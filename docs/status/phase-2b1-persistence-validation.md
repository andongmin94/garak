# Phase 2B.1 Persistence Validation

## Scope

This status records the durable persistence implementation on Windows x64. The source code adds package-tree revisions, physical target locks, persistent backups, strict transaction manifests, recovery, and explicit in-place migration.

## Direct tests

The Product Compiler test suite includes dedicated coverage for:

- path-independent tree fingerprints;
- persistent exact backups;
- future-schema and Product-ID replacement rejection;
- source-retired rollback;
- candidate-published completion;
- exclusive writer locking;
- identity-preserving in-place migration;
- orphan-lock fail-closed behavior.

## Regression gates

The GitHub Actions workflow runs frozen dependency installation, Product Compiler format/lint/typecheck/tests, Studio format/lint/typecheck/tests/build, and the existing Windows CMake Debug smoke tests.

Exact counts and the final commit status are recorded after the workflow completes. No result is treated as passing before the corresponding command exits successfully.

## Explicit limitations

- Phase 2B.2 user-facing migration/conflict/recovery presentation is not implemented.
- Persistent backup pruning is not implemented.
- Hardware power-loss guarantees, packaged Studio, actual DAWs, macOS/AU, signing, and notarization remain unverified.
