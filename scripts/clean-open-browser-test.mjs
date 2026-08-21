import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 3210;
const debugPort = 9321;
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-office-clean-open-'));
const dbPath = path.join(tempRoot, 'clean-open.sqlite3');
const profilePath = path.join(tempRoot, 'chrome-profile');
let server;
let chrome;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(url, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await wait(150);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function cdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
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
      const id = ++sequence;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() { socket.close(); }
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result.value;
}

function stop(child) { if (child?.exitCode == null && !child?.signalCode) child.kill('SIGTERM'); }

try {
  if (!existsSync(chromePath)) throw new Error('BROWSER_BINARY_UNAVAILABLE: system Chrome is required for clean-open browser evidence');
  console.log('[clean-open] starting isolated application');
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_URL: `http://127.0.0.1:${port}`, DB_PATH: dbPath, UPLOADS_DIR: path.join(tempRoot, 'uploads'), LOGS_DIR: path.join(tempRoot, 'logs'), BACKUPS_DIR: path.join(tempRoot, 'backups'), AI_OFFICE_SKIP_ENV_FILES: '1' },
    stdio: 'inherit'
  });
  await waitFor(`http://127.0.0.1:${port}/api/health`, 'application health');
  console.log('[clean-open] application health ready');
  chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profilePath}`, 'about:blank'], { stdio: 'ignore' });
  console.log('[clean-open] starting isolated system Chrome');
  const tabs = await (await waitFor(`http://127.0.0.1:${debugPort}/json/list`, 'Chrome CDP')).json();
  const page = tabs.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
  assert.ok(page, 'a dedicated Chrome page must be available');
  const client = await cdp(page.webSocketDebuggerUrl);
  console.log('[clean-open] Chrome CDP ready');
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__cleanOpenEvidence = { unhandled: [] }; window.addEventListener('unhandledrejection', event => window.__cleanOpenEvidence.unhandled.push(String(event.reason?.message || event.reason || ''))); localStorage.setItem('personal-ai-os-auth', JSON.stringify({ token: 'expired-fixture-token', demo: false, user: { id: 'fixture-expired-user' }, enterprise: { id: 'fixture-enterprise' } }));` });
  await client.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  console.log('[clean-open] navigating expired-session fixture');
  await wait(1800);
  const read = () => evaluate(client, `JSON.stringify((() => { const alerts = (Store?.state?.bugAlerts || []).filter(item => item.lifecycle !== 'resolved' && item.lifecycle !== 'ignored'); return { route: App?.route || '', loggedIn: AuthClient.isLoggedIn(), demo: AuthClient.isDemo(), unhandled: window.__cleanOpenEvidence?.unhandled || [], activeAlerts: alerts.map(item => ({ signature: item.signature, message: item.message, count: item.count })) }; })())`);
  const first = JSON.parse(await read());
  assert.equal(first.route, 'login', 'expired session must become the normal login state');
  assert.equal(first.loggedIn, false, 'expired session reference must be cleared');
  assert.equal(first.unhandled.length, 0, 'expected session expiry must not escape as unhandled rejection');
  assert.equal(first.activeAlerts.length, 0, 'normal clean open must not create a current bug');
  const refreshes = [];
  for (let index = 0; index < 3; index += 1) {
    await client.send('Page.reload', { ignoreCache: true });
    await wait(1100);
    const state = JSON.parse(await read());
    assert.equal(state.unhandled.length, 0, `refresh ${index + 1} must not create an unhandled rejection`);
    assert.equal(state.activeAlerts.length, 0, `refresh ${index + 1} must not create a current bug`);
    refreshes.push(state);
  }
  await client.send('Runtime.evaluate', { expression: `Promise.reject(new Error('clean-open-unknown-fixture'))` });
  await wait(300);
  const unknown = JSON.parse(await read());
  assert.equal(unknown.unhandled.length, 1, 'an unknown runtime rejection must remain visible to the global boundary');
  assert.equal(unknown.activeAlerts.length, 1, 'unknown runtime rejection must fail closed as an actionable alert');
  console.log(`clean-open-browser-test: PASS ${JSON.stringify({ first, refreshes: refreshes.map(item => ({ route: item.route, activeAlerts: item.activeAlerts.length, unhandled: item.unhandled.length })), unknown: { activeAlerts: unknown.activeAlerts.length, unhandled: unknown.unhandled.length }, isolatedDb: dbPath })}`);
  client.close();
} finally {
  stop(chrome);
  stop(server);
  await wait(250);
  await fs.rm(tempRoot, { recursive: true, force: true });
}
