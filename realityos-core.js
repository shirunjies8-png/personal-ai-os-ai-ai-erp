(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RealityOSCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  const READINESS_STATES = Object.freeze(['DECLARED', 'RESOLVED', 'READY', 'DEGRADED', 'BLOCKED', 'UNAVAILABLE']);
  const DEPENDENCY_TYPES = Object.freeze(['runtime', 'package', 'credential', 'service', 'network', 'filesystem', 'device', 'model']);
  const CLASSIFICATIONS = Object.freeze(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SENSITIVE', 'UNKNOWN']);
  const PLACEMENTS = Object.freeze(['LOCAL_ONLY', 'ON_PREMISE', 'CONTROLLED_SERVER', 'EXTERNAL', 'UNKNOWN']);
  const EFFECT_CLASSES = Object.freeze(['OBSERVATION', 'LOCAL_TRANSFORM', 'PERSISTENT_LOCAL_MUTATION', 'PERSISTENT_EXTERNAL_MUTATION', 'COMMUNICATION', 'CODE_EXECUTION', 'FINANCIAL_EFFECT', 'PHYSICAL_EFFECT', 'UNKNOWN']);
  const EFFECT_VERBS = Object.freeze(['READ', 'CREATE', 'UPDATE', 'DELETE', 'SEND', 'UPLOAD', 'EXECUTE', 'MOVE', 'APPROVE', 'POST', 'UNKNOWN']);
  const AUTHORITY_DECISIONS = Object.freeze(['ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'UNKNOWN']);
  const EFFECT_COMPARISON_STATUSES = Object.freeze(['MATCH', 'DIVERGED', 'UNKNOWN']);

  const now = () => new Date().toISOString();
  const asUpper = (value, fallback = 'UNKNOWN') => String(value || fallback).trim().toUpperCase();
  const asArray = value => Array.isArray(value) ? value.filter(item => item != null) : value == null ? [] : [value];
  const known = (set, value, fallback) => set.includes(value) ? value : fallback;
  const readyLike = value => asUpper(value) === 'READY';
  const blockedLike = value => ['BLOCKED', 'UNAVAILABLE'].includes(asUpper(value));
  const isHighRiskEffectClass = value => ['PERSISTENT_EXTERNAL_MUTATION', 'COMMUNICATION', 'CODE_EXECUTION', 'FINANCIAL_EFFECT', 'PHYSICAL_EFFECT'].includes(asUpper(value));
  const normalizePlacement = (value, fallback = 'UNKNOWN') => {
    const placement = asUpper(value, fallback);
    return known(PLACEMENTS, placement === 'LOCAL' ? 'LOCAL_ONLY' : placement, fallback);
  };

  function normalizeReadiness(value, fallback = 'DECLARED') {
    return known(READINESS_STATES, asUpper(value, fallback), fallback);
  }

  function createDependency(input = {}) {
    const status = normalizeReadiness(input.status || input.readiness || (input.available ? 'READY' : 'DECLARED'));
    return {
      dependencyId: String(input.dependencyId || input.id || input.name || ''),
      type: DEPENDENCY_TYPES.includes(String(input.type || 'service')) ? String(input.type || 'service') : 'service',
      required: input.required !== false,
      expectedVersion: String(input.expectedVersion || input.version || input.constraint || ''),
      constraint: String(input.constraint || input.expectedVersion || ''),
      resolvedVersion: String(input.resolvedVersion || input.actualVersion || ''),
      status,
      evidence: input.evidence || null,
      failureReason: String(input.failureReason || input.reason || ''),
      metadata: input.metadata || {},
    };
  }

  function normalizeDependencyList(dependencies = []) {
    return asArray(dependencies).map(item => typeof item === 'string'
      ? createDependency({ dependencyId: item, type: 'service', required: true, status: 'DECLARED' })
      : createDependency(item));
  }

  function summarizeDependencyStatus(dependencies = []) {
    const list = normalizeDependencyList(dependencies);
    const required = list.filter(item => item.required);
    const optional = list.filter(item => !item.required);
    if (required.some(item => blockedLike(item.status))) return 'BLOCKED';
    if (required.length && required.every(item => readyLike(item.status)) && optional.some(item => blockedLike(item.status))) return 'DEGRADED';
    if (required.length && required.every(item => readyLike(item.status))) return 'READY';
    if (list.some(item => asUpper(item.status) === 'RESOLVED')) return 'RESOLVED';
    return list.length ? 'DECLARED' : 'DECLARED';
  }

  function createDataPolicy(input = {}) {
    const classification = known(CLASSIFICATIONS, asUpper(input.classification || input.dataClassification, 'CONFIDENTIAL'), 'UNKNOWN');
    const requiredPlacement = normalizePlacement(input.requiredPlacement || input.placement, 'LOCAL_ONLY');
    const allowedPlacements = asArray(input.allowedPlacements?.length ? input.allowedPlacements : [requiredPlacement]).map(item => normalizePlacement(item));
    return {
      classification,
      requiredPlacement,
      allowedPlacements,
      externalUploadAllowed: Boolean(input.externalUploadAllowed),
      externalAIAllowed: Boolean(input.externalAIAllowed),
      telemetryPolicy: input.telemetryPolicy || { rawContentAllowed: false },
      retentionPolicy: input.retentionPolicy || { temporaryInput: 'DELETE_AFTER_TERMINAL_STATE' },
    };
  }

  function evaluateDataPolicy(policyInput = {}, executionInput = {}) {
    const policy = createDataPolicy(policyInput);
    const actualPlacement = normalizePlacement(executionInput.actualPlacement || executionInput.placement || policy.requiredPlacement);
    const externalUpload = Boolean(executionInput.externalUpload);
    const externalAI = Boolean(executionInput.externalAI);
    const blockingReasons = [];
    if (!policy.allowedPlacements.includes(actualPlacement)) blockingReasons.push('PLACEMENT_NOT_ALLOWED');
    if (policy.requiredPlacement !== 'UNKNOWN' && actualPlacement !== policy.requiredPlacement) blockingReasons.push('REQUIRED_PLACEMENT_MISMATCH');
    if (policy.classification === 'CONFIDENTIAL' && externalUpload && !policy.externalUploadAllowed) blockingReasons.push('CONFIDENTIAL_EXTERNAL_UPLOAD_BLOCKED');
    if (policy.classification === 'CONFIDENTIAL' && externalAI && !policy.externalAIAllowed) blockingReasons.push('CONFIDENTIAL_EXTERNAL_AI_BLOCKED');
    if (policy.classification === 'SENSITIVE' && (externalUpload || externalAI)) blockingReasons.push('SENSITIVE_EXTERNAL_EGRESS_BLOCKED');
    if (policy.classification === 'UNKNOWN') blockingReasons.push('UNKNOWN_CLASSIFICATION_FAIL_CLOSED');
    return {
      status: blockingReasons.length ? 'BLOCKED' : 'READY',
      policy,
      actualPlacement,
      externalUpload,
      externalAI,
      blockingReasons,
    };
  }

  function createCapability(input = {}) {
    const dependencies = normalizeDependencyList(input.dependencies || []);
    const dataPolicy = createDataPolicy(input.dataPolicy || input.inputPolicy || {});
    const readiness = normalizeReadiness(input.readiness || summarizeDependencyStatus(dependencies));
    return {
      capabilityId: String(input.capabilityId || input.id || ''),
      name: String(input.name || input.capabilityName || ''),
      category: String(input.category || 'generic'),
      providerIds: asArray(input.providerIds || input.providers).map(String),
      required: input.required !== false,
      dependencies,
      dataPolicy,
      readiness,
      health: input.health || null,
      version: String(input.version || '1'),
      metadata: input.metadata || {},
    };
  }

  class CapabilityRegistry {
    constructor() {
      this.capabilities = new Map();
    }
    register(input) {
      const capability = createCapability(input);
      if (!capability.capabilityId) throw new Error('capabilityId is required');
      this.capabilities.set(capability.capabilityId, capability);
      return capability;
    }
    get(capabilityId) {
      return this.capabilities.get(capabilityId) || null;
    }
    list() {
      return [...this.capabilities.values()].map(item => ({ ...item, dependencies: item.dependencies.map(dep => ({ ...dep })) }));
    }
  }

  function createProviderDescriptor(input = {}) {
    const readiness = normalizeReadiness(input.readiness || input.status || (input.available ? 'READY' : 'DECLARED'));
    const placement = normalizePlacement(input.placement || (input.supportsCloud ? 'EXTERNAL' : 'LOCAL_ONLY'));
    return {
      providerId: String(input.providerId || input.id || ''),
      providerName: String(input.providerName || input.name || ''),
      providerType: String(input.providerType || input.type || ''),
      version: String(input.version || input.providerVersion || ''),
      enabled: input.enabled !== false,
      readiness,
      available: input.available === true || readiness === 'READY',
      externalUpload: Boolean(input.externalUpload || input.supportsCloud),
      externalAI: Boolean(input.externalAI),
      placement,
      supportsLocal: input.supportsLocal !== false && placement !== 'EXTERNAL',
      supportsLayout: Boolean(input.supportsLayout),
      supportsChinese: input.supportsChinese !== false,
      routingPriority: Number(input.routingPriority || 0),
      dependencies: normalizeDependencyList(input.dependencies || []),
      metadata: input.metadata || {},
    };
  }

  function routeProvider(input = {}) {
    const requestedProvider = String(input.requestedProvider || input.providerId || 'auto');
    const candidateProviders = asArray(input.candidateProviders || input.providers).map(createProviderDescriptor);
    const allowFallback = input.allowFallback !== false;
    const policy = createDataPolicy(input.dataPolicy || input.inputPolicy || {});
    const requiresLayout = input.requiresLayout === true;
    const requiresChinese = input.requiresChinese !== false;
    const attempts = [];
    const compatible = provider => {
      const reasons = [];
      if (!provider.enabled) reasons.push('PROVIDER_DISABLED');
      if (requestedProvider !== 'auto' && provider.providerId !== requestedProvider) reasons.push('NOT_REQUESTED_PROVIDER');
      if (!readyLike(provider.readiness)) reasons.push('PROVIDER_NOT_READY');
      const policyResult = evaluateDataPolicy(policy, {
        actualPlacement: provider.placement,
        externalUpload: provider.externalUpload,
        externalAI: provider.externalAI,
      });
      reasons.push(...policyResult.blockingReasons);
      if (requiresLayout && !provider.supportsLayout) reasons.push('LAYOUT_NOT_SUPPORTED');
      if (requiresChinese && !provider.supportsChinese) reasons.push('CHINESE_NOT_SUPPORTED');
      return reasons;
    };
    const sorted = candidateProviders
      .filter(provider => requestedProvider === 'auto' || provider.providerId === requestedProvider)
      .sort((left, right) => right.routingPriority - left.routingPriority);
    for (const provider of sorted) {
      const reasons = compatible(provider);
      attempts.push({ providerId: provider.providerId, readiness: provider.readiness, result: reasons.length ? 'SKIPPED' : 'SELECTED', reason: reasons.join(';') });
      if (!reasons.length) {
        return {
          status: 'READY',
          requestedProvider,
          candidateProviders,
          allowFallback,
          selectedProvider: provider.providerId,
          actualProvider: provider.providerId,
          selectionReason: requestedProvider === 'auto' ? 'AUTO_READY_PROVIDER' : 'REQUESTED_PROVIDER_READY',
          attempts,
          policy,
        };
      }
      if (requestedProvider !== 'auto' || !allowFallback) break;
    }
    return {
      status: 'BLOCKED',
      requestedProvider,
      candidateProviders,
      allowFallback,
      selectedProvider: '',
      actualProvider: '',
      selectionReason: 'NO_PROVIDER_SATISFIES_POLICY',
      attempts,
      policy,
    };
  }

  function preflight(input = {}) {
    const capability = createCapability(input.capability || {});
    const providerReadiness = normalizeReadiness(input.providerReadiness || input.provider?.readiness || capability.readiness);
    const dependencyEvidence = normalizeDependencyList(input.requiredDependencies || capability.dependencies);
    const dependencyStatus = summarizeDependencyStatus(dependencyEvidence);
    const policyResult = evaluateDataPolicy(capability.dataPolicy, input.executionContext || {});
    const blockingReasons = [
      ...(blockedLike(dependencyStatus) ? ['REQUIRED_DEPENDENCY_BLOCKED'] : []),
      ...(blockedLike(providerReadiness) ? ['PROVIDER_NOT_READY'] : []),
      ...policyResult.blockingReasons,
    ];
    const warnings = [];
    if (dependencyStatus === 'DEGRADED') warnings.push('OPTIONAL_DEPENDENCY_DEGRADED');
    return {
      status: blockingReasons.length ? 'BLOCKED' : warnings.length ? 'DEGRADED' : 'READY',
      blockingReasons,
      warnings,
      dependencyEvidence,
      providerReadiness,
      policyResult,
    };
  }

  function createExecutionProvenance(input = {}) {
    return {
      executionId: String(input.executionId || input.requestId || ''),
      capabilityId: String(input.capabilityId || ''),
      requestedProvider: String(input.requestedProvider || ''),
      actualProvider: String(input.actualProvider || ''),
      providerVersion: String(input.providerVersion || ''),
      runtimeIdentity: input.runtimeIdentity || {},
      executionNode: String(input.executionNode || ''),
      executionPlacement: normalizePlacement(input.executionPlacement || input.placement, 'UNKNOWN'),
      inputIdentity: input.inputIdentity || {},
      outputIdentity: input.outputIdentity || {},
      fallbackUsed: Boolean(input.fallbackUsed),
      startedAt: input.startedAt || '',
      finishedAt: input.finishedAt || '',
      status: String(input.status || ''),
      evidenceRefs: asArray(input.evidenceRefs),
      runtimeMetadata: input.runtimeMetadata || {},
    };
  }

  function compareExpectedActual(expected = {}, actual = {}) {
    const checks = [
      ['provider', expected.requestedProvider, actual.actualProvider],
      ['placement', expected.requestedPlacement, actual.actualPlacement || actual.executionPlacement],
      ['runtime', expected.expectedRuntime, actual.actualRuntime || actual.runtimeIdentity?.runtime],
      ['fallback', expected.fallbackExpected, actual.fallbackUsed],
    ].map(([field, expectedValue, actualValue]) => ({
      field,
      expected: expectedValue,
      actual: actualValue,
      match: expectedValue === undefined || expectedValue === actualValue,
    }));
    return { status: checks.every(item => item.match) ? 'MATCH' : 'MISMATCH', checks };
  }

  function projectCapabilityHealth(input = {}) {
    const readiness = normalizeReadiness(input.readiness || input.capability?.readiness || input.provider?.readiness || 'DECLARED');
    const dependencyStatus = summarizeDependencyStatus(input.dependencies || input.capability?.dependencies || []);
    const status = blockedLike(readiness) || blockedLike(dependencyStatus)
      ? 'BLOCKED'
      : readiness === 'READY' && dependencyStatus === 'READY'
        ? 'READY'
        : readiness === 'DEGRADED' || dependencyStatus === 'DEGRADED'
          ? 'DEGRADED'
          : readiness;
    return {
      capabilityId: String(input.capabilityId || input.capability?.capabilityId || ''),
      status,
      provider: input.provider?.providerId || input.provider || '',
      readiness,
      dependencyStatus,
      lastCheckedAt: input.lastCheckedAt || now(),
      failureReason: String(input.failureReason || input.provider?.failureReason || ''),
      evidence: input.evidence || null,
    };
  }

  function normalizeEffectClass(value, fallback = 'UNKNOWN') {
    return known(EFFECT_CLASSES, asUpper(value, fallback), fallback);
  }

  function normalizeVerb(value, fallback = 'UNKNOWN') {
    return known(EFFECT_VERBS, asUpper(value, fallback), fallback);
  }

  function createEffectRequest(input = {}) {
    const resource = String(input.resource || '');
    const verb = normalizeVerb(input.verb);
    const target = String(input.target || '');
    const purpose = String(input.purpose || '');
    const effectClass = normalizeEffectClass(input.effectClass);
    const canonicalEffect = String(input.canonicalEffect || [resource, verb, purpose].filter(Boolean).join(':') || 'UNKNOWN_EFFECT');
    return {
      effectId: String(input.effectId || `${canonicalEffect}:${target || 'scope'}`),
      resource,
      verb,
      target,
      purpose,
      effectClass,
      canonicalEffect,
      persistence: String(input.persistence || (effectClass.startsWith('PERSISTENT_') ? 'PERSISTENT' : 'NON_PERSISTENT')),
      reversibility: String(input.reversibility || 'UNKNOWN'),
      externalMutation: Boolean(input.externalMutation || ['PERSISTENT_EXTERNAL_MUTATION', 'COMMUNICATION', 'FINANCIAL_EFFECT', 'PHYSICAL_EFFECT'].includes(effectClass)),
      requiresAuthority: input.requiresAuthority !== false,
      metadata: input.metadata || {},
    };
  }

  function createExpectedEffect(input = {}) {
    const request = createEffectRequest(input);
    return {
      resource: request.resource,
      verb: request.verb,
      target: request.target,
      purpose: request.purpose,
      effectClass: request.effectClass,
      canonicalEffect: request.canonicalEffect,
      evidenceRefs: asArray(input.evidenceRefs),
    };
  }

  function createActualEffect(input = {}) {
    return {
      observedResource: String(input.observedResource || input.resource || ''),
      observedVerb: normalizeVerb(input.observedVerb || input.verb),
      observedTarget: String(input.observedTarget || input.target || ''),
      observedEffectClass: normalizeEffectClass(input.observedEffectClass || input.effectClass),
      canonicalEffect: String(input.canonicalEffect || ''),
      evidence: input.evidence || null,
      evidenceRefs: asArray(input.evidenceRefs),
    };
  }

  function compareExpectedActualEffect(expectedInput = {}, actualInput = {}) {
    const expected = createExpectedEffect(expectedInput);
    const actual = createActualEffect(actualInput);
    const checks = [
      ['resource', expected.resource, actual.observedResource],
      ['verb', expected.verb, actual.observedVerb],
      ['target', expected.target, actual.observedTarget],
      ['effectClass', expected.effectClass, actual.observedEffectClass],
      ['canonicalEffect', expected.canonicalEffect, actual.canonicalEffect],
    ].map(([field, expectedValue, actualValue]) => ({
      field,
      expected: expectedValue,
      actual: actualValue,
      match: expectedValue === undefined || expectedValue === '' || expectedValue === actualValue,
    }));
    if (checks.some(item => !item.actual || item.actual === 'UNKNOWN')) return { status: 'UNKNOWN', expected, actual, checks };
    return { status: checks.every(item => item.match) ? 'MATCH' : 'DIVERGED', expected, actual, checks };
  }

  function matchesAuthorityRule(rule = {}, effect = {}) {
    return ['canonicalEffect', 'resource', 'verb', 'target', 'purpose', 'effectClass'].every(field => {
      const ruleValue = rule[field];
      return ruleValue == null || ruleValue === '*' || String(ruleValue) === String(effect[field]);
    });
  }

  function evaluateEffectAuthority(input = {}) {
    const effectRequest = createEffectRequest(input.effectRequest || input);
    const context = input.authorityContext || input.context || {};
    const rules = asArray(context.rules || input.rules);
    const matchedRule = rules.find(rule => matchesAuthorityRule(rule, effectRequest));
    const decision = matchedRule?.decision || (effectRequest.requiresAuthority === false ? 'ALLOW' : isHighRiskEffectClass(effectRequest.effectClass) ? 'REQUIRE_APPROVAL' : 'UNKNOWN');
    const normalizedDecision = known(AUTHORITY_DECISIONS, asUpper(decision), 'UNKNOWN');
    return {
      decision: normalizedDecision,
      reason: String(matchedRule?.reason || (matchedRule ? 'MATCHED_AUTHORITY_RULE' : normalizedDecision === 'REQUIRE_APPROVAL' ? 'HIGH_RISK_EFFECT_AUTHORITY_UNKNOWN' : normalizedDecision === 'ALLOW' ? 'AUTHORITY_NOT_REQUIRED' : 'NO_MATCHING_AUTHORITY_RULE')),
      policy: String(matchedRule?.policy || context.policy || ''),
      ruleRef: String(matchedRule?.ruleRef || matchedRule?.id || ''),
      evaluatedAt: input.evaluatedAt || now(),
      principal: context.principal || input.principal || null,
      representedPrincipal: context.representedPrincipal || input.representedPrincipal || null,
      evidence: input.evidence || matchedRule?.evidence || null,
      effectRequest,
    };
  }

  function detectCapabilitySemanticDivergence(input = {}) {
    const expectedEffect = createExpectedEffect(input.expectedEffect || {});
    const actualEffect = createActualEffect(input.actualEffect || {});
    const comparison = compareExpectedActualEffect(expectedEffect, actualEffect);
    const divergences = [];
    if (comparison.status === 'DIVERGED') divergences.push('CAPABILITY_SEMANTIC_DIVERGENCE');
    if (expectedEffect.effectClass === 'OBSERVATION' && isHighRiskEffectClass(actualEffect.observedEffectClass)) divergences.push('EFFECT_AUTHORITY_DIVERGENCE');
    return {
      status: divergences.length ? 'DIVERGED' : comparison.status,
      divergenceTypes: divergences,
      comparison,
    };
  }

  function validateEffect(input = {}) {
    const effectRequest = createEffectRequest(input.effectRequest || input);
    const authorityDecision = evaluateEffectAuthority({
      effectRequest,
      authorityContext: input.authorityContext || {},
      evidence: input.authorityEvidence || null,
    });
    const expectedEffect = createExpectedEffect(input.expectedEffect || effectRequest);
    const actualEffect = input.actualEffect ? createActualEffect(input.actualEffect) : null;
    const comparison = actualEffect ? compareExpectedActualEffect(expectedEffect, actualEffect) : { status: 'UNKNOWN', expected: expectedEffect, actual: null, checks: [] };
    const classification = {
      effectClass: effectRequest.effectClass,
      highRisk: isHighRiskEffectClass(effectRequest.effectClass),
      externalMutation: effectRequest.externalMutation,
    };
    const blockingReasons = [];
    if (authorityDecision.decision === 'DENY') blockingReasons.push('EFFECT_AUTHORITY_DENIED');
    if (authorityDecision.decision === 'REQUIRE_APPROVAL') blockingReasons.push('EFFECT_REQUIRES_APPROVAL');
    if (authorityDecision.decision === 'UNKNOWN' && classification.highRisk) blockingReasons.push('HIGH_RISK_EFFECT_AUTHORITY_UNKNOWN');
    if (comparison.status === 'DIVERGED') blockingReasons.push('EXPECTED_ACTUAL_EFFECT_DIVERGED');
    return {
      status: blockingReasons.length ? 'BLOCKED' : authorityDecision.decision === 'ALLOW' ? 'ALLOWED' : 'UNKNOWN',
      effectRequest,
      effectClassification: classification,
      authorityDecision,
      expectedEffect,
      actualEffect,
      comparison,
      evidenceRefs: asArray(input.evidenceRefs),
      policyVersion: String(input.policyVersion || ''),
      blockingReasons,
    };
  }

  return {
    READINESS_STATES,
    DEPENDENCY_TYPES,
    CLASSIFICATIONS,
    PLACEMENTS,
    EFFECT_CLASSES,
    EFFECT_VERBS,
    AUTHORITY_DECISIONS,
    EFFECT_COMPARISON_STATUSES,
    normalizePlacement,
    normalizeReadiness,
    createDependency,
    normalizeDependencyList,
    summarizeDependencyStatus,
    createDataPolicy,
    evaluateDataPolicy,
    createCapability,
    CapabilityRegistry,
    createProviderDescriptor,
    routeProvider,
    preflight,
    createExecutionProvenance,
    compareExpectedActual,
    projectCapabilityHealth,
    normalizeEffectClass,
    normalizeVerb,
    createEffectRequest,
    createExpectedEffect,
    createActualEffect,
    compareExpectedActualEffect,
    evaluateEffectAuthority,
    detectCapabilitySemanticDivergence,
    validateEffect,
  };
});
