# ExecPlan 0007 — Phase 2A Editable Project Schema Evolution and Deterministic Migration Engine

- Status: Complete
- Started: 2026-08-12
- Updated: 2026-08-12
- Owner: Product Compiler / Project Model

## 목적

출시 가능한 제품 제작 경로가 사용하는 editable `.garak` project를 schema version별로 strict하게
읽고, 지원되는 legacy schema를 순차적이고 결정론적인 migration으로 current canonical schema에
변환하는 기반을 완성한다.

Phase 2A의 end-to-end 결과는 다음 흐름이다.

```text
Legacy Garak Project schema v1
  → safe version detection
  → exact v1 validation
  → pure v1-to-v2 migration
  → exact current schema v2 validation
  → canonical v2 serialization
  → unchanged Product ID / VST3 FUID / Parameter ID / product meaning
  → unchanged GARAKCPD v1 bytes
  → unchanged Windows white-label VST3 behavior
```

Phase 2A는 migration core와 headless CLI를 구현하고, Studio에는 legacy open/current-memory status와
no-rewrite/save-refusal boundary만 추가한다. Migration 안내, confirmation, backup/recovery와 in-place
publication UX는 Phase 2B에 둔다. Compiled product data와 plug-in/DAW state의 compatibility 정책은
Phase 2C에 둔다.

## 사용자 가치

아티스트가 Garak의 이전 editable project로 만든 제품을 새 Garak에서 열고 검증·compile·export해도
제품 identity와 sound/default 의미를 잃지 않는다. Migration은 source를 조용히 덮어쓰지 않으며,
사용자가 명시한 별도 output에만 current project를 생성한다. Future/unsupported schema는 추측하지 않고
안전하게 거부한다.

## 시작 저장소 상태

- Branch: `master`
- 시작 commit: `8d1930c8f07a94bcc441d54e91d9a40b84b5b505`
- Subject: `feat: complete Garak phase 1C.2 Studio product workflow`
- 시작 working tree: clean
- Remote: 없음
- 이 plan의 첫 변경 전 staged/unstaged/untracked path: 0
- 사용자 지시에 따라 Phase 1C.2를 위 commit으로 먼저 checkpoint했다.
- 이번 Phase 2A 작업에서는 commit, amend, rebase 또는 branch 변경을 하지 않는다.

### Toolchain과 검증 기준선

- Windows `10.0.26200`, x64
- Node.js `24.19.0`
- pnpm `11.16.0`
- Visual Studio `18.7.11925.98`, MSVC `19.51.36248` x64
- 이전 native cache 기준 CMake `4.3.1-msvc1`, Ninja `1.13.2`
- 일반 PowerShell PATH에는 `cl`, CMake, Ninja와 clang 도구가 없으므로 Native gate는 Visual Studio x64
  Developer Command 환경에서 실행한다.
- Product Compiler built-in test baseline: 52
- Studio built-in test baseline: 10
- Product Runtime Debug/Release CTest baseline: 각각 7/7
- Studio direct dependency: runtime 2 + development 14 = 16
- Product Compiler runtime third-party dependency: 0

### VST3 SDK 기준선

- Root gitlink/tag: `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`, `v3.8.0_build_66`
- Nested pins:
  - `base`: `3d2e82f8e6bff59c1d8b7a27491a29c2286b5206`
  - `cmake`: `de6e54eeaaab35b7145f5c32c279b5e892146e04`
  - `doc`: `6d4737c9e70750056e731d88d49aa06eefc8a1a4`
  - `pluginterfaces`: `31d6eeba6daaa3e2a8bfbe3e7a90ca0b7fbfbc1c`
  - `public.sdk`: `a3911a4615dabbfdfd9d181ee26b05c70c289a95`
  - `tutorials`: `33b73dfbb87f3fde3bce8c0a10cae934dc66ad34`
  - `vstgui4`: `76823bdbe286e4bdb9f79ab8986af5ce7202336c`
- SDK와 nested checkout은 모두 detached/exact/clean이다.

## 시작 시 project schema v1

Phase 2A 시작 시 두 reference project는 exact v1 shape를 사용했다. 이 섹션은 implementation
전 baseline을 기록하며 완료 후 current schema는 v2다.

```json
{
  "schemaVersion": 1,
  "productId": "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
  "vendor": "Garak Test Artist",
  "name": "Artist Gain Warm",
  "version": "0.1.0",
  "category": "Fx",
  "template": "garak.gain-v1",
  "defaults": {
    "gainDb": -6.0
  }
}
```

- Root key는 정확히 8개다.
- `template`은 exact string `garak.gain-v1`이다.
- `defaults`는 exact `gainDb` 하나다.
- `ProductProject`, document/inspection DTO와 Studio response guard는 schema 1과 string template에 결합돼
  있었다.
- 시작 시 validator는 root exact-key 검사를 schemaVersion 분류보다 먼저 수행해 future schema의 새
  field를 `PROJECT_VERSION_TOO_NEW`가 아닌 v1 unknown field로 잘못 분류할 수 있었다.
