# P0 Security & Privacy Gate 1

Status: **implemented as a minimum fail-closed contract**. This does not make the product production-ready or alter its existing `LOCAL_DEMO_PERSISTENCE` boundary.

## Reused implementation

The gate extends [securityPolicyService.js](../services/securityPolicyService.js) for policy, authority, approval, and tool decisions; it extends [aiRedactionService.js](../services/aiRedactionService.js) for recursive log/audit sanitization. Existing role capability checks, JWT authentication, `utils/logger`, and the AI gateway remain their respective sources of truth. No parallel policy, redaction, or permission engine was introduced.

## Data classification and local-first rule

`PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, and `SENSITIVE` are the only recognized classifications. Missing or unrecognized classification is `UNKNOWN`, which is treated as sensitive for outbound decisions and is denied. The default processing location is `LOCAL`; confidential data may use `CONTROLLED_SERVER` only when a future controlled policy authorizes it. `EXTERNAL` is never inferred from model capability.

## Outbound gate

`evaluateOutboundDecision()` and `canSendToExternalAI()` require an actor, purpose, non-global data scope, tool, destination, classification, and a matching explicit policy. The policy must identify itself and enumerate classification, destination, purpose, data scope, and tool. The default is `DENY`.

| Classification | External handling |
| --- | --- |
| PUBLIC | Allowed only with matching explicit policy. |
| INTERNAL | Allowed only with matching explicit policy and `REDACTED` status. |
| CONFIDENTIAL | Denied without matching explicit policy; redaction is required when a policy exists. |
| SENSITIVE / UNKNOWN | Denied. |

The live AI gateway invokes this gate immediately before its provider request. A denied result returns `security_blocked`; it does not invoke the provider, retry, or create a chargeable call. Mock and unconfigured modes retain their existing, clearly labelled behavior.

## Authority and Tool Guard

Authority is separate from login access and role: every request must explicitly name an actor, action, resource, and non-global scope. The action set is `READ`, `CREATE`, `MODIFY`, `DELETE`, `SEND`, `PUBLISH`, `APPROVE`, `PURCHASE`, `PAY`, and `CONTROL`; a read grant never implies a write grant.

`ToolGuard.evaluate()` combines an explicit permission decision, authority decision, outbound decision, and approval decision. It returns only `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`, with policy/authority/outbound decisions and a risk class. `DELETE`, `SEND_EXTERNAL`, `PUBLISH`, `PURCHASE`, `PAY`, `INVENTORY_WRITE`, `MES_WRITE`, `DEVICE_CONTROL`, and `PERMISSION_CHANGE` require a distinct human approval. An AI agent cannot approve its own action.

## Secret-safe observability and minimization

`sanitizeForLog()` recursively redacts credential-bearing keys and text patterns. `sanitizeAuditRecord()` retains only permitted metadata: actor, action, decision, policy ID, resource type, classification, destination, timestamp, request ID, and `credentialPresent`. It never preserves raw authorization headers, tokens, passwords, or prompts. `minimizePayload()` emits a reference ID when available, otherwise only caller-selected fields.

## Production boundary

This is a local contract and test gate, not a claim of enterprise security, production readiness, zero data loss, or durable server recovery. External AI use remains fail-closed until an authorized caller supplies a data classification and explicit outbound policy. No live provider call is made by this phase.

## Verification

`scripts/security-privacy-gate-test.mjs` covers unknown/sensitive denial, explicit public/internal allow cases, action/scope authority denial, agent self-approval denial, secret redaction, high-risk approval, payload minimization, and a provider-call prevention proof.

## Full verification closeout

The earlier long-running OCR failure was classified as `TEST_RUNNER_LIFECYCLE_FAILURE`, not a product or renderer failure. The runner now observes Chrome ownership through a separate, read-only browser transport every ten seconds, bounds individual CDP calls without treating a method timeout as ownership termination, and explicitly proves `Runtime.evaluate -> Page.reload -> Runtime.evaluate` after the OCR terminal state.

Two isolated OCR-only runs and the final full verifier completed with Chrome alive, the browser WebSocket open, the page target present, the flattened session attached, no detach reason, and no target crash during the OCR window. The real `current` provider reached the existing fail-closed `partial_success / request_timeout` state with manual confirmation required, no mock fallback, and no fabricated OCR data. This is browser-runner qualification evidence; it does not claim that Tesseract produced usable text or that the product is production-ready.
