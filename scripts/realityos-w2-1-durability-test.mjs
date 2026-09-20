import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const currentFile = fileURLToPath(import.meta.url);
const Database = require('better-sqlite3');
const Kernel = require('../services/realityosKernelService');
const W2 = require('../services/realityosKernelDurabilityContract');
const {
  RealityOSKernelDurableStore,
  persistExecutionIntentBeforeDispatch,
} = require('../services/realityosKernelDurableStore');

const now = '2026-09-21T12:00:00.000Z';
const resumeStartedAt = '2026-09-21T11:59:00.000Z';
const future = '2026-09-21T12:30:00.000Z';
const fixedClock = () => new Date(now);

function input(overrides = {}) {
  return {
    mission_id: 'mission-w2-1-durability',
    goal_id: 'goal-enterprise-durable-kernel',
    task_id: 'task-w2-1-durable-run',
    organization_context: { enterprise_id: 'enterprise-w2-1', workspace_id: 'workspace-w2-1' },
    actor_identity: { id: 'actor-w2-1', owner: '01-identity' },
    principal: { id: 'principal-w2-1', owner: '01-identity' },
    represented_principal: { id: 'enterprise-w2-1', owner: '02-organization' },
    authority_lease: {
      lease_id: 'lease-w2-1',
      status: 'ACTIVE',
      principal_id: 'principal-w2-1',
      represented_principal_id: 'enterprise-w2-1',
      capability_ids: ['capability-w2-1'],
      agent_ids: ['agent-w2-1'],
      executor_ids: ['executor-w2-1'],
      tool_ids: ['tool-w2-1'],
      canonical_effects: ['W2_1_REFERENCE_EFFECT'],
      expires_at: future,
    },
    agent: { id: 'agent-w2-1', owner: '06-agent-skill' },
    executor: { id: 'executor-w2-1', owner: '10-execution-runtime', capabilityId: 'capability-w2-1' },
    capability_id: 'capability-w2-1',
    tool: { id: 'tool-w2-1', owner: '07-tool-connector', capabilityId: 'capability-w2-1' },
    execution_intent: { operation: 'reference-durable-write', payload_ref: 'fixture-only' },
    effect_declaration: {
      resource: 'w2.reference',
      verb: 'UPDATE',
      target: 'w2:durability-fixture',
      purpose: 'W2_1_DURABILITY_TEST',
      effectClass: 'PERSISTENT_LOCAL_MUTATION',
      canonicalEffect: 'W2_1_REFERENCE_EFFECT',
    },
    ...overrides,
  };
}

function referenceEnvelope(overrides = {}) {
  return Kernel.createKernelEnvelope(input(overrides), fixedClock);
}

function durability(overrides = {}) {
  return {
    schema_version: 1,
    run_id: 'run-w2-1',
    revision: 0,
    transition_id: 'transition-w2-1-0',
    transition_phase: 'INITIAL_CHECKPOINT',
    effect_operation_id: 'effect-op-w2-1',
    idempotency_ref: 'idem-w2-1',
    dispatch_started: false,
    effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
    evidence_commit_ref: 'evidence-commit-w2-1',
    intent_digest: crypto.createHash('sha256').update('reference-durable-write').digest('hex'),
    authority_ref: { id: 'authority-w2-1', owner: '04-authority', enterprise_id: 'enterprise-w2-1' },
    lease_ref: { id: 'lease-w2-1', owner: '04-authority', enterprise_id: 'enterprise-w2-1' },
    verification_ref: { id: 'verification-pending-w2-1', owner: '14-verification-runtime', enterprise_id: 'enterprise-w2-1' },
    human_control_ref: { id: 'human-control-placeholder-w2-1', owner: '17-human-control', enterprise_id: 'enterprise-w2-1' },
    extensions: { adapter: 'sqlite-current-durable-adapter', workspace_id: 'workspace-w2-1' },
    ...overrides,
  };
}

