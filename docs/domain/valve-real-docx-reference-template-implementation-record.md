# Valve Real DOCX Reference Template Structured Extraction — Implementation Record

## Status

`FINAL_REVIEW_REMEDIATION_IMPLEMENTED_CANDIDATE` — the local/private deterministic parser now carries unified candidate provenance, documented counting semantics, and current-tree private-path removal. This record does not claim a Client Tender Project, quotation, product match, drawing, API, UI, database schema, cloud deployment, or production readiness. Final Review must still re-run the complete contract.

## Scope and boundaries

- Input: `.docx` only; caller must provide an exact approved SHA-256 when source identity is required.
- Placement: local/private, memory-only parsing. No external AI, cloud OCR, network fetch, database write, UI route, or API route is introduced.
- Truth: every extracted concrete value is emitted only as `REFERENCE_ONLY`. Reference values cannot satisfy current-project required fields and remain subject to the existing residual scanner and generation safety gate.
- Foundation: results reuse `ReferenceTenderPackage`, `ReferenceTenderDocument`, `ReferenceTenderTemplate`, `TemplateSection`, `TemplateTable`, `TemplateField`, and `ReferenceValue` candidates. No second tender/template runtime or truth store is created.

## Deterministic parser contract

`services/valveReferenceDocxParserService.js` reads OOXML directly using a bounded ZIP reader and SAX XML parser.

It produces ordered `blocks`, paragraphs, tables, rows, cells, style/numbering heading candidates, merge metadata, external-relationship metadata, reference candidates, and deterministic rule candidates.

Every `Section`, `Table`, `Field`, `ReferenceValue`, and `Rule` candidate has the same canonical provenance shape:

- `source_document_id`: the Foundation `ReferenceTenderDocument.reference_document_id`, deterministically derived as `refdoc_<source-hash-prefix>`; an optional caller label is retained only as an external source reference and never replaces this canonical identity.
- `source_hash`: the full SHA-256 of the exact `.docx` bytes parsed.
- `source_locator`: a deterministic hash-scoped OOXML locator.
- `extraction_method`: the deterministic OOXML method that produced the candidate.

Stable locators are source-hash scoped:

- `docx://<source_hash>/paragraph/<paragraph_index>`
- `docx://<source_hash>/table/<table_index>/row/<row_index>/cell/<xml_cell_index>`

`w:gridSpan` and `w:vMerge` are preserved as structural metadata. Heading candidates retain `STYLE`, `NUMBERING`, or `HEURISTIC` source and never become project truth. Rule candidates are deterministic text-pattern observations (`DETERMINISTIC_OOXML_TEXT_PATTERN`), not inferred business truth.

## Counting semantics

Counts are derived only from `word/document.xml` and its `w:body` subtree. Headers, footers, comments, notes, and relationship targets are outside this parser's input.

- `paragraph_count` counts every body-subtree `w:p`, including body paragraphs, table-cell paragraphs, nested-table paragraphs, empty paragraphs, and text-box paragraphs found beneath `w:body`.
- `table_count` counts only top-level `w:tbl` elements whose parent is `w:body`; `row_count` sums their `w:tr` rows, including header rows. A grid span or vertical merge does not change row count.
- `merged_table_count` counts top-level tables containing at least one `w:gridSpan` or `w:vMerge` cell property.
- `nested_table_count` reports tables below another table. `all_table_row_count` and `all_merged_table_count` expose the inclusive all-table view without changing the primary top-level counts.

The approved private reference source therefore has the independently reproducible primary counts `969` paragraphs, `5` top-level tables, `75` top-level table rows, and `2` merged top-level tables. The synthetic contract covers body, table-cell, nested-table, and empty paragraphs plus top-level/nested table, row, `gridSpan`, and `vMerge` semantics.

## Local safety contract

The parser rejects or bounds source file size, ZIP entry count, entry size, total uncompressed size, suspicious compression ratio, unsafe archive paths, missing `word/document.xml`, malformed XML, and DOCTYPE/entity declarations. Macro/executable/embedding entries are never executed or loaded as document text; they are metadata-only ignored entries. External OOXML relationships are represented as `EXTERNAL_REFERENCE_ONLY`, without dereferencing targets.

The source buffer is parsed in memory and no raw source, raw text, secret, or customer data is logged by the parser.

## Evidence

The synthetic test uses a redacted generated OOXML fixture and verifies block order, paragraph/table/cell locators, heading source, `gridSpan`, `vMerge`, reference-only enforcement, residual blocking, archive/XML rejection, macro non-execution, and temporary-fixture cleanup.

The opt-in private-source integration check uses an explicit file path plus exact approved SHA-256. Its report is limited to structural counts, source hash, and candidate rule types; it does not persist, print, track, or publish source text. At the reviewed source identity it observed:

- paragraphs: `969`
- top-level tables: `5`
- table rows: `75`
- merged-cell tables: `2`
- deterministic candidate rule types include `CONTROL_PRICE_RULE`, `INVALID_ABOVE_CONTROL_PRICE_RULE`, and `SOURCE_PRIORITY_RULE`.

The parser's resource limits are defined and enforced for ZIP/XML input. A wall-clock parser timeout is `DEFINED_ONLY`: the synchronous local parser does not currently provide a runtime cancellation primitive, and this record does not claim one.

## Privacy and history status

The current Valve task-owned docs/code contain no absolute local user path. A scoped Git-history audit found that an older committed source-audit revision contained a private absolute path. History is intentionally not rewritten in this remediation slice; therefore `HISTORICAL_PRIVATE_PATH_LEAK=YES` and `PUSH_PRIVACY_GATE=BLOCKED` until a separately approved history/privacy remediation is completed.

## Explicit non-goals

- Legacy `.doc` extraction and DWG semantics.
- Customer/project ingestion or any promotion of reference values into project truth.
- Product matching, pricing, quote creation, output generation, drawing generation, or UI/API integration.
- Any external model/provider or automated decision.

## Final Review gate

Final Review must independently check the exact parser/test changeset, run the synthetic contract and opt-in local source check, inspect the Foundation boundary, and confirm staging remains empty. No commit, push, or deployment is authorized by this record.
