import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-real-inventory-'));
process.env.DB_PATH = path.join(root, 'transaction.sqlite3');
process.env.UPLOADS_DIR = path.join(root, 'uploads'); process.env.LOGS_DIR = path.join(root, 'logs'); process.env.BACKUPS_DIR = path.join(root, 'backups');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const require = createRequire(import.meta.url);
const db = require('../database/init');
const service = require('../services/transactionSafetyService');
const controller = require('../controllers/inventoryController');
const routes = require('../routes/transactionSafetyRoutes');
const stamp = new Date().toISOString();
const enterpriseId = 'real-tx-a'; const otherEnterpriseId = 'real-tx-b';
const user = { enterpriseId, userId: 'real-admin', role: '企业管理员', name: '库存管理员' };

function insertEnterprise(id) { db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(id, id, stamp, stamp); }
function insertUser(id, enterprise) { db.prepare('INSERT INTO users(id,enterprise_id,email,password_hash,name,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id, enterprise, `${id}@example.test`, 'hash', id, '企业管理员', '启用', stamp, stamp); }
function seed(id, enterprise = enterpriseId, stock = 100, safety = 0, version = 0) {
  db.prepare('INSERT INTO inventory(id,enterprise_id,product_code,product_name,stock_quantity,safety_stock,location,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(id, enterprise, id, `物料-${id}`, stock, safety, 'A01', version, stamp, stamp);
}
function prepare(operationId, inventoryId, quantity, extra = {}) { return service.prepare({ ...user, input: { business_operation_id: operationId, inventory_id: inventoryId, quantity, ...extra } }); }
function approve(prep, options = {}) { return service.decide({ enterpriseId, preparationId: prep.preparation.id, approved: true, reason: Object.prototype.hasOwnProperty.call(options, 'reason') ? options.reason : '测试批准', humanOverride: Boolean(options.humanOverride), actor: user }); }
function fakeResponse() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

insertEnterprise(enterpriseId); insertEnterprise(otherEnterpriseId); insertUser(user.userId, enterpriseId); insertUser('other-admin', otherEnterpriseId);
try {
  const paths = routes.stack.filter(layer => layer.route).map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  for (const expected of ['POST /preparations', 'GET /preparations/:id', 'POST /preparations/:id/approval', 'POST /preparations/:id/execute']) assert.ok(paths.includes(expected));

  // Migration: new real tables and compatible inventory version are present.
  for (const table of ['stock_transactions', 'material_requisitions', 'material_reservations', 'audit_retry_queue']) assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
  assert.ok(db.prepare('PRAGMA table_info(inventory)').all().some(column => column.name === 'version'));

  // Old PUT cannot directly modify quantity.
  seed('INV-PUT'); const response = fakeResponse();
  controller.updateInventory({ params: { id: 'INV-PUT' }, user: { enterprise_id: enterpriseId }, body: { stockQuantity: 1 } }, response);
  assert.equal(response.statusCode, 409); assert.match(response.body.message, /INVENTORY_QUANTITY_REQUIRES_TRANSACTION/);
  assert.equal(db.prepare('SELECT stock_quantity FROM inventory WHERE id=?').get('INV-PUT').stock_quantity, 100);

  // CASE 26: awaiting approval does not keep a business SQLite transaction open.
  seed('INV-26'); const prep26 = prepare('ISSUE-26', 'INV-26', 10, { ttl_seconds: 7200 });
  assert.equal(prep26.preparation.status, 'WAITING_APPROVAL'); assert.equal(db.inTransaction, false);

  // CASE 27 / 31: an external version change during approval causes an optimistic-lock abort.
  seed('INV-27'); const prep27 = prepare('ISSUE-27', 'INV-27', 80); approve(prep27);
  db.prepare('UPDATE inventory SET stock_quantity=?,version=version+1 WHERE id=? AND enterprise_id=?').run(0, 'INV-27', enterpriseId);
  const abort27 = service.execute({ enterpriseId, preparationId: prep27.preparation.id });
  assert.equal(abort27.transactions.at(-1).status, 'CONCURRENCY_ABORT');
  assert.equal(db.prepare('SELECT stock_quantity FROM inventory WHERE id=?').get('INV-27').stock_quantity, 0);

  // CASE 28 and 29: ledger failure rolls back stock; the next attempt gets a new transaction and commits.
  seed('INV-28'); const prep28 = prepare('ISSUE-28', 'INV-28', 20); approve(prep28);
  const rollback28 = service.execute({ enterpriseId, preparationId: prep28.preparation.id, simulateLedgerFailure: true });
  assert.equal(rollback28.transactions.at(-1).status, 'ROLLED_BACK'); assert.equal(db.prepare('SELECT stock_quantity FROM inventory WHERE id=?').get('INV-28').stock_quantity, 100);
  const retry28 = service.execute({ enterpriseId, preparationId: prep28.preparation.id });
  assert.equal(retry28.transactions.at(-1).status, 'COMMITTED'); assert.equal(retry28.transactions.at(-1).execution_attempt, 2);
  assert.equal(db.prepare('SELECT stock_quantity,version FROM inventory WHERE id=?').get('INV-28').stock_quantity, 80);
  assert.equal(db.prepare('SELECT version FROM inventory WHERE id=?').get('INV-28').version, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM stock_transactions WHERE transaction_id=?').get(retry28.transactions.at(-1).id).n, 1);

  // CASE 30: the approval card is the exact structured validator object, without LLM wording.
  const approval30 = db.prepare('SELECT override_context FROM runtime_approvals WHERE run_id=?').get(prep28.preparation.run_id);
  assert.deepEqual(JSON.parse(approval30.override_context).approval_card, JSON.parse(prep28.preparation.validation_result));

  // CASE 32: committed business operations are idempotent and do not deduct again.
  const duplicate32 = prepare('ISSUE-28', 'INV-28', 20);
  assert.equal(duplicate32.code, 'COMMITTED_HISTORY'); assert.equal(db.prepare('SELECT stock_quantity FROM inventory WHERE id=?').get('INV-28').stock_quantity, 80);

  // CASE 33: audit degradation after a committed business transaction is queued, not silently lost.
  seed('INV-33'); const prep33 = prepare('ISSUE-33', 'INV-33', 10); approve(prep33);
  const committed33 = service.execute({ enterpriseId, preparationId: prep33.preparation.id, simulateAuditFailure: true });
  assert.equal(committed33.transactions.at(-1).audit_status, 'PENDING_RETRY');
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM audit_retry_queue WHERE run_id=? AND status='PENDING_RETRY'").get(prep33.preparation.run_id).n >= 1);

  // CASE 34: a failed preparation creates no half-complete preparation or reservation.
  const before34 = db.prepare('SELECT COUNT(*) AS n FROM transaction_preparations').get().n;
  assert.throws(() => prepare('ISSUE-34', 'MISSING-INVENTORY', 1), /库存记录不存在/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transaction_preparations').get().n, before34);

  // CASE 35: a second active operation for the same inventory is prevented by Soft Reservation.
  seed('INV-35'); const prep35 = prepare('ISSUE-35-A', 'INV-35', 10);
  const collision35 = prepare('ISSUE-35-B', 'INV-35', 10); assert.equal(collision35.code, 'SOFT_RESERVATION_CONFLICT');
  assert.equal(prep35.reservations[0].inventory_id, 'INV-35');

  // CASE 36: safety-stock override needs an explicit reason and remains fully auditable.
  seed('INV-36', enterpriseId, 100, 50); const prep36 = prepare('ISSUE-36', 'INV-36', 70);
  assert.throws(() => approve(prep36, { humanOverride: true, reason: '' }), /人工覆盖必须填写原因/);
  approve(prep36, { humanOverride: true, reason: '紧急生产订单' }); const committed36 = service.execute({ enterpriseId, preparationId: prep36.preparation.id });
  assert.equal(committed36.transactions.at(-1).status, 'COMMITTED');
  const override36 = db.prepare('SELECT override_context FROM runtime_approvals WHERE run_id=?').get(prep36.preparation.run_id);
  assert.equal(JSON.parse(override36.override_context).human_override, true); assert.equal(JSON.parse(override36.override_context).override_reason, '紧急生产订单');

  // Tenant isolation and persistence: enterprise A cannot prepare against enterprise B inventory; committed data remains queryable.
  seed('INV-B', otherEnterpriseId); assert.throws(() => prepare('ISSUE-CROSS', 'INV-B', 1), /库存记录不存在/);
  assert.equal(db.prepare('SELECT stock_quantity FROM inventory WHERE id=? AND enterprise_id=?').get('INV-28', enterpriseId).stock_quantity, 80);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stock_transactions WHERE transaction_type='OPENING_BALANCE'").get().n, 0, 'fixtures must not fabricate legacy history');
} finally {
  await new Promise(resolve => setTimeout(resolve, 100));
  db.close(); fs.rmSync(root, { recursive: true, force: true });
}
console.log('real inventory transaction migration, locking, atomic ledger, tenant isolation and audit tests passed');
