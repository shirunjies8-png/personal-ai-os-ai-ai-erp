# Valve Tender Source Package Reality Audit

Status: SOURCE PACKAGE READ / MVP IMPLEMENTATION NOT STARTED

This audit uses the user-provided source package only. It does not implement the
Valve Tender Structured Extraction slice, does not create schemas, APIs, UI, or
quotation logic, and does not start W2.3.

## Package Identity

| Field | Value |
| --- | --- |
| Filename | `江苏招标文件(1).zip` |
| Original user path | `PRIVATE_REFERENCE_SOURCE` |
| Actual audited copy | `docs/source/valve/江苏招标文件(1).zip` |
| Size | 9,756,940 bytes |
| SHA-256 | `96c8295c021fcedb8bb39c7cf082bd1bb34757e6d8c084e4917e4916a2181780` |
| Extraction location | `/tmp/valve-source-audit/extracted` |
| Business files | 7 |
| Duplicate business file hashes | 0 |

System files ignored:

- `__MACOSX`
- `.DS_Store`
- `._*`

## Real Source Inventory

| # | Relative path | Type | Size | SHA-256 | Category | Parser status |
| --- | --- | --- | ---: | --- | --- | --- |
| 1 | `江苏招标文件/1、竞争性磋商文件（公开）-连云港虹洋热电有限公司新增西线热网工程截止阀采购.doc` | `.doc` | 483,698 | `cc72f2ab24c3dd37f42cbc695ee6fb2beb320a7bcd30975488756e265b9ac8f5` | TENDER_DOCUMENT / PRICE_OR_BOQ | `textutil` readable |
| 2 | `江苏招标文件/3.蝶阀/0、虹洋热电低碳循环供热创新示范项目 国产蝶阀技术规范书20230519（签字版）.docx` | `.docx` | 71,335 | `43e2d9f2111b8b7ea2bd21d22b25ea84dac0d9a4014d86ad1d481faa344af0d1` | TECHNICAL_SPECIFICATION | DOCX XML readable; about 95 tables |
| 3 | `江苏招标文件/3.蝶阀/1、竞争性谈判文件—虹洋热电低碳循环供热创新示范项目建安施工蝶阀增补采购.doc` | `.doc` | 419,066 | `162c2b3083eca0ae37816a807e0fbdc025dd0891abc36d533ae937c384610928` | TENDER_DOCUMENT / PRICE_OR_BOQ | `textutil` readable |
| 4 | `江苏招标文件/2.阀门/竞争性谈判文件-连云港石化产业基地拓展区板桥片区蒸汽管道工程阀门采购.docx` | `.docx` | 134,385 | `1c7e6c72046e5d2a79715b30c4f6097b8bf11f3fef08248e7538a8f3e78ac878` | TENDER_DOCUMENT / PRICE_OR_BOQ | DOCX XML readable; about 267 tables |
| 5 | `江苏招标文件/2.阀门/阀门及旋转补偿器技术规格表.dwg` | `.dwg` | 1,026,880 | `4e85e7d682d2badefc329b79e6b29021551c05c31246d00d0d0a5e72cc582acc` | DRAWING | metadata only; AutoCAD 2007/2008/2009 |
| 6 | `江苏招标文件/1球阀/1.竞争性谈判文件—徐圩新区石化基地次高压天然气管道三标段EPC工程阀门采购.doc` | `.doc` | 1,246,259 | `d9d4e70d9ce9b10d202a83f7b7f6e0bc0cfbdbaa18f23aa80404a5d5c0a4f2fb` | TENDER_DOCUMENT / TECHNICAL_SPECIFICATION / PRICE_OR_BOQ | `textutil` readable |
| 7 | `江苏招标文件/1球阀/4.图纸—徐圩新区石化基地次高压天然气管道三标段EPC工程阀门采购.dwg` | `.dwg` | 10,645,476 | `2965d3539902a6374ef7733ef98c59e4cb588fd78b3bf7fc4969640e93892d1f` | DRAWING | metadata only; AutoCAD 2013-2017 |

