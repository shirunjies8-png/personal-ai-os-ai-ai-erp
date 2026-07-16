const env = require('../config/env');
const logger = require('../logger');
const { maybeRunTool } = require('./toolRegistry');
const policy = require('./securityPolicyService');
const costControl = require('./costControlService');
const logService = require('./logService');
const redaction = require('./aiRedactionService');

const circuit = { failures: 0, openedAt: 0, state: 'closed', lastSuccessAt: '', lastError: '', lastCallAt: '' };

function requestId(prefix = 'ai') { return logger.requestId(prefix); }
function nowIso(runtime = {}) { return new Date(runtime.now || Date.now()).toISOString(); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function resolveProviderConfig(input = {}, runtime = {}) {
  const requested = String(input.provider || env.aiProvider || 'deepseek').toLowerCase();
  const provider = /mock|本地/.test(requested) ? 'mock' : 'deepseek';
  return {
    provider,
    model: provider === 'mock' ? (input.model || env.deepseekModel) : env.deepseekModel,
    baseUrl: String(env.deepseekBaseUrl || 'https://api.deepseek.com').trim().replace(/\/$/, ''),
    apiKey: provider === 'mock' ? '' : String(runtime.apiKey ?? env.deepseekApiKey ?? '').trim()
  };
}

function resolveEndpoint(baseUrl = '') {
  const normalized = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!normalized) return '';
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function sanitizeErrorMessage(error = {}) {
  const text = String(error?.message || error || '');
  if (/401|unauthorized|invalid api key|authentication/i.test(text)) return 'DeepSeek 认证失败，请由管理员检查服务端配置。';
  if (/API Key|missing api key|not configured/i.test(text)) return '未配置真实 DeepSeek 服务。';
  if (/402|balance|insufficient|credit/i.test(text)) return 'DeepSeek 余额或服务额度不足。';
  if (/403|forbidden/i.test(text)) return '当前服务端凭据无权使用该模型。';
  if (/404|model|not found|unsupported/i.test(text)) return '当前模型不可用，请由管理员检查模型配置。';
  if (/AbortError|timeout|超时/i.test(text)) return 'AI 请求超时，请稍后重试。';
  if (/429|rate.?limit/i.test(text)) return 'AI 服务当前限流，请稍后重试。';
  if (/fetch|network|ENOTFOUND|ECONN|socket/i.test(text)) return 'AI 服务端网络连接失败。';
  if (/502|503|504|capacity/i.test(text)) return 'AI 服务暂时不可用，请稍后重试。';
  if (/JSON|parse|invalid response/i.test(text)) return 'AI 服务返回了无法解析的响应。';
  return logger.sanitize(text || 'AI 调用失败');
}

function extractResponseText(data = {}) {
  const choice = data?.choices?.[0];
  const candidates = [choice?.message?.content, choice?.delta?.content, choice?.text, data?.output_text, data?.text, data?.message?.content];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (Array.isArray(candidate)) {
      const value = candidate.map(item => typeof item === 'string' ? item : item?.text || item?.content || '').filter(Boolean).join('\n').trim();
      if (value) return value;
    }
  }
  return '';
}

function classifyError(error = {}) {
  const status = Number(error.httpStatus || error.status || 0);
  const text = String(error.message || error || '');
  if (error.code === 'BUDGET_BLOCKED') return { status: 'budget_blocked', signature: 'deepseek-budget-blocked', retryable: false };
  if (/AbortError|timeout|超时/i.test(text)) return { status: 'timeout', signature: 'deepseek-timeout', retryable: true };
  if (status === 401 || /auth|api key/i.test(text)) return { status: 'failed', signature: 'deepseek-auth-failed', retryable: false };
  if (status === 429 || /rate.?limit/i.test(text)) return { status: 'rate_limited', signature: 'deepseek-rate-limited', retryable: true };
  if (/empty/i.test(text)) return { status: 'empty_response', signature: 'deepseek-empty-response', retryable: false };
  if (/parse|invalid response|JSON/i.test(text)) return { status: 'failed', signature: 'deepseek-invalid-response', retryable: false };
  if (/context|too large|输入超过/i.test(text)) return { status: 'failed', signature: 'deepseek-context-too-large', retryable: false };
  if ([502, 503, 504].includes(status) || /network|fetch|ECONN|capacity/i.test(text)) return { status: 'failed', signature: 'deepseek-network-error', retryable: true };
  return { status: 'failed', signature: 'deepseek-invalid-response', retryable: false };
}

function isRetryable(error = {}) { return classifyError(error).retryable; }

