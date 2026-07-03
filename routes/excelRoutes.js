const express = require('express');
const multer = require('multer');
const controller = require('../controllers/excelController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const allowedExtensions = /\.(xlsx|xls|csv|tsv)$/i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedExtensions.test(file.originalname || '')) {
      const error = new Error('文件格式不支持，请上传 XLSX、XLS、CSV 或 TSV 文件。');
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  }
});

router.post('/parse', authRequired, upload.single('file'), controller.parseExcel);

module.exports = router;