## Real Document Types

Confirmed:

- `.doc`
- `.docx`
- `.dwg`

Not present in the package:

- PDF
- XLS / XLSX

## Parser Status

| Parser area | Status | Evidence |
| --- | --- | --- |
| Legacy DOC | `READABLE_WITH_TEXTUTIL / CONVERSION_REQUIRED_FOR_STRUCTURED_TABLES` | 3 `.doc` files converted to text successfully; table structure is not reliably preserved enough for production extraction. |
| DOCX | `STRUCTURED_XML_READABLE` | 2 `.docx` files readable through OOXML; table counts observed. |
| PDF | `NOT_PRESENT` | No PDF in source package. |
| Excel | `NOT_PRESENT` | No `.xls` / `.xlsx` in source package. |
| DWG | `METADATA_ONLY` | 2 DWG files detected by `file`; no reliable DWG structured parser confirmed. |

DWG status:

```text
DWG_STRUCTURED_EXTRACTION = NOT_YET_VERIFIED
DWG_ROLE = SOURCE_REFERENCE / FUTURE_TEMPLATE_INPUT
```

## Real Valve Types Found

Source-backed valve types:

- 截止阀
- 止回阀
- 球阀
- 蝶阀
- 闸阀
- 疏水阀
- 旋转补偿器

These are recorded because they appear in source filenames or extracted document
text. They are not a complete valve taxonomy.

## Tender Project Fields Found

Source evidence confirms the need for:

- project name;
- project location;
- purchaser / procurement organization;
- procurement method: competitive consultation / competitive negotiation;
- procurement scope;
- control price / maximum price;
- quote invalidation rule when quote exceeds control price;
- delivery / supply period;
- quality requirement;
- qualification requirements;
- response file requirements;
- payment terms;
- tax / VAT rule;
- final quote / second-round quote language in several files.

Examples:

- Stop valve project: `连云港虹洋热电有限公司新增西线热网工程截止阀采购`; control price `234.0510 万元`; quote exceeding control price is invalid; supply period `30 日历天`; includes 13% VAT.
- Ball valve project: `徐圩新区石化基地次高压天然气管道三标段EPC工程阀门采购`; control price `69.95 万元`; quote exceeding control price is invalid; supply period `100 日历天`.
- Comprehensive valve project: `连云港石化产业基地拓展区(板桥片区)蒸汽管道工程阀门采购`; control price `58.1916 万元`; quote exceeding control price is invalid; includes BOQ / engineering quantity list.
- Butterfly valve project: `虹洋热电低碳循环供热创新示范项目建安施工蝶阀增补采购`; control price `88 万元`; quote exceeding control price is invalid; supply period `50 日历天`.

## Valve Requirement Fields Found

Confirmed from readable source text:

- item number / list row;
- valve type;
- quantity;
- unit;
- DN / nominal size;
- PN / pressure class;
- pressure;
- temperature;
- medium;
- pipe / connection size;
- connection type;
- material;
- valve body / valve stem / valve seat / disc / seal language;
- leakage class;
- manufacturing / structure language;
- drive / actuator language;
- actuator power supply;
- actuator protection class;
- open/close time;
- torque;
- standards;
- inspection and test requirements;
- drawing reference.

High-value source evidence:

- Comprehensive valve BOQ contains rows such as `闸阀 DN350 PN40`, `截止阀 DN40 PN40`, and notes that if the list and drawing differ, the list description prevails.
- Butterfly technical specification contains `电动蝶阀参数表` with pipe diameter, connection type, quantity, pipe material, design pressure, design temperature, and pipe orientation.
- Ball valve procurement text contains `Q367F-25C DN400 5个`, `DN300 2个`, `DN200 2个`, plus technical specification content and DWG drawing reference.
- Stop valve procurement text contains `Y型截止阀`, `PN100`, `DN80/DN40`, pipe sizes, material `15CrMoG`, quantities, and technical specification references.

## Quote Rules Found

Confirmed:

