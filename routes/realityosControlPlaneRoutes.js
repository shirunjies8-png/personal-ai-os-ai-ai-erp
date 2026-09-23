'use strict';

const express = require('express');
const controller = require('../controllers/realityosControlPlaneController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);
router.get('/', controller.list);
router.get('/runs/:id', controller.getRun);

module.exports = router;
