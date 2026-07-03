const env = require('../config/env');
const logger = require('../logger');
const { maybeRunTool } = require('./toolRegistry');

function requestId(prefix = 'ai') {
  return logger.requestId(prefix);
}

function resolveProviderConfig(input = {}) {
  const rawProvider = String(input.provider || env.aiProvider || 'deepseek').toLowerCase();
  const provider = /mock|本地/.test(rawProvider)
    ? 'mock'
    : /qwen|通义/.test(rawProvider)
      ? 'qwen'
      : /openai/.test(rawProvider)
        ? 'openai_compatible'
        : 'deepseek';
  const modelByProvider = {
    mock: input.model || env.deepseekModel || 'deepseek-v4-flash',
    deepseek: input.model || env.deepseekModel || 'deepseek-v4-flash',
    openai_compatible: input.model || env.openaiModel || env.deepseekModel || 'deepseek-v4-flash',
    qwen: input.model || env.qwenModel || 'qwen-plus'
  };
  const baseUrlByProvider = {
    mock: '',
    deepseek: input.baseUrl || env.deepseekBaseUrl || 'https://api.deepseek.com',
    openai_compatible: input.baseUrl || env.openaiBaseUrl || env.deepseekBaseUrl || 'https://api.deepseek.com',
    qwen: input.baseUrl || env.qwenBaseUrl || env.deepseekBaseUrl || 'https://api.deepseek.com'
  };
  return {
    provider,
    model: modelByProvider[provider] || input.model || env.deepseekModel || 'deepseek-v4-flash',
    baseUrl: String(baseUrlByProvider[provider] || '').trim().replace(/\/$/, ''),
    apiKey: provider === 'mock' ? '' : String(input.apiKey || env.deepseekApiKey || '').trim()
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
  const text = String(error.message || error || '');
  if (/DEEPSEEK_API_KEY|未配置.*API Key|missing api key/i.test(text)) return '当前未配置 DeepSeek API Key，无法调用真实 AI。';
  if (/401|unauthorized|invalid api key|authentication/i.test(text)) return 'DeepSeek API Key 无效或无权限，请检查配置。';
  if (/402|balance|insufficient|credit/i.test(text)) return 'DeepSeek 余额不足或额度已用完。';
  if (/404|model|not found|unsupported/i.test(text)) return '当前模型不可用，请检查模型名称或权限。';
  if (/AbortError|timeout|超时/i.test(text)) return 'AI 请求超时，请稍后重试。';
  if (/fetch|network|ENOTFOUND|ECONN/i.test(text)) return 'AI 后端连接失败，请检查网络或 Base URL。';
  if (/429|503|502|504/i.test(text)) return '当前 AI 模型繁忙，请稍后重试。';
  return text || 'AI 调用失败';
}

function extractResponseText(data = {}) {
  const choice = data?.choices?.[0];
  const candidates = [
    choice?.message?.content,
    choice?.delta?.content,
    choice?.message?.reasoning_content,
    choice?.reasoning_content,
    choice?.text,
    data?.output_text,
    data?.text,
    data?.message?.content,
    data?.message,
    data?.response?.output_text,
    data?.response?.text,
    data?.response?.message?.content,
    data?.response
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (Array.isArray(candidate)) {
      const value = candidate.map(item => {
        if (typeof item === 'string') return item;
        return item?.text || item?.content || item?.output_text || '';
      }).filter(Boolean).join('\n').trim();
      if (value) return value;
    }
    if (candidate && typeof candidate === 'object') {
      const value = candidate.content || candidate.text || candidate.output_text || candidate.message?.content || candidate.delta?.content || '';
      if (String(value || '').trim()) return String(value).trim();
    }
  }
  return '';
}

async function readResponse(response) {
  const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
  const text = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return { raw: text, json: JSON.parse(text) };
    } catch {
      return { raw: text, json: null };
    }
  }
  try {
    return { raw: text, json: JSON.parse(text) };
  } catch {
    return { raw: text, json: null };
  }
}

function isRetryable(error = {}) {
  const text = String(error.message || error || '');
  return /Selected model is at capacity|Rate limit exceeded|\b429\b|\b502\b|\b503\b|\b504\b|Timeout|Network Error|AI 后端连接失败/i.test(text);
}

