# RealityOS W2.0 Contract & Compatibility Review

Status: **CONTRACT BASELINE + PURE CONTRACT SLICE CANDIDATE**. The architecture baseline has been committed. The current changeset starts the approved pure-contract slice only; durable storage, product migration and real effect replay remain not implemented.

Authority: root `project.md` → W0 Governance / 21 Module Registry → W1 Kernel semantics → committed W2 Entry Plan. W2 remains **Platform Completion**; durability/integration is its priority, not a replacement for Organization, Knowledge/Context, Model, Workflow, Human Control or Audit. This document adds no owner, runtime, product capability, database schema or deployed service.

Baseline: W1 `93f160176585c86bff15a77402729cee4dc5001b`; W2 Entry Architecture `21a75835989c08044b6447a6e7b5de5dfec9f6ee` (parent `aeca08d9842d5b8de895eb243a159ebcbd51ccd4`); W2.0 Contract Baseline `b81e052051aa608b60181b19ef5311a8647d5491`. Interfaces/fields below are implemented only where explicitly mapped in section 16. The current implementation candidate is contract-only and does not create a persistent runtime.

## 1. W2_0_REALITY_AUDIT

Evidence is source/schema inspection, not new runtime or product verification. Database evidence means actual CREATE/ensure-column definitions, not an assertion that any deployed database has been migrated. Existing working-tree AI Gateway changes are historical, outside this changeset, and not promoted to a new verified baseline.

Status scope: EXISTING_RUNTIME = executable domain implementation exists (not proof of universal integration or production readiness); PARTIAL = domain mechanisms exist but shared Kernel integration is missing; REFERENCE_ONLY = reference Kernel/adapter only; CONTRACT_ONLY = pure contract/decision boundary without durable runtime; MISSING = no matching runtime implementation evidenced. Architecture vocabulary alone does not count as a capability.

| Object | Status | Actual source / evidence | Reuse and boundary |
|---|---|---|---|
| Kernel envelope | REFERENCE_ONLY | `services/realityosKernelService.js:createKernelEnvelope`, `transition`, `runKernel` | One in-memory envelope; no durable store/restart loader |
| Runtime Run | EXISTING_RUNTIME | `database/init.js:runtime_runs`; `services/runtimeObservabilityService.js:start/finish` | Persistent `run_id`, enterprise/user/context/status; not a Kernel checkpoint |
| Runtime Attempt | EXISTING_RUNTIME | `database/init.js:runtime_attempts`; `services/trustedExecutionService.js` attempt writes | Persistent `id/run_id/step_id/attempt_no`; W1 attempts instead live inside an array |
| Identity | PARTIAL | `middleware/auth.js:authRequired`; `models/userModel.js`; Kernel identity shape/binding checks | JWT-backed product user exists; canonical restart identity adapter absent |
| Represented Principal | REFERENCE_ONLY | Kernel `represented_principal`, binding snapshot | Reference value, not production delegation/representation resolution |
| Authority | PARTIAL | `services/permissionService.js`; Kernel authority adapter + execution-boundary recheck | Domain permission checks exist; shared durable Authority decision adapter absent |
| Lease | PARTIAL | Kernel authority lease validation; `audit_recovery_jobs.claim_token/lease_version/lease_expires_at` | Work ownership lease exists; **not** Authority Lease; no shared revocation-backed authority lease persistence |
| Capability | CONTRACT_ONLY | `realityos-core.js:CapabilityRegistry`; Kernel capability binding | Contract/lookup reusable; W1 executor/tool binding retained; not universal production integration |
| Tool | PARTIAL | Kernel `tool`/capability binding; `permissionService.authorizeTool` | Existing domain authorization, no restart-safe shared tool descriptor resolver |
| Preflight | CONTRACT_ONLY | Core preflight contract; Kernel preflight adapter and post-preflight checks | Recompute before resumed effect; old pass is evidence only |
| Execution | PARTIAL | Kernel `runKernel`; `trustedExecutionService.execute`; runtime step/attempt tables | Product execution and reference orchestration exist separately |
| Effect | CONTRACT_ONLY | Core `createEffectRequest`, `createExpectedEffect`, comparison vocabulary | Semantic effect descriptor exists; not a persistent operation-instance ledger |
| Reality Readback | PARTIAL | Kernel independent `reality.readback`; domain fact reader in `auditRecoveryService.js:materialIssueFactResult` | Real domain fact queries exist; general Kernel adapter remains REFERENCE_ONLY, no durable integration |
| Evidence | REFERENCE_ONLY | Kernel `createReferenceEvidenceRuntime`, `recordEvidence`; owner 13 registry | W1 evidence memory array; existing provenance/trace fields do not constitute shared Evidence persistence |
| Verification | PARTIAL | Kernel independent verifier; `runtime_validations` actual schema; `trustedExecutionService.recordValidation` | Persistent domain validation and reference verifier; no unified durable integration |
| Outcome | PARTIAL | Kernel `outcome`; `runtime_outcome_feedback` and runtime status columns | Reference outcome vs domain feedback; never conflate execution success with verified effect |
| Recovery | PARTIAL | `services/auditRecoveryService.js`; jobs/attempts/idempotency/events tables | Durable domain recovery exists; Kernel recovery adapter remains reference-only |
| Audit | PARTIAL | `audit_recovery_events`; `services/approvalService.js`; runtime trace records | Domain events/decisions exist; no universal Kernel audit adapter contract implementation |
| Workflow | PARTIAL | `trustedExecutionService` steps/approvals; runtime_steps | Domain sequencing exists; shared W2 Workflow ownership integration absent |
| Human Control | PARTIAL | `services/approvalService.js:request/decide`; runtime_approvals; recovery manualRetry | Specific approval flows, not full observe/pause/cancel/takeover/recover runtime |
| Organization | PARTIAL | `users.enterprise_id`, runtime enterprise scoping, approval tenant check | Tenant membership exists; Team/Responsibility/Accountability runtime not proven |
| Knowledge/Context | MISSING | W0 registry owner 05 is PLANNED with no known contract; envelope merely carries `organization_context`/intent | Passing context is not a Knowledge runtime; durable context snapshot/freshness resolver missing |
| Model Runtime | PARTIAL | `services/aiGateway.js:chat/providerRequest/getStatus`, provider request/response contract | Existing gateway, including dirty historical changes; no Kernel model adapter or resumed-model authority proof |

