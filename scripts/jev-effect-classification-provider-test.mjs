import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import Core from '../realityos-core.js';
import W2 from '../services/realityosKernelDurabilityContract.js';
import {
  OWNERS,
  RealityOSDurableLinkageService,
} from '../services/realityosDurableLinkageService.js';
import {
  AUTHORITY_OWNER,
  CLASSIFIER_SCHEMA_VERSION,
  EFFECT_TAXONOMY_OWNER,
  INVARIANTS,
  classifyEffect,
  createDeterministicFixtureProvider,
  resolveClassifierConflict,
} from '../services/jevEffectClassificationProvider.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-jev-effect-classification-'));
const dbPath = path.join(root, 'jev-effect.sqlite3');

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function envelope(overrides = {}) {
  const base = {
    kernel_version: 'W1',
    mission_id: 'mission-jev',
    goal_id: 'goal-jev',
    task_id: 'task-jev',
    organization_context: { enterprise_id: 'enterprise-jev', workspace_id: 'workspace-jev' },
    actor_identity: { id: 'actor-jev', owner: '01-identity' },
    principal: { id: 'principal-jev', owner: '01-identity' },
    represented_principal: { id: 'enterprise-jev', owner: '02-organization' },
    authority_decision: { decision: 'UNKNOWN', owner: AUTHORITY_OWNER },
    authority_lease: {
      lease_id: 'lease-jev',
      status: 'VALID',
      principal_id: 'principal-jev',
      represented_principal_id: 'enterprise-jev',
      capability_ids: ['capability-jev'],
      agent_ids: ['agent-jev'],
      executor_ids: ['executor-jev'],
      tool_ids: ['tool-jev'],
      issued_at: '2026-09-23T00:00:00.000Z',
      expires_at: '2026-09-24T00:00:00.000Z',
    },
    agent: { id: 'agent-jev', owner: '06-agent-skill' },
    executor: { id: 'executor-jev', owner: '10-execution-runtime', capabilityId: 'capability-jev' },
    capability_id: 'capability-jev',
    capability: { capabilityId: 'capability-jev', owner: '07-tool-connector' },
    tool: { id: 'tool-jev', owner: '07-tool-connector', capabilityId: 'capability-jev' },
    preflight_result: { status: 'READY' },
    execution_intent: { operation: 'jev-effect-classification-reference-only' },
    execution_attempts: [],
    effect_declaration: { effectClass: 'OBSERVATION', canonicalEffect: 'classify:semantic-effect', owner: EFFECT_TAXONOMY_OWNER },
    expected_effect: { effectClass: 'OBSERVATION', canonicalEffect: 'classify:semantic-effect' },
    actual_reality_readback: null,
    evidence_refs: [],
    provenance_refs: [],
    verification_result: { status: 'PENDING' },
    outcome: { verified: false },
    recovery_state: {},
    timestamps: { created_at: '2026-09-23T00:00:00.000Z' },
    correlation_id: 'corr-jev',
    trace_id: 'trace-jev',
    state: 'EVIDENCE_PENDING',
    state_history: [{ state: 'EVIDENCE_PENDING', at: '2026-09-23T00:00:00.000Z' }],
    extensions: {},
  };
  const durability = {
    schema_version: W2.SCHEMA_VERSION,
    run_id: 'run-jev',
    attempt_id: 'attempt-jev-0',
    revision: 0,
    transition_id: 'transition-jev-0',
    transition_phase: 'CLASSIFICATION_EVIDENCE',
    effect_operation_id: 'effect-op-jev',
    idempotency_ref: 'idem-jev',
    dispatch_started: false,
    effect_certainty: W2.EFFECT_CERTAINTY.UNKNOWN,
    evidence_commit_ref: 'evidence-commit-jev',
    intent_digest: sha({ operation: 'jev-effect-classification-reference-only' }),
    authority_ref: { id: 'authority-jev', owner: AUTHORITY_OWNER, enterprise_id: 'enterprise-jev' },
    lease_ref: { id: 'lease-jev', owner: AUTHORITY_OWNER, enterprise_id: 'enterprise-jev' },
    verification_ref: { id: 'verification-jev-pending', owner: OWNERS.VERIFICATION, enterprise_id: 'enterprise-jev' },
    human_control_ref: { id: 'human-control-jev-placeholder', owner: '17-human-control', enterprise_id: 'enterprise-jev' },
    extensions: { adapter: 'jev-effect-classification-provider-adapter-candidate' },
  };
  return W2.extendCanonicalEnvelope({ ...base, ...overrides.envelope }, { ...durability, ...overrides.durability });
}

