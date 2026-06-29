const { completeChat } = require('../services/aiService');
const { fail } = require('../utils/response');

async function chat(req, res) {
  try {
    const result = await completeChat({
      messages: req.body.messages,
      moduleName: req.body.module || 'default',
      model: req.body.model || 'deepseek-chat',
      temperature: req.body.temperature ?? 0.2
    });
    res.json({ ok: true, reply: result.reply });
  } catch (error) {
    fail(res, error.status || 500, error.message);
  }
}

module.exports = {
  chat
};
