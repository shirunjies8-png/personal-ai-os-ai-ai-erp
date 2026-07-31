import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// This suite proves Recovery Runtime state, isolation, idempotency and governance.
// It does not claim that arbitrary external systems are recovered or production is deployed.

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-audit-recovery-'));
process.env.DB_PATH = path.join(root, 'recovery.sqlite3'); process.env.LOGS_DIR = path.join(root, 'logs'); process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const require = createRequire(import.meta.url);
const db = require('../database/init');
db.exec("CREATE TABLE audit_recovery_effects (id TEXT PRIMARY KEY, enterprise_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, value TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(enterprise_id,idempotency_key))");
const { AuditRecoveryService, STATES } = require('../services/auditRecoveryService');
const controller = require('../controllers/auditRecoveryController');
const routes = require('../routes/auditRecoveryRoutes');
const enterprise = 'recovery-enterprise'; const circuitEnterprise = 'recovery-circuit-enterprise'; const stamp = new Date().toISOString();
db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(enterprise, enterprise, stamp, stamp);
db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(circuitEnterprise, circuitEnterprise, stamp, stamp);

const attempts = new Map();
const handlers = {
  controlled: {
    execute({ job }) { const payload = job.payload; const count = (attempts.get(job.id) || 0) + 1; attempts.set(job.id, count); if (payload.mode === 'unknown') return { unknown: true, code: 'external_state_unknown', message: '外部状态无法确认' }; if (payload.mode === 'no_progress') return { ok: false, code: 'network_timeout', message: '同一网络超时' }; if (payload.mode === 'verify_fail') return { ok: true, result: { written: true } }; if (payload.mode === 'recoverable' && !payload.evidence_version) return { ok: false, code: 'network_timeout', message: '依赖暂不可用' }; db.prepare('INSERT OR IGNORE INTO audit_recovery_effects(id,enterprise_id,idempotency_key,value,created_at) VALUES(?,?,?,?,?)').run(crypto.randomUUID(), job.enterprise_id, job.idempotency_key, 'written', new Date().toISOString()); return { ok: true, result: { written: true } }; },
    verify({ job }) { if (job.payload.mode === 'verify_fail') return { ok: false, code: 'readback_failed', message: '独立回读失败' }; return { ok: Boolean(db.prepare('SELECT 1 FROM audit_recovery_effects WHERE enterprise_id=? AND idempotency_key=?').get(job.enterprise_id, job.idempotency_key)), message: 'SQLite 回读失败' }; }
  }
};
const service = new AuditRecoveryService({ handlers, leaseMs: 5, maxNoProgress: 2, circuitThreshold: 99, circuitCooldownMs: 1 });
function run(job, worker = 'worker-1') { return service.runOnce(worker, enterprise); }
function due(id) { db.prepare('UPDATE audit_recovery_jobs SET next_retry_at=? WHERE id=?').run(new Date(Date.now() - 1).toISOString(), id); }
function invoke(handler, { user, params = {}, body = {} }) { let status = 200; let payload; handler({ user, params, body }, { status(c) { status = c; return this; }, json(v) { payload = v; } }); return { status, payload }; }