function distribution(selected, confidence) {
  return { [selected]: confidence, UNKNOWN: Number((1 - confidence).toFixed(4)) };
}

const fixtures = {
  read_machine_status: {
    selected_candidate: 'OBSERVATION',
    confidence: 0.98,
    probability_distribution: distribution('OBSERVATION', 0.98),
  },
  change_machine_parameter: {
    selected_candidate: 'PHYSICAL_EFFECT',
    confidence: 0.999,
    probability_distribution: distribution('PHYSICAL_EFFECT', 0.999),
    semantic_risk_signals: ['PHYSICAL_EFFECT'],
  },
  'transfer 10000 to supplier': {
    selected_candidate: 'FINANCIAL_EFFECT',
    confidence: 0.97,
    probability_distribution: distribution('FINANCIAL_EFFECT', 0.97),
    semantic_risk_signals: ['FINANCIAL_EFFECT'],
  },
  'send customer an email': {
    selected_candidate: 'COMMUNICATION',
    confidence: 0.94,
    probability_distribution: distribution('COMMUNICATION', 0.94),
  },
  'run this deployment script': {
    selected_candidate: 'CODE_EXECUTION',
    confidence: 0.93,
    probability_distribution: distribution('CODE_EXECUTION', 0.93),
  },
  'handle this for me': {
    selected_candidate: 'UNKNOWN',
    confidence: 0.36,
    low_confidence: true,
    probability_distribution: { UNKNOWN: 0.36, OBSERVATION: 0.34, LOCAL_TRANSFORM: 0.30 },
  },
};

const provider = createDeterministicFixtureProvider(fixtures, {
  provider_id: 'jev-compatible-fixture-provider',
  provider_version: 'candidate-1',
  model_id: 'jev-reference-fixture',
  model_version: 'candidate-model-1',
});

async function classify(action, options = {}) {
  return classifyEffect({
    normalized_semantic_input: action,
    input_ref: { kind: 'REFERENCE_ACTION', action },
    envelope: options.envelope || envelope(),
    request_id: options.request_id || `request:${action}`,
  }, { provider, ...options });
}

const db = new Database(dbPath);
const linkage = new RealityOSDurableLinkageService(db, { clock: () => new Date('2026-09-23T00:00:00.000Z') });

const readOnly = await classify('read_machine_status', { linkageService: linkage });
assert.equal(readOnly.candidate_effect_class, 'OBSERVATION');
assert.equal(readOnly.executionAllowed, false);
assert.equal(readOnly.authority_decision, 'UNCHANGED');
assert.equal(readOnly.evidenceReceipt.owner, OWNERS.EVIDENCE);
assert.equal(readOnly.verificationCase.status, 'VERIFIED');

const physical = await classify('change_machine_parameter');
assert.equal(physical.candidate_effect_class, 'PHYSICAL_EFFECT');
assert.equal(physical.executionAllowed, false);
assert.equal(physical.authority_decision, 'UNCHANGED');

const financial = await classify('transfer 10000 to supplier');
assert.equal(financial.candidate_effect_class, 'FINANCIAL_EFFECT');
assert.equal(financial.executionAllowed, false);

const communication = await classify('send customer an email');
assert.equal(communication.candidate_effect_class, 'COMMUNICATION');
assert.equal(communication.executionAllowed, false);

const code = await classify('run this deployment script');
assert.equal(code.candidate_effect_class, 'CODE_EXECUTION');
assert.equal(code.executionAllowed, false);

const ambiguous = await classify('handle this for me');
assert.equal(ambiguous.low_confidence, true);
assert.equal(ambiguous.executionAllowed, false);
assert.equal(ambiguous.candidate_effect_class, 'UNKNOWN');

const timeout = await classifyEffect({
  normalized_semantic_input: 'provider timeout',
  input_ref: { kind: 'REFERENCE_ACTION', action: 'provider timeout' },
  envelope: envelope(),
}, {
  provider: async () => { throw Object.assign(new Error('provider timeout'), { code: 'PROVIDER_TIMEOUT' }); },
});
assert.equal(timeout.status, 'FAIL_SAFE');
assert.equal(timeout.candidate_effect_class, 'UNKNOWN');
assert.equal(timeout.executionAllowed, false);

