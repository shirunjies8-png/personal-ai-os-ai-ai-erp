const crypto = require('node:crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/init');
const permissionService = require('./permissionService');
const approvalService = require('./approvalService');
const logService = require('./logService');
const logModel = require('../models/logModel');
const agentTaskModel = require('../models/agentTaskModel');
const agentApprovalModel = require('../models/agentApprovalModel');

const RFQ_STATUS_LABELS = Object.freeze({
  draft: '草稿',
  waiting_review: '待评审',
  information_required: '补充资料',
  ready_for_quotation: '可报价',
  quotation_in_progress: '报价中',
  quoted: '已报价',
  negotiating: '洽谈中',
  won: '已成交',
  expired: '已失效'
});

const RFQ_TRANSITIONS = Object.freeze({
  draft: new Set(['waiting_review', 'information_required']),
  waiting_review: new Set(['information_required', 'ready_for_quotation']),
  information_required: new Set(['waiting_review', 'expired']),
  ready_for_quotation: new Set(['quotation_in_progress', 'expired']),
  quotation_in_progress: new Set(['quoted', 'expired']),
  quoted: new Set(['negotiating', 'expired']),
  negotiating: new Set(['won', 'expired']),
  won: new Set(),
  expired: new Set()
});

const REQUIREMENT_SPECS = Object.freeze([
  { key: 'product_name', label: '产品名称', column: 'product_name', category: 'product', required: true },
  { key: 'material', label: '材料', column: 'material', category: 'product', required: true },
  { key: 'quantity', label: '数量', column: 'quantity', category: 'commercial', required: true, numeric: true },
  { key: 'process_requirements', label: '工艺要求', column: 'process_requirements', category: 'process', required: true },
  { key: 'requested_delivery_date', label: '期望交期', column: 'requested_delivery_date', category: 'delivery', required: true },
  { key: 'contact_name', label: '联系人', column: 'contact_name', category: 'customer', required: true },
  { key: 'contact_details', label: '联系方式', column: 'contact_details', category: 'customer', required: true },
  { key: 'owner', label: '负责人', column: 'owner', category: 'management', required: true },
  { key: 'tolerance_requirements', label: '精度和公差', column: 'tolerance_requirements', category: 'quality', required: false },
  { key: 'surface_treatment', label: '表面处理', column: 'surface_treatment', category: 'quality', required: false },
  { key: 'packaging_requirements', label: '包装要求', column: 'packaging_requirements', category: 'delivery', required: false }
]);

const CUSTOMER_FIELDS = Object.freeze(['name', 'source', 'level', 'owner', 'notes', 'status']);
const PROJECT_FIELDS = Object.freeze(['customer_id', 'name', 'description', 'owner', 'planned_start_date', 'planned_end_date', 'status']);
const RFQ_FIELDS = Object.freeze([
  'customer_id', 'project_id', 'product_name', 'product_code', 'material', 'quantity', 'unit',
  'process_requirements', 'tolerance_requirements', 'surface_treatment', 'packaging_requirements',
  'quality_requirements', 'customer_special_requirements', 'budget_minor', 'currency', 'requested_delivery_date', 'owner', 'contact_name', 'contact_details', 'notes'
]);
const RISK_FIELDS = Object.freeze([
  'title', 'category', 'severity', 'probability', 'impact', 'owner', 'due_date', 'mitigation',
  'status', 'acceptance_reason', 'closure_evidence'
]);