No claim of complete shared runtime follows from these components. Owner IDs and canonical vocabulary remain exactly those of `registry/realityos-module-registry.js`. Duplicate concept owner additions: 0.

## 2. W1 semantic compatibility freeze

Preserve all 18 W1 validated gates (`scripts/realityos-w1-kernel-test.mjs`) and associated counterexamples. No Authority → no Execution; lease valid at execution boundary; actor/principal/representation and capability/executor/tool binding stable; preflight necessary but not sufficient; Execution ≠ Effect ≠ Verified Outcome; independent Reality and Verification; Recovery evidence required; retry re-enters authorization; Provenance owner remains Evidence Runtime (13).

Only add durability, resume, integration and migration. Existing W1 factory/result/state vocabulary and reference tests remain compatible. W1 `failOutcome` may report FAILED after `EFFECT_UNCONFIRMED`: that is the reference **orchestration outcome**, not proof of business non-occurrence. W2 must preserve separate effect certainty; it cannot infer `NOT_OCCURRED` from that outcome. Any future need to change W1 lifecycle semantics requires separately approved migration, not a persistence-side reinterpretation.

## 3. One canonical envelope and version policy

Extend the envelope made by the existing `createKernelEnvelope`; do not introduce a second production envelope class/factory with different semantics. `kernel_version: 'W1'` is currently an implementation marker, **not** a stored-schema version.

| Field group | Current fields | W2 contract |
|---|---|---|
| Required core identity/context | `mission_id`, `goal_id`, `task_id`, `organization_context`, `actor_identity`, `principal`, `represented_principal`, `agent`, `executor`, `capability_id`, `tool` | Preserve names and meaning; existing optional/null shape stays compatible for reference callers; durable admission requires resolvable bindings and enterprise scope |
| Required execution/effect core | `execution_intent`, `execution_attempts`, `effect_declaration`, `expected_effect` | Preserve; attempts append new identity/history, never replace earlier attempt |
| Required governance/result slots | `authority_decision`, `authority_lease`, `capability`, `preflight_result`, `actual_reality_readback`, `evidence_refs`, `provenance_refs`, `verification_result`, `outcome`, `recovery_state` | Slots may remain null until corresponding stage; null never means pass |
| Required lifecycle core | `state`, `state_history`, `timestamps`, `correlation_id`, `trace_id`, `kernel_version` | Existing state transitions authoritative; trace correlation does not replace a run identity |
| Proposed optional durable extension | `durability` object containing `schema_version`, `run_id`, `attempt_id`, `revision`, `transition_id`, `transition_phase`, `authority_ref`, `lease_ref`, `effect_operation_id`, `idempotency_ref`, `readback_ref`, `verification_ref`, `outcome_ref`, `recovery_ref`, `human_control_ref`, `evidence_commit_ref` | Optional for legacy reference calls; mandatory validated subset at durable admission. These are candidate logical fields, **not actual database columns** |