- Strict JSON lexical scanner는 JSON string escape를 decode한 뒤 모든 object scope의 duplicate key를
  검출했고 v2에서도 재사용했다.

## 시작 시 `.garak` physical form

Phase 2A 시작 시 `.garak` project는 single-file container가 아닌 unpacked directory package였고,
Phase 2A는 이 physical form을 변경하지 않았다.

```text
<name>.garak/
└─ product.json
```

- Directory leaf는 case-sensitive exact `.garak` suffix를 가진다.
- Inventory는 physical ordinary file `product.json` 하나로 정확히 제한된다.
- Symlink/reparse point, extra file/directory, case variant filename을 거부한다.
- `product.json`은 1..65536 bytes, strict UTF-8, BOM 없음이다.
- 완료 후에도 동일한 physical form을 유지한다.

## 시작 시 Product Compiler와 Studio project boundary

아래는 Phase 2A implementation 전 boundary를 기록한다.

- `parseStrictJson`은 malformed JSON과 duplicate key를 구분했다.
- `loadProductProjectSource`는 physical package/UTF-8을 검증한 뒤 schema 1 validator를 호출했다.
- `validate`, `inspect`, `compile`, `export`와 Studio callable facade는 같은 loader를 공유했다.
- Identity derivation은 canonical Product ID와 role만 입력으로 사용했다.
- `GARAKCPD` v1 compiler/export는 `ProductProject`를 입력으로 사용하고 Gain `1001`, Bypass `1002`와
  compiled template enum `1`을 emit했다.
- Project create/save는 whole-directory stage → validate → backup → final rename → rollback transaction을
  사용했다.
- Electron main은 callable compiler API를 사용하고 physical path/document/output/cleanup capability를
  소유했다. Renderer는 filesystem/raw IPC 권한이 없었다.
- 시작 시 save는 open source revision을 기준으로 canonical project를 다시 쓰므로, legacy v1을
  current v2로 자동 덮어쓰지 않도록 Phase 2A에서 명시적으로 차단해야 했다.

## Phase 2 구조

### Phase 2A — 이번 plan

Editable Project Schema Evolution and Deterministic Migration Engine:

- version detection
- strict v1/v2 validator
- canonical v2 model/writer
- pure v1 → v2 migration
- source-preserving headless migration CLI
- identity, compiled data와 Windows VST3 export parity

### Phase 2B — 비범위, 정확한 다음 단계

Studio Migration, Backup, Recovery and Durable Persistence UX:

- migration 안내/확인
- backup과 in-place publication
- 실패 시 recovery/restore
- autosave/crash recovery와 durable multi-session UX

### Phase 2C — 비범위

Compiled Product and Plug-in State Compatibility Policy:

- compiled-data mismatch의 migrate/rebuild/reject 정책
- Product Runtime upgrade policy
- preset/DAW/plugin state compatibility와 migration

Phase 2A가 PASS해도 Phase 2 전체는 미완료다. macOS VST3/Universal과 AU는 계속 첫 상용 배포 전
cross-platform release gate다.

## 범위

1. Project schema version envelope와 stable diagnostic
2. Separate exact ProjectSchemaV1 / ProjectSchemaV2 validation
3. Current canonical v2 domain model
4. Pure deterministic v1 → v2 migration step/chain
5. Canonical v2 serializer
6. `migration-status`와 `migrate` headless CLI/API
7. Dry-run과 explicit distinct output migration
8. Atomic migration output, force/rollback/cleanup behavior
9. Legacy v1 memory migration for validate/inspect/compile/export
10. Legacy v1 open without source rewrite and legacy save refusal
11. Warm/Bright legacy/current fixtures and exact literal oracles
12. v1/v2 identity, compiled bytes, moduleinfo, Runtime와 VST3 validation parity
13. Product Compiler, Studio와 Native regressions
14. ADR 0007, architecture/status/public documentation

## 절대 비범위

- Studio migration dialog/banner/button
- Studio backup/recovery UI
- Autosave, crash recovery와 undo/redo
- In-place project migration 또는 open 시 automatic source rewrite
- Single-file `.garak`, ZIP/archive/container 변경
- `GARAKCPD` v2 또는 compiled-product-data migration
- `GARAKPST` v2, DAW/plugin state migration 또는 Runtime binary migration
- VST3 parameter migration, ID remapping 또는 tombstone system 구현
- DSP graph, arbitrary node, macro, compressor, saturation, BLOOM
- Custom plugin editor, Skia, CanvasKit, Yoga, XYFlow 또는 VSTGUI
- JUCE, MIDI, sidechain, instrument, preset browser 또는 external asset
- Installer, updater, macOS VST3, AU, signing 또는 notarization
- Cloud, telemetry, authentication, DRM 또는 marketplace
- Studio dependency 또는 Product Compiler runtime dependency 추가
- Phase 2B/2C 선행 구현
- Root `LICENSE` 생성