function domainError(message, code = 'INVALID_INPUT', status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function now() {
  return new Date().toISOString();
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pageParams(input = {}) {
  const page = Math.max(1, Math.floor(finiteNumber(input.page, 1)));
  const pageSize = Math.max(1, Math.min(100, Math.floor(finiteNumber(input.pageSize, 20))));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function requireOperator(user) {
  permissionService.authorizeBusiness({ role: user.role }, 'operator');
}

function requireAdmin(user) {
  permissionService.authorizeApproval({ role: user.role });
}

function rejectAiDecision(input = {}) {
  if (input.aiGenerated === true || text(input.actorType).toLowerCase() === 'ai') {
    throw domainError('AI 只能生成建议，不能修改正式状态或审批结果', 'AI_DECISION_FORBIDDEN', 403);
  }
}

function maskPersonal(value) {
  return text(value)
    .replace(/\b(1\d{2})\d{4}(\d{4})\b/g, '$1****$2')
    .replace(/([\w.+-]{1,3})[\w.+-]*(@[\w.-]+)/g, '$1***$2');
}

function auditSnapshot(value = {}) {
  const clone = { ...value };
  for (const key of ['phone', 'email', 'contact_details', 'notes']) {
    if (clone[key] != null) clone[key] = maskPersonal(clone[key]);
  }
  delete clone.deleted_by;
  return clone;
}

function audit(user, entityType, entityId, action, title, options = {}) {
  logService.add({
    enterpriseId: user.enterprise_id,
    userId: user.id,
    type: 'manufacturing',
    title,
    detail: options.detail || '',
    entityType,
    entityId,
    action,
    requestId: options.requestId || '',
    approvalId: options.approvalId || '',
    before: options.before ? auditSnapshot(options.before) : '',
    after: options.after ? auditSnapshot(options.after) : '',
    result: options.result || 'success',
    sourceClient: options.sourceClient || ''
  });
}

function nextDocumentNumber(enterpriseId, type, prefix, periodKey, timestamp = now()) {
  const sequenceId = uuidv4();
  db.prepare(`INSERT OR IGNORE INTO document_sequences(
    id,enterprise_id,document_type,period_key,current_value,padding,updated_at
  ) VALUES(?,?,?,?,0,6,?)`).run(sequenceId, enterpriseId, type, periodKey, timestamp);
  db.prepare(`UPDATE document_sequences SET current_value=current_value+1,updated_at=?
    WHERE enterprise_id=? AND document_type=? AND period_key=?`)
    .run(timestamp, enterpriseId, type, periodKey);
  const row = db.prepare(`SELECT current_value,padding FROM document_sequences
    WHERE enterprise_id=? AND document_type=? AND period_key=?`)
    .get(enterpriseId, type, periodKey);
  return `${prefix}-${periodKey}-${String(row.current_value).padStart(row.padding, '0')}`;
}

function mustCustomer(id, user) {
  const item = db.prepare(`SELECT * FROM customers
    WHERE id=? AND enterprise_id=? AND deleted_at IS NULL`).get(id, user.enterprise_id);
  if (!item) throw domainError('客户不存在或无权访问', 'CUSTOMER_NOT_FOUND', 404);
  return item;
}

function mustProject(id, user) {
  const item = db.prepare(`SELECT * FROM projects
    WHERE id=? AND enterprise_id=? AND deleted_at IS NULL`).get(id, user.enterprise_id);
  if (!item) throw domainError('项目不存在或无权访问', 'PROJECT_NOT_FOUND', 404);
  return item;
}

function mustRfq(id, user) {
  const item = db.prepare(`SELECT * FROM rfqs
    WHERE id=? AND enterprise_id=? AND deleted_at IS NULL`).get(id, user.enterprise_id);
  if (!item) throw domainError('RFQ 不存在或无权访问', 'RFQ_NOT_FOUND', 404);
  return item;
}

function checkVersion(item, input) {
  if (input.version != null && Number(input.version) !== Number(item.version)) {
    throw domainError('数据已被其他用户修改，请刷新后重试', 'VERSION_CONFLICT', 409);
  }
}

function validateProjectDates(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    throw domainError('项目计划完成日期不能早于开始日期');
  }
}

function validateContactDetails(input = {}) {
  const phone = text(input.phone);
  const email = text(input.email);
  if (phone && !/^(?:\+?\d[\d\s()-]{5,24})$/.test(phone)) throw domainError('联系电话格式无效');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw domainError('邮箱格式无效');
}

function idempotencyKey(input = {}) {
  const key = text(input.idempotency_key || input.idempotencyKey);
  if (key && !/^[A-Za-z0-9._:-]{8,160}$/.test(key)) throw domainError('幂等请求标识格式无效');
  return key;
}

function idempotentEntity(operation, input, user, getter) {
  const key = idempotencyKey(input);
  if (!key) return { key: '', entity: null };
  const existing = db.prepare(`SELECT entity_id FROM manufacturing_idempotency_keys
    WHERE enterprise_id=? AND operation=? AND idempotency_key=?`).get(user.enterprise_id, operation, key);
  return { key, entity: existing ? getter(existing.entity_id, user) : null };
}

function rememberIdempotent(operation, key, entityType, entityId, user, timestamp) {
  if (!key) return;
  db.prepare(`INSERT INTO manufacturing_idempotency_keys(
    enterprise_id,operation,idempotency_key,entity_type,entity_id,created_at
  ) VALUES(?,?,?,?,?,?)`).run(user.enterprise_id, operation, key, entityType, entityId, timestamp);
}

function createCustomer(input, user) {
  requireOperator(user);
  const replay = idempotentEntity('create_customer', input, user, getCustomer);
  if (replay.entity) return replay.entity;
  const name = text(input.name);
  if (!name) throw domainError('客户名称不能为空');
  const level = text(input.level) || 'normal';
  const status = text(input.status) || 'active';
  if (!['normal', 'important', 'strategic'].includes(level)) throw domainError('客户等级无效');
  if (!['draft', 'active', 'inactive', 'archived'].includes(status)) throw domainError('客户状态无效');
  const timestamp = now();
  const item = db.transaction(() => {
    const id = uuidv4();
    const customerNo = nextDocumentNumber(user.enterprise_id, 'customer', 'CUS', timestamp.slice(0, 4), timestamp);
    db.prepare(`INSERT INTO customers(
      id,enterprise_id,customer_no,name,source,level,owner,notes,status,version,
      created_by,updated_by,created_at,updated_at,deleted_at,deleted_by
    ) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,NULL,NULL)`).run(
      id, user.enterprise_id, customerNo, name, text(input.source), level, text(input.owner),
      text(input.notes), status, user.id, user.id, timestamp, timestamp
    );
    if (input.primaryContact && text(input.primaryContact.name)) {
      createContactRecord(id, input.primaryContact, user, true, timestamp);
    }
    const created = mustCustomer(id, user);
    rememberIdempotent('create_customer', replay.key, 'customer', id, user, timestamp);
    audit(user, 'customer', id, 'create', '创建客户档案', { after: created });
    return created;
  })();
  return getCustomer(item.id, user);
}

function createContactRecord(customerId, input, user, primary = false, timestamp = now()) {
  validateContactDetails(input);
  const id = uuidv4();
  db.prepare(`INSERT INTO customer_contacts(
    id,enterprise_id,customer_id,name,title,phone,email,is_primary,notes,
    created_by,updated_by,created_at,updated_at,deleted_at,deleted_by
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL)`).run(
    id, user.enterprise_id, customerId, text(input.name), text(input.title), text(input.phone),
    text(input.email), primary || input.isPrimary ? 1 : 0, text(input.notes),
    user.id, user.id, timestamp, timestamp
  );
  return db.prepare('SELECT * FROM customer_contacts WHERE id=? AND enterprise_id=?')
    .get(id, user.enterprise_id);
}

function addCustomerContact(customerId, input, user) {
  requireOperator(user);
  mustCustomer(customerId, user);
  if (!text(input.name)) throw domainError('联系人姓名不能为空');
  validateContactDetails(input);
  const contact = db.transaction(() => {
    if (input.isPrimary) db.prepare(`UPDATE customer_contacts SET is_primary=0,updated_at=?,updated_by=?
      WHERE customer_id=? AND enterprise_id=? AND deleted_at IS NULL`)
      .run(now(), user.id, customerId, user.enterprise_id);
    const created = createContactRecord(customerId, input, user, Boolean(input.isPrimary));
    audit(user, 'customer', customerId, 'contact_create', '新增客户联系人', { after: created });
    return created;
  })();
  return contact;
}

function updateCustomerContact(customerId, contactId, input, user) {
  requireOperator(user);
  mustCustomer(customerId, user);
  const current = db.prepare(`SELECT * FROM customer_contacts
    WHERE id=? AND customer_id=? AND enterprise_id=? AND deleted_at IS NULL`)
    .get(contactId, customerId, user.enterprise_id);
  if (!current) throw domainError('联系人不存在或无权访问', 'CONTACT_NOT_FOUND', 404);
  const next = {
    name: input.name === undefined ? current.name : text(input.name),
    title: input.title === undefined ? current.title : text(input.title),
    phone: input.phone === undefined ? current.phone : text(input.phone),
    email: input.email === undefined ? current.email : text(input.email),
    is_primary: input.isPrimary === undefined ? current.is_primary : (input.isPrimary ? 1 : 0),
    notes: input.notes === undefined ? current.notes : text(input.notes)
  };
  if (!next.name) throw domainError('联系人姓名不能为空');
  validateContactDetails(next);
  const timestamp = now();
  db.transaction(() => {
    if (next.is_primary) db.prepare(`UPDATE customer_contacts SET is_primary=0,updated_at=?,updated_by=?
      WHERE customer_id=? AND enterprise_id=? AND deleted_at IS NULL`)
      .run(timestamp, user.id, customerId, user.enterprise_id);
    db.prepare(`UPDATE customer_contacts SET name=?,title=?,phone=?,email=?,is_primary=?,notes=?,
      updated_by=?,updated_at=? WHERE id=? AND customer_id=? AND enterprise_id=?`)
      .run(next.name, next.title, next.phone, next.email, next.is_primary, next.notes,
        user.id, timestamp, contactId, customerId, user.enterprise_id);
    audit(user, 'customer', customerId, 'contact_update', '修改客户联系人', {
      before: current,
      after: { ...current, ...next }
    });
  })();
  return db.prepare('SELECT * FROM customer_contacts WHERE id=? AND enterprise_id=?')
    .get(contactId, user.enterprise_id);
}

function deleteCustomerContact(customerId, contactId, input, user) {
  requireAdmin(user);
  const reason = text(input.reason);
  if (!reason) throw domainError('删除联系人必须填写原因');
  mustCustomer(customerId, user);
  const current = db.prepare(`SELECT * FROM customer_contacts
    WHERE id=? AND customer_id=? AND enterprise_id=? AND deleted_at IS NULL`)
    .get(contactId, customerId, user.enterprise_id);
  if (!current) throw domainError('联系人不存在或无权访问', 'CONTACT_NOT_FOUND', 404);
  const timestamp = now();
  db.prepare(`UPDATE customer_contacts SET deleted_at=?,deleted_by=?,updated_at=?,updated_by=?
    WHERE id=? AND customer_id=? AND enterprise_id=?`)
    .run(timestamp, user.id, timestamp, user.id, contactId, customerId, user.enterprise_id);
  audit(user, 'customer', customerId, 'contact_delete', '删除客户联系人', {
    detail: reason,
    before: current,
    after: { ...current, deleted_at: timestamp }
  });
  return { id: contactId, deleted_at: timestamp };
}

function listCustomers(query, user) {
  const { page, pageSize, offset } = pageParams(query);
  const q = `%${text(query.q)}%`;
  const status = text(query.status);
  const where = ['c.enterprise_id=?', 'c.deleted_at IS NULL'];
  const params = [user.enterprise_id];
  if (text(query.q)) {
    where.push('(c.customer_no LIKE ? OR c.name LIKE ? OR c.owner LIKE ? OR c.source LIKE ?)');
    params.push(q, q, q, q);
  }
  if (status) {
    where.push('c.status=?');
    params.push(status);
  }
  const condition = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS count FROM customers c WHERE ${condition}`).get(...params).count;
  const items = db.prepare(`SELECT c.*,
      (SELECT COUNT(*) FROM projects p WHERE p.customer_id=c.id AND p.enterprise_id=c.enterprise_id AND p.deleted_at IS NULL) project_count,
      (SELECT COUNT(*) FROM rfqs r WHERE r.customer_id=c.id AND r.enterprise_id=c.enterprise_id AND r.deleted_at IS NULL) rfq_count
    FROM customers c WHERE ${condition} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);
  return { items, meta: { page, pageSize, total } };
}

function getCustomer(id, user) {
  const item = mustCustomer(id, user);
  const contacts = db.prepare(`SELECT * FROM customer_contacts
    WHERE customer_id=? AND enterprise_id=? AND deleted_at IS NULL ORDER BY is_primary DESC,updated_at DESC`)
    .all(id, user.enterprise_id);
  const projects = db.prepare(`SELECT * FROM projects
    WHERE customer_id=? AND enterprise_id=? AND deleted_at IS NULL ORDER BY updated_at DESC`)
    .all(id, user.enterprise_id);
  const rfqs = db.prepare(`SELECT id,rfq_no,product_name,status,owner,requested_delivery_date,updated_at FROM rfqs
    WHERE customer_id=? AND enterprise_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 50`)
    .all(id, user.enterprise_id);
  return { ...item, contacts, projects, rfqs };
}

function updateCustomer(id, input, user) {
  requireOperator(user);
  const current = mustCustomer(id, user);
  checkVersion(current, input);
  const fields = CUSTOMER_FIELDS.filter(field => input[field] !== undefined);
  if (!fields.length) throw domainError('没有可更新的客户字段');
  const values = { id, enterprise_id: user.enterprise_id, updated_by: user.id, updated_at: now() };
  for (const field of fields) values[field] = text(input[field]);
  if (fields.includes('name') && !values.name) throw domainError('客户名称不能为空');
  if (fields.includes('level') && !['normal', 'important', 'strategic'].includes(values.level)) throw domainError('客户等级无效');
  if (fields.includes('status') && !['draft', 'active', 'inactive', 'archived'].includes(values.status)) throw domainError('客户状态无效');
  const result = db.prepare(`UPDATE customers SET ${fields.map(field => `${field}=@${field}`).join(',')},
    version=version+1,updated_by=@updated_by,updated_at=@updated_at
    WHERE id=@id AND enterprise_id=@enterprise_id AND deleted_at IS NULL`).run(values);
  if (!result.changes) throw domainError('客户更新失败', 'UPDATE_FAILED', 409);
  const updated = mustCustomer(id, user);
  audit(user, 'customer', id, 'update', '修改客户档案', { before: current, after: updated });
  return getCustomer(id, user);
}

function deleteCustomer(id, input, user) {
  requireAdmin(user);
  const reason = text(input.reason);
  if (!reason) throw domainError('删除客户必须填写原因');
  const current = mustCustomer(id, user);
  const linked = db.prepare(`SELECT
    (SELECT COUNT(*) FROM projects WHERE customer_id=? AND enterprise_id=? AND deleted_at IS NULL) projects,
    (SELECT COUNT(*) FROM rfqs WHERE customer_id=? AND enterprise_id=? AND deleted_at IS NULL) rfqs`)
    .get(id, user.enterprise_id, id, user.enterprise_id);
  if (linked.projects || linked.rfqs) throw domainError('客户存在项目或 RFQ，不能删除，请先归档关联记录', 'CUSTOMER_IN_USE', 409);
  const timestamp = now();
  db.prepare(`UPDATE customers SET deleted_at=?,deleted_by=?,updated_at=?,updated_by=?,version=version+1
    WHERE id=? AND enterprise_id=?`).run(timestamp, user.id, timestamp, user.id, id, user.enterprise_id);
  audit(user, 'customer', id, 'delete', '删除客户档案', { detail: reason, before: current });
  return { id, deleted_at: timestamp };
}

function createProject(input, user) {
  requireOperator(user);
  const replay = idempotentEntity('create_project', input, user, getProject);
  if (replay.entity) return replay.entity;
  const customer = mustCustomer(text(input.customer_id), user);
  const name = text(input.name);
  if (!name) throw domainError('项目名称不能为空');
  const status = text(input.status) || 'draft';
  if (!['draft', 'active', 'on_hold', 'completed', 'closed'].includes(status)) throw domainError('项目状态无效');
  validateProjectDates(text(input.planned_start_date), text(input.planned_end_date));
  const timestamp = now();
  const item = db.transaction(() => {
    const id = uuidv4();
    const projectNo = nextDocumentNumber(user.enterprise_id, 'project', 'PRJ', timestamp.slice(0, 4), timestamp);
    db.prepare(`INSERT INTO projects(
      id,enterprise_id,project_no,customer_id,name,description,owner,planned_start_date,planned_end_date,
      status,version,created_by,updated_by,created_at,updated_at,deleted_at,deleted_by
    ) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,NULL,NULL)`).run(
      id, user.enterprise_id, projectNo, customer.id, name, text(input.description), text(input.owner),
      text(input.planned_start_date), text(input.planned_end_date), status,
      user.id, user.id, timestamp, timestamp
    );
    const created = mustProject(id, user);
    rememberIdempotent('create_project', replay.key, 'project', id, user, timestamp);
    audit(user, 'project', id, 'create', '创建项目档案', { after: created });
    return created;
  })();
  return item;
}

function listProjects(query, user) {
  const { page, pageSize, offset } = pageParams(query);
  const where = ['p.enterprise_id=?', 'p.deleted_at IS NULL'];
  const params = [user.enterprise_id];
  if (text(query.q)) {
    const q = `%${text(query.q)}%`;
    where.push('(p.project_no LIKE ? OR p.name LIKE ? OR c.name LIKE ? OR p.owner LIKE ?)');
    params.push(q, q, q, q);
  }
  if (text(query.status)) {
    where.push('p.status=?');
    params.push(text(query.status));
  }
  if (text(query.customerId)) {
    where.push('p.customer_id=?');
    params.push(text(query.customerId));
  }
  const condition = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS count FROM projects p JOIN customers c ON c.id=p.customer_id
    WHERE ${condition}`).get(...params).count;
  const items = db.prepare(`SELECT p.*,c.customer_no,c.name customer_name FROM projects p
    JOIN customers c ON c.id=p.customer_id AND c.enterprise_id=p.enterprise_id
    WHERE ${condition} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
  return { items, meta: { page, pageSize, total } };
}

function getProject(id, user) {
  const item = mustProject(id, user);
  const customer = mustCustomer(item.customer_id, user);
  const rfqs = db.prepare(`SELECT id,rfq_no,product_name,status,updated_at FROM rfqs
    WHERE project_id=? AND enterprise_id=? AND deleted_at IS NULL ORDER BY updated_at DESC`)
    .all(id, user.enterprise_id);
  const riskSummary = db.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN r.is_blocking=1 AND r.status NOT IN ('accepted','closed') THEN 1 ELSE 0 END) AS open_blocking
    FROM rfq_risks r
    JOIN rfqs q ON q.id=r.rfq_id AND q.enterprise_id=r.enterprise_id
    WHERE q.project_id=? AND q.enterprise_id=? AND q.deleted_at IS NULL`)
    .get(id, user.enterprise_id);
  return {
    ...item,
    customer,
    rfqs,
    risk_summary: {
      total: Number(riskSummary?.total || 0),
      open_blocking: Number(riskSummary?.open_blocking || 0)
    },
    history: logModel.listByEntity(user.enterprise_id, 'project', id, 20)
  };
}

function updateProject(id, input, user) {
  requireOperator(user);
  const current = mustProject(id, user);
  checkVersion(current, input);
  const fields = PROJECT_FIELDS.filter(field => input[field] !== undefined);
  if (!fields.length) throw domainError('没有可更新的项目字段');
  const values = { id, enterprise_id: user.enterprise_id, updated_by: user.id, updated_at: now() };
  for (const field of fields) values[field] = text(input[field]);
  if (fields.includes('customer_id')) mustCustomer(values.customer_id, user);
  if (fields.includes('customer_id') && values.customer_id !== current.customer_id) {
    const linked = db.prepare(`SELECT COUNT(*) count FROM rfqs
      WHERE project_id=? AND enterprise_id=? AND deleted_at IS NULL`).get(id, user.enterprise_id).count;
    if (linked) throw domainError('项目已有 RFQ，不能变更所属客户', 'PROJECT_CUSTOMER_IN_USE', 409);
  }
  if (fields.includes('name') && !values.name) throw domainError('项目名称不能为空');
  const start = fields.includes('planned_start_date') ? values.planned_start_date : current.planned_start_date;
  const end = fields.includes('planned_end_date') ? values.planned_end_date : current.planned_end_date;
  validateProjectDates(start, end);
  if (fields.includes('status') && !['draft', 'active', 'on_hold', 'completed', 'closed'].includes(values.status)) {
    throw domainError('项目状态无效');
  }
  db.prepare(`UPDATE projects SET ${fields.map(field => `${field}=@${field}`).join(',')},
    version=version+1,updated_by=@updated_by,updated_at=@updated_at
    WHERE id=@id AND enterprise_id=@enterprise_id AND deleted_at IS NULL`).run(values);
  const updated = mustProject(id, user);
  audit(user, 'project', id, 'update', '修改项目档案', { before: current, after: updated });
  return getProject(id, user);
}

function deleteProject(id, input, user) {
  requireAdmin(user);
  const reason = text(input.reason);
  if (!reason) throw domainError('删除项目必须填写原因');
  const current = mustProject(id, user);
  const linked = db.prepare(`SELECT COUNT(*) AS count FROM rfqs
    WHERE project_id=? AND enterprise_id=? AND deleted_at IS NULL`).get(id, user.enterprise_id).count;
  if (linked) throw domainError('项目存在 RFQ，不能删除，请先归档关联记录', 'PROJECT_IN_USE', 409);
  const timestamp = now();
  db.prepare(`UPDATE projects SET deleted_at=?,deleted_by=?,updated_at=?,updated_by=?,version=version+1
    WHERE id=? AND enterprise_id=?`).run(timestamp, user.id, timestamp, user.id, id, user.enterprise_id);
  audit(user, 'project', id, 'delete', '删除项目档案', { detail: reason, before: current });
  return { id, deleted_at: timestamp };
}

function requirementValue(item, spec) {
  const value = item[spec.column];
  if (spec.numeric) return finiteNumber(value) > 0 ? String(value) : '';
  return text(value);
}

function syncRequirements(item, user, source = 'manual') {
  const timestamp = now();
  const statement = db.prepare(`INSERT INTO rfq_requirements(
    id,enterprise_id,rfq_id,category,field_key,label,value,unit,required,confirmed,source,updated_by,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(enterprise_id,rfq_id,field_key) DO UPDATE SET
    value=excluded.value,required=excluded.required,confirmed=excluded.confirmed,source=excluded.source,
    updated_by=excluded.updated_by,updated_at=excluded.updated_at`);
  for (const spec of REQUIREMENT_SPECS) {
    const value = requirementValue(item, spec);
    statement.run(
      uuidv4(), user.enterprise_id, item.id, spec.category, spec.key, spec.label, value,
      spec.numeric ? item.unit || '件' : '', spec.required ? 1 : 0,
      value && source === 'manual' ? 1 : 0, source, user.id, timestamp, timestamp
    );
  }
}

function riskDerived(input = {}) {
  const severityAliases = { low: 1, medium: 3, high: 4, critical: 5, blocking: 5, severe: 5, 低: 1, 中: 3, 高: 4, 严重: 4, 阻断: 5 };
  const rawSeverity = input.severity;
  const severity = Math.max(1, Math.min(5, Number.isFinite(Number(rawSeverity))
    ? Number(rawSeverity)
    : (severityAliases[text(rawSeverity)] || 1)));
  const probability = Math.max(1, Math.min(5, Math.round(finiteNumber(input.probability, 1))));
  const impact = Math.max(1, Math.min(5, Math.round(finiteNumber(input.impact, severity))));
  const riskScore = probability * impact;
  const riskLevel = severity >= 5 || riskScore >= 20 ? 'critical'
    : severity >= 4 || riskScore >= 12 ? 'high'
      : severity >= 3 || riskScore >= 6 ? 'medium' : 'low';
  return { severity, probability, impact, risk_score: riskScore, risk_level: riskLevel, is_blocking: ['high', 'critical'].includes(riskLevel) ? 1 : 0 };
}

function rfqAssessment(id, user) {
  const item = mustRfq(id, user);
  const requirements = db.prepare(`SELECT * FROM rfq_requirements
    WHERE rfq_id=? AND enterprise_id=? ORDER BY required DESC,category,field_key`).all(id, user.enterprise_id);
  const missingFields = requirements.filter(requirement => Number(requirement.required) === 1 && !text(requirement.value));
  const risks = db.prepare(`SELECT * FROM rfq_risks
    WHERE rfq_id=? AND enterprise_id=? AND deleted_at IS NULL ORDER BY risk_score DESC,updated_at DESC`)
    .all(id, user.enterprise_id);
  const openBlockingRisks = risks.filter(risk => Number(risk.is_blocking) === 1 && ['open', 'handling', 'mitigated'].includes(risk.status));
  const invalidAcceptedRisks = risks.filter(risk => Number(risk.is_blocking) === 1
    && risk.status === 'accepted' && !text(risk.acceptance_reason));
  const blockers = [
    ...missingFields.map(field => ({ type: 'missing_field', key: field.field_key, message: `缺少${field.label}` })),
    ...openBlockingRisks.map(risk => ({ type: 'open_risk', id: risk.id, message: `${risk.title}尚未关闭或接受` })),
    ...invalidAcceptedRisks.map(risk => ({ type: 'risk_acceptance', id: risk.id, message: `${risk.title}缺少接受理由` }))
  ];
  const approval = item.review_approval_id ? agentApprovalModel.findById(item.review_approval_id) : null;
  const nextActions = blockers.length
    ? [...new Set(blockers.map(blocker => blocker.message))]
    : item.status === 'draft' || item.status === 'information_required'
      ? ['提交 RFQ 评审']
      : item.status === 'waiting_review' ? ['由授权审批人确认可报价']
        : item.status === 'ready_for_quotation' ? ['转入现有报价模块'] : [];
  return {
    status: item.status,
    status_label: RFQ_STATUS_LABELS[item.status],
    missing_fields: missingFields.map(field => ({ key: field.field_key, label: field.label })),
    open_blocking_risks: openBlockingRisks,
    invalid_accepted_risks: invalidAcceptedRisks,
    blockers,
    pending_approval: approval?.status === 'pending' ? approval : null,
    approval_status: approval?.status || 'not_requested',
    next_actions: nextActions,
    can_submit_review: ['draft', 'information_required'].includes(item.status) && !missingFields.length,
    can_mark_ready: item.status === 'waiting_review' && !blockers.length && approval?.status === 'pending',
    can_convert_to_quotation: item.status === 'ready_for_quotation' && !blockers.length
  };
}

function createRfq(input, user) {
  requireOperator(user);
  const replay = idempotentEntity('create_rfq', input, user, getRfq);
  if (replay.entity) return replay.entity;
  const customer = mustCustomer(text(input.customer_id), user);
  const projectId = text(input.project_id);
  if (projectId) {
    const project = mustProject(projectId, user);
    if (project.customer_id !== customer.id) throw domainError('RFQ 项目与客户不一致');
  }
  const productName = text(input.product_name);
  if (!productName) throw domainError('产品名称不能为空');
  const source = text(input.source) || 'manual';
  const sourceReference = text(input.source_reference);
  if (sourceReference) {
    const duplicate = db.prepare(`SELECT id FROM rfqs WHERE enterprise_id=? AND source=? AND source_reference=?`)
      .get(user.enterprise_id, source, sourceReference);
    if (duplicate) return getRfq(duplicate.id, user);
  }
  const timestamp = now();
  const rfq = db.transaction(() => {
    const id = uuidv4();
    const period = timestamp.slice(0, 7).replace('-', '');
    const rfqNo = nextDocumentNumber(user.enterprise_id, 'rfq', 'RFQ', period, timestamp);
    db.prepare(`INSERT INTO rfqs(
      id,enterprise_id,rfq_no,customer_id,project_id,source,source_reference,product_name,product_code,
      material,quantity,unit,process_requirements,tolerance_requirements,surface_treatment,packaging_requirements,quality_requirements,customer_special_requirements,
      budget_minor,currency,requested_delivery_date,owner,contact_name,contact_details,notes,missing_summary,
      risk_summary,status,review_task_id,review_approval_id,quote_workspace_ref,version,
      created_by,updated_by,created_at,updated_at,deleted_at,deleted_by
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft','','','',1,?,?,?,?,NULL,NULL)`).run(
      id, user.enterprise_id, rfqNo, customer.id, projectId || null, source, sourceReference,
      productName, text(input.product_code), text(input.material), Math.max(0, finiteNumber(input.quantity)),
      text(input.unit) || '件', text(input.process_requirements), text(input.tolerance_requirements),
      text(input.surface_treatment), text(input.packaging_requirements), text(input.quality_requirements), text(input.customer_special_requirements),
      input.budget_minor == null || input.budget_minor === '' ? null : Math.max(0, Math.round(finiteNumber(input.budget_minor))),
      text(input.currency) || 'CNY', text(input.requested_delivery_date), text(input.owner),
      text(input.contact_name), text(input.contact_details), text(input.notes), '', '',
      user.id, user.id, timestamp, timestamp
    );
    const created = mustRfq(id, user);
    rememberIdempotent('create_rfq', replay.key, 'rfq', id, user, timestamp);
    syncRequirements(created, user, source === 'manual' ? 'manual' : source);
    const assessment = rfqAssessment(id, user);
    db.prepare(`UPDATE rfqs SET missing_summary=?,risk_summary=? WHERE id=? AND enterprise_id=?`)
      .run(assessment.missing_fields.map(field => field.label).join('、'), '', id, user.enterprise_id);
    audit(user, 'rfq', id, 'create', '创建 RFQ', { after: created });
    return getRfq(id, user);
  })();
  return rfq;
}

