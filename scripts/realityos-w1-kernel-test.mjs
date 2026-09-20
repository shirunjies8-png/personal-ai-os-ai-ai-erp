import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../realityos-core');
const governance = require('../registry/realityos-module-registry');
const Kernel = require('../services/realityosKernelService');

const fixedNow = '2026-09-20T10:00:00.000Z';
const clock = () => new Date(fixedNow);
let taskSequence = 0;

function baseInput(overrides = {}) {
  taskSequence += 1;
  return {
    mission_id: 'mission-w1-reference',
    goal_id: 'goal-prove-kernel',
    task_id: `task-w1-reference-${taskSequence}`,
    organization_context: { enterprise_id: 'enterprise-reference' },
    actor_identity: { id: 'identity-operator', source: 'REFERENCE_FIXTURE' },
    principal: { id: 'principal-operator', type: 'USER' },
    represented_principal: { id: 'enterprise-reference', type: 'ORGANIZATION' },
    authority_lease: {
      lease_id: 'lease-reference',
      status: 'ACTIVE',
      principal_id: 'principal-operator',
      represented_principal_id: 'enterprise-reference',
      capability_ids: ['reference.counter.increment'],
      agent_ids: ['agent-reference'],
      executor_ids: ['executor-reference'],
      tool_ids: ['tool-reference-counter'],
      canonical_effects: ['REFERENCE_COUNTER_INCREMENTED'],
      expires_at: '2026-09-20T10:30:00.000Z',
    },
    agent: { id: 'agent-reference' },
    executor: { id: 'executor-reference', capabilityId: 'reference.counter.increment' },
    capability_id: 'reference.counter.increment',
    tool: { id: 'tool-reference-counter', capabilityId: 'reference.counter.increment' },
    execution_intent: { operation: 'increment', amount: 1 },
    effect_declaration: {
      resource: 'reference.counter',
      verb: 'UPDATE',
      target: 'counter:w1-reference',
      purpose: 'KERNEL_CONFORMANCE',
      effectClass: 'PERSISTENT_LOCAL_MUTATION',
      canonicalEffect: 'REFERENCE_COUNTER_INCREMENTED',
    },
    authority_rules: [{
      id: 'rule-w1-reference',
      canonicalEffect: 'REFERENCE_COUNTER_INCREMENTED',
      decision: 'ALLOW',
      reason: 'Reference kernel effect is authorized for this lease.',
    }],
    execution_context: { actualPlacement: 'LOCAL_ONLY' },
    max_attempts: 1,
    ...overrides,
  };
}