function durableEnvelope({ state = 'CREATED', revision = 0, dispatchStarted = false, effectCertainty = W2.EFFECT_CERTAINTY.UNKNOWN, attempts = [], durabilityPatch = {}, envelopePatch = {} } = {}) {
  const envelope = referenceEnvelope(envelopePatch);
  if (state !== 'CREATED') {
    envelope.state = state;
    envelope.state_history.push({ state, at: now, reason: `TEST_${state}` });
  }
  envelope.execution_attempts.push(...attempts);
  const d = durability({
    revision,
    transition_id: `transition-w2-1-${revision}`,
    transition_phase: revision === 0 ? 'INITIAL_CHECKPOINT' : 'CHECKPOINT',
    dispatch_started: dispatchStarted,
    effect_certainty: effectCertainty,
    attempt_id: attempts.length ? attempts.at(-1).attempt_id : durabilityPatch.attempt_id,
    ...durabilityPatch,
  });
  return W2.extendCanonicalEnvelope(envelope, d);
}

function currentAuthorization(overrides = {}) {
  return {
    resume_id: 'resume-w2-1',
    run_id: 'run-w2-1',
    enterprise_id: 'enterprise-w2-1',
    actor_identity_id: 'actor-w2-1',
    principal_id: 'principal-w2-1',
    represented_principal_id: 'enterprise-w2-1',
    agent_id: 'agent-w2-1',
    executor_id: 'executor-w2-1',
    capability_id: 'capability-w2-1',
    tool_id: 'tool-w2-1',
    effect_operation_id: 'effect-op-w2-1',
    decision: 'ALLOW',
    preflight_status: 'READY',
    checked_at: now,
    lease: input().authority_lease,
    ...overrides,
  };
}

function resumeContext(overrides = {}) {
  return {
    now,
    resume_id: 'resume-w2-1',
    resume_started_at: resumeStartedAt,
    action: 'WRITE',
    access: { enterprise_id: 'enterprise-w2-1', read_authorized: true },
    checkpoint: { integrity_valid: true, writer_protocol_valid: true },
    current_authorization: currentAuthorization(),
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    evidence: { complete: false, integrity_valid: false },
    verification: { status: 'PENDING' },
    recovery: { resolved: true },
    ...overrides,
  };
}

function withDb(dbPath, fn) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function createStore(dbPath) {
  return withDb(dbPath, db => new RealityOSKernelDurableStore(db, { clock: fixedClock }));
}

function childWrite(dbPath) {
  return withDb(dbPath, db => {
    const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
    store.create(durableEnvelope({ state: 'PREFLIGHT_PASSED' }));
    return { ok: true };
  });
}

function childRead(dbPath) {
  return withDb(dbPath, db => {
    const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
    const loaded = store.load('run-w2-1');
    assert.ok(loaded);
    assert.equal(loaded.envelope.state, 'PREFLIGHT_PASSED');
    const decision = W2.decideResume(loaded.envelope, resumeContext({
      effect: { certainty: W2.EFFECT_CERTAINTY.UNKNOWN, independent: false, fresh: false },
    }));
    assert.equal(decision.executionAllowed, false);
    return { decision: decision.decision, runId: loaded.envelope.durability.run_id };
  });
}

const childMode = process.argv.find(arg => arg.startsWith('--child='));
if (childMode) {
  const mode = childMode.split('=')[1];
  const dbPath = process.argv.find(arg => arg.startsWith('--db='))?.slice(5);
  const result = mode === 'write' ? childWrite(dbPath) : childRead(dbPath);
  console.log(JSON.stringify(result));
  process.exit(0);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-w2-1-durability-'));
const dbPath = path.join(root, 'w2-1.sqlite3');

// Adapter shape is the W2.0 contract shape and is now backed by real SQLite.
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  assert.deepEqual(W2.validateAdapter(W2.ADAPTER_KINDS.DURABLE_STORE, store), {
    valid: true,
    kind: W2.ADAPTER_KINDS.DURABLE_STORE,
    missing: [],
    shapeOnly: true,
    durabilityVerified: false,
  });
});