## 전제와 제약

- Root/studio/native/VST3 adapter AGENTS와 Accepted ADR 0001/0002/0004/0005/0006을 따른다.
- ADR 0003은 계속 Proposed다.
- ADR 0007은 editable source project migration에만 Accepted다.
- v1은 이미 보존해야 하는 supported legacy persistent schema다. v1 지원은 obsolete internal API
  compatibility shim이 아니다.
- Source project schema와 `GARAKCPD`/`GARAKPST` contract version은 서로 독립이다.
- Product ID, derived FUID와 Parameter ID를 migration 때문에 다시 생성하거나 재해석하지 않는다.
- 새 dependency를 추가하지 않고 Node built-in과 기존 first-party utility를 사용한다.
- Runtime/native/SDK source 수정은 필요하지 않으며 최종 diff 0을 목표로 한다.

## 설계 결정

### Current editable schema v2

현재 actual v1이 지시문의 예상과 일치하므로 대체 evolution을 만들지 않는다. v2는 template identity와
template contract version만 분리한다.

```json
{
  "schemaVersion": 2,
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
    "gainDb": -6.0
  }
}
```

- v2 root exact keys는 v1과 같다.
- `template`은 exact object이며 key는 `id`, `version` 두 개다.
- `id`는 `garak.gain`, version은 integer `1`이다.
- `defaults`는 root sibling으로 유지한다.
- Internal `ProductProject`와 writer는 v2만 표현한다. v1 string/object union을 downstream에 누출하지
  않는다.

### Version detection

```text
physical bytes
  → size / UTF-8 / BOM / package inventory
  → strict JSON lexical duplicate detection + JSON parse
  → root object + schemaVersion envelope only
  → exact lexical integer token + safe integer version classification
  → exact version-specific validator
```

- Malformed JSON은 JSON syntax diagnostic으로 유지한다.
- Missing version은 명시적 version-missing diagnostic이다.
- Non-number, fraction/exponent numeric spelling, non-safe integer, precision-loss token, negative/zero는
  추측하지 않는다. `2.0`, `2e0`, `2.0000000000000001`도 exact schema version `2`가 아니다.
- `0`과 현재 최소 지원 version보다 작은 값은 `PROJECT_VERSION_TOO_OLD` 동등 diagnostic이다.
- `> 2`는 document shape를 current validator로 읽기 전에 `PROJECT_VERSION_TOO_NEW`로 fail closed한다.
- Version detection은 unknown field 검사보다 먼저 수행한다.

### Version별 strict validation

- v1 validator는 exact string template만 허용하고 v2 object를 거부한다.
- v2 validator는 exact structured template만 허용하고 v1 string을 거부한다.
- 각 validator는 자기 version의 exact root/nested key, type, UUID, display string, Windows name,
  semantic version, category, template와 Gain contract를 검증한다.
- 공통 field validation helper는 재사용하되 version shape를 union/fallback으로 숨기지 않는다.

### Canonical current model

```text
Versioned source value
  → exact version validator
  → migration chain if needed
  → canonical ProductProject schema v2
  → identity / compile / export
```

- Canonical model은 Studio/Electron type과 filesystem path를 product semantics로 포함하지 않는다.
- Canonical `ProductProject`와 versioned source model에는 filesystem path를 두지 않는다.
  `LoadedProductProject`, document snapshot과 compile/export operation option이 mutation/collision과
  diagnostic provenance를 별도로 운반한다.
- Loader는 canonical project와 별도의 `ProjectSchemaStatus`를 반환한다.
- Status는 source/current version, migrationRequired와 exact step ID를 포함한다.

### Migration chain

Initial registry는 exact one step만 가진다.

```text
project-schema-1-to-2: v1 → v2
```

- Step은 pure, synchronous, deterministic, filesystem/environment/time/random 비의존 함수다.
- Validated v1 input을 새 exact v2 value로 변환하고 source object를 mutate하지 않는다.
- Step 결과를 v2 validator에 다시 넣은 뒤에만 canonical model로 공개한다.
- Version을 건너뛰지 않는다. v3/general registry/plugin loader를 미리 만들지 않는다.

### Compiled/runtime lowering

Project source template `{ id: "garak.gain", version: 1 }`은 기존 compiled template contract
`garak.gain-v1`/enum `1`로 explicit하게 낮춘다.

- `GARAKCPD` major/minor `1.0`과 exact layout을 바꾸지 않는다.
- `GARAKPST` v1을 바꾸지 않는다.
- Inspector의 current native contract argument `garak.gain-v1`을 유지한다.
- Native C++, VST3 factory, moduleinfo structure와 Runtime binary를 바꾸지 않는다.

### Deterministic canonical serialization

Canonical v2 bytes는 다음을 고정한다.

