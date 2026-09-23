# RealityOS Production-visible Runtime Surface

Status: IMPLEMENTED FOR CURRENT REAL RUNTIME DATA

This record documents the first read-only product surface for the existing
RealityOS durable runtime. It is a Control Plane / Operations Surface, not a
demo layer, not a second runtime, and not a production-readiness claim.

## Reality Audit

| Area | Current source of truth | Status | Notes |
| --- | --- | --- | --- |
| Kernel runs | `realityos_kernel_runs` | DURABLE_VERIFIED when table exists | Read-only projection only. |
| Kernel attempts | `realityos_kernel_attempts` | DURABLE_VERIFIED when table exists | Attempts are displayed only when recorded by the kernel store. |
| Kernel transitions | `realityos_kernel_transitions` | DURABLE_VERIFIED when table exists | UI timeline uses recorded transitions only. |
| Evidence | `realityos_evidence_receipts` | DURABLE_VERIFIED when table exists | Payload body is not exposed; metadata/reference only. |
| Verification | `realityos_verification_cases` | DURABLE_VERIFIED when table exists | Execution success is not treated as verification success. |
| Recovery | `realityos_recovery_cases` | DURABLE_VERIFIED when table exists | Automated recovery execution remains `NOT_READY`. |
| Jev adapter | `services/jevEffectClassificationProvider.js` | REFERENCE/RUNTIME CONTRACT VERIFIED | Real Jev provider runtime is `NOT_INTEGRATED`. |
| Enterprise identity | current JWT/users/enterprises + W2 refs | PARTIAL | W2.3 implementation not started. |
| Authority | W1/W2 refs + existing policy services | REFERENCE_ONLY in this surface | No enterprise authority durability claim is made. |

## Read Model

`services/realityosControlPlaneReadModel.js` projects existing canonical stores:

- `realityos_kernel_runs`
- `realityos_kernel_attempts`
- `realityos_kernel_transitions`
- `realityos_evidence_receipts`
- `realityos_verification_cases`
- `realityos_recovery_cases`

It does not create tables, seed records, or write any runtime facts.

## Product Surface

The product adds a read-only `RealityOS Control Plane` entry backed by:

- `GET /api/realityos/control-plane`
- `GET /api/realityos/control-plane/runs/:id`

The UI displays:

- runtime status counts;
- recent governed runs;
- run detail;
- execution timeline;
- effect reality / resume admission;
- evidence metadata;
- verification cases;
- recovery cases;
- Jev adapter vs real Jev runtime distinction;
- proof-level badges;
- missing Expected/Actual and Identity/Authority as `NOT_AVAILABLE` or `REFERENCE_ONLY`.

## Truth-only Rules

- Mock data used: NO.
- Fake runtime state used: NO.
- Parallel truth store: NO.
- Direct browser database access: NO.
- Mutating product path migrated: NO.
- Automatic recovery retry exposed: NO.
- Expected/Actual values are not fabricated.
- Enterprise identity and authority are not over-claimed.

## First Real Read-only Product Path

`FIRST_REAL_READ_ONLY_PATH = BLOCKED`

Reason: no existing product read-only path has yet been migrated through:

Product request → Identity/context available today → Capability → Effect
`OBSERVATION` → Preflight → Kernel Run → Execution → Reality Readback →
Evidence → Verification → Outcome.

This block is intentional. The Control Plane can expose current durable runtime
data now, but it does not create fake product traffic or use fixture data as a
product run.

## Validation

Targeted validation:

- `node scripts/realityos-control-plane-read-model-test.mjs`

Verified cases:

- zero-data state;
- real run list;
- run detail;
- transition sequence;
- UNKNOWN display;
- evidence lookup;
- verification pending;
- recovery required;
- Jev adapter vs real provider distinction;
- missing identity does not fabricate enterprise identity;
- missing Expected/Actual does not fabricate values;
- no mutation endpoint in the read model;
- no parallel truth store.

## Non-goals

- No W2.3 implementation started.
- No real Jev provider runtime integrated.
- No product mutation migrated.
- No production-ready or enterprise-pilot-ready claim.
