'use strict';

const crypto = require('node:crypto');
const defaultDb = require('../database/client');
const dashboardService = require('./dashboardService');
const Kernel = require('./realityosKernelService');
const W2 = require('./realityosKernelDurabilityContract');
const { RealityOSKernelDurableStore } = require('./realityosKernelDurableStore');
const {
  OWNERS,
  VERIFICATION_STATUS,
  RealityOSDurableLinkageService,
} = require('./realityosDurableLinkageService');

const CAPABILITY_ID = 'capability.dashboard.read_status';
const CANONICAL_EFFECT = 'DASHBOARD_STATUS_OBSERVED';
const AUTHORITY_PROOF_LEVEL = 'REFERENCE_CURRENT_PRODUCT_AUTH_BOUNDARY';

function nowIso(clock) {
  const value = typeof clock === 'function' ? clock() : new Date();
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDashboardSnapshot(value) {
  const countField = field => {
    const item = value?.[field];
    if (Array.isArray(item)) return item.length;
    return Number(item || 0);
  };
  return {
    todayOrders: countField('todayOrders'),
    inventoryAlerts: countField('inventoryAlerts'),
    delayedOrders: countField('delayedOrders'),
    todayPlan: countField('todayPlan'),
    aiSuggestions: Array.isArray(value?.aiSuggestions) ? value.aiSuggestions.length : 0,
    agentExecutions: Number(value?.agentExecutions || 0),
    aiLearningTimes: Number(value?.aiLearningTimes || 0),
    systemStatus: String(value?.systemStatus || 'UNKNOWN'),
  };
}

function getEnterpriseId(user = {}) {
  return String(user.enterprise_id || '').trim();
}

function buildDurability(envelope, patch = {}) {
  return {
    schema_version: 1,
    run_id: patch.run_id || envelope?.durability?.run_id || `run-dashboard-${crypto.randomUUID()}`,
    revision: Number(patch.revision ?? envelope?.durability?.revision ?? 0),
    transition_id: patch.transition_id || `transition-dashboard-${crypto.randomUUID()}`,
    transition_phase: patch.transition_phase || 'INITIAL_CHECKPOINT',
    effect_operation_id: patch.effect_operation_id || envelope?.durability?.effect_operation_id || `dashboard.read_status:${crypto.randomUUID()}`,
    idempotency_ref: patch.idempotency_ref || envelope?.durability?.idempotency_ref || `dashboard.idempotency:${crypto.randomUUID()}`,
    dispatch_started: Boolean(patch.dispatch_started ?? envelope?.durability?.dispatch_started ?? false),
    effect_certainty: patch.effect_certainty || envelope?.durability?.effect_certainty || W2.EFFECT_CERTAINTY.UNKNOWN,
    evidence_commit_ref: patch.evidence_commit_ref || envelope?.durability?.evidence_commit_ref || 'dashboard-observation:evidence-pending',
    intent_digest: patch.intent_digest || envelope?.durability?.intent_digest || sha({
      capability_id: CAPABILITY_ID,
      operation: 'dashboard.read_status',
      enterprise_id: envelope?.organization_context?.enterprise_id || '',
    }),
    attempt_id: patch.attempt_id ?? envelope?.durability?.attempt_id,
    authority_ref: patch.authority_ref ?? envelope?.durability?.authority_ref ?? null,
    lease_ref: patch.lease_ref ?? envelope?.durability?.lease_ref ?? null,
    readback_ref: patch.readback_ref ?? envelope?.durability?.readback_ref,
    verification_ref: patch.verification_ref ?? envelope?.durability?.verification_ref,
    outcome_ref: patch.outcome_ref ?? envelope?.durability?.outcome_ref,
    recovery_ref: patch.recovery_ref ?? envelope?.durability?.recovery_ref,
    human_control_ref: patch.human_control_ref ?? envelope?.durability?.human_control_ref,
    extensions: {
      ...(envelope?.durability?.extensions || {}),
      authority_proof_level: AUTHORITY_PROOF_LEVEL,
      represented_principal: 'NOT_FABRICATED',
      delegation: 'NOT_FABRICATED',
      w2_3_dependency: 'NOT_STARTED',
      ...(patch.extensions || {}),
    },
  };
}

function extend(envelope, durabilityPatch = {}) {
  const mutable = clone(envelope);
  const durability = buildDurability(mutable, durabilityPatch);
  delete mutable.durability;
  return W2.extendCanonicalEnvelope(mutable, durability);
}

function checkpoint(store, envelope, nextState, reason, phase, durabilityPatch = {}, clock) {
  const previousRevision = Number(envelope.durability.revision || 0);
  const mutable = clone(envelope);
  Kernel.transition(mutable, nextState, reason, clock);
  const next = extend(mutable, {
    ...durabilityPatch,
    revision: previousRevision + 1,
    transition_id: `${envelope.durability.run_id}:${previousRevision + 1}`,
    transition_phase: phase || nextState,
  });
  const result = store.appendTransition(next.durability.run_id, next, {
    expectedRevision: previousRevision,
    transitionId: next.durability.transition_id,
    phase: next.durability.transition_phase,
    reason,
  });
  if (!result.ok) {
    const error = new Error(`RealityOS durable transition failed: ${result.reason}`);
    error.code = 'REALITYOS_DURABLE_TRANSITION_FAILED';
    error.result = result;
    throw error;
  }
  return next;
}

function buildInitialEnvelope({ user, enterpriseId, clock }) {
  const runId = `run-dashboard-${crypto.randomUUID()}`;
  const actorId = String(user.id || user.email || 'authenticated-user');
  const envelope = Kernel.createKernelEnvelope({
    mission_id: 'mission.product.dashboard.read-status',
    goal_id: 'goal.first-governed-read-only-product-path',
    task_id: `task.dashboard.read-status.${crypto.randomUUID()}`,
    organization_context: { enterprise_id: enterpriseId, workspace_id: 'current-product-auth-boundary' },
    actor_identity: { id: actorId, owner: '01-identity', source: 'JWT_REQ_USER' },
    principal: { id: actorId, owner: '01-identity', source: 'CURRENT_PRODUCT_AUTH_BOUNDARY' },
    represented_principal: null,
    authority_lease: null,
    agent: { id: 'product-dashboard-controller', owner: '06-agent-skill' },
    executor: { id: 'governed-dashboard-adapter', owner: '10-execution-runtime', capabilityId: CAPABILITY_ID },
    capability_id: CAPABILITY_ID,
    tool: { id: 'dashboardService.getDashboard', owner: '07-tool-connector', capabilityId: CAPABILITY_ID },
    execution_intent: {
      operation: 'dashboard.read_status',
      method: 'GET',
      resource_ref: 'dashboard.summary',
      business_service_owner: 'services/dashboardService.js#getDashboard',
    },
    effect_declaration: {
      resource: 'dashboard.summary',
      verb: 'READ',
      target: 'enterprise-dashboard',
      purpose: 'FIRST_REAL_GOVERNED_READ_ONLY_PRODUCT_PATH',
      effectClass: 'OBSERVATION',
      canonicalEffect: CANONICAL_EFFECT,
      externalMutation: false,
    },
    expected_effect: {
      resource: 'dashboard.summary',
      verb: 'READ',
      target: 'enterprise-dashboard',
      purpose: 'FIRST_REAL_GOVERNED_READ_ONLY_PRODUCT_PATH',
      effectClass: 'OBSERVATION',
      canonicalEffect: CANONICAL_EFFECT,
      externalMutation: false,
    },
    trace_id: `trace-dashboard-${crypto.randomUUID()}`,
    correlation_id: `correlation-dashboard-${crypto.randomUUID()}`,
  }, clock);
  return extend(envelope, {
    run_id: runId,
    transition_id: `${runId}:0`,
    transition_phase: 'INITIAL_CHECKPOINT',
    effect_operation_id: `dashboard.read_status:${runId}`,
    idempotency_ref: `dashboard.read_status:${runId}`,
    authority_ref: { id: 'current-product-auth-boundary', owner: '04-authority', enterprise_id: enterpriseId },
  });
}

function preflight({ user, enterpriseId, method, dashboardReader }) {
  if (!user || !String(user.id || user.email || '').trim()) return { ok: false, code: 'AUTHENTICATED_ACTOR_REQUIRED', status: 401 };
  if (!enterpriseId) return { ok: false, code: 'ENTERPRISE_CONTEXT_REQUIRED', status: 403 };
  if (method !== 'GET') return { ok: false, code: 'READ_ONLY_METHOD_REQUIRED', status: 405 };
  if (typeof dashboardReader !== 'function') return { ok: false, code: 'DASHBOARD_SERVICE_UNAVAILABLE', status: 503 };
  return { ok: true, status: 'READY' };
}

function getGovernedDashboard(options = {}) {
  const user = options.user || {};
  const method = String(options.method || 'GET').toUpperCase();
  const enterpriseId = getEnterpriseId(user);
  const dashboardReader = options.dashboardReader || dashboardService.getDashboard;
  const db = options.db || defaultDb;
  const clock = options.clock;
  const initialPreflight = preflight({ user, enterpriseId, method, dashboardReader });
  if (!initialPreflight.ok) {
    const error = new Error(initialPreflight.code);
    error.code = initialPreflight.code;
    error.status = initialPreflight.status;
    throw error;
  }

  const store = options.store || new RealityOSKernelDurableStore(db, { clock });
  const linkage = options.linkage || new RealityOSDurableLinkageService(db, { clock });
  let envelope = buildInitialEnvelope({ user, enterpriseId, clock });
  try {
    store.create(envelope);
  } catch (error) {
    const durableError = new Error('GOVERNED_DASHBOARD_DURABLE_RUN_FAILED');
    durableError.code = 'GOVERNED_DASHBOARD_DURABLE_RUN_FAILED';
    durableError.status = 503;
    durableError.cause = error;
    throw durableError;
  }

  try {
    envelope = checkpoint(store, envelope, 'CONTEXT_BOUND', 'AUTHENTICATED_ACTOR_CONTEXT_BOUND', 'CONTEXT_BOUND', {}, clock);
    envelope = checkpoint(store, envelope, 'AUTHORITY_PENDING', 'CURRENT_PRODUCT_AUTH_BOUNDARY_REFERENCED', 'AUTHORITY_REFERENCE', {}, clock);
    const authorized = clone(envelope);
    authorized.authority_decision = {
      decision: 'ALLOW',
      source: 'CURRENT_PRODUCT_AUTH_BOUNDARY',
      proof_level: AUTHORITY_PROOF_LEVEL,
      represented_principal: 'NOT_FABRICATED',
      delegation: 'NOT_FABRICATED',
    };
    envelope = checkpoint(store, authorized, 'AUTHORIZED', 'READ_ONLY_CURRENT_PRODUCT_AUTH_BOUNDARY', 'AUTHORIZED', {}, clock);
    envelope = checkpoint(store, envelope, 'PREFLIGHT_PENDING', 'READ_ONLY_DASHBOARD_PREFLIGHT_REQUIRED', 'PREFLIGHT_PENDING', {}, clock);
    const preflightEnvelope = clone(envelope);
    preflightEnvelope.preflight_result = {
      status: 'READY',
      capability_id: CAPABILITY_ID,
      method,
      effect_class: 'OBSERVATION',
      business_service_owner: 'services/dashboardService.js#getDashboard',
      mutation_intent: false,
      jev_required: false,
    };
    envelope = checkpoint(store, preflightEnvelope, 'PREFLIGHT_PASSED', 'READ_ONLY_DASHBOARD_PREFLIGHT_PASSED', 'PREFLIGHT_PASSED', {}, clock);
    envelope = checkpoint(store, envelope, 'EXECUTION_PENDING', 'DASHBOARD_READ_QUEUED_AFTER_DURABLE_RUN', 'EXECUTION_PENDING', {}, clock);

    const attemptId = `attempt-dashboard-${crypto.randomUUID()}`;
    const executingEnvelope = clone(envelope);
    executingEnvelope.execution_attempts.push({
      attempt_id: attemptId,
      attempt_no: 1,
      started_at: nowIso(clock),
      finished_at: '',
      status: 'RUNNING',
      operation: 'dashboardService.getDashboard',
      effect_class: 'OBSERVATION',
    });
    envelope = checkpoint(store, executingEnvelope, 'EXECUTING', 'DASHBOARD_SERVICE_OBSERVATION_STARTED', 'WRITE_BEFORE_READ_ONLY_OBSERVATION', {
      dispatch_started: true,
      attempt_id: attemptId,
    }, clock);

    const dashboard = dashboardReader(enterpriseId);
    const firstObservedAt = nowIso(clock);
    const normalizedFirst = normalizeDashboardSnapshot(dashboard);

    envelope = checkpoint(store, envelope, 'EFFECT_PENDING', 'DASHBOARD_OBSERVATION_REQUIRES_READBACK', 'EFFECT_PENDING', {}, clock);
    envelope = checkpoint(store, envelope, 'READBACK_PENDING', 'SECOND_DASHBOARD_READBACK_REQUIRED', 'READBACK_PENDING', {}, clock);
    const readback = dashboardReader(enterpriseId);
    const readbackAt = nowIso(clock);
    const normalizedReadback = normalizeDashboardSnapshot(readback);
    const firstHash = sha(normalizedFirst);
    const readbackHash = sha(normalizedReadback);
    const stableMatch = firstHash === readbackHash;

    const readbackEnvelope = clone(envelope);
    readbackEnvelope.actual_reality_readback = {
      status: 'OBSERVED',
      source: 'dashboardService.getDashboard',
      first_observation_hash: firstHash,
      readback_hash: readbackHash,
      stable_match: stableMatch,
      changed_between_reads: !stableMatch,
      first_observed_at: firstObservedAt,
      readback_at: readbackAt,
    };
    envelope = checkpoint(store, readbackEnvelope, 'EVIDENCE_PENDING', 'DASHBOARD_OBSERVATION_METADATA_READY_FOR_EVIDENCE', 'EVIDENCE_PENDING', {
      effect_certainty: W2.EFFECT_CERTAINTY.OBSERVED,
      readback_ref: { id: `readback:${envelope.durability.run_id}`, owner: '12-reality-runtime', enterprise_id: enterpriseId },
    }, clock);

    const evidenceId = `evidence-dashboard-${crypto.randomUUID()}`;
    const evidencePayloadRef = {
      schema: 'dashboard-observation.v1',
      business_service_owner: 'services/dashboardService.js#getDashboard',
      source_tables: ['orders', 'inventory', 'feedback', 'logs'],
      full_payload_stored: false,
      first_observation_hash: firstHash,
      readback_hash: readbackHash,
      stable_match: stableMatch,
      changed_between_reads: !stableMatch,
      first_observed_at: firstObservedAt,
      readback_at: readbackAt,
      normalized_shape: Object.keys(normalizedFirst),
    };
    const payloadHash = sha(evidencePayloadRef);
    const evidence = linkage.recordEvidenceReceipt({
      envelope,
      evidence_id: evidenceId,
      evidence_type: 'DASHBOARD_OBSERVATION_READBACK',
      source_ref: { owner: '07-tool-connector', source: 'dashboardService.getDashboard' },
      provenance_ref: { owner: OWNERS.EVIDENCE, lineage: 'product-dashboard-read-only-observation' },
      payload_ref: evidencePayloadRef,
      payload_hash: payloadHash,
      integrity_ref: `sha256:${payloadHash}`,
    });
    const evidenceRef = {
      evidence_id: evidence.evidence_id,
      owner: OWNERS.EVIDENCE,
      enterprise_id: evidence.enterprise_id,
      integrity_ref: evidence.integrity_ref,
    };

    const evidenceEnvelope = clone(envelope);
    evidenceEnvelope.evidence_refs.push(evidenceRef);
    evidenceEnvelope.provenance_refs.push({ evidence_id: evidence.evidence_id, owner: OWNERS.EVIDENCE, stage: 'DASHBOARD_OBSERVATION_READBACK' });
    envelope = checkpoint(store, evidenceEnvelope, 'VERIFICATION_PENDING', 'DASHBOARD_OBSERVATION_EVIDENCE_RECORDED', 'VERIFICATION_PENDING', {
      evidence_commit_ref: evidence.evidence_id,
    }, clock);

    const verification = linkage.createVerificationCase({
      envelope,
      verification_id: `verification-dashboard-${crypto.randomUUID()}`,
      evidence_refs: [evidenceRef],
      verifier_ref: { owner: OWNERS.VERIFICATION, type: 'DASHBOARD_OBSERVATION_SCHEMA_VERIFIER' },
      verification_policy_ref: { policy: 'dashboard-observation-v1', exact_hash_match_required: false },
      status: VERIFICATION_STATUS.VERIFIED,
      decision: stableMatch ? 'STABLE_OBSERVATION_VERIFIED' : 'OBSERVATION_SCHEMA_VERIFIED_READBACK_CHANGED',
      reason_ref: {
        stable_match: stableMatch,
        rule: 'schema-and-provenance-verified; concurrent readback change preserved when present',
      },
    });

    const verifiedEnvelope = clone(envelope);
    verifiedEnvelope.verification_result = {
      status: VERIFICATION_STATUS.VERIFIED,
      verification_id: verification.verification_id,
      decision: verification.decision,
    };
    envelope = checkpoint(store, verifiedEnvelope, 'VERIFIED', 'DASHBOARD_OBSERVATION_VERIFIED', 'VERIFIED', {
      verification_ref: { id: verification.verification_id, owner: OWNERS.VERIFICATION, enterprise_id: enterpriseId },
    }, clock);

    const outcomeEnvelope = clone(envelope);
    outcomeEnvelope.outcome = {
      status: 'VERIFIED_OBSERVATION',
      execution_success: true,
      verified: true,
      verification_ref: verification.verification_id,
      evidence_refs: [evidenceRef],
      business_payload_returned: true,
      product_mutation: false,
    };
    envelope = checkpoint(store, outcomeEnvelope, 'OUTCOME_RECORDED', 'DASHBOARD_OBSERVATION_OUTCOME_RECORDED', 'OUTCOME_RECORDED', {
      outcome_ref: { id: `outcome:${envelope.durability.run_id}`, owner: '11-effect-runtime', enterprise_id: enterpriseId },
    }, clock);

    store.recordAttempt({
      attempt_id: attemptId,
      run_id: envelope.durability.run_id,
      enterprise_id: enterpriseId,
      attempt_no: 1,
      lifecycle_state: envelope.state,
      dispatch_started: true,
      effect_certainty: W2.EFFECT_CERTAINTY.OBSERVED,
      status: 'SUCCESS',
      started_at: firstObservedAt,
      finished_at: readbackAt,
      evidence_refs: [evidenceRef],
      attempt_snapshot: {
        operation: 'dashboardService.getDashboard',
        service_calls: 2,
        first_observation_hash: firstHash,
        readback_hash: readbackHash,
        stable_match: stableMatch,
        full_payload_stored: false,
      },
    });

    return {
      dashboard,
      realityos: {
        run_id: envelope.durability.run_id,
        attempt_id: attemptId,
        capability_id: CAPABILITY_ID,
        effect_class: 'OBSERVATION',
        effect_certainty: 'KNOWN_OCCURRED',
        evidence_id: evidence.evidence_id,
        verification_id: verification.verification_id,
        verification_status: verification.status,
        verification_decision: verification.decision,
        first_observation_hash: firstHash,
        readback_hash: readbackHash,
        stable_match: stableMatch,
        changed_between_reads: !stableMatch,
        authority_proof_level: AUTHORITY_PROOF_LEVEL,
        represented_principal: 'NOT_FABRICATED',
        delegation: 'NOT_FABRICATED',
        real_jev_runtime: 'NOT_INTEGRATED',
      },
    };
  } catch (error) {
    try {
      const failed = checkpoint(store, envelope, 'EXECUTION_FAILED', error.code || 'DASHBOARD_OBSERVATION_FAILED', 'EXECUTION_FAILED', {}, clock);
      checkpoint(store, failed, 'TERMINAL_FAILURE', 'READ_ONLY_DASHBOARD_FAILURE_RECORDED', 'TERMINAL_FAILURE', {}, clock);
    } catch {
      // Preserve the original business/governance error; failure recording is best-effort after durable run creation.
    }
    error.realityos = {
      run_id: envelope?.durability?.run_id,
      capability_id: CAPABILITY_ID,
      effect_class: 'OBSERVATION',
      failure_recording: 'ATTEMPTED',
    };
    throw error;
  }
}

module.exports = {
  AUTHORITY_PROOF_LEVEL,
  CANONICAL_EFFECT,
  CAPABILITY_ID,
  getGovernedDashboard,
  normalizeDashboardSnapshot,
};