- control price / maximum price;
- quote exceeding control price is invalid;
- final quote;
- second-round / follow-up quote references;
- fixed item list / BOQ rows;
- unit price;
- total price / combined price;
- VAT-inclusive price, commonly `含13%增值税`;
- freight / packaging / insurance / management fee / risk / profit / tax included in unit price language;
- payment terms;
- delivery terms.

## Technical Specification Fields Found

Confirmed for valve technical specs:

- usage / project context;
- medium;
- quantity;
- execution standards;
- valve type;
- nominal size / pressure rating;
- design pressure / design temperature;
- operating pressure / operating temperature language;
- connection and pipe dimensions;
- torque;
- leakage class;
- valve structure / manufacturing;
- body material;
- disc / ball / gate / stem / seat / seal language;
- packing / gasket language;
- pressure drop / resistance language;
- connecting pipe material.

Confirmed for actuator:

- manufacturer / brand candidate language;
- model / series candidate language;
- power supply;
- protection class;
- motor power and speed language;
- insulation class;
- gear output speed language;
- open/close time;
- limit switch;
- torque switch;
- control power;
- handwheel;
- local / remote switch.

## Standards Found

Source-backed standards include:

- `NB47044-2014`
- `GB/T13927-2008`
- `JB/T 9092-1999`
- `GB12220-2015`
- `GB12221-2005`
- `GB12224-2015`
- `GB12228-2006`
- `GB12229-2005`
- `GB12230-2005`
- `GB12236-2008`
- `GB12238-2008`
- `GB37828-2019`
- `JB/T5263-2005`
- `DL/T 922-2016`
- `MSS-SP-61`
- `ASME 第9章`
- `ISO9001`
- ball-valve package also references API / ASME / HG/T standard families.

No internet lookup was used to complete standard titles or editions beyond the
source text.

## Certificate / Quality Document Requirements Found

Confirmed:

- business license / qualification certificates;
- manufacturer authorization where required;
- type test report or mandatory certification certificate;
- ISO quality management certificate where required;
- inspection records;
- test reports;
- quality certificate / quality proof;
- product certificate of conformity;
- packing list;
- technical documents;
- drawings and installation / operation / maintenance manuals;
- material chemical composition and mechanical performance reports in the ball
  valve technical content.

## Source Priority Rules Found

Confirmed examples:

- comprehensive valve BOQ says when list and drawing differ, the list
  description prevails.
- several procurement documents say response-file original/copy inconsistencies
  are resolved by the original.
- comprehensive valve document includes broader interpretation order language:
  contract documents first where applicable, then announcement, supplier
  instructions, evaluation method, response format, later sequence / later time
  versions where applicable, and purchaser interpretation if still unresolved.
- butterfly specification says Chinese version prevails when bilingual
  materials are provided.

These rules must be represented as source-backed `RESOLUTION_RULE` records, not
hardcoded industry assumptions.

## Conflicts Found

No actual conflicting value pair was confirmed in this audit because DWG content
was not structurally parsed and no full cross-document field reconciliation was
implemented.

Confirmed conflict risk:

- comprehensive valve text explicitly anticipates list-vs-drawing mismatch and
  states list description should prevail.

Status:

```text
CONFLICTS_FOUND = RISK_CONFIRMED / NO_VALUE_PAIR_CONFIRMED
```

## Current Candidate Schema Reconciliation

Confirmed by source:

- TenderProject;
- TenderDocument;
- ValveRequirementItem;
- QuoteRule;
- TechnicalRequirement;
- StandardRequirement;
- Certificate / deliverable requirement;
- Source provenance;
- Conflict / resolution rule;
- Human Review trigger.

Additions required:

- `ResolutionRule` with source-backed priority/interpretation rules;
- `CertificateRequirement` / `QualityDocumentRequirement`;
- `TenderResponseDocumentRequirement`;
- `BOQLineItem` or explicit BOQ view of `ValveRequirementItem`;
- `ParserCapability` / `ParserStatus` per source document;
- `DWGReference` metadata object before structured DWG extraction exists.

