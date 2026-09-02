# Garak Editable Project Schema v3

- 상태: Phase 3C2 current editable source contract
- Current schema version: `3`
- Supported legacy input: schema versions `1`, `2`
- Embedded graph source version: `1`
- 관련 문서: [Editable Project Schema v2](editable-project-schema-v2.md), [Project Migration Engine](project-migration-engine.md), [Project Model](project-model.md), [Runtime과 export](runtime-and-export.md), [Compiled Product Data v1](compiled-product-data-v1.md), [Product State v1](product-state-v1.md), [ExecPlan 0014](../../plans/0014-phase-3c-editable-static-graph-contract.md), [ExecPlan 0016](../../plans/0016-phase-3c2-editable-project-schema-v3.md)

## 목적과 version 경계

Schema v3은 현재 `.garak` editable source에 versioned sound graph를 명시한다. Product metadata, Product ID,
template와 Gain default만 저장하던 v2에 embedded graph source v1을 추가하며, 현재 지원 capability인
`Audio Input → Gain → Audio Output`을 project-owned contract로 만든다.

다음 version은 서로 독립적이다.

- project source schema: `3`
- embedded graph source schema: `1`
- node implementation version: `1`
- compiled product format: `GARAKCPD` `1.0`
- compiled graph format: `GARAKGRF` `1.0`
- plug-in state format: `GARAKPST` `1.0`
- product release version: `major.minor.patch`

Project schema가 v3으로 바뀌어도 Product ID, processor/controller FUID, Gain Parameter ID `1001`, Bypass
Parameter ID `1002`, `GARAKCPD` v1와 `GARAKPST` v1의 의미와 바이트 계약은 바뀌지 않는다.

## Physical form

Physical package는 계속 unpacked directory와 exact `product.json` 한 파일이다.

```text
<product-name>.garak/
└─ product.json
```

- Directory leaf는 exact lowercase `.garak` suffix를 사용한다.
- Root inventory는 ordinary file `product.json` 하나다.
- Extra entry, subdirectory, symlink/reparse point와 filename case variant를 거부한다.
- `product.json`은 `1..65536` bytes, strict UTF-8, BOM 없음이어야 한다.
- Editable JSON source는 generated VST3 bundle에 포함하지 않는다.

Graph를 별도 physical file로 분리하지 않는다. 현재 one-file atomic save/recovery 경계를 유지하는 것이 v3의
가장 작은 완결된 increment다.

## Canonical schema version 3

Canonical Warm example:

```json
{
  "schemaVersion": 3,
  "productId": "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
  "vendor": "Garak Test Artist",
  "name": "Artist Gain Warm",
  "version": "0.1.0",
  "category": "Fx",
  "template": {
    "id": "garak.gain",
    "version": 1
  },
  "defaults": {
    "gainDb": -6
  },
  "graph": {
    "schemaVersion": 1,
    "nodes": [
      {
        "id": "input",
        "type": "garak.audio-input",
        "implementationVersion": 1
      },
      {
        "id": "gain",
        "type": "garak.gain",
        "implementationVersion": 1
      },
      {
        "id": "output",
        "type": "garak.audio-output",
        "implementationVersion": 1
      }
    ],
    "connections": [
      {
        "from": { "nodeId": "input", "port": "audio" },
        "to": { "nodeId": "gain", "port": "audio" }
      },
      {
        "from": { "nodeId": "gain", "port": "audio" },
        "to": { "nodeId": "output", "port": "audio" }
      }
    ]
  }
}
```

Root key set은 정확히 다음 아홉 개다.

| Field | Type | v3 contract |
| --- | --- | --- |
| `schemaVersion` | JSON number | Fraction/exponent 없는 lexical integer token이며 정확히 `3` |
| `productId` | string | Canonical lowercase UUID, non-nil, immutable |
| `vendor` | string | Valid UTF-8 `1..63` bytes |
| `name` | string | Windows-safe product/bundle leaf, valid UTF-8 `1..52` bytes |
| `version` | string | Prerelease/build 없는 strict `major.minor.patch` |
| `category` | string | 정확히 `Fx` |
| `template` | object | Exact `{ "id": "garak.gain", "version": 1 }` |
| `defaults` | object | Exact finite `gainDb`, inclusive `-60..12` dB |
| `graph` | object | Exact graph source v1 |

Unknown, missing, duplicate 또는 wrong-type field를 허용하지 않는다. Graph가 없거나 잘못됐을 때 export가
canonical graph를 대신 삽입하는 fallback도 없다.

## Embedded graph source v1

### Exact shape

`graph` root key는 `schemaVersion`, `nodes`, `connections` 세 개다.

Node key는 `id`, `type`, `implementationVersion` 세 개다.

Connection key는 `from`, `to` 두 개고, endpoint key는 `nodeId`, `port` 두 개다.

Current graph는 정확히 세 node와 두 connection을 가진다.

