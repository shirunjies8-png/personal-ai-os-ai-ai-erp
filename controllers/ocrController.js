const { ok, fail } = require('../utils/response');
const rapidOcrService = require('../services/rapidOcrService');

function rapidOcrReadiness(_req, res) {
  ok(res, rapidOcrService.readiness(), 'RapidOCR readiness 已读取');
}

async function recognizeRapidOcr(req, res) {
  try {
    const encoded = String(req.body?.imageBase64 || '');
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      return fail(res, 400, 'OCR 图片内容无效', { code: 'INPUT_IDENTITY_BLOCKED' });
    }
    const result = await rapidOcrService.recognize({
      buffer: Buffer.from(encoded, 'base64'),
      mimeType: String(req.body?.mimeType || ''),
      inputHash: String(req.body?.inputHash || ''),
      classification: String(req.body?.classification || ''),
      placement: String(req.body?.placement || ''),
    });
    return ok(res, result, 'RapidOCR 本地识别完成');
  } catch (error) {
    return fail(res, error.status || 500, error.message || 'RapidOCR 识别失败', { code: error.code || 'OCR_EXECUTION_FAILED', ...(error.detail || {}) });
  }
}

module.exports = { rapidOcrReadiness, recognizeRapidOcr };