Proposed schema version starts at 1 only when implementation is approved. Unversioned W1 envelope is valid as reference data; never automatically executable as a resumed durable job. Explicit import must validate, assign/reuse stable owner IDs, persist provenance and mark authority freshness unknown. Source snapshot is retained. Migration is deterministic, versioned, non-mutating of original evidence, and reversible by retaining old snapshot; rollback cannot replay effects.

Unknown additive metadata is preserved opaquely under an explicit extension namespace and never used for authorization or execution. Unknown core/security fields, missing required fields, unsupported major/schema versions, invalid revision and inconsistent IDs fail closed at durable admission; retain evidence and request review. No silent default, dropping fields, or automatic down-conversion. An older reader may inspect unsupported data but cannot resume it. State revision is optimistic concurrency, schema version is representation compatibility, and historical version is retained evidence: three distinct concepts.

## 4. Stable identity across restart

| Identity | Existing authority / ID | Durable requirement / gap |
|---|---|---|
| Mission / Goal / Task | W1 supplied `mission_id/goal_id/task_id` (owner03) | Reuse; validate resolution, no new per-restart identity |
| Run / Attempt | `runtime_runs.run_id`, `runtime_attempts.id` (owner10); W1 only attempt_no | Link existing run when already present; persistent attempt IDs absent in W1; number alone insufficient |
| Actor / Principal / represented principal | users.id + W1 identity objects (owner01) | Re-resolve membership and representation; no copying user ID into a second identity system |
| Authority decision / Lease | W1 `authority_decision.ruleRef` identifies a rule, not a decision instance; `authority_lease.lease_id` exists (owner04); recovery worker token is different | Reuse existing lease ID when valid; canonical durable decision identity/lease resolver missing; persist decision evidence, not reusable authorization |
| Agent / Executor / Capability / Tool | W1 descriptors; Core capabilityId; owner06/07/10 | Resolve same registry IDs/version; do not mint replacement entities on restart |
| Effect | Core `effectId` (owner11), defaults to canonicalEffect + colon + target (or `scope`) | Preserve/reference existing ID; default is semantic target identity, not unique operation-instance identity; durable operation binding still needed |
| Evidence / Verification | evidence_id (owner13); runtime_validations.id (owner14 integration candidate) | Reuse IDs and owner-scoped references, validate run/effect binding and integrity |
| Outcome | W1 value; runtime_outcome_feedback.id; canonical Outcome belongs to owner03 | Existing feedback row is a candidate link only, not automatically canonical Outcome or owner13 Evidence |
| Recovery | audit_recovery_jobs.id / attempts.id (owner15 adapter candidate) | Preserve parent/case/history; work claim token never becomes case identity |

Logical link tuple: enterprise scope + existing run_id + attempt_id + effect operation identity + trace_id; foreign IDs must resolve within scope. Correlation IDs aid tracing but never authorize access. Resolution failure blocks effectful resume.

## 5. Durable state contract

| Category | Content | Rationale |
|---|---|---|
| MUST_PERSIST | lifecycle state/history, current transition ID/phase, schema version, revision, run/attempt IDs, intent and intent digest, capability/tool bindings | Distinguish before-dispatch from uncertain dispatch; reject stale writers |
| MUST_PERSIST | authority decision/lease **references and snapshots**, identity/representation bindings, fresh-check timestamps | Immutable history; not current permission |
| MUST_PERSIST | effect operation identity, idempotency reference, dispatch-start marker, effect certainty, observation/readback state + refs | Restart cannot decide retry from lost memory |
| MUST_PERSIST | evidence/provenance refs and commit acknowledgement, verification state/ref, outcome, recovery case/history/eligibility, human-control requirement/decision refs | No fabricated completion; outstanding recovery must survive crash |
| MUST_PERSIST | created/updated/transition/attempt times, correlation/trace, failure and uncertainty causes | Audit and budget boundaries survive process restart |
| MAY_RECONSTRUCT | UI projection, progress summary, linked evidence display, provider/capability descriptive metadata | Only from durable versioned sources; current authorization/preflight re-evaluated, not reconstructed as old PASS |
| EPHEMERAL_ONLY | process PID, socket, active claim connection, callback/function, abort controller, timers, decrypted credentials | Never serialize live handles/secrets; credentials reacquired through existing security path |

Credential values, raw sensitive payloads and unbounded exception content are not checkpoint metadata. Use classified references/access checks/retention policy, not blanket payload copying. Candidate persistence adapter requires compare-and-set revision + atomic transition write; these guarantees are requirements, not existing capabilities.

## 6. Crash-safe transition contract

The names below are protocol boundaries, not new W1 enum entries. W1 actually transitions `EXECUTING → EFFECT_PENDING → READBACK_PENDING` on execution success, or `EXECUTING → EXECUTION_FAILED` on execution failure. `EFFECT_PENDING` already exists; `UNKNOWN` describes effect uncertainty, not a new W1 lifecycle enum. `transition_phase` is proposed durability metadata. “Commit” here means durable acknowledgement, not Git.

