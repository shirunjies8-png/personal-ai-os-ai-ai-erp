# RELIABILITY-PREVENTION-1 Evidence Record

Status: `PARTIAL_RELIABILITY_AND_RECOVERY_BASELINE`.

This is a narrowly scoped frontend/runtime baseline. It does **not** claim zero
bugs, enterprise production readiness, or a continuously deployed recovery
worker. GitHub Pages remains `STATIC_DEMO_ONLY`; browser task storage is only
`LOCAL_DEMO_PERSISTENCE` for the same browser, device, and undeleted site data.

## Implemented evidence

| Requirement | Existing path / addition | Evidence |
| --- | --- | --- |
| Unified readiness | `Stability.resolveReadiness()` | `READY`, `DEGRADED`, `BLOCKED`, `UNKNOWN`; high-risk unknown resolves to blocked. |
| API failure boundary | `APIClient.request()` + `Stability.classifyApiFailure()` | HTTP/network/timeout/schema categories are structured; response schema mismatch stops use of the response. |
| Safe retry boundary | `Stability.canRetryApiFailure()` | Only safe reads may retry inside a bounded attempt policy; `UNKNOWN_OUTCOME` is never auto-retryable. |
| Save before execute | `App.runWithStability()` | Task becomes a persisted `READY` record with `INPUT_SAVED` verified checkpoint before work starts. |
| Persistence readback | `Store.persistTaskWithReadback()` | Writes then reads the local app state and compares task ID, input version, current step, and last verified step. A mismatch blocks execution. |
| Checkpoint and partial result preservation | `Stability.normalizeTask()` task fields | Draft and approved data, checkpoint list, last verified step, pending/failed step, evidence refs and append-only failure history are retained. |
| Safe resume | `Stability.safeResumeDecision()` | `UNKNOWN` is reconciliation-only; failed/suspended work resumes from the last verified checkpoint rather than silently completing. |
| User explanation | Task Center | Shows lifecycle state, current/verified step, persistence, recovery state and next action. |
| Existing durable recovery | `services/auditRecoveryService.js` | Existing server-side worker remains the recovery mechanism for its registered jobs; this phase did not create a second worker. |

## Failure-injection matrix

| Case | Result | Evidence / boundary |
| --- | --- | --- |
| A API base absent | PASS | Required API readiness returns `BLOCKED` before work. |
| B timeout | PASS | `AbortError` is `READ_TIMEOUT`; task becomes suspended with preserved checkpoint. |
| C 401 | PASS | Classified `AUTH_REQUIRED`. |
| D 500 | PASS | Classified `DEPENDENCY_UNAVAILABLE`. |
| E invalid schema | PASS | `expectedSchema` mismatch produces `SCHEMA_MISMATCH` and fails closed. |
| F/G circuit | PARTIAL | Existing AI Gateway and Audit Recovery circuits remain authoritative; this frontend baseline exposes retry safety but does not create a duplicate circuit registry. |
| H save + refresh serialization | PASS | Isolated contract test writes and reads task draft/approved values. |
| I verified steps 1–3, step 4 fails | PASS | `lastVerifiedStep` is retained and `SAFE_TO_RESUME` points to the pending work. |
| J write connection loss | NOT_APPLICABLE | No new safe business write probe was added; Material Issue recovery remains separately governed. |
| K manual correction survives | PASS | Draft and approved data are persisted separately. |
| L downstream stale | GAP | Task state stores input version but this phase does not retrofit stale invalidation into every business module. |
| M persistence failure | PASS | Readback failure throws `PERSISTENCE_FAILURE` and prevents execution. |
| N recovery preserves old failure | PASS | Failure history is append-only and remains on the task record. |

## Local reality proof

Date: 2026-08-24 (local isolated verification).

- `http://127.0.0.1:3210/` returned HTTP 200 from an isolated temporary SQLite
  process configured without `.env` or `.env.local`; `/api/health` also returned
  HTTP 200. No DeepSeek call was made.
- A system-Chrome/CDP browser test used an isolated temporary SQLite database,
  Chrome profile, application port 3211 and CDP port 9322. The login submit was
  a coordinate-validated trusted mouse event (`TARGET_HIT=PASS`,
  `TRUSTED_EVENT=PASS`).
- The test invoked the existing `runWithStability()` envelope with a local,
  side-effect-free controlled timeout, then performed a real page reload and
  reopened Task Center. It added no product fault endpoint or business write.
- Before and after reload, task ID `reliability-browser-fixture` remained the
  same, lifecycle remained `SUSPENDED`, last verified step remained `STEP_3`,
  and failure-history count remained exactly one.
- Contract-level task persistence/readback, checkpoint preservation and safe
  resume were verified by `scripts/reliability-prevention-test.mjs` without a
  business write or external request.

## Verification commands

- `node scripts/reliability-prevention-test.mjs`: PASS.
- `npm run check`: PASS.
- `npm run test:unit`: PASS. Existing test teardown emitted several
  `database connection is not open` seed warnings, but all test commands
  completed successfully; this phase did not change that teardown path.
- `npm run build`: PASS.
- `git diff --check`: PASS.
- `npm run verify`: `ENVIRONMENT_BLOCKED` at browser lifecycle setup. The
  verifier correctly refused to run because port 3000 was already occupied by
  pre-existing Node listeners. PID 12877 belongs to
  `<LOCAL_PROJECT_PATH>` (`node server/app.js`),
  and PID 20585 belongs to
  `<LOCAL_PROJECT_PATH>`
  (`node backend/server.js`). Neither process belongs to this repository, so
  neither was stopped. Port 9222 was free. No product E2E ran and this is not
  recorded as a product pass or failure.
