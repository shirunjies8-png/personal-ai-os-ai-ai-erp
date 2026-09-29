# Valve Tender / Quotation / Sample Drawing Entry Review

Status: ENTRY REVIEW — SOURCE PACKAGE AUDITED / IMPLEMENTATION NOT STARTED

This document records the first RealityOS domain entry review for the current
real-world landing priority:

```text
VALVE_TENDER_QUOTATION_DRAWING
```

It is not a demo layer, not a parallel architecture, and not a claim that a
valve tender product is complete. The domain must reuse the existing RealityOS
owners for Identity, Organization, Authority, Capability, AI Gateway,
Document/OCR, Evidence, Verification, Recovery, Audit, Costing, Knowledge,
Workflow, File Center, and document generation.

## Source Package Audit

Expected user package:

```text
江苏招标文件(1).zip
```

Source package audit result:

```text
SOURCE_PACKAGE_FOUND = YES
SOURCE_PACKAGE_AUDIT = COMPLETE
SOURCE_PACKAGE_SHA256 = 96c8295c021fcedb8bb39c7cf082bd1bb34757e6d8c084e4917e4916a2181780
```

Detailed source audit:

- `docs/domain/valve-source-package-reality-audit.md`

The business architecture below has been reconciled against the first source
package audit. It remains an architecture / MVP proposal only; implementation
has not started.

## Real Document Types

Expected document types from the user-specified package description:

- competitive consultation / negotiation tender files;
- technical specification documents;
- DWG drawings;
- valve and rotary compensator specification tables;
- procurement and quotation rule documents.

Verification status:

```text
REAL_DOCUMENT_TYPES = DOC / DOCX / DWG
```

## Valve Types Found

Expected valve types from the user-specified package description:

- stop valve / 截止阀;
- ball valve / 球阀;
- butterfly valve / 蝶阀;
- comprehensive valve procurement package;
- rotary compensator / 旋转补偿器 related technical material.

Verification status:

```text
VALVE_TYPES_FOUND = 截止阀 / 止回阀 / 球阀 / 蝶阀 / 闸阀 / 疏水阀 / 旋转补偿器
```

## DWG Files Found

Expected DWG sources from the task description:

- ball valve DWG drawing;
- valve and rotary compensator technical specification table DWG.

Verification status:

```text
DWG_FILES_FOUND = 2
DWG_STRUCTURED_EXTRACTION = NOT_YET_VERIFIED
```

DWG must initially be treated as read/reference/template source. No dimension may
be guessed from OCR or visual inspection without a verified extraction or human
review path.

## First Reference Project

Selected after source audit:

```text
FIRST_REFERENCE_PROJECT =
连云港石化产业基地拓展区(板桥片区)蒸汽管道工程阀门采购
```

Selection evidence:

1. readable `.docx` tender file;
2. clear project name, control price, and invalid quote rule;
3. structured engineering quantity list / BOQ with multiple valve types;
4. source-backed DN / PN / quantity rows;
5. explicit list-vs-drawing priority rule;
6. paired DWG reference exists, while DWG structured extraction remains
   reserved.

## MVP Boundary

First product loop:

```text
Tender
→ Structured Requirement
→ Valve Items
→ Technical Compliance
→ Quotation Draft
→ Parametric Sample Drawing Draft
→ Human Approval
```

Explicit exclusions:

- automatic CAD production design;
- automatic DWG modification;
- automatic order placement;
- automatic contract signing;
- automatic quote sending;
- ERP/MES deep integration;
- PLC/CNC/industrial control.

## TenderProject Schema

Minimum fields:

- `project_id`
- `project_name`
- `purchaser`
- `tender_type`
- `tender_no`
- `bid_deadline`
- `control_price`
- `tax_rate`
- `pricing_method`
- `quote_rounds`
- `delivery_requirement`
- `source_documents`
- `status`

All fields should support source references and a domain truth level.

## TenderDocument Schema

Minimum fields:

- `document_id`
- `project_id`
- `filename`
- `document_type`
- `source_hash`
- `extraction_status`
- `source_page`
- `source_section`
- `version`
- `provenance`

