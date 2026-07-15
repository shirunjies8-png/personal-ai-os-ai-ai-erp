import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.DB_PATH = `/tmp/personal-ai-os-apqp-records-${process.pid}.sqlite3`;
process.env.LOGS_DIR = `/tmp/personal-ai-os-apqp-records-logs-${process.pid}`;
const require = createRequire(import.meta.url);
const db = require('../database/init');
const service = require('../services/apqpService');
const controller = require('../controllers/apqpController');

const admin = { id: 'admin-a', enterprise_id: 'tenant-a', role: '企业管理员', name: '管理员' };
const operator = { id: 'operator-a', enterprise_id: 'tenant-a', role: 'operator', name: '操作员' };
const viewer = { id: 'viewer-a', enterprise_id: 'tenant-a', role: 'viewer', name: '访客' };
const otherTenant = { id: 'admin-b', enterprise_id: 'tenant-b', role: '企业管理员', name: '其他企业管理员' };

function invoke(handler, { params = {}, body = {}, user = operator } = {}) {
  let statusCode = 200;
  let payload;
  handler({ params, body, user }, {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; }
  });
  return { statusCode, payload };
}

function assertAssessment(value) {
  assert.ok(value);
  assert.equal(Number.isFinite(value.overall_progress), true);
  assert.ok(value.overall_progress >= 0 && value.overall_progress <= 100);
  for (const stage of value.stage_progress) assert.ok(stage.progress >= 0 && stage.progress <= 100);
}

const project = service.create({ project_no: `APQP-RECORDS-${process.pid}`, project_name: '记录 API 专项测试' }, admin);
const firstStage = project.stages[0];
const deliverable = firstStage.deliverables[0];

// 交付物 GET/PATCH、证据阻塞和不适用理由。
let response = invoke(controller.deliverables, { params: { id: project.id } });
assert.equal(response.payload.ok, true);
assert.equal(response.payload.data.items.length, 38);
assertAssessment(response.payload.data.assessment);

response = invoke(controller.updateDeliverable, {
  params: { id: project.id, recordId: deliverable.id }, body: { owner: '质量负责人', notes: '待收集证据' }
});
assert.equal(response.payload.ok, true);
assert.equal(response.payload.data.project.stages[0].deliverables[0].owner, '质量负责人');
assertAssessment(response.payload.data.project.assessment);

assert.throws(() => service.update(project.id, 'deliverables', deliverable.id, { status: 'completed' }, operator), /缺少证据/);
assert.throws(() => service.update(project.id, 'deliverables', deliverable.id, { is_applicable: 0 }, operator), /必须填写理由/);
service.update(project.id, 'deliverables', firstStage.deliverables[1].id, {
  is_applicable: 0, not_applicable_reason: '客户书面确认不适用'
}, operator);

// 证据新增/GET，明确仅保存 metadata_only 记录。
response = invoke(controller.evidence, {
  params: { id: project.id },
  body: { deliverable_id: deliverable.id, file_name: 'customer-requirement.pdf', file_type: 'application/pdf', file_size: 128 }
});
assert.equal(response.payload.ok, true);
assertAssessment(response.payload.data.project.assessment);
response = invoke(controller.evidenceRecords, { params: { id: project.id } });
assert.equal(response.payload.ok, true);
assert.equal(response.payload.data.items.length, 1);
assert.equal(response.payload.data.items[0].storage_status, 'metadata_only');
const evidence = response.payload.data.items[0];

// 删除原因、管理员权限、软删除字段和删除后重新阻塞。
response = invoke(controller.removeEvidence, { params: { id: project.id, evidenceId: evidence.id }, body: {}, user: admin });
assert.equal(response.statusCode, 400);
assert.match(response.payload.message, /必须填写原因/);
assert.throws(() => service.removeEvidence(project.id, evidence.id, { delete_reason: '无效请求' }, operator), /权限不足/);
response = invoke(controller.removeEvidence, {
  params: { id: project.id, evidenceId: evidence.id },
  body: { delete_reason: '证据版本错误，仅删除元数据记录' }, user: admin
});
assert.equal(response.payload.ok, true);
const removed = response.payload.data.project;
assertAssessment(removed.assessment);
assert.ok(removed.assessment.missing_evidence.length > 0);
const deletedRow = db.prepare('SELECT * FROM apqp_evidence WHERE id=?').get(evidence.id);
assert.ok(deletedRow.deleted_at);
assert.equal(deletedRow.deleted_by, admin.id);
assert.equal(deletedRow.delete_reason, '证据版本错误，仅删除元数据记录');
assert.equal(service.records(project.id, admin, 'evidence').length, 0);
const resetDeliverable = db.prepare('SELECT * FROM apqp_deliverables WHERE id=?').get(deliverable.id);
assert.equal(resetDeliverable.evidence_count, 0);
assert.equal(resetDeliverable.status, 'waiting_evidence');

