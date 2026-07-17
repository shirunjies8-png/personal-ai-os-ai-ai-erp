import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-manufacturing-'));
process.env.DB_PATH = path.join(tempRoot, 'manufacturing.sqlite3');
process.env.UPLOADS_DIR = path.join(tempRoot, 'uploads');
process.env.LOGS_DIR = path.join(tempRoot, 'logs');
process.env.BACKUPS_DIR = path.join(tempRoot, 'backups');

const require = createRequire(import.meta.url);
const db = require('../database/init');
const service = require('../services/manufacturingService');
const controller = require('../controllers/manufacturingController');

db.prepare(`INSERT OR IGNORE INTO enterprises(id,name,logo_url,contact_name,contact_phone,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?)`).run('tenant-a', '企业 A', '', '', '', new Date().toISOString(), new Date().toISOString());
db.prepare(`INSERT OR IGNORE INTO enterprises(id,name,logo_url,contact_name,contact_phone,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?)`).run('tenant-b', '企业 B', '', '', '', new Date().toISOString(), new Date().toISOString());

const admin = { id: 'admin-a', enterprise_id: 'tenant-a', role: '企业管理员', name: '管理员', email: 'admin-a@example.test' };
const operator = { id: 'operator-a', enterprise_id: 'tenant-a', role: 'operator', name: '业务员', email: 'operator-a@example.test' };
const viewer = { id: 'viewer-a', enterprise_id: 'tenant-a', role: 'viewer', name: '访客' };
const otherAdmin = { id: 'admin-b', enterprise_id: 'tenant-b', role: '企业管理员', name: '企业 B 管理员' };

function invoke(handler, { params = {}, body = {}, query = {}, user = operator } = {}) {
  let statusCode = 200;
  let payload;
  handler({ params, body, query, user }, {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; }
  });
  return { statusCode, payload };
}

for (const table of [
  'schema_migrations', 'document_sequences', 'legacy_migration_records', 'entity_attachments',
  'customers', 'customer_contacts', 'projects', 'rfqs', 'rfq_requirements', 'rfq_risks', 'rfq_followups'
]) {
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table), `缺少表 ${table}`);
}
assert.equal(db.prepare("SELECT COUNT(*) count FROM schema_migrations WHERE status='applied'").get().count, 3);

const customer = service.createCustomer({
  name: '测试制造客户', source: '现场询盘', level: 'important', owner: '业务员',
  primaryContact: { name: '张工', phone: '13800138000', email: 'zhang@example.test', isPrimary: true }
}, operator);
assert.match(customer.customer_no, /^CUS-\d{4}-\d{6}$/);
assert.equal(customer.contacts.length, 1);

const otherCustomer = service.createCustomer({ name: '企业 B 客户' }, otherAdmin);
assert.equal(service.listCustomers({}, operator).items.length, 1);
assert.equal(service.listCustomers({}, otherAdmin).items.length, 1);
assert.equal(service.listCustomers({}, otherAdmin).items[0].id, otherCustomer.id);
assert.throws(() => service.getCustomer(customer.id, otherAdmin), /不存在或无权访问/);
assert.throws(() => service.updateCustomer(customer.id, { name: '访客越权' }, viewer), /权限不足/);

const contact = service.addCustomerContact(customer.id, {
  name: '李经理', phone: '13900139000', email: 'li@example.test'
}, operator);
const updatedContact = service.updateCustomerContact(customer.id, contact.id, { title: '采购经理' }, operator);
assert.equal(updatedContact.title, '采购经理');

const project = service.createProject({
  customer_id: customer.id,
  name: '新能源结构件项目',
  owner: '项目经理',
  planned_start_date: '2026-07-17',
  planned_end_date: '2026-12-31',
  status: 'active'
}, operator);
assert.match(project.project_no, /^PRJ-\d{4}-\d{6}$/);
assert.throws(() => service.createProject({
  customer_id: customer.id, name: '错误日期', planned_start_date: '2026-12-31', planned_end_date: '2026-01-01'
}, operator), /不能早于/);

let rfq = service.createRfq({
  customer_id: customer.id,
  project_id: project.id,
  product_name: '精密支架',
  quantity: 100,
  unit: '件',
  owner: '业务员',
  contact_name: '张工',
  contact_details: '13800138000'
}, operator);
assert.match(rfq.rfq_no, /^RFQ-\d{6}-\d{6}$/);
assert.ok(rfq.assessment.missing_fields.some(item => item.key === 'material'));
assert.ok(rfq.assessment.missing_fields.some(item => item.key === 'process_requirements'));

rfq = service.submitReview(rfq.id, {}, operator);
assert.equal(rfq.status, 'information_required');
assert.ok(rfq.assessment.blockers.length > 0);

rfq = service.updateRfq(rfq.id, {
  version: rfq.version,
  material: '304不锈钢',
  process_requirements: '激光切割、折弯、焊接',
  requested_delivery_date: '2026-09-30',
  tolerance_requirements: '关键尺寸±0.05',
  surface_treatment: '拉丝',
  packaging_requirements: '独立防刮包装'
}, operator);
assert.equal(rfq.assessment.missing_fields.length, 0);
assert.throws(() => service.updateRfq(rfq.id, { version: 1, notes: '版本冲突' }, operator), /刷新后重试/);
assert.throws(() => service.updateRfq(rfq.id, { status: 'won' }, operator), /受控动作/);