try {
  // Migration and route/auth surface.
  for (const table of ['audit_recovery_jobs', 'audit_recovery_attempts', 'audit_recovery_idempotency', 'audit_recovery_workers', 'audit_recovery_circuits', 'audit_recovery_events']) assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
  const paths = routes.stack.filter(x => x.route).map(x => `${Object.keys(x.route.methods)[0].toUpperCase()} ${x.route.path}`);
  for (const expected of ['POST /jobs', 'GET /jobs', 'GET /jobs/:id', 'POST /jobs/:id/retry', 'POST /scan']) assert.ok(paths.includes(expected));

  // Production handler: only deterministic runtime_finish audit data is replayed.
  db.prepare("INSERT INTO runtime_runs(run_id,enterprise_id,component_id,component_type,task_type,started_at,execution_status,verification_status,execution_mode,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run('audit-run', enterprise, 'audit', 'SKILL', 'audit', stamp, 'RUNNING', 'NOT_VERIFIED', 'DETERMINISTIC_RULE', stamp);
  db.prepare("INSERT INTO audit_retry_queue(id,enterprise_id,run_id,event_type,payload,status,retry_count,last_error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run('queue-finish', enterprise, 'audit-run', 'runtime_finish', JSON.stringify({ execution_status: 'FAILED', verification_status: 'UNKNOWN', error_code: 'audit_write_failed' }), 'PENDING_RETRY', 0, '', stamp, stamp);
  const production = service.createFromAuditQueue({ enterpriseId: enterprise, queueId: 'queue-finish' }); assert.equal(run(production.job).status, STATES.SUCCEEDED); assert.equal(db.prepare('SELECT status FROM audit_retry_queue WHERE id=?').get('queue-finish').status, 'RECORDED');

  // Reality / SQLite integration: durable failed run, situation evidence changes, then verified success; both attempts persist.
  const flow = service.create({ enterpriseId: enterprise, handlerType: 'controlled', payload: { mode: 'recoverable', input: { reference: 'safe-controlled-record' }, dependency_state: 'offline' }, idempotencyKey: 'reality-flow' });
  const first = run(flow.job); assert.equal(first.status, STATES.RETRY_SCHEDULED); assert.equal(first.execution_status, 'FAILED');
  // RETRY_SCHEDULED only becomes CLAIMED when due; the atomic claim then uses
  // the state-machine transition to RUNNING inside process().
  assert.equal(service.claimNext('too-early', enterprise), null);
  const changedPayload = { ...flow.job.payload, evidence_version: 'dependency-restored', dependency_state: 'online' }; db.prepare('UPDATE audit_recovery_jobs SET payload=?,next_retry_at=? WHERE id=?').run(JSON.stringify(changedPayload), new Date(Date.now() - 1).toISOString(), flow.job.id);
  const success = run(flow.job); assert.equal(success.status, STATES.SUCCEEDED); assert.equal(success.verification_status, 'VERIFIED'); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit_recovery_effects WHERE idempotency_key=?').get('reality-flow').n, 1);
  const trace = service.details(flow.job.id, enterprise); assert.equal(trace.attempts.length, 2); assert.equal(trace.attempts[0].execution_status, 'FAILED'); assert.equal(trace.attempts[1].verification_status, 'VERIFIED');
  assert.throws(() => service.details(flow.job.id, 'other-enterprise'), /无权访问/);

  // Idempotency: successful business key returns prior result; no second effect.
  const again = service.create({ enterpriseId: enterprise, handlerType: 'controlled', payload: {}, idempotencyKey: 'reality-flow' }); assert.equal(again.reused, true); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit_recovery_effects WHERE idempotency_key=?').get('reality-flow').n, 1);

  // UNKNOWN never auto-retries, and verification failure cannot become success.
  const unknown = service.create({ enterpriseId: enterprise, handlerType: 'controlled', payload: { mode: 'unknown' }, idempotencyKey: 'unknown-key' }); assert.equal(run(unknown.job).status, STATES.UNKNOWN); assert.equal(service.runOnce('worker-2', enterprise), null);
  const verifyFail = service.create({ enterpriseId: enterprise, handlerType: 'controlled', payload: { mode: 'verify_fail' }, idempotencyKey: 'verify-key', maxAttempts: 1 }); assert.equal(run(verifyFail.job).status, STATES.DEAD); assert.equal(service.details(verifyFail.job.id, enterprise).attempts[0].execution_status, 'SUCCESS');

  // Same evidence/error has no mechanical retry and produces an immutable NO_PROGRESS trace.
  const stagnant = service.create({ enterpriseId: enterprise, handlerType: 'controlled', payload: { mode: 'no_progress', dependency_state: 'same' }, idempotencyKey: 'stagnant-key', maxAttempts: 5 }); assert.equal(run(stagnant.job).status, STATES.RETRY_SCHEDULED); due(stagnant.job.id); assert.equal(run(stagnant.job).status, STATES.RETRY_SCHEDULED); due(stagnant.job.id); const stopped = run(stagnant.job); assert.equal(stopped.status, STATES.DEAD); assert.ok(service.details(stagnant.job.id, enterprise).events.some(event => event.event_type === 'NO_PROGRESS'));
  db.prepare('DELETE FROM audit_recovery_circuits WHERE enterprise_id=? AND handler_type=?').run(enterprise, 'controlled');

  // Atomic claim / fencing: only one claimant can process a row and stale token cannot finalize it.
  const claimed = service.create({ enterpriseId: enterprise, handlerType: 'controlled', payload: { evidence_version: 'ready' }, idempotencyKey: 'claim-key' }); const one = service.claimNext('claim-a', enterprise); const two = service.claimNext('claim-b', enterprise); assert.equal(one.id, claimed.job.id); assert.equal(two, null); const stale = { ...one, claim_token: 'stale', status: 'RUNNING' }; assert.throws(() => service.transition(stale, STATES.SUCCEEDED), /Claim Token/);
  // let lease expire and verify safe re-claim instead of a fabricated business failure.
  db.prepare('UPDATE audit_recovery_jobs SET lease_expires_at=? WHERE id=?').run(new Date(Date.now() - 1000).toISOString(), one.id); assert.equal(service.reclaimExpiredLeases(), 1); assert.equal(run(claimed.job).status, STATES.SUCCEEDED);

  // Circuit is isolated by handler/enterprise and has OPEN -> HALF_OPEN -> CLOSED recovery.
  const circuitService = new AuditRecoveryService({ handlers, leaseMs: 5, maxNoProgress: 2, circuitThreshold: 3, circuitCooldownMs: 1 });
  for (let i = 0; i < 3; i += 1) { const item = circuitService.create({ enterpriseId: circuitEnterprise, handlerType: 'controlled', payload: { mode: 'no_progress', marker: i }, idempotencyKey: `circuit-${i}`, maxAttempts: 1 }); circuitService.runOnce(`circuit-${i}`, circuitEnterprise); }
  assert.equal(circuitService.circuit(circuitEnterprise, 'controlled').status, 'OPEN');
  const blocked = circuitService.create({ enterpriseId: circuitEnterprise, handlerType: 'controlled', payload: { evidence_version: 'ready' }, idempotencyKey: 'circuit-blocked' }); assert.equal(circuitService.runOnce('blocked-worker', circuitEnterprise), null); assert.ok(circuitService.details(blocked.job.id, circuitEnterprise).events.some(event => event.event_type === 'CIRCUIT_BLOCKED'));
  db.prepare('UPDATE audit_recovery_circuits SET cooldown_until=? WHERE enterprise_id=? AND handler_type=?').run(new Date(Date.now() - 1).toISOString(), circuitEnterprise, 'controlled'); assert.equal(circuitService.runOnce('half-open-worker', circuitEnterprise).status, STATES.SUCCEEDED); assert.equal(circuitService.circuit(circuitEnterprise, 'controlled').status, 'CLOSED');

  // Budget / watchdog / manual retry permissions.
  const budget = service.create({ enterpriseId: enterprise, handlerType: 'controlled', payload: { mode: 'no_progress', marker: 'budget' }, idempotencyKey: 'budget', maxAttempts: 1 }); assert.equal(run(budget.job).status, STATES.DEAD);
  const expiredBudget = service.create({ enterpriseId: enterprise, handlerType: 'controlled', payload: { evidence_version: 'ready' }, idempotencyKey: 'expired-budget' }); db.prepare('UPDATE audit_recovery_jobs SET recovery_deadline_at=? WHERE id=?').run(new Date(Date.now() - 1).toISOString(), expiredBudget.job.id); assert.equal(run(expiredBudget.job).status, STATES.DEAD);
  service.heartbeat('dead-worker', 'RUNNING', budget.job.id); db.prepare('UPDATE audit_recovery_workers SET heartbeat_at=? WHERE worker_id=?').run(new Date(Date.now() - 100000).toISOString(), 'dead-worker'); assert.ok(service.watchdog({ staleMs: 1 }).staleWorkers.includes('dead-worker'));
  assert.throws(() => service.manualRetry({ enterpriseId: enterprise, jobId: budget.job.id, actor: { isAdmin: false }, reason: 'fix' }), /仅管理员/);
  assert.throws(() => service.manualRetry({ enterpriseId: enterprise, jobId: budget.job.id, actor: { isAdmin: true }, reason: '' }), /必须填写原因/);
  const manual = service.manualRetry({ enterpriseId: enterprise, jobId: budget.job.id, actor: { isAdmin: true }, reason: 'new evidence' }); assert.notEqual(manual.job.id, budget.job.id);
  const user = { id: 'admin', enterprise_id: enterprise, role: '企业管理员' }; const bad = invoke(controller.retry, { user: { ...user, role: '普通用户' }, params: { id: budget.job.id }, body: { reason: 'x' } }); assert.equal(bad.status, 403);
} finally { await new Promise(resolve => setTimeout(resolve, 100)); db.close(); fs.rmSync(root, { recursive: true, force: true }); }
console.log('audit recovery worker persistence, retry safety, verification, circuit, watchdog, permissions and controlled SQLite integration tests passed');
