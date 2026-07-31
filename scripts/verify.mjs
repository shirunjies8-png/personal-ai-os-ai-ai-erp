import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
// Keep every verification subprocess on the same Node runtime that started this
// script. On developer machines PATH can resolve a different global Node (for
// example Node 25), while better-sqlite3 is intentionally built for Node 22.
const nodeExecutable = process.execPath;
const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const baseUrl = 'http://127.0.0.1:3000';
const chromePort = 9222;
const environmentOnly = process.argv.includes('--environment-only');

// A child can flush its final log line while the inherited output pipe is
// closing. EPIPE is a transport teardown condition, not a browser or product
// failure; keep it from turning verified cleanup into an uncaught exception.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', error => {
    if (error?.code !== 'EPIPE') throw error;
  });
}

function log(step, msg) {
  console.log(`\n[verify] ${step}${msg ? `：${msg}` : ''}`);
}

function runChecked(command, args, opts = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 执行失败`);
  }
}

async function waitFor(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`等待服务超时：${url}`);
}

function processEvidence(child, label) {
  return {
    label,
    pid: child?.pid || null,
    parentPid: process.pid,
    exited: child ? Boolean(child.exitCode !== null || child.signalCode) : null,
    exitCode: child?.exitCode ?? null,
    signalCode: child?.signalCode ?? null
  };
}

function recordOutput(child, label) {
  const output = { stdout: '', stderr: '' };
  child.stdout.on('data', chunk => {
    const text = String(chunk);
    output.stdout = (output.stdout + text).slice(-4000);
    process.stdout.write(`[${label}] ${text}`);
  });
  child.stderr.on('data', chunk => {
    const text = String(chunk);
    output.stderr = (output.stderr + text).slice(-4000);
    process.stderr.write(`[${label}] ${text}`);
  });
  return output;
}

async function isPortListening(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = value => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

async function assertPortUnused(port, label) {
  if (await isPortListening(port)) throw new Error(`${label} 端口 ${port} 已有监听进程`);
}

function terminateProcessGroup(child, label) {
  if (!child?.pid || child.exitCode !== null || child.signalCode) return;
  try {
    // Keep children attached to this verifier so the lifecycle owner is
    // explicit. The unique Chrome profile plus post-cleanup port probes detect
    // descendants that a direct PID signal could not terminate.
    child.kill('SIGTERM');
  } catch (error) {
    console.warn(`[verify] ${label} 清理失败：${error.message}`);
  }
}

async function waitForExit(child, timeoutMs = 5000) {
  const started = Date.now();
  while (child?.exitCode === null && !child?.signalCode && Date.now() - started < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function assertPortReleased(port, label) {
  const released = !(await isPortListening(port));
  if (!released) console.warn(`[verify] ${label}：端口 ${port} 仍可连接`);
  return released;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败：${url}`);
  return res.json();
}

async function runBrowserLifecycle({ chromePath, cycle }) {
  let server;
  let chrome;
  let chromeProfile;
  let serverOutput;
  let chromeOutput;
  const evidence = { cycle, baseUrl, chromePort, startedAt: new Date().toISOString() };
  try {
    await assertPortUnused(3000, '应用');
    await assertPortUnused(chromePort, 'Chrome CDP');

    server = spawn(nodeExecutable, ['server.js'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    serverOutput = recordOutput(server, 'server');
    server.on('exit', (code, signal) => console.warn(`[verify] server 退出：code=${code} signal=${signal || ''}`));

    // Health belongs to the process started above: a preflight port probe
    // prevents an older process on :3000 from satisfying this check.
    await waitFor(`${baseUrl}/api/health`, 30000);
    const health = await fetchJson(`${baseUrl}/api/health`);
    if (!health.ok) throw new Error('/api/health 未返回 ok');
    const selfTest = await fetchJson(`${baseUrl}/api/self-test`);
    if (!selfTest.ok) throw new Error('/api/self-test 未返回 ok');

    chromeProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'eaos-verify-chrome-'));
    chrome = spawn(chromePath, [
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${chromeProfile}`,
      baseUrl
    ], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    chromeOutput = recordOutput(chrome, 'chrome');
    chrome.on('exit', (code, signal) => console.warn(`[verify] chrome 退出：code=${code} signal=${signal || ''}`));
    await waitFor(`http://127.0.0.1:${chromePort}/json/version`, 30000);

    runChecked(nodeExecutable, ['scripts/run-e2e.mjs', ...(environmentOnly ? ['--environment-only'] : [])], {
      env: { ...process.env, E2E_BASE_URL: baseUrl, E2E_CHROME_PORT: String(chromePort) }
    });
    evidence.result = 'READY';
    return evidence;
  } catch (error) {
    evidence.result = 'BLOCKED';
    evidence.error = error.message;
    evidence.server = processEvidence(server, 'server');
    evidence.chrome = processEvidence(chrome, 'chrome');
    evidence.serverOutput = serverOutput || null;
    evidence.chromeOutput = chromeOutput || null;
    console.error(`[verify] BROWSER_ENVIRONMENT_EVIDENCE ${JSON.stringify(evidence)}`);
    throw error;
  } finally {
    terminateProcessGroup(chrome, 'Chrome');
    terminateProcessGroup(server, '应用');
    await Promise.all([waitForExit(chrome), waitForExit(server)]);
    evidence.cleanup = {
      chrome: processEvidence(chrome, 'chrome'),
      server: processEvidence(server, 'server'),
      chromePortReleased: await assertPortReleased(chromePort, 'Chrome CDP 清理后端口'),
      applicationPortReleased: await assertPortReleased(3000, '应用清理后端口')
    };
    console.log(`[verify] BROWSER_ENVIRONMENT_CLEANUP ${JSON.stringify(evidence.cleanup)}`);
    if (chromeProfile) await fs.rm(chromeProfile, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  log('1/4', 'node --check');
  runChecked('npm', ['run', 'check']);

  log('2/4', 'npm run build');
  runChecked('npm', ['run', 'build']);

  log('3/4', 'npm run bug:scan');
  runChecked('npm', ['run', 'bug:scan', '--', '--check-only']);

  log('4/4', environmentOnly ? 'browser environment' : 'browser e2e');
  const chromePath = chromeCandidates.find(candidate => existsSync(candidate));
  if (!chromePath) {
    console.log('[verify] 未找到 Chrome 可执行文件，跳过浏览器 e2e。');
    return;
  }

  const cycles = environmentOnly ? 2 : 1;
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const result = await runBrowserLifecycle({ chromePath, cycle });
    console.log(`[verify] Browser environment cycle ${cycle}/${cycles}: ${result.result}`);
  }
  if (!environmentOnly) {
    const report = await fs.readFile(path.join(root, 'TEST_REPORT.md'), 'utf8').catch(() => '');
    if (report) console.log('[verify] TEST_REPORT.md 已更新。');
    const bugReport = await fs.readFile(path.join(root, 'BUG_REPORT.md'), 'utf8').catch(() => '');
    if (bugReport) console.log('[verify] BUG_REPORT.md 已更新。');
  }
}

main().catch(err => {
  console.error(`[verify] 失败：${err.message}`);
  process.exit(1);
});
