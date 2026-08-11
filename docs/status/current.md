# Garak Current Status

- 기준일: 2026-08-22
- Branch: `main`
- Phase 0A/0B: **PASS / Complete**
- Phase 1A/1B/1C: **PASS / Complete (Windows x64)**
- Phase 2A: **PASS / Complete**
- Phase 2B.1: **Implemented — durable persistence core**
- Phase 2B.2: **Implemented — main-owned migration/conflict/recovery UX**
- Phase 2C: **Implemented — compiled product and plug-in state compatibility policy/tooling**
- Phase 2 overall: **Windows implementation complete; exact current-commit gates remain authoritative**

## Current product path

Studio creates, opens, validates, saves, and exports minimal directory `.garak` products as local white-label Windows x64 VST3 bundles. Editable schema v2 is current, schema v1 remains a strict supported legacy input, and Product ID, VST3 FUIDs, and Parameter IDs survive migration and export.

## Persistence and user decisions

Phase 2B uses deterministic full-package revisions, physical target identity, exclusive write locks, strict transaction manifests, persistent verified backups, and deterministic recovery. Legacy migration now requires a native Open Read-Only or Back Up & Upgrade decision. Save conflicts and ambiguous recovery states are explained without widening renderer filesystem or IPC authority.

## Artifact compatibility

Phase 2C distinguishes source, derived build output, and host-persisted state:

- exact valid `GARAKCPD` 1.0 loads;
- older compiled data is rebuilt from `.garak`;
- future or corrupt compiled data is rejected;
- exact valid same-product `GARAKPST` 1.0 restores;
- older state is rejected unless an explicit migration exists;
- future, foreign-product, or corrupt state is rejected without mutating prior valid state.

No compiled-data v2 or state v2 was invented. Gain ID `1001` and Bypass ID `1002` remain permanent contracts, and removed IDs must become tombstones rather than being reassigned.

## Source of truth

- [ADR 0008](../adr/0008-durable-project-persistence-and-recovery-policy.md)
- [ADR 0009](../adr/0009-main-owned-studio-project-evolution-ux.md)
- [ADR 0010](../adr/0010-compiled-product-and-state-compatibility.md)
- [Project Persistence Service](../architecture/project-persistence-service.md)
- [Compiled/state compatibility](../architecture/compiled-and-state-compatibility.md)
- [Phase 2B.2 validation](phase-2b2-studio-evolution-validation.md)
- [Phase 2C validation](phase-2c-compatibility-validation.md)

## Release gates still open

- exact current-commit Product Compiler, Studio, Native, and VST3 Validator regressions;
- backup retention/pruning and advanced manual recovery tooling;
- general DSP graph, macros, native product editor, presets/assets, and ANDONGMIN BLOOM;
- packaged Studio, installer, actual DAW matrix;
- macOS Universal VST3, AU, signing, and notarization;
- transitive legal/trademark/security review and repository license decision.

Windows results are not generalized to the open cross-platform gates. The next product capability milestone is a minimal static DSP graph and compiled execution plan, not another compatibility wrapper.
