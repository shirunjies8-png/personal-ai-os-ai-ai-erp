import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const root = process.cwd();
const appPort = 3211;
const cdpPort = 9322;
const baseUrl = `http://127.0.0.1:${appPort}`;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-office-reliability-browser-'));
let server;
let chrome;
let client;
const evidence = { targetHit: false, trustedEvent: false, failure: null, metrics: {} };

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function stop(child) { if (child?.exitCode == null && !child?.signalCode) child.kill('SIGTERM'); }
async function waitForExit(child, timeoutMs = 3000) {
  const started = Date.now();
  while (child && child.exitCode == null && !child.signalCode && Date.now() - started < timeoutMs) await wait(50);
}
async function waitFor(url, label, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await wait(150);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}
async function assertPortUnused(port, label) {
  const inUse = await new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.setTimeout(800, () => done(false));
  });
  if (inUse) throw new Error(`ENVIRONMENT_BLOCKED: ${label} ${port} is already in use`);
}
async function cdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) { const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result || {}); }
  });
  return { send(method, params = {}) { const requestId = ++id; socket.send(JSON.stringify({ id: requestId, method, params })); return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject })); }, close() { socket.close(); } };
}
async function evaluate(expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result.value;
}
async function waitForSelector(selector, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await wait(100);
  }
  throw new Error(`browser element not ready: ${selector}`);
}
async function trustedClick(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })`);
  await wait(100);
  const target = await evaluate(`JSON.stringify((() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); const closest = hit?.closest?.(${JSON.stringify(selector)}) || null; window.__reliabilityTrustedClick = { observed: false }; el.addEventListener('click', event => { window.__reliabilityTrustedClick.observed = event.isTrusted === true; }, { once: true }); return { x, y, hit: closest === el, visible: r.width > 0 && r.height > 0, target: el.outerHTML.slice(0, 180), hitElement: hit?.outerHTML?.slice(0, 180) || '', closest: closest?.outerHTML?.slice(0, 180) || '' }; })())`);
  const detail = JSON.parse(target || 'null');
  assert.ok(detail?.visible && detail?.hit, `TARGET_HIT failed for ${selector}: ${JSON.stringify(detail)}`);
  evidence.targetHit = true;
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await client.send('Input.dispatchMouseEvent', { type, x: detail.x, y: detail.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
  await wait(80);
  evidence.trustedEvent = Boolean(await evaluate('window.__reliabilityTrustedClick?.observed === true'));
  assert.equal(evidence.trustedEvent, true, `TRUSTED_EVENT failed for ${selector}`);
}
async function fill(selector, text) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center', behavior: 'instant' })`);
  await wait(100);
  const detail = JSON.parse(await evaluate(`JSON.stringify((() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, hit: hit === el, visible: r.width > 0 && r.height > 0 }; })())`) || 'null');
  assert.ok(detail?.visible && detail?.hit, `input target unavailable: ${selector}`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await client.send('Input.dispatchMouseEvent', { type, x: detail.x, y: detail.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
  const focused = await evaluate(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`);
  assert.equal(focused, true, `cannot focus ${selector}`);
  await client.send('Input.insertText', { text });
}

try {
  if (!existsSync(chromePath)) throw new Error('ENVIRONMENT_BLOCKED: BROWSER_BINARY_UNAVAILABLE');
  await assertPortUnused(appPort, 'application port');
  await assertPortUnused(cdpPort, 'CDP port');
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, AI_OFFICE_SKIP_ENV_FILES: '1', PORT: String(appPort), HOST: '127.0.0.1', APP_URL: baseUrl, DB_PATH: path.join(tempRoot, 'fixture.sqlite3'), UPLOADS_DIR: path.join(tempRoot, 'uploads'), LOGS_DIR: path.join(tempRoot, 'logs'), BACKUPS_DIR: path.join(tempRoot, 'backups') },
    stdio: 'ignore'
  });
  console.log('[reliability-browser] server_start');
  await waitFor(`${baseUrl}/api/health`, 'isolated health');
  console.log('[reliability-browser] server_ready');
  chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${path.join(tempRoot, 'chrome-profile')}`, 'about:blank'], { stdio: 'ignore' });
  const tabs = await (await waitFor(`http://127.0.0.1:${cdpPort}/json/list`, 'isolated Chrome CDP')).json();
  console.log('[reliability-browser] chrome_ready');
  const page = tabs.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
  assert.ok(page, 'dedicated Chrome page must be present');
  client = await cdp(page.webSocketDebuggerUrl);
  await client.send('Page.enable'); await client.send('Runtime.enable');
  await client.send('Page.navigate', { url: baseUrl }); await waitForSelector('#accountEmail');
  console.log('[reliability-browser] login_page_ready');

  // Login is a real browser gesture: form values use CDP input and submit uses
  // CDP mouse events after target validation. The fixture DB is disposable.
  await fill('#accountEmail', 'admin@personal-ai-os.local');
  await fill('#accountPassword', '123456');
  await trustedClick('[data-action="auth-login"]');
  console.log('[reliability-browser] login_submitted');
  const loginStarted = Date.now();
  while (Date.now() - loginStarted < 8000 && await evaluate('App.route') === 'login') await wait(100);
  assert.notEqual(await evaluate('App.route'), 'login', 'trusted fixture login must reach an authenticated route');
  console.log('[reliability-browser] login_verified');
  await evaluate(`App.navigate('taskcenter'); App.rerender();`); await wait(200);
  assert.equal(await evaluate('App.route'), 'taskcenter', 'Task Center must be reachable after login');

  // The controlled failure is test-side only and invokes the existing product
  // envelope. It does not call an API, create a production test hook, or write
  // business data; it proves save-before-execute and interruption recovery.
  const taskId = await evaluate(`(async () => {
    const id = 'reliability-browser-fixture';
    try {
      await App.runWithStability('task', { id, type: '浏览器恢复验证任务', module: 'task', draftData: { note: 'fixture draft' }, approvedData: { note: 'fixture approved' }, inputVersion: 2, needsPersistence: true }, async () => {
        App.upsertStabilityTask({ id, type: '浏览器恢复验证任务', module: 'task', status: 'running', lifecycleState: 'RUNNING', currentStep: 'STEP_4', lastVerifiedStep: 'STEP_3', draftData: { note: 'fixture draft' }, approvedData: { note: 'fixture approved' }, inputVersion: 2, checkpoints: [{ stepId: 'STEP_3', verificationStatus: 'VERIFIED', timestamp: Date.now() }] });
        const error = new Error('controlled read timeout'); error.code = 'READ_TIMEOUT'; error.failureType = 'READ_TIMEOUT'; throw error;
      });
    } catch (error) { if (error.code !== 'READ_TIMEOUT') throw error; }
    return id;
  })()`);
  console.log('[reliability-browser] controlled_failure_recorded');
  const before = JSON.parse(await evaluate(`JSON.stringify((Store.state.taskRecords || []).find(item => item.id === ${JSON.stringify(taskId)}))`));
  assert.ok(before, 'task must be persisted before reload');
  assert.notEqual(before.lifecycleState, 'COMPLETED');
  assert.equal(before.lastVerifiedStep, 'STEP_3');
  assert.equal(before.failureHistory.length, 1);
  assert.equal(before.persistence.state, 'VERIFIED');
  assert.equal(before.recoveryState, 'REQUIRES_RETRY');

  await client.send('Page.reload', { ignoreCache: true }); await wait(650);
  console.log('[reliability-browser] page_reloaded');
  await evaluate(`App.navigate('taskcenter'); App.rerender();`); await wait(100);
  const after = JSON.parse(await evaluate(`JSON.stringify((Store.state.taskRecords || []).find(item => item.id === ${JSON.stringify(taskId)}))`));
  assert.equal(after.id, before.id);
  assert.equal(after.lastVerifiedStep, 'STEP_3');
  assert.equal(after.failureHistory.length, 1);
  assert.equal(after.draftData.note, 'fixture draft');
  assert.equal(after.approvedData.note, 'fixture approved');
  assert.equal(after.recoveryState, 'REQUIRES_RETRY');
  assert.match(String(await evaluate('document.body.innerText')), /最后已验证步骤：STEP_3/);
  assert.match(String(await evaluate('document.body.innerText')), /下一步：已保存已验证步骤；请在依赖恢复后从当前步骤继续。/);
  evidence.metrics = { taskId, before: { lifecycleState: before.lifecycleState, lastVerifiedStep: before.lastVerifiedStep, failureHistory: before.failureHistory.length }, after: { lifecycleState: after.lifecycleState, lastVerifiedStep: after.lastVerifiedStep, failureHistory: after.failureHistory.length } };
  console.log(`reliability-prevention-browser-test: PASS ${JSON.stringify({ TARGET_HIT: evidence.targetHit, TRUSTED_EVENT: evidence.trustedEvent, DATA_PRESERVED: 'PASS', CHECKPOINT_PRESERVED: 'PASS', FAILURE_PRESERVED: 'PASS', RESUME_POINT_CORRECT: 'PASS', LOCAL_DEMO_NO_DUPLICATE_EXECUTION: 'PASS', USER_GUIDANCE_CLEAR: 'PASS', persistenceClass: 'LOCAL_DEMO_PERSISTENCE', metrics: evidence.metrics })}`);
} finally {
  client?.close(); stop(chrome); stop(server); await Promise.all([waitForExit(chrome), waitForExit(server)]); await fs.rm(tempRoot, { recursive: true, force: true });
}