function updateRfq(id, input, user) {
  requireOperator(user);
  rejectAiDecision(input);
  const current = mustRfq(id, user);
  checkVersion(current, input);
  if (input.status !== undefined || input.rfq_no !== undefined || input.enterprise_id !== undefined
    || input.review_approval_id !== undefined || input.quote_workspace_ref !== undefined) {
    throw domainError('状态、编号、审批和报价关联必须通过受控动作修改');
  }
  const fields = RFQ_FIELDS.filter(field => input[field] !== undefined);
  if (!fields.length) throw domainError('没有可更新的 RFQ 字段');
  const values = { id, enterprise_id: user.enterprise_id, updated_by: user.id, updated_at: now() };
  for (const field of fields) {
    if (field === 'quantity') values[field] = Math.max(0, finiteNumber(input[field]));
    else if (field === 'budget_minor') values[field] = input[field] == null || input[field] === ''
      ? null : Math.max(0, Math.round(finiteNumber(input[field])));
    else values[field] = text(input[field]);
  }
  const customerId = fields.includes('customer_id') ? values.customer_id : current.customer_id;
  mustCustomer(customerId, user);
  const projectId = fields.includes('project_id') ? values.project_id : current.project_id;
  if (projectId) {
    const project = mustProject(projectId, user);
    if (project.customer_id !== customerId) throw domainError('RFQ 项目与客户不一致');
  }
  if (fields.includes('product_name') && !values.product_name) throw domainError('产品名称不能为空');
  db.transaction(() => {
    db.prepare(`UPDATE rfqs SET ${fields.map(field => `${field}=@${field}`).join(',')},
      version=version+1,updated_by=@updated_by,updated_at=@updated_at
      WHERE id=@id AND enterprise_id=@enterprise_id AND deleted_at IS NULL`).run(values);
    const updated = mustRfq(id, user);
    syncRequirements(updated, user, 'manual');
    const assessment = rfqAssessment(id, user);
    const nextStatus = ['waiting_review', 'ready_for_quotation'].includes(updated.status) && assessment.blockers.length
      ? 'information_required' : updated.status;
    db.prepare(`UPDATE rfqs SET missing_summary=?,risk_summary=?,status=? WHERE id=? AND enterprise_id=?`)
      .run(assessment.missing_fields.map(field => field.label).join('、'),
        assessment.open_blocking_risks.map(risk => risk.title).join('、'), nextStatus, id, user.enterprise_id);
    audit(user, 'rfq', id, 'update', '修改 RFQ', { before: current, after: mustRfq(id, user) });
  })();
  return getRfq(id, user);
}

