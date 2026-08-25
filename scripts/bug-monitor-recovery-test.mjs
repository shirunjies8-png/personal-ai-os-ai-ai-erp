import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const coreSource = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace('App.init();', 'globalThis.__App = App;');
const context = vm.createContext({
  AIOfficeContracts: { ocr: { timeoutMs: 120000 } },
  ManufacturingWorkspace: { emptyState: () => ({}) },
  location: { hostname: 'shirunjies8-png.github.io' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { addEventListener: () => {}, dispatchEvent: () => {}, getElementById: () => null },
  CustomEvent: class CustomEvent { constructor(type, detail = {}) { this.type = type; this.detail = detail; } },
  console,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  structuredClone,
  globalThis: null
});
context.globalThis = context;
context.window = context;
vm.runInContext(`${coreSource}\nglobalThis.__Stability = Stability; globalThis.__SafeRecovery = SafeRecovery;`, context, { filename: 'core.js' });
vm.runInContext(appSource, context, { filename: 'app.js' });
const { __Stability: Stability, __SafeRecovery: SafeRecovery, __App: App } = context;

const normalize = payload => Stability.normalizeError({ lifecycle: 'active', source: 'fixture', ...payload });
const model = payload => Stability.bugAlertSemanticsModel(normalize(payload), { isGitHubPages: true });
const safeContract = (overrides = {}) => ({
  actionType: 'REINITIALIZE_KNOWN_LOCAL_UI_STATE',
  target: 'ERROR_CENTER_VIEW',
  known: true,
  deterministic: true,
  lowRisk: true,
  reversibleOrSafe: true,
  noUnknownOutcome: true,
  noHighRiskAuthority: true,
  noSecurityBoundaryChange: true,
  ...overrides
});

// 1-5: global presentation is reserved for real blockers and high severity.
assert.equal(model({ eventKind: 'EXPECTED_DEGRADED' }).isGlobalBlocking, false);
assert.equal(model({ eventKind: 'SYNTHETIC_TEST' }).isGlobalBlocking, false);
assert.equal(model({ lifecycle: 'resolved' }).isGlobalBlocking, false);
const lowRiskModel = model({ severity: 'low' });
assert.equal(lowRiskModel.classification, 'CURRENT_BUG');
assert.equal(lowRiskModel.isCurrentPending, true);
assert.equal(lowRiskModel.impactsHealth, true);
assert.equal(lowRiskModel.isGlobalBlocking, false);
assert.equal(lowRiskModel.errorCenterView, 'current');
assert.equal(model({ severity: 'blocking' }).isGlobalBlocking, true);

// 6: the same unresolved signature updates one record and keeps occurrence evidence.
context.Store.state = { bugAlerts: [], errorLog: [], aiErrors: [], repairRecords: [], taskRecords: [], systemHealth: {} };
App.route = 'home';
App.renderBugMonitor = () => {};
App.rerender = () => {};
App.updateStabilityHealthSnapshot = () => {};
const first = App.reportBug({ module: 'fixture', feature: 'dedup', type: 'RuntimeError', message: 'same root cause', signature: 'fixture-dedup' });
const second = App.reportBug({ module: 'fixture', feature: 'dedup', type: 'RuntimeError', message: 'same root cause', signature: 'fixture-dedup', lastEvidence: 'second observation' });
assert.equal(context.Store.state.bugAlerts.length, 1);
assert.equal(first.id, second.id);
assert.equal(second.occurrenceCount, 2);
assert.equal(second.lastEvidence, 'second observation');
assert.ok(second.firstSeenAt <= second.lastSeenAt);

const createRecoverable = (overrides = {}) => normalize({
  id: `failure-${Math.random()}`,
  signature: `failure-signature-${Math.random()}`,
  module: 'UI', feature: 'Error Center view', type: 'KnownLocalStateError',
  message: 'Known local UI state is invalid.',
  severity: 'low',
  recoveryContract: safeContract(),
  ...overrides
});

// 7: a known safe action really runs.
let actionRuns = 0;
const recovered = createRecoverable();
const recoveredResult = await SafeRecovery.run(recovered, {
  action: () => { actionRuns += 1; return { reset: true }; },
  readback: () => ({ view: 'current' }),
  validate: state => ({ valid: state.view === 'current' }),
  revalidate: state => ({ valid: state.view === 'current' })
});
assert.equal(actionRuns, 1);
assert.equal(recoveredResult.ok, true);

// 8: an action return value is not proof when actual readback fails.
const readbackFailure = createRecoverable();
const readbackFailureResult = await SafeRecovery.run(readbackFailure, {
  action: () => true,
  readback: () => null,
  validate: () => true,
  revalidate: () => true
});
assert.equal(readbackFailureResult.ok, false);
assert.notEqual(readbackFailure.eventKind, 'AUTO_RESOLVED_VERIFIED');
assert.equal(readbackFailure.recoveryAttempts.at(-1).readbackResult, 'FAILED');

// 9: readback without validator acceptance cannot resolve.
const validationFailure = createRecoverable();
const validationFailureResult = await SafeRecovery.run(validationFailure, {
  action: () => true,
  readback: () => ({ view: 'current' }),
  validate: () => ({ valid: false, reason: 'fixture mismatch' }),
  revalidate: () => true
});
assert.equal(validationFailureResult.ok, false);
assert.notEqual(validationFailure.eventKind, 'AUTO_RESOLVED_VERIFIED');

// 10-11: all gates pass, and the original failure plus attempt evidence remains.
assert.equal(recovered.eventKind, 'AUTO_RESOLVED_VERIFIED');
assert.equal(recovered.recoveryState, 'AUTO_RESOLVED_VERIFIED');
assert.equal(recovered.verificationResult, 'PASS');
assert.equal(recovered.recoveryAttempts.length, 1);
assert.equal(recovered.originalFailureEvidence.message, 'Known local UI state is invalid.');
assert.equal(recovered.originalFailureSignature, recovered.signature);

// 12: UNKNOWN never enters automatic recovery or automatic closure.
const unknown = createRecoverable({ eventKind: 'UNKNOWN' });
const unknownResult = await SafeRecovery.run(unknown, { action: () => { throw new Error('must not run'); } });
assert.equal(unknownResult.ok, false);
assert.equal(unknownResult.attempt.actionResult, 'NOT_RUN');
assert.equal(unknown.eventKind, 'UNKNOWN');
assert.match(unknown.nextAction, /Situation Check/);

// 13: an unknown write outcome never grants retry/recovery permission.
const unknownOutcome = createRecoverable({ unknownOutcome: true });
assert.equal(SafeRecovery.eligibility(unknownOutcome).eligible, false);

// 14: high-risk side effects are denied even if a producer claims they are safe.
const highRisk = createRecoverable({ recoveryContract: safeContract({ actionType: 'INVENTORY_WRITE' }) });
assert.equal(SafeRecovery.eligibility(highRisk).eligible, false);

// 15: security-related denial cannot be bypassed by a recovery contract.
const security = createRecoverable({ impactsSecurity: true });
assert.equal(SafeRecovery.eligibility(security).eligible, false);

// 16: explicit product-side high-risk families stay outside the recovery allowlist.
for (const actionType of ['QUOTATION_SEND', 'APPROVAL_OVERRIDE', 'SECRET_ROTATION', 'MES_WRITE']) {
  assert.equal(SafeRecovery.eligibility(createRecoverable({ recoveryContract: safeContract({ actionType }) })).eligible, false, actionType);
}

console.log('bug-monitor-recovery-test: PASS (16 governed cases; action/readback/validation/revalidation evidence preserved)');
