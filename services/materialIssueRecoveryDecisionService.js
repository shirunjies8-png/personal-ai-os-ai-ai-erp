const db = require('../database/client');
const approvalService = require('./approvalService');
const audit = require('./transactionAuditService');

const DECISIONS = Object.freeze({
  SAFE_COMPLETE: 'SAFE_COMPLETE',
  RETRY_REQUIRES_APPROVAL: 'RETRY_REQUIRES_APPROVAL',
  RECHECK_REQUIRED: 'RECHECK_REQUIRED',
  BLOCKED_CONFLICT: 'BLOCKED_CONFLICT',
  MANUAL_REVIEW: 'MANUAL_REVIEW'
});

function evaluate({ factResult, evidence = {} }) {
  if (factResult === 'COMMITTED') return { factResult, decision: DECISIONS.SAFE_COMPLETE, executionAllowed: false, approvalRequired: false, reasonCodes: ['FACTS_CONFIRM_COMMITTED'], evidence };
  if (factResult === 'NOT_COMMITTED') return { factResult, decision: DECISIONS.RETRY_REQUIRES_APPROVAL, executionAllowed: false, approvalRequired: true, reasonCodes: ['NO_INVENTORY_ISSUE_FACT_FOUND', 'NEW_ATTEMPT_REQUIRES_SEPARATE_APPROVAL'], evidence };
  if (factResult === 'STILL_UNKNOWN') return { factResult, decision: DECISIONS.RECHECK_REQUIRED, executionAllowed: false, approvalRequired: false, reasonCodes: ['FACTS_INSUFFICIENT_FOR_SAFE_CONCLUSION'], evidence };
  if (factResult === 'CONFLICT') return { factResult, decision: DECISIONS.BLOCKED_CONFLICT, executionAllowed: false, approvalRequired: true, reasonCodes: ['BUSINESS_FACT_CONFLICT', ...(evidence.conflict_codes || [])], evidence };
  return { factResult: factResult || 'UNKNOWN', decision: DECISIONS.MANUAL_REVIEW, executionAllowed: false, approvalRequired: true, reasonCodes: ['POLICY_NOT_DETERMINED'], evidence };
}

function existingApproval(enterpriseId, runId, jobId) {
  return db.prepare("SELECT * FROM agent_approvals WHERE enterprise_id=? AND task_id=? AND tool_name='material_issue_recovery_decision' AND payload LIKE ? ORDER BY created_at DESC LIMIT 1")
    .get(enterpriseId, runId, `%${jobId}%`);
}

function record({ job, fact }) {
  const decision = evaluate({ factResult: fact.result, evidence: fact.evidence });
  const payload = job.payload || {};
  const runId = String(payload.runtime_run_id || '');
  const stepId = String(payload.runtime_step_id || '');
  const attemptId = String(payload.runtime_attempt_id || '');
  let approval = null;

  // A decision may authorize only a future, separately prepared attempt. It is
  // deliberately not an execution permission and never invokes execute().
  if (decision.approvalRequired && runId) {
    approval = existingApproval(job.enterprise_id, runId, job.id);
    if (!approval) approval = approvalService.request({
      taskId: runId,
      enterpriseId: job.enterprise_id,
      userId: String(payload.requested_by || 'recovery-governance'),
      toolName: 'material_issue_recovery_decision',
      actionLabel: '批准领料恢复决策（不执行领料）',
      reason: decision.reasonCodes.join('；'),
      payload: {
        recovery_job_id: job.id,
        business_operation_id: payload.business_operation_id || '',
        fact_result: decision.factResult,
        decision: decision.decision,
        execution_allowed: false,
        authorization_scope: 'AUTHORIZED_FOR_NEW_ATTEMPT_ONLY'
      }
    });
  }
  if (runId && stepId) audit.recordValidation({
    run: { run_id: runId, enterprise_id: job.enterprise_id }, stepId, attemptId,
    result: decision.decision, snapshot: { fact_result: decision.factResult, evidence: decision.evidence, reason_codes: decision.reasonCodes, recovery_job_id: job.id },
    reason: 'Recovery Decision 是治理结论，不是领料执行授权', source: 'READ_COMMITTED', overrideAllowed: false,
    validatorType: 'MATERIAL_ISSUE_RECOVERY_DECISION_POLICY', ruleId: 'material_issue.recovery_decision_policy'
  });
  return { ...decision, approval: approval ? { id: approval.id, status: approval.status, action_label: approval.action_label } : null };
}

module.exports = { DECISIONS, evaluate, record };
