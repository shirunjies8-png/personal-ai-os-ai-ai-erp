import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Kernel = require('../services/realityosKernelService');
const W2 = require('../services/realityosKernelDurabilityContract');

const now = '2026-09-21T10:00:00.000Z';
const resumeStartedAt = '2026-09-21T09:59:00.000Z';
const future = '2026-09-21T10:30:00.000Z';
let taskSequence = 0;

function input(overrides = {}) {
  return {
    mission_id: 'mission-w2-contract',
    goal_id: 'goal-w2-durable-contract',
    task_id: `task-w2-${++taskSequence}`,
    organization_context: { enterprise_id: 'enterprise-w2' },
    actor_identity: { id: 'actor-w2' },
    principal: { id: 'principal-w2' },
    represented_principal: { id: 'enterprise-w2' },
    authority_lease: {
      lease_id: 'lease-w2',
      status: 'ACTIVE',
      principal_id: 'principal-w2',
      represented_principal_id: 'enterprise-w2',
      capability_ids: ['capability-w2'],
      agent_ids: ['agent-w2'],
      executor_ids: ['executor-w2'],
      tool_ids: ['tool-w2'],
      canonical_effects: ['W2_REFERENCE_EFFECT'],
      expires_at: future,
    },
    agent: { id: 'agent-w2' },
    executor: { id: 'executor-w2', capabilityId: 'capability-w2' },
    capability_id: 'capability-w2',
    tool: { id: 'tool-w2', capabilityId: 'capability-w2' },
    execution_intent: { operation: 'contract-only' },
    effect_declaration: {
      resource: 'w2.contract',
      verb: 'UPDATE',
      target: 'w2:contract',
      purpose: 'W2_CONTRACT_TEST',
      effectClass: 'PERSISTENT_LOCAL_MUTATION',
      canonicalEffect: 'W2_REFERENCE_EFFECT',
    },
    ...overrides,
  };
}

function envelope(overrides = {}) {
  return Kernel.createKernelEnvelope(input(overrides), () => new Date(now));
}

function durability(overrides = {}) {
  return {
    schema_version: 1,
    run_id: 'run-w2',
    revision: 0,
    transition_id: 'transition-w2',
    transition_phase: 'BEFORE_ACTION',
    effect_operation_id: 'effect-op-w2',
    idempotency_ref: 'idem-w2',
    dispatch_started: false,
    effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
    evidence_commit_ref: 'evidence-commit-w2',
    intent_digest: 'intent-digest-w2',
    authority_ref: { id: 'authority-w2', owner: '04-authority', enterprise_id: 'enterprise-w2' },
    lease_ref: { id: 'lease-w2', owner: '04-authority', enterprise_id: 'enterprise-w2' },
    extensions: { note: 'opaque metadata preserved but not trusted' },
    ...overrides,
  };
}

function durableEnvelope(durabilityOverrides = {}, envelopeOverrides = {}) {
  return W2.extendCanonicalEnvelope(envelope(envelopeOverrides), durability(durabilityOverrides));
}

function statefulEnvelope(state, durabilityOverrides = {}, envelopeOverrides = {}) {
  const e = envelope(envelopeOverrides);
  e.state = state;
  e.state_history.push({ state, at: now, reason: `TEST_${state}` });
  if (state === 'RECOVERY_REQUIRED') e.recovery_state = { status: 'RECOVERING', attempts: 1, history: [] };
  return W2.extendCanonicalEnvelope(e, durability(durabilityOverrides));
}

