import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

process.env.AI_OFFICE_SKIP_ENV_FILES = '1';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-governed-dashboard-'));
process.env.DB_PATH = process.env.GOVERNED_DASHBOARD_TEST_DB_PATH || path.join(root, 'governed-dashboard.sqlite3');
process.env.UPLOADS_DIR = path.join(root, 'uploads');
process.env.LOGS_DIR = path.join(root, 'logs');
process.env.BACKUPS_DIR = path.join(root, 'backups');

const require = createRequire(import.meta.url);
const currentFile = fileURLToPath(import.meta.url);
const db = require('../database/client');
const { authRequired } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');
const dashboardService = require('../services/dashboardService');
const governedDashboardService = require('../services/governedDashboardService');
const readModel = require('../services/realityosControlPlaneReadModel');

function createSchema() {
  db.exec(`
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
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  product_code TEXT DEFAULT '',
  product_name TEXT NOT NULL,
  stock_quantity REAL NOT NULL DEFAULT 0,
  safety_stock REAL NOT NULL DEFAULT 0,
  location TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT '',
  updated_at TEXT NOT NULL
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
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL,
  user_id TEXT DEFAULT '',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
`);
}

function resetBusinessTables() {
  for (const table of ['orders', 'inventory', 'feedback', 'logs']) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
}

function seedBusinessData() {
  const now = '2026-09-27T10:00:00.000Z';
  db.prepare(`INSERT INTO orders (id,enterprise_id,order_no,customer,product,quantity,delivery_date,status,priority,created_at,updated_at)
    VALUES (@id,@enterprise_id,@order_no,@customer,@product,@quantity,@delivery_date,@status,@priority,@created_at,@updated_at)`).run({
    id: 'order-a-1',
    enterprise_id: 'enterprise-a',
    order_no: 'SO-A-1',
    customer: 'A Customer',
    product: 'A Product',
    quantity: 10,
    delivery_date: '2026-09-27',
    status: '待处理',
    priority: '中',
    created_at: now,
    updated_at: now,
  });
  db.prepare(`INSERT INTO orders (id,enterprise_id,order_no,customer,product,quantity,delivery_date,status,priority,created_at,updated_at)
    VALUES (@id,@enterprise_id,@order_no,@customer,@product,@quantity,@delivery_date,@status,@priority,@created_at,@updated_at)`).run({
    id: 'order-b-1',
    enterprise_id: 'enterprise-b',
    order_no: 'SO-B-1',
    customer: 'B Customer',
    product: 'B Product',
    quantity: 20,
    delivery_date: '2026-09-27',
    status: '延期',
    priority: '高',
    created_at: now,
    updated_at: now,
  });
  db.prepare(`INSERT INTO inventory (id,enterprise_id,product_code,product_name,stock_quantity,safety_stock,location,version,created_at,updated_at)
    VALUES (@id,@enterprise_id,@product_code,@product_name,@stock_quantity,@safety_stock,@location,@version,@created_at,@updated_at)`).run({
    id: 'inventory-a-1',
    enterprise_id: 'enterprise-a',
    product_code: 'A-001',
    product_name: 'A Inventory',
    stock_quantity: 5,
    safety_stock: 10,
    location: 'A1',
    version: 0,
    created_at: now,
    updated_at: now,
  });
  db.prepare(`INSERT INTO feedback (id,enterprise_id,user_id,category,rating,reason,modified_content,created_at)
    VALUES (@id,@enterprise_id,@user_id,@category,@rating,@reason,@modified_content,@created_at)`).run({
    id: 'feedback-a-1',
    enterprise_id: 'enterprise-a',
    user_id: 'user-a',
    category: 'dashboard',
    rating: 'good',
    reason: 'read-only',
    modified_content: '',
    created_at: now,
  });
  db.prepare(`INSERT INTO logs (id,enterprise_id,user_id,type,title,detail,created_at)
    VALUES (@id,@enterprise_id,@user_id,@type,@title,@detail,@created_at)`).run({
    id: 'log-a-1',
    enterprise_id: 'enterprise-a',
    user_id: 'user-a',
    type: 'system',
    title: 'A log',
    detail: 'readable',
    created_at: now,
  });
}

