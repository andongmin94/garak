# Compiled Product and Plug-in State Compatibility

## Artifact classes

| Artifact | Authority | Current format | Old-version action | Future-version action |
| --- | --- | --- | --- | --- |
| Editable `.garak` project | User source of truth | schema 2 | sequential source migration | fail closed |
| Compiled product data | Derived build output | `GARAKCPD` 1.0 | rebuild from source | reject, preserve bytes |
| Plug-in/DAW state | Host-persisted user state | `GARAKPST` 1.0 | reject unless an explicit migration exists | reject, preserve bytes |

## Classification API

Both TypeScript tooling and the C++ Runtime classify before consuming an artifact.

### Compiled product dispositions

- `load-current`
- `rebuild-from-project`
- `reject-too-new`
- `reject-invalid`

### State dispositions

- `restore-current`
- `reject-unsupported-old`
- `reject-too-new`
- `reject-foreign-product`
- `reject-invalid`

C++ exposes the same policy through `CompatibilityDisposition` and classification functions in `garak/runtime/product_v1/compatibility.hpp`.

## Product binding

`GARAKPST` contains the 16-byte Product ID at offset 24. The state classifier fully validates the exact v1 structure before comparing this ID with the expected product. A structurally valid state from another product is `reject-foreign-product`; malformed bytes remain `reject-invalid`.

## Failure semantics

Compatibility inspection never mutates a project, compiled artifact, state buffer, processor, or controller. Runtime state decode continues to write the destination only after every field has passed validation. Rejection therefore preserves the prior valid state.

## CLI

```powershell
pnpm product:compatibility --compiled <product.garakbin>
pnpm product:compatibility --compiled <product.garakbin> --state <state.bin>
pnpm product:compatibility --compiled <product.garakbin> --state <state.bin> --product-id <uuid> --json
```

The command reports the required action. It does not rewrite or migrate either file.

## Version evolution rule

A new major/minor format is added only when an actual capability requires it. Before release, Garak must add fixed old/new byte fixtures, Runtime and compiler parity tests, Product ID and Parameter ID invariants, and an explicit migration-or-rejection decision. Unimplemented future formats are never guessed from their shape.
