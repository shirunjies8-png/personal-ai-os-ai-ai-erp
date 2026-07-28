const service = require('../services/trustedExecutionService');
const { ok, fail } = require('../utils/response');

function execute(req, res) {
  try { ok(res, service.execute({ enterpriseId: req.user.enterprise_id, userId: req.user.id, role: req.user.role, input: req.body || {} }), '可信执行已记录'); }
  catch (error) { fail(res, error.status || 400, error.message || '可信执行失败'); }
}
function detail(req, res) {
  try { ok(res, service.details(req.params.id, req.user.enterprise_id)); }
  catch (error) { fail(res, error.status || 404, error.message || '运行记录不存在'); }
}
function decide(req, res) {
  try {
    const item = service.decideApproval({ enterpriseId: req.user.enterprise_id, runId: req.params.id, approved: Boolean(req.body?.approved), reason: String(req.body?.reason || ''), actor: { enterpriseId: req.user.enterprise_id, userId: req.user.id, name: req.user.name, role: req.user.role } });
    ok(res, item, req.body?.approved ? '审批通过并执行' : '审批已拒绝');
  } catch (error) { fail(res, error.status || 400, error.message || '审批处理失败'); }
}
module.exports = { execute, detail, decide };
