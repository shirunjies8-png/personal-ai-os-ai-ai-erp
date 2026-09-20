# RealityOS W1 Exit Review / W2 Entry Plan

Status: REVIEW / DESIGN ONLY. W1 exit: REFERENCE_KERNEL_VERIFIED. W2 planning entry: PASS; implementation NOT_STARTED. Real-effect integration gate: NOT_SATISFIED.

## 1. Baseline and evidence rules

- W0: `67f88378cedd31d21db6942115cdd296a98f7836`.
- W1: `93f160176585c86bff15a77402729cee4dc5001b`.
- W2_ENTRY_BASELINE_COMMIT: `aeca08d9842d5b8de895eb243a159ebcbd51ccd4` (project-state-only commit).
- Authority: root `project.md`; frozen architecture in `realityos-w0-governance-baseline.md`, `realityos-w1-kernel-baseline.md`, `realityos-module-registry.md`, and `registry/realityos-module-registry.js`.
- This plan refines sequencing, not ownership. No registry/status enum/schema/source code changes. Historical W0 CURRENT snapshots and W1 pre-commit annotations remain historical; actual Git commits establish current completion.
- Evidence below is code/schema-definition inspection, not a live production database or restart experiment. W0/W1 validators were rerun and passed. No product, browser or provider validation was performed.
- Tracked W1 service/test and W0/W1 governance files have no working diff. Other historical dirty files are neither promoted nor staged.

## 2. Frozen W1 exit statement

COMPLETE means reference scope only: Universal Mission → Goal/Task → Identity → Represented Principal → Authority/Lease → Agent/Executor → Capability/Tool → Preflight → Execution → Effect → Reality Readback → Evidence → Independent Verification → Outcome, with governed Recovery where required.

Confirmed components: identity shape gate; represented-principal preservation; authority and execution-boundary lease checks; capability/executor/tool binding; preflight enforcement; execution/effect separation; independent reality readback; evidence orchestration; verification and outcome boundaries; explicit state machine; safe retry requiring independent no-effect proof and recovery evidence; verifier exception closure.

`services/realityosKernelService.js`: `runKernel`, `validContext`, `capabilityBound`, `validateAuthorityLease`, `transition`, `recoverOrStop`, `recordEvidence`.

`scripts/realityos-w1-kernel-test.mjs`: original 12 invariants plus corrective 13–18, controlled clock, malformed identities, wrong capability, post-mutation error, null recovery evidence, throwing verifier, authority/binding changes. Assertions 1–10 and 13–18 are runtime reference assertions; 11–12 concern static governance with additional runtime evidence-owner checks.

REFERENCE_KERNEL_VERIFIED ≠ PRODUCTION_KERNEL_COMPLETE. No production authentication, durability, physical control or cross-process guarantees follow from an in-memory counter fixture.

## 3. Remaining-gap inventory

Classification is the current universal Kernel integration level, not a denial of existing domain capabilities. EXISTING identifies an implemented prerequisite, PARTIAL identifies domain-specific implementation without universal integration. Reference behavior and code inspection are not production Reality Evidence.

