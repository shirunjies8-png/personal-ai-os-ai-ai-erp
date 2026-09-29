# Valve Real DOCX Reference Template Structured Extraction Entry Review

Status: ENTRY REVIEW COMPLETE / IMPLEMENTATION NOT STARTED

## Scope and source role

This is a read-only, local/private review of the first reference DOCX. It does
not implement a parser, current client project, quotation engine, product
matching, DWG handling, drawing generation, UI, API, database migration, cloud
deployment, or external AI integration.

```text
FIRST_REFERENCE_TEMPLATE_SOURCE = REFERENCE_TEMPLATE_SOURCE
CURRENT_CLIENT_PROJECT = NOT_CREATED
REFERENCE_DATA_CANNOT_BECOME_PROJECT_TRUTH = REQUIRED
SOURCE_CONFIDENTIALITY = CONFIDENTIAL / LOCAL / PRIVATE / GIT_IGNORED
```

The resolved source is:

| Field | Value |
| --- | --- |
| ZIP member | `江苏招标文件/2.阀门/竞争性谈判文件-连云港石化产业基地拓展区板桥片区蒸汽管道工程阀门采购.docx` |
| Size | 134,385 bytes |
| SHA-256 | `1c7e6c72046e5d2a79715b30c4f6097b8bf11f3fef08248e7538a8f3e78ac878` |
| Resolution method | ZIP member content SHA-256, then filename decoding verification |
| Extraction | isolated temporary directory; cleanup verified |

The document's purchaser, project name/number, control price, quantities,
specifications, DN, PN, dates, contact data, addresses, delivery/payment/tax
terms, and historical quotation values remain `REFERENCE_ONLY`. They cannot
satisfy a future project field.

## Existing capability and dependency audit

| Area | Existing evidence | Review result |
| --- | --- | --- |
| Frontend Word text read | `core.js` uses browser Mammoth | `PARTIAL`; no backend stable locators |
| DOCX export | `core.js` uses browser JSZip | unrelated to safe input parsing |
| Mammoth package | direct dependency; installed `1.12.0` | raw text support, not a source-node/provenance parser |
| JSZip / unzipper | installed transitively (`3.10.1` / `0.10.14`) | not a declared backend parser contract |
| XML libraries | `@xmldom/xmldom` and `saxes` installed transitively | no existing secure DOCX structured parser or service |

```text
EXISTING_DOCX_CAPABILITY = PARTIAL
NEW_DEPENDENCY_REQUIRED = YES
```

The implementation review recommends declaring direct, pinned dependencies for
the chosen local parser path rather than importing transitive packages:

- `unzipper` for controlled archive entry access after Foundation manifest checks;
- `saxes` for bounded streaming OOXML parsing without external resource loading.

No dependency was installed in this review. The implementation must review
package ownership, update lockfile deliberately, enforce entry/size/count
limits before parse, reject traversal, forbid macros, set a parser timeout, and
never use document-controlled paths as shell input.

## Direct OOXML structure evidence

The resolved DOCX contains all required first-pass OOXML parts:

```text
word/document.xml = PRESENT
word/styles.xml = PRESENT
word/numbering.xml = PRESENT
word/_rels/document.xml.rels = PRESENT
```

Direct OOXML observation, without reproducing document text:

| Metric | Observed |
| --- | ---: |
| Paragraph nodes | 969 |
| Top-level tables | 5 |
| Total table rows | 75 |
| Cell-count range per row | 1–8 |
| Tables with merged cells | 2 |
| Repeated-header markers | 0 |
| Nested tables | 0 |
| Empty/spacer rows | 0 |
| Heading-style candidates | 29 |
| Numbered candidates | 11 |
| Text-pattern candidates | 325 |

Heading extraction is feasible with an ordered policy: Word heading style is
`DOCUMENTED`, numbering/style combination is `DOCUMENTED` where present, and
text-pattern classification is `INFERRED`. The future parser must preserve that
distinction rather than treating a heuristic as source fact.

Table extraction is feasible. The five tables have deterministic zero-based
indexes; two contain merged cells and therefore require a parser that preserves
cell structure rather than flattening raw text. No nested tables were observed.

## Stable locator and provenance contract

The first parser slice must emit immutable source provenance for every node and
candidate:

```text
source_document_id
source_sha256
parser_version
extraction_method

paragraph: document / paragraph_index
table cell: document / table_index / row_index / cell_index
```

Optional heading path or OOXML node metadata may be added only when the parser
can produce it deterministically. Character offsets alone are insufficient.
No locator may be invented before the parser observes it.

## Source-supported reusable structures

