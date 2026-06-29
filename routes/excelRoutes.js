const express = require('express');
const multer = require('multer');
const controller = require('../controllers/excelController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/parse', authRequired, upload.single('file'), controller.parseExcel);

module.exports = router;