// 风险 GET/POST/PATCH，等级与阻断状态确定性计算。
response = invoke(controller.risk, {
  params: { id: project.id },
  body: { title: '关键设备不可用', severity: 'high', probability: 4, impact: 4, owner: '设备经理' }
});
assert.equal(response.payload.ok, true);
response = invoke(controller.risks, { params: { id: project.id } });
assert.equal(response.payload.ok, true);
assert.equal(response.payload.data.items.length, 1);
const risk = response.payload.data.items[0];
assert.equal(risk.risk_level, 'high');
assert.equal(risk.is_blocking, 1);
assert.throws(() => service.update(project.id, 'risks', risk.id, { status: 'accepted' }, operator), /必须填写理由/);
assert.throws(() => service.update(project.id, 'risks', risk.id, { status: 'closed' }, operator), /必须填写说明或证据/);
assert.throws(() => service.update(project.id, 'risks', risk.id, { risk_level: 'low' }, operator), /由系统计算/);
response = invoke(controller.updateRisk, {
  params: { id: project.id, recordId: risk.id },
  body: { status: 'accepted', acceptance_reason: '管理层书面接受并持续跟踪' }
});
assert.equal(response.payload.ok, true);
assertAssessment(response.payload.data.project.assessment);
const closedRisk = service.update(project.id, 'risks', risk.id, {
  status: 'closed', closure_evidence: 'CAPA-2026-001 已验证关闭'
}, operator);
assertAssessment(closedRisk.assessment);

// 任务 GET/POST/PATCH，证据要求和逾期由确定性代码处理。
assert.throws(() => service.task(project.id, {
  stage_id: firstStage.id, title: '无证据直接完成', evidence_required: true, status: 'completed'
}, operator), /必须先关联证据/);
response = invoke(controller.task, {
  params: { id: project.id },
  body: { stage_id: firstStage.id, title: '确认客户需求', owner: '项目经理', due_date: '2000-01-01', evidence_required: true }
});
assert.equal(response.payload.ok, true);
response = invoke(controller.tasks, { params: { id: project.id } });
assert.equal(response.payload.ok, true);
assert.equal(response.payload.data.items.length, 1);
const task = response.payload.data.items[0];
assert.equal(task.overdue, true);
assert.throws(() => service.update(project.id, 'tasks', task.id, { status: 'completed' }, operator), /必须先关联证据/);

service.evidence(project.id, { deliverable_id: deliverable.id, file_name: 'customer-requirement-v2.pdf' }, operator);
response = invoke(controller.updateTask, {
  params: { id: project.id, recordId: task.id },
  body: { owner: '项目负责人', due_date: '2030-12-31', status: 'completed', completion_note: '已复核' }
});
assert.equal(response.payload.ok, true);
assertAssessment(response.payload.data.project.assessment);
const completedTask = service.records(project.id, operator, 'tasks')[0];
assert.equal(completedTask.status, 'completed');
assert.equal(completedTask.overdue, false);
assert.ok(completedTask.completed_at);

// tenant_id、写权限、历史/审计链和统一评估范围。
assert.throws(() => service.records(project.id, otherTenant, 'deliverables'), /项目不存在/);
assert.throws(() => service.update(project.id, 'tasks', task.id, { owner: '越权' }, viewer), /权限不足/);
assert.throws(() => service.evidence(project.id, { deliverable_id: deliverable.id }, viewer), /权限不足/);
const actions = service.history(project.id, admin).map(item => item.action);
for (const expected of ['更新deliverables', '上传证据记录', '软删除证据记录', '新增风险', '更新risks', '新增任务', '更新tasks']) {
  assert.ok(actions.includes(expected), `缺少历史记录：${expected}`);
}
const auditTitles = db.prepare("SELECT title FROM logs WHERE enterprise_id=? AND type='apqp'").all(admin.enterprise_id)
  .map(item => item.title);
for (const expected of ['更新deliverables', '软删除证据记录', '更新risks', '更新tasks']) {
  assert.ok(auditTitles.includes(expected), `缺少统一审计日志：${expected}`);
}
assertAssessment(service.assessment(project.id, admin));

console.log('apqp record API tests passed');
