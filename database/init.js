const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./client');
const env = require('../config/env');
const { hashPassword } = require('../utils/password');
const enterpriseModel = require('../models/enterpriseModel');
const userModel = require('../models/userModel');

fs.mkdirSync(env.uploadsDir, { recursive: true });
fs.mkdirSync(env.logsDir, { recursive: true });
fs.mkdirSync(env.backupsDir, { recursive: true });

db.exec(`
CREATE TABLE IF NOT EXISTS enterprises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  department TEXT DEFAULT '',
  team TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_states (
  enterprise_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  order_no TEXT NOT NULL,
  customer TEXT NOT NULL,
  product TEXT NOT NULL,
  quantity REAL NOT NULL,
  delivery_date TEXT DEFAULT '',
  status TEXT DEFAULT '待处理',
  priority TEXT DEFAULT '中',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  product_code TEXT DEFAULT '',
  product_name TEXT NOT NULL,
  stock_quantity REAL NOT NULL DEFAULT 0,
  safety_stock REAL NOT NULL DEFAULT 0,
  location TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  user_id TEXT DEFAULT '',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rating TEXT NOT NULL,
  reason TEXT DEFAULT '',
  modified_content TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mail_records (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  mail_type TEXT NOT NULL,
  attachments TEXT DEFAULT '[]',
  status TEXT NOT NULL,
  failure_reason TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  input_payload TEXT DEFAULT '{}',
  output_payload TEXT DEFAULT '{}',
  error_code TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  retry_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  needs_approval INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  agent_name TEXT DEFAULT '',
  tool_name TEXT DEFAULT '',
  status TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  action_label TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT DEFAULT '',
  payload TEXT DEFAULT '{}',
  approved_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS apqp_projects (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_no TEXT NOT NULL, project_name TEXT NOT NULL, customer_or_source TEXT DEFAULT '', product_description TEXT DEFAULT '', project_owner TEXT DEFAULT '', project_team TEXT DEFAULT '', project_type TEXT DEFAULT '', importance_level TEXT DEFAULT 'medium', current_stage INTEGER DEFAULT 1, overall_progress REAL DEFAULT 0, planned_start_date TEXT DEFAULT '', planned_end_date TEXT DEFAULT '', actual_end_date TEXT DEFAULT '', customer_requirements TEXT DEFAULT '', special_requirements TEXT DEFAULT '', risk_summary TEXT DEFAULT '', status TEXT DEFAULT 'draft', version INTEGER DEFAULT 1, created_by TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_apqp_project_no ON apqp_projects(tenant_id, project_no);
CREATE TABLE IF NOT EXISTS apqp_stages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_no INTEGER NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, progress REAL DEFAULT 0, owner TEXT DEFAULT '', start_date TEXT DEFAULT '', due_date TEXT DEFAULT '', approval_status TEXT DEFAULT 'not_required', blocker_reason TEXT DEFAULT '', next_step TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apqp_deliverables (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_id TEXT NOT NULL, name TEXT NOT NULL, required INTEGER DEFAULT 1, status TEXT DEFAULT 'not_started', evidence_count INTEGER DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apqp_risks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, level TEXT DEFAULT 'medium', status TEXT DEFAULT 'open', owner TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apqp_tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_id TEXT NOT NULL, title TEXT NOT NULL, owner TEXT DEFAULT '', status TEXT DEFAULT 'not_started', due_date TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apqp_evidence (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_id TEXT NOT NULL, deliverable_id TEXT NOT NULL, file_name TEXT NOT NULL, note TEXT DEFAULT '', uploaded_by TEXT DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apqp_stage_approvals (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, stage_id TEXT NOT NULL, status TEXT NOT NULL, requested_by TEXT DEFAULT '', decided_by TEXT DEFAULT '', reason TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apqp_history (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, tenant_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT DEFAULT '', actor TEXT DEFAULT '', created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS ai_usage_records (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  enterprise_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT DEFAULT '',
  module TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  cached INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  request_status TEXT NOT NULL,
  budget_status TEXT NOT NULL DEFAULT 'normal',
  error_signature TEXT DEFAULT '',
  redaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_enterprise_date ON ai_usage_records(enterprise_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_records(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_agent_date ON ai_usage_records(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_module_date ON ai_usage_records(module, created_at);

CREATE TABLE IF NOT EXISTS ai_cache_entries (
  cache_key TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  user_scope TEXT NOT NULL,
  module TEXT NOT NULL,
  task_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  mode TEXT NOT NULL,
  payload TEXT NOT NULL,
  sensitive INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_enterprise ON ai_cache_entries(enterprise_id, created_at);
`);