| # | Capability | Current class | Code/schema evidence | Remaining gate / owner |
|---|---|---|---|---|
| 1 | Durable Kernel envelope | REFERENCE_ONLY | Kernel `createKernelEnvelope` creates a JS object; `transition` changes memory only | Versioned persisted checkpoint/CAS and restart load; 16 storage, 03/10 semantic owners |
| 2 | Durable Run/Attempt | PARTIAL | `database/init.js` runtime_runs/runtime_steps/runtime_attempts; `runtimeObservabilityService.start/finish`; `trustedExecutionService.perform/details` | Bind Kernel lifecycle to existing IDs and tenant scope; 10 |
| 3 | Unified durable Evidence | REFERENCE_ONLY | Kernel `createReferenceEvidenceRuntime` uses an array; `recordEvidence` checks owner/id/trace/stage | Durable append/readback with canonical provenance and integrity; 13 |
| 4 | Durable Recovery adapter | PARTIAL | `auditRecoveryService.create/claimNext/process`; audit_recovery_jobs/attempts/events/idempotency in `database/init.js` | Map W1 failure/evidence/attempt to existing recovery owner; no blind execute on reclaim; 15+16 |
| 5 | Production identity/auth binding | PARTIAL | `middleware/auth.js#authRequired` verifies JWT then reads user; Kernel accepts caller-supplied identity references | Trusted mapping from req.user to canonical actor/principal/enterprise, not client assertion; 01 |
| 6 | Organization | PARTIAL | Existing enterprise_id scoping in `trustedExecutionService.assertTenant/details`; registry 02 majorGap | Mandatory tenant membership/isolation, role/accountability; full team hierarchy later; 02 |
| 7 | Delegation | CONTRACT_ONLY | Registry 04 owns Delegation; Kernel preserves represented_principal but no chain validation | Scope, issuer, audience, expiry, revocation and transitive limits; reject unsupported delegation; 04 consuming 01 |
| 8 | Authority Lease persistence/revocation | REFERENCE_ONLY | Kernel `validateAuthorityLease` validates provided ACTIVE lease/time/scope; Audit Recovery claim lease is a separate mechanism | Authoritative durable lease version/revocation lookup at execution and resume; 04 |
| 9 | Human Control | PARTIAL | `trustedExecutionService.decideApproval`, runtime_approvals; `auditRecoveryService.manualRetry` domain recovery precedent; registry 17 PLANNED | Canonical pause/cancel/intervention requests, readback, approval scope; 17 |
| 10 | Resume Re-authorization | MISSING | Kernel always creates a new envelope; no load/resume entry; retry rechecks are in-process only | Resume must never inherit prior ALLOW; 16 invokes 04 |
| 11 | Provider/Execution Provenance | PARTIAL | `realityos-core.js#createExecutionProvenance`; runtime_runs provider/runtime_or_model/request_id; Kernel evidence fragments | Versioned provider/tool/input references joined to durable Evidence, no secrets; 13 consumes 08/10 |
| 12 | Product-path Kernel integration | MISSING | Scoped rg over services/routes/controllers/scripts finds runKernel calls only in W1 test | Kernel Integration Contract and one separately approved pilot; 07/09/10 |
| 13 | Migration compatibility | MISSING | Existing init schema and business_operations identifiers differ from Kernel envelope; no Kernel persistence mapping | Versioned mapping, additive upgrade/rollback and old-reader tests before schema proposal; 16 with semantic owners |
| 14 | Kernel bypass detection | MISSING | Current product entry points do not call Kernel; W1 tests cover reference executor only | Pilot command/entrypoint inventory plus deny/bypass tests; 18 with 07/10 |
| 15 | Observability/tracing | PARTIAL | Kernel trace_id/state_history; runtimeObservabilityService list/details and runtime run SQL | Cross-process correlation and safety events independent of sampled debug logs; 10/18 |
| 16 | Crash/restart recovery | PARTIAL | auditRecoveryService.reclaimExpiredLeases/claimNext/transition uses claim_token/lease_version | Existing worker reclaim is not universal Kernel replay safety; stage-specific crash tests/fencing; 16 |
| 17 | Idempotency | PARTIAL | business_operations unique enterprise/operation/key and active operation ID index; audit_recovery_idempotency; trustedExecutionService.activeResponse | Stable command identity+payload binding+effect-side dedupe/readback across crash; Kernel has no such contract yet; 10/11/15 |
| 18 | Compensation | CONTRACT_ONLY | Registry 15 owns Compensation/Rollback; Kernel recovery adapter only RETRY/STOP handling | Domain-specific compensation requires new authority, evidence and independent verification; not automatic inverse; 15 |
| 19 | Effect uncertainty | PARTIAL | Core comparison UNKNOWN; Kernel EFFECT_UNCONFIRMED/readback failure; Recovery UNKNOWN terminal; materialIssueRecoveryDecisionService returns executionAllowed:false | Kernel durable uncertainty must not be collapsed into business FAILED; W1 failOutcome currently uses FAILED; 11/12/15 |
| 20 | Independent production verifier | PARTIAL | trustedExecutionService.recordValidation and runtime_validations; W1 separate verifier adapter | Durable versioned verifier references, retry verification without reexecution, production adapter; 14 |

No item above establishes universal production completeness. Read-only inspection has not tested power-loss durability, backup restore, multi-host fencing or external exactly-once effects.

## 4. W2 mission and scope

Formal name remains **W2 Platform Completion** from W0. Execution priority: **Integration & Durability**. Goal: make W1 a shared durable governed runtime before expanding product count.

W0 W2 modules all remain in scope: 02 Organization, 05 Enterprise Knowledge & Context, 08 Model / Intelligence, 09 Workflow / Orchestration, 16 Durable Runtime, 17 Human Control, 18 Audit / Governance. Durability work integrates W1 owners 01/03/04/07/10–15; it does not transfer their concepts to module 16.

