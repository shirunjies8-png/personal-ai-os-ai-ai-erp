import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-trusted-execution-'));
process.env.DB_PATH = path.join(root, 'trusted.sqlite3'); process.env.UPLOADS_DIR = path.join(root, 'uploads'); process.env.LOGS_DIR = path.join(root, 'logs'); process.env.BACKUPS_DIR = path.join(root, 'backups'); process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const require = createRequire(import.meta.url); const db = require('../database/init'); const service = require('../services/trustedExecutionService');
const stamp = new Date().toISOString();
for (const id of ['trusted-a', 'trusted-b']) db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(id, id, stamp, stamp);
db.prepare('INSERT INTO users(id,enterprise_id,email,password_hash,name,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('user-a', 'trusted-a', 'trusted-a@example.test', 'hash', '管理员', '企业管理员', '启用', stamp, stamp);
try {
  const base = { enterpriseId: 'trusted-a', userId: 'user-a', role: '企业管理员' };
  // CASE 11: execution can succeed while schema validation independently fails.
  const schema = service.execute({ ...base, input: { business_operation_id: 'SCHEMA-001', scenario: 'schema', payload: { customer: 123, product: '零件', quantity: 1 }, prediction_confidence: 0.95, prediction_risk: 'LOW' } });
  assert.equal(schema.result.execution_status, 'SUCCESS'); assert.equal(schema.result.final_status, 'HUMAN_REVIEW_REQUIRED');
  assert.equal(schema.details.validations[0].validation_result, 'FAILED_VALIDATION'); assert.match(schema.details.validations[0].failure_reason, /field type mismatch/);
  assert.ok(schema.details.outcome && schema.details.outcome.feedback_type === 'false_positive');
  // CASE 15: invalid JSON is malformed before Schema Validator.
  const malformed = service.execute({ ...base, input: { business_operation_id: 'MALFORMED-001', scenario: 'schema', payload: '这里是分析结果：xxxx' } });
  assert.equal(malformed.result.execution_status, 'EXECUTION_MALFORMED'); assert.equal(malformed.details.validations[0].validator_type, 'FORMAT_SANITIZER');
  const bounded = service.execute({ ...base, input: { business_operation_id: 'TRACE-001', scenario: 'schema', max_bytes: 300, max_tokens: 64, payload: { customer: 'a'.repeat(2000), product: '产品', quantity: 1 } } });
  assert.ok(Buffer.byteLength(bounded.details.validations[0].input_snapshot, 'utf8') <= 300, 'validator snapshot must obey storage guard');
  // CASE 16: syntactically correct JSON with an invalid field remains Schema validation failure.
  assert.equal(schema.details.validations[0].validator_type, 'SCHEMA_VALIDATOR');
  // CASE 12: business rule blocks negative stock without mutating inventory.
  const inventory = service.execute({ ...base, input: { business_operation_id: 'INV-001', scenario: 'inventory', payload: { current_inventory: 100, issue_quantity: 120 } } });
  assert.equal(inventory.result.final_status, 'BLOCKED'); assert.equal(inventory.details.validations[0].validation_result, 'BUSINESS_RULE_FAILED');
  // CASE 17: snapshot validation announces staleness instead of pretending serializable data.
  assert.equal(inventory.details.validations[0].validation_source, 'SNAPSHOT'); assert.match(inventory.details.validations[0].stale_warning, /STALE_VALIDATION_WARNING/);
  // CASE 13: same business operation returns the original result, not a second run.
  const duplicate = service.execute({ ...base, input: { business_operation_id: 'INV-001', scenario: 'inventory', payload: { current_inventory: 100, issue_quantity: 120 } } });
  assert.equal(duplicate.idempotent, true); assert.equal(duplicate.run.run_id, inventory.run.run_id);
  // CASE 19: UNKNOWN is query-only and never runs a second operation.
  db.prepare('UPDATE business_operations SET status=? WHERE run_id=?').run('UNKNOWN', schema.run.run_id);
  const unknown = service.execute({ ...base, input: { business_operation_id: 'SCHEMA-001', scenario: 'schema', payload: { customer: 'x', product: 'y', quantity: 1 } } });
  assert.equal(unknown.code, 'OPERATION_STATUS_UNKNOWN');
  // Retry preserves a failed attempt and succeeds on a later attempt.
  const recovered = service.execute({ ...base, input: { business_operation_id: 'RETRY-001', scenario: 'schema', max_attempts: 2, transient_failures: 1, payload: { customer: '客户', product: '产品', quantity: 1 } } });
  assert.equal(recovered.result.final_status, 'SUCCESS'); assert.equal(recovered.details.attempts.length, 2); assert.equal(recovered.details.attempts[0].status, 'FAILED'); assert.equal(recovered.details.attempts[1].status, 'SUCCESS');
  // Retry is exhausted and validation errors do not get retried.
  const exhausted = service.execute({ ...base, input: { business_operation_id: 'RETRY-002', scenario: 'schema', max_attempts: 2, transient_failures: 2, payload: {} } });
  assert.equal(exhausted.result.final_status, 'RETRY_EXHAUSTED'); assert.equal(exhausted.details.attempts.length, 2);
  // Non-idempotent work is never auto-retried and requires a real approval decision.
  const waiting = service.execute({ ...base, input: { business_operation_id: 'APPROVAL-001', idempotent: false, payload: { customer: '客户', product: '产品', quantity: 1 } } });
  assert.equal(waiting.waitingApproval, true); assert.equal(waiting.run.execution_status, 'BLOCKED');
  // CASE 18: a repeat request observes the one existing approval instead of creating a second request.
  const waitingAgain = service.execute({ ...base, input: { business_operation_id: 'APPROVAL-001', idempotent: false, payload: { customer: '客户', product: '产品', quantity: 1 } } });
  assert.equal(waitingAgain.code, 'WAITING_EXISTING_APPROVAL');
  const rejected = service.decideApproval({ enterpriseId: 'trusted-a', runId: waiting.run.run_id, approved: false, reason: '测试拒绝', actor: { enterpriseId: 'trusted-a', userId: 'user-a', name: '管理员', role: '企业管理员' } });
  assert.equal(rejected.run.execution_status, 'CANCELLED');
  // CASE 20: a permitted business-rule override re-executes once with recorded override context.
  const overrideWaiting = service.execute({ ...base, input: { business_operation_id: 'OVERRIDE-001', idempotent: false, scenario: 'inventory', payload: { current_inventory: 10, issue_quantity: 12 } } });
  const overridden = service.decideApproval({ enterpriseId: 'trusted-a', runId: overrideWaiting.run.run_id, approved: true, reason: '紧急生产订单', overrideContext: { human_override: true, override_reason: '紧急生产订单', override_scope: 'single_run' }, actor: { enterpriseId: 'trusted-a', userId: 'user-a', name: '管理员', role: '企业管理员' } });
  assert.equal(overridden.result.final_status, 'SUCCESS_WITH_HUMAN_OVERRIDE'); assert.equal(overridden.details.approvals[0].human_override, 1);
  const tenantB = 'trusted-b'; assert.throws(() => service.details(schema.run.run_id, tenantB), /运行记录不存在/);
} finally { await new Promise(resolve => setTimeout(resolve, 350)); db.close(); fs.rmSync(root, { recursive: true, force: true }); }
console.log('trusted execution run, retry, validation, idempotency, outcome and tenant tests passed');
