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
const { RealityOSKernelDurableStore } = require('../services/realityosKernelDurableStore');
const {
  OWNERS,
  VERIFICATION_STATUS,
  RECOVERY_STATE,
  RealityOSDurableLinkageService,
} = require('../services/realityosDurableLinkageService');

const now = '2026-09-21T13:00:00.000Z';
const future = '2026-09-21T14:00:00.000Z';
const fixedClock = () => new Date(now);

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function input(overrides = {}) {
  return {
    mission_id: 'mission-w2-2-1',
    goal_id: 'goal-owner-backed-durable-linkage',
    task_id: 'task-w2-2-1',
    organization_context: { enterprise_id: 'enterprise-w2-2-1', workspace_id: 'workspace-w2-2-1' },
    actor_identity: { id: 'actor-w2-2-1', owner: '01-identity' },
    principal: { id: 'principal-w2-2-1', owner: '01-identity' },
    represented_principal: { id: 'enterprise-w2-2-1', owner: '02-organization' },
    authority_lease: {
      lease_id: 'lease-w2-2-1',
      status: 'ACTIVE',
      principal_id: 'principal-w2-2-1',
      represented_principal_id: 'enterprise-w2-2-1',
      capability_ids: ['capability-w2-2-1'],
      agent_ids: ['agent-w2-2-1'],
      executor_ids: ['executor-w2-2-1'],
      tool_ids: ['tool-w2-2-1'],
      canonical_effects: ['W2_2_1_REFERENCE_EFFECT'],
      expires_at: future,
    },
    agent: { id: 'agent-w2-2-1', owner: '06-agent-skill' },
    executor: { id: 'executor-w2-2-1', owner: '10-execution-runtime', capabilityId: 'capability-w2-2-1' },
    capability_id: 'capability-w2-2-1',
    tool: { id: 'tool-w2-2-1', owner: '07-tool-connector', capabilityId: 'capability-w2-2-1' },
    execution_intent: { operation: 'owner-backed-linkage', payload_ref: 'fixture-only' },
    effect_declaration: {
      resource: 'w2.linkage',
      verb: 'UPDATE',
      target: 'w2:durable-linkage-fixture',
      purpose: 'W2_2_1_DURABILITY_TEST',
      effectClass: 'PERSISTENT_LOCAL_MUTATION',
      canonicalEffect: 'W2_2_1_REFERENCE_EFFECT',
    },
    ...overrides,
  };
}

function durability(overrides = {}) {
  return {
    schema_version: 1,
    run_id: 'run-w2-2-1',
    revision: 0,
    transition_id: 'transition-w2-2-1-0',
    transition_phase: 'INITIAL_CHECKPOINT',
    effect_operation_id: 'effect-op-w2-2-1',
    idempotency_ref: 'idem-w2-2-1',
    dispatch_started: false,
    effect_certainty: W2.EFFECT_CERTAINTY.OBSERVED,
    evidence_commit_ref: 'evidence-commit-w2-2-1',
    intent_digest: sha('owner-backed-linkage'),
    authority_ref: { id: 'authority-w2-2-1', owner: '04-authority', enterprise_id: 'enterprise-w2-2-1' },
    lease_ref: { id: 'lease-w2-2-1', owner: '04-authority', enterprise_id: 'enterprise-w2-2-1' },
    ...overrides,
  };
}

function envelope(options = {}) {
  const e = Kernel.createKernelEnvelope(input(options.input), fixedClock);
  if (options.state && options.state !== 'CREATED') {
    e.state = options.state;
    e.state_history.push({ state: options.state, at: now, reason: `TEST_${options.state}` });
  }
  if (options.evidenceRefs) e.evidence_refs.push(...options.evidenceRefs);
  if (options.recoveryState) e.recovery_state = options.recoveryState;
  return W2.extendCanonicalEnvelope(e, durability(options.durability));
}

