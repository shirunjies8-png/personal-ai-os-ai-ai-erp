# RealityOS W1 Universal Kernel Baseline

Status: W1 KERNEL REFERENCE RUNTIME / RUNTIME VERIFIED / PRODUCT INTEGRATION NOT STARTED / COMMIT NO / PUSH NO / DEPLOY NO

This document is subordinate to the frozen W0 governance baseline and its machine-readable 21-module registry. It does not redefine module ownership.

## W1 Reality Audit

`W1_REALITY_AUDIT = COMPLETE`

The audit used the real repository at W1 implementation baseline `e31e3a3e8cb18eec4e41047ce4b8c1ccbfb3f086`.

| Kernel concept | W0 owner | Real repository evidence | Current reality before W1 | W1 reuse |
|---|---|---|---|---|
| Mission / Goal / Task | 03 Work Runtime | `services/trustedExecutionService.js`, `models/agentTaskModel.js` | Local and product-path task inputs existed; no canonical universal envelope | Canonical IDs are bound in the kernel envelope; no second task database was created |
| Identity / Principal | 01 Identity Runtime | `middleware/auth.js`, `models/userModel.js`, `utils/jwt.js` | JWT user identity enters real HTTP paths | Envelope references actor identity and principal; authentication remains owned by existing auth code |
| Represented Principal | 01 Identity Runtime | W0 registry; tenant context in users and runtime rows | Enterprise context existed, but represented-principal semantics were not a universal contract | Explicit represented principal is preserved end to end |
| Authority / Lease | 04 Authority | `realityos-core.js#evaluateEffectAuthority`, `services/permissionService.js` | Effect Authority contract and role checks existed; no universal lease gate | Existing effect authority is reused; the kernel adds fail-closed lease validation at the shared enforcement point |
| Agent / Executor | 06 Agent & Skill Registry | `services/agentRuntimeService.js`, `services/trustedExecutionService.js` | Multiple executors existed on separate paths | Kernel accepts an identified executor adapter; it does not create another Agent registry |
| Capability / Tool | 07 Tool / Connector Runtime | `realityos-core.js#CapabilityRegistry`, `services/toolRegistry.js` | Capability registry contract and real tools existed | Existing Capability contract and resolver boundary are reused |
| Preflight | 07 Tool / Connector Runtime / 10 Execution Runtime | `realityos-core.js#preflight` | Verified contract, integrated only on selected paths | Same preflight contract is mandatory before executor invocation |
| Execution | 10 Execution Runtime | `services/runtimeObservabilityService.js`, `services/trustedExecutionService.js` | Real run/attempt tables and path-specific execution existed | Kernel owns orchestration state, while executor and persistent run stores remain adapters/current owners |
| Effect | 11 Effect Runtime | `realityos-core.js` Effect Governance Contract v1 | Contract verified; production closure not universal | Existing effect request, expected effect and comparison functions are reused unchanged |
| Reality Readback | 12 Reality Runtime | product-specific SQLite/OCR readbacks; W0 registry | Real readbacks existed only inside product paths | Kernel requires a separate authoritative readback adapter after execution |
| Evidence / Provenance | 13 Evidence Runtime | runtime traces, OCR lineage, `runtime_validations` | Evidence fragments existed; no universal canonical store | Kernel only accepts references returned with owner `13-evidence-runtime`; reference runtime is explicitly in-memory |
| Verification | 14 Verification Runtime | `runtime_validations`, trusted execution validators, effect comparison | Independent validation existed per path | Verifier is a distinct adapter and cannot be replaced by executor success |
| Outcome | 03 Work Runtime | `runtime_outcome_feedback` through trusted execution | Path-specific outcome recording existed | Verified outcome is recorded only after independent verification |
| Recovery | 15 Recovery Runtime | `services/auditRecoveryService.js`, `audit_recovery_jobs`, `audit_recovery_attempts` | Governed recovery existed but was not wired to a universal kernel | Kernel exposes a Recovery decision boundary and requires recovery evidence; existing durable worker remains the future persistence adapter |

## Why the Previous Loop Was Not Universal

