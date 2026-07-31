# Scenario B Browser Root-Cause Record

## Classification

**Current Scenario B status: BLOCKED**

**Root-cause classification: TEST_HARNESS.** The latest timestamped run proves
that the Approver page, BrowserContext and Chrome CDP connection remain open
after the rejection API returns HTTP 200. The current runner then intentionally
calls the protected execute endpoint; its expected HTTP 409 is emitted by the
browser as a network-level console error and the generic red-console filter
incorrectly fails the run.

There was also a confirmed **test-harness isolation defect**: the former
Scenario B runner logged Requester and Approver into the same CDP page and
overwrote the same `localStorage` entry. That defect is corrected below, but it
was not proven to be the cause of Chrome's assertion.

## Confirmed browser lifecycle

The acceptance runner is not Playwright. It starts an externally managed
Google Chrome process from `scripts/verify.mjs`, enables the Chrome DevTools
Protocol (CDP), and runs `scripts/run-e2e.mjs` as the browser client.

| Concern | Previous behavior | Current test-harness behavior | Evidence |
| --- | --- | --- | --- |
| Browser creation | One Chrome process, remote debugging port 9222 | Unchanged; no production browser behavior is involved | `scripts/verify.mjs`, `runBrowserLifecycle()` |
| Context model | Default Chrome context and a reused CDP page | `Target.createBrowserContext` for each Scenario B role | `scripts/run-e2e.mjs`, `openIsolatedPage()` |
| Requester session | JWT was written to the page's `personal-ai-os-auth` localStorage key | Context A is closed after request creation | `setAuth()`, `closeIsolatedPage()` |
| Approver session | Same page localStorage was overwritten with Approver JWT | Context B is newly created, then real `/api/auth/login` provides a new JWT | `setAuth()`, `testMaterialIssueScenarioB()` |
| Cleanup | WebSocket closure could leave pending CDP work silently unresolved | Target, BrowserContext, page CDP and browser CDP are explicitly closed | `closeIsolatedPage()` |

## Session boundary

The intended Scenario B lifecycle is now:

```text
Create isolated SQLite Fixture
  → start application
  → BrowserContext A / Requester JWT login
  → create material request
  → close Context A
  → BrowserContext B / Approver JWT login
  → load approval record
  → reject
  → collect UI + API + SQLite evidence
  → dispose Context B and fixture
```

No cookies, localStorage, or JWT are shared between A and B. Both credentials
come from fixture `users` records and are exchanged only through the real
`/api/auth/login` path. No development account, JWT bypass, or test approval
endpoint is used.

## Failure evidence requirements now implemented

Each Scenario B context records:

- Chrome PID (provided by the verifier);
- CDP BrowserContext ID and Target ID;
- page URL;
- current acceptance step;
- creation and expected-close times;
- CDP disconnect time, close code, and reason when available.

On an unexpected CDP close, pending commands are rejected with an explicit
error. This prevents a disconnected browser from exiting acceptance execution
as a false success.

The Scenario B error record labels the exact step, such as
`Approver_Login`, `Approval_Page_Load`, or `Reject_Click`.

## Observed failures

Two prior fixture attempts reached Requester preparation, then Chrome reported:

```text
ERROR:base/observer_list.h:330] Check failed: observers_.empty().
```

After Context isolation, the latest run showed a normal Requester Context close
(an expected cleanup), created an Approver Context, and reached the real
rejection endpoint. The following sample, captured immediately after its HTTP
200 response, proved `browserConnected=true`, `pageClosed=false`, and one page
in the Approver BrowserContext. The eventual test failure was the expected
HTTP 409 from the deliberate post-rejection execute attempt, not a Chrome
disconnect.

## Disconnect Timeline

| Time (UTC) | Event | Object | State / evidence |
| --- | --- | --- | --- |
| 15:43:09.985 | page/context close requested | Requester Context A | Deliberate cleanup after `WAITING_APPROVAL` creation |
| 15:43:09.991 | `Inspector.detached` | Requester page | `Render process gone`; expected during Context A disposal |
| 15:43:10.021 | page CDP closed | Requester page | close code 1006, marked `expected_close=true` |
| 15:43:10.056 | browser CDP closed | Requester browser connection | close code 1000, marked expected cleanup |
| 15:43:12.809 | `before_reject_click` | Approver Context B | Browser open; page open; URL `/#/inventory`; context pages = 1 |
| 15:43:12.865 | `approval_response_received` | Approver Context B | POST approval HTTP 200; structured response body began with `ok: true` |
| 15:43:12.866 | `after_reject_response` | Approver Context B | Browser still connected; page not closed; context pages = 1 |
| later | protected execute attempt | Approver browser page | Expected HTTP 409; generic console-error assertion stopped the test |
| cleanup | Chrome exit | Verifier | exit code 0 during verifier cleanup |

This is not Case A, B, or C as an unexpected shutdown sequence. The only page
close before rejection was the intentional Requester Context disposal. The
post-rejection BrowserContext remained healthy; the correct classification is
therefore **TEST_HARNESS**, not business failure.

## Non-findings and scope

- No evidence links the failure to Material Issue service semantics.
- No evidence links the failure to inventory quantity/version updates.
- No evidence links the failure to approval authorization or state transitions.
- No browser result is treated as VERIFIED without UI, API, and SQLite
  evidence from the same run.

The changes are restricted to browser/CDP lifecycle and diagnostics. They do
not modify production code paths, Material Issue, Inventory, Approval,
Runtime/Recovery, schema, permissions, or APIs.
