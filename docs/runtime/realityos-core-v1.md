# RealityOS Core v1

Status: IMPLEMENTED LOCALLY / COMMIT NOT CREATED / PUSH NO / DEPLOY NO

RealityOS Core v1 extracts only the mechanisms already proven by the RapidOCR local product path. It is not a new runtime product, not a new agent layer, and not a production deployment claim.

## Proven Source

The source capability is the verified RapidOCR local OCR path:

- capability: `document.ocr`
- provider: `rapidocr-local`
- data classification: `CONFIDENTIAL`
- placement: `LOCAL_ONLY`
- egress: no external upload
- runtime: Python / ONNX Runtime
- provider evidence: `services/rapidOcrService.js`
- browser routing evidence: `ocr-provider.js`
- product proof script: `scripts/rapidocr-product-test.mjs`

## Core Contracts

RealityOS Core v1 defines the following reusable contracts in `realityos-core.js`:

1. Capability Registry
2. Dependency Contract
3. Capability Readiness
4. Execution-specific Preflight
5. Provider / Resource Router
6. Data Classification / Placement / Egress Policy
7. Requested vs Actual Execution Provenance
8. Capability Health / Mission Control projection
9. Expected Execution / Configuration ↔ Actual Execution / Configuration

These contracts are intentionally small and evidence-oriented. They do not execute business work by themselves.

## OCR Migration Map

| OCR concept | Core v1 concept | Implementation |
|---|---|---|
| RapidOCR provider metadata | Provider Descriptor | `ocr-provider.js`, `services/rapidOcrService.js` |
| local runtime dependencies | Dependency Contract | `providerContract().dependencyEvidence` |
| readiness state | Capability Readiness | `RealityOSCore.normalizeReadiness()` |
| confidential local OCR policy | Data Policy | `RealityOSCore.createDataPolicy()` |
| provider selection | Provider Router | `RealityOSCore.evaluateDataPolicy()` within OCR registry filtering |
| runtime guard before execution | Preflight | `RealityOSCore.preflight()` |
| engine/version/hash execution evidence | Execution Provenance | `executionProvenance` on OCR results |
| requested vs actual provider/runtime | Expected / Actual Check | `expectedActual` on OCR results |
| Mission Control projection | Capability Health | RapidOCR `capabilityHealth` |

## Generalized in v1

- Provider metadata normalization
- Readiness vocabulary
- Dependency status summary
- Confidential data placement policy
- Local-only egress blocking
- Execution provenance shape
- Requested vs actual comparison
- Capability health projection

## Remains OCR-Specific

- OCR field extraction
- OCR text normalization and garbled-text detection
- RapidOCR adapter invocation
- Tesseract fallback behavior
- OCR review UI semantics
- Document-specific field validation

## Reserved for v2

The following are intentionally not implemented in this phase:

- Effect Governance
- Resume Authority
- Human Control Runtime
- Improvement MetaRSI
- Model Supply-Chain implementation
- Writing Capability Pack
- Universal / Work Runtime
- Industrial World runtime

## Boundaries

RealityOS Core v1 does not:

- start services;
- deploy;
- push;
- call external AI;
- change OCR recognition algorithms;
- change RapidOCR dependencies;
- modify business workflow semantics;
- claim production readiness.

## Verification

Core v1 is verified by:

- `scripts/realityos-core-test.mjs`
- `scripts/ocr-provider-test.mjs`
- `scripts/rapidocr-product-test.mjs`
- `npm run check`
- `npm run test:unit`
- `npm run build`
- `git diff --check`

Browser product proof remains a separate environment-dependent verification and must not be inferred from the Core contract tests alone.
