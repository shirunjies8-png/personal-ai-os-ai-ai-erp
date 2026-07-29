const { v4: uuid } = require('uuid');
const db = require('../database/client');
const runtime = require('./runtimeObservabilityService');
const audit = require('./transactionAuditService');
const approvalService = require('./approvalService');
const permissionService = require('./permissionService');
const inventoryRepository = require('../repositories/inventoryRepository');

const TX_STATUSES = new Set(['PREPARING', 'VALIDATING', 'WAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMMITTED', 'ROLLED_BACK', 'CONCURRENCY_ABORT', 'FAILED', 'EXPIRED']);
const TRANSITIONS = Object.freeze({
  PREPARING: new Set(['VALIDATING', 'FAILED']), VALIDATING: new Set(['WAITING_APPROVAL', 'FAILED']),
  WAITING_APPROVAL: new Set(['APPROVED', 'EXPIRED']), APPROVED: new Set(['EXECUTING', 'EXPIRED']),
  EXECUTING: new Set(['COMMITTED', 'ROLLED_BACK', 'CONCURRENCY_ABORT', 'FAILED']),
  ROLLED_BACK: new Set(['EXECUTING']), CONCURRENCY_ABORT: new Set(['EXECUTING']), FAILED: new Set(['EXECUTING']),
  COMMITTED: new Set(), EXPIRED: new Set()
});
const OPERATION_TYPE = 'REAL_INVENTORY_ISSUE';
const now = () => new Date().toISOString();
const json = value => JSON.stringify(value || {});
const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };

function transition(current, next) {
  if (!TX_STATUSES.has(next) || !TRANSITIONS[current]?.has(next)) {
    throw Object.assign(new Error(`非法状态转换：${current} → ${next}`), { code: 'INVALID_STATE_TRANSITION', status: 409 });
  }
}

function runFor(enterpriseId, userId, operationId) {
  return runtime.start({
    enterprise_id: enterpriseId, user_id: userId, component_id: 'tool-registry', component_type: 'SKILL',
    task_type: 'real_inventory_issue', trigger_source: 'transaction_preparation', provider: 'transaction-safety',
    runtime_or_model: 'deterministic-rule', execution_mode: 'DETERMINISTIC_RULE',
    input_summary: `真实库存领料预检查：${operationId}`
  });
}

