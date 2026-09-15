# Local Private OCR Runtime and RapidOCR 3 Reality Benchmark

**Phase:** `OCR-LOCAL-PRIVATE-RUNTIME-AND-RAPIDOCR3-REALITY-BENCHMARK-1`
**Status:** `CONTROLLED_SOURCE_RECOVERY_COMPLETE; REAL_SAMPLE_INPUT_UNAVAILABLE`
**Product change:** `NONE`

## Placement and environment identity

| Field | Evidence |
| --- | --- |
| Runtime ID | `local-mac-rapidocr311-benchmark-v1` |
| OS / version | macOS 26.4.1 |
| Architecture | arm64 |
| Selected Python | Python 3.11.15 at `<LOCAL_PRIVATE_RUNTIME_PATH>` |
| Other compatible Python runtimes observed | 3.10.20 and 3.13.10 |
| Venv | `/tmp/ai-office-ocr-runtime-rapidocr311` |
| Placement required / actual | `LOCAL_ONLY` / `LOCAL_MAC` for all attempted work |
| Placement proof | Package installer and venv were local processes; no OCR task was started |
| Real input identity | `1ac6f72975d4986c82cf09e21ac400e81c82f72947520e72ae27b61289d120af` |
| Business data external uploads | `0` |
| AI / cloud OCR provider calls | `0` |

The real document was never passed to the new runtime during the initial blocked attempt. The later controlled recovery passed its public-fixture gate. At the final real-sample benchmark step, the explicitly supplied original path was no longer available (`ENOENT`); no directory search, regenerated image, screenshot, or substitute input was used.

## Software supply chain and install evidence

The current package index reported `rapidocr 3.9.2` as the current stable release. Official RapidOCR documentation specifies installing `rapidocr` with an explicitly selected inference runtime; this benchmark selected ONNX Runtime on CPU. The old `rapidocr-onnxruntime` package was not used.

| Field | Evidence |
| --- | --- |
| OCR package requested | `rapidocr==3.9.2` |
| Inference runtime requested | `onnxruntime` |
| Publisher / source | RapidAI / PyPI package index |
| License | Apache-2.0 from current official project/package metadata |
| Artifact identity | `rapidocr-3.9.2-py3-none-any.whl`, 27.3 MB; downloaded into pip cache but installation did not complete |
| Additional dependency reached | `numpy-2.4.6` download began; not complete |
| Imported RapidOCR / ONNX Runtime | NOT REACHED — no installed package may be treated as an engine |
| Execution provider | NOT REACHED; no inference session exists |
| Model identity / load | NOT REACHED; no model acquisition or execution occurred |

## Precise failure classification

`NETWORK_DOWNLOAD_FAILURE`

The installation used one bounded attempt with one package-manager resume. The RapidOCR wheel transfer interrupted at 5.8 MB, resumed once, interrupted again at 12.1 MB, and then completed the 27.3 MB wheel. The subsequent NumPy dependency transfer began but was stopped before a second recovery cycle, because the phase allows at most one reasonable recovery attempt per install failure. No alternate mirror, reinstallation, or third OCR engine was used.

This is an acquisition/runtime failure, **not** evidence that RapidOCR lacks OCR capability.

## Benchmark gates

| Gate | Status |
| --- | --- |
| Compatible Python | PASS — Python 3.11.15 |
| Isolated local runtime | PASS |
| RapidOCR installation readback | BLOCKED |
| ONNX Runtime import / providers | NOT REACHED |
| Public Songti fixture | NOT RUN — install gate failed |
| Confidential real document | NOT RUN — public gate not reached |
| Same-input engine comparison | NOT RUN |
| Numeric safety comparison | NOT RUN |
| Crop diagnostic | NOT REQUIRED |
| Privacy / no business-data egress | PASS |

## Existing Tesseract comparison baseline

The established baseline remains `tesseract.js + chi_sim`: document type and `FH-20240627-001` were exact, while the verified quantity `120` and critical Chinese labels were not reliably recovered. This is a `CURRENT_BASELINE`, not a new RapidOCR comparison result.

## Minimal next design readiness

The confidential-document trigger makes local/private execution applicable now. A future, separately approved provider proof should carry only these minimum facts: `providerId`, `engineIdentity`, `runtimeIdentity`, `modelIdentity`, `placement`, `supportedLanguages`, `supportedDocumentTypes`, `dataEligibility`, `inputArtifactId`, `resultEvidence`, `failureState`, and `healthState`.

An OCR Resource Router remains **NEXT**, not implemented: there is not yet a second verified engine.

## Failure learning