Before W1, Capability, Preflight and Effect Authority were reusable contracts, but Execution, Reality Readback, Evidence, Verification and Recovery were joined only inside individual product or service paths. No single runtime envelope preserved Mission, Task, Principal, Authority Lease, Executor, Effect, Readback, Evidence, Verification and Outcome through one state machine. Callers could therefore use strong local components without conforming to one cross-path enforcement sequence.

## Source-of-Truth Reuse

W1 does not create parallel owners:

- W0 `registry/realityos-module-registry.js` remains the module and concept ownership authority.
- `realityos-core.js` remains the reusable Capability, Preflight and Effect Governance contract.
- Identity authentication remains in JWT/auth/user code.
- Existing Runtime and Audit Recovery persistence remain the durable implementation evidence.
- Evidence Runtime remains the sole canonical Provenance / Lineage owner.
- The new kernel service is an orchestrator and contract enforcement point, not a second database, registry, authority service, evidence store or recovery worker.

`NEW_PARALLEL_ARCHITECTURE = NONE`

## Universal Runtime Envelope

The envelope carries:

- `mission_id`, `goal_id`, `task_id`
- `organization_context`
- `actor_identity`, `principal`, `represented_principal`
- `authority_decision`, `authority_lease`
- `agent`, `executor`, `capability_id`, `capability`, `tool`
- `preflight_result`
- `execution_intent`, `execution_attempts`
- `effect_declaration`, `expected_effect`, `actual_reality_readback`
- `evidence_refs`, `provenance_refs`
- `verification_result`, `outcome`, `recovery_state`
- `timestamps`, `correlation_id`, `trace_id`
- `state`, `state_history`

These names follow the W0 Canonical Vocabulary. The envelope references owners; it does not replace their internal models.

## Kernel State Machine

Success path:

```text
CREATED
→ CONTEXT_BOUND
→ AUTHORITY_PENDING
→ AUTHORIZED
→ PREFLIGHT_PENDING
→ PREFLIGHT_PASSED
→ EXECUTION_PENDING
→ EXECUTING
→ EFFECT_PENDING
→ READBACK_PENDING
→ EVIDENCE_PENDING
→ VERIFICATION_PENDING
→ VERIFIED
→ OUTCOME_RECORDED
```

Failure and recovery states:

- `AUTHORITY_DENIED`
- `PREFLIGHT_REJECTED`
- `EXECUTION_FAILED`
- `EFFECT_UNCONFIRMED`
- `READBACK_FAILED`
- `EVIDENCE_INSUFFICIENT`
- `VERIFICATION_FAILED`
- `RECOVERY_REQUIRED`
- `RECOVERING`
- `RECOVERED`
- `TERMINAL_FAILURE`

Every transition is checked against an explicit transition map. Invalid transitions throw `INVALID_STATE_TRANSITION`.

Terminal states are:

- `AUTHORITY_DENIED`
- `PREFLIGHT_REJECTED`
- `OUTCOME_RECORDED`
- `TERMINAL_FAILURE`

## Authority Enforcement

The only executor invocation occurs after all of these facts are true:

1. Effect Authority decision is `ALLOW`.
2. Authority Lease is `ACTIVE` and unexpired.
3. Lease principal matches the principal.
4. Lease represented principal matches the represented principal.
5. Lease permits the selected Capability.
6. Lease permits the selected Agent, Executor and Tool.
7. Lease permits the declared canonical Effect.
8. Capability resolves from the existing capability boundary.
9. Preflight returns `READY` or explicitly tolerated `DEGRADED` due only to non-blocking conditions.

Missing authority, an expired/mismatched lease, missing Capability or blocked Preflight results in zero executor calls.

## Effect and Reality Closure

`Execution Result`, `Effect`, `Reality Readback` and `Verified Outcome` are separate objects and stages.

Executor `SUCCESS` moves only to `EFFECT_PENDING`. A separate Reality Runtime adapter must return an authoritative observation and actual effect. The existing Effect Runtime comparison must return `MATCH`. Only then may Evidence and Verification begin.

## Evidence and Provenance

Canonical evidence is accepted only when its owner is `13-evidence-runtime` and it has an evidence identity. The kernel stores references, not a competing evidence database. The test-only reference Evidence Runtime is in-memory and proves the contract; durable canonical evidence integration remains a later integration task.

