# Editable Project Schema v5

- 문서 상태: Phase 3D2 accepted current schema contract
- Project schema version: `5`
- Embedded graph source version: `3`
- Supported legacy project input: schema `1`, `2`, `3`, `4`
- Current compiled graph target: `GARAKGRF` `1.2`
- Related plan: [`plans/0019-phase-3d2-saturation-node.md`](../../plans/0019-phase-3d2-saturation-node.md)

## 목적

Schema v5는 fixed, parameterless Saturation을 추가한다. Historical [schema v4](editable-project-schema-v4.md)의 Gain-only와 Gain→Polarity 의미는 보존하고 graph source version을 3으로 올린다. Arbitrary graph format, graph canvas나 parameter/macro system은 추가하지 않는다.

## Current project shape

Unpacked `.garak` directory 안의 exact `product.json`이 authority다.

```json
{
  "schemaVersion": 5,
  "productId": "<uuid>",
  "vendor": "<vendor>",
  "name": "<product name>",
  "version": "<semver>",
  "category": "Fx",
  "template": { "id": "garak.gain", "version": 1 },
  "defaults": { "gainDb": 0 },
  "graph": {
    "schemaVersion": 3,
    "nodes": [],
    "connections": []
  }
}
```

빈 graph arrays는 shape 설명용이며 valid topology가 아니다. Exact key/type/range와 graph validation은 Product Compiler가 소유하며 unknown/missing fields를 거부한다.

## Graph source v3

Node는 exact `id`, `type`, `implementationVersion` fields를 가진다. Valid authoring ID는 `^[a-z][a-z0-9-]{0,63}$`이고 implementation version은 `1`이다. Current types는 다음과 같다.

- `garak.audio-input`
- `garak.gain`
- `garak.polarity`
- `garak.saturation`
- `garak.audio-output`

Connection은 exact `from`/`to` endpoint이며 endpoint는 `nodeId`와 port `audio`만 가진다.

지원 topology는 정확히 세 개다.

```text
Audio Input → Gain → Audio Output
Audio Input → Gain → Polarity → Audio Output
Audio Input → Gain → Saturation → Audio Output
```

Gain-only는 3 nodes/2 connections, optional-node topology는 4 nodes/3 connections다. Post-Gain node는 Polarity 또는 Saturation 중 최대 하나만 허용한다. Repeated types, duplicate IDs/connections, extra fields, unsupported versions/ports, missing/disconnected endpoints, reversed topology, branching, merge, cycles, feedback와 sidechain은 거부한다.

`garak.saturation` implementation version 1은 finite active post-Gain sample에 `y = tanh(x)`를 적용한다. Public parameter, node property bag와 persistent state field는 없다. Host Bypass는 whole product graph를 우회해 original dry input을 그대로 출력한다.

## Migration and authoring order

지원 migration은 version jump 없이 순서대로 진행한다.

```text
schema 1 → schema 2 → schema 3 → schema 4 → schema 5
```

v4→v5는 project version과 embedded graph source version만 승격한다. 기존 graph node IDs, node/connection array order와 exact Gain-only/Polarity topology를 보존한다. Product ID, FUID derivation, metadata/defaults와 Gain/Bypass semantics는 바뀌지 않는다.

Historical graph source v1의 canonical serialization ordering은 기존 계약을 유지한다. Current graph source v3의 parse/serialize와 v4→v5 migration은 source node/connection array order를 보존한다. Valid authoring IDs와 array order가 달라도 같은 semantic topology는 같은 compiled graph bytes를 만든다.

Ordinary open은 legacy source를 memory에서 current model로 읽으며 source를 rewrite하지 않는다. Ordinary legacy Save는 migration-required refusal을 유지한다. Explicit migration publication은 shared compiler와 main-owned verified backup/recovery transaction을 사용한다.

## Deterministic compiled result

Validated schema v5 source는 `GARAKGRF` 1.2로 compile된다.

| Topology | Operations | Bytes | Logical buffers | Latency |
| --- | --- | --- | --- | --- |
| Gain-only | 3 | 92 | 2 | 0 |
| Gain→Polarity | 4 | 112 | 3 | 0 |
| Gain→Saturation | 4 | 112 | 3 | 0 |

Compiler는 source topology에서 deterministic operation plan을 만든다. Source path, timestamp, machine/user와 random data는 identity나 compiled bytes에 포함하지 않는다. `GARAKGRF` 1.0/1.1은 old derived artifacts로 current source에서 rebuild한다. Future/corrupt graph는 reject하며 deployed Runtime에는 fallback이 없다.

## Studio ownership and persistent invariants

Electron main이 current graph, Product ID와 physical source path를 소유한다. Renderer는 read-only graph status와 editable metadata/default draft만 받고 graph/path/identity authority를 제출하지 않는다.

Phase 3D2에서 `GARAKCPD` 1.0, product-bound `GARAKPST` 1.0, Gain `1001`, Bypass `1002`, Product ID와 deterministic FUID derivation은 유지한다. Polarity/Saturation presence는 graph structure이며 public state가 아니다.

`Artist Gain Saturated` reference는 Product ID `8a5ce3f8-7b74-4f53-bdc2-c52e4f586072`, default Gain `0 dB`와 Gain→Saturation topology를 사용한다. Warm/Bright/Inverted의 identity와 sound semantics는 유지한다. Phase 3D2 acceptance 상태는 [current status](../status/current.md)를 따른다.
