# Material Issue Browser Acceptance — Scenario A

## Scope and isolation

This record covers only **Scenario A: normal material issue**. It was executed
through the existing browser UI against the isolated SQLite fixture created by
`scripts/material-issue-fixture.mjs`; no development or production database was
used. The fixture contains a separate enterprise, requester, approver, and
normal inventory record.

Fixture invariant before execution:

| Field | Value |
| --- | ---: |
| Inventory ID | `fixture-normal` |
| Initial `stock_quantity` | 100 |
| `request_quantity` | 30 |
| `safety_stock` | 20 |
| Initial `version` | 0 |

The requested deduction leaves 70, which remains at or above safety stock.

## Scenario result

**Status: VERIFIED** — the UI, authenticated API, and isolated SQLite evidence
were all obtained in the same browser lifecycle.

| User action | Expected UI state | UI evidence | API evidence | Database evidence |
| --- | --- | --- | --- | --- |
| Requester logs in and opens Inventory | Real material issue workspace is visible | `真实领料申请`; normal fixture inventory shown as available 100 | Authenticated requester session established | Fixture enterprise and requester are isolated records |
| Requester creates and submits the issue | `WAITING_APPROVAL`; validator card shows the precheck | Card showed current 100, request 30, remaining 70, safety 20, expected version 0 | `POST /api/transaction-safety/preparations` returned 200 | Preparation and requisition created under the fixture enterprise |
| Separate approver logs in and approves | `APPROVED`; controlled-deduction action becomes visible | Approval card remained structured Validator JSON; execute button appeared | `POST /api/transaction-safety/preparations/:id/approval` returned 200 | Approval/preparation state persisted for the same preparation |
| Requester executes the approved issue | `COMMITTED`; inventory selector shows available 70 | Terminal state `COMMITTED` displayed after the controlled execution | Detail endpoint and requisitions endpoint each returned 200 and reported `COMMITTED` | Inventory, transaction fact, requisition, business transaction, and Runtime Trace all matched |

## API evidence

The post-execution authenticated reads returned HTTP 200:

- `GET /api/transaction-safety/preparations/:id` returned
  `preparation.status = COMMITTED`.
- `GET /api/transaction-safety/requisitions` contained the same fixture
  `business_operation_id` with `status = COMMITTED`.

The operation identifier and preparation identifier are generated per isolated
run and intentionally are not retained after fixture cleanup.

## Database evidence

The read-only query performed before fixture cleanup found:

| Source of truth | Before | After / verified fact |
| --- | --- | --- |
| `inventory.stock_quantity` | 100 | 70 |
| `inventory.version` | 0 | 1 |
| `stock_transactions` | no Scenario A row | one `INVENTORY_ISSUE`, `quantity_delta = -30`, `stock_before = 100`, `stock_after = 70` |
| `material_requisitions.status` | newly created | `COMMITTED` |
| `business_transactions.status` | newly created | `COMMITTED` |
| `runtime_runs` | newly created | execution `SUCCESS`, verification `VERIFIED` |
| `runtime_attempts` | trace created | 2 records |
| `runtime_validations` | trace created | 2 records |

## Acceptance boundary

This document verifies a normal, approved issue only. It does not verify
rejection, insufficient inventory, concurrency conflict, or `UNKNOWN`; those
remain separate scenarios. Browser automation is evidence for this isolated
fixture run, not a claim that all real-world inventory systems are integrated.

## Implementation boundary

The acceptance work changes only the unified verification runner and this
record. Material Issue service semantics, inventory transaction logic, approval
state machine, Runtime/Recovery, production APIs, and business UI behavior were
not changed.
