# BUG-MONITOR-UX-AUTO-RECOVERY-1

Status: LOCAL IMPLEMENTATION — NOT PUSHED / NOT DEPLOYED

## Capability boundary

This phase governs presentation, classification, deduplication and explicitly approved low-risk recovery. It does not add a general-purpose recovery Agent and does not alter RFQ, OCR, inventory, approval, Security/Privacy Gate or database semantics.

The global Bug Monitor shows only `CRITICAL` / `BLOCKING` `CURRENT_BUG` records, explicit current-task blockers, and high-impact `UNKNOWN` records that may affect correctness or security. Low-risk current failures remain in Error Center. `EXPECTED_DEGRADED`, `GUIDANCE`, `SYNTHETIC_TEST`, `HISTORICAL_RESOLVED` and `AUTO_RESOLVED_VERIFIED` never activate the global monitor.

Error Center separates:

- Current: `CURRENT_BUG`, `UNKNOWN`.
- History: `HISTORICAL_RESOLVED`, `AUTO_RESOLVED_VERIFIED`, manually resolved records.
- Diagnostic / Developer: `EXPECTED_DEGRADED`, `GUIDANCE`, `SYNTHETIC_TEST`.

Existing self-test records are explicitly marked `SYNTHETIC_TEST` and retain their existing safe cleanup contract.

## Deduplication and evidence

Unresolved records with the same signature update the existing record. They retain `firstSeenAt`, update `lastSeenAt`, increment `occurrenceCount`, and replace only `lastEvidence`. Historical incidents and recovery attempts remain independently traceable; no original failure is deleted.

## Known safe recovery contract

Automatic recovery is fail-closed. Eligibility requires all of the following producer facts:

- known;
- deterministic;
- low risk;
- reversible or otherwise safe;
- no unknown outcome;
- no high-risk authority;
- no security-boundary change.

The runtime denies `UNKNOWN`, unknown write outcomes, inventory/MES/device commands, payment, purchase, quotation send, approval changes, permission or secret changes, deletion, overwrite and security-policy operations.

An eligible recovery still cannot close a record based on the action return value. The required evidence sequence is:

`ACTION -> ACTUAL STATE READBACK -> VALIDATION -> REVALIDATION -> AUTO_RESOLVED_VERIFIED`

Failure at any stage preserves the original failure and recovery attempt evidence, returns the record to `CURRENT_BUG` or `UNKNOWN`, and requires human/developer action. `UNKNOWN` always requires a Situation Check and is never automatically retried or closed.

The first approved product handler is limited to reinitializing the known local Error Center view state. It has no business-data side effect and cannot alter authority, security policy or external state.

## Verification scope

`scripts/bug-monitor-recovery-test.mjs` covers the 16 governed classification and recovery cases. `scripts/bug-monitor-recovery-browser-test.mjs` uses an isolated SQLite database and isolated system-Chrome profile to verify the rendered global monitor, default Error Center filtering, actual safe action, readback, validator, revalidation and original-failure preservation.

These tests do not claim that arbitrary failures are automatically recoverable. No database schema, DeepSeek LIVE integration, deployment or production background worker is introduced.
