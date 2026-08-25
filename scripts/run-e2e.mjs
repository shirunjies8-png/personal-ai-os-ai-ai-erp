import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const OCR_TIMEOUT_CONTRACT = require('../ocr-timeout-contract.js');
const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const chromePort = Number(process.env.E2E_CHROME_PORT || 9222);
const environmentOnly = process.argv.includes('--environment-only');
const materialIssueScenarioA = process.argv.includes('--material-issue-scenario-a') || process.env.E2E_MATERIAL_ISSUE_SCENARIO_A === '1';
const materialIssueScenarioB = process.argv.includes('--material-issue-scenario-b') || process.env.E2E_MATERIAL_ISSUE_SCENARIO_B === '1';
const materialIssueScenarioC = process.argv.includes('--material-issue-scenario-c') || process.env.E2E_MATERIAL_ISSUE_SCENARIO_C === '1';
const materialIssueScenarioD = process.argv.includes('--material-issue-scenario-d') || process.env.E2E_MATERIAL_ISSUE_SCENARIO_D === '1';
const materialIssueScenarioE = process.argv.includes('--material-issue-scenario-e') || process.env.E2E_MATERIAL_ISSUE_SCENARIO_E === '1';
const quotationOnly = process.argv.includes('--quotation-only');
const rfqOnly = process.argv.includes('--rfq-only') || process.env.E2E_RFQ_ONLY === '1';
const ocrOnly = process.argv.includes('--ocr-only') || process.env.E2E_OCR_ONLY === '1';
const ocrCdpMinimal = process.argv.includes('--ocr-cdp-minimal') || process.env.E2E_OCR_CDP_MINIMAL === '1';
let sharedBrowserConnection = null;
let sharedBrowserEvidence = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function boundedCdpCall(call, timeoutMs, label) {
  let timer;
  return Promise.race([
    Promise.resolve().then(call),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${timeoutMs}ms`), { code: 'CDP_METHOD_TIMEOUT' })), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await fetch(url, { method: 'GET' });
      return true;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`等待服务超时：${url}`);
}

async function chromeTabs() {
  const res = await fetch(`http://127.0.0.1:${chromePort}/json/list`);
  if (!res.ok) throw new Error('未能连接 Chrome 远程调试端口');
  return res.json();
}

async function chromeVersion() {
  const res = await fetch(`http://127.0.0.1:${chromePort}/json/version`);
  if (!res.ok) throw new Error('未能读取 Chrome 版本信息');
  return res.json();
}

async function chromeNewTab(url) {
  const browser = await getSharedBrowserConnection();
  const result = await browser.send('Target.createTarget', { url });
  return { ...result, browserWs: browser.ws, browserSend: browser.send, browserEvidence: sharedBrowserEvidence, browser };
}

async function getSharedBrowserConnection() {
  if (sharedBrowserConnection?.ws?.readyState === WebSocket.OPEN) return sharedBrowserConnection;
  const version = await chromeVersion();
  if (!version.webSocketDebuggerUrl) throw new Error('Chrome 未提供浏览器级调试入口');
  sharedBrowserEvidence = {
    browserPid: process.env.E2E_CHROME_PID || '',
    transportKind: 'browser',
    expectedClose: false,
    currentStep: 'shared_browser_connect',
    lifecycleTrace: [],
    targetEvents: []
  };
  sharedBrowserConnection = await cdpConnect(version.webSocketDebuggerUrl, sharedBrowserEvidence, message => {
    if (!['Target.targetCreated', 'Target.targetDestroyed', 'Target.targetInfoChanged', 'Target.attachedToTarget', 'Target.detachedFromTarget', 'Target.targetCrashed'].includes(message.method)) return;
    const detail = {
      timestamp: new Date().toISOString(),
      method: message.method,
      targetId: message.params?.targetId || message.params?.targetInfo?.targetId || '',
      sessionId: message.params?.sessionId || '',
      targetType: message.params?.targetInfo?.type || '',
      targetUrl: message.params?.targetInfo?.url || '',
      status: message.params?.status || '',
      errorCode: message.params?.errorCode ?? null
    };
    sharedBrowserEvidence.targetEvents.push(detail);
    console.error(`TARGET_LIFECYCLE_EVIDENCE ${JSON.stringify(detail)}`);
  });
  sharedBrowserEvidence.browserWs = sharedBrowserConnection.ws;
  await sharedBrowserConnection.send('Target.setDiscoverTargets', { discover: true });
  return sharedBrowserConnection;
}

function closeSharedBrowserConnection() {
  if (sharedBrowserConnection?.ws?.readyState === WebSocket.OPEN) {
    sharedBrowserEvidence.expectedClose = true;
    sharedBrowserConnection.ws.close();
  }
}

// The dedicated Chrome profile starts with no clipboard permission.  Granting
// this browser permission to the local test origin keeps the UI interaction
// real (the CDP mouse gesture below still triggers the production handler)
// while avoiding a test-only clipboard mock or a false audit assertion.
async function grantLocalClipboardPermission() {
  const version = await chromeVersion();
  const { ws, send } = await cdpConnect(version.webSocketDebuggerUrl);
  try {
    await send('Browser.grantPermissions', {
      origin: baseUrl,
      permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite']
    });
  } finally {
    ws.close();
  }
}

function pickTab(tabs, targetUrl = '') {
  const pages = tabs.filter(tab => tab.type === 'page' && !String(tab.url || '').startsWith('chrome-extension://'));
  return pages.find(tab => tab.url === targetUrl)
    || pages.find(tab => tab.url === 'about:blank')
    || pages.find(tab => targetUrl && String(tab.url || '').startsWith(targetUrl))
    || pages[0]
    || tabs.find(tab => tab.type === 'page')
    || tabs[0];
}

function wsStatus(ws) {
  return ['connecting', 'open', 'closing', 'closed'][ws?.readyState] || 'unknown';
}

function processAlive(pidValue) {
  const pid = Number(pidValue);
  if (!Number.isInteger(pid) || pid < 1) return 'UNKNOWN';
  try {
    process.kill(pid, 0);
    return 'ALIVE';
  } catch (error) {
    return error?.code === 'ESRCH' ? 'EXITED' : 'UNKNOWN';
  }
}

function evaluateExpressionCategory(expression) {
  const value = String(expression || '').trim();
  if (value === '1 + 1') return 'ARITHMETIC_PRECHECK';
  if (value === 'location.href') return 'LOCATION_READ';
  if (value.includes('document.readyState')) return 'DOCUMENT_STATE';
  return 'OTHER';
}

function traceLifecycle(trace, { step, event, session = null, browserWs = null, details = {} }) {
  if (!trace) return;
  trace.push({
    timestamp: new Date().toISOString(),
    step,
    event,
    browser_status: wsStatus(browserWs),
    context_status: session?.expectedClose ? 'closing' : (session?.disconnectedAt ? 'closed' : 'active'),
    page_status: session?.pageWs ? wsStatus(session.pageWs) : (session?.disconnectedAt ? 'closed' : 'unknown'),
    role: session?.role || '',
    page_url: session?.pageUrl || '',
    ...details
  });
}

async function cdpConnect(wsUrl, sessionEvidence = null, onEvent = null) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  const listeners = new Set();
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.method) events.push(msg);
    if (msg.method) onEvent?.(msg, ws);
    if (msg.method) for (const listener of listeners) listener(msg, ws);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  // A closed CDP transport can otherwise leave an awaited browser action
  // without active Node handles, letting a failed acceptance run exit as 0.
  // Reject outstanding operations so the unified verifier records the actual
  // browser-environment failure instead of reporting a false READY result.
  ws.onclose = event => {
    if (sessionEvidence) {
      sessionEvidence.disconnectedAt = new Date().toISOString();
      sessionEvidence.disconnectCode = event.code;
      sessionEvidence.disconnectReason = event.reason || '';
      traceLifecycle(sessionEvidence.lifecycleTrace, {
        step: sessionEvidence.currentStep || 'unknown',
        event: sessionEvidence.transportKind === 'browser' ? 'browser_disconnected' : 'page_cdp_disconnected',
        session: sessionEvidence,
        browserWs: sessionEvidence.browserWs,
        details: { close_code: event.code, close_reason: event.reason || '', expected_close: Boolean(sessionEvidence.expectedClose) }
      });
      console.error(`CDP_DISCONNECT_EVIDENCE ${JSON.stringify({
        chromePid: process.env.E2E_CHROME_PID || null,
        chromeProcessState: processAlive(process.env.E2E_CHROME_PID),
        browserWebSocketState: sessionEvidence.browserWs
          ? wsStatus(sessionEvidence.browserWs)
          : (sessionEvidence.browserWebSocketState || 'UNKNOWN'),
        pageWebSocketState: wsStatus(ws),
        targetId: sessionEvidence.targetId || null,
        browserContextId: sessionEvidence.browserContextId || null,
        pageUrl: sessionEvidence.pageUrl || null,
        lastCdpMethod: sessionEvidence.lastCdpMethod || null,
        runtimeEvaluateExpressionCategory: sessionEvidence.runtimeEvaluateExpressionCategory || null,
        disconnectCode: event.code,
        disconnectReason: event.reason || '',
        expectedClose: Boolean(sessionEvidence.expectedClose)
      })}`);
    }
    const error = new Error('Chrome CDP connection closed before browser acceptance completed');
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
    for (const listener of listeners) listener({ method: 'Browser.transportClosed', params: { code: event.code, reason: event.reason || '' } }, ws);
  };
  const send = (method, params = {}, sessionId = '') => new Promise((resolve, reject) => {
    if (sessionEvidence) {
      sessionEvidence.lastCdpMethod = method;
      if (method === 'Runtime.evaluate') {
        sessionEvidence.runtimeEvaluateExpressionCategory = evaluateExpressionCategory(params.expression);
      }
    }
    if (ws.readyState !== WebSocket.OPEN) {
      reject(new Error(`Chrome CDP is unavailable during ${method}`));
      return;
    }
    const current = ++id;
    pending.set(current, { resolve, reject });
    ws.send(JSON.stringify({ id: current, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return {
    ws,
    send,
    events,
    addEventListener(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

async function findTarget(targetId, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const target = (await chromeTabs()).find(tab => tab.id === targetId);
    if (target?.webSocketDebuggerUrl) return target;
    await sleep(100);
  }
  throw new Error(`Chrome target ${targetId} 未就绪`);
}

// Scenario acceptance roles must not share cookies or localStorage. Chrome's
// CDP BrowserContext provides the equivalent isolation boundary without
// changing the application or bypassing its real JWT login flow.
async function openIsolatedPage(url, role, evidence) {
  const version = await chromeVersion();
  if (!version.webSocketDebuggerUrl) throw new Error('Chrome 未提供浏览器级调试入口');
  evidence.lifecycleTrace = evidence.lifecycleTrace || [];
  evidence.role = role;
  evidence.transportKind = 'browser';
  evidence.currentStep = `${role}_context_create`;
  const browser = await cdpConnect(version.webSocketDebuggerUrl, evidence, msg => {
    if (['Target.targetDestroyed', 'Target.targetInfoChanged'].includes(msg.method)) {
      traceLifecycle(evidence.lifecycleTrace, {
        step: evidence.currentStep,
        event: msg.method === 'Target.targetDestroyed' ? 'page_closed' : 'target_state_changed',
        session: evidence,
        browserWs: browser.ws,
        details: { cdp_event: msg.method, target_id: msg.params?.targetId || msg.params?.targetInfo?.targetId || '' }
      });
    }
  });
  evidence.browserWs = browser.ws;
  const context = await browser.send('Target.createBrowserContext');
  traceLifecycle(evidence.lifecycleTrace, { step: evidence.currentStep, event: 'context_created', session: evidence, browserWs: browser.ws, details: { browser_context_id: context.browserContextId } });
  const target = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: context.browserContextId });
  const targetInfo = await findTarget(target.targetId);
  const pageEvidence = {
    role,
    browserPid: process.env.E2E_CHROME_PID || '',
    browserContextId: context.browserContextId,
    targetId: target.targetId,
    createdAt: new Date().toISOString(),
    currentStep: 'page_open',
    lifecycleTrace: evidence.lifecycleTrace,
    transportKind: 'page',
    browserWs: browser.ws
  };
  const page = await cdpConnect(targetInfo.webSocketDebuggerUrl, pageEvidence, msg => {
    if (['Inspector.detached', 'Page.lifecycleEvent'].includes(msg.method)) {
      traceLifecycle(evidence.lifecycleTrace, {
        step: pageEvidence.currentStep,
        event: msg.method === 'Inspector.detached' ? 'page_detached' : 'page_lifecycle',
        session: pageEvidence,
        browserWs: browser.ws,
        details: { cdp_event: msg.method, reason: msg.params?.reason || '', lifecycle_name: msg.params?.name || '' }
      });
    }
  });
  pageEvidence.pageWs = page.ws;
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Log.enable').catch(() => {});
  await page.send('Network.enable').catch(() => {});
  await page.send('Page.navigate', { url });
  await sleep(1500);
  pageEvidence.pageUrl = url;
  traceLifecycle(evidence.lifecycleTrace, { step: pageEvidence.currentStep, event: 'page_ready', session: pageEvidence, browserWs: browser.ws, details: { browser_context_id: context.browserContextId, target_id: target.targetId } });
  return { ...page, ...pageEvidence, browserWs: browser.ws, browserSend: browser.send, pageEvidence, browserEvidence: evidence };
}

async function closeIsolatedPage(session, reason = 'context_close') {
  if (!session) return;
  session.pageEvidence.expectedClose = true;
  if (session.browserEvidence) session.browserEvidence.expectedClose = true;
  session.pageEvidence.closeReason = reason;
  session.pageEvidence.closedAt = new Date().toISOString();
  traceLifecycle(session.pageEvidence.lifecycleTrace, { step: session.pageEvidence.currentStep || 'cleanup', event: 'page_close_requested', session: session.pageEvidence, browserWs: session.browserWs, details: { reason } });
  try { await session.browserSend('Target.closeTarget', { targetId: session.targetId }); } catch {}
  traceLifecycle(session.pageEvidence.lifecycleTrace, { step: session.pageEvidence.currentStep || 'cleanup', event: 'context_close_requested', session: session.pageEvidence, browserWs: session.browserWs, details: { reason } });
  try { await session.browserSend('Target.disposeBrowserContext', { browserContextId: session.browserContextId }); } catch {}
  try { session.ws.close(); } catch {}
  try { session.browserWs.close(); } catch {}
}

async function openPage(url) {
  // Each test owns a fresh, ordinary page target. Reusing Chrome's launch
  // tab made navigation races look like product failures when CDP detached.
  const created = await chromeNewTab('about:blank');
  const tab = await findTarget(created.targetId);
  if (!tab?.webSocketDebuggerUrl || /^(chrome|devtools|chrome-extension):/i.test(String(tab.url || ''))) {
    throw new Error(`未获得可用于 E2E 的 page target：${String(tab?.url || '')}`);
  }
  // A flattened session can evaluate a background target, but trusted mouse
  // input is dispatched only to the active page. Make target ownership
  // explicit before attaching so a real click cannot silently hit Chrome's
  // launch tab after a prior scenario closes.
  await created.browserSend('Target.activateTarget', { targetId: created.targetId });
  const pageEvidence = {
    browserPid: process.env.E2E_CHROME_PID || '',
    browserWebSocketState: 'OPEN_DURING_PAGE_SESSION',
    browserWs: created.browserWs,
    browserEvidence: created.browserEvidence,
    browserContextId: null,
    targetId: created.targetId,
    pageUrl: tab.url || 'about:blank',
    currentStep: 'open_page',
    expectedClose: false,
    transportKind: 'page',
    lifecycleTrace: [],
    pageEvents: []
  };
  const attached = await created.browserSend('Target.attachToTarget', { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  pageEvidence.sessionId = sessionId;
  const events = [];
  const removePageListener = created.browser.addEventListener(message => {
    if (message.sessionId !== sessionId && message.params?.sessionId !== sessionId) return;
    if (message.method) events.push(message);
    if (message.method === 'Target.detachedFromTarget') {
      pageEvidence.sessionState = 'DETACHED';
      pageEvidence.detachReason = message.params?.reason || '';
    }
    if (!['Target.detachedFromTarget', 'Inspector.detached', 'Page.frameNavigated', 'Page.lifecycleEvent', 'Runtime.executionContextsCleared', 'Runtime.executionContextCreated'].includes(message.method)) return;
    const detail = {
      timestamp: new Date().toISOString(),
      method: message.method,
      reason: message.params?.reason || '',
      frameUrl: message.params?.frame?.url || '',
      lifecycleName: message.params?.name || '',
      executionContextId: message.params?.context?.id ?? null
    };
    pageEvidence.pageEvents.push(detail);
  });
  const send = (method, params = {}) => {
    pageEvidence.lastCdpMethod = method;
    if (method === 'Runtime.evaluate') pageEvidence.runtimeEvaluateExpressionCategory = evaluateExpressionCategory(params.expression);
    return created.browserSend(method, params, sessionId);
  };
  let pageReadyState = WebSocket.OPEN;
  const ws = {
    get readyState() { return pageReadyState; },
    close() {
      if (pageReadyState !== WebSocket.OPEN) return;
      pageEvidence.expectedClose = true;
      pageReadyState = WebSocket.CLOSING;
      removePageListener();
      created.browserSend('Target.closeTarget', { targetId: created.targetId })
        .catch(() => {})
        .finally(() => { pageReadyState = WebSocket.CLOSED; });
    }
  };
  const removeTransportListener = created.browser.addEventListener(message => {
    if (message.method !== 'Browser.transportClosed') return;
    pageReadyState = WebSocket.CLOSED;
    console.error(`PAGE_TARGET_AFTER_DISCONNECT ${JSON.stringify({
      timestamp: new Date().toISOString(), targetId: created.targetId,
      targetAfterFailure: 'UNKNOWN_BROWSER_TRANSPORT_CLOSED',
      chromeProcessState: processAlive(process.env.E2E_CHROME_PID),
      browserWebSocketState: wsStatus(created.browserWs), pageWebSocketState: 'SESSION_DETACHED',
      disconnectCode: message.params?.code ?? null, disconnectReason: message.params?.reason || '',
      pageEvents: pageEvidence.pageEvents.slice(-20),
      targetEvents: created.browserEvidence.targetEvents.filter(item => item.targetId === created.targetId).slice(-20)
    })}`);
    removeTransportListener();
  });
  await send('Page.enable');
  await send('Page.bringToFront');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable').catch(() => {});
  await send('Page.navigate', { url });
  await sleep(4000);
  pageEvidence.pageUrl = url;
  return { ws, send, events, pageEvidence };
}

async function recordOcrLifecycleStep(pageEvidence, send, step) {
  pageEvidence.currentStep = step;
  const state = JSON.parse(await evalValue(send, `JSON.stringify({
    href: location.href,
    readyState: document.readyState,
    title: document.title
  })`));
  const detail = {
    timestamp: new Date().toISOString(),
    step,
    targetId: pageEvidence.targetId,
    browserContextId: pageEvidence.browserContextId,
    ...state
  };
  console.error(`OCR_PAGE_LIFECYCLE_STEP ${JSON.stringify(detail)}`);
  return detail;
}

// OCR can legitimately occupy its worker for the product timeout window. This
// monitor deliberately uses a separate browser-level transport and a bounded,
// read-only Target.getTargets call every ten seconds: it observes ownership
// without repeatedly evaluating page JavaScript or altering OCR timing.
async function startOcrLongRunMonitor(pageEvidence) {
  const version = await chromeVersion();
  const monitorEvidence = {
    transportKind: 'ocr_health_monitor',
    browserPid: process.env.E2E_CHROME_PID || '',
    currentStep: 'ocr_long_run_monitor',
    targetEvents: [],
    targetId: pageEvidence.targetId,
    sessionId: pageEvidence.sessionId,
    samples: []
  };
  const monitor = await cdpConnect(version.webSocketDebuggerUrl, monitorEvidence, message => {
    if (!['Target.detachedFromTarget', 'Target.targetDestroyed', 'Target.targetCrashed', 'Inspector.detached'].includes(message.method)) return;
    const detail = {
      timestamp: new Date().toISOString(),
      method: message.method,
      targetId: message.params?.targetId || message.params?.targetInfo?.targetId || '',
      sessionId: message.params?.sessionId || '',
      reason: message.params?.reason || '',
      status: message.params?.status || ''
    };
    monitorEvidence.targetEvents.push(detail);
    console.error(`OCR_INFRA_EVENT ${JSON.stringify(detail)}`);
  });
  await monitor.send('Target.setDiscoverTargets', { discover: true });
  let stopped = false;
  let running = false;
  const sample = async (phase = 'periodic') => {
    if (stopped || running) return;
    running = true;
    const record = {
      timestamp: new Date().toISOString(),
      phase,
      chromePid: processAlive(process.env.E2E_CHROME_PID),
      browserWebSocket: wsStatus(pageEvidence.browserWs),
      monitorWebSocket: wsStatus(monitor.ws),
      sessionId: pageEvidence.sessionId || 'UNKNOWN',
      targetId: pageEvidence.targetId || 'UNKNOWN',
      browserContextId: pageEvidence.browserContextId || 'NONE',
      currentUrl: pageEvidence.pageUrl || 'UNKNOWN',
      lastSuccessfulCdpMethod: pageEvidence.lastCdpMethod || 'UNKNOWN',
      targetExists: 'UNKNOWN',
      sessionState: pageEvidence.sessionState || 'ATTACHED',
      targetCrashed: false
    };
    try {
      const result = await boundedCdpCall(() => monitor.send('Target.getTargets'), 3000, 'Target.getTargets');
      const target = (result.targetInfos || []).find(item => item.targetId === pageEvidence.targetId);
      record.targetExists = target ? 'EXISTS' : 'MISSING';
      record.currentUrl = target?.url || record.currentUrl;
    } catch (error) {
      record.targetQuery = error.code || error.message || 'UNKNOWN';
    } finally {
      monitorEvidence.samples.push(record);
      console.error(`OCR_INFRA_HEALTH ${JSON.stringify(record)}`);
      running = false;
    }
  };
  await sample('start');
  const timer = setInterval(() => { sample('periodic').catch(() => {}); }, 10000);
  return {
    evidence: monitorEvidence,
    async stop() {
      stopped = true;
      clearInterval(timer);
      await sample('stop');
      try { monitor.ws.close(); } catch {}
    }
  };
}

async function evalValue(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    const exception = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime.evaluate failed';
    throw new Error(`浏览器脚本执行失败：${exception}`);
  }
  return result.result.value;
}

async function setAuth(send, requestedCredentials = null) {
  const credentials = requestedCredentials || {
    enterpriseName: 'Personal AI OS Demo Enterprise',
    name: '企业管理员',
    email: 'admin@personal-ai-os.local',
    password: '123456',
    role: '企业管理员'
  };
  let auth;
  try {
    auth = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: credentials.email, password: credentials.password })
    }).then(async response => {
      const text = await response.text();
      const json = text ? JSON.parse(text) : null;
      if (!response.ok) throw new Error(json?.message || text || `HTTP ${response.status}`);
      return json;
    });
  } catch {
    auth = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    }).then(async response => {
      const text = await response.text();
      const json = text ? JSON.parse(text) : null;
      if (!response.ok) throw new Error(json?.message || text || `HTTP ${response.status}`);
      return json;
    });
  }
  const session = {
    token: auth.data?.token || auth.token || '',
    user: auth.data?.user || auth.user || {
      email: credentials.email,
      name: credentials.name,
      role: credentials.role
    },
    enterprise: auth.data?.enterprise || auth.enterprise || {
      name: credentials.enterpriseName
    },
    demo: false
  };
  await evalValue(send, `localStorage.setItem('personal-ai-os-auth', JSON.stringify(${JSON.stringify(session)}));`);
  return session;
}

