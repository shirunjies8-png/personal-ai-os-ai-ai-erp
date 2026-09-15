# RapidOCR Local / On-Premise Runtime Deployment Design

Status: DESIGN ONLY

Baseline:

- Verified OCR commit: `ad8a5e534394960c05546d634980d3ccb1159e84`
- Verified patch identity: `7a0984a5f711a0d5c3a7b543b53ef457db777e958c96487f6344e753cec728da`
- RapidOCR: `3.9.2`
- Python: `3.11.x` verified with `3.11.15`
- ONNX Runtime: `1.29.0`
- Execution provider: `CPUExecutionProvider`

This document defines deployment boundaries and acceptance criteria for future
implementation. It does not deploy RapidOCR, modify OCR logic, modify GitHub
Pages, or certify production operation.

DESIGNED != IMPLEMENTED != DEPLOYED != VERIFIED.

## RealityOS Principles

- FRONTEND DEPLOYED != CAPABILITY DEPLOYED.
- INTERFACE AVAILABLE != EXECUTION CAPABILITY AVAILABLE.
- CAPABILITY DECLARED != CAPABILITY READY.
- REQUESTED PROVIDER != VERIFIED PROCESSOR.
- CONFIDENTIAL DATA MUST OBEY EXECUTION PLACEMENT POLICY.
- ARCHITECTURE EXISTS != PRODUCT CAPABILITY EXISTS.

The GitHub Pages OCR screen is a public static frontend. It is not evidence that
the Python RapidOCR runtime is deployed, reachable, authorized, or ready.

## Deployment Profiles

### A. LOCAL_DESKTOP

Topology:

```text
User Browser
  -> 127.0.0.1 Node/API
  -> OCR Provider Router
  -> RapidOCR Service
  -> Python 3.11 Runtime
  -> RapidOCR 3.9.2 / ONNX Runtime 1.29.0 / CPUExecutionProvider
  -> local temporary storage
```

Purpose:

- Development.
- Personal local confidential document processing.
- Reality proof before enterprise topology design.

Boundary:

- Browser, Node/API, Python runtime, temp files, logs, and evidence remain on the
  same workstation.
- Python runtime is owned by this installation and is not exposed as a public
  network service.

### B. ON_PREMISE_LAN

Topology:

```text
Enterprise Client Browser
  -> HTTPS Reverse Proxy
  -> Authenticated Node/API
  -> OCR Provider Router
  -> RapidOCR Runtime Host
  -> Python 3.11 Runtime
  -> RapidOCR 3.9.2 / ONNX Runtime 1.29.0 / CPUExecutionProvider
  -> on-prem temp storage and evidence store
```

Purpose:

- Enterprise LAN use.
- Multi-user OCR without data leaving the customer organization.

Boundary:

- TLS terminates at the enterprise reverse proxy or an approved internal gateway.
- Node/API is the authenticated entrypoint.
- Python runtime is private to the service tier and is not directly reachable by
  end-user browsers.
- Data placement is ON_PREMISE.

### C. CONTROLLED_HYBRID

Topology:

```text
Public UI / Product Entry
  -> Authenticated Gateway
  -> Placement Policy Enforcement
  -> Private Network Path
  -> Private Node/API or OCR Gateway
  -> OCR Provider Router
  -> Private RapidOCR Runtime
  -> private temp storage and evidence store
```

Purpose:

- Product UI can be public while confidential OCR execution remains local or
  private.

Boundary:

- Public UI != direct Python runtime access.
- Browser must not call a naked Python OCR port.
- Every OCR request must pass authentication, authority, data classification,
  placement policy, and provenance recording before execution.

## Component Boundary

