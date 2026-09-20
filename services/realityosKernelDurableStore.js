'use strict';

const crypto = require('node:crypto');
const W2 = require('./realityosKernelDurabilityContract');

const STORE_SCHEMA_VERSION = 1;
const TERMINAL_STATES = new Set(['AUTHORITY_DENIED', 'PREFLIGHT_REJECTED', 'OUTCOME_RECORDED', 'TERMINAL_FAILURE']);

function nowIso(clock) {
  const value = typeof clock === 'function' ? clock() : new Date();
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function parse(value, fallback = null) {
  if (value == null || value === '') return fallback;
  return JSON.parse(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(json(value)).digest('hex');
}

function enterpriseId(envelope) {
  return String(envelope.organization_context?.enterprise_id || envelope.represented_principal?.id || '');
}

function ensureSchema(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS realityos_kernel_runs (
  run_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  enterprise_id TEXT NOT NULL,
  workspace_id TEXT DEFAULT '',
  mission_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  previous_state TEXT DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0,
  checkpoint_sequence INTEGER NOT NULL DEFAULT 0,
  effect_capable INTEGER NOT NULL DEFAULT 0,
  dispatch_started INTEGER NOT NULL DEFAULT 0,
  effect_certainty TEXT NOT NULL,
  actor_identity_ref TEXT NOT NULL DEFAULT '{}',
  principal_ref TEXT NOT NULL DEFAULT '{}',
  represented_principal_ref TEXT NOT NULL DEFAULT '{}',
  authority_ref TEXT DEFAULT '{}',
  lease_ref TEXT DEFAULT '{}',
  capability_id TEXT NOT NULL,
  agent_ref TEXT DEFAULT '{}',
  executor_ref TEXT DEFAULT '{}',
  tool_ref TEXT DEFAULT '{}',
  execution_intent_identity TEXT NOT NULL,
  effect_operation_id TEXT NOT NULL,
  idempotency_ref TEXT NOT NULL,
  intent_digest TEXT NOT NULL,
  evidence_refs TEXT NOT NULL DEFAULT '[]',
  verification_state TEXT NOT NULL DEFAULT 'PENDING',
  recovery_state TEXT NOT NULL DEFAULT '{}',
  human_control_required INTEGER NOT NULL DEFAULT 0,
  envelope_snapshot TEXT NOT NULL,
  envelope_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_realityos_kernel_runs_enterprise_state
  ON realityos_kernel_runs(enterprise_id, lifecycle_state, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_realityos_kernel_runs_operation
  ON realityos_kernel_runs(enterprise_id, effect_operation_id, idempotency_ref);

CREATE TABLE IF NOT EXISTS realityos_kernel_attempts (
  attempt_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  enterprise_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  lifecycle_state TEXT NOT NULL,
  dispatch_started INTEGER NOT NULL DEFAULT 0,
  effect_certainty TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECORDED',
  started_at TEXT DEFAULT '',
  finished_at TEXT DEFAULT '',
  evidence_refs TEXT NOT NULL DEFAULT '[]',
  attempt_snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES realityos_kernel_runs(run_id) ON DELETE CASCADE,
  UNIQUE(run_id, attempt_no)
);
CREATE INDEX IF NOT EXISTS idx_realityos_kernel_attempts_run
  ON realityos_kernel_attempts(run_id, attempt_no);

CREATE TABLE IF NOT EXISTS realityos_kernel_transitions (
  transition_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  enterprise_id TEXT NOT NULL,
  from_state TEXT DEFAULT '',
  to_state TEXT NOT NULL,
  revision_before INTEGER NOT NULL,
  revision_after INTEGER NOT NULL,
  checkpoint_sequence INTEGER NOT NULL,
  phase TEXT NOT NULL,
  reason TEXT DEFAULT '',
  evidence_refs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES realityos_kernel_runs(run_id) ON DELETE CASCADE,
  UNIQUE(run_id, revision_after)
);
CREATE INDEX IF NOT EXISTS idx_realityos_kernel_transitions_run
  ON realityos_kernel_transitions(run_id, revision_after);
`);
}

function rowFromEnvelope(envelope, clock) {
  const validation = W2.validateEnvelope(envelope, { mode: 'durable' });
  if (!validation.valid) {
    const error = new Error('Durable envelope is invalid');
    error.code = 'DURABLE_ENVELOPE_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  const durability = envelope.durability;
  const timestamp = nowIso(clock);
  const history = Array.isArray(envelope.state_history) ? envelope.state_history : [];
  const previous = history.length > 1 ? String(history[history.length - 2]?.state || '') : '';
  const effectCapable = !['OBSERVATION', 'LOCAL_TRANSFORM'].includes(String(envelope.effect_declaration?.effectClass || envelope.effect_declaration?.effect_class || 'UNKNOWN'));
  return {
    run_id: durability.run_id,
    schema_version: STORE_SCHEMA_VERSION,
    enterprise_id: enterpriseId(envelope),
    workspace_id: String(envelope.organization_context?.workspace_id || ''),
    mission_id: envelope.mission_id,
    goal_id: envelope.goal_id,
    task_id: envelope.task_id,
    trace_id: envelope.trace_id,
    correlation_id: envelope.correlation_id,
    lifecycle_state: envelope.state,
    previous_state: previous,
    revision: durability.revision,
    checkpoint_sequence: Number(durability.checkpoint_sequence || durability.revision || 0),
    effect_capable: effectCapable ? 1 : 0,
    dispatch_started: durability.dispatch_started ? 1 : 0,
    effect_certainty: durability.effect_certainty,
    actor_identity_ref: json(envelope.actor_identity),
    principal_ref: json(envelope.principal),
    represented_principal_ref: json(envelope.represented_principal),
    authority_ref: json(durability.authority_ref || null),
    lease_ref: json(durability.lease_ref || null),
    capability_id: envelope.capability_id,
    agent_ref: json(envelope.agent),
    executor_ref: json(envelope.executor),
    tool_ref: json(envelope.tool),
    execution_intent_identity: String(envelope.execution_intent?.operation || durability.effect_operation_id),
    effect_operation_id: durability.effect_operation_id,
    idempotency_ref: durability.idempotency_ref,
    intent_digest: durability.intent_digest,
    evidence_refs: json(envelope.evidence_refs || []),
    verification_state: String(envelope.verification_result?.status || 'PENDING'),
    recovery_state: json(envelope.recovery_state || {}),
    human_control_required: durability.human_control_ref || envelope.recovery_state?.status === 'HUMAN_REQUIRED' ? 1 : 0,
    envelope_snapshot: json(envelope),
    envelope_hash: hash(envelope),
    created_at: timestamp,
    updated_at: timestamp,
  };
}

class RealityOSKernelDurableStore {
  constructor(db, options = {}) {
    if (!db || typeof db.prepare !== 'function') throw new Error('A better-sqlite3 compatible database is required');
    this.db = db;
    this.clock = options.clock;
    ensureSchema(db);
  }

  create(envelope) {
    const row = rowFromEnvelope(envelope, this.clock);
    const insert = this.db.prepare(`INSERT INTO realityos_kernel_runs (
      run_id,schema_version,enterprise_id,workspace_id,mission_id,goal_id,task_id,trace_id,correlation_id,lifecycle_state,previous_state,
      revision,checkpoint_sequence,effect_capable,dispatch_started,effect_certainty,actor_identity_ref,principal_ref,represented_principal_ref,
      authority_ref,lease_ref,capability_id,agent_ref,executor_ref,tool_ref,execution_intent_identity,effect_operation_id,idempotency_ref,
      intent_digest,evidence_refs,verification_state,recovery_state,human_control_required,envelope_snapshot,envelope_hash,created_at,updated_at
    ) VALUES (
      @run_id,@schema_version,@enterprise_id,@workspace_id,@mission_id,@goal_id,@task_id,@trace_id,@correlation_id,@lifecycle_state,@previous_state,
      @revision,@checkpoint_sequence,@effect_capable,@dispatch_started,@effect_certainty,@actor_identity_ref,@principal_ref,@represented_principal_ref,
      @authority_ref,@lease_ref,@capability_id,@agent_ref,@executor_ref,@tool_ref,@execution_intent_identity,@effect_operation_id,@idempotency_ref,
      @intent_digest,@evidence_refs,@verification_state,@recovery_state,@human_control_required,@envelope_snapshot,@envelope_hash,@created_at,@updated_at
    )`);
    const createTx = this.db.transaction(() => {
      insert.run(row);
      this._insertTransition(envelope.durability.run_id, envelope, {
        expectedRevision: envelope.durability.revision,
        nextRevision: envelope.durability.revision,
        transitionId: envelope.durability.transition_id,
        phase: envelope.durability.transition_phase,
        reason: 'DURABLE_RUN_CREATED',
      });
    });
    createTx();
    return this.load(envelope.durability.run_id);
  }

  load(runId) {
    const row = this.db.prepare('SELECT * FROM realityos_kernel_runs WHERE run_id=?').get(String(runId || ''));
    if (!row) return null;
    const envelope = parse(row.envelope_snapshot, null);
    return {
      row,
      envelope,
      schemaVersion: row.schema_version,
      revision: row.revision,
      checkpointSequence: row.checkpoint_sequence,
      attempts: this.listAttempts(runId),
      transitions: this.db.prepare('SELECT * FROM realityos_kernel_transitions WHERE run_id=? ORDER BY revision_after').all(runId),
    };
  }

  _updateRunByRevision(runId, expectedRevision, envelope) {
    const row = rowFromEnvelope(envelope, this.clock);
    const result = this.db.prepare(`UPDATE realityos_kernel_runs SET
      schema_version=@schema_version, enterprise_id=@enterprise_id, workspace_id=@workspace_id, mission_id=@mission_id, goal_id=@goal_id,
      task_id=@task_id, trace_id=@trace_id, correlation_id=@correlation_id, lifecycle_state=@lifecycle_state, previous_state=@previous_state,
      revision=@revision, checkpoint_sequence=@checkpoint_sequence, effect_capable=@effect_capable, dispatch_started=@dispatch_started,
      effect_certainty=@effect_certainty, actor_identity_ref=@actor_identity_ref, principal_ref=@principal_ref,
      represented_principal_ref=@represented_principal_ref, authority_ref=@authority_ref, lease_ref=@lease_ref, capability_id=@capability_id,
      agent_ref=@agent_ref, executor_ref=@executor_ref, tool_ref=@tool_ref, execution_intent_identity=@execution_intent_identity,
      effect_operation_id=@effect_operation_id, idempotency_ref=@idempotency_ref, intent_digest=@intent_digest, evidence_refs=@evidence_refs,
      verification_state=@verification_state, recovery_state=@recovery_state, human_control_required=@human_control_required,
      envelope_snapshot=@envelope_snapshot, envelope_hash=@envelope_hash, updated_at=@updated_at
      WHERE run_id=@run_id AND revision=@expected_revision`).run({ ...row, expected_revision: Number(expectedRevision) });
    return { ok: result.changes === 1, reason: result.changes === 1 ? 'UPDATED' : 'REVISION_CONFLICT', revision: row.revision };
  }

  compareAndSet(runId, expectedRevision, envelope) {
    const current = this.db.prepare('SELECT revision FROM realityos_kernel_runs WHERE run_id=?').get(runId);
    if (!current) return { ok: false, reason: 'RUN_NOT_FOUND' };
    if (Number(current.revision) !== Number(expectedRevision)) {
      return { ok: false, reason: 'REVISION_CONFLICT', currentRevision: Number(current.revision) };
    }
    return this._updateRunByRevision(runId, expectedRevision, envelope);
  }

  _insertTransition(runId, envelope, options = {}) {
    const expectedRevision = Number(options.expectedRevision);
    const nextRevision = Number(options.nextRevision ?? envelope.durability?.revision ?? 0);
    const history = Array.isArray(envelope.state_history) ? envelope.state_history : [];
    const previous = history.length > 1 ? String(history[history.length - 2]?.state || '') : '';
    const transition = {
      transition_id: String(options.transitionId || envelope.durability.transition_id || `${runId}:${nextRevision}`),
      run_id: runId,
      enterprise_id: enterpriseId(envelope),
      from_state: previous,
      to_state: envelope.state,
      revision_before: expectedRevision,
      revision_after: nextRevision,
      checkpoint_sequence: Number(envelope.durability.checkpoint_sequence || nextRevision),
      phase: String(options.phase || envelope.durability.transition_phase || 'CHECKPOINT'),
      reason: String(options.reason || ''),
      evidence_refs: json(envelope.evidence_refs || []),
      created_at: nowIso(this.clock),
    };
    this.db.prepare(`INSERT INTO realityos_kernel_transitions (
      transition_id,run_id,enterprise_id,from_state,to_state,revision_before,revision_after,checkpoint_sequence,phase,reason,evidence_refs,created_at
    ) VALUES (
      @transition_id,@run_id,@enterprise_id,@from_state,@to_state,@revision_before,@revision_after,@checkpoint_sequence,@phase,@reason,@evidence_refs,@created_at
    )`).run(transition);
  }

  appendTransition(runId, envelope, options = {}) {
    const expectedRevision = Number(options.expectedRevision);
    const nextRevision = Number(envelope.durability?.revision || 0);
    if (!options.allowSameRevision && nextRevision <= expectedRevision) return { ok: false, reason: 'REVISION_MUST_ADVANCE' };
    const appendTx = this.db.transaction(() => {
      const update = options.allowSameRevision
        ? { ok: true, reason: 'INITIAL_INSERT', revision: nextRevision }
        : this._updateRunByRevision(runId, expectedRevision, envelope);
      if (!update.ok) return update;
      this._insertTransition(runId, envelope, { ...options, expectedRevision, nextRevision });
      return { ok: true, reason: update.reason, revision: nextRevision };
    });
    return appendTx();
  }

  recordAttempt(input = {}) {
    const row = {
      attempt_id: String(input.attempt_id || ''),
      run_id: String(input.run_id || ''),
      enterprise_id: String(input.enterprise_id || ''),
      attempt_no: Number(input.attempt_no || 0),
      lifecycle_state: String(input.lifecycle_state || ''),
      dispatch_started: input.dispatch_started ? 1 : 0,
      effect_certainty: String(input.effect_certainty || W2.EFFECT_CERTAINTY.UNKNOWN),
      status: String(input.status || 'RECORDED'),
      started_at: String(input.started_at || ''),
      finished_at: String(input.finished_at || ''),
      evidence_refs: json(input.evidence_refs || []),
      attempt_snapshot: json(input.attempt_snapshot || {}),
      created_at: String(input.created_at || nowIso(this.clock)),
    };
    this.db.prepare(`INSERT INTO realityos_kernel_attempts (
      attempt_id,run_id,enterprise_id,attempt_no,lifecycle_state,dispatch_started,effect_certainty,status,started_at,finished_at,evidence_refs,attempt_snapshot,created_at
    ) VALUES (
      @attempt_id,@run_id,@enterprise_id,@attempt_no,@lifecycle_state,@dispatch_started,@effect_certainty,@status,@started_at,@finished_at,@evidence_refs,@attempt_snapshot,@created_at
    )`).run(row);
    return row;
  }

  appendTransitionAndAttempt(runId, envelope, options = {}, attemptInput = {}) {
    const expectedRevision = Number(options.expectedRevision);
    const nextRevision = Number(envelope.durability?.revision || 0);
    if (nextRevision <= expectedRevision) return { ok: false, reason: 'REVISION_MUST_ADVANCE' };
    const appendTx = this.db.transaction(() => {
      const update = this._updateRunByRevision(runId, expectedRevision, envelope);
      if (!update.ok) return update;
      this._insertTransition(runId, envelope, { ...options, expectedRevision, nextRevision });
      this.recordAttempt(attemptInput);
      return { ok: true, reason: update.reason, revision: nextRevision };
    });
    return appendTx();
  }

  listAttempts(runId) {
    return this.db.prepare('SELECT * FROM realityos_kernel_attempts WHERE run_id=? ORDER BY attempt_no').all(String(runId || ''));
  }

  markPendingLink(runId, expectedRevision, patch = {}) {
    const current = this.load(runId);
    if (!current) return { ok: false, reason: 'RUN_NOT_FOUND' };
    if (current.revision !== Number(expectedRevision)) return { ok: false, reason: 'REVISION_CONFLICT', currentRevision: current.revision };
    const envelope = current.envelope;
    const durability = { ...envelope.durability, ...patch.durability, revision: Number(expectedRevision) + 1 };
    const next = W2.extendCanonicalEnvelope({ ...envelope, durability: undefined }, durability);
    return this.appendTransition(runId, next, {
      expectedRevision,
      transitionId: durability.transition_id,
      phase: durability.transition_phase || 'PENDING_LINK',
      reason: 'DURABLE_LINK_MARKED',
    });
  }

  listUnfinished(enterpriseIdValue) {
    return this.db.prepare(`SELECT * FROM realityos_kernel_runs
      WHERE enterprise_id=? AND lifecycle_state NOT IN (${[...TERMINAL_STATES].map(() => '?').join(',')})
      ORDER BY updated_at ASC`).all(String(enterpriseIdValue || ''), ...TERMINAL_STATES);
  }
}

function persistExecutionIntentBeforeDispatch(store, envelope, executor) {
  const runId = envelope.durability.run_id;
  const expectedRevision = envelope.durability.revision;
  const attemptId = envelope.durability.attempt_id;
  const attemptInput = {
    attempt_id: attemptId,
    run_id: runId,
    enterprise_id: enterpriseId(envelope),
    attempt_no: envelope.execution_attempts.length || 1,
    lifecycle_state: envelope.state,
    dispatch_started: true,
    effect_certainty: envelope.durability.effect_certainty,
    status: 'DISPATCH_READY',
    started_at: nowIso(store.clock),
    attempt_snapshot: envelope.execution_attempts.at(-1) || {},
  };
  const result = store.appendTransitionAndAttempt(runId, envelope, {
    expectedRevision,
    transitionId: envelope.durability.transition_id,
    phase: 'WRITE_BEFORE_EFFECT',
    reason: 'EFFECT_INTENT_CHECKPOINTED_BEFORE_DISPATCH',
  }, attemptInput);
  if (!result.ok) return { dispatched: false, reason: result.reason, executorInvoked: false };
  const value = executor();
  return { dispatched: true, reason: 'DISPATCHED_AFTER_DURABLE_CHECKPOINT', executorInvoked: true, value };
}

module.exports = {
  STORE_SCHEMA_VERSION,
  ensureSchema,
  RealityOSKernelDurableStore,
  persistExecutionIntentBeforeDispatch,
};
