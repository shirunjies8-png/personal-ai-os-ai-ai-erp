# Material Issue Browser Acceptance — Scenario B

## Scenario

**Scenario B: Approver rejects a material issue.**

Required acceptance condition: the browser must show `REJECTED`; the protected
execute endpoint must reject a bypass attempt; and the isolated SQLite fixture
must prove that inventory quantity/version are unchanged, no
`INVENTORY_ISSUE` fact exists, and the requisition is `REJECTED`.

## Fixture boundary

The runner uses the existing isolated SQLite fixture only:

| Object | Fixture fact |
| --- | --- |
| Enterprise | Separate fixture enterprise |
| Requester | Real `users` row, role `操作员`, authenticated through `/api/auth/login` |
| Approver | Different real `users` row, role `企业管理员`, authenticated through `/api/auth/login` |
| Inventory | `fixture-normal`: stock 100, safety stock 20, version 0; request quantity 30 |

No development or production database is used.

## User actions and expected evidence

| Step | User action | Expected UI / API / SQLite evidence |
| --- | --- | --- |
| 1 | Requester logs in and opens Inventory | Real material issue workspace and JWT-authenticated session |
| 2 | Requester creates an issue | `WAITING_APPROVAL`, preparation and requisition under one business operation |
| 3 | Different approver logs in | Separate JWT identity and administrator authorization |
| 4 | Approver rejects | `REJECTED` in UI and detail API; rejection approval trace persisted |
| 5 | Attempt execution | Execute action hidden and protected execute request returns 4xx; no execution fact |
| 6 | Read fixture SQLite | stock/version unchanged; no `INVENTORY_ISSUE`; requisition `REJECTED`; transaction is not `COMMITTED`; Run/Attempt/Validation/Approval trace exists without `SUCCESS`/`VERIFIED` execution result |

## Verification status

**Status: VERIFIED**

The isolated browser acceptance run completed on 2026-07-31 with all three
required evidence classes. The requester and approver used different isolated
Chrome BrowserContexts and different real fixture JWT identities. The approver
rejection response was HTTP 200; the page then displayed `REJECTED` and did not
render an execute control.

The harness deliberately made one post-rejection execute request only after it
had independently confirmed the rejected preparation and requisition through
the API and the fixture SQLite file. Its raw response was:

```text
POST /api/transaction-safety/preparations/:id/execute
HTTP 409
{ "ok": false, "message": "预检查尚未获批或已终态，需重新发起申请", "detail": null }
```

It is classified as `EXPECTED_BUSINESS_BLOCK` / `PROTECTED_REJECTION`, not as
a generic successful 4xx. The classification is valid only for this exact
post-rejection execution step with the prerequisite API and SQLite evidence;
any 4xx from login, creation, approval, permissions, or an unconfirmed state
remains an `UNEXPECTED_FAILURE`.

SQLite evidence after the rejected execution attempt showed:

- `inventory.stock_quantity = 100` and `inventory.version = 0` (unchanged);
- no `stock_transactions` row with `transaction_type = INVENTORY_ISSUE` for
  the business operation;
- `material_requisitions.status = REJECTED` and
  `transaction_preparations.status = REJECTED`;
- no `business_transactions.status = COMMITTED`;
- retained Runtime evidence: one Run, Attempt and Validation, with the
  approval trace `REJECTED`; the Run is `BLOCKED` / `HUMAN_REVIEW_REQUIRED`,
  not execution `SUCCESS` / verification `VERIFIED`.

No business logic was changed to obtain this result.

## Runner hardening applied

The browser test transport now rejects outstanding CDP commands when Chrome
closes. This prevents an early browser exit from being reported as a successful
acceptance result. It is test-environment detection only; it does not alter the
Material Issue workflow, inventory transaction, approval state machine,
Runtime/Recovery, schema, UI behavior, or production APIs.

## Test record

- `git diff --check`: passed.
- `npm run check`: passed.
- `npm run test:unit`: passed.
- `npm run build`: passed.
- `npm run verify -- --material-issue-scenario-b`: passed, including the
  unified server/Chrome lifecycle, fixture login, browser UI path, API evidence
  and SQLite evidence.

No Chrome Crashpad warning occurred in the successful rerun. Earlier Chrome
lifecycle observations remain historical harness evidence, not a reason to
weaken Scenario B's three-evidence requirement.
