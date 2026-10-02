# Valve Real Workflow UI + Backend Integration Entry Review

**Review status:** ENTRY_REVIEW_COMPLETE — design only
**Scope:** first read-only product workbench slice
**Implementation status:** NOT_STARTED
**Source privacy:** CONFIDENTIAL / LOCAL_PRIVATE
**Product truth:** no client project, quotation, product match, drawing, or bid submission is created by this review.

## 1. Decision

The first product surface is a read-only **阀门招投标工作台** (`#/valve-tender`). It exposes only a redacted projection of the already verified local DOCX parser and Reference Tender Template Foundation.

It is not a second Runtime, a template editor, a quotation screen, or a demo dashboard. The canonical owners remain:

| Concern | Canonical owner | First-slice use |
|---|---|---|
| DOCX structure and source provenance | `valveReferenceDocxParserService` / Foundation | server-only parse and projection |
| Reference-only boundary | `valveReferenceTenderTemplateService` | every returned candidate is marked `REFERENCE_ONLY` |
| Authenticated actor | `middleware/auth.js` | existing JWT `req.user` |
| Existing admin decision | `adminRequired` / security policy | initial access gate |
| Governed read-only execution | `realityosKernelService`, durable store and linkage | reuse as an observation path; no new runtime |
| Evidence/verification/recovery truth | existing RealityOS durable stores | metadata/reference only |

The first slice is approved only as a proposal. It must not be treated as a product capability until its real parser, API, UI, evidence, and browser readback are verified.

## 2. Entry evidence

### 2.1 Reference data

| Fact | Evidence | Status |
|---|---|---|
| Reference DOCX is locally/private controlled | Valve Foundation and parser final review | VERIFIED |
| Approved DOCX SHA-256 | `1c7e6c72046e5d2a79715b30c4f6097b8bf11f3fef08248e7538a8f3e78ac878` | VERIFIED |
| Parser result | 969 paragraphs; 5 top-level tables; 75 top-level rows; 2 merged-cell tables | VERIFIED |
| Candidate provenance | `source_document_id`, full internal hash, locator, extraction method | VERIFIED |
| Classification | `REFERENCE_ONLY` | VERIFIED |
| Client-project truth / quotation / product matching | no existing implementation evidence | NOT_IMPLEMENTED |

The browser must never receive the local source path, raw OOXML, complete source text, or unredacted `sourceNodes`. Full source hash remains internal; UI may receive only a fingerprint.

### 2.2 Existing product and backend surface

| Surface | Real evidence | Classification |
|---|---|---|
| Frontend | vanilla JS shell: `index.html` → `config.js` → `core.js` → `ui.js` → `app.js`; hash routing | RUNTIME_VERIFIED architecture |
| Navigation/design system | `ui.js` module registry, core navigation; `styles.css` responsive grid/table patterns | RUNTIME_VERIFIED architecture |
| API client | `core.js` `APIClient`, JWT header and AbortController timeout; `RuntimeConfig.API_BASE_URL` | RUNTIME_VERIFIED architecture |
| Server/router | `server.js` mounts `routes/index.js` under `/api`; JSON, Helmet, CORS and static SPA fallback | RUNTIME_VERIFIED architecture |
| Dashboard | `GET /api/dashboard` is JWT-authenticated, governed observation via `governedDashboardService` | DURABLE_VERIFIED first path |
| Control Plane | `/api/realityos/control-plane` and `/runs/:id`; JWT plus `adminRequired`; canonical durable-store projection | DURABLE_VERIFIED / READ_ONLY |
| Durable reality tables | `realityos_kernel_runs`, attempts, transitions, evidence receipts, verification cases and recovery cases | DURABLE_VERIFIED, conditional on actual rows |
| Current identity | JWT-derived user and `enterprise_id`; admin/operator/viewer normalization | PARTIAL |
| Enterprise/represented principal/delegation | W2.3 is incomplete | PARTIAL / REFERENCE_ONLY / NOT_IMPLEMENTED |

### 2.3 Current demo signals that the Valve slice must not inherit

The public Pages build is explicitly `STATIC_DEMO_ONLY` when it has no configured API gateway. `index.html` brands the current build as an RFQ demo. `app.js` contains demo-local session promotion and hard-coded quotation/sample helpers, while selected UI state uses local browser persistence. These are existing product facts, not acceptable truth sources for the Valve workbench.

