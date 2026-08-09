# ADR 0007 — Editable Project Schema Migration Policy

- Status: Accepted
- Date: 2026-08-12
- Scope: Phase 2A editable `.garak` source project schema evolution and migration
- 관련 문서: [ADR 0005](0005-windows-v0x-prebuilt-product-runtime.md), [ADR 0006](0006-studio-product-workflow-boundary.md), [Editable Project Schema v2](../architecture/editable-project-schema-v2.md), [Project Migration Engine](../architecture/project-migration-engine.md), [Minimal Garak Product Project](../architecture/minimal-garak-product-project.md), [ExecPlan 0007](../../plans/0007-phase-2a-editable-project-schema-migration.md)

## Context

Phase 1C.1과 Phase 1C.2는 editable schema v1의 minimal `.garak` directory project를 Windows
white-label VST3로 compile/export하고 Studio에서 create/open/save/export하는 경로를 완성했다. v1은
Product ID, product metadata, `garak.gain-v1` template와 Gain default를 보존하는 첫 persistent source
contract다.

현재 v1의 flat template string은 template identity와 template contract version을 한 값에 결합한다.
Project schema 자체의 version과 template version을 독립적으로 발전시키려면 current source schema가 이
두 개념을 분리해야 한다. 동시에 이미 존재하는 v1 project는 strict하게 읽고 같은 product 의미로
변환할 수 있어야 한다.

지원되는 legacy source를 reader 전체에 union과 fallback으로 남기거나 open 시 자동으로 덮어쓰면
canonical implementation이 분기하고 사용자 원본을 명시적 동의 없이 바꾸게 된다. 반대로 v1을
obsolete internal API처럼 제거하면 Garak이 소유한 persistent project contract를 훼손한다. Editable
source migration은 compiled product data와 plug-in/DAW state migration과도 별도 version boundary여야
한다.

## Decision

### Current schema와 legacy 범위

- Editable project schema v2를 current schema와 canonical writer model로 정한다.
- v2는 `template: { "id": "garak.gain", "version": 1 }`을 사용한다. 나머지 v1 product
  field와 의미는 유지한다.
- Schema v1은 supported legacy persistent input이다. v1 지원은 obsolete compiler/API fallback 또는
  무기한 historical-format 지원 약속이 아니다.
- Product Compiler downstream은 current v2 canonical model만 소비한다. v1/v2 source union을 compile,
  export 또는 Studio domain 전체에 누출하지 않는다.

### Version-first strict reading

Reader는 package inventory, byte bound, strict UTF-8와 BOM을 검사하고 strict JSON duplicate-key
detection과 parsing을 마친 뒤 root `schemaVersion` envelope를 다른 schema field보다 먼저 분류한다.

- Missing version과 invalid type/non-integer-token/non-safe-integer/precision-loss version은 서로 구분되는
  invalid-version diagnostic이다. Raw token은 fraction/exponent 없는 integer spelling이어야 하며 `2.0`,
  `2e0`, `2.0000000000000001`을 current version `2`로 받아들이지 않는다.
- 현재 최소 지원 version `1`보다 작은 valid lexical safe integer는 too-old로 거부한다. 따라서 `0`과 음수도
  too-old다.
- Current version `2`보다 큰 valid lexical safe integer는 too-new로 fail closed한다.
- Version `1`과 `2`만 각자의 exact version-specific validator로 전달한다.
- 각 validator는 exact root/nested key, type와 value contract를 적용한다. Unknown field, duplicate key,
  다른 version의 template representation과 추측 기반 forward compatibility를 허용하지 않는다.

이 순서는 future schema의 새 field가 v1/v2 unknown-field 오류로 잘못 분류되는 일을 막는다.

### Pure sequential migration

초기 migration registry는 exact step `project-schema-1-to-2` 하나만 소유한다.

- Step은 validated v1 value를 새 v2 value로 변환하는 pure, synchronous, deterministic function이다.
- Filesystem, environment, clock, locale, random, machine, user와 output path에 의존하지 않고 source
  object를 mutate하지 않는다.
- Step 결과는 exact v2 validator를 다시 통과한 뒤에만 canonical model로 공개한다.
- Migration은 인접 version을 순서대로 적용하며 version을 건너뛰거나 실패한 중간 결과를 공개하지
  않는다.
- 현재 요구에 없는 general plugin loader, arbitrary graph migrator 또는 speculative v3 registry를
  만들지 않는다.

### Source mutation과 publication

- Open, validate, inspect, compile, export, migration-status와 migration dry-run은 source를 읽기만 한다.
- Supported v1 project는 memory에서 v2로 migration해 inspect/compile/export할 수 있지만 source bytes를
  자동으로 다시 쓰지 않는다.
- Phase 2A에서 migration publication은 사용자가 지정한 distinct explicit `.garak` output에만
  허용한다. In-place option은 제공하지 않으며 `--force`도 same/overlapping source path를 허용하지
  않는다.
- Current v2 project의 dry-run은 no-op status로 성공할 수 있지만 actual migrate는 새 identity clone을
  만들지 않도록 migration-not-required로 거부한다.
