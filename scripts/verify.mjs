import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
// Keep every verification subprocess on the same Node runtime that started this
// script. On developer machines PATH can resolve a different global Node (for
// example Node 25), while better-sqlite3 is intentionally built for Node 22.
const nodeExecutable = process.execPath;
const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

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

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败：${url}`);
  return res.json();
}

async function main() {
  log('1/4', 'node --check');
  runChecked('npm', ['run', 'check']);

  log('2/4', 'npm run build');
  runChecked('npm', ['run', 'build']);

  log('3/4', 'npm run bug:scan');
  runChecked('npm', ['run', 'bug:scan', '--', '--check-only']);

  log('4/4', 'browser e2e');
  const chromePath = chromeCandidates.find(candidate => existsSync(candidate));
  if (!chromePath) {
    console.log('[verify] 未找到 Chrome 可执行文件，跳过浏览器 e2e。');
    return;
  }

  const server = spawn(nodeExecutable, ['server.js'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });
  server.stdout.on('data', chunk => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on('data', chunk => process.stderr.write(`[server] ${chunk}`));

  const chrome = spawn(chromePath, [
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/eaos-verify-chrome',
    'http://127.0.0.1:3000'
  ], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });
  chrome.stdout.on('data', chunk => process.stdout.write(`[chrome] ${chunk}`));
  chrome.stderr.on('data', chunk => process.stderr.write(`[chrome] ${chunk}`));

  try {
    await waitFor('http://127.0.0.1:3000/api/health', 30000);
    const health = await fetchJson('http://127.0.0.1:3000/api/health');
    if (!health.ok) throw new Error('/api/health 未返回 ok');
    const selfTest = await fetchJson('http://127.0.0.1:3000/api/self-test');
    if (!selfTest.ok) throw new Error('/api/self-test 未返回 ok');
    await waitFor('http://127.0.0.1:9222/json/version', 30000);
    runChecked(nodeExecutable, ['scripts/run-e2e.mjs']);
    const report = await fs.readFile(path.join(root, 'TEST_REPORT.md'), 'utf8').catch(() => '');
    if (report) console.log('[verify] TEST_REPORT.md 已更新。');
    const bugReport = await fs.readFile(path.join(root, 'BUG_REPORT.md'), 'utf8').catch(() => '');
    if (bugReport) console.log('[verify] BUG_REPORT.md 已更新。');
  } finally {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    try { process.kill(-chrome.pid, 'SIGTERM'); } catch {}
  }
}

main().catch(err => {
  console.error(`[verify] 失败：${err.message}`);
  process.exit(1);
});