function currentAuthorization(overrides = {}) {
  return {
    resume_id: 'resume-w2',
    run_id: 'run-w2',
    enterprise_id: 'enterprise-w2',
    actor_identity_id: 'actor-w2',
    principal_id: 'principal-w2',
    represented_principal_id: 'enterprise-w2',
    agent_id: 'agent-w2',
    executor_id: 'executor-w2',
    capability_id: 'capability-w2',
    tool_id: 'tool-w2',
    effect_operation_id: 'effect-op-w2',
    decision: 'ALLOW',
    preflight_status: 'READY',
    checked_at: now,
    lease: {
      lease_id: 'lease-w2-current',
      status: 'ACTIVE',
      principal_id: 'principal-w2',
      represented_principal_id: 'enterprise-w2',
      capability_ids: ['capability-w2'],
      agent_ids: ['agent-w2'],
      executor_ids: ['executor-w2'],
      tool_ids: ['tool-w2'],
      canonical_effects: ['W2_REFERENCE_EFFECT'],
      expires_at: future,
    },
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    now,
    resume_id: 'resume-w2',
    resume_started_at: resumeStartedAt,
    action: 'WRITE',
    access: { enterprise_id: 'enterprise-w2', read_authorized: true },
    checkpoint: { integrity_valid: true, writer_protocol_valid: true, revision: 0 },
    current_authorization: currentAuthorization(),
    effect: { certainty: W2.EFFECT_CERTAINTY.UNKNOWN, independent: false, fresh: false },
    evidence: { complete: false, integrity_valid: false },
    verification: { status: 'PENDING' },
    recovery: { resolved: true },
    ...overrides,
  };
}

function assertDecision(result, decision) {
  assert.equal(result.decision, decision);
  assert.equal(result.executionAllowed, false);
}

// Reference W1 envelopes remain readable reference data but are not durable-admissible.
{
  const ref = envelope();
  assert.equal(W2.validateEnvelope(ref, { mode: 'reference' }).valid, true);
  assert.equal(W2.validateEnvelope(ref, { mode: 'durable' }).valid, false);
  const decision = W2.decideResume(ref, context());
  assertDecision(decision, W2.DECISIONS.TERMINAL_FAILURE);
}

// Durable metadata is additive to the canonical W1 envelope; inputs are cloned and frozen.
{
  const ref = envelope();
  const durable = durability();
  const extended = W2.extendCanonicalEnvelope(ref, durable);
  assert.equal(extended.kernel_version, 'W1');
  assert.equal(extended.durability.schema_version, 1);
  assert.equal(Object.isFrozen(extended), true);
  assert.equal(Object.isFrozen(extended.state_history), true);
  assert.throws(() => extended.state_history.push({ state: 'CREATED' }), TypeError);
  assert.equal(ref.durability, undefined);
  durable.run_id = 'mutated';
  assert.equal(extended.durability.run_id, 'run-w2');
  assert.equal(W2.validateEnvelope(extended, { mode: 'durable' }).valid, true);
}

// Version, revision, unknown durable field and unknown core field fail closed.
{
  assert.throws(() => W2.extendCanonicalEnvelope(envelope(), durability({ schema_version: 2 })), error => error.code === 'DURABLE_ENVELOPE_INVALID');
  assert.throws(() => W2.extendCanonicalEnvelope(envelope(), durability({ revision: -1 })), error => error.code === 'DURABLE_ENVELOPE_INVALID');
  assert.throws(() => W2.extendCanonicalEnvelope(envelope(), { ...durability(), hidden_authority: true }), error => error.code === 'DURABLE_ENVELOPE_INVALID');
  const withUnknownCore = { ...envelope(), secondEnvelope: true };
  assert.equal(W2.validateEnvelope(withUnknownCore, { mode: 'reference' }).valid, false);
}

// Durable field classification separates persisted, reconstructable and ephemeral values.
{
  for (const field of [
    'state',
    'state_history',
    'durability.effect_certainty',
    'durability.run_id',
    'durability.attempt_id',
    'durability.authority_ref',
    'durability.evidence_commit_ref',
    'execution_intent',
    'effect_declaration',
    'durability.effect_operation_id',
    'verification_result',
    'recovery_state',
    'durability.human_control_ref',
  ]) {
    assert.equal(W2.classifyDurableField(field), W2.DURABLE_FIELD_CLASSIFICATION.MUST_PERSIST, `${field} must persist`);
  }
  assert.equal(W2.classifyDurableField('capability'), W2.DURABLE_FIELD_CLASSIFICATION.MAY_RECONSTRUCT);
  assert.equal(W2.classifyDurableField('process.pid'), W2.DURABLE_FIELD_CLASSIFICATION.EPHEMERAL_ONLY);
}

