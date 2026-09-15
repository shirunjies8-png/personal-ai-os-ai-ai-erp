const express = require('express');
const { authRequired } = require('../middleware/auth');
const controller = require('../controllers/ocrController');

const router = express.Router();

router.use(authRequired);
router.get('/providers/rapidocr-local/readiness', controller.rapidOcrReadiness);
router.post('/providers/rapidocr-local/recognize', controller.recognizeRapidOcr);

module.exports = router;
