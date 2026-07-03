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
`);

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
