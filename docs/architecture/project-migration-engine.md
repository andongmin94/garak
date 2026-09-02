# Garak Project Migration Engine

- 상태: current schema v3 migration contract
- Owner: Product Compiler
- Supported source versions: `1`, `2`, `3`
- Current target version: `3`
- 관련 문서: [Editable Project Schema v3](editable-project-schema-v3.md), [Editable Project Schema v2](editable-project-schema-v2.md), [Project Model](project-model.md), [Project Persistence Service](project-persistence-service.md), [Runtime과 export](runtime-and-export.md), [ADR 0007](../adr/0007-editable-project-schema-migration-policy.md), [ExecPlan 0016](../../plans/0016-phase-3c2-editable-project-schema-v3.md)

## 목적과 ownership

Project Migration Engine은 versioned editable `.garak` source를 분류하고, 지원되는 exact legacy schema를
current canonical schema로 결정론적으로 변환하는 Product Compiler boundary다. CLI와 Electron main은 같은
callable workflow에 위임한다. Studio renderer와 native Runtime은 별도 validator 또는 migration chain을
소유하지 않는다.

Migration은 input/serialization boundary에서 끝난다. Inspect, compile과 export는 canonical
`ProductProject` v3만 소비하며 legacy union, fallback parser, dual writer 또는 downstream compatibility
branch를 갖지 않는다.

## End-to-end pipeline

```text
physical `.garak` directory
  → package inventory / byte bound / strict UTF-8 / BOM validation
  → duplicate-key lexical scan + JSON parse
  → root object and schemaVersion envelope detection
  → exact version-specific validator
  → ordered pure migration steps
  → exact current v3 revalidation
  → canonical ProductProject v3
  → inspect / compile / export or explicit publication
```

각 단계가 성공한 뒤에만 다음 단계로 넘어간다. Failure는 partial canonical project, output stage, compiled
data 또는 export bundle을 공개하지 않는다.

## Physical and JSON boundary

Version detection 전에 physical project가 다음 contract를 만족해야 한다.

- Exact `.garak` directory와 ordinary lowercase `product.json` 하나
- Extra entry, symlink/reparse point와 case variant 없음
- `product.json` size `1..65536` bytes
- Strict UTF-8, BOM 없음

Lexical pass는 모든 object scope에서 decoded key 기준 duplicate를 검출한다. Root `schemaVersion` token은
fraction/exponent 없는 integer spelling이어야 한다. `3.0`, `3e0`와 parse 시 `3`으로 반올림되는 token을
current version으로 받아들이지 않는다. Malformed JSON, duplicate key, invalid UTF-8와 invalid package를
schema-version failure로 다시 분류하지 않는다.

## Version-first detection

Exact schema field set보다 먼저 root object와 `schemaVersion` envelope만 검사한다.

| Input | Classification | Required behavior |
| --- | --- | --- |
| Root가 object가 아님 | invalid document | Version-specific validation 전에 실패 |
| `schemaVersion` missing | version missing | `GARAK_PROJECT_VERSION_MISSING` |
| Wrong type, non-integer spelling, non-safe integer 또는 precision-loss token | version invalid | `GARAK_PROJECT_VERSION_INVALID` |
| Safe integer `< 1` | too old | `GARAK_PROJECT_VERSION_TOO_OLD` |
| Safe integer `1` | supported legacy | Exact v1 validation, then two migration steps |
| Safe integer `2` | supported legacy | Exact v2 validation, then one migration step |
| Safe integer `3` | current | Exact v3 validation, no migration |
| Safe integer `> 3` | too new | `GARAK_PROJECT_VERSION_TOO_NEW` |

Too-new document의 fields를 v3 shape로 추측하지 않는다. Too-old와 too-new input은 모든 operation에서 source
mutation과 output creation `0`을 보장한다.

## Exact version validators

Envelope classification 뒤 선택된 validator 하나만 실행한다.

- V1: exact eight root keys와 string `template: "garak.gain-v1"`
- V2: exact eight root keys와 structured `template: { "id": "garak.gain", "version": 1 }`
- V3: exact nine root keys, same structured template와 strict embedded graph source v1