- `npm run test:reliability:browser`: PASS on isolated ports 3211/9322.

## Full verifier environment closeout

`DEFAULT_VERIFY_ENVIRONMENT=BLOCKED_BY_UNRELATED_PORT_3000`.

With no port variables, `npm run verify` retained the established fail-closed
contract: it stopped before launching this application's server because port
3000 was already owned by unrelated local projects. It did not search for a
different port or terminate those processes.

`ISOLATED_FULL_VERIFY=PASS`.

With `VERIFY_APP_PORT=3212` and `VERIFY_CHROME_PORT=9323`, the verifier itself
started the application at `http://127.0.0.1:3212`; `/api/health` and
`/api/self-test` returned HTTP 200, fixture authentication succeeded, and
Chrome published CDP at `127.0.0.1:9323`. Both ports were confirmed released
during cleanup.

The initial intermittent entry failure was classified `PAGE_CDP_FAILURE`:
Chrome remained `ALIVE`, the Browser WebSocket was already closed after target
creation, and the Page WebSocket disconnected with code 1006 during
`Page.navigate`. The verifier now uses the same `--headless=new` lifecycle as
the stable clean-open runner and keeps Browser CDP ownership until its Page
session ends. The environment-only gate then completed two consecutive cycles;
each passed `Runtime.evaluate(1 + 1)`, `location.href`, `Page.reload`, and the
same evaluations after reload. Normal Page close was code 1000 with
`expectedClose=true`, while Chrome remained alive until verifier cleanup.

The OCR lifecycle investigation then separated target lifetime from transport
lifetime. A minimal OCR-page run completed navigation, reload, DOM access and
`Runtime.evaluate` with the same target. An OCR-only run also retained its
target and completed the existing 120-second contract as an explicit
`partial_success` / `request_timeout`, with manual confirmation required and no
mock result. No `Target.targetCrashed` or `Inspector.detached` event was
observed and Chrome remained `ALIVE`.

The full run showed that the raw per-page WebSocket failure was not tied to the
OCR renderer: after OCR completed, the next quotation page lost its Page
transport while the Browser process remained alive. The runner now keeps one
Browser WebSocket and uses `Target.attachToTarget({ flatten: true })` sessions
for ordinary pages. That change removed the cross-page 1006 failure: the next
full run completed chat, OCR and quotation, and reached the RFQ/inquiries
scenario.

The RFQ blocker was a test targeting defect, not an RFQ product failure. The
business context was ready (`loaded=true`, `loading=false`, `mode=server`),
authentication was valid, and the create button existed and was enabled, but
its centre point was outside the current trusted-input target before the
runner's submit step. The runner now scrolls that existing button into view,
re-measures it, requires `elementFromPoint` to hit the same action, and records
the capture-phase trusted click before accepting the POST.

RFQ-only then passed twice with fresh isolated fixtures. Both runs recorded
`isTrusted=true`, action `manufacturing-rfq-save`, HTTP 200, a unique created
RFQ and successful SQLite readback. Two subsequent isolated full verifier runs
completed Chat, OCR, Quotation, RFQ, Agent and Monitor. The final run also
released application port 3212 and CDP port 9323 during cleanup.

Root-cause classification for the original cross-page 1006 is
`PAGE_TRANSPORT_FAILURE`. The OCR product root cause remains unconfirmed. No
OCR/business code, automatic port fallback, process termination, E2E skip, or
catch-and-pass behavior was added.

The independent local browser recovery proof remains PASS after this verifier
change; it uses its own isolated 3211/9322 lifecycle and verifies trusted
input, task preservation, checkpoint preservation, failure preservation, safe
resume guidance, and local-demo non-duplication.

## Browser recovery reality proof

| Metric | Result | Evidence |
| --- | --- | --- |
| DATA_PRESERVED | PASS | Draft and approved fixture values survived a real reload. |
| CHECKPOINT_PRESERVED | PASS | `lastVerifiedStep=STEP_3` before and after reload. |
| FAILURE_PRESERVED | PASS | One timeout failure remained; it was not overwritten. |
| RESUME_POINT_CORRECT | PASS | Task remained suspended with `REQUIRES_RETRY` guidance for the unfinished step. |
| NO_DUPLICATE_EXECUTION | PASS (local demo scope) | Same task ID, one failure record, unchanged verified step; no second envelope execution occurred. This is not an enterprise exactly-once claim. |
| USER_GUIDANCE_CLEAR | PASS | Task Center displayed the verified step and the instruction to continue after dependency recovery. |

`PERSISTENCE_CLASS=LOCAL_DEMO_PERSISTENCE`.

`SERVER_DURABILITY=NOT_IMPLEMENTED`.

`GLOBAL_STALE_INVALIDATION=NOT_IMPLEMENTED`.

`ENTERPRISE_PRODUCTION_READY=NO`.

## Known gaps and non-goals

1. No general server-side durable task store was added; local task persistence
   is not enterprise durable storage.
2. No new endpoint probe matrix was added for every existing API. Health probes
   remain side-effect-free and task readiness does not claim endpoint-specific
   authorization evidence until the task actually has it.
3. No global downstream stale-invalidation retrofit was made.
4. No forced cancellation of synchronous handlers is possible; existing timeout
   containment records failure and prevents the UI from waiting indefinitely.
5. OCR, provider quality, Paddle bootstrap and ISSUE-OCR-001 were not entered.
6. No Material Issue, inventory, quotation/RFQ, schema, API, or Recovery Runtime
   core semantics were changed.