Recovery records separate evidence before any retry decision. The preserved provenance includes actor identity, principal, represented principal, Agent, Executor, Tool, authority rule and authority lease references.

## Independent Verification

The verifier is a separate adapter receiving execution result, authoritative readback, canonical evidence and effect comparison. Executor success cannot set `VERIFIED`. A verifier rejection ends in a governed failure even when execution succeeded.

## Recovery Boundary

Recovery is entered for execution, readback, effect, evidence or verification failures. The Recovery Runtime returns an explicit decision.

Automatic retry is permitted only when all conditions hold:

- Recovery decision is `RETRY`.
- Failure is explicitly `retry_safe`.
- Independent Reality readback for `EXECUTION_FAILURE` explicitly returns `NOT_OCCURRED`; executor flags alone cannot authorize retry.
- Recovery Evidence has a non-empty canonical reference, matching trace and stage.
- Attempt budget remains.
- Failure occurred before an unconfirmed external effect can be repeated.

Every retry returns to `AUTHORITY_PENDING`, requiring fresh Authority Lease validation and Preflight. Readback uncertainty, effect mismatch, insufficient evidence and verification failure are not automatically re-executed by the reference policy. Human review and durable recovery job integration remain explicit adapter responsibilities.

## Universal Reference Execution

The product-independent conformance fixture is a local reference counter. It has no OCR, document, ERP, UI or external-provider dependency.

Success path:

```text
Reference Mission / Task
→ represented enterprise principal
→ ALLOW rule + active scoped lease
→ registered local capability
→ preflight
→ one counter mutation
→ separate counter readback
→ Evidence Runtime record
→ independent verification
→ verified outcome
```

Failure/recovery path:

```text
Attempt 1 transiently fails before effect
→ recovery evidence
→ Recovery Runtime returns RETRY
→ fresh authority and lease validation
→ fresh preflight
→ Attempt 2 succeeds
→ readback
→ evidence
→ independent verification
→ RECOVERED
→ OUTCOME_RECORDED
```

## Kernel Invariants

The W1 conformance validator verifies:

1. `NO_AUTHORITY_NO_EXECUTION`
2. `NO_VALID_LEASE_NO_EXECUTION`
3. `NO_CAPABILITY_NO_EXECUTION`
4. `PREFLIGHT_FAILURE_BLOCKS_EXECUTION`
5. `EXECUTION_SUCCESS_IS_NOT_VERIFIED_OUTCOME`
6. `EFFECT_REQUIRES_READBACK`
7. `VERIFICATION_REQUIRES_EVIDENCE`
8. `INVALID_STATE_TRANSITION_REJECTED`
9. `RECOVERY_IS_AUDITABLE`
10. `REPRESENTED_PRINCIPAL_IS_PRESERVED`
11. `PROVENANCE_OWNER_REMAINS_EVIDENCE_RUNTIME`
12. `ONE_SOURCE_OF_TRUTH_PER_KERNEL_CONCEPT`

## Verification Level and Gaps

Verified now:

- Product-independent W1 envelope and state machine.
- Shared authority/lease/capability/preflight enforcement point.
- Separate execution, readback, evidence, verification and outcome stages.
- One successful reference path.
- One safe failure/recovery/reverification path.
- Twelve kernel invariants.

Not claimed:

- Production-ready W1 runtime.
- Durable kernel envelope persistence.
- Universal integration of existing product paths.
- Full delegation chain or organization model.
- Durable Evidence Runtime adapter.
- Durable Audit Recovery adapter wiring.
- Human Control UI or automatic compensation.
- W2 platform modules.
- Any product capability validation.

`ARCHITECTURE EXISTS ≠ PRODUCT CAPABILITY EXISTS`

`REFERENCE RUNTIME VERIFIED ≠ PRODUCTION INTEGRATED`

## Validation Commands

### Prior final semantic audit — 2026-09-20 (superseded by corrective verification below)

`FINAL_AUDIT_BLOCKED`: the existing validator's reference cases pass; this does not establish all authority and recovery invariants. This audit qualification supersedes broader verification claims above. No implementation or test code was changed in this audit.