Non-goals: new product capabilities; migrating 21 modules at once; choosing OCR by familiarity; full ERP/MES/physical integration; new provider calls; autonomous compensation; second registry/core/evidence system; deployment. No implementation, schema changes or pilot execution in this review.

## 5. Entry and hard gates

Planning entry PASS: W1 committed and rerun, owners fixed, gaps evidenced, sequencing/exit criteria defined. This unlocks review of the first bounded implementation slice only. Each slice still needs approval. It does not mean the following real-effect gates have passed.

### W2_HARD_GATE — required before real effect integration

1. Durable operation/envelope/checkpoint, Run/Attempt binding and atomic state updates. No dispatch without durable intent; durable acknowledgments must precede progress claims.
2. Durable Evidence/provenance and verification/recovery references, including unreadable/missing-evidence fail-closed behavior.
3. Recovery persistence, bounded policy, fencing, crash/restart readback and safe resume. Expired worker ownership is not permission to repeat an effect.
4. Authenticated subject + enterprise isolation + scoped current authority; expired/revoked authority cannot execute. Service-account and represented identity must be explicit.
5. Stable idempotency identity with payload/scope binding and effect-side dedupe or independent reconciliation. A database key alone cannot prove external exactly-once delivery.
6. Independently observed effect, versioned verifier, uncertainty handling and bounded failure closure. No executor self-certification.
7. Human escalation/stop boundary for high risk, ambiguity and unresolved uncertainty. A generic UI is not required for every low-risk read, but governed handling must exist before permitting writes that can become ambiguous.
8. Resume Re-authorization before any cross-process resumed effect, revalidated again at dispatch; current policy/input/version bindings and fresh evidence.
9. Pilot migration compatibility, bypass prevention, tenant-negative tests and rollback/disable plan.

Delegation is a conditional hard gate: any path acting under delegated/represented authority must prove that chain; unsupported delegation is DENY. Direct self-authority need not implement arbitrary chains first. Organization's enterprise isolation/accountability is mandatory on every tenant path; rich hierarchy is not mandatory for every Class A read.

### W2_REQUIRED

All seven W2 module boundaries need versioned minimal contracts and demonstrable integration before full W2 exit: Organization roles/accountability; Knowledge/Context evidence refs/version/temporal validity/conflict; Model decision/provenance distinct from authority; Workflow plan distinct from execution authorization; Durable state; Human Control; Audit policy history. Also metrics, retention/redaction, migration-version checks and read-only resume policy. A contract document alone is not a completed runtime.

### W2_LATER

W2 later: richer Organization/delegation beyond the first authorized scope, expanded context/model/workflow features, additional carefully reviewed pilots. W3: learning, self-improvement and domain packs. Broad product validation remains after Framework Freeze. Unsupported compensation or physical control stays disabled, not silently treated as available.

## 6. Durable adapters and ownership

| Boundary | Sole semantic owner | W2 adapter plan |
|---|---|---|
| Work/Outcome | 03 | Preserve mission/task and acceptance/Outcome references |
| Run/Attempt/Step | 10 | Reuse runtime_* persistence where compatible; preserve old IDs/history |
| Checkpoint/Resume | 16 | Version/CAS/fencing, monotonic checkpoints, crash-consistent store; never grants authority |
| Identity/Organization | 01/02 | Server-authenticated subject mapping and enterprise scope; no client-supplied trust |
| Authority Lease/Delegation | 04 | Durable scope/version/expiry/revocation and fresh decisions; distinct from worker claim lease |
| Effect/Reality | 11/12 | Stable effect identity, uncertainty and independent observations |
| Evidence/Provenance/Lineage | 13 | Append canonical evidence, durable reference readback and integrity; other modules only produce fragments |
| Verification | 14 | Versioned decision over cited evidence, durable result and failure reason |
| Recovery | 15 | Adapt existing jobs/attempts/policy; new retry decision never overwrites previous attempts |
| Human Control | 17 | Scoped intervention request; Authority approves, Execution applies, Reality confirms |
| Audit | 18 | Record requester/approver/action/policy/evidence and policy history; never authorizes |

First slice must compare exact columns/transaction boundaries in database/init.js and runtime services before choosing reuse vs additive migration. This review approves no table/field names or migration. Do not store a second authoritative copy of Evidence in Kernel JSON. Recoverable metadata and evidence references may be checkpointed; secrets, JWTs and unredacted business payloads must not be.