| Node type | Count | Implementation version | Audio role |
| --- | ---: | ---: | --- |
| `garak.audio-input` | 1 | `1` | source only |
| `garak.gain` | 1 | `1` | one input, one output |
| `garak.audio-output` | 1 | `1` | target only |

모든 endpoint port는 exact string `audio`다. Valid topology는 다음 두 edge뿐이다.

```text
garak.audio-input.audio → garak.gain.audio
garak.gain.audio        → garak.audio-output.audio
```

### Node ID

Node ID는 authoring identity이며 정규식 `^[a-z][a-z0-9-]{0,63}$`를 만족한다.

- Graph 안에서 unique해야 한다.
- Connection은 존재하는 node ID를 참조해야 한다.
- ID는 operation order, buffer slot, Parameter ID 또는 compiled graph bytes를 결정하지 않는다.
- Canonical writer는 valid ID를 보존한다.

### Validation

Validator는 최소한 다음을 fail closed한다.

- unknown/missing field 또는 wrong JSON type
- graph schema version 또는 node implementation version mismatch
- invalid/duplicate node ID
- unsupported/duplicate/missing node type
- invalid port
- missing connection endpoint
- duplicate connection
- Audio Output에서 나가거나 Audio Input으로 들어오는 edge
- cycle
- disconnected node 또는 exact Gain chain 이외의 topology

현재 exact capability보다 넓은 arbitrary DAG, split/merge, feedback, sidechain과 additional node를 v1로
추측해 받아들이지 않는다.

## Canonicalization과 deterministic compilation

Source node/connection 배열 순서는 semantic하지 않다. Validation 뒤 canonical current model은 node를
`Audio Input`, `Gain`, `Audio Output` type order로 정렬하고 connection을 chain order로 정렬한다. Valid
node ID는 그대로 보존한다.

Compilation은 validated `project.graph`를 받아 다음 immutable `GARAKGRF` v1 plan으로 낮춘다.

| Operation | Instance ID | Input buffer | Output buffer | Parameter binding |
| --- | ---: | ---: | ---: | --- |
| Audio Input | `1` | none | `0` | none |
| Gain | `2` | `0` | `1` | Gain `1001`, Bypass `1002` |
| Audio Output | `3` | `1` | none | none |

Buffer count는 `2`, latency는 `0`이다. Valid authoring ID와 source array order가 달라도 exact 92-byte
`graph.garakbin`은 동일하다. Invalid current graph는 compile/export 전에 실패하고 canonical plan으로
대체되지 않는다.

## Migration

지원 chain은 다음 하나다.

```text
schema v1 --project-schema-1-to-2--> schema v2
schema v2 --project-schema-2-to-3--> schema v3
```

- v1 open은 두 step을 순서대로 보고한다.
- v2 open은 `project-schema-2-to-3` 하나를 보고한다.
- v3 open은 no-op이다.
- v2→v3은 exact canonical Gain graph source를 한 번 추가한다.
- Migration은 Product ID/FUID, metadata, product version, Gain default, template meaning, Parameter ID,
  compiled product bytes와 state meaning을 보존한다.
- Open/inspect/compile/export와 dry-run은 source를 수정하지 않는다.
- Studio in-place migration은 사용자의 명시적 승인 뒤 verified persistent backup을 만든 다음 v3을 publish한다.
- Legacy source를 ordinary Save로 조용히 v3으로 rewrite하지 않는다.

Legacy v1과 v2 fixture는 current fixture와 분리해 exact bytes/SHA oracle로 유지한다. Obsolete parser 또는
legacy downstream model을 current compiler path에 보존하지 않고, input boundary에서 current v3 model로
변환한다.

## Studio boundary

Phase 3C2의 renderer는 기존 metadata/default draft만 편집한다.

- Electron main이 Product ID, physical path와 validated graph를 session에 보관한다.
- `ProductDocument.graph`는 renderer에 read-only status data로 전달한다.
- Renderer validate/save request에는 graph, Product ID 또는 path를 넣을 수 없다.
- Main이 renderer draft와 session graph를 결합해 Product Compiler draft를 만든다.
- Create/open/save/reopen/migrate는 exact graph를 round-trip한다.
- Filesystem, child process 또는 raw IPC authority를 renderer에 추가하지 않는다.

Graph canvas와 graph mutation UX는 별도 phase다. Read-only graph 표시가 future editing capability를
암시해서는 안 된다.

## Scope boundary

Schema v3은 current editorless Gain product의 explicit graph source만 추가한다. 다음은 v3 contract가 아니다.

- additional DSP nodes
- arbitrary DAG, branching, feedback와 sidechain
- macro/control mapping
- graph canvas, undo/redo와 selection state
- interface scene, preset 또는 asset package
- compiled graph compatibility disposition matrix
- `GARAKCPD`/`GARAKPST` layout change
- platform target, signing, installer 또는 DAW matrix

Compiled graph current/missing/corrupt/too-old/too-new disposition과 final cross-layer gate는 Phase 3C3가
소유한다.
