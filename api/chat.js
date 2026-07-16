const aiGateway = require('../services/aiGateway');
const { verifyToken } = require('../utils/jwt');
const userModel = require('../models/userModel');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'http://127.0.0.1:3000');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  try {
    const authorization = String(req.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) return res.status(401).json({ ok: false, message: '请先登录' });
    const decoded = verifyToken(authorization.slice(7));
    const user = userModel.findById(decoded.userId);
    if (!user) return res.status(401).json({ ok: false, message: '登录已失效' });
    const result = await aiGateway.chat({
      messages: req.body?.messages,
      provider: req.body?.demoMode ? 'mock' : 'deepseek',
      demoMode: Boolean(req.body?.demoMode),
      module: String(req.body?.module || 'general').slice(0, 60),
      taskType: 'chat', userId: user.id, enterpriseId: user.enterprise_id, role: user.role,
      maxTokens: req.body?.max_tokens, timeout: req.body?.timeout,
      sensitiveMode: req.body?.sensitiveMode || 'mask', sensitiveConfirmed: req.body?.sensitiveConfirmed === true,
      highCostConfirmed: false, forceRegenerate: Boolean(req.body?.forceRegenerate)
    });
    const ok = ['success', 'partial_success', 'mock_completed'].includes(result.status);
    return res.status(ok ? 200 : result.status === 'disabled' ? 503 : result.status === 'budget_blocked' ? 429 : 502).json({ ok, data: result, ...result });
  } catch {
    return res.status(500).json({ ok: false, message: 'AI 网关处理失败' });
  }
};
