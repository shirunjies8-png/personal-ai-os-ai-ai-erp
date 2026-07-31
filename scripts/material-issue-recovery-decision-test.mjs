import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-material-issue-decision-'));
process.env.DB_PATH = path.join(root, 'workflow.sqlite3'); process.env.UPLOADS_DIR = path.join(root, 'uploads'); process.env.LOGS_DIR = path.join(root, 'logs'); process.env.BACKUPS_DIR = path.join(root, 'backups'); process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const require = createRequire(import.meta.url);
const db = require('../database/init');
const materialIssue = require('../services/transactionSafetyService');
const recovery = require('../services/materialIssueRecoveryService');
const { DECISIONS } = require('../services/materialIssueRecoveryDecisionService');
const stamp = new Date().toISOString(); const enterprise = 'decision-enterprise';
const requester = { id: 'decision-requester', enterprise_id: enterprise, role: '企业管理员', name: '申请人' };
const approver = { id: 'decision-approver', enterprise_id: enterprise, role: '企业管理员', name: '审批人' };

function seedInventory(id, stock = 100) { db.prepare('INSERT INTO inventory(id,enterprise_id,product_code,product_name,stock_quantity,safety_stock,location,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, enterprise, id, id, stock, 20, 'A01', 0, stamp, stamp); }
function create(operationId, inventoryId, quantity = 30) { return materialIssue.prepare({ enterpriseId: enterprise, userId: requester.id, role: requester.role, input: { business_operation_id: operationId, inventory_id: inventoryId, quantity } }); }
function approve(preparationId, approved = true) { return materialIssue.decide({ enterpriseId: enterprise, preparationId, approved, reason: approved ? '批准' : '拒绝', actor: { enterpriseId: enterprise, userId: approver.id, role: approver.role, name: approver.name } }); }
function unknown(preparationId) { return recovery.recordResultUnavailable({ enterpriseId: enterprise, actor: { userId: requester.id, role: requester.role }, preparationId }); }
function run() { return recovery.recovery.runOnce('decision-worker', enterprise); }

db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(enterprise, 'Decision Fixture', stamp, stamp);
for (const user of [requester, approver]) db.prepare('INSERT INTO users(id,enterprise_id,email,password_hash,name,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(user.id, enterprise, `${user.id}@fixture.test`, 'hash', user.name, user.role, '启用', stamp, stamp);

try {
  // F1: committed fact is safely completed; fact validation never changes it.
  seedInventory('F1'); const f1 = create('F1-COMMITTED', 'F1'); approve(f1.preparation.id); materialIssue.execute({ enterpriseId: enterprise, preparationId: f1.preparation.id });
  const f1Before = db.prepare('SELECT stock_quantity,version FROM inventory WHERE id=?').get('F1'); unknown(f1.preparation.id); run(); const f1View = recovery.lookup({ enterpriseId: enterprise, businessOperationId: 'F1-COMMITTED' });
  assert.equal(f1View.factResult, 'COMMITTED'); assert.equal(f1View.decision.decision, DECISIONS.SAFE_COMPLETE); assert.equal(f1View.decision.executionAllowed, false); assert.equal(f1View.decision.approvalRequired, false);
  assert.deepEqual(db.prepare('SELECT stock_quantity,version FROM inventory WHERE id=?').get('F1'), f1Before); assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stock_transactions WHERE business_operation_id='F1-COMMITTED'").get().count, 1);

  // F2: rejected/not-committed fact can request governance approval only.
  seedInventory('F2'); const f2 = create('F2-NOT-COMMITTED', 'F2'); approve(f2.preparation.id, false); const f2Before = db.prepare('SELECT stock_quantity,version FROM inventory WHERE id=?').get('F2'); unknown(f2.preparation.id); run(); const f2View = recovery.lookup({ enterpriseId: enterprise, businessOperationId: 'F2-NOT-COMMITTED' });
  assert.equal(f2View.factResult, 'NOT_COMMITTED'); assert.equal(f2View.decision.decision, DECISIONS.RETRY_REQUIRES_APPROVAL); assert.equal(f2View.decision.executionAllowed, false); assert.equal(f2View.decision.approvalRequired, true); assert.equal(f2View.decision.approval.status, 'pending');
  assert.deepEqual(db.prepare('SELECT stock_quantity,version FROM inventory WHERE id=?').get('F2'), f2Before); assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stock_transactions WHERE business_operation_id='F2-NOT-COMMITTED'").get().count, 0); assert.equal(db.prepare("SELECT COUNT(*) AS count FROM business_transactions WHERE business_operation_id='F2-NOT-COMMITTED'").get().count, 1);

  // F3: a missing transaction reference remains a read-only recheck, never execute.
  const f3Job = recovery.recovery.create({ enterpriseId: enterprise, handlerType: 'material_issue_fact_validator', payload: { observation: 'RESULT_UNAVAILABLE', business_operation_id: 'F1-COMMITTED', material_issue_id: f1.preparation.id, preparation_id: f1.preparation.id, transaction_id: 'missing-transaction', runtime_run_id: f1.preparation.run_id, runtime_step_id: db.prepare('SELECT id FROM runtime_steps WHERE run_id=?').get(f1.preparation.run_id).id, input: { business_operation_id: 'F1-COMMITTED', transaction_id: 'missing-transaction' } }, idempotencyKey: 'F3-still-unknown', maxAttempts: 1 });
  run(); const f3Detail = recovery.recovery.details(f3Job.job.id, enterprise); const f3Result = JSON.parse(db.prepare('SELECT result_snapshot FROM audit_recovery_idempotency WHERE enterprise_id=? AND idempotency_key=?').get(enterprise, 'F3-still-unknown').result_snapshot);
  assert.equal(f3Detail.job.status, 'UNKNOWN'); assert.equal(f3Result.result, 'STILL_UNKNOWN'); assert.equal(f3Result.decision.decision, DECISIONS.RECHECK_REQUIRED); assert.equal(f3Result.decision.executionAllowed, false);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stock_transactions WHERE business_operation_id='F1-COMMITTED'").get().count, 1);

  // F4: a ledger plus contradictory transaction state is a conflict, not a guess.
  seedInventory('F4'); const f4 = create('F4-CONFLICT', 'F4'); approve(f4.preparation.id); materialIssue.execute({ enterpriseId: enterprise, preparationId: f4.preparation.id });
  db.prepare("UPDATE business_transactions SET status='FAILED' WHERE enterprise_id=? AND business_operation_id=?").run(enterprise, 'F4-CONFLICT');
  unknown(f4.preparation.id); run(); const f4View = recovery.lookup({ enterpriseId: enterprise, businessOperationId: 'F4-CONFLICT' });
  assert.equal(f4View.factResult, 'CONFLICT'); assert.equal(f4View.decision.decision, DECISIONS.BLOCKED_CONFLICT); assert.equal(f4View.decision.executionAllowed, false); assert.equal(f4View.decision.approvalRequired, true); assert.ok(f4View.evidence.conflict_codes.includes('LEDGER_WITH_NON_COMMITTED_TRANSACTION'));
  assert.ok(db.prepare("SELECT COUNT(*) AS count FROM runtime_validations WHERE validator_type='MATERIAL_ISSUE_RECOVERY_DECISION_POLICY' AND validation_result='BLOCKED_CONFLICT'").get().count >= 1);

  // F5: a completed Recovery Job is idempotent. A second scan creates neither
  // another attempt nor another governance approval or inventory effect.
  const f2Attempts = db.prepare('SELECT COUNT(*) AS count FROM audit_recovery_attempts WHERE job_id=?').get(f2View.recovery_job_id).count;
  const f2Approvals = db.prepare("SELECT COUNT(*) AS count FROM agent_approvals WHERE tool_name='material_issue_recovery_decision' AND enterprise_id=?").get(enterprise).count;
  assert.equal(run(), null);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM audit_recovery_attempts WHERE job_id=?').get(f2View.recovery_job_id).count, f2Attempts);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM agent_approvals WHERE tool_name='material_issue_recovery_decision' AND enterprise_id=?").get(enterprise).count, f2Approvals);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stock_transactions WHERE enterprise_id=?").get(enterprise).count, 2);
} finally { await new Promise(resolve => setTimeout(resolve, 100)); db.close(); fs.rmSync(root, { recursive: true, force: true }); }

console.log('material issue recovery decision governance F1-F5 tests passed without any recovery execution');
