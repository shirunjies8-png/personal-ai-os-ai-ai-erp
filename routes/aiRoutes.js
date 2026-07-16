const express = require('express');
const controller = require('../controllers/aiController');
const { authRequired } = require('../middleware/auth');
const env = require('../config/env');

const router = express.Router();
const ipWindows = new Map();

function aiRequestGuard(req, res, next) {
  if (['POST', 'PATCH', 'PUT'].includes(req.method) && !String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    return res.status(415).json({ ok: false, message: 'AI 网关只接受 application/json 请求。' });
  }
  const now = Date.now();
  const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
  const windowStart = now - 60 * 1000;
  const hits = (ipWindows.get(key) || []).filter(time => time >= windowStart);
  if (hits.length >= env.aiIpRateLimit) return res.status(429).json({ ok: false, message: '当前 IP 请求过于频繁，请稍后重试。' });
  hits.push(now);
  ipWindows.set(key, hits);
  return next();
}

router.use(aiRequestGuard);
router.use(authRequired);
router.post('/chat', controller.execute('chat'));
router.post('/generate', controller.execute('generate'));
router.post('/correct', controller.execute('correct'));
router.post('/structure', controller.execute('structure'));
router.post('/summarize', controller.execute('summarize'));
router.post('/risk-review', controller.execute('risk-review'));
router.get('/health', controller.health);
router.get('/usage', controller.usage);
router.get('/config-safe', controller.configSafe);
router.delete('/cache', controller.deleteCache);

module.exports = router;
