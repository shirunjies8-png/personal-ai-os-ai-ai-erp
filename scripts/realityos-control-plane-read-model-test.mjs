import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const Kernel = require('../services/realityosKernelService');
const W2 = require('../services/realityosKernelDurabilityContract');
const { RealityOSKernelDurableStore } = require('../services/realityosKernelDurableStore');
const { RealityOSDurableLinkageService, OWNERS, VERIFICATION_STATUS, RECOVERY_STATE } = require('../services/realityosDurableLinkageService');
const readModel = require('../services/realityosControlPlaneReadModel');

const now = '2026-09-23T08:00:00.000Z';
const clock = () => new Date(now);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realityos-control-plane-'));
const routeSource = fs.readFileSync(path.join(process.cwd(), 'routes', 'realityosControlPlaneRoutes.js'), 'utf8');
let dbCounter = 0;

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function createEnvelope() {
  const envelope = Kernel.createKernelEnvelope({
    mission_id: 'mission-control-plane',
    goal_id: 'goal-control-plane',
    task_id: 'task-read-only-surface',
    organization_context: { enterprise_id: 'enterprise-control-plane', workspace_id: 'workspace-control-plane' },
    actor_identity: { id: 'actor-control-plane', owner: '01-identity' },
    principal: { id: 'principal-control-plane', owner: '01-identity' },
    represented_principal: { id: 'enterprise-control-plane', owner: '02-organization' },
    authority_lease: {
      lease_id: 'lease-control-plane',
      status: 'ACTIVE',
      principal_id: 'principal-control-plane',
      represented_principal_id: 'enterprise-control-plane',
      capability_ids: ['capability-control-plane'],
      agent_ids: ['agent-control-plane'],
      executor_ids: ['executor-control-plane'],
      tool_ids: ['tool-control-plane'],
      canonical_effects: ['READ_RUNTIME_STATUS'],
      expires_at: '2026-09-23T09:00:00.000Z',
    },
    agent: { id: 'agent-control-plane', owner: '06-agent-skill' },
    executor: { id: 'executor-control-plane', owner: '10-execution-runtime', capabilityId: 'capability-control-plane' },
    capability_id: 'capability-control-plane',
    tool: { id: 'tool-control-plane', owner: '07-tool-connector', capabilityId: 'capability-control-plane' },
    execution_intent: { operation: 'read-runtime-status', payload_ref: 'runtime-status' },
    effect_declaration: {
      resource: 'realityos.control-plane',
      verb: 'READ',
      target: 'runtime-status',
      purpose: 'CONTROL_PLANE_READ_ONLY_TEST',
      effectClass: 'OBSERVATION',
      canonicalEffect: 'READ_RUNTIME_STATUS',
    },
  }, clock);
  return W2.extendCanonicalEnvelope(envelope, {
    schema_version: 1,
    run_id: 'run-control-plane',
    revision: 0,
    transition_id: 'transition-control-plane-0',
    transition_phase: 'INITIAL_CHECKPOINT',
    effect_operation_id: 'effect-op-control-plane',
    idempotency_ref: 'idem-control-plane',
    dispatch_started: false,
    effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
    evidence_commit_ref: 'evidence-commit-control-plane',
    intent_digest: sha('read-runtime-status'),
    authority_ref: { id: 'authority-control-plane', owner: '04-authority', enterprise_id: 'enterprise-control-plane' },
    lease_ref: { id: 'lease-control-plane', owner: '04-authority', enterprise_id: 'enterprise-control-plane' },
  });
}