| Boundary | Persist/action order and crash gap | Resume / repeat / Readback / Human |
|---|---|---|
| AUTHORIZED → PREFLIGHT_PENDING | Append authority decision evidence + intent to enter preflight before evaluation; then record result | Missing result → re-evaluate read-only preflight. Old authorization stale; no effect. Human only on policy ambiguity/denial requiring approval |
| PREFLIGHT_PASSED → EXECUTION_PENDING | Persist preflight evidence and planned execution binding before dispatch admission | No dispatch marker is not alone proof no effect if writer consistency unknown; validate integrity. Reauthorize before any execution; stale/missing evidence blocks |
| EXECUTION_PENDING → EXECUTING | Persist attempt ID + operation ID + dispatch-start intent with CAS **before** effectful call | Crash after marker cannot distinguish not-sent/sent; READBACK_FIRST, no blind replay. Even absent marker needs guaranteed writer protocol. Human if unresolved/high risk |
| EXECUTING → EFFECT_PENDING/UNKNOWN | Effect may happen externally before local receipt. Persist receipt/error/uncertainty immediately; no claim of atomicity across systems | Missing receipt/timeout = uncertain. Repeat observation only; not effect. Independent readback mandatory; unresolved → Recovery/Human |
| EFFECT → READBACK_PENDING | Persist effect reference/certainty + observation intent before read-only readback | Repeat bounded readback allowed with new observation timestamp, retain earlier evidence. Inconsistent facts → Human, not overwrite |
| READBACK → EVIDENCE_PENDING | Capture observation snapshot and durable reference before advancing; Evidence append idempotent by stable evidence operation key | Crash before evidence ack → resolve reference or append same observation idempotently. If source observation lost, read again and mark distinct freshness; never invent snapshot |
| EVIDENCE → VERIFICATION_PENDING | Validate evidence existence/integrity/links and persist verifier input refs/version before verification | Deterministic/read-only verification may repeat on same snapshot; new evidence → new verification record. Missing/corrupt evidence blocks; conflicts → Human |
| VERIFICATION → OUTCOME | Persist immutable verification result first; CAS Outcome once, linked to evidence and verifier | Crash before Outcome → finalize same verified result only if freshness policy holds. No execute. Contradictory finalization → stop/Human |
| FAILURE → RECOVERY_REQUIRED | Persist failure/effect certainty + recovery requirement before dispatching Recovery; acknowledge case link | Crash between stores → reconcile stable case creation idempotently. Never drop failed attempt. Unknown requires readback; retry requires all gates; Human as risk/evidence dictate |

No global distributed transaction promised. Multi-store handoffs need durable pending link + idempotent acknowledgment/reconciliation. If the eventual store cannot provide this, effect admission remains blocked. Crash tests must exercise before and after each durable acknowledgement, not only happy-path serialization.

Any asynchronous persistence acknowledgment must finish before the final execution-boundary authority/lease/binding check; no storage await may be inserted between the final synchronous check and executor invocation. A persisted dispatch-start marker followed by denied authorization may conservatively require reconciliation, but never grants permission to dispatch. Record the denial as new evidence; safety takes priority over avoiding an extra readback.

## 7. Unified idempotency contract

Owner10 Execution owns request/run dedupe policy; owner11 Effect owns operation identity and effect dedupe semantics; owner15 Recovery references both, never invents a new logical effect just to retry. Tenant scope uses existing `enterprise_id`, not `tenant_id`.

- Scope: enterprise + capability/effect operation kind + stable business operation identity. Existing `business_operations` unique `(enterprise_id, operation_type, business_key)` and active recovery idempotency constraints are reuse evidence, not automatically a universal contract.
- Same logical request: same canonical intent digest and operation identity → return/link existing run, not a new effect. Same key + different intent → conflict, audit, no dispatch.
- Run may have multiple distinct attempts; every attempt has its own ID, but attempts for the same logical effect retain operation identity/idempotency binding. Fresh intentional business effect requires a separately authorized request, never inferred by Recovery.
- Lifetime: retain key/result/tombstone at least through maximum effect validity, retry/recovery window and required audit retention. Expiry/deletion must not silently permit replay. Concrete retention duration remains a policy decision and implementation gate.
- Provider-supported keys: bind provider scope/key and validate receipt/readback; provider idempotency alone does not establish real Outcome.
- No provider idempotency: durable single-writer admission plus operation correlation and authoritative readback; crash ambiguity means no auto-resend. If non-occurrence cannot be proven, Human/Recovery only.
- Retry requires independently proven `NOT_OCCURRED`, existing `retry_safe`, Recovery evidence and RETRY decision, budget, fresh Identity/Authority/Lease/Capability/Preflight. Idempotency replaces neither readback nor verification.