function createHarness(options = {}) {
  const capabilityRegistry = new Core.CapabilityRegistry();
  capabilityRegistry.register({
    capabilityId: 'reference.counter.increment',
    name: 'Reference Counter Increment',
    category: 'kernel-conformance',
    dependencies: [{ dependencyId: 'reference-runtime', type: 'runtime', required: true, status: options.dependencyStatus || 'READY' }],
    dataPolicy: { classification: 'INTERNAL', requiredPlacement: 'LOCAL_ONLY', allowedPlacements: ['LOCAL_ONLY'] },
    readiness: options.capabilityReadiness || 'READY',
  });
  const reality = { value: 0 };
  const evidence = options.evidence || Kernel.createReferenceEvidenceRuntime();
  let calls = 0;
  const adapters = {
    clock,
    capability: { resolve: id => options.missingCapability ? null : capabilityRegistry.get(id) },
    executor: {
      async execute() {
        calls += 1;
        if (options.failFirst && calls === 1) {
          const error = new Error('Reference transient execution failure');
          error.code = 'REFERENCE_TRANSIENT_FAILURE';
          error.retry_safe = true;
          throw error;
        }
        reality.value += 1;
        return { status: 'SUCCESS', accepted: true, execution_only: true };
      },
    },
    reality: {
      async readback({ envelope, phase }) {
        if (phase === 'EXECUTION_FAILURE') return { status: reality.value === 0 ? 'NOT_OCCURRED' : 'OBSERVED', value: reality.value };
        if (options.missingReadback) return null;
        return {
          status: 'OBSERVED',
          value: reality.value,
          actual_effect: {
            observedResource: 'reference.counter',
            observedVerb: 'UPDATE',
            observedTarget: 'counter:w1-reference',
            observedEffectClass: 'PERSISTENT_LOCAL_MUTATION',
            canonicalEffect: options.divergedEffect ? 'WRONG_EFFECT' : envelope.expected_effect.canonicalEffect,
          },
        };
      },
    },
    evidence,
    verification: {
      async verify({ execution_result, reality_readback, evidence: evidenceRecord, effect_comparison }) {
        if (options.verificationFailure) return { status: 'FAILED', reason: 'REFERENCE_VERIFIER_REJECTED' };
        const verified = execution_result?.status === 'SUCCESS'
          && reality_readback?.value === 1
          && evidenceRecord?.owner === '13-evidence-runtime'
          && effect_comparison?.status === 'MATCH';
        return { verification_id: `verification-${calls}`, status: verified ? 'VERIFIED' : 'FAILED', reason: verified ? '' : 'REFERENCE_FACT_MISMATCH' };
      },
    },
    recovery: {
      async decide({ failure }) {
        return options.allowRetry && failure.retry_safe
          ? { action: 'RETRY', reason: 'REFERENCE_SAFE_RETRY', decided_by: '15-recovery-runtime' }
          : { action: 'STOP', reason: 'REFERENCE_STOP', decided_by: '15-recovery-runtime' };
      },
    },
    outcome: { async record({ outcome }) { return { recorded: true, status: outcome.status }; } },
  };
  return { adapters, evidence, getExecutionCalls: () => calls, getRealityValue: () => reality.value };
}

// Success reference path: execution success alone is insufficient; readback,
// Evidence Runtime and an independent verifier must all complete.
{
  const harness = createHarness();
  const result = await Kernel.runKernel(baseInput(), harness.adapters);
  assert.equal(result.state, 'OUTCOME_RECORDED');
  assert.equal(result.outcome.status, 'VERIFIED_SUCCESS');
  assert.equal(result.verification_result.status, 'VERIFIED');
  assert.equal(harness.getExecutionCalls(), 1);
  assert.equal(harness.getRealityValue(), 1);
  assert.ok(result.state_history.some(item => item.state === 'READBACK_PENDING'));
  assert.ok(result.state_history.some(item => item.state === 'EVIDENCE_PENDING'));
  assert.ok(result.state_history.some(item => item.state === 'VERIFICATION_PENDING'));
  assert.equal(result.represented_principal.id, 'enterprise-reference');
  assert.ok(result.provenance_refs.every(item => item.owner === '13-evidence-runtime'));
}

// Failure/recovery reference path: a safe pre-effect failure is recorded,
// then fresh authority + preflight are required before the second attempt.
{
  const harness = createHarness({ failFirst: true, allowRetry: true });
  const result = await Kernel.runKernel(baseInput({ max_attempts: 2 }), harness.adapters);
  assert.equal(result.state, 'OUTCOME_RECORDED');
  assert.equal(result.execution_attempts.length, 2);
  assert.equal(result.execution_attempts[0].status, 'FAILED');
  assert.equal(result.execution_attempts[1].status, 'SUCCESS');
  assert.equal(result.recovery_state.status, 'RECOVERED');
  assert.ok(result.state_history.filter(item => item.state === 'AUTHORITY_PENDING').length >= 2);
  assert.ok(harness.evidence.list(result.trace_id).some(item => item.type === 'RECOVERY_EVIDENCE'));
}

// Invariant: no authority, no execution.
{
  const harness = createHarness();
  const result = await Kernel.runKernel(baseInput({ authority_rules: [] }), harness.adapters);
  assert.equal(result.state, 'AUTHORITY_DENIED');
  assert.equal(harness.getExecutionCalls(), 0);
}

