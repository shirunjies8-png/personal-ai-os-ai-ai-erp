const { AuditRecoveryService } = require('../services/auditRecoveryService');
const { ok, fail } = require('../utils/response');
const recovery = new AuditRecoveryService();
const admin = user => ['admin', '企业管理员'].includes(String(user?.role || '').toLowerCase()) || String(user?.role || '') === '企业管理员';

function create(req, res) { try { if (!admin(req.user)) return fail(res, 403, '仅管理员可创建审计恢复任务'); ok(res, recovery.createFromAuditQueue({ enterpriseId: req.user.enterprise_id, queueId: req.body?.queueId }), '审计恢复任务已创建'); } catch (e) { fail(res, e.status || 400, e.message); } }
function list(req, res) { try { ok(res, { items: recovery.list(req.user.enterprise_id) }); } catch (e) { fail(res, e.status || 400, e.message); } }
function detail(req, res) { try { ok(res, recovery.details(req.params.id, req.user.enterprise_id)); } catch (e) { fail(res, e.status || 404, e.message); } }
function retry(req, res) { try { ok(res, recovery.manualRetry({ enterpriseId: req.user.enterprise_id, jobId: req.params.id, actor: { isAdmin: admin(req.user), userId: req.user.id }, reason: req.body?.reason, circuitOverride: Boolean(req.body?.circuitOverride) }), '已创建独立恢复尝试'); } catch (e) { fail(res, e.status || 400, e.message); } }
function scan(req, res) { try { if (!admin(req.user)) return fail(res, 403, '仅管理员可执行恢复扫描'); ok(res, { result: recovery.runOnce(`api:${req.user.id}`, req.user.enterprise_id) }); } catch (e) { fail(res, e.status || 400, e.message); } }
module.exports = { create, list, detail, retry, scan };
