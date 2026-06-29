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

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'personal-ai-os-api', time: new Date().toISOString() });
});

module.exports = router;
