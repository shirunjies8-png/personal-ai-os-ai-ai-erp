# RealityOS Render Production Runtime Contract

Status: `IMPLEMENTED_CANDIDATE`
Public Reality Ready: `NO`

This document defines the production runtime prerequisites for the existing RealityOS backend and the Valve reference workbench. It is a deployment contract, not evidence that Render has been deployed or that public acceptance has passed.

## Storage layout

The production runtime requires one approved persistent root. All durable SQLite state and the private Valve reference source must remain inside that root.

| Purpose | Environment variable | Required property |
|---|---|---|
| Persistent storage root | `PERSISTENT_DATA_ROOT` | Absolute, mounted, writable persistent filesystem |
| Existing business and RealityOS SQLite | `DB_PATH` | Absolute path inside `PERSISTENT_DATA_ROOT` |
| Valve private root | `VALVE_REFERENCE_PRIVATE_ROOT` | Absolute directory inside `PERSISTENT_DATA_ROOT` |
| Approved Valve DOCX | `VALVE_REFERENCE_DOCX_PATH` | File inside `VALVE_REFERENCE_PRIVATE_ROOT` |
| Approved source identity | `VALVE_REFERENCE_DOCX_SHA256` | Exact 64-character SHA-256 supplied server-side |
| Enterprise binding | `VALVE_REFERENCE_ENTERPRISE_ID` | Server-side enterprise identifier |

The runtime must not fall back to the repository, current working directory, a temporary directory, or a container-ephemeral path in production. No separate Valve database is introduced; canonical business and RealityOS durable records continue to use the existing SQLite source of truth.

## Security prerequisites

Production startup is fail-closed. It requires:

- a strong, explicit `JWT_SECRET`;
- an explicit first-bootstrap administrator email and strong password;
- an explicit non-demo enterprise name;
- an exact, non-wildcard `CORS_ALLOWED_ORIGINS` value;
- an absolute persistent `DB_PATH` whose parent is writable.

Existing production administrator credentials are not reset during later startup. Secrets, passwords, full enterprise identifiers, private filesystem paths, and raw source files must never be returned to the browser or recorded in public evidence.

## Private source provisioning

Provisioning mode is `CONTROLLED_OPERATOR_TRANSFER`.

1. An authorized operator transfers the approved DOCX to the mounted private persistent directory.
2. The operator configures the private root, source path, expected SHA-256, and enterprise binding as server-side environment variables.
3. Startup/readiness verifies approved-root containment, file existence, readability, and exact source identity.
4. The authenticated request enterprise must match the configured enterprise binding.

There is no anonymous or public source upload API in this slice. The source file is not copied into Git, `public/`, or `dist/`.

## Public frontend binding

The public-real frontend uses `window.PERSONAL_AI_OS_API_BASE_URL` as its single API base source of truth. A public-real GitHub Pages build must also explicitly set `window.PERSONAL_AI_OS_PUBLIC_REAL_MODE = true` before `config.js` loads.

In public-real mode:

- the API base must use HTTPS;
- localhost and loopback HTTP URLs are rejected;
- a missing or rejected backend URL produces `BACKEND_NOT_CONFIGURED`;
- static-demo fallback is disabled.

Local development continues to support same-origin localhost HTTP.

## Health and readiness

`GET /api/health` distinguishes process liveness from configuration and capability readiness. The response exposes only safe state labels. It must not include the source path, expected hash, enterprise identifier, JWT secret, or administrator credential.

Valve remains `NOT_READY` until all private-source conditions are satisfied. This contract does not claim durable Valve Run, Attempt, Transition, Evidence, or Verification integration; `VALVE_GOVERNED_RUNTIME` remains `BLOCKED / INTEGRATING`.

## Deployment order

1. Create and mount the persistent disk.
2. Configure the production security, persistent storage, CORS, and Valve server-side variables.
3. Transfer the approved DOCX through the controlled operator channel.
4. Start the backend and inspect `/api/health` readiness without exposing confidential configuration.
5. Bind the public frontend to the approved HTTPS backend.
6. Perform authenticated enterprise-scoped readback.
7. Restart/redeploy the backend and repeat persistence readback.
8. Perform external-device acceptance only after the previous gates pass.

## Required restart proof

`RESTART_PERSISTENCE_PROOF_REQUIRED = YES`.

After a backend restart or redeploy, acceptance must prove independently that:

- the approved Valve source still exists and has the configured identity;
- the canonical SQLite database still contains its prior durable state;
- authenticated enterprise binding still rejects other enterprises;
- no static-demo or mock fallback replaced the real backend path.

Until this proof and external-device validation exist, `PUBLIC_REALITY_READY = NO`.