function deleteRfq(id, input, user) {
  requireAdmin(user);
  rejectAiDecision(input);
  const reason = text(input.reason);
  if (!reason) throw domainError('删除 RFQ 必须填写原因');
  const current = mustRfq(id, user);
  if (['won', 'quotation_in_progress', 'quoted', 'negotiating'].includes(current.status)) {
    throw domainError('已进入报价或成交状态的 RFQ 不能删除，只能失效归档', 'RFQ_IN_USE', 409);
  }
  const timestamp = now();
  db.prepare(`UPDATE rfqs SET deleted_at=?,deleted_by=?,updated_at=?,updated_by=?,version=version+1
    WHERE id=? AND enterprise_id=?`).run(timestamp, user.id, timestamp, user.id, id, user.enterprise_id);
  audit(user, 'rfq', id, 'delete', '删除 RFQ', { detail: reason, before: current });
  return { id, deleted_at: timestamp };
}

function listRfqs(query, user) {
  const { page, pageSize, offset } = pageParams(query);
  const where = ['r.enterprise_id=?', 'r.deleted_at IS NULL'];
  const params = [user.enterprise_id];
  if (text(query.q)) {
    const q = `%${text(query.q)}%`;
    where.push('(r.rfq_no LIKE ? OR r.product_name LIKE ? OR r.product_code LIKE ? OR c.name LIKE ? OR r.owner LIKE ?)');
    params.push(q, q, q, q, q);
  }
  if (text(query.status)) {
    where.push('r.status=?');
    params.push(text(query.status));
  }
  if (text(query.customerId)) {
    where.push('r.customer_id=?');
    params.push(text(query.customerId));
  }
  const condition = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS count FROM rfqs r JOIN customers c ON c.id=r.customer_id
    WHERE ${condition}`).get(...params).count;
  const rows = db.prepare(`SELECT r.*,c.customer_no,c.name customer_name,p.project_no,p.name project_name
    FROM rfqs r JOIN customers c ON c.id=r.customer_id AND c.enterprise_id=r.enterprise_id
    LEFT JOIN projects p ON p.id=r.project_id AND p.enterprise_id=r.enterprise_id
    WHERE ${condition} ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
  const items = rows.map(item => ({ ...item, assessment: rfqAssessment(item.id, user) }));
  return { items, meta: { page, pageSize, total } };
}

