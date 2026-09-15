# OCR Engine Capability Replacement Benchmark

**Status:** `ENVIRONMENT_BLOCKED` — benchmark-only decision record; not a product change.

## Scope and privacy

This record evaluates the explicitly supplied failure input only. The input is
classified as `CONFIDENTIAL`; processing was local-only. No complete OCR text,
image bytes, or user document content is stored in this repository.

| Property | Evidence |
| --- | --- |
| Input identity | `处理后_ChatGPT Image 2026年6月27日 22_06_22.png` |
| SHA-256 | `1ac6f72975d4986c82cf09e21ac400e81c82f72947520e72ae27b61289d120af` |
| MIME / dimensions | PNG, 1536 × 1024, RGBA |
| Execution location | Local Apple Silicon host only |
| Cloud provider calls | `0` |
| Product OCR changes | `NONE` |

## Current baseline: Tesseract.js

The existing same-input evidence used `tesseract.js` with `chi_sim`. Its raw
output was 598 characters at confidence 57. The following results are from the
engine-raw boundary, not normalization, UI, structured extraction, or AI
correction.

| Dimension | Result |
| --- | --- |
| Document type `发货单` | EXACT |
| Document number `FH-20240627-001` | EXACT |
| Supplier label | NO |
| Order label | NO |
| Product label | NO |
| Quantity label | NO |
| Quantity `120` | MISS |
| Unit-price label | NO |
| Amount label | NO |
| Total label | NO |
| Numeric integrity | FAIL — most verified numeric anchors were not recovered |
| Chinese integrity / table usefulness | Insufficient for this enterprise document |
| Classification | `CURRENT_BASELINE`; not fit as the sole primary engine for this document type |

The supplied document confirms a capability failure in engine raw output. It
does **not** establish the accuracy of any OCR-produced supplier, product,
price, amount, or total value that is not independently anchored.

## Local candidate attempts

### Candidate A — PaddleOCR

| Property | Evidence |
| --- | --- |
| Package considered | `paddleocr 3.7.0` |
| Intended runtime | Local Python, CPU |
| License | Apache-2.0, according to the package's PyPI metadata |
| Environment | macOS arm64, Python 3.14.4, isolated `/tmp/ai-office-ocr-benchmark` venv |
| Install probe | `pip install --dry-run paddleocr paddlepaddle` |
| Result | `PADDLEOCR_ENVIRONMENT_BLOCKED` |
| Failure evidence | `No matching distribution found for paddlepaddle` |
| OCR execution | NOT RUN |
| Classification | `NEEDS_MORE_EVIDENCE` |

No project Python environment, Docker configuration, or production dependency
was modified.

### Candidate B — RapidOCR / ONNX Runtime

| Property | Evidence |
| --- | --- |
| Package considered | `rapidocr-onnxruntime 1.2.3` (resolver candidate) |
| Intended runtime | Local ONNX Runtime, CPU |
| License | `UNKNOWN` for the uninstalled artifact; upstream PyPI metadata advertises Apache-2.0 and must be revalidated with an installed, pinned artifact before any production recommendation |
| Environment | Same isolated venv only |
| Install result | `ENVIRONMENT_BLOCKED` |
| Failure evidence | Dependency transfer reached 2.6 MB of a 12.3 MB wheel at about 16.6 kB/s and was stopped under the explicit resource budget; no package was installed and no model was executed |
| OCR execution | NOT RUN |
| Classification | `NEEDS_MORE_EVIDENCE` |

This was the only permitted second local candidate. No third engine was tried.

## Comparison and decision

| Engine | Real document | Synthetic Songti fixture | Local / privacy eligible | Latency | Decision |
| --- | --- | --- | --- | --- | --- |
| Tesseract.js + chi_sim | Executed; critical-field coverage insufficient | Previously PASS | YES | Not remeasured; existing same-input run completed locally | `CURRENT_BASELINE` |
| PaddleOCR | Environment blocked before execution | NOT RUN | Intended local-only | NOT AVAILABLE | `NEEDS_MORE_EVIDENCE` |
| RapidOCR / ONNX | Environment blocked before execution | NOT RUN | Intended local-only | NOT AVAILABLE | `NEEDS_MORE_EVIDENCE` |

`ENGINE_DECISION = ENVIRONMENT_BLOCKED` and `BEST_LOCAL_ENGINE = NO_ENGINE_SELECTED`.
No candidate may be called a `LOCAL_PRIMARY_CANDIDATE`, and Tesseract's
production role is unchanged. `DOCUMENT_CROP_DIAGNOSTIC = NOT_REQUIRED`: no
new local engine completed a whole-document benchmark from which a crop
diagnostic could be interpreted.

## Failure learning

- **Symptom:** a real Chinese shipping document produces garbled text and
  misses critical fields.
- **First corrupted boundary:** `TESSERACT_ENGINE_RAW`.
- **Why earlier work did not remedy it:** lifecycle, timeout, evidence,
  normalization, and UI work cannot increase an OCR engine's raw capability.
- **Prevention rule:** a synthetic fixture pass never establishes real document
  capability; retain an authorized real-document benchmark before selecting a
  primary OCR engine.

## Next safe action

Provide a reproducible local benchmark environment with a supported Python
runtime and pinned candidate artifacts, then rerun the same input without
changing product code. Cloud OCR remains `RESERVED / BLOCKED_BY_OUTBOUND_POLICY`
for this confidential document.

## Non-goals confirmed

- No cloud OCR or AI provider request.
- No image copied into the repository.
- No OCR Router, provider switch, crop-based production behavior, or OCR
  algorithm change.
- No commit, push, or deployment.
