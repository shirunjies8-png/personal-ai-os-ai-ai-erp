# RELIABILITY-PREVENTION-1 — FILES_TO_CHANGE

Status: implementation scope record (not a release or production-readiness claim).

## Purpose

Add a small, evidence-based reliability baseline to existing startup, API and
task-record paths. It must preserve user input before external execution,
classify failures, fail closed for unknown high-risk readiness, and provide a
safe resume decision without introducing a parallel recovery platform.

## Approved files

| File | Purpose |
| --- | --- |
| `core.js` | Extend the existing `Stability`, `APIClient`, and `Store` contracts with runtime readiness, failure taxonomy, minimal task/checkpoint state, safe retry/circuit policy, and local persistence readback. |
| `app.js` | Make the existing `runWithStability()` save and verify task state before work, preserve failure history/checkpoints, and expose a safe resume decision through the existing task records. |
| `ui.js` | Display the existing task record's verified checkpoint, recovery state, persistence state, and next safe action in Task Center. |
| `scripts/reliability-prevention-test.mjs` | Isolated, no-network contract tests and fault injections for readiness, API taxonomy/schema failure, persistence readback, checkpoint/resume, stale invalidation, and failure-history preservation. |
| `scripts/reliability-prevention-browser-test.mjs` | Isolated 3211/9322 system-Chrome CDP reality proof for trusted login, task persistence, controlled failure, refresh and Task Center recovery evidence. |
| `scripts/verify.mjs` | Preserve the default 3000/9222 fail-closed lifecycle while allowing an explicitly supplied, preflight-checked isolated application/CDP port pair for full verification. |
| `scripts/run-e2e.mjs` | Keep Browser CDP ownership alive for each created page, add bounded disconnect evidence, and qualify the existing runner with evaluate/location/reload/evaluate checks before business E2E. |
| `package.json` | Add only the independent `test:reliability:browser` command; it is intentionally not folded into `test:unit` or `verify`. |
| `docs/reliability-prevention-1-record.md` | Evidence record, current boundary, failure-injection result matrix, known gaps, and local-demo persistence limitation. |

## Explicitly excluded

- OCR, PaddleOCR, Tesseract and provider changes.
- DeepSeek configuration, calls, secrets or secret inspection.
- Material Issue, inventory, quotation, RFQ, Recovery Runtime semantics, database schema, and server deployment changes.
- `anime-pocket-agent/` (unread, untouched, unstaged).
- Commit, push, deployment, or any real business write used as a probe.

## Evidence policy

Readiness is task-specific. `UNKNOWN` is never treated as `READY`; for a
high-risk task it resolves to `BLOCKED`. Browser localStorage persistence is
only `LOCAL_DEMO_PERSISTENCE`, not enterprise durable storage.
