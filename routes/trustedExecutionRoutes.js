const express = require('express');
const { authRequired } = require('../middleware/auth');
const controller = require('../controllers/trustedExecutionController');
const router = express.Router();
router.post('/runs', authRequired, controller.execute);
router.get('/runs/:id', authRequired, controller.detail);
router.post('/runs/:id/approval', authRequired, controller.decide);
module.exports = router;
