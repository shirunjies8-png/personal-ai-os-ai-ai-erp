import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// Scenario E is intentionally a fact-recovery test: the original Execute has
// already committed before the client loses its response. Recovery must read
// evidence only and must not call the Material Issue executor a second time.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-material-issue-unknown-'));
process.env.DB_PATH = path.join(root, 'workflow.sqlite3');
process.env.UPLOADS_DIR = path.join(root, 'uploads');
process.env.LOGS_DIR = path.join(root, 'logs');
process.env.BACKUPS_DIR = path.join(root, 'backups');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const require = createRequire(import.meta.url);
const db = require('../database/init');
const materialIssue = require('../services/transactionSafetyService');
const recovery = require('../services/materialIssueRecoveryService');
const { materialIssueFactResult } = require('../services/auditRecoveryService');
const recoveryController = require('../controllers/materialIssueRecoveryController');
const issueRoutes = require('../routes/transactionSafetyRoutes');
const recoveryRoutes = require('../routes/auditRecoveryRoutes');
const stamp = new Date().toISOString();
const enterprise = 'scenario-e-enterprise';
const requester = { id: 'scenario-e-requester', enterprise_id: enterprise, role: '企业管理员', name: '申请人' };
const approver = { id: 'scenario-e-approver', enterprise_id: enterprise, role: '企业管理员', name: '审批人' };

function invoke(handler, { user = requester, params = {}, body = {} } = {}) {
  let status = 200; let payload;
  handler({ user, params, body }, { status(code) { status = code; return this; }, json(value) { payload = value; } });
  return { status, payload };
}

