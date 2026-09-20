const { randomUUID } = require('node:crypto');
const Core = require('../realityos-core');

const STATES = Object.freeze([
  'CREATED',
  'CONTEXT_BOUND',
  'AUTHORITY_PENDING',
  'AUTHORIZED',
  'AUTHORITY_DENIED',
  'PREFLIGHT_PENDING',
  'PREFLIGHT_PASSED',
  'PREFLIGHT_REJECTED',
  'EXECUTION_PENDING',
  'EXECUTING',
  'EXECUTION_FAILED',
  'EFFECT_PENDING',
  'READBACK_PENDING',
  'READBACK_FAILED',
  'EFFECT_UNCONFIRMED',
  'EVIDENCE_PENDING',
  'EVIDENCE_INSUFFICIENT',
  'VERIFICATION_PENDING',
  'VERIFICATION_FAILED',
  'VERIFIED',
  'OUTCOME_RECORDED',
  'RECOVERY_REQUIRED',
  'RECOVERING',
  'RECOVERED',
  'TERMINAL_FAILURE',
]);

const TRANSITIONS = Object.freeze({
  CREATED: ['CONTEXT_BOUND'],
  CONTEXT_BOUND: ['AUTHORITY_PENDING'],
  AUTHORITY_PENDING: ['AUTHORIZED', 'AUTHORITY_DENIED'],
  AUTHORIZED: ['PREFLIGHT_PENDING'],
  PREFLIGHT_PENDING: ['PREFLIGHT_PASSED', 'PREFLIGHT_REJECTED'],
  PREFLIGHT_PASSED: ['EXECUTION_PENDING', 'AUTHORITY_DENIED'],
  EXECUTION_PENDING: ['EXECUTING'],
  EXECUTING: ['EFFECT_PENDING', 'EXECUTION_FAILED'],
  EXECUTION_FAILED: ['RECOVERY_REQUIRED', 'TERMINAL_FAILURE'],
  EFFECT_PENDING: ['READBACK_PENDING'],
  READBACK_PENDING: ['EVIDENCE_PENDING', 'READBACK_FAILED', 'EFFECT_UNCONFIRMED'],
  READBACK_FAILED: ['RECOVERY_REQUIRED', 'TERMINAL_FAILURE'],
  EFFECT_UNCONFIRMED: ['RECOVERY_REQUIRED', 'TERMINAL_FAILURE'],
  EVIDENCE_PENDING: ['VERIFICATION_PENDING', 'EVIDENCE_INSUFFICIENT'],
  EVIDENCE_INSUFFICIENT: ['RECOVERY_REQUIRED', 'TERMINAL_FAILURE'],
  VERIFICATION_PENDING: ['VERIFIED', 'VERIFICATION_FAILED'],
  VERIFICATION_FAILED: ['RECOVERY_REQUIRED', 'TERMINAL_FAILURE'],
  VERIFIED: ['RECOVERED', 'OUTCOME_RECORDED'],
  RECOVERY_REQUIRED: ['RECOVERING', 'TERMINAL_FAILURE'],
  RECOVERING: ['AUTHORITY_PENDING', 'TERMINAL_FAILURE'],
  RECOVERED: ['OUTCOME_RECORDED'],
  AUTHORITY_DENIED: [],
  PREFLIGHT_REJECTED: [],
  OUTCOME_RECORDED: [],
  TERMINAL_FAILURE: [],
});

const TERMINAL_STATES = Object.freeze([
  'AUTHORITY_DENIED',
  'PREFLIGHT_REJECTED',
  'OUTCOME_RECORDED',
  'TERMINAL_FAILURE',
]);

class KernelContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'KernelContractError';
    this.code = code;
  }
}