Future reserved:

- Product master;
- deterministic product matching;
- full quotation engine;
- compliance matrix generation;
- parametric drawing generation.

## First Reference Project Selection

Selected:

```text
FIRST_REFERENCE_PROJECT =
连云港石化产业基地拓展区(板桥片区)蒸汽管道工程阀门采购
```

Why:

- readable `.docx` tender file;
- clear project name and control price;
- explicit engineering quantity list / BOQ;
- multiple valve types in one structured list;
- real DN / PN / quantity rows;
- explicit quote invalidation rule;
- explicit list-vs-drawing priority rule;
- paired DWG reference exists;
- good fit for first structured extraction without requiring legacy `.doc`
  conversion as the first dependency.

Runner-up:

```text
虹洋热电低碳循环供热创新示范项目建安施工蝶阀增补采购
```

Reason: has a strong butterfly technical specification `.docx`, but its tender
document is legacy `.doc`; good second candidate after the first structured
extraction path is proven.

## First Implementation Slice Confirmation

Recommended slice remains:

```text
Valve Tender Structured Extraction
```

Include:

- `TenderProject`
- `TenderDocument`
- `ValveRequirementItem`
- `TenderRule`
- `QuoteRule`
- `TechnicalRequirement`
- `StandardRequirement`
- `CertificateRequirement`
- `ResolutionRule`
- Evidence/provenance refs
- Conflict candidates
- Human Review flags

Exclude:

- full quotation engine;
- product auto matching;
- final tender generation;
- automatic CAD;
- DWG editing;
- cloud deployment;
- ERP/MES integration;
- automatic external sending.

## Parser Requirements

| Capability | Status | Need |
| --- | --- | --- |
| DOCX structured parser | `PARTIAL` | Required for first slice; OOXML text/tables are readable, but production parser must preserve table/row/cell locators. |
| Legacy DOC conversion | `PARTIAL / CONVERSION_REQUIRED` | Required after first slice for stop valve, ball valve, and butterfly tender `.doc` files. |
| PDF parser | `NOT_REQUIRED_FOR_CURRENT_PACKAGE` | No PDF present. |
| Excel parser | `NOT_REQUIRED_FOR_CURRENT_PACKAGE` | No XLS/XLSX present. |
| DWG metadata handler | `NEEDS_IMPLEMENTATION` | Required to register DWG as evidence/reference. |
| DWG structured parser | `BLOCKED / RESERVED` | Not required for first extraction slice. |

## Human Review Triggers

The first slice must send these cases to Human Review:

- `INFERRED` fields;
- `CONFLICT` fields;
- critical `MISSING` fields;
- ambiguous valve type;
- ambiguous DN/PN;
- unclear material;
- list/drawing/spec mismatch;
- uncertain actuator parameter;
- price rule conflict;
- final quote approval;
- drawing dimension uncertainty.

## AI Boundary

AI may assist with extraction, classification, summarization, candidate
interpretation, and drafting.

AI does not own final valve dimension truth, product master truth, cost truth,
final quote, final compliance, engineering drawing truth, or final technical
approval.

## Provider / Deployment Status

```text
QWEN_STATUS = PROVIDER_CANDIDATE / NOT_HARD_DEPENDENCY
WORKBUDDY_STATUS = OPTIONAL / RESERVED
CLOUD_DEPLOYMENT_STATUS = NEXT_AFTER_MVP_CORE
PUBLIC_DEPLOYMENT_HARDENING_STATUS = PAUSED / PRESERVED
W2_3_STATUS = NOT_STARTED
SECOND_GENERIC_PRODUCT_PATH = PAUSED
INDUSTRIAL_CONTROL = NOT_STARTED
```

## Next

Approve:

```text
Valve Tender Structured Extraction Slice
```

First implementation input:

```text
江苏招标文件/2.阀门/竞争性谈判文件-连云港石化产业基地拓展区板桥片区蒸汽管道工程阀门采购.docx
```
