const { v4: uuidv4 } = require('uuid');
const db = require('../models/baseModel');
const permission = require('./permissionService');
const logService = require('./logService');

const STAGES = [
  ['计划和确定项目', ['客户需求', '项目目标', '可行性评审', '初始材料清单', '初始过程流程图', '初始特殊特性清单', '项目质量目标', '项目计划']],
  ['产品设计与开发验证', ['设计评审', 'DFMEA', '设计验证计划', '设计验证结果', '图纸或技术规范', '工程变更记录', '样件控制计划']],
  ['过程设计与开发验证', ['过程流程图', 'PFMEA', '试生产控制计划', '作业指导书', '包装规范', '设备和工装计划', '测量系统计划', '初始过程能力计划']],
  ['产品和过程确认', ['试生产记录', 'MSA 结果', '初始过程能力研究', '产品验证结果', '过程验证结果', 'PPAP 提交状态', '量产控制计划', '生产准备评审']],
  ['反馈、评定和纠正措施', ['客户反馈', '不良和投诉', '8D 或整改任务', '过程能力趋势', '经验总结', '遗留风险', '项目关闭评审']]
];

const RECORD_TABLES = Object.freeze({
  deliverables: 'apqp_deliverables',
  evidence: 'apqp_evidence',
  risks: 'apqp_risks',
  tasks: 'apqp_tasks'
});
const RISK_STATUSES = new Set(['open', 'handling', 'mitigated', 'accepted', 'closed']);
const TASK_STATUSES = new Set(['pending', 'in_progress', 'waiting_evidence', 'completed', 'blocked', 'cancelled']);
const now = () => new Date().toISOString();

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function history(project, action, detail, user) {
  db.prepare('INSERT INTO apqp_history VALUES(?,?,?,?,?,?,?)')
    .run(uuidv4(), project.id, project.tenant_id, action, detail, user.id, now());
  logService.add({ enterpriseId: project.tenant_id, userId: user.id, type: 'apqp', title: action, detail });
}

function project(id, tenantId) {
  return db.prepare('SELECT * FROM apqp_projects WHERE id=? AND tenant_id=?').get(id, tenantId);
}

function must(id, user) {
  const item = project(id, user.enterprise_id);
  if (!item) throw inputError('项目不存在');
  return item;
}

function detail(item) {
  const stages = db.prepare('SELECT * FROM apqp_stages WHERE project_id=? ORDER BY stage_no').all(item.id);
  return {
    ...item,
    stages: stages.map(stage => ({
      ...stage,
      deliverables: db.prepare('SELECT * FROM apqp_deliverables WHERE stage_id=?').all(stage.id),
      risks: db.prepare('SELECT * FROM apqp_risks WHERE project_id=?').all(item.id),
      tasks: db.prepare('SELECT * FROM apqp_tasks WHERE stage_id=?').all(stage.id),
      approvals: db.prepare('SELECT * FROM apqp_stage_approvals WHERE stage_id=?').all(stage.id)
    }))
  };
}