function seedRestartData() {
  resetBusinessTables();
  const now = '2026-09-27T10:30:00.000Z';
  db.prepare(`INSERT INTO orders (id,enterprise_id,order_no,customer,product,quantity,delivery_date,status,priority,created_at,updated_at)
    VALUES (@id,@enterprise_id,@order_no,@customer,@product,@quantity,@delivery_date,@status,@priority,@created_at,@updated_at)`).run({
    id: 'order-restart-1',
    enterprise_id: 'enterprise-restart',
    order_no: 'SO-RESTART-1',
    customer: 'Restart Customer',
    product: 'Restart Product',
    quantity: 3,
    delivery_date: '2026-09-27',
    status: '待处理',
    priority: '中',
    created_at: now,
    updated_at: now,
  });
}

function countBusinessRows() {
  return Object.fromEntries(['orders', 'inventory', 'feedback', 'logs'].map(table => [
    table,
    db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
  ]));
}

function user(overrides = {}) {
  return {
    id: 'user-a',
    email: 'user-a@example.test',
    enterprise_id: 'enterprise-a',
    role: 'admin',
    ...overrides,
  };
}

function latestRun() {
  return db.prepare('SELECT * FROM realityos_kernel_runs ORDER BY updated_at DESC LIMIT 1').get();
}

createSchema();

const childMode = process.argv.find(arg => arg.startsWith('--child='))?.slice('--child='.length);
if (childMode === 'write-restart-proof') {
  seedRestartData();
  const writeResult = governedDashboardService.getGovernedDashboard({
    user: user({ id: 'user-restart', email: 'restart@example.test', enterprise_id: 'enterprise-restart' }),
    method: 'GET',
  });
  console.log(JSON.stringify({
    child: childMode,
    run_id: writeResult.realityos.run_id,
    evidence_id: writeResult.realityos.evidence_id,
    verification_id: writeResult.realityos.verification_id,
  }));
  db.close();
  process.exit(0);
}

if (childMode === 'read-restart-proof') {
  const controlPlane = readModel.getControlPlane({ db, enterpriseId: 'enterprise-restart' });
  const governedRuns = controlPlane.runs.filter(run => run.capability_id === governedDashboardService.CAPABILITY_ID);
  assert.equal(governedRuns.length, 1);
  const detail = readModel.loadRun(db, governedRuns[0].run_id, 'enterprise-restart');
  assert.equal(detail.evidence.length, 1);
  assert.equal(detail.verification.length, 1);
  assert.equal(detail.run.lifecycle, 'OUTCOME_RECORDED');
  console.log(JSON.stringify({
    child: childMode,
    run_id: governedRuns[0].run_id,
    evidence: detail.evidence.length,
    verification: detail.verification.length,
    control_plane_visible: true,
  }));
  db.close();
  process.exit(0);
}

seedBusinessData();

assert.equal(authRequired.name, 'authRequired', 'route auth middleware remains the product auth gate');
assert.equal(typeof dashboardService.getDashboard, 'function', 'dashboardService.getDashboard remains the dashboard business owner');

const beforeCounts = countBusinessRows();
const result = governedDashboardService.getGovernedDashboard({ user: user(), method: 'GET' });
assert.equal(result.dashboard.todayOrders, 1);
assert.equal(result.dashboard.inventoryAlerts, 1);
assert.equal(result.dashboard.aiLearningTimes, 1);
assert.equal(result.realityos.capability_id, governedDashboardService.CAPABILITY_ID);
assert.equal(result.realityos.effect_class, 'OBSERVATION');
assert.equal(result.realityos.verification_status, 'VERIFIED');
assert.equal(result.realityos.represented_principal, 'NOT_FABRICATED');
assert.equal(result.realityos.delegation, 'NOT_FABRICATED');
assert.equal(result.realityos.real_jev_runtime, 'NOT_INTEGRATED');
assert.deepEqual(countBusinessRows(), beforeCounts, 'governed dashboard path must not mutate business tables');