- UTF-8 without BOM
- LF, 2-space indentation, final newline
- Root property order: schemaVersion, productId, vendor, name, version, category, template, defaults
- Template property order: id, version
- Defaults property order: gainDb
- Canonical lowercase UUID와 semantic version
- Finite Gain, negative zero normalized to positive zero
- Timestamp/path/machine/user/random/build 정보 없음

### Source immutability와 Studio boundary

- `validate`, `inspect`, `compile`, `export`, `migration-status`와 dry-run은 source를 읽기만 한다.
- v1 open은 canonical v2 memory model을 반환할 수 있지만 source bytes를 수정하지 않는다.
- Phase 2A의 existing Studio Save는 legacy v1 source에서 stable `migration required` diagnostic으로
  실패한다. Silent in-place v2 rewrite는 금지한다.
- v2 create/save/open/export는 기존 Phase 1C.2 behavior를 유지한다.
- Future/too-old project는 open/save/export/migrate 모두 fail closed한다.

### Migration CLI

```text
pnpm product:migration-status --project <path> [--json]

pnpm product:migrate --project <legacy-path> --to latest --dry-run [--json]

pnpm product:migrate --project <legacy-path> --to latest \
  --output <new-project-path> [--force] [--json]
```

- `--to`는 exact `latest`만 허용한다.
- Dry-run과 output mode는 상호 배타적이다.
- `--force`는 actual output mode에서만 허용한다.
- Output은 exact `.garak` directory이며 source와 resolved/case-folded same path 또는 overlap이면 거부한다.
- `--in-place`는 존재하지 않는다.
- Current v2 dry-run은 no-op report로 성공한다.
- Current v2 actual migrate는 migration-not-required로 거부해 duplicate identity clone을 만들지 않는다.
- Default stdout은 bounded human-readable summary, `--json`은 exact one JSON report다.

Migration report 최소 필드:

- sourceSchemaVersion / targetSchemaVersion
- steps
- sourceProductId / targetProductId
- processorFuidBefore / processorFuidAfter
- controllerFuidBefore / controllerFuidAfter
- identityChanged / productSemanticsChanged
- sourceModified / outputWritten / dryRun
- canonicalSha256
- output path는 operation 결과로만 표현하고 product contract에는 포함하지 않음

### Atomic explicit output

- 모든 parse/validation/migration/serialization을 output 생성 전에 완료한다.
- Sibling stage directory에 exact v2 package를 쓰고 current loader로 재검증한다.
- Existing output은 기본 거부하고 `--force`일 때만 transaction backup을 사용한다.
- Publication failure는 prior output rollback, no partial final output을 보장한다.
- Post-commit cleanup failure는 successful publication + typed owned cleanup diagnostic이다.
- Source tree는 success/failure 모든 경로에서 unchanged다.

## Reference fixture 계획

기존 root Warm/Bright fixture는 current v2로 갱신한다. Original v1 bytes는 별도 legacy path에 그대로
보존한다.

```text
examples/products/artist-gain-warm.garak/             # current v2
examples/products/artist-gain-bright.garak/           # current v2
examples/products/legacy/v1/artist-gain-warm.garak/   # exact legacy v1
examples/products/legacy/v1/artist-gain-bright.garak/ # exact legacy v1
```

동일 Product ID pair는 일반 batch collision validator에 함께 넣지 않고 parity fixture로만 비교한다.

### Normative literal

| Product | Product ID | Processor FUID | Controller FUID | Gain / Bypass ID | GARAKCPD v1 |
| --- | --- | --- | --- | --- | --- |
| Warm | `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` | `3BA93DD6A062C97D89EC78F3652F83C4` | `00DD9000A50F7F28F4AE084CD29C4330` | `1001` / `1002` | 177 bytes, `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` |
| Bright | `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357` | `FCB1FDAED3D981A2AE3AE5A20898C449` | `32D933DFBD3C8110E014829EF5D62EA3` | `1001` / `1002` | 179 bytes, `ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52` |

Canonical v2 source SHA-256는 Warm
`3F27ED552AEC8CAE3C7D34C5AE1F4821582E1DAC3E323B353A845C8891734C33`, Bright
`B50A360FD6862BFD0364D4BE95365D4B48E0AF34EE81084626EBE5F791C5932B`로 independent literal에 고정했다.

## Future/old/failure behavior

- Schema 3 fixture는 envelope detection에 성공하고 `GARAK_PROJECT_VERSION_TOO_NEW`로 실패한다.
- Schema 0 fixture는 `GARAK_PROJECT_VERSION_TOO_OLD`로 실패한다.
- Missing/duplicate/noninteger/excessive version은 각 contract diagnostic으로 실패한다.
- Future/old input은 validate/compile/export/migrate에서 source mutation 0, output 생성 0이다.
- Unknown field를 ignore하거나 latest shape로 추측하지 않는다.
- Migration failure는 partial canonical object나 partial output을 공개하지 않는다.

## 구현 단계

