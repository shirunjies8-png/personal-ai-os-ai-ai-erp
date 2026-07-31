const crypto = require('node:crypto');
const { v4: uuid } = require('uuid');
const db = require('../database/client');
const { sanitize, info, error: logError } = require('../utils/logger');
const transactionAudit = require('./transactionAuditService');

const STATES = Object.freeze({ PENDING_RETRY: 'PENDING_RETRY', CLAIMED: 'CLAIMED', RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', RETRY_SCHEDULED: 'RETRY_SCHEDULED', DEAD: 'DEAD', CANCELLED: 'CANCELLED', UNKNOWN: 'UNKNOWN' });
const TERMINAL = new Set([STATES.SUCCEEDED, STATES.DEAD, STATES.CANCELLED, STATES.UNKNOWN]);
const TRANSITIONS = Object.freeze({
  PENDING_RETRY: [STATES.CLAIMED, STATES.CANCELLED, STATES.DEAD], CLAIMED: [STATES.RUNNING, STATES.PENDING_RETRY, STATES.CANCELLED],
  RUNNING: [STATES.SUCCEEDED, STATES.RETRY_SCHEDULED, STATES.DEAD, STATES.UNKNOWN, STATES.PENDING_RETRY], RETRY_SCHEDULED: [STATES.CLAIMED, STATES.DEAD, STATES.CANCELLED],
  SUCCEEDED: [], DEAD: [], CANCELLED: [], UNKNOWN: []
});
const FAILURE = Object.freeze({ RETRYABLE: 'RETRYABLE', NON_RETRYABLE: 'NON_RETRYABLE', UNKNOWN: 'UNKNOWN' });
const iso = (clock = Date) => new clock().toISOString();
const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
const stable = value => JSON.stringify(value && typeof value === 'object' ? Object.keys(value).sort().reduce((out, key) => { out[key] = value[key]; return out; }, {}) : value);
const fingerprint = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const publicJob = job => job && ({ ...job, payload: parse(job.payload) });

function materialIssueFactResult(job) {
  const payload = job.payload || {};
  const operationId = String(payload.business_operation_id || '');
  const preparationId = String(payload.material_issue_id || payload.preparation_id || '');
  const transactionId = String(payload.transaction_id || '');
  const operation = db.prepare('SELECT * FROM business_operations WHERE enterprise_id=? AND business_operation_id=? AND operation_type=?').get(job.enterprise_id, operationId, 'REAL_INVENTORY_ISSUE');
  const requisition = preparationId
    ? db.prepare('SELECT * FROM material_requisitions WHERE enterprise_id=? AND preparation_id=? AND business_operation_id=?').get(job.enterprise_id, preparationId, operationId)
    : db.prepare('SELECT * FROM material_requisitions WHERE enterprise_id=? AND business_operation_id=? ORDER BY created_at DESC LIMIT 1').get(job.enterprise_id, operationId);
  const transaction = transactionId
    ? db.prepare('SELECT * FROM business_transactions WHERE enterprise_id=? AND id=? AND business_operation_id=?').get(job.enterprise_id, transactionId, operationId)
    : db.prepare('SELECT * FROM business_transactions WHERE enterprise_id=? AND business_operation_id=? ORDER BY created_at DESC LIMIT 1').get(job.enterprise_id, operationId);
  const ledger = transaction
    ? db.prepare("SELECT * FROM stock_transactions WHERE enterprise_id=? AND transaction_id=? AND business_operation_id=? AND transaction_type='INVENTORY_ISSUE'").all(job.enterprise_id, transaction.id, operationId)
    : [];
  const inventory = requisition ? db.prepare('SELECT id,stock_quantity,version FROM inventory WHERE enterprise_id=? AND id=?').get(job.enterprise_id, requisition.inventory_id) : null;
  const run = String(payload.runtime_run_id || operation?.run_id || '');
  const attempts = run ? db.prepare('SELECT COUNT(*) AS count FROM runtime_attempts WHERE enterprise_id=? AND run_id=?').get(job.enterprise_id, run) : { count: 0 };
  const evidence = {
    inventory_transaction: ledger.length === 1,
    inventory_transaction_count: ledger.length,
    material_issue_status: requisition?.status || 'NOT_FOUND',
    business_transaction_status: transaction?.status || 'NOT_FOUND',
    business_operation_status: operation?.final_status || 'NOT_FOUND',
    business_operation_id: operationId,
    transaction_id: transaction?.id || transactionId || '',
    inventory_id: inventory?.id || requisition?.inventory_id || '',
    inventory_stock_quantity: inventory?.stock_quantity ?? null,
    inventory_version: inventory?.version ?? null,
    runtime_run_id: run,
    runtime_attempt_count: Number(attempts?.count || 0)
  };
  const committed = transaction?.status === 'COMMITTED' && requisition?.status === 'COMMITTED' && operation?.final_status === 'COMMITTED' && ledger.length === 1 && inventory && Number(ledger[0].stock_after) === Number(inventory.stock_quantity);
  if (committed) return { result: 'COMMITTED', evidence, reason: '库存流水、领料申请、业务事务和操作状态一致地证明已提交' };
  const terminalNotCommitted = ['FAILED', 'REJECTED', 'EXPIRED', 'CONCURRENCY_ABORT', 'ROLLED_BACK'];
  // Existing rejection flow makes requisition/operation terminal while its
  // pre-created business transaction remains WAITING_APPROVAL. That is still
  // conclusive non-commit only when the ledger is absent and both authorities
  // agree; this validator observes that fact without changing the workflow.
  const failed = ledger.length === 0 && terminalNotCommitted.includes(String(requisition?.status || '')) && String(operation?.final_status || '') === String(requisition?.status || '') && (String(transaction?.status || '') === String(requisition?.status || '') || String(transaction?.status || '') === 'WAITING_APPROVAL');
  if (failed) return { result: 'NOT_COMMITTED', evidence, reason: '没有扣减流水，且领料申请与业务操作存在一致的明确未提交终态' };
  return { result: 'STILL_UNKNOWN', evidence, reason: '领料业务事实不完整或相互矛盾，不能安全判断是否已提交' };
}

// The first production handler deliberately supports only audit records whose
// replay is deterministic. Ambiguous records are returned as UNKNOWN instead
// of manufacturing an audit entry from incomplete context.
const defaultHandlers = {
  audit_retry_queue: {
    execute({ job }) {
      const queueId = String(job.payload.queue_id || '');
      const queue = db.prepare('SELECT * FROM audit_retry_queue WHERE id=? AND enterprise_id=?').get(queueId, job.enterprise_id);
      if (!queue) return { ok: false, nonRetryable: true, code: 'audit_queue_not_found', message: '待恢复审计记录不存在' };
      if (queue.status === 'RECORDED') return { ok: true, result: { queue_id: queueId, replayed: false } };
      if (queue.event_type !== 'runtime_finish') return { unknown: true, code: 'audit_replay_requires_manual_context', message: '审计记录缺少可安全重放的上下文' };
      const patch = parse(queue.payload);
      db.transaction(() => {
        const updated = db.prepare('UPDATE runtime_runs SET finished_at=?,execution_status=?,verification_status=?,error_code=?,error_message=?,observability_status=? WHERE run_id=? AND enterprise_id=?')
          .run(new Date().toISOString(), patch.execution_status || 'FAILED', patch.verification_status || 'UNKNOWN', String(patch.error_code || ''), sanitize(patch.error_message || ''), 'RECORDED', queue.run_id, job.enterprise_id);
        if (updated.changes !== 1) throw Object.assign(new Error('运行审计对象不存在，无法安全重放'), { code: 'runtime_run_not_found' });
        db.prepare("UPDATE audit_retry_queue SET status='RECORDED',updated_at=?,retry_count=retry_count+1,last_error='' WHERE id=? AND enterprise_id=?").run(new Date().toISOString(), queueId, job.enterprise_id);
      })();
      return { ok: true, result: { queue_id: queueId, replayed: true } };
    },
    verify({ job }) {
      const queue = db.prepare('SELECT status FROM audit_retry_queue WHERE id=? AND enterprise_id=?').get(String(job.payload.queue_id || ''), job.enterprise_id);
      return { ok: queue?.status === 'RECORDED', message: '审计重放回读失败' };
    }
  },
  // This handler intentionally performs evidence reads only. It never calls the
  // Material Issue executor, so recovery cannot create a second inventory effect.
  material_issue_fact_validator: {
    execute({ job }) {
      const result = materialIssueFactResult(job);
      const runId = String(job.payload.runtime_run_id || '');
      const stepId = String(job.payload.runtime_step_id || '');
      const attemptId = String(job.payload.runtime_attempt_id || '');
      if (runId && stepId) {
        transactionAudit.recordValidation({
          run: { run_id: runId, enterprise_id: job.enterprise_id }, stepId, attemptId,
          result: result.result, snapshot: result.evidence, reason: result.reason,
          source: 'READ_COMMITTED', overrideAllowed: false,
          validatorType: 'MATERIAL_ISSUE_FACT_VALIDATOR', ruleId: 'material_issue.fact_reconciliation'
        });
      }
      if (result.result === 'STILL_UNKNOWN') return { unknown: true, code: 'material_issue_still_unknown', message: result.reason, result };
      return { ok: true, result };
    },
    verify({ outcome }) {
      return { ok: outcome?.result?.result !== 'STILL_UNKNOWN', message: 'Material Issue 事实验证未得到确定结论' };
    }
  }
};

function classified(value = {}) {
  if (value.failureClass) return value.failureClass;
  const text = String(value.code || value.message || '').toLowerCase();
  if (value.unknown || /unknown|ambiguous|cannot.*confirm/.test(text)) return FAILURE.UNKNOWN;
  if (/timeout|network|temporar|busy|unavailable/.test(text)) return FAILURE.RETRYABLE;
  return FAILURE.NON_RETRYABLE;
}
function retryDelay(attempt) { return Math.min(300000, 1000 * (2 ** Math.max(0, Number(attempt) - 1))); }
function assertTransition(from, to) { if (!TRANSITIONS[from]?.includes(to)) { const e = new Error(`非法恢复状态转换: ${from} → ${to}`); e.code = 'ILLEGAL_RECOVERY_TRANSITION'; e.status = 409; throw e; } }

class AuditRecoveryService {
  constructor({ clock = Date, handlers = {}, leaseMs = 30000, maxNoProgress = 2, circuitThreshold = 3, circuitCooldownMs = 60000 } = {}) {
    this.clock = clock; this.handlers = { ...defaultHandlers, ...handlers }; this.leaseMs = leaseMs; this.maxNoProgress = maxNoProgress; this.circuitThreshold = circuitThreshold; this.circuitCooldownMs = circuitCooldownMs;
  }
  now() { return iso(this.clock); }
  later(ms) { return new Date(new this.clock().getTime() + ms).toISOString(); }
  event(enterpriseId, jobId, type, detail = {}, attemptId = '') { db.prepare('INSERT INTO audit_recovery_events(id,enterprise_id,job_id,attempt_id,event_type,detail,created_at) VALUES(?,?,?,?,?,?,?)').run(uuid(), enterpriseId, jobId, attemptId, type, JSON.stringify(detail), this.now()); info('audit_recovery_event', { enterpriseId, jobId, type }); }
  getJob(id, enterpriseId) { const row = db.prepare('SELECT * FROM audit_recovery_jobs WHERE id=? AND enterprise_id=?').get(id, enterpriseId); if (!row) { const e = new Error('恢复任务不存在或无权访问'); e.status = 404; throw e; } return row; }
  list(enterpriseId) { return db.prepare('SELECT * FROM audit_recovery_jobs WHERE enterprise_id=? ORDER BY created_at DESC').all(enterpriseId).map(publicJob); }
  create({ enterpriseId, handlerType, payload = {}, idempotencyKey, maxAttempts = 3, recoveryWindowMs = 3600000 }) {
    if (!enterpriseId || !handlerType || !idempotencyKey) throw new Error('enterpriseId、handlerType 和 idempotencyKey 为必填项');
    const existing = db.prepare('SELECT * FROM audit_recovery_idempotency WHERE enterprise_id=? AND idempotency_key=?').get(enterpriseId, idempotencyKey);
    if (existing?.status === STATES.SUCCEEDED) return { reused: true, job: publicJob(this.getJob(existing.job_id, enterpriseId)), result: parse(existing.result_snapshot) };
    if (existing && ['PENDING_RETRY', 'CLAIMED', 'RUNNING', 'RETRY_SCHEDULED'].includes(existing.status)) return { reused: true, job: publicJob(this.getJob(existing.job_id, enterpriseId)) };
    const id = uuid(); const now = this.now();
    db.transaction(() => {
      db.prepare('INSERT INTO audit_recovery_jobs(id,enterprise_id,handler_type,payload,idempotency_key,status,next_retry_at,max_attempts,recovery_deadline_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id, enterpriseId, handlerType, JSON.stringify(payload), idempotencyKey, STATES.PENDING_RETRY, now, Math.max(1, Number(maxAttempts)), this.later(recoveryWindowMs), now, now);
      db.prepare('INSERT INTO audit_recovery_idempotency(enterprise_id,idempotency_key,job_id,status,result_snapshot,updated_at,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(enterprise_id,idempotency_key) DO UPDATE SET job_id=excluded.job_id,status=excluded.status,result_snapshot=excluded.result_snapshot,updated_at=excluded.updated_at').run(enterpriseId, idempotencyKey, id, STATES.PENDING_RETRY, '{}', now, now);
    })(); this.event(enterpriseId, id, 'RECOVERY_CREATED', { handlerType }); return { reused: false, job: publicJob(this.getJob(id, enterpriseId)) };
  }
  createFromAuditQueue({ enterpriseId, queueId }) {
    const queue = db.prepare('SELECT * FROM audit_retry_queue WHERE id=? AND enterprise_id=?').get(queueId, enterpriseId);
    if (!queue) { const error = new Error('待恢复审计记录不存在或无权访问'); error.status = 404; throw error; }
    return this.create({ enterpriseId, handlerType: 'audit_retry_queue', payload: { queue_id: queue.id, event_type: queue.event_type }, idempotencyKey: `audit-queue:${queue.id}`, maxAttempts: 3 });
  }
  heartbeat(workerId, status = 'IDLE', currentJobId = '') { const now = this.now(); db.prepare('INSERT INTO audit_recovery_workers(worker_id,status,heartbeat_at,current_job_id,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(worker_id) DO UPDATE SET status=excluded.status,heartbeat_at=excluded.heartbeat_at,current_job_id=excluded.current_job_id,updated_at=excluded.updated_at').run(workerId, status, now, currentJobId, now); }
  reclaimExpiredLeases() { const now = this.now(); const rows = db.prepare("SELECT * FROM audit_recovery_jobs WHERE status IN ('CLAIMED','RUNNING') AND lease_expires_at<>'' AND lease_expires_at<?").all(now); for (const row of rows) { db.prepare("UPDATE audit_recovery_jobs SET status='PENDING_RETRY',claim_token='',claimed_by='',lease_expires_at='',next_retry_at=?,updated_at=? WHERE id=? AND lease_version=?").run(now, now, row.id, row.lease_version); this.event(row.enterprise_id, row.id, 'LEASE_EXPIRED', { previousStatus: row.status }); } return rows.length; }
  circuit(enterpriseId, handlerType) { const row = db.prepare('SELECT * FROM audit_recovery_circuits WHERE enterprise_id=? AND handler_type=?').get(enterpriseId, handlerType); return row || { enterprise_id: enterpriseId, handler_type: handlerType, status: 'CLOSED', failure_count: 0, cooldown_until: '' }; }
  allowCircuit(enterpriseId, handlerType) { const circuit = this.circuit(enterpriseId, handlerType); const now = this.now(); if (circuit.status === 'OPEN' && circuit.cooldown_until > now) return { allowed: false, circuit }; if (circuit.status === 'OPEN') { db.prepare("UPDATE audit_recovery_circuits SET status='HALF_OPEN',half_open_claim='',updated_at=? WHERE enterprise_id=? AND handler_type=?").run(now, enterpriseId, handlerType); return { allowed: true, circuit: { ...circuit, status: 'HALF_OPEN' } }; } if (circuit.status === 'HALF_OPEN' && circuit.half_open_claim) return { allowed: false, circuit }; return { allowed: true, circuit }; }
  updateCircuit(job, success) { const old = this.circuit(job.enterprise_id, job.handler_type); const now = this.now(); let status = 'CLOSED'; let failures = 0; let opened = ''; let cooldown = '';
    if (!success) { failures = Number(old.failure_count || 0) + 1; if (old.status === 'HALF_OPEN' || failures >= this.circuitThreshold) { status = 'OPEN'; opened = now; cooldown = this.later(this.circuitCooldownMs); this.event(job.enterprise_id, job.id, 'CIRCUIT_OPEN', { handlerType: job.handler_type, failures }); } }
    db.prepare('INSERT INTO audit_recovery_circuits(enterprise_id,handler_type,status,failure_count,opened_at,cooldown_until,half_open_claim,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(enterprise_id,handler_type) DO UPDATE SET status=excluded.status,failure_count=excluded.failure_count,opened_at=excluded.opened_at,cooldown_until=excluded.cooldown_until,half_open_claim=excluded.half_open_claim,updated_at=excluded.updated_at').run(job.enterprise_id, job.handler_type, status, failures, opened, cooldown, '', now);
  }
  claimNext(workerId, enterpriseId = '') { this.heartbeat(workerId, 'SCANNING'); this.reclaimExpiredLeases(); const now = this.now(); let claimed = null;
    db.transaction(() => { const where = enterpriseId ? 'AND enterprise_id=?' : ''; const candidate = db.prepare(`SELECT * FROM audit_recovery_jobs WHERE status IN ('PENDING_RETRY','RETRY_SCHEDULED') AND (next_retry_at='' OR next_retry_at<=?) ${where} ORDER BY created_at LIMIT 1`).get(...(enterpriseId ? [now, enterpriseId] : [now])); if (!candidate) return; assertTransition(candidate.status, STATES.CLAIMED); const gate = this.allowCircuit(candidate.enterprise_id, candidate.handler_type); if (!gate.allowed) { this.event(candidate.enterprise_id, candidate.id, 'CIRCUIT_BLOCKED', { handlerType: candidate.handler_type }); return; } const token = uuid(); const changed = db.prepare("UPDATE audit_recovery_jobs SET status='CLAIMED',claim_token=?,claimed_by=?,claimed_at=?,lease_expires_at=?,lease_version=lease_version+1,updated_at=? WHERE id=? AND status IN ('PENDING_RETRY','RETRY_SCHEDULED')").run(token, workerId, now, this.later(this.leaseMs), now, candidate.id); if (changed.changes === 1) claimed = this.getJob(candidate.id, candidate.enterprise_id); })();
    if (claimed) { this.heartbeat(workerId, 'CLAIMED', claimed.id); this.event(claimed.enterprise_id, claimed.id, 'CLAIMED', { workerId, leaseVersion: claimed.lease_version }); } return claimed;
  }
  situation(job) { const payload = parse(job.payload); return { handler_type: job.handler_type, input_fingerprint: fingerprint(payload.input || payload), dependency_state: payload.dependency_state || '', business_data_version: payload.business_data_version || '', approval_state: payload.approval_state || '', evidence_version: payload.evidence_version || '', environment: payload.environment || '' }; }
  transition(job, next, patch = {}) { assertTransition(job.status, next); const now = this.now(); const changed = db.prepare('UPDATE audit_recovery_jobs SET status=?,execution_status=?,verification_status=?,next_retry_at=?,last_error_type=?,last_error_code=?,last_error_signature=?,last_situation_fingerprint=?,no_progress_count=?,updated_at=? WHERE id=? AND claim_token=? AND lease_version=?').run(next, patch.executionStatus || job.execution_status, patch.verificationStatus || job.verification_status, patch.nextRetryAt ?? job.next_retry_at, patch.errorType ?? job.last_error_type, patch.errorCode ?? job.last_error_code, patch.errorSignature ?? job.last_error_signature, patch.situationFingerprint ?? job.last_situation_fingerprint, patch.noProgressCount ?? job.no_progress_count, now, job.id, job.claim_token, job.lease_version); if (changed.changes !== 1) { const error = new Error('恢复任务 Claim Token 已失效'); error.code = 'STALE_CLAIM_TOKEN'; error.status = 409; throw error; } }
  process(job, workerId) { if (!job) return null; const current = this.getJob(job.id, job.enterprise_id); if (current.claim_token !== job.claim_token) return { stale: true }; this.transition(current, STATES.RUNNING, { executionStatus: 'RUNNING' }); const running = this.getJob(job.id, job.enterprise_id); const attemptNo = Number(running.attempt_count) + 1; const attemptId = uuid(); const situation = this.situation(running); const situationFingerprint = fingerprint(situation); const now = this.now(); db.prepare('INSERT INTO audit_recovery_attempts(id,job_id,enterprise_id,attempt_no,claim_token,situation_state,situation_fingerprint,execution_status,verification_status,started_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(attemptId, running.id, running.enterprise_id, attemptNo, running.claim_token, JSON.stringify(situation), situationFingerprint, 'RUNNING', 'NOT_VERIFIED', now, now); db.prepare('UPDATE audit_recovery_jobs SET attempt_count=?,first_failed_at=CASE WHEN first_failed_at=\'\' THEN ? ELSE first_failed_at END,updated_at=? WHERE id=?').run(attemptNo, now, now, running.id); this.event(running.enterprise_id, running.id, 'ATTEMPT_STARTED', { attemptNo, workerId }, attemptId);
    if (running.recovery_deadline_at && running.recovery_deadline_at < now) return this.finishFailure(running, attemptId, { nonRetryable: true, code: 'recovery_window_exhausted', message: '恢复时间窗口已耗尽' }, situationFingerprint);
    const handler = this.handlers[running.handler_type]; let outcome;
    try { if (!handler?.execute) throw Object.assign(new Error('恢复处理器未注册'), { code: 'handler_unavailable' }); outcome = handler.execute({ job: publicJob(running), attemptNo, situation }); } catch (err) { outcome = { ok: false, code: err.code || 'handler_error', message: err.message }; }
    // An ambiguous external outcome may already have produced a side effect;
    // retrying it automatically would turn uncertainty into a duplicate action.
    if (outcome?.unknown) return this.finishUnknown(running, attemptId, outcome, situationFingerprint);
    if (!outcome?.ok) return this.finishFailure(running, attemptId, outcome || {}, situationFingerprint);
    let verification; try { verification = handler.verify ? handler.verify({ job: publicJob(running), outcome, attemptNo }) : { ok: true }; } catch (err) { verification = { ok: false, unknown: Boolean(err.unknown), code: err.code || 'verification_error', message: err.message }; }
    if (verification?.unknown) return this.finishUnknown(running, attemptId, verification, situationFingerprint, 'SUCCESS');
    if (!verification?.ok) return this.finishFailure(running, attemptId, { ...verification, code: verification.code || 'verification_failed', message: verification.message || '执行成功但独立验证失败', nonRetryable: true }, situationFingerprint, 'SUCCESS', 'FAILED');
    this.transition(running, STATES.SUCCEEDED, { executionStatus: 'SUCCESS', verificationStatus: 'VERIFIED', situationFingerprint }); db.prepare("UPDATE audit_recovery_attempts SET execution_status='SUCCESS',verification_status='VERIFIED',strategy='STOP',finished_at=? WHERE id=?").run(this.now(), attemptId); db.prepare("UPDATE audit_recovery_idempotency SET status='SUCCEEDED',result_snapshot=?,updated_at=? WHERE enterprise_id=? AND idempotency_key=?").run(JSON.stringify(outcome.result || {}), this.now(), running.enterprise_id, running.idempotency_key); this.updateCircuit(running, true); this.event(running.enterprise_id, running.id, 'VERIFIED_SUCCESS', { attemptNo }, attemptId); return publicJob(this.getJob(running.id, running.enterprise_id));
  }
  finishUnknown(job, attemptId, outcome, fp, execution = 'UNKNOWN') { this.transition(job, STATES.UNKNOWN, { executionStatus: execution, verificationStatus: 'UNKNOWN', errorType: FAILURE.UNKNOWN, errorCode: outcome.code || 'unknown', errorSignature: fingerprint({ code: outcome.code || 'unknown' }), situationFingerprint: fp }); db.prepare("UPDATE audit_recovery_attempts SET execution_status=?,verification_status='UNKNOWN',failure_class='UNKNOWN',failure_code=?,failure_reason=?,strategy='MARK_UNKNOWN',finished_at=? WHERE id=?").run(execution, outcome.code || 'unknown', sanitize(outcome.message || ''), this.now(), attemptId); db.prepare("UPDATE audit_recovery_idempotency SET status='UNKNOWN',result_snapshot=?,updated_at=? WHERE enterprise_id=? AND idempotency_key=?").run(JSON.stringify(outcome.result || {}), this.now(), job.enterprise_id, job.idempotency_key); this.event(job.enterprise_id, job.id, 'MARKED_UNKNOWN', { code: outcome.code || 'unknown', recoveryResult: outcome.result?.result || 'STILL_UNKNOWN' }, attemptId); return publicJob(this.getJob(job.id, job.enterprise_id)); }
  finishFailure(job, attemptId, outcome, fp, execution = 'FAILED', verification = 'NOT_VERIFIED') { const type = outcome.nonRetryable ? FAILURE.NON_RETRYABLE : classified(outcome); const signature = fingerprint({ type, code: outcome.code || '', message: outcome.message || '' }); const same = job.last_situation_fingerprint === fp && job.last_error_signature === signature; const noProgress = same ? Number(job.no_progress_count || 0) + 1 : 0; const exhausted = Number(job.attempt_count) + 1 >= Number(job.max_attempts) || (job.recovery_deadline_at && job.recovery_deadline_at < this.now()); let next = STATES.DEAD; let strategy = 'MARK_DEAD'; // Repeating identical evidence cannot add safety confidence, so stop this Run rather than loop indefinitely.
    if (type === FAILURE.UNKNOWN) { next = STATES.UNKNOWN; strategy = 'MARK_UNKNOWN'; } else if (type === FAILURE.RETRYABLE && !exhausted && noProgress < this.maxNoProgress) { next = STATES.RETRY_SCHEDULED; strategy = 'RETRY'; } else if (noProgress >= this.maxNoProgress) strategy = 'STOP_NO_PROGRESS';
    this.transition(job, next, { executionStatus: execution, verificationStatus: verification, nextRetryAt: next === STATES.RETRY_SCHEDULED ? this.later(retryDelay(Number(job.attempt_count) + 1)) : '', errorType: type, errorCode: outcome.code || 'execution_failed', errorSignature: signature, situationFingerprint: fp, noProgressCount: noProgress }); db.prepare('UPDATE audit_recovery_attempts SET execution_status=?,verification_status=?,failure_class=?,failure_code=?,failure_reason=?,strategy=?,finished_at=? WHERE id=?').run(execution, verification, type, outcome.code || 'execution_failed', sanitize(outcome.message || ''), strategy, this.now(), attemptId); db.prepare('UPDATE audit_recovery_idempotency SET status=?,updated_at=? WHERE enterprise_id=? AND idempotency_key=?').run(next, this.now(), job.enterprise_id, job.idempotency_key); this.updateCircuit(job, false); this.event(job.enterprise_id, job.id, noProgress >= this.maxNoProgress ? 'NO_PROGRESS' : 'ATTEMPT_FAILED', { type, code: outcome.code || '', strategy }, attemptId); return publicJob(this.getJob(job.id, job.enterprise_id));
  }
  runOnce(workerId, enterpriseId = '') { const job = this.claimNext(workerId, enterpriseId); if (!job) { this.heartbeat(workerId, 'IDLE'); return null; } try { return this.process(job, workerId); } finally { this.heartbeat(workerId, 'IDLE'); } }
  manualRetry({ enterpriseId, jobId, actor, reason, circuitOverride = false }) { if (!actor?.isAdmin) { const e = new Error('仅管理员可人工重试'); e.status = 403; throw e; } if (!String(reason || '').trim()) { const e = new Error('人工重试必须填写原因'); e.status = 400; throw e; } const old = this.getJob(jobId, enterpriseId); if (old.status === STATES.SUCCEEDED) return { reused: true, job: publicJob(old), message: '已存在成功结果，不重复执行' }; if (['CLAIMED', 'RUNNING'].includes(old.status)) { const e = new Error('操作正在执行中'); e.status = 409; throw e; } if (old.status === STATES.UNKNOWN && !circuitOverride) { const e = new Error('UNKNOWN 状态需要先完成独立状态查询或管理员覆盖'); e.status = 409; throw e; } // DEAD ends automatic recovery only; a new Run preserves immutable prior attempts and avoids rewriting history.
    const created = this.create({ enterpriseId, handlerType: old.handler_type, payload: parse(old.payload), idempotencyKey: `${old.idempotency_key}:manual:${uuid()}`, maxAttempts: old.max_attempts }); db.prepare('UPDATE audit_recovery_jobs SET parent_job_id=? WHERE id=?').run(old.id, created.job.id); this.event(enterpriseId, old.id, 'MANUAL_RETRY_REQUESTED', { reason: sanitize(reason), newJobId: created.job.id, circuitOverride: Boolean(circuitOverride) }); return created; }
  watchdog({ staleMs = 60000 } = {}) { const cutoff = new Date(new this.clock().getTime() - staleMs).toISOString(); const stale = db.prepare("SELECT * FROM audit_recovery_workers WHERE heartbeat_at<? AND status<>'STOPPED'").all(cutoff); for (const worker of stale) this.event('', worker.current_job_id || 'system', 'WORKER_HEARTBEAT_STALE', { workerId: worker.worker_id }); return { staleWorkers: stale.map(x => x.worker_id), reclaimed: this.reclaimExpiredLeases() }; }
  details(id, enterpriseId) { const job = this.getJob(id, enterpriseId); return { job: publicJob(job), attempts: db.prepare('SELECT * FROM audit_recovery_attempts WHERE job_id=? AND enterprise_id=? ORDER BY attempt_no').all(id, enterpriseId).map(x => ({ ...x, situation_state: parse(x.situation_state) })), events: db.prepare('SELECT * FROM audit_recovery_events WHERE job_id=? AND enterprise_id=? ORDER BY created_at').all(id, enterpriseId).map(x => ({ ...x, detail: parse(x.detail) })), circuit: this.circuit(enterpriseId, job.handler_type) }; }
}
module.exports = { AuditRecoveryService, STATES, FAILURE, TRANSITIONS, fingerprint, retryDelay, materialIssueFactResult };
