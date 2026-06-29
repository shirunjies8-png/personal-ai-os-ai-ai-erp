const express = require('express');
const controller = require('../controllers/logController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.get('/', authRequired, controller.listLogs);

module.exports = router;
