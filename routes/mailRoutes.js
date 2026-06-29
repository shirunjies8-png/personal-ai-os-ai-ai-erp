const express = require('express');
const controller = require('../controllers/mailController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.get('/test', authRequired, controller.testConnection);
router.get('/inbox', authRequired, controller.listInbox);
router.get('/records', authRequired, controller.listRecords);
router.post('/send', authRequired, controller.send);

module.exports = router;