- Studio가 legacy v1 project를 open하는 것은 허용하지만 ordinary Save로 v2를 조용히 덮어쓰는 것은
  stable migration-required failure로 차단한다. Confirmation, backup, recovery와 in-place publication
  UX는 Phase 2B에서 결정한다.
- Too-old, too-new 또는 invalid source는 open/save/export/migrate에서 fail closed하며 source나 output을
  변경하지 않는다.

### 보존 계약과 독립 version boundary

Migration은 다음을 byte 또는 semantic parity로 보존한다.

- Product ID와 Product ID/role에서 파생한 Processor/Controller FUID
- Gain `1001`과 Bypass `1002` numeric Parameter ID
- Vendor, name, product version, category, default와 `garak.gain` template version 1의 의미
- 같은 logical product가 만드는 deterministic `GARAKCPD` v1 bytes와 Windows export metadata

Structured source template는 compile boundary에서 기존 `garak.gain-v1`/compiled template enum `1`로
명시적으로 낮춘다. Phase 2A는 `GARAKCPD` v1 layout/version, `GARAKPST` v1, Product Runtime binary,
VST3 factory/moduleinfo contract 또는 native build strategy를 바꾸지 않는다. Compiled-data와
plug-in/preset/DAW state compatibility 정책은 Phase 2C의 별도 결정이다.

### Ownership

Product Compiler가 version detection, exact v1/v2 validator, migration step, canonical v2 serializer,
migration report와 atomic explicit-output transaction을 소유한다. CLI와 Electron main은 같은 callable
first-party workflow에 위임한다. Renderer 또는 Electron main에 별도 schema validator나 migration을
구현하지 않는다.

## Alternatives Considered

### Open 또는 Save 때 v1을 자동으로 v2로 덮어쓰기

사용자 확인과 recovery 없이 persistent source를 바꾸며 read-only open 의미를 깨뜨린다. Phase 2A는
memory migration과 explicit distinct output만 허용하고 in-place publication은 Phase 2B로 미룬다.

### v1과 v2 union을 compiler/export 전체에서 계속 처리

모든 downstream operation에 version branch와 dual serialization 의미를 전파한다. Source boundary에서
v1을 v2로 변환하고 canonical path 하나만 유지한다.

### Unknown/future field를 무시하고 current shape로 읽기

새 schema의 의미를 오래된 reader가 잘못 해석해 identity나 sound contract를 손상할 수 있다.
Version-first detection과 exact validator로 fail closed한다.

### Editable schema v2와 함께 GARAKCPD/GARAKPST v2 도입

Source의 template representation만 진화시키는 데 runtime binary/state format 변경은 필요하지 않다.
서로 독립된 version contract를 결합하면 불필요한 Runtime와 DAW-state migration을 만든다.

### CLI에 in-place migration 제공

Backup, restore, crash recovery와 사용자 confirmation 정책이 없는 상태에서 source 손상 위험을 만든다.
Phase 2A는 distinct explicit output만 제공한다.

## Consequences

긍정적 결과:

- Legacy v1 project를 보존하면서 compiler/export 내부는 current v2 model 하나만 유지한다.
- Future/unsupported schema를 정확히 분류하고 잘못된 current-shape interpretation을 막는다.
- Migration 결과가 deterministic fixture와 canonical hash로 재현 가능하다.
- Source schema evolution이 Product ID, FUID, Parameter ID, compiled bytes와 product behavior를 바꾸지
  않는다.
- Studio와 CLI가 하나의 validation/migration/serialization implementation을 사용한다.

비용과 위험:

- Version envelope와 exact v1/v2 validator를 분리하고 모든 loader path가 이 boundary를 통과하는지
  검증해야 한다.
- Legacy document session은 current Save를 사용할 수 없으므로 Phase 2B 전까지 explicit headless output
  migration이 필요하다.
- Same Product ID를 가진 v1/v2 parity fixture는 일반 batch collision validation에 함께 넣을 수 없다.
- Atomic explicit-output transaction은 path alias, existing output, rollback과 post-commit cleanup failure를
  설명 가능한 diagnostic으로 다뤄야 한다.

## Phase and release boundary

Phase 2A는 migration core, headless CLI, Studio legacy no-rewrite/save-refusal boundary와 Windows
compile/export parity까지만 책임진다. Phase 2B는 Studio migration confirmation, backup, recovery,
autosave와 durable persistence UX를 맡는다. Phase 2C는 compiled product와 plug-in/preset/DAW state
compatibility를 맡는다.

이 ADR의 `Accepted`는 source migration 정책의 승인 범위다. Phase 2A 구현, fixture, Debug/Release export,
validator와 regression gate는 별도의
[Phase 2A validation](../status/phase-2a-project-migration-validation.md)에서 **PASS**로 확인했다. 이
구현 PASS가 ADR의 범위를 compiled/state migration으로 넓히지는 않는다. Phase 2 전체,
macOS VST3/Universal, AU, signing/notarization, installer와 commercial release gate는 완료되지 않았다.

이 결정은 ADR 0005의 Windows x64 v0.x prebuilt Runtime 범위와 ADR 0006의 Studio security/process
boundary를 유지하며, ADR 0003의 Proposed cross-platform Runtime 전략을 Accepted로 바꾸지 않는다.