async function waitForValue(read, predicate, label, timeoutMs = 15000) {
  const started = Date.now();
  let value;
  while (Date.now() - started < timeoutMs) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(250);
  }
  throw new Error(`${label} 超时：${JSON.stringify(value)}`);
}

async function requestApi(pathname, token, { method = 'GET', body: requestBody } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(requestBody === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) })
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { status: response.status, ok: response.ok, body };
}

async function waitForNetworkResponse(page, urlPart, timeoutMs = 5000, method = '') {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const match = [...page.events].reverse().find(event => {
      if (event.method !== 'Network.responseReceived' || !event.params?.response?.url?.includes(urlPart)) return false;
      if (!method) return true;
      return page.events.some(request => request.method === 'Network.requestWillBeSent' && request.params?.requestId === event.params.requestId && request.params?.request?.method === method);
    });
    if (match) {
      let responseText = '';
      try {
        const body = await page.send('Network.getResponseBody', { requestId: match.params.requestId });
        responseText = String(body?.body || '');
      } catch {}
      const bodySummary = responseText.slice(0, 500);
      let body = null;
      try { body = responseText ? JSON.parse(responseText) : null; } catch { body = { raw: bodySummary }; }
      return { url: match.params.response.url, status: match.params.response.status, requestId: match.params.requestId, bodySummary, body };
    }
    await sleep(50);
  }
  throw new Error(`未观察到浏览器响应：${urlPart}`);
}

async function samplePageState(page) {
  const targets = await page.browserSend('Target.getTargets');
  return {
    browserConnected: wsStatus(page.browserWs) === 'open',
    pageClosed: wsStatus(page.ws) === 'closed',
    pageUrl: await evalValue(page.send, 'location.href'),
    contextPages: (targets.targetInfos || []).filter(target => target.browserContextId === page.browserContextId && target.type === 'page').length
  };
}

function readScenarioBDatabaseEvidence({ operationId, preparationId }) {
  const dbPath = process.env.E2E_FIXTURE_DB_PATH;
  if (!dbPath) throw new Error('缺少隔离 Fixture SQLite 路径');
  const db = new Database(dbPath, { readonly: true });
  try {
    const inventory = db.prepare('SELECT id, stock_quantity, safety_stock, version FROM inventory WHERE id = ?').get('fixture-normal');
    const requisition = db.prepare('SELECT id, status, quantity, preparation_id FROM material_requisitions WHERE enterprise_id = ? AND business_operation_id = ?').get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const transaction = db.prepare('SELECT id, status, transaction_type, preparation_id, run_id FROM business_transactions WHERE enterprise_id = ? AND business_operation_id = ? ORDER BY created_at DESC LIMIT 1').get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const issueCount = db.prepare("SELECT count(*) AS count FROM stock_transactions WHERE enterprise_id = ? AND business_operation_id = ? AND transaction_type = 'INVENTORY_ISSUE'").get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const preparation = db.prepare('SELECT id, run_id, status FROM transaction_preparations WHERE id = ?').get(preparationId);
    const trace = preparation?.run_id ? {
      run: db.prepare('SELECT run_id, execution_status, verification_status FROM runtime_runs WHERE run_id = ?').get(preparation.run_id),
      attempts: db.prepare('SELECT count(*) AS count FROM runtime_attempts WHERE run_id = ?').get(preparation.run_id),
      validations: db.prepare('SELECT count(*) AS count FROM runtime_validations WHERE run_id = ?').get(preparation.run_id),
      approval: db.prepare('SELECT status, decided_by, reason FROM runtime_approvals WHERE run_id = ?').get(preparation.run_id)
    } : null;
    return { inventory, requisition, transaction, issueCount, preparation, trace };
  } finally {
    db.close();
  }
}

function isRejectedScenarioBState(evidence) {
  return evidence.inventory?.stock_quantity === 100
    && evidence.inventory?.version === 0
    && evidence.issueCount?.count === 0
    && evidence.requisition?.status === 'REJECTED'
    && evidence.preparation?.status === 'REJECTED'
    && evidence.transaction?.status !== 'COMMITTED'
    && evidence.trace?.run
    && evidence.trace?.run?.execution_status !== 'SUCCESS'
    && evidence.trace?.run?.verification_status !== 'VERIFIED'
    && evidence.trace?.attempts?.count > 0
    && evidence.trace?.validations?.count > 0
    && evidence.trace?.approval?.status === 'REJECTED';
}

function classifyProtectedExecution({ preconditions, response }) {
  const raw = {
    step: 'post_rejection_execute_attempt',
    timestamp: new Date().toISOString(),
    request_url: response.url,
    http_method: 'POST',
    status_code: response.status,
    response_body: response.body
  };
  if (!preconditions) return { classification: 'UNEXPECTED_FAILURE', raw, reason: '执行前未确认 REJECTED 业务状态' };
  const protectedStatuses = new Set([400, 403, 409, 422]);
  if (protectedStatuses.has(response.status) && response.body?.data?.preparation?.status !== 'COMMITTED') {
    return { classification: 'EXPECTED_BUSINESS_BLOCK', raw, reason: '已拒绝申请的受保护执行端点拒绝后续扣减' };
  }
  return { classification: 'UNEXPECTED_FAILURE', raw, reason: '受保护执行端点未返回可接受的业务阻断响应' };
}

function readScenarioCDatabaseEvidence({ operationId, preparationId }) {
  const dbPath = process.env.E2E_FIXTURE_DB_PATH;
  if (!dbPath) throw new Error('缺少隔离 Fixture SQLite 路径');
  const db = new Database(dbPath, { readonly: true });
  try {
    const inventory = db.prepare('SELECT id, product_code, stock_quantity, safety_stock, version FROM inventory WHERE id = ?').get('fixture-insufficient');
    const requisition = db.prepare('SELECT id, status, quantity, preparation_id FROM material_requisitions WHERE enterprise_id = ? AND business_operation_id = ?').get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const transaction = db.prepare('SELECT id, status, transaction_type, preparation_id, run_id, failure_reason FROM business_transactions WHERE enterprise_id = ? AND business_operation_id = ? ORDER BY created_at DESC LIMIT 1').get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const issueCount = db.prepare("SELECT count(*) AS count FROM stock_transactions WHERE enterprise_id = ? AND business_operation_id = ? AND transaction_type = 'INVENTORY_ISSUE'").get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const preparation = db.prepare('SELECT id, run_id, status, validation_result FROM transaction_preparations WHERE id = ?').get(preparationId);
    const trace = preparation?.run_id ? {
      run: db.prepare('SELECT run_id, execution_status, verification_status, error_code, error_message FROM runtime_runs WHERE run_id = ?').get(preparation.run_id),
      attempts: db.prepare('SELECT count(*) AS count FROM runtime_attempts WHERE run_id = ?').get(preparation.run_id),
      validations: db.prepare('SELECT count(*) AS count FROM runtime_validations WHERE run_id = ?').get(preparation.run_id),
      approval: db.prepare('SELECT status, decided_by, reason FROM runtime_approvals WHERE run_id = ?').get(preparation.run_id)
    } : null;
    return { inventory, requisition, transaction, issueCount, preparation, trace };
  } finally {
    db.close();
  }
}

function isInsufficientScenarioCState(evidence) {
  return evidence.inventory?.stock_quantity === 10
    && evidence.inventory?.version === 0
    && evidence.issueCount?.count === 0
    && evidence.requisition?.status === 'FAILED'
    && evidence.preparation?.status === 'FAILED'
    && evidence.transaction?.status !== 'COMMITTED'
    && evidence.trace?.run?.execution_status === 'FAILED'
    && evidence.trace?.run?.verification_status === 'FAILED_VERIFICATION'
    && evidence.trace?.attempts?.count > 0
    && evidence.trace?.validations?.count > 0
    && evidence.trace?.approval?.status === 'APPROVED';
}

function classifyInsufficientExecution({ preconditions, response }) {
  const raw = {
    step: 'insufficient_inventory_execute_attempt',
    timestamp: new Date().toISOString(),
    request_url: response.url,
    http_method: 'POST',
    status_code: response.status,
    response_body: response.body
  };
  if (!preconditions) return { classification: 'UNEXPECTED_FAILURE', raw, reason: '执行前未确认库存不足的已审批申请' };
  const finalStatus = response.body?.data?.preparation?.status;
  if (response.status >= 200 && response.status < 300 && finalStatus === 'FAILED') {
    return { classification: 'EXPECTED_BUSINESS_BLOCK', raw, reason: '执行阶段重新校验库存不足，未提交库存扣减' };
  }
  if (new Set([400, 403, 409, 422]).has(response.status) && finalStatus !== 'COMMITTED') {
    return { classification: 'EXPECTED_BUSINESS_BLOCK', raw, reason: '已审批库存不足申请被受保护执行端点阻止' };
  }
  return { classification: 'UNEXPECTED_FAILURE', raw, reason: '库存不足执行未返回可验证的业务阻断结果' };
}

function fixtureCredentials(kind) {
  const email = process.env[`E2E_FIXTURE_${kind}_EMAIL`];
  const password = process.env[`E2E_FIXTURE_${kind}_PASSWORD`];
  if (!email || !password) throw new Error(`缺少隔离 Fixture ${kind} 登录凭据`);
  return { email, password, name: kind === 'APPROVER' ? 'Fixture Approver' : `Fixture ${kind.replace('_', ' ')}` };
}

