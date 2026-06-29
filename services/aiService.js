const env = require('../config/env');

async function complete(prompt, options = {}) {
  if (!env.deepseekApiKey) {
    return {
      mode: 'mock',
      text: `AI模拟结果：${String(prompt).slice(0, 240)}`
    };
  }
  const response = await fetch(`${env.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.deepseekApiKey}`
    },
    body: JSON.stringify({
      model: options.model || 'deepseek-chat',
      temperature: options.temperature ?? 0.2,
      messages: [
        { role: 'system', content: '你是企业办公 AI 助手。' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
  const data = await response.json();
  return {
    mode: 'deepseek',
    text: data.choices?.[0]?.message?.content || ''
  };
}

module.exports = {
  complete
};
