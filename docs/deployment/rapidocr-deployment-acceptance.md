# RapidOCR Deployment Acceptance Contract

Status: DESIGN ONLY

This contract defines the minimum evidence required before any RapidOCR
deployment profile can be marked ready for implementation or release. It does
not certify any existing production deployment.

DESIGNED != IMPLEMENTED != DEPLOYED != VERIFIED.

## Gate Result Terms

- `PASS`: observed with current deployment evidence.
- `FAIL`: observed and did not meet the contract.
- `BLOCKED`: required evidence cannot be collected.
- `NOT_APPLICABLE`: profile does not include this capability and the exclusion is
  documented.

## Acceptance Gates

| Gate | Required evidence | LOCAL_DESKTOP | ON_PREMISE_LAN | CONTROLLED_HYBRID |
|---|---|---|---|---|
| Runtime versions verified | Python, RapidOCR, ONNX Runtime, execution provider readback | required | required | required |
| Capability READY | readiness includes imports, model init, CPU provider, temp probe | required | required | required |
| Same-input hash PASS | approved input hash matches expected test fixture | required | required | required |
| Known anchor regression PASS | approved anchor set remains true | required | required | required |
| Browser -> API -> RapidOCR -> UI readback PASS | full product path readback | required | required | required |
| requested/actual provider match | `requestedProvider` equals verified `actualProvider` | required | required | required |
| fallback=false enforcement | no cloud OCR or external AI fallback | required | required | required |
| `partial_success` preservation | partial result remains partial and is visible | required | required | required |
| CONFIDENTIAL / placement policy PASS | classification and placement enforced | required | required | required |
| external OCR upload = 0 | no cloud OCR upload observed | required | required | required |
| external AI calls = 0 | no external AI call observed for OCR | required | required | required |
| health/readiness semantics PASS | `/live` and `/ready` are distinct | required | required | required |
| timeout cleanup PASS | owned child process/temp cleanup verified | required | required | required |
| restart recovery PASS | restart does not fake old running work as complete | required | required | required |
| unauthorized request blocked | no auth/authority bypass | required | required | required |
| logs contain no raw confidential content | log scan and evidence review | required | required | required |
| rollback path demonstrated | rollback to last verified runtime shown | required before release | required before release | required before release |

## Runtime Version Gate

Minimum evidence:

- Python executable path is owned by the deployment.
- Python major/minor matches approved baseline.
- `rapidocr` package version equals the approved version.
- `onnxruntime` package version equals the approved version.
- Execution provider includes `CPUExecutionProvider`.
- Component provider readback covers detection, classification, and recognition
  where available.

Failure result:

- Missing or mismatched runtime evidence -> `BLOCKED`.

## Readiness Gate

RapidOCR readiness must prove:

- Python executable exists and executes.
- `rapidocr` import PASS.
- `onnxruntime` import PASS.
- Model initialization PASS.
- Required execution provider available.
- Temp directory write/read/delete PASS.
- Adapter returns structured readiness JSON.

Port listening or web page loading is not readiness.

## Product Path Gate

The product path must prove:

```text
Browser
  -> authenticated API
  -> OCR Provider Router
  -> RapidOCR Service
  -> Python Adapter
  -> ONNX CPU Runtime
  -> structured product result
  -> UI readback
```

Required readback:

- `engineRawText` present where the product path exposes it.
- normalized text present.
- structured result present.
- UI shows provider/result state truthfully.
- `requestedProvider` and `actualProvider` recorded.
- `fallbackUsed=false`.

## Data Placement Gate

For `CONFIDENTIAL` input:

- `LOCAL_ONLY` must not leave the local machine.
- `ON_PREMISE` must not leave the customer organization.
- `CONTROLLED_HYBRID` must enforce placement before OCR execution.

Forbidden success conditions:

- Silent upload.
- Cloud OCR fallback.
- External AI fallback.
- Unknown processor.
- Raw OCR content in telemetry.

## Health Gate

`/live` acceptance:

- Service process answers liveness.
- Does not claim OCR execution capability.

`/ready` acceptance:

- Includes RapidOCR dependency/runtime probe.
- Includes provider router status.
- Includes temp storage status.
- Includes policy capability status.
- Fails closed when required capability is blocked.

## Failure Semantics Gate

Required failure classes:

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

`partial_success` must remain visible and must not be converted to `success`.

## Timeout And Cleanup Gate

Required evidence:

- Request timeout is finite.
- Owned child process termination is attempted and read back.
- Temp artifacts are removed or preserved with an explicit incident marker.
- Cleanup is idempotent.
- Unrelated Python, Chrome, or Node processes are not killed.

## Restart Recovery Gate

Required evidence:

- In-flight request state survives or is explicitly marked unknown.
- Previous `RUNNING` work is not automatically promoted to `COMPLETED`.
- Evidence readback determines whether work is complete, failed, or unresolved.
- Manual review is required for contradictory evidence.

## Authority Gate

Required authority checks:

- Authenticated caller.
- Upload authority.
- OCR execution authority.
- Result read authority.
- Administrator runtime authority for readiness/config operations.

Network location alone is not authority.

## Supply Chain Gate

Required evidence:

- Dependency lock is present.
- Package versions match lock.
- Package source is documented.
- Python runtime version is approved.
- ONNX Runtime version is approved.
- Runtime build/hash identity is recorded where practical.

No production startup may perform unapproved dependency upgrade or unknown model
code download.

## Update And Rollback Gate

Candidate runtime release requires:

- Dependency verification PASS.
- Same-input regression PASS.
- Product proof PASS.
- Independent verification PASS.
- Approved release record.
- Deployment health/readback PASS.

Rollback requires:

- Last verified runtime identity.
- Rollback execution evidence.
- Post-rollback readiness evidence.
- Failure evidence retained for the rejected candidate.

## Deployment Acceptance Outcome

A deployment profile can be marked `READY_FOR_DEPLOYMENT_IMPLEMENTATION` only
when:

- All required gates are `PASS`, or a gate is explicitly `NOT_APPLICABLE` with a
  documented reason.
- No required gate is `FAIL` or `BLOCKED`.
- Push/deploy authority has been granted separately.

Until then, the status remains:

```text
DEPLOYMENT_DESIGNED_ONLY
IMPLEMENTATION_NOT_STARTED
DEPLOYMENT_NOT_PERFORMED
```