| Component | Process owner | Trust boundary | Network boundary | Data read/write | Startup dependency | Health signal | Failure semantics |
|---|---|---|---|---|---|---|---|
| Browser Frontend | User session | Untrusted input | HTTPS or localhost | reads UI state; uploads selected files | static assets | page load only | page ready does not mean OCR ready |
| Node API | AI Office service owner | authenticated service boundary | localhost/LAN/private gateway | reads request; writes state/evidence/temp references | config, auth, router | `/live`, `/ready` | maps structured OCR failures |
| OCR Provider Router | Node API | provider selection boundary | in-process | reads requested provider and policy | provider registry | provider resolved | requested provider mismatch is BLOCKED |
| RapidOCR Service | Node API | capability boundary | in-process Node to child Python | reads input buffer/temp file; writes sanitized result/evidence | Python adapter | readiness probe | DEGRADED/BLOCKED if dependency missing |
| Python Adapter | Node API owned child process | private runtime boundary | stdio by default | reads temp image; emits JSON result | Python runtime, packages, models | preflight JSON | malformed result is structured failure |
| Python Runtime | Deployment owner | local/private execution | not public | reads model/package files and temp inputs | approved Python 3.11 | version/import probe | unavailable if version/import mismatch |
| ONNX Models | Deployment owner | supply-chain boundary | none | read-only model assets | pinned runtime package/model assets | model initialization | initialization failure blocks readiness |
| Temporary Input Storage | Deployment owner | confidential data boundary | local filesystem/private volume | writes input; deletes after run | writable temp directory | write/delete probe | storage failure blocks execution |
| Evidence / Run State | Node API | audit boundary | local/private DB/API | writes hashes, versions, status, provenance | storage backend | write/readback probe | evidence failure prevents verified success |
| Auth | Node/API owner | authority boundary | API/gateway | reads user/session/role | auth config | login/introspection | access != authority |
| Reverse Proxy | Deployment owner | perimeter boundary | public/LAN/private | no OCR content logging | TLS/cert/routing | liveness route | proxy alive != OCR ready |
| Health / Readiness | Deployment owner | operations boundary | internal and authenticated where needed | reads status only | all required capabilities | `/live`, `/ready` | liveness and readiness are separate |
| Logging | Deployment owner | observability boundary | local/private log sink | writes metadata only | log sink | append/readback | no raw confidential OCR text |

## Data Sovereignty Contract

Default OCR input classification: `CONFIDENTIAL`.

Supported placements:

- `LOCAL_ONLY`: input and OCR execution remain on the local machine.
- `ON_PREMISE`: input and OCR execution remain inside the customer organization.

Future placements may be added only after explicit policy and acceptance tests.

Required rules:

- Input files are stored only in an approved local/private temp location.
- Temp files must be deleted after terminal success, failure, or timeout cleanup.
- Raw OCR text is product data and must not be emitted into infrastructure logs.
- Evidence may contain hashes, provider identity, versions, status, timings, and
  sanitized structured metadata.
- Telemetry must not include OCR image bytes, raw OCR text, customer documents,
  or business secrets unless an explicit customer policy authorizes it.
- Cloud OCR fallback is forbidden for `CONFIDENTIAL` `LOCAL_ONLY` and
  `ON_PREMISE` requests.
- External AI fallback is forbidden unless a future placement policy explicitly
  allows controlled egress.
- Unknown processor execution is forbidden.

## Execution Provenance

Each OCR run should record:

- `requestedProvider`
- `actualProvider`
- `runtimeVersion`
- `pythonVersion`
- `rapidOcrVersion`
- `onnxRuntimeVersion`
- `executionProvider`
- `executionNode`
- `deploymentProfile`
- `dataPlacement`
- `fallbackUsed`
- `inputHash`
- `resultHash`
- `startedAt`
- `finishedAt`
- `status`

Do not use an absolute private filesystem path as the core business identity.
Paths may be diagnostic-only and must be sanitized before durable evidence.

## Capability Readiness

States:

- `DECLARED`: provider exists in config or registry.
- `RESOLVED`: router can resolve the provider for the request and policy.
- `READY`: runtime dependency checks, model initialization, and storage probes
  pass.
- `DEGRADED`: provider can run but has a reduced verified capability.
- `BLOCKED`: required dependency, policy, authority, storage, or model check
  failed.
- `UNAVAILABLE`: provider cannot be reached or started.

RapidOCR `READY` requires:

- Python executable valid.
- `rapidocr` import PASS.
- `onnxruntime` import PASS.
- Required versions match approved baseline.
- Model initialization PASS.
- `CPUExecutionProvider` available for required components.
- Temp directory writable and deletable.
- API adapter reachable and returns structured readiness JSON.

Listening on a server port is not sufficient for OCR readiness.

## Startup Contract