function getRfq(id, user) {
  const item = mustRfq(id, user);
  const customer = mustCustomer(item.customer_id, user);
  const project = item.project_id ? mustProject(item.project_id, user) : null;
  const requirements = db.prepare(`SELECT * FROM rfq_requirements
    WHERE rfq_id=? AND enterprise_id=? ORDER BY required DESC,category,field_key`).all(id, user.enterprise_id);
  const risks = db.prepare(`SELECT * FROM rfq_risks
    WHERE rfq_id=? AND enterprise_id=? AND deleted_at IS NULL ORDER BY risk_score DESC,updated_at DESC`)
    .all(id, user.enterprise_id);
  const followups = db.prepare(`SELECT * FROM rfq_followups
    WHERE rfq_id=? AND enterprise_id=? ORDER BY created_at DESC`).all(id, user.enterprise_id);
  return {
    ...item,
    status_label: RFQ_STATUS_LABELS[item.status],
    customer,
    project,
    requirements,
    risks,
    followups,
    assessment: rfqAssessment(id, user),
    history: logModel.listByEntity(user.enterprise_id, 'rfq', id, 200)
  };
}

function updateRequirement(rfqId, requirementId, input, user) {
  requireOperator(user);
  const rfq = mustRfq(rfqId, user);
  const current = db.prepare(`SELECT * FROM rfq_requirements
    WHERE id=? AND rfq_id=? AND enterprise_id=?`).get(requirementId, rfqId, user.enterprise_id);
  if (!current) throw domainError('需求项不存在或无权访问', 'REQUIREMENT_NOT_FOUND', 404);
  const value = text(input.value);
  const confirmed = input.confirmed === undefined ? current.confirmed : (input.confirmed ? 1 : 0);
  const timestamp = now();
  db.transaction(() => {
    db.prepare(`UPDATE rfq_requirements SET value=?,confirmed=?,source='manual',updated_by=?,updated_at=?
      WHERE id=? AND rfq_id=? AND enterprise_id=?`)
      .run(value, confirmed, user.id, timestamp, requirementId, rfqId, user.enterprise_id);
    const spec = REQUIREMENT_SPECS.find(item => item.key === current.field_key);
    if (spec) {
      const formalValue = spec.numeric ? Math.max(0, finiteNumber(value)) : value;
      db.prepare(`UPDATE rfqs SET ${spec.column}=?,version=version+1,updated_by=?,updated_at=?
        WHERE id=? AND enterprise_id=?`).run(formalValue, user.id, timestamp, rfqId, user.enterprise_id);
    }
    const assessment = rfqAssessment(rfqId, user);
    const nextStatus = rfq.status === 'information_required' && !assessment.missing_fields.length ? 'draft' : rfq.status;
    db.prepare(`UPDATE rfqs SET missing_summary=?,status=? WHERE id=? AND enterprise_id=?`)
      .run(assessment.missing_fields.map(field => field.label).join('、'), nextStatus, rfqId, user.enterprise_id);
    audit(user, 'rfq', rfqId, 'requirement_update', '修改 RFQ 需求项', {
      before: current,
      after: { ...current, value, confirmed }
    });
  })();
  return getRfq(rfqId, user);
}

