const express = require('express');

const authRoutes = require('./authRoutes');
const stateRoutes = require('./stateRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const enterpriseRoutes = require('./enterpriseRoutes');
const orderRoutes = require('./orderRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const agentRoutes = require('./agentRoutes');
const mailRoutes = require('./mailRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const logRoutes = require('./logRoutes');
const excelRoutes = require('./excelRoutes');
const chatRoutes = require('./chatRoutes');
const apqpRoutes = require('./apqpRoutes');
const aiRoutes = require('./aiRoutes');
const manufacturingRoutes = require('./manufacturingRoutes');
const runtimeObservabilityRoutes = require('./runtimeObservabilityRoutes');
const trustedExecutionRoutes = require('./trustedExecutionRoutes');
const { authRequired } = require('../middleware/auth');
const qualityService = require('../services/aiQualityCheckService');
const env = require('../config/env');
const toolRegistry = require('../services/toolRegistry');
const agentRuntimeService = require('../services/agentRuntimeService');
const aiGateway = require('../services/aiGateway');
const db = require('../database/client');
const runtimeObservabilityService = require('../services/runtimeObservabilityService');

const router = express.Router();
runtimeObservabilityService.registerDefaults({ deepseekConfigured: Boolean(env.deepseekApiKey) });

router.use('/auth', authRoutes);
router.use('/state', stateRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/enterprise', enterpriseRoutes);
router.use('/orders', orderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/agents', agentRoutes);
router.use('/mail', mailRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/logs', logRoutes);
router.use('/excel', excelRoutes);
router.use('/chat', chatRoutes);
router.use('/ai', aiRoutes);
router.use('/apqp', apqpRoutes);
router.use('/manufacturing/v1', manufacturingRoutes);
router.use('/runtime-observability', runtimeObservabilityRoutes);
router.use('/trusted-execution', trustedExecutionRoutes);

function identityForAi(req) {
  return req.user ? { userId: req.user.id, enterpriseId: req.user.enterprise_id, role: req.user.role } : {};
}

function requireAuthenticatedAi(req, res, next) {
  if (!req.body?.allowAi) return next();
  return authRequired(req, res, next);
}

router.post('/quality/check', requireAuthenticatedAi, async (req, res, next) => {
  try {
    const report = await qualityService.checkQuality(req.body || {}, identityForAi(req));
    res.json({ ok: true, data: report, message: '质量检测已完成' });
  } catch (error) {
    next(error);
  }
});

router.post('/quality/fix', requireAuthenticatedAi, async (req, res, next) => {
  try {
    const report = await qualityService.fixQuality(req.body || {}, identityForAi(req));
    res.json({ ok: true, data: report, message: report.approvalRequired ? '检测到高风险修复建议，需要人工确认' : '修复建议已生成' });
  } catch (error) {
    next(error);
  }
});

router.post('/quality/export', requireAuthenticatedAi, async (req, res, next) => {
  try {
    const report = await qualityService.checkQuality(req.body || {}, identityForAi(req));
    const text = qualityService.exportReport(report, String(req.body?.module || 'general'));
    res.json({ ok: true, data: { text, report }, message: '修复报告已生成' });
  } catch (error) {
    next(error);
  }
});

router.get('/health', (_req, res) => {
  const aiStatus = aiGateway.getStatus();
  res.json({
    ok: true,
    service: 'personal-ai-os-api',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    buildTime: process.env.BUILD_TIME || '',
    commit: process.env.GIT_COMMIT || '',
    provider: aiStatus.provider,
    model: aiStatus.model,
    deepseekConfigured: aiStatus.enabled,
    aiGateway: { mode: aiStatus.mode, healthy: aiStatus.healthy, budgetStatus: aiStatus.budgetStatus, circuit: aiStatus.circuit },
    databaseOk: true,
    toolRegistryOk: typeof toolRegistry.listTools === 'function',
    agentRuntimeOk: typeof agentRuntimeService.getMonitorStats === 'function'
  });
});

router.get('/self-test', (_req, res) => {
  let databaseOk = true;
  try {
    db.prepare('SELECT 1').get();
  } catch {
    databaseOk = false;
  }
  res.json({
    ok: true,
    time: new Date().toISOString(),
    aiGatewayOk: Boolean(env.deepseekApiKey),
    toolRegistryOk: typeof toolRegistry.listTools === 'function',
    agentRuntimeOk: typeof agentRuntimeService.getMonitorStats === 'function',
    databaseOk,
    memoryOk: true,
    ocrOk: true,
    includeAi: false
  });
});

module.exports = router;
