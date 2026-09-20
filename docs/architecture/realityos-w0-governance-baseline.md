# RealityOS W0 Architecture Governance Baseline

Status: W0 ARCHITECTURE GOVERNANCE BASELINE / FRAMEWORK_FIRST / COMMIT NO / PUSH NO / DEPLOY NO

This document is the human-readable W0 architecture governance baseline. The machine-readable registry lives in `registry/realityos-module-registry.js` and is validated by `scripts/realityos-w0-governance-test.mjs`.

W0 is not product capability validation. OCR, Effect Reality Closure Demo, RFQ, quotation, manufacturing, AI Gateway, WorkBuddy, GEO, Agent Economy, Robot and Physical AI work are deferred to the Product Validation Backlog unless explicitly pulled into a later framework wave.

## Framework Priority

`FRAMEWORK_FIRST = TRUE`

Development order is frozen as:

```text
W0 Architecture Governance
↓
W1 Kernel Completion
↓
W2 Platform Completion
↓
W3 Evolution + Domain
↓
Framework Freeze
↓
Product Capability Validation Program
```

Product validation is deferred, not deleted, abandoned or failed.

## Architecture Governance Rules

- `ONE CONCEPT → ONE SOURCE OF TRUTH`
- `MODULE ≠ MICROSERVICE`
- `ARCHITECTURE EXISTS ≠ PRODUCT CAPABILITY EXISTS`
- `CODE EXISTS ≠ REALITY VERIFIED`
- `TARGET ≠ CURRENT`
- `MOCK ≠ PRODUCT`
- `FRAMEWORK FIRST ≠ EMPTY FILE FIRST`
- `DOMAIN EXTENDS CORE`
- `PRODUCT VALIDATION DOES NOT REDEFINE CORE`
- `DECISION ≠ AUTHORITY`
- `AUTHORITY ≠ EXECUTION`
- `EXECUTION SUCCESS ≠ BUSINESS SUCCESS`
- `OBSERVABILITY ≠ ASSURANCE`

## Four Waves

### W0 Architecture Governance

Owns:

- Module Registry
- Canonical Vocabulary
- Source-of-Truth Map
- Dependency Graph
- Current Status Matrix
- Current Minimum Closed Loop
- Product Validation Backlog

### W1 Kernel

Owns the first universal runtime loop:

- Work
- Identity
- Authority
- Agent / Executor
- Tool / Capability
- Execution
- Effect
- Reality
- Evidence
- Verification
- Recovery

Completion standard: a minimal E2E runtime can truly run from start to finish. Mock tool, mock ERP, mock reality and mock verifier are allowed if explicitly marked, but documentation alone is not enough.

### W2 Platform

Owns:

- Organization
- Enterprise Knowledge & Context
- Model / Intelligence Runtime
- Workflow / Orchestration
- Durable Runtime
- Human Control
- Audit / Governance

W2 must build on W1 Kernel and must not create parallel runtimes.

### W3 Evolution + Domain

Owns:

- Experience / Learning
- Self-Improvement
- Enterprise
- Manufacturing
- Science
- Energy
- Robotics
- Physical AI
- GEO
- Writing
- WorkBuddy
- Agent Economy
- Domain Packs

## Canonical 21 Module Registry

The canonical module list is:

| # | Module | Wave | Current status | Owner summary |
|---|---|---|---|---|
| 01 | Identity Runtime | W1 | PARTIAL | Identity, principal and represented principal |
| 02 | Organization | W2 | PARTIAL | Organization, team, role, responsibility and accountability |
| 03 | Work Runtime | W1 | SKELETON | Mission, goal, work, task, dependency, outcome and acceptance |
| 04 | Authority | W1 | PARTIAL | Permission, delegation and authority lease |
| 05 | Enterprise Knowledge & Context | W2 | PLANNED | Knowledge object, entity, relation, ontology, context package |
| 06 | Agent & Skill Registry | W1 | SKELETON | Agent and skill definition |
| 07 | Tool / Connector Runtime | W1 | PARTIAL | Tool, connector and capability adapter |
| 08 | Model / Intelligence Runtime | W2 | PARTIAL | Model, provider and decision recommendation |
| 09 | Workflow / Orchestration | W2 | SKELETON | Workflow definition, generated plan and execution plan |
| 10 | Execution Runtime | W1 | PARTIAL | Run, attempt, step, command and execution state |
| 11 | Effect Runtime | W1 | VERIFIED | Canonical effect, expected effect, actual effect and effect class |
| 12 | Reality Runtime | W1 | PARTIAL | Reality state, observation and authoritative readback |
| 13 | Evidence Runtime | W1 | PARTIAL | Evidence, provenance and lineage |
| 14 | Verification Runtime | W1 | PARTIAL | Verification result and reality verification |
| 15 | Recovery Runtime | W1 | PARTIAL | Recovery policy, retry, compensation and rollback |
| 16 | Durable Runtime | W2 | SKELETON | Checkpoint, resume and durable execution position |
| 17 | Human Control | W2 | PLANNED | Observe, pause, cancel, takeover and recover requests |
| 18 | Audit / Governance | W2 | PARTIAL | Audit record, governance record and policy history |
| 19 | Experience / Learning | W3 | PLANNED | Experience candidate, promotion and organizational memory |
| 20 | Self-Improvement Runtime | W3 | PLANNED | Improvement proposal, write surface, regression, promotion and release |
| 21 | Domain Runtime | W3 | PARTIAL | Domain ontologies, tools, verifiers and packs |

The module registry is not a list of 21 parallel implementation projects.

## Canonical Vocabulary

| Concept group | Canonical terms | Owner |
|---|---|---|
| Identity | Identity, Principal, Represented Principal | 01 Identity Runtime |
| Organization | Organization, Team, Role, Responsibility, Accountability | 02 Organization |
| Work | Mission, Goal, Work, Task, Subtask, Dependency, Outcome, Acceptance | 03 Work Runtime |
| Authority | Permission, Delegation, Authority Lease | 04 Authority |
| Agent | Agent, Skill | 06 Agent & Skill Registry |
| Tool | Tool, Connector, Capability, Capability Adapter | 07 Tool / Connector Runtime |
| Decision | FAST_DECISION, DEEP_REASONING, DETERMINISTIC_RULE, HUMAN_REVIEW | 08 Model / Intelligence Runtime |
| Workflow | Workflow Definition, ExecutionPlan, Generated Workflow | 09 Workflow / Orchestration |
| Execution | Run, Attempt, Step, Command, Execution State | 10 Execution Runtime |
| Effect | Canonical Effect, Expected Effect, Actual Effect, Effect Class | 11 Effect Runtime |
| Reality | Reality State, Observation, Authoritative Readback | 12 Reality Runtime |
| Evidence | Evidence, Provenance, Lineage, Transformation Provenance | 13 Evidence Runtime |
| Verification | Independent Verification, Acceptance Verification, Reality Verification | 14 Verification Runtime |
| Recovery | Checkpoint, Resume, Retry, Compensation, Rollback, Recovery | 15 Recovery Runtime / 16 Durable Runtime |
| Knowledge | Context Package, Knowledge Object, Entity, Relation, Ontology, Version, Temporal Validity, Conflict | 05 Enterprise Knowledge & Context |
| Experience | Experience Candidate, Experience Promotion, Organizational Memory | 19 Experience / Learning |
| Improvement | Improvement Proposal, Write Surface, Regression, Promotion, Release | 20 Self-Improvement Runtime |

Existing code may use aliases. W0 freezes ownership; it does not rename all historical code.

## Source-of-Truth Map

`ONE CONCEPT → ONE SOURCE OF TRUTH → MANY CONSUMERS`