1. Tesseract engine raw is confirmed insufficient for this real business document; surrounding lifecycle or UI fixes cannot change that fact.
2. Python and runtime versions are part of OCR evidence identity.
3. Environment acquisition failure cannot reject an OCR engine's capability.
4. Confidential input activates a local execution requirement, not a general local LLM, vLLM, oMLX, or VLM requirement.
5. Provider selection must be benchmarked on reality evidence before router integration.

## Decision and next safe action

`ENGINE_DECISION = RUNTIME_ENVIRONMENT_BLOCKED`
`BEST_LOCAL_ENGINE = NONE`
`OCR_GARBLED_TEXT_BUG = OPEN`

The safe next action is a narrowly scoped package-acquisition recovery for this same pinned Python 3.11 runtime, followed by the public fixture gate. No product OCR change, cloud OCR request, or Router implementation is authorized by this record.

## Package acquisition recovery evidence

**Phase:** `OCR-LOCAL-PACKAGE-ACQUISITION-RECOVERY-1`
**Legal completion state:** `PACKAGE_RECOVERY_DIAGNOSIS_COMPLETE + PRECISE_BLOCKER_CONFIRMED`

### Start state

The owned Python 3.11 venv contained only `pip` and `setuptools`; `rapidocr`,
`onnxruntime`, and `numpy` were absent. The inherited user pip cache was
disabled by its ownership policy, so this phase did not read, alter, or clear
it. A new owned cache and wheelhouse were created under `/tmp`.

### Wheelhouse and integrity

`pip download --only-binary=:all:` completed from official PyPI into
`/tmp/ai-office-ocr-wheelhouse`. It resolved 21 wheels (106 MB total). ZIP
integrity checks passed for every wheel and actual SHA-256 values were recorded
locally. Core artifact identities are:

| Artifact | Actual SHA-256 |
| --- | --- |
| `rapidocr-3.9.2-py3-none-any.whl` | `04d6b8d151f823d930bd91910555f57bea897c0c44fa6794267b94cf9c1ef9a0` |
| `onnxruntime-1.29.0-cp311-cp311-macosx_14_0_arm64.whl` | `07c5907474dec4a2792fd7626b753dc66707808385a6d9eecf993db0066a9d0f` |
| `numpy-2.4.6-cp311-cp311-macosx_14_0_arm64.whl` | `4cfe66903cc32a9921a6733d96b19bb6abf310397581bbad89c228f5abaf0ee8` |

The subsequent `--no-index --find-links` installation succeeded. Readback
confirmed `rapidocr 3.9.2`, `onnxruntime 1.29.0`, and `numpy 2.4.6` in the
owned venv. ONNX Runtime reported these providers:
`CoreMLExecutionProvider`, `AzureExecutionProvider`, and
`CPUExecutionProvider`.

### Precise runtime blocker

The public Songti fixture was generated in `/tmp`, but RapidOCR failed before
it could load models or process that fixture. Under the binary-only policy,
pip selected `omegaconf 2.0.0`, which formally satisfies RapidOCR's declared
`omegaconf!=2.2.1` dependency. RapidOCR 3.9.2 then failed while assigning its
`PosixPath` model root:

`omegaconf.errors.UnsupportedValueType: Value 'PosixPath' is not a supported primitive type`

The only compatible OmegaConf candidate checked, `omegaconf 2.3.1`, requires
`antlr4-python3-runtime==4.9.*`. Official PyPI has no binary wheel matching
that exact requirement under the phase's `--only-binary=:all:` policy.

| Layer | Status |
| --- | --- |
| Package acquisition / artifact integrity | PASS |
| Offline installation | PASS |
| RapidOCR module import | PASS |
| ONNX Runtime import / provider readback | PASS |
| RapidOCR model initialization | FAIL |
| Failure class | `BINARY_WHEEL_UNAVAILABLE` with a resulting `ENGINE_RUNTIME_FAILURE` |
| Public fixture OCR | NOT RUN — model-init gate blocked |
| Confidential document OCR | NOT RUN — public fixture gate blocked |
| Model identity | NOT REACHED |
| Business-data external uploads | `0` |

The actual next safe action is an explicitly approved compatibility decision:
either permit a controlled pure-Python source artifact for
`antlr4-python3-runtime==4.9.*`, or select a separately verified compatible
RapidOCR dependency set. No source build, alternative OCR engine, product
change, cloud request, or real-document access is authorized by this record.

## Controlled pure-Python source recovery

**Phase:** `OCR-RAPIDOCR-CONTROLLED-PURE-PYTHON-SOURCE-RECOVERY-1`
**Scope:** benchmark runtime only; no production OCR code changed.

