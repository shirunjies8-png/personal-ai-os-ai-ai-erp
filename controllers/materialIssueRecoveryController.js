const service = require('../services/materialIssueRecoveryService');
const { ok, fail } = require('../utils/response');

function unavailable(req, res) {
  try { ok(res, service.recordResultUnavailable({ enterpriseId: req.user.enterprise_id, actor: { userId: req.user.id, role: req.user.role }, preparationId: req.params.id }), '已登记客户端结果未知；恢复任务仅核对事实，不会重新执行领料'); }
  catch (error) { fail(res, error.status || 400, error.message); }
}
function status(req, res) {
  try { ok(res, service.lookup({ enterpriseId: req.user.enterprise_id, businessOperationId: req.params.businessOperationId })); }
  catch (error) { fail(res, error.status || 404, error.message); }
}
module.exports = { unavailable, status };
