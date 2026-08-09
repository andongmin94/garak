# Phase 2A Project Migration Validation

- 기준일: 2026-08-12
- 판정: **PASS / Complete (Windows x64 Phase 2A scope)**
- 시작 baseline: `8d1930c8f07a94bcc441d54e91d9a40b84b5b505`
- 계획: [ExecPlan 0007](../../plans/0007-phase-2a-editable-project-schema-migration.md)
- Fixture: [Phase 2A Project Migration Fixtures](phase-2a-project-migration-fixtures.md)
- Local structured reports: `out/reports/phase-2a/project-migration-parity-{debug|release}.json`

## 판정

Phase 2A mandatory gate는 Windows x64에서 모두 통과했다. Product Compiler는 schema v1/v2 version-first
strict reading, pure deterministic v1→v2 migration, canonical v2 serialization과 explicit distinct-output
publication을 제공한다. Legacy/current Warm/Bright는 exact identity, `GARAKCPD` v1, Runtime,
`moduleinfo.json`, bundle inventory와 official Validator parity를 유지했고 source/build artifact는
변경되지 않았다.

Phase 2 전체 판정은 아직 미완료다. Phase 2B와 Phase 2C는 아래 release boundary에 남는다.

## Environment and repository boundary

- Windows `10.0.26200`, x64
- Node.js `24.19.0`, pnpm `11.16.0`
- Visual Studio `18.7.11925.98`, MSVC `19.51.36248` x64
- CMake `4.3.1-msvc1`, Ninja `1.13.2`
- 시작 commit: `8d1930c8f07a94bcc441d54e91d9a40b84b5b505`
- Phase 2A commit/amend/rebase/branch change: 없음
- Native/CMake/VST3 SDK source 변경: 없음
- Studio direct dependency: 16, Product Compiler runtime third-party dependency: 0
- Fixture Git EOL: `.gitattributes`의 `examples/products/**/product.json text eol=lf`; four fixtures
  `text=set`, `eol=lf`, CR 0과 exact SHA 확인

## Product Compiler and Studio

| Gate | Result |
| --- | --- |
| `pnpm product:format:check` | PASS |
| `pnpm product:lint` | PASS |
| `pnpm product:typecheck` | PASS |
| `pnpm product:test` | **76/76 PASS** |
| `pnpm studio:format:check` | PASS |
| `pnpm studio:lint` | PASS |
| `pnpm studio:typecheck` | PASS |
| `pnpm studio:test` | **12/12 PASS** |
| `pnpm studio:build` | PASS; 21/18/3 modules, renderer `209.53 kB`, main `60.19 kB`, preload `5.55 kB` |

Product tests include exact version detection, separate v1/v2 validators, lexical numeric-version rejection,
pure migration and source-object immutability, canonical hashes, status/dry-run/output CLI, same/overlap/current
rejection including a real Windows junction alias, force publication faults, legacy save refusal,
too-old/too-new fail-closed behavior and v1/v2 compiled byte parity. Studio tests add legacy
open/current-memory status, no-rewrite/save-refusal and future-schema session fail-closed behavior. Phase 2A는
migration UI를 추가하지 않았다.

## Native final-source gates

Visual Studio x64 Developer Command environment에서 final source로 실행했다.

| Gate | Debug | Release |
| --- | ---: | ---: |
| Fresh configure + clean Product Runtime build | 177/177 PASS | 177/177 PASS |
| Product Runtime CTest | 7/7 PASS | 7/7 PASS |

별도 `product-runtime-werror`와 `product-runtime-clang-tidy` fresh/clean aggregate build는 각각
110/110으로 PASS했다. Configuration-independent first-party formatter gate는 `native/`의 58개
`.cpp`/`.hpp`를 통과했고 third-party SDK source를 대상으로 삼지 않았다.

Final evidence ordering은 각 configuration에서 migration/no-native export runner를 끝낸 뒤 CTest를 다시
실행하는 순서다. 최종 no-native regeneration 뒤 Debug CTest 7/7 exit 0 (`0.46s`), Release 7/7 exit 0
(`0.23s`)을 확인했다.

## Debug/Release project migration export parity

`tools/product-compiler/scripts/verify_project_migration_export_parity.ps1`을 Debug와 Release에 각각
실행했다. 각 run은 Warm/Bright의 legacy v1과 current v2, 총 네 export를 수행했다.

| Configuration | Exports | Child processes | Source / artifact | Forbidden native build | Runtime SHA-256 |
| --- | ---: | ---: | --- | ---: | --- |
| Debug | 4 | 20/20 exit 0 | unchanged / unchanged | 0 | `7FF41EF6DD7D22E3D52B2771D118882205A8326568FC647928015486F6C207F4` |
| Release | 4 | 20/20 exit 0 | unchanged / unchanged | 0 | `7317648ABA43CE256DED10E620ED4F17810DB0F6C6E9B8E7A665BA0A1B4FAFBC` |

각 export의 child 5개는 moduleinfotool create/validate, first-party inspector, official Validator standard와
extensive다. 모든 child는 exit 0이고 official Validator는 filter 없이 warning/failure/crash 0이다. 각
bundle inventory는 `moduleinfo.json`, `product.garakbin`, x86_64-win module의 exact 3 files다.

Final Release direct log audit에서 Warm/Bright × legacy-v1/current-v2의 standard/extensive Validator 8
run은 모두 exit 0이었다. Standard 4개는 각각 exact `Result: 47 tests passed, 0 tests failed`,
extensive 4개는 각각 exact `Result: 537 tests passed, 0 tests failed`였고 warning/failure/crash marker는
0이었다.

Pair별 exact parity:

| Product | `GARAKCPD` bytes / SHA-256 | Identity / Runtime / moduleinfo / inventory |
| --- | --- | --- |
| Warm v1 ↔ v2 | 177 / `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` | 모두 parity |
| Bright v1 ↔ v2 | 179 / `ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52` | 모두 parity |

## Phase 1C.1 no-native-build regression

| Configuration | Build manifest | Export child passes | Artifact tree | Forbidden build | Runtime hash |
| --- | ---: | ---: | --- | ---: | --- |
| Debug | 772 entries | first 10/10 + second 10/10 exit 0 | unchanged | 0 | `7FF41EF6DD7D22E3D52B2771D118882205A8326568FC647928015486F6C207F4` |
| Release | 641 entries | first 10/10 + second 10/10 exit 0 | unchanged | 0 | `7317648ABA43CE256DED10E620ED4F17810DB0F6C6E9B8E7A665BA0A1B4FAFBC` |

## Earlier-phase regressions

- Phase 0 Native Debug/Release, smoke, Werror와 clang-tidy: PASS.
- Phase 1A Debug/Release clean build, CTest 3/3, official Validator standard `47/47`와 extensive `537/537`,
  Werror/tidy/format: PASS.
- Phase 1B Debug/Release clean build, CTest 5/5, configuration별 five bundles의 10 Validator run 모두
  standard `47/47`와 extensive `537/537`, inspection parity, Werror/tidy: PASS.
- Phase 1C.1 Product Runtime/no-native-build와 Phase 1C.2 Studio lifecycle/export contract: PASS.

Phase 1B는 여전히 Windows-only private A/B spike이고 ADR 0003은 Proposed다. 이 regression은 A/B 어느
하나를 cross-platform 기본값으로 채택하지 않는다.

## Failure history and remediation

- Sandboxed Studio build 및 native/validator child spawn은 `EPERM`으로 실패했다. 실패 run은 PASS evidence에
  포함하지 않았고 같은 final source와 exact command를 승인된 environment에서 다시 실행해 통과했다.
- Studio workflow smoke의 첫 retry는 script name 뒤 불필요한 literal `--`를 전달해 usage exit 1로
  종료됐다. Exact `pnpm studio:verify:product-workflow --configuration <Debug|Release>`로 교정한 뒤 두
  configuration 모두 exit 0으로 통과했다.
- Final audit는 schema detection 결과를 structured union으로 고정하고, `schemaVersion` JSON numeric token이
  JavaScript number로 정밀도 손실되는 입력을 명시적으로 거부하며, migration identity/product-semantics
  invariant를 output mutation 전에 검사하도록 보강했다. Canonical `ProductProject`/versioned source에서
  filesystem provenance도 제거했다. `LoadedProductProject`는 lexical `sourceDirectory`와 resolved
  `physicalSourceDirectory`를 가지고 document snapshot과 compile/export operation option도 provenance를
  semantic model 밖에서 운반한다. 아직 없는 compile output/export final bundle은 prospective physical
  path로 해석한다. Compile output은 source와, export bundle은 source와 existing immutable artifact root
  모두와 비교해 junction/alias overlap을 거부한다. 해당 수정 뒤 Product Compiler 76/76,
  Studio 12/12/build, Debug/Release parity와
  no-native reports, post-export CTest 7/7 및 Studio workflow smoke를 모두 재확인했다.
- Final hygiene audit는 `core.autocrlf=true` checkout이 exact JSON fixture hash를 바꿀 수 있음을 발견했다.
  `.gitattributes`에 product fixture LF rule을 추가하고 four tracked fixtures의 attribute, CR 0과 exact hash를
  재확인했다.
- 실패 또는 중단된 command, stale pre-fix artifact와 sandbox retry는 위 PASS 수치에 포함하지 않았다.

## Nonblocking audit observations

- Studio future-schema session test는 compiler failure를 주입해 no-session/no-save를 검증한다. Shared disk loader의
  future-schema fail-closed regression은 있지만, Studio service에서 열린 file을 실제 future schema로
  교체한 뒤 reload하는 전용 on-disk regression은 없다.
- Migration `--force`는 different Product ID output을 `GARAK_MIGRATION_OUTPUT_PRODUCT_ID`로 거부하지만
  이 branch만의 전용 test는 없다. Same-product replace와 transaction failure/rollback은 검증됐다.
- Exact v1/v2 validator의 `sourceDirectory` diagnostic-context parameter는 현재 함수 내에서 사용하지
  않는 cleanup 후보다. Canonical/versioned source model의 path-free contract를 변경하지는 않는다.

이 세 항목은 final code audit의 nonblocking coverage/cleanup observation이며 mandatory gate failure는 아니다.

## Unverified and release boundary

다음 항목은 수행하지 않았고 PASS로 일반화하지 않는다.

- Phase 2B Studio migration confirmation, backup/restore, in-place publication, autosave/crash recovery와
  durable multi-session persistence UX
- Phase 2C compiled-data mismatch의 migrate/rebuild/reject 정책, Product Runtime upgrade, preset/DAW/plugin
  state compatibility와 migration
- macOS Apple Clang/Xcode, arm64/x86_64/Universal VST3, AU, signing/notarization
- Windows/macOS actual DAW, installer/system deployment와 packaged Studio distribution
- Commercial redistribution 및 full license/notice/trademark/security audit

따라서 **Phase 2A만 PASS**다. 정확한 다음 milestone은 **Phase 2B — Studio Migration, Backup, Recovery
and Durable Persistence UX**이고 Phase 2C는 pending이다. macOS VST3/Universal과 AU는 첫 상용 배포 전
cross-platform release gate로 남는다.