## 7. Crash / Resume Decision Matrix (target, not implemented)

All resume operations require authenticated read access; all resumed effects require new Authority evaluation and current Lease. Preserve previous attempt and append resume/decision evidence. A current fencing token controls checkpoint writes but is not an Authority grant.

| Last durable stage | Initial interpretation | Resume action | Automatic Execute? | Human boundary |
|---|---|---|---|---|
| AUTHORIZED | Old authorization is stale | Re-authorize; resolve current capability; rerun Preflight | Only after fresh complete gates and proven not dispatched | Revoked/ambiguous identity or policy |
| PREFLIGHT_PASSED | Preflight data may be stale | Re-authorize and rerun Preflight with versioned input | Same conditions, never use old boolean | Binding drift or unavailable approval |
| EXECUTING | Effect may have occurred, even without response | Read authoritative reality by stable operation key, persist evidence, independently verify | NO while uncertainty remains | Unreadable/conflicting/irreversible effect |
| EFFECT_PENDING | Execution acknowledgment is not reality proof | Readback → Evidence → Verification | NO | Missing authoritative readback |
| READBACK_PENDING | Old/incomplete observation is not fresh evidence | Reauthorize observation access, repeat read-only readback, verify | NO | Persistent inability to observe |
| VERIFICATION_PENDING | Existing evidence may be stale; execution already happened | Validate evidence integrity/freshness and verifier version, rerun verifier only; refresh readback if needed | NO | Verifier unavailable/conflicting evidence |
| RECOVERY_REQUIRED | Failure classification and authority may have changed | Reload immutable history, Situation Check, Evidence, bounded policy, fresh authority | Only proven no effect + idempotency + valid recovery evidence + fresh gates | Otherwise stop/escalate |

Crash before durable intent: no command dispatch allowed. Crash after effect but before acknowledgment: unknown, not failure. Process restart must not call runKernel with a newly generated operation key as a resume substitute.

## 8. Effect uncertainty and Human Control

Canonical vocabulary audit: Core EFFECT_COMPARISON_STATUSES already contains UNKNOWN; W1 has EFFECT_UNCONFIRMED; Audit Recovery has terminal UNKNOWN. Use **Actual Effect observation = UNKNOWN** owned by 11/12 as design semantics. `EFFECT_UNKNOWN` is an explanatory label, NOT a new registered W1 state or schema enum. W2.0 must approve the mapping before implementation.

Separate execution status, observed Effect, verification result and business Outcome. UNKNOWN → read-only Reality Readback → durable Evidence → independent Verification → confirmed Outcome or Recovery/Human boundary. Missing evidence cannot establish no effect. A failed observation is not proof of failed business action. Compensation is a separately authorized effect with its own identity, evidence and verification.

Human Control is mandatory for authorization ambiguity; unresolved or contradictory effect uncertainty; irreversible/high-impact action; insufficient recovery evidence; persistent verifier unavailability; required but unavailable compensation; repeated/no-progress failure; revoked authority; and physical high risk. Restart by itself need not require a person if deterministic read-only reconciliation and fresh authorization can resolve it; restart must never inherit execution permission.

Human records must bind authenticated requester and approver, enterprise, operation/run/attempt, requested scope, reason, current policy/lease version, evidence references, decision/expiry and readback of applied action. Pause/cancel acknowledgment ≠ confirmed physical stop. No “force retry” that bypasses effect reconciliation; revoked grants require a new valid grant from Authority, not an override flag.

## 9. Migration classes and pilot criteria

| Class | Meaning | Entry requirements |
|---|---|---|
| A | Truly read-only, no external effect | Auth/tenant/data policy, bounded observation, evidence/verification, truthful durability label; any external upload or incidental persistent effect reclassifies the path |
| B | Reversible digital effect | All hard gates; independent readback; dedupe; crash proof; authorized compensation/disable plan |
| C | High-impact business effect (send/approve/procure/ERP/MES/shipping) | B plus transaction-scope approval, segregation of duties, expiry/revocation, authoritative external acknowledgment, escalation; no blind retry |
| D | Physical effect | C plus domain safety engineering, certified stop/readback/interlocks/operator procedures; no W2 physical pilot authorization |

First future pilot criteria: low risk and bounded data; unambiguous effect; independent readback; durable evidence; independent verifier; testable crash/recovery and idempotency; minimal UI dependence; no physical dependencies; disable/migration rollback; demonstrable restart value; owner-approved contract. Score candidates against these criteria before selection. No candidate is selected here; OCR familiarity is not a selection reason.

