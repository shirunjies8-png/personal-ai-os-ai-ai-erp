# Material Issue Browser Acceptance — Scenario C

## Scenario

**Scenario C: insufficient inventory is blocked during controlled execution.**

Status: **VERIFIED**

The acceptance run uses an isolated SQLite fixture, injected through `DB_PATH`
before the application starts. It does not use a development or production
database.

| Fixture field | Value |
| --- | --- |
| `inventory.id` | `fixture-insufficient` |
| `product_code` | `FIX-INSUFFICIENT` |
| Initial `stock_quantity` | `10` |
| Requested quantity | `30` |
| `safety_stock` | `0` |
| Initial `version` | `0` |

The requester and approver are separate real `users` rows. Both authenticate
through `/api/auth/login`; the approver has the fixture's real administrator
role. No hard-coded administrator identity or development account is used.

## User actions and UI evidence

1. The requester logged in and opened the real Material Issue workspace.
2. The requester selected `FIX-INSUFFICIENT`, entered quantity `30`, and
   created an application. The UI displayed `WAITING_APPROVAL` with the
   Validator JSON card `STOCK_NEGATIVE`: current stock `10`, requested `30`,
   remaining `-20`, and “库存不足，禁止领料”.
3. The separate approver session read the same card and, under the actual
   current workflow, approved without an override. The UI then displayed
   `APPROVED` and the real execute control. This is recorded behavior, not an
   assumption that approval itself authorizes a stock deduction.
4. A new requester session clicked the real execute control. The UI became
   terminal `FAILED`; the execute control disappeared and the original
   `STOCK_NEGATIVE` reason remained visible.

## API evidence and response classification

The approval request returned HTTP 200. The real execution request also
returned HTTP 200, but its response payload contained
`data.preparation.status = FAILED` and the persisted business transaction
failure reason `business_rule_failed` / “最终库存或安全库存校验未通过”.

This is classified as **`EXPECTED_BUSINESS_BLOCK`**, not as success merely
because its HTTP status is 2xx. The classification requires all of these
preconditions: the fixture inventory is the insufficient record, the request
is quantity 30, the preparation and requisition are `APPROVED`, and the
execution request is the actual post-approval execute endpoint. Any other
unexpected response, timeout, browser failure, or mismatched state remains an
`UNEXPECTED_FAILURE`.

## SQLite evidence

After the attempted execution, the isolated SQLite database showed:

| Object | Verified fact |
| --- | --- |
| `inventory` | `stock_quantity = 10`, `version = 0`; neither changed |
| `stock_transactions` | no `INVENTORY_ISSUE` row for the business operation |
| `material_requisitions` | `status = FAILED` |
| `transaction_preparations` | `status = FAILED` |
| `business_transactions` | `status = FAILED`, never `COMMITTED` |
| Runtime trace | Run `FAILED` / `FAILED_VERIFICATION`; two attempts, two validations, approved decision trace retained |

The absence of an `INVENTORY_ISSUE` fact and unchanged inventory version prove
that the failed short transaction did not create a false inventory deduction
or ledger entry.

## Verification boundary

Scenario C is `VERIFIED` only because browser UI, authenticated API behavior,
and direct SQLite evidence agree. The acceptance Harness records the raw HTTP
status and response before classification; it does not treat all non-2xx
responses as failures or all 2xx responses as business success.

Failure categories remain:

- `BUSINESS`: real UI/API/SQLite facts disagree or a forbidden business result
  is observed.
- `ENVIRONMENT`: fixture, browser, process, network, or database isolation
  cannot be established.
- `TEST_HARNESS`: assertion or evidence extraction is incorrect while the raw
  evidence identifies the problem.

No Material Issue, Inventory, Approval, Runtime/Recovery, schema, production
API, or UI business logic was modified for this acceptance run.

## Test record

- `git diff --check`: passed.
- `npm run check`: passed.
- `npm run test:unit`: passed.
- `npm run build`: passed.
- `npm run verify -- --browser-only --material-issue-scenario-c`: passed with
  the complete isolated browser/API/SQLite evidence above.

The full `npm run verify -- --material-issue-scenario-c` quality-gate portion
completed through check, build and bug scan before the host's single-command
output window ended during browser startup. The later browser-only command
reused the same `verify.mjs` lifecycle and completed the Scenario C browser
phase successfully; it does not replace the recorded quality gates.
