const { completeChat } = require('../services/aiService');
const env = require('../config/env');
const { fail } = require('../utils/response');

async function chat(req, res) {
  try {
    const result = await completeChat({
      messages: req.body.messages,
      moduleName: req.body.module || 'default',
      model: req.body.model || env.deepseekModel || 'deepseek-v4-flash',
      temperature: req.body.temperature ?? 0.2,
      maxTokens: req.body.max_tokens ?? 2048,
      timeout: req.body.timeout ?? 30000,
      apiKey: req.body.apiKey,
      baseUrl: req.body.providerBaseUrl
    });
    res.json({ ok: true, reply: result.reply });
  } catch (error) {
    fail(res, error.status || 500, error.message);
  }
}

module.exports = {
  chat
};
