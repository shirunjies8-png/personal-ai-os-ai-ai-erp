const express = require('express');
const controller = require('../controllers/aiController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
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
