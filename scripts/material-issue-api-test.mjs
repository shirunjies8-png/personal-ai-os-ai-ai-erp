import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-material-issue-api-'));
process.env.DB_PATH = path.join(root, 'workflow.sqlite3'); process.env.UPLOADS_DIR = path.join(root, 'uploads'); process.env.LOGS_DIR = path.join(root, 'logs'); process.env.BACKUPS_DIR = path.join(root, 'backups'); process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const require = createRequire(import.meta.url); const db = require('../database/init'); const routes = require('../routes/transactionSafetyRoutes'); const controller = require('../controllers/transactionSafetyController');
const stamp = new Date().toISOString();
const enterprise = 'issue-api-a'; const otherEnterprise = 'issue-api-b';
const requester = { id: 'issue-requester', enterprise_id: enterprise, role: '企业管理员', name: '申请人' };
const approver = { id: 'issue-approver', enterprise_id: enterprise, role: '企业管理员', name: '审批人' };
const other = { id: 'issue-other', enterprise_id: otherEnterprise, role: '企业管理员', name: '其他企业管理员' };

function invoke(handler, { user = requester, params = {}, body = {} } = {}) { let status = 200; let payload; handler({ user, params, body }, { status(code) { status = code; return this; }, json(value) { payload = value; } }); return { status, payload }; }
function seedEnterprise(id) { db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(id, id, stamp, stamp); }
function seedUser(user) { db.prepare('INSERT INTO users(id,enterprise_id,email,password_hash,name,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(user.id, user.enterprise_id, `${user.id}@test`, 'hash', user.name, user.role, '启用', stamp, stamp); }
function seedInventory(id, tenant = enterprise, stock = 100, safety = 20) { db.prepare('INSERT INTO inventory(id,enterprise_id,product_code,product_name,stock_quantity,safety_stock,location,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, tenant, id, id, stock, safety, 'A01', 0, stamp, stamp); }

seedEnterprise(enterprise); seedEnterprise(otherEnterprise); [requester, approver, other].forEach(seedUser);
try {
  const paths = routes.stack.filter(layer => layer.route).map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  for (const expected of ['POST /preparations', 'GET /requisitions', 'GET /preparations/:id', 'POST /preparations/:id/approval', 'POST /preparations/:id/execute']) assert.ok(paths.includes(expected));
  for (const layer of routes.stack.filter(layer => layer.route)) assert.ok(layer.route.stack.some(handler => handler.name === 'authRequired'), '每个领料 API 必须经过认证');

  seedInventory('HTTP-37');
  const created = invoke(controller.prepare, { body: { business_operation_id: 'HTTP-37', inventory_id: 'HTTP-37', quantity: 30 } });
  assert.equal(created.status, 200); const preparationId = created.payload.data.preparation.id;
  assert.equal(invoke(controller.prepare, { body: { business_operation_id: 'HTTP-37', inventory_id: 'HTTP-37', quantity: 30 } }).payload.data.code, 'WAITING_EXISTING_APPROVAL');
  assert.equal(invoke(controller.approve, { params: { id: preparationId }, body: { approved: true, reason: '自批' } }).status, 403);
  assert.equal(invoke(controller.approve, { user: other, params: { id: preparationId }, body: { approved: true, reason: '跨租户' } }).status, 404);
  assert.equal(invoke(controller.approve, { user: approver, params: { id: preparationId }, body: { approved: true, reason: '批准' } }).status, 200);
  const executed = invoke(controller.execute, { user: requester, params: { id: preparationId } });
  assert.equal(executed.status, 200); assert.equal(executed.payload.data.preparation.status, 'COMMITTED');
  assert.equal(db.prepare('SELECT stock_quantity,version FROM inventory WHERE id=?').get('HTTP-37').stock_quantity, 70);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM stock_transactions WHERE business_operation_id=?').get('HTTP-37').n, 1);
  assert.equal(invoke(controller.prepare, { body: { business_operation_id: 'HTTP-37', inventory_id: 'HTTP-37', quantity: 30 } }).payload.data.code, 'COMMITTED_HISTORY');
  assert.equal(db.prepare('SELECT stock_quantity FROM inventory WHERE id=?').get('HTTP-37').stock_quantity, 70);
  assert.ok(invoke(controller.requisitions).payload.data.items.some(item => item.business_operation_id === 'HTTP-37'));
} finally { await new Promise(resolve => setTimeout(resolve, 100)); db.close(); fs.rmSync(root, { recursive: true, force: true }); }
console.log('real material issue authenticated HTTP controller workflow tests passed');