## 8. Effect uncertainty and resume decision

Reuse Core comparison `UNKNOWN`, W1 lifecycle `EFFECT_UNCONFIRMED`, and Recovery `UNKNOWN` in their own domains. Do not create a competing generic state enum. `MATCH/DIVERGED/UNKNOWN`, execution status and business final status are separate. Worker lease expiry, HTTP failure, W1 FAILED outcome or missing row alone never prove business failure.

Effect Unknown → authorized read-only Reality Readback → Evidence → independent Verification → Outcome / Recovery / Human Control. Never Unknown → Retry. Current `auditRecoveryService.reclaimExpiredLeases` returns jobs to pending work; that domain behavior is **not** approved as automatic replay of arbitrary effects in W2.

Proposed pure Resume Decision Contract input: versioned snapshot + current identity/authority/lease status + effect certainty and freshness + evidence completeness/integrity + verification/recovery state + risk class + human requirement/decision + idempotency binding. Output is a decision and reasons/evidence refs/required gates/allowed next transition; not a mutation, dispatch call, new W1 state or owner.

Ordered rules (first applicable; decision labels are proposed protocol results under Durable owner16, not new canonical lifecycle states):

1. Unsupported version, corrupted/cross-scope binding or irreconcilable terminal record → `TERMINAL_FAILURE` for resume admission; preserve case, no business failure inference.
2. Policy demands human, conflict, revoked permission needing review, unresolved high-risk uncertainty → `HUMAN_CONFIRMATION_REQUIRED`; only permitted read-only evidence collection may precede decision.
3. Effect uncertain or dispatch-start without trustworthy terminal observation → `READBACK_FIRST`; unavailable evidence source remains blocked/recovery, never execute. Read access must itself be authorized.
4. At readback/verification continuation boundary, corresponding effect/readback evidence is complete but verification missing/stale → `VERIFY_FIRST`; bounded independent verification, no effect. Authority/preflight evidence alone does not satisfy this condition.
5. Failure/outstanding recovery without eligible resolved plan → `RECOVERY_REQUIRED`; preserves case and blocks write.
6. Any proposed write with old/missing/currently invalid identity-authority-lease-capability-preflight → `REAUTHORIZE`; denial does not loop indefinitely, goes to policy stop/human.
7. `CONTINUE_SAFE` only for permitted read-only continuation, immutable verified outcome finalization, or the following distinct write-admission cases: (a) a first dispatch provably never entered the executor under an intact durable writer protocol, with **fresh** Identity/Authority/Lease/Capability/Preflight; (b) a retry after executor entry, requiring independent `NOT_OCCURRED`, `retry_safe`, Recovery RETRY decision/evidence, budget and all fresh execution gates. Absence of an in-memory result or untrusted missing marker is not proof for (a). The decision never bypasses the final synchronous execution-boundary recheck.

Terminal verified outcome is returned by reference, not re-executed. Every observation, evidence load, verification input and outcome read also requires current read permission and tenant scope; read-only is not authorization-free. Expired budgets stop; unresolved may stay pending with bounded recheck policy. Decisions cannot convert uncertainty to success/failure merely to finish a run.

## 9. Reauthorization compatibility

Old Authority decision, Lease check and Preflight result are immutable Evidence with time/version/bindings. They are never current permission after restart. Before a resumed write: resolve Identity/Principal/Representation → current Authority → current Authority Lease/revocation → current Capability/Tool/Executor binding → fresh Preflight → recheck immediately at dispatch. Save new decisions as new evidence linked to originals, never update old decision in place.

Worker fencing protects concurrent writers; it does not grant business authority. Human approval does not bypass lease, tenant scope, revoked actor or capability checks. If required authority source is unavailable, fail closed. W1 tests remain reference-adapter validation, not proof of production revocation or malicious adapter isolation.

## 10. Adapter contracts (interfaces only)

### Evidence — owner13

Proposed semantic operations: append immutable evidence (idempotent append key, scope, type/stage, run/attempt/effect/recovery links, classified payload/ref, provenance); return durable `evidence_id` + owner + integrity/commit acknowledgement; reference/load by tenant-scoped ID; validate existence/integrity/version/linkage; append linkage/provenance evidence rather than rewrite history. Confidential content access follows existing security policy. A valid shape alone is insufficient durable acknowledgment.

Kernel stores references and invokes adapter; it does not own evidence content or provenance semantics. Audit owner18 consumes evidence references, not a second provenance truth. Proposed snapshot store and Evidence store must reconcile pending links. A reference-memory adapter may remain for tests but cannot claim durability.

