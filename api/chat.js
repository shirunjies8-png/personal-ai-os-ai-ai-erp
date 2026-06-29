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
      model: req.body?.model || 'deepseek-chat',
      temperature: req.body?.temperature ?? 0.2
    });
    return res.status(200).json({ ok: true, reply: result.reply });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || 'AI 调用失败'
    });
  }
};
