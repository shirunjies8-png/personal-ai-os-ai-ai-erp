import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const configSource = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');

function makeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}

function loadConfig({ hostname, protocol = 'https:', runtimeApiBase = '', storedApiBase = '' }) {
  const localStorage = makeStorage(storedApiBase ? { personal_ai_os_api_base_url: storedApiBase } : {});
  const context = { window: { location: { hostname, origin: `https://${hostname}`, protocol }, localStorage, PERSONAL_AI_OS_API_BASE_URL: runtimeApiBase } };
  vm.runInNewContext(configSource, context, { filename: 'config.js' });
  return context.window.PERSONAL_AI_OS_CONFIG;
}

const pages = loadConfig({ hostname: 'shirunjies8-png.github.io', storedApiBase: 'https://stale-gateway.example' });
assert.equal(pages.STATIC_DEMO_ONLY, true, 'Pages defaults to static demo mode');
assert.equal(pages.API_BASE_URL, '', 'stored API URL must not turn static Pages into an implicit backend probe');
assert.equal(pages.DEMO_LOGIN_ONLY, true, 'Pages static mode must enter the explicit demo contract');
const pagesExplicit = loadConfig({ hostname: 'shirunjies8-png.github.io', runtimeApiBase: 'https://gateway.example' });
assert.equal(pagesExplicit.STATIC_DEMO_ONLY, false, 'an explicit runtime gateway is opt-in, not a default');
assert.equal(pagesExplicit.API_BASE_URL, 'https://gateway.example');
const local = loadConfig({ hostname: '127.0.0.1' });
assert.equal(local.API_BASE_URL, 'https://127.0.0.1', 'local path remains independent from Pages static routing');

const start = coreSource.indexOf('const StartupReliability =');
const end = coreSource.indexOf('\n\nconst APIClient =', start);
assert.ok(start >= 0 && end > start, 'StartupReliability must be a separate, testable contract');
const startupSource = coreSource.slice(start, end).replace('const StartupReliability =', 'globalThis.StartupReliability =');
const context = vm.createContext({ RuntimeConfig: {}, Utils: { isGitHubPagesHost: () => false }, globalThis: null });
context.globalThis = context;
vm.runInContext(startupSource, context, { filename: 'core.js' });
const StartupReliability = context.StartupReliability;
const staleSessionDecision = StartupReliability.reconcileSession({ token: 'expired-token', demo: false }, { staticDemo: true });
assert.equal(staleSessionDecision.action, 'CLEAR_STALE_REMOTE_SESSION', 'old Pages stale-session path must be rejected');
assert.equal(staleSessionDecision.reason, 'static_demo_environment');
const validSessionDecision = StartupReliability.reconcileSession({ token: 'valid-token', demo: false }, { staticDemo: false });
assert.equal(validSessionDecision.action, 'KEEP_SESSION', 'a valid non-static session remains authenticated');
assert.equal(validSessionDecision.reason, 'session_present');
const missingSessionDecision = StartupReliability.reconcileSession({}, { staticDemo: false });
assert.equal(missingSessionDecision.action, 'KEEP_SESSION', 'a missing session is not promoted to authenticated state');
assert.equal(missingSessionDecision.reason, 'session_missing');
assert.equal(StartupReliability.reconcileSession({ token: 'demo', demo: true }, { staticDemo: true }).action, 'KEEP_SESSION');
assert.equal(StartupReliability.isExpectedSessionExpiry(new Error('登录已失效')), true, 'expired-session path is expected and handled locally');
assert.equal(StartupReliability.isExpectedSessionExpiry(new Error('后端请求超时（10000ms）')), false, 'unknown timeout must remain fail-closed');
assert.equal(StartupReliability.isExpectedSessionExpiry(new Error('未知运行异常')), false, 'unknown runtime errors must not be swallowed');

const legacyAlert = { id: 'legacy-login-expiry', signature: StartupReliability.legacyLoginExpirySignature, source: 'system-error', lifecycle: 'active', time: 100, lastAt: 100, count: 25 };
const legacyMigration = StartupReliability.resolveKnownLegacyStartupAlerts([legacyAlert], { staticDemo: true, now: 200 });
assert.equal(legacyMigration.resolved, 1, 'the exact pre-release Pages startup signature becomes historical only after the static-demo fix');
assert.equal(legacyMigration.alerts[0].lifecycle, 'resolved', 'legacy evidence is preserved as resolved history');
assert.equal(legacyMigration.alerts[0].count, 25, 'legacy migration must not erase error history');
assert.equal(legacyMigration.alerts[0].legacyStartupRelease, 'PUBLIC_DEMO_CLEAN_OPEN_V1');
const recurrence = StartupReliability.resolveKnownLegacyStartupAlerts([{ ...legacyMigration.alerts[0], lifecycle: 'active', confirmed: false, lastAt: 201 }], { staticDemo: true, now: 202 });
assert.equal(recurrence.resolved, 0, 'a post-release recurrence must remain actionable rather than being permanently suppressed');
assert.equal(recurrence.alerts[0].lifecycle, 'active');
assert.equal(StartupReliability.resolveKnownLegacyStartupAlerts([legacyAlert], { staticDemo: false }).resolved, 0, 'non-Pages environments do not mutate historical alerts');

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(appSource, /refreshStartupAuthenticatedState\(\)/, 'startup work must be guarded by the session boundary');
assert.match(appSource, /if \(!StartupReliability\.isExpectedSessionExpiry\(error\)\) throw error/, 'non-auth startup failures must remain actionable');
assert.match(appSource, /AuthClient\.clear\(\);\n\s*Store\.syncStatus = \{ mode: 'local', state: 'expired'/, 'expired authentication must be cleared before rendering the normal login state');
assert.match(appSource, /resolveKnownLegacyStartupAlerts\(Store\.state\.bugAlerts/, 'only the startup path may migrate the exact legacy Pages alert');
console.log('clean-open-contract-test: PASS (static Pages, stale session, expected expiry, fail-closed unknown)');
