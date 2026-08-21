import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const coreSource = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = coreSource.indexOf('const StartupReliability =');
const end = coreSource.indexOf('\n\nconst APIClient =', start);
assert.ok(start >= 0 && end > start, 'StartupReliability must remain independently testable');
const startupSource = coreSource.slice(start, end).replace('const StartupReliability =', 'globalThis.StartupReliability =');
const context = vm.createContext({ RuntimeConfig: {}, Utils: { isGitHubPagesHost: () => true }, globalThis: null });
context.globalThis = context;
vm.runInContext(startupSource, context, { filename: 'core.js' });
const { StartupReliability } = context;

const expectedCutoff = Date.parse('2026-08-21T05:55:50Z');
assert.equal(StartupReliability.legacyPagesTimeoutEligibleBefore, expectedCutoff, 'cutoff must equal the immutable Clean Open commit time');
const oldTimestamp = Date.UTC(2026, 7, 15, 8, 9, 0);
const oldTimeout = {
  id: 'legacy-pages-timeout',
  signature: StartupReliability.legacyPagesTimeoutSignature,
  source: 'system-error',
  lifecycle: 'active',
  firstAt: oldTimestamp,
  time: oldTimestamp,
  lastAt: oldTimestamp,
  count: 1
};

const migrated = StartupReliability.resolveKnownLegacyStartupAlerts([oldTimeout], { staticDemo: true, now: Date.UTC(2026, 7, 21, 14, 0, 0) });
assert.equal(migrated.resolved, 1, 'CASE 1: exact pre-release Pages timeout must move to resolved history');
assert.equal(migrated.alerts[0].lifecycle, 'resolved');
assert.equal(migrated.alerts[0].count, 1, 'CASE 1: history count must be preserved');
assert.equal(migrated.alerts[0].lastAt, oldTimestamp, 'CASE 1: original last occurrence must be preserved');
assert.match(migrated.alerts[0].resolutionReason, /隐式后端探测/);

const migrationAt = lastAt => StartupReliability.resolveKnownLegacyStartupAlerts([{
  ...oldTimeout,
  time: lastAt,
  firstAt: lastAt,
  lastAt
}], { staticDemo: true, now: expectedCutoff + 60_000 });
assert.equal(migrationAt(expectedCutoff - 1).resolved, 1, 'CASE B: one millisecond before cutoff remains eligible');
assert.equal(migrationAt(expectedCutoff).resolved, 0, 'CASE C: exactly at cutoff must remain active');
assert.equal(migrationAt(expectedCutoff + 1).resolved, 0, 'CASE D: one millisecond after cutoff must remain active');
assert.equal(migrationAt(expectedCutoff + 60_000).resolved, 0, 'CASE E: one minute after cutoff must remain active');

const newOccurrence = StartupReliability.resolveKnownLegacyStartupAlerts([{
  ...migrated.alerts[0],
  lifecycle: 'active',
  confirmed: false,
  fixed: false,
  lastAt: migrated.alerts[0].legacyStartupResolvedAt + 1,
  count: 2
}], { staticDemo: true, now: migrated.alerts[0].legacyStartupResolvedAt + 2 });
assert.equal(newOccurrence.resolved, 0, 'CASE 2: a later same-signature recurrence must stay current');
assert.equal(newOccurrence.alerts[0].lifecycle, 'active');
assert.equal(newOccurrence.alerts[0].count, 2);

const unknownTimeout = StartupReliability.resolveKnownLegacyStartupAlerts([{
  ...oldTimeout,
  id: 'unknown-timeout',
  signature: 'global|window.onunhandledrejection|系统错误|后端请求超时（15000ms），已保留本地演示数据。'
}], { staticDemo: true, now: oldTimestamp + 1 });
assert.equal(unknownTimeout.resolved, 0, 'CASE 3: unknown timeout must fail closed');
assert.equal(unknownTimeout.alerts[0].lifecycle, 'active');

const differentNetworkFailure = StartupReliability.resolveKnownLegacyStartupAlerts([{
  ...oldTimeout,
  id: 'different-network-failure',
  signature: 'global|window.onunhandledrejection|系统错误|HTTPS 后端未连接，已保留本地演示功能。'
}], { staticDemo: true, now: oldTimestamp + 1 });
assert.equal(differentNetworkFailure.resolved, 0, 'CASE 4: a different network failure must stay current');
assert.equal(differentNetworkFailure.alerts[0].lifecycle, 'active');

assert.equal(StartupReliability.resolveKnownLegacyStartupAlerts([oldTimeout], { staticDemo: false }).resolved, 0, 'migration is Pages-static-only');
assert.match(appSource, /existing\.count = Math\.max\(1, Number\(existing\.count \|\| 1\)\) \+ 1/, 'new reports must preserve recurrence count');
assert.match(appSource, /existing\.lastAt = record\.time/, 'new reports must refresh the recurrence timestamp');
assert.match(appSource, /existing\.lifecycle = 'active'/, 'new reports must reactivate a resolved record instead of suppressing it');
console.log('legacy-timeout-lifecycle-test: PASS (eligible history, recurrence, unknown timeout, network failure, static Pages boundary)');