// Invariant: an expired lease blocks execution even when the policy rule allows it.
{
  const harness = createHarness();
  const input = baseInput();
  input.authority_lease = { ...input.authority_lease, expires_at: '2026-09-20T09:59:59.000Z' };
  const result = await Kernel.runKernel(input, harness.adapters);
  assert.equal(result.state, 'AUTHORITY_DENIED');
  assert.equal(result.outcome.reason, 'AUTHORITY_LEASE_EXPIRED');
  assert.equal(harness.getExecutionCalls(), 0);
}

// Invariant: missing capability and failed preflight both block execution.
{
  const missing = createHarness({ missingCapability: true });
  const missingResult = await Kernel.runKernel(baseInput(), missing.adapters);
  assert.equal(missingResult.state, 'PREFLIGHT_REJECTED');
  assert.equal(missing.getExecutionCalls(), 0);

  const blocked = createHarness({ dependencyStatus: 'BLOCKED' });
  const blockedResult = await Kernel.runKernel(baseInput(), blocked.adapters);
  assert.equal(blockedResult.state, 'PREFLIGHT_REJECTED');
  assert.equal(blocked.getExecutionCalls(), 0);
}

// Invariant: execution success cannot self-certify a verified outcome.
{
  const harness = createHarness({ verificationFailure: true });
  const result = await Kernel.runKernel(baseInput(), harness.adapters);
  assert.equal(result.state, 'TERMINAL_FAILURE');
  assert.equal(result.outcome.execution_success, true);
  assert.equal(result.outcome.verified, false);
}

// Invariant: an effect requires authoritative readback and verification requires canonical evidence.
{
  const noReadback = createHarness({ missingReadback: true });
  const noReadbackResult = await Kernel.runKernel(baseInput(), noReadback.adapters);
  assert.equal(noReadbackResult.state, 'TERMINAL_FAILURE');
  assert.equal(noReadbackResult.outcome.code, 'AUTHORITATIVE_READBACK_MISSING');

  const invalidEvidence = { owner: 'parallel-evidence-owner', record: () => ({ evidence_id: 'wrong', owner: 'parallel-evidence-owner' }) };
  const noEvidence = createHarness({ evidence: invalidEvidence });
  const noEvidenceResult = await Kernel.runKernel(baseInput(), noEvidence.adapters);
  assert.equal(noEvidenceResult.state, 'TERMINAL_FAILURE');
  assert.equal(noEvidenceResult.outcome.code, 'EVIDENCE_INSUFFICIENT');
}

// Invariant: invalid transitions fail closed.
{
  const envelope = Kernel.createKernelEnvelope(baseInput(), clock);
  assert.throws(() => Kernel.transition(envelope, 'EXECUTING', 'BYPASS_GATES', clock), error => error.code === 'INVALID_STATE_TRANSITION');
}

// Governance invariants: W0 remains the source-of-truth map and Evidence Runtime
// remains the only canonical provenance owner.
{
  assert.equal(governance.modules.length, 21);
  assert.equal(governance.ownership.Provenance, '13-evidence-runtime');
  assert.equal(governance.ownership.Lineage, '13-evidence-runtime');
  const concepts = governance.modules.flatMap(module => module.sourceOfTruthFor);
  assert.equal(new Set(concepts).size, concepts.length);
}

// 13: INVALID_IDENTITY_BLOCKS_EXECUTION, including all bound identities.
for (const field of ['actor_identity', 'principal', 'represented_principal', 'agent', 'executor', 'tool']) {
  for (const malformed of [{}, { id: '' }, { id: 42 }, [], null, { id: '   ' }]) {
    const h = createHarness();
    const result = await Kernel.runKernel(baseInput({ [field]: malformed }), h.adapters);
    assert.equal(result.state, 'AUTHORITY_DENIED');
    assert.equal(h.getExecutionCalls(), 0);
  }
}

