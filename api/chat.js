const env = require('../config/env');
const { complete } = require('../services/aiService');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  try {
    const result = await complete({
      messages: req.body?.messages,
      moduleName: req.body?.module || 'default',
      model: req.body?.model || env.deepseekModel || 'deepseek-v4-flash',
      temperature: req.body?.temperature ?? 0.2,
      maxTokens: req.body?.max_tokens ?? 2048,
      timeout: req.body?.timeout ?? 30000,
      provider: req.body?.provider || env.aiProvider || 'deepseek',
      baseUrl: req.body?.providerBaseUrl || env.deepseekBaseUrl,
      demoMode: Boolean(req.body?.demoMode),
      allowMockFallback: req.body?.allowMockFallback !== false
    });
    return res.status(200).json({
      ok: true,
      reply: result.text,
      text: result.text,
      provider: result.provider || req.body?.provider || env.aiProvider || 'deepseek',
      model: result.model || req.body?.model || env.deepseekModel || 'deepseek-v4-flash',
      requestId: result.requestId || '',
      httpStatus: result.httpStatus || 200,
      promptTokens: result.usage?.prompt_tokens || 0,
      completionTokens: result.usage?.completion_tokens || 0,
      totalTokens: result.usage?.total_tokens || 0,
      rawError: result.rawError || '',
      latencyMs: result.latencyMs || 0,
      mock: result.mode === 'mock'
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || '当前未配置 DeepSeek API Key，无法调用真实 AI。'
    });
  }
};
