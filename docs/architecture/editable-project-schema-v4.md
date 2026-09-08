# Editable Project Schema v4

- 문서 상태: Current
- Project schema version: `4`
- Embedded graph source version: `2`
- Supported legacy project input: schema `1`, `2`, `3`
- Current compiled graph target: `GARAKGRF` `1.1`
- Related plan: [`plans/0018-phase-3d1-polarity-node.md`](../../plans/0018-phase-3d1-polarity-node.md)

## 목적

Schema v4는 editable `.garak` project가 Gain-only뿐 아니라 fixed Polarity operation을 포함한 두 번째 실제 sound topology를 명시할 수 있도록 한다. v4는 arbitrary graph format이 아니며 Phase 3D1에 필요한 최소 exact contract만 추가한다.

Historical schema v3는 embedded graph source v1의 exact Gain-only contract다. v4가 이를 silent하게 broaden하지 않고 graph source version을 2로 명시적으로 올린다.

## Current project shape

Current unpacked project는 `.garak` directory 안의 canonical `product.json`을 authority로 사용한다. 핵심 fields는 다음 의미를 가진다.

```json
{
  "schemaVersion": 4,
  "productId": "<uuid>",
  "vendor": "<vendor>",
  "name": "<product name>",
  "version": "<semver>",
  "category": "Fx",
  "template": {
    "id": "garak.gain",
    "version": 1
  },
  "defaults": {
    "gainDb": 0
  },
  "graph": {
    "schemaVersion": 2,
    "nodes": [],
    "connections": []
  }
}
```

Exact key/type/range validation은 Product Compiler가 소유한다. Unknown/missing fields는 fail closed한다.

## Graph source v2

### Node shape

```json
{
  "id": "node-id",
  "type": "garak.gain",
  "implementationVersion": 1
}
```

Current node types:

- `garak.audio-input`
- `garak.gain`
- `garak.polarity`
- `garak.audio-output`

모든 implementationVersion은 정확히 `1`이다.

Node IDs는 authoring identity다. Valid IDs와 source array order가 같은 semantic topology의 compiled graph bytes를 바꾸지 않는다.

### Endpoint and connection shape

```json
{
  "from": { "nodeId": "gain", "port": "audio" },
  "to": { "nodeId": "output", "port": "audio" }
}
```

Current endpoint port는 정확히 `audio` 하나다.

## Supported exact topologies

Graph source v2가 받아들이는 topology는 정확히 두 개다.

### Gain-only

```text
garak.audio-input
→ garak.gain
→ garak.audio-output
```

- node count: 3
- connection count: 2
- each required node type exactly once

### Gain→Polarity

```text
garak.audio-input
→ garak.gain
→ garak.polarity
→ garak.audio-output
```

- node count: 4
- connection count: 3
- each required node type exactly once

## Explicitly unsupported

Current validator rejects:

- duplicate node IDs
- duplicate node types
- unknown node types or implementation versions
- missing endpoints
- non-`audio` ports
- duplicate connections
- invalid connection direction
- cycles
- disconnected nodes
- reordered semantic topology such as Polarity before Gain
- multiple Gain or Polarity nodes
- branching, merge, feedback, sidechain
- node-specific property bags
- arbitrary DAGs

이 제한은 임시 parser limitation이 아니라 Phase 3D1의 intentional product contract다.

## Migration

Supported project migration chain:

```text
schema 1 → schema 2 → schema 3 → schema 4
```

### v3→v4

The v3 source already contains exact graph source v1:

```text
Audio Input → Gain → Audio Output
```

v3→v4는 이 graph를 source v2 representation으로 승격한다. 이 migration은 다음 의미를 바꾸지 않는다.

- Product ID
- processor/controller FUID derivation
- vendor/name/version/category/template
- Gain default
- Gain Parameter ID `1001`
- Bypass Parameter ID `1002`
- authoring node IDs
- Gain-only sound topology
- `GARAKCPD` 1.0 meaning
- `GARAKPST` 1.0 meaning

Ordinary open은 legacy source를 memory에서 current model로 읽을 수 있지만 source rewrite는 explicit migration flow가 소유한다. Save가 legacy source를 implicit overwrite하지 않는다.

## Canonical serialization

Current schema v4 serializer는 semantic document를 canonical bytes로 쓴다. Source path, timestamp, CWD, machine/user와 random data는 project or compiled identity에 포함되지 않는다.

Graph source의 semantically irrelevant array ordering은 compiler output에 영향을 주지 않는다. Compiler는 node type/topology 의미에서 deterministic operation plan을 만든다.

## Compiled result

Validated v4 source는 `GARAKGRF` 1.1로 compile된다.

- Gain-only → exact 3-operation 92-byte plan
- Gain→Polarity → exact 4-operation 112-byte plan

Compiled graph는 derived artifact다. Current source가 invalid하면 export는 output mutation 전에 실패한다. Missing/old compiled graph는 authoring context에서 source로부터 rebuild할 수 있지만 deployed Runtime은 fallback하지 않는다.

## Studio ownership

Electron main이 current validated graph와 project identity를 소유한다. Renderer의 editable metadata/default draft가 Product ID, source path 또는 graph를 임의로 제출/변경하지 못한다. Migration/conflict/recovery/export decisions도 main-owned service boundary를 통과한다.

## Phase 3D1 invariants

Schema v4 도입으로 다음 persistent contracts는 바뀌지 않는다.

- `GARAKCPD` 1.0
- `GARAKPST` 1.0
- Gain `1001`
- Bypass `1002`
- Product ID/FUID derivation

Polarity는 graph structure이며 public parameter/state가 아니다.