- Identity → Identity Runtime
- Organization → Organization
- Mission / Goal / Work / Task / Outcome → Work Runtime
- Authority / Permission / Delegation / Lease → Authority
- Agent / Skill Definition → Agent & Skill Registry
- Tool / Connector / Capability Adapter → Tool / Connector Runtime
- Model / Provider / Decision Provider → Model / Intelligence Runtime
- Workflow Definition / Plan → Workflow / Orchestration
- Run / Step / Command / Execution State → Execution Runtime
- Canonical Effect / Expected Effect / Actual Effect → Effect Runtime
- Reality State / Observation / Authoritative Readback → Reality Runtime
- Evidence / Provenance / Lineage → Evidence Runtime
- Verification Result → Verification Runtime
- Recovery Policy → Recovery Runtime
- Checkpoint / Persistent Job Position → Durable Runtime
- Human Observe / Pause / Cancel / Takeover → Human Control
- Audit Record → Audit / Governance
- Experience Candidate → Experience / Learning
- Runtime Improvement → Self-Improvement Runtime
- Domain-specific ontology/tools/verifiers → Domain Runtime

## Provenance Owner

Evidence Runtime is the canonical owner of Provenance and Lineage.

Other modules may produce local provenance fragments:

- Knowledge produces knowledge evidence/provenance.
- Model produces provider/model provenance.
- Execution produces execution/runtime provenance.
- Tool produces connector/tool provenance.
- Workflow produces planning/orchestration provenance.

All canonical provenance and lineage flows into Evidence Runtime. Modules must not invent competing provenance models.

## Authority / Human Control / Execution / Audit Separation

- Authority decides whether a subject may perform an action.
- Human Control owns observe, pause, cancel, takeover and recover requests.
- Execution Runtime executes control commands.
- Reality Runtime confirms whether reality actually stopped or changed.
- Evidence Runtime retains proof.
- Audit / Governance records who requested, who approved and what the system did.

Human Control does not own permissions. Audit does not authorize. Authority does not execute actions.

## Recent Concept Mapping

| Concept | Owner | Frozen rule |
|---|---|---|
| Jev / System One | 08 Model / Intelligence Runtime | Decision recommendation is not action authority; model confidence is not permission |
| GEO | 21 Domain Runtime → Enterprise → Generative Discovery Capability | GEO is not a new top-level runtime |
| Agent Economy / Payment | 11 Effect Runtime as `FINANCIAL_EFFECT` | Payment success is not business outcome success |
| WorkBuddy | 21 Domain Runtime as product entry / enterprise domain surface | WorkBuddy is not a new core runtime |
| Harness | 09 Workflow / 06 Agent mechanisms depending on usage | Harness is not a RealityOS top-level module |
| Enterprise Knowledge | 05 Enterprise Knowledge & Context | Not just RAG |
| Generated Workflow | 09 Workflow / Orchestration | AI-generated plan is not authorized plan |
| Experience | 19 Experience / Learning | Execution history is not learned experience |
| Self-Improvement / RSIAgent | 20 Self-Improvement Runtime | Self-improvement is not self-authorization, self-certification or self-release |

## Dependency Graph

Dependency types:

- HARD
- SOFT
- EXTENSION

W1 target chain:

```text
Mission / Work
↓
Identity
↓
Represented Principal
↓
Authority
↓
Agent / Executor
↓
Capability / Tool
↓
Execution
↓
Effect
↓
Reality Readback
↓
Evidence
↓
Verification
↓
Outcome
↓
Recovery
```

Ownership must not cycle. If future work discovers a dependency conflict, record `ARCHITECTURE_DEPENDENCY_CONFLICT`; do not duplicate the model to avoid the conflict.

## Current Status Model

Allowed status enum:

- PLANNED
- SKELETON
- PARTIAL
- RUNNABLE
- INTEGRATED
- VERIFIED
- PRODUCTION_READY

Forbidden implementation status labels:

- DONE
- COMPLETE
- FINISHED

Design status, implementation status, integration status and verification status may differ.

## Existing RealityOS Core Mapping

`realityos-core.js` remains the verified baseline. No `realityos-core-v2.js` exists or is introduced by W0.

