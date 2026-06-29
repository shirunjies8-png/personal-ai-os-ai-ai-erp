const express = require('express');
const controller = require('../controllers/feedbackController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.get('/', authRequired, controller.listFeedback);
router.post('/', authRequired, controller.createFeedback);

module.exports = router;