The sole approved source exception was `antlr4-python3-runtime==4.9.3` from
official PyPI. Its source archive SHA-256 was verified before extraction:

| Artifact | Source / provenance | SHA-256 | Result |
| --- | --- | --- | --- |
| `antlr4-python3-runtime-4.9.3.tar.gz` | Official PyPI sdist, 117,034 bytes | `f224469b4168294902bb1efa80a8bf7855f24c99aef99cbefc1bcd3cce77881b` | PASS |
| `antlr4_python3_runtime-4.9.3-py3-none-any.whl` | Locally built offline from that verified source, 144,590 bytes, Python 3.11 arm64 host, built 2026-09-02T14:26:06Z | `0d4fe291bee5e11f3a1d330b1e922076be1cace6bd5729e613d381795a428d0c` | PASS |
| `omegaconf-2.3.1-py3-none-any.whl` | Official PyPI binary, 79,502 bytes | `3d701d14e9a8828f1edd28bb70b725908b34277cdd72cf7d6a83f94dadc6b6a0` | PASS |

The extracted source was inspected before build: it contains Python package
sources and packaging metadata only; no C/C++/shared-library source, native
build configuration, custom downloader, or shell-execution hook was found.
The resulting wheel was built locally and installed into a new, owned Python
3.11.15 virtual environment using `--no-index --find-links`. No other source
artifact was built.

### Clean-runtime readback

`pip check` passed. Imports and versions read back as: `rapidocr 3.9.2`,
`onnxruntime 1.29.0`, `numpy 2.4.6`, `omegaconf 2.3.1`, and
`antlr4-python3-runtime 4.9.3`. `RapidOCR()` initialized successfully in
about 224 ms. The detection, classification, and recognition sessions each
reported `CPUExecutionProvider` as the provider actually in use.

Package metadata readback also established the exact compatibility chain:
`rapidocr 3.9.2` declares `omegaconf!=2.2.1`, and `omegaconf 2.3.1` declares
`antlr4-python3-runtime==4.9.*`. This is why the exception was confined to
ANTLR 4.9.3 and did not broaden the source-build policy.

| Local model artifact | SHA-256 |
| --- | --- |
| `PP-OCRv6_det_small.onnx` | `090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f` |
| `ch_ppocr_mobile_v2.0_cls_mobile.onnx` | `e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c` |
| `PP-OCRv6_rec_small.onnx` | `6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884` |

An ONNX Runtime telemetry-device-ID persistence warning was observed during
initialization. It did not include input business data and no business-data
egress was observed; it remains an environment warning, not a claim of a
network-free library implementation.

### Public fixture gate

The generated public Songti SC fixture (SHA-256
`077bf3e13de4ec3e9c450dbe65792e750dc78b03cc00709911065e7c0c4773f4`)
completed in 743 ms. It produced nine text regions and passed all required
public-field checks: title, `PO-20260820-001`, `125`, `18.60`, `2325.00`,
and `不锈钢板`.

| Gate | Status |
| --- | --- |
| Controlled source provenance and offline build | PASS |
| Clean fixed dependency installation / `pip check` | PASS |
| RapidOCR initialization / local model identity | PASS |
| Public Songti fixture | PASS |
| Original real document RapidOCR run (source-recovery subphase) | BLOCKED — explicitly supplied path returned `ENOENT` |
| Tesseract-vs-RapidOCR comparison (source-recovery subphase) | NOT RUN — same original input unavailable |
| Product OCR integration | NOT IMPLEMENTED |

This establishes RapidOCR only as a **local benchmark candidate**, not a
product default. The user-observed OCR garbling defect remains open and its
same-input comparison has not been replaced by a synthetic fixture result.

### Completion boundary and failure learning

`SOFTWARE_SUPPLY_CHAIN=PASS`; `PRIVACY_BOUNDARY=PASS`; and
`BUSINESS_DATA_EXTERNAL_UPLOADS=0`. The only source-build exception used was
`antlr4-python3-runtime==4.9.3`. Tesseract real-failure evidence, OCR evidence
boundaries, and live-provider evidence remain valid because product code and
provider configuration were untouched.

At the end of the source-recovery subphase,
`ENGINE_DECISION=MORE_EVIDENCE_REQUIRED`; `BEST_LOCAL_ENGINE=NONE`; and
`OCR_GARBLED_TEXT_BUG=OPEN`. Its next safe action was to obtain the same
original artifact from the user and run the full-document same-input
comparison. That subsequent comparison is recorded below; no product change
was authorized by the source-recovery result itself.

## Same-input real-document reality benchmark

