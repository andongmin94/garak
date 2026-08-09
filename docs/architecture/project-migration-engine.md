# Garak Project Migration Engine

- 상태: Phase 2A normative migration contract; Windows x64 validation PASS
- Owner: Product Compiler
- Supported source versions: `1`, `2`
- Current target version: `2`
- 관련 문서: [Editable Project Schema v2](editable-project-schema-v2.md), [Minimal Garak Product Project](minimal-garak-product-project.md), [Project Model](project-model.md), [Runtime과 export](runtime-and-export.md), [ADR 0007](../adr/0007-editable-project-schema-migration-policy.md), [ADR 0006](../adr/0006-studio-product-workflow-boundary.md), [ExecPlan 0007](../../plans/0007-phase-2a-editable-project-schema-migration.md), [Phase 2A fixtures](../status/phase-2a-project-migration-fixtures.md), [Phase 2A validation](../status/phase-2a-project-migration-validation.md)

## 목적과 ownership

Project Migration Engine은 versioned editable `.garak` source를 안전하게 분류하고, 지원되는 exact legacy
schema를 current canonical schema로 결정론적으로 변환하는 Product Compiler boundary다. CLI와 Electron
main은 같은 callable workflow에 위임한다. Studio renderer, Electron main 또는 native Runtime이 별도
validator/migration chain을 소유하지 않는다.

Migration은 serialization/input boundary에서 끝난다. Inspect, compile과 export는 current canonical v2
model만 소비하며 legacy branch, fallback parser 또는 dual-write path를 갖지 않는다.

## End-to-end pipeline

```text
physical `.garak` directory
  → package inventory / byte bound / strict UTF-8 / BOM validation
  → duplicate-key lexical scan + JSON parse
  → root object and schemaVersion envelope detection
  → supported-version classification
  → exact version-specific validator
  → sequential pure migration steps
  → exact current v2 revalidation
  → canonical ProductProject v2
  → inspect / compile / export or explicit-output serialization
```

각 단계가 성공한 뒤에만 다음 단계로 넘어간다. Failure는 partial canonical project, stage directory,
compiled data 또는 export bundle을 공개하지 않는다.

## Physical and JSON boundary

Version detection 전에 physical project가 현재 directory-package contract를 만족해야 한다.

- Exact `.garak` directory와 ordinary lowercase `product.json` 하나
- Extra entry, symlink/reparse point와 case variant 없음
- `product.json` size `1..65536` bytes
- Strict UTF-8, BOM 없음

JSON lexical pass는 모든 object scope에서 decoded key 기준 duplicate를 검출한다. 그 뒤 standard JSON
parser가 complete root value를 만든다. Lexical pass는 root `schemaVersion` numeric token spelling도
보존해 fraction/exponent 없는 integer인지 검사한다. 따라서 `2.0`, `2e0`와 JavaScript number conversion이
`2`로 정밀도 손실되는 `2.0000000000000001`을 current version으로 받아들이지 않는다. Malformed JSON,
duplicate key, invalid UTF-8와 invalid package는 schema-version diagnostic으로 다시 분류하지 않는다.

## Version-first detection

JSON parse 뒤에는 exact schema field set을 검사하기 전에 root object와 `schemaVersion` envelope만
검사한다. Current validator의 unknown-field 검사를 먼저 실행하지 않는다.

| Input | Classification | Required behavior |
| --- | --- | --- |
| Root가 object가 아님 | invalid document | Fail before version-specific validation |
| `schemaVersion` missing | version missing | `GARAK_PROJECT_VERSION_MISSING` |
| Wrong JSON type, non-integer token spelling, non-safe integer 또는 precision-loss token | version invalid | `GARAK_PROJECT_VERSION_INVALID` |
| Safe integer `< 1` | too old | `GARAK_PROJECT_VERSION_TOO_OLD`, fail closed |
| Safe integer `1` | supported legacy | Exact v1 validation, then migration required |
| Safe integer `2` | current | Exact v2 validation, no migration required |
| Safe integer `> 2` | too new | `GARAK_PROJECT_VERSION_TOO_NEW`, fail closed |

Too-new document의 unknown field를 v2 unknown-field로 보고하거나 current shape로 추측하지 않는다.
Too-old와 too-new input은 validate/inspect/compile/export/migrate에서 source mutation과 output creation 0을
보장한다.

## Exact version validators

Envelope classification 뒤 선택된 validator 하나만 실행한다.

- V1 validator는 exact eight root keys, string `template: "garak.gain-v1"`와 exact Gain defaults를
  요구한다.
- V2 validator는 exact eight root keys, exact structured
  `template: { "id": "garak.gain", "version": 1 }`와 exact Gain defaults를 요구한다.
- 두 validator는 Product ID, metadata, product version, Windows name, category와 Gain range의 common
  helper를 공유할 수 있지만 version shape를 union 또는 fallback으로 숨기지 않는다.
- Unknown/missing/duplicate field, wrong type, invalid UUID/string/version/category/template/default는 해당
  version의 validation failure다.
