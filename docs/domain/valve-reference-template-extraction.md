# Valve Reference Tender Template Foundation

Status: FOUNDATION IMPLEMENTED CANDIDATE / FINAL REVIEW REQUIRED

This slice establishes a safe reference-template foundation from the audited
source package identity and previously audited metadata. It does not implement
real DOCX structured extraction, legacy DOC structured extraction, a current
client tender project, quotation, product matching, drawing generation, cloud
deployment, or final bid generation.

## Hard Invariant

```text
REFERENCE_DATA_CANNOT_BECOME_PROJECT_TRUTH
```

Reference tender data may guide structure, field definitions, response layout,
table shapes, and writing organization. It may not satisfy current project
truth.

## Domain Separation

| Layer | Source | Truth scope |
| --- | --- | --- |
| Reference Layer | historical / reference tender package | `REFERENCE_ONLY` |
| Project Layer | future current client tender data | `DOCUMENTED / VERIFIED / CONFLICT / MISSING` |

The slice introduces model helpers for:

- `ReferenceTenderPackage`
- `ReferenceTenderDocument`
- `ReferenceTenderTemplate`
- `TemplateSection`
- `TemplateTable`
- `TemplateField`
- `ReferenceValue`

Implementation candidate:

- `services/valveReferenceTenderTemplateService.js`

Validation:

- `scripts/valve-reference-template-test.mjs`

## Confidentiality Model

Default:

```text
CONFIDENTIAL_BY_DEFAULT
LOCAL_FIRST
NO_RAW_SOURCE_TO_EXTERNAL_MODEL_BY_DEFAULT
NO_CONFIDENTIAL_SOURCE_IN_GIT
NO_SECRET_IN_LOGS
```

The service models reference package/document/template confidentiality as
`CONFIDENTIAL`. Real source ZIP/DOC/DOCX/DWG files remain ignored under:

```text
docs/source/valve/*.zip
docs/source/valve/extracted/
docs/source/valve/private/
docs/source/valve/tmp/
```

## Safe Reuse

Allowed as template structure:

- chapter order;
- table column definitions;
- field labels and datatypes;
- response organization;
- quotation table structure;
- certificate/document requirement structure;
- drawing information section structure.

Not allowed as project truth:

- purchaser;
- client;
- project name / number;
- control price;
- final quote;
- unit price;
- quantity;
- delivery date;
- tax rate where project-specific;
- customer contact;
- address;
- DN / PN;
- material;
- actuator;
- actual dimensions;
- drawing values.

These are marked with `NEVER_INHERIT` or a project-source/human-approval policy.

## Reference Residual Scanner

The service includes a `scanReferenceResidual` helper. It detects old reference
values in generated output and returns:

```text
REFERENCE_DATA_LEAK_DETECTED
```

Findings expose value hashes, not raw confidential values.

## Generation Safety Gate

Before future Word/PDF export, generated content must pass:

1. required project fields complete;
2. no unresolved critical conflicts;
3. no reference-only values used as project truth;
4. no old reference value residue;
5. pricing approved;
6. human final approval.

The current slice provides the validation contract. It does not generate final
bid documents.

## Secure Parser Boundary

The helper contract covers:

- zip-slip prevention;
- system file ignore;
- file count limit;
- file size limit;
- unexpected extension rejection;
- parser timeout policy;
- macro execution forbidden;
- temporary directory cleanup.

It does not execute Office macros and does not call external AI providers.

## AI / Provider Boundary

```text
QWEN_STATUS = PROVIDER_CANDIDATE / NOT_HARD_DEPENDENCY
WORKBUDDY_STATUS = OPTIONAL / RESERVED
EXTERNAL_AI_EGRESS = BLOCKED_BY_DEFAULT
AI_GATEWAY_REQUIRED = TRUE
MINIMUM_NECESSARY_DISCLOSURE = TRUE
```

Future model calls must go through the AI Gateway with classification,
authorization, redaction/minimum disclosure, provider policy, and audit records.

## Enterprise Isolation and Audit

The model preserves `enterprise_id` fields on package, document, and template
objects. This prepares for enterprise isolation but does not complete W2.3.

Audit metadata records action/source/field references without logging raw source
content. It is an audit metadata contract only; no audit event persistence is
implemented in this slice.

## Current Extraction Boundary

```text
REAL_DOCX_STRUCTURED_EXTRACTION = NOT_IMPLEMENTED
LEGACY_DOC_STRUCTURED_EXTRACTION = NOT_IMPLEMENTED
DWG_STRUCTURED_EXTRACTION = NOT_VERIFIED
PARSER_TIMEOUT = DEFINED_NOT_RUNTIME_VERIFIED
REDACTION_BOUNDARY = DEFINED / FUTURE_AI_GATEWAY_ENFORCEMENT
```

The future provenance model can carry `source_document`, `source_hash`,
`section`, `table`, `row`, `cell`, `paragraph`, and `extraction_method`. This
foundation does not invent locators before a real parser produces them.

## UI Status

```text
UI_STATUS = DEFERRED
```

No product UI is added in this slice.

## Cloud Status

```text
PUBLIC_DEPLOYMENT_HARDENING = PAUSED / PRESERVED
VALVE_PRODUCTION_CLOUD = NOT_STARTED
```

## Non-goals

- no current `ClientTenderProject`;
- no quotation engine;
- no final quote;
- no product matching;
- no compliance matrix generation;
- no Word/PDF export;
- no CAD/DWG editing;
- no raw source in Git;
- no push or deploy.
