const express = require('express');
const controller = require('../controllers/agentController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.post('/run', authRequired, controller.createTask);
router.post('/tasks', authRequired, controller.createTask);
router.post('/8d', authRequired, controller.create8DTask);
router.get('/tasks', authRequired, controller.listTasks);
router.get('/tasks/:id', authRequired, controller.getTask);
router.post('/tasks/:id/approve', authRequired, controller.approveTask);
router.post('/tasks/:id/cancel', authRequired, controller.cancelTask);
router.post('/tasks/:id/retry', authRequired, controller.retryTask);
router.get('/tools', authRequired, controller.listTools);
router.post('/tools/:name/execute', authRequired, controller.executeRuntimeTool);
router.get('/monitor', authRequired, controller.monitor);
router.get('/memory', authRequired, controller.listMemory);
router.post('/memory/clear', authRequired, controller.clearMemory);

module.exports = router;