- Invalid source를 trim, clamp, UUID generation, field deletion 또는 default substitution으로 수리하지
  않는다.

## Canonical status and model boundary

Successful load는 current canonical `ProductProject`와 별도 `ProjectSchemaStatus`를 반환한다. 최소 status
정보는 다음과 같다.

- `sourceSchemaVersion`
- `currentSchemaVersion`
- `migrationRequired`
- 적용할 exact ordered step ID

Schema status, source path, raw source revision과 transaction metadata는 product semantic model의 field가
아니다. Canonical `ProductProject`와 versioned source model에는 filesystem path가 없다.
`LoadedProductProject`는 lexical `sourceDirectory`와 resolved `physicalSourceDirectory`를 가지고, document
snapshot과 compile/export operation option도 provenance를 semantic model 밖에서 별도로 운반한다.
Downstream compiler/export에는 source representation union이 아니라 schema v2 canonical model만 전달한다.

## Sequential migration chain

Initial chain은 exact one step이다.

```text
project-schema-1-to-2: validated v1 → exact v2
```

Step contract:

- Pure, synchronous, deterministic function
- Validated source version과 exact next target version 명시
- Source object mutation 없음
- Filesystem, process environment, CWD, locale, time, random, machine/user와 output path 의존 없음
- Product ID, metadata, product version, category, default와 template meaning 보존
- 새 exact target value를 반환하고 target validator로 재검증

Chain은 version을 한 단계씩 증가시키며 빠진 step이나 target mismatch에서 즉시 실패한다. Migration
failure는 마지막 valid canonical object로 fallback하지 않는다. Current v2 input은 step을 실행하지 않고
current validator 결과를 사용한다. General registry, dynamic migration plugin과 version jump는 현재
요구가 아니므로 추가하지 않는다.

## Identity and semantic invariants

Migration 전후 다음 불변식을 비교한다.

- Source/target Product ID exact equality
- Processor/Controller FUID exact equality
- Gain `1001`과 Bypass `1002` Parameter ID exact equality
- Vendor, name, product version와 category equality
- Gain default equality; `-0`은 product meaning을 바꾸지 않는 canonical `+0`으로만 normalize
- V1 `garak.gain-v1`과 v2 `{ id: "garak.gain", version: 1 }`의 template semantic equality

V1/v2 counterpart compile은 exact same `GARAKCPD` v1 bytes/hash를 만들어야 한다. 같은 configuration의
export는 Runtime, moduleinfo identity/metadata, bundle inventory와 validator behavior가 같아야 한다.
Migration 때문에 Product ID/FUID를 재발급하거나 Parameter ID를 remap하지 않는다.

`GARAKCPD` v1과 `GARAKPST` v1의 version/layout은 project schema와 독립이다. Compiled-data mismatch와
Runtime/preset/DAW/plugin state migration/rebuild/reject 정책은 Phase 2C 전까지 이 engine에 넣지 않는다.

## Read operations and Studio boundary

| Operation | v1 behavior | v2 behavior | Source mutation |
| --- | --- | --- | --- |
| Validate/inspect | Validate then memory-migrate | Validate current | 없음 |
| Compile/export | Memory-migrate then canonical path | Canonical path | 없음 |
| Studio open | Open canonical memory document with migration-required status | Open current document | 없음 |
| Migration status | Report exact required step | Report current/no-op | 없음 |
| Migration dry-run | Compute/report canonical result | Report no-op | 없음 |
| Ordinary Studio save | Stable migration-required refusal | Existing atomic v2 save | v1은 없음 |

Renderer는 migration path, physical mutation path 또는 raw filesystem capability를 받지 않는다. Studio의
legacy notice/confirmation, backup/restore, in-place publication, crash recovery와 durable multi-session UX는
Phase 2B다.

## Headless CLI contract

```text
pnpm product:migration-status --project <path> [--json]

pnpm product:migrate --project <legacy-path> --to latest --dry-run [--json]

pnpm product:migrate --project <legacy-path> --to latest \
  --output <new-project-path> [--force] [--json]
```

- `--to`는 exact `latest`만 허용한다.
- `--dry-run`과 `--output` mode는 상호 배타적이다.
- `--force`는 actual output mode에서만 허용한다.
- `--in-place` option은 존재하지 않는다.
- Output은 exact `.garak` directory이고 source와 distinct해야 한다.
- Lexical/physical resolved path, Windows case fold, ancestor/descendant overlap과 reparse alias를 검사한다.
  Migration output의 parent는 물리적으로 존재해야 하며 parent real path에 output leaf를 붙여
  비교한다. `--force`도 same/overlapping source를 허용하지 않는다.
- 아직 없는 compile output/export final bundle path는 nearest existing ancestor의 real path에 나머지
  leaf를 붙인 prospective physical path로 해석한다. Compile output은 source와, export bundle은 source와
  existing immutable prebuilt artifact root 모두와 비교해 alias overlap을 거부한다.