function buildMockReply(messages = [], module = 'general', reason = 'AI Gateway 未启用，当前使用 Mock 兜底。') {
  const last = [...messages].reverse().find(item => String(item.role || '') === 'user')?.content || '';
  const base = last ? `已接收任务：${last.slice(0, 120)}` : '已接收任务。';
  const lines = [
    '当前为演示模式，已使用内置演示数据生成结果。',
    '如需真实AI，请配置 Vercel + DEEPSEEK_API_KEY。',
    `模块：${module}`,
    `原因：${reason}`,
    '',
    base,
    '',
    '建议：请结合真实业务数据后再执行关键操作。'
  ];
  return lines.join('\n');
}

function resolveMockFallback(input = {}, messages = [], reason = '') {
  if (typeof input.mockFallback === 'function') return String(input.mockFallback(reason));
  if (input.mockFallback != null) return String(input.mockFallback);
  return buildMockReply(messages, input.module || 'general', reason);
}

async function callProvider(messages = [], config = {}, options = {}) {
  if (config.provider === 'mock') {
    const content = resolveMockFallback(options, messages, options.reason || 'AI Gateway 未启用，当前使用 Mock 兜底。');
    return {
      ok: true,
      provider: 'mock',
      model: config.model,
      content,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      httpStatus: 200,
      rawError: '',
      latencyMs: 0,
      requestId: options.requestId
    };
  }
  if (!config.apiKey) {
    const error = new Error('当前未配置 DeepSeek API Key，无法调用真实 AI。');
    error.status = 503;
    throw error;
  }
  const endpoint = resolveEndpoint(config.baseUrl);
  if (!endpoint) {
    const error = new Error('AI 后端连接失败：未配置有效的 Base URL。');
    error.status = 502;
    throw error;
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP ?? 1,
      stream: Boolean(options.stream)
    }),
    signal: AbortSignal.timeout(Math.max(1000, Number(options.timeout || 30000)))
  });
  const { raw, json } = await readResponse(response);
  logger.info('AI Gateway 响应结构（已脱敏）', {
    requestId: options.requestId,
    module: options.module,
    provider: config.provider,
    model: config.model,
    httpStatus: response.status,
    hasChoices: Array.isArray(json?.choices) && json.choices.length > 0,
    choiceFields: json?.choices?.[0] && typeof json.choices[0] === 'object' ? Object.keys(json.choices[0]) : [],
    hasMessageContent: Boolean(json?.choices?.[0]?.message?.content),
    hasDeltaContent: Boolean(json?.choices?.[0]?.delta?.content),
    hasOutputText: Boolean(json?.output_text),
    hasText: Boolean(json?.text),
    hasResponse: Boolean(json?.response)
  });
  if (!response.ok) {
    const message = sanitizeErrorMessage(json?.error?.message || json?.message || raw || `DeepSeek HTTP ${response.status}`);
    const error = new Error(message);
    error.status = response.status >= 500 ? 502 : response.status;
    error.httpStatus = response.status;
    error.rawError = String(json?.error?.message || json?.message || raw || '');
    throw error;
  }
  const content = extractResponseText(json);
  if (!content) {
    const error = new Error('模型响应为空，请检查模型名称或请求格式。');
    error.status = 502;
    error.httpStatus = response.status;
    error.rawError = raw;
    throw error;
  }
  const usage = json?.usage || {};
  return {
    ok: true,
    provider: config.provider,
    model: config.model,
    content,
    promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
    totalTokens: usage.total_tokens ?? ((usage.prompt_tokens ?? usage.input_tokens ?? 0) + (usage.completion_tokens ?? usage.output_tokens ?? 0)),
    httpStatus: response.status,
    rawError: '',
    latencyMs: Number(options.latencyMs || 0),
    requestId: options.requestId,
    raw: json,
    usage
  };
}