function readScenarioADatabaseEvidence({ operationId, preparationId }) {
  const dbPath = process.env.E2E_FIXTURE_DB_PATH;
  if (!dbPath) throw new Error('缺少隔离 Fixture SQLite 路径');
  const db = new Database(dbPath, { readonly: true });
  try {
    const inventory = db.prepare('SELECT id, stock_quantity, safety_stock, version FROM inventory WHERE id = ?').get('fixture-normal');
    const requisition = db.prepare('SELECT id, status, quantity, preparation_id FROM material_requisitions WHERE enterprise_id = ? AND business_operation_id = ?').get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const transaction = db.prepare('SELECT id, status, transaction_type, preparation_id, run_id FROM business_transactions WHERE enterprise_id = ? AND business_operation_id = ? ORDER BY created_at DESC LIMIT 1').get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const stockTransaction = db.prepare('SELECT transaction_type, quantity_delta, stock_before, stock_after, transaction_id FROM stock_transactions WHERE enterprise_id = ? AND business_operation_id = ?').get(process.env.E2E_FIXTURE_ENTERPRISE_ID, operationId);
    const preparation = db.prepare('SELECT id, run_id, status FROM transaction_preparations WHERE id = ?').get(preparationId);
    const trace = preparation?.run_id ? {
      run: db.prepare('SELECT run_id, execution_status, verification_status FROM runtime_runs WHERE run_id = ?').get(preparation.run_id),
      attempts: db.prepare('SELECT count(*) AS count FROM runtime_attempts WHERE run_id = ?').get(preparation.run_id),
      validations: db.prepare('SELECT count(*) AS count FROM runtime_validations WHERE run_id = ?').get(preparation.run_id)
    } : null;
    return { inventory, requisition, transaction, stockTransaction, preparation, trace };
  } finally {
    db.close();
  }
}

async function testMaterialIssueScenarioA() {
  const requesterCredentials = fixtureCredentials('REQUESTER');
  const approverCredentials = fixtureCredentials('APPROVER');
  const operationId = `FIXTURE-ISSUE-A-${Date.now()}`;
  const quantity = 30;
  const uiEvidence = [];
  const { ws, send, events } = await openPage(`${baseUrl}/#/inventory`);
  try {
    const requesterSession = await setAuth(send, requesterCredentials);
    await send('Page.reload');
    await sleep(1500);
    const initialUi = await evalValue(send, `document.getElementById('materialIssueWorkflow')?.innerText || ''`);
    if (!initialUi.includes('真实领料申请')) throw new Error('Requester 未打开真实领料工作区');
    uiEvidence.push({ action: 'Requester 登录并打开库存页', state: initialUi.slice(0, 800) });

    await evalValue(send, `(() => {
      window.confirm = () => true;
      const inventory = document.getElementById('materialIssueInventory');
      const operation = document.getElementById('materialIssueOperation');
      const quantity = document.getElementById('materialIssueQuantity');
      inventory.value = 'fixture-normal';
      inventory.dispatchEvent(new Event('change', { bubbles: true }));
      operation.value = ${JSON.stringify(operationId)};
      operation.dispatchEvent(new Event('input', { bubbles: true }));
      quantity.value = '30';
      quantity.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-action="material-issue-prepare"]')?.click();
      return Boolean(document.querySelector('[data-action="material-issue-prepare"]'));
    })()`);
    const waiting = await waitForValue(
      () => evalValue(send, `JSON.stringify({ id: window.App?.temp?.materialIssue?.preparationId || '', status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`).then(JSON.parse),
      value => value.status === 'WAITING_APPROVAL' && value.id,
      '领料预检查进入 WAITING_APPROVAL'
    );
    const preparationId = waiting.id;
    uiEvidence.push({ action: 'Requester 创建并提交审批', state: waiting.ui.slice(0, 1200) });

    const approverSession = await setAuth(send, approverCredentials);
    await send('Page.reload');
    await sleep(1200);
    await evalValue(send, `(() => { window.App.temp.materialIssue.preparationId = ${JSON.stringify(preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation', ${JSON.stringify(preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    await evalValue(send, `window.prompt = () => 'Fixture Scenario A approval'; window.confirm = () => true; document.querySelector('[data-action="material-issue-approve"]')?.click();`);
    const approved = await waitForValue(
      () => evalValue(send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`).then(JSON.parse),
      value => value.status === 'APPROVED',
      'Approver 批准领料申请'
    );
    uiEvidence.push({ action: 'Approver 批准', state: approved.ui.slice(0, 1200) });

    await setAuth(send, requesterCredentials);
    await send('Page.reload');
    await sleep(1200);
    await evalValue(send, `(() => { window.App.temp.materialIssue.preparationId = ${JSON.stringify(preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation', ${JSON.stringify(preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    await evalValue(send, `window.confirm = () => true; document.querySelector('[data-action="material-issue-execute"]')?.click();`);
    const committed = await waitForValue(
      () => evalValue(send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`).then(JSON.parse),
      value => value.status === 'COMMITTED',
      'Requester 执行受控库存扣减'
    );
    uiEvidence.push({ action: 'Requester 执行领料', state: committed.ui.slice(0, 1200) });

    const preparationResponse = await requestApi(`/api/transaction-safety/preparations/${encodeURIComponent(preparationId)}`, requesterSession.token);
    const requisitionsResponse = await requestApi('/api/transaction-safety/requisitions', requesterSession.token);
    if (preparationResponse.status !== 200 || preparationResponse.body?.data?.preparation?.status !== 'COMMITTED') throw new Error(`领料详情 API 未返回 COMMITTED：${JSON.stringify(preparationResponse)}`);
    if (requisitionsResponse.status !== 200 || !requisitionsResponse.body?.data?.items?.some(item => item.business_operation_id === operationId && item.status === 'COMMITTED')) throw new Error(`领料列表 API 缺少 COMMITTED 申请：${JSON.stringify(requisitionsResponse)}`);
    const databaseEvidence = readScenarioADatabaseEvidence({ operationId, preparationId });
    const dbChecks = databaseEvidence.inventory?.stock_quantity === 70
      && databaseEvidence.inventory?.version === 1
      && databaseEvidence.stockTransaction?.transaction_type === 'INVENTORY_ISSUE'
      && databaseEvidence.stockTransaction?.quantity_delta === -quantity
      && databaseEvidence.requisition?.status === 'COMMITTED'
      && databaseEvidence.transaction?.status === 'COMMITTED'
      && databaseEvidence.trace?.run
      && databaseEvidence.trace?.attempts?.count > 0
      && databaseEvidence.trace?.validations?.count > 0;
    if (!dbChecks) throw new Error(`Scenario A SQLite 证据不完整：${JSON.stringify(databaseEvidence)}`);
    const browserErrors = events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'));
    if (browserErrors.length) throw new Error(`Scenario A 页面出现浏览器错误：${JSON.stringify(browserErrors.slice(-2))}`);
    const evidence = {
      scenario: 'A-normal-material-issue',
      status: 'VERIFIED',
      operationId,
      preparationId,
      uiEvidence,
      apiEvidence: { preparation: { status: preparationResponse.status, state: preparationResponse.body?.data?.preparation?.status }, requisitions: { status: requisitionsResponse.status, committedRecordFound: true } },
      databaseEvidence
    };
    console.log(`MATERIAL_ISSUE_SCENARIO_A_EVIDENCE ${JSON.stringify(evidence)}`);
    return 'material-issue-scenario-a: verified';
  } finally {
    ws.close();
  }
}

async function testMaterialIssueScenarioB() {
  const requesterCredentials = fixtureCredentials('REQUESTER');
  const approverCredentials = fixtureCredentials('APPROVER');
  const operationId = `FIXTURE-ISSUE-B-${Date.now()}`;
  const uiEvidence = [];
  const disconnectTimeline = [];
  const browserEvidence = { browserPid: process.env.E2E_CHROME_PID || '', startedAt: new Date().toISOString(), requester: null, approver: null, disconnectTimeline, failedAt: '' };
  let requesterPage;
  let approverPage;
  let requesterEvents = [];
  try {
    browserEvidence.failedAt = 'Requester_Context_Create';
    requesterPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'requester', browserEvidence.requester = { lifecycleTrace: disconnectTimeline });
    browserEvidence.requester.currentStep = 'Requester_Login';
    const requesterSession = await setAuth(requesterPage.send, requesterCredentials);
    await requesterPage.send('Page.reload');
    await sleep(1000);
    const initialUi = await evalValue(requesterPage.send, `document.getElementById('materialIssueWorkflow')?.innerText || ''`);
    if (!initialUi.includes('真实领料申请')) throw new Error('Requester 未打开真实领料工作区');
    uiEvidence.push({ action: 'Requester 登录并打开库存页', state: initialUi.slice(0, 800) });

    browserEvidence.requester.currentStep = 'Requester_Create_Request';
    await evalValue(requesterPage.send, `(() => {
      window.confirm = () => true;
      const inventory = document.getElementById('materialIssueInventory');
      const operation = document.getElementById('materialIssueOperation');
      const quantity = document.getElementById('materialIssueQuantity');
      inventory.value = 'fixture-normal';
      inventory.dispatchEvent(new Event('change', { bubbles: true }));
      operation.value = ${JSON.stringify(operationId)};
      operation.dispatchEvent(new Event('input', { bubbles: true }));
      quantity.value = '30';
      quantity.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-action="material-issue-prepare"]')?.click();
    })()`);
    const waiting = await waitForValue(
      () => evalValue(requesterPage.send, `JSON.stringify({ id: window.App?.temp?.materialIssue?.preparationId || '', status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`).then(JSON.parse),
      value => value.status === 'WAITING_APPROVAL' && value.id,
      '领料预检查进入 WAITING_APPROVAL'
    );
    const preparationId = waiting.id;
    uiEvidence.push({ action: 'Requester 创建并提交审批', state: waiting.ui.slice(0, 1200) });
    browserEvidence.requester.currentStep = 'Requester_Context_Closed';
    requesterEvents = requesterPage.events;
    await closeIsolatedPage(requesterPage, 'requester_request_created');
    requesterPage = null;

    browserEvidence.failedAt = 'Approver_Context_Create';
    approverPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'approver', browserEvidence.approver = { lifecycleTrace: disconnectTimeline });
    browserEvidence.approver.currentStep = 'Approver_Login';
    const approverSession = await setAuth(approverPage.send, approverCredentials);
    await approverPage.send('Page.reload');
    await sleep(1000);
    browserEvidence.approver.currentStep = 'Approval_Page_Load';
    await evalValue(approverPage.send, `(() => { window.App.temp.materialIssue.preparationId = ${JSON.stringify(preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation', ${JSON.stringify(preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    browserEvidence.approver.currentStep = 'before_reject_click';
    approverPage.pageEvidence.currentStep = 'before_reject_click';
    const beforeReject = await samplePageState(approverPage);
    traceLifecycle(disconnectTimeline, { step: 'before_reject_click', event: 'state_sample', session: approverPage.pageEvidence, browserWs: approverPage.browserWs, details: beforeReject });
    browserEvidence.approver.currentStep = 'reject_click_start';
    approverPage.pageEvidence.currentStep = 'reject_click_start';
    traceLifecycle(disconnectTimeline, { step: 'reject_click_start', event: 'approval_request_started', session: approverPage.pageEvidence, browserWs: approverPage.browserWs, details: { request_url: `/api/transaction-safety/preparations/${preparationId}/approval`, http_method: 'POST' } });
    await evalValue(approverPage.send, `window.prompt = () => 'Fixture Scenario B rejection'; window.confirm = () => true; document.querySelector('[data-action="material-issue-reject"]')?.click();`);
    browserEvidence.approver.currentStep = 'approval_response_received';
    approverPage.pageEvidence.currentStep = 'approval_response_received';
    const approvalResponse = await waitForNetworkResponse(approverPage, `/api/transaction-safety/preparations/${preparationId}/approval`);
    traceLifecycle(disconnectTimeline, { step: 'approval_response_received', event: 'approval_response_received', session: approverPage.pageEvidence, browserWs: approverPage.browserWs, details: { http_status: approvalResponse.status, request_url: approvalResponse.url, response_body_summary: approvalResponse.bodySummary } });
    browserEvidence.approver.currentStep = 'after_reject_response';
    approverPage.pageEvidence.currentStep = 'after_reject_response';
    const afterRejectResponse = await samplePageState(approverPage);
    traceLifecycle(disconnectTimeline, { step: 'after_reject_response', event: 'state_sample', session: approverPage.pageEvidence, browserWs: approverPage.browserWs, details: afterRejectResponse });
    const rejected = await waitForValue(
      () => evalValue(approverPage.send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', executeVisible: Boolean(document.querySelector('[data-action="material-issue-execute"]')), ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`).then(JSON.parse),
      value => value.status === 'REJECTED' && !value.executeVisible,
      'Approver 拒绝领料申请'
    );
    uiEvidence.push({ action: 'Approver 拒绝', state: rejected.ui.slice(0, 1200) });

    // Confirm the actual rejected state before testing the execution guard.
    // This prevents an unrelated 409 from being classified as a valid block.
    const preconditionPreparationResponse = await requestApi(`/api/transaction-safety/preparations/${encodeURIComponent(preparationId)}`, requesterSession.token);
    const preconditionRequisitionsResponse = await requestApi('/api/transaction-safety/requisitions', requesterSession.token);
    const rejectedEvidenceBefore = readScenarioBDatabaseEvidence({ operationId, preparationId });
    const executionPreconditions = preconditionPreparationResponse.status === 200
      && preconditionPreparationResponse.body?.data?.preparation?.status === 'REJECTED'
      && preconditionRequisitionsResponse.status === 200
      && preconditionRequisitionsResponse.body?.data?.items?.some(item => item.business_operation_id === operationId && item.status === 'REJECTED')
      && isRejectedScenarioBState(rejectedEvidenceBefore);
    if (!executionPreconditions) throw new Error(`执行保护前置状态不完整：${JSON.stringify({ preconditionPreparationResponse, preconditionRequisitionsResponse, rejectedEvidenceBefore })}`);

    // The UI deliberately removes the execute action after rejection.  Attempt
    // the same protected endpoint from this authenticated browser session to
    // evidence that the server also rejects bypass attempts.
    browserEvidence.approver.currentStep = 'Rejected_Execute_Attempt';
    const executeAttempt = JSON.parse(await evalValue(approverPage.send, `(async () => {
      const session = JSON.parse(localStorage.getItem('personal-ai-os-auth') || '{}');
      const response = await fetch('/api/transaction-safety/preparations/${preparationId}/execute', {
        method: 'POST', headers: { Authorization: 'Bearer ' + (session.token || ''), 'Content-Type': 'application/json' }, body: '{}'
      });
      const text = await response.text();
      let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
      return JSON.stringify({ url: response.url, status: response.status, body });
    })()`));
    const executionClassification = classifyProtectedExecution({ preconditions: executionPreconditions, response: executeAttempt });
    traceLifecycle(disconnectTimeline, { step: 'post_rejection_execute_attempt', event: 'response_classified', session: approverPage.pageEvidence, browserWs: approverPage.browserWs, details: { classification: executionClassification.classification, reason: executionClassification.reason, raw_response: executionClassification.raw } });
    if (executionClassification.classification !== 'EXPECTED_BUSINESS_BLOCK') throw new Error(`拒绝后执行未被正确阻止：${JSON.stringify(executionClassification)}`);
    const afterExecuteUi = JSON.parse(await evalValue(approverPage.send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', executeVisible: Boolean(document.querySelector('[data-action="material-issue-execute"]')), ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`));
    if (afterExecuteUi.status !== 'REJECTED' || afterExecuteUi.executeVisible) throw new Error(`执行保护后 UI 状态异常：${JSON.stringify(afterExecuteUi)}`);
    uiEvidence.push({ action: '拒绝后尝试执行', state: `状态仍为 ${afterExecuteUi.status}；执行按钮不可见；受保护 API 返回 HTTP ${executeAttempt.status}`, ui: afterExecuteUi.ui.slice(0, 1200) });

    const preparationResponse = await requestApi(`/api/transaction-safety/preparations/${encodeURIComponent(preparationId)}`, requesterSession.token);
    const requisitionsResponse = await requestApi('/api/transaction-safety/requisitions', requesterSession.token);
    if (preparationResponse.status !== 200 || preparationResponse.body?.data?.preparation?.status !== 'REJECTED') throw new Error(`领料详情 API 未返回 REJECTED：${JSON.stringify(preparationResponse)}`);
    if (requisitionsResponse.status !== 200 || !requisitionsResponse.body?.data?.items?.some(item => item.business_operation_id === operationId && item.status === 'REJECTED')) throw new Error(`领料列表 API 缺少 REJECTED 申请：${JSON.stringify(requisitionsResponse)}`);
    const databaseEvidence = readScenarioBDatabaseEvidence({ operationId, preparationId });
    const dbChecks = isRejectedScenarioBState(databaseEvidence);
    if (!dbChecks) throw new Error(`Scenario B SQLite 证据不完整：${JSON.stringify(databaseEvidence)}`);
    const browserErrors = [...requesterEvents, ...approverPage.events].filter(event => {
      if (event.method === 'Runtime.exceptionThrown') return true;
      if (event.method !== 'Log.entryAdded' || event.params?.entry?.level !== 'error') return false;
      const entry = event.params.entry;
      const isExpectedProtectedResponse = executionClassification.classification === 'EXPECTED_BUSINESS_BLOCK'
        && entry.source === 'network'
        && entry.url === executeAttempt.url
        && String(entry.text || '').includes(String(executeAttempt.status));
      return !isExpectedProtectedResponse;
    });
    if (browserErrors.length) throw new Error(`Scenario B 页面出现浏览器错误：${JSON.stringify(browserErrors.slice(-2))}`);
    const evidence = {
      scenario: 'B-material-issue-rejected', status: 'VERIFIED', operationId, preparationId, uiEvidence,
      apiEvidence: { approvalResponse, preparation: { status: preparationResponse.status, state: preparationResponse.body?.data?.preparation?.status }, requisitions: { status: requisitionsResponse.status, rejectedRecordFound: true }, executeAttempt, executionClassification },
      databaseEvidence, browserEvidence
    };
    console.log(`MATERIAL_ISSUE_SCENARIO_B_EVIDENCE ${JSON.stringify(evidence)}`);
    return 'material-issue-scenario-b: verified';
  } catch (error) {
    console.error(`MATERIAL_ISSUE_SCENARIO_B_BROWSER_FAILURE ${JSON.stringify({
      scenario: 'B-material-issue-rejected', status: 'BLOCKED', failedAt: browserEvidence.approver?.currentStep || browserEvidence.requester?.currentStep || browserEvidence.failedAt || 'unknown',
      error: error.message, browserEvidence, disconnectTimeline
    })}`);
    throw error;
  } finally {
    await closeIsolatedPage(requesterPage, 'scenario_cleanup');
    await closeIsolatedPage(approverPage, 'scenario_cleanup');
  }
}