- Current v2 dry-run은 no-op report로 성공한다.
- Current v2 actual migrate는 `migration not required`로 거부해 같은 Product ID clone을 만들지 않는다.
- Default stdout은 bounded human-readable summary이고 `--json`은 exact one structured JSON report다.

Migration report는 최소한 다음 정보를 포함한다.

- Source/target schema version과 ordered step IDs
- Source/target Product ID
- Processor/Controller FUID before/after
- `identityChanged`, `productSemanticsChanged`
- `sourceModified`, `outputWritten`, `dryRun`
- Canonical v2 SHA-256
- Operation 결과로서의 output path

Output path는 report/transaction metadata이며 canonical product contract에는 포함하지 않는다.

## Deterministic canonical result

Migration은 [Editable Project Schema v2](editable-project-schema-v2.md)의 exact serializer를 사용한다.
같은 valid v1 input은 source timestamp, original whitespace/key order, absolute path, output, CWD, machine와
user에 관계없이 exact same v2 bytes와 SHA-256을 만든다.

Repeated load/migration과 v2 canonical parse/serialize는 idempotent해야 한다. Canonical hash는 v2 output
bytes의 uppercase SHA-256이며 raw legacy source revision과 별도다.

## Source immutability

Migration status, dry-run, read operations와 actual distinct-output migration은 source tree를 변경하지
않는다. Success와 failure 모두에서 source의 다음 evidence가 동일해야 한다.

- File inventory와 entry type
- Exact bytes와 size
- Last-write metadata

Windows access time처럼 read 자체로 바뀔 수 있는 metadata는 보존 oracle로 사용하지 않는다. Source를
stage, backup, rename, chmod 또는 touch하지 않는다.

## Atomic explicit-output publication

Actual migration은 모든 source parse/validation, pure migration, target validation과 serialization을
output mutation 전에 완료한다.

1. Source와 output의 physical/path separation을 검증한다.
2. Output sibling에 owned stage directory를 만든다.
3. Exact canonical v2 `product.json`을 쓰고 current loader로 stage를 재검증한다.
4. Existing output은 기본 거부한다.
5. `--force`일 때만 prior output을 owned backup으로 이동한다.
6. Stage→final rename을 publication commit point로 사용한다.
7. Commit 전 failure는 stage를 제거하고 prior output을 보존/rollback한다.
8. Commit 후 cleanup failure는 successful publication을 되돌리지 않고 typed owned-cleanup diagnostic과
   remediation을 반환한다.

Failure는 partial final output을 남기지 않는다. Rollback 자체가 실패하면 primary publication failure와
rollback failure를 함께 보존하고 arbitrary path cleanup을 시도하지 않는다.

## Diagnostics and failure behavior

- User/input failure는 non-zero result, stable code, project-relative field path와 bounded message를
  제공한다.
- 일반 failure에 stack trace를 기본 노출하지 않는다.
- Future/too-old/malformed input은 migration step을 실행하지 않고 output을 만들지 않는다.
- Failed migration 결과를 current project, default project 또는 prior cached document로 공개하지 않는다.
- Unknown field ignore, dual parser fallback와 automatic best-effort conversion을 허용하지 않는다.
- Existing valid compiled/export/project output은 모든 pre-commit failure에서 보존한다.

## Validation requirements

- Exact v1/v2 Warm/Bright fixtures와 malformed/old/future fixtures
- Missing, duplicate, wrong-type, fraction/exponent spelling, precision-loss, non-safe, too-old와 too-new schema
  version cases
- Version-first classification before unknown-field validation
- Pure step determinism, source-object immutability, target revalidation와 idempotence
- Source bytes/inventory/size/last-write immutability on success and every failure
- Dry-run, explicit output, same/overlap rejection, current no-op와 `--force` transaction failures
- Product ID/FUID/Parameter ID/template/default semantic invariants
- Exact v1/v2 `GARAKCPD` v1 byte/hash parity
- Debug/Release Windows Runtime/moduleinfo/export/official Validator parity
- Existing Product Compiler, Studio, Native와 Phase 0–1 regression gates

같은 Product ID의 v1/v2 counterpart는 parity pair로 직접 비교하고 일반 batch collision validator에 함께
넣지 않는다.

## Phase boundary

Phase 2A는 migration core, explicit-output CLI, Studio legacy no-rewrite/save-refusal와 Windows parity를
완성한다. Phase 2B는 Studio migration publication, backup/recovery와 durable persistence UX를 맡는다.
Phase 2C는 compiled product와 plug-in/preset/DAW state compatibility policy를 맡는다.

Phase 2A PASS는 Phase 2 전체 또는 macOS VST3/Universal, AU, DAW, signing/notarization, installer와
commercial release readiness를 의미하지 않는다.

구현과 mandatory gate의 실제 PASS evidence는
[Phase 2A Project Migration Validation](../status/phase-2a-project-migration-validation.md)이 단일 권위를
가진다.
