# ADR 0010 — Compiled product and plug-in state compatibility policy

- Status: Accepted
- Date: 2026-08-22
- Scope: `GARAKCPD` v1 and `GARAKPST` v1

## Context

Garak has two different persistent artifact classes:

1. `product.garakbin` is a deterministic derived artifact compiled from the editable `.garak` source.
2. Plug-in state is saved by a host and may be the only copy of a user's automated session state.

Treating both as interchangeable migration inputs would either preserve obsolete build output unnecessarily or risk silently discarding DAW state.

## Decision

### Compiled product data

- Exact supported version and valid structure: load.
- Older version: discard and rebuild deterministically from the editable `.garak` project.
- Newer major or minor version: reject and do not reinterpret or overwrite.
- Corrupt current-version data: reject and diagnose; do not fall back to defaults.

Compiled data is never migrated in place. The editable project remains the source of truth.

### Plug-in state

- Exact supported version, valid structure, and matching Product ID: restore.
- Older version: reject until an explicit, released migration exists.
- Newer major or minor version: reject and preserve for a compatible newer plug-in.
- Different Product ID: reject as foreign state.
- Corrupt state: reject without mutating the previously valid processor/controller state.
- No silent reset-to-default path may report success.

### Identity lifecycle

- Product ID and processor/controller FUID remain stable across product updates.
- Parameter IDs are persistent host contracts.
- Removed Parameter IDs become permanent tombstones and are never reassigned.
- A format version change alone never authorizes an identity change.

## Current implementation

Phase 2C adds matching TypeScript inspection and C++ Runtime classification for current, old, future, foreign, and corrupt fixtures. It does not invent `GARAKCPD` v2, `GARAKPST` v2, or a speculative migration.

## Consequences

The policy deliberately prefers explicit rejection over data loss. A future state migration must be designed against a real released source and target format, with fixture-level proof that identity and parameter meaning are preserved.
