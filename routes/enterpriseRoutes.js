const express = require('express');
const controller = require('../controllers/enterpriseController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.get('/', authRequired, controller.getEnterprise);
router.put('/', authRequired, controller.updateEnterprise);

module.exports = router;