1. [x] Phase 1C.2를 `8d1930c` checkpoint로 commit하고 clean baseline을 확인한다.
2. [x] 필수 문서, actual schema/API, SDK, dependency와 test/evidence 기준선을 read-only 감사한다.
3. [x] 본 ExecPlan으로 v2 shape, migration chain, CLI, source immutability와 parity gate를 고정한다.
4. [x] ADR 0007과 v2/migration architecture 문서를 작성한다.
5. [x] Version detection과 exact v1/v2 validators를 분리한다.
6. [x] Canonical v2 model, pure v1→v2 step과 deterministic serializer를 구현한다.
7. [x] Existing Product Compiler/Studio boundary를 canonical v2에 맞추고 legacy silent save를 차단한다.
8. [x] Migration status/dry-run/explicit atomic output API와 CLI를 구현한다.
9. [x] Legacy/current/future/old fixtures와 unit/CLI/atomicity tests를 추가한다.
10. [x] v1/v2 exact compiled bytes와 identity parity를 검증한다.
11. [x] Debug/Release export parity, official validator와 source/build immutability evidence를 수집한다.
12. [x] Product Compiler/Studio/Native/Phase 0–1 regressions와 quality gates를 실행한다.
13. [x] README/ROADMAP/AGENTS/architecture/status와 본 plan을 실제 결과로 동기화한다.
14. [x] Repository hygiene와 독립 source/evidence/docs 감사를 수행한다.

## 변경 대상 파일

예상 생성:

- `plans/0007-phase-2a-editable-project-schema-migration.md`
- `docs/adr/0007-editable-project-schema-migration-policy.md`
- `docs/architecture/editable-project-schema-v2.md`
- `docs/architecture/project-migration-engine.md`
- `docs/status/phase-2a-project-migration-fixtures.md`
- `docs/status/phase-2a-project-migration-validation.md`
- `tools/product-compiler/src/project_migration.ts`
- `tools/product-compiler/tests/project_migration.test.ts`
- `tools/product-compiler/tests/project_migration_core.test.ts`
- `tools/product-compiler/tests/project_migration.test.ts`
- `tools/product-compiler/scripts/verify_project_migration_export_parity.ps1`
- Legacy v1 Warm/Bright fixtures와 old/future/malformed test fixtures

예상 수정:

- Product Compiler: `project_model.ts`, `validation.ts`, `project_document.ts`, `api.ts`, `cli.ts`,
  `compiled_product.ts`, `export_windows.ts`, tests/helpers, package scripts
- Studio minimum regression: shared DTO, ProductService/state/test와 template display
- Root package scripts
- `README.md`, `ROADMAP.md`, root/studio `AGENTS.md`, `docs/status/current.md`
- Architecture: minimal project, project model, system overview, module boundaries, runtime/export,
  parameter/state, identity, dependency policy, 필요 시 compiled/state/VST3 cross-link
- ADR 0003/0005/0006의 stale follow-up와 Phase 2A boundary
- Phase 1C.2 status의 정확한 후속 milestone

변경하지 않는 것이 목표:

- `native/**`와 `CMakeLists.txt`/CMake presets
- `third_party/vst3sdk/**`, `.gitmodules`와 SDK gitlink
- `GARAKCPD` v1 및 `GARAKPST` v1 binary layout
- `pnpm-lock.yaml` dependency inventory

## 검증 계획

### Product Compiler

```text
pnpm product:format:check
pnpm product:lint
pnpm product:typecheck
pnpm product:test
```

전체 test는 baseline 52를 유지하고 migration tests를 추가해 final 76/76이어야 한다.

CLI smoke:

```text
pnpm product:migration-status --project examples/products/legacy/v1/artist-gain-warm.garak --json
pnpm product:migrate --project examples/products/legacy/v1/artist-gain-warm.garak --to latest --dry-run --json
New-Item -ItemType Directory -Force out\migration | Out-Null
pnpm product:migrate --project examples/products/legacy/v1/artist-gain-warm.garak --to latest --output out/migration/artist-gain-warm.garak --force --json
pnpm product:compile --project examples/products/legacy/v1/artist-gain-warm.garak --output out/compiled/phase-2a/v1/product.garakbin --force
pnpm product:compile --project examples/products/artist-gain-warm.garak --output out/compiled/phase-2a/v2/product.garakbin --force
```

### Studio

```text
pnpm studio:format:check
pnpm studio:lint
pnpm studio:typecheck
pnpm studio:test
pnpm studio:build
pnpm --dir studio verify:product-workflow --configuration Debug
pnpm --dir studio verify:product-workflow --configuration Release
```

- 기존 10개 test를 유지한다.
- Current v2 create/save/reopen/export와 legacy v1 open/no-rewrite/save-refusal contract를 검증한다.
- Renderer Node/fs/raw IPC 경계를 다시 감사한다.

### Native와 export parity

Visual Studio x64 Developer Command 환경에서 final source로 실행한다.

