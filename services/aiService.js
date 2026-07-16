const env = require('../config/env');
const { chat, getStatus, sanitizeErrorMessage, isRetryable } = require('./aiGateway');

function buildMessages(prompt, options = {}) {
  if (Array.isArray(prompt)) return prompt;
  const system = options.system || '你是 Personal AI OS 企业版中的严谨中文办公助手。回答必须可执行、保留关键业务字段、避免空泛表述。';
  return [
    { role: 'system', content: system },
    { role: 'user', content: String(prompt || '') }
  ];
}

async function completeChat({ messages, prompt, moduleName = 'default', taskType = 'chat', model, temperature = 0.2, maxTokens, timeout, provider, demoMode, userId, enterpriseId, role, agentId, promptVersion, forceRegenerate, sensitiveMode, sensitiveConfirmed, highCostConfirmed, expectStructured, allowTools }, runtime = {}) {
  const payload = await chat({
    requestId: undefined,
    provider: provider || env.aiProvider || 'deepseek',
    model: model || env.deepseekModel,
    messages: messages || buildMessages(prompt, { moduleName }),
    module: moduleName,
    taskType,
    temperature,
    maxTokens: maxTokens || env.deepseekMaxOutputTokens,
    timeout: timeout || env.deepseekTimeoutMs,
    demoMode: demoMode ?? false,
    userId,
    enterpriseId,
    role,
    agentId,
    promptVersion,
    forceRegenerate,
    sensitiveMode,
    sensitiveConfirmed,
    highCostConfirmed,
    expectStructured,
    allowTools
  }, runtime);
  if (!['success', 'partial_success', 'mock_completed'].includes(payload.status)) {
    const error = new Error(payload.errors?.[0] || 'AI 调用失败');
    error.code = payload.status;
    error.status = payload.status === 'disabled' ? 503 : payload.status === 'budget_blocked' ? 429 : 502;
    error.result = payload;
    error.requestId = payload.requestId;
    throw error;
  }
  const text = String(payload.content || '').trim();
  if (!text) throw new Error('模型响应为空，请检查模型名称或请求格式。');
  return {
    text,
    mode: payload.status === 'mock_completed' ? 'mock' : 'api',
    model: payload.model,
    usage: {
      prompt_tokens: payload.promptTokens || 0,
      completion_tokens: payload.completionTokens || 0,
      total_tokens: payload.totalTokens || 0
    },
    provider: payload.provider,
    requestId: payload.requestId,
    status: payload.status,
    structuredData: payload.structuredData,
    estimatedCost: payload.estimatedCost,
    cached: payload.cached,
    cacheCreatedAt: payload.cacheCreatedAt,
    retryCount: payload.retryCount,
    budgetStatus: payload.budgetStatus,
    warnings: payload.warnings,
    errors: payload.errors,
    latencyMs: payload.durationMs || 0,
    durationMs: payload.durationMs || 0
  };
}

async function streamChat(prompt, options = {}) {
  const full = await completeChat({
    prompt,
    moduleName: options.module || options.mode || 'general',
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    timeout: options.timeout,
    provider: options.provider,
    mockFallback: options.mockFallback,
    demoMode: options.demoMode,
    allowMockFallback: options.allowMockFallback
  });
  const text = String(full.text || '');
  if (typeof options.onUpdate === 'function') {
    let current = '';
    const step = Math.max(6, Math.ceil(text.length / 40));
    for (let i = 0; i < text.length; i += step) {
      current += text.slice(i, i + step);
      options.onUpdate(current, i + step >= text.length, full);
      if (typeof window !== 'undefined') {
        // no-op in Node; the browser caller drives visual updates
      }
      await new Promise(resolve => setTimeout(resolve, 16));
    }
  }
  return full;
}

module.exports = {
  complete: completeChat,
  streamChat,
  getStatus,
  friendlyMessage: sanitizeErrorMessage,
  isRetryable
};
