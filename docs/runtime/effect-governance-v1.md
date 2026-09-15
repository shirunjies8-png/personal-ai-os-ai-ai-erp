# Effect Governance Contract v1

Status: CONTRACT VERIFIED / PRODUCTION EFFECT CLOSURE NOT VERIFIED / PUSH NO / DEPLOY NO

Effect Governance Contract v1 extends RealityOS Core v1. It does not create a new control plane, does not implement a full policy engine, and does not claim production-world effect governance is complete.

## Purpose

The contract separates capability access from authority to produce a side effect:

- resource access is not action authority;
- tool authorization is not effect authorization;
- alternate execution paths do not create new authority;
- unknown authority for high-risk effects must fail closed.

## Effect Contract

An effect request contains:

- `effectId`
- `resource`
- `verb`
- `target`
- `purpose`
- `effectClass`
- `canonicalEffect`
- `persistence`
- `reversibility`
- `externalMutation`
- `requiresAuthority`
- `metadata`

The first implementation lives in `realityos-core.js` and remains generic. It is not OCR-specific, ERP-specific, or browser-specific.

## Effect Classes

Minimum supported classes:

- `OBSERVATION`
- `LOCAL_TRANSFORM`
- `PERSISTENT_LOCAL_MUTATION`
- `PERSISTENT_EXTERNAL_MUTATION`
- `COMMUNICATION`
- `CODE_EXECUTION`
- `FINANCIAL_EFFECT`
- `PHYSICAL_EFFECT`
- `UNKNOWN`

The tool name is not the effect class. For example, `browser` can read, upload, send, create, or delete depending on resource, verb, target, and observed side effect.

## Authority Decision

The minimal decision contract evaluates:

- principal / represented principal when available;
- capability id via metadata when present;
- resource;
- verb;
- target;
- purpose;
- effect class;
- canonical effect;
- constraints / context.

Decision values:

- `ALLOW`
- `DENY`
- `REQUIRE_APPROVAL`
- `UNKNOWN`

High-risk effects with unknown authority do not become allowed. They return `REQUIRE_APPROVAL` and block automatic execution in the validation result.

## Canonical Effect and Alternate Paths

Different execution paths can map to the same canonical business effect.

Example:

- `erp.api.createPurchaseOrder`
- `browser.csvImport`

Both may map to:

- `CREATE_PURCHASE_ORDER`

If authority for `CREATE_PURCHASE_ORDER` is `DENY`, both paths are blocked. A fallback path does not grant new authority.

## Expected Effect ↔ Actual Effect

The contract adds expected/actual effect comparison alongside the existing expected/actual execution comparison.

Expected effect:

- resource
- verb
- target
- purpose
- effect class
- canonical effect

Actual effect:

- observed resource
- observed verb
- observed target
- observed effect class
- canonical effect
- evidence

Comparison status:

- `MATCH`
- `DIVERGED`
- `UNKNOWN`

## Divergence

Minimum divergence types:

- `CAPABILITY_SEMANTIC_DIVERGENCE`
- `EFFECT_AUTHORITY_DIVERGENCE`

Example:

- declared expected effect: browser `READ`, `OBSERVATION`
- observed effect: browser `POST`, `PERSISTENT_EXTERNAL_MUTATION`

This is a semantic divergence and an authority divergence.

## Fail-Closed

The contract preserves:

- `UNKNOWN ≠ FAILED ≠ COMPLETED`
- high-risk unknown authority does not become `ALLOW`
- persistent external mutation requires explicit authority or approval

## OCR Compatibility

Local OCR remains a `LOCAL_TRANSFORM` / document-analysis effect. It is not classified as a persistent external mutation when it stays `CONFIDENTIAL`, `LOCAL_ONLY`, external upload `0`, external AI `0`, and no fallback.

## Verification Level

Current level:

- `CONTRACT_ONLY`

Verified by:

- `scripts/effect-governance-test.mjs`
- `scripts/realityos-core-test.mjs`
- OCR regression tests

Not yet verified:

- a production external mutation reality closure demo;
- human approval workflow;
- emergency stop;
- resume authority;
- full RBAC or identity graph.

## Non-goals

This phase does not implement:

- full RBAC;
- identity graph;
- delegation chain;
- authority lease;
- resume re-authorization;
- human approval workflow;
- emergency stop;
- recovery execution;
- saga / compensation;
- physical actuator governance;
- financial transaction integration;
- model remote-code governance;
- MetaRSI;
- observability platform.
