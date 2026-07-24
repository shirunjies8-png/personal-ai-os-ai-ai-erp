import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-manufacturing-api-'));
process.env.DB_PATH = path.join(tempRoot, 'manufacturing-api.sqlite3');
process.env.UPLOADS_DIR = path.join(tempRoot, 'uploads');
process.env.LOGS_DIR = path.join(tempRoot, 'logs');
process.env.BACKUPS_DIR = path.join(tempRoot, 'backups');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const require = createRequire(import.meta.url);
const db = require('../database/init');
const routes = require('../routes/manufacturingRoutes');
const controller = require('../controllers/manufacturingController');
const timestamp = new Date().toISOString();

for (const [id, name] of [['http-tenant-a', '接口企业 A'], ['http-tenant-b', '接口企业 B']]) {
  db.prepare(`INSERT OR IGNORE INTO enterprises(id,name,logo_url,contact_name,contact_phone,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?)`).run(id, name, '', '', '', timestamp, timestamp);
}
const adminA = { id: 'http-admin-a', enterprise_id: 'http-tenant-a', role: '企业管理员', name: '管理员 A' };
const operatorA = { id: 'http-operator-a', enterprise_id: 'http-tenant-a', role: 'operator', name: '业务员 A' };
const viewerA = { id: 'http-viewer-a', enterprise_id: 'http-tenant-a', role: 'viewer', name: '访客 A' };
const adminB = { id: 'http-admin-b', enterprise_id: 'http-tenant-b', role: '企业管理员', name: '管理员 B' };

function invoke(handler, { user = operatorA, params = {}, body = {}, query = {}, headers = {} } = {}) {
  let status = 200;
  let payload;
  handler({ user, params, body, query, headers, get(name) { return headers[String(name).toLowerCase()]; } }, {
    status(code) { status = code; return this; },
    json(value) { payload = value; }
  });
  return { status, payload };
}

try {
  const routePaths = routes.stack.filter(layer => layer.route).map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  for (const expected of [
    'GET /customers', 'POST /customers', 'PATCH /customers/:id', 'DELETE /customers/:id',
    'GET /projects', 'POST /projects', 'PATCH /projects/:id', 'DELETE /projects/:id',
    'GET /rfqs', 'POST /rfqs', 'PATCH /rfqs/:id', 'DELETE /rfqs/:id',
    'POST /rfqs/:id/submit-review', 'POST /rfqs/:id/transition', 'POST /rfqs/:id/convert-to-quotation'
  ]) assert.ok(routePaths.includes(expected), `缺少受认证 API 路由：${expected}`);
  assert.ok(routes.stack.some(layer => !layer.route && layer.name === 'authRequired'), '制造业务路由必须统一接入认证中间件');

  let result = invoke(controller.createCustomer, { body: { name: '接口测试客户', owner: '业务员' } });
  assert.equal(result.status, 200);
  const customer = result.payload.data.customer;
  const retryHeaders = { 'idempotency-key': 'http-customer-create-retry-0001' };
  const retryInput = { body: { name: 'HTTP 幂等客户' }, headers: retryHeaders };
  const retryCustomer = invoke(controller.createCustomer, retryInput).payload.data.customer;
  assert.equal(invoke(controller.createCustomer, retryInput).payload.data.customer.id, retryCustomer.id, '控制器必须将 Idempotency-Key 交给服务端幂等处理');
  assert.equal(invoke(controller.listCustomers, { user: adminB }).payload.data.items.length, 0);
  assert.equal(invoke(controller.getCustomer, { user: adminB, params: { id: customer.id } }).status, 404);

  result = invoke(controller.createProject, { body: { customer_id: customer.id, name: '接口测试项目', status: 'active' } });
  assert.equal(result.status, 200);
  const project = result.payload.data.project;

  result = invoke(controller.createRfq, { body: {
    customer_id: customer.id, project_id: project.id, product_name: '接口测试零件', quantity: 20,
    owner: '业务员', contact_name: '张工', contact_details: '13800138000'
  } });
  assert.equal(result.status, 200);
  let rfq = result.payload.data.rfq;
  assert.ok(rfq.assessment.missing_fields.length > 0);
  assert.equal(invoke(controller.updateRfq, { user: viewerA, params: { id: rfq.id }, body: { notes: '越权' } }).status, 403);
  assert.equal(invoke(controller.updateRfq, { params: { id: rfq.id }, body: { status: 'won' } }).status, 400);

  result = invoke(controller.updateRfq, { params: { id: rfq.id }, body: {
    version: rfq.version, material: '6061铝合金', process_requirements: 'CNC', requested_delivery_date: '2026-10-31'
  } });
  rfq = result.payload.data.rfq;
  assert.equal(rfq.assessment.missing_fields.length, 0);
  result = invoke(controller.submitReview, { params: { id: rfq.id }, body: {} });
  rfq = result.payload.data.rfq;
  assert.equal(rfq.status, 'waiting_review');
  assert.equal(rfq.assessment.approval_status, 'pending');

  result = invoke(controller.transitionRfq, { user: adminA, params: { id: rfq.id }, body: { target_status: 'ready_for_quotation', reason: '人工评审通过' } });
  assert.equal(result.status, 200);
  rfq = result.payload.data.rfq;
  assert.equal(rfq.status, 'ready_for_quotation');
  result = invoke(controller.convertToQuotation, { params: { id: rfq.id }, body: {} });
  assert.equal(result.payload.data.quotationDraft.approvedByHuman, true);
  assert.equal(result.payload.data.rfq.status, 'quotation_in_progress');
  result = invoke(controller.getHistory, { params: { id: rfq.id } });
  assert.ok(result.payload.data.items.some(item => item.action === 'convert_to_quotation'));
} finally {
  await new Promise(resolve => setTimeout(resolve, 350));
  db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('manufacturing authenticated API routes, tenant isolation and quotation conversion tests passed');