function responseShape(overrides = {}) {
  return {
    requestId: overrides.requestId || '', provider: overrides.provider || 'deepseek', model: overrides.model || '',
    mode: overrides.mode || 'disabled', status: overrides.status || 'failed', content: overrides.content || '',
    structuredData: overrides.structuredData ?? null, inputTokens: Number(overrides.inputTokens || 0), outputTokens: Number(overrides.outputTokens || 0),
    totalTokens: Number(overrides.totalTokens || 0), estimatedCost: Number(overrides.estimatedCost || 0), durationMs: Number(overrides.durationMs || 0),
    cached: Boolean(overrides.cached), cacheCreatedAt: overrides.cacheCreatedAt || '', retryCount: Number(overrides.retryCount || 0),
    budgetStatus: overrides.budgetStatus || 'normal', warnings: Array.isArray(overrides.warnings) ? overrides.warnings : [],
    errors: Array.isArray(overrides.errors) ? overrides.errors : [], createdAt: overrides.createdAt || new Date().toISOString()
  };
}

function buildMockReply(messages = [], module = 'general') {
  const last = [...messages].reverse().find(item => item?.role === 'user')?.content || '';
  return `当前为 Mock 演示数据，非真实 DeepSeek 结果。\n模块：${module}\n已接收任务：${String(last).slice(0, 120)}`;
}

function cacheKey(input, config, protectedMessages, mode) {
  return redaction.hashPayload(JSON.stringify({
    enterpriseId: input.enterpriseId, userScope: `${input.userId}:${input.role || ''}`, module: input.module,
    taskType: input.taskType, content: protectedMessages, promptVersion: input.promptVersion || 'v1', model: config.model,
    parameters: { temperature: input.temperature ?? 0.2, maxTokens: input.maxTokens }, mode
  }));
}

function recordOutcome(input, result, extra = {}) {
  const billable = !result.cached && result.mode === 'live' && ['success', 'partial_success'].includes(result.status);
  costControl.record({
    requestId: result.requestId, enterpriseId: input.enterpriseId || 'default', userId: input.userId || 'anonymous',
    agentId: input.agentId || '', module: input.module || 'general', provider: result.provider, model: result.model,
    taskType: input.taskType || 'chat', inputTokens: billable ? result.inputTokens : 0, outputTokens: billable ? result.outputTokens : 0,
    totalTokens: billable ? result.totalTokens : 0, estimatedCost: billable ? result.estimatedCost : 0, durationMs: result.durationMs,
    cached: result.cached, retryCount: result.retryCount, requestStatus: result.status, budgetStatus: result.budgetStatus,
    errorSignature: extra.errorSignature || '', redactionCount: extra.redactionCount || 0, createdAt: result.createdAt
  });
  if (extra.errorSignature && input.enterpriseId) {
    logService.add({ enterpriseId: input.enterpriseId, userId: input.userId, type: 'ai_error', title: extra.errorSignature, detail: result.errors.join('；') || result.warnings.join('；') || 'AI 调用异常' });
  }
}

function circuitState(now = Date.now()) {
  if (circuit.state === 'open' && now - circuit.openedAt >= env.deepseekCircuitCooldownMs) circuit.state = 'half_open';
  return circuit.state;
}

function registerFailure(error, now = Date.now()) {
  if (!classifyError(error).retryable) return;
  circuit.failures += 1;
  circuit.lastError = sanitizeErrorMessage(error);
  if (circuit.failures >= env.deepseekCircuitFailureThreshold) {
    circuit.state = 'open';
    circuit.openedAt = now;
  }
}

function registerSuccess(time = new Date().toISOString()) {
  circuit.failures = 0; circuit.openedAt = 0; circuit.state = 'closed'; circuit.lastError = ''; circuit.lastSuccessAt = time;
}

async function providerRequest(messages, config, input, runtime, requestIdValue) {
  const fetchImpl = runtime.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw Object.assign(new Error('AI 服务端网络连接失败。'), { status: 502 });
  const response = await fetchImpl(resolveEndpoint(config.baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages, temperature: input.temperature ?? 0.2, max_tokens: input.maxTokens, top_p: input.topP ?? 1, stream: false }),
    signal: AbortSignal.timeout(input.timeoutMs)
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch {
    const error = Object.assign(new Error('AI invalid response JSON'), { status: 502, httpStatus: response.status });
    throw error;
  }
  if (!response.ok) {
    const error = Object.assign(new Error(data?.error?.message || data?.message || `HTTP ${response.status}`), { status: response.status, httpStatus: response.status });
    throw error;
  }
  const content = extractResponseText(data);
  if (!content) throw Object.assign(new Error('AI empty response'), { status: 502, httpStatus: response.status });
  return { data, content, finishReason: data?.choices?.[0]?.finish_reason || '', requestId: requestIdValue };
}

