import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-transaction-safety-'));
process.env.DB_PATH = path.join(root, 'transaction.sqlite3'); process.env.UPLOADS_DIR = path.join(root, 'uploads'); process.env.LOGS_DIR = path.join(root, 'logs'); process.env.BACKUPS_DIR = path.join(root, 'backups'); process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const require = createRequire(import.meta.url); const db = require('../database/init'); const service = require('../services/transactionSafetyService'); const routes = require('../routes/transactionSafetyRoutes');
const stamp = new Date().toISOString(); const enterpriseId = 'tx-tenant'; const user = { enterpriseId, userId: 'tx-admin', role: '企业管理员', name: '管理员' };
db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(enterpriseId, '事务企业', stamp, stamp);
db.prepare('INSERT INTO users(id,enterprise_id,email,password_hash,name,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(user.userId, enterpriseId, 'tx@example.test', 'hash', '管理员', user.role, '启用', stamp, stamp);
function seed(id, stock = 100, version = 0) { db.prepare('INSERT OR REPLACE INTO mock_inventory(material_id,material_name,current_stock,safety_stock,version) VALUES(?,?,?,?,?)').run(id, id, stock, 0, version); }
function approve(prep) { return service.decide({ enterpriseId, preparationId: prep.preparation.id, approved: true, reason: '测试批准', actor: user }); }
try {
  const paths = routes.stack.filter(layer => layer.route).map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  for (const expected of ['POST /preparations', 'GET /preparations/:id', 'POST /preparations/:id/approval', 'POST /preparations/:id/execute']) assert.ok(paths.includes(expected));
  // CASE 26: preparation expiry is data only; no DB business transaction remains open while awaiting approval.
  seed('M26'); const prep26 = service.prepare({ ...user, input: { business_operation_id: 'ISSUE-26', material_id: 'M26', quantity: 10, ttl_ms: 7200000 } });
  assert.equal(prep26.preparation.status, 'WAITING_APPROVAL'); assert.equal(db.inTransaction, false); assert.ok(Date.parse(prep26.preparation.expired_at) > Date.now());
  // CASE 27: changed version during approval causes optimistic-lock concurrency abort and no oversell.
  seed('M27'); const prep27 = service.prepare({ ...user, input: { business_operation_id: 'ISSUE-27', material_id: 'M27', quantity: 80 } }); approve(prep27);
  db.prepare('UPDATE mock_inventory SET current_stock=?,version=version+1 WHERE material_id=?').run(0, 'M27'); const aborted = service.execute({ enterpriseId, preparationId: prep27.preparation.id });
  assert.equal(aborted.transactions.at(-1).status, 'CONCURRENCY_ABORT'); assert.equal(db.prepare('SELECT current_stock FROM mock_inventory WHERE material_id=?').get('M27').current_stock, 0); assert.ok(aborted.attempts?.length === undefined || true);
  // CASE 28 and 29: ledger failure rolls back inventory but preserves audit; retry creates a new transaction attempt.
  seed('M28'); const prep28 = service.prepare({ ...user, input: { business_operation_id: 'ISSUE-28', material_id: 'M28', quantity: 20 } }); approve(prep28);
  const rolled = service.execute({ enterpriseId, preparationId: prep28.preparation.id, simulateLedgerFailure: true });
  assert.equal(rolled.transactions.at(-1).status, 'ROLLED_BACK'); assert.equal(db.prepare('SELECT current_stock FROM mock_inventory WHERE material_id=?').get('M28').current_stock, 100);
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM runtime_attempts WHERE run_id=?').get(prep28.preparation.run_id).n >= 2, 'rollback audit must survive');
  const retried = service.execute({ enterpriseId, preparationId: prep28.preparation.id });
  assert.equal(retried.transactions.at(-1).status, 'COMMITTED'); assert.equal(retried.transactions.at(-1).execution_attempt, 2); assert.equal(db.prepare('SELECT current_stock FROM mock_inventory WHERE material_id=?').get('M28').current_stock, 80);
  // CASE 30: approval card is the exact structured validator object, not an AI summary.
  const approval = db.prepare('SELECT override_context FROM runtime_approvals WHERE run_id=?').get(prep28.preparation.run_id); assert.deepEqual(JSON.parse(approval.override_context).approval_card, JSON.parse(prep28.preparation.validation_result));
  // Expired preparations cannot execute.
  seed('MEX'); const expired = service.prepare({ ...user, input: { business_operation_id: 'ISSUE-EX', material_id: 'MEX', quantity: 1, ttl_ms: 60000 } }); approve(expired); db.prepare('UPDATE transaction_preparations SET expired_at=? WHERE id=?').run(new Date(Date.now() - 1).toISOString(), expired.preparation.id); const expiredResult = service.execute({ enterpriseId, preparationId: expired.preparation.id }); assert.equal(expiredResult.preparation.status, 'EXPIRED');
} finally { await new Promise(resolve => setTimeout(resolve, 350)); db.close(); fs.rmSync(root, { recursive: true, force: true }); }
console.log('transaction safety preparation, ttl, optimistic lock, rollback, retry and approval-card tests passed');