**Phase:** `OCR-RAPIDOCR-SAME-INPUT-REALITY-BENCHMARK-1`
**Input classification / placement:** `CONFIDENTIAL` / `LOCAL_ONLY` on local macOS.

The user re-provided the original artifact. Its SHA-256 exactly matched the
Tesseract baseline artifact:
`1ac6f72975d4986c82cf09e21ac400e81c82f72947520e72ae27b61289d120af`.
It is a 1,758,745-byte PNG at 1536×1024. RapidOCR received this full original
file unchanged: no crop, resize, rotation, enhancement, or compression was
performed. No cloud OCR or external-AI request was made.

The verified runtime was re-read before the benchmark: Python 3.11.15,
RapidOCR 3.9.2, ONNX Runtime 1.29.0, OmegaConf 2.3.1, and ANTLR 4.9.3;
`pip check` passed. The public Songti fixture was re-run and passed. All three
actual model sessions used `CPUExecutionProvider`.

### RapidOCR full-document evidence

| Evidence | Result |
| --- | --- |
| Input hash | Exact match with Tesseract baseline |
| Full-document latency | 2,272 ms |
| Text / layout regions | 87 / 87 |
| Raw text evidence | 719 UTF-8 characters; SHA-256 `222fc86ddf9fb34db61d149124e41b301c5512500ede787ff8863b77b90fd4b4` |
| Confidence summary | 87 regions; min 0.7411, mean 0.9881, max 1.0000 |
| `发货单` | EXACT |
| `FH-20240627-001` | EXACT |
| Known quantity `120` | EXACT |

No real OCR text is stored in this repository. The raw-text hash and the
field-state evidence above are retained solely for same-input provenance.

### Label and numeric boundary

| Required business concept | RapidOCR result | Evidence boundary |
| --- | --- | --- |
| Supplier label `供应商` | `LABEL_MISS` | The source form uses `客户名称`, not the literal `供应商`; `客户名称` was `LABEL_EXACT`. |
| Order label `订单号` | `LABEL_PARTIAL` | The source-form label `订单编号` was observed; the requested literal was not. |
| Product-name label | `LABEL_EXACT` | Label only. |
| Quantity label | `LABEL_EXACT` | Label only. |
| Unit-price label | `LABEL_EXACT` | Label only. |
| Amount label | `LABEL_EXACT` | Label only. |
| Total-amount label | `LABEL_EXACT` | Label only. |
| Known quantity `120` | `EXACT` | Independently known anchor. |
| Other order / price / amount values | `VALUE_EXTRACTED_UNVERIFIED` | Presence was observed but values are not treated as ground truth. |

### Same-input comparison and decision

| Dimension | Existing Tesseract.js + `chi_sim` baseline | RapidOCR 3.9.2 local result |
| --- | --- | --- |
| Document type | EXACT | EXACT |
| Document number | EXACT | EXACT |
| Known quantity `120` | Not reliable | EXACT |
| Chinese critical-label coverage | Not reliable | Five required labels exact, one semantic-equivalent partial; literal supplier label absent from source form |
| Layout usefulness | Insufficient for structured review | 87 positioned regions; materially more useful for a table document |
| Raw-text integrity | Engine-raw corruption confirmed | Engine output retained in-memory; stable evidence hash recorded |
| Runtime / placement | Browser Tesseract baseline | Verified local Python / CPU runtime |
| Privacy eligibility | No external call observed | `LOCAL_ONLY`; external uploads `0` |

`KNOWN_NUMERIC_INTEGRITY=PASS` only for the known anchor `120`. It is not a
claim that unverified prices or monetary amounts are correct. The first real
document shows clearly higher Chinese label coverage and known-number accuracy
than the same-input Tesseract baseline, with no known numeric hallucination.

`ENGINE_DECISION=LOCAL_PRIMARY_CANDIDATE`
`BEST_LOCAL_ENGINE=RapidOCR 3.9.2 (benchmark candidate only)`
`TESSERACT_FUTURE_ROLE=LIGHTWEIGHT_FALLBACK_CANDIDATE`

This unlocks, but does not implement, the next design work:
`OCR_PROVIDER_CONTRACT=NEXT_UNLOCKED`, `OCR_RESOURCE_ROUTER=NEXT_UNLOCKED`,
and `RAPIDOCR_ADAPTER=NEXT_UNLOCKED`. `PADDLEOCR=RESERVED`; it is not
triggered by this result. `OCR_GARBLED_TEXT_BUG` remains `OPEN`, because
RapidOCR has not been integrated into the product or verified through the
product browser path.

### Failure learning and closure boundary

