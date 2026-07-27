const express = require('express');
const controller = require('../controllers/runtimeObservabilityController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.get('/components', authRequired, controller.list);
router.get('/runs', authRequired, controller.list);
router.get('/runs/:id', authRequired, controller.get);
router.post('/runs', authRequired, controller.start);
router.patch('/runs/:id', authRequired, controller.finish);
module.exports = router;