async function chat(input = {}, runtime = {}) {
  policy.requireCapability('ai');
  const startedAt = Number(runtime.now || Date.now());
  const createdAt = nowIso(runtime);
  const requestIdValue = input.requestId || requestId('ai');
  const config = resolveProviderConfig(input, runtime);
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const mode = input.demoMode || config.provider === 'mock' ? 'mock' : config.apiKey ? 'live' : 'disabled';
  const base = { requestId: requestIdValue, provider: config.provider, model: config.model, createdAt, mode };
  circuit.lastCallAt = createdAt;

  if (mode === 'mock') {
    const result = responseShape({ ...base, status: 'mock_completed', content: buildMockReply(messages, input.module), warnings: ['当前为 Mock 演示数据，非真实 DeepSeek 结果。'] });
    recordOutcome(input, result);
    return result;
  }
  if (mode === 'disabled') {
    const result = responseShape({ ...base, status: 'disabled', errors: ['未配置真实 DeepSeek 服务。'], budgetStatus: 'normal' });
    recordOutcome(input, result, { errorSignature: 'deepseek-not-configured' });
    return result;
  }

  let protectedPayload;
  try {
    protectedPayload = redaction.protectMessages(messages, { mode: input.sensitiveMode || 'mask', confirmed: input.sensitiveConfirmed === true });
  } catch (error) {
    const result = responseShape({ ...base, status: 'failed', errors: [sanitizeErrorMessage(error)] });
    recordOutcome(input, result, { errorSignature: 'deepseek-redaction-failed' });
    return result;
  }
  const maxTokens = Math.min(Number(input.maxTokens || env.deepseekMaxOutputTokens), env.deepseekMaxOutputTokens);
  const budget = costControl.preflight({ ...input, messages: protectedPayload.messages, maxOutputTokens: maxTokens, now: new Date(startedAt) }, runtime.limits);
  if (!budget.allowed) {
    const signature = ['CONTEXT_TOO_LARGE', 'REQUEST_TOO_LARGE', 'CONTEXT_TOKEN_LIMIT'].includes(budget.code) ? 'deepseek-context-too-large' : 'deepseek-budget-blocked';
    const result = responseShape({ ...base, status: 'budget_blocked', budgetStatus: 'blocked', errors: [budget.reason] });
    recordOutcome(input, result, { errorSignature: signature, redactionCount: protectedPayload.total });
    return result;
  }
  const promptMessages = protectedPayload.messages;
  const key = cacheKey({ ...input, maxTokens }, config, promptMessages, mode);
  if (!input.forceRegenerate) {
    let cached = null;
    try { cached = costControl.cacheGet(key, input.enterpriseId, new Date(startedAt)); } catch (error) {
      if (input.enterpriseId) logService.add({ enterpriseId: input.enterpriseId, userId: input.userId, type: 'ai_error', title: 'deepseek-cache-error', detail: 'AI 缓存读取失败，已跳过缓存。' });
    }
    if (cached) {
      const result = responseShape({ ...cached, requestId: requestIdValue, cached: true, cacheCreatedAt: cached.cacheCreatedAt, createdAt, durationMs: Date.now() - startedAt, budgetStatus: budget.status });
      recordOutcome(input, result, { redactionCount: protectedPayload.total });
      return result;
    }
  }
  if (circuitState(startedAt) === 'open') {
    const result = responseShape({ ...base, mode: 'circuit_open', status: 'circuit_open', budgetStatus: budget.status, errors: ['DeepSeek 熔断已打开，请等待冷却后重试。'] });
    recordOutcome(input, result, { errorSignature: 'deepseek-circuit-open', redactionCount: protectedPayload.total });
    return result;
  }

  const toolResult = input.allowTools ? await maybeRunTool(promptMessages, input.module || 'general') : null;
  const toolContext = toolResult?.data?.summary || toolResult?.data?.preview || '';
  const finalMessages = toolContext ? [...promptMessages, { role: 'assistant', content: redaction.redactText(String(toolContext)).text }] : promptMessages;
  let lastError;
  let attempt = 0;
  const maxRetries = Math.min(env.deepseekMaxRetries, Number(runtime.maxRetries ?? env.deepseekMaxRetries));
  for (; attempt <= maxRetries; attempt += 1) {
    try {
      const provider = await providerRequest(finalMessages, config, { ...input, maxTokens, timeoutMs: Math.min(Number(input.timeout || env.deepseekTimeoutMs), env.deepseekTimeoutMs) }, runtime, requestIdValue);
      const usage = provider.data?.usage || {};
      const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? budget.estimatedInputTokens ?? 0);
      const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
      const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);
      const cachedInputTokens = Number(usage.prompt_cache_hit_tokens || 0);
      const warnings = [];
      let status = 'success';
      if (provider.finishReason === 'length') { status = 'partial_success'; warnings.push('模型输出达到长度上限，结果可能被截断。'); }
      if (/(.{20,})\1\1/.test(provider.content)) { status = 'partial_success'; warnings.push('检测到明显重复文本，请人工复核。'); }
      let structuredData = null;
      if (input.expectStructured) {
        try { structuredData = JSON.parse(provider.content); } catch { status = 'partial_success'; warnings.push('结构化响应格式不符合要求，请人工复核。'); }
        if (structuredData && typeof structuredData === 'object' && Object.values(structuredData).every(value => value == null || value === '')) { status = 'partial_success'; warnings.push('结构化字段全部为空。'); }
      }
      const result = responseShape({ ...base, mode: 'live', status, content: provider.content, structuredData, inputTokens, outputTokens, totalTokens, estimatedCost: costControl.estimateCost({ model: config.model, inputTokens, outputTokens, cachedInputTokens }), durationMs: Date.now() - startedAt, retryCount: attempt, budgetStatus: budget.status, warnings });
      registerSuccess(createdAt);
      recordOutcome(input, result, { errorSignature: provider.finishReason === 'length' ? 'deepseek-output-truncated' : '', redactionCount: protectedPayload.total });
      try {
        costControl.cacheSet({ cacheKey: key, enterpriseId: input.enterpriseId, userScope: `${input.userId}:${input.role || ''}`, module: input.module || 'general', taskType: input.taskType || 'chat', provider: config.provider, model: config.model, mode: 'live', payload: result, sensitive: protectedPayload.total > 0, createdAt });
      } catch (error) {
        if (input.enterpriseId) logService.add({ enterpriseId: input.enterpriseId, userId: input.userId, type: 'ai_error', title: 'deepseek-cache-error', detail: 'AI 缓存写入失败，本次结果未缓存。' });
      }
      logger.info('AI Gateway 完成', { requestId: requestIdValue, enterpriseId: input.enterpriseId, userId: input.userId, module: input.module, provider: config.provider, model: config.model, status, totalTokens, estimatedCost: result.estimatedCost, durationMs: result.durationMs, retryCount: attempt, redactionCount: protectedPayload.total });
      return result;
    } catch (error) {
      lastError = error;
      const classified = classifyError(error);
      if (!classified.retryable || attempt >= maxRetries) break;
      await sleep(Number(runtime.retryDelayMs ?? 200));
    }
  }
  registerFailure(lastError, startedAt);
  const classified = classifyError(lastError);
  const result = responseShape({ ...base, mode: circuit.state === 'open' ? 'degraded' : 'live', status: classified.status, durationMs: Date.now() - startedAt, retryCount: attempt, budgetStatus: budget.status, errors: [sanitizeErrorMessage(lastError)] });
  recordOutcome(input, result, { errorSignature: classified.signature, redactionCount: protectedPayload.total });
  logger.error('AI Gateway 失败', { requestId: requestIdValue, enterpriseId: input.enterpriseId, userId: input.userId, module: input.module, provider: config.provider, model: config.model, status: result.status, signature: classified.signature, retryCount: result.retryCount, errorMessage: result.errors[0] });
  return result;
}