```text
cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Debug
tools\product-compiler\scripts\verify_project_migration_export_parity.ps1 -Configuration Debug
ctest --preset product-runtime-debug-test --no-tests=error

cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Release
tools\product-compiler\scripts\verify_project_migration_export_parity.ps1 -Configuration Release
ctest --preset product-runtime-release-test --no-tests=error

cmake --preset product-runtime-werror --fresh
cmake --build --preset product-runtime-werror-build --clean-first
cmake --preset product-runtime-clang-tidy --fresh
cmake --build --preset product-runtime-clang-tidy-build --clean-first
```

Native first-party `.cpp`/`.hpp` 전체를 `clang-format --dry-run --Werror`로 검사한다.

Parity report는 `out/reports/phase-2a/project-migration-parity-{debug|release}.json`에 다음을 기록한다.

- Warm/Bright v1/v2 source schema와 source before/after manifest
- Product ID/FUID/Parameter ID/default/template semantics
- compiled bytes/size/hash
- Runtime, moduleinfo, bundle inventory와 hash parity
- moduleinfotool/inspector/validator child log와 exit
- prebuilt template/build tree before/after 불변
- forbidden native build command count

Release official Validator standard/extensive는 mandatory이며 filter 없이 failure/crash 0, exit 0이어야 한다.
Debug도 같은 gate로 실행한다.

### Phase regressions

- Phase 0 Native Debug/Release smoke/CTest와 Werror/tidy
- Phase 1A canonical VST3 CTest/validator
- Phase 1B runtime-strategy CTest/validator/inspection
- Phase 1C.1 no-native-build, Product Runtime CTest/validator
- Phase 1C.2 Studio lifecycle/export smoke

실제 영향과 시간에 맞춰 기존 canonical scripts/presets를 사용한다. 수행하지 않은 gate는 PASS로 세지 않고
status에 이유와 재현 명령을 남긴다.

### Repository hygiene

- `git status --short --branch`
- `git diff --check`
- tracked/untracked strict UTF-8, BOM/NUL/CR, trailing whitespace, final LF
- Markdown local link와 anchor
- migration stage/backup/orphan 0
- generated outputs ignored/nontracked
- SDK/nested exact/clean, SDK source diff 0
- Studio dependency 16, Product Compiler runtime dependency 0, lock importer parity
- Native/CMake diff 0 또는 explicit justification
- Root LICENSE 없음
- Phase 2B/2C code와 forbidden dependency/source identifier 0

## 수용 기준

### Schema

- v1 legacy source를 exact validator와 fixture로 보존한다.
- v2가 current canonical writer/schema다.
- Version-first detection이 missing/invalid/too-old/too-new를 구분한다.
- v1/v2는 exact shape만 허용하며 서로의 template representation과 unknown/duplicate field를 거부한다.

### Migration

- Pure deterministic v1→v2 step과 exact chain이 존재한다.
- Same input은 exact same canonical bytes/hash를 만든다.
- Repeated migration/no-op canonicalization이 idempotent하다.
- Source bytes와 metadata가 dry-run/output migration에서 바뀌지 않는다.
- Product ID, FUID, Parameter ID, vendor/name/version/category/default/template meaning이 보존된다.

### CLI와 persistence

- `migration-status`, dry-run, explicit output와 JSON report가 동작한다.
- In-place/same/overlap path를 거부한다.
- Output은 atomic이고 existing output/force/rollback/cleanup failure를 명시적으로 처리한다.
- Future/too-old/failure input에서 output/partial mutation이 없다.

### Compatibility

- Warm/Bright v1/v2 `GARAKCPD` bytes와 normative hash가 각각 동일하다.
- FUID와 Parameter ID가 동일하다.
- Same configuration Runtime/moduleinfo semantic structure/inventory가 parity다.
- Warm/Bright Debug/Release export와 official validator가 통과한다.
- `GARAKCPD`/`GARAKPST`/Native Runtime contract는 변경하지 않는다.

### Regression/dependency/docs

- Product Compiler baseline 52 + migration tests, final 76/76 PASS
- Studio baseline 10 + migration boundary tests, final 12/12 PASS와 lint/format/typecheck/build
- Native Debug/Release CTest, Werror, format, tidy PASS
- Studio 16 deps, Compiler runtime deps 0 유지
- ADR 0007 Accepted, Phase 2A 결과와 Phase 2B/2C 분리를 문서화
- Phase 2 전체와 macOS/AU를 완료로 표시하지 않는다.

필수 gate 하나라도 수행되지 않으면 PASS가 아니라 CONDITIONAL PASS 또는 FAIL이다.

## 리스크와 완화

