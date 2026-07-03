const { complete } = require('../services/aiService');
const env = require('../config/env');
const { fail } = require('../utils/response');

async function chat(req, res) {
  try {
    const result = await complete({
      messages: req.body.messages,
      moduleName: req.body.module || 'default',
      model: req.body.model || env.deepseekModel || 'deepseek-v4-flash',
      temperature: req.body.temperature ?? 0.2,
      maxTokens: req.body.max_tokens ?? 2048,
      timeout: req.body.timeout ?? 30000,
      provider: req.body.provider || env.aiProvider || 'deepseek',
      baseUrl: req.body.providerBaseUrl || env.deepseekBaseUrl,
      demoMode: Boolean(req.body.demoMode),
      allowMockFallback: req.body.allowMockFallback !== false
    });
    res.json({
      ok: true,
      reply: result.text,
      text: result.text,
      provider: result.provider || req.body.provider || env.aiProvider || 'deepseek',
      model: result.model || req.body.model || env.deepseekModel || 'deepseek-v4-flash',
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
    fail(res, error.status || 500, error.message);
  }
}

module.exports = {
  chat
};
