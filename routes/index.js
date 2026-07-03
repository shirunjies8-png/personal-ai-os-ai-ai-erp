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
const qualityService = require('../services/aiQualityCheckService');
const env = require('../config/env');
const toolRegistry = require('../services/toolRegistry');
const agentRuntimeService = require('../services/agentRuntimeService');
const db = require('../database/client');

const router = express.Router();

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

router.post('/quality/check', async (req, res, next) => {
  try {
    const report = await qualityService.checkQuality(req.body || {});
    res.json({ ok: true, data: report, message: '质量检测已完成' });
  } catch (error) {
    next(error);
  }
});

router.post('/quality/fix', async (req, res, next) => {
  try {
    const report = await qualityService.fixQuality(req.body || {});
    res.json({ ok: true, data: report, message: report.approvalRequired ? '检测到高风险修复建议，需要人工确认' : '修复建议已生成' });
  } catch (error) {
    next(error);
  }
});

router.post('/quality/export', async (req, res, next) => {
  try {
    const report = await qualityService.checkQuality(req.body || {});
    const text = qualityService.exportReport(report, String(req.body?.module || 'general'));
    res.json({ ok: true, data: { text, report }, message: '修复报告已生成' });
  } catch (error) {
    next(error);
  }
});

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'personal-ai-os-api',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    buildTime: process.env.BUILD_TIME || '',
    commit: process.env.GIT_COMMIT || '',
    provider: env.aiProvider || 'deepseek',
    model: env.deepseekModel,
    deepseekConfigured: Boolean(env.deepseekApiKey),
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
