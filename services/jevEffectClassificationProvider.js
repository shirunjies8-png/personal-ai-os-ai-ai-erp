'use strict';

const crypto = require('node:crypto');
const Core = require('../realityos-core');
const {
  OWNERS,
  VERIFICATION_STATUS,
} = require('./realityosDurableLinkageService');

const CLASSIFIER_SCHEMA_VERSION = 'jev-effect-classification-provider-v1';
const EFFECT_TAXONOMY_OWNER = '11-effect-runtime';
const MODEL_RUNTIME_OWNER = '08-model-intelligence-runtime';
const AUTHORITY_OWNER = '04-authority';
const LOW_CONFIDENCE_THRESHOLD = 0.7;

const INVARIANTS = Object.freeze([
  'MODEL_OUTPUT_IS_EVIDENCE_NOT_AUTHORITY',
  'PROBABILISTIC_CLASSIFIER_NEVER_GRANTS_AUTHORITY',
  'CONFIDENCE_NEVER_REPLACES_POLICY',
  'EFFECT_TAXONOMY_OWNER_REMAINS_EFFECT_RUNTIME',
  'JEV_PROVIDER_IS_REPLACEABLE',
  'JEV_OUTPUT_REQUIRES_SCHEMA_VALIDATION',
  'JEV_OUTPUT_REQUIRES_PROVENANCE',
  'LOW_CONFIDENCE_FAILS_SAFE',
  'PROVIDER_UNAVAILABLE_FAILS_SAFE',
  'MALFORMED_OUTPUT_FAILS_SAFE',
  'PHYSICAL_EFFECT_CLASSIFICATION_NEVER_AUTHORIZES_PHYSICAL_EXECUTION',
  'FINANCIAL_EFFECT_CLASSIFICATION_NEVER_AUTHORIZES_FINANCIAL_EXECUTION',
  'PROVIDER_SUCCESS_IS_NOT_BUSINESS_SUCCESS',
  'CLASSIFIER_CONFLICT_CANNOT_BYPASS_EFFECT_GOVERNANCE',
  'JEV_REMOVAL_DOES_NOT_BREAK_KERNEL',
]);

