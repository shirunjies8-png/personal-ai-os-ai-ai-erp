const logger = require('../utils/logger');
const { fail } = require('../utils/response');

function errorHandler(error, req, res, _next) {
  logger.error(error.message, { path: req.path, stack: error.stack });
  fail(res, error.status || 500, error.message || '服务器内部错误', error.detail || null);
}

module.exports = errorHandler;
