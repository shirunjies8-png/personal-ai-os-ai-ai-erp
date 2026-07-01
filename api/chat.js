const env = require('../config/env');
const { completeChat } = require('../services/aiService');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  try {
    const result = await completeChat({
      messages: req.body?.messages,
      moduleName: req.body?.module || 'default',
      model: req.body?.model || env.deepseekModel || 'deepseek-v4-flash',
      temperature: req.body?.temperature ?? 0.2,
      maxTokens: req.body?.max_tokens ?? 2048,
      timeout: req.body?.timeout ?? 30000,
      apiKey: req.body?.apiKey,
      baseUrl: req.body?.providerBaseUrl
    });
    return res.status(200).json({ ok: true, reply: result.reply });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || '当前未配置 DeepSeek API Key，无法调用真实 AI。'
    });
  }
};