// UNKNOWN or untrusted dispatch marker always routes to readback first; it never allows execution.
{
  const e = durableEnvelope({ dispatch_started: true, attempt_id: 'attempt-w2', effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN });
  const decision = W2.decideResume(e, context());
  assertDecision(decision, W2.DECISIONS.READBACK_FIRST);
  assert.ok(decision.requiredGates.includes('AUTHORITATIVE_READBACK'));
}

// Authority/preflight evidence alone cannot trigger verification; effect evidence must be complete.
{
  const e = durableEnvelope({ effect_certainty: W2.EFFECT_CERTAINTY.OBSERVED, dispatch_started: true, attempt_id: 'attempt-w2' });
  const decision = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.OBSERVED, independent: true, fresh: true },
    evidence: { complete: false, integrity_valid: false },
    recovery: { resolved: true },
  }));
  assertDecision(decision, W2.DECISIONS.RECOVERY_REQUIRED);
}

// Complete evidence without independent verification yields VERIFY_FIRST, not outcome success.
{
  const e = durableEnvelope({ effect_certainty: W2.EFFECT_CERTAINTY.OBSERVED, dispatch_started: true, attempt_id: 'attempt-w2' });
  const decision = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.OBSERVED, independent: true, fresh: true },
    evidence: { complete: true, integrity_valid: true },
    verification: { status: 'PENDING' },
    recovery: { resolved: true },
  }));
  assertDecision(decision, W2.DECISIONS.VERIFY_FIRST);
}

// A first dispatch is admissible only after fresh current authorization and final boundary recheck remains required.
{
  const e = durableEnvelope({ effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, dispatch_started: false });
  const decision = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    recovery: { resolved: true },
  }));
  assertDecision(decision, W2.DECISIONS.CONTINUE_SAFE);
  assert.equal(decision.allowedNextAction, 'DISPATCH_AFTER_FINAL_BOUNDARY_RECHECK');
  assert.ok(decision.requiredGates.includes('EXECUTION_BOUNDARY_RECHECK'));
}

// Stale, expired, or mismatched current authority cannot admit a write.
{
  const e = durableEnvelope({ effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, dispatch_started: false });
  const stale = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    current_authorization: currentAuthorization({ checked_at: '2026-09-21T09:58:59.000Z' }),
  }));
  assertDecision(stale, W2.DECISIONS.REAUTHORIZE);
  const expired = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    current_authorization: currentAuthorization({ lease: { ...currentAuthorization().lease, expires_at: '2026-09-21T09:59:59.000Z' } }),
  }));
  assertDecision(expired, W2.DECISIONS.REAUTHORIZE);
  const changedPrincipal = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    current_authorization: currentAuthorization({ represented_principal_id: 'other-enterprise' }),
  }));
  assertDecision(changedPrincipal, W2.DECISIONS.REAUTHORIZE);
  const changedCapability = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    current_authorization: currentAuthorization({ capability_id: 'different-capability' }),
  }));
  assertDecision(changedCapability, W2.DECISIONS.REAUTHORIZE);
  const stalePreflight = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    current_authorization: currentAuthorization({ preflight_status: 'STALE' }),
  }));
  assertDecision(stalePreflight, W2.DECISIONS.REAUTHORIZE);
}

// Retry after executor entry requires proven NOT_OCCURRED, recovery evidence, budget and fresh gates.
{
  const e = durableEnvelope({ dispatch_started: true, attempt_id: 'attempt-w2', effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED });
  const decision = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    recovery: { resolved: false, action: 'RETRY', retry_safe: true, evidence_ref: 'evidence-recovery', budget_remaining: 1 },
  }));
  assertDecision(decision, W2.DECISIONS.CONTINUE_SAFE);
  assert.equal(decision.allowedNextAction, 'DISPATCH_RETRY_AFTER_FINAL_BOUNDARY_RECHECK');

  const missingEvidence = W2.decideResume(e, context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    recovery: { resolved: false, action: 'RETRY', retry_safe: true, budget_remaining: 1 },
  }));
  assertDecision(missingEvidence, W2.DECISIONS.RECOVERY_REQUIRED);
}

// Human requirement or scope conflicts stop automatic admission.
{
  const e = durableEnvelope({ effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED });
  const decision = W2.decideResume(e, context({ human: { required: true } }));
  assertDecision(decision, W2.DECISIONS.HUMAN_CONFIRMATION_REQUIRED);
}

