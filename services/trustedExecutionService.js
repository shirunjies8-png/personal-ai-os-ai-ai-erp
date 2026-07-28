const { v4: uuid } = require('uuid');
const db = require('../database/client');
const runtime = require('./runtimeObservabilityService');
const approvalService = require('./approvalService');
const permissionService = require('./permissionService');

const ERROR_TYPES = new Set(['transient_error', 'validation_error', 'permission_error', 'business_rule_error', 'system_error', 'unknown_error']);
const now = () => new Date().toISOString();
const json = value => JSON.stringify(value || {});
const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };

function assertTenant(run, enterpriseId) {
  if (!run || run.enterprise_id !== enterpriseId) throw Object.assign(new Error('运行记录不存在'), { status: 404 });
  return run;
}
function getRun(runId, enterpriseId) {
  return assertTenant(db.prepare('SELECT * FROM runtime_runs WHERE run_id=?').get(runId), enterpriseId);
}
function details(runId, enterpriseId) {
  const run = getRun(runId, enterpriseId);
  return { run, steps: db.prepare('SELECT * FROM runtime_steps WHERE run_id=? AND enterprise_id=? ORDER BY step_no').all(runId, enterpriseId),
    attempts: db.prepare('SELECT * FROM runtime_attempts WHERE run_id=? AND enterprise_id=? ORDER BY created_at').all(runId, enterpriseId),
    validations: db.prepare('SELECT * FROM runtime_validations WHERE run_id=? AND enterprise_id=? ORDER BY created_at').all(runId, enterpriseId),
    approvals: db.prepare('SELECT * FROM runtime_approvals WHERE run_id=? AND enterprise_id=? ORDER BY created_at').all(runId, enterpriseId),
    outcome: db.prepare('SELECT * FROM runtime_outcome_feedback WHERE run_id=? AND enterprise_id=? ORDER BY created_at DESC LIMIT 1').get(runId, enterpriseId) || null };
}
function recordValidation({ run, stepId, attemptId, type, version = '1', schemaVersion = '', ruleId = '', input = {}, result, reason = '' }) {
  db.prepare(`INSERT INTO runtime_validations(id,run_id,step_id,attempt_id,enterprise_id,validator_type,validator_version,schema_version,rule_id,rule_version,input_snapshot,validation_result,failure_reason,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uuid(), run.run_id, stepId, attemptId, run.enterprise_id, type, version, schemaVersion, ruleId, version, json(input), result, String(reason), now());
}
function schemaValidate(payload) {
  const required = { customer: 'string', product: 'string', quantity: 'number' };
  for (const [key, type] of Object.entries(required)) {
    if (typeof payload?.[key] !== type) return { ok: false, reason: `field type mismatch: ${key} must be ${type}` };
  }
  return { ok: true, reason: '' };
}
function inventoryRule(payload) {
  const current = Number(payload?.current_inventory); const issue = Number(payload?.issue_quantity);
  if (!Number.isFinite(current) || !Number.isFinite(issue)) return { ok: false, reason: 'inventory values must be numbers', remaining: null };
  const remaining = current - issue;
  return remaining >= 0 ? { ok: true, remaining } : { ok: false, remaining, reason: `库存数量不得小于 0，当前计算结果：${remaining}` };
}
function finishAttempt(attemptId, status, error = {}) {
  db.prepare('UPDATE runtime_attempts SET status=?,error_type=?,error_code=?,error_message=?,finished_at=?,duration_ms=? WHERE id=?').run(status, error.type || '', error.code || '', error.message || '', now(), 0, attemptId);
}
function recordOutcome(run, input, actual, validationResult, feedbackType = '') {
  db.prepare(`INSERT INTO runtime_outcome_feedback(id,run_id,enterprise_id,prediction_confidence,prediction_risk,validator_result,actual_result,feedback_type,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(uuid(), run.run_id, run.enterprise_id, Number(input.prediction_confidence || 0), String(input.prediction_risk || ''), validationResult, actual, feedbackType, now());
}
function execute({ enterpriseId, userId, role, input = {} }) {
  permissionService.authorizeAgent({ role });
  const operationType = String(input.operation_type || 'validation_demo');
  const businessKey = String(input.business_operation_id || input.business_key || '');
  if (!businessKey) throw new Error('business_operation_id 必填');
  const existing = db.prepare('SELECT * FROM business_operations WHERE enterprise_id=? AND operation_type=? AND business_key=?').get(enterpriseId, operationType, businessKey);
  if (existing && existing.status === 'SUCCESS') return { idempotent: true, operation: existing, result: parse(existing.result_snapshot), run: getRun(existing.run_id, enterpriseId) };
  if (existing) return { idempotent: true, operation: existing, result: parse(existing.result_snapshot), run: getRun(existing.run_id, enterpriseId) };
  const nonIdempotent = input.idempotent === false;
  const componentId = String(input.component_id || 'agent-runtime');
  const mode = String(input.execution_mode || 'DETERMINISTIC_RULE');
  const run = runtime.start({ enterprise_id: enterpriseId, user_id: userId, component_id: componentId, component_type: input.component_type || 'SKILL', task_type: operationType, trigger_source: input.trigger_source || 'api', request_id: input.request_id || '', provider: input.provider || 'trusted-execution', runtime_or_model: input.runtime_or_model || 'deterministic-rule', execution_mode: mode, input_summary: `业务操作：${operationType} / ${businessKey}` });
  db.prepare('INSERT INTO business_operations(id,enterprise_id,operation_type,business_key,run_id,status,result_snapshot,created_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?)').run(uuid(), enterpriseId, operationType, businessKey, run.run_id, nonIdempotent ? 'WAITING_APPROVAL' : 'RUNNING', '{}', now(), '');
  const stepId = uuid();
  db.prepare('INSERT INTO runtime_steps(id,run_id,enterprise_id,step_no,name,status,retry_policy,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(stepId, run.run_id, enterpriseId, 1, input.step_name || '执行并验证', nonIdempotent ? 'WAITING_APPROVAL' : 'RUNNING', json({ maxAttempts: Number(input.max_attempts || 1), retryableErrors: ['transient_error'], idempotent: !nonIdempotent }), now(), now());
  if (nonIdempotent) {
    db.prepare(`INSERT OR IGNORE INTO agent_tasks(id,enterprise_id,user_id,agent_name,title,goal,status,current_step,total_steps,input_payload,output_payload,error_code,error_message,retry_count,confidence,needs_approval,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(run.run_id, enterpriseId, userId, 'trusted-execution', '非幂等业务操作审批', operationType, 'waiting_approval', 0, 1, json({ businessKey }), '{}', '', '', 0, 0, 1, now(), now());
    const approval = approvalService.request({ taskId: run.run_id, enterpriseId, userId, toolName: componentId, actionLabel: '非幂等业务操作', reason: '非幂等操作必须人工审批', payload: { operationType, businessKey } });
    db.prepare('INSERT INTO runtime_approvals(id,run_id,enterprise_id,status,risk,reason,requested_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(approval.id, run.run_id, enterpriseId, 'WAITING_APPROVAL', 'HIGH', approval.reason, userId, now(), now());
    runtime.finish(run.run_id, { execution_status: 'BLOCKED', verification_status: 'NOT_VERIFIED', error_code: 'waiting_approval', error_message: '非幂等业务操作等待人工审批' });
    return { run: getRun(run.run_id, enterpriseId), waitingApproval: true, approvalId: approval.id };
  }
  return perform(run, stepId, input);
}
function perform(run, stepId, input) {
  const maxAttempts = Math.max(1, Math.min(3, Number(input.max_attempts || 1)));
  const transientFailures = Math.max(0, Number(input.transient_failures || 0));
  let attemptId; let attemptNo = 0;
  while (attemptNo < maxAttempts) {
    attemptNo += 1; attemptId = uuid();
    db.prepare('INSERT INTO runtime_attempts(id,run_id,step_id,enterprise_id,attempt_no,status,started_at,created_at) VALUES(?,?,?,?,?,?,?,?)').run(attemptId, run.run_id, stepId, run.enterprise_id, attemptNo, 'RUNNING', now(), now());
    if (attemptNo <= transientFailures) { finishAttempt(attemptId, 'FAILED', { type: 'transient_error', code: 'simulated_transient', message: '可重试的临时错误' }); continue; }
    break;
  }
  if (attemptNo <= transientFailures) {
    db.prepare('UPDATE runtime_steps SET status=?,updated_at=? WHERE id=?').run('RETRY_EXHAUSTED', now(), stepId);
    runtime.finish(run.run_id, { execution_status: 'FAILED', verification_status: 'NOT_VERIFIED', error_code: 'retry_exhausted', error_message: '临时错误重试次数已耗尽' });
    const exhausted = { execution_status: 'FAILED', final_status: 'RETRY_EXHAUSTED', retryable: false };
    db.prepare('UPDATE business_operations SET status=?,result_snapshot=?,completed_at=? WHERE run_id=?').run('RETRY_EXHAUSTED', json(exhausted), now(), run.run_id);
    recordOutcome(run, input, 'RETRY_EXHAUSTED', 'NOT_VERIFIED');
    return { run: getRun(run.run_id, run.enterprise_id), result: exhausted, details: details(run.run_id, run.enterprise_id) };
  }
  let validation; let final; let execution = 'SUCCESS';
  if (input.scenario === 'inventory') {
    validation = inventoryRule(input.payload || {});
    recordValidation({ run, stepId, attemptId, type: 'BUSINESS_RULE_VALIDATOR', version: '1', ruleId: 'inventory.non_negative', input: input.payload, result: validation.ok ? 'PASSED' : 'BUSINESS_RULE_FAILED', reason: validation.reason });
    final = validation.ok ? 'SUCCESS' : 'BLOCKED';
  } else {
    validation = schemaValidate(input.payload || {});
    recordValidation({ run, stepId, attemptId, type: 'SCHEMA_VALIDATOR', version: '1', schemaVersion: 'ocr-result-v1', input: input.payload, result: validation.ok ? 'PASSED' : 'FAILED_VALIDATION', reason: validation.reason });
    final = validation.ok ? 'SUCCESS' : 'HUMAN_REVIEW_REQUIRED';
  }
  finishAttempt(attemptId, execution);
  db.prepare('UPDATE runtime_steps SET status=?,updated_at=? WHERE id=?').run(final, now(), stepId);
  const verification = validation.ok ? 'VERIFIED' : final === 'BLOCKED' ? 'FAILED_VERIFICATION' : 'HUMAN_REVIEW_REQUIRED';
  runtime.finish(run.run_id, { execution_status: execution, verification_status: verification, error_code: validation.ok ? '' : 'validation_failed', error_message: validation.reason });
  const result = { execution_status: execution, final_status: final, validation, retryable: false };
  db.prepare('UPDATE business_operations SET status=?,result_snapshot=?,completed_at=? WHERE run_id=?').run(final, json(result), now(), run.run_id);
  recordOutcome(run, input, final, validation.ok ? 'PASSED' : 'FAILED', validation.ok ? '' : 'false_positive');
  return { run: getRun(run.run_id, run.enterprise_id), result, details: details(run.run_id, run.enterprise_id) };
}
function decideApproval({ enterpriseId, actor, runId, approved, reason }) {
  const item = db.prepare('SELECT * FROM runtime_approvals WHERE run_id=? AND enterprise_id=? AND status=?').get(runId, enterpriseId, 'WAITING_APPROVAL');
  if (!item) throw new Error('待审批运行不存在');
  approvalService.decide({ approvalId: item.id, actor, approved, reason });
  db.prepare('UPDATE runtime_approvals SET status=?,reason=?,decided_by=?,decided_at=?,updated_at=? WHERE id=?').run(approved ? 'APPROVED' : 'REJECTED', reason || item.reason, actor.name || actor.userId, now(), now(), item.id);
  const run = getRun(runId, enterpriseId);
  if (!approved) { runtime.finish(runId, { execution_status: 'CANCELLED', verification_status: 'NOT_VERIFIED', error_code: 'approval_rejected', error_message: reason || '审批拒绝' }); db.prepare('UPDATE business_operations SET status=?,completed_at=? WHERE run_id=?').run('ABORTED', now(), runId); return details(runId, enterpriseId); }
  return perform(run, db.prepare('SELECT id FROM runtime_steps WHERE run_id=? ORDER BY step_no LIMIT 1').get(runId).id, { operation_type: 'approved_operation', business_operation_id: 'approved', scenario: 'schema', payload: { customer: '', product: '', quantity: 0 } });
}
module.exports = { ERROR_TYPES, execute, details, decideApproval, schemaValidate, inventoryRule };
