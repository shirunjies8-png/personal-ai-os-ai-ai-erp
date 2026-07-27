const { v4: uuid } = require('uuid');
const db = require('../database/client');

const EXECUTION = new Set(['QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'TIMEOUT', 'CANCELLED', 'BLOCKED']);
const VERIFICATION = new Set(['NOT_VERIFIED', 'VERIFIED', 'HUMAN_REVIEW_REQUIRED', 'FAILED_VERIFICATION', 'UNKNOWN']);
const MODES = new Set(['REAL_MODEL', 'LOCAL_RUNTIME', 'DETERMINISTIC_RULE', 'MOCK', 'NOT_CONFIGURED', 'DEMO_ONLY']);
const TYPES = new Set(['AGENT', 'SKILL', 'PROVIDER', 'LOCAL_RUNTIME']);
const iso = () => new Date().toISOString();
const clean = value => String(value || '').replace(/(bearer\s+|api[_-]?key\s*[=:]\s*)[^\s,;]+/ig, '$1[REDACTED]').slice(0, 500);

function init() {
  db.exec(`CREATE TABLE IF NOT EXISTS runtime_components (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, version TEXT DEFAULT '', execution_mode TEXT NOT NULL,
    provider TEXT DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, health_status TEXT DEFAULT 'UNKNOWN', last_run_at TEXT DEFAULT '',
    last_success_at TEXT DEFAULT '', last_failure_at TEXT DEFAULT '', success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0, timeout_count INTEGER NOT NULL DEFAULT 0, average_duration_ms REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS runtime_runs (
    run_id TEXT PRIMARY KEY, enterprise_id TEXT NOT NULL, user_id TEXT DEFAULT '', component_id TEXT NOT NULL,
    component_type TEXT NOT NULL, task_type TEXT NOT NULL, trigger_source TEXT DEFAULT '', request_id TEXT DEFAULT '',
    parent_run_id TEXT DEFAULT '', started_at TEXT NOT NULL, finished_at TEXT DEFAULT '', duration_ms INTEGER NOT NULL DEFAULT 0,
    execution_status TEXT NOT NULL, verification_status TEXT NOT NULL, provider TEXT DEFAULT '', runtime_or_model TEXT DEFAULT '',
    execution_mode TEXT NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0, error_code TEXT DEFAULT '', error_message TEXT DEFAULT '',
    input_summary TEXT DEFAULT '', observability_status TEXT NOT NULL DEFAULT 'RECORDED', created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_runtime_runs_enterprise ON runtime_runs(enterprise_id, created_at);`);
}
init();

function registerDefaults({ deepseekConfigured = false } = {}) {
  return [
    register({ id: 'ocr-current', name: 'OCR · Tesseract 当前运行时', type: 'LOCAL_RUNTIME', version: '6', execution_mode: 'LOCAL_RUNTIME', provider: 'Tesseract.js', health_status: 'UNKNOWN' }),
    register({ id: 'ocr-mock', name: 'OCR · 演示 Provider', type: 'PROVIDER', version: '1', execution_mode: 'MOCK', provider: 'mock', health_status: 'DEMO_ONLY' }),
    register({ id: 'agent-runtime', name: 'Agent Runtime', type: 'AGENT', version: '1', execution_mode: 'DETERMINISTIC_RULE', provider: 'agentRuntimeService', health_status: 'UNKNOWN' }),
    register({ id: 'tool-registry', name: 'Tool Registry', type: 'SKILL', version: '1', execution_mode: 'DETERMINISTIC_RULE', provider: 'toolRegistry', health_status: 'UNKNOWN' }),
    register({ id: 'deepseek-gateway', name: 'DeepSeek 安全网关', type: 'PROVIDER', version: '1', execution_mode: deepseekConfigured ? 'REAL_MODEL' : 'NOT_CONFIGURED', provider: 'DeepSeek', enabled: deepseekConfigured, health_status: deepseekConfigured ? 'UNKNOWN' : 'NOT_CONFIGURED' })
  ];
}

function register(input = {}) {
  const id = String(input.id || 'unknown'); const now = iso();
  const type = TYPES.has(input.type) ? input.type : 'SKILL'; const mode = MODES.has(input.execution_mode) ? input.execution_mode : 'NOT_CONFIGURED';
  db.prepare(`INSERT INTO runtime_components (id,name,type,version,execution_mode,provider,enabled,health_status,updated_at)
    VALUES (@id,@name,@type,@version,@execution_mode,@provider,@enabled,@health_status,@updated_at)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,version=excluded.version,execution_mode=excluded.execution_mode,provider=excluded.provider,enabled=excluded.enabled,health_status=excluded.health_status,updated_at=excluded.updated_at`).run({ id, name: String(input.name || id), type, version: String(input.version || '1'), execution_mode: mode, provider: String(input.provider || ''), enabled: input.enabled === false ? 0 : 1, health_status: String(input.health_status || 'UNKNOWN'), updated_at: now });
  return db.prepare('SELECT * FROM runtime_components WHERE id=?').get(id);
}

function start(input = {}) {
  const now = iso(); const run = { run_id: String(input.run_id || uuid()), enterprise_id: String(input.enterprise_id || ''), user_id: String(input.user_id || ''), component_id: String(input.component_id), component_type: String(input.component_type || 'SKILL'), task_type: String(input.task_type || ''), trigger_source: String(input.trigger_source || 'ui'), request_id: String(input.request_id || ''), parent_run_id: String(input.parent_run_id || ''), started_at: now, finished_at: '', duration_ms: 0, execution_status: 'RUNNING', verification_status: 'NOT_VERIFIED', provider: String(input.provider || ''), runtime_or_model: String(input.runtime_or_model || ''), execution_mode: MODES.has(input.execution_mode) ? input.execution_mode : 'LOCAL_RUNTIME', retry_count: Number(input.retry_count || 0), error_code: '', error_message: '', input_summary: clean(input.input_summary), observability_status: 'RECORDED', created_at: now };
  db.prepare(`INSERT INTO runtime_runs (${Object.keys(run).join(',')}) VALUES (${Object.keys(run).map(k => '@' + k).join(',')})`).run(run); return run;
}

function finish(runId, patch = {}) {
  const run = db.prepare('SELECT * FROM runtime_runs WHERE run_id=?').get(runId); if (!run) return null;
  const ended = Date.now(); const duration = Math.max(0, ended - Date.parse(run.started_at));
  const execution = EXECUTION.has(patch.execution_status) ? patch.execution_status : 'FAILED';
  const verification = VERIFICATION.has(patch.verification_status) ? patch.verification_status : 'UNKNOWN';
  db.prepare(`UPDATE runtime_runs SET finished_at=?,duration_ms=?,execution_status=?,verification_status=?,error_code=?,error_message=?,observability_status=? WHERE run_id=?`).run(iso(), duration, execution, verification, String(patch.error_code || ''), clean(patch.error_message), String(patch.observability_status || 'RECORDED'), runId);
  const component = db.prepare('SELECT * FROM runtime_components WHERE id=?').get(run.component_id);
  if (component) { const success = execution === 'SUCCESS' || execution === 'PARTIAL'; const count = Number(component.success_count + component.failure_count + 1); const avg = ((Number(component.average_duration_ms) * (count - 1)) + duration) / count; db.prepare(`UPDATE runtime_components SET last_run_at=?,last_success_at=CASE WHEN ? THEN ? ELSE last_success_at END,last_failure_at=CASE WHEN ? THEN ? ELSE last_failure_at END,success_count=success_count+?,failure_count=failure_count+?,timeout_count=timeout_count+?,average_duration_ms=?,health_status=?,updated_at=? WHERE id=?`).run(iso(), success ? 1 : 0, iso(), success ? 0 : 1, iso(), success ? 1 : 0, success ? 0 : 1, execution === 'TIMEOUT' ? 1 : 0, avg, execution === 'SUCCESS' ? 'HEALTHY' : execution, iso(), run.component_id); }
  return db.prepare('SELECT * FROM runtime_runs WHERE run_id=?').get(runId);
}
function list(enterpriseId, limit = 100) { return db.prepare('SELECT * FROM runtime_runs WHERE enterprise_id=? ORDER BY created_at DESC LIMIT ?').all(enterpriseId, Math.min(200, Number(limit || 100))); }
function components() { return db.prepare('SELECT * FROM runtime_components ORDER BY name').all(); }
module.exports = { EXECUTION, VERIFICATION, MODES, TYPES, register, registerDefaults, start, finish, list, components };
