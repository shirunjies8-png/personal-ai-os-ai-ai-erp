import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const root = process.cwd();
const now = () => new Date().toISOString();

export async function createMaterialIssueFixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eaos-material-issue-acceptance-'));
  const dbPath = path.join(dir, 'acceptance.sqlite3');
  const init = spawnSync(process.execPath, ['scripts/init-db.mjs'], {
    cwd: root,
    env: { ...process.env, DB_PATH: dbPath, UPLOADS_DIR: path.join(dir, 'uploads'), LOGS_DIR: path.join(dir, 'logs'), BACKUPS_DIR: path.join(dir, 'backups') },
    encoding: 'utf8'
  });
  if (init.status !== 0) throw new Error(`Fixture schema initialization failed: ${init.stderr || init.stdout}`);
  const db = new Database(dbPath);
  const enterpriseId = 'fixture-enterprise';
  const requester = { id: 'fixture-requester', email: 'requester.fixture@example.test', password: 'Requester-Only-123!', role: '操作员' };
  const approver = { id: 'fixture-approver', email: 'approver.fixture@example.test', password: 'Approver-Only-123!', role: '企业管理员' };
  const timestamp = now();
  db.prepare('INSERT INTO enterprises(id,name,logo_url,contact_name,contact_phone,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(enterpriseId, 'Material Issue Acceptance Fixture', '', '', '', timestamp, timestamp);
  for (const user of [requester, approver]) {
    db.prepare('INSERT INTO users(id,enterprise_id,email,password_hash,name,role,status,department,team,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run(user.id, enterpriseId, user.email, await bcrypt.hash(user.password, 10), user.id, user.role, '启用', 'Fixture', 'Acceptance', timestamp, timestamp);
  }
  const rows = [
    ['fixture-normal', 'FIX-NORMAL', 'Normal inventory', 100, 20],
    ['fixture-insufficient', 'FIX-INSUFFICIENT', 'Insufficient inventory', 10, 0],
    ['fixture-safety', 'FIX-SAFETY', 'Safety-stock inventory', 50, 40]
  ];
  for (const [id, code, name, stock, safety] of rows) {
    db.prepare('INSERT INTO inventory(id,enterprise_id,product_code,product_name,stock_quantity,safety_stock,location,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(id, enterpriseId, code, name, stock, safety, 'fixture', 0, timestamp, timestamp);
  }
  db.close();
  return { dir, dbPath, enterpriseId, requester, approver };
}

export async function cleanupMaterialIssueFixture(fixture) {
  if (fixture?.dir) await fs.rm(fixture.dir, { recursive: true, force: true });
}
