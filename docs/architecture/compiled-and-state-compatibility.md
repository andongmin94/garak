# Compiled Artifact and Plug-in State Compatibility

- 문서 상태: Phase 3C3 compiled graph matrix implementation candidate
- Editable project schema: `3`
- Compiled product: `GARAKCPD` `1.0`
- Compiled graph: `GARAKGRF` `1.0`
- Product state: `GARAKPST` `1.0`

## Artifact classes

| Artifact | Authority | Current format | Missing/old action | Future action | Corrupt action |
| --- | --- | --- | --- | --- | --- |
| Editable `.garak` project | User source of truth | schema 3 | sequential source migration | fail closed, preserve source | fail closed, preserve source |
| Compiled product data | Derived build output | `GARAKCPD` 1.0 | rebuild from editable source | reject, preserve artifact | reject, preserve artifact and source |
| Compiled graph data | Derived build output | `GARAKGRF` 1.0 | rebuild from validated `project.graph` | reject, preserve artifact | reject, preserve artifact and source |
| Plug-in/DAW state | Host-persisted user state | `GARAKPST` 1.0 | reject unless an explicit released migration exists | reject, preserve state | reject without changing prior valid state |

Compiled artifacts are not alternate sources of truth. Rebuild means deterministic compilation from a valid current
editable project. It never means guessing a graph from damaged current bytes or adding a Runtime fallback.

## Compiled graph semantic matrix

Product Compiler TypeScript, Native static graph Runtime and the first-party inspector use the same semantic decision.

| Input | Disposition | Authoring/compiler behavior | Deployed Runtime behavior |
| --- | --- | --- | --- |
| exact `GARAKGRF` 1.0 | `load-current` | use current derived graph | load its prepared immutable binding |
| missing file | `rebuild-from-project` | compile again from validated schema v3 source | fail module load; no editable source exists in the bundle |
| supported-old major/minor | `rebuild-from-project` | discard old derived bytes and compile current bytes | fail module load |
| future major or minor | `reject-too-new` | preserve without overwrite or reinterpretation | fail module load |
| invalid magic/header/current layout or noncanonical plan | `reject-invalid` | preserve artifact and source for diagnosis | fail module load |

Missing and old data have different diagnostic codes:

- `GARAK_COMPILED_GRAPH_MISSING`
- `GARAK_COMPILED_GRAPH_VERSION_OLD`

They share one authoring action because both are derived data. Future and corrupt artifacts are terminal rejection
cases. A current schema v3 source with an invalid `graph` never reaches this derived-artifact matrix: project validation
fails before export output mutation.

## Classification order

A present compiled graph is classified in this order.

1. Recognizable exact `GARAKGRF` magic
2. Readable major/minor header
3. Old or future version decision
4. Exact current-size parser, reserved fields and semantic `Input → Gain → Output` binding

Version is therefore identified before the exact current parser runs. Old and future headers are not misreported as a
current-layout corruption. Bad magic or a header shorter than the version fields is invalid.

The Native current result contains the actual `GainExecutionBinding`. Product Runtime does not classify through one
path and parse through another. Only a `current` report with a binding reaches the processor context.

## Product and state dispositions

### Compiled product

- `load-current`
- `rebuild-from-project`
- `reject-too-new`
- `reject-invalid`

### Product state

- `restore-current`
- `reject-unsupported-old`
- `reject-too-new`
- `reject-foreign-product`
- `reject-invalid`

`GARAKPST` contains the 16-byte Product ID at offset 24. The state classifier fully validates the exact v1 structure
before comparing this ID with the expected product. A structurally valid state from another product is
`reject-foreign-product`; malformed bytes remain `reject-invalid`.

## Cross-layer ownership

- Product Compiler owns authoring-time `load-current` / `rebuild-from-project` / rejection guidance.
- `pnpm product:compatibility` reports compiled product, compiled graph and optional Product State together.
- Product Runtime reads `graph.garakbin` at module load, uses the Native classifier and publishes no factory for any
  non-current disposition.
- `garak_product_inspector` classifies the graph resource before module/factory parity inspection. Missing, old, future
  and corrupt graph data are reported as graph compatibility failures instead of only an indirect module-load failure.
- Audio callback code receives only the immutable prepared binding. Compatibility parsing, file I/O and diagnostics
  remain outside realtime processing.

## Failure semantics

Compatibility inspection never mutates a project, compiled artifact, state buffer, processor or controller. Only an
intentionally omitted graph path or filesystem `ENOENT` is reported as missing by the TypeScript file API. Permission,
I/O and other read failures remain command errors rather than being silently converted into a rebuild decision.

Runtime state decode continues to write the destination only after every field has passed validation. Rejection
therefore preserves the prior valid state.

## CLI

```powershell
pnpm product:compatibility --compiled <product.garakbin>
pnpm product:compatibility --compiled <product.garakbin> --graph <graph.garakbin>
pnpm product:compatibility --compiled <product.garakbin> --graph <graph.garakbin> --state <state.bin>
pnpm product:compatibility --compiled <product.garakbin> --graph <graph.garakbin> --state <state.bin> --product-id <uuid> --json
```

Omitting `--graph`, or supplying a path that does not exist, intentionally produces the explicit missing graph report
and makes `loadable` false. The command reports required actions only. It does not rewrite, migrate or delete any file.

## Version evolution rule

A new major/minor format is added only when an actual capability requires it. Before release, Garak must add fixed
old/current/future/corrupt byte fixtures, TypeScript and Native parity tests, Product ID and Parameter ID invariants, and
an explicit migration, rebuild or rejection decision. Unimplemented future formats are never guessed from their shape.

No `GARAKGRF` migration implementation exists in Phase 3C3. Old derived graph data is replaced only by deterministic
compilation from a validated current editable project.
