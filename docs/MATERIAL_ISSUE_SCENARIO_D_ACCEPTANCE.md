# Material Issue Browser Acceptance — Scenario D

## Scenario status

**NOT VERIFIED** — the real browser test verified early concurrent-request
protection, but the current business workflow prevents the required two
approved executions from ever competing on `inventory.version`.

The test used an isolated SQLite database through `DB_PATH` before startup.
It created two different real fixture users, two isolated BrowserContexts, and
two distinct JWTs. No development database, production user, hard-coded
administrator, or direct SQLite state manipulation was used.

## Fixture

| Field | Value |
| --- | --- |
| Shared inventory | `fixture-concurrent` / `FIX-CONCURRENT` |
| Initial stock | 50 |
| Initial version | 0 |
| Request A | 30 |
| Request B | 30 |

## Actual concurrent result

Both requesters sent their real browser `POST /api/transaction-safety/preparations`
actions concurrently.

| Request | Result | Classification | Evidence |
| --- | --- | --- | --- |
| B | Created, approved and executed | `SUCCESS` | `COMMITTED` via real UI/API |
| A | No preparation created | `EXPECTED_CONCURRENCY_PROTECTION` | API payload `SOFT_RESERVATION_CONFLICT` and UI displayed that code |

The winner is timing-dependent. The observed run produced B as the winner; no
claim is made that a particular requester must always win.

## UI evidence

- Two isolated requester contexts opened the Material Issue workspace with
  different authenticated sessions.
- The winning requester displayed `WAITING_APPROVAL`, then `COMMITTED` after a
  real administrator approval and real execute click.
- The losing requester remained without a preparation and visibly displayed
  `SOFT_RESERVATION_CONFLICT`.

## API evidence

- Both preparation requests returned real HTTP 200 responses.
- The winner response contained a preparation; the losing response contained
  `data.code = SOFT_RESERVATION_CONFLICT` for the active reservation of the
  shared inventory.
- The winner approval and execute requests completed through the normal API.

The loser is classified as expected concurrency protection only because its
response is the actual same-inventory, post-race `SOFT_RESERVATION_CONFLICT`.
It is not a generic rule that every HTTP 200 or every conflict is successful.

## SQLite evidence

| Fact | Observed value |
| --- | --- |
| Final `inventory.stock_quantity` | 20 |
| Final `inventory.version` | 1 |
| `INVENTORY_ISSUE` rows | 1 |
| `COMMITTED` inventory transactions | 1 |
| Winner requisition | `COMMITTED` |
| Loser requisition | absent |
| Loser agent task / Run Trace | absent |

This proves no repeated deduction or duplicate business fact was created in
the actual concurrent browser attempt.

## Why this is not full optimistic-lock verification

The real `transactionSafetyService.prepare()` checks for an active
`material_reservations` row before it creates a Run, Preparation, Requisition,
Transaction or Attempt. Therefore the second request is blocked before it can
obtain the same version snapshot, be approved, or send an execute request.

That is a valid early concurrency boundary, but it means this acceptance run
cannot prove an execution-time `CONCURRENCY_ABORT`, fencing outcome, or a
failure Run Trace for the blocked second request. Producing those conditions
would require bypassing the real Soft Reservation workflow or changing business
logic, both forbidden in this acceptance-only Sprint.

Existing controlled SQLite unit coverage still checks an externally changed
version maps to `CONCURRENCY_ABORT`; it is supporting evidence only, not a
substitute for the missing two-execution browser acceptance.

## Failure classification

There is no business failure, environment failure, or Harness failure in the
observed early-protection path. The acceptance status is `NOT VERIFIED` solely
because the stronger requested execution-race evidence cannot exist under the
current valid Soft Reservation rule.

## Test record

- `git diff --check`: passed.
- `npm run check`: passed.
- `npm run test:unit`: passed.
- `npm run build`: passed.
- `npm run verify -- --browser-only --material-issue-scenario-d`: completed;
  the Harness emitted `NOT VERIFIED` with the evidence above.
- `npm run verify -- --material-issue-scenario-d`: completed its full unified
  lifecycle (health, build, bug scan, browser and cleanup); the Scenario D
  Harness again emitted `NOT VERIFIED` with the same early-protection evidence.

No Material Issue, Inventory, Approval, Transaction Service, Runtime/Recovery,
schema, production API, or UI business logic was modified.