Common Product ID, metadata, product version, Windows name, category와 Gain range helper는 공유하지만 version
shape를 union 또는 fallback으로 숨기지 않는다. Invalid input을 trim, clamp, UUID generation, field deletion,
graph synthesis 또는 default substitution으로 수리하지 않는다.

## Canonical status and model boundary

Successful load는 canonical `ProductProject` v3와 별도 `ProjectSchemaStatus`를 반환한다.

- `sourceSchemaVersion`
- `currentSchemaVersion`
- `migrationRequired`
- exact ordered `steps`

Status, source path, raw source revision과 transaction metadata는 product semantic model field가 아니다.
`LoadedProductProject`만 lexical `sourceDirectory`, resolved `physicalSourceDirectory`, raw bytes와 status를
운반한다. Downstream compiler/export에는 versioned source union이 전달되지 않는다.

## Sequential migration chain

```text
project-schema-1-to-2: validated v1 → exact v2
project-schema-2-to-3: validated v2 → exact v3 with canonical graph source v1
```

Step contract:

- pure, synchronous, deterministic function
- exact source/target version
- source object mutation 없음
- filesystem, environment, CWD, locale, time, random, machine/user와 output path 의존 없음
- Product ID, metadata, product version, category, template meaning과 Gain default 보존
- exact next target를 반환하고 target validator로 재검증

V1은 두 step을 순서대로 실행하고 v2는 두 번째 step만 실행한다. V3는 no-op이다. Missing step, target
mismatch 또는 validation failure에서 즉시 실패하며 마지막 valid object나 canonical default로 fallback하지
않는다. Dynamic registry와 version jump는 현재 요구가 아니므로 추가하지 않는다.

## Identity and semantic invariants

Migration 전후 다음을 비교한다.

- Product ID exact equality
- Processor/Controller FUID exact equality
- Gain `1001`, Bypass `1002` exact equality
- Vendor, name, product version, category와 Gain default equality
- V1 string template와 v2/v3 structured template의 compiled semantic equality
- Source graph와 target graph의 exact compiled `GARAKGRF` semantic equality

V1/V2에는 graph field가 없으므로 invariant 비교에서 current canonical Gain graph 의미를 사용한다. Authoring
node ID와 source array order는 compiled graph 의미가 아니며 migration invariant를 실패시키지 않는다.
Invalid/disconnected/unsupported graph는 semantic comparison 전에 strict validation에서 실패한다.

같은 logical product의 v1/v2/v3 counterpart는 exact same `GARAKCPD` v1 bytes/hash와 exact same
`GARAKGRF` v1 bytes/hash를 만든다. Migration 때문에 Product ID/FUID를 재발급하거나 Parameter ID를 remap하지
않는다. `GARAKCPD`와 `GARAKPST` version/layout은 project schema와 독립이다.

## Read operations and Studio boundary

| Operation | v1 | v2 | v3 | Source mutation |
| --- | --- | --- | --- | --- |
| Validate/inspect | Memory migrate through v2/v3 | Memory migrate to v3 | Validate current | 없음 |
| Compile/export | Canonical v3 path | Canonical v3 path | Canonical v3 path | 없음 |
| Migration status | Two ordered steps | One ordered step | Current/no-op | 없음 |
| Migration dry-run | Canonical v3 report | Canonical v3 report | No-op report | 없음 |
| Studio open | Current memory document + migration required | Current memory document + migration required | Current document | 없음 |
| Ordinary Studio save | Stable migration-required refusal | Stable migration-required refusal | Atomic v3 save | legacy는 없음 |

Electron main owns user confirmation, in-place publication, persistent backup, conflict and recovery. Renderer는
migration path, physical path 또는 raw filesystem capability를 받지 않는다.

## Headless CLI contract

```text
pnpm product:migration-status --project <path> [--json]

pnpm product:migrate --project <legacy-path> --to latest --dry-run [--json]

pnpm product:migrate --project <legacy-path> --to latest \
  --output <new-project-path> [--force] [--json]
```