function ensureColumns(table, columns) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(item => item.name));
  for (const [name, type] of Object.entries(columns)) if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
}
ensureColumns('apqp_evidence', { deleted_at: 'TEXT', deleted_by: 'TEXT', delete_reason: 'TEXT', storage_status: "TEXT DEFAULT 'metadata_only'", file_type: 'TEXT DEFAULT \'\'', file_size: 'INTEGER DEFAULT 0', checksum: 'TEXT DEFAULT \'\'' });
ensureColumns('apqp_deliverables', { owner: 'TEXT DEFAULT \'\'', due_date: 'TEXT DEFAULT \'\'', notes: 'TEXT DEFAULT \'\'', is_applicable: 'INTEGER DEFAULT 1', not_applicable_reason: 'TEXT DEFAULT \'\'', required_evidence_count: 'INTEGER DEFAULT 1', completed_at: 'TEXT', completed_by: 'TEXT' });
ensureColumns('apqp_risks', { description: 'TEXT DEFAULT \'\'', severity: "TEXT DEFAULT 'medium'", probability: 'INTEGER DEFAULT 0', impact: 'INTEGER DEFAULT 0', risk_level: "TEXT DEFAULT 'medium'", is_blocking: 'INTEGER DEFAULT 0', due_date: 'TEXT DEFAULT \'\'', mitigation: 'TEXT DEFAULT \'\'', acceptance_reason: 'TEXT DEFAULT \'\'', closure_evidence: 'TEXT DEFAULT \'\'' });
ensureColumns('apqp_tasks', { description: 'TEXT DEFAULT \'\'', priority: "TEXT DEFAULT 'medium'", evidence_required: 'INTEGER DEFAULT 0', completion_note: 'TEXT DEFAULT \'\'', completed_at: 'TEXT' });

async function seed() {
  const now = new Date().toISOString();
  const existing = userModel.findByEmail(env.defaultAdminEmail);
  if (existing) {
    enterpriseModel.updateById(existing.enterprise_id, {
      name: env.defaultEnterpriseName,
      contact_name: '系统管理员',
      contact_phone: ''
    });
    userModel.updatePassword(existing.id, await hashPassword(env.defaultAdminPassword));
    db.prepare(`
      UPDATE users
      SET name = ?, role = ?, status = ?, department = ?, team = ?, updated_at = ?
      WHERE id = ?
    `).run('企业管理员', '企业管理员', '启用', '管理部', '默认班组', now, existing.id);
    return;
  }
  const enterpriseId = uuidv4();
  enterpriseModel.create({
    id: enterpriseId,
    name: env.defaultEnterpriseName,
    logo_url: '',
    contact_name: '系统管理员',
    contact_phone: '',
    created_at: now,
    updated_at: now
  });
  userModel.create({
    id: uuidv4(),
    enterprise_id: enterpriseId,
    email: env.defaultAdminEmail,
    password_hash: await hashPassword(env.defaultAdminPassword),
    name: '企业管理员',
    role: '企业管理员',
    status: '启用',
    department: '管理部',
    team: '默认班组',
    created_at: now,
    updated_at: now
  });
}

seed().catch(error => {
  console.error('Failed to seed database', error);
});

module.exports = db;