- **Version보다 shape를 먼저 검사하는 위험:** envelope detection을 exact-key validator 앞에 둔다.
- **Legacy union 누출:** v1 type은 validator/migration module에만 두고 downstream에는 canonical v2만 전달한다.
- **Project schema와 compiled/state version 혼동:** 별도 constant/type/lowering helper와 문서 명칭으로 분리한다.
- **Silent legacy overwrite:** v1 snapshot save를 stable migration-required error로 차단한다.
- **Fixture identity collision:** same Product ID v1/v2 pair를 일반 batch validation에 함께 넣지 않는다.
- **Source/output alias 손상:** resolved path, Windows case fold, ancestor/descendant와 reparse chain을 검사한다.
- **Atomic force ambiguity:** publication rename을 commit point로 두고 prior output rollback/post-commit warning을
  기존 transaction contract와 맞춘다.
- **Stale Runtime hash:** 과거 artifact summary의 absolute Runtime hash를 oracle로 사용하지 않고 final build의
  template-before/after와 v1/v2 direct parity를 비교한다.
- **Studio scope creep:** migration UX를 만들지 않고 response model/current v2/legacy-save refusal만 최소 조정한다.
- **Evidence staleness:** final source 뒤 fresh clean build/export/validator 순서를 지킨다.

## 발견 사항

- 2026-08-12: Actual v1 schema는 지시문의 예상 flat shape와 정확히 일치하므로 structured template v2를
  그대로 채택할 수 있다.
- 2026-08-12: Current validator는 root exact-key 검사를 version보다 먼저 수행해 future version을 잘못
  분류할 수 있다.
- 2026-08-12: Existing strict JSON scanner는 escaped duplicate key와 nested object를 이미 지원한다.
- 2026-08-12: Existing create/save와 compile/export transaction은 atomic output의 검증된 기반이지만 legacy
  save를 그대로 두면 silent in-place migration이 된다.
- 2026-08-12: `artifact-summary.json`/validator summary는 2026-08-10 artifact이고 final Phase 1C.2 Runtime
  rebuild/evidence는 2026-08-12다. Phase 2A는 final source에서 parity report를 새로 생성한다.
- 2026-08-12: `docs/status/current.md`의 Phase 1C.2 uncommitted 문구와 ADR 0003/0005의 “Phase 1C.2 next”
  문구는 checkpoint 이후 stale하므로 Phase 2A closeout에서 바로잡는다.
- 2026-08-12: Final source audit에서 parsed JavaScript number만 검사하면 `2.0000000000000001` 같은 token이
  schema `2`로 반올림될 수 있음을 확인했다. Raw `schemaVersion` token은 fraction/exponent 없는 exact
  integer spelling이어야 하며 `2.0`, `2e0`도 거부하도록 scanner/test/문서를 보강했다.
- 2026-08-12: Migration report invariant를 publication 뒤에만 계산하면 invariant failure 전에 output이
  변할 수 있었다. Shared identity/product-semantics invariant preflight를 output mutation 전에 실행하고
  fixture로 고정했다.
- 2026-08-12: Lexical/reparse overlap audit는 resolved physical source와 output이 junction alias로 겹치는
  Windows case를 추가로 요구했다. Real junction fixture를 추가해 fail closed behavior를 검증했다.
- 2026-08-12: Loader는 lexical `sourceDirectory`와 resolved `physicalSourceDirectory`를 분리했다.
  아직 없는 compile output과 export final bundle path는 nearest existing ancestor real path로 prospective
  physical path를 구한다. Compile output은 source와, export bundle은 source와 existing immutable artifact
  root 모두와 비교해 alias overlap을 거부한다.
- 2026-08-12: Sandbox child spawn은 Studio build/native validator에서 `EPERM`을 반환했다. 같은 final source와
  exact command를 승인된 environment에서 재실행했으며 실패 run은 PASS 수치에서 제외했다.
- 2026-08-12: Studio workflow smoke 첫 retry는 불필요한 literal `--` 때문에 usage exit 1이었다. Exact
  `pnpm studio:verify:product-workflow --configuration <Debug|Release>`로 교정해 두 configuration 모두
  exit 0을 확인했다.
- 2026-08-12: Repository `core.autocrlf=true`에서 exact JSON fixture가 fresh checkout 시 CRLF로 변환될 수
  있었다. `.gitattributes`에 `examples/products/**/product.json text eol=lf`를 추가하고 four fixture의
  `text=set`, `eol=lf`, CR 0과 independent SHA를 확인했다.
- 2026-08-12: Final code audit blocker는 0이다. Nonblocking follow-up으로 Studio future-schema의 실제
  disk replacement/reload, different-Product-ID `--force` rejection 전용 regression과 exact validator의 unused
  `sourceDirectory` diagnostic-context argument cleanup을 기록했다.

## 의사결정 로그

- 2026-08-12: v2 evolution은 `template: { id: "garak.gain", version: 1 }`로 고정하고 defaults는 root에
  유지한다. 의미 변화와 미래 graph/UI field 선행 추가를 피한다.
- 2026-08-12: Current canonical model은 v2 하나만 사용한다. v1을 union/fallback으로 compiler 전체에
  보존하지 않는다.
- 2026-08-12: Project schema v2는 `GARAKCPD` 또는 `GARAKPST` v2를 요구하지 않는다. Exact lowering으로
  기존 binary/runtime contract를 보존한다.
