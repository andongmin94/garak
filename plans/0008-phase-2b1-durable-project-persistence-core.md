# ExecPlan 0008 — Phase 2B.1 Durable Project Persistence Core

## Purpose

Preserve a valid artist project across stale saves, publication failures, and recoverable process interruption while retaining the Phase 1C/2A project and export contracts.

## User value

A Studio save must not silently overwrite external work or strand the only valid project when the process terminates between source retirement and candidate publication.

## Starting state

- `main` started at Phase 2A commit `fc2f23a36205a7bf488a0c65a34dd6391a480550`.
- Current project schema is v2; v1 is supported legacy input.
- Product Compiler baseline is 76 tests and Studio baseline is 12 tests.
- Existing writer already validates a stage, moves the source to a temporary backup, publishes, and rolls back on ordinary errors.

## Scope

- deterministic package tree revision;
- physical target identity and exclusive write lock;
- strict transaction manifest;
- persistent verified backup;
- recovery before open/save;
- explicit in-place v1→v2 migration service;
- Studio default API switched to durable wrappers;
- fault, conflict, and recovery tests.

## Non-scope

No renderer migration dialog, conflict dialog, backup browser, autosave UX, single-file container, compiled/state v2, DSP graph, custom editor, macOS/AU, installer, signing, or new dependency.

## Design decisions

The existing `project_document.ts` writer remains unchanged and authoritative. `project_persistence.ts` wraps it. This avoids a parallel serializer and preserves earlier atomicity and regression tests.

Revision becomes a tree fingerprint in the durable API. The inner writer still receives its existing source-byte revision privately.

Persistent backups are retained without pruning. Ambiguous recovery fails closed.

## Implementation steps

1. Add persistence module and strict operational formats.
2. Alias canonical callable API create/open/save operations to durable wrappers.
3. Add tree, backup, conflict, lock, failure, recovery, and migration tests.
4. Keep Studio renderer/preload contracts unchanged.
5. Run TypeScript, Studio, and native regression gates in CI.
6. Update decision and architecture documents.

## Acceptance

- external future schema and Product ID replacement never publish;
- a retired source is restored from a verified backup;
- a published candidate is recognized and completed;
- a second writer is rejected;
- legacy in-place migration retains the exact v1 backup and identity;
- Product Compiler and Studio quality gates pass without dependency changes.

## Risks

- Backup growth is unbounded until a retention policy exists.
- A crash between lock creation and the first manifest remains an ambiguous, fail-closed condition.
- Full hardware power-loss durability is outside this phase.

## Completion record

Implementation is committed only after repository CI passes. Phase 2B.2 remains the next milestone.