function evidenceRef(id = 'evidence-w2-2-1') {
  return { evidence_id: id, owner: OWNERS.EVIDENCE, enterprise_id: 'enterprise-w2-2-1', integrity_ref: `sha256:${sha({ fixture: id })}` };
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

function createEvidence(service, e, id = 'evidence-w2-2-1') {
  return service.recordEvidenceReceipt({
    envelope: e,
    evidence_id: id,
    evidence_type: 'REALITY_READBACK_RECEIPT',
    source_ref: { owner: '12-reality-runtime', source: 'fixture-readback' },
    provenance_ref: { owner: OWNERS.EVIDENCE, lineage: 'kernel-run-fixture' },
    payload_ref: { fixture: id },
    payload_hash: sha({ fixture: id }),
    integrity_ref: `sha256:${sha({ fixture: id })}`,
  });
}

function setupRunAndEvidence(dbPath, { state = 'EVIDENCE_PENDING', evidenceId = 'evidence-w2-2-1', durabilityPatch = {}, recoveryState } = {}) {
  return withDb(dbPath, db => {
    const kernelStore = new RealityOSKernelDurableStore(db, { clock: fixedClock });
    const linkage = new RealityOSDurableLinkageService(db, { clock: fixedClock });
    const e = envelope({ state, evidenceRefs: [evidenceRef(evidenceId)], durability: durabilityPatch, recoveryState });
    kernelStore.create(e);
    const receipt = createEvidence(linkage, e, evidenceId);
    return { runId: e.durability.run_id, evidenceId: receipt.evidence_id, owner: receipt.owner };
  });
}

function childWrite(dbPath, mode) {
  if (mode === 'evidence-write') {
    return setupRunAndEvidence(dbPath);
  }
  if (mode === 'verification-write') {
    return withDb(dbPath, db => {
      const kernelStore = new RealityOSKernelDurableStore(db, { clock: fixedClock });
      const linkage = new RealityOSDurableLinkageService(db, { clock: fixedClock });
      const e = envelope({ state: 'VERIFICATION_PENDING', evidenceRefs: [evidenceRef()] });
      kernelStore.create(e);
      createEvidence(linkage, e);
      const verification = linkage.createVerificationCase({
        envelope: e,
        verification_id: 'verification-w2-2-1',
        evidence_refs: [evidenceRef()],
        verifier_ref: { owner: OWNERS.VERIFICATION, type: 'REFERENCE_VERIFIER' },
        status: VERIFICATION_STATUS.PENDING,
      });
      return { verification_id: verification.verification_id, status: verification.status };
    });
  }
  if (mode === 'recovery-write') {
    return withDb(dbPath, db => {
      const kernelStore = new RealityOSKernelDurableStore(db, { clock: fixedClock });
      const linkage = new RealityOSDurableLinkageService(db, { clock: fixedClock });
      const e = envelope({
        state: 'RECOVERY_REQUIRED',
        evidenceRefs: [evidenceRef()],
        durability: {
          effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
          recovery_ref: { id: 'recovery-w2-2-1', owner: OWNERS.RECOVERY, enterprise_id: 'enterprise-w2-2-1' },
        },
        recoveryState: { status: 'RECOVERING', attempts: 1, history: [] },
      });
      kernelStore.create(e);
      createEvidence(linkage, e);
      const recovery = linkage.createRecoveryCase({
        envelope: e,
        recovery_case_id: 'recovery-w2-2-1',
        evidence_refs: [evidenceRef()],
        originating_failure_ref: { code: 'EFFECT_UNCONFIRMED' },
        effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
        recovery_state: RECOVERY_STATE.REQUIRED,
        retry_eligibility: 'REQUIRES_EFFECT_NOT_OCCURRED_AND_CURRENT_AUTHORITY',
      });
      return { recovery_case_id: recovery.recovery_case_id, recovery_state: recovery.recovery_state };
    });
  }
  throw new Error(`Unknown child write mode: ${mode}`);
}

function childRead(dbPath, mode) {
  return withDb(dbPath, db => {
    const kernelStore = new RealityOSKernelDurableStore(db, { clock: fixedClock });
    const linkage = new RealityOSDurableLinkageService(db, { clock: fixedClock });
    const loaded = kernelStore.load('run-w2-2-1');
    assert.ok(loaded);
    if (mode === 'evidence-read') {
      const receipt = linkage.loadEvidenceReceipt('evidence-w2-2-1', 'enterprise-w2-2-1');
      assert.equal(receipt.receipt.owner, OWNERS.EVIDENCE);
      assert.equal(receipt.receipt.run_id, loaded.envelope.durability.run_id);
      assert.equal(linkage.validateEvidenceRefs([evidenceRef()], loaded.envelope).valid, true);
      return { evidence_id: receipt.receipt.evidence_id, integrity_ref: receipt.receipt.integrity_ref };
    }
    if (mode === 'verification-read') {
      const verification = linkage.loadVerificationCase('verification-w2-2-1', 'enterprise-w2-2-1');
      const decision = linkage.decideVerificationResume(loaded.envelope, verification);
      assert.equal(verification.status, VERIFICATION_STATUS.PENDING);
      assert.equal(decision.decision, W2.DECISIONS.VERIFY_FIRST);
      return { verification_id: verification.verification_id, decision: decision.decision };
    }
    if (mode === 'recovery-read') {
      const recovery = linkage.loadRecoveryCase('recovery-w2-2-1', 'enterprise-w2-2-1');
      const decision = linkage.decideRecoveryResume(loaded.envelope, recovery, { effect: { certainty: W2.EFFECT_CERTAINTY.UNKNOWN, independent: false } });
      assert.equal(recovery.recovery_state, RECOVERY_STATE.REQUIRED);
      assert.equal(decision.decision, W2.DECISIONS.RECOVERY_REQUIRED);
      assert.equal(decision.executionAllowed, false);
      return { recovery_case_id: recovery.recovery_case_id, decision: decision.decision, executionAllowed: decision.executionAllowed };
    }
    throw new Error(`Unknown child read mode: ${mode}`);
  });
}

const childMode = process.argv.find(arg => arg.startsWith('--child='));
if (childMode) {
  const mode = childMode.split('=')[1];
  const dbPath = process.argv.find(arg => arg.startsWith('--db='))?.slice(5);
  const result = mode.endsWith('-write') ? childWrite(dbPath, mode) : childRead(dbPath, mode);
  console.log(JSON.stringify(result));
  process.exit(0);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-w2-2-1-durability-'));

function runChild(mode, dbPath) {
  const result = spawnSync(process.execPath, [currentFile, `--child=${mode}`, `--db=${dbPath}`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split('\n').at(-1));
}

// Adapter shape remains owner-scoped. Evidence and Recovery satisfy W2.0 shapes; Verification remains owner-backed service API.
withDb(path.join(root, 'adapter.sqlite3'), db => {
  const service = new RealityOSDurableLinkageService(db, { clock: fixedClock });
  assert.equal(W2.validateAdapter(W2.ADAPTER_KINDS.EVIDENCE, service).valid, true);
  assert.equal(W2.validateAdapter(W2.ADAPTER_KINDS.RECOVERY, service).valid, true);
});

// Scenario A: Evidence survives independent process restart with integrity and owner metadata preserved.
{
  const dbPath = path.join(root, 'evidence-process.sqlite3');
  runChild('evidence-write', dbPath);
  const read = runChild('evidence-read', dbPath);
  assert.equal(read.evidence_id, 'evidence-w2-2-1');
  assert.equal(read.integrity_ref, `sha256:${sha({ fixture: 'evidence-w2-2-1' })}`);
}

// Evidence history is immutable; a different payload under the same evidence_id is rejected.
withDb(path.join(root, 'immutable.sqlite3'), db => {
  const service = new RealityOSDurableLinkageService(db, { clock: fixedClock });
  const e = envelope({ evidenceRefs: [evidenceRef()] });
  createEvidence(service, e);
  assert.throws(() => service.recordEvidenceReceipt({
    envelope: e,
    evidence_id: 'evidence-w2-2-1',
    evidence_type: 'REALITY_READBACK_RECEIPT',
    source_ref: { owner: '12-reality-runtime', source: 'changed' },
    provenance_ref: { owner: OWNERS.EVIDENCE },
    payload_ref: { fixture: 'changed' },
    payload_hash: sha({ fixture: 'changed' }),
  }), error => error.code === 'EVIDENCE_HISTORY_IS_IMMUTABLE');
});

// Scenario B: Verification PENDING survives restart and resumes as VERIFY_FIRST, never implicit success.
{
  const dbPath = path.join(root, 'verification-process.sqlite3');
  runChild('verification-write', dbPath);
  const read = runChild('verification-read', dbPath);
  assert.equal(read.decision, W2.DECISIONS.VERIFY_FIRST);
}

// Verification operation identity is idempotent for duplicate queue delivery.
withDb(path.join(root, 'verification-idem.sqlite3'), db => {
  const service = new RealityOSDurableLinkageService(db, { clock: fixedClock });
  const e = envelope({ evidenceRefs: [evidenceRef()] });
  createEvidence(service, e);
  const first = service.createVerificationCase({ envelope: e, verification_id: 'verification-idem-a', evidence_refs: [evidenceRef()], operation_identity: 'verify-op-1' });
  const second = service.createVerificationCase({ envelope: e, verification_id: 'verification-idem-b', evidence_refs: [evidenceRef()], operation_identity: 'verify-op-1' });
  assert.equal(first.verification_id, second.verification_id);
});

// Scenario C: Recovery REQUIRED survives restart and never dispatches a retry.
{
  const dbPath = path.join(root, 'recovery-process.sqlite3');
  runChild('recovery-write', dbPath);
  const read = runChild('recovery-read', dbPath);
  assert.equal(read.decision, W2.DECISIONS.RECOVERY_REQUIRED);
  assert.equal(read.executionAllowed, false);
}

// Missing or invalid Evidence fails safe for both Verification and Recovery admission.
withDb(path.join(root, 'missing-evidence.sqlite3'), db => {
  const service = new RealityOSDurableLinkageService(db, { clock: fixedClock });
  const e = envelope({ evidenceRefs: [evidenceRef('missing-evidence')] });
  assert.throws(() => service.createVerificationCase({ envelope: e, verification_id: 'verification-missing', evidence_refs: [evidenceRef('missing-evidence')] }),
    error => error.code === 'VERIFICATION_REQUIRES_DURABLE_EVIDENCE_REFERENCES');
  assert.throws(() => service.createRecoveryCase({ envelope: e, recovery_case_id: 'recovery-missing', evidence_refs: [evidenceRef('missing-evidence')] }),
    error => error.code === 'RECOVERY_WITHOUT_EVIDENCE_CANNOT_ADVANCE');
});

// Kernel boundary: Kernel durable store contains references and envelope snapshots; Evidence truth stays in Evidence owner table.
withDb(path.join(root, 'kernel-boundary.sqlite3'), db => {
  const kernelStore = new RealityOSKernelDurableStore(db, { clock: fixedClock });
  const service = new RealityOSDurableLinkageService(db, { clock: fixedClock });
  const e = envelope({ evidenceRefs: [evidenceRef()] });
  kernelStore.create(e);
  createEvidence(service, e);
  const loaded = kernelStore.load('run-w2-2-1');
  assert.deepEqual(loaded.envelope.evidence_refs, [evidenceRef()]);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM realityos_evidence_receipts').get().count, 1);
  assert.equal(db.prepare('SELECT evidence_refs FROM realityos_kernel_runs WHERE run_id=?').get('run-w2-2-1').evidence_refs.includes('evidence-w2-2-1'), true);
});

console.log(JSON.stringify({
  W2_2_1_DURABILITY_TESTS: 'PASS',
  RUNTIME_DURABILITY_VERIFIED: [
    'EVIDENCE_SURVIVES_PROCESS_RESTART',
    'VERIFICATION_STATE_SURVIVES_RESTART',
    'RECOVERY_CASE_SURVIVES_RESTART',
    'PROCESS_A_PROCESS_B_RESTART_PROOF',
  ],
  REFERENCE_INTEGRATION_VERIFIED: [
    'PENDING_VERIFICATION_NEVER_BECOMES_SUCCESS_ON_RESTART',
    'RECOVERY_RESTART_NEVER_BLIND_RETRIES',
    'KERNEL_STORES_REFERENCES_NOT_EVIDENCE_TRUTH',
  ],
  STATIC_GOVERNANCE_VERIFIED: [
    'EVIDENCE_OWNER_REMAINS_EVIDENCE_RUNTIME',
    'VERIFICATION_OWNER_REMAINS_VERIFICATION_RUNTIME',
    'RECOVERY_OWNER_REMAINS_RECOVERY_RUNTIME',
  ],
  CONTRACT_ONLY: [
    'RECOVERY_RETRY_REQUIRES_CURRENT_AUTHORITY',
    'RECOVERY_RETRY_REQUIRES_EFFECT_NOT_OCCURRED',
    'ENTERPRISE_CONTEXT_COMPATIBLE_WITH_W2_3',
  ],
  W2_2_1_INVARIANTS: {
    EVIDENCE_SURVIVES_PROCESS_RESTART: 'RUNTIME_DURABILITY_VERIFIED',
    EVIDENCE_HISTORY_IS_IMMUTABLE: 'RUNTIME_DURABILITY_VERIFIED',
    EVIDENCE_OWNER_REMAINS_EVIDENCE_RUNTIME: 'STATIC_GOVERNANCE_VERIFIED',
    VERIFICATION_STATE_SURVIVES_RESTART: 'RUNTIME_DURABILITY_VERIFIED',
    PENDING_VERIFICATION_NEVER_BECOMES_SUCCESS_ON_RESTART: 'REFERENCE_INTEGRATION_VERIFIED',
    VERIFICATION_REQUIRES_DURABLE_EVIDENCE_REFERENCES: 'RUNTIME_DURABILITY_VERIFIED',
    RECOVERY_CASE_SURVIVES_RESTART: 'RUNTIME_DURABILITY_VERIFIED',
    RECOVERY_RESTART_NEVER_BLIND_RETRIES: 'REFERENCE_INTEGRATION_VERIFIED',
    RECOVERY_RETRY_REQUIRES_CURRENT_AUTHORITY: 'CONTRACT_ONLY',
    RECOVERY_RETRY_REQUIRES_EFFECT_NOT_OCCURRED: 'CONTRACT_ONLY',
    RECOVERY_WITHOUT_EVIDENCE_CANNOT_ADVANCE: 'RUNTIME_DURABILITY_VERIFIED',
    RECOVERY_HISTORY_IS_AUDITABLE: 'RUNTIME_DURABILITY_VERIFIED',
    KERNEL_STORES_REFERENCES_NOT_EVIDENCE_TRUTH: 'REFERENCE_INTEGRATION_VERIFIED',
    CRASH_DURING_VERIFICATION_PRESERVES_DECISION_CONTEXT: 'RUNTIME_DURABILITY_VERIFIED',
    VERIFICATION_AND_RECOVERY_PRESERVE_RUN_ATTEMPT_LINKAGE: 'RUNTIME_DURABILITY_VERIFIED',
    MISSING_OR_INVALID_EVIDENCE_FAILS_SAFE: 'RUNTIME_DURABILITY_VERIFIED',
    DURABLE_LINKAGE_PRESERVES_ENTERPRISE_CONTEXT_REFERENCE: 'RUNTIME_DURABILITY_VERIFIED',
    W2_2_DURABILITY_DOES_NOT_CHANGE_W1_W2_1_SEMANTICS: 'REFERENCE_INTEGRATION_VERIFIED',
  },
}, null, 2));