- 2026-08-12: Legacy project open/compile/export는 memory migration을 허용하지만 source rewrite는 하지
  않는다. Legacy source의 ordinary Studio save는 Phase 2B 전까지 차단한다.
- 2026-08-12: Actual migration은 distinct explicit output에만 허용하고 current v2 actual migration clone은
  거부한다.
- 2026-08-12: 새 dependency와 Native/SDK 변경 없이 구현한다.
- 2026-08-12: Schema detection public result는 `supported-legacy`/`current`/`too-old`/`too-new`/`invalid`
  structured union으로 고정한다. Version-specific field validation 전에 이 envelope를 소비한다.
- 2026-08-12: Final boundary audit에 따라 `sourceDirectory`를 canonical `ProductProject`와 versioned source
  model에서 제거했다. `LoadedProductProject`, document snapshot과 compile/export operation option이
  filesystem provenance를 별도로 운반해 collision/output safety를 유지한다. Refactor 뒤 Product 76/76,
  Studio 12/12/build, Debug/Release parity/no-native, post-export CTest 7/7과 Studio workflow smoke를 다시
  통과했다.

## 완료 기록

Phase 2A는 Windows x64 범위에서 **PASS / Complete**다. Editable schema v2, exact supported legacy v1,
structured version-first detection, pure deterministic v1→v2 migration, canonical writer, source-preserving
status/dry-run과 explicit distinct-output atomic CLI를 구현했다. Studio는 legacy open/current-memory status를
지원하고 ordinary Save로 silent source rewrite를 하지 않는다.

실제 생성 파일:

- `docs/adr/0007-editable-project-schema-migration-policy.md`
- `docs/architecture/editable-project-schema-v2.md`
- `docs/architecture/project-migration-engine.md`
- `docs/status/phase-2a-project-migration-fixtures.md`
- `docs/status/phase-2a-project-migration-validation.md`
- `plans/0007-phase-2a-editable-project-schema-migration.md`
- `tools/product-compiler/src/project_migration_core.ts`
- `tools/product-compiler/src/project_migration.ts`
- `tools/product-compiler/tests/project_migration_core.test.ts`
- `tools/product-compiler/tests/project_migration.test.ts`
- `tools/product-compiler/scripts/verify_project_migration_export_parity.ps1`
- `examples/products/legacy/v1/` Warm/Bright v1 fixtures

실제 수정 범주는 `.gitattributes`, Product Compiler schema/model/validation/document/API/CLI/compile/export와 tests, current
Warm/Bright v2 fixtures, root package scripts, Studio DTO/ProductService/workspace/tests, root/studio instructions,
README/ROADMAP/architecture/status/ADR다. Native/CMake/SDK source와 dependency lock inventory는 변경하지
않았다.

최종 검증:

- Product Compiler format/lint/typecheck와 **76/76 tests** PASS
- Studio format/lint/typecheck와 **12/12 tests**, production build PASS
  (`21/18/3` modules, renderer `209.53 kB`, main `60.19 kB`, preload `5.55 kB`)
- Product Runtime Debug/Release fresh clean `177/177`, CTest `7/7` each PASS
- Native Werror/tidy `110/110` each, first-party format `58` files PASS
- Debug/Release parity 각각 exports `4`, child `20/20` exit 0, source/artifact unchanged, forbidden native build 0
- Final Release Warm/Bright × v1/v2 official Validator 8 run exit 0; standard 각각 `47/47`, extensive 각각
  `537/537`, warning/failure/crash marker 0
- No-native-build Debug/Release manifests `772`/`641`, first `10/10` + second `10/10` exit 0, forbidden 0
- Phase 0 regression, Phase 1A full regression과 Phase 1B full regression PASS
- Four project fixture Git attributes `text=set`/`eol=lf`, CR 0과 exact hashes PASS

Warm/Bright canonical v2 SHA는 각각
`3F27ED552AEC8CAE3C7D34C5AE1F4821582E1DAC3E323B353A845C8891734C33`와
`B50A360FD6862BFD0364D4BE95365D4B48E0AF34EE81084626EBE5F791C5932B`다. Exact `GARAKCPD` v1 SHA는
Warm `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9`, Bright
`ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52`로 v1/v2 parity를 유지한다.

Phase 2A commit은 만들지 않았다. Phase 2B/2C, macOS/AU, actual DAW, installer/signing/notarization과
commercial/legal audit는 수행하지 않았고 PASS로 표현하지 않는다. Exact evidence와 failure/remediation은
[Phase 2A validation](../docs/status/phase-2a-project-migration-validation.md)에 기록했다.

## 다음 단계

`Phase 2B — Studio Migration, Backup, Recovery and Durable Persistence UX`

Phase 2A mandatory gate가 모두 PASS했으므로 위 작업이 정확한 다음 milestone이다. 이번 plan에서는
Phase 2B 또는 Phase 2C를 구현하지 않았다.
