# ExecPlan 0009 — Phase 2B.2 Studio Migration, Conflict, and Recovery UX

## Purpose

Expose the proven Phase 2B.1 persistence decisions to users without widening renderer authority or duplicating the persistence engine.

## User value

A legacy project can be opened read-only or upgraded only after explicit approval. External edits and ambiguous recovery states are explained before Garak refuses a destructive action. Verified backups remain main-owned and are shown only as informational results.

## Scope

- native confirmation before v1→v2 in-place migration;
- verified backup completion notice;
- native conflict notice for stale, future-schema, identity, and lock failures;
- native recovery-review notice for ambiguous persistence states;
- existing generic renderer diagnostic remains the durable fallback;
- ProductService regression tests.

## Non-scope

No renderer filesystem access, raw IPC, generic recovery browser, manual artifact arbitration, backup deletion/pruning, autosave prompt, new dependency, DSP graph, custom editor, macOS/AU, signing, or installer.

## Design

`ProductService` keeps its opaque document sessions. Opening a supported legacy project prompts through the Electron main-process dialog port. Approval calls the existing durable migration service and requires a verified backup summary before the session is installed. Decline leaves the project open read-only. Save conflicts and ambiguous recovery errors are surfaced through bounded native dialogs, while the original structured diagnostic is returned unchanged.

The renderer API does not gain path-bearing methods or new IPC channels. This is intentionally smaller than the abandoned self-generating component workflow.

## Validation

- Studio format, lint, typecheck, tests, and production build;
- Product Compiler regression;
- migration approval/decline tests;
- backup notice test;
- conflict notice test;
- recovery notice and no-session test;
- dependency counts unchanged.

## Completion record

Implementation is committed directly to `main`. The obsolete self-modifying Phase 2B.2 workflows are removed. Full Windows gate results are recorded in `docs/status/phase-2b2-studio-evolution-validation.md`.