const runRow = db.prepare('SELECT * FROM realityos_kernel_runs WHERE run_id=?').get(result.realityos.run_id);
assert.equal(runRow.enterprise_id, 'enterprise-a');
assert.equal(runRow.capability_id, governedDashboardService.CAPABILITY_ID);
assert.equal(runRow.lifecycle_state, 'OUTCOME_RECORDED');
assert.equal(runRow.effect_certainty, 'OBSERVED');
assert.equal(JSON.parse(runRow.represented_principal_ref), null);
assert.equal(JSON.parse(runRow.lease_ref), null);

const transitions = db.prepare('SELECT to_state FROM realityos_kernel_transitions WHERE run_id=? ORDER BY revision_after').all(result.realityos.run_id).map(row => row.to_state);
assert.deepEqual(transitions, [
  'CREATED',
  'CONTEXT_BOUND',
  'AUTHORITY_PENDING',
  'AUTHORIZED',
  'PREFLIGHT_PENDING',
  'PREFLIGHT_PASSED',
  'EXECUTION_PENDING',
  'EXECUTING',
  'EFFECT_PENDING',
  'READBACK_PENDING',
  'EVIDENCE_PENDING',
  'VERIFICATION_PENDING',
  'VERIFIED',
  'OUTCOME_RECORDED',
]);

const attempt = db.prepare('SELECT * FROM realityos_kernel_attempts WHERE run_id=?').get(result.realityos.run_id);
assert.equal(attempt.status, 'SUCCESS');
assert.equal(attempt.dispatch_started, 1);
assert.equal(attempt.effect_certainty, 'OBSERVED');

const evidence = db.prepare('SELECT * FROM realityos_evidence_receipts WHERE run_id=?').get(result.realityos.run_id);
assert.equal(evidence.evidence_type, 'DASHBOARD_OBSERVATION_READBACK');
assert.equal(evidence.owner, '13-evidence-runtime');
const evidencePayload = JSON.parse(evidence.payload_ref);
assert.equal(evidencePayload.full_payload_stored, false);
assert.deepEqual(evidencePayload.source_tables, ['orders', 'inventory', 'feedback', 'logs']);

const verification = db.prepare('SELECT * FROM realityos_verification_cases WHERE run_id=?').get(result.realityos.run_id);
assert.equal(verification.status, 'VERIFIED');
assert.ok(['STABLE_OBSERVATION_VERIFIED', 'OBSERVATION_SCHEMA_VERIFIED_READBACK_CHANGED'].includes(verification.decision));

const controlPlane = readModel.getControlPlane({ db, enterpriseId: 'enterprise-a' });
assert.equal(controlPlane.runs.some(run => run.run_id === result.realityos.run_id), true);
assert.equal(controlPlane.first_read_only_path.status, 'VERIFIED');

const otherEnterpriseRuns = readModel.getControlPlane({ db, enterpriseId: 'enterprise-b' }).runs;
assert.equal(otherEnterpriseRuns.some(run => run.run_id === result.realityos.run_id), false);

assert.throws(() => governedDashboardService.getGovernedDashboard({
  user: user({ enterprise_id: '' }),
  method: 'GET',
  dashboardReader() {
    throw new Error('business reader must not be called without enterprise');
  },
}), /ENTERPRISE_CONTEXT_REQUIRED/);

assert.throws(() => governedDashboardService.getGovernedDashboard({ user: user(), method: 'POST' }), /READ_ONLY_METHOD_REQUIRED/);

