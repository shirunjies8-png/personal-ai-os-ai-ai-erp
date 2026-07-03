const { ok } = require('../utils/response');
const { parseWorkbook } = require('../services/excelService');

function parseExcel(req, res, next) {
  if (!req.file) return res.status(400).json({ ok: false, message: '请上传 Excel 文件' });
  try {
    const parsed = parseWorkbook(req.file.buffer);
    ok(res, { parsed }, 'Excel 已解析');
  } catch (error) {
    error.status = 400;
    error.message = 'Excel 文件无法解析，请确认文件未损坏且格式正确。';
    next(error);
  }
}

module.exports = {
  parseExcel
};