// Read-only or terminal verified finalization may continue but still never dispatches execution from this contract.
{
  const terminal = envelope();
  terminal.state = 'OUTCOME_RECORDED';
  terminal.state_history.push({ state: 'OUTCOME_RECORDED', at: now, reason: 'TEST_FINALIZED' });
  terminal.outcome = { verified: true };
  const e = W2.extendCanonicalEnvelope(terminal, durability({ effect_certainty: W2.EFFECT_CERTAINTY.OBSERVED }));
  const decision = W2.decideResume(e, context({
    action: 'READ',
    effect: { certainty: W2.EFFECT_CERTAINTY.OBSERVED, independent: true, fresh: true },
    evidence: { complete: true, integrity_valid: true },
    verification: { status: 'VERIFIED' },
  }));
  assertDecision(decision, W2.DECISIONS.CONTINUE_SAFE);
  assert.equal(decision.executionAllowed, false);
}

// Idempotency binds scope, operation, key and intent; duplicate keys do not verify effects.
{
  const a = durableEnvelope();
  const same = durableEnvelope();
  assert.deepEqual(W2.compareOperationIdentity(a, same), {
    valid: true,
    relation: 'SAME_OPERATION',
    executionAllowed: false,
    verifiedEffect: false,
  });
  const conflict = durableEnvelope({ intent_digest: 'different-intent' });
  assert.equal(W2.compareOperationIdentity(a, conflict).relation, 'CONFLICT');
  const duplicateButUnknown = W2.decideResume(same, context({ effect: { certainty: W2.EFFECT_CERTAINTY.UNKNOWN, independent: false, fresh: false } }));
  assertDecision(duplicateButUnknown, W2.DECISIONS.READBACK_FIRST);
}

// Nine crash/resume boundaries are tested through real decision inputs, not name checks.
{
  const firstDispatchContext = context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    recovery: { resolved: true },
  });
  const authorized = W2.decideResume(statefulEnvelope('AUTHORIZED', { effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED }), firstDispatchContext);
  assertDecision(authorized, W2.DECISIONS.CONTINUE_SAFE);
  assert.equal(authorized.allowedNextAction, 'DISPATCH_AFTER_FINAL_BOUNDARY_RECHECK');
  assert.ok(authorized.requiredGates.includes('EXECUTION_BOUNDARY_RECHECK'));

  const preflight = W2.decideResume(statefulEnvelope('PREFLIGHT_PASSED', { effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED }), firstDispatchContext);
  assertDecision(preflight, W2.DECISIONS.CONTINUE_SAFE);
  assert.ok(preflight.requiredGates.includes('EXECUTION_BOUNDARY_RECHECK'));

  const executionPending = W2.decideResume(statefulEnvelope('EXECUTION_PENDING', { effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED }), context({
    ...firstDispatchContext,
    current_authorization: currentAuthorization({ checked_at: '2026-09-21T09:58:59.000Z' }),
  }));
  assertDecision(executionPending, W2.DECISIONS.REAUTHORIZE);

  const executing = W2.decideResume(statefulEnvelope('EXECUTING', {
    dispatch_started: true,
    attempt_id: 'attempt-w2',
    effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
  }), context());
  assertDecision(executing, W2.DECISIONS.READBACK_FIRST);

  const effectUnknown = W2.decideResume(statefulEnvelope('EFFECT_UNCONFIRMED', {
    dispatch_started: true,
    attempt_id: 'attempt-w2',
    effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
  }), context());
  assertDecision(effectUnknown, W2.DECISIONS.READBACK_FIRST);

  const readbackPending = W2.decideResume(statefulEnvelope('READBACK_PENDING', {
    dispatch_started: true,
    attempt_id: 'attempt-w2',
    effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
  }), context());
  assertDecision(readbackPending, W2.DECISIONS.READBACK_FIRST);

  const evidencePending = W2.decideResume(statefulEnvelope('EVIDENCE_PENDING', {
    dispatch_started: true,
    attempt_id: 'attempt-w2',
    effect_certainty: W2.EFFECT_CERTAINTY.OBSERVED,
  }), context({
    effect: { certainty: W2.EFFECT_CERTAINTY.OBSERVED, independent: true, fresh: true },
    evidence: { complete: false, integrity_valid: false },
    recovery: { resolved: true },
  }));
  assertDecision(evidencePending, W2.DECISIONS.RECOVERY_REQUIRED);

  const verificationPending = W2.decideResume(statefulEnvelope('VERIFICATION_PENDING', {
    dispatch_started: true,
    attempt_id: 'attempt-w2',
    effect_certainty: W2.EFFECT_CERTAINTY.OBSERVED,
  }), context({
    effect: { certainty: W2.EFFECT_CERTAINTY.OBSERVED, independent: true, fresh: true },
    evidence: { complete: true, integrity_valid: true },
    verification: { status: 'PENDING' },
    recovery: { resolved: true },
  }));
  assertDecision(verificationPending, W2.DECISIONS.VERIFY_FIRST);

  const recoveryRequired = W2.decideResume(statefulEnvelope('RECOVERY_REQUIRED', {
    dispatch_started: true,
    attempt_id: 'attempt-w2',
    effect_certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED,
    recovery_ref: { id: 'recovery-w2', owner: '15-recovery-runtime', enterprise_id: 'enterprise-w2' },
  }), context({
    effect: { certainty: W2.EFFECT_CERTAINTY.NOT_OCCURRED, independent: true, fresh: true },
    verification: { status: 'VERIFIED' },
    recovery: { resolved: false, action: 'STOP', retry_safe: false, evidence_ref: 'evidence-recovery', budget_remaining: 1 },
  }));
  assertDecision(recoveryRequired, W2.DECISIONS.RECOVERY_REQUIRED);
}

