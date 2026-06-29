const { ok } = require('../utils/response');
const { parseWorkbook } = require('../services/excelService');

function parseExcel(req, res) {
  if (!req.file) return res.status(400).json({ ok: false, message: '请上传 Excel 文件' });
  const parsed = parseWorkbook(req.file.buffer);
  ok(res, { parsed }, 'Excel 已解析');
}

module.exports = {
  parseExcel
};
