import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.DB_PATH = `/tmp/personal-ai-os-apqp-update-${process.pid}.sqlite3`;
process.env.LOGS_DIR = `/tmp/personal-ai-os-apqp-update-logs-${process.pid}`;
const require = createRequire(import.meta.url);
require('../database/init');
const service = require('../services/apqpService');
const controller = require('../controllers/apqpController');

const admin = { id: 'admin-a', enterprise_id: 'tenant-a', role: '企业管理员', name: '管理员' };
const operator = { id: 'operator-a', enterprise_id: 'tenant-a', role: 'operator', name: '操作员' };
const otherTenant = { id: 'admin-b', enterprise_id: 'tenant-b', role: '企业管理员', name: '其他企业管理员' };
const created = service.create({ project_no: `APQP-UPDATE-${process.pid}`, project_name: '更新前', project_owner: '负责人甲' }, admin);

const common = service.updateProject(created.id, { project_name: '更新后', customer_or_source: '客户 A' }, operator);
assert.equal(common.project_name, '更新后');
assert.equal(common.version, 2);
assert.ok(common.assessment);
assert.equal(Number.isFinite(common.assessment.overall_progress), true);

assert.throws(() => service.updateProject(created.id, { current_stage: 5 }, admin), /禁止直接修改字段/);
assert.throws(() => service.updateProject(created.id, { project_owner: '越权负责人' }, operator), /权限不足/);
assert.throws(() => service.updateProject(created.id, { project_name: '跨企业修改' }, otherTenant), /项目不存在/);

const sensitive = service.updateProject(created.id, { project_owner: '负责人乙', planned_end_date: '2026-12-31', importance_level: 'high' }, admin);
assert.equal(sensitive.project_owner, '负责人乙');
assert.equal(sensitive.planned_end_date, '2026-12-31');
assert.equal(sensitive.importance_level, 'high');
assert.equal(sensitive.version, 3);

const audit = service.history(created.id, admin).find(item => item.action === '修改 APQP 项目' && item.detail.includes('project_owner'));
assert.ok(audit);
assert.match(audit.detail, /负责人甲/);
assert.match(audit.detail, /负责人乙/);

let response;
controller.updateProject({ params: { id: created.id }, body: { product_description: '控制器更新' }, user: operator }, {
  json(payload) { response = payload; },
  status(code) { this.statusCode = code; return this; }
});
assert.equal(response.ok, true);
assert.equal(response.data.project.product_description, '控制器更新');
assert.ok(response.data.project.assessment);

console.log('apqp update API test passed');
