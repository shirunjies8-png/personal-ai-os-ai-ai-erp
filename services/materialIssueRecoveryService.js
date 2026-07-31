const db = require('../database/client');
const audit = require('./transactionAuditService');
const { AuditRecoveryService } = require('./auditRecoveryService');

const CLIENT_OBSERVATION = Object.freeze({ RESPONSE_RECEIVED: 'RESPONSE_RECEIVED', RESULT_UNAVAILABLE: 'RESULT_UNAVAILABLE' });
const RECOVERY_STATUS = Object.freeze({ UNKNOWN: 'UNKNOWN', CHECKING: 'CHECKING', COMMITTED: 'COMMITTED', NOT_COMMITTED: 'NOT_COMMITTED', STILL_UNKNOWN: 'STILL_UNKNOWN' });
const admin = role => ['admin', '企业管理员'].includes(String(role || '').toLowerCase()) || String(role || '') === '企业管理员';
const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
const recovery = new AuditRecoveryService();

function operationContext(enterpriseId, preparationId) {
  const preparation = db.prepare('SELECT * FROM transaction_preparations WHERE id=? AND enterprise_id=?').get(preparationId, enterpriseId);
  if (!preparation) throw Object.assign(new Error('领料预检查不存在或无权访问'), { status: 404 });
  const requisition = db.prepare('SELECT * FROM material_requisitions WHERE enterprise_id=? AND preparation_id=?').get(enterpriseId, preparationId);
  const operation = db.prepare('SELECT * FROM business_operations WHERE enterprise_id=? AND business_operation_id=? AND operation_type=?').get(enterpriseId, preparation.business_operation_id, 'REAL_INVENTORY_ISSUE');
  const transaction = db.prepare('SELECT * FROM business_transactions WHERE enterprise_id=? AND preparation_id=? ORDER BY created_at DESC LIMIT 1').get(enterpriseId, preparationId);
  const step = db.prepare('SELECT * FROM runtime_steps WHERE enterprise_id=? AND run_id=? ORDER BY step_no LIMIT 1').get(enterpriseId, preparation.run_id);
  if (!requisition || !operation || !transaction || !step) throw Object.assign(new Error('领料事实关联不完整，不能登记未知结果恢复'), { status: 409, code: 'MATERIAL_ISSUE_FACT_LINK_INCOMPLETE' });
  return { preparation, requisition, operation, transaction, step };
}

function recordResultUnavailable({ enterpriseId, actor, preparationId }) {
  const context = operationContext(enterpriseId, preparationId);
  if (actor.userId !== context.requisition.requested_by && !admin(actor.role)) throw Object.assign(new Error('仅申请人或管理员可登记客户端结果未知'), { status: 403 });
  const run = { run_id: context.preparation.run_id, enterprise_id: enterpriseId };
  const runtimeAttemptId = audit.recordAttempt({ run, stepId: context.step.id, attemptNo: Number(context.transaction.execution_attempt || 1), status: 'UNKNOWN', code: CLIENT_OBSERVATION.RESULT_UNAVAILABLE, message: '客户端未获得 Execute 的确定响应；未重试业务执行' });
  const payload = {
    observation: CLIENT_OBSERVATION.RESULT_UNAVAILABLE,
    observed_at: new Date().toISOString(),
    business_operation_id: context.preparation.business_operation_id,
    material_issue_id: context.preparation.id,
    preparation_id: context.preparation.id,
    transaction_id: context.transaction.id,
    runtime_run_id: context.preparation.run_id,
    runtime_step_id: context.step.id,
    runtime_attempt_id: runtimeAttemptId,
    requested_by: context.requisition.requested_by,
    input: { business_operation_id: context.preparation.business_operation_id, preparation_id: context.preparation.id, transaction_id: context.transaction.id },
    environment: 'client_result_unavailable'
  };
  audit.recordValidation({ run, stepId: context.step.id, attemptId: runtimeAttemptId, result: RECOVERY_STATUS.UNKNOWN, snapshot: payload, reason: '客户端未获得 Execute 确定响应，必须只读核对业务事实', source: 'READ_COMMITTED', overrideAllowed: false, validatorType: 'MATERIAL_ISSUE_UNKNOWN_OBSERVATION', ruleId: 'material_issue.client_result_unavailable' });
  const created = recovery.create({ enterpriseId, handlerType: 'material_issue_fact_validator', payload, idempotencyKey: `material-issue-fact:${enterpriseId}:${context.preparation.business_operation_id}:${context.transaction.id}`, maxAttempts: 1 });
  return { observation: CLIENT_OBSERVATION.RESULT_UNAVAILABLE, job: created.job, reused: created.reused, operation_id: context.preparation.business_operation_id, trace_id: context.preparation.run_id };
}

function lookup({ enterpriseId, businessOperationId }) {
  const operation = db.prepare('SELECT * FROM business_operations WHERE enterprise_id=? AND business_operation_id=? AND operation_type=?').get(enterpriseId, businessOperationId, 'REAL_INVENTORY_ISSUE');
  if (!operation) throw Object.assign(new Error('领料业务操作不存在或无权访问'), { status: 404 });
  const jobs = recovery.list(enterpriseId).filter(job => job.handler_type === 'material_issue_fact_validator' && job.payload.business_operation_id === businessOperationId);
  const job = jobs[0];
  if (!job) return { status: RECOVERY_STATUS.UNKNOWN, verified: false, source: 'none', trace_id: operation.run_id, operation_id: businessOperationId, message: '尚未登记 RESULT_UNAVAILABLE 恢复验证请求' };
  const idempotency = db.prepare('SELECT result_snapshot FROM audit_recovery_idempotency WHERE enterprise_id=? AND idempotency_key=?').get(enterpriseId, job.idempotency_key);
  const result = parse(idempotency?.result_snapshot);
  const checking = ['PENDING_RETRY', 'CLAIMED', 'RUNNING', 'RETRY_SCHEDULED'].includes(job.status);
  const factResult = checking ? RECOVERY_STATUS.CHECKING : (result.result || RECOVERY_STATUS.STILL_UNKNOWN);
  return { status: factResult, factResult, decision: result.decision || null, verified: factResult === RECOVERY_STATUS.COMMITTED || factResult === RECOVERY_STATUS.NOT_COMMITTED, source: result.evidence?.inventory_transaction ? 'inventory_transaction' : 'business_fact_reconciliation', trace_id: job.payload.runtime_run_id || operation.run_id, operation_id: businessOperationId, recovery_job_id: job.id, original_result: job.payload.observation || CLIENT_OBSERVATION.RESULT_UNAVAILABLE, evidence: result.evidence || {}, reason: result.reason || '' };
}

module.exports = { CLIENT_OBSERVATION, RECOVERY_STATUS, recordResultUnavailable, lookup, operationContext, recovery };
