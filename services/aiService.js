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

async function completeChat({ messages, moduleName = 'default', model = 'deepseek-chat', temperature = 0.2 }) {
  if (!env.deepseekApiKey) {
    const error = new Error('当前未连接 AI 后端，请部署 Vercel 并配置 DEEPSEEK_API_KEY。');
    error.status = 503;
    throw error;
  }
  const normalizedMessages = Array.isArray(messages) && messages.length
    ? messages
    : [{ role: 'user', content: '' }];
  const payload = {
    model,
    temperature,
    messages: [
      { role: 'system', content: getSystemPrompt(moduleName) },
      ...normalizedMessages
    ]
  };
  let response;
  try {
    response = await fetch(`${env.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.deepseekApiKey}`
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const wrapped = new Error(`AI 后端连接失败：${error.message}`);
    wrapped.status = 502;
    throw wrapped;
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `DeepSeek HTTP ${response.status}`;
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
  getSystemPrompt
};