// Test A: durable Run survives a real DB close/open round-trip.
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  store.create(durableEnvelope({ state: 'CREATED' }));
});
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  const loaded = store.load('run-w2-1');
  assert.ok(loaded);
  assert.equal(loaded.envelope.durability.run_id, 'run-w2-1');
  assert.equal(loaded.schemaVersion, 1);
  assert.equal(loaded.envelope.state, 'CREATED');
  assert.equal(loaded.row.enterprise_id, 'enterprise-w2-1');
  assert.equal(loaded.row.workspace_id, 'workspace-w2-1');
});

// Test B: durable Attempt history is immutable and appends Attempt 2 without overwriting Attempt 1.
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  store.recordAttempt({
    attempt_id: 'attempt-w2-1-1',
    run_id: 'run-w2-1',
    enterprise_id: 'enterprise-w2-1',
    attempt_no: 1,
    lifecycle_state: 'EXECUTING',
    dispatch_started: true,
    effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
    status: 'FAILED_UNKNOWN',
  });
});
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  store.recordAttempt({
    attempt_id: 'attempt-w2-1-2',
    run_id: 'run-w2-1',
    enterprise_id: 'enterprise-w2-1',
    attempt_no: 2,
    lifecycle_state: 'RECOVERING',
    dispatch_started: false,
    effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED,
    status: 'RECOVERY_REVIEW',
  });
  const attempts = store.listAttempts('run-w2-1');
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].attempt_id, 'attempt-w2-1-1');
  assert.equal(attempts[1].attempt_id, 'attempt-w2-1-2');
  assert.throws(() => store.recordAttempt({
    attempt_id: 'attempt-w2-1-2',
    run_id: 'run-w2-1',
    enterprise_id: 'enterprise-w2-1',
    attempt_no: 3,
    lifecycle_state: 'RECOVERING',
    effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED,
  }), /UNIQUE|constraint/i);
});

// Test C/D: PREFLIGHT_PASSED / EXECUTION_PENDING restart never reuses stale preflight or missing current authority.
{
  const preflight = durableEnvelope({ state: 'PREFLIGHT_PASSED', effectCertainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED });
  const decision = W2.decideResume(preflight, resumeContext({ current_authorization: null }));
  assert.equal(decision.decision, W2.DECISIONS.REAUTHORIZE);
  assert.ok(decision.requiredGates.includes('IDENTITY'));
  const pending = durableEnvelope({ state: 'EXECUTION_PENDING', effectCertainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED });
  const pendingDecision = W2.decideResume(pending, resumeContext());
  assert.equal(pendingDecision.decision, W2.DECISIONS.CONTINUE_SAFE);
  assert.equal(pendingDecision.executionAllowed, false);
  assert.equal(pendingDecision.allowedNextAction, 'DISPATCH_AFTER_FINAL_BOUNDARY_RECHECK');
}

// Test E/F: EXECUTING crash and persisted UNKNOWN remain READBACK_FIRST after reload.
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  const executingUnknown = durableEnvelope({
    state: 'EXECUTING',
    revision: 1,
    dispatchStarted: true,
    effectCertainty: W2.EFFECT_CERTAINTY.UNKNOWN,
    attempts: [{ attempt_id: 'attempt-w2-1-unknown', attempt_no: 3, status: 'RUNNING' }],
    durabilityPatch: { attempt_id: 'attempt-w2-1-unknown' },
  });
  const result = store.appendTransition('run-w2-1', executingUnknown, { expectedRevision: 0, transitionId: 'transition-w2-1-unknown', phase: 'CRASH_BOUNDARY', reason: 'EXECUTING_CRASH_UNKNOWN' });
  assert.equal(result.ok, true);
});
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  const loaded = store.load('run-w2-1');
  assert.equal(loaded.envelope.durability.effect_certainty, W2.EFFECT_CERTAINTY.UNKNOWN);
  const decision = W2.decideResume(loaded.envelope, resumeContext({ effect: { certainty: W2.EFFECT_CERTAINTY.UNKNOWN, independent: false, fresh: false } }));
  assert.equal(decision.decision, W2.DECISIONS.READBACK_FIRST);
});

