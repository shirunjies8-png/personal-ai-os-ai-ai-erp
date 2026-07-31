# Material Issue Browser Acceptance Re-run

## Execution Environment

- Browser environment baseline: `27de76eb91f30c4b79ea7547eb327e93abad873e` (`fix: stabilize browser acceptance runtime`).
- Browser runner: `npm run verify` → `scripts/verify.mjs` → `scripts/run-e2e.mjs`.
- Runtime result: application health/self-test, Chrome CDP, existing browser E2E, process cleanup and port release all succeeded.
- Browser warning: Chrome emitted Crashpad/updater errors during shutdown; `npm run verify` exited `0`, so these warnings did not block the verified environment lifecycle.

## Evidence Rule

Only UI Evidence + API Evidence + SQLite Evidence from the **same isolated browser operation** can be `VERIFIED`. Existing `material-issue-api-test.mjs` and `material-issue-page-test.mjs` are useful automated evidence, but are not a substitute for that three-part human/browser proof.

## Scenario Results

| Scenario | Status | UI Evidence | API Evidence | DB Evidence | Issue |
| --- | --- | --- | --- | --- | --- |
| A — 正常领料 | NOT VERIFIED | The real workflow UI is implemented (`ui.js`: prepare/approve/execute actions), but no isolated applicant/admin browser operation was run. | Automated authenticated controller test covers prepare → approval → execute. | Automated SQLite tests cover `inventory.stock_quantity`, `inventory.version`, `stock_transactions`, `material_requisitions`, `business_transactions` and runtime trace records; not from a browser operation. | No existing isolated two-user browser fixture in the canonical runner. |
| B — 审批拒绝 | NOT VERIFIED | No browser rejection performed. | `transactionSafetyService.decide()` and authenticated API test cover rejection and self-approval restriction. | No same-operation browser SQLite read; existing automated tests are only supporting evidence. | Same fixture gap. |
| C — 库存不足 | NOT VERIFIED | No browser insufficient-stock submission performed. | Deterministic `conditionalDeduct()` and transaction tests cover non-negative stock protection. | Existing integration tests cover no successful ledger on failure, but not from this browser rerun. | Same fixture gap. |
| D — 并发冲突 | NOT VERIFIED | No simultaneous dual-browser execution performed. | Inventory version conflict is covered by existing transaction safety integration tests. | Existing tests verify `CONCURRENCY_ABORT` and ledger protection, not same-operation browser evidence. | Requires controlled parallel isolated browser fixture. |
| E — UNKNOWN | NOT VERIFIED | No safe browser operation can deterministically create UNKNOWN. | Runtime preserves UNKNOWN without automatic retry in existing recovery tests. | No Material Issue browser attempt trace with UNKNOWN exists. | No proven, side-effect-free UI trigger; no fault injection added by this sprint. |

## Findings

1. **No false upgrade:** Browser environment is `READY`, but that does not turn the prior Material Issue browser acceptance scenarios into verified results.
2. **Missing acceptance fixture:** The canonical E2E runner currently uses its normal application database and has no isolated test enterprise with two distinct approval actors plus seeded inventory. Using it for these scenarios would risk writing acceptance data to the ordinary local SQLite database.
3. **No business change made:** No Material Issue service, inventory transaction, schema, approval state machine or UI business logic was modified.

## Final Assessment

Real Material Issue browser acceptance standard is **not yet met**: `VERIFIED=0`, `NOT VERIFIED=5`, `BLOCKED=0`.

The next safe step is a separately approved enhancement to the existing canonical runner that supplies an isolated SQLite database, applicant/admin fixture and browser evidence collection. It must remain part of `npm run verify`; it must not create a second runner or alter Material Issue business behavior.