// Adapter validation is shape-only, not a durability proof.
{
  const goodEvidence = {
    append() {},
    load() {},
    link() {},
    validateIntegrity() {},
  };
  const result = W2.validateAdapter(W2.ADAPTER_KINDS.EVIDENCE, goodEvidence);
  assert.equal(result.valid, true);
  assert.equal(result.shapeOnly, true);
  assert.equal(result.durabilityVerified, false);
  assert.equal(W2.validateAdapter(W2.ADAPTER_KINDS.RECOVERY, { load() {} }).valid, false);
}

// Evidence owner, scope and durable acknowledgment are mandatory.
{
  const e = durableEnvelope();
  const receipt = {
    owner: '13-evidence-runtime',
    evidence_id: 'evidence-w2',
    durability_ack: true,
    integrity_ref: 'sha256:abc',
    run_id: 'run-w2',
    effect_operation_id: 'effect-op-w2',
    enterprise_id: 'enterprise-w2',
  };
  assert.equal(W2.validateEvidenceReceipt(receipt, e).valid, true);
  assert.equal(W2.validateEvidenceReceipt({ ...receipt, owner: '04-authority' }, e).valid, false);
}

// Human decisions are bounded, scoped and auditable; they cannot directly allow execution.
{
  const e = durableEnvelope();
  const decision = {
    decision_id: 'human-decision-w2',
    request_id: 'human-request-w2',
    decision_maker_id: 'admin-w2',
    action: 'APPROVE_RETRY_RECOMMENDATION',
    rationale: 'Evidence reviewed; still requires kernel gates.',
    decided_at: now,
    expires_at: future,
    evidence_ref: 'evidence-human',
    enterprise_id: 'enterprise-w2',
    run_id: 'run-w2',
  };
  const result = W2.validateHumanDecision(decision, e, { now });
  assert.equal(result.valid, true);
  assert.equal(result.executionAllowed, false);
  assert.equal(W2.validateHumanDecision({ ...decision, action: 'APPROVE_EXECUTE' }, e, { now }).valid, false);
}

console.log(JSON.stringify({
  schemaVersion: W2.SCHEMA_VERSION,
  durableEnvelopeCompatibility: 'PASS',
  resumeAdmissionBranches: 'PASS',
  idempotencyBoundary: 'PASS',
  adapterInterfaces: 'PASS',
  evidenceOwner: '13-evidence-runtime',
  executionAllowedFromContract: false,
}, null, 2));
console.log('realityos W2 durable contract tests passed');