function create(input, user) {
  permission.authorizeAgent({ role: user.role });
  const timestamp = now();
  const id = uuidv4();
  const item = {
    id,
    tenant_id: user.enterprise_id,
    project_no: String(input.project_no || `APQP-${Date.now()}`),
    project_name: String(input.project_name || '未命名 APQP'),
    customer_or_source: input.customer_or_source || '',
    product_description: input.product_description || '',
    project_owner: input.project_owner || user.name || '',
    project_team: input.project_team || '',
    project_type: input.project_type || '',
    importance_level: input.importance_level || 'medium',
    planned_start_date: input.planned_start_date || '',
    planned_end_date: input.planned_end_date || '',
    customer_requirements: input.customer_requirements || '',
    special_requirements: input.special_requirements || '',
    created_by: user.id,
    created_at: timestamp,
    updated_at: timestamp
  };
  db.prepare(`INSERT INTO apqp_projects(
    id,tenant_id,project_no,project_name,customer_or_source,product_description,project_owner,project_team,
    project_type,importance_level,planned_start_date,planned_end_date,customer_requirements,special_requirements,
    created_by,created_at,updated_at
  ) VALUES(
    @id,@tenant_id,@project_no,@project_name,@customer_or_source,@product_description,@project_owner,@project_team,
    @project_type,@importance_level,@planned_start_date,@planned_end_date,@customer_requirements,@special_requirements,
    @created_by,@created_at,@updated_at
  )`).run(item);
  STAGES.forEach(([name, deliverables], index) => {
    const stageId = uuidv4();
    db.prepare(`INSERT INTO apqp_stages(
      id,project_id,stage_no,name,status,progress,owner,start_date,due_date,approval_status,
      blocker_reason,next_step,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      stageId, id, index + 1, name, 'not_started', 0, item.project_owner, '', item.planned_end_date,
      'not_required', '', '', timestamp, timestamp
    );
    deliverables.forEach(deliverableName => db.prepare(`INSERT INTO apqp_deliverables(
      id,project_id,stage_id,name,required,status,evidence_count,updated_at
    ) VALUES(?,?,?,?,?,?,?,?)`).run(uuidv4(), id, stageId, deliverableName, 1, 'not_started', 0, timestamp));
  });
  history(item, '创建 APQP 项目', item.project_no, user);
  return detail(project(id, user.enterprise_id));
}

function evaluate(item, stage) {
  const deliverables = db.prepare('SELECT * FROM apqp_deliverables WHERE stage_id=?').all(stage.id);
  const tasks = db.prepare('SELECT * FROM apqp_tasks WHERE stage_id=?').all(stage.id);
  const risks = db.prepare(`SELECT * FROM apqp_risks
    WHERE project_id=? AND (risk_level IN ('high','critical') OR is_blocking=1) AND status!='closed'`).all(item.id);
  const applicable = deliverables.filter(deliverable => Number(deliverable.is_applicable) !== 0);
  const missing = applicable.filter(deliverable => Number(deliverable.required) === 1
    && Number(deliverable.evidence_count) < Number(deliverable.required_evidence_count || 1));
  const openTasks = tasks.filter(task => !['completed', 'cancelled'].includes(task.status));
  const approvalComplete = ['approved', 'not_required'].includes(stage.approval_status);
  const total = applicable.length + tasks.length + (stage.approval_status === 'not_required' ? 0 : 1);
  const completed = applicable.filter(deliverable => Number(deliverable.evidence_count) >= Number(deliverable.required_evidence_count || 1)).length
    + tasks.filter(task => ['completed', 'cancelled'].includes(task.status)).length
    + (stage.approval_status === 'approved' ? 1 : 0);
  const progress = Math.max(0, Math.min(100, total ? Math.round((completed / total) * 100) : 0));
  const reason = missing.length ? '缺少交付物证据'
    : openTasks.length ? '存在未完成任务'
      : risks.length ? '高风险未关闭'
        : !approvalComplete ? '审批未完成' : '';
  return { ok: !reason, progress, reason, missing, openTasks, risks };
}

function assessment(projectId, user) {
  const item = must(projectId, user);
  const stages = db.prepare('SELECT * FROM apqp_stages WHERE project_id=? ORDER BY stage_no').all(projectId);
  const checks = stages.map(stage => ({ stage, ...evaluate(item, stage) }));
  const blockers = checks.filter(check => !check.ok).map(check => ({ stage: check.stage.stage_no, reason: check.reason }));
  const progress = Math.max(0, Math.min(100, Math.round(
    checks.reduce((sum, check) => sum + check.progress, 0) / Math.max(1, checks.length)
  )));
  return {
    current_stage: item.current_stage,
    overall_progress: progress,
    stage_progress: checks.map(check => ({
      stage_id: check.stage.id,
      stage_no: check.stage.stage_no,
      progress: check.progress,
      status: check.stage.status
    })),
    blockers,
    missing_deliverables: blockers.filter(blocker => blocker.reason === '缺少交付物证据'),
    missing_evidence: blockers.filter(blocker => blocker.reason === '缺少交付物证据'),
    incomplete_tasks: blockers.filter(blocker => blocker.reason === '存在未完成任务'),
    open_high_risks: blockers.filter(blocker => blocker.reason === '高风险未关闭'),
    pending_approvals: blockers.filter(blocker => blocker.reason === '审批未完成'),
    next_actions: [...new Set(blockers.map(blocker => blocker.reason))],
    can_close_project: !blockers.length
  };
}

function enriched(projectId, user) {
  return { ...detail(must(projectId, user)), assessment: assessment(projectId, user) };
}

function submit(projectId, stageId, user) {
  permission.authorizeAgent({ role: user.role });
  const item = must(projectId, user);
  const stage = db.prepare('SELECT * FROM apqp_stages WHERE id=? AND project_id=?').get(stageId, projectId);
  if (!stage) throw inputError('阶段不存在');
  const result = evaluate(item, stage);
  db.prepare(`UPDATE apqp_stages SET progress=?,status=?,blocker_reason=?,approval_status=?,updated_at=? WHERE id=?`)
    .run(result.progress, result.ok ? 'waiting_approval' : 'blocked', result.reason, result.ok ? 'pending' : 'not_required', now(), stageId);
  if (result.ok) db.prepare('INSERT INTO apqp_stage_approvals VALUES(?,?,?,?,?,?,?,?,?)')
    .run(uuidv4(), projectId, stageId, 'pending', user.id, '', '', now(), now());
  history(item, '提交阶段评审', result.reason || stage.name, user);
  return enriched(projectId, user);
}

function decide(projectId, stageId, user, approved, reason = '') {
  permission.authorizeApproval({ role: user.role });
  const item = must(projectId, user);
  const stage = db.prepare('SELECT * FROM apqp_stages WHERE id=? AND project_id=?').get(stageId, projectId);
  if (!stage) throw inputError('阶段不存在');
  db.prepare(`UPDATE apqp_stage_approvals SET status=?,decided_by=?,reason=?,updated_at=?
    WHERE stage_id=? AND status='pending'`).run(approved ? 'approved' : 'rejected', user.id, reason, now(), stageId);
  db.prepare('UPDATE apqp_stages SET status=?,approval_status=?,updated_at=? WHERE id=?')
    .run(approved ? 'completed' : 'blocked', approved ? 'approved' : 'rejected', now(), stageId);
  if (approved) db.prepare(`UPDATE apqp_projects SET current_stage=MAX(current_stage,?),
    overall_progress=(SELECT AVG(progress) FROM apqp_stages WHERE project_id=?),updated_at=? WHERE id=?`)
    .run(stage.stage_no + 1, projectId, now(), projectId);
  history(item, approved ? '审批通过' : '审批驳回', reason, user);
  return enriched(projectId, user);
}

const PROJECT_UPDATE_FIELDS = Object.freeze([
  'project_name', 'customer_or_source', 'product_description', 'project_owner', 'project_team', 'project_type',
  'importance_level', 'planned_start_date', 'planned_end_date', 'customer_requirements', 'special_requirements', 'risk_summary'
]);
const PROJECT_PROTECTED_FIELDS = Object.freeze([
  'id', 'project_no', 'tenant_id', 'current_stage', 'overall_progress', 'actual_end_date', 'status', 'version',
  'created_by', 'created_at', 'updated_at'
]);
const PROJECT_HIGH_RISK_FIELDS = new Set(['project_owner', 'planned_end_date', 'importance_level']);

function updateProject(projectId, input, user) {
  const item = must(projectId, user);
  permission.authorizeAgent({ role: user.role });
  const forbidden = PROJECT_PROTECTED_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(input, field));
  if (forbidden.length) throw inputError(`禁止直接修改字段：${forbidden.join('、')}`);
  const fields = PROJECT_UPDATE_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(input, field));
  if (!fields.length) throw inputError('没有可更新的项目字段');
  if (fields.some(field => PROJECT_HIGH_RISK_FIELDS.has(field))) permission.authorizeApproval({ role: user.role });
  const values = { id: projectId, tenant_id: user.enterprise_id, updated_at: now() };
  for (const field of fields) values[field] = String(input[field] ?? '').trim();
  if (fields.includes('project_name') && !values.project_name) throw inputError('项目名称不能为空');
  db.prepare(`UPDATE apqp_projects SET ${fields.map(field => `${field}=@${field}`).join(', ')},
    version=version+1,updated_at=@updated_at WHERE id=@id AND tenant_id=@tenant_id`).run(values);
  history(item, '修改 APQP 项目', JSON.stringify({
    changes: fields.map(field => ({ field, oldValue: item[field] ?? '', newValue: values[field] }))
  }), user);
  return enriched(projectId, user);
}

function evidence(projectId, input, user) {
  const item = must(projectId, user);
  permission.authorizeAgent({ role: user.role });
  const deliverable = db.prepare('SELECT * FROM apqp_deliverables WHERE id=? AND project_id=?')
    .get(input.deliverable_id, projectId);
  if (!deliverable) throw inputError('交付物不存在');
  const timestamp = now();
  db.prepare(`INSERT INTO apqp_evidence(
    id,project_id,stage_id,deliverable_id,file_name,note,uploaded_by,created_at,
    storage_status,file_type,file_size,checksum
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    uuidv4(), projectId, deliverable.stage_id, deliverable.id, String(input.file_name || '未命名证据'),
    String(input.note || ''), user.id, timestamp, 'metadata_only', String(input.file_type || ''),
    Math.max(0, Number(input.file_size) || 0), String(input.checksum || '')
  );
  const count = db.prepare('SELECT COUNT(*) AS count FROM apqp_evidence WHERE deliverable_id=? AND deleted_at IS NULL')
    .get(deliverable.id).count;
  const completed = count >= Number(deliverable.required_evidence_count || 1);
  db.prepare('UPDATE apqp_deliverables SET evidence_count=?,status=?,updated_at=? WHERE id=?')
    .run(count, completed ? 'completed' : 'waiting_evidence', timestamp, deliverable.id);
  history(item, '上传证据记录', JSON.stringify({ deliverable: deliverable.name, storage_status: 'metadata_only' }), user);
  return enriched(projectId, user);
}

function riskScore(values) {
  const severity = String(values.severity || 'medium').toLowerCase();
  const probability = Math.max(0, Math.min(5, Number(values.probability) || 0));
  const impact = Math.max(0, Math.min(5, Number(values.impact) || 0));
  const score = probability * impact;
  const riskLevel = severity === 'critical' || score >= 20 ? 'critical'
    : severity === 'high' || score >= 12 ? 'high'
      : score >= 6 || severity === 'medium' ? 'medium' : 'low';
  return { severity, probability, impact, risk_level: riskLevel, is_blocking: ['high', 'critical'].includes(riskLevel) ? 1 : 0 };
}

function risk(projectId, input, user) {
  const item = must(projectId, user);
  permission.authorizeAgent({ role: user.role });
  const status = input.status || 'open';
  if (!RISK_STATUSES.has(status)) throw inputError('风险状态无效');
  const derived = riskScore(input);
  if (status === 'accepted' && derived.is_blocking && !String(input.acceptance_reason || '').trim()) {
    throw inputError('高风险接受必须填写理由');
  }
  if (status === 'closed' && !String(input.closure_evidence || '').trim()) throw inputError('关闭风险必须填写说明或证据');
  const timestamp = now();
  db.prepare(`INSERT INTO apqp_risks(
    id,project_id,title,level,status,owner,created_at,updated_at,description,severity,probability,impact,
    risk_level,is_blocking,due_date,mitigation,acceptance_reason,closure_evidence
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    uuidv4(), projectId, String(input.title || '未命名风险'), derived.risk_level, status, String(input.owner || ''),
    timestamp, timestamp, String(input.description || ''), derived.severity, derived.probability, derived.impact,
    derived.risk_level, derived.is_blocking, String(input.due_date || ''), String(input.mitigation || ''),
    String(input.acceptance_reason || ''), String(input.closure_evidence || '')
  );
  history(item, '新增风险', JSON.stringify({ title: input.title || '未命名风险', risk_level: derived.risk_level }), user);
  return enriched(projectId, user);
}

function task(projectId, input, user) {
  const item = must(projectId, user);
  permission.authorizeAgent({ role: user.role });
  const stage = db.prepare('SELECT id FROM apqp_stages WHERE id=? AND project_id=?').get(input.stage_id, projectId);
  if (!stage) throw inputError('阶段不存在');
  const status = input.status || 'pending';
  if (!TASK_STATUSES.has(status)) throw inputError('任务状态无效');
  if (status === 'completed' && input.evidence_required) {
    const activeEvidence = db.prepare(`SELECT COUNT(*) AS count FROM apqp_evidence
      WHERE project_id=? AND stage_id=? AND deleted_at IS NULL`).get(projectId, stage.id).count;
    if (!activeEvidence) throw inputError('证据要求任务必须先关联证据');
  }
  const timestamp = now();
  db.prepare(`INSERT INTO apqp_tasks(
    id,project_id,stage_id,title,owner,status,due_date,created_at,updated_at,
    description,priority,evidence_required,completion_note,completed_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    uuidv4(), projectId, stage.id, String(input.title || '未命名任务'), String(input.owner || ''), status,
    String(input.due_date || ''), timestamp, timestamp, String(input.description || ''), String(input.priority || 'medium'),
    input.evidence_required ? 1 : 0, String(input.completion_note || ''), status === 'completed' ? timestamp : null
  );
  history(item, '新增任务', String(input.title || ''), user);
  return enriched(projectId, user);
}

function close(projectId, user, reason) {
  const item = must(projectId, user);
  permission.authorizeApproval({ role: user.role });
  const stages = db.prepare('SELECT * FROM apqp_stages WHERE project_id=?').all(projectId);
  const blocked = stages.map(stage => evaluate(item, stage)).filter(result => !result.ok);
  if (blocked.length) throw inputError(`项目关闭被阻塞：${blocked[0].reason}`);
  db.prepare(`UPDATE apqp_projects SET status='closed',actual_end_date=?,updated_at=? WHERE id=?`)
    .run(now(), now(), projectId);
  history(item, '关闭项目', reason || '管理员确认', user);
  return enriched(projectId, user);
}

function records(projectId, user, type) {
  must(projectId, user);
  const table = RECORD_TABLES[type];
  if (!table) throw inputError('记录类型无效');
  const items = db.prepare(`SELECT * FROM ${table} WHERE project_id=?${type === 'evidence' ? ' AND deleted_at IS NULL' : ''}`)
    .all(projectId);
  if (type === 'tasks') {
    const today = new Date().toISOString().slice(0, 10);
    return items.map(item => ({
      ...item,
      overdue: Boolean(item.due_date && item.due_date < today && !['completed', 'cancelled'].includes(item.status))
    }));
  }
  return items;
}

function update(projectId, type, recordId, patch, user) {
  const item = must(projectId, user);
  permission.authorizeAgent({ role: user.role });
  const table = RECORD_TABLES[type];
  if (!table || type === 'evidence') throw inputError('记录类型无效');
  const row = db.prepare(`SELECT * FROM ${table} WHERE id=? AND project_id=?`).get(recordId, projectId);
  if (!row) throw inputError('记录不存在');

  let allowed;
  const computed = {};
  if (type === 'deliverables') {
    allowed = ['status', 'owner', 'due_date', 'notes', 'is_applicable', 'not_applicable_reason'];
    const applicable = patch.is_applicable === undefined ? Number(row.is_applicable) !== 0 : Boolean(Number(patch.is_applicable));
    const reason = patch.not_applicable_reason === undefined ? row.not_applicable_reason : String(patch.not_applicable_reason).trim();
    if (!applicable && !reason) throw inputError('标记不适用必须填写理由');
    if (patch.status === 'completed' && applicable
      && Number(row.evidence_count) < Number(row.required_evidence_count || 1)) throw inputError('必交付物缺少证据');
    if (patch.status === 'completed') {
      computed.completed_at = now();
      computed.completed_by = user.id;
    }
  } else if (type === 'risks') {
    allowed = ['title', 'description', 'severity', 'probability', 'impact', 'owner', 'due_date', 'mitigation', 'status', 'acceptance_reason', 'closure_evidence'];
    if (patch.risk_level !== undefined || patch.is_blocking !== undefined || patch.level !== undefined) {
      throw inputError('风险等级和阻断状态由系统计算');
    }
    const status = patch.status || row.status;
    if (!RISK_STATUSES.has(status)) throw inputError('风险状态无效');
    const merged = { ...row, ...patch };
    const derived = riskScore(merged);
    if (status === 'accepted' && derived.is_blocking && !String(merged.acceptance_reason || '').trim()) {
      throw inputError('高风险接受必须填写理由');
    }
    if (status === 'closed' && !String(merged.closure_evidence || '').trim()) {
      throw inputError('关闭风险必须填写说明或证据');
    }
    Object.assign(computed, derived, { level: derived.risk_level });
  } else {
    allowed = ['title', 'description', 'owner', 'priority', 'due_date', 'status', 'completion_note', 'evidence_required'];
    const status = patch.status || row.status;
    if (!TASK_STATUSES.has(status)) throw inputError('任务状态无效');
    const evidenceRequired = patch.evidence_required === undefined ? Boolean(row.evidence_required) : Boolean(patch.evidence_required);
    if (status === 'completed' && evidenceRequired) {
      const activeEvidence = db.prepare(`SELECT COUNT(*) AS count FROM apqp_evidence
        WHERE project_id=? AND stage_id=? AND deleted_at IS NULL`).get(projectId, row.stage_id).count;
      if (!activeEvidence) throw inputError('证据要求任务必须先关联证据');
    }
    computed.completed_at = status === 'completed' ? (row.completed_at || now()) : null;
  }

  const fields = allowed.filter(key => patch[key] !== undefined);
  const values = { id: recordId, updated_at: now(), ...computed };
  for (const field of fields) values[field] = field === 'is_applicable' || field === 'evidence_required'
    ? (patch[field] ? 1 : 0) : patch[field];
  const computedFields = Object.keys(computed);
  const allFields = [...new Set([...fields, ...computedFields])];
  if (!allFields.length) throw inputError('没有可更新的记录字段');
  db.prepare(`UPDATE ${table} SET ${allFields.map(field => `${field}=@${field}`).join(',')},updated_at=@updated_at WHERE id=@id`)
    .run(values);
  history(item, `更新${type}`, JSON.stringify({
    changes: allFields.map(field => ({ field, oldValue: row[field] ?? '', newValue: values[field] ?? '' }))
  }), user);
  return enriched(projectId, user);
}

function removeEvidence(projectId, evidenceId, input, user) {
  const item = must(projectId, user);
  permission.authorizeApproval({ role: user.role });
  const deleteReason = String(input.delete_reason || '').trim();
  if (!deleteReason) throw inputError('删除证据必须填写原因');
  const evidenceItem = db.prepare(`SELECT * FROM apqp_evidence
    WHERE id=? AND project_id=? AND deleted_at IS NULL`).get(evidenceId, projectId);
  if (!evidenceItem) throw inputError('证据不存在');
  const timestamp = now();
  db.prepare('UPDATE apqp_evidence SET deleted_at=?,deleted_by=?,delete_reason=? WHERE id=?')
    .run(timestamp, user.id, deleteReason, evidenceId);
  const count = db.prepare('SELECT COUNT(*) AS count FROM apqp_evidence WHERE deliverable_id=? AND deleted_at IS NULL')
    .get(evidenceItem.deliverable_id).count;
  const deliverable = db.prepare('SELECT * FROM apqp_deliverables WHERE id=? AND project_id=?')
    .get(evidenceItem.deliverable_id, projectId);
  const status = count >= Number(deliverable.required_evidence_count || 1) ? deliverable.status : 'waiting_evidence';
  db.prepare('UPDATE apqp_deliverables SET evidence_count=?,status=?,completed_at=?,completed_by=?,updated_at=? WHERE id=?')
    .run(count, status, status === 'completed' ? deliverable.completed_at : null,
      status === 'completed' ? deliverable.completed_by : null, timestamp, deliverable.id);
  history(item, '软删除证据记录', JSON.stringify({
    evidence_id: evidenceId,
    delete_reason: deleteReason,
    storage_action: 'metadata_only_no_file_delete'
  }), user);
  return enriched(projectId, user);
}

function historyList(projectId, user) {
  must(projectId, user);
  return db.prepare('SELECT * FROM apqp_history WHERE project_id=? AND tenant_id=? ORDER BY created_at DESC')
    .all(projectId, user.enterprise_id);
}

module.exports = {
  STAGES,
  PROJECT_UPDATE_FIELDS,
  create,
  updateProject,
  detail: (id, user) => enriched(id, user),
  list: user => db.prepare('SELECT * FROM apqp_projects WHERE tenant_id=? ORDER BY updated_at DESC')
    .all(user.enterprise_id).map(item => ({ ...item, assessment: assessment(item.id, user) })),
  submit,
  decide,
  evaluate,
  evidence,
  risk,
  task,
  close,
  history: historyList,
  assessment,
  records,
  update,
  removeEvidence
};