- `--to`는 exact `latest`만 허용한다.
- `--dry-run`과 `--output`은 상호 배타적이다.
- `--force`는 actual output mode에서만 허용한다.
- Headless CLI에는 `--in-place` option이 없다.
- Output은 source와 distinct한 exact `.garak` directory여야 한다.
- Lexical/resolved path, Windows case fold, ancestor/descendant overlap과 reparse alias를 검사한다.
- Current v3 dry-run은 no-op report로 성공한다.
- Current v3 actual migrate는 `migration not required`로 거부한다.

Report에는 source/target version, ordered step IDs, Product ID/FUID before/after, semantic invariant flags,
source/output mutation flags, canonical v3 SHA-256와 output path를 포함한다. Output path는 transaction metadata며
canonical product 의미가 아니다.

## Deterministic canonical result

Migration은 [Editable Project Schema v3](editable-project-schema-v3.md)의 exact serializer를 사용한다.

- UTF-8 without BOM
- LF, two-space indentation, final newline
- deterministic root/template/default/graph field order
- graph node type order와 chain connection order
- valid authoring node ID 보존
- negative zero를 positive zero로 normalize
- timestamp/path/CWD/machine/user/PID/random/build data `0`

같은 valid source는 original whitespace/key order와 실행 환경에 관계없이 exact same v3 bytes와 SHA-256을
만든다. Repeated current parse/serialize는 idempotent하다. Legacy v1/v2 bytes와 SHA는 별도 tracked oracle로
보존한다.

## Source immutability

Migration status, dry-run, validate/inspect/compile/export와 distinct-output migration은 source tree를 수정하지
않는다. Success와 failure 모두에서 inventory, entry type, exact bytes, size와 안정적으로 비교 가능한
last-write metadata를 보존한다. Source를 stage, backup, rename, chmod 또는 touch하지 않는다.

Studio in-place migration은 별도 explicit workflow다. 먼저 current candidate를 완전히 검증하고 persistent
verified backup을 만든 뒤 atomic publication을 수행한다. 실패 시 source 또는 verified backup을 보존한다.

## Atomic publication

Actual distinct-output 또는 in-place publication은 source parse/validation, pure migration, target validation과
serialization을 output mutation 전에 완료한다.

1. Source/output identity와 physical separation을 검증한다.
2. Owned stage를 만든다.
3. Exact canonical v3 `product.json`을 쓰고 current loader로 stage를 재검증한다.
4. Existing output은 기본 거부한다.
5. Explicit replacement에서 prior output/source를 owned verified backup으로 보존한다.
6. Stage→final rename을 commit point로 사용한다.
7. Commit 전 failure는 partial output을 제거하고 prior valid project를 보존 또는 rollback한다.
8. Commit 후 cleanup failure는 successful publication을 되돌리지 않고 typed owned-cleanup diagnostic을
   반환한다.

Rollback 자체가 실패하면 primary와 rollback failure를 함께 보존하고 arbitrary path cleanup을 시도하지
않는다.

## Diagnostics and validation requirements

Required coverage:

- exact current v3 Warm/Bright fixture bytes/SHA
- exact legacy v1/v2 Warm/Bright fixture bytes/SHA
- malformed/old/future version envelope와 version-first classification
- exact v1/v2/v3 validator separation
- pure step determinism, source immutability와 target revalidation
- v1→v2→v3 and v2→v3 ordered status/report
- Product ID/FUID/Parameter/template/default/compiled graph invariants
- exact v1/v2/v3 `GARAKCPD` v1 and `GARAKGRF` v1 parity
- dry-run, distinct output, overlap, current no-op and force/failure transactions
- Studio decline/read-only and approve/backup/migrate/reopen paths
- Debug/Release actual export, official Validator, CTest, Studio workflow, Werror and clang-tidy

Unknown field ignore, dual parser fallback와 best-effort conversion을 허용하지 않는다. Failed migration을
current/default/cached project로 공개하지 않는다.

## Phase boundary

Phase 2A가 v1→v2 engine을 만들었고 Phase 2B가 durable in-place migration/backup/recovery를 추가했다.
Phase 3C2는 같은 경계를 v2→v3 graph source로 확장한다. Compiled graph compatibility disposition matrix와
final Phase 3C gate는 Phase 3C3가 소유한다.
