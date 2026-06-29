const logger = require('../utils/logger');
const { fail } = require('../utils/response');

function errorHandler(error, req, res, _next) {
  logger.error(error.message, { path: req.path, stack: error.stack });
  fail(res, 500, '服务器内部错误', error.message);
}

module.exports = errorHandler;