function createRisk(rfqId, input, user) {
  requireOperator(user);
  rejectAiDecision(input);
  mustRfq(rfqId, user);
  if (!text(input.title)) throw domainError('风险标题不能为空');
  const status = text(input.status) || 'open';
  if (!['open', 'handling', 'mitigated', 'accepted', 'closed'].includes(status)) throw domainError('风险状态无效');
  const derived = riskDerived(input);
  if (status === 'accepted' && derived.is_blocking && !text(input.acceptance_reason)) {
    throw domainError('高风险或阻断风险接受时必须填写接受理由');
  }
  if (status === 'closed' && !text(input.closure_evidence)) throw domainError('关闭风险必须填写关闭说明或证据');
  if (status === 'accepted' || status === 'closed') requireAdmin(user);
  const timestamp = now();
  const id = uuidv4();
  db.prepare(`INSERT INTO rfq_risks(
    id,enterprise_id,rfq_id,title,category,severity,probability,impact,risk_score,risk_level,is_blocking,
    owner,due_date,mitigation,status,acceptance_reason,closure_evidence,version,
    created_by,updated_by,created_at,updated_at,deleted_at,deleted_by
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,NULL,NULL)`).run(
    id, user.enterprise_id, rfqId, text(input.title), text(input.category) || 'delivery',
    derived.severity, derived.probability, derived.impact, derived.risk_score, derived.risk_level,
    derived.is_blocking, text(input.owner), text(input.due_date), text(input.mitigation), status,
    text(input.acceptance_reason), text(input.closure_evidence), user.id, user.id, timestamp, timestamp
  );
  const risk = db.prepare('SELECT * FROM rfq_risks WHERE id=? AND enterprise_id=?').get(id, user.enterprise_id);
  audit(user, 'rfq', rfqId, 'risk_create', '新增 RFQ 风险', { after: risk });
  return getRfq(rfqId, user);
}

