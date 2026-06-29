const express = require('express');
const controller = require('../controllers/agentController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.post('/run', authRequired, controller.run);

module.exports = router;