db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(enterprise, 'Scenario E Fixture', stamp, stamp);
for (const user of [requester, approver]) db.prepare('INSERT INTO users(id,enterprise_id,email,password_hash,name,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(user.id, enterprise, `${user.id}@fixture.test`, 'hash', user.name, user.role, '启用', stamp, stamp);
db.prepare('INSERT INTO inventory(id,enterprise_id,product_code,product_name,stock_quantity,safety_stock,location,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('scenario-e-stock', enterprise, 'SC-E', 'Scenario E Normal Inventory', 100, 20, 'A-01', 0, stamp, stamp);

try {
  assert.deepEqual(recovery.RECOVERY_STATUS, { UNKNOWN: 'UNKNOWN', CHECKING: 'CHECKING', COMMITTED: 'COMMITTED', NOT_COMMITTED: 'NOT_COMMITTED', STILL_UNKNOWN: 'STILL_UNKNOWN' });
  const issuePaths = issueRoutes.stack.filter(layer => layer.route).map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  const recoveryPaths = recoveryRoutes.stack.filter(layer => layer.route).map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.ok(issuePaths.includes('POST /preparations/:id/result-unavailable'));
  assert.ok(recoveryPaths.includes('GET /material-issue/:businessOperationId'));

  const created = materialIssue.prepare({ enterpriseId: enterprise, userId: requester.id, role: requester.role, input: { business_operation_id: 'SCENARIO-E-001', inventory_id: 'scenario-e-stock', quantity: 30 } });
  const preparationId = created.preparation.id;
  materialIssue.decide({ enterpriseId: enterprise, preparationId, approved: true, reason: '独立审批', actor: { enterpriseId: enterprise, userId: approver.id, role: approver.role, name: approver.name } });

  // Server-side Execute completes. The test deliberately does not consume a
  // response from a browser; it records only the later client observation.
  const executed = materialIssue.execute({ enterpriseId: enterprise, preparationId });
  assert.equal(executed.preparation.status, 'COMMITTED');
  const beforeRecovery = db.prepare('SELECT stock_quantity,version FROM inventory WHERE id=? AND enterprise_id=?').get('scenario-e-stock', enterprise);
  assert.deepEqual(beforeRecovery, { stock_quantity: 70, version: 1 });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stock_transactions WHERE enterprise_id=? AND business_operation_id=? AND transaction_type='INVENTORY_ISSUE'").get(enterprise, 'SCENARIO-E-001').count, 1);

  const unavailable = invoke(recoveryController.unavailable, { params: { id: preparationId } });
  assert.equal(unavailable.status, 200);
  assert.equal(unavailable.payload.data.observation, 'RESULT_UNAVAILABLE');
  assert.equal(unavailable.payload.data.job.handler_type, 'material_issue_fact_validator');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM runtime_attempts WHERE run_id=? AND error_code='RESULT_UNAVAILABLE'").get(created.preparation.run_id).count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM runtime_validations WHERE run_id=? AND validator_type='MATERIAL_ISSUE_UNKNOWN_OBSERVATION'").get(created.preparation.run_id).count, 1);
  const checking = invoke(recoveryController.status, { params: { businessOperationId: 'SCENARIO-E-001' } });
  assert.equal(checking.payload.data.status, 'CHECKING');

  const result = recovery.recovery.runOnce('scenario-e-fact-worker', enterprise);
  assert.equal(result.status, 'SUCCEEDED');
  const lookup = invoke(recoveryController.status, { params: { businessOperationId: 'SCENARIO-E-001' } });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.payload.data.status, 'COMMITTED');
  assert.equal(lookup.payload.data.verified, true);
  assert.equal(lookup.payload.data.source, 'inventory_transaction');
  assert.equal(lookup.payload.data.evidence.inventory_transaction_count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM runtime_validations WHERE run_id=? AND validator_type='MATERIAL_ISSUE_FACT_VALIDATOR' AND validation_result='COMMITTED'").get(created.preparation.run_id).count, 1);

  // The evidence verifier must not mutate the already committed business fact.
  const afterRecovery = db.prepare('SELECT stock_quantity,version FROM inventory WHERE id=? AND enterprise_id=?').get('scenario-e-stock', enterprise);
  assert.deepEqual(afterRecovery, beforeRecovery);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stock_transactions WHERE enterprise_id=? AND business_operation_id=? AND transaction_type='INVENTORY_ISSUE'").get(enterprise, 'SCENARIO-E-001').count, 1);
  assert.equal(db.prepare("SELECT status FROM business_transactions WHERE enterprise_id=? AND business_operation_id=?").get(enterprise, 'SCENARIO-E-001').status, 'COMMITTED');

  // Explicit non-commit proof: a rejected operation produces no ledger and is
  // classified from facts, not from a client-side HTTP guess.
  const rejected = materialIssue.prepare({ enterpriseId: enterprise, userId: requester.id, role: requester.role, input: { business_operation_id: 'SCENARIO-E-REJECTED', inventory_id: 'scenario-e-stock', quantity: 10 } });
  materialIssue.decide({ enterpriseId: enterprise, preparationId: rejected.preparation.id, approved: false, reason: '测试拒绝', actor: { enterpriseId: enterprise, userId: approver.id, role: approver.role, name: approver.name } });
  invoke(recoveryController.unavailable, { params: { id: rejected.preparation.id } });
  const rejectedRecovery = recovery.recovery.runOnce('scenario-e-fact-worker', enterprise);
  assert.equal(rejectedRecovery.status, 'SUCCEEDED');
  assert.equal(invoke(recoveryController.status, { params: { businessOperationId: 'SCENARIO-E-REJECTED' } }).payload.data.status, 'NOT_COMMITTED');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stock_transactions WHERE enterprise_id=? AND business_operation_id=?").get(enterprise, 'SCENARIO-E-REJECTED').count, 0);

  // A mismatched transaction reference is intentionally unresolved rather than
  // guessed as failure or success.
  assert.equal(materialIssueFactResult({ enterprise_id: enterprise, payload: { business_operation_id: 'SCENARIO-E-001', material_issue_id: preparationId, transaction_id: 'missing-transaction' } }).result, 'STILL_UNKNOWN');
} finally {
  await new Promise(resolve => setTimeout(resolve, 100));
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Scenario E Material Issue UNKNOWN recovery uses read-only fact validation without duplicate inventory execution');