The new workbench must therefore have no fallback fixture, sample template, local-storage template cache, synthetic statistics, or “parse succeeded” visual state. Missing source data must be displayed as a real unavailable state.

## 3. Required first slice

### 3.1 User-facing route and placement

- **Route:** `#/valve-tender`
- **Label:** `阀门招投标工作台`
- **Placement:** Core user navigation adjacent to existing inquiry/quotation work, not a new top-level Runtime.
- **Home:** navigation-first. A home card is deferred unless the backend reports a real `READY` source; it must not display a hard-coded count or readiness claim.
- **Access:** existing authenticated user plus existing admin gate in the first slice. This is a conservative gate, not a claim that W2.3 durable authorization is complete.

### 3.2 Backend contract (proposal)

`GET /api/valve/reference-workbench`

The endpoint is read-only and authenticated. It checks, in this order:

1. `authRequired` resolves an existing JWT user.
2. `adminRequired` uses the existing policy path.
3. Server-only configured `VALVE_REFERENCE_ENTERPRISE_ID` exactly matches `req.user.enterprise_id`; otherwise return `CONFIDENTIAL_ACCESS_DENIED`.
4. Server-only configured `VALVE_REFERENCE_DOCX_PATH` and expected SHA-256 exist. The browser never sends a path.
5. The parser verifies the exact expected hash before producing a projection.
6. The result is classified `REFERENCE_ONLY`; source values cannot populate a client project field.

Proposed non-success states are deliberately explicit: `NO_REFERENCE_SOURCE`, `SOURCE_NOT_AVAILABLE`, `HASH_MISMATCH`, `PARSER_FAILED`, `CONFIDENTIAL_ACCESS_DENIED`, `NO_DATA`, and `NEEDS_REVIEW`. There is no mock fallback.

### 3.3 Read model and privacy contract

The server creates a **minimal projection**, not a new truth database:

```text
Valve Workbench Read Model
  = projection(parser + Foundation + governed observation evidence)
  != client project truth
  != UI-owned data store
```

The projection may expose only:

- template/source IDs, sanitized file name, hash fingerprint, confidentiality and parser status;
- structural counts and selected headings/tables/fields/rules with source locators;
- `REFERENCE_ONLY`, inheritance policy, review status and field availability;
- safe provenance metadata and evidence references.

It must omit raw source document content, absolute paths, source package paths, raw XML, full hash, unreviewed reference values by default, and any secret or customer data.

The proposed first implementation uses a server-only in-memory derived snapshot keyed by the expected hash. It is invalidated on server restart, changed configured hash, or parse failure. It is not persisted to SQLite and it creates no schema migration. Browser state is volatile only: no `localStorage`, `sessionStorage`, IndexedDB, Cache API, service-worker cache, or offline copy for this confidential projection. Reload requires a new authenticated read.

### 3.4 Governed observation path

The first slice should reuse the established `governedDashboardService` pattern rather than add a parallel execution model. It creates a canonical Kernel run, durable transitions, attempt, readback evidence and verification for an `OBSERVATION` / `LOCAL_TRANSFORM` read-only capability.

The Valve adapter must preserve the existing Kernel semantics and record only redacted metadata/fingerprint in evidence payload references. It must not use Jev, external AI, mutation, automatic retry, client-project creation, or reference-value inheritance.

This is a proposal to reuse an existing RealityOS pattern. Its actual capability identifier and durable evidence sequence remain **NOT_IMPLEMENTED** until an implementation review confirms them.

## 4. Proposed UI

### Desktop

Header: `阀门招投标工作台` with badges **企业机密 / 本地私有** and **仅参考，不会带入新项目**. A template summary card shows only verified source identity fingerprint, parser result and `REFERENCE_ONLY` status.

Tabs:

1. `模板结构` — sections and table structure with precise source locators.
2. `技术与商务字段` — candidate fields, datatype/unit, inheritance blocked/allowed policy, and `待人工确认` where appropriate.
3. `规则` — only parser-found rule candidates, including control-price/source-priority categories when actually present.
4. `来源证据` — provenance metadata/ref, never raw source body.
5. `安全状态` — source availability, local-only, external AI calls `0`, raw source in Git `NO`, auto-inheritance `BLOCKED`.

No “new project” action is shown in v1. A disabled future-action button is avoided because it would imply a capability not yet present.

