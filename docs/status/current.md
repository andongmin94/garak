# Garak Current Status

- 기준일: 2026-08-12
- 현재 milestone: Phase 2 — Project Evolution and Persistent Migration
- Phase 0A/0B 판정: **PASS / Complete**
- Phase 1A 판정: **PASS / Complete**
- Phase 1B 판정: **PASS / Complete (Windows x64 spike)**
- Phase 1C.1 판정: **PASS / Complete (Windows x64 headless export)**
- Phase 1C.2 판정: **PASS / Complete (Windows x64 repository-local Studio workflow)**
- Phase 1 전체 판정: **PASS / Complete**
- Phase 2A 판정: **PASS / Complete (Windows x64 editable project migration)**
- Phase 2 전체 판정: **Incomplete**
- 정확한 다음 제안: **Phase 2B — Studio Migration, Backup, Recovery and Durable Persistence UX**
- Phase 2C: **Pending — Compiled Product and Plug-in State Compatibility Policy**

## 요약

Garak은 Windows x64에서 minimal directory `.garak` project를 Studio Product workspace로 만들고 열고
편집하고 검증하고 atomic 저장한 뒤, configuration별 prebuilt Product Runtime을 사용해 product-specific
C++ compile/link 없이 white-label VST3로 export하는 Phase 1 vertical path를 유지한다.

Phase 2A는 editable source schema evolution을 그 working product 위에 추가했다. Current schema는 v2이고
template identity/version을 `{ "id": "garak.gain", "version": 1 }`로 분리한다. Schema v1은 exact
supported legacy persistent input이다. Product Compiler는 version-first detection, separate exact v1/v2
validation, pure deterministic `project-schema-1-to-2`, canonical v2 serialization과 explicit
distinct-output migration을 소유한다.

Legacy source의 validate/inspect/compile/export/open은 current v2 memory model을 사용하지만 source를
자동으로 덮어쓰지 않는다. Studio legacy ordinary Save는 migration-required로 실패한다. Renderer에는
Node, filesystem, shell, process, raw IPC 또는 arbitrary path mutation 권한이 없다. Phase 2A는 Studio
migration UI를 추가하지 않았다.

Final evidence는 Product Compiler 76/76 tests, Studio 12/12 tests와 production build, Product Runtime
Debug/Release fresh clean 177/177·CTest 7/7, Werror/tidy 110/110, native format 58 files와 configuration별
v1/v2 Warm/Bright export 4개·child 20/20 exit 0이다. Exact fixture와 evidence는
[Phase 2A fixtures](phase-2a-project-migration-fixtures.md)와
[Phase 2A validation](phase-2a-project-migration-validation.md)에 기록한다.