// 14: LEASE_MUST_BE_VALID_AT_EXECUTION_BOUNDARY; controlled time, no sleep.
{
  const h = createHarness();
  let now = fixedNow;
  h.adapters.clock = () => new Date(now);
  h.adapters.preflight = { async evaluate() { now = '2026-09-20T11:00:00.000Z'; return { status: 'READY' }; } };
  const result = await Kernel.runKernel(baseInput(), h.adapters);
  assert.equal(result.state, 'AUTHORITY_DENIED');
  assert.equal(h.getExecutionCalls(), 0);
}
for (const change of ['principal', 'authority']) {
  const h = createHarness();
  let allowed = true;
  h.adapters.authority = { async evaluate() { return { decision: allowed ? 'ALLOW' : 'DENY' }; } };
  h.adapters.preflight = { async evaluate({ envelope }) {
    if (change === 'principal') envelope.represented_principal.id = 'changed';
    else allowed = false;
    return { status: 'READY' };
  } };
  assert.equal((await Kernel.runKernel(baseInput(), h.adapters)).state, 'AUTHORITY_DENIED');
  assert.equal(h.getExecutionCalls(), 0);
}

// 15: CAPABILITY_BINDING_MISMATCH_BLOCKS_EXECUTION.
for (const field of ['resolved', 'executor', 'tool']) {
  const h = createHarness();
  const input = baseInput();
  if (field === 'resolved') {
    const resolve = h.adapters.capability.resolve;
    h.adapters.capability.resolve = id => ({ ...resolve(id), capabilityId: 'different' });
  } else input[field].capabilityId = 'different';
  const result = await Kernel.runKernel(input, h.adapters);
  assert.equal(result.outcome.code, 'CAPABILITY_BINDING_MISMATCH');
  assert.equal(h.getExecutionCalls(), 0);
}

// 16: RETRY_REQUIRES_PROVEN_NO_EFFECT; effect producer cannot certify safety.
{
  const h = createHarness({ allowRetry: true });
  let mutations = 0;
  h.adapters.executor.execute = async () => { mutations++; throw Object.assign(new Error('after effect'), { retry_safe: true }); };
  h.adapters.reality.readback = async () => ({ status: 'OBSERVED', value: mutations });
  const result = await Kernel.runKernel(baseInput({ max_attempts: 2 }), h.adapters);
  assert.equal(mutations, 1);
  assert.equal(result.execution_attempts.length, 1);
  assert.equal(result.state, 'TERMINAL_FAILURE');
}

// 17: RECOVERY_WITHOUT_EVIDENCE_CANNOT_RETRY, even with proven no effect.
{
  const h = createHarness({ failFirst: true, allowRetry: true });
  const record = h.adapters.evidence.record;
  h.adapters.evidence.record = input => input.stage === 'RECOVERY' ? null : record(input);
  const result = await Kernel.runKernel(baseInput({ max_attempts: 2 }), h.adapters);
  assert.equal(h.getExecutionCalls(), 1);
  assert.equal(result.state, 'TERMINAL_FAILURE');
  assert.equal(result.state_history.at(-1).reason, 'RECOVERY_EVIDENCE_INSUFFICIENT');
}

// 18: VERIFIER_EXCEPTION_CLOSES_LIFECYCLE with preserved error provenance.
{
  const h = createHarness();
  h.adapters.verification.verify = async () => { throw Object.assign(new Error('verifier unavailable'), { code: 'REFERENCE_VERIFIER_OUTAGE' }); };
  const result = await Kernel.runKernel(baseInput(), h.adapters);
  assert.equal(result.state, 'TERMINAL_FAILURE');
  assert.equal(result.outcome.code, 'VERIFIER_EXCEPTION');
  assert.equal(result.verification_result.status, 'ERROR');
  assert.ok(h.evidence.list(result.trace_id).some(item => item.payload.error?.code === 'REFERENCE_VERIFIER_OUTAGE'));
  assert.equal(h.getExecutionCalls(), 1);
}

console.log(JSON.stringify({
  universalKernelPath: 'VERIFIED_REFERENCE_PATH',
  successPath: 'PASS',
  failureRecoveryPath: 'PASS',
  invariants: 18,
  correctiveCounterexamples: 'PASS (6 groups plus boundary revocation/binding checks)',
  provenanceOwner: governance.ownership.Provenance,
  productCoupling: 'NONE',
}, null, 2));
console.log('realityos W1 kernel conformance tests passed');
