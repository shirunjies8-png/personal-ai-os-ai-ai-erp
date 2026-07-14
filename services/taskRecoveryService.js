const { classifyFailure } = require('./toolRegistry');

function recoveryPlan(error = '', retryCount = 0) {
  const type = classifyFailure(error);
  const retryable = ['timeout', 'network'].includes(type) && Number(retryCount) < 2;
  return { failureType: type || 'runtime', retryable, action: retryable ? 'retry_with_backoff' : 'stop_and_report' };
}
module.exports = { recoveryPlan };
