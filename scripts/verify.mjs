import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { createMaterialIssueFixture, cleanupMaterialIssueFixture } from './material-issue-fixture.mjs';

const root = process.cwd();
// Keep every verification subprocess on the same Node runtime that started this
// script. On developer machines PATH can resolve a different global Node (for
// example Node 25), while better-sqlite3 is intentionally built for Node 22.
const nodeExecutable = process.execPath;
const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
// Verification ports are explicit inputs: the defaults preserve the historic
// contract, while a caller may select a known-free isolated pair.  Do not
// search for or fall back to another port: ownership must be fail-closed.
const appPort = Number(process.env.VERIFY_APP_PORT || 3000);
const chromePort = Number(process.env.VERIFY_CHROME_PORT || 9222);
if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) {
  throw new Error(`VERIFY_APP_PORT 无效：${process.env.VERIFY_APP_PORT}`);
}
if (!Number.isInteger(chromePort) || chromePort < 1 || chromePort > 65535) {
  throw new Error(`VERIFY_CHROME_PORT 无效：${process.env.VERIFY_CHROME_PORT}`);
}
const baseUrl = `http://127.0.0.1:${appPort}`;
const environmentOnly = process.argv.includes('--environment-only');
const fixtureMode = process.argv.includes('--material-issue-fixture');
const materialIssueScenarioA = process.argv.includes('--material-issue-scenario-a');
const materialIssueScenarioB = process.argv.includes('--material-issue-scenario-b');
const materialIssueScenarioC = process.argv.includes('--material-issue-scenario-c');
const materialIssueScenarioD = process.argv.includes('--material-issue-scenario-d');
const materialIssueScenarioE = process.argv.includes('--material-issue-scenario-e');
const quotationOnly = process.argv.includes('--quotation-only');
const rfqOnly = process.argv.includes('--rfq-only');
const ocrOnly = process.argv.includes('--ocr-only');
const ocrCdpMinimal = process.argv.includes('--ocr-cdp-minimal');
const quotationCopyNativeControl = process.argv.includes('--quotation-copy-native-control');
const browserOnly = process.argv.includes('--browser-only');

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

async function readDevToolsPort(chromeProfile) {
  try {
    const file = path.join(chromeProfile, 'DevToolsActivePort');
    const raw = await fs.readFile(file, 'utf8');
    const [portLine] = raw.trim().split(/\r?\n/);
    const port = Number(portLine);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { port: null, error: 'INVALID_DEVTOOLS_PORT' };
    }
    return { port, error: null };
  } catch (error) {
    return { port: null, error: error?.code || error?.message || 'DEVTOOLS_PORT_UNREADABLE' };
  }
}

async function waitForChromeCdp(chrome, chromeProfile, expectedPort, timeoutMs = 30000) {
  const startedAt = Date.now();
  const attempts = [];
  let lastPortError = null;
  let lastHttpError = null;

  while (Date.now() - startedAt < timeoutMs) {
    const elapsedMs = Date.now() - startedAt;
    if (chrome?.exitCode !== null || chrome?.signalCode) {
      return {
        ready: false,
        classification: 'CHROME_PROCESS_EARLY_EXIT',
        elapsedMs,
        attempts,
        exitCode: chrome?.exitCode ?? null,
        signalCode: chrome?.signalCode ?? null,
        lastPortError,
        lastHttpError
      };
    }

    const portState = await readDevToolsPort(chromeProfile);
    lastPortError = portState.error;
    if (portState.port && portState.port !== expectedPort) {
      return {
        ready: false,
        classification: 'CHROME_CDP_PORT_MISMATCH',
        elapsedMs,
        attempts,
        expectedPort,
        publishedPort: portState.port,
        lastPortError,
        lastHttpError
      };
    }
    // Chrome writes DevToolsActivePort only for an automatically selected
    // debugging port. For this verifier the port is an explicit, preflighted
    // contract, so probe that exact port when the profile file is absent.
    const candidatePort = portState.port || expectedPort;
    if (candidatePort) {
      try {
        const response = await fetch(`http://127.0.0.1:${candidatePort}/json/version`);
        if (response.ok) {
          return {
            ready: true,
            chromePort: candidatePort,
            elapsedMs,
            attempts,
            lastPortError,
            lastHttpError
          };
        }
        lastHttpError = `HTTP_${response.status}`;
      } catch (error) {
        lastHttpError = error?.message || 'CDP_HTTP_UNAVAILABLE';
      }
    }
    if (attempts.length < 24) {
      attempts.push({ elapsedMs, devToolsPort: portState.port, expectedPort, portError: portState.error, httpError: lastHttpError });
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return {
    ready: false,
    classification: lastPortError === 'ENOENT' ? 'CHROME_DEVTOOLS_PORT_NOT_PUBLISHED' : 'CHROME_CDP_UNAVAILABLE',
    elapsedMs: Date.now() - startedAt,
    attempts,
    exitCode: chrome?.exitCode ?? null,
    signalCode: chrome?.signalCode ?? null,
    lastPortError,
    lastHttpError
  };
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

async function verifyFixtureLogin(fixture) {
  if (!fixture) return;
  for (const user of [fixture.requester, fixture.requesterB, fixture.approver].filter(Boolean)) {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: user.password }) });
    const body = await response.json();
    if (!response.ok || !body?.data?.token) throw new Error(`Fixture JWT login failed for ${user.id}`);
  }
}