function nowIso(clock) {
  const value = typeof clock === 'function' ? clock() : new Date();
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function digest(value) {
  return crypto.createHash('sha256').update(json(value)).digest('hex');
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEffectClass(value) {
  return Core.EFFECT_CLASSES.includes(String(value || '').toUpperCase())
    ? String(value).toUpperCase()
    : 'UNKNOWN';
}

function validateProbabilityDistribution(distribution, selectedCandidate, errors) {
  if (!isPlainObject(distribution)) {
    errors.push({ code: 'INVALID_PROBABILITY_DISTRIBUTION', field: 'probability_distribution' });
    return;
  }
  let total = 0;
  for (const [key, value] of Object.entries(distribution)) {
    if (!Core.EFFECT_CLASSES.includes(key)) errors.push({ code: 'NON_CANONICAL_EFFECT_CLASS', field: `probability_distribution.${key}` });
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      errors.push({ code: 'INVALID_PROBABILITY_VALUE', field: `probability_distribution.${key}` });
    } else {
      total += value;
    }
  }
  if (total <= 0 || total > 1.000001) errors.push({ code: 'INVALID_PROBABILITY_TOTAL', total });
  if (!Object.prototype.hasOwnProperty.call(distribution, selectedCandidate)) {
    errors.push({ code: 'SELECTED_CANDIDATE_NOT_IN_DISTRIBUTION', selectedCandidate });
  }
}

function validateProviderOutput(output, request) {
  const errors = [];
  if (!isPlainObject(output)) errors.push({ code: 'OUTPUT_NOT_OBJECT' });
  const result = isPlainObject(output) ? output : {};
  for (const field of ['provider_id', 'provider_version', 'model_id', 'model_version', 'classifier_schema_version', 'inference_id']) {
    if (!nonEmpty(result[field])) errors.push({ code: 'MISSING_REQUIRED_FIELD', field });
  }
  if (result.classifier_schema_version && result.classifier_schema_version !== CLASSIFIER_SCHEMA_VERSION) {
    errors.push({ code: 'UNSUPPORTED_CLASSIFIER_SCHEMA_VERSION', field: 'classifier_schema_version' });
  }
  const selectedCandidate = normalizeEffectClass(result.selected_candidate || result.candidate_effect_class);
  if (selectedCandidate === 'UNKNOWN' && !Core.EFFECT_CLASSES.includes(String(result.selected_candidate || result.candidate_effect_class || '').toUpperCase())) {
    errors.push({ code: 'INVALID_SELECTED_CANDIDATE', field: 'selected_candidate' });
  }
  validateProbabilityDistribution(result.probability_distribution, selectedCandidate, errors);
  if (typeof result.confidence !== 'number' || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) {
    errors.push({ code: 'INVALID_CONFIDENCE', field: 'confidence' });
  }
  if (!nonEmpty(result.input_hash) || result.input_hash !== request.input_hash) {
    errors.push({ code: 'INPUT_OUTPUT_BINDING_INVALID', field: 'input_hash' });
  }
  if (!nonEmpty(result.provider_status)) errors.push({ code: 'MISSING_PROVIDER_STATUS', field: 'provider_status' });
  if (!nonEmpty(result.parser_status)) errors.push({ code: 'MISSING_PARSER_STATUS', field: 'parser_status' });
  return {
    valid: errors.length === 0,
    errors,
    selectedCandidate,
  };
}

function buildRequest(input = {}, options = {}) {
  const normalizedSemanticInput = String(input.normalized_semantic_input || input.normalizedSemanticInput || input.action || '');
  if (!normalizedSemanticInput.trim()) {
    throw Object.assign(new Error('normalized semantic input is required'), { code: 'CLASSIFICATION_INPUT_REQUIRED' });
  }
  const inputRef = input.input_ref || input.inputRef || {};
  const inputHash = String(input.input_hash || input.inputHash || digest({ normalizedSemanticInput, inputRef }));
  return {
    request_id: String(input.request_id || input.requestId || `jev-classification:${inputHash.slice(0, 16)}`),
    run_id: String(input.run_id || input.runId || input.envelope?.durability?.run_id || ''),
    attempt_id: String(input.attempt_id || input.attemptId || input.envelope?.durability?.attempt_id || ''),
    input_ref: inputRef,
    normalized_semantic_input: normalizedSemanticInput,
    input_hash: inputHash,
    context_refs: Array.isArray(input.context_refs) ? input.context_refs : [],
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    classifier_schema_version: CLASSIFIER_SCHEMA_VERSION,
    created_at: nowIso(options.clock),
  };
}

function failSafeResult(request, reason, details = {}, options = {}) {
  const timestamp = nowIso(options.clock);
  return {
    status: 'FAIL_SAFE',
    candidate_effect_class: 'UNKNOWN',
    selected_candidate: 'UNKNOWN',
    confidence: 0,
    low_confidence: true,
    provider_status: details.provider_status || 'FAILED',
    parser_status: details.parser_status || 'NOT_USABLE',
    fallback_status: 'FAIL_SAFE_UNKNOWN',
    semantic_risk_signals: ['CLASSIFICATION_UNAVAILABLE', reason],
    verification_status: 'REJECTED',
    authority_decision: 'UNCHANGED',
    executionAllowed: false,
    authorityOwner: AUTHORITY_OWNER,
    effectTaxonomyOwner: EFFECT_TAXONOMY_OWNER,
    modelRuntimeOwner: MODEL_RUNTIME_OWNER,
    evidenceReceipt: null,
    verificationCase: null,
    request,
    failure: { reason, details },
    invariants: INVARIANTS,
    timestamp,
  };
}

function createEvidencePayload(request, output, validation, options = {}) {
  const selected = validation.selectedCandidate;
  const lowConfidence = output.low_confidence === true || output.confidence < (options.lowConfidenceThreshold || LOW_CONFIDENCE_THRESHOLD);
  return {
    provider_id: output.provider_id,
    provider_version: output.provider_version,
    model_id: output.model_id,
    model_version: output.model_version,
    classifier_schema_version: output.classifier_schema_version,
    inference_id: output.inference_id,
    request_id: request.request_id,
    run_id: request.run_id,
    attempt_id: request.attempt_id,
    input_ref: request.input_ref,
    input_hash: request.input_hash,
    candidate_effect_class: selected,
    selected_candidate: selected,
    probability_distribution: output.probability_distribution,
    confidence: output.confidence,
    low_confidence: lowConfidence,
    semantic_risk_signals: Array.isArray(output.semantic_risk_signals) ? output.semantic_risk_signals.map(String) : [],
    provider_status: String(output.provider_status),
    parser_status: String(output.parser_status),
    fallback_status: String(output.fallback_status || 'NONE'),
    timestamp: String(output.timestamp || nowIso(options.clock)),
    evidence_semantics: 'CLASSIFICATION_MODEL_INFERENCE_EVIDENCE',
    model_output_is_authority: false,
    executionAllowed: false,
    effect_taxonomy_owner: EFFECT_TAXONOMY_OWNER,
    model_runtime_owner: MODEL_RUNTIME_OWNER,
  };
}

function maybeRecordEvidence(linkageService, envelope, payload, options = {}) {
  if (!linkageService) return { receipt: null, verificationCase: null };
  const evidenceId = String(options.evidence_id || `evidence:jev-effect-classification:${payload.inference_id}`);
  const payloadHash = digest(payload);
  const receipt = linkageService.recordEvidenceReceipt({
    evidence_id: evidenceId,
    evidence_type: 'CLASSIFICATION_MODEL_INFERENCE_EVIDENCE',
    envelope,
    source_ref: {
      owner: MODEL_RUNTIME_OWNER,
      provider_id: payload.provider_id,
      model_id: payload.model_id,
      inference_id: payload.inference_id,
    },
    provenance_ref: {
      provider_id: payload.provider_id,
      provider_version: payload.provider_version,
      model_id: payload.model_id,
      model_version: payload.model_version,
      classifier_schema_version: payload.classifier_schema_version,
      input_hash: payload.input_hash,
      timestamp: payload.timestamp,
    },
    payload_ref: {
      kind: 'SANITIZED_CLASSIFICATION_OUTPUT',
      payload_hash: payloadHash,
      selected_candidate: payload.selected_candidate,
      confidence: payload.confidence,
      low_confidence: payload.low_confidence,
    },
    payload_hash: payloadHash,
    integrity_ref: `sha256:${payloadHash}`,
  });
  const verificationCase = linkageService.createVerificationCase({
    verification_id: String(options.verification_id || `verification:jev-effect-classification:${payload.inference_id}`),
    envelope,
    evidence_refs: [{ evidence_id: receipt.evidence_id, owner: OWNERS.EVIDENCE, enterprise_id: receipt.enterprise_id, integrity_ref: receipt.integrity_ref }],
    verifier_ref: { owner: OWNERS.VERIFICATION, type: 'JEV_EFFECT_CLASSIFICATION_SCHEMA_VERIFIER' },
    verification_policy_ref: {
      policy: 'JEV_OUTPUT_SCHEMA_AND_PROVENANCE_VALIDATION',
      schema_version: CLASSIFIER_SCHEMA_VERSION,
      authority_semantics: 'NO_AUTHORITY_GRANTED',
    },
    status: VERIFICATION_STATUS.VERIFIED,
    decision: payload.low_confidence ? 'USABLE_WITH_LOW_CONFIDENCE_FAIL_SAFE' : 'USABLE_AS_CLASSIFICATION_EVIDENCE',
    reason_ref: {
      taxonomy_valid: true,
      probability_distribution_valid: true,
      provenance_complete: true,
      input_output_binding_valid: true,
      confidence_is_not_authority: true,
    },
  });
  return { receipt, verificationCase };
}

async function classifyEffect(input = {}, options = {}) {
  const request = buildRequest(input, options);
  const provider = options.provider || input.provider;
  if (typeof provider !== 'function') {
    return failSafeResult(request, 'PROVIDER_UNAVAILABLE', { provider_status: 'UNAVAILABLE' }, options);
  }
  let output;
  try {
    output = await provider(request);
  } catch (err) {
    return failSafeResult(request, err?.code || 'PROVIDER_EXCEPTION', { message: String(err?.message || err), provider_status: 'EXCEPTION' }, options);
  }
  const validation = validateProviderOutput(output, request);
  if (!validation.valid) {
    return failSafeResult(request, 'MALFORMED_PROVIDER_OUTPUT', { errors: validation.errors, provider_status: output?.provider_status || 'MALFORMED', parser_status: output?.parser_status || 'ERROR' }, options);
  }
  const payload = createEvidencePayload(request, output, validation, options);
  const { receipt, verificationCase } = maybeRecordEvidence(options.linkageService, input.envelope, payload, options);
  return {
    status: 'CLASSIFICATION_EVIDENCE_RECORDED',
    candidate_effect_class: payload.candidate_effect_class,
    selected_candidate: payload.selected_candidate,
    probability_distribution: payload.probability_distribution,
    confidence: payload.confidence,
    low_confidence: payload.low_confidence,
    semantic_risk_signals: payload.semantic_risk_signals,
    provider_status: payload.provider_status,
    parser_status: payload.parser_status,
    fallback_status: payload.fallback_status,
    verification_status: verificationCase ? verificationCase.status : 'REFERENCE_VERIFIED',
    verification_decision: verificationCase ? verificationCase.decision : 'USABLE_AS_CLASSIFICATION_EVIDENCE',
    authority_decision: 'UNCHANGED',
    executionAllowed: false,
    authorityOwner: AUTHORITY_OWNER,
    effectTaxonomyOwner: EFFECT_TAXONOMY_OWNER,
    modelRuntimeOwner: MODEL_RUNTIME_OWNER,
    evidenceReceipt: receipt,
    verificationCase,
    evidencePayload: payload,
    request,
    invariants: INVARIANTS,
  };
}

function createDeterministicFixtureProvider(fixtures = {}, metadata = {}) {
  return async request => {
    const fixture = fixtures[request.normalized_semantic_input] || fixtures.default;
    if (!fixture) throw Object.assign(new Error('fixture output unavailable'), { code: 'PROVIDER_UNAVAILABLE' });
    const selected = normalizeEffectClass(fixture.selected_candidate || fixture.candidate_effect_class);
    return {
      provider_id: metadata.provider_id || 'jev-compatible-fixture-provider',
      provider_version: metadata.provider_version || 'fixture-1',
      model_id: metadata.model_id || 'jev-compatible-reference-fixture',
      model_version: metadata.model_version || 'fixture-model-1',
      classifier_schema_version: CLASSIFIER_SCHEMA_VERSION,
      inference_id: fixture.inference_id || `${request.request_id}:${selected}`,
      input_hash: request.input_hash,
      candidate_effect_class: selected,
      selected_candidate: selected,
      probability_distribution: fixture.probability_distribution || { [selected]: fixture.confidence ?? 1 },
      confidence: fixture.confidence ?? 1,
      low_confidence: fixture.low_confidence,
      semantic_risk_signals: fixture.semantic_risk_signals || [],
      provider_status: fixture.provider_status || 'SUCCESS',
      parser_status: fixture.parser_status || 'VALID',
      fallback_status: fixture.fallback_status || 'NONE',
      timestamp: fixture.timestamp || nowIso(metadata.clock),
    };
  };
}

function resolveClassifierConflict(input = {}) {
  const providerCandidate = normalizeEffectClass(input.providerCandidate || input.jevCandidate);
  const deterministicCandidate = normalizeEffectClass(input.deterministicCandidate || input.ruleCandidate);
  const conflict = providerCandidate !== deterministicCandidate;
  return {
    status: conflict ? 'CLASSIFIER_CONFLICT_REQUIRES_EFFECT_GOVERNANCE' : 'CLASSIFIER_AGREEMENT',
    providerCandidate,
    deterministicCandidate,
    selected_candidate: conflict ? 'UNKNOWN' : providerCandidate,
    conflict,
    policy: conflict ? 'UNKNOWN_OR_HUMAN_REVIEW' : 'CANDIDATE_RETAINED',
    reason: conflict ? 'CLASSIFIER_CONFLICT_CANNOT_BYPASS_EFFECT_GOVERNANCE' : 'CLASSIFIERS_AGREE',
    executionAllowed: false,
    effectTaxonomyOwner: EFFECT_TAXONOMY_OWNER,
    authorityDecision: 'UNCHANGED',
  };
}

module.exports = {
  CLASSIFIER_SCHEMA_VERSION,
  EFFECT_TAXONOMY_OWNER,
  MODEL_RUNTIME_OWNER,
  AUTHORITY_OWNER,
  LOW_CONFIDENCE_THRESHOLD,
  INVARIANTS,
  buildRequest,
  validateProviderOutput,
  classifyEffect,
  createDeterministicFixtureProvider,
  resolveClassifierConflict,
};