function iso(clock) {
  const value = typeof clock === 'function' ? clock() : new Date();
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function required(value, field) {
  if (value == null || value === '') throw new KernelContractError('KERNEL_CONTEXT_INVALID', `${field} is required`);
  return value;
}

// Reference identities reuse the canonical id field; this is shape validation,
// not a second authentication system or a substitute for the Authority owner.
function validIdentity(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && typeof value.id === 'string' && value.id.trim().length > 0;
}

function validContext(envelope) {
  return ['actor_identity', 'principal', 'represented_principal', 'agent', 'executor', 'tool']
    .every(key => validIdentity(envelope[key]));
}

function bindingSnapshot(envelope) {
  return JSON.stringify(['actor_identity', 'principal', 'represented_principal', 'agent', 'executor', 'tool',
    'capability_id', 'authority_lease', 'effect_declaration', 'expected_effect', 'execution_intent']
    .map(key => envelope[key]));
}

function capabilityBound(envelope, capability) {
  return capability?.capabilityId === envelope.capability_id
    && envelope.executor?.capabilityId === envelope.capability_id
    && envelope.tool?.capabilityId === envelope.capability_id;
}

function createKernelEnvelope(input = {}, clock) {
  const createdAt = iso(clock);
  const traceId = String(input.trace_id || randomUUID());
  const envelope = {
    kernel_version: 'W1',
    mission_id: String(required(input.mission_id, 'mission_id')),
    goal_id: String(required(input.goal_id, 'goal_id')),
    task_id: String(required(input.task_id, 'task_id')),
    organization_context: input.organization_context || {},
    actor_identity: input.actor_identity || null,
    principal: input.principal || null,
    represented_principal: input.represented_principal || null,
    authority_decision: null,
    authority_lease: input.authority_lease || null,
    agent: input.agent || null,
    executor: input.executor || null,
    capability_id: String(required(input.capability_id, 'capability_id')),
    capability: null,
    tool: input.tool || null,
    preflight_result: null,
    execution_intent: input.execution_intent || {},
    execution_attempts: [],
    effect_declaration: Core.createEffectRequest(input.effect_declaration || {}),
    expected_effect: Core.createExpectedEffect(input.expected_effect || input.effect_declaration || {}),
    actual_reality_readback: null,
    evidence_refs: [],
    provenance_refs: [],
    verification_result: null,
    outcome: null,
    recovery_state: { status: 'NOT_REQUIRED', attempts: 0, history: [] },
    timestamps: { created_at: createdAt, updated_at: createdAt, terminal_at: '' },
    correlation_id: String(input.correlation_id || traceId),
    trace_id: traceId,
    state: 'CREATED',
    state_history: [{ state: 'CREATED', at: createdAt, reason: 'KERNEL_ENVELOPE_CREATED' }],
  };
  if (!envelope.effect_declaration.canonicalEffect || envelope.effect_declaration.canonicalEffect === 'UNKNOWN_EFFECT') {
    throw new KernelContractError('KERNEL_CONTEXT_INVALID', 'effect_declaration.canonicalEffect is required');
  }
  return envelope;
}

function transition(envelope, nextState, reason, clock) {
  if (!STATES.includes(nextState)) throw new KernelContractError('UNKNOWN_KERNEL_STATE', `Unknown kernel state: ${nextState}`);
  const allowed = TRANSITIONS[envelope.state] || [];
  if (!allowed.includes(nextState)) {
    throw new KernelContractError('INVALID_STATE_TRANSITION', `${envelope.state} -> ${nextState} is not allowed`);
  }
  const at = iso(clock);
  envelope.state = nextState;
  envelope.timestamps.updated_at = at;
  if (TERMINAL_STATES.includes(nextState)) envelope.timestamps.terminal_at = at;
  envelope.state_history.push({ state: nextState, at, reason: String(reason || '') });
  return envelope;
}

function validateAuthorityLease(lease, envelope, nowValue) {
  if (!lease || lease.status !== 'ACTIVE') return { valid: false, reason: 'NO_ACTIVE_AUTHORITY_LEASE' };
  const nowMs = Date.parse(nowValue);
  const expiresMs = Date.parse(lease.expires_at || '');
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return { valid: false, reason: 'AUTHORITY_LEASE_EXPIRED' };
  const principalId = String(envelope.principal?.id || '');
  const representedPrincipalId = String(envelope.represented_principal?.id || '');
  if (String(lease.principal_id || '') !== principalId) return { valid: false, reason: 'AUTHORITY_LEASE_PRINCIPAL_MISMATCH' };
  if (String(lease.represented_principal_id || '') !== representedPrincipalId) return { valid: false, reason: 'AUTHORITY_LEASE_REPRESENTED_PRINCIPAL_MISMATCH' };
  const capabilityIds = Array.isArray(lease.capability_ids) ? lease.capability_ids : [];
  if (!capabilityIds.includes(envelope.capability_id)) return { valid: false, reason: 'AUTHORITY_LEASE_CAPABILITY_NOT_ALLOWED' };
  const agentIds = Array.isArray(lease.agent_ids) ? lease.agent_ids : [];
  if (!agentIds.includes(String(envelope.agent?.id || ''))) return { valid: false, reason: 'AUTHORITY_LEASE_AGENT_NOT_ALLOWED' };
  const executorIds = Array.isArray(lease.executor_ids) ? lease.executor_ids : [];
  if (!executorIds.includes(String(envelope.executor?.id || ''))) return { valid: false, reason: 'AUTHORITY_LEASE_EXECUTOR_NOT_ALLOWED' };
  const toolIds = Array.isArray(lease.tool_ids) ? lease.tool_ids : [];
  if (!toolIds.includes(String(envelope.tool?.id || ''))) return { valid: false, reason: 'AUTHORITY_LEASE_TOOL_NOT_ALLOWED' };
  const canonicalEffects = Array.isArray(lease.canonical_effects) ? lease.canonical_effects : [];
  if (!canonicalEffects.includes(envelope.effect_declaration.canonicalEffect)) return { valid: false, reason: 'AUTHORITY_LEASE_EFFECT_NOT_ALLOWED' };
  return { valid: true, reason: 'AUTHORITY_LEASE_VALID', lease_id: String(lease.lease_id || '') };
}

function createReferenceEvidenceRuntime() {
  const records = [];
  return {
    owner: '13-evidence-runtime',
    record(input = {}) {
      const record = Object.freeze({
        evidence_id: String(input.evidence_id || randomUUID()),
        owner: '13-evidence-runtime',
        trace_id: String(input.trace_id || ''),
        type: String(input.type || 'KERNEL_EVIDENCE'),
        stage: String(input.stage || ''),
        payload: input.payload || {},
        provenance: input.provenance || {},
        recorded_at: String(input.recorded_at || new Date().toISOString()),
      });
      records.push(record);
      return record;
    },
    list(traceId) {
      return records.filter(item => !traceId || item.trace_id === traceId);
    },
  };
}

function defaultAuthorityEvaluator(envelope, authorityRules) {
  return Core.evaluateEffectAuthority({
    effectRequest: envelope.effect_declaration,
    authorityContext: {
      principal: envelope.principal,
      representedPrincipal: envelope.represented_principal,
      rules: authorityRules || [],
    },
  });
}

function failOutcome(envelope, code, reason) {
  envelope.outcome = {
    status: 'FAILED',
    code,
    reason,
    execution_success: envelope.execution_attempts.some(item => item.status === 'SUCCESS'),
    verified: false,
  };
  return envelope;
}

async function recordEvidence(adapters, envelope, input) {
  if (!adapters.evidence || typeof adapters.evidence.record !== 'function') return null;
  const evidence = await adapters.evidence.record({
    trace_id: envelope.trace_id,
    recorded_at: envelope.timestamps.updated_at,
    ...input,
  });
  if (!evidence || evidence.owner !== '13-evidence-runtime'
    || typeof evidence.evidence_id !== 'string' || !evidence.evidence_id.trim()
    || evidence.trace_id !== envelope.trace_id || evidence.stage !== input.stage) return null;
  envelope.evidence_refs.push(evidence.evidence_id);
  envelope.provenance_refs.push({
    evidence_id: evidence.evidence_id,
    owner: evidence.owner,
    stage: evidence.stage,
  });
  return evidence;
}

async function recoverOrStop({ envelope, adapters, failure, clock, maxAttempts }) {
  transition(envelope, 'RECOVERY_REQUIRED', failure.code, clock);
  transition(envelope, 'RECOVERING', failure.code, clock);
  envelope.recovery_state.status = 'RECOVERING';
  envelope.recovery_state.attempts += 1;
  const recoveryEvidence = await recordEvidence(adapters, envelope, {
    type: 'RECOVERY_EVIDENCE',
    stage: 'RECOVERY',
    payload: { failure_code: failure.code, retry_safe: failure.retry_safe === true,
      no_effect_readback: failure.no_effect_readback || null, error: failure.error || null },
    provenance: { represented_principal_id: envelope.represented_principal?.id || '' },
  });
  const decision = typeof adapters.recovery?.decide === 'function'
    ? await adapters.recovery.decide({ envelope, failure, recoveryEvidence })
    : { action: 'STOP', reason: 'NO_RECOVERY_POLICY' };
  const normalized = {
    action: String(decision?.action || 'STOP'),
    reason: String(decision?.reason || ''),
    decided_by: String(decision?.decided_by || 'recovery-runtime'),
    evidence_ref: recoveryEvidence?.evidence_id || '',
  };
  envelope.recovery_state.history.push(normalized);
  const retryAllowed = normalized.action === 'RETRY'
    && failure.retry_safe === true
    && failure.no_effect_readback?.status === 'NOT_OCCURRED'
    && !!recoveryEvidence
    && envelope.execution_attempts.length < maxAttempts;
  if (!retryAllowed) {
    envelope.recovery_state.status = 'STOPPED';
    transition(envelope, 'TERMINAL_FAILURE', recoveryEvidence ? normalized.reason || failure.code : 'RECOVERY_EVIDENCE_INSUFFICIENT', clock);
    return false;
  }
  envelope.recovery_state.status = 'RETRY_AUTHORIZED';
  transition(envelope, 'AUTHORITY_PENDING', 'RECOVERY_REQUIRES_FRESH_AUTHORITY_AND_PREFLIGHT', clock);
  return true;
}

async function runKernel(input = {}, adapters = {}) {
  const clock = adapters.clock;
  const maxAttempts = Math.max(1, Math.min(3, Number(input.max_attempts || 1)));
  const envelope = createKernelEnvelope(input, clock);
  const originalBinding = bindingSnapshot(envelope);
  transition(envelope, 'CONTEXT_BOUND', 'IDENTITY_WORK_AND_TRACE_CONTEXT_BOUND', clock);
  transition(envelope, 'AUTHORITY_PENDING', 'AUTHORITY_REQUIRED_BEFORE_EXECUTION', clock);

  while (envelope.execution_attempts.length < maxAttempts) {
    if (!validContext(envelope) || bindingSnapshot(envelope) !== originalBinding) {
      transition(envelope, 'AUTHORITY_DENIED', 'INVALID_IDENTITY_OR_BINDING', clock);
      return failOutcome(envelope, 'INVALID_IDENTITY_OR_BINDING', 'Canonical identity or authority binding is invalid');
    }
    const authorityDecision = typeof adapters.authority?.evaluate === 'function'
      ? await adapters.authority.evaluate({ envelope })
      : defaultAuthorityEvaluator(envelope, input.authority_rules);
    const leaseResult = validateAuthorityLease(envelope.authority_lease, envelope, iso(clock));
    envelope.authority_decision = { ...authorityDecision, lease: leaseResult };
    if (authorityDecision?.decision !== 'ALLOW' || !leaseResult.valid) {
      transition(envelope, 'AUTHORITY_DENIED', leaseResult.valid ? `AUTHORITY_${authorityDecision?.decision || 'UNKNOWN'}` : leaseResult.reason, clock);
      return failOutcome(envelope, 'AUTHORITY_DENIED', leaseResult.valid ? authorityDecision?.reason : leaseResult.reason);
    }
    transition(envelope, 'AUTHORIZED', 'AUTHORITY_AND_LEASE_VALID', clock);

    transition(envelope, 'PREFLIGHT_PENDING', 'CAPABILITY_AND_PREFLIGHT_REQUIRED', clock);
    const capability = typeof adapters.capability?.resolve === 'function'
      ? await adapters.capability.resolve(envelope.capability_id)
      : null;
    envelope.capability = capability || null;
    if (!capability) {
      transition(envelope, 'PREFLIGHT_REJECTED', 'CAPABILITY_NOT_FOUND', clock);
      return failOutcome(envelope, 'CAPABILITY_NOT_FOUND', 'Capability is not registered');
    }
    if (!capabilityBound(envelope, capability)) {
      transition(envelope, 'PREFLIGHT_REJECTED', 'CAPABILITY_BINDING_MISMATCH', clock);
      return failOutcome(envelope, 'CAPABILITY_BINDING_MISMATCH', 'Requested, resolved, executor and tool capability must match');
    }
    const preflightResult = typeof adapters.preflight?.evaluate === 'function'
      ? await adapters.preflight.evaluate({ envelope, capability })
      : Core.preflight({ capability, executionContext: input.execution_context || {} });
    envelope.preflight_result = preflightResult;
    if (!['READY', 'DEGRADED'].includes(preflightResult?.status)) {
      transition(envelope, 'PREFLIGHT_REJECTED', 'PREFLIGHT_BLOCKED', clock);
      return failOutcome(envelope, 'PREFLIGHT_REJECTED', (preflightResult?.blockingReasons || []).join(';') || 'Preflight did not pass');
    }
    transition(envelope, 'PREFLIGHT_PASSED', `PREFLIGHT_${preflightResult.status}`, clock);
    // Reevaluate after all asynchronous preflight work; no await may separate
    // the final lease/binding checks from crossing the executor boundary.
    const freshAuthority = typeof adapters.authority?.evaluate === 'function'
      ? await adapters.authority.evaluate({ envelope })
      : defaultAuthorityEvaluator(envelope, input.authority_rules);
    const freshLease = validateAuthorityLease(envelope.authority_lease, envelope, iso(clock));
    if (freshAuthority?.decision !== 'ALLOW' || !freshLease.valid || !validContext(envelope)
      || bindingSnapshot(envelope) !== originalBinding || !capabilityBound(envelope, capability)
      || !['READY', 'DEGRADED'].includes(envelope.preflight_result?.status)) {
      transition(envelope, 'AUTHORITY_DENIED', 'EXECUTION_BOUNDARY_REJECTED', clock);
      return failOutcome(envelope, 'EXECUTION_BOUNDARY_REJECTED', freshLease.reason);
    }
    envelope.authority_decision = { ...freshAuthority, lease: freshLease };
    transition(envelope, 'EXECUTION_PENDING', 'EXECUTION_ENQUEUED_AFTER_GATES', clock);
    transition(envelope, 'EXECUTING', 'EXECUTOR_INVOKED', clock);

    const attempt = {
      attempt_no: envelope.execution_attempts.length + 1,
      started_at: iso(clock),
      finished_at: '',
      status: 'RUNNING',
      result: null,
      error: null,
    };
    envelope.execution_attempts.push(attempt);
    try {
      const executionResult = await adapters.executor.execute({ envelope, attempt_no: attempt.attempt_no });
      attempt.finished_at = iso(clock);
      attempt.status = executionResult?.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
      attempt.result = executionResult || null;
      if (attempt.status !== 'SUCCESS') throw Object.assign(new Error(executionResult?.reason || 'Execution failed'), { code: executionResult?.code || 'EXECUTION_FAILED', retry_safe: executionResult?.retry_safe === true });
    } catch (error) {
      attempt.finished_at = attempt.finished_at || iso(clock);
      attempt.status = 'FAILED';
      attempt.error = { code: String(error.code || 'EXECUTION_FAILED'), message: String(error.message || 'Execution failed') };
      transition(envelope, 'EXECUTION_FAILED', attempt.error.code, clock);
      // Once execute was entered, only independent reality readback can prove
      // absence of effects. The executor's retry flag is never sufficient.
      let noEffectReadback = null;
      try {
        noEffectReadback = await adapters.reality.readback({ envelope, phase: 'EXECUTION_FAILURE', execution_result: attempt.result });
      } catch (readbackError) {
        attempt.failure_readback_error = { code: String(readbackError.code || 'READBACK_FAILED'), message: String(readbackError.message) };
      }
      attempt.failure_readback = noEffectReadback;
      const retry = await recoverOrStop({ envelope, adapters, failure: { code: attempt.error.code, reason: attempt.error.message, retry_safe: error.retry_safe === true, no_effect_readback: noEffectReadback }, clock, maxAttempts });
      if (retry) continue;
      return failOutcome(envelope, attempt.error.code, attempt.error.message);
    }

    transition(envelope, 'EFFECT_PENDING', 'EXECUTION_SUCCESS_REQUIRES_REALITY_READBACK', clock);
    transition(envelope, 'READBACK_PENDING', 'AUTHORITATIVE_READBACK_REQUIRED', clock);
    let readback;
    try {
      readback = await adapters.reality.readback({ envelope, execution_result: attempt.result });
    } catch (error) {
      transition(envelope, 'READBACK_FAILED', String(error.code || 'READBACK_FAILED'), clock);
      await recoverOrStop({ envelope, adapters, failure: { code: String(error.code || 'READBACK_FAILED'), reason: String(error.message || ''), retry_safe: false }, clock, maxAttempts });
      return failOutcome(envelope, 'READBACK_FAILED', String(error.message || 'Authoritative readback failed'));
    }
    if (!readback || readback.status !== 'OBSERVED' || !readback.actual_effect) {
      transition(envelope, 'READBACK_FAILED', 'AUTHORITATIVE_READBACK_MISSING', clock);
      await recoverOrStop({ envelope, adapters, failure: { code: 'AUTHORITATIVE_READBACK_MISSING', reason: 'Reality readback was not observed', retry_safe: false }, clock, maxAttempts });
      return failOutcome(envelope, 'AUTHORITATIVE_READBACK_MISSING', 'Reality readback was not observed');
    }
    envelope.actual_reality_readback = readback;
    const effectComparison = Core.compareExpectedActualEffect(envelope.expected_effect, readback.actual_effect);
    if (effectComparison.status !== 'MATCH') {
      transition(envelope, 'EFFECT_UNCONFIRMED', `EFFECT_${effectComparison.status}`, clock);
      await recoverOrStop({ envelope, adapters, failure: { code: 'EFFECT_UNCONFIRMED', reason: effectComparison.status, retry_safe: false }, clock, maxAttempts });
      return failOutcome(envelope, 'EFFECT_UNCONFIRMED', `Expected and actual effect: ${effectComparison.status}`);
    }

    transition(envelope, 'EVIDENCE_PENDING', 'EVIDENCE_RUNTIME_RECORD_REQUIRED', clock);
    const evidence = await recordEvidence(adapters, envelope, {
      type: 'KERNEL_EXECUTION_EVIDENCE',
      stage: 'REALITY_READBACK',
      payload: {
        mission_id: envelope.mission_id,
        task_id: envelope.task_id,
        capability_id: envelope.capability_id,
        effect_comparison: effectComparison.status,
      },
      provenance: {
        actor_identity_id: envelope.actor_identity?.id || '',
        principal_id: envelope.principal?.id || '',
        represented_principal_id: envelope.represented_principal?.id || '',
        agent_id: envelope.agent?.id || '',
        executor_id: envelope.executor?.id || '',
        tool_id: envelope.tool?.id || '',
        authority_rule_ref: envelope.authority_decision?.ruleRef || '',
        authority_lease_id: envelope.authority_decision?.lease?.lease_id || '',
      },
    });
    if (!evidence) {
      transition(envelope, 'EVIDENCE_INSUFFICIENT', 'EVIDENCE_RUNTIME_DID_NOT_RETURN_CANONICAL_REFERENCE', clock);
      await recoverOrStop({ envelope, adapters, failure: { code: 'EVIDENCE_INSUFFICIENT', reason: 'Canonical evidence is required', retry_safe: false }, clock, maxAttempts });
      return failOutcome(envelope, 'EVIDENCE_INSUFFICIENT', 'Canonical evidence is required');
    }

    transition(envelope, 'VERIFICATION_PENDING', 'INDEPENDENT_VERIFICATION_REQUIRED', clock);
    let verificationResult;
    try {
      verificationResult = await adapters.verification.verify({
      envelope,
      execution_result: attempt.result,
      reality_readback: readback,
      evidence,
      effect_comparison: effectComparison,
      });
    } catch (error) {
      const verificationError = { code: String(error.code || 'VERIFIER_EXCEPTION'), name: String(error.name || 'Error'), message: String(error.message || error) };
      envelope.verification_result = { status: 'ERROR', error: verificationError };
      transition(envelope, 'VERIFICATION_FAILED', 'VERIFIER_EXCEPTION', clock);
      await recoverOrStop({ envelope, adapters, failure: { code: 'VERIFIER_EXCEPTION', retry_safe: false, error: verificationError }, clock, maxAttempts });
      return failOutcome(envelope, 'VERIFIER_EXCEPTION', verificationError.message);
    }
    envelope.verification_result = verificationResult || null;
    if (!verificationResult || verificationResult.status !== 'VERIFIED') {
      transition(envelope, 'VERIFICATION_FAILED', verificationResult?.reason || 'VERIFICATION_FAILED', clock);
      await recoverOrStop({ envelope, adapters, failure: { code: 'VERIFICATION_FAILED', reason: verificationResult?.reason || 'Independent verification failed', retry_safe: false }, clock, maxAttempts });
      return failOutcome(envelope, 'VERIFICATION_FAILED', verificationResult?.reason || 'Independent verification failed');
    }

    transition(envelope, 'VERIFIED', 'INDEPENDENT_VERIFICATION_PASSED', clock);
    if (envelope.recovery_state.attempts > 0) {
      envelope.recovery_state.status = 'RECOVERED';
      transition(envelope, 'RECOVERED', 'RECOVERY_REVERIFIED', clock);
    }
    envelope.outcome = {
      status: 'VERIFIED_SUCCESS',
      execution_success: true,
      verified: true,
      verification_ref: String(verificationResult.verification_id || ''),
      evidence_refs: [...envelope.evidence_refs],
    };
    if (typeof adapters.outcome?.record === 'function') {
      envelope.outcome.record = await adapters.outcome.record({ envelope, outcome: envelope.outcome });
    }
    transition(envelope, 'OUTCOME_RECORDED', 'VERIFIED_OUTCOME_RECORDED', clock);
    return envelope;
  }

  if (!TERMINAL_STATES.includes(envelope.state)) {
    transition(envelope, 'TERMINAL_FAILURE', 'ATTEMPT_BUDGET_EXHAUSTED', clock);
  }
  return failOutcome(envelope, 'ATTEMPT_BUDGET_EXHAUSTED', 'Kernel attempt budget exhausted');
}

module.exports = {
  STATES,
  TRANSITIONS,
  TERMINAL_STATES,
  KernelContractError,
  createKernelEnvelope,
  transition,
  validateAuthorityLease,
  createReferenceEvidenceRuntime,
  runKernel,
};