### Recovery — owner15

Proposed operations: create-or-reference case, append observation/decision, load case, resolve under CAS; all scoped and idempotent. Required logical content: case ID, origin run/attempt/failure evidence, effect operation/certainty, readback/evidence links, retry eligibility/reasons/budget, compensation status, human decision reference, reauthorization requirement, final resolution and timestamps. Compensation is another governed effect, not an automatic rollback.

Existing `audit_recovery_jobs/attempts/events/idempotency` are adapter candidates; no one-to-one mapping declared complete. Existing worker claims, manual retry, circuit and watchdog cannot stand in for Kernel admission. Preserve all attempts/failures; a final resolved case does not erase earlier failures. `retry_count` alone is not Recovery state.

### Human Control — owner17

Request: stable request/case reference, reason, risk, effect uncertainty, required evidence, requested decision, permitted actions, actor/representation/authority context, audit context, expiry and permitted transition scope. Response: decision (bounded to permitted actions), decision-maker identity/represented authority, timestamp, rationale, immutable evidence ref, allowed next transition and authority version/binding. Reject mismatched scope/expired decision; explicit deny/pause/cancel are not failures to overwrite.

No bare `approved: true`; no UI implemented. Human “retry” recommendation still requires proven non-occurrence and fresh execution gates. Unknown/high-risk UI may offer inspect/verify/escalate, not ungoverned re-execute.

## 11. Dependencies and initialization

Keep W0 ownership/dependency graph unchanged. Effect11 ↔ Reality12 reciprocal HARD dependency is a contract cluster: descriptors register before adapter activation; activate only when both ports plus Evidence/Authority readiness resolve. No constructor may execute a business effect or recursively start its peer. Recovery/Durable coordinate through IDs and immutable evidence. Static dependency validator PASS does not prove runtime startup or deadlock freedom; future initialization tests must.

## 12. Migration and backward compatibility

No Big Bang migration. Each path visibly marked `LEGACY` or `KERNEL_GOVERNED` in its contract/provenance; reference-only test paths cannot claim production governance. This is a contract label proposal, not a UI change. Pilot not selected or migrated here. W2 exit requires no bypass inside the selected pilot scope, not a false claim that every legacy path is governed.

Required per-path migration record:

| Field | Required evidence / gate |
|---|---|
| current entrypoint | actual route/service/caller and authentication chain |
| current authority | role/permission/tenant/representation checks; map to owner04 |
| existing effect | operation instance, class/risk, reversibility, provider idempotency |
| current readback | independently queryable authoritative facts and scope |
| evidence / verification | provenance, immutable refs, validator inputs/version, independence |
| recovery | unknown handling, budget, attempts, human/compensation boundaries |
| target Kernel entrypoint | existing `runKernel` through approved adapters; no second kernel |
| bypass removal | enumerate every caller; ensure old direct executor cannot be reached within governed pilot; negative tests |
| rollback | stop new governed admissions; preserve/reconcile in-flight IDs/effects/evidence; explicit routing rollback only after safe drain; never replay unknown work via legacy path |

Product does not acquire its own new Authority/Evidence/Verification/Recovery/Effect vocabulary. Additive compatibility must preserve existing IDs, records and behavior outside pilot; no schema change or migration script approved here.

## 13. W2 invariants and proof levels

| Invariant | First slice contract test | Later runtime proof still required |
|---|---|---|
| DURABILITY_DOES_NOT_CHANGE_W1_SEMANTICS | W1 18 gates unchanged | crash/restart with real adapters |
| ONE_CANONICAL_KERNEL_ENVELOPE | one extension/validator, no duplicate factory | durable store round-trip |
| STATE_VERSION_IS_EXPLICIT | invalid/unknown versions block resume | upgrade/rollback data retention |
| EFFECT_UNKNOWN_NEVER_BLIND_RETRIES | decision table never emits execute for unknown | effect crash fault injection |
| RESUME_WRITE_REQUIRES_REAUTHORIZATION | stale authority forbids write | real revocation/lease expiry at dispatch |
| HISTORICAL_AUTHORITY_DECISION_IS_IMMUTABLE_EVIDENCE | input immutability + append-only interface requirements | stored history immutability |
| EVIDENCE_OWNER_REMAINS_EVIDENCE_RUNTIME | owner13 and linkage validation | durable integrity/access proof |
| RECOVERY_STATE_IS_DURABLE | mandatory recovery refs/schema + acknowledgment contract | process restart recovers same case/history |
| IDEMPOTENCY_DOES_NOT_REPLACE_READBACK | key alone never admits verified outcome/retry | provider/no-provider crash duplicates |
| HUMAN_DECISION_IS_AUDITABLE | structured decision + identity/evidence required | authenticated human decision persistence |
| LEGACY_PATH_CANNOT_CLAIM_KERNEL_GOVERNANCE | provenance label consistency | real route/caller coverage |
| MIGRATED_PATH_CANNOT_BYPASS_KERNEL_GATE | migration manifest requirements | negative bypass integration tests |

