'use strict';

const fs = require('node:fs');
const path = require('node:path');
const db = require('../database/client');
const env = require('../config/env');

const TERMINAL_STATES = new Set(['AUTHORITY_DENIED', 'PREFLIGHT_REJECTED', 'OUTCOME_RECORDED', 'TERMINAL_FAILURE']);
const NON_TERMINAL_STATES = new Set(['CREATED', 'PREFLIGHT_PASSED', 'EXECUTION_PENDING', 'EXECUTING', 'READBACK_REQUIRED', 'EVIDENCE_PENDING', 'VERIFICATION_PENDING']);

function safeParse(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function tableExists(database, tableName) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName));
}

function columnExists(database, tableName, columnName) {
  if (!tableExists(database, tableName)) return false;
  return database.prepare(`PRAGMA table_info(${tableName})`).all().some(column => column.name === columnName);
}

function count(database, tableName, where = '', params = []) {
  if (!tableExists(database, tableName)) return 0;
  return database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}${where ? ` WHERE ${where}` : ''}`).get(...params).count;
}

function scopedWhere(database, tableName, enterpriseId, prefix = 'WHERE') {
  if (!enterpriseId || !columnExists(database, tableName, 'enterprise_id')) return { sql: '', params: [] };
  return { sql: `${prefix} enterprise_id=?`, params: [enterpriseId] };
}

function normalizeEffectCertainty(value) {
  if (value === 'OBSERVED') return 'KNOWN_OCCURRED';
  if (value === 'NOT_OCCURRED') return 'KNOWN_NOT_OCCURRED';
  if (value === 'UNKNOWN') return 'UNKNOWN';
  return value || 'UNKNOWN';
}

function normalizeRun(row = {}) {
  const recovery = safeParse(row.recovery_state, {});
  return {
    run_id: row.run_id,
    mission_id: row.mission_id || 'NOT_AVAILABLE',
    task_id: row.task_id || 'NOT_AVAILABLE',
    trace_id: row.trace_id || 'NOT_AVAILABLE',
    lifecycle: row.lifecycle_state || 'NOT_AVAILABLE',
    previous_state: row.previous_state || 'NOT_AVAILABLE',
    revision: Number(row.revision || 0),
    checkpoint_sequence: Number(row.checkpoint_sequence || 0),
    effect_certainty: normalizeEffectCertainty(row.effect_certainty),
    raw_effect_certainty: row.effect_certainty || 'UNKNOWN',
    capability_id: row.capability_id || 'NOT_AVAILABLE',
    attempt_count: Number(row.attempt_count || 0),
    evidence_count: Number(row.evidence_count || 0),
    verification_count: Number(row.verification_count || 0),
    recovery_count: Number(row.recovery_count || 0),
    verification_state: row.verification_state || 'PENDING',
    recovery_state: recovery?.status || row.recovery_case_state || 'NOT_AVAILABLE',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
    identity: {
      actor: safeParse(row.actor_identity_ref, null) || 'REFERENCE_ONLY',
      principal: safeParse(row.principal_ref, null) || 'REFERENCE_ONLY',
      represented_principal: safeParse(row.represented_principal_ref, null) || 'REFERENCE_ONLY',
    },
    authority: safeParse(row.authority_ref, null) || 'REFERENCE_ONLY',
    expected_actual: 'NOT_AVAILABLE_FOR_THIS_RUN',
  };
}

function listRuns(database = db, enterpriseId, limit = 25) {
  database = database || db;
  if (!tableExists(database, 'realityos_kernel_runs')) return [];
  const scoped = scopedWhere(database, 'realityos_kernel_runs', enterpriseId);
  const attemptCount = tableExists(database, 'realityos_kernel_attempts')
    ? '(SELECT COUNT(*) FROM realityos_kernel_attempts a WHERE a.run_id=r.run_id)'
    : '0';
  const evidenceCount = tableExists(database, 'realityos_evidence_receipts')
    ? '(SELECT COUNT(*) FROM realityos_evidence_receipts e WHERE e.run_id=r.run_id)'
    : '0';
  const verificationCount = tableExists(database, 'realityos_verification_cases')
    ? '(SELECT COUNT(*) FROM realityos_verification_cases v WHERE v.run_id=r.run_id)'
    : '0';
  const recoveryCount = tableExists(database, 'realityos_recovery_cases')
    ? '(SELECT COUNT(*) FROM realityos_recovery_cases c WHERE c.run_id=r.run_id)'
    : '0';
  const recoveryState = tableExists(database, 'realityos_recovery_cases')
    ? '(SELECT c.recovery_state FROM realityos_recovery_cases c WHERE c.run_id=r.run_id ORDER BY c.updated_at DESC LIMIT 1)'
    : "'NOT_AVAILABLE'";
  return database.prepare(`
    SELECT r.*,
      ${attemptCount} AS attempt_count,
      ${evidenceCount} AS evidence_count,
      ${verificationCount} AS verification_count,
      ${recoveryCount} AS recovery_count,
      ${recoveryState} AS recovery_case_state
    FROM realityos_kernel_runs r
    ${scoped.sql}
    ORDER BY r.updated_at DESC
    LIMIT ?`).all(...scoped.params, Math.min(100, Math.max(1, Number(limit || 25)))).map(normalizeRun);
}

function loadRun(database = db, runId, enterpriseId) {
  database = database || db;
  if (!tableExists(database, 'realityos_kernel_runs')) return null;
  const scoped = enterpriseId && columnExists(database, 'realityos_kernel_runs', 'enterprise_id') ? ' AND enterprise_id=?' : '';
  const params = enterpriseId ? [runId, enterpriseId] : [runId];
  const row = database.prepare(`SELECT * FROM realityos_kernel_runs WHERE run_id=?${scoped}`).get(...params);
  if (!row) return null;
  const run = normalizeRun(row);
  const scope = enterpriseId ? ' AND enterprise_id=?' : '';
  const detailParams = enterpriseId ? [runId, enterpriseId] : [runId];
  const transitions = tableExists(database, 'realityos_kernel_transitions')
    ? database.prepare(`SELECT transition_id,run_id,from_state,to_state,revision_before,revision_after,checkpoint_sequence,phase,reason,evidence_refs,created_at FROM realityos_kernel_transitions WHERE run_id=?${scope} ORDER BY revision_after`).all(...detailParams)
      .map(item => ({ ...item, evidence_refs: safeParse(item.evidence_refs, []) }))
    : [];
  const evidence = tableExists(database, 'realityos_evidence_receipts')
    ? database.prepare(`SELECT evidence_id,owner,schema_version,evidence_type,source_ref,provenance_ref,run_id,attempt_id,revision,payload_ref,payload_hash,integrity_ref,integrity_status,created_at FROM realityos_evidence_receipts WHERE run_id=?${scope} ORDER BY created_at`).all(...detailParams)
      .map(item => ({ ...item, source_ref: safeParse(item.source_ref, {}), provenance_ref: safeParse(item.provenance_ref, {}), payload_ref: safeParse(item.payload_ref, {}), payload: 'REFERENCE / METADATA' }))
    : [];
  const verification = tableExists(database, 'realityos_verification_cases')
    ? database.prepare(`SELECT verification_id,owner,schema_version,run_id,attempt_id,revision,evidence_refs,verifier_ref,verification_policy_ref,status,decision,reason_ref,created_at,updated_at FROM realityos_verification_cases WHERE run_id=?${scope} ORDER BY updated_at`).all(...detailParams)
      .map(item => ({ ...item, evidence_refs: safeParse(item.evidence_refs, []), verifier_ref: safeParse(item.verifier_ref, {}), verification_policy_ref: safeParse(item.verification_policy_ref, {}), reason_ref: safeParse(item.reason_ref, {}) }))
    : [];
  const recovery = tableExists(database, 'realityos_recovery_cases')
    ? database.prepare(`SELECT recovery_case_id,owner,schema_version,run_id,attempt_id,revision,originating_failure_ref,effect_certainty,evidence_refs,verification_ref,recovery_state,retry_eligibility,reauthorization_required,human_control_required,compensation_ref,final_resolution,history,created_at,updated_at FROM realityos_recovery_cases WHERE run_id=?${scope} ORDER BY updated_at`).all(...detailParams)
      .map(item => ({ ...item, effect_certainty: normalizeEffectCertainty(item.effect_certainty), originating_failure_ref: safeParse(item.originating_failure_ref, {}), evidence_refs: safeParse(item.evidence_refs, []), verification_ref: safeParse(item.verification_ref, {}), reauthorization_required: Boolean(item.reauthorization_required), human_control_required: Boolean(item.human_control_required), compensation_ref: safeParse(item.compensation_ref, {}), history: safeParse(item.history, []), automated_recovery_execution: 'NOT_READY' }))
    : [];
  const attempts = tableExists(database, 'realityos_kernel_attempts')
    ? database.prepare(`SELECT attempt_id,run_id,attempt_no,lifecycle_state,dispatch_started,effect_certainty,status,started_at,finished_at,evidence_refs,created_at FROM realityos_kernel_attempts WHERE run_id=?${scope} ORDER BY attempt_no`).all(...detailParams)
      .map(item => ({ ...item, effect_certainty: normalizeEffectCertainty(item.effect_certainty), evidence_refs: safeParse(item.evidence_refs, []) }))
    : [];
  return {
    run,
    attempts,
    transitions,
    evidence,
    verification,
    recovery,
    effect_reality: {
      certainty: run.effect_certainty,
      message: run.effect_certainty === 'UNKNOWN' ? 'Reality not yet established' : 'Reality state is based on durable runtime data',
      resume_admission: run.effect_certainty === 'UNKNOWN' ? 'READBACK_FIRST' : 'VERIFY_FIRST',
    },
    expected_actual: run.expected_actual,
  };
}

function tableHealth(database) {
  return {
    kernel_runs: tableExists(database, 'realityos_kernel_runs') ? 'AVAILABLE' : 'NOT_AVAILABLE',
    kernel_attempts: tableExists(database, 'realityos_kernel_attempts') ? 'AVAILABLE' : 'NOT_AVAILABLE',
    kernel_transitions: tableExists(database, 'realityos_kernel_transitions') ? 'AVAILABLE' : 'NOT_AVAILABLE',
    evidence_receipts: tableExists(database, 'realityos_evidence_receipts') ? 'AVAILABLE' : 'NOT_AVAILABLE',
    verification_cases: tableExists(database, 'realityos_verification_cases') ? 'AVAILABLE' : 'NOT_AVAILABLE',
    recovery_cases: tableExists(database, 'realityos_recovery_cases') ? 'AVAILABLE' : 'NOT_AVAILABLE',
    database_path_present: Boolean(env.dbPath),
    database_file_present: Boolean(env.dbPath && fs.existsSync(env.dbPath)),
    database_directory: env.dbPath ? path.dirname(env.dbPath) : 'NOT_AVAILABLE',
  };
}

function getSummary(options = {}) {
  const database = options.db || db;
  const enterpriseId = String(options.enterpriseId || '');
  const runsScope = scopedWhere(database, 'realityos_kernel_runs', enterpriseId);
  const evidenceScope = scopedWhere(database, 'realityos_evidence_receipts', enterpriseId);
  const verificationScope = scopedWhere(database, 'realityos_verification_cases', enterpriseId);
  const recoveryScope = scopedWhere(database, 'realityos_recovery_cases', enterpriseId);
  const activeRuns = count(database, 'realityos_kernel_runs', `${runsScope.sql ? 'enterprise_id=? AND ' : ''}lifecycle_state NOT IN (${[...TERMINAL_STATES].map(() => '?').join(',')})`, [...runsScope.params, ...TERMINAL_STATES]);
  const nonTerminalRuns = count(database, 'realityos_kernel_runs', `${runsScope.sql ? 'enterprise_id=? AND ' : ''}lifecycle_state IN (${[...NON_TERMINAL_STATES].map(() => '?').join(',')})`, [...runsScope.params, ...NON_TERMINAL_STATES]);
  const verificationPending = count(database, 'realityos_verification_cases', `${verificationScope.sql ? 'enterprise_id=? AND ' : ''}status='PENDING'`, verificationScope.params);
  const effectUnknown = count(database, 'realityos_kernel_runs', `${runsScope.sql ? 'enterprise_id=? AND ' : ''}effect_certainty='UNKNOWN'`, runsScope.params);
  const recoveryRequired = count(database, 'realityos_recovery_cases', `${recoveryScope.sql ? 'enterprise_id=? AND ' : ''}recovery_state IN ('REQUIRED','ADMISSION_REQUIRED','HUMAN_REQUIRED','UNRESOLVED')`, recoveryScope.params);
  const failedOrBlocked = count(database, 'realityos_kernel_runs', `${runsScope.sql ? 'enterprise_id=? AND ' : ''}lifecycle_state IN ('AUTHORITY_DENIED','PREFLIGHT_REJECTED','TERMINAL_FAILURE')`, runsScope.params);
  const evidenceReceiptCount = count(database, 'realityos_evidence_receipts', evidenceScope.sql.replace(/^WHERE /, ''), evidenceScope.params);
  const governedDashboardRuns = count(database, 'realityos_kernel_runs', `${runsScope.sql ? 'enterprise_id=? AND ' : ''}capability_id='capability.dashboard.read_status'`, runsScope.params);
  return {
    status: {
      active_runs: activeRuns,
      non_terminal_runs: nonTerminalRuns,
      verification_pending: verificationPending,
      effect_unknown: effectUnknown,
      recovery_required: recoveryRequired,
      evidence_receipt_count: evidenceReceiptCount,
      failed_blocked_runs: failedOrBlocked,
      durable_store_health: tableHealth(database),
    },
    proof_levels: {
      kernel_run_durability: tableExists(database, 'realityos_kernel_runs') ? 'DURABLE_VERIFIED' : 'NOT_AVAILABLE',
      evidence_durability: tableExists(database, 'realityos_evidence_receipts') ? 'DURABLE_VERIFIED' : 'NOT_AVAILABLE',
      verification_durability: tableExists(database, 'realityos_verification_cases') ? 'DURABLE_VERIFIED' : 'NOT_AVAILABLE',
      recovery_linkage: tableExists(database, 'realityos_recovery_cases') ? 'DURABLE_VERIFIED' : 'NOT_AVAILABLE',
      jev_adapter: fs.existsSync(path.join(process.cwd(), 'services', 'jevEffectClassificationProvider.js')) ? 'REFERENCE/RUNTIME CONTRACT VERIFIED' : 'NOT_AVAILABLE',
      real_jev_runtime: 'NOT_INTEGRATED',
      enterprise_identity: 'PARTIAL',
      organization: 'PARTIAL',
      represented_principal: 'REFERENCE_ONLY',
      delegation: 'NOT_IMPLEMENTED',
      authority: 'REFERENCE_ONLY',
      human_control_runtime: 'NOT_READY',
      product_migration: 'CONTROL_PLANE_READ_ONLY',
      production_ready: 'NO',
      enterprise_pilot_ready: 'NO',
    },
    jev: {
      adapter: 'VERIFIED',
      real_provider: 'NOT_INTEGRATED',
      production_claim: 'NOT_CLAIMED',
    },
    first_read_only_path: {
      status: governedDashboardRuns > 0 ? 'VERIFIED' : 'NOT_YET_INTEGRATED',
      path: 'GET /api/dashboard',
      capability_id: 'capability.dashboard.read_status',
      effect: 'OBSERVATION',
      run_count: governedDashboardRuns,
      reason: governedDashboardRuns > 0
        ? 'Existing dashboard read-only path has produced durable Kernel Run + Evidence + Verification records.'
        : 'No governed dashboard product run has been observed yet.',
    },
  };
}

function getControlPlane(options = {}) {
  const database = options.db || db;
  const enterpriseId = String(options.enterpriseId || '');
  const summary = getSummary({ db: database, enterpriseId });
  const runs = listRuns(database, enterpriseId, options.limit);
  return {
    surface: 'PRODUCTION_VISIBLE_RUNTIME_SURFACE',
    mode: 'READ_ONLY',
    source: 'CANONICAL_DURABLE_STORES',
    parallel_truth_store: false,
    mock_data_used: false,
    fake_runtime_state_used: false,
    mutating_product_path_migrated: false,
    enterprise_id_scope: enterpriseId || 'NOT_AVAILABLE',
    ...summary,
    runs,
    zero_data_state: runs.length ? 'HAS_GOVERNED_RUNS' : 'NO_GOVERNED_RUNS_YET',
  };
}

module.exports = {
  getControlPlane,
  getSummary,
  loadRun,
  listRuns,
  normalizeEffectCertainty,
  tableExists,
};
