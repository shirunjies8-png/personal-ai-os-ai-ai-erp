const service = require('../services/transactionSafetyService');
const { ok, fail } = require('../utils/response');
function prepare(req, res) { try { ok(res, service.prepare({ enterpriseId: req.user.enterprise_id, userId: req.user.id, role: req.user.role, input: req.body || {} }), '事务预检查已保存'); } catch (error) { fail(res, error.status || 400, error.message); } }
function detail(req, res) { try { ok(res, service.preparationDetails(req.params.id, req.user.enterprise_id)); } catch (error) { fail(res, error.status || 404, error.message); } }
function approve(req, res) { try { ok(res, service.decide({ enterpriseId: req.user.enterprise_id, preparationId: req.params.id, approved: Boolean(req.body?.approved), reason: String(req.body?.reason || ''), actor: { enterpriseId: req.user.enterprise_id, userId: req.user.id, name: req.user.name, role: req.user.role } })); } catch (error) { fail(res, error.status || 400, error.message); } }
function execute(req, res) { try { ok(res, service.execute({ enterpriseId: req.user.enterprise_id, preparationId: req.params.id, simulateLedgerFailure: Boolean(req.body?.simulate_ledger_failure) })); } catch (error) { fail(res, error.status || 400, error.message); } }
module.exports = { prepare, detail, approve, execute };