async function testMaterialIssueScenarioC() {
  const requesterCredentials = fixtureCredentials('REQUESTER');
  const approverCredentials = fixtureCredentials('APPROVER');
  const operationId = `FIXTURE-ISSUE-C-${Date.now()}`;
  const quantity = 30;
  const uiEvidence = [];
  let requesterPage;
  let approverPage;
  let executorPage;
  let requesterEvents = [];
  let approverEvents = [];
  try {
    requesterPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'requester', {});
    const requesterSession = await setAuth(requesterPage.send, requesterCredentials);
    await requesterPage.send('Page.reload');
    await sleep(1000);
    const initialUi = await evalValue(requesterPage.send, `document.getElementById('materialIssueWorkflow')?.innerText || ''`);
    if (!initialUi.includes('真实领料申请')) throw new Error('Requester 未打开真实领料工作区');
    uiEvidence.push({ action: 'Requester 登录', state: initialUi.slice(0, 800) });

    await evalValue(requesterPage.send, `(() => {
      window.confirm = () => true;
      const inventory = document.getElementById('materialIssueInventory');
      const operation = document.getElementById('materialIssueOperation');
      const quantity = document.getElementById('materialIssueQuantity');
      inventory.value = 'fixture-insufficient';
      inventory.dispatchEvent(new Event('change', { bubbles: true }));
      operation.value = ${JSON.stringify(operationId)};
      operation.dispatchEvent(new Event('input', { bubbles: true }));
      quantity.value = ${JSON.stringify(String(quantity))};
      quantity.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-action="material-issue-prepare"]')?.click();
    })()`);
    const waiting = await waitForValue(
      () => evalValue(requesterPage.send, `JSON.stringify({ id: window.App?.temp?.materialIssue?.preparationId || '', status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', card: window.App?.temp?.materialIssue?.detail?.approval_card || {}, ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`).then(JSON.parse),
      value => value.status === 'WAITING_APPROVAL' && value.id && value.card?.type === 'STOCK_NEGATIVE',
      '库存不足申请进入 WAITING_APPROVAL'
    );
    const preparationId = waiting.id;
    uiEvidence.push({ action: 'Requester 创建库存不足申请', state: waiting.ui.slice(0, 1200), validator: waiting.card });
    requesterEvents = requesterPage.events;
    await closeIsolatedPage(requesterPage, 'requester_request_created');
    requesterPage = null;

    approverPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'approver', {});
    const approverSession = await setAuth(approverPage.send, approverCredentials);
    await approverPage.send('Page.reload');
    await sleep(1000);
    await evalValue(approverPage.send, `(() => { window.App.temp.materialIssue.preparationId = ${JSON.stringify(preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation', ${JSON.stringify(preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    const approvalCard = JSON.parse(await evalValue(approverPage.send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', card: window.App?.temp?.materialIssue?.detail?.approval_card || {}, ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`));
    if (approvalCard.status !== 'WAITING_APPROVAL' || approvalCard.card?.type !== 'STOCK_NEGATIVE') throw new Error(`Approver 未看到真实库存不足审批卡：${JSON.stringify(approvalCard)}`);
    await evalValue(approverPage.send, `window.prompt = () => 'Fixture Scenario C approval for execution re-validation'; window.confirm = () => true; document.querySelector('[data-action="material-issue-approve"]')?.click();`);
    const approvalResponse = await waitForNetworkResponse(approverPage, `/api/transaction-safety/preparations/${preparationId}/approval`);
    const approved = await waitForValue(
      () => evalValue(approverPage.send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`).then(JSON.parse),
      value => value.status === 'APPROVED',
      'Approver 批准库存不足申请以触发执行期重新验证'
    );
    uiEvidence.push({ action: 'Approver 批准（无 override）', state: approved.ui.slice(0, 1200), approval_status: approvalResponse.status });
    approverEvents = approverPage.events;
    await closeIsolatedPage(approverPage, 'approver_approved_for_revalidation');
    approverPage = null;

    const beforeExecution = readScenarioCDatabaseEvidence({ operationId, preparationId });
    const executionPreconditions = beforeExecution.inventory?.id === 'fixture-insufficient'
      && beforeExecution.inventory?.stock_quantity === 10
      && beforeExecution.inventory?.version === 0
      && beforeExecution.requisition?.status === 'APPROVED'
      && beforeExecution.preparation?.status === 'APPROVED'
      && beforeExecution.transaction?.status === 'WAITING_APPROVAL'
      && beforeExecution.trace?.approval?.status === 'APPROVED';
    if (!executionPreconditions) throw new Error(`库存不足执行前置状态不完整：${JSON.stringify(beforeExecution)}`);

    executorPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'requester-executor', {});
    await setAuth(executorPage.send, requesterCredentials);
    await executorPage.send('Page.reload');
    await sleep(1000);
    await evalValue(executorPage.send, `(() => { window.App.temp.materialIssue.preparationId = ${JSON.stringify(preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation', ${JSON.stringify(preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    const readyToExecute = JSON.parse(await evalValue(executorPage.send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', executeVisible: Boolean(document.querySelector('[data-action="material-issue-execute"]')), ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`));
    if (readyToExecute.status !== 'APPROVED' || !readyToExecute.executeVisible) throw new Error(`Requester 未获得真实执行入口：${JSON.stringify(readyToExecute)}`);
    await evalValue(executorPage.send, `window.confirm = () => true; document.querySelector('[data-action="material-issue-execute"]')?.click();`);
    const executeResponse = await waitForNetworkResponse(executorPage, `/api/transaction-safety/preparations/${preparationId}/execute`);
    const executionClassification = classifyInsufficientExecution({ preconditions: executionPreconditions, response: executeResponse });
    if (executionClassification.classification !== 'EXPECTED_BUSINESS_BLOCK') throw new Error(`库存不足执行未被正确分类：${JSON.stringify(executionClassification)}`);
    const blocked = await waitForValue(
      () => evalValue(executorPage.send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', executeVisible: Boolean(document.querySelector('[data-action="material-issue-execute"]')), ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`).then(JSON.parse),
      value => value.status === 'FAILED' && !value.executeVisible,
      '库存不足执行后 UI 保持失败终态'
    );
    uiEvidence.push({ action: 'Requester 尝试执行库存不足领料', state: blocked.ui.slice(0, 1200), execute_visible: blocked.executeVisible, execute_status: executeResponse.status });

    const preparationResponse = await requestApi(`/api/transaction-safety/preparations/${encodeURIComponent(preparationId)}`, requesterSession.token);
    const requisitionsResponse = await requestApi('/api/transaction-safety/requisitions', requesterSession.token);
    if (preparationResponse.status !== 200 || preparationResponse.body?.data?.preparation?.status !== 'FAILED') throw new Error(`库存不足详情 API 未返回 FAILED：${JSON.stringify(preparationResponse)}`);
    if (requisitionsResponse.status !== 200 || !requisitionsResponse.body?.data?.items?.some(item => item.business_operation_id === operationId && item.status === 'FAILED')) throw new Error(`库存不足申请列表缺少 FAILED 记录：${JSON.stringify(requisitionsResponse)}`);
    const databaseEvidence = readScenarioCDatabaseEvidence({ operationId, preparationId });
    if (!isInsufficientScenarioCState(databaseEvidence)) throw new Error(`Scenario C SQLite 证据不完整：${JSON.stringify(databaseEvidence)}`);
    const browserErrors = [...requesterEvents, ...approverEvents, ...executorPage.events].filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'));
    if (browserErrors.length) throw new Error(`Scenario C 页面出现浏览器错误：${JSON.stringify(browserErrors.slice(-2))}`);
    const evidence = {
      scenario: 'C-insufficient-inventory-material-issue', status: 'VERIFIED', operationId, preparationId,
      fixture: { inventory_id: 'fixture-insufficient', product_code: 'FIX-INSUFFICIENT', stock_quantity: 10, request_quantity: quantity, safety_stock: 0, version: 0 },
      uiEvidence,
      apiEvidence: { approvalResponse, executeResponse, executionClassification, preparation: { status: preparationResponse.status, state: preparationResponse.body?.data?.preparation?.status }, requisitions: { status: requisitionsResponse.status, failedRecordFound: true } },
      databaseEvidence
    };
    console.log(`MATERIAL_ISSUE_SCENARIO_C_EVIDENCE ${JSON.stringify(evidence)}`);
    return 'material-issue-scenario-c: verified';
  } finally {
    await closeIsolatedPage(requesterPage, 'scenario_cleanup');
    await closeIsolatedPage(approverPage, 'scenario_cleanup');
    await closeIsolatedPage(executorPage, 'scenario_cleanup');
  }
}

function readScenarioDDatabaseEvidence({ winnerOperationId, loserOperationId }) {
  const db = new Database(process.env.E2E_FIXTURE_DB_PATH, { readonly: true });
  try {
    const enterpriseId = process.env.E2E_FIXTURE_ENTERPRISE_ID;
    return {
      inventory: db.prepare('SELECT id, stock_quantity, version FROM inventory WHERE id=?').get('fixture-concurrent'),
      issueCount: db.prepare("SELECT count(*) AS count FROM stock_transactions WHERE enterprise_id=? AND inventory_id=? AND transaction_type='INVENTORY_ISSUE'").get(enterpriseId, 'fixture-concurrent'),
      committedCount: db.prepare("SELECT count(*) AS count FROM business_transactions WHERE enterprise_id=? AND transaction_type='INVENTORY_ISSUE' AND status='COMMITTED'").get(enterpriseId),
      winner: db.prepare('SELECT status FROM material_requisitions WHERE enterprise_id=? AND business_operation_id=?').get(enterpriseId, winnerOperationId),
      loser: db.prepare('SELECT status FROM material_requisitions WHERE enterprise_id=? AND business_operation_id=?').get(enterpriseId, loserOperationId),
      loserTasks: db.prepare('SELECT count(*) AS count FROM agent_tasks WHERE enterprise_id=? AND goal=?').get(enterpriseId, loserOperationId)
    };
  } finally { db.close(); }
}

async function testMaterialIssueScenarioD() {
  const requesterA = fixtureCredentials('REQUESTER');
  const requesterB = fixtureCredentials('REQUESTER_B');
  const approver = fixtureCredentials('APPROVER');
  const operationA = `FIXTURE-ISSUE-D-A-${Date.now()}`;
  const operationB = `FIXTURE-ISSUE-D-B-${Date.now()}`;
  const quantity = 30;
  let pageA; let pageB; let approverPage;
  try {
    pageA = await openIsolatedPage(`${baseUrl}/#/inventory`, 'requester-a', {});
    pageB = await openIsolatedPage(`${baseUrl}/#/inventory`, 'requester-b', {});
    const [sessionA, sessionB] = await Promise.all([setAuth(pageA.send, requesterA), setAuth(pageB.send, requesterB)]);
    if (!sessionA.token || !sessionB.token || sessionA.token === sessionB.token) throw new Error('并发验收未获得两个独立 JWT');
    await Promise.all([pageA.send('Page.reload'), pageB.send('Page.reload')]);
    await sleep(1000);
    const submit = (page, operationId) => evalValue(page.send, `(() => {
      window.confirm = () => true;
      document.getElementById('materialIssueInventory').value = 'fixture-concurrent';
      document.getElementById('materialIssueInventory').dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('materialIssueOperation').value = ${JSON.stringify(operationId)};
      document.getElementById('materialIssueOperation').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('materialIssueQuantity').value = '30';
      document.getElementById('materialIssueQuantity').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-action="material-issue-prepare"]')?.click();
    })()`);
    const startedAt = new Date().toISOString();
    await Promise.all([submit(pageA, operationA), submit(pageB, operationB)]);
    const [responseA, responseB] = await Promise.all([
      waitForNetworkResponse(pageA, '/api/transaction-safety/preparations'),
      waitForNetworkResponse(pageB, '/api/transaction-safety/preparations')
    ]);
    const prepA = responseA.body?.data?.preparation;
    const prepB = responseB.body?.data?.preparation;
    const winner = prepA?.id ? { page: pageA, session: sessionA, operationId: operationA, preparationId: prepA.id, response: responseA, label: 'A' }
      : prepB?.id ? { page: pageB, session: sessionB, operationId: operationB, preparationId: prepB.id, response: responseB, label: 'B' } : null;
    const loser = prepA?.id ? { operationId: operationB, response: responseB, label: 'B' }
      : prepB?.id ? { operationId: operationA, response: responseA, label: 'A' } : null;
    if (!winner || !loser || (prepA?.id && prepB?.id)) throw new Error(`并发 Preparation 未产生唯一结果：${JSON.stringify({ responseA, responseB })}`);
    const loserClassification = loser.response.body?.data?.code === 'SOFT_RESERVATION_CONFLICT'
      ? 'EXPECTED_CONCURRENCY_PROTECTION' : 'UNEXPECTED_FAILURE';
    if (loserClassification !== 'EXPECTED_CONCURRENCY_PROTECTION') throw new Error(`第二个申请未被真实 Soft Reservation 保护：${JSON.stringify(loser.response)}`);
    const winnerUi = JSON.parse(await evalValue(winner.page.send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', ui: document.getElementById('materialIssueWorkflow')?.innerText || '' })`));
    const loserUi = JSON.parse(await evalValue(loser.label === 'A' ? pageA.send : pageB.send, `JSON.stringify({ status: window.App?.temp?.materialIssue?.detail?.preparation?.status || '', ui: document.body.innerText || '' })`));

    approverPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'approver', {});
    await setAuth(approverPage.send, approver);
    await approverPage.send('Page.reload'); await sleep(800);
    await evalValue(approverPage.send, `(() => { window.App.temp.materialIssue.preparationId=${JSON.stringify(winner.preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation', ${JSON.stringify(winner.preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    await evalValue(approverPage.send, `window.prompt=()=> 'Fixture Scenario D approval'; window.confirm=()=>true; document.querySelector('[data-action="material-issue-approve"]')?.click();`);
    await waitForValue(() => evalValue(approverPage.send, `window.App?.temp?.materialIssue?.detail?.preparation?.status || ''`), value => value === 'APPROVED', '并发获胜申请审批');
    await evalValue(winner.page.send, `(() => { window.App.temp.materialIssue.preparationId=${JSON.stringify(winner.preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation', ${JSON.stringify(winner.preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    await evalValue(winner.page.send, `window.confirm=()=>true; document.querySelector('[data-action="material-issue-execute"]')?.click();`);
    const executeResponse = await waitForNetworkResponse(winner.page, `/api/transaction-safety/preparations/${winner.preparationId}/execute`);
    const committed = await waitForValue(() => evalValue(winner.page.send, `window.App?.temp?.materialIssue?.detail?.preparation?.status || ''`), value => value === 'COMMITTED', '并发获胜申请执行');
    const databaseEvidence = readScenarioDDatabaseEvidence({ winnerOperationId: winner.operationId, loserOperationId: loser.operationId });
    const earlyProtectionEvidence = databaseEvidence.inventory?.stock_quantity === 20
      && databaseEvidence.inventory?.version === 1
      && databaseEvidence.issueCount?.count === 1
      && databaseEvidence.committedCount?.count === 1
      && databaseEvidence.winner?.status === 'COMMITTED'
      && !databaseEvidence.loser
      && databaseEvidence.loserTasks?.count === 0;
    if (!earlyProtectionEvidence) throw new Error(`Scenario D SQLite 前置并发保护证据不完整：${JSON.stringify(databaseEvidence)}`);
    const evidence = {
      scenario: 'D-concurrent-material-issue', status: 'NOT_VERIFIED', startedAt,
      fixture: { inventory_id: 'fixture-concurrent', stock_quantity: 50, request_quantity: quantity, version: 0 },
      requests: [
        { request: winner.label, classification: 'SUCCESS', prepare_status: winner.response.status, execute_status: executeResponse.status, final_status: committed, operation_id: winner.operationId },
        { request: loser.label, classification: loserClassification, prepare_status: loser.response.status, raw_response: loser.response.body, operation_id: loser.operationId }
      ],
      uiEvidence: { winner: winnerUi, loser: loserUi }, databaseEvidence,
      limitation: 'Soft Reservation blocks the second request before it creates a preparation/run/transaction. Therefore this browser flow proves early concurrency protection and one committed deduction, but cannot prove two approved executions competing on inventory.version without bypassing the real workflow.'
    };
    console.log(`MATERIAL_ISSUE_SCENARIO_D_EVIDENCE ${JSON.stringify(evidence)}`);
    return 'material-issue-scenario-d: not verified (soft reservation prevents execution-level race)';
  } finally {
    await closeIsolatedPage(pageA, 'scenario_cleanup');
    await closeIsolatedPage(pageB, 'scenario_cleanup');
    await closeIsolatedPage(approverPage, 'scenario_cleanup');
  }
}

function readScenarioEDatabaseEvidence({ operationId, preparationId }) {
  const db = new Database(process.env.E2E_FIXTURE_DB_PATH, { readonly: true });
  try {
    const enterpriseId = process.env.E2E_FIXTURE_ENTERPRISE_ID;
    const preparation = db.prepare('SELECT id, run_id, status FROM transaction_preparations WHERE id=? AND enterprise_id=?').get(preparationId, enterpriseId);
    return {
      inventory: db.prepare('SELECT id, stock_quantity, safety_stock, version FROM inventory WHERE id=? AND enterprise_id=?').get('fixture-normal', enterpriseId),
      requisition: db.prepare('SELECT id, status, quantity, preparation_id FROM material_requisitions WHERE enterprise_id=? AND business_operation_id=?').get(enterpriseId, operationId),
      transaction: db.prepare('SELECT id, status, transaction_type, preparation_id, run_id FROM business_transactions WHERE enterprise_id=? AND business_operation_id=? ORDER BY created_at DESC LIMIT 1').get(enterpriseId, operationId),
      issueCount: db.prepare("SELECT count(*) AS count FROM stock_transactions WHERE enterprise_id=? AND business_operation_id=? AND transaction_type='INVENTORY_ISSUE'").get(enterpriseId, operationId),
      preparation,
      operation: db.prepare('SELECT final_status, current_transaction_id, attempt_count FROM business_operations WHERE enterprise_id=? AND business_operation_id=?').get(enterpriseId, operationId),
      trace: preparation?.run_id ? {
        run: db.prepare('SELECT run_id, execution_status, verification_status, error_code, error_message FROM runtime_runs WHERE run_id=?').get(preparation.run_id),
        attempts: db.prepare('SELECT count(*) AS count FROM runtime_attempts WHERE run_id=?').get(preparation.run_id),
        validations: db.prepare('SELECT count(*) AS count FROM runtime_validations WHERE run_id=?').get(preparation.run_id),
        approval: db.prepare('SELECT status, decided_by FROM runtime_approvals WHERE run_id=?').get(preparation.run_id)
      } : null
    };
  } finally { db.close(); }
}

// This deliberately aborts only the browser's request after fetch is invoked.
// It does not alter the server, API response, database, or business state. The
// outcome must therefore be established later from the normal detail endpoint
// and SQLite evidence rather than inferred from the client-side AbortError.
async function testMaterialIssueScenarioE() {
  const requester = fixtureCredentials('REQUESTER');
  const approver = fixtureCredentials('APPROVER');
  const operationId = `FIXTURE-ISSUE-E-${Date.now()}`;
  const quantity = 30;
  let requesterPage; let approverPage; let executorPage;
  try {
    requesterPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'requester', {});
    const requesterSession = await setAuth(requesterPage.send, requester);
    await requesterPage.send('Page.reload'); await sleep(800);
    await evalValue(requesterPage.send, `(() => {
      window.confirm=()=>true;
      document.getElementById('materialIssueInventory').value='fixture-normal';
      document.getElementById('materialIssueInventory').dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('materialIssueOperation').value=${JSON.stringify(operationId)};
      document.getElementById('materialIssueOperation').dispatchEvent(new Event('input',{bubbles:true}));
      document.getElementById('materialIssueQuantity').value=${JSON.stringify(String(quantity))};
      document.getElementById('materialIssueQuantity').dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('[data-action="material-issue-prepare"]')?.click();
    })()`);
    const waiting = await waitForValue(
      () => evalValue(requesterPage.send, `JSON.stringify({id:window.App?.temp?.materialIssue?.preparationId||'',status:window.App?.temp?.materialIssue?.detail?.preparation?.status||'',ui:document.getElementById('materialIssueWorkflow')?.innerText||''})`).then(JSON.parse),
      value => value.id && value.status === 'WAITING_APPROVAL', 'Scenario E 申请进入 WAITING_APPROVAL'
    );
    const preparationId = waiting.id;
    await closeIsolatedPage(requesterPage, 'requester_request_created'); requesterPage = null;

    approverPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'approver', {});
    const approverSession = await setAuth(approverPage.send, approver);
    if (!requesterSession.token || !approverSession.token || requesterSession.token === approverSession.token) throw new Error('Scenario E 未获得隔离的 Requester / Approver JWT');
    await approverPage.send('Page.reload'); await sleep(800);
    await evalValue(approverPage.send, `(() => { window.App.temp.materialIssue.preparationId=${JSON.stringify(preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation',${JSON.stringify(preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    await evalValue(approverPage.send, `window.prompt=()=> 'Fixture Scenario E approval'; window.confirm=()=>true; document.querySelector('[data-action="material-issue-approve"]')?.click();`);
    const approved = await waitForValue(
      () => evalValue(approverPage.send, `JSON.stringify({status:window.App?.temp?.materialIssue?.detail?.preparation?.status||'',ui:document.getElementById('materialIssueWorkflow')?.innerText||''})`).then(JSON.parse),
      value => value.status === 'APPROVED', 'Scenario E 管理员批准'
    );
    await closeIsolatedPage(approverPage, 'approver_approved'); approverPage = null;

    executorPage = await openIsolatedPage(`${baseUrl}/#/inventory`, 'requester-executor', {});
    await setAuth(executorPage.send, requester);
    await executorPage.send('Page.reload'); await sleep(800);
    await evalValue(executorPage.send, `(() => { window.App.temp.materialIssue.preparationId=${JSON.stringify(preparationId)}; localStorage.setItem('personal-ai-os-material-issue-preparation',${JSON.stringify(preparationId)}); return window.App.refreshMaterialIssue(); })()`);
    const ready = await waitForValue(
      () => evalValue(executorPage.send, `JSON.stringify({status:window.App?.temp?.materialIssue?.detail?.preparation?.status||'',executeVisible:Boolean(document.querySelector('[data-action="material-issue-execute"]')),ui:document.getElementById('materialIssueWorkflow')?.innerText||''})`).then(JSON.parse),
      value => value.status === 'APPROVED' && value.executeVisible, 'Scenario E 执行入口'
    );

    await evalValue(executorPage.send, `(() => {
      const originalFetch=window.fetch.bind(window);
      window.__scenarioEAbort={request_sent_at:'',abort_at:'',client_error:'',response_observed:false};
      window.fetch=(input,init={})=>{
        const url=typeof input==='string'?input:input?.url||'';
        if (!url.includes('/api/transaction-safety/preparations/') || !url.endsWith('/execute')) return originalFetch(input,init);
        const controller=new AbortController();
        window.__scenarioEAbort.request_sent_at=new Date().toISOString();
        const pending=originalFetch(input,{...init,signal:controller.signal});
        setTimeout(()=>{ window.__scenarioEAbort.abort_at=new Date().toISOString(); controller.abort('scenario_e_client_result_unavailable'); },0);
        return pending.then(response=>{ window.__scenarioEAbort.response_observed=true; return response; },error=>{ window.__scenarioEAbort.client_error=String(error?.name||error?.message||error); throw error; });
      };
      window.confirm=()=>true;
      document.querySelector('[data-action="material-issue-execute"]')?.click();
    })()`);
    const abortState = await waitForValue(
      () => evalValue(executorPage.send, 'JSON.stringify(window.__scenarioEAbort || {})').then(JSON.parse),
      value => Boolean(value.client_error) || value.response_observed, 'Scenario E 客户端执行结果不可达尝试', 5000
    );
    await sleep(500);
    const afterUncertainUi = JSON.parse(await evalValue(executorPage.send, `JSON.stringify({status:window.App?.temp?.materialIssue?.detail?.preparation?.status||'',executeVisible:Boolean(document.querySelector('[data-action="material-issue-execute"]')),ui:document.getElementById('materialIssueWorkflow')?.innerText||'',body:document.body.innerText||''})`));
    const beforeManualRead = readScenarioEDatabaseEvidence({ operationId, preparationId });
    const manualDetail = await requestApi(`/api/transaction-safety/preparations/${encodeURIComponent(preparationId)}`, requesterSession.token);
    await evalValue(executorPage.send, 'window.App.refreshMaterialIssue()');
    const afterManualReadUi = await waitForValue(
      () => evalValue(executorPage.send, `JSON.stringify({status:window.App?.temp?.materialIssue?.detail?.preparation?.status||'',executeVisible:Boolean(document.querySelector('[data-action="material-issue-execute"]')),ui:document.getElementById('materialIssueWorkflow')?.innerText||''})`).then(JSON.parse),
      value => Boolean(value.status), 'Scenario E 人工回读状态'
    );
    const afterManualRead = readScenarioEDatabaseEvidence({ operationId, preparationId });
    const repeatExecute = await requestApi(`/api/transaction-safety/preparations/${encodeURIComponent(preparationId)}/execute`, requesterSession.token, { method: 'POST', body: {} });
    const afterRepeat = readScenarioEDatabaseEvidence({ operationId, preparationId });
    const clientOutcomeUnknown = Boolean(abortState.client_error) && !abortState.response_observed;
    const exactlyOnce = afterRepeat.issueCount?.count === 1
      && afterRepeat.inventory?.stock_quantity === 70
      && afterRepeat.inventory?.version === 1
      && afterRepeat.transaction?.status === 'COMMITTED';
    const systemMarkedUnknown = afterRepeat.preparation?.status === 'UNKNOWN' || afterRepeat.operation?.final_status === 'UNKNOWN' || afterRepeat.trace?.run?.execution_status === 'UNKNOWN';
    const evidence = {
      scenario: 'E-unconfirmed-material-issue-execution',
      status: 'NOT_VERIFIED',
      fixture: { inventory_id: 'fixture-normal', stock_quantity: 100, safety_stock: 20, request_quantity: quantity, version: 0 },
      uiEvidence: { requester_waiting: waiting.ui.slice(0, 900), approver_approved: approved.ui.slice(0, 900), executor_ready: ready.ui.slice(0, 900), after_client_abort: afterUncertainUi, after_manual_read: afterManualReadUi },
      apiEvidence: { client_abort: abortState, manual_detail: { status: manualDetail.status, preparation_status: manualDetail.body?.data?.preparation?.status }, repeat_execute: { status: repeatExecute.status, body: repeatExecute.body } },
      databaseEvidence: { before_manual_read: beforeManualRead, after_manual_read: afterManualRead, after_repeat: afterRepeat },
      classifications: { client_outcome: clientOutcomeUnknown ? 'UNKNOWN' : 'SUCCESS', system_unknown_persisted: systemMarkedUnknown, exactly_once_after_repeat: exactlyOnce },
      limitation: 'The browser request was truly aborted after dispatch, but the current Material Issue production path has no persisted client-uncertain / PENDING_VERIFICATION / UNKNOWN transition. A later normal detail read resolves the business state, so this is not evidence of a system-managed UNKNOWN recovery state.'
    };
    console.log(`MATERIAL_ISSUE_SCENARIO_E_EVIDENCE ${JSON.stringify(evidence)}`);
    return 'material-issue-scenario-e: not verified (no persisted UNKNOWN transition in current material issue path)';
  } finally {
    await closeIsolatedPage(requesterPage, 'scenario_cleanup');
    await closeIsolatedPage(approverPage, 'scenario_cleanup');
    await closeIsolatedPage(executorPage, 'scenario_cleanup');
  }
}

async function testChat() {
  const { ws, send } = await openPage(`${baseUrl}/#/chat`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(3000);
  const prompt = '请用三点回答你能帮我解决什么问题。';
  await evalValue(send, `(() => {
    const input = document.getElementById('chatInput');
    input.value = ${JSON.stringify(prompt)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-form="chat"]').requestSubmit();
  })()`);
  await sleep(12000);
  const chatState = await evalValue(send, `(() => {
    const messages = [...document.querySelectorAll('#chatMessages .message')];
    const assistantMessages = messages.filter(item => !item.classList.contains('user'));
    const last = assistantMessages.at(-1);
    return JSON.stringify({
      count: messages.length,
      assistantCount: assistantMessages.length,
      lastText: last?.innerText || '',
      inputDisabled: Boolean(document.getElementById('chatInput')?.disabled),
      body: document.body.innerText
    });
  })()`);
  const parsedChat = JSON.parse(chatState);
  const body = parsedChat.body || '';
  if (!parsedChat.assistantCount || !parsedChat.lastText.trim()) throw new Error(`AI Chat 未生成可见回复：${JSON.stringify(parsedChat)}`);
  if (parsedChat.inputDisabled) throw new Error('AI Chat 回复后输入框不可用');
  if (body.includes('模型返回为空')) throw new Error('仍出现模型返回为空');
  ws.close();
  return 'ai-chat: ok';
}

async function testOcr() {
  const { ws, send, pageEvidence } = await openPage(`${baseUrl}/#/ocr`);
  const evidence = { entry: 'ocr-page', startedAt: new Date().toISOString(), browserProfile: 'verify-managed-ephemeral', pageTarget: 'dedicated-cdp-target' };
  let monitor = null;
  try {
    await recordOcrLifecycleStep(pageEvidence, send, 'OCR_OPEN_START');
    await setAuth(send);
    await send('Page.reload');
    await sleep(3000);
    await recordOcrLifecycleStep(pageEvidence, send, 'OCR_PAGE_READY');
    const stateBefore = await evalValue(send, `window.App?.temp?.ocr?.status || ''`);
    const ocrBodyBefore = await evalValue(send, `document.body.innerText || ''`);
    if (!ocrBodyBefore.includes('OCR识别') || /undefined|null|NaN/i.test(stateBefore)) throw new Error(`OCR 初始状态异常：${stateBefore}`);
    await evalValue(send, `(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,800,280);
    ctx.fillStyle = '#000';
    ctx.font = '36px sans-serif';
    ctx.fillText('发货单 SO-2026-015', 30, 60);
    ctx.fillText('客户 常州新能源科技有限公司', 30, 110);
    ctx.fillText('发货数量 760', 30, 160);
    ctx.fillText('总金额 9710.00', 30, 210);
    canvas.toBlob(blob => {
      const file = new File([blob], 'ocr-test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('input[data-input="ocr-file"]');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    })()`);
    await sleep(1200);
    const uploadState = JSON.parse(await evalValue(send, `JSON.stringify({ name: window.App?.temp?.ocr?.file?.name || '', type: window.App?.temp?.ocr?.file?.type || '', size: window.App?.temp?.ocr?.file?.size || 0, status: window.App?.temp?.ocr?.status || '' })`));
    evidence.file = uploadState;
    if (uploadState.name !== 'ocr-test.png') throw new Error(`OCR 上传后文件状态异常：${JSON.stringify(uploadState)}`);
  // A previous document session can contain text from an earlier OCR run.
  // Clear only transient UI results so this test must observe the current
  // upload completing or reaching an explicit failure/timeout state.
    await evalValue(send, `(() => {
    const o = window.App?.temp?.ocr;
    if (!o) return false;
    o.providerId = 'auto';
    o.providerResult = null;
    o.result = '';
    o.original = '';
    o.status = '等待识别';
    return true;
    })()`);
    const timeoutMs = OCR_TIMEOUT_CONTRACT.ocr.timeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error(`OCR timeout 契约无效：${timeoutMs}`);
    evidence.timeoutMs = timeoutMs;
    evidence.observationBudgetMs = timeoutMs + 10000;
    await recordOcrLifecycleStep(pageEvidence, send, 'OCR_BEFORE_RUNTIME_EVALUATE');
    evidence.workerBefore = JSON.parse(await evalValue(send, `JSON.stringify(window.OCRService?.health?.() || {})`));
    await recordOcrLifecycleStep(pageEvidence, send, 'OCR_AFTER_RUNTIME_EVALUATE');
    monitor = await startOcrLongRunMonitor(pageEvidence);
    await evalValue(send, `document.querySelector('[data-action="ocr-run"]').click()`);
    const observed = [];
    const observationStarted = Date.now();
    let runState = { status: '', text: '', terminal: false };
    let cdpStateReadBlocked = false;
    while (Date.now() - observationStarted <= evidence.observationBudgetMs) {
      await sleep(1000);
      if (cdpStateReadBlocked) {
        // Keep observing browser ownership on the separate monitor until the
        // product window ends, but do not turn a timed-out page query into a
        // stream of additional Runtime.evaluate requests.
        await sleep(Math.min(9000, Math.max(0, evidence.observationBudgetMs - (Date.now() - observationStarted))));
        continue;
      }
      try {
        runState = JSON.parse(await boundedCdpCall(() => evalValue(send, `JSON.stringify((() => {
        const o = window.App?.temp?.ocr || {};
        const result = o.providerResult || {};
        const data = window.Store?.state?.ocrData || {};
        const health = window.OCRService?.health?.() || {};
        const terminal = ['success','partial_success','failed','timeout','fallback','cancelled'].includes(result.status)
          || /OCR (失败|超时)|已使用降级模式|演示数据/.test(String(o.status || ''));
        return {
          status: result.status || o.status || '', text: result.rawText || o.result || '', terminal,
          loading: Boolean(o.loading), progress: Number(o.progress || 0), manualConfirmationRequired: Boolean(result.manualConfirmationRequired),
          fallbackUsed: Boolean(result.fallbackUsed), providerId: result.providerId || o.providerId || '',
          warnings: result.warnings || [], errors: result.errors || [], health,
          lastError: data.errors?.[0] || null, lastLog: data.providerLogs?.[0] || null
        };
        })())`), 5000, 'OCR state Runtime.evaluate'));
      } catch (error) {
        observed.push({ elapsedMs: Date.now() - observationStarted, status: 'CDP_STATE_UNAVAILABLE', cdpError: error.code || error.message });
        evidence.cdpStateReadError = error.code || error.message;
        cdpStateReadBlocked = true;
        continue;
      }
      observed.push({ elapsedMs: Date.now() - observationStarted, status: runState.status, progress: runState.progress, loading: runState.loading, health: runState.health, error: runState.errors?.[0]?.type || runState.lastError?.errorType || '' });
      if (runState.terminal) break;
    }
    const arithmeticBeforeReload = await boundedCdpCall(() => evalValue(send, '1 + 1'), 5000, 'post-OCR Runtime.evaluate');
    await boundedCdpCall(() => send('Page.reload'), 5000, 'post-OCR Page.reload');
    await sleep(1500);
    const arithmeticAfterReload = await boundedCdpCall(() => evalValue(send, '1 + 1'), 5000, 'post-reload Runtime.evaluate');
    evidence.postOcrCdp = { arithmeticBeforeReload, reload: 'completed', arithmeticAfterReload };
    if (arithmeticBeforeReload !== 2 || arithmeticAfterReload !== 2) {
      throw new Error(`OCR_POST_RUN_CDP_QUALIFICATION_FAILED:${JSON.stringify(evidence.postOcrCdp)}`);
    }
    await monitor.stop();
    evidence.infrastructureHealth = monitor.evidence.samples;
    evidence.infrastructureEvents = monitor.evidence.targetEvents;
    monitor = null;
    evidence.workerAfter = runState.health || {};
    evidence.observations = observed.slice(-18);
    evidence.final = { status: runState.status, providerId: runState.providerId, manualConfirmationRequired: runState.manualConfirmationRequired,
      fallbackUsed: runState.fallbackUsed, textLength: String(runState.text || '').length, warnings: runState.warnings, errors: runState.errors, lastError: runState.lastError, lastLog: runState.lastLog };
    const explicitManualState = runState.status === 'partial_success' && runState.manualConfirmationRequired && !runState.fallbackUsed;
    const explicitFailure = /failed|error|unavailable|timeout|失败|不可用|超时/i.test(runState.status);
    if (evidence.cdpStateReadError) throw new Error(`OCR_CDP_STATE_READ_UNAVAILABLE:${JSON.stringify(evidence)}`);
    if (!runState.text.trim() && !explicitManualState && !explicitFailure) throw new Error(`OCR 未在 ${evidence.observationBudgetMs}ms 内进入明确终态：${JSON.stringify(evidence.final)}`);
    if (/Mock OCR 成功/.test(runState.status) || runState.providerId === 'mock') throw new Error('OCR 真实测试被错误标记为 Mock 成功');
    console.log(`OCR_E2E_EVIDENCE ${JSON.stringify(evidence)}`);
    return 'ocr: ok';
  } finally {
    if (monitor) {
      await monitor.stop().catch(() => {});
      evidence.infrastructureHealth = monitor.evidence.samples;
      evidence.infrastructureEvents = monitor.evidence.targetEvents;
    }
    ws.close();
  }
}

async function testOcrCdpMinimal() {
  const { ws, send, pageEvidence } = await openPage(`${baseUrl}/#/ocr`);
  try {
    const steps = [];
    steps.push(await recordOcrLifecycleStep(pageEvidence, send, 'OCR_OPEN_START'));
    await setAuth(send);
    await send('Page.reload');
    await sleep(1500);
    steps.push(await recordOcrLifecycleStep(pageEvidence, send, 'OCR_PAGE_READY'));
    const before = await evalValue(send, '1 + 1');
    const domBefore = await evalValue(send, `document.body?.innerText?.includes('OCR识别') === true`);
    await send('Page.reload');
    await sleep(1500);
    const after = await evalValue(send, '1 + 1');
    const domAfter = await evalValue(send, `document.body?.innerText?.includes('OCR识别') === true`);
    steps.push(await recordOcrLifecycleStep(pageEvidence, send, 'OCR_AFTER_RUNTIME_EVALUATE'));
    if (before !== 2 || after !== 2 || !domBefore || !domAfter) {
      throw new Error(`OCR_CDP_MINIMAL_FAILED:${JSON.stringify({ before, after, domBefore, domAfter, steps })}`);
    }
    pageEvidence.expectedClose = true;
    ws.close();
    return `ocr-cdp-minimal: PASS ${JSON.stringify({ targetId: pageEvidence.targetId, before, after, domBefore, domAfter })}`;
  } finally {
    if (ws.readyState === WebSocket.OPEN) {
      pageEvidence.expectedClose = true;
      ws.close();
    }
  }
}

async function testAgent() {
  const { ws, send } = await openPage(`${baseUrl}/#/agent`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(2500);
  const goal = '分析一份发货单并在需要审批时暂停';
  await evalValue(send, `(() => {
    const el = document.getElementById('agentGoal');
    el.value = ${JSON.stringify(goal)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await evalValue(send, `document.querySelector('[data-action="agent-run"]').click()`);
  await sleep(1000);
  let snapshot = '';
  for (let i = 0; i < 12; i += 1) {
    snapshot = await evalValue(send, `(() => {
      const body = document.body.innerText || '';
      const statusText = document.querySelector('.panel .status-pill')?.textContent || '';
      const logText = document.getElementById('agentLog')?.innerText || '';
      const stepText = document.querySelector('.agent-steps')?.innerText || '';
      return JSON.stringify({
        statusText,
        body: body.slice(0, 2000),
        logText: logText.slice(0, 1000),
        stepText: stepText.slice(0, 1000)
      });
    })()`);
    if (/等待中|执行中|已完成|等待审批|失败|取消|超时|pending|running|waiting_human|success|failed|timeout|cancelled/.test(snapshot)) break;
    await sleep(1000);
  }
  if (!/等待中|执行中|已完成|等待审批|失败|pending|running|waiting_human|success|failed|timeout|cancelled/.test(snapshot)) {
    throw new Error('Agent 状态流转未出现');
  }
  ws.close();
  return 'agent-runtime: ok';
}


async function testQuotation() {
  const { ws, send, events } = await openPage(`${baseUrl}/#/quotation`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(3000);

  // Clipboard writes require an actual user activation in Chromium. Dispatch
  // a CDP pointer gesture rather than invoking HTMLElement.click(), otherwise
  // the quotation-copy path is not exercising the browser's real permission
  // behavior.
  const click = async selector => {
    if (selector !== '[data-action="quotation-copy"]') {
      return evalValue(send, `(() => document.querySelector(${JSON.stringify(selector)})?.click())()`);
    }
    let box = await evalValue(send, `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); }
      catch { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' }); }
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, viewport: { width: innerWidth, height: innerHeight }, visible: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight };
    })()`);
    if (!box || box.width <= 0 || box.height <= 0) throw new Error(`报价操作目标不可点击：${selector}`);
    if (!box.visible) {
      await send('Input.synthesizeScrollGesture', { x: Math.max(1, Math.floor(box.viewport.width * 0.75)), y: Math.max(1, Math.floor(box.viewport.height * 0.5)), yDistance: -Math.max(1, Math.ceil(box.y - (box.viewport.height / 2))), speed: 800, preventFling: true });
      await sleep(150);
      box = await evalValue(send, `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, targetHit: hit?.closest('button') === el };
      })()`);
    }
    const preClickTarget = await evalValue(send, `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit?.closest('button') === el;
    })()`);
    if (!box?.visible || !preClickTarget) throw new Error(`报价复制真实点击目标未就绪：${selector}`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1 });
  };
  const bodyText = async () => evalValue(send, 'document.body.innerText');
  const getApproval = async () => evalValue(send, `(() => document.querySelector('.panel .status-pill')?.textContent || '')()`);
  const expectNoConsoleErrors = async label => {
    const redErrors = events.filter(event => {
      const method = event.method || '';
      const params = event.params || {};
      const text = JSON.stringify(params);
      if (method === 'Runtime.exceptionThrown') return true;
      if (method === 'Log.entryAdded' && params.entry?.level === 'error') return true;
      return /ReferenceError|TypeError|Uncaught|Failed to execute/.test(text);
    });
    if (redErrors.length) {
      throw new Error(`${label} 出现浏览器红色错误：${JSON.stringify(redErrors.slice(-2))}`);
    }
  };

  await click('[data-action="quotation-sample"][data-sample="complete"]');
  await sleep(1200);
  await click('[data-action="quotation-generate"]');
  await sleep(2500);
  let body = await bodyText();
  if (!body.includes('报价草稿') && !body.includes('RFQ 报价草稿')) throw new Error('RFQ 报价草稿未生成');
  if (!body.includes('当前无阻断项') && !body.includes('可生成')) throw new Error('完整示例不应出现阻断项');

  await click('[data-action="quotation-sample"][data-sample="missingMaterial"]');
  await sleep(1200);
  await click('[data-action="quotation-generate"]');
  await sleep(1800);
  body = await bodyText();
  if (!body.includes('缺少：材料名称') && !body.includes('必填项缺失')) throw new Error('缺少材料示例未触发阻断');

  await click('[data-action="quotation-sample"][data-sample="deliveryRisk"]');
  await sleep(1200);
  await click('[data-action="quotation-generate"]');
  await sleep(1800);
  body = await bodyText();
  if (!body.includes('交期过紧') && !body.includes('交付风险')) throw new Error('交期风险示例未触发阻断');

  await click('[data-action="quotation-sample"][data-sample="qualityRisk"]');
  await sleep(1200);
  await evalValue(send, `(() => {
    const reason = document.querySelector('[data-ws-field="approvalReason"][data-module="quotation"]');
    if (reason) {
      reason.value = 'RFQ 审批通过，已完成人工确认';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await evalValue(send, `(() => {
    const ws = App.getQuotationWorkspace();
    return (ws.rfqRisks || []).map(risk => risk.id);
  })()`).then(async ids => {
    for (const id of ids) {
      await evalValue(send, `App.quotationSelectRisk(${JSON.stringify(id)})`);
      await sleep(500);
      await click('[data-action="quotation-risk-action"][data-status="mitigate"]');
      await sleep(800);
    }
  });
  body = await bodyText();
  if (/阻断\s+\d+/.test(body) && !body.includes('可继续')) {
    throw new Error('风险缓解后仍存在阻断');
  }

  await click('[data-action="quotation-sample"][data-sample="complete"]');
  await sleep(1200);
  await click('[data-action="quotation-submit-approval"]');
  await sleep(800);
  await evalValue(send, `(() => {
    const reason = document.querySelector('[data-ws-field="approvalReason"][data-module="quotation"]');
    if (reason) {
      reason.value = '';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await click('[data-action="quotation-decision"][data-status="rejected"]');
  await sleep(900);
  body = await bodyText();
  if (!body.includes('pending') && !body.includes('draft')) throw new Error('驳回空原因仍然变更状态');

  await evalValue(send, `(() => {
    const reason = document.querySelector('[data-ws-field="approvalReason"][data-module="quotation"]');
    if (reason) {
      reason.value = '客户要求补充交期说明';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await click('[data-action="quotation-decision"][data-status="returned"]');
  await sleep(900);
  body = await bodyText();
  if (!body.includes('returned')) throw new Error('退回补充未生效');

  await evalValue(send, `(() => {
    const reason = document.querySelector('[data-ws-field="approvalReason"][data-module="quotation"]');
    if (reason) {
      reason.value = 'RFQ 审批通过，已完成人工确认';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await click('[data-action="quotation-decision"][data-status="approved"]');
  await sleep(2500);
  body = await bodyText();
  if (!body.includes('审批通过') && !body.includes('approved')) throw new Error('审批通过未生效');
  if (!body.includes('报价草稿')) throw new Error('审批通过后未生成报价草稿');

  await click('[data-action="quotation-save"]');
  await sleep(1000);
  body = await bodyText();
  if (!body.includes('保存报价草稿')) throw new Error('报价草稿保存未进入审计记录');

  const copyAuditBaseline = await evalValue(send, `(() => {
    const ws = App.getQuotationWorkspace();
    const quotationId = String(ws.rfqActiveSavedDraftId || '');
    const savedDraft = (ws.rfqSavedDrafts || []).find(item => item.id === quotationId) || null;
    const audits = (ws.rfqAuditTrail || []).filter(item => item.action === '复制报价草稿' && item.quotationId === quotationId);
    return { quotationId, hasSavedDraft: Boolean(savedDraft), count: audits.length };
  })()`);
  if (!copyAuditBaseline.hasSavedDraft || !copyAuditBaseline.quotationId) {
    throw new Error('报价草稿复制前未获得稳定保存草稿 ID');
  }
  await click('[data-action="quotation-copy"]');
  const copyAudits = await waitForValue(
    () => evalValue(send, `(() => {
      const trail = App.getQuotationWorkspace().rfqAuditTrail || [];
      return trail.filter(item => item.action === '复制报价草稿' && item.quotationId === ${JSON.stringify(copyAuditBaseline.quotationId)}).map(item => ({
        id: item.id,
        status: item.status,
        message: item.message,
        quotationId: item.quotationId || ''
      }));
    })()`),
    items => Array.isArray(items) && items.length === copyAuditBaseline.count + 1,
    '报价草稿复制审计记录'
  );
  const currentCopyAudit = copyAudits.find(item => item.quotationId === copyAuditBaseline.quotationId);
  if (!currentCopyAudit || currentCopyAudit.message !== '报价草稿已复制到剪贴板') {
    throw new Error('报价草稿复制审计语义不正确');
  }
  const savedDraft = await evalValue(send, `(() => {
    const ws = App.getQuotationWorkspace();
    return (ws.rfqSavedDrafts || []).find(item => item.id === ws.rfqActiveSavedDraftId) || null;
  })()`);
  if (!savedDraft || savedDraft.id !== copyAuditBaseline.quotationId || currentCopyAudit.quotationId !== savedDraft.id) {
    throw new Error('报价草稿复制审计未关联当前保存草稿');
  }
  // saveQuotationAudit updates state before the async persistence and rerender
  // finish.  Wait for the rendered audit card instead of treating an immediate
  // whole-page text snapshot as proof that the UI failed to update.
  await waitForValue(bodyText, text => text.includes('复制报价草稿'), '报价草稿复制审计界面', 3000);

  await evalValue(send, `(() => {
    window.__rfqPrintCalled = false;
    window.open = () => ({
      document: { open() {}, write() {}, close() {} },
      focus() {},
      print() { window.__rfqPrintCalled = true; }
    });
  })()`);
  await click('[data-action="quotation-print"]');
  await sleep(1200);
  const printed = await evalValue(send, 'Boolean(window.__rfqPrintCalled)');
  body = await bodyText();
  if (!printed && !body.includes('打印报价草稿')) throw new Error('报价草稿打印动作未触发');

  await evalValue(send, 'window.confirm = () => true');
  await click('[data-action="quotation-final-send"]');
  await sleep(1200);
  body = await bodyText();
  if (!body.includes('最终发送确认')) throw new Error('最终发送人工确认未进入审计记录');

  await send('Page.reload');
  await sleep(2500);
  body = await bodyText();
  if (!body.includes('RFQ 报价草稿') || !body.includes('最终发送确认')) {
    throw new Error('页面刷新后 RFQ 数据未恢复');
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await sleep(800);
  const mobileLayout = await evalValue(send, `(() => {
    const body = document.body;
    const buttons = [...document.querySelectorAll('button')];
    const clipped = buttons.map(btn => {
      const r = btn.getBoundingClientRect();
      const style = getComputedStyle(btn);
      return { text: String(btn.textContent || '').trim().slice(0, 60), left: r.left, right: r.right, top: r.top, width: r.width, height: r.height, hidden: btn.hidden, display: style.display, visibility: style.visibility };
    }).filter(item => item.display !== 'none' && item.visibility !== 'hidden' && !item.hidden && (item.width < 12 || item.height < 12 || item.right > window.innerWidth + 4));
    return JSON.stringify({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      clipped,
      hasQuotation: body.innerText.includes('报价助手')
    });
  })()`);
  const parsedMobile = JSON.parse(mobileLayout);
  if (!parsedMobile.hasQuotation) throw new Error('手机尺寸下报价页面未显示');
  if (parsedMobile.scrollWidth > parsedMobile.innerWidth + 8) throw new Error('手机尺寸下存在横向溢出');
  if (parsedMobile.clipped.length > 0) throw new Error(`手机尺寸下存在按钮遮挡或尺寸异常：${JSON.stringify(parsedMobile.clipped)}`);
  await send('Emulation.clearDeviceMetricsOverride').catch(() => {});

  const approvalStatus = await getApproval();
  if (!approvalStatus) throw new Error('审批状态未显示');
  const audit = await evalValue(send, `document.body.innerText.includes('审计记录')`);
  if (!audit) throw new Error('审计记录未显示');
  await expectNoConsoleErrors('RFQ 报价审批');

  ws.close();
  return 'quotation: ok';
}

// Diagnostic only: each verifier invocation owns a fresh SQLite fixture and
// Chrome profile. Native HTMLElement.click is a control experiment, never
// quotation-audit acceptance evidence.
async function testQuotationCopyAudit() {
  const nativeControl = process.argv.includes('--quotation-copy-native-control');
  const session = await openIsolatedPage(`${baseUrl}/#/quotation`, 'quotation-copy-diagnosis', {});
  const { ws, send } = session;
  const click = selector => evalValue(send, `document.querySelector(${JSON.stringify(selector)})?.click()`);
  try {
    await setAuth(send, fixtureCredentials('REQUESTER'));
    await grantLocalClipboardPermission();
    await send('Page.reload');
    await sleep(1000);
    await click('[data-action="quotation-sample"][data-sample="complete"]');
    await click('[data-action="quotation-generate"]');
    await waitForValue(() => evalValue(send, `App.getQuotationWorkspace().rfqDraft || ''`), value => Boolean(value), '报价草稿生成');
    await click('[data-action="quotation-save"]');
    const prepared = await waitForValue(() => evalValue(send, `(() => {
      const workspace = App.getQuotationWorkspace();
      const saved = (workspace.rfqSavedDrafts || [])[0];
      return saved?.id ? { quotationId: saved.id, copyAuditCount: (workspace.rfqAuditTrail || []).filter(item => item.action === '复制报价草稿').length, quotationCount: (workspace.rfqSavedDrafts || []).length } : null;
    })()`), value => Boolean(value?.quotationId), '隔离报价草稿');
    let scrollEvidence = await evalValue(send, `(async () => {
      const button = document.querySelector('[data-action="quotation-copy"]');
      if (!button) return null;
      const selector = '[data-action="quotation-copy"]';
      const describeNode = node => node ? { tagName: node.tagName, id: node.id || '', className: String(node.className || '').slice(0, 160) } : null;
      const rectOf = node => { const rect = node.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; };
      const scrollable = node => {
        const style = getComputedStyle(node);
        return node.scrollHeight > node.clientHeight && /auto|scroll|overlay/.test(style.overflowY);
      };
      const ancestorAudit = () => {
        const rows = [];
        for (let node = button.parentElement; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          const rect = rectOf(node);
          const targetRect = rectOf(button);
          rows.push({ ...describeNode(node), position: style.position, overflowX: style.overflowX, overflowY: style.overflowY, scrollTop: node.scrollTop, scrollLeft: node.scrollLeft, scrollHeight: node.scrollHeight, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, clientWidth: node.clientWidth, rect, scrollable: scrollable(node), clipsTarget: targetRect.top < rect.top || targetRect.bottom > rect.bottom || targetRect.left < rect.left || targetRect.right > rect.right });
        }
        const root = document.scrollingElement;
        if (root && !rows.some(row => row.tagName === root.tagName && row.id === root.id)) {
          const style = getComputedStyle(root);
          rows.push({ ...describeNode(root), position: style.position, overflowX: style.overflowX, overflowY: style.overflowY, scrollTop: root.scrollTop, scrollLeft: root.scrollLeft, scrollHeight: root.scrollHeight, scrollWidth: root.scrollWidth, clientHeight: root.clientHeight, clientWidth: root.clientWidth, rect: rectOf(root), scrollable: scrollable(root), clipsTarget: false, documentScrollingElement: true });
        }
        return rows;
      };
      const before = { window: { x: scrollX, y: scrollY }, rect: rectOf(button), ancestors: ancestorAudit(), viewport: { width: innerWidth, height: innerHeight } };
      const oldDocumentScrollBehavior = document.documentElement.style.scrollBehavior;
      const oldBodyScrollBehavior = document.body?.style.scrollBehavior || '';
      document.documentElement.style.scrollBehavior = 'auto';
      if (document.body) document.body.style.scrollBehavior = 'auto';
      try { button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); }
      catch { button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' }); }
      // A nested scroller can clip a target even after scrollIntoView. Centre it
      // within every real scroll container without relying on a stale rect.
      for (let node = button.parentElement; node; node = node.parentElement) {
        if (!scrollable(node)) continue;
        const targetRect = rectOf(button);
        const containerRect = rectOf(node);
        const deltaY = ((targetRect.top + targetRect.bottom) / 2) - ((containerRect.top + containerRect.bottom) / 2);
        const deltaX = ((targetRect.left + targetRect.right) / 2) - ((containerRect.left + containerRect.right) / 2);
        if (Math.abs(deltaY) > 1) node.scrollTop += deltaY;
        if (Math.abs(deltaX) > 1) node.scrollLeft += deltaX;
      }
      const afterContainer = rectOf(button);
      const desiredTop = Math.max(0, scrollY + afterContainer.top - ((innerHeight - afterContainer.height) / 2));
      const desiredLeft = Math.max(0, scrollX + afterContainer.left - ((innerWidth - afterContainer.width) / 2));
      // Chromium can retain BODY as the effective scroll host while reporting
      // HTML as document.scrollingElement. Set both documented hosts, then
      // verify the final geometry instead of assuming window.scrollTo worked.
      const root = document.scrollingElement;
      if (root) { root.scrollTop = desiredTop; root.scrollLeft = desiredLeft; }
      document.documentElement.scrollTop = desiredTop;
      document.documentElement.scrollLeft = desiredLeft;
      if (document.body) { document.body.scrollTop = desiredTop; document.body.scrollLeft = desiredLeft; }
      window.scrollTo({ top: desiredTop, left: desiredLeft, behavior: 'auto' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => setTimeout(resolve, 150));
      const finalRect = rectOf(button);
      const fullyInside = finalRect.width > 0 && finalRect.height > 0 && finalRect.left >= 0 && finalRect.top >= 0 && finalRect.right <= innerWidth && finalRect.bottom <= innerHeight;
      const centreInside = ((finalRect.left + finalRect.right) / 2) >= 0 && ((finalRect.left + finalRect.right) / 2) <= innerWidth && ((finalRect.top + finalRect.bottom) / 2) >= 0 && ((finalRect.top + finalRect.bottom) / 2) <= innerHeight;
      document.documentElement.style.scrollBehavior = oldDocumentScrollBehavior;
      if (document.body) document.body.style.scrollBehavior = oldBodyScrollBehavior;
      return { selector, before, requestedWindowScroll: { x: desiredLeft, y: desiredTop }, after: { window: { x: scrollX, y: scrollY }, rootScrollTop: root?.scrollTop ?? null, bodyScrollTop: document.body?.scrollTop ?? null, rect: finalRect, ancestors: ancestorAudit(), viewport: { width: innerWidth, height: innerHeight }, fullyInside, centreInside } };
    })()`);
    if (!scrollEvidence) throw new Error('复制报价草稿按钮不存在');
    if (!scrollEvidence.after.fullyInside || !scrollEvidence.after.centreInside) {
      // This is the one permitted re-location attempt. It is a scroll-only CDP
      // gesture on the content area, never a button input or synthetic click.
      await send('Input.synthesizeScrollGesture', {
        x: Math.max(1, Math.floor(scrollEvidence.after.viewport.width * 0.75)),
        y: Math.max(1, Math.floor(scrollEvidence.after.viewport.height * 0.5)),
        yDistance: -Math.max(1, Math.ceil(scrollEvidence.after.rect.top - ((scrollEvidence.after.viewport.height - scrollEvidence.after.rect.height) / 2))),
        speed: 800,
        preventFling: true
      });
      await sleep(150);
      const relocation = await evalValue(send, `(() => {
        const button = document.querySelector('[data-action="quotation-copy"]');
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        const fullyInside = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
        const centreInside = ((rect.left + rect.right) / 2) >= 0 && ((rect.left + rect.right) / 2) <= innerWidth && ((rect.top + rect.bottom) / 2) >= 0 && ((rect.top + rect.bottom) / 2) <= innerHeight;
        const ancestorRects = [];
        for (let node = button.parentElement; node; node = node.parentElement) {
          const nodeRect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          ancestorRects.push({ tagName: node.tagName, id: node.id || '', className: String(node.className || '').slice(0, 160), position: style.position, overflowX: style.overflowX, overflowY: style.overflowY, scrollTop: node.scrollTop, scrollLeft: node.scrollLeft, scrollHeight: node.scrollHeight, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, clientWidth: node.clientWidth, rect: { left: nodeRect.left, top: nodeRect.top, right: nodeRect.right, bottom: nodeRect.bottom, width: nodeRect.width, height: nodeRect.height } });
        }
        return { after: { window: { x: scrollX, y: scrollY }, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }, ancestors: ancestorRects, viewport: { width: innerWidth, height: innerHeight }, fullyInside, centreInside } };
      })()`);
      if (relocation) scrollEvidence = { ...scrollEvidence, after: relocation.after, relocation: 'CDP_SCROLL_GESTURE' };
    }
    if (!scrollEvidence.after.fullyInside || !scrollEvidence.after.centreInside) {
      throw new Error(`TEST_HARNESS_SCROLL_FAILURE: ${JSON.stringify(scrollEvidence)}`);
    }
    const diagnosis = await evalValue(send, `(async () => {
      const button = document.querySelector('[data-action="quotation-copy"]');
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      const style = getComputedStyle(button);
      const clipboard = navigator.clipboard;
      const state = window.__quotationCopyDiagnosis = { events: [], errors: [], handler: { entered: 'UNKNOWN', completed: 'UNKNOWN' }, clipboard: { available: Boolean(clipboard), writeText: Boolean(clipboard?.writeText), fallbackAttempted: 'UNKNOWN', fallbackResult: 'UNKNOWN', primaryResult: 'UNKNOWN', primaryError: 'NONE' } };
      const describe = node => node ? { tagName: node.tagName, id: node.id || '', className: String(node.className || ''), text: String(node.textContent || '').trim().slice(0, 80) } : null;
      const observe = (event, scope) => state.events.push({ type: event.type, scope, target: describe(event.target), currentTarget: describe(event.currentTarget), clientX: event.clientX, clientY: event.clientY, button: event.button, buttons: event.buttons, defaultPrevented: event.defaultPrevented, isTrusted: event.isTrusted, timestamp: Date.now() });
      ['pointerover','pointerenter','pointermove','pointerdown','mousedown','pointerup','mouseup','click'].forEach(type => { button.addEventListener(type, event => observe(event, 'button'), true); document.addEventListener(type, event => observe(event, 'document'), true); });
      window.addEventListener('error', event => state.errors.push({ type: 'error', message: event.message || '', timestamp: Date.now() }));
      window.addEventListener('unhandledrejection', event => state.errors.push({ type: 'unhandledrejection', message: String(event.reason?.message || event.reason || ''), timestamp: Date.now() }));
      const originalWriteText = clipboard?.writeText?.bind(clipboard);
      const originalExecCommand = document.execCommand?.bind(document);
      try {
        if (originalWriteText) clipboard.writeText = value => {
          state.clipboard.primaryResult = 'PENDING';
          return Promise.resolve(originalWriteText(value)).then(result => { state.clipboard.primaryResult = 'SUCCESS'; return result; }, error => { state.clipboard.primaryResult = 'ERROR'; state.clipboard.primaryError = error?.name || 'Error'; throw error; });
        };
      } catch { state.clipboard.primaryResult = 'UNKNOWN'; }
      try {
        if (originalExecCommand) document.execCommand = (...args) => {
          if (args[0] === 'copy') state.clipboard.fallbackAttempted = 'YES';
          const result = originalExecCommand(...args);
          if (args[0] === 'copy') state.clipboard.fallbackResult = result ? 'SUCCESS' : 'FAIL';
          return result;
        };
      } catch { state.clipboard.fallbackAttempted = 'UNKNOWN'; }
      const originalHandler = App.quotationCopyDraft;
      App.quotationCopyDraft = async function (...args) {
        state.handler.entered = 'YES';
        try { const result = await originalHandler.apply(this, args); state.handler.completed = 'YES'; return result; }
        catch (error) { state.handler.completed = 'NO'; state.handler.error = String(error?.name || 'Error') + ': ' + String(error?.message || error); throw error; }
      };
      state.restore = () => { App.quotationCopyDraft = originalHandler; try { if (originalWriteText) clipboard.writeText = originalWriteText; } catch {} try { if (originalExecCommand) document.execCommand = originalExecCommand; } catch {} };
      let clipboardPermission = 'UNKNOWN';
      try { if (navigator.permissions?.query) clipboardPermission = (await navigator.permissions.query({ name: 'clipboard-write' })).state; } catch (error) { clipboardPermission = 'ERROR:' + (error.name || 'unknown'); }
      return { selector: '[data-action="quotation-copy"]', text: button.textContent.trim(), tagName: button.tagName, id: button.id || '', className: button.className || '', disabled: button.disabled, ariaDisabled: button.getAttribute('aria-disabled'), hidden: button.hidden, offsetWidth: button.offsetWidth, offsetHeight: button.offsetHeight, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }, x, y, display: style.display, visibility: style.visibility, opacity: style.opacity, pointerEvents: style.pointerEvents, viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio, scroll: { x: scrollX, y: scrollY }, hit: describe(hit), closestMatches: hit?.closest('button') === button, clipboardPermission, clipboard: { secureContext: window.isSecureContext, available: Boolean(clipboard), writeText: Boolean(clipboard?.writeText), commandSupported: document.queryCommandSupported('copy'), execCommand: typeof document.execCommand === 'function' } };
    })()`);
    if (!diagnosis.closestMatches || diagnosis.disabled || diagnosis.pointerEvents === 'none') throw new Error(`TEST_HARNESS_TARGETING_FAILURE: ${JSON.stringify({ scrollEvidence, diagnosis })}`);
    const prePressHit = await evalValue(send, `(() => {
      const button = document.querySelector('[data-action="quotation-copy"]');
      const hit = document.elementFromPoint(${JSON.stringify(diagnosis.x)}, ${JSON.stringify(diagnosis.y)});
      return { hit: hit ? { tagName: hit.tagName, id: hit.id || '', className: String(hit.className || ''), text: String(hit.textContent || '').trim().slice(0, 80) } : null, closestMatches: hit?.closest('button') === button };
    })()`);
    if (!prePressHit.closestMatches) throw new Error(`TEST_HARNESS_TARGETING_FAILURE: ${JSON.stringify({ scrollEvidence, diagnosis, prePressHit })}`);
    if (nativeControl) {
      await evalValue(send, `HTMLElement.prototype.click.call(document.querySelector('[data-action="quotation-copy"]'))`);
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: diagnosis.x, y: diagnosis.y, button: 'none' });
      await sleep(75);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: diagnosis.x, y: diagnosis.y, button: 'left', buttons: 1, clickCount: 1 });
      await sleep(75);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: diagnosis.x, y: diagnosis.y, button: 'left', buttons: 0, clickCount: 1 });
    }
    await sleep(3000);
    const evidence = await evalValue(send, `(() => {
      const state = window.__quotationCopyDiagnosis || {};
      const workspace = App.getQuotationWorkspace();
      const copies = (workspace.rfqAuditTrail || []).filter(item => item.action === '复制报价草稿');
      state.restore?.();
      return { handler: state.handler, events: state.events, errors: state.errors, clipboard: state.clipboard, toast: document.getElementById('toastStack')?.innerText || '', copies, quotationCount: (workspace.rfqSavedDrafts || []).length };
    })()`);
    const trustedClick = evidence.events.some(event => event.type === 'click' && event.isTrusted);
    const clickObserved = evidence.events.some(event => event.type === 'click');
    const copyCreated = evidence.copies.length === prepared.copyAuditCount + 1;
    const matchingAuditCount = evidence.copies.filter(item => item.quotationId === prepared.quotationId || item.sourceQuotationId === prepared.quotationId).length;
    const uiSuccess = evidence.toast.includes('报价草稿已复制');
    const report = { mode: nativeControl ? 'NATIVE_CONTROL' : 'REAL_CDP', prepared, scrollEvidence, diagnosis, prePressHit, trustedClick, clickObserved, evidence, copyCreated, matchingAuditCount, uiSuccess };
    if (!nativeControl && trustedClick && evidence.handler.entered === 'YES' && evidence.handler.completed === 'YES' && copyCreated && matchingAuditCount !== 1) {
      throw new Error(`BUSINESS_FAILURE_AUDIT_MISSING: 成功复制审计缺少当前 quotationId 关联。${JSON.stringify(report)}`);
    }
    return `quotation-copy-diagnosis: ${JSON.stringify(report)}`;
  } finally { await closeIsolatedPage(session, 'quotation_copy_diagnosis_complete'); }
}

async function rfqContractFailure(send, selector, scenario) {
  const page = JSON.parse(await evalValue(send, `JSON.stringify({ url: location.href, workspace: Boolean(document.querySelector('[data-manufacturing-workspace]')), fields: [...document.querySelectorAll('[id^="manufacturingRfq"]')].map(el => el.id), text: document.body.innerText.slice(0, 600) })`));
  throw new Error(`RFQ_E2E_CONTRACT_MISSING: ${JSON.stringify({ selector, scenario, timeoutMs: 15000, page })}`);
}

async function rfqMouse(send, selector, scenario) {
  const present = await evalValue(send, `(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false; el.scrollIntoView({block:'center',inline:'center'}); return true; })()`);
  if (!present) await rfqContractFailure(send, selector, scenario);
  await sleep(200);
  let box = await evalValue(send, `(() => { const el=document.querySelector(${JSON.stringify(selector)}), r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, hit=document.elementFromPoint(x,y); return {x,y,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight},visible:r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:hit===el||hit?.closest('button,input,select,textarea')===el}; })()`);
  if (box && !box.visible && box.width > 0 && box.height > 0) {
    // Scrolling is test-harness positioning only; field values and actions
    // continue to use trusted CDP keyboard/mouse events.
    await evalValue(send, `window.scrollBy(0, ${Math.max(1, Math.ceil(box.y - box.viewport.height / 2))})`);
    await sleep(200);
    box = await evalValue(send, `(() => { const el=document.querySelector(${JSON.stringify(selector)}), r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, hit=document.elementFromPoint(x,y); return {x,y,visible:r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:hit===el||hit?.closest('button,input,select,textarea')===el}; })()`);
  }
  if (!box?.visible || !box.hit) await rfqContractFailure(send, selector, scenario);
  const prePress = await evalValue(send, `(() => { const el=document.querySelector(${JSON.stringify(selector)}), hit=document.elementFromPoint(${box.x},${box.y}); return hit===el||hit?.closest('button,input,select,textarea')===el; })()`);
  if (!prePress) throw new Error(`RFQ_E2E_TARGETING_FAILURE: ${JSON.stringify({ selector, scenario, x: box.x, y: box.y })}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1 });
}

async function rfqInput(send, selector, value, scenario) {
  await rfqMouse(send, selector, scenario);
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await send('Input.insertText', { text: value });
  if (await evalValue(send, `document.querySelector(${JSON.stringify(selector)})?.value`) !== value) throw new Error(`RFQ_E2E_INPUT_FAILURE: ${JSON.stringify({ selector, scenario, value })}`);
}

async function testInquiries() {
  const { ws, send, events } = await openPage(`${baseUrl}/#/inquiries`);
  const session = await setAuth(send, {
    email: process.env.E2E_FIXTURE_REQUESTER_EMAIL, password: process.env.E2E_FIXTURE_REQUESTER_PASSWORD,
    name: 'fixture-requester', role: '操作员', enterpriseName: 'Material Issue Acceptance Fixture'
  });
  await send('Page.reload');
  await waitForValue(() => evalValue(send, `Boolean(document.querySelector('[data-manufacturing-workspace]') && document.querySelector('#manufacturingRfqCustomer') && document.querySelector('[data-action="manufacturing-rfq-save"]'))`), Boolean, 'RFQ page ready');
  const readiness = await waitForValue(
    () => evalValue(send, `JSON.stringify({ loaded: App.temp.manufacturing.loaded, loading: App.temp.manufacturing.loading, mode: App.temp.manufacturing.mode, error: App.temp.manufacturing.error })`),
    value => { const state = JSON.parse(value); return state.loaded === true && state.loading === false; },
    'RFQ business context ready'
  );
  const readyState = JSON.parse(readiness);
  if (readyState.mode !== 'server') throw new Error(`BACKEND_READINESS_FAILURE: ${JSON.stringify(readyState)}`);
  const marker = `RFQ-E2E-${Date.now()}`;
  const customerId = process.env.E2E_FIXTURE_RFQ_CUSTOMER_ID;
  if (!customerId) throw new Error('RFQ_E2E_FIXTURE_MISSING: customer prerequisite');
  await rfqMouse(send, '#manufacturingRfqCustomer', 'R2 customer');
  // Focus does not set a business value; native keyboard events below perform
  // the actual user-visible selection.
  await evalValue(send, `document.querySelector('#manufacturingRfqCustomer')?.focus()`);
  // Native select controls require keyboard input after the trusted pointer
  // activation; no DOM value assignment is used for this business field.
  for (const [key, code, value] of [['Home', 'Home', 36], ['ArrowDown', 'ArrowDown', 40]]) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: value, nativeVirtualKeyCode: value });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: value });
    await sleep(100);
  }
  await send('Input.dispatchKeyEvent', { type: 'char', text: 'C', unmodifiedText: 'C', key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, nativeVirtualKeyCode: 67 });
  await sleep(100);
  const selectedCustomer = await evalValue(send, `document.querySelector('#manufacturingRfqCustomer')?.value`);
  if (selectedCustomer !== customerId) throw new Error(`RFQ_E2E_INPUT_FAILURE: ${JSON.stringify({ expected: customerId, actual: selectedCustomer, options: JSON.parse(await evalValue(send, "JSON.stringify([...document.querySelector('#manufacturingRfqCustomer').options].map(option => ({value:option.value,text:option.textContent})))")) })}`);
  for (const [selector, value, scenario] of [
    // validateRfq currently requires only customer and product name.  The
    // test deliberately exercises that live product contract instead of
    // inventing requirements merely because later assessment may flag them.
    ['#manufacturingRfqProduct', marker, 'R2 product']
  ]) await rfqInput(send, selector, value, scenario);
  await evalValue(send, `document.querySelector('[data-action="manufacturing-rfq-save"]')?.scrollIntoView({ block: 'center', inline: 'center' })`);
  await sleep(200);
  const preClickState = JSON.parse(await evalValue(send, `JSON.stringify((() => {
    const state = App.temp.manufacturing;
    const button = document.querySelector('[data-action="manufacturing-rfq-save"]');
    const rect = button?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : 0;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const hit = document.elementFromPoint(x, y);
    window.__rfqSubmitEvidence = { clicks: [], installedAt: Date.now() };
    document.addEventListener('click', event => {
      const action = event.target?.closest?.('[data-action]')?.dataset?.action || '';
      if (action === 'manufacturing-rfq-save') window.__rfqSubmitEvidence.clicks.push({ isTrusted: event.isTrusted, action, target: event.target?.tagName || '', timestamp: Date.now() });
    }, { capture: true, once: true });
    return {
      route: App.route,
      loaded: state.loaded,
      loading: state.loading,
      mode: state.mode,
      error: state.error,
      syncStatus: Store.syncStatus,
      auth: AuthClient.isLoggedIn(),
      customerCount: state.customers.length,
      projectCount: state.projects.length,
      button: { exists: Boolean(button), disabled: Boolean(button?.disabled), action: button?.dataset?.action || '', targetHit: hit === button || hit?.closest?.('[data-action]') === button },
      selectedRfqId: state.selectedRfqId,
      rfq: state.rfq
    };
  })())`));
  console.error(`RFQ_PRE_CLICK_STATE ${JSON.stringify(preClickState)}`);
  if (!preClickState.button.targetHit) throw new Error(`TEST_HARNESS_TARGETING_FAILURE: ${JSON.stringify(preClickState)}`);
  await rfqMouse(send, '[data-action="manufacturing-rfq-save"]', 'R2 submit');
  let response;
  try {
    response = await waitForNetworkResponse({ send, events }, '/api/manufacturing/v1/rfqs', 5000, 'POST');
  } catch (error) {
    const postClickState = JSON.parse(await evalValue(send, `JSON.stringify({
      clicks: window.__rfqSubmitEvidence?.clicks || [],
      mode: App.temp.manufacturing.mode,
      error: App.temp.manufacturing.error,
      toast: document.getElementById('toastStack')?.innerText || '',
      selectedRfqId: App.temp.manufacturing.selectedRfqId,
      rfq: App.temp.manufacturing.rfq,
      buttonDisabled: Boolean(document.querySelector('[data-action="manufacturing-rfq-save"]')?.disabled)
    })`));
    const network = events.filter(event => ['Network.requestWillBeSent', 'Network.responseReceived', 'Runtime.exceptionThrown', 'Log.entryAdded'].includes(event.method)).slice(-40);
    console.error(`RFQ_POST_CLICK_STATE ${JSON.stringify({ postClickState, network })}`);
    const trusted = postClickState.clicks.some(item => item.isTrusted && item.action === 'manufacturing-rfq-save');
    if (!trusted) throw new Error(`UI_EVENT_DISPATCH_FAILURE: trusted manufacturing-rfq-save click not observed. ${JSON.stringify(postClickState)}`);
    if (postClickState.error) throw new Error(`CLIENT_PRECONDITION_BLOCK: ${JSON.stringify(postClickState)}`);
    throw error;
  }
  console.error(`RFQ_SUBMIT_EVIDENCE ${JSON.stringify({ preClickState, click: JSON.parse(await evalValue(send, `JSON.stringify(window.__rfqSubmitEvidence?.clicks || [])`)), postStatus: response.status })}`);
  const createdId = response.body?.data?.rfq?.id;
  if (![200, 201].includes(response.status) || !createdId) throw new Error(`RFQ_E2E_CREATE_FAILED: ${JSON.stringify(response)}`);
  await waitForValue(() => evalValue(send, `document.getElementById('toastStack')?.innerText || ''`), value => value.includes('RFQ 已创建'), 'R3 create success UI', 3000);
  const readback = await requestApi(`/api/manufacturing/v1/rfqs/${createdId}`, session.token);
  const record = readback.body?.data?.rfq;
  if (!readback.ok || record?.id !== createdId || record?.product_name !== marker || record?.customer_id !== customerId) throw new Error(`RFQ_E2E_PERSISTENCE_FAILED: ${JSON.stringify({ status: readback.status, record })}`);
  await send('Page.reload');
  await waitForValue(() => evalValue(send, 'document.body.innerText'), body => body.includes(marker), 'R5 RFQ refresh');
  const list = await requestApi(`/api/manufacturing/v1/rfqs?q=${encodeURIComponent(marker)}&pageSize=100`, session.token);
  const matches = (list.body?.data?.items || []).filter(item => item.product_name === marker);
  if (!list.ok || matches.length !== 1 || matches[0].id !== createdId) throw new Error(`RFQ_E2E_DUPLICATE_OR_READBACK_FAILED: ${JSON.stringify({ status: list.status, matches })}`);
  const browserErrors = events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'));
  if (browserErrors.length) throw new Error(`RFQ browser errors: ${JSON.stringify(browserErrors.slice(-2))}`);
  ws.close();
  return `rfq-server-contract-r1-r7: ok ${JSON.stringify({ createdId, marker, matchingRecordCount: matches.length, isolatedFixture: Boolean(process.env.E2E_FIXTURE_DB_PATH) })}`;
}

async function testMonitor() {
  const { ws, send } = await openPage(`${baseUrl}/#/monitor`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(2500);
  const body = await evalValue(send, 'document.body.innerText');
  if (!body.includes('系统监控') && !body.includes('健康状态') && !body.includes('Agent任务总数')) throw new Error('Monitor 页面未打开');
  ws.close();
  return 'monitor: ok';
}

// This is deliberately an environment probe only: it proves the managed
// browser can navigate to the configured application entry without creating
// users, changing inventory, or making business assertions.
async function testEnvironmentEntry() {
  const { ws, send, pageEvidence } = await openPage(baseUrl);
  pageEvidence.currentStep = 'cdp_precheck_before_reload';
  const arithmeticBeforeReload = await evalValue(send, '1 + 1');
  const locationBeforeReload = await evalValue(send, 'location.href');
  if (arithmeticBeforeReload !== 2 || !String(locationBeforeReload).startsWith(baseUrl)) {
    throw new Error(`CDP_PRECHECK_FAILED:${JSON.stringify({ arithmeticBeforeReload, locationBeforeReload })}`);
  }
  const readState = () => evalValue(send, `JSON.stringify({
    readyState: document.readyState,
    title: document.title,
    bodyLength: (document.body?.innerText || '').trim().length,
    url: location.href
  })`);
  const initial = JSON.parse(await readState());
  pageEvidence.currentStep = 'cdp_precheck_reload';
  await send('Page.reload');
  await sleep(1000);
  pageEvidence.currentStep = 'cdp_precheck_after_reload';
  const arithmeticAfterReload = await evalValue(send, '1 + 1');
  const locationAfterReload = await evalValue(send, 'location.href');
  const state = JSON.parse(await readState());
  pageEvidence.expectedClose = true;
  ws.close();
  if (arithmeticAfterReload !== 2 || !String(locationAfterReload).startsWith(baseUrl)
    || initial.readyState !== 'complete' || !initial.bodyLength || !initial.url.startsWith(baseUrl)
    || state.readyState !== 'complete' || !state.bodyLength || !state.url.startsWith(baseUrl)) {
    throw new Error(`CDP_PRECHECK_FAILED:${JSON.stringify({ arithmeticBeforeReload, locationBeforeReload, arithmeticAfterReload, locationAfterReload, initial, state })}`);
  }
  return 'CDP_PRECHECK: PASS (evaluate, location, reload, evaluate)';
}

async function main() {
  await waitForServer(baseUrl);
  const results = [];
  if (environmentOnly) {
    results.push(await testEnvironmentEntry());
    console.log(results.join('\n'));
    return;
  }
  if (quotationOnly) {
    results.push(await testQuotationCopyAudit());
    console.log(results.join('\n'));
    return;
  }
  if (rfqOnly) {
    results.push(await testInquiries());
    console.log(results.join('\n'));
    return;
  }
  if (ocrOnly) {
    results.push(await testOcr());
    console.log(results.join('\n'));
    return;
  }
  if (ocrCdpMinimal) {
    results.push(await testOcrCdpMinimal());
    console.log(results.join('\n'));
    return;
  }
  if (materialIssueScenarioA) {
    results.push(await testMaterialIssueScenarioA());
    console.log(results.join('\n'));
    return;
  }
  if (materialIssueScenarioB) {
    results.push(await testMaterialIssueScenarioB());
    console.log(results.join('\n'));
    return;
  }
  if (materialIssueScenarioC) {
    results.push(await testMaterialIssueScenarioC());
    console.log(results.join('\n'));
    return;
  }
  if (materialIssueScenarioD) {
    results.push(await testMaterialIssueScenarioD());
    console.log(results.join('\n'));
    return;
  }
  if (materialIssueScenarioE) {
    results.push(await testMaterialIssueScenarioE());
    console.log(results.join('\n'));
    return;
  }
  results.push(await testChat());
  results.push(await testOcr());
  results.push(await testQuotation());
  results.push(await testInquiries());
  results.push(await testAgent());
  results.push(await testMonitor());
  console.log(results.join('\n'));
}

main().then(() => {
  closeSharedBrowserConnection();
}).catch(err => {
  console.error(err);
  closeSharedBrowserConnection();
  process.exitCode = 1;
});
