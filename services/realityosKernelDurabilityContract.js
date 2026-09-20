'use strict';

const Kernel = require('./realityosKernelService');

const SCHEMA_VERSION = 1;

const DECISIONS = Object.freeze({
  CONTINUE_SAFE: 'CONTINUE_SAFE',
  READBACK_FIRST: 'READBACK_FIRST',
  VERIFY_FIRST: 'VERIFY_FIRST',
  RECOVERY_REQUIRED: 'RECOVERY_REQUIRED',
  HUMAN_CONFIRMATION_REQUIRED: 'HUMAN_CONFIRMATION_REQUIRED',
  REAUTHORIZE: 'REAUTHORIZE',
  TERMINAL_FAILURE: 'TERMINAL_FAILURE',
});

const EFFECT_CERTAINTY = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  NOT_OCCURRED: 'NOT_OCCURRED',
  OBSERVED: 'OBSERVED',
});

const DURABLE_FIELD_CLASSIFICATION = Object.freeze({
  MUST_PERSIST: 'MUST_PERSIST',
  MAY_RECONSTRUCT: 'MAY_RECONSTRUCT',
  EPHEMERAL_ONLY: 'EPHEMERAL_ONLY',
  UNKNOWN: 'UNKNOWN',
});

const ADAPTER_KINDS = Object.freeze({
  EVIDENCE: 'evidence',
  RECOVERY: 'recovery',
  HUMAN: 'human',
  DURABLE_STORE: 'durable_store',
});

const DURABILITY_REQUIRED_FIELDS = Object.freeze([
  'schema_version',
  'run_id',
  'revision',
  'transition_id',
  'transition_phase',
  'effect_operation_id',
  'idempotency_ref',
  'dispatch_started',
  'effect_certainty',
  'evidence_commit_ref',
  'intent_digest',
]);

const DURABILITY_ALLOWED_FIELDS = Object.freeze([
  ...DURABILITY_REQUIRED_FIELDS,
  'attempt_id',
  'authority_ref',
  'lease_ref',
  'readback_ref',
  'verification_ref',
  'outcome_ref',
  'recovery_ref',
  'human_control_ref',
  'extensions',
]);

const REFERENCE_CORE_FIELDS = Object.freeze([
  'kernel_version',
  'mission_id',
  'goal_id',
  'task_id',
  'organization_context',
  'actor_identity',
  'principal',
  'represented_principal',
  'authority_decision',
  'authority_lease',
  'agent',
  'executor',
  'capability_id',
  'capability',
  'tool',
  'preflight_result',
  'execution_intent',
  'execution_attempts',
  'effect_declaration',
  'expected_effect',
  'actual_reality_readback',
  'evidence_refs',
  'provenance_refs',
  'verification_result',
  'outcome',
  'recovery_state',
  'timestamps',
  'correlation_id',
  'trace_id',
  'state',
  'state_history',
  'durability',
  'extensions',
]);

class DurabilityContractError extends Error {
  constructor(code, message, errors = []) {
    super(message);
    this.name = 'DurabilityContractError';
    this.code = code;
    this.errors = errors;
  }
}