Contract tests do **not** mark later runtime proof complete. These are frozen design requirements, not a new runtime achievement. Implementation approval applies only to the first pure-contract slice after the architecture baseline commit.

## 14. W2_0_SLICE_PROPOSAL

**Proposal: Canonical Durable Envelope Compatibility + Pure Resume Admission Contract.** No persistence implementation. This is the smallest slice because W1 already has canonical orchestration and reference adapters, whereas durable identity/version/resume decisions are missing.

### INCLUDED

- Pure versioned durable-extension validator/normalizer for the existing envelope; explicit reference-only vs durable admission, no second factory.
- Pure resume-decision evaluator with ordered fail-closed rules, immutable inputs and explicit required gates; no execute/readback/network/store calls.
- Evidence/Recovery/Human adapter interface requirements and acknowledgment shape validators; no adapter implementation.
- Stable identity/idempotency binding rules and deterministic compatibility/crash-boundary test vectors.

### EXCLUDED

Database/schema/migrations, real persistence, job scheduling/claims, product adapters/migration, business effects, UI, provider calls, deployment, full W2 platform runtime, compensation execution, OCR/PDF/Excel/PPT validation and large infrastructure. No modification of W1 semantic transitions to make tests pass.

### FILES_EXPECTED (next approved slice only)

- New candidate `services/realityosKernelDurabilityContract.js`: pure extension/adapter/resume contract under existing Kernel orchestration and owner16 rules; no new runtime owner or standalone envelope factory.
- New candidate `scripts/realityos-w2-contract-test.mjs`: contract test vectors, no DB/product dispatch.
- Existing `scripts/realityos-w1-kernel-test.mjs`: only if additional compatibility assertions cannot stay in the W2 test; original assertions retained.
- This contract document + `project.md`: actual implementation/evidence status only. No production import/wiring needed for this first slice. `services/realityosKernelService.js`, database files and `package.json` are not expected changes.

### TESTS_REQUIRED

W0/W1 unchanged regressions; W1 reference envelope accepted as reference but not silently resumed; explicit version/unknown-field/invalid binding cases; every required persistent category; stable IDs across serialized copies; same-key/different-intent conflict; all ordered resume branches; pre-dispatch first execution distinct from post-executor retry; authority-only evidence cannot trigger effect verification; unknown never execute; stale authority/lease and changed principal/capability; evidence owner/scope/integrity failures; structured human decision mismatch/expiry; recovery ref requirements; immutable input/history; finite budget handling; the nine crash-boundary vectors as pure decision tests; legacy/governed label contradiction. These tests cannot replace actual durability fault injection in W2.1.

### EXIT_CRITERIA

Approved exact changeset; pure modules contain no effects/storage/provider calls; all contract vectors + unchanged W0/W1 validators pass; `git diff --check` and applicable repository static/unit checks pass; no new owner/second envelope; no product migration; docs distinguish CONTRACT_ONLY from runtime evidence; next persistence slice remains approval-gated. Failure in a W1 gate blocks completion, not permission to alter that gate.

## 15. Unresolved implementation gates and disposition

W2.1 must separately choose storage transaction/CAS and multi-store reconciliation mechanism, evidence integrity/retention policy, authority/lease revocation source, context freshness rules, operation-key retention, and canonical owner-backed ID resolvers. Existing runtime/recovery tables are candidates, not proof they can hold the full envelope without changes. No SQL schema proposal is executed or approved here.

Architecture/contract review complete; the W2.0 pure contract slice is implemented as an unstaged candidate in `services/realityosKernelDurabilityContract.js` and `scripts/realityos-w2-contract-test.mjs`. Product Migration/Validation = NO, Source-of-Truth drift = NONE, new parallel architecture = NONE. Implementation changes require a separate Final Review and must remain unstaged/uncommitted. Push and Deploy = NO.

## 16. W2_0_CONTRACT_RUNTIME_SLICE_CANDIDATE

Implementation status: **CONTRACT_RUNTIME_SLICE_VERIFIED when tests pass**. This section records the current candidate only; it is not a durable store, product adapter, schema migration or real crash-recovery proof.

