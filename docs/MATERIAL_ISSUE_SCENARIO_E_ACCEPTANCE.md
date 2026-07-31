# Material Issue Browser Acceptance — Scenario E: Unconfirmed Execution Result

## Verification status

`NOT VERIFIED`

The final full unified run completed. The browser request was actually aborted
after dispatch and did not receive a response; the server then committed a
single real transaction. A later normal detail read established that result.

This is still not `VERIFIED`: code and runtime evidence do not support a claim
that the Material Issue workflow persists an `UNKNOWN` or
`PENDING_VERIFICATION` recovery state when the client disconnects after
dispatch.

## Scenario and fixture

- Isolated SQLite database, injected through `DB_PATH` before application start.
- Real fixture Requester and Approver users authenticate through `/api/auth/login`.
- `fixture-normal`: `stock_quantity=100`, `safety_stock=20`, `version=0`.
- Request quantity: `30`; a normal successful execution would produce `70`.

## Real uncertainty method

The browser invokes the existing Execute button. Test-only browser instrumentation
wraps that page's `fetch`, dispatches the real `/execute` request, then aborts
the browser request immediately. It does not change the server, response,
database, business state, or API route. The raw AbortError / response observation
and timestamps are retained by the Harness.

This is a client-result-unavailable condition, not a fabricated `UNKNOWN` row.

## Required evidence and current boundary

| Evidence | Requirement | Result |
| --- | --- | --- |
| UI | Requester creates request; Approver approves; execution result is unavailable to client | `APPROVED` remained visible with Execute still shown; browser displayed `scenario_e_client_result_unavailable` |
| API | Later normal detail read and guarded repeat Execute are captured | Detail: HTTP 200 / `COMMITTED`; repeat Execute: HTTP 409 |
| SQLite | Inventory, ledger, requisition, transaction and Run Trace are read after the aborted client request | One committed transaction, one ledger row, trace retained |
| Recovery | No repeated request may create a second issue | Repeat Execute did not create another ledger entry or increment inventory version |

The run cannot be `VERIFIED` unless all evidence shows a real persisted UNKNOWN or
pending-verification state governed by the existing production workflow. A
successful later detail read alone is not a substitute for that missing state.

## Current implementation limitation

`services/transactionSafetyService.js` permits `UNKNOWN` as a terminal
operation state and prevents its execution, but the current real Material Issue
execute route does not create it on client timeout/disconnect. Its synchronous
execution either commits or records a defined failure before returning. The
browser can therefore lose the response while the server completes, but the
system does not persist that uncertainty for recovery governance.

## Actual evidence

- Client dispatch: `2026-07-31T16:54:42.559Z`; abort one millisecond later.
- The client recorded `scenario_e_client_result_unavailable` and observed no
  response. This is a genuine client-side unknown outcome, not a fabricated
  database state.
- Before manual read, SQLite showed `stock_quantity=70`, `version=1`, one
  `INVENTORY_ISSUE` ledger entry, `COMMITTED` requisition and transaction, and
  Run Trace `execution_status=SUCCESS` / `verification_status=VERIFIED`.
- Manual UI/API re-read showed `COMMITTED` and removed the Execute control.
- A repeat Execute returned HTTP 409; SQLite remained at stock 70, version 1,
  and one ledger entry. No duplicate side effect occurred.

The trace is complete for the actual completed execution, but it is not an
`UNKNOWN` trace: the current system does not retain the client-result-unavailable
condition as a governed recovery state. Manual re-read resolves the fact; no
separate recovery action is exposed.

No business service, inventory logic, approval state machine, Recovery Runtime,
schema, production API, or UI business logic was changed by this acceptance work.

## Prior transient environment evidence

Two earlier browser-only attempts of
`npm run verify -- --browser-only --material-issue-scenario-e`
started the isolated-fixture process. In each attempt the server printed
`Personal AI OS server running on http://127.0.0.1:3000`, immediately exited
with `code=0`, and the verifier timed out waiting for
`http://127.0.0.1:3000/api/health`. No Chrome process was started, no fixture
business transaction was executed, and no UNKNOWN conclusion was manufactured.
The final full `npm run verify -- --material-issue-scenario-e` run was READY
and produced the evidence above.

## Test record

- `git diff --check`: passed.
- `npm run check`: passed.
- `npm run test:unit`: passed.
- `npm run build`: passed.
- `npm run verify -- --material-issue-scenario-e`: completed; Browser
  Environment READY, Scenario E status `NOT VERIFIED` for the persisted-UNKNOWN
  requirement stated above.