```text
Runtime dependency check
  -> Python readiness
  -> OCR provider readiness
  -> Node API
  -> Router registration
  -> Health probe
  -> Application READY
```

If a required OCR capability is `BLOCKED`, the overall OCR capability must not be
reported as `READY`. The broader app may be live while OCR is blocked, but UI and
API must show that distinction.

## Health Contract

Required health semantics:

- `/live`: process is alive and can answer basic service checks.
- `/ready`: service can accept real OCR work under current policy.

Readiness must include RapidOCR dependency and runtime probes. Liveness must not
be reused as readiness.

## Failure Semantics

Failures must remain structured:

- `DEPENDENCY_MISSING`
- `PYTHON_UNAVAILABLE`
- `MODEL_INITIALIZATION_FAILED`
- `OCR_EXECUTION_FAILED`
- `OCR_TIMEOUT`
- `PARTIAL_SUCCESS`
- `MALFORMED_RESULT`
- `PROVIDER_MISMATCH`
- `STORAGE_FAILURE`
- `NETWORK_FAILURE`

Do not collapse all failures into HTTP 500 plus "OCR failed".

`partial_success` is a real outcome and must not be upgraded to `success`.

## Timeout / Process Control

Timeout means the caller stopped waiting; it does not prove the child process was
terminated or that no side effect occurred.

The runtime design must define:

- Request timeout.
- Child-process graceful termination.
- Child-process force kill.
- Temp cleanup.
- Unknown-effect handling.
- Process ownership.

Only processes created and owned by the current AI Office run may be terminated.
Do not kill unrelated Python, Chrome, or Node processes.

## Authority / Access

Internal network placement is not authority.

The API must distinguish:

- Authenticated caller.
- Workspace/user identity.
- Upload authority.
- OCR execution authority.
- Result read authority.
- Administrator runtime authority.

ACCESS != AUTHORITY.

## Model / Runtime Supply Chain

Required records:

- Dependency lock: `tools/ocr-benchmark/rapidocr311.lock`.
- Package versions and source.
- Approved Python version.
- Approved ONNX Runtime version.
- Approved execution provider.
- Runtime hash or build identity where practical.

Production startup must not automatically upgrade dependencies, download unknown
model code, or enable arbitrary remote code execution.

NEWER VERSION != VERIFIED SECURITY FIX.

## Update / Rollback

```text
Candidate Runtime
  -> Dependency verification
  -> same-input regression
  -> product proof
  -> independent verification
  -> approved release
  -> deployment
  -> health/readback
```

Failure path:

- Stop rollout.
- Preserve failure evidence.
- Roll back to the most recent verified runtime.
- Mark old verification evidence stale for any capability-altering change.

CAPABILITY-ALTERING CHANGE -> old verification evidence may be invalid.

## Recovery

Recovery cases:

- Process crash.
- Machine restart.
- Partial request.
- Temp artifact remains.
- Unfinished run.
- Runtime dependency corruption.

Recovery must read authoritative state and evidence. It must not automatically
turn a previous `RUNNING` state into `COMPLETED`.

Unknown or contradictory evidence requires manual review or a read-only
verification workflow.

## Network Topology

### LOCAL_DESKTOP

```text
Browser: http://127.0.0.1:<app-port>
Node/API: 127.0.0.1 only
Node -> Python: owned child process over stdio
Python network port: none by default
TLS: optional for localhost
Private boundary: local machine
```

### ON_PREMISE_LAN

```text
Browser: https://office.example.internal
Reverse proxy: 443 TLS termination
Node/API: private LAN address
Node -> Python: owned child process or private local runtime host
Python network port: none by default; if used, bind private-only and authenticate
Storage: enterprise private volume
Private boundary: customer organization network
```

### CONTROLLED_HYBRID

```text
Browser: public product URL
Gateway: authenticated public or private edge
Placement policy: required before OCR execution
Node/API: private or controlled backend
Node -> Python: private network path or local private runtime
Python network port: never public
Storage: private customer-approved location
Public/private boundary: gateway + placement policy
```

## Non-Goals

- No deployment is performed by this design.
- No Nginx, DNS, GitHub Pages, GitHub Actions, tunnel, or cloud server changes.
- No OCR recognition algorithm changes.
- No provider fallback implementation.
- No production dependency installation.
- No Push or Deploy.
