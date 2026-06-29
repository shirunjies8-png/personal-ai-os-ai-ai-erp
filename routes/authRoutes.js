const express = require('express');
const controller = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', authRequired, controller.me);
router.post('/change-password', authRequired, controller.changePassword);

module.exports = router;
