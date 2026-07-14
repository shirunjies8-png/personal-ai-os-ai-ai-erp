const logger = require('../utils/logger');
const { fail } = require('../utils/response');

function errorHandler(error, req, res, _next) {
  logger.error(error.message, { path: req.path, stack: error.stack });
  const raw = String(logger.sanitize(error.message || ''));
  let message = raw || '服务器内部错误';
  if (error.code === 'LIMIT_FILE_SIZE') message = '文件过大，请上传不超过 20MB 的文件。';
  else if (/Unexpected field|invalid file|unsupported|not supported/i.test(raw)) message = '文件格式不支持，请检查文件类型后重试。';
  else if (/fetch|network|ECONN|ENOTFOUND/i.test(raw)) message = '网络连接失败，请检查服务或网络状态。';
  else if (/JSON|parse|unexpected token|invalid/i.test(raw)) message = '请求或文件内容无法解析，请检查格式后重试。';
  else if ((error.status || 500) >= 500 && /TypeError|ReferenceError|Cannot read|undefined|null/i.test(raw)) message = '服务器处理失败，请稍后重试。';
  fail(res, error.status || 500, message, null);
}

module.exports = errorHandler;