function safeAudit(run, event, payload, fallback) {
  try { return event(); } catch (error) {
    try {
      db.prepare('INSERT INTO audit_retry_queue(id,enterprise_id,run_id,event_type,payload,status,retry_count,last_error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(uuid(), run.enterprise_id, run.run_id, fallback, json(payload), 'PENDING_RETRY', 0, String(error.message || 'audit_write_failed'), now(), now());
    } catch { /* A failed alert is intentionally not hidden from the caller's transaction state. */ }
    return null;
  }
}

function recordValidation(run, stepId, attemptId, result, snapshot, reason, source = 'SNAPSHOT') {
  return safeAudit(run, () => audit.recordValidation({ run, stepId, attemptId, result, snapshot, reason, source }), { result, snapshot, reason }, 'runtime_validation');
}

function finishRun(run, patch) {
  return safeAudit(run, () => audit.finishRun(run.run_id, patch), patch, 'runtime_finish');
}

function windowFor(input) {
  const type = ['URGENT', 'NORMAL', 'LONG'].includes(input.approval_window_type) ? input.approval_window_type : 'NORMAL';
  const defaults = { URGENT: 600, NORMAL: 86400, LONG: 259200 };
  return { type, ttl: Math.max(60, Math.min(259200, Number(input.ttl_seconds || defaults[type]))) };
}

function operation(enterpriseId, operationId) {
  return db.prepare('SELECT * FROM business_operations WHERE enterprise_id=? AND business_operation_id=? AND operation_type=?')
    .get(enterpriseId, operationId, OPERATION_TYPE);
}

function updateOperation(enterpriseId, operationId, fields) {
  const current = operation(enterpriseId, operationId);
  if (!current) return;
  db.prepare('UPDATE business_operations SET status=?,final_status=?,current_transaction_id=?,attempt_count=?,updated_at=?,completed_at=?,result_snapshot=? WHERE id=?')
    .run(fields.status || current.status, fields.status || current.final_status, fields.transactionId || current.current_transaction_id,
      fields.attemptCount ?? current.attempt_count, now(), fields.completedAt || current.completed_at,
      fields.resultSnapshot ? json(fields.resultSnapshot) : current.result_snapshot, current.id);
}

function releaseReservation(preparation, status = 'RELEASED') {
  db.prepare("UPDATE material_reservations SET status=?,released_at=? WHERE enterprise_id=? AND inventory_id=? AND business_operation_id=? AND status='ACTIVE'")
    .run(status, now(), preparation.enterprise_id, parse(preparation.snapshot_data).inventory_id, preparation.business_operation_id);
}

function details(id, enterpriseId) {
  const preparation = db.prepare('SELECT * FROM transaction_preparations WHERE id=? AND enterprise_id=?').get(id, enterpriseId);
  if (!preparation) throw Object.assign(new Error('预检查不存在'), { status: 404 });
  return {
    preparation,
    approval_card: parse(preparation.validation_result),
    reservations: db.prepare('SELECT * FROM material_reservations WHERE enterprise_id=? AND business_operation_id=?').all(enterpriseId, preparation.business_operation_id),
    requisitions: db.prepare('SELECT * FROM material_requisitions WHERE enterprise_id=? AND preparation_id=?').all(enterpriseId, id),
    transactions: db.prepare('SELECT * FROM business_transactions WHERE preparation_id=? AND enterprise_id=? ORDER BY execution_attempt').all(id, enterpriseId),
    stock_transactions: db.prepare('SELECT * FROM stock_transactions WHERE enterprise_id=? AND business_operation_id=? ORDER BY created_at').all(enterpriseId, preparation.business_operation_id)
  };
}

function validatorFor(snapshot) {
  const remaining = Number(snapshot.stock_quantity) - Number(snapshot.quantity);
  return {
    type: remaining < 0 ? 'STOCK_NEGATIVE' : remaining < Number(snapshot.safety_stock) ? 'SAFETY_STOCK_FAILED' : 'PASSED',
    inventory_id: snapshot.inventory_id, current_stock: Number(snapshot.stock_quantity), safety_stock: Number(snapshot.safety_stock),
    requested_quantity: Number(snapshot.quantity), remaining_stock: remaining,
    reason: remaining < 0 ? '库存不足，禁止领料' : remaining < Number(snapshot.safety_stock) ? '库存低于安全库存，需要人工审批或明确覆盖' : '预检查通过',
    validation_source: 'SNAPSHOT'
  };
}

function prepare({ enterpriseId, userId, role, input = {} }) {
  permissionService.authorizeAgent({ role });
  const operationId = String(input.business_operation_id || '');
  const inventoryId = String(input.inventory_id || '');
  const quantity = Number(input.quantity);
  if (!operationId || !inventoryId || !Number.isFinite(quantity) || quantity <= 0) {
    throw Object.assign(new Error('business_operation_id、inventory_id 与正数 quantity 必填'), { status: 400 });
  }
  const existing = operation(enterpriseId, operationId);
  if (existing?.final_status === 'COMMITTED') return { code: 'COMMITTED_HISTORY', operation: existing, result: parse(existing.result_snapshot) };
  if (existing && ['PREPARING', 'WAITING_APPROVAL', 'EXECUTING'].includes(existing.final_status)) {
    return { code: existing.final_status === 'WAITING_APPROVAL' ? 'WAITING_EXISTING_APPROVAL' : 'OPERATION_IN_PROGRESS', operation: existing };
  }
  const inventory = inventoryRepository.readSnapshot(enterpriseId, inventoryId);
  if (!inventory) throw Object.assign(new Error('库存记录不存在或无权访问'), { status: 404 });
  const active = db.prepare("SELECT * FROM material_reservations WHERE enterprise_id=? AND inventory_id=? AND status='ACTIVE' AND expired_at>? LIMIT 1")
    .get(enterpriseId, inventoryId, now());
  if (active) return { code: 'SOFT_RESERVATION_CONFLICT', reservation: active };

  const run = runFor(enterpriseId, userId, operationId);
  const stepId = uuid();
  const attemptId = safeAudit(run, () => audit.recordAttempt({ run, stepId, attemptNo: Number(existing?.attempt_count || 0) + 1, status: 'SUCCESS' }), {}, 'runtime_attempt');
  const win = windowFor(input); const readAt = now(); const expiredAt = new Date(Date.now() + win.ttl * 1000).toISOString();
  const snapshot = { inventory_id: inventoryId, quantity, stock_quantity: Number(inventory.stock_quantity), safety_stock: Number(inventory.safety_stock), expected_version: Number(inventory.version), read_at: readAt, source: 'inventory' };
  const validator = validatorFor(snapshot);
  const preparationId = uuid(); const transactionId = uuid(); const attemptNo = Number(existing?.attempt_count || 0) + 1;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO runtime_steps(id,run_id,enterprise_id,step_no,name,status,retry_policy,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(stepId, run.run_id, enterpriseId, 1, 'Inventory Transaction Preparation', 'VALIDATING', json({ maxAttempts: 1, idempotent: true }), now(), now());
    db.prepare('INSERT INTO transaction_preparations(id,enterprise_id,run_id,business_operation_id,snapshot_data,validation_result,created_at,expired_at,status,expected_version,read_at,snapshot_source,ttl_seconds,approval_window_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(preparationId, enterpriseId, run.run_id, operationId, json(snapshot), json(validator), now(), expiredAt, 'WAITING_APPROVAL', snapshot.expected_version, readAt, 'inventory', win.ttl, win.type);
    db.prepare('INSERT INTO material_reservations(id,enterprise_id,inventory_id,material_id,business_operation_id,reserved_quantity,status,created_at,expired_at,released_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(uuid(), enterpriseId, inventoryId, '', operationId, quantity, 'ACTIVE', now(), expiredAt, '');
    db.prepare('INSERT INTO material_requisitions(id,enterprise_id,business_operation_id,inventory_id,quantity,requested_by,status,preparation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(uuid(), enterpriseId, operationId, inventoryId, quantity, userId, 'WAITING_APPROVAL', preparationId, now(), now());
    db.prepare('INSERT OR REPLACE INTO business_operations(id,enterprise_id,operation_type,business_key,business_operation_id,run_id,status,result_snapshot,created_at,completed_at,final_status,current_transaction_id,attempt_count,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(existing?.id || uuid(), enterpriseId, OPERATION_TYPE, operationId, operationId, run.run_id, 'WAITING_APPROVAL', '{}', existing?.created_at || now(), '', 'WAITING_APPROVAL', transactionId, attemptNo, now());
    db.prepare('INSERT INTO business_transactions(id,enterprise_id,business_operation_id,transaction_type,preparation_id,status,run_id,execution_attempt,lock_version,failure_reason,created_at,completed_at,audit_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(transactionId, enterpriseId, operationId, 'INVENTORY_ISSUE', preparationId, 'WAITING_APPROVAL', run.run_id, attemptNo, snapshot.expected_version, '{}', now(), '', 'RECORDED');
    db.prepare('INSERT INTO agent_tasks(id,enterprise_id,user_id,agent_name,title,goal,status,current_step,total_steps,input_payload,output_payload,error_code,error_message,retry_count,confidence,needs_approval,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(run.run_id, enterpriseId, userId, 'transaction-safety', '真实库存领料审批', operationId, 'waiting_approval', 0, 1, json({ preparation_id: preparationId, inventory_id: inventoryId, quantity }), '{}', '', '', 0, 0, 1, now(), now());
    const approval = approvalService.request({ taskId: run.run_id, enterpriseId, userId, toolName: 'real_inventory_issue', actionLabel: '真实库存领料', reason: validator.reason, payload: validator });
    db.prepare('INSERT INTO runtime_approvals(id,run_id,enterprise_id,status,risk,reason,requested_by,created_at,updated_at,human_override,override_context) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run(approval.id, run.run_id, enterpriseId, 'WAITING_APPROVAL', validator.type === 'PASSED' ? 'MEDIUM' : 'HIGH', validator.reason, userId, now(), now(), 0, json({ approval_card: validator }));
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    finishRun(run, { execution_status: 'FAILED', verification_status: 'FAILED_VERIFICATION', error_code: 'preparation_failed', error_message: '预检查未完成，未创建半完成业务申请' });
    throw error;
  }
  recordValidation(run, stepId, attemptId, validator.type, snapshot, validator.reason);
  finishRun(run, { execution_status: 'BLOCKED', verification_status: 'HUMAN_REVIEW_REQUIRED', error_code: 'waiting_approval', error_message: validator.reason });
  return details(preparationId, enterpriseId);
}

function decide({ enterpriseId, actor, preparationId, approved, reason = '', humanOverride = false }) {
  const current = details(preparationId, enterpriseId); const prep = current.preparation;
  transition(prep.status, approved ? 'APPROVED' : 'EXPIRED');
  const approval = db.prepare("SELECT * FROM runtime_approvals WHERE run_id=? AND enterprise_id=? AND status='WAITING_APPROVAL'").get(prep.run_id, enterpriseId);
  if (!approval) throw Object.assign(new Error('审批记录不存在'), { status: 404 });
  if (humanOverride && !reason.trim()) throw Object.assign(new Error('人工覆盖必须填写原因'), { status: 400 });
  approvalService.decide({ approvalId: approval.id, actor, approved, reason });
  const context = { approval_card: parse(prep.validation_result), human_override: Boolean(humanOverride), override_reason: humanOverride ? reason : '', approved_by: actor.name || actor.userId, approved_at: now(), override_scope: humanOverride ? 'single_transaction' : 'none' };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE runtime_approvals SET status=?,reason=?,decided_by=?,decided_at=?,updated_at=?,human_override=?,override_context=? WHERE id=?')
      .run(approved ? 'APPROVED' : 'REJECTED', reason || approval.reason, context.approved_by, now(), now(), context.human_override ? 1 : 0, json(context), approval.id);
    if (!approved) {
      db.prepare('UPDATE transaction_preparations SET status=? WHERE id=?').run('EXPIRED', preparationId);
      releaseReservation(prep);
      db.prepare("UPDATE material_requisitions SET status='REJECTED',updated_at=? WHERE preparation_id=? AND enterprise_id=?").run(now(), preparationId, enterpriseId);
      updateOperation(enterpriseId, prep.business_operation_id, { status: 'EXPIRED' });
    } else {
      db.prepare('UPDATE transaction_preparations SET status=? WHERE id=?').run('APPROVED', preparationId);
      db.prepare("UPDATE material_requisitions SET status='APPROVED',updated_at=? WHERE preparation_id=? AND enterprise_id=?").run(now(), preparationId, enterpriseId);
      updateOperation(enterpriseId, prep.business_operation_id, { status: 'WAITING_APPROVAL' });
    }
    db.exec('COMMIT');
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  return details(preparationId, enterpriseId);
}

function executionFailure({ prep, tx, run, stepId, attemptId, snapshot, status, code, reason }) {
  db.prepare('UPDATE business_transactions SET status=?,failure_reason=?,completed_at=? WHERE id=?').run(status, json({ code, reason }), now(), tx.id);
  db.prepare('UPDATE transaction_preparations SET status=? WHERE id=?').run('APPROVED', prep.id);
  db.prepare("UPDATE material_requisitions SET status=?,updated_at=? WHERE preparation_id=? AND enterprise_id=?").run(status, now(), prep.id, prep.enterprise_id);
  updateOperation(prep.enterprise_id, prep.business_operation_id, { status, transactionId: tx.id, attemptCount: tx.execution_attempt });
  recordValidation(run, stepId, attemptId, status === 'CONCURRENCY_ABORT' ? 'CONCURRENCY_ABORT' : 'BUSINESS_RULE_FAILED', snapshot, reason, 'READ_COMMITTED');
  safeAudit(run, () => audit.markAttempt(attemptId, 'FAILED', code), { code, reason }, 'runtime_attempt_update');
  finishRun(run, { execution_status: 'FAILED', verification_status: 'FAILED_VERIFICATION', error_code: code, error_message: reason });
  return details(prep.id, prep.enterprise_id);
}

function execute({ enterpriseId, preparationId, simulateLedgerFailure = false, simulateAuditFailure = false }) {
  const state = details(preparationId, enterpriseId); const prep = state.preparation;
  if (prep.status !== 'APPROVED') throw Object.assign(new Error('预检查尚未获批'), { status: 409 });
  if (Date.now() > Date.parse(prep.expired_at)) {
    transition(prep.status, 'EXPIRED'); db.prepare('UPDATE transaction_preparations SET status=? WHERE id=?').run('EXPIRED', preparationId);
    releaseReservation(prep, 'EXPIRED'); updateOperation(enterpriseId, prep.business_operation_id, { status: 'EXPIRED' }); return details(preparationId, enterpriseId);
  }
  const run = { run_id: prep.run_id, enterprise_id: enterpriseId };
  const step = db.prepare('SELECT * FROM runtime_steps WHERE run_id=? ORDER BY step_no LIMIT 1').get(prep.run_id);
  let tx = state.transactions.at(-1);
  if (!tx || tx.status !== 'WAITING_APPROVAL') {
    tx = { id: uuid(), execution_attempt: Number(tx?.execution_attempt || 0) + 1, lock_version: Number(prep.expected_version) };
    db.prepare('INSERT INTO business_transactions(id,enterprise_id,business_operation_id,transaction_type,preparation_id,status,run_id,execution_attempt,lock_version,failure_reason,created_at,completed_at,audit_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(tx.id, enterpriseId, prep.business_operation_id, 'INVENTORY_ISSUE', preparationId, 'APPROVED', prep.run_id, tx.execution_attempt, prep.expected_version, '{}', now(), '', 'RECORDED');
    updateOperation(enterpriseId, prep.business_operation_id, { status: 'APPROVED', transactionId: tx.id, attemptCount: tx.execution_attempt });
  }
  const snapshot = parse(prep.snapshot_data);
  const approval = db.prepare("SELECT * FROM runtime_approvals WHERE run_id=? AND enterprise_id=? AND status='APPROVED'").get(prep.run_id, enterpriseId);
  const override = Boolean(parse(approval?.override_context).human_override);
  const attemptId = safeAudit(run, () => audit.recordAttempt({ run, stepId: step.id, attemptNo: tx.execution_attempt, status: 'RUNNING' }), {}, 'runtime_attempt');

  try {
    transition(prep.status, 'EXECUTING'); db.exec('BEGIN IMMEDIATE');
    db.prepare('UPDATE transaction_preparations SET status=? WHERE id=?').run('EXECUTING', prep.id);
    db.prepare('UPDATE business_transactions SET status=? WHERE id=?').run('EXECUTING', tx.id);
    updateOperation(enterpriseId, prep.business_operation_id, { status: 'EXECUTING', transactionId: tx.id, attemptCount: tx.execution_attempt });
    const update = inventoryRepository.conditionalDeduct({ enterpriseId, inventoryId: snapshot.inventory_id, expectedVersion: prep.expected_version, quantity: snapshot.quantity, allowSafetyOverride: override, updatedAt: now() });
    if (update.changes !== 1) {
      const fresh = inventoryRepository.readSnapshot(enterpriseId, snapshot.inventory_id);
      db.exec('ROLLBACK');
      if (!fresh || Number(fresh.version) !== Number(prep.expected_version)) {
        return executionFailure({ prep, tx, run, stepId: step.id, attemptId, snapshot, status: 'CONCURRENCY_ABORT', code: 'concurrency_abort', reason: '库存版本已变化，禁止使用过期预检查执行' });
      }
      return executionFailure({ prep, tx, run, stepId: step.id, attemptId, snapshot, status: 'FAILED', code: 'business_rule_failed', reason: '最终库存或安全库存校验未通过' });
    }
    if (simulateLedgerFailure) throw new Error('simulated_ledger_failure');
    inventoryRepository.appendStockTransaction({
      id: uuid(), enterprise_id: enterpriseId, inventory_id: snapshot.inventory_id, business_operation_id: prep.business_operation_id,
      transaction_id: tx.id, transaction_type: 'INVENTORY_ISSUE', quantity_delta: -Number(snapshot.quantity),
      stock_before: Number(snapshot.stock_quantity), stock_after: Number(snapshot.stock_quantity) - Number(snapshot.quantity),
      reference_type: 'material_requisition', reference_id: prep.id, created_by: prep.run_id, created_at: now(), note: 'Controlled inventory issue'
    });
    db.prepare("UPDATE material_requisitions SET status='COMMITTED',updated_at=? WHERE preparation_id=? AND enterprise_id=?").run(now(), prep.id, enterpriseId);
    db.prepare('UPDATE business_transactions SET status=?,completed_at=? WHERE id=?').run('COMMITTED', now(), tx.id);
    db.prepare('UPDATE transaction_preparations SET status=? WHERE id=?').run('COMMITTED', prep.id);
    releaseReservation(prep, 'COMMITTED');
    updateOperation(enterpriseId, prep.business_operation_id, { status: 'COMMITTED', transactionId: tx.id, attemptCount: tx.execution_attempt, completedAt: now(), resultSnapshot: { transaction_id: tx.id, inventory_id: snapshot.inventory_id, quantity: snapshot.quantity, stock_after: Number(snapshot.stock_quantity) - Number(snapshot.quantity) } });
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    return executionFailure({ prep, tx, run, stepId: step.id, attemptId, snapshot, status: 'ROLLED_BACK', code: 'rolled_back', reason: '业务流水写入失败，库存已回滚' });
  }

  if (simulateAuditFailure) {
    db.prepare('UPDATE business_transactions SET audit_status=? WHERE id=?').run('PENDING_RETRY', tx.id);
    safeAudit(run, () => { throw new Error('simulated_audit_failure'); }, { transaction_id: tx.id, preparation_id: prep.id }, 'transaction_committed');
  } else {
    recordValidation(run, step.id, attemptId, 'PASSED', snapshot, '执行前重新验证通过', 'READ_COMMITTED');
    safeAudit(run, () => audit.markAttempt(attemptId, 'SUCCESS'), {}, 'runtime_attempt_update');
  }
  finishRun(run, { execution_status: 'SUCCESS', verification_status: 'VERIFIED', observability_status: simulateAuditFailure ? 'AUDIT_DEGRADED' : 'RECORDED' });
  return details(preparationId, enterpriseId);
}

module.exports = { TX_STATUSES, TRANSITIONS, prepare, decide, execute, preparationDetails: details };
