# RealityOS Module Registry

Status: W0 SOURCE OF TRUTH INDEX

Canonical machine-readable registry:

- `registry/realityos-module-registry.js`

Human-readable W0 baseline:

- `docs/architecture/realityos-w0-governance-baseline.md`

Validator:

- `scripts/realityos-w0-governance-test.mjs`

This document is an index, not a competing registry. The registry currently contains 21 modules:

1. Identity Runtime
2. Organization
3. Work Runtime
4. Authority
5. Enterprise Knowledge & Context
6. Agent & Skill Registry
7. Tool / Connector Runtime
8. Model / Intelligence Runtime
9. Workflow / Orchestration
10. Execution Runtime
11. Effect Runtime
12. Reality Runtime
13. Evidence Runtime
14. Verification Runtime
15. Recovery Runtime
16. Durable Runtime
17. Human Control
18. Audit / Governance
19. Experience / Learning
20. Self-Improvement Runtime
21. Domain Runtime

Governance rule:

```text
ONE CONCEPT
→
ONE SOURCE OF TRUTH
→
MANY CONSUMERS
```

Do not create new top-level runtimes for product capabilities such as GEO, Payment, WorkBuddy, OCR, Writing, Manufacturing, Robot or Physical AI. Map them to the existing module owner first.
