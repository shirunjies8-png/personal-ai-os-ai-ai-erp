'use strict';
const express = require('express');
const controller = require('../controllers/valveTenderWorkbenchController');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();
router.use(authRequired);
router.use(adminRequired);
router.get('/reference-workbench', controller.get);
module.exports = router;
