const env = require('../config/env');

const RANK = Object.freeze({ viewer: 1, operator: 2, admin: 3 });
const HIGH_RISK_ACTIONS = new Set(['file_generate_tool', 'web_api_tool', 'human_approval_tool', '8d_closure']);
const DATA_CLASSIFICATIONS = Object.freeze(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SENSITIVE']);
const PROCESSING_LOCATIONS = Object.freeze(['LOCAL', 'CONTROLLED_SERVER', 'EXTERNAL']);
const AUTHORITY_ACTIONS = Object.freeze(['READ', 'CREATE', 'MODIFY', 'DELETE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'PAY', 'CONTROL']);
const HIGH_RISK_AUTHORITY_ACTIONS = new Set(['DELETE', 'SEND_EXTERNAL', 'PUBLISH', 'PURCHASE', 'PAY', 'INVENTORY_WRITE', 'MES_WRITE', 'DEVICE_CONTROL', 'PERMISSION_CHANGE']);

function bool(value, fallback = true) {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function normalizeRole(role = '') {
  const text = String(role).toLowerCase();
  if (/admin|企业管理员|管理员/.test(text)) return 'admin';
  if (/operator|操作员|业务员/.test(text)) return 'operator';
  return 'viewer';
}

function flags() {
  return {
    ai: bool(process.env.CAPABILITY_AI ?? env.capabilityAi, true),
    agents: bool(process.env.CAPABILITY_AGENTS ?? env.capabilityAgents, true),
    skills: bool(process.env.CAPABILITY_SKILLS ?? env.capabilitySkills, true),
    workflows: bool(process.env.CAPABILITY_WORKFLOWS ?? env.capabilityWorkflows, true),
    externalNetwork: bool(process.env.CAPABILITY_EXTERNAL_NETWORK ?? env.capabilityExternalNetwork, false),
    fileGeneration: bool(process.env.CAPABILITY_FILE_GENERATION ?? env.capabilityFileGeneration, false)
  };
}

function requireCapability(name) {
  if (!flags()[name]) {
    const error = new Error(`能力未启用：${name}`);
    error.code = 'CAPABILITY_DISABLED';
    error.status = 403;
    throw error;
  }
}

function requireRole(actual, required = 'viewer') {
  if ((RANK[normalizeRole(actual)] || 0) < (RANK[normalizeRole(required)] || 0)) {
    const error = new Error('权限不足');
    error.code = 'FORBIDDEN';
    error.status = 403;
    throw error;
  }
}

function isHighRisk(action) {
  return HIGH_RISK_ACTIONS.has(String(action || ''));
}

function normalizeDataClassification(value = '') {
  const normalized = String(value || '').trim().toUpperCase();
  return DATA_CLASSIFICATIONS.includes(normalized) ? normalized : 'UNKNOWN';
}

function localFirstLocation(classification) {
  const normalized = normalizeDataClassification(classification);
  if (normalized === 'CONFIDENTIAL') return 'CONTROLLED_SERVER';
  return 'LOCAL';
}

function classifyData(input = {}) {
  const classification = normalizeDataClassification(input.classification);
  const containsSecrets = Boolean(input.containsSecrets);
  const containsSensitiveData = Boolean(input.containsSensitiveData || containsSecrets || classification === 'SENSITIVE');
  const processingLocation = PROCESSING_LOCATIONS.includes(String(input.processingLocation || '').toUpperCase())
    ? String(input.processingLocation).toUpperCase()
    : localFirstLocation(classification);
  return {
    classification,
    source: String(input.source || 'UNKNOWN'),
    purpose: String(input.purpose || 'UNKNOWN'),
    ownerScope: String(input.ownerScope || input.dataScope || 'UNKNOWN'),
    containsSecrets,
    containsPersonalData: Boolean(input.containsPersonalData),
    containsSensitiveData,
    processingLocation,
    outboundAllowed: false,
    reason: classification === 'UNKNOWN' ? 'UNKNOWN_CLASSIFICATION_FAIL_CLOSED' : 'LOCAL_FIRST_DEFAULT'
  };
}

function hasMatch(policyValue, value) {
  if (!Array.isArray(policyValue) || policyValue.length === 0) return false;
  return policyValue.includes(value);
}

function matchesExplicitOutboundPolicy(policyValue, context) {
  if (!policyValue || policyValue.outboundAllowed !== true || !String(policyValue.id || '').trim()) return false;
  return hasMatch(policyValue.allowedClassifications, context.classification)
    && hasMatch(policyValue.allowedDestinations, context.destination)
    && hasMatch(policyValue.allowedPurposes, context.purpose)
    && hasMatch(policyValue.allowedDataScopes, context.dataScope)
    && hasMatch(policyValue.allowedTools, context.tool);
}

function evaluateOutboundDecision(input = {}) {
  const classification = normalizeDataClassification(input.classification);
  const destination = String(input.destination || 'UNKNOWN').toUpperCase();
  const purpose = String(input.purpose || 'UNKNOWN');
  const dataScope = String(input.dataScope || input.ownerScope || 'UNKNOWN');
  const tool = String(input.tool || 'UNKNOWN');
  const actorId = String(input.actor?.id || input.actorId || '');
  const redactionRequired = classification === 'INTERNAL' || classification === 'CONFIDENTIAL' || classification === 'SENSITIVE' || classification === 'UNKNOWN';
  const result = (decision, reason, policyId = '') => ({ decision, reason, policyId, classification, destination, redactionRequired });
  if (!actorId || purpose === 'UNKNOWN' || dataScope === 'UNKNOWN' || dataScope === 'global' || tool === 'UNKNOWN' || destination === 'UNKNOWN') return result('DENY', 'OUTBOUND_CONTEXT_INCOMPLETE');
  if (classification === 'UNKNOWN') return result('DENY', 'UNKNOWN_CLASSIFICATION_FAIL_CLOSED');
  if (classification === 'SENSITIVE' || Boolean(input.containsSecrets)) return result('DENY', 'SENSITIVE_OUTBOUND_DENIED');
  if (!matchesExplicitOutboundPolicy(input.policy, { classification, destination, purpose, dataScope, tool })) return result('DENY', 'EXPLICIT_OUTBOUND_POLICY_REQUIRED');
  if (redactionRequired && String(input.redactionStatus || '').toUpperCase() !== 'REDACTED') return result('DENY', 'REDACTION_REQUIRED');
  return result('ALLOW', 'EXPLICIT_POLICY_ALLOWED', String(input.policy.id));
}

function evaluateAuthority(input = {}) {
  const action = String(input.action || '').toUpperCase();
  const resource = String(input.resource || '');
  const scope = String(input.scope || '');
  const actor = input.actor || {};
  const authority = actor.authority || actor;
  const result = (decision, reason) => ({ decision, reason, action, resource, scope, actorId: String(actor.id || '') });
  if (!actor.id || !AUTHORITY_ACTIONS.includes(action) || !resource || !scope || scope === 'global') return result('DENY', 'AUTHORITY_CONTEXT_INCOMPLETE');
  if (!hasMatch(authority.allowedActions, action)) return result('DENY', 'ACTION_NOT_AUTHORIZED');
  if (!hasMatch(authority.allowedResources, resource)) return result('DENY', 'RESOURCE_NOT_AUTHORIZED');
  if (!hasMatch(authority.allowedScopes, scope)) return result('DENY', 'SCOPE_NOT_AUTHORIZED');
  return result('ALLOW', 'EXPLICIT_AUTHORITY_ALLOWED');
}

function evaluateApproval(input = {}) {
  const action = String(input.action || '').toUpperCase();
  const isHighRiskAction = HIGH_RISK_AUTHORITY_ACTIONS.has(action) || Boolean(input.highRisk);
  if (!isHighRiskAction) return { decision: 'ALLOW', reason: 'APPROVAL_NOT_REQUIRED' };
  const approval = input.approval || {};
  const executor = input.executor || input.actor || {};
  const approver = approval.approver || input.approver || {};
  if (approval.status == null || approval.status === 'UNKNOWN') return { decision: 'REQUIRE_APPROVAL', reason: 'APPROVAL_UNKNOWN' };
  if (approval.status !== 'APPROVED') return { decision: 'REQUIRE_APPROVAL', reason: 'HUMAN_APPROVAL_REQUIRED' };
  if (!approver.id || String(approver.type || '').toUpperCase() === 'AI_AGENT' || (String(executor.type || '').toUpperCase() === 'AI_AGENT' && executor.id === approver.id)) return { decision: 'DENY', reason: 'AI_AGENT_CANNOT_SELF_APPROVE' };
  return { decision: 'ALLOW', reason: 'HUMAN_APPROVAL_VERIFIED' };
}

const ToolGuard = Object.freeze({
  evaluate(input = {}) {
    const authorityDecision = evaluateAuthority(input);
    const outboundDecision = input.outbound === false
      ? { decision: 'ALLOW', reason: 'NO_OUTBOUND_REQUIRED', policyId: '', classification: normalizeDataClassification(input.classification), destination: 'LOCAL', redactionRequired: false }
      : evaluateOutboundDecision(input);
    const permissionDecision = String(input.permissionDecision || 'UNKNOWN').toUpperCase();
    const highRisk = HIGH_RISK_AUTHORITY_ACTIONS.has(String(input.action || '').toUpperCase()) || Boolean(input.highRisk);
    const approvalDecision = evaluateApproval({ ...input, highRisk });
    const base = { policyDecision: outboundDecision.decision, authorityDecision: authorityDecision.decision, outboundDecision: outboundDecision.decision, riskClass: highRisk ? 'HIGH' : 'STANDARD' };
    if (permissionDecision !== 'ALLOW') return { decision: 'DENY', reason: 'PERMISSION_UNKNOWN_OR_DENIED', ...base };
    if (authorityDecision.decision !== 'ALLOW') return { decision: 'DENY', reason: authorityDecision.reason, ...base };
    if (outboundDecision.decision !== 'ALLOW') return { decision: 'DENY', reason: outboundDecision.reason, ...base };
    if (approvalDecision.decision === 'DENY') return { decision: 'DENY', reason: approvalDecision.reason, ...base };
    if (approvalDecision.decision === 'REQUIRE_APPROVAL') return { decision: 'REQUIRE_APPROVAL', reason: approvalDecision.reason, ...base };
    return { decision: 'ALLOW', reason: 'TOOL_GUARD_ALLOWED', ...base };
  }
});

function canSendToExternalAI(input = {}) {
  const result = evaluateOutboundDecision({ ...input, destination: 'EXTERNAL' });
  return { ...result, allowed: result.decision === 'ALLOW' };
}

function minimizePayload(payload = {}, options = {}) {
  if (options.referenceId) return { referenceId: String(options.referenceId) };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const allowed = Array.isArray(options.allowedFields) ? options.allowedFields : [];
  return Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(payload, key)).map(key => [key, payload[key]]));
}

module.exports = {
  RANK, flags, normalizeRole, requireCapability, requireRole, isHighRisk,
  DATA_CLASSIFICATIONS, PROCESSING_LOCATIONS, AUTHORITY_ACTIONS, HIGH_RISK_AUTHORITY_ACTIONS,
  normalizeDataClassification, classifyData, evaluateOutboundDecision, evaluateAuthority,
  evaluateApproval, ToolGuard, canSendToExternalAI, minimizePayload
};
