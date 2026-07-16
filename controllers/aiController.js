const aiGateway = require('../services/aiGateway');
const costControl = require('../services/costControlService');
const policy = require('../services/securityPolicyService');

const MODULES = new Set(['ai-office', 'ocr', 'inquiry', 'quotation', 'rfq', '8d', 'apqp', 'customer-reply', 'document-summary', 'contract-risk', 'agent', 'gateway-test', 'general', 'default']);
const AGENT_IDS = new Set(['', 'EnterpriseAgentRuntimeV1', 'agent-runtime']);

function context(req, taskType) {
  const moduleName = MODULES.has(String(req.body?.module || '')) ? String(req.body.module) : 'general';
  if (req.body?.highCostConfirmed) policy.requireRole(req.user.role, 'admin');
  return {
    messages: req.body?.messages,
    provider: req.body?.demoMode ? 'mock' : 'deepseek',
    demoMode: Boolean(req.body?.demoMode),
    module: moduleName,
    taskType,
    userId: req.user.id,
    enterpriseId: req.user.enterprise_id,
    role: req.user.role,
    agentId: AGENT_IDS.has(String(req.body?.agentId || '')) ? String(req.body?.agentId || '') : '',
    temperature: req.body?.temperature,
    maxTokens: req.body?.max_tokens,
    timeout: req.body?.timeout,
    promptVersion: String(req.body?.promptVersion || 'v1').slice(0, 40),
    forceRegenerate: Boolean(req.body?.forceRegenerate),
    sensitiveMode: req.body?.sensitiveMode || 'mask',
    sensitiveConfirmed: req.body?.sensitiveConfirmed === true,
    highCostConfirmed: req.body?.highCostConfirmed === true,
    expectStructured: taskType === 'structure' || Boolean(req.body?.expectStructured),
    allowTools: Boolean(req.body?.allowTools)
  };
}

function httpStatus(result) {
  if (['success', 'partial_success', 'mock_completed'].includes(result.status)) return 200;
  if (result.status === 'disabled' || result.status === 'circuit_open') return 503;
  if (result.status === 'budget_blocked' || result.status === 'rate_limited') return 429;
  if (result.status === 'timeout') return 504;
  return 502;
}

function execute(taskType) {
  return async (req, res, next) => {
    try {
      const result = await aiGateway.chat(context(req, taskType));
      res.status(httpStatus(result)).json({ ok: ['success', 'partial_success', 'mock_completed'].includes(result.status), data: result, ...result });
    } catch (error) { next(error); }
  };
}

function configSafe(req, res) {
  const status = aiGateway.getStatus({ enterpriseId: req.user.enterprise_id, isAdmin: policy.normalizeRole(req.user.role) === 'admin' });
  res.json({ ok: true, data: status });
}

function health(req, res) {
  const status = aiGateway.getStatus({ enterpriseId: req.user.enterprise_id });
  res.status(status.enabled && status.healthy ? 200 : 503).json({ ok: status.enabled && status.healthy, data: status });
}

function usage(req, res) {
  res.json({ ok: true, data: costControl.usage({ enterpriseId: req.user.enterprise_id, isAdmin: policy.normalizeRole(req.user.role) === 'admin' }) });
}

function deleteCache(req, res) {
  policy.requireRole(req.user.role, 'admin');
  const deleted = costControl.cacheDelete({ enterpriseId: req.user.enterprise_id, cacheKey: String(req.body?.cacheKey || ''), sensitiveOnly: req.body?.sensitiveOnly !== false });
  res.json({ ok: true, data: { deleted }, message: 'AI 敏感缓存已删除' });
}

module.exports = { execute, configSafe, health, usage, deleteCache };