## ValveRequirementItem Schema

Minimum candidate fields:

- `item_no`
- `valve_type`
- `usage`
- `medium`
- `quantity`
- `nominal_size`
- `pressure_class`
- `design_pressure`
- `design_temperature`
- `operating_pressure`
- `operating_temperature`
- `connection_type`
- `pipe_size`
- `pipe_material`
- `body_material`
- `disc_ball_gate_material`
- `stem_material`
- `seat_material`
- `seal_type`
- `leakage_class`
- `manufacturing_type`
- `drive_type`
- `actuator_type`
- `actuator_model`
- `actuator_power`
- `protection_class`
- `open_close_time`
- `torque`
- `standard`
- `inspection_requirement`
- `drawing_ref`
- `source_ref`

Field requirement policy:

```text
REQUIRED | OPTIONAL | UNKNOWN | NOT_APPLICABLE
```

The first implementation must not force every candidate field to be required.

## Quote Rule Schema

Tender quotation rules must capture:

- `control_price`
- `fixed_unit_price`
- `total_price`
- `tax_rate`
- `quote_rounds`
- `invalid_if_exceeds_control_price`
- `quantity_change_rule`
- `comprehensive_unit_price`
- `transport_cost_rule`
- `packaging_cost_rule`
- `inspection_cost_rule`
- `management_cost_rule`
- `profit_rule`
- `tax_fee_rule`
- `source_ref`

AI does not own final price truth. Final quote must be human approved.

## Quotation Domain Model

The quotation model should reuse the existing costing capabilities where
possible and must not create a second costing engine without review.

Target formula:

```text
Valve Product Base Cost
+ Material
+ Machining
+ Actuator
+ Accessories
+ Inspection
+ Packaging
+ Transport
+ Management Cost
+ Risk
+ Profit
+ Tax
= Suggested Quote
```

Price states:

- `cost`
- `suggested_price`
- `minimum_acceptable_price`
- `final_approved_quote`

## Technical Compliance Schema

Technical compliance matrix:

| Tender requirement | Our product parameter | Status | Source | Notes |
| --- | --- | --- | --- | --- |

Allowed statuses:

- `COMPLY`
- `DEVIATION`
- `MISSING`
- `CONFLICT`
- `NEED_HUMAN_REVIEW`

This output should generate technical response and technical deviation tables,
but only from source-backed structured data or verified product facts.

## Product Master Requirement

The MVP must reserve a real enterprise product library. It is not LLM memory.

Minimum candidate fields:

- `manufacturer`
- `series`
- `valve_type`
- `model`
- `dn_range`
- `pn_range`
- `medium_compatibility`
- `temperature_range`
- `material_options`
- `connection`
- `standard`
- `actuator_compatibility`
- `dimension_table`
- `weight`
- `cost_base_price`
- `drawing_template`
- `certificates`
- `test_reports`

Matching must use deterministic hard requirements such as DN, PN, temperature,
medium, material, connection, and standard. A hard requirement mismatch cannot be
auto-labeled `MATCHED`.

## Parametric Drawing Model

Drawing flow:

```text
Verified Product
→ Drawing Template
→ Dimension Table
→ Parameter Binding
→ SVG/PDF
```

DWG policy for the first version:

```text
DWG = READ / REFERENCE / TEMPLATE SOURCE
DWG_COMPLEX_EDITING = EXCLUDED
```

Minimum `ValveDrawingTemplate` fields:

- `template_id`
- `valve_type`
- `series`
- `applicable_dn`
- `applicable_pn`
- `source_dwg_ref`
- `source_svg_ref`
- `dimension_fields`
- `connection`
- `actuator_position`
- `revision`
- `verified_by`
- `evidence_refs`

## Standards Model

Standards should not be stored only as free text.

Minimum fields:

- `standard_code`
- `standard_title`
- `edition_year`
- `requirement_ref`
- `applies_to`
- `mandatory_or_contractual`
- `source_document`

No complete standards database is proposed in this entry review.

## Source Provenance Model