## 10. Dependency-driven sequence

W0 contains reciprocal HARD Effect↔Reality references (11↔12) and SOFT Execution/Tool and Durable/Recovery links. Treat Effect/Reality as a jointly versioned interface cluster, not an acyclic initialization order; do not invent a second owner to break it. W0 validator's dependencyConflicts=0 checks registry consistency, not production startup/deadlock freedom. W2.0 must specify initialization/protocol behavior without mutating W0 ownership.

1. **W2.0 Integration contracts and compatibility preparation**: 01/02/03/04/07/10–18 mapping, persisted state/Effect uncertainty and operation identity contracts, failure taxonomy, privacy policy and migration test design. No real product effect. Approve schema/adapter proposal separately.
2. **W2.1 Durable execution substrate**: 10 + 16 versioned envelope/run/attempt/checkpoint binding, CAS/fencing, isolated DB migration/restart tests. Dispatch remains disabled until later gates pass.
3. **W2.2 Evidence, Verification, Audit and Recovery durability**: 11/12 observation contracts → 13 evidence → 14 verification → 18 audit and 15 recovery integration. Crash at every boundary; fail-closed if evidence persistence fails.
4. **W2.3 Identity/Organization/Authority resume gates**: durable lease/revocation and authenticated resume, conditional delegation; recheck at actual execution. Worker lease remains separate.
5. **W2.4 Platform governance integration**: 17 Human Control after 04/10/18; 05 Context after 13; 08 decision/provenance without authority; 09 Workflow after 03/04/06. Minimal independently validated contracts/integrations, not new product packs.
6. **W2.5 Controlled migration gate**: score/select one future pilot, separately approve scope, prove all applicable gates and rollback, execute one controlled product-path integration. This narrow framework pilot does not open the full Product Validation Backlog.

Each slice has an independent evidence report and approval. Rollback means disabling new dispatch and preserving/reconciling in-flight records, not erasing data or reverting schemas blindly. W2 full exit cannot be claimed after only W2.1–2.3 while other W0 W2 modules remain unimplemented.

## 11. W2 Exit Criteria

Required evidence, not merely code completion:

1. Kill/restart tests prove persisted envelope, run, attempt and checkpoint continuity at every matrix stage, with no lost/double-applied mutation.
2. Expired/revoked/mismatched authority cannot resume execution; old fencing owner cannot write; tenant-crossing read/resume denied.
3. Stable idempotency key/payload/version tests plus duplicate/concurrent requests; effect uncertainty invokes readback, never blind retry.
4. Evidence, provenance, recovery history and verification references survive restart and remain readable/integrity-checked; unavailable stores block unsafe progress.
5. Independent verification resumes or closes with a governed result; verifier/storage exceptions and timeouts leave recoverable trace, not fake success.
6. Human pause/cancel/escalation/manual recovery are scoped, authorized, auditable and independently read back; no approval bypass.
7. At least one approved low-risk real product path uses Kernel with independent effect/readback evidence; pilot bypass tests deny all alternate execution entry points.
8. Existing-data migration, new install, compatibility and safe disable/rollback tests preserve original records.
9. W0/W1 invariants pass; no owner drift, no parallel taxonomy. Context/Model/Workflow/Organization/Human/Audit minimal W2 integration evidence exists, not only documents.
10. Failure classification and privacy/redaction/retention controls hold under crash and repeated failure; debug trace sampling never deletes required governance evidence.
11. Product-independent tests and pilot evidence are clearly distinguished; production readiness, deployment and external/physical exactly-once claims require separate approval/evidence.

## 12. Entry disposition and next action

W1_EXIT_REVIEW=PASS; W1_EXIT_STATUS=REFERENCE_KERNEL_VERIFIED.
W2_ENTRY_PLAN=READY_FOR_REVIEW; W2 planning entry=PASS. W2=READY for a first separately approved W2.0 contract/compatibility slice; W2_IMPLEMENTATION_STARTED=NO. W2 real-effect gates remain NOT_SATISFIED.

Next executable task: obtain approval for W2.0; map current runtime_* and audit_recovery_* schema to a versioned Kernel persistence/adapter contract, define crash/uncertainty/idempotency test vectors and additive migration/rollback proposal, without product dispatch or schema execution. New architecture plan and updated project.md stay unstaged. Only Step 0 state commit was created; Push/Deploy=NO.