function error(code, path, message) {
  return { code, path, message };
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertJsonSafe(value, path, errors, seen = new Set()) {
  if (value == null) return;
  if (['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      errors.push(error('NON_JSON_VALUE', path, `${path} must be JSON-safe`));
    }
    return;
  }
  if (typeof value !== 'object') {
    errors.push(error('NON_JSON_VALUE', path, `${path} must be JSON-safe`));
    return;
  }
  if (seen.has(value)) {
    errors.push(error('CYCLIC_VALUE', path, `${path} must not contain cycles`));
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`, errors, seen));
    seen.delete(value);
    return;
  }
  if (!isPlainObject(value)) {
    errors.push(error('NON_PLAIN_OBJECT', path, `${path} must be a plain object`));
    seen.delete(value);
    return;
  }
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && (typeof descriptor.get === 'function' || typeof descriptor.set === 'function')) {
      errors.push(error('ACCESSOR_FIELD', `${path}.${key}`, `${path}.${key} must be data-only`));
      continue;
    }
    assertJsonSafe(value[key], `${path}.${key}`, errors, seen);
  }
  seen.delete(value);
}

function cloneJson(value) {
  const errors = [];
  assertJsonSafe(value, '$', errors);
  if (errors.length) throw new DurabilityContractError('DURABILITY_JSON_UNSAFE', 'Value is not JSON-safe', errors);
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item, seen);
  return value;
}

function validateRef(value, path, errors, required = false) {
  if (value == null) {
    if (required) errors.push(error('MISSING_REFERENCE', path, `${path} is required`));
    return;
  }
  if (!isPlainObject(value)) {
    errors.push(error('INVALID_REFERENCE', path, `${path} must be an object`));
    return;
  }
  if (!isNonEmptyString(value.id)) errors.push(error('INVALID_REFERENCE_ID', `${path}.id`, `${path}.id is required`));
  if (!isNonEmptyString(value.owner)) errors.push(error('INVALID_REFERENCE_OWNER', `${path}.owner`, `${path}.owner is required`));
  if (hasOwn(value, 'enterprise_id') && !isNonEmptyString(value.enterprise_id)) {
    errors.push(error('INVALID_REFERENCE_SCOPE', `${path}.enterprise_id`, `${path}.enterprise_id must be non-empty when present`));
  }
}

function validateReferenceEnvelope(envelope, errors) {
  if (!isPlainObject(envelope)) {
    errors.push(error('INVALID_ENVELOPE', '$', 'Envelope must be a plain object'));
    return;
  }
  for (const key of Object.keys(envelope)) {
    if (!REFERENCE_CORE_FIELDS.includes(key)) {
      errors.push(error('UNKNOWN_CORE_FIELD', `$.${key}`, `Unknown core field is not durable-safe: ${key}`));
    }
  }
  for (const key of ['mission_id', 'goal_id', 'task_id', 'capability_id', 'correlation_id', 'trace_id', 'state', 'kernel_version']) {
    if (!isNonEmptyString(envelope[key])) errors.push(error('MISSING_CORE_FIELD', `$.${key}`, `${key} is required`));
  }
  if (!Kernel.STATES.includes(envelope.state)) {
    errors.push(error('UNKNOWN_KERNEL_STATE', '$.state', `Unknown kernel state: ${envelope.state}`));
  }
  if (!Array.isArray(envelope.state_history) || envelope.state_history.length === 0) {
    errors.push(error('MISSING_STATE_HISTORY', '$.state_history', 'state_history is required'));
  } else {
    const last = envelope.state_history[envelope.state_history.length - 1];
    if (last?.state !== envelope.state) {
      errors.push(error('STATE_HISTORY_MISMATCH', '$.state_history', 'state_history last state must match envelope.state'));
    }
    for (const item of envelope.state_history) {
      if (!Kernel.STATES.includes(item?.state)) {
        errors.push(error('UNKNOWN_STATE_HISTORY_ITEM', '$.state_history', 'state_history contains unknown state'));
      }
    }
  }
  if (!Array.isArray(envelope.execution_attempts)) {
    errors.push(error('INVALID_ATTEMPTS', '$.execution_attempts', 'execution_attempts must be an array'));
  }
  if (!Array.isArray(envelope.evidence_refs)) {
    errors.push(error('INVALID_EVIDENCE_REFS', '$.evidence_refs', 'evidence_refs must be an array'));
  }
  if (!Array.isArray(envelope.provenance_refs)) {
    errors.push(error('INVALID_PROVENANCE_REFS', '$.provenance_refs', 'provenance_refs must be an array'));
  } else if (envelope.provenance_refs.some(item => item?.owner && item.owner !== '13-evidence-runtime')) {
    errors.push(error('WRONG_PROVENANCE_OWNER', '$.provenance_refs', 'Provenance owner must remain Evidence Runtime'));
  }
}

function validateDurability(envelope, errors) {
  const durability = envelope.durability;
  if (!isPlainObject(durability)) {
    errors.push(error('MISSING_DURABILITY', '$.durability', 'durability extension is required for durable admission'));
    return;
  }
  for (const key of Object.keys(durability)) {
    if (!DURABILITY_ALLOWED_FIELDS.includes(key)) {
      errors.push(error('UNKNOWN_DURABILITY_FIELD', `$.durability.${key}`, `Unknown durability field: ${key}`));
    }
  }
  for (const key of DURABILITY_REQUIRED_FIELDS) {
    if (!hasOwn(durability, key)) errors.push(error('MISSING_DURABILITY_FIELD', `$.durability.${key}`, `${key} is required`));
  }
  if (durability.schema_version !== SCHEMA_VERSION) {
    errors.push(error('UNSUPPORTED_SCHEMA_VERSION', '$.durability.schema_version', `schema_version must be ${SCHEMA_VERSION}`));
  }
  if (!Number.isSafeInteger(durability.revision) || durability.revision < 0) {
    errors.push(error('INVALID_REVISION', '$.durability.revision', 'revision must be a non-negative safe integer'));
  }
  if (typeof durability.dispatch_started !== 'boolean') {
    errors.push(error('INVALID_DISPATCH_MARKER', '$.durability.dispatch_started', 'dispatch_started must be boolean'));
  }
  if (!Object.values(EFFECT_CERTAINTY).includes(durability.effect_certainty)) {
    errors.push(error('INVALID_EFFECT_CERTAINTY', '$.durability.effect_certainty', 'effect_certainty is invalid'));
  }
  for (const key of ['run_id', 'transition_id', 'transition_phase', 'effect_operation_id', 'idempotency_ref', 'evidence_commit_ref', 'intent_digest']) {
    if (!isNonEmptyString(durability[key])) {
      errors.push(error('INVALID_DURABILITY_ID', `$.durability.${key}`, `${key} must be a non-empty string`));
    }
  }
  if (envelope.execution_attempts?.length > 0 && !isNonEmptyString(durability.attempt_id)) {
    errors.push(error('MISSING_ATTEMPT_ID', '$.durability.attempt_id', 'attempt_id is required once attempts exist'));
  }
  validateRef(durability.authority_ref, '$.durability.authority_ref', errors);
  validateRef(durability.lease_ref, '$.durability.lease_ref', errors);
  validateRef(durability.readback_ref, '$.durability.readback_ref', errors);
  validateRef(durability.verification_ref, '$.durability.verification_ref', errors);
  validateRef(durability.outcome_ref, '$.durability.outcome_ref', errors);
  validateRef(durability.recovery_ref, '$.durability.recovery_ref', errors);
  validateRef(durability.human_control_ref, '$.durability.human_control_ref', errors);
  if (durability.extensions != null && !isPlainObject(durability.extensions)) {
    errors.push(error('INVALID_EXTENSION_NAMESPACE', '$.durability.extensions', 'extensions must be an object'));
  }
  if (durability.dispatch_started && !isNonEmptyString(durability.attempt_id)) {
    errors.push(error('MISSING_ATTEMPT_ID', '$.durability.attempt_id', 'attempt_id is required once dispatch started'));
  }
  if (envelope.state === 'RECOVERY_REQUIRED' && !durability.recovery_ref) {
    errors.push(error('MISSING_RECOVERY_REF', '$.durability.recovery_ref', 'recovery_ref is required for recovery state'));
  }
}

function validateEnvelope(envelope, options = {}) {
  const mode = options.mode || 'reference';
  const errors = [];
  assertJsonSafe(envelope, '$', errors);
  if (!errors.length) {
    validateReferenceEnvelope(envelope, errors);
    if (mode === 'durable') validateDurability(envelope, errors);
  }
  return { valid: errors.length === 0, errors, mode };
}

function extendCanonicalEnvelope(envelope, durability) {
  const reference = validateEnvelope(envelope, { mode: 'reference' });
  if (!reference.valid) {
    throw new DurabilityContractError('REFERENCE_ENVELOPE_INVALID', 'Cannot extend invalid canonical envelope', reference.errors);
  }
  const next = cloneJson(envelope);
  next.durability = cloneJson(durability);
  const durable = validateEnvelope(next, { mode: 'durable' });
  if (!durable.valid) {
    throw new DurabilityContractError('DURABLE_ENVELOPE_INVALID', 'Durable extension is invalid', durable.errors);
  }
  return deepFreeze(next);
}

function classifyDurableField(path) {
  const normalized = String(path || '').replace(/^\$\.?/, '');
  if (/^(state|state_history|timestamps|durability|execution_intent|execution_attempts|effect_declaration|expected_effect|evidence_refs|provenance_refs|verification_result|outcome|recovery_state|authority_decision|authority_lease|actor_identity|principal|represented_principal|agent|executor|capability_id|tool|trace_id|correlation_id)/.test(normalized)) {
    return DURABLE_FIELD_CLASSIFICATION.MUST_PERSIST;
  }
  if (/^(capability|preflight_result|actual_reality_readback|organization_context)/.test(normalized)) {
    return DURABLE_FIELD_CLASSIFICATION.MAY_RECONSTRUCT;
  }
  if (/^(process|pid|socket|timer|callback|abort_controller|decrypted|secret|credential)/.test(normalized)) {
    return DURABLE_FIELD_CLASSIFICATION.EPHEMERAL_ONLY;
  }
  return DURABLE_FIELD_CLASSIFICATION.UNKNOWN;
}

function identityTuple(envelope) {
  return {
    enterprise_id: String(envelope.organization_context?.enterprise_id || envelope.represented_principal?.id || ''),
    capability_id: String(envelope.capability_id || ''),
    canonical_effect: String(envelope.effect_declaration?.canonicalEffect || ''),
    effect_operation_id: String(envelope.durability?.effect_operation_id || ''),
    idempotency_ref: String(envelope.durability?.idempotency_ref || ''),
    intent_digest: String(envelope.durability?.intent_digest || ''),
  };
}

function compareOperationIdentity(a, b) {
  const ea = identityTuple(a || {});
  const eb = identityTuple(b || {});
  const sameScope = ea.enterprise_id === eb.enterprise_id && ea.capability_id === eb.capability_id && ea.canonical_effect === eb.canonical_effect;
  const sameOperation = sameScope && ea.effect_operation_id === eb.effect_operation_id && ea.idempotency_ref === eb.idempotency_ref && ea.intent_digest === eb.intent_digest;
  const conflict = sameScope && (
    (ea.idempotency_ref && ea.idempotency_ref === eb.idempotency_ref && ea.intent_digest !== eb.intent_digest)
    || (ea.effect_operation_id && ea.effect_operation_id === eb.effect_operation_id && ea.idempotency_ref !== eb.idempotency_ref)
  );
  return {
    valid: sameOperation && !conflict,
    relation: sameOperation ? 'SAME_OPERATION' : conflict ? 'CONFLICT' : 'DISTINCT_OPERATION',
    executionAllowed: false,
    verifiedEffect: false,
  };
}

function freshAuthorizationValid(envelope, context, now) {
  const auth = context.current_authorization;
  const durability = envelope.durability || {};
  if (!isPlainObject(auth)) return { valid: false, reason: 'CURRENT_AUTHORIZATION_MISSING' };
  if (auth.decision !== 'ALLOW') return { valid: false, reason: 'CURRENT_AUTHORIZATION_NOT_ALLOW' };
  if (!['READY', 'DEGRADED'].includes(auth.preflight_status)) return { valid: false, reason: 'CURRENT_PREFLIGHT_NOT_READY' };
  for (const key of ['resume_id', 'run_id', 'enterprise_id', 'actor_identity_id', 'principal_id', 'represented_principal_id', 'agent_id', 'executor_id', 'capability_id', 'tool_id', 'effect_operation_id']) {
    if (!isNonEmptyString(auth[key])) return { valid: false, reason: `CURRENT_AUTHORIZATION_${key.toUpperCase()}_MISSING` };
  }
  if (auth.resume_id !== context.resume_id) return { valid: false, reason: 'CURRENT_AUTHORIZATION_RESUME_MISMATCH' };
  if (auth.run_id !== durability.run_id) return { valid: false, reason: 'CURRENT_AUTHORIZATION_RUN_MISMATCH' };
  if (auth.effect_operation_id !== durability.effect_operation_id) return { valid: false, reason: 'CURRENT_AUTHORIZATION_EFFECT_MISMATCH' };
  if (auth.enterprise_id !== String(envelope.organization_context?.enterprise_id || envelope.represented_principal?.id || '')) return { valid: false, reason: 'CURRENT_AUTHORIZATION_SCOPE_MISMATCH' };
  if (auth.actor_identity_id !== envelope.actor_identity?.id || auth.principal_id !== envelope.principal?.id
    || auth.represented_principal_id !== envelope.represented_principal?.id || auth.agent_id !== envelope.agent?.id
    || auth.executor_id !== envelope.executor?.id || auth.tool_id !== envelope.tool?.id || auth.capability_id !== envelope.capability_id) {
    return { valid: false, reason: 'CURRENT_AUTHORIZATION_BINDING_MISMATCH' };
  }
  const checkedAt = Date.parse(auth.checked_at || '');
  const resumeStarted = Date.parse(context.resume_started_at || '');
  const nowMs = Date.parse(now);
  if (!Number.isFinite(checkedAt) || !Number.isFinite(resumeStarted) || checkedAt < resumeStarted || checkedAt > nowMs) {
    return { valid: false, reason: 'CURRENT_AUTHORIZATION_NOT_FRESH' };
  }
  const leaseResult = Kernel.validateAuthorityLease(auth.lease, envelope, now);
  if (!leaseResult.valid) return { valid: false, reason: leaseResult.reason };
  return { valid: true, reason: 'CURRENT_AUTHORIZATION_VALID' };
}

function baseDecision(decision, reasons, extra = {}) {
  return deepFreeze({
    decision,
    reasons: [...reasons],
    executionAllowed: false,
    admissionGranted: decision === DECISIONS.CONTINUE_SAFE,
    businessOutcome: 'UNDETERMINED',
    ...extra,
  });
}

function decideResume(envelope, context = {}) {
  const now = String(context.now || new Date(0).toISOString());
  const durable = validateEnvelope(envelope, { mode: 'durable' });
  if (!durable.valid) {
    return baseDecision(DECISIONS.TERMINAL_FAILURE, durable.errors.map(item => item.code), { requiredGates: Object.freeze(['MANUAL_REVIEW']) });
  }
  const readAuthorized = context.access?.read_authorized === true
    && context.access?.enterprise_id === String(envelope.organization_context?.enterprise_id || envelope.represented_principal?.id || '');
  if (!readAuthorized) {
    return baseDecision(DECISIONS.REAUTHORIZE, ['READ_AUTHORIZATION_REQUIRED'], { requiredGates: Object.freeze(['CURRENT_READ_AUTHORITY']) });
  }
  if (context.checkpoint && (context.checkpoint.integrity_valid !== true || context.checkpoint.writer_protocol_valid !== true)) {
    return baseDecision(DECISIONS.TERMINAL_FAILURE, ['CHECKPOINT_INTEGRITY_OR_WRITER_PROTOCOL_INVALID'], { requiredGates: Object.freeze(['MANUAL_REVIEW']) });
  }
  if (context.human?.required === true || context.human?.conflict === true || context.risk === 'HIGH') {
    return baseDecision(DECISIONS.HUMAN_CONFIRMATION_REQUIRED, ['HUMAN_CONTROL_REQUIRED'], { requiredGates: Object.freeze(['HUMAN_CONTROL']) });
  }
  const certainty = context.effect?.certainty || envelope.durability.effect_certainty;
  const effectFresh = context.effect?.fresh === true && context.effect?.independent === true;
  if (certainty === EFFECT_CERTAINTY.UNKNOWN || envelope.durability.dispatch_started && !effectFresh) {
    return baseDecision(DECISIONS.READBACK_FIRST, ['EFFECT_CERTAINTY_UNKNOWN'], { requiredGates: Object.freeze(['AUTHORITATIVE_READBACK']) });
  }
  const hasEvidence = context.evidence?.complete === true && context.evidence?.integrity_valid === true;
  const verification = context.verification || {};
  if (hasEvidence && verification.status !== 'VERIFIED') {
    return baseDecision(DECISIONS.VERIFY_FIRST, ['INDEPENDENT_VERIFICATION_REQUIRED'], { requiredGates: Object.freeze(['VERIFICATION']) });
  }
  const recovery = context.recovery || {};
  const recoveryNeeded = envelope.state === 'RECOVERY_REQUIRED' || envelope.recovery_state?.status === 'RECOVERING' || recovery.resolved === false;
  if (recoveryNeeded && !(certainty === EFFECT_CERTAINTY.NOT_OCCURRED && recovery.action === 'RETRY' && recovery.retry_safe === true && Number(recovery.budget_remaining) > 0 && recovery.evidence_ref)) {
    return baseDecision(DECISIONS.RECOVERY_REQUIRED, ['RECOVERY_PLAN_REQUIRED'], { requiredGates: Object.freeze(['RECOVERY_DECISION']) });
  }
  const auth = freshAuthorizationValid(envelope, context, now);
  const wantsWrite = context.action !== 'READ' && (envelope.state === 'EXECUTION_PENDING' || envelope.state === 'EXECUTING' || recovery.action === 'RETRY' || context.action === 'WRITE');
  if (wantsWrite && !auth.valid) {
    return baseDecision(DECISIONS.REAUTHORIZE, [auth.reason], { requiredGates: Object.freeze(['IDENTITY', 'AUTHORITY', 'LEASE', 'CAPABILITY', 'PREFLIGHT']) });
  }
  const terminalVerified = envelope.state === 'OUTCOME_RECORDED' && envelope.outcome?.verified === true;
  if (terminalVerified || context.action === 'READ') {
    return baseDecision(DECISIONS.CONTINUE_SAFE, ['READ_OR_FINALIZATION_ONLY'], { allowedNextAction: 'READ_OR_FINALIZE_OUTCOME', requiredGates: Object.freeze(['CURRENT_READ_AUTHORITY']) });
  }
  if (envelope.durability.dispatch_started === false && envelope.execution_attempts.length === 0 && auth.valid) {
    return baseDecision(DECISIONS.CONTINUE_SAFE, ['FIRST_DISPATCH_ADMISSION_AFTER_FRESH_GATES'], { allowedNextAction: 'DISPATCH_AFTER_FINAL_BOUNDARY_RECHECK', requiredGates: Object.freeze(['EXECUTION_BOUNDARY_RECHECK']) });
  }
  if (certainty === EFFECT_CERTAINTY.NOT_OCCURRED && recovery.action === 'RETRY' && recovery.retry_safe === true && Number(recovery.budget_remaining) > 0 && recovery.evidence_ref && auth.valid) {
    return baseDecision(DECISIONS.CONTINUE_SAFE, ['RETRY_AFTER_PROVEN_NOT_OCCURRED_AND_FRESH_GATES'], { allowedNextAction: 'DISPATCH_RETRY_AFTER_FINAL_BOUNDARY_RECHECK', requiredGates: Object.freeze(['EXECUTION_BOUNDARY_RECHECK']) });
  }
  return baseDecision(DECISIONS.RECOVERY_REQUIRED, ['NO_SAFE_RESUME_RULE_MATCHED'], { requiredGates: Object.freeze(['RECOVERY_DECISION']) });
}

function validateAdapter(kind, adapter) {
  const requirements = {
    [ADAPTER_KINDS.EVIDENCE]: ['append', 'load', 'link', 'validateIntegrity'],
    [ADAPTER_KINDS.RECOVERY]: ['createOrReference', 'appendDecision', 'load', 'resolve'],
    [ADAPTER_KINDS.HUMAN]: ['request', 'recordDecision', 'load'],
    [ADAPTER_KINDS.DURABLE_STORE]: ['load', 'compareAndSet', 'appendTransition', 'markPendingLink'],
  };
  const required = requirements[kind] || [];
  const missing = required.filter(name => typeof adapter?.[name] !== 'function');
  return {
    valid: missing.length === 0,
    kind,
    missing,
    shapeOnly: true,
    durabilityVerified: false,
  };
}

function validateEvidenceReceipt(receipt, envelope) {
  const errors = [];
  if (!isPlainObject(receipt)) errors.push(error('INVALID_EVIDENCE_RECEIPT', '$', 'receipt must be an object'));
  if (!errors.length) {
    if (receipt.owner !== '13-evidence-runtime') errors.push(error('WRONG_EVIDENCE_OWNER', '$.owner', 'Evidence owner must be 13-evidence-runtime'));
    if (!isNonEmptyString(receipt.evidence_id)) errors.push(error('MISSING_EVIDENCE_ID', '$.evidence_id', 'evidence_id is required'));
    if (receipt.durability_ack !== true) errors.push(error('MISSING_DURABILITY_ACK', '$.durability_ack', 'durability_ack must be true'));
    if (!isNonEmptyString(receipt.integrity_ref)) errors.push(error('MISSING_INTEGRITY_REF', '$.integrity_ref', 'integrity_ref is required'));
    if (receipt.run_id !== envelope.durability?.run_id) errors.push(error('EVIDENCE_RUN_MISMATCH', '$.run_id', 'run_id must match envelope'));
    if (receipt.effect_operation_id !== envelope.durability?.effect_operation_id) errors.push(error('EVIDENCE_EFFECT_MISMATCH', '$.effect_operation_id', 'effect_operation_id must match envelope'));
    if (receipt.enterprise_id !== String(envelope.organization_context?.enterprise_id || envelope.represented_principal?.id || '')) errors.push(error('EVIDENCE_SCOPE_MISMATCH', '$.enterprise_id', 'enterprise scope must match envelope'));
  }
  return { valid: errors.length === 0, errors };
}

function validateHumanDecision(decision, envelope, context = {}) {
  const errors = [];
  if (!isPlainObject(decision)) errors.push(error('INVALID_HUMAN_DECISION', '$', 'decision must be an object'));
  if (!errors.length) {
    for (const key of ['decision_id', 'request_id', 'decision_maker_id', 'rationale', 'decided_at', 'evidence_ref']) {
      if (!isNonEmptyString(decision[key])) errors.push(error('MISSING_HUMAN_DECISION_FIELD', `$.${key}`, `${key} is required`));
    }
    if (!['APPROVE_READBACK', 'APPROVE_VERIFY', 'APPROVE_RETRY_RECOMMENDATION', 'DENY', 'PAUSE', 'CANCEL'].includes(decision.action)) {
      errors.push(error('INVALID_HUMAN_ACTION', '$.action', 'human action is outside the bounded contract'));
    }
    if (decision.enterprise_id !== String(envelope.organization_context?.enterprise_id || envelope.represented_principal?.id || '')) {
      errors.push(error('HUMAN_SCOPE_MISMATCH', '$.enterprise_id', 'enterprise scope must match envelope'));
    }
    if (decision.run_id !== envelope.durability?.run_id) errors.push(error('HUMAN_RUN_MISMATCH', '$.run_id', 'run_id must match envelope'));
    if (context.now && Date.parse(decision.expires_at || '') <= Date.parse(context.now)) {
      errors.push(error('HUMAN_DECISION_EXPIRED', '$.expires_at', 'human decision is expired'));
    }
  }
  return { valid: errors.length === 0, errors, executionAllowed: false };
}

module.exports = {
  SCHEMA_VERSION,
  DECISIONS,
  EFFECT_CERTAINTY,
  DURABLE_FIELD_CLASSIFICATION,
  ADAPTER_KINDS,
  DurabilityContractError,
  validateEnvelope,
  extendCanonicalEnvelope,
  classifyDurableField,
  decideResume,
  compareOperationIdentity,
  validateAdapter,
  validateEvidenceReceipt,
  validateHumanDecision,
};