function updateRisk(rfqId, riskId, input, user) {
  requireOperator(user);
  rejectAiDecision(input);
  mustRfq(rfqId, user);
  const current = db.prepare(`SELECT * FROM rfq_risks
    WHERE id=? AND rfq_id=? AND enterprise_id=? AND deleted_at IS NULL`)
    .get(riskId, rfqId, user.enterprise_id);
  if (!current) throw domainError('风险不存在或无权访问', 'RISK_NOT_FOUND', 404);
  checkVersion(current, input);
  if (input.risk_level !== undefined || input.risk_score !== undefined || input.is_blocking !== undefined) {
    throw domainError('风险等级和阻断状态由程序计算');
  }
  const merged = { ...current, ...input };
  const status = text(merged.status);
  if (!['open', 'handling', 'mitigated', 'accepted', 'closed'].includes(status)) throw domainError('风险状态无效');
  const derived = riskDerived(merged);
  if (status === 'accepted' && derived.is_blocking && !text(merged.acceptance_reason)) {
    throw domainError('高风险或阻断风险接受时必须填写接受理由');
  }
  if (status === 'closed' && !text(merged.closure_evidence)) throw domainError('关闭风险必须填写关闭说明或证据');
  if (status === 'accepted' || status === 'closed') requireAdmin(user);
  const fields = RISK_FIELDS.filter(field => input[field] !== undefined);
  const values = { id: riskId, enterprise_id: user.enterprise_id, updated_by: user.id, updated_at: now(), ...derived };
  for (const field of fields) values[field] = ['severity', 'probability', 'impact'].includes(field)
    ? derived[field] : text(input[field]);
  const computed = ['severity', 'probability', 'impact', 'risk_score', 'risk_level', 'is_blocking'];
  const updateFields = [...new Set([...fields, ...computed])];
  db.prepare(`UPDATE rfq_risks SET ${updateFields.map(field => `${field}=@${field}`).join(',')},
    version=version+1,updated_by=@updated_by,updated_at=@updated_at
    WHERE id=@id AND enterprise_id=@enterprise_id AND deleted_at IS NULL`).run(values);
  const updated = db.prepare('SELECT * FROM rfq_risks WHERE id=? AND enterprise_id=?').get(riskId, user.enterprise_id);
  audit(user, 'rfq', rfqId, 'risk_update', '修改 RFQ 风险', { before: current, after: updated });
  return getRfq(rfqId, user);
}

