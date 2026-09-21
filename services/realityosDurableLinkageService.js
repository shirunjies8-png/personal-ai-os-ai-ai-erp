'use strict';

const crypto = require('node:crypto');
const W2 = require('./realityosKernelDurabilityContract');

const LINKAGE_SCHEMA_VERSION = 1;

const OWNERS = Object.freeze({
  EVIDENCE: '13-evidence-runtime',
  VERIFICATION: '14-verification-runtime',
  RECOVERY: '15-recovery-runtime',
});

const VERIFICATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  FAILED_VERIFICATION: 'FAILED_VERIFICATION',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
  UNKNOWN: 'UNKNOWN',
});

const RECOVERY_STATE = Object.freeze({
  REQUIRED: 'REQUIRED',
  ADMISSION_REQUIRED: 'ADMISSION_REQUIRED',
  HUMAN_REQUIRED: 'HUMAN_REQUIRED',
  RESOLVED: 'RESOLVED',
  UNRESOLVED: 'UNRESOLVED',
});

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

function digest(value) {
  return crypto.createHash('sha256').update(json(value)).digest('hex');
}

function enterpriseId(envelope) {
  return String(envelope?.organization_context?.enterprise_id || envelope?.represented_principal?.id || '');
}

function workspaceId(envelope) {
  return String(envelope?.organization_context?.workspace_id || '');
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEvidenceRef(ref) {
  if (typeof ref === 'string') return { evidence_id: ref, owner: OWNERS.EVIDENCE };
  return {
    evidence_id: String(ref?.evidence_id || ref?.id || ''),
    owner: String(ref?.owner || OWNERS.EVIDENCE),
    enterprise_id: ref?.enterprise_id ? String(ref.enterprise_id) : '',
    integrity_ref: ref?.integrity_ref ? String(ref.integrity_ref) : '',
  };
}

function ensureSchema(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS realityos_evidence_receipts (
  evidence_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  evidence_type TEXT NOT NULL,
  source_ref TEXT NOT NULL DEFAULT '{}',
  provenance_ref TEXT NOT NULL DEFAULT '{}',
  run_id TEXT NOT NULL,
  attempt_id TEXT DEFAULT '',
  revision INTEGER NOT NULL,
  effect_operation_id TEXT NOT NULL,
  intent_digest TEXT NOT NULL,
  idempotency_ref TEXT NOT NULL,
  enterprise_id TEXT NOT NULL,
  organization_ref TEXT NOT NULL DEFAULT '{}',
  workspace_id TEXT DEFAULT '',
  payload_ref TEXT NOT NULL DEFAULT '{}',
  payload_hash TEXT NOT NULL,
  integrity_ref TEXT NOT NULL,
  integrity_status TEXT NOT NULL,
  supersedes_evidence_id TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(enterprise_id, run_id, evidence_id)
);
CREATE INDEX IF NOT EXISTS idx_realityos_evidence_run
  ON realityos_evidence_receipts(enterprise_id, run_id, revision);

CREATE TABLE IF NOT EXISTS realityos_verification_cases (
  verification_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  attempt_id TEXT DEFAULT '',
  revision INTEGER NOT NULL,
  effect_operation_id TEXT NOT NULL,
  intent_digest TEXT NOT NULL,
  idempotency_ref TEXT NOT NULL,
  enterprise_id TEXT NOT NULL,
  workspace_id TEXT DEFAULT '',
  evidence_refs TEXT NOT NULL,
  verifier_ref TEXT NOT NULL DEFAULT '{}',
  verification_policy_ref TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT '',
  reason_ref TEXT NOT NULL DEFAULT '{}',
  operation_identity TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(enterprise_id, operation_identity)
);
CREATE INDEX IF NOT EXISTS idx_realityos_verification_run
  ON realityos_verification_cases(enterprise_id, run_id, revision);

CREATE TABLE IF NOT EXISTS realityos_recovery_cases (
  recovery_case_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  attempt_id TEXT DEFAULT '',
  revision INTEGER NOT NULL,
  originating_failure_ref TEXT NOT NULL DEFAULT '{}',
  effect_operation_id TEXT NOT NULL,
  effect_certainty TEXT NOT NULL,
  intent_digest TEXT NOT NULL,
  idempotency_ref TEXT NOT NULL,
  enterprise_id TEXT NOT NULL,
  workspace_id TEXT DEFAULT '',
  evidence_refs TEXT NOT NULL,
  verification_ref TEXT NOT NULL DEFAULT '{}',
  recovery_state TEXT NOT NULL,
  retry_eligibility TEXT NOT NULL,
  reauthorization_required INTEGER NOT NULL DEFAULT 1,
  human_control_required INTEGER NOT NULL DEFAULT 0,
  compensation_ref TEXT NOT NULL DEFAULT '{}',
  final_resolution TEXT DEFAULT '',
  operation_identity TEXT NOT NULL,
  history TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(enterprise_id, operation_identity)
);
CREATE INDEX IF NOT EXISTS idx_realityos_recovery_run
  ON realityos_recovery_cases(enterprise_id, run_id, revision);
`);
}

function requiredEnvelopeIds(envelope) {
  const durability = envelope?.durability || {};
  return {
    run_id: String(durability.run_id || ''),
    attempt_id: String(durability.attempt_id || ''),
    revision: Number(durability.revision || 0),
    effect_operation_id: String(durability.effect_operation_id || ''),
    intent_digest: String(durability.intent_digest || ''),
    idempotency_ref: String(durability.idempotency_ref || ''),
    enterprise_id: enterpriseId(envelope),
    workspace_id: workspaceId(envelope),
  };
}

class RealityOSDurableLinkageService {
  constructor(db, options = {}) {
    if (!db || typeof db.prepare !== 'function') throw new Error('A better-sqlite3 compatible database is required');
    this.db = db;
    this.clock = options.clock;
    ensureSchema(db);
  }

  append(input = {}) {
    return this.recordEvidenceReceipt(input);
  }

  recordEvidenceReceipt(input = {}) {
    const envelope = input.envelope || {};
    const ids = { ...requiredEnvelopeIds(envelope), ...input };
    const evidenceId = String(input.evidence_id || input.id || '');
    if (!nonEmpty(evidenceId)) throw Object.assign(new Error('evidence_id is required'), { code: 'EVIDENCE_ID_REQUIRED' });
    const payloadRef = input.payload_ref || {};
    const payloadHash = String(input.payload_hash || digest(payloadRef));
    const sourceRef = input.source_ref || {};
    const provenanceRef = input.provenance_ref || {};
    const row = {
      evidence_id: evidenceId,
      owner: OWNERS.EVIDENCE,
      schema_version: LINKAGE_SCHEMA_VERSION,
      evidence_type: String(input.evidence_type || input.type || 'KERNEL_EVIDENCE'),
      source_ref: json(sourceRef),
      provenance_ref: json(provenanceRef),
      run_id: ids.run_id,
      attempt_id: String(ids.attempt_id || ''),
      revision: Number(ids.revision || 0),
      effect_operation_id: ids.effect_operation_id,
      intent_digest: ids.intent_digest,
      idempotency_ref: ids.idempotency_ref,
      enterprise_id: ids.enterprise_id,
      organization_ref: json(input.organization_ref || envelope.organization_context || {}),
      workspace_id: ids.workspace_id,
      payload_ref: json(payloadRef),
      payload_hash: payloadHash,
      integrity_ref: String(input.integrity_ref || `sha256:${payloadHash}`),
      integrity_status: String(input.integrity_status || 'VALID'),
      supersedes_evidence_id: String(input.supersedes_evidence_id || ''),
      created_at: String(input.created_at || nowIso(this.clock)),
    };
    for (const key of ['run_id', 'effect_operation_id', 'intent_digest', 'idempotency_ref', 'enterprise_id', 'payload_hash']) {
      if (!nonEmpty(String(row[key] || ''))) throw Object.assign(new Error(`${key} is required`), { code: 'EVIDENCE_RECEIPT_INVALID' });
    }
    const existing = this.loadEvidenceReceipt(evidenceId, row.enterprise_id);
    if (existing) {
      const immutable = ['owner', 'schema_version', 'evidence_type', 'source_ref', 'provenance_ref', 'run_id', 'attempt_id', 'revision',
        'effect_operation_id', 'intent_digest', 'idempotency_ref', 'enterprise_id', 'workspace_id', 'payload_ref', 'payload_hash',
        'integrity_ref', 'integrity_status', 'supersedes_evidence_id'];
      const changed = immutable.filter(key => String(existing.row[key] ?? '') !== String(row[key] ?? ''));
      if (changed.length) throw Object.assign(new Error('Evidence receipt is immutable; create a new evidence record or explicit supersession'), {
        code: 'EVIDENCE_HISTORY_IS_IMMUTABLE',
        changed,
      });
      return existing.receipt;
    }
    this.db.prepare(`INSERT INTO realityos_evidence_receipts (
      evidence_id,owner,schema_version,evidence_type,source_ref,provenance_ref,run_id,attempt_id,revision,effect_operation_id,
      intent_digest,idempotency_ref,enterprise_id,organization_ref,workspace_id,payload_ref,payload_hash,integrity_ref,integrity_status,
      supersedes_evidence_id,created_at
    ) VALUES (
      @evidence_id,@owner,@schema_version,@evidence_type,@source_ref,@provenance_ref,@run_id,@attempt_id,@revision,@effect_operation_id,
      @intent_digest,@idempotency_ref,@enterprise_id,@organization_ref,@workspace_id,@payload_ref,@payload_hash,@integrity_ref,@integrity_status,
      @supersedes_evidence_id,@created_at
    )`).run(row);
    return this.loadEvidenceReceipt(evidenceId, row.enterprise_id).receipt;
  }

  loadEvidenceReceipt(evidenceId, enterpriseId) {
    const row = this.db.prepare('SELECT * FROM realityos_evidence_receipts WHERE evidence_id=? AND enterprise_id=?')
      .get(String(evidenceId || ''), String(enterpriseId || ''));
    if (!row) return null;
    const receipt = {
      evidence_id: row.evidence_id,
      id: row.evidence_id,
      owner: row.owner,
      schema_version: row.schema_version,
      evidence_type: row.evidence_type,
      source_ref: parse(row.source_ref, {}),
      provenance_ref: parse(row.provenance_ref, {}),
      run_id: row.run_id,
      attempt_id: row.attempt_id,
      revision: row.revision,
      effect_operation_id: row.effect_operation_id,
      intent_digest: row.intent_digest,
      idempotency_ref: row.idempotency_ref,
      enterprise_id: row.enterprise_id,
      workspace_id: row.workspace_id,
      payload_ref: parse(row.payload_ref, {}),
      payload_hash: row.payload_hash,
      integrity_ref: row.integrity_ref,
      integrity_status: row.integrity_status,
      durability_ack: true,
      created_at: row.created_at,
    };
    return { row, receipt };
  }

  load(evidenceId, enterpriseId) {
    return this.loadEvidenceReceipt(evidenceId, enterpriseId)?.receipt || null;
  }

  link(envelope, evidenceRefs = []) {
    return this.validateEvidenceRefs(evidenceRefs, envelope);
  }

  validateIntegrity(ref, envelope) {
    return this.validateEvidenceRefs([ref], envelope);
  }

  validateEvidenceRefs(evidenceRefs = [], envelope) {
    const refs = evidenceRefs.map(normalizeEvidenceRef);
    const errors = [];
    const receipts = [];
    const expectedEnterprise = enterpriseId(envelope);
    for (const ref of refs) {
      if (ref.owner !== OWNERS.EVIDENCE) {
        errors.push({ code: 'WRONG_EVIDENCE_OWNER', evidence_id: ref.evidence_id });
        continue;
      }
      const receipt = this.loadEvidenceReceipt(ref.evidence_id, ref.enterprise_id || expectedEnterprise);
      if (!receipt) {
        errors.push({ code: 'EVIDENCE_NOT_FOUND', evidence_id: ref.evidence_id });
        continue;
      }
      const validation = W2.validateEvidenceReceipt(receipt.receipt, envelope);
      if (!validation.valid) {
        errors.push(...validation.errors);
        continue;
      }
      if (receipt.row.integrity_status !== 'VALID') errors.push({ code: 'EVIDENCE_INTEGRITY_INVALID', evidence_id: ref.evidence_id });
      if (ref.integrity_ref && ref.integrity_ref !== receipt.row.integrity_ref) errors.push({ code: 'EVIDENCE_INTEGRITY_REF_MISMATCH', evidence_id: ref.evidence_id });
      receipts.push(receipt.receipt);
    }
    return {
      valid: errors.length === 0 && refs.length > 0,
      complete: errors.length === 0 && refs.length > 0,
      integrity_valid: errors.length === 0 && refs.length > 0,
      errors,
      receipts,
    };
  }

  createVerificationCase(input = {}) {
    const envelope = input.envelope || {};
    const ids = { ...requiredEnvelopeIds(envelope), ...input };
    const evidenceValidation = this.validateEvidenceRefs(input.evidence_refs || envelope.evidence_refs || [], envelope);
    if (!evidenceValidation.valid) throw Object.assign(new Error('Verification requires durable valid Evidence references'), {
      code: 'VERIFICATION_REQUIRES_DURABLE_EVIDENCE_REFERENCES',
      errors: evidenceValidation.errors,
    });
    const operationIdentity = String(input.operation_identity || digest({
      owner: OWNERS.VERIFICATION,
      run_id: ids.run_id,
      revision: ids.revision,
      effect_operation_id: ids.effect_operation_id,
      idempotency_ref: ids.idempotency_ref,
      verifier_ref: input.verifier_ref || {},
    }));
    const existing = this.db.prepare('SELECT * FROM realityos_verification_cases WHERE enterprise_id=? AND operation_identity=?')
      .get(ids.enterprise_id, operationIdentity);
    if (existing) return this.loadVerificationCase(existing.verification_id, ids.enterprise_id);
    const timestamp = nowIso(this.clock);
    const row = {
      verification_id: String(input.verification_id || `verification:${operationIdentity}`),
      owner: OWNERS.VERIFICATION,
      schema_version: LINKAGE_SCHEMA_VERSION,
      run_id: ids.run_id,
      attempt_id: String(ids.attempt_id || ''),
      revision: Number(ids.revision || 0),
      effect_operation_id: ids.effect_operation_id,
      intent_digest: ids.intent_digest,
      idempotency_ref: ids.idempotency_ref,
      enterprise_id: ids.enterprise_id,
      workspace_id: ids.workspace_id,
      evidence_refs: json(evidenceValidation.receipts.map(item => ({ evidence_id: item.evidence_id, owner: item.owner, enterprise_id: item.enterprise_id, integrity_ref: item.integrity_ref }))),
      verifier_ref: json(input.verifier_ref || { owner: OWNERS.VERIFICATION, type: 'REFERENCE_VERIFIER' }),
      verification_policy_ref: json(input.verification_policy_ref || {}),
      status: Object.values(VERIFICATION_STATUS).includes(input.status) ? input.status : VERIFICATION_STATUS.PENDING,
      decision: String(input.decision || ''),
      reason_ref: json(input.reason_ref || {}),
      operation_identity: operationIdentity,
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.db.prepare(`INSERT INTO realityos_verification_cases (
      verification_id,owner,schema_version,run_id,attempt_id,revision,effect_operation_id,intent_digest,idempotency_ref,enterprise_id,workspace_id,
      evidence_refs,verifier_ref,verification_policy_ref,status,decision,reason_ref,operation_identity,created_at,updated_at
    ) VALUES (
      @verification_id,@owner,@schema_version,@run_id,@attempt_id,@revision,@effect_operation_id,@intent_digest,@idempotency_ref,@enterprise_id,@workspace_id,
      @evidence_refs,@verifier_ref,@verification_policy_ref,@status,@decision,@reason_ref,@operation_identity,@created_at,@updated_at
    )`).run(row);
    return this.loadVerificationCase(row.verification_id, row.enterprise_id);
  }

  loadVerificationCase(verificationId, enterpriseId) {
    const row = this.db.prepare('SELECT * FROM realityos_verification_cases WHERE verification_id=? AND enterprise_id=?')
      .get(String(verificationId || ''), String(enterpriseId || ''));
    if (!row) return null;
    return { ...row, evidence_refs: parse(row.evidence_refs, []), verifier_ref: parse(row.verifier_ref, {}), verification_policy_ref: parse(row.verification_policy_ref, {}), reason_ref: parse(row.reason_ref, {}) };
  }

  decideVerificationResume(envelope, verificationCase) {
    const evidence = this.validateEvidenceRefs(verificationCase?.evidence_refs || [], envelope);
    if (!evidence.valid) {
      return { decision: W2.DECISIONS.RECOVERY_REQUIRED, executionAllowed: false, reasons: ['MISSING_OR_INVALID_EVIDENCE_BLOCKS_VERIFICATION_OR_RECOVERY_ADVANCE'], evidence };
    }
    if (verificationCase.status !== VERIFICATION_STATUS.VERIFIED) {
      return { decision: W2.DECISIONS.VERIFY_FIRST, executionAllowed: false, reasons: ['PENDING_VERIFICATION_NEVER_BECOMES_SUCCESS_ON_RESTART'], evidence };
    }
    return { decision: W2.DECISIONS.CONTINUE_SAFE, executionAllowed: false, reasons: ['VERIFICATION_ALREADY_RECORDED'], evidence };
  }

  createOrReference(input = {}) {
    return this.createRecoveryCase(input);
  }

  createRecoveryCase(input = {}) {
    const envelope = input.envelope || {};
    const ids = { ...requiredEnvelopeIds(envelope), ...input };
    const evidenceValidation = this.validateEvidenceRefs(input.evidence_refs || envelope.evidence_refs || [], envelope);
    if (!evidenceValidation.valid) throw Object.assign(new Error('Recovery cannot advance without durable valid Evidence'), {
      code: 'RECOVERY_WITHOUT_EVIDENCE_CANNOT_ADVANCE',
      errors: evidenceValidation.errors,
    });
    const operationIdentity = String(input.operation_identity || digest({
      owner: OWNERS.RECOVERY,
      run_id: ids.run_id,
      revision: ids.revision,
      effect_operation_id: ids.effect_operation_id,
      idempotency_ref: ids.idempotency_ref,
      failure: input.originating_failure_ref || {},
    }));
    const existing = this.db.prepare('SELECT * FROM realityos_recovery_cases WHERE enterprise_id=? AND operation_identity=?')
      .get(ids.enterprise_id, operationIdentity);
    if (existing) return this.loadRecoveryCase(existing.recovery_case_id, ids.enterprise_id);
    const timestamp = nowIso(this.clock);
    const row = {
      recovery_case_id: String(input.recovery_case_id || `recovery:${operationIdentity}`),
      owner: OWNERS.RECOVERY,
      schema_version: LINKAGE_SCHEMA_VERSION,
      run_id: ids.run_id,
      attempt_id: String(ids.attempt_id || ''),
      revision: Number(ids.revision || 0),
      originating_failure_ref: json(input.originating_failure_ref || {}),
      effect_operation_id: ids.effect_operation_id,
      effect_certainty: String(input.effect_certainty || envelope.durability?.effect_certainty || W2.EFFECT_CERTAINTY.UNKNOWN),
      intent_digest: ids.intent_digest,
      idempotency_ref: ids.idempotency_ref,
      enterprise_id: ids.enterprise_id,
      workspace_id: ids.workspace_id,
      evidence_refs: json(evidenceValidation.receipts.map(item => ({ evidence_id: item.evidence_id, owner: item.owner, enterprise_id: item.enterprise_id, integrity_ref: item.integrity_ref }))),
      verification_ref: json(input.verification_ref || envelope.durability?.verification_ref || {}),
      recovery_state: Object.values(RECOVERY_STATE).includes(input.recovery_state) ? input.recovery_state : RECOVERY_STATE.REQUIRED,
      retry_eligibility: String(input.retry_eligibility || 'REQUIRES_CURRENT_AUTHORITY_AND_EFFECT_NOT_OCCURRED'),
      reauthorization_required: input.reauthorization_required === false ? 0 : 1,
      human_control_required: input.human_control_required ? 1 : 0,
      compensation_ref: json(input.compensation_ref || {}),
      final_resolution: String(input.final_resolution || ''),
      operation_identity: operationIdentity,
      history: json([{ at: timestamp, event: 'RECOVERY_CASE_CREATED', evidence_count: evidenceValidation.receipts.length }]),
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.db.prepare(`INSERT INTO realityos_recovery_cases (
      recovery_case_id,owner,schema_version,run_id,attempt_id,revision,originating_failure_ref,effect_operation_id,effect_certainty,
      intent_digest,idempotency_ref,enterprise_id,workspace_id,evidence_refs,verification_ref,recovery_state,retry_eligibility,reauthorization_required,
      human_control_required,compensation_ref,final_resolution,operation_identity,history,created_at,updated_at
    ) VALUES (
      @recovery_case_id,@owner,@schema_version,@run_id,@attempt_id,@revision,@originating_failure_ref,@effect_operation_id,@effect_certainty,
      @intent_digest,@idempotency_ref,@enterprise_id,@workspace_id,@evidence_refs,@verification_ref,@recovery_state,@retry_eligibility,@reauthorization_required,
      @human_control_required,@compensation_ref,@final_resolution,@operation_identity,@history,@created_at,@updated_at
    )`).run(row);
    return this.loadRecoveryCase(row.recovery_case_id, row.enterprise_id);
  }

  appendDecision(recoveryCaseId, enterpriseId, decision = {}) {
    const current = this.loadRecoveryCase(recoveryCaseId, enterpriseId);
    if (!current) return null;
    const history = [...current.history, { at: nowIso(this.clock), event: 'RECOVERY_DECISION_APPENDED', decision }];
    this.db.prepare('UPDATE realityos_recovery_cases SET history=?, updated_at=? WHERE recovery_case_id=? AND enterprise_id=?')
      .run(json(history), nowIso(this.clock), recoveryCaseId, enterpriseId);
    return this.loadRecoveryCase(recoveryCaseId, enterpriseId);
  }

  resolve(recoveryCaseId, enterpriseId, resolution = {}) {
    const current = this.loadRecoveryCase(recoveryCaseId, enterpriseId);
    if (!current) return null;
    const history = [...current.history, { at: nowIso(this.clock), event: 'RECOVERY_CASE_RESOLVED', resolution }];
    this.db.prepare("UPDATE realityos_recovery_cases SET recovery_state=?, final_resolution=?, history=?, updated_at=? WHERE recovery_case_id=? AND enterprise_id=?")
      .run(RECOVERY_STATE.RESOLVED, String(resolution.final_resolution || 'RESOLVED'), json(history), nowIso(this.clock), recoveryCaseId, enterpriseId);
    return this.loadRecoveryCase(recoveryCaseId, enterpriseId);
  }

  loadRecoveryCase(recoveryCaseId, enterpriseId) {
    const row = this.db.prepare('SELECT * FROM realityos_recovery_cases WHERE recovery_case_id=? AND enterprise_id=?')
      .get(String(recoveryCaseId || ''), String(enterpriseId || ''));
    if (!row) return null;
    return {
      ...row,
      originating_failure_ref: parse(row.originating_failure_ref, {}),
      evidence_refs: parse(row.evidence_refs, []),
      verification_ref: parse(row.verification_ref, {}),
      compensation_ref: parse(row.compensation_ref, {}),
      history: parse(row.history, []),
      reauthorization_required: Boolean(row.reauthorization_required),
      human_control_required: Boolean(row.human_control_required),
    };
  }

  decideRecoveryResume(envelope, recoveryCase, context = {}) {
    const evidence = this.validateEvidenceRefs(recoveryCase?.evidence_refs || [], envelope);
    if (!evidence.valid) {
      return { decision: W2.DECISIONS.RECOVERY_REQUIRED, executionAllowed: false, reasons: ['MISSING_OR_INVALID_EVIDENCE_BLOCKS_VERIFICATION_OR_RECOVERY_ADVANCE'], evidence };
    }
    const effectNotOccurred = recoveryCase.effect_certainty === W2.EFFECT_CERTAINTY.NOT_OCCURRED && context.effect?.certainty === W2.EFFECT_CERTAINTY.NOT_OCCURRED && context.effect?.independent === true;
    const currentAuthority = context.current_authorization?.decision === 'ALLOW';
    return {
      decision: W2.DECISIONS.RECOVERY_REQUIRED,
      executionAllowed: false,
      retryEligibleNow: effectNotOccurred && currentAuthority,
      reasons: ['RECOVERY_RESTART_NEVER_BLIND_RETRIES', 'RECOVERY_RETRY_REQUIRES_CURRENT_AUTHORITY', 'RECOVERY_RETRY_REQUIRES_EFFECT_NOT_OCCURRED'],
      requiredGates: ['RECOVERY_ADMISSION', 'CURRENT_AUTHORITY', 'AUTHORITATIVE_READBACK', 'HUMAN_CONTROL_IF_REQUIRED'],
      evidence,
    };
  }
}

module.exports = {
  LINKAGE_SCHEMA_VERSION,
  OWNERS,
  VERIFICATION_STATUS,
  RECOVERY_STATE,
  ensureSchema,
  RealityOSDurableLinkageService,
};