async function chat(input = {}) {
  const requestIdValue = input.requestId || requestId('ai');
  const startedAt = Date.now();
  const providerConfig = resolveProviderConfig(input);
  const demoMode = Boolean(input.demoMode);
  const fallbackAllowed = input.allowMockFallback !== false;
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const toolResult = await maybeRunTool(messages, input.module || 'general');
  const toolContext = toolResult?.data?.summary || toolResult?.data?.preview || toolResult?.data?.message || '';
  const promptMessages = toolContext
    ? [...messages, { role: 'assistant', content: `工具调用结果：\n${typeof toolContext === 'string' ? toolContext : JSON.stringify(toolContext)}` }]
    : messages;

  logger.info('AI Gateway 请求', {
    requestId: requestIdValue,
    module: input.module || 'general',
    provider: providerConfig.provider,
    model: providerConfig.model,
    demoMode,
    fallbackAllowed,
    toolUsed: Boolean(toolResult?.ok),
    toolName: toolResult?.toolName || ''
  });

  const gatewayMode = demoMode ? 'mock' : providerConfig.provider;
  if (gatewayMode === 'mock') {
    const content = resolveMockFallback(input, promptMessages, 'AI Gateway 未启用，当前使用 Mock 兜底。');
    const latencyMs = Date.now() - startedAt;
    logger.info('AI Gateway 完成（Mock）', {
      requestId: requestIdValue,
      module: input.module || 'general',
      provider: 'mock',
      model: providerConfig.model,
      success: true,
      httpStatus: 200,
      latencyMs
    });
    return {
      ok: true,
      provider: 'mock',
      model: providerConfig.model,
      content,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      httpStatus: 200,
      rawError: '',
      latencyMs,
      requestId: requestIdValue,
      mock: true,
      usedTool: Boolean(toolResult?.ok)
    };
  }

  const retryable = [429, 500, 502, 503, 504];
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await callProvider(promptMessages, providerConfig, {
        ...input,
        requestId: requestIdValue,
        timeout: input.timeout || 30000,
        latencyMs: Date.now() - startedAt
      });
      res.latencyMs = Date.now() - startedAt;
      logger.info('AI Gateway 完成', {
        requestId: requestIdValue,
        module: input.module || 'general',
        provider: res.provider,
        model: res.model,
        success: true,
        httpStatus: res.httpStatus,
        latencyMs: res.latencyMs,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
        totalTokens: res.totalTokens,
        toolUsed: Boolean(toolResult?.ok)
      });
      return {
        ...res,
        requestId: requestIdValue,
        usedTool: Boolean(toolResult?.ok)
      };
    } catch (error) {
      lastError = error;
      const httpStatus = error.httpStatus || error.status || 500;
      logger.error('AI Gateway 失败', {
        requestId: requestIdValue,
        module: input.module || 'general',
        provider: providerConfig.provider,
        model: providerConfig.model,
        success: false,
        httpStatus,
        latencyMs: Date.now() - startedAt,
        errorMessage: sanitizeErrorMessage(error),
        rawError: String(error.rawError || error.message || error || '')
      });
      if (!retryable.includes(httpStatus) && !isRetryable(error)) break;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
    }
  }

  const rawError = String(lastError?.rawError || lastError?.message || lastError || '');
  const friendly = sanitizeErrorMessage(lastError);
  if (fallbackAllowed) {
    const content = resolveMockFallback(input, promptMessages, friendly);
    const latencyMs = Date.now() - startedAt;
    logger.info('AI Gateway 降级 Mock', {
      requestId: requestIdValue,
      module: input.module || 'general',
      provider: providerConfig.provider,
      model: providerConfig.model,
      success: true,
      httpStatus: lastError?.httpStatus || lastError?.status || 200,
      latencyMs,
      errorMessage: friendly,
      rawError
    });
    return {
      ok: true,
      provider: providerConfig.provider,
      model: providerConfig.model,
      content,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      httpStatus: lastError?.httpStatus || lastError?.status || 200,
      rawError: friendly,
      latencyMs,
      requestId: requestIdValue,
      mock: true,
      usedTool: Boolean(toolResult?.ok),
      fallbackReason: friendly
    };
  }

  const error = new Error(friendly);
  error.rawError = rawError;
  error.httpStatus = lastError?.httpStatus || lastError?.status || 500;
  error.requestId = requestIdValue;
  throw error;
}

function getStatus() {
  const stats = logger.recentAiStats();
  return {
    provider: env.aiProvider || 'deepseek',
    model: env.deepseekModel || 'deepseek-v4-flash',
    apiKeyExists: Boolean(env.deepseekApiKey),
    baseUrl: env.deepseekBaseUrl || '',
    mockFallbackEnabled: true,
    demoMode: String(process.env.DEMO_MODE || '').toLowerCase() === 'true',
    todayCount: stats.todayCount,
    todayFailedCount: stats.todayFailedCount,
    recentError: stats.lastError?.errorMessage || stats.lastError?.message || '',
    avgLatency: stats.avgLatency,
    lastRequestId: stats.latest?.requestId || '',
    lastRequestTime: stats.latest?.time || ''
  };
}

module.exports = {
  chat,
  getStatus,
  resolveProviderConfig,
  sanitizeErrorMessage,
  extractResponseText,
  isRetryable
};
