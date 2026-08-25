import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const root = process.cwd();
const appPort = 3214;
const cdpPort = 9325;
const baseUrl = `http://127.0.0.1:${appPort}`;
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-office-bug-recovery-browser-'));
let server;
let chrome;
let client;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const stop = child => { if (child?.exitCode == null && !child?.signalCode) child.kill('SIGTERM'); };
async function waitForExit(child, timeoutMs = 3000) {
  const started = Date.now();
  while (child && child.exitCode == null && !child.signalCode && Date.now() - started < timeoutMs) await wait(50);
}
async function assertPortUnused(port, label) {
  const inUse = await new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(800, () => done(false));
  });
  if (inUse) throw new Error(`ENVIRONMENT_BLOCKED: ${label} ${port} is already in use`);
}
async function waitFor(url, label, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await wait(150);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}
async function cdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result || {});
  });
  return {
    send(method, params = {}) {
      const requestId = ++id;
      socket.send(JSON.stringify({ id: requestId, method, params }));
      return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
    },
    close() { socket.close(); }
  };
}
async function evaluate(expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result.value;
}
async function waitForExpression(expression, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await wait(100);
  }
  throw new Error(`browser condition timed out: ${expression}`);
}

try {
  if (!existsSync(chromePath)) throw new Error('ENVIRONMENT_BLOCKED: BROWSER_BINARY_UNAVAILABLE');
  await assertPortUnused(appPort, 'application port');
  await assertPortUnused(cdpPort, 'Chrome CDP port');
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      AI_OFFICE_SKIP_ENV_FILES: '1',
      PORT: String(appPort), HOST: '127.0.0.1', APP_URL: baseUrl,
      DB_PATH: path.join(tempRoot, 'fixture.sqlite3'),
      UPLOADS_DIR: path.join(tempRoot, 'uploads'),
      LOGS_DIR: path.join(tempRoot, 'logs'),
      BACKUPS_DIR: path.join(tempRoot, 'backups')
    },
    stdio: 'ignore'
  });
  await waitFor(`${baseUrl}/api/health`, 'isolated application health');
  chrome = spawn(chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${path.join(tempRoot, 'chrome-profile')}`, 'about:blank'
  ], { stdio: 'ignore' });
  const tabs = await (await waitFor(`http://127.0.0.1:${cdpPort}/json/list`, 'isolated Chrome CDP')).json();
  const page = tabs.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
  assert.ok(page, 'dedicated Chrome page must be present');
  client = await cdp(page.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url: baseUrl });
  await waitForExpression(`typeof App === 'object' && typeof Store === 'object'`);

  await evaluate(`(async () => {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@personal-ai-os.local', password: '123456' }) });
    if (!response.ok) throw new Error('fixture login failed: ' + response.status);
    const payload = await response.json();
    if (!payload?.data?.token) throw new Error('fixture login response has no token');
    localStorage.setItem('personal-ai-os-auth', JSON.stringify({ ...payload.data, demo: false }));
  })()`);
  await client.send('Page.reload', { ignoreCache: true });
  await waitForExpression(`typeof App === 'object' && App.route !== 'login'`);

  await evaluate(`(async () => {
    Store.state.bugAlerts = [];
    Store.state.repairRecords = [];
    Store.state.errorLog = [];
    Store.state.aiErrors = [];
    App.temp.errorCenterView = 'corrupt';
    App.reportBug({ id: 'browser-low', signature: 'browser-low', module: 'Browser Fixture', feature: 'low', type: 'LocalError', message: 'low-current-fixture', severity: 'low' });
    App.reportBug({ id: 'browser-blocking', signature: 'browser-blocking', module: 'Browser Fixture', feature: 'blocking', type: 'BlockingError', message: 'blocking-current-fixture', severity: 'blocking', currentTaskBlocked: true });
    App.reportBug({ id: 'browser-degraded', signature: 'browser-degraded', module: 'Browser Fixture', feature: 'degraded', type: 'Offline', message: 'expected-degraded-fixture', eventKind: 'EXPECTED_DEGRADED' });
    App.reportBug({ id: 'browser-synthetic', signature: 'browser-synthetic', module: 'Browser Fixture', feature: 'test', type: 'SelfTest', message: 'synthetic-fixture', eventKind: 'SYNTHETIC_TEST' });
    App.reportBug({ id: 'browser-history', signature: 'browser-history', module: 'Browser Fixture', feature: 'history', type: 'OldError', message: 'history-fixture', lifecycle: 'resolved', status: '已验证' });
    App.reportBug({
      id: 'browser-recovery', signature: 'browser-recovery', module: 'Browser Fixture', feature: 'known-local-state', type: 'KnownLocalStateError', message: 'known-safe-recovery-fixture', severity: 'low', autoRecovery: true,
      recoveryContract: { actionType: 'REINITIALIZE_KNOWN_LOCAL_UI_STATE', target: 'ERROR_CENTER_VIEW', known: true, deterministic: true, lowRisk: true, reversibleOrSafe: true, noUnknownOutcome: true, noHighRiskAuthority: true, noSecurityBoundaryChange: true }
    });
  })()`);
  await wait(500);
  const automaticRecoveryState = JSON.parse(await evaluate(`JSON.stringify((Store.state.bugAlerts || []).find(item => item.signature === 'browser-recovery') || null)`));
  assert.equal(automaticRecoveryState?.eventKind, 'AUTO_RESOLVED_VERIFIED', `automatic recovery did not reach verified state: ${JSON.stringify(automaticRecoveryState)}`);
  await evaluate(`App.navigate('monitoring'); App.rerender();`);
  await waitForExpression(`document.body.innerText.includes('Error Center · 当前')`);

  const evidence = JSON.parse(await evaluate(`JSON.stringify((() => {
    const alerts = App.getVisibleBugAlerts();
    const model = App.getBugMonitorModel(alerts);
    const recovered = alerts.find(item => item.signature === 'browser-recovery');
    const errorPanel = [...document.querySelectorAll('section.panel')].find(section => section.querySelector('h3')?.textContent?.trim() === 'Error Center · 当前');
    return {
      globalSignatures: model.globalAlerts.map(item => item.signature),
      currentSignatures: App.getErrorCenterAlerts('current', alerts).map(item => item.signature),
      historySignatures: App.getErrorCenterAlerts('history', alerts).map(item => item.signature),
      diagnosticSignatures: App.getErrorCenterAlerts('diagnostic', alerts).map(item => item.signature),
      dockHidden: document.getElementById('bugMonitorDock')?.hidden,
      dockText: document.getElementById('bugMonitorDock')?.innerText || '',
      errorPanelText: errorPanel?.innerText || '',
      recovered
    };
  })())`));
  assert.deepEqual(evidence.globalSignatures, ['browser-blocking']);
  assert.ok(evidence.currentSignatures.includes('browser-low'));
  assert.ok(evidence.currentSignatures.includes('browser-blocking'));
  assert.ok(!evidence.currentSignatures.includes('browser-degraded'));
  assert.ok(!evidence.currentSignatures.includes('browser-synthetic'));
  assert.ok(evidence.historySignatures.includes('browser-history'));
  assert.ok(evidence.historySignatures.includes('browser-recovery'));
  assert.ok(evidence.diagnosticSignatures.includes('browser-degraded'));
  assert.ok(evidence.diagnosticSignatures.includes('browser-synthetic'));
  assert.equal(evidence.dockHidden, false);
  assert.match(evidence.dockText, /1 个阻塞或高严重度问题/);
  assert.match(evidence.errorPanelText, /low-current-fixture/);
  assert.doesNotMatch(evidence.errorPanelText, /expected-degraded-fixture|synthetic-fixture|history-fixture/);
  assert.equal(evidence.recovered.verificationResult, 'PASS');
  assert.equal(evidence.recovered.recoveryAttempts.length, 1);
  assert.equal(evidence.recovered.originalFailureEvidence.message, 'known-safe-recovery-fixture');

  await evaluate(`(() => { const item = Store.state.bugAlerts.find(entry => entry.signature === 'browser-blocking'); item.lifecycle = 'resolved'; item.status = '已验证'; App.renderBugMonitor(); })()`);
  assert.equal(await evaluate(`document.getElementById('bugMonitorDock').hidden`), true, 'global dock hides after the only blocker is resolved');
  console.log(`bug-monitor-recovery-browser-test: PASS ${JSON.stringify({ globalPolicy: evidence.globalSignatures, currentCount: evidence.currentSignatures.length, diagnosticCount: evidence.diagnosticSignatures.length, historyCount: evidence.historySignatures.length, recoveryState: evidence.recovered.recoveryState, originalFailurePreserved: true })}`);
} finally {
  client?.close();
  stop(chrome);
  stop(server);
  await Promise.all([waitForExit(chrome), waitForExit(server)]);
  await fs.rm(tempRoot, { recursive: true, force: true });
}