Every extracted field must retain:

- `value`
- `value_status`
- `source_document`
- `source_hash`
- `source_page`
- `source_section`
- `source_quote_or_anchor`
- `extraction_method`
- `verification_status`
- `evidence_refs`

Example:

```text
valve_type = 蝶阀
value_status = DOCUMENTED
source_document = <tender technical specification>
source_section = 3.2.1.1
```

## Domain Truth Levels

The valve tender domain uses data-confidence levels:

- `DOCUMENTED`
- `INFERRED`
- `VERIFIED`
- `CONFLICT`
- `MISSING`

These do not replace the RealityOS Kernel Effect taxonomy.

## Conflict Handling

Conflicting source facts must be preserved, not overwritten.

Example:

```text
Source A: DRAWING → DN300
Source B: BOQ → DN350
Conflict: YES
Resolution rule: BOQ_OVERRIDES_DRAWING
Resolution source: tender clause reference
```

Resolution rules must themselves be source-backed.

## Human Review Boundary

Human review is required for:

- `CONFLICT`
- `INFERRED`
- `MISSING`
- price approval;
- product selection uncertainty;
- drawing dimension uncertainty;
- standards applicability uncertainty;
- final quote approval.

## AI Model Boundary

Model/provider-neutral AI may assist with:

- extraction;
- classification;
- drafting;
- explanation.

Rules, database, and human approval own:

- dimensions;
- price truth;
- hard standards;
- product facts;
- approval.

Qwen/Bailian status:

```text
QWEN_STATUS = RESERVED_PROVIDER_OPTION
```

WorkBuddy status:

```text
WORKBUDDY_STATUS = OPTIONAL_RESERVED
```

## Cloud Deployment Status

```text
CLOUD_DEPLOYMENT_STATUS = NEXT_AFTER_MVP_CORE
```

Do not deploy an empty system before the real domain schema, workflow, and first
import are verified.

## Existing RealityOS Capabilities Reused

- Identity Runtime
- Organization
- Authority
- Capability Registry
- AI Gateway
- Document/OCR
- Evidence Runtime
- Verification Runtime
- Recovery Runtime
- Audit/Governance
- Knowledge/Context
- Workflow/Orchestration
- File Center
- document generation
- Costing / quotation support where already present

## New Domain Capabilities Required

- Tender project and document model;
- valve requirement item extraction;
- tender quotation rule extraction;
- valve product library;
- deterministic product matching;
- technical compliance matrix;
- human review queue for missing/conflict/inferred facts;
- parametric sample drawing template metadata.

## First Implementation Slice

Recommended first slice:

```text
Valve Tender Structured Extraction
```

Input:

```text
one real tender document from the provided source package
```

Output:

- `TenderProject`
- `TenderDocument`
- `ValveRequirementItems`
- `TenderRules`
- `TechnicalRequirements`
- Evidence refs
- Conflicts

Included fields for success criteria:

- project;
- procurement list;
- valve category;
- DN;
- PN;
- quantity;
- material if present;
- connection;
- medium if present;
- temperature/pressure if present;
- applicable standard;
- quote rules;
- document requirements;
- source/provenance for every extracted field.

Excluded from the first slice:

- full quotation engine;
- product master population;
- compliance matrix generation beyond extracted requirements;
- sample drawing generation;
- DWG structured extraction;
- complete tender response generation;
- cloud deployment;
- W2.3 implementation;
- industrial control.

Expected implementation size:

```text
SMALL_TO_MEDIUM
```

Expected files:

- domain model / service for tender extraction;
- source document ingestion helpers;
- evidence/provenance mapping;
- targeted fixture/acceptance test using the real package;
- documentation update.

## Current Blockers

- DWG structured extraction is not verified.
- Legacy `.doc` files are readable through conversion, but production extraction
  needs a structured conversion path.
- The first implementation slice still requires approval before code/schema/API
  work starts.

## Non-goals

- No product code implementation in this entry review.
- No second Runtime.
- No fake tender sample.
- No fake valve product library.
- No cloud deployment.
- No push or deploy.