이 PASS는 Phase 2 전체, macOS/AU, 실제 DAW, signing/notarization, installer, packaged Studio 또는
commercial/legal readiness 판정이 아니다. Cross-platform runtime 전략의
[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속 **Proposed**다.

## Milestone 상태와 release gate

현재 제품 제작 순서:

1. **Phase 1C.1 — Product Contracts and Headless Windows VST3 Export** — 완료
2. **Phase 1C.2 — Garak Studio Product Workspace and Export UX** — 완료
3. **Phase 2A — Editable Project Schema Evolution and Deterministic Migration Engine** — 완료
4. **Phase 2B — Studio Migration, Backup, Recovery and Durable Persistence UX** — 정확한 다음 milestone
5. **Phase 2C — Compiled Product and Plug-in State Compatibility Policy** — pending
6. 후속 capability 뒤 첫 상용 배포 전 **Cross-platform release gate**

macOS VST3 arm64/x86_64/Universal, AU, Developer ID signing, notarization, installer와 Windows/macOS 실제
DAW 검증은 release gate에 남아 있다. Mac 장비가 현재 Windows 제품 제작을 막지는 않지만 Windows PASS가
이 gate를 대신하지 않는다.

## Git 기준선과 저장소 보존

- Phase 0 기준선: `ef71c755ee84a9b82d6589365711211fdbc62f58`
- Phase 1A 기준선: `c9d92bfd800cb702a0c32442598a508b382b1df2`
- Phase 1B 기준선: `4203138f13a83e652c04405061fcd2c2ec362c27`
- Phase 1C.1 기준선: `c3f0afb6b9d42d441137e97c115ed96631cae0bc`
- Phase 1C.2 / Phase 2A 시작 baseline: `8d1930c8f07a94bcc441d54e91d9a40b84b5b505`
  (`feat: complete Garak phase 1C.2 Studio product workflow`)
- Phase 2A 변경은 uncommitted이고 remote는 없다. Phase 2A commit/amend/rebase/branch change를 수행하지
  않았다.
- Native/CMake와 VST3 SDK/nested source diff는 0이다. Global/system/user VST3 install과 registry write는
  없었다.
- Build/export/report는 ignored `out/` 아래에만 있다.

## Current editable project and migration contract

### Physical and schema boundary

현재 `.garak` physical form은 exact lowercase `product.json` 하나를 가진 unpacked directory package다.
Current root Warm/Bright fixture는 canonical schema v2이고 original schema v1 byte oracle은
`examples/products/legacy/v1/`에 별도로 보존한다.

Physical/UTF-8/strict JSON boundary 뒤 `schemaVersion`을 version-specific unknown-field 검사보다 먼저
structured union으로 분류한다.

- `supported-legacy`: exact schema v1
- `current`: exact schema v2
- `too-old`: lexical integer `< 1`
- `too-new`: lexical integer `> 2`
- `invalid`: root type, missing 또는 신뢰할 수 없는 version token/value

`schemaVersion`은 fraction/exponent 없는 lexical integer JSON token이어야 한다. 따라서 `2.0`, `2e0`과
JavaScript number conversion이 `2`로 정밀도 손실되는 `2.0000000000000001`도 거부한다. V1/v2는 각자의
exact root/nested shape만 허용하며 future/old/invalid input을 current shape로 추측하지 않는다.

### Canonical model and identity

V1 source는 exact validation 뒤 pure v1→v2 step과 exact v2 revalidation을 거쳐 current canonical model이
된다. Compile/export downstream은 legacy template union이나 fallback parser를 받지 않는다. Canonical
`ProductProject`와 versioned source model에는 filesystem path가 없다. `LoadedProductProject`는 lexical
`sourceDirectory`와 resolved `physicalSourceDirectory`를 별도로 유지하고, document snapshot과
compile/export operation option도 collision/output safety provenance를 semantic model 밖에서 운반한다.

Product ID에서 versioned SHA-256 algorithm으로 processor/controller FUID를 결정적으로 도출한다. Source
schema v1/v2 representation은 FUID input이 아니다. Gain ID `1001`, Bypass ID `1002`, `GARAKCPD` major
1/minor 0과 `GARAKPST` major 1/minor 0은 Phase 1C.1 contract를 유지한다.

### Migration operation boundary

- Status, dry-run, validate/inspect/compile/export/open은 source를 읽기만 한다.
- Actual migration은 explicit distinct `.garak` output만 허용한다.
- Same/ancestor/descendant, Windows case-fold와 physical junction/reparse alias overlap을 거부한다. Migration
  output parent는 존재해야 한다. 아직 없는 compile output/export final bundle path는 nearest existing
  ancestor의 real path로 prospective physical path를 구한다. Compile output은 source와, export bundle은
  source와 existing immutable artifact root 모두와 비교한다.
- Current v2 actual migrate는 duplicate identity clone을 만들지 않도록 migration-not-required로 거부한다.
- `--force`는 same Product ID의 existing output만 atomic stage/backup/rollback transaction으로 교체한다.
- Identity/product-semantics invariant는 output mutation 전에 검사한다.
- Legacy Studio ordinary Save는 `GARAK_PROJECT_MIGRATION_REQUIRED`로 source rewrite를 차단한다.

## Reference parity artifacts

### Editable and compiled fixtures

| Product | Canonical v2 SHA-256 | `GARAKCPD` v1 bytes / SHA-256 |
| --- | --- | --- |
| Warm | `3F27ED552AEC8CAE3C7D34C5AE1F4821582E1DAC3E323B353A845C8891734C33` | 177 / `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` |
| Bright | `B50A360FD6862BFD0364D4BE95365D4B48E0AF34EE81084626EBE5F791C5932B` | 179 / `ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52` |

V1/v2 counterpart는 Product ID, processor/controller FUID, Parameter ID, metadata/default/template meaning과
exact compiled bytes를 모두 보존한다.

### Debug/Release export parity

| Configuration | Runtime SHA-256 | Exports / child | Build manifest | Mutation / forbidden build |
| --- | --- | --- | ---: | --- |
| Debug | `7FF41EF6DD7D22E3D52B2771D118882205A8326568FC647928015486F6C207F4` | 4 / 20 exit 0 | 772 entries | source/artifact unchanged / 0 |
| Release | `7317648ABA43CE256DED10E620ED4F17810DB0F6C6E9B8E7A665BA0A1B4FAFBC` | 4 / 20 exit 0 | 641 entries | source/artifact unchanged / 0 |

각 export의 child 5개는 moduleinfotool create/validate, first-party inspector, official Validator
standard/extensive다. Exact bundle inventory는 `moduleinfo.json`, `product.garakbin`, x86_64-win module의
3 files다.

## Decision status

| ADR | 상태 | 현재 의미 |
| --- | --- | --- |
| [0001](../adr/0001-typescript-studio-and-cpp20-engine.md) | Accepted | Studio Electron/React/strict TypeScript, Native C++20 |
| [0002](../adr/0002-no-juce-and-adapter-boundaries.md) | Accepted | JUCE 없이 external library를 adapter 뒤에 격리 |
| [0004](../adr/0004-windows-macos-and-plugin-formats.md) | Accepted | 첫 상용 format은 Windows VST3, macOS Universal VST3와 AU |
| [0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md) | Accepted, Windows x64 v0.x | Prebuilt Runtime plus `GARAKCPD` |
| [0006](../adr/0006-studio-product-workflow-boundary.md) | Accepted, repository-local | Main-owned capability와 shared compiler facade |
| [0007](../adr/0007-editable-project-schema-migration-policy.md) | Accepted | Editable schema v2, supported v1와 source-preserving migration |
| [0003](../adr/0003-generated-plugin-runtime-strategy.md) | **Proposed** | macOS/AU 장기 runtime 결합 전략 미선택 |

## Final validation

### Phase 2A direct gates

| Gate | Result |
| --- | --- |
| Product Compiler format/lint/typecheck | PASS |
| Product Compiler tests | **76/76 PASS** |
| Studio format/lint/typecheck | PASS |
| Studio tests | **12/12 PASS** |
| Studio production build | 21/18/3 modules; renderer 209.53 kB, main 60.19 kB, preload 5.55 kB |
| Product Runtime Debug/Release | Fresh clean 177/177, CTest 7/7 each |
| Native Werror / clang-tidy | 110/110 PASS each |
| First-party native format | 58 files PASS |
| Migration parity Debug/Release | Config별 4 exports, child 20/20 exit 0, source/artifact unchanged, forbidden 0 |
| Dependency | Studio direct 16, Product Compiler runtime third-party 0 |

### Earlier-phase regression

- Phase 0 Native Debug/Release/smoke/Werror/tidy: PASS.
- Phase 1A Debug/Release clean build, CTest 3/3, official Validator standard 47/47와 extensive 537/537,
  Werror/tidy/format: PASS.
- Phase 1B Debug/Release clean build, CTest 5/5, configuration별 five modules의 Validator 10 runs 모두
  47/47와 537/537, inspection parity, Werror/tidy: PASS.
- Phase 1C.1 no-native-build는 Debug/Release manifest 772/641 불변, first 10/10 + second 10/10 child exit 0,
  forbidden invocation 0으로 PASS.
- Phase 1C.2 Studio ProductService Debug/Release lifecycle/export smoke: PASS.

## Failure history and remediation

- Sandbox의 Studio build와 native/validator child spawn은 `EPERM`으로 실패했다. 실패 run은 PASS 수치에
  포함하지 않고 같은 final source와 exact command를 승인된 environment에서 재실행했다.
- Studio workflow smoke 첫 retry는 script name 뒤 불필요한 literal `--`를 전달해 usage exit 1이었다.
  Exact `pnpm studio:verify:product-workflow --configuration <Debug|Release>`로 교정해 둘 다 exit 0을
  확인했다.
- Final source audit는 structured detection union, lexical `schemaVersion` numeric token precision rejection,
  output mutation 전 shared migration invariant, physical junction alias overlap fixture와 canonical model의
  filesystem-provenance 분리를 보강했다. 보강 뒤 Product 76/76, Studio 12/12/build, Debug/Release
  parity/no-native, post-export CTest 7/7과 Studio workflow smoke를 다시 통과했다.
- 실패, 중단, stale pre-fix artifact는 최종 PASS 수치에 포함하지 않았다.

## Explicitly incomplete or unverified

- Phase 2B migration confirmation, backup/restore, in-place publication, autosave/crash recovery와 durable
  multi-session UX
- Phase 2C compiled-data mismatch migrate/rebuild/reject, Runtime upgrade와 preset/DAW/plugin state migration
- macOS VST3/AU, Universal binary, Apple Clang/Xcode, signing/notarization
- Windows/macOS actual DAW, installer/system deployment와 packaged Studio distribution
- Production single-file `.garak`, general DSP graph/compiler, macro, scene, preset/asset와 custom editor
- Full transitive license/notice/trademark/security 및 commercial redistribution audit
- Root `LICENSE`와 commercial legal approval

Phase 2A Windows validator/local hosting 결과를 위 항목의 완료로 일반화하지 않는다.

## Current risks and exact next step

- Repository-local Runtime/tool discovery는 installed Studio distribution contract가 아니다.
- Prebuilt Runtime resource lookup과 product-specific moduleinfo는 Windows에서만 검증됐다.
- `GARAKCPD` v1은 fixed Gain template contract이고 graph-ready general container가 아니다.
- Studio future-schema disk replacement/reload와 different-Product-ID migration `--force` rejection은 전용
  regression test가 아직 없다. Shared fail-closed loader와 implementation guard는 존재한다.
- Exact validator의 unused `sourceDirectory` diagnostic-context argument는 후속 cleanup 후보다.
- Final single-file `.garak` physical form과 schema v1 이후 장기 support window는 미결정이다.
- SDK redistribution notice/trademark와 generated Runtime commercial legal review는 미완료다.

정확한 다음 작업은 **Phase 2B — Studio Migration, Backup, Recovery and Durable Persistence UX**다. 별도
ExecPlan 뒤 explicit user confirmation, verified backup/restore, safe in-place publication, failure recovery와
durable persistence를 구현한다. Phase 2C compiled/state compatibility는 pending이고 macOS/AU는 첫 상용
배포 전 cross-platform release gate에 남는다.
