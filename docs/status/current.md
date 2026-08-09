# Garak Current Status

- 기준일: 2026-08-22
- Branch: `main`
- Phase 0A/0B: **PASS / Complete**
- Phase 1A/1B/1C: **PASS / Complete (Windows x64)**
- Phase 2A: **PASS / Complete**
- Phase 2B.1: **Implementation committed; CI is the authoritative completion gate**
- Phase 2B.2: **Pending — Studio Migration, Conflict and Recovery UX**
- Phase 2C: **Pending — Compiled Product and Plug-in State Compatibility Policy**

## Current product path

Studio creates, opens, validates, saves, and exports minimal directory `.garak` products as local white-label Windows x64 VST3 bundles. Editable schema v2 is current, schema v1 remains a strict supported legacy input, and v1/v2 compile and export semantics preserve Product ID, VST3 FUIDs, and Parameter IDs.

## Phase 2B.1

The main-owned callable API now wraps the existing canonical project writer with:

- deterministic full-package tree revisions;
- resolved physical target identity;
- cross-process exclusive persistence locks;
- strict versioned transaction manifests;
- persistent verified backups;
- deterministic recovery of aborted, rolled-back, or already-published saves;
- explicit identity-preserving v1→v2 in-place migration.

The renderer still has no Node.js, filesystem, shell, process, or raw IPC access. Existing fixed preload methods and opaque document capabilities remain the Studio boundary.

Phase 2B.1 does not implement migration/conflict/recovery dialogs, autosave UX, backup pruning, or packaged distribution. Those remain Phase 2B.2 work.

## Source of truth

- [ADR 0008](../adr/0008-durable-project-persistence-and-recovery-policy.md)
- [Project Persistence Service](../architecture/project-persistence-service.md)
- [Persistence Transaction v1](../architecture/project-save-transaction-v1.md)
- [Backup and Recovery](../architecture/project-backup-and-recovery.md)
- [Phase 2B.1 validation](phase-2b1-persistence-validation.md)
- [ExecPlan 0008](../../plans/0008-phase-2b1-durable-project-persistence-core.md)

## Release gates still open

- Phase 2B.2 user-facing migration, conflict, recovery, and backup UX
- Phase 2C compiled product and plug-in/preset/DAW state compatibility
- general DSP graph, macros, native product editor, and ANDONGMIN BLOOM
- packaged Studio, installer, actual DAW matrix
- macOS Universal VST3, AU, signing, and notarization
- transitive legal/trademark/security review and repository license decision

Windows results are not generalized to the open cross-platform gates.
