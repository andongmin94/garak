# Phase 2A Project Migration Fixtures

- 기준일: 2026-08-12
- 판정: **PASS / Complete (editable project migration fixtures)**
- 시작 baseline: `8d1930c8f07a94bcc441d54e91d9a40b84b5b505`
- 관련 계획: [ExecPlan 0007](../../plans/0007-phase-2a-editable-project-schema-migration.md)
- 계약: [Editable Project Schema v2](../architecture/editable-project-schema-v2.md), [Project Migration Engine](../architecture/project-migration-engine.md), [ADR 0007](../adr/0007-editable-project-schema-migration-policy.md)
- 검증: [Phase 2A Project Migration Validation](phase-2a-project-migration-validation.md)

## 판정

Phase 2A는 editable `.garak` source의 current schema를 v2로 올리고 schema v1을 exact supported legacy
input으로 고정했다. Warm/Bright v1 fixture는 source byte oracle로 보존하고, root Warm/Bright fixture는
canonical v2 writer의 exact output으로 갱신했다. V1→v2는 product identity, Gain/Bypass Parameter ID,
metadata, default와 template 의미를 바꾸지 않으며 같은 `GARAKCPD` v1 bytes를 만든다.

이 PASS는 editable source migration fixture에만 해당한다. Phase 2B Studio migration publication,
backup/recovery와 durable persistence UX, Phase 2C compiled product 및 plug-in/preset/DAW state compatibility는
완료하지 않았다.

## Physical fixture inventory

Physical form은 Phase 1C의 unpacked directory package를 유지한다.

```text
examples/products/
├─ artist-gain-warm.garak/product.json
├─ artist-gain-bright.garak/product.json
└─ legacy/v1/
   ├─ artist-gain-warm.garak/product.json
   └─ artist-gain-bright.garak/product.json
```

- Root Warm/Bright는 current canonical schema v2다.
- `legacy/v1` Warm/Bright는 exact schema v1 source다.
- 각 directory는 lowercase ordinary `product.json` 하나만 포함한다.
- 동일 product의 v1/v2 pair는 Product ID가 같으므로 일반 batch collision input이 아니라 migration parity
  pair로만 사용한다.
- Project source는 generated VST3 bundle에 포함하지 않는다.

## Exact source byte oracles

| Product | Schema | Bytes | `product.json` SHA-256 |
| --- | ---: | ---: | --- |
| Warm legacy | 1 | 256 | `E67AE969C2712040D1455034AE9CEC27369A1F3CA661B18837F71070446CB556` |
| Bright legacy | 1 | 257 | `5ED2BA89333BD58410A9A97E7C01C2C1575D60529E2C916A1A6E2654B1CB3094` |
| Warm current/canonical | 2 | 285 | `3F27ED552AEC8CAE3C7D34C5AE1F4821582E1DAC3E323B353A845C8891734C33` |
| Bright current/canonical | 2 | 286 | `B50A360FD6862BFD0364D4BE95365D4B48E0AF34EE81084626EBE5F791C5932B` |

Canonical v2 bytes는 UTF-8 without BOM, LF, 2-space indentation, fixed property order와 final newline을
사용한다. Negative zero는 positive zero로 normalize한다. Timestamp, path, CWD, machine/user, PID와
random value는 serialization에 들어가지 않는다.

Repository의 `core.autocrlf=true` 환경에서도 exact byte oracle이 checkout 때 CRLF로 바뀌지 않도록
`.gitattributes`는 `examples/products/**/product.json text eol=lf`를 고정한다. 네 fixture 모두 Git
attribute `text=set`, `eol=lf`, CR byte 0과 위 SHA-256을 확인했다.

## Schema representation delta

Migration은 두 representation만 바꾼다.

| Meaning | Schema v1 | Schema v2 |
| --- | --- | --- |
| Editable project schema | `schemaVersion: 1` | `schemaVersion: 2` |
| Template identity/version | `template: "garak.gain-v1"` | `template: { "id": "garak.gain", "version": 1 }` |

Product ID, vendor, name, product release version, category와 `defaults.gainDb`는 그대로 보존한다. V2
structured template는 compile boundary에서 existing logical/compiled `garak.gain-v1`과 template enum
`1`로 명시적으로 낮춘다.

## Identity and compiled-data oracles

| Product | Product ID | Processor FUID | Controller FUID | Gain / Bypass | `GARAKCPD` v1 |
| --- | --- | --- | --- | --- | --- |
| Warm | `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` | `3BA93DD6A062C97D89EC78F3652F83C4` | `00DD9000A50F7F28F4AE084CD29C4330` | `1001` / `1002` | 177 bytes, `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` |
| Bright | `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357` | `FCB1FDAED3D981A2AE3AE5A20898C449` | `32D933DFBD3C8110E014829EF5D62EA3` | `1001` / `1002` | 179 bytes, `ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52` |

Debug와 Release parity report 모두 각 product의 v1/v2 compiled bytes, Runtime bytes,
`moduleinfo.json`, bundle inventory와 identity parity를 `true`로 기록했다. Schema v2는 `GARAKCPD` 또는
`GARAKPST` v2를 뜻하지 않는다.

## Detection and failure fixtures

Version detection은 exact version-specific field validation보다 먼저 실행되고 다음 structured union을
구분한다.

- `supported-legacy`: exact schema v1
- `current`: exact schema v2
- `too-old`: valid lexical safe integer `< 1`
- `too-new`: valid lexical safe integer `> 2`
- `invalid`: root type, missing version 또는 신뢰할 수 없는 version token/value

Schema 0/3, missing, duplicate, wrong-type, fractional/exponent, non-safe 또는 lexically imprecise version과
malformed JSON을 current shape로 추측하지 않는다. `2.0`, `2e0`와 parse 시 `2`로 반올림되는
`2.0000000000000001`은 모두 invalid다. V1/v2 validator는 서로의 template representation, unknown key와
duplicate key를 거부한다. Too-old/too-new/invalid input은 migration, compile과 export output을 만들지 않고
source를 변경하지 않는다.

## Source immutability and publication fixtures

Unit/CLI fixture는 migration-status, dry-run, legacy open, compile/export와 explicit distinct-output
migration의 source bytes, size, inventory와 last-write metadata 불변을 검사한다. Ordinary Studio save는
legacy v1 source에서 `GARAK_PROJECT_MIGRATION_REQUIRED`로 실패한다.

Actual migration은 distinct explicit `.garak` output만 허용한다. Same/overlapping path, current v2 actual
migration, occupied output without `--force`, missing parent와 different-product force replacement을 구현 계약으로
거부한다. Different-product `--force` branch의 전용 regression fixture는 후속 보강 항목이다.
New/force publication의 backup, publish, rollback과 cleanup fault fixture는 partial final을 공개하지 않고
prior valid output을 보존한다.

## Scope boundary

Phase 2A는 Studio migration dialog/banner/button이나 in-place publication을 추가하지 않았다. Exact 다음
milestone은 **Phase 2B — Studio Migration, Backup, Recovery and Durable Persistence UX**다. Compiled-data와
plug-in/preset/DAW state compatibility는 **Phase 2C**에 남아 있고, macOS VST3/Universal과 AU는 첫 상용
배포 전 cross-platform release gate다.