const malformed = await classifyEffect({
  normalized_semantic_input: 'bad provider schema',
  input_ref: { kind: 'REFERENCE_ACTION', action: 'bad provider schema' },
  envelope: envelope(),
}, {
  provider: async request => ({
    provider_id: 'jev-compatible-fixture-provider',
    provider_version: 'candidate-1',
    model_id: 'jev-reference-fixture',
    model_version: 'candidate-model-1',
    classifier_schema_version: CLASSIFIER_SCHEMA_VERSION,
    inference_id: 'bad-schema',
    input_hash: request.input_hash,
    selected_candidate: 'JEV_PHYSICAL',
    candidate_effect_class: 'JEV_PHYSICAL',
    probability_distribution: { JEV_PHYSICAL: 1 },
    confidence: 1,
    provider_status: 'SUCCESS',
    parser_status: 'VALID',
  }),
});
assert.equal(malformed.status, 'FAIL_SAFE');
assert.equal(malformed.candidate_effect_class, 'UNKNOWN');
assert.equal(malformed.executionAllowed, false);

const denyDespiteConfidence = await classify('change_machine_parameter');
const authorityDecision = Core.evaluateEffectAuthority({
  effectRequest: Core.createEffectRequest({ effectClass: denyDespiteConfidence.candidate_effect_class, canonicalEffect: 'machine:parameter:update', verb: 'UPDATE', resource: 'machine', target: 'parameter' }),
  rules: [{ effectClass: 'PHYSICAL_EFFECT', decision: 'DENY', reason: 'FIXTURE_POLICY_DENY' }],
});
assert.equal(denyDespiteConfidence.confidence > 0.99, true);
assert.equal(authorityDecision.decision, 'DENY');
assert.equal(denyDespiteConfidence.executionAllowed, false);

const perfectPhysical = await classifyEffect({
  normalized_semantic_input: 'perfect physical confidence',
  input_ref: { kind: 'REFERENCE_ACTION', action: 'perfect physical confidence' },
  envelope: envelope(),
}, {
  provider: createDeterministicFixtureProvider({
    'perfect physical confidence': {
      selected_candidate: 'PHYSICAL_EFFECT',
      confidence: 1,
      probability_distribution: { PHYSICAL_EFFECT: 1 },
    },
  }),
});
assert.equal(perfectPhysical.candidate_effect_class, 'PHYSICAL_EFFECT');
assert.equal(perfectPhysical.confidence, 1);
assert.equal(perfectPhysical.executionAllowed, false);

const conflict = resolveClassifierConflict({ providerCandidate: 'FINANCIAL_EFFECT', deterministicCandidate: 'OBSERVATION' });
assert.equal(conflict.conflict, true);
assert.equal(conflict.selected_candidate, 'UNKNOWN');
assert.equal(conflict.executionAllowed, false);

assert.ok(INVARIANTS.includes('MODEL_OUTPUT_IS_EVIDENCE_NOT_AUTHORITY'));
assert.ok(INVARIANTS.includes('JEV_REMOVAL_DOES_NOT_BREAK_KERNEL'));

db.close();
const reloadDb = new Database(dbPath);
const reloadedLinkage = new RealityOSDurableLinkageService(reloadDb);
const receipt = reloadedLinkage.loadEvidenceReceipt(readOnly.evidenceReceipt.evidence_id, 'enterprise-jev');
assert.equal(Boolean(receipt), true);
assert.equal(receipt.receipt.owner, OWNERS.EVIDENCE);
assert.equal(receipt.receipt.provenance_ref.provider_id, 'jev-compatible-fixture-provider');
assert.equal(receipt.receipt.provenance_ref.model_id, 'jev-reference-fixture');
assert.equal(receipt.receipt.provenance_ref.classifier_schema_version, CLASSIFIER_SCHEMA_VERSION);
const verification = reloadedLinkage.loadVerificationCase(readOnly.verificationCase.verification_id, 'enterprise-jev');
assert.equal(verification.status, 'VERIFIED');
assert.equal(verification.decision, 'USABLE_AS_CLASSIFICATION_EVIDENCE');
assert.equal(verification.reason_ref.confidence_is_not_authority, true);
reloadDb.close();

console.log(JSON.stringify({
  JEV_PROVIDER_ADAPTER_CONTRACT: 'VERIFIED',
  REAL_JEV_PROVIDER_RUNTIME_INTEGRATED: 'NO',
  RUNTIME_CONTRACT_VERIFIED: 'PASS',
  DURABLE_EVIDENCE_VERIFIED: 'PASS',
  REFERENCE_INTEGRATION_VERIFIED: 'PASS',
  STATIC_GOVERNANCE_VERIFIED: 'PASS',
  REAL_EFFECT_EXECUTION: 'NO',
  DEPENDENCY_CHANGE_REQUIRED: 'NO',
  EXTERNAL_NETWORK_REQUIRED: 'NO',
}, null, 2));