| Existing core capability | Module owner |
|---|---|
| Capability Registry | 07 Tool / Connector Runtime |
| Dependency Contract | 07 Tool / Connector Runtime / 10 Execution Runtime |
| Readiness | 07 Tool / Connector Runtime |
| Preflight | 10 Execution Runtime |
| Provider Router | 07 Tool / Connector Runtime / 08 Model Runtime depending on provider |
| Data Policy | 18 Audit / Governance with consumers in Tool/Model |
| Execution Provenance | 10 Execution Runtime producing evidence fragment |
| Capability Health | 07 Tool / Connector Runtime |
| Expected / Actual Execution | 10 Execution Runtime and 14 Verification Runtime |
| Effect Governance Contract | 11 Effect Runtime with Authority dependency |

## Current Minimum Closed Loop

`CURRENT_MINIMUM_CLOSED_LOOP = DEFINED`

Today the code can prove pieces of the loop, but not yet one universal W1 kernel loop:

```text
Capability
↓
Preflight
↓
Effect Authority
↓
Execution (path-specific)
↓
Evidence (path-specific)
↓
Verification (path-specific)
```

Levels:

- Capability / Preflight / Effect Authority: VERIFIED_CONTRACT
- Execution / Evidence / Verification: PARTIAL and path-specific

Gap:

- No single universal W1 kernel loop yet runs end-to-end across all modules.

## Target W1 Kernel Loop

`TARGET_W1_KERNEL_LOOP = DEFINED`

```text
Mission
↓
Goal / Task
↓
Identity
↓
Represented Principal
↓
Authority / Lease
↓
Agent / Executor
↓
Capability / Tool
↓
Preflight
↓
Execution
↓
Effect
↓
Reality Readback
↓
Evidence
↓
Verification
↓
Outcome
↓
Recovery if needed
```

Target is not current.

## Reality / Verification Levels

Reality levels:

- Digital Reality
- Institutional Reality
- Physical Reality
- Scientific Reality

Scientific verification levels:

- COMPUTATIONALLY_VALID
- SIMULATION_CONSISTENT
- DATA_CONSISTENT
- EXPERIMENTALLY_OBSERVED
- INDEPENDENTLY_REPRODUCED

Frozen distinctions:

- `SIMULATION ≠ OBSERVATION`
- `PREDICTION ≠ DISCOVERY`
- `MATCHED PATTERN ≠ SCIENTIFIC TRUTH`

## Product Validation Backlog

All product capabilities are deferred for product validation after framework governance:

- OCR
- PDF
- Word
- Excel
- PPT
- Email
- Translation
- Writing
- Knowledge Product
- Contract
- Tender
- Quote
- Procurement
- Sales
- Production
- Shipping
- Warehouse
- Quality
- ERP
- MES
- Equipment
- Data Analysis
- GEO
- WorkBuddy
- Agent Economy
- Robot
- Physical AI
- Effect Reality Closure Demo

Existing verified baselines remain valid. Deferral does not mean removal, abandonment or failure.

## Internal / External Architecture Mapping

Internal map: 21 Module Engineering Map.

External explanatory map:

- L9 Collective Intelligence
- L8 Normative Reality
- L7 Possible Reality
- L6 Causal Reality
- L5 Epistemic Reality
- L4 Semantic Reality
- L3 Social Reality
- L2 Institutional Reality
- L1 Digital Reality
- L0 Physical Reality

W0 does not rebuild website, marketing or presentation pages.

## W0 Validation

W0 validation checks:

- moduleId unique
- canonicalName unique
- owner unique
- source-of-truth unique
- dependency target exists
- status enum valid
- wave enum valid
- no duplicate concept owner
- no dangling module reference
- no W3 domain copying core responsibility

Validator:

```text
node scripts/realityos-w0-governance-test.mjs
```

## Non-goals

W0 does not:

- validate OCR again;
- continue Effect Reality Closure Demo;
- implement W1 Kernel;
- create a new control plane;
- create a second RealityOS core;
- create GEO Runtime;
- create Payment OS;
- create Knowledge Platform v2;
- start Resume Authority;
- start Human Control;
- start Emergency Stop;
- start Self-Improvement runtime;
- push;
- deploy.
