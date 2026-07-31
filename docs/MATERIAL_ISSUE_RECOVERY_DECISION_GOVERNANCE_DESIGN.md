# Material Issue Recovery Decision Governance

## Scope

Phase C-6 governs decisions after Material Issue fact validation. It does not retry, replay or execute a material issue.

## Fact and Decision Separation

| Fact result | Recovery decision | Execution allowed | Approval required |
|---|---|---:|---:|
| `COMMITTED` | `SAFE_COMPLETE` | No | No |
| `NOT_COMMITTED` | `RETRY_REQUIRES_APPROVAL` | No | Yes |
| `STILL_UNKNOWN` | `RECHECK_REQUIRED` | No | No |
| `CONFLICT` | `BLOCKED_CONFLICT` | No | Yes |
| unsupported / incomplete policy input | `MANUAL_REVIEW` | No | Yes |

`NOT_COMMITTED` only means the facts permit proposing a new, separately governed attempt. It never authorizes the Recovery Worker to call Material Issue Execute.

## Reused Evidence and Governance Records

- `runtime_validations` records both `MATERIAL_ISSUE_FACT_VALIDATOR` and `MATERIAL_ISSUE_RECOVERY_DECISION_POLICY` results.
- `audit_recovery_jobs`, attempts and events retain Claim/Lease, Situation Check and decision events.
- `agent_approvals` records required governance approval using the existing Runtime Run as `task_id`; the approval payload is explicitly scoped to `AUTHORIZED_FOR_NEW_ATTEMPT_ONLY`.
- No new table, inventory transaction or business transaction is created by this decision layer.

## Conflict Policy

The fact validator returns `CONFLICT`, rather than `COMMITTED` or `NOT_COMMITTED`, for evidence such as a committed requisition without ledger, a ledger with non-committed transaction, multiple ledger facts, unresolvable transaction references, inconsistent operation transactions, or mismatched Runtime Run references. Conflict is always `BLOCKED_CONFLICT`; it cannot be automatically resolved.

## Safety Invariants

1. Fact validation is read-only.
2. The Decision Service imports neither Material Issue Execute nor Inventory mutation capability.
3. `NOT_COMMITTED` is not a retry.
4. Approval is not execution.
5. Conflict is never automatically reclassified as a definitive business outcome.
6. Every decision is a Runtime Validation and Recovery Event.
7. A second Recovery scan cannot add business facts, attempts, or approvals to a terminal Recovery Job.

## Current Boundary

Phase C-6 intentionally does not implement automatic retry, a new Material Issue attempt, approval decision UI, or any inventory compensation. A future phase must separately define how an approved governance record may permit a user to initiate a new Preparation and approval cycle.

## Test Evidence

`scripts/material-issue-recovery-decision-test.mjs` covers F1–F5: safe complete, approval-required not-committed, recheck-only unknown, blocked conflict, and repeated-job idempotency.