function addFollowup(rfqId, input, user) {
  requireOperator(user);
  mustRfq(rfqId, user);
  if (!text(input.content)) throw domainError('跟进内容不能为空');
  const id = uuidv4();
  const timestamp = now();
  db.prepare(`INSERT INTO rfq_followups(
    id,enterprise_id,rfq_id,method,content,next_followup_at,owner,result,created_by,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    id, user.enterprise_id, rfqId, text(input.method) || 'note', text(input.content),
    text(input.next_followup_at), text(input.owner), text(input.result), user.id, timestamp
  );
  audit(user, 'rfq', rfqId, 'followup_create', '新增 RFQ 跟进记录', {
    after: { id, method: text(input.method) || 'note', next_followup_at: text(input.next_followup_at), owner: text(input.owner) }
  });
  return getRfq(rfqId, user);
}

function createReviewTask(rfq, user) {
  const timestamp = now();
  const taskId = uuidv4();
  agentTaskModel.create({
    id: taskId,
    enterprise_id: user.enterprise_id,
    user_id: user.id,
    agent_name: 'RFQ评审',
    title: `${rfq.rfq_no} RFQ 人工评审`,
    goal: '由授权审批人确认客户需求和风险后决定是否可报价',
    status: 'waiting_human',
    current_step: 1,
    total_steps: 1,
    input_payload: { workflowType: 'rfq_review', rfqId: rfq.id, rfqNo: rfq.rfq_no },
    output_payload: {},
    error_code: '',
    error_message: '',
    retry_count: 0,
    confidence: 1,
    needs_approval: 1,
    created_at: timestamp,
    updated_at: timestamp
  });
  const approval = approvalService.request({
    taskId,
    enterpriseId: user.enterprise_id,
    userId: user.id,
    toolName: 'rfq_review',
    actionLabel: `确认 ${rfq.rfq_no} 可报价`,
    reason: 'RFQ 需求和风险必须由人工确认',
    payload: { entityType: 'rfq', entityId: rfq.id, rfqNo: rfq.rfq_no }
  });
  return { taskId, approval };
}

function submitReview(rfqId, input, user) {
  requireOperator(user);
  rejectAiDecision(input);
  const rfq = mustRfq(rfqId, user);
  if (!['draft', 'information_required'].includes(rfq.status)) {
    throw domainError('当前状态不能提交评审', 'INVALID_TRANSITION', 409);
  }
  const assessment = rfqAssessment(rfqId, user);
  if (assessment.missing_fields.length) {
    db.prepare(`UPDATE rfqs SET status='information_required',missing_summary=?,version=version+1,
      updated_by=?,updated_at=? WHERE id=? AND enterprise_id=?`)
      .run(assessment.missing_fields.map(field => field.label).join('、'), user.id, now(), rfqId, user.enterprise_id);
    audit(user, 'rfq', rfqId, 'submit_blocked', 'RFQ 提交评审被缺失项阻断', {
      detail: assessment.missing_fields.map(field => field.label).join('、'),
      before: rfq,
      after: mustRfq(rfqId, user),
      result: 'blocked'
    });
    return getRfq(rfqId, user);
  }
  return db.transaction(() => {
    const review = createReviewTask(rfq, user);
    db.prepare(`UPDATE rfqs SET status='waiting_review',review_task_id=?,review_approval_id=?,
      version=version+1,updated_by=?,updated_at=? WHERE id=? AND enterprise_id=?`)
      .run(review.taskId, review.approval.id, user.id, now(), rfqId, user.enterprise_id);
    audit(user, 'rfq', rfqId, 'submit_review', '提交 RFQ 评审', {
      before: rfq,
      after: mustRfq(rfqId, user),
      approvalId: review.approval.id
    });
    return getRfq(rfqId, user);
  })();
}

function transitionRfq(rfqId, input, user) {
  requireOperator(user);
  rejectAiDecision(input);
  const rfq = mustRfq(rfqId, user);
  const target = text(input.target_status);
  if (!RFQ_STATUS_LABELS[target]) throw domainError('目标状态无效');
  if (!RFQ_TRANSITIONS[rfq.status]?.has(target)) {
    throw domainError(`不允许从${RFQ_STATUS_LABELS[rfq.status]}进入${RFQ_STATUS_LABELS[target]}`, 'INVALID_TRANSITION', 409);
  }
  const reason = text(input.reason);
  if (['information_required', 'won', 'expired'].includes(target) && !reason) {
    throw domainError(`${RFQ_STATUS_LABELS[target]}必须填写原因或客户确认说明`);
  }
  let approvalId = '';
  if (target === 'ready_for_quotation') {
    requireAdmin(user);
    const assessment = rfqAssessment(rfqId, user);
    if (assessment.blockers.length) throw domainError(`RFQ 仍被阻塞：${assessment.blockers[0].message}`, 'RFQ_BLOCKED', 409);
    if (!rfq.review_approval_id) throw domainError('RFQ 尚未提交正式评审', 'APPROVAL_REQUIRED', 409);
    const approval = agentApprovalModel.findById(rfq.review_approval_id);
    if (!approval || approval.status !== 'pending') throw domainError('审批请求不存在或已处理', 'APPROVAL_INVALID', 409);
    approvalService.decide({
      approvalId: approval.id,
      actor: { enterpriseId: user.enterprise_id, userId: user.id, name: user.name || user.email || user.id, role: user.role },
      approved: true,
      reason: reason || '需求和风险已由人工确认'
    });
    agentTaskModel.update(rfq.review_task_id, { status: 'success', needs_approval: 0, output_payload: { approved: true, reason } });
    approvalId = approval.id;
  }
  const timestamp = now();
  db.prepare(`UPDATE rfqs SET status=?,version=version+1,updated_by=?,updated_at=?
    WHERE id=? AND enterprise_id=?`).run(target, user.id, timestamp, rfqId, user.enterprise_id);
  audit(user, 'rfq', rfqId, 'transition', `RFQ 状态变更为${RFQ_STATUS_LABELS[target]}`, {
    detail: reason,
    before: rfq,
    after: mustRfq(rfqId, user),
    approvalId
  });
  return getRfq(rfqId, user);
}

function convertToQuotation(rfqId, input, user) {
  requireOperator(user);
  rejectAiDecision(input);
  const rfq = mustRfq(rfqId, user);
  const assessment = rfqAssessment(rfqId, user);
  if (!assessment.can_convert_to_quotation) {
    throw domainError(assessment.blockers[0]?.message || 'RFQ 当前不可转报价', 'RFQ_NOT_READY', 409);
  }
  const customer = mustCustomer(rfq.customer_id, user);
  const reference = `rfq:${rfq.id}:v${rfq.version}`;
  const quotationDraft = {
    source: 'manufacturing_rfq',
    sourceRfqId: rfq.id,
    sourceRfqNo: rfq.rfq_no,
    customerName: customer.name,
    productName: rfq.product_name,
    productCode: rfq.product_code,
    materialName: rfq.material,
    quantity: String(rfq.quantity || ''),
    unit: rfq.unit,
    processType: rfq.process_requirements,
    deliveryDate: rfq.requested_delivery_date,
    contactName: rfq.contact_name,
    phone: rfq.contact_details,
    requirements: [rfq.tolerance_requirements, rfq.surface_treatment, rfq.packaging_requirements, rfq.notes]
      .filter(Boolean).join('；'),
    approvalStatus: 'approved',
    approvedByHuman: true,
    assessment
  };
  db.prepare(`UPDATE rfqs SET status='quotation_in_progress',quote_workspace_ref=?,version=version+1,
    updated_by=?,updated_at=? WHERE id=? AND enterprise_id=?`)
    .run(reference, user.id, now(), rfqId, user.enterprise_id);
  audit(user, 'rfq', rfqId, 'convert_to_quotation', 'RFQ 转入现有报价模块', {
    before: rfq,
    after: mustRfq(rfqId, user),
    detail: reference
  });
  return { rfq: getRfq(rfqId, user), quotationDraft };
}

function hashLegacy(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function importLegacyRfqs(user) {
  requireAdmin(user);
  const stateRow = db.prepare('SELECT payload FROM app_states WHERE enterprise_id=?').get(user.enterprise_id);
  if (!stateRow) return { imported: 0, skipped: 0, items: [] };
  let state;
  try {
    state = JSON.parse(stateRow.payload);
  } catch {
    throw domainError('旧询盘数据无法解析，原数据未修改', 'LEGACY_STATE_INVALID', 409);
  }
  const records = Array.isArray(state.ocrInquiries) ? state.ocrInquiries : [];
  const result = { imported: 0, skipped: 0, items: [] };
  for (const record of records) {
    const sourceId = text(record.id) || hashLegacy(record).slice(0, 16);
    const sourceHash = hashLegacy(record);
    const existingMigration = db.prepare(`SELECT * FROM legacy_migration_records
      WHERE enterprise_id=? AND source_area='app_states.ocrInquiries' AND source_record_id=? AND source_hash=?`)
      .get(user.enterprise_id, sourceId, sourceHash);
    if (existingMigration) {
      result.skipped += 1;
      continue;
    }
    const customerName = text(record.customerName || record.fields?.customer_name || record.customer || '旧询盘客户待补充');
    let customer = db.prepare(`SELECT * FROM customers
      WHERE enterprise_id=? AND name=? AND deleted_at IS NULL ORDER BY created_at LIMIT 1`)
      .get(user.enterprise_id, customerName);
    if (!customer) customer = createCustomer({ name: customerName, source: 'legacy_inquiry', status: 'draft' }, user);
    const existingRfq = db.prepare(`SELECT id FROM rfqs
      WHERE enterprise_id=? AND source='legacy_app_state' AND source_reference=?`).get(user.enterprise_id, sourceId);
    const rfq = existingRfq ? getRfq(existingRfq.id, user) : createRfq({
      customer_id: customer.id,
      source: 'legacy_app_state',
      source_reference: sourceId,
      product_name: text(record.productName || record.fields?.product_name || '旧询盘产品待补充'),
      quantity: record.quantity || record.fields?.quantity || 0,
      unit: record.unit || record.fields?.unit || '件',
      material: record.material || record.fields?.material || '',
      process_requirements: record.process || record.fields?.process || '',
      requested_delivery_date: record.deliveryDate || record.fields?.delivery_date || '',
      contact_name: record.contactName || '',
      contact_details: record.contact || record.fields?.phone || '',
      notes: `旧询盘导入；原状态：${text(record.status) || 'unknown'}。${text(record.notes)}`,
      owner: user.name || user.email || ''
    }, user);
    const timestamp = now();
    db.prepare(`INSERT INTO legacy_migration_records(
      id,enterprise_id,source_area,source_record_id,source_hash,target_type,target_id,status,error_summary,migrated_at,created_at
    ) VALUES(?,?,?,?,?,?,?,'imported','',?,?)`).run(
      uuidv4(), user.enterprise_id, 'app_states.ocrInquiries', sourceId, sourceHash, 'rfq', rfq.id, timestamp, timestamp
    );
    result.imported += 1;
    result.items.push(rfq);
  }
  return result;
}

module.exports = {
  RFQ_STATUS_LABELS,
  RFQ_TRANSITIONS,
  REQUIREMENT_SPECS,
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerContact,
  updateCustomerContact,
  deleteCustomerContact,
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  createRfq,
  listRfqs,
  getRfq,
  updateRfq,
  deleteRfq,
  rfqAssessment,
  updateRequirement,
  createRisk,
  updateRisk,
  addFollowup,
  submitReview,
  transitionRfq,
  convertToQuotation,
  importLegacyRfqs,
  riskDerived
};