### Mobile

Use the existing responsive CSS contract: single-column cards below 650px, horizontally scrollable tables through the established `.table-wrap`, compact tabs, and a detail drawer/panel for evidence. No mobile-only fake summary replaces the full provenance state.

### Truthful UI state model

`LOADING` → final explicit state only. `READY` is shown only after the server proves parser output for the approved source. `NO_REFERENCE_SOURCE`, `SOURCE_NOT_AVAILABLE`, `HASH_MISMATCH`, `PARSER_FAILED`, `CONFIDENTIAL_ACCESS_DENIED`, `NO_DATA`, and `NEEDS_REVIEW` remain visible to the user; they are not converted to “sample data loaded.”

## 5. Exact expected implementation boundary

Expected new files, only after separate approval:

- `services/valveTenderWorkbenchService.js` — redacted server projection and controlled snapshot;
- `controllers/valveTenderWorkbenchController.js` — auth/context/error mapping only;
- `routes/valveTenderWorkbenchRoutes.js` — read-only route;
- `scripts/valve-tender-workbench-test.mjs` — identity, hash, privacy, no-mutation and no-fallback tests.

Expected modified files, subject to hunk-isolation review:

- `routes/index.js` — mount the one endpoint;
- `app.js` — one route/navigation and volatile fetch state (currently mixed; only isolated hunks allowed);
- `ui.js` and `styles.css` — renderer/responsive styles;
- `project.md` — real post-verification status only.

No database schema, migration, Foundation parser, DOCX source, quotation service, product matching, DWG parser, drawing generator, provider router, OCR, external AI, or automatic action is in scope.

## 6. Reality, verification and acceptance requirements

Before implementation can claim a real slice, it must prove:

| Requirement | Required evidence |
|---|---|
| no mock/template fallback | source missing/hash mismatch response has no parsed body or synthetic counts |
| access boundary | unauthenticated, non-admin, wrong-enterprise and configured enterprise cases |
| source identity | full server-side SHA gate and UI fingerprint only |
| parser/Foundation integration | actual approved source yields truthful parsed projection with `REFERENCE_ONLY` |
| governed read | a real durable Kernel run, attempt, transition, redacted evidence receipt and verification case |
| privacy | response/body/browser storage inspection excludes path, raw source, full hash and raw nodes |
| no business mutation | no client project, quote, product, drawing or bid-side write route; DB mutation audit is empty |
| UI readback | desktop/mobile browser proof reflects API final state and exact evidence references |
| Control Plane visibility | created governed run can be read through the existing canonical Control Plane |

The page may display a run/evidence reference only after it is actually created. `Execution Success ≠ Verification Success`; pending or unknown remains pending/unknown.

## 7. Readiness and gaps

| Area | Current truth |
|---|---|
| Parser/Foundation source capability | VERIFIED, local/private, reference-only |
| Product workbench | NOT_IMPLEMENTED |
| Controlled source configuration and enterprise binding | NOT_IMPLEMENTED; implementation precondition |
| Full durable enterprise identity/delegation | NOT_IMPLEMENTED (W2.3) |
| Real Jev runtime | NOT_INTEGRATED and not required |
| Reference → client project inheritance | BLOCKED |
| Automatic extraction-to-quote action | BLOCKED |
| Production / enterprise pilot readiness | NO |

## 8. Source-of-truth and architecture decisions

- **Parallel truth store:** NO.
- **New top-level Runtime:** NO.
- **UI truth source:** canonical API projection of the parser/Foundation and, when implemented, the existing Kernel/durable linkage.
- **Cache decision:** server-only derived, volatile snapshot; browser persistence prohibited.
- **RBAC decision:** reuse existing JWT/auth/admin path plus exact configured enterprise match; classify this as an interim, conservative boundary, not W2.3 completion.
- **Effect decision:** observation/local transform only; no mutation and no automatic recovery/retry.
- **Demo decision:** existing static/demo signals remain outside this workbench; unavailable means unavailable.

## 9. Final entry-review outcome

`VALVE_REAL_WORKFLOW_UI_BACKEND = ENTRY_REVIEW_COMPLETE`.

The proposed first real workbench slice is eligible for human approval, but it is not implemented or verified. Historical private-path evidence still keeps `PUSH_PRIVACY_GATE=BLOCKED`; this review does not alter that gate.