The source contains locatable evidence for quotation-related tables, technical
response/parameter-oriented tables, and business/qualification/delivery/payment
structure. It also contains locatable control/max-price material, quote
invalidity material, and a list-versus-drawing priority rule.

The future output may produce only:

- `TemplateSection` candidates with source locator and confidence/source method;
- `TemplateTable` column schemas, without historical rows becoming defaults;
- `TemplateField` candidates with derived labels, datatype/unit candidates, and
  an explicit `DOCUMENTED` or `INFERRED` classification;
- `ReferenceValue` records for concrete historical facts.

The following categories were observed as reference-value categories in the
source: purchaser, project/project-number, control price, quote deadline,
quantity, valve specification, DN, PN, material, tax, payment, address, and
contact. Delivery wording needs a broader future semantic classifier and is not
claimed as directly confirmed by this metadata-only probe.

`TemplateTable.columns` may reuse observed schema. Specific historical rows,
prices, quantities, specifications, terms, and drawing dimensions remain
`REFERENCE_ONLY`.

## Deterministic parser plan

```text
Private DOCX
  -> secure local archive reader
  -> bounded OOXML structural parse
  -> paragraph/table/cell nodes with locators
  -> deterministic structure candidates
  -> Foundation model helpers
  -> ReferenceTenderTemplate candidates
```

The parser is not an LLM, OCR, quotation, project-generation, or drawing
service. Deterministic work includes container validation, XML node traversal,
paragraph/table/cell extraction, locators, source hash, and exact text. Section
purpose, business meaning, and semantic keys remain candidates and must be
marked `INFERRED`, `UNKNOWN`, or `NEEDS_CLASSIFICATION` when not explicit.

```text
FIRST_DOCX_EXTRACTION_EXTERNAL_AI_REQUIRED = NO
AI_GATEWAY_REQUIRED_IF_FUTURE_AI = YES
```

The new service boundary is:

```text
valveReferenceDocxParserService
  DOCX -> structured source nodes / extraction candidates
```

It must reuse `valveReferenceTenderTemplateService` for confidentiality,
`ReferenceTenderPackage`/`ReferenceTenderDocument`, `TemplateField`, inheritance
policy, residual scanning, and final-generation safety gates. It must not create
a second project model, inheritance policy, audit truth store, or parser/runtime.

## Security, disclosure, and runtime boundary

| Boundary | Required implementation behavior |
| --- | --- |
| XML | streaming parser with external-entity/resource resolution disabled; current source contains no DOCTYPE/entity declaration |
| Relationships | no follow/fetch/execute; current `document.xml.rels` has zero external relationships |
| Macros / embedded objects | no execution; current source has no `vbaProject.bin` and no `word/embeddings/` entries |
| Logging | no complete source body, pricing rows, contact data, or XML in logs |
| Storage | isolated temporary processing, minimal structured result, cleanup in success and failure paths |
| Output | no full source body returned to frontend; metadata/provenance by explicit review only |
| External AI | no call in first parser slice; future task-relevant fragments only through AI Gateway |

`PARSER_TIMEOUT`, redaction, and audit persistence remain contracts until a
future implementation proves runtime enforcement.

## Test and integration plan

CI must use a new synthetic/redacted DOCX fixture containing one heading, one
paragraph, one table, a merged cell because the source needs it, a quotation
field, a project-specific value, a valve field, and a source-priority rule. It
must not copy source paragraphs or values.

Local opt-in integration testing may run only when the ignored source exists.
It must verify parsing, paragraph/table nodes, locators, section/table/field
candidates, source priority/control-price rule locators, `REFERENCE_ONLY`
classification, no Git/public/log leakage, and zero external AI calls.

## Implementation boundary

```text
DB_SCHEMA_CHANGE_REQUIRED = NO (first in-memory/parser-test slice)
API = DEFERRED
UI = DEFERRED
LEGACY_DOC_STRUCTURED_EXTRACTION = RESERVED
DWG_STRUCTURED_EXTRACTION = NOT_VERIFIED
REAL_DOCX_IMPLEMENTATION_STATUS = NOT_STARTED
IMPLEMENTATION_SIZE = MEDIUM
```

Expected later task-owned files, subject to implementation approval:

- NEW: `services/valveReferenceDocxParserService.js`
- NEW: deterministic parser test and synthetic/redacted DOCX fixture
- MODIFY: `services/valveReferenceTenderTemplateService.js` only for explicit
  Foundation integration points if necessary
- MODIFY: domain documentation and `project.md`

No parser, dependency installation, API, UI, database migration, commit, push,
or deploy is performed by this Entry Review.