function getStatus(context = {}) {
  const stats = costControl.usage(context);
  const enabled = Boolean(env.deepseekApiKey);
  return {
    provider: 'deepseek', mode: enabled ? (circuitState() === 'open' ? 'circuit_open' : 'live') : 'disabled', enabled,
    model: env.deepseekModel, healthy: enabled && circuitState() !== 'open', timeoutMs: env.deepseekTimeoutMs,
    maxOutputTokens: env.deepseekMaxOutputTokens, maxContextTokens: env.deepseekMaxContextTokens, budgetStatus: stats.budget.status, lastCallAt: circuit.lastCallAt,
    lastSuccessAt: circuit.lastSuccessAt, recentError: circuit.lastError, circuit: { state: circuitState(), failures: circuit.failures },
    cache: { enabled: env.deepseekCacheTtlSeconds > 0, ttlSeconds: env.deepseekCacheTtlSeconds }, usage: stats
  };
}

function resetCircuitForTests() { circuit.failures = 0; circuit.openedAt = 0; circuit.state = 'closed'; circuit.lastSuccessAt = ''; circuit.lastError = ''; circuit.lastCallAt = ''; }

module.exports = { chat, getStatus, resolveProviderConfig, resolveEndpoint, sanitizeErrorMessage, extractResponseText, isRetryable, classifyError, responseShape, resetCircuitForTests, _circuit: circuit };
