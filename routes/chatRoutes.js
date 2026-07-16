const express = require('express');
const { chat } = require('../controllers/chatController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/', authRequired, chat);

module.exports = router;