rfq = service.createRisk(rfq.id, {
  title: '交期过紧', category: 'delivery', severity: 5, probability: 4, impact: 5,
  owner: '项目经理', mitigation: '评估加班和外协'
}, operator);
const risk = rfq.risks[0];
assert.equal(risk.risk_level, 'critical');
assert.equal(risk.is_blocking, 1);

rfq = service.submitReview(rfq.id, {}, operator);
assert.equal(rfq.status, 'waiting_review');
assert.equal(rfq.assessment.approval_status, 'pending');
assert.throws(() => service.transitionRfq(rfq.id, { target_status: 'ready_for_quotation' }, admin), /仍被阻塞/);
assert.throws(() => service.updateRisk(rfq.id, risk.id, { status: 'accepted' }, admin), /必须填写接受理由/);
assert.throws(() => service.updateRisk(rfq.id, risk.id, { risk_level: 'low' }, admin), /由程序计算/);

rfq = service.updateRisk(rfq.id, risk.id, {
  version: risk.version,
  status: 'accepted',
  acceptance_reason: '客户书面确认交期风险，管理层批准加急方案'
}, admin);
assert.equal(rfq.assessment.open_blocking_risks.length, 0);
rfq = service.transitionRfq(rfq.id, { target_status: 'ready_for_quotation', reason: '需求及风险已人工评审' }, admin);
assert.equal(rfq.status, 'ready_for_quotation');
assert.equal(rfq.assessment.approval_status, 'approved');

const conversion = service.convertToQuotation(rfq.id, {}, operator);
assert.equal(conversion.rfq.status, 'quotation_in_progress');
assert.equal(conversion.quotationDraft.source, 'manufacturing_rfq');
assert.equal(conversion.quotationDraft.approvedByHuman, true);
assert.equal(conversion.quotationDraft.customerName, customer.name);

rfq = service.transitionRfq(rfq.id, { target_status: 'quoted' }, operator);
rfq = service.transitionRfq(rfq.id, { target_status: 'negotiating' }, operator);
assert.throws(() => service.transitionRfq(rfq.id, { target_status: 'won' }, operator), /必须填写原因/);
rfq = service.transitionRfq(rfq.id, { target_status: 'won', reason: '客户邮件确认成交' }, operator);
assert.equal(rfq.status, 'won');

const historyActions = rfq.history.map(item => item.action);
for (const action of ['create', 'submit_review', 'risk_create', 'risk_update', 'transition', 'convert_to_quotation']) {
  assert.ok(historyActions.includes(action), `缺少审计动作 ${action}`);
}
const auditRow = db.prepare("SELECT before_json,after_json FROM logs WHERE entity_type='rfq' AND entity_id=? AND action='update' ORDER BY created_at DESC LIMIT 1")
  .get(rfq.id);
assert.ok(auditRow);
assert.doesNotMatch(`${auditRow.before_json}${auditRow.after_json}`, /13800138000/);

const draftToDelete = service.createRfq({
  customer_id: customer.id, product_name: '可删除草稿', owner: '业务员', contact_name: '张工', contact_details: '13800138000'
}, operator);
assert.throws(() => service.deleteRfq(draftToDelete.id, { reason: '访客删除' }, viewer), /权限不足/);
const deleted = service.deleteRfq(draftToDelete.id, { reason: '重复录入' }, admin);
assert.ok(deleted.deleted_at);
assert.throws(() => service.getRfq(draftToDelete.id, operator), /不存在或无权访问/);

const statePayload = {
  ocrInquiries: [{ id: 'legacy-1', customerName: '旧询盘客户', productName: '旧询盘零件', quantity: '20', status: 'approved' }]
};
db.prepare(`INSERT INTO app_states(enterprise_id,payload,updated_at) VALUES(?,?,?)
  ON CONFLICT(enterprise_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`)
  .run('tenant-a', JSON.stringify(statePayload), new Date().toISOString());
const imported = service.importLegacyRfqs(admin);
assert.equal(imported.imported, 1);
assert.equal(imported.items[0].status, 'draft', '旧数据不得自动标记为已批准');
assert.equal(service.importLegacyRfqs(admin).skipped, 1, '旧数据迁移必须幂等');

let response = invoke(controller.listRfqs, { query: { q: '精密支架' } });
assert.equal(response.statusCode, 200);
assert.equal(response.payload.ok, true);
assert.ok(response.payload.data.items.some(item => item.id === rfq.id));
response = invoke(controller.getRfq, { params: { id: rfq.id }, user: otherAdmin });
assert.equal(response.statusCode, 404);
assert.equal(response.payload.detail.code, 'RFQ_NOT_FOUND');
response = invoke(controller.createRfq, {
  body: { customer_id: customer.id, product_name: '访客创建' }, user: viewer
});
assert.equal(response.statusCode, 403);

const ranges = service.listRfqs({}, operator).items.map(item => item.assessment);
assert.ok(ranges.every(item => Array.isArray(item.blockers) && Array.isArray(item.next_actions)));

await new Promise(resolve => setTimeout(resolve, 350));
db.close();
fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('manufacturing phase 2 migrations, customer, project, RFQ, isolation and audit tests passed');
