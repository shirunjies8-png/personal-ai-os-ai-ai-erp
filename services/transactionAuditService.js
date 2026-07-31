const Database = require('better-sqlite3');
const env = require('../config/env');
const { v4: uuid } = require('uuid');

const now = () => new Date().toISOString();
const json = value => JSON.stringify(value || {});

function withAudit(write) {
  const auditDb = new Database(env.dbPath);
  try {
    auditDb.pragma('foreign_keys = ON');
    auditDb.pragma('busy_timeout = 5000');
    return write(auditDb);
  } finally { auditDb.close(); }
}

function recordAttempt({ run, stepId, attemptNo, status, code = '', message = '' }) {
  return withAudit(auditDb => {
    const id = uuid();
    auditDb.prepare('INSERT INTO runtime_attempts(id,run_id,step_id,enterprise_id,attempt_no,status,error_type,error_code,error_message,started_at,finished_at,duration_ms,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, run.run_id, stepId, run.enterprise_id, attemptNo, status, code ? 'business_rule_error' : '', code, message, now(), now(), 0, now());
    return id;
  });
}

function recordValidation({ run, stepId, attemptId, result, snapshot, reason, source = 'SNAPSHOT', overrideAllowed = true, validatorType = 'BUSINESS_RULE_VALIDATOR', ruleId = 'inventory.non_negative_and_safety' }) {
  return withAudit(auditDb => auditDb.prepare('INSERT INTO runtime_validations(id,run_id,step_id,attempt_id,enterprise_id,validator_type,validator_version,schema_version,rule_id,rule_version,input_snapshot,validation_result,failure_reason,validation_source,stale_warning,override_allowed,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(uuid(), run.run_id, stepId, attemptId, run.enterprise_id, validatorType, '1', '', ruleId, '1', json(snapshot), result, reason, source, source === 'SNAPSHOT' ? 'STALE_VALIDATION_WARNING: pre-approval data may change' : '', overrideAllowed ? 1 : 0, now()));
}

function markAttempt(id, status, code = '') {
  return withAudit(auditDb => auditDb.prepare('UPDATE runtime_attempts SET status=?,error_code=?,finished_at=? WHERE id=?').run(status, code, now(), id));
}

function finishRun(runId, patch = {}) {
  return withAudit(auditDb => auditDb.prepare('UPDATE runtime_runs SET finished_at=?,execution_status=?,verification_status=?,error_code=?,error_message=?,observability_status=? WHERE run_id=?')
    .run(now(), patch.execution_status || 'FAILED', patch.verification_status || 'UNKNOWN', patch.error_code || '', patch.error_message || '', patch.observability_status || 'RECORDED', runId));
}

module.exports = { recordAttempt, recordValidation, markAttempt, finishRun };