let callCount = 0;
const unstableResult = governedDashboardService.getGovernedDashboard({
  user: user(),
  method: 'GET',
  dashboardReader() {
    callCount += 1;
    return {
      todayOrders: callCount === 1 ? [{ id: 'first' }] : [{ id: 'first' }, { id: 'second' }],
      inventoryAlerts: [],
      delayedOrders: [],
      todayPlan: [],
      aiSuggestions: [],
      agentExecutions: callCount,
      aiLearningTimes: 0,
      systemStatus: '运行中',
    };
  },
});
assert.equal(callCount, 2, 'governed path must perform first observation plus readback');
assert.equal(unstableResult.realityos.stable_match, false);
const unstableVerification = db.prepare('SELECT decision FROM realityos_verification_cases WHERE run_id=?').get(unstableResult.realityos.run_id);
assert.equal(unstableVerification.decision, 'OBSERVATION_SCHEMA_VERIFIED_READBACK_CHANGED');

const restartDbPath = path.join(root, 'restart-proof.sqlite3');
const childEnv = {
  ...process.env,
  GOVERNED_DASHBOARD_TEST_DB_PATH: restartDbPath,
  AI_OFFICE_SKIP_ENV_FILES: '1',
};
const writer = spawnSync(process.execPath, [currentFile, '--child=write-restart-proof'], {
  env: childEnv,
  encoding: 'utf8',
});
assert.equal(writer.status, 0, writer.stderr || writer.stdout);
const reader = spawnSync(process.execPath, [currentFile, '--child=read-restart-proof'], {
  env: childEnv,
  encoding: 'utf8',
});
assert.equal(reader.status, 0, reader.stderr || reader.stdout);
const restartReadback = JSON.parse(reader.stdout.trim());
assert.equal(restartReadback.control_plane_visible, true);
assert.equal(restartReadback.evidence, 1);
assert.equal(restartReadback.verification, 1);

let durableFailureBusinessCalls = 0;
assert.throws(() => governedDashboardService.getGovernedDashboard({
  user: user(),
  method: 'GET',
  store: {
    create() {
      throw new Error('store unavailable');
    },
  },
  dashboardReader() {
    durableFailureBusinessCalls += 1;
    return {};
  },
}), /GOVERNED_DASHBOARD_DURABLE_RUN_FAILED/);
assert.equal(durableFailureBusinessCalls, 0, 'durable creation failure must fail closed before business read');

assert.throws(() => governedDashboardService.getGovernedDashboard({
  user: user(),
  method: 'GET',
  dashboardReader() {
    throw Object.assign(new Error('dashboard service exploded'), { code: 'DASHBOARD_SERVICE_TEST_FAILURE' });
  },
}), /dashboard service exploded/);
const failedRun = latestRun();
assert.equal(failedRun.lifecycle_state, 'TERMINAL_FAILURE');

let headerRunId = '';
let controllerStatus = 200;
let controllerBody = null;
dashboardController.getDashboard({
  method: 'GET',
  user: user(),
}, {
  set(name, value) {
    if (name === 'X-RealityOS-Run-Id') headerRunId = value;
  },
  status(code) {
    controllerStatus = code;
    return this;
  },
  json(payload) {
    controllerBody = payload;
    return payload;
  },
});
assert.equal(controllerStatus, 200);
assert.equal(controllerBody.ok, true);
assert.ok(controllerBody.data.dashboard);
assert.equal(controllerBody.data.realityos.run_id, headerRunId);
assert.equal(controllerBody.data.realityos.capability_id, governedDashboardService.CAPABILITY_ID);

const governedSource = fs.readFileSync(path.join(process.cwd(), 'services', 'governedDashboardService.js'), 'utf8');
assert.equal(governedSource.includes('jevEffectClassificationProvider'), false, 'dashboard OBSERVATION path must not depend on Jev runtime');

db.close();
console.log(JSON.stringify({
  GOVERNED_DASHBOARD_PATH: 'PASS',
  CAPABILITY: governedDashboardService.CAPABILITY_ID,
  EFFECT: 'OBSERVATION',
  BUSINESS_SERVICE_OWNER: 'services/dashboardService.js#getDashboard',
  REALITYOS_RUN_CREATED: true,
  EVIDENCE_CREATED: true,
  VERIFICATION_CREATED: true,
  BUSINESS_MUTATION: 'NONE',
  JEV_DEPENDENCY: 'NO',
}, null, 2));