`RAPIDOCR_RUNTIME_RECOVERY=PASS` and
`REAL_DOCUMENT_CAPABILITY=VERIFIED_FOR_THIS_SINGLE_ARTIFACT`. Runtime health
and synthetic-fixture success alone were insufficient; the same original input
was necessary to establish this capability evidence. A benchmark candidate is
not a product remediation. Product integration, provider-contract validation,
and product reality proof require separate approval.

## Product integration and reality proof

**Phase:** `OCR-PROVIDER-CONTRACT-RESOURCE-ROUTER-RAPIDOCR-ADAPTER-1`
**Status:** `VERIFIED_LOCAL_PRODUCT_PATH`
**Deployment status:** local worktree only; not committed, pushed, or deployed.

The implementation adds a small provider contract and resource router to the
existing OCR architecture. Automatic selection is policy-aware and uses the
first provider that is both eligible and healthy: RapidOCR local is first and
the existing local Tesseract path is the only fallback. A provider that is
cloud-hosted, mock-backed, unavailable, or incompatible with
`CONFIDENTIAL / LOCAL_ONLY` input is not eligible. When no eligible local
provider is ready, the run ends as `OCR_CAPABILITY_NOT_READY`; it does not
manufacture a successful result.

RapidOCR execution is owned by the Node backend and a minimal Python adapter.
Readiness verifies the configured absolute Python runtime, adapter, imports,
model initialization, and `CPUExecutionProvider`. Recognition verifies MIME,
size, classification, placement, and SHA-256 before execution. It writes a
mode-0600 temporary input, runs with a private temporary working directory,
checks the adapter's input-hash readback, and removes the temporary directory
in `finally`. The browser can call this path only from a loopback origin; the
public static Pages build therefore cannot upload a confidential image to an
unowned OCR endpoint.

### Same-input product evidence

The product test used only the explicitly supplied PNG with SHA-256
`1ac6f72975d4986c82cf09e21ac400e81c82f72947520e72ae27b61289d120af`.
The local service and authenticated API returned the same RapidOCR result
provenance hash,
`222fc86ddf9fb34db61d149124e41b301c5512500ede787ff8863b77b90fd4b4`,
87 positioned regions, RapidOCR 3.9.2, Python 3.11.15, and actual
`CPUExecutionProvider`. No raw confidential OCR text is recorded here.

The isolated product-browser proof started its own server on port 3212 and
Chrome CDP endpoint on 9323. It uploaded the same artifact through the real
OCR page, selected `rapidocr-local`, received readiness and recognition HTTP
200 responses, persisted the result, reloaded the page, and passed the
harness's engine-raw, normalized, structured, UI, provider, input-hash, and
all-anchor readback assertions. The browser transport emitted CDP close code
1006 while Chrome and the target remained alive; the bounded readback channel
reconnected to the same target identity and completed the proof. Chrome also
reported CVDisplayLink and Crashpad/updater environment warnings. Neither
warning changed the OCR result, and creator-owned cleanup confirmed both
ports released.

| Product completion gate | Result |
| --- | --- |
| Provider contract / policy eligibility | PASS |
| Resource router / per-run readiness | PASS |
| RapidOCR adapter / dependency preflight | PASS |
| Capability readiness | READY |
| Confidential local-only policy | PASS |
| Same-input SHA-256 | PASS |
| Actual product provider | `rapidocr-local` |
| Browser engine-raw readback | PASS |
| Browser normalized / structured readback | PASS |
| Browser UI and provenance readback | PASS |
| `发货单`, `FH-20240627-001`, `120` | PASS |
| `产品名称`, `数量`, `单价`, `金额`, `合计金额` | PASS |
| External business-data uploads | `0` |
| Cloud OCR calls | `0` |
| External AI calls | `0` |

The normalized result is still allowed to enter `partial_success` when the
existing conservative garbled-text detector requests human review. That is a
truthful review boundary, not provider fallback or mock success. Engine raw,
normalized text, structured source stage, actual provider, input identity,
layout regions, and routing evidence remain separately visible.

### Completion decision

For this exact user-provided artifact, the previously observed Tesseract
garbling is no longer reproduced on the real product path after selection of
the verified RapidOCR local provider. The same-input anchors, layout evidence,
product browser readback, and local-only policy all passed. Therefore
`OCR_GARBLED_TEXT_BUG=CLOSED` for the scoped defect and artifact. This does not
claim universal OCR accuracy: unverified monetary values still require human
review, the local RapidOCR runtime must be provisioned and configured on each
installation, and public GitHub Pages remains a static demo rather than a
confidential OCR execution environment.