| Contract concept | Candidate implementation | Boundary |
|---|---|---|
| Canonical envelope compatibility | `services/realityosKernelDurabilityContract.js:validateEnvelope`, `extendCanonicalEnvelope` | Extends the existing W1 envelope with `durability`; no second factory and no mutation of the input envelope |
| Schema/version contract | `SCHEMA_VERSION = 1`; invalid, missing or unknown durability fields fail closed | Unversioned W1 envelope remains reference data and cannot be durable-resumed |
| Stable identifiers | Durability refs for run, attempt, transition, effect operation, idempotency, evidence, recovery and human control | Shape and binding contract only; IDs are caller-supplied, not minted or persisted |
| Durable field classification | `classifyDurableField` returns `MUST_PERSIST`, `MAY_RECONSTRUCT`, `EPHEMERAL_ONLY` or `UNKNOWN` | Classification does not prove storage durability |
| Resume admission | `decideResume` emits ordered decisions with `executionAllowed: false` for every branch | It is an admission recommendation; it never dispatches effects |
| UNKNOWN / effect uncertainty | `UNKNOWN` and untrusted dispatch markers route to `READBACK_FIRST` | Unknown never converts to success, failure or retry |
| Reauthorization | Write admission requires current authorization, lease, scope and binding freshness | Historical authority evidence cannot authorize resumed execution |
| Idempotency boundary | `compareOperationIdentity` detects same operation and same-key/different-intent conflicts | Duplicate identity does not verify a real effect |
| Adapter interfaces | `validateAdapter` checks Evidence, Recovery, Human and Durable Store shapes | Shape-only; `durabilityVerified` is always false |
| Evidence/Human contracts | `validateEvidenceReceipt`, `validateHumanDecision` require owner/scope/audit fields | No UI, persistence, crypto verification or authenticated human workflow implemented |

Candidate test evidence: `scripts/realityos-w2-contract-test.mjs` covers reference-vs-durable envelopes, version and unknown-field failures, safety-critical durable classification, readback-first for UNKNOWN, verify-first, fresh reauthorization, retry boundaries, human gates, idempotency conflicts, adapter shapes, Evidence owner scope, bounded Human decisions and the nine crash/resume boundaries as pure decision vectors. W0/W1 regressions remain required for final review.

### Final review classification

| Invariant | Current classification | Evidence boundary |
|---|---|---|
| DURABILITY_DOES_NOT_CHANGE_W1_SEMANTICS | RUNTIME/PURE_CONTRACT_VERIFIED | W0/W1 regressions remain green; W2 module does not import into W1 runtime |
| ONE_CANONICAL_KERNEL_ENVELOPE | RUNTIME/PURE_CONTRACT_VERIFIED | `extendCanonicalEnvelope` clones and extends the W1 envelope; no second production factory |
| STATE_VERSION_IS_EXPLICIT | RUNTIME/PURE_CONTRACT_VERIFIED | schema version 1 is required; unsupported version fails closed |
| EFFECT_UNKNOWN_NEVER_BLIND_RETRIES | RUNTIME/PURE_CONTRACT_VERIFIED | UNKNOWN and untrusted dispatch route to `READBACK_FIRST`, never execution |
| RESUME_WRITE_REQUIRES_REAUTHORIZATION | RUNTIME/PURE_CONTRACT_VERIFIED | current identity, authority, lease, binding and preflight freshness are required for write admission |
| HISTORICAL_AUTHORITY_DECISION_IS_IMMUTABLE_EVIDENCE | RUNTIME/PURE_CONTRACT_VERIFIED | old authority/preflight never grants resumed write; final boundary recheck remains required |
| EVIDENCE_OWNER_REMAINS_EVIDENCE_RUNTIME | RUNTIME/PURE_CONTRACT_VERIFIED + STATIC_GOVERNANCE_VERIFIED | Evidence receipt owner must be `13-evidence-runtime`; registry owner remains unchanged |
| RECOVERY_STATE_IS_DURABLE | NOT_YET_VERIFIED | recovery refs and adapter shape are defined, but no durable store or restart proof exists |
| IDEMPOTENCY_DOES_NOT_REPLACE_READBACK | RUNTIME/PURE_CONTRACT_VERIFIED | same operation identity never verifies effect; UNKNOWN still requires readback |
| HUMAN_DECISION_IS_AUDITABLE | RUNTIME/PURE_CONTRACT_VERIFIED | human decision shape requires actor, scope, rationale, expiry and evidence ref; no UI/persistence implemented |
| LEGACY_PATH_CANNOT_CLAIM_KERNEL_GOVERNANCE | STATIC_GOVERNANCE_VERIFIED | document/provenance boundary only; no product migration started |
| MIGRATED_PATH_CANNOT_BYPASS_KERNEL_GATE | NOT_YET_VERIFIED | requires future product migration and negative integration tests |

Pure contract verification is not persistence verification. Crash survival, CAS, evidence durability, recovery durability, product migration and production kernel readiness remain future W2.1+ gates.