async function runBrowserLifecycle({ chromePath, cycle, runtimeEnv = process.env, fixture = null }) {
  let server;
  let chrome;
  let chromeProfile;
  let serverOutput;
  let chromeOutput;
  let verifiedChromePort = null;
  const evidence = { cycle, baseUrl, requestedChromePort: chromePort, startedAt: new Date().toISOString() };
  try {
    await assertPortUnused(appPort, '应用');
    await assertPortUnused(chromePort, 'Chrome CDP');

    server = spawn(nodeExecutable, ['server.js'], {
      cwd: root,
      env: {
        ...runtimeEnv,
        PORT: String(appPort),
        HOST: '127.0.0.1',
        APP_URL: baseUrl
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    serverOutput = recordOutput(server, 'server');
    server.on('exit', (code, signal) => console.warn(`[verify] server 退出：code=${code} signal=${signal || ''}`));

    // Health belongs to the process started above: a preflight port probe
    // prevents an older process on the selected port from satisfying this check.
    await waitFor(`${baseUrl}/api/health`, 30000);
    const health = await fetchJson(`${baseUrl}/api/health`);
    if (!health.ok) throw new Error('/api/health 未返回 ok');
    const selfTest = await fetchJson(`${baseUrl}/api/self-test`);
    if (!selfTest.ok) throw new Error('/api/self-test 未返回 ok');
    await verifyFixtureLogin(fixture);

    chromeProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'eaos-verify-chrome-'));
    chrome = spawn(chromePath, [
      // The existing clean-open and reliability browser runners both use
      // headless=new successfully. Keeping this verifier on the same browser
      // lifecycle avoids a foreground macOS target being detached while the
      // E2E child owns its page CDP session.
      '--headless=new',
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${chromeProfile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--disable-extensions',
      // CDP-created page targets are backgrounded by Chrome. The browser
      // otherwise throttles the bounded clipboard fallback timer and stalls
      // a real user action before its audit is evaluated.
      '--disable-background-timer-throttling',
      '--disable-breakpad',
      '--disable-crash-reporter',
      'about:blank'
    ], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    chromeOutput = recordOutput(chrome, 'chrome');
    chrome.on('exit', (code, signal) => console.warn(`[verify] chrome 退出：code=${code} signal=${signal || ''}`));
    const cdp = await waitForChromeCdp(chrome, chromeProfile, chromePort, 30000);
    evidence.cdpStartup = cdp;
    if (!cdp.ready) {
      throw new Error(`CDP_STARTUP_FAILED:${cdp.classification}`);
    }
    verifiedChromePort = cdp.chromePort;
    evidence.chromePort = verifiedChromePort;

    const e2eEnv = {
      env: {
        ...runtimeEnv,
        E2E_BASE_URL: baseUrl,
        E2E_CHROME_PORT: String(chromePort),
        E2E_CHROME_PID: String(chrome.pid || ''),
        E2E_MATERIAL_ISSUE_SCENARIO_A: materialIssueScenarioA ? '1' : '',
        E2E_MATERIAL_ISSUE_SCENARIO_B: materialIssueScenarioB ? '1' : '',
        E2E_MATERIAL_ISSUE_SCENARIO_C: materialIssueScenarioC ? '1' : '',
        E2E_MATERIAL_ISSUE_SCENARIO_D: materialIssueScenarioD ? '1' : '',
        E2E_MATERIAL_ISSUE_SCENARIO_E: materialIssueScenarioE ? '1' : '',
        E2E_RFQ_ONLY: rfqOnly ? '1' : '',
        E2E_OCR_ONLY: ocrOnly ? '1' : '',
        E2E_OCR_CDP_MINIMAL: ocrCdpMinimal ? '1' : '',
        ...(fixture ? {
          E2E_FIXTURE_REQUESTER_EMAIL: fixture.requester.email,
          E2E_FIXTURE_REQUESTER_PASSWORD: fixture.requester.password,
          E2E_FIXTURE_REQUESTER_B_EMAIL: fixture.requesterB?.email || '',
          E2E_FIXTURE_REQUESTER_B_PASSWORD: fixture.requesterB?.password || '',
          E2E_FIXTURE_APPROVER_EMAIL: fixture.approver.email,
          E2E_FIXTURE_APPROVER_PASSWORD: fixture.approver.password,
          E2E_FIXTURE_ENTERPRISE_ID: fixture.enterpriseId,
          E2E_FIXTURE_DB_PATH: fixture.dbPath,
          E2E_FIXTURE_RFQ_CUSTOMER_ID: fixture.customer?.id || ''
        } : {})
      }
    };
    // The no-side-effect probe verifies the exact CDP lifecycle used below:
    // open a dedicated target, evaluate, navigate, evaluate again, then close.
    // A failed probe stops before any business action can be repeated.
    runChecked(nodeExecutable, ['scripts/run-e2e.mjs', '--environment-only'], e2eEnv);
    if (!environmentOnly) {
      runChecked(nodeExecutable, ['scripts/run-e2e.mjs', ...(quotationOnly ? ['--quotation-only'] : []), ...(rfqOnly ? ['--rfq-only'] : []), ...(ocrOnly ? ['--ocr-only'] : []), ...(ocrCdpMinimal ? ['--ocr-cdp-minimal'] : []), ...(quotationCopyNativeControl ? ['--quotation-copy-native-control'] : []), ...(materialIssueScenarioA ? ['--material-issue-scenario-a'] : []), ...(materialIssueScenarioB ? ['--material-issue-scenario-b'] : []), ...(materialIssueScenarioC ? ['--material-issue-scenario-c'] : []), ...(materialIssueScenarioD ? ['--material-issue-scenario-d'] : []), ...(materialIssueScenarioE ? ['--material-issue-scenario-e'] : [])], e2eEnv);
    }
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
      chromePortReleased: verifiedChromePort ? await assertPortReleased(chromePort, 'Chrome CDP 清理后端口') : true,
      applicationPortReleased: await assertPortReleased(appPort, '应用清理后端口')
    };
    console.log(`[verify] BROWSER_ENVIRONMENT_CLEANUP ${JSON.stringify(evidence.cleanup)}`);
    if (chromeProfile) await fs.rm(chromeProfile, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  if (!browserOnly) {
    log('1/4', 'node --check');
    runChecked('npm', ['run', 'check']);

    log('2/4', 'npm run build');
    runChecked('npm', ['run', 'build']);

    log('3/4', 'npm run bug:scan');
    runChecked('npm', ['run', 'bug:scan', '--', '--check-only']);
  } else {
    // Browser acceptance is sometimes invoked after the required check/unit/
    // build gates have run separately.  It reuses this same lifecycle and
    // must not create a second browser runner merely to fit a bounded host.
    log('1-3/4', 'browser-only; quality gates run separately');
  }

  log('4/4', environmentOnly ? 'browser environment' : 'browser e2e');
  const chromePath = chromeCandidates.find(candidate => existsSync(candidate));
  if (!chromePath) {
    console.log('[verify] 未找到 Chrome 可执行文件，跳过浏览器 e2e。');
    return;
  }

  // Quotation click-path diagnosis must not reuse a persisted development
  // workspace.  It exercises the existing auth/state persistence on a fresh
  // SQLite fixture, exactly as the material-issue browser scenarios do.
  // Full E2E creates RFQ data, therefore it also runs on a disposable SQLite
  // fixture rather than the user's local business database.
  const fixture = !environmentOnly || fixtureMode || quotationOnly || rfqOnly || ocrOnly || ocrCdpMinimal || materialIssueScenarioA || materialIssueScenarioB || materialIssueScenarioC || materialIssueScenarioD || materialIssueScenarioE ? await createMaterialIssueFixture() : null;
  try {
    const runtimeEnv = fixture ? { ...process.env, DB_PATH: fixture.dbPath, UPLOADS_DIR: path.join(fixture.dir, 'uploads'), LOGS_DIR: path.join(fixture.dir, 'logs'), BACKUPS_DIR: path.join(fixture.dir, 'backups') } : process.env;
    // Fixture readiness is checked twice only for the environment probe.  A
    // Scenario mutates its isolated fixture, so it runs once per fixture.
    const cycles = environmentOnly ? 2 : 1;
    for (let cycle = 1; cycle <= cycles; cycle += 1) {
      const result = await runBrowserLifecycle({ chromePath, cycle, runtimeEnv, fixture });
      console.log(`[verify] Browser environment cycle ${cycle}/${cycles}: ${result.result}`);
    }
  } finally {
    await cleanupMaterialIssueFixture(fixture);
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