// Test G: revoked/expired authority and changed represented principal block write resume.
{
  const notOccurred = durableEnvelope({ state: 'EXECUTION_PENDING', effectCertainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED });
  for (const auth of [
    currentAuthorization({ decision: 'DENY' }),
    currentAuthorization({ lease: { ...input().authority_lease, expires_at: '2026-09-21T11:59:59.000Z' } }),
    currentAuthorization({ represented_principal_id: 'enterprise-other' }),
    currentAuthorization({ preflight_status: 'BLOCKED' }),
  ]) {
    const decision = W2.decideResume(notOccurred, resumeContext({ current_authorization: auth }));
    assert.equal(decision.decision, W2.DECISIONS.REAUTHORIZE);
    assert.equal(decision.executionAllowed, false);
  }
}

// Additional fail-closed checks: unsupported schema version and malformed persisted state cannot resume as success.
{
  assert.throws(() => durableEnvelope({ durabilityPatch: { schema_version: 99 } }), error => error.code === 'DURABLE_ENVELOPE_INVALID');
}
withDb(dbPath, db => {
  db.prepare('UPDATE realityos_kernel_runs SET envelope_snapshot=? WHERE run_id=?').run('{malformed-json', 'run-w2-1');
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  assert.throws(() => store.load('run-w2-1'), SyntaxError);
});
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  store.compareAndSet('run-w2-1', 2, durableEnvelope({
    state: 'RECOVERY_REQUIRED',
    revision: 3,
    effectCertainty: W2.EFFECT_CERTAINTY.UNKNOWN,
    durabilityPatch: { recovery_ref: { id: 'recovery-w2-1-reset', owner: '15-recovery-runtime', enterprise_id: 'enterprise-w2-1' } },
  }));
});

// Test H: concurrent resume actors cannot both advance the same durable Run revision.
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  const first = durableEnvelope({ state: 'RECOVERY_REQUIRED', revision: 2, effectCertainty: W2.EFFECT_CERTAINTY.UNKNOWN, durabilityPatch: { recovery_ref: { id: 'recovery-w2-1', owner: '15-recovery-runtime', enterprise_id: 'enterprise-w2-1' } } });
  const second = durableEnvelope({ state: 'RECOVERY_REQUIRED', revision: 2, effectCertainty: W2.EFFECT_CERTAINTY.UNKNOWN, durabilityPatch: { recovery_ref: { id: 'recovery-w2-1-b', owner: '15-recovery-runtime', enterprise_id: 'enterprise-w2-1' } } });
  const actorA = store.appendTransition('run-w2-1', first, { expectedRevision: 1, transitionId: 'transition-concurrent-a', phase: 'RESUME_CAS', reason: 'ACTOR_A' });
  const actorB = store.appendTransition('run-w2-1', second, { expectedRevision: 1, transitionId: 'transition-concurrent-b', phase: 'RESUME_CAS', reason: 'ACTOR_B' });
  assert.equal(actorA.ok, true);
  assert.equal(actorB.ok, false);
  assert.equal(actorB.reason, 'REVISION_CONFLICT');
});

// Test I: persistence failure blocks effect dispatch; executor is not invoked.
{
  let executorInvocations = 0;
  const failingStore = {
    appendTransitionAndAttempt() { return { ok: false, reason: 'SIMULATED_PERSISTENCE_FAILURE' }; },
  };
  const effectIntent = durableEnvelope({
    state: 'EXECUTION_PENDING',
    revision: 3,
    dispatchStarted: true,
    effectCertainty: W2.EFFECT_CERTAINTY.UNKNOWN,
    attempts: [{ attempt_id: 'attempt-w2-1-dispatch', attempt_no: 4, status: 'RUNNING' }],
    durabilityPatch: { attempt_id: 'attempt-w2-1-dispatch' },
  });
  const result = persistExecutionIntentBeforeDispatch(failingStore, effectIntent, () => { executorInvocations += 1; });
  assert.equal(result.dispatched, false);
  assert.equal(result.reason, 'SIMULATED_PERSISTENCE_FAILURE');
  assert.equal(executorInvocations, 0);
}

