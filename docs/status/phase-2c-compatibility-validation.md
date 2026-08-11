# Phase 2C compatibility validation

## Result

Implementation committed to `main`; final PASS requires the exact TypeScript and Windows Native gates for the resulting commit.

## Implemented matrix

| Artifact | Fixture | Expected disposition |
| --- | --- | --- |
| `GARAKCPD` | exact 1.0 | load current |
| `GARAKCPD` | older major | rebuild from editable project |
| `GARAKCPD` | future major/minor | reject too new |
| `GARAKCPD` | corrupt current layout | reject invalid |
| `GARAKPST` | exact 1.0, same Product ID | restore current |
| `GARAKPST` | older major | reject unsupported old |
| `GARAKPST` | future major/minor | reject too new |
| `GARAKPST` | valid, different Product ID | reject foreign product |
| `GARAKPST` | corrupt current layout | reject invalid |

## Required gates

- `pnpm product:format:check`
- `pnpm product:lint`
- `pnpm product:typecheck`
- `pnpm product:test`
- `pnpm product:compatibility` against current compiled/state fixtures
- `cmake --preset product-runtime-debug`
- `cmake --build --preset product-runtime-debug-build`
- `ctest --preset product-runtime-debug-test --no-tests=error`
- corresponding Release, Werror, clang-format, and clang-tidy gates
- Studio and exported-product regressions

## Invariants

- `GARAKCPD` v1 and `GARAKPST` v1 bytes are unchanged.
- Product ID, processor/controller FUID, Gain ID `1001`, and Bypass ID `1002` are unchanged.
- No failed state decode mutates prior valid state.
- No future artifact is rewritten or interpreted as current.
- No dependency was added.

## Explicit non-scope

No v2 format, automatic state migration, silent state reset, graph, new DSP, custom editor, macOS/AU, installer, signing, or notarization.
