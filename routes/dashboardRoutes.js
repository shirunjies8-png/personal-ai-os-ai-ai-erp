const express = require('express');
const controller = require('../controllers/dashboardController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.get('/', authRequired, controller.getDashboard);

module.exports = router;