function withDb(fn) {
  const dbPath = path.join(tempRoot, `control-plane-${++dbCounter}.sqlite3`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

try {
  assert.match(routeSource, /router\.use\(authRequired\)/, 'Control Plane read API must require auth');
  assert.match(routeSource, /router\.get\('\/'/, 'Control Plane list endpoint must be GET');
  assert.match(routeSource, /router\.get\('\/runs\/:id'/, 'Control Plane detail endpoint must be GET');
  assert.doesNotMatch(routeSource, /router\.(post|patch|put|delete)\(/, 'Control Plane route must not expose mutating endpoints');

  withDb(db => {
    const zero = readModel.getControlPlane({ db, enterpriseId: 'enterprise-control-plane' });
    assert.equal(zero.parallel_truth_store, false);
    assert.equal(zero.mock_data_used, false);
    assert.equal(zero.zero_data_state, 'NO_GOVERNED_RUNS_YET');
    assert.equal(zero.status.active_runs, 0);
    assert.equal(zero.proof_levels.kernel_run_durability, 'NOT_AVAILABLE');
  });

  withDb(db => {
    const kernel = new RealityOSKernelDurableStore(db, { clock });
    kernel.create(createEnvelope());
    const partial = readModel.getControlPlane({ db, enterpriseId: 'enterprise-control-plane' });
    assert.equal(partial.status.evidence_receipt_count, 0);
    assert.equal(partial.status.verification_pending, 0);
    assert.equal(partial.status.recovery_required, 0);
    assert.equal(partial.runs.length, 1);
    assert.equal(partial.runs[0].evidence_count, 0);
    assert.equal(partial.runs[0].verification_count, 0);
    assert.equal(partial.runs[0].recovery_count, 0);
    assert.equal(partial.runs[0].recovery_state, 'NOT_REQUIRED');
  });

  withDb(db => {
    const kernel = new RealityOSKernelDurableStore(db, { clock });
    const linkage = new RealityOSDurableLinkageService(db, { clock });
    const envelope = createEnvelope();
    kernel.create(envelope);
    const evidence = linkage.recordEvidenceReceipt({
      envelope,
      evidence_id: 'evidence-control-plane',
      evidence_type: 'CONTROL_PLANE_READBACK_RECEIPT',
      source_ref: { owner: '12-reality-runtime', source: 'durable-store-readback' },
      provenance_ref: { owner: OWNERS.EVIDENCE, lineage: 'kernel-run' },
      payload_ref: { table: 'realityos_kernel_runs', run_id: 'run-control-plane' },
      payload_hash: sha({ table: 'realityos_kernel_runs', run_id: 'run-control-plane' }),
    });
    const withEvidence = { ...envelope, evidence_refs: [{ evidence_id: evidence.evidence_id, owner: OWNERS.EVIDENCE, enterprise_id: evidence.enterprise_id, integrity_ref: evidence.integrity_ref }] };
    linkage.createVerificationCase({
      envelope: withEvidence,
      evidence_refs: withEvidence.evidence_refs,
      verification_id: 'verification-control-plane',
      status: VERIFICATION_STATUS.PENDING,
      decision: 'PENDING_READBACK_REVIEW',
    });
    linkage.createRecoveryCase({
      envelope: withEvidence,
      evidence_refs: withEvidence.evidence_refs,
      recovery_case_id: 'recovery-control-plane',
      recovery_state: RECOVERY_STATE.REQUIRED,
      originating_failure_ref: { failure_class: 'UNKNOWN_EFFECT' },
    });

    const controlPlane = readModel.getControlPlane({ db, enterpriseId: 'enterprise-control-plane' });
    assert.equal(controlPlane.status.active_runs, 1);
    assert.equal(controlPlane.status.effect_unknown, 1);
    assert.equal(controlPlane.status.verification_pending, 1);
    assert.equal(controlPlane.status.recovery_required, 1);
    assert.equal(controlPlane.status.evidence_receipt_count, 1);
    assert.equal(controlPlane.proof_levels.kernel_run_durability, 'DURABLE_VERIFIED');
    assert.equal(controlPlane.proof_levels.real_jev_runtime, 'NOT_INTEGRATED');
    assert.equal(controlPlane.first_read_only_path.status, 'BLOCKED');
    assert.equal(controlPlane.runs[0].effect_certainty, 'UNKNOWN');
    assert.equal(controlPlane.runs[0].expected_actual, 'NOT_AVAILABLE_FOR_THIS_RUN');

    const detail = readModel.loadRun(db, 'run-control-plane', 'enterprise-control-plane');
    assert.equal(detail.run.run_id, 'run-control-plane');
    assert.equal(detail.transitions.length, 1);
    assert.equal(detail.evidence.length, 1);
    assert.equal(detail.evidence[0].payload, 'REFERENCE / METADATA');
    assert.equal(detail.verification[0].status, 'PENDING');
    assert.equal(detail.recovery[0].automated_recovery_execution, 'NOT_READY');
    assert.equal(detail.effect_reality.message, 'Reality not yet established');
  });

  console.log(JSON.stringify({
    status: 'PASS',
    zeroData: 'PASS',
    runList: 'PASS',
    runDetail: 'PASS',
    evidenceView: 'PASS',
    verificationView: 'PASS',
    recoveryView: 'PASS',
    jevDistinction: 'PASS',
    readApiAuth: 'PASS',
    mutationEndpoint: 'NONE',
    parallelTruthStore: 'NO',
  }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
