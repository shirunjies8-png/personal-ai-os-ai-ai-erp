const express = require('express');
const controller = require('../controllers/stateController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, controller.getState);
router.put('/', authRequired, controller.saveState);

module.exports = router;