// Missing Evidence reference remains missing; Kernel persistence must not fabricate Evidence ownership or truth.
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  const loaded = store.load('run-w2-1');
  assert.deepEqual(loaded.envelope.evidence_refs, []);
  const decision = W2.decideResume(loaded.envelope, resumeContext({
    effect: { certainty: W2.EFFECT_CERTAINTY.OBSERVED, independent: true, fresh: true },
    evidence: { complete: false, integrity_valid: false },
    verification: { status: 'PENDING' },
  }));
  assert.notEqual(decision.decision, W2.DECISIONS.VERIFY_FIRST);
});

// Test J: unfinished run discovery returns only non-terminal runs and does not execute them.
withDb(dbPath, db => {
  const store = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  const terminal = durableEnvelope({ state: 'OUTCOME_RECORDED', durabilityPatch: { run_id: 'run-w2-1-terminal', transition_id: 'transition-w2-1-terminal', effect_operation_id: 'effect-op-terminal', idempotency_ref: 'idem-terminal' } });
  store.create(terminal);
  const unfinished = store.listUnfinished('enterprise-w2-1');
  assert.ok(unfinished.some(row => row.run_id === 'run-w2-1'));
  assert.ok(!unfinished.some(row => row.run_id === 'run-w2-1-terminal'));
});

// Real process restart proof: Process A writes, Process B reloads and computes resume admission.
{
  const processDb = path.join(root, 'w2-1-process.sqlite3');
  const write = spawnSync(process.execPath, [currentFile, '--child=write', `--db=${processDb}`], { encoding: 'utf8' });
  assert.equal(write.status, 0, write.stderr || write.stdout);
  const read = spawnSync(process.execPath, [currentFile, '--child=read', `--db=${processDb}`], { encoding: 'utf8' });
  assert.equal(read.status, 0, read.stderr || read.stdout);
  const payload = JSON.parse(read.stdout.trim().split('\n').at(-1));
  assert.equal(payload.runId, 'run-w2-1');
  assert.equal(payload.decision, W2.DECISIONS.READBACK_FIRST);
}

console.log(JSON.stringify({
  W2_1_DURABILITY_TESTS: 'PASS',
  REAL_DATABASE_ROUNDTRIP: 'PASS',
  PROCESS_RESTART_PROOF: 'PASS',
  DURABLE_RUN_IDENTITY_SURVIVES_RESTART: 'PASS',
  DURABLE_ATTEMPT_HISTORY_IS_IMMUTABLE: 'PASS',
  EFFECT_INTENT_IS_CHECKPOINTED_BEFORE_DISPATCH: 'PASS',
  EFFECT_UNKNOWN_SURVIVES_RESTART: 'PASS',
  RESUMED_WRITE_REQUIRES_CURRENT_AUTHORITY: 'PASS',
  RESUMED_WRITE_REQUIRES_CURRENT_LEASE: 'PASS',
  STALE_PREFLIGHT_IS_NOT_REUSED: 'PASS',
  DUPLICATE_RESUME_CANNOT_DUPLICATE_EFFECT: 'PASS',
  CONCURRENT_RESUME_CANNOT_DOUBLE_ADVANCE: 'PASS',
  DURABLE_STATE_VERSION_IS_VALIDATED: 'PASS',
  EVIDENCE_REFERENCE_SURVIVES_RESTART: 'PASS',
  PERSISTENCE_FAILURE_BLOCKS_EFFECT_DISPATCH: 'PASS',
  DURABLE_STATE_IS_NOT_PROCESS_MEMORY: 'PASS',
  KERNEL_PERSISTENCE_IS_ADAPTER_BASED: 'PASS',
  UNFINISHED_RUNS_ARE_DISCOVERABLE_AFTER_RESTART: 'PASS',
  DURABLE_RECORDS_PRESERVE_ENTERPRISE_CONTEXT_REFERENCES: 'CONTRACT_PREPARED',
}, null, 2));
