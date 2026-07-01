const env = require('../config/env');

const MODULE_SYSTEM_PROMPTS = {
  'ai-chat': '你是企业办公 AI 助手。回答要直接、可执行、准确。',
  'ai-office-writing': '你是企业办公写作助手。必须保留客户、产品、数量、交期、付款方式等关键字段，并输出正式文稿。',
  'ai-sql': '你是 SQL 助手。根据自然语言生成准确 SQL，并给出解释、优化建议和索引建议。',
  'ai-pdf': '你是 PDF 文档分析助手。请提取摘要、重点、风险、关键数据和建议。',
  assistant: '你是企业 AI 助手中心的总入口，擅长结合订单、库存、邮件、知识库给出综合建议。',
  'agentic-rl': '你是 Agentic RL 执行器。请先拆解，再逐步执行，输出清晰、结构化、可复用的结果。',
  'chip-assistant': '你是芯片助理，擅长 Verilog、RTL、Testbench、RISC-V、FPGA 和 ASIC 相关问题。',
  default: '你是企业人工智能操作系统中的严谨中文助手。回答必须真实、可执行、避免空泛。'
};

function getSystemPrompt(moduleName = 'default') {
  return MODULE_SYSTEM_PROMPTS[moduleName] || MODULE_SYSTEM_PROMPTS.default;
}

function resolveChatEndpoint(baseUrl = '') {
  const normalized = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!normalized) return '';
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  if (/\/v1$/i.test(normalized)) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function friendlyDeepSeekError(error = {}) {
  const text = String(error.message || error || '');
  if (/DEEPSEEK_API_KEY|未配置.*API Key|missing api key/i.test(text)) return '当前未配置 DeepSeek API Key，无法调用真实 AI。';
  if (/401|unauthorized|invalid api key|authentication/i.test(text)) return 'DeepSeek API Key 无效或无权限，请检查配置。';
  if (/402|balance|insufficient|credit/i.test(text)) return 'DeepSeek 余额不足或额度已用完。';
  if (/404|model|not found|unsupported/i.test(text)) return '当前模型不可用，请检查 DEEPSEEK_MODEL。';
  if (/AbortError|timeout|超时/i.test(text)) return 'DeepSeek 请求超时，请稍后重试。';
  if (/fetch|network|ENOTFOUND|ECONN/i.test(text)) return 'DeepSeek 网络错误，请检查网络或 Base URL。';
  return text || 'DeepSeek 调用失败';
}

async function completeChat({ messages, moduleName = 'default', model = env.deepseekModel || 'deepseek-v4-flash', temperature = 0.2, maxTokens = 2048, timeout = 30000, apiKey, baseUrl }) {
  const effectiveKey = apiKey || env.deepseekApiKey;
  const effectiveBaseUrl = String(baseUrl || env.deepseekBaseUrl || '').replace(/\/$/, '');
  if (!effectiveKey) {
    const error = new Error('当前未配置 DeepSeek API Key，无法调用真实 AI。');
    error.status = 503;
    throw error;
  }
  const normalizedMessages = Array.isArray(messages) && messages.length
    ? messages
    : [{ role: 'user', content: '' }];
  const payload = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: getSystemPrompt(moduleName) },
      ...normalizedMessages
    ]
  };
  let response;
  try {
    if (!/^https:\/\//i.test(effectiveBaseUrl) && !/^http:\/\/127\.0\.0\.1(?::\d+)?/i.test(effectiveBaseUrl)) {
      const invalid = new Error('Base URL 必须使用 HTTPS');
      invalid.status = 400;
      throw invalid;
    }
    response = await fetch(resolveChatEndpoint(effectiveBaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveKey}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Math.max(1000, Number(timeout || 30000)))
    });
  } catch (error) {
    const wrapped = new Error(error?.name === 'TimeoutError' ? 'AI 请求超时' : `AI 后端连接失败：${error.message}`);
    wrapped.status = 502;
    throw wrapped;
  }
  const readResponse = async res => {
    const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
    const text = await res.text();
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
  };
  const { raw, json: data } = await readResponse(response);
  if (!response.ok) {
    const message = friendlyDeepSeekError(data?.error?.message || data?.message || raw || `DeepSeek HTTP ${response.status}`);
    const error = new Error(message);
    error.status = response.status >= 500 ? 502 : response.status;
    throw error;
  }
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const error = new Error('模型返回为空');
    error.status = 502;
    throw error;
  }
  return {
    reply: text,
    raw: data
  };
}

module.exports = {
  completeChat,
  getSystemPrompt,
  friendlyDeepSeekError,
  resolveChatEndpoint
};
