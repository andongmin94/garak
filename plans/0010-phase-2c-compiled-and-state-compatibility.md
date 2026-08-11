# ExecPlan 0010 — Phase 2C compiled product and plug-in state compatibility

## Purpose

Turn the existing strict `GARAKCPD` v1 and `GARAKPST` v1 parsers into an explicit compatibility policy that distinguishes current, rebuildable, future, foreign, and corrupt artifacts without inventing a speculative v2 format.

## User value

Older compiled output can be rebuilt safely from the editable source, while irreplaceable DAW state is never silently reset or interpreted under the wrong product identity.

## Starting point

- Editable schema v1→v2 migration and durable Studio persistence are complete on Windows x64.
- `GARAKCPD` 1.0 is deterministic derived product data.
- `GARAKPST` 1.0 is an exact 96-byte Product-ID-bound state format.
- Gain ID `1001` and Bypass ID `1002` are stable host contracts.

## Scope

- Accepted compatibility ADR.
- TypeScript compatibility classifier and read-only CLI.
- Current/old/future/corrupt compiled fixtures.
- Current/old/future/foreign/corrupt state fixtures.
- C++ Runtime compatibility classifier using the existing strict parsers.
- Native and TypeScript tests.
- Parameter tombstone and identity lifecycle policy.

## Non-scope

No compiled-data v2, state v2, in-place artifact migration, automatic state reset, new DSP behavior, preset browser, graph, custom editor, macOS/AU, installer, signing, or new dependency.

## Design decisions

Compiled data is derived and older versions are rebuilt from `.garak`. State is host-persisted and rejected unless an explicit migration is implemented. Future versions are always rejected without overwrite. State is restored only after exact validation and Product ID parity.

## Files

- `tools/product-compiler/src/compatibility.ts`
- `tools/product-compiler/src/compatibility_cli.ts`
- `tools/product-compiler/tests/compatibility.test.ts`
- `native/runtime/product_v1/include/garak/runtime/product_v1/compatibility.hpp`
- `native/runtime/product_v1/src/compatibility.cpp`
- `native/tests/product_compatibility_tests.cpp`
- CMake and documentation updates

## Validation

- Product Compiler format/lint/typecheck/test.
- CLI human and JSON inspection.
- Product Runtime Debug/Release CTest including compatibility tests.
- Werror, clang-format, and clang-tidy.
- Existing `GARAKCPD`/`GARAKPST` fixtures remain byte-identical.
- Studio and export regressions remain unchanged.

## Completion record

Implementation is committed directly to `main`. Exact CI results and any unexecuted gates are recorded in `docs/status/phase-2c-compatibility-validation.md`.
