# Compiled Artifact and Plug-in State Compatibility

- 문서 상태: Phase 3D1 current contract
- Editable project schema: `4`
- Embedded graph source: `2`
- Compiled product: `GARAKCPD` `1.0`
- Compiled graph: `GARAKGRF` `1.1`
- Product state: `GARAKPST` `1.0`

## Artifact classes

| Artifact | Authority | Current format | Missing/old action | Future action | Corrupt action |
| --- | --- | --- | --- | --- | --- |
| Editable `.garak` project | user source of truth | schema 4 | ordered source migration from v1/v2/v3 | fail closed, preserve source | fail closed, preserve source |
| Compiled product | derived output | `GARAKCPD` 1.0 | rebuild from editable source | reject | reject |
| Compiled graph | derived output | `GARAKGRF` 1.1 | rebuild from validated `project.graph` | reject | reject |
| Plug-in/DAW state | host-persisted user state | `GARAKPST` 1.0 | reject unless explicit released migration exists | reject | reject without changing prior valid state |

Compiled artifacts are never alternate sources of truth. Rebuild means deterministic compilation from a valid current editable project. It never means guessing from damaged bytes or adding a deployed Runtime fallback.

## Current compiled graph contract

`GARAKGRF` 1.1 has one exact header and one of two exact semantic plans.

### Gain-only

- operation count: 3
- byte size: 92
- logical buffer count: 2
- latency: 0
- operations: Audio Input → Gain → Audio Output
- Gain uses public Parameter IDs `1001` and `1002`

### Gain→Polarity

- operation count: 4
- byte size: 112
- logical buffer count: 3
- latency: 0
- operations: Audio Input → Gain → Polarity → Audio Output
- Polarity has no public Parameter ID

Only these canonical plans load as current. Reordered operations, unexpected buffers/parameters, non-zero reserved data, trailing/truncated bytes or any other current-version shape is invalid.

## Compiled graph semantic matrix

| Input | Disposition | Authoring/compiler behavior | Deployed Runtime behavior |
| --- | --- | --- | --- |
| exact canonical `GARAKGRF` 1.1 | `load-current` | use current derived graph | load prepared `StaticExecutionBinding` |
| missing graph | `rebuild-from-project` | compile from validated schema v4 source | fail module load |
| `GARAKGRF` 1.0 | `rebuild-from-project` | replace with deterministic 1.1 bytes | fail module load |
| other supported-old version | `rebuild-from-project` | rebuild current bytes | fail module load |
| future major/minor | `reject-too-new` | preserve artifact and source | fail module load |
| invalid magic/header/layout/noncanonical plan | `reject-invalid` | preserve for diagnosis | fail module load |

Missing and old graph data remain distinct diagnostics even though both authoring actions are rebuild. Future and corrupt artifacts are terminal rejections.

A current schema v4 source with invalid `graph` never reaches the compiled-artifact matrix. Project validation fails before output mutation.

## Classification order

A present compiled graph is classified in this order.

1. recognizable exact `GARAKGRF` magic
2. readable major/minor
3. old/current/future version decision
4. exact current byte size from operation count
5. reserved-field validation
6. exact canonical static plan binding

Version classification therefore happens before current-layout parsing. Old 1.0 bytes are not misreported as current corruption.

## Shared Native binding

The Native current classifier returns the actual `StaticExecutionBinding`. Product Runtime and first-party inspector do not classify through one path and parse through another. Only a current report carrying a valid binding reaches processor initialization.

The binding admits exactly two plans and stores only the data required by the current Runtime: Gain/Bypass IDs and whether the exact plan contains Polarity. Obsolete gain-specific execution/binding APIs were removed rather than retained as aliases.

## Runtime execution consequence

The compiled Polarity plan records a distinct logical operation and buffer. Current Runtime may fuse this exact fixed operation into the Gain active branch. This optimization does not change the compiled plan meaning:

- active Gain-only sample = Gain result
- active Gain→Polarity sample = negated Gain result
- bypassed sample in either plan = original dry input

The callback receives only a validated immutable binding and performs no compatibility parsing or file I/O.

## Product and state dispositions

### Compiled product

- `load-current`
- `rebuild-from-project`
- `reject-too-new`
- `reject-invalid`

`GARAKCPD` remains 1.0 in Phase 3D1.

### Product state

- `restore-current`
- `reject-unsupported-old`
- `reject-too-new`
- `reject-foreign-product`
- `reject-invalid`

`GARAKPST` remains 1.0 and contains the Product ID. Polarity adds no state field, so existing Gain/Bypass state meaning is unchanged.

## Editable source evolution

Current project schema is v4 and graph source is v2. Supported legacy source is v1/v2/v3. Migration is ordered:

```text
v1 → v2 → v3 → v4
```

The v3→v4 step converts exact historical graph source v1 to graph source v2 while preserving the Gain-only topology, authoring node IDs, Product ID, deterministic FUID meaning, Gain/Bypass Parameter IDs, metadata and defaults.

## Cross-layer ownership

- Product Compiler owns authoring-time load/rebuild/reject guidance and deterministic rebuild.
- Studio invokes compiler-owned project/migration/export capabilities through Electron main.
- Product Runtime reads `product.garakbin` and `graph.garakbin` at module load and publishes no usable product path when compatibility fails.
- `garak_product_inspector` uses the same Native graph classification before module/factory parity inspection.
- Audio callback receives only immutable prepared binding/state.

## CLI

```powershell
pnpm product:compatibility --compiled <product.garakbin>
pnpm product:compatibility --compiled <product.garakbin> --graph <graph.garakbin>
pnpm product:compatibility --compiled <product.garakbin> --graph <graph.garakbin> --state <state.bin>
```

Compatibility inspection reports actions only. It does not rewrite, migrate or delete files.

## Version evolution rule

A new major/minor format is added only when an actual capability requires it. Every evolution must add fixed old/current/future/corrupt fixtures, TypeScript/Native parity tests, persistent identity invariants and an explicit migration/rebuild/rejection decision. Unimplemented future formats are never guessed from shape.
