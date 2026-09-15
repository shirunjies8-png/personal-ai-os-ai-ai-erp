(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RealityOSCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  const READINESS_STATES = Object.freeze(['DECLARED', 'RESOLVED', 'READY', 'DEGRADED', 'BLOCKED', 'UNAVAILABLE']);
  const DEPENDENCY_TYPES = Object.freeze(['runtime', 'package', 'credential', 'service', 'network', 'filesystem', 'device', 'model']);
  const CLASSIFICATIONS = Object.freeze(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SENSITIVE', 'UNKNOWN']);
  const PLACEMENTS = Object.freeze(['LOCAL_ONLY', 'ON_PREMISE', 'CONTROLLED_SERVER', 'EXTERNAL', 'UNKNOWN']);

  const now = () => new Date().toISOString();
  const asUpper = (value, fallback = 'UNKNOWN') => String(value || fallback).trim().toUpperCase();
  const asArray = value => Array.isArray(value) ? value.filter(item => item != null) : value == null ? [] : [value];
  const known = (set, value, fallback) => set.includes(value) ? value : fallback;
  const readyLike = value => asUpper(value) === 'READY';
  const blockedLike = value => ['BLOCKED', 'UNAVAILABLE'].includes(asUpper(value));
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

  return {
    READINESS_STATES,
    DEPENDENCY_TYPES,
    CLASSIFICATIONS,
    PLACEMENTS,
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
  };
});
