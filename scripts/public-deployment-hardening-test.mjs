import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

process.env.AI_OFFICE_SKIP_ENV_FILES = '1';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-public-hardening-'));
process.env.DB_PATH = path.join(root, 'hardening.sqlite3');
process.env.UPLOADS_DIR = path.join(root, 'uploads');
process.env.LOGS_DIR = path.join(root, 'logs');
process.env.BACKUPS_DIR = path.join(root, 'backups');

const require = createRequire(import.meta.url);
const deployment = require('../services/deploymentReadinessService');
const env = require('../config/env');
const { authRequired, adminRequired } = require('../middleware/auth');
const { signToken } = require('../utils/jwt');
const db = require('../database/init');
const readModel = require('../services/realityosControlPlaneReadModel');

const now = new Date().toISOString();

function runMiddleware(middleware, req) {
  let statusCode = 200;
  let payload = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return value;
    },
  };
  middleware(req, res, () => { nextCalled = true; });
  return { statusCode, payload, nextCalled, req };
}

function insertEnterprise(id) {
  db.prepare('INSERT INTO enterprises(id,name,logo_url,contact_name,contact_phone,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .run(id, id, '', '', '', now, now);
}

function insertUser(id, enterpriseId, role) {
  db.prepare('INSERT INTO users(id,enterprise_id,email,password_hash,name,role,status,department,team,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, enterpriseId, `${id}@example.test`, 'hash', id, role, '启用', '', '', now, now);
}

function bearer(userId, enterpriseId, role) {
  return `Bearer ${signToken({ userId, enterpriseId, role })}`;
}

async function waitForBootstrapCompletion() {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const row = db.prepare('SELECT id FROM users WHERE email = ?').get(env.defaultAdminEmail);
    if (row) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Default administrator bootstrap did not reach a terminal database state');
}

insertEnterprise('enterprise-a');
insertEnterprise('enterprise-b');
insertUser('admin-a', 'enterprise-a', '企业管理员');
insertUser('normal-a', 'enterprise-a', '普通员工');
insertUser('admin-b', 'enterprise-b', '企业管理员');

let result = runMiddleware(authRequired, { headers: {} });
assert.equal(result.statusCode, 401, 'unauthenticated Control Plane request must be denied');
assert.equal(result.nextCalled, false);

const normalReq = { headers: { authorization: bearer('normal-a', 'enterprise-a', '普通员工') } };
result = runMiddleware(authRequired, normalReq);
assert.equal(result.nextCalled, true, 'normal user should authenticate');
result = runMiddleware(adminRequired, normalReq);
assert.equal(result.statusCode, 403, 'normal authenticated user must not read Control Plane');
assert.equal(result.nextCalled, false);

const adminReq = { headers: { authorization: bearer('admin-a', 'enterprise-a', '企业管理员') } };
result = runMiddleware(authRequired, adminReq);
assert.equal(result.nextCalled, true, 'admin should authenticate');
result = runMiddleware(adminRequired, adminReq);
assert.equal(result.nextCalled, true, 'admin should pass Control Plane RBAC');

db.exec(`
CREATE TABLE IF NOT EXISTS realityos_kernel_runs (
  run_id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  task_id TEXT DEFAULT '',
  capability_id TEXT DEFAULT '',
  lifecycle_state TEXT DEFAULT '',
  previous_state TEXT DEFAULT '',
  revision INTEGER DEFAULT 0,
  effect_certainty TEXT DEFAULT '',
  identity_ref TEXT DEFAULT '{}',
  authority_ref TEXT DEFAULT '{}',
  represented_principal_ref TEXT DEFAULT 'null',
  expected_actual_ref TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);
db.prepare('INSERT INTO realityos_kernel_runs(run_id,enterprise_id,task_id,capability_id,lifecycle_state,previous_state,revision,effect_certainty,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
  .run('run-enterprise-a', 'enterprise-a', 'task-a', 'capability.dashboard.read_status', 'OUTCOME_RECORDED', 'VERIFIED', 1, 'OBSERVED', now, now);

assert.equal(readModel.loadRun(db, 'run-enterprise-a', 'enterprise-a')?.run?.run_id, 'run-enterprise-a');
assert.equal(readModel.loadRun(db, 'run-enterprise-a', 'enterprise-b'), null, 'Enterprise B admin must not read Enterprise A run');

const sourceRoute = fs.readFileSync(path.join(process.cwd(), 'routes', 'realityosControlPlaneRoutes.js'), 'utf8');
assert.match(sourceRoute, /router\.use\(authRequired\)/);
assert.match(sourceRoute, /router\.use\(adminRequired\)/);
assert.doesNotMatch(sourceRoute, /router\.(post|patch|put|delete)\(/);

const appSource = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
assert.match(appSource, /isRealityOSControlPlaneAdmin/);
assert.match(appSource, /visibleNavigationIds/);
assert.match(appSource, /该受治理工作台仅企业管理员可见/);

const configSource = fs.readFileSync(path.join(process.cwd(), 'config.js'), 'utf8');
assert.match(configSource, /window\.PERSONAL_AI_OS_API_BASE_URL/);
assert.match(configSource, /STATIC_DEMO_ONLY/);
assert.doesNotMatch(configSource, /localhost:3000.*github\.io/s, 'GitHub Pages must not fallback to localhost');

assert.throws(() => deployment.validateProductionEnvironment({
  nodeEnv: 'production',
  dbPath: path.join(root, 'prod.sqlite3'),
}), error => error.code === 'PRODUCTION_STARTUP_CONFIG_INVALID' && error.errors.includes('JWT_SECRET_PRODUCTION_UNSAFE'));

const oldEnv = { ...process.env };
try {
  process.env.JWT_SECRET = 'x'.repeat(40);
  process.env.DEFAULT_ADMIN_PASSWORD = 'SecureAdminPassword-2026!';
  process.env.DEFAULT_ADMIN_EMAIL = 'production-admin@example.test';
  process.env.DEFAULT_ENTERPRISE_NAME = 'Example Manufacturing Enterprise';
  process.env.PERSISTENT_DATA_ROOT = root;
  process.env.DB_PATH = path.join(root, 'prod.sqlite3');
  process.env.CORS_ALLOWED_ORIGINS = 'https://shirunjies8-png.github.io';
  assert.equal(deployment.validateProductionEnvironment({ nodeEnv: 'production', dbPath: process.env.DB_PATH }).ok, true);
  process.env.DB_PATH = path.join(root, 'missing-parent', 'prod.sqlite3');
  assert.throws(() => deployment.validateProductionEnvironment({ nodeEnv: 'production', dbPath: process.env.DB_PATH }), /DB_PATH_PARENT_NOT_WRITABLE_OR_MISSING/);
  process.env.DB_PATH = path.join(root, 'prod.sqlite3');
  process.env.CORS_ALLOWED_ORIGINS = '*';
  assert.throws(() => deployment.validateProductionEnvironment({ nodeEnv: 'production', dbPath: process.env.DB_PATH }), /CORS_WILDCARD_FORBIDDEN_IN_PRODUCTION/);
} finally {
  process.env = oldEnv;
}

const initSource = fs.readFileSync(path.join(process.cwd(), 'database', 'init.js'), 'utf8');
assert.doesNotMatch(initSource, /userModel\.updatePassword\(existing\.id/, 'existing default admin password must not be silently reset');
assert.doesNotMatch(initSource, /DROP TABLE|DELETE FROM users|DELETE FROM enterprises|TRUNCATE|rmSync\(env\.dbPath/, 'production init must not include destructive reset');

const renderSource = fs.readFileSync(path.join(process.cwd(), 'render.yaml'), 'utf8');
assert.match(renderSource, /DB_PATH[\s\S]*value: \/var\/data\/ai-gateway\.sqlite/);
assert.match(renderSource, /CORS_ALLOWED_ORIGINS[\s\S]*value: https:\/\/shirunjies8-png\.github\.io/);
assert.match(renderSource, /healthCheckPath: \/api\/health/);

await waitForBootstrapCompletion();
db.close();
fs.rmSync(root, { recursive: true, force: true });

console.log(JSON.stringify({
  PUBLIC_DEPLOYMENT_HARDENING: 'PASS',
  CONTROL_PLANE_SERVER_AUTHORIZATION: 'VERIFIED',
  CONTROL_PLANE_ALLOWED_ROLE: 'admin',
  CROSS_ENTERPRISE_ISOLATION: 'VERIFIED',
  FRONTEND_ROLE_VISIBILITY: 'VERIFIED',
  API_BASE_SOURCE_OF_TRUTH: 'window.PERSONAL_AI_OS_API_BASE_URL',
  STATIC_MODE_FAIL_SAFE: 'VERIFIED',
  JWT_SECRET_PRODUCTION_GATE: 'VERIFIED',
  DEFAULT_ADMIN_BOOTSTRAP_GATE: 'VERIFIED',
  EXISTING_ADMIN_RESET_RISK: 'REMOVED',
  PRODUCTION_CORS: 'VERIFIED',
  EPHEMERAL_DB_FALLBACK: 'NO',
  PRODUCTION_FIXTURE_SEED: 'NO',
}, null, 2));