Read-only, in-memory counterexamples using the existing test's reference adapters produced:

| Counterexample | Observed result | First boundary |
|---|---|---|
| Empty actor_identity object | Executor called once; OUTCOME_RECORDED | required() checks presence, not identity validity |
| Clock advances past Lease expiry during async Preflight | Executor starts after expiry; OUTCOME_RECORDED | Lease is not rechecked immediately before execution |
| Resolver returns a different capabilityId | Executor called once; OUTCOME_RECORDED | Resolved capability identity is not matched |
| Executor mutates then throws retry_safe=true | Two mutations, two attempts; eventual TERMINAL_FAILURE | Retry trusts flag without proving effect absence |
| Evidence adapter returns null for RECOVERY | Two calls; OUTCOME_RECORDED; empty recovery evidence reference | Missing recovery evidence does not block retry |
| Independent verifier throws | Promise rejected; VERIFICATION_PENDING; null outcome | Verifier exception has no governed failure transition |

W0, W1, Core, Effect Governance, Trusted Execution, Audit Recovery, npm check, unit tests and build all passed in the current audit. These tests do not cover the counterexamples above. Invariants 1–10 are runtime assertions of their tested cases, not universal proofs; 11–12 include static governance checks (owner and uniqueness). The full lease, capability and recovery-audit requirements are not satisfied.

Commit and staging are blocked pending approved minimal remediation and regression tests. W2, product validation, Push and Deploy have not started. Reference in-memory evidence remains REFERENCE_ONLY; no durable integration is claimed.

### Corrective verification — current candidate

`W1_CORRECTIVE_FIX_AUDIT = PASS / FINAL_COMMIT_APPROVAL_PENDING` for the scoped reference contract, not production readiness.

- Identity references use canonical non-empty string `id`; the same shape gate applies to actor, principal, represented principal, agent, executor and tool. Authentication remains outside Kernel with the Identity owner.
- Authority is evaluated again after asynchronous Preflight. Immediately before execution, current Lease, identity/binding snapshot, Capability and Preflight are checked without an intervening await. Binding changes are rejected rather than silently adopted.
- Requested `capability_id`, resolved Core `capabilityId`, and executor/tool `capabilityId` must match; Lease must authorize the same ID. No new registry or taxonomy is introduced.
- Entering executor means effects are possible. On exception, the independent Reality adapter is queried. Only explicit `NOT_OCCURRED`, canonical Recovery Evidence, policy RETRY, retry_safe and remaining budget can permit another attempt; fresh gates run again.
- Verifier exceptions are recorded as ERROR, including code/name/message; Recovery Evidence preserves the exception and the lifecycle ends in a failed Outcome, not VERIFICATION_PENDING.
- Evidence remains owned by `13-evidence-runtime`; reference ID, trace ID and stage must match. Durability and adversarial adapter isolation are not claimed.

Original invariants 1–10 and new invariants 13–18 are runtime assertions. Owner/uniqueness invariants 11–12 are static governance assertions, with additional runtime owner checks. New automatic groups: INVALID_IDENTITY_BLOCKS_EXECUTION, LEASE_MUST_BE_VALID_AT_EXECUTION_BOUNDARY, CAPABILITY_BINDING_MISMATCH_BLOCKS_EXECUTION, RETRY_REQUIRES_PROVEN_NO_EFFECT, RECOVERY_WITHOUT_EVIDENCE_CANNOT_RETRY, VERIFIER_EXCEPTION_CLOSES_LIFECYCLE. Additional controlled-clock and authorization/binding-revocation cases pass. The original successful safe retry remains covered via independent counter readback, not executor self-certification.

W0/W1/Core/Effect/Trusted Execution/Audit Recovery, npm check/unit/build and diff checks passed. Only the four W1 candidate files changed in this corrective task. No staging, commit, push, deployment, W2 or product Reality validation. Next: W1 Final Commit Review.

```text
node scripts/realityos-w0-governance-test.mjs
node scripts/realityos-w1-kernel-test.mjs
node --check services/realityosKernelService.js
node --check scripts/realityos-w1-kernel-test.mjs
git diff --check
```
