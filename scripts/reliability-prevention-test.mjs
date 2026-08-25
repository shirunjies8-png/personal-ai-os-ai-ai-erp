import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const coreSource = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const storage = new Map();
const context = vm.createContext({
  AIOfficeContracts: { ocr: { timeoutMs: 120000 } },
  ManufacturingWorkspace: { emptyState: () => ({}) },
  RuntimeConfig: { API_BASE_URL: '', STATIC_DEMO_ONLY: false, REQUEST_TIMEOUT_MS: 1000 },
  location: { hostname: '127.0.0.1', protocol: 'http:', origin: 'http://127.0.0.1:3210' },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  sessionStorage: { removeItem: () => {} },
  document: { dispatchEvent: () => {}, addEventListener: () => {} },
  CustomEvent: class { constructor(type) { this.type = type; } },
  fetch: async () => ({ ok: true, headers: { get: () => 'application/json' }, text: async () => '{"ok":true}' }),
  console, setTimeout, clearTimeout, structuredClone, globalThis: null
});
context.globalThis = context;
context.window = context;
vm.runInContext(`${coreSource}\nglobalThis.__reliability = { Stability, Store, APIClient };`, context, { filename: 'core.js' });
const { Stability, Store, APIClient } = context.__reliability;
Store.state = { taskRecords: [], settings: {}, aiGatewayStatus: null, systemHealth: {}, errorLog: [], runtime: null, aiResult: null };
vm.runInContext(`${appSource.replace('App.init();', 'globalThis.__reliabilityApp = App;')}`, context, { filename: 'app.js' });
const App = context.__reliabilityApp;

// A–G: readiness, no network probe, taxonomy/schema and retry safety.
assert.equal(Stability.resolveReadiness({ checks: [{ name: 'api', state: 'READY' }], highRisk: true }).state, 'READY');
assert.equal(Stability.resolveReadiness({ checks: [{ name: 'api', state: 'UNKNOWN' }], highRisk: true }).state, 'BLOCKED');
assert.equal(Stability.resolveReadiness({ checks: [{ name: 'fallback', state: 'DEGRADED' }], hasSafeFallback: true }).state, 'DEGRADED');
assert.equal(Stability.classifyApiFailure({ name: 'AbortError', message: 'timeout' }), 'READ_TIMEOUT');
assert.equal(Stability.classifyApiFailure({ httpStatus: 401, message: 'unauthorized' }), 'AUTH_REQUIRED');
assert.equal(Stability.classifyApiFailure({ httpStatus: 500, message: 'server error' }), 'DEPENDENCY_UNAVAILABLE');
assert.equal(Stability.canRetryApiFailure('READ_TIMEOUT', { safeRead: true, attempt: 0 }), true);
assert.equal(Stability.canRetryApiFailure('UNKNOWN_OUTCOME', { safeRead: true, attempt: 0 }), false);
assert.equal(APIClient.matchesSchema({ data: {} }, { data: 'object' }), true);
assert.equal(APIClient.matchesSchema({ data: 'wrong' }, { data: 'object' }), false);

// H–N: locally isolated persistence/readback, checkpoints, recovery and history.
const first = Stability.normalizeTask({ id: 'reliability-task', type: '安全本地任务', status: 'pending', lifecycleState: 'READY', currentStep: 'STEP_4', lastVerifiedStep: 'STEP_3', draftData: { quantity: 125 }, approvedData: { quantity: 128 }, inputVersion: 2, checkpoints: [{ stepId: 'STEP_3', verificationStatus: 'VERIFIED' }] });
const persisted = Store.persistTaskWithReadback(first).task;
assert.equal(persisted.persistence.state, 'VERIFIED');
assert.equal(JSON.parse(storage.get('personal-ai-os-v1')).taskRecords[0].draftData.quantity, 125, 'draft survives refresh serialization');
assert.equal(JSON.parse(storage.get('personal-ai-os-v1')).taskRecords[0].approvedData.quantity, 128, 'approved data is not overwritten by draft');
assert.equal(Stability.safeResumeDecision({ ...persisted, lifecycleState: 'SUSPENDED', lastVerifiedStep: 'STEP_3' }), 'SAFE_TO_RESUME');
assert.equal(Stability.safeResumeDecision({ ...persisted, lifecycleState: 'UNKNOWN', pendingOperation: { outcome: 'UNKNOWN_OUTCOME' } }), 'REQUIRES_RECONCILIATION');
assert.equal(Stability.safeResumeDecision({ ...persisted, lifecycleState: 'COMPLETED' }), 'COMPLETED_ALREADY');
const failure = Stability.normalizeTask({ ...persisted, lifecycleState: 'SUSPENDED', status: 'failed', failureHistory: [{ at: 1, type: 'READ_TIMEOUT' }] });
assert.equal(failure.failureHistory.length, 1, 'failure history remains append-only input for later recovery');
assert.equal(failure.lastVerifiedStep, 'STEP_3', 'failed step does not erase last verified checkpoint');

// Execute the real generic envelope with a safe local function: it verifies the
// save-before-execute path without issuing an API request or business write.
App.getVisibleBugAlerts = () => [];
App.getBugMonitorModel = () => ({ currentPendingAlerts: [] });
const runResult = await App.runWithStability('task', { type: '本地可靠性验证', module: 'task', needsPersistence: true }, async () => 'verified-local-result');
assert.equal(runResult, 'verified-local-result');
const completed = Store.state.taskRecords.find(item => item.type === '本地可靠性验证');
assert.equal(completed.lifecycleState, 'COMPLETED');
assert.equal(completed.lastVerifiedStep, 'COMPLETED');
assert.equal(completed.persistence.state, 'VERIFIED');

assert.match(appSource, /UNKNOWN_OUTCOME/);
assert.match(appSource, /REQUIRES_RECONCILIATION/);
assert.match(appSource, /persistTaskWithReadback/);
console.log('reliability-prevention-test: PASS (readiness, failure taxonomy, schema fail-closed, persistence readback, checkpoint, safe resume, failure preservation)');
