# Phase 1C.1 Headless Windows Export Validation

- 기준일: 2026-08-10
- 상태: Windows x64 **PASS / Complete**
- 시작 baseline: `4203138f13a83e652c04405061fcd2c2ec362c27`
- 계획: [ExecPlan 0005](../../plans/0005-phase-1c1-product-contracts-and-headless-windows-export.md)
- fixture와 artifact: [Phase 1C.1 Product Fixtures](phase-1c1-product-fixtures.md)
- Windows runtime 결정: [ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)

## 판정

Strict unpacked `.garak` project에서 deterministic identity와 `GARAKCPD` v1을 만들고, configuration별로
한 번 build한 `Garak Product Runtime v1`을 제품별 C++ compile/link 없이 Warm/Bright white-label
Windows x64 VST3로 export하는 최소 end-to-end 경로가 모든 필수 gate를 통과했다.

Warm/Bright의 Debug/Release 네 bundle은 project → compiled data → Runtime factory → moduleinfo identity와
metadata parity, product-bound state, same-process seven-module coexistence, standard/extensive official
Validator와 repeat/atomic export를 통과했다. 일반 PowerShell evidence에서 두 configuration의 native
build tree는 file inventory/size/hash/timestamp 기준으로 불변이고 forbidden native-build invocation은
0이었다.

이 PASS는 Phase 1C.1 Windows x64 headless 경로에만 한정한다. macOS/AU, 실제 DAW, signing/notarization,
installer, commercial/legal readiness와 Phase 1C.2 Studio UX를 통과했다고 일반화하지 않는다.

## 검증 환경

| 항목 | 확인한 version 또는 상태 |
| --- | --- |
| OS | Microsoft Windows 10.0.26200, x64 |
| Visual Studio / MSVC | Community 2026 18.7.3 / 19.51.36248 x64 |
| CMake / Ninja | 4.3.1-msvc1 / 1.13.2 |
| clang-format / clang-tidy | 22.1.3 / 22.1.3 |
| Node.js / pnpm | 24.19.0 / 11.16.0 |
| Electron | 43.3.0 Windows x64 |
| VST3 SDK | `v3.8.0_build_66` / `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0` |

Native configure/build/test는 `VsDevCmd.bat -arch=x64 -host_arch=x64` 환경에서 실행했다. SDK
superproject와 nested 7개 checkout은 exact gitlink, detached HEAD와 clean 상태를 유지했고 SDK/VSTGUI
source를 변경하지 않았다.

## Product Compiler gate

| Gate | 최종 결과 |
| --- | --- |
| Frozen workspace install | PASS, 171 packages reused, downloaded 0 |
| `pnpm product:format:check` | PASS |
| `pnpm product:lint` | PASS, warning 0 |
| `pnpm product:typecheck` | PASS |
| `pnpm product:test` | **36/36 PASS** |
| Runtime third-party dependency | **0** |
| Studio direct dependency regression | Runtime 2 + dev 14 = **16**, unchanged |

Compiler는 `validate`, `inspect`, `compile`, `export` 네 command, strict duplicate-key/schema/path/collision
validation, versioned identity, deterministic encoder/decoder, executable+argument-array child boundary와
atomic staging/replace를 갖는다. Commit point는 완전히 검증된 stage file/bundle을 exact final path로
rename하는 순간이다. `--force` publication rename이 commit 전에 실패하면 transaction-owned backup을
final로 rollback하고 staging을 정리한 뒤 실패한다. Rollback 자체가 실패하면 새 output은 publish되지
않고 prior output이 보존된 transaction backup path를 distinct diagnostic으로 보고한다. Commit 뒤
stage-parent/backup cleanup이 실패하면 valid final publication은 성공으로 유지하고 bounded structured
`cleanupDiagnostics`를 반환한다.

최종 36개 test의 atomic fault matrix가 검증한 stable taxonomy는 다음과 같다.

| State | Compile code / path | Export code / path | 계약 |
| --- | --- | --- | --- |
| Prior final → backup 실패 | `GARAK_COMPILE_PREPUBLISH_BACKUP` / `compile.publish.backup` | `GARAK_EXPORT_PREPUBLISH_BACKUP` / `export.publish.backup` | 새 output 없음, prior final 제자리 보존 |
| Stage → final publication 실패, rollback 성공 | `GARAK_COMPILE_PUBLISH` / `compile.publish` | `GARAK_EXPORT_PUBLISH` / `export.publish` | 새 output 없음, prior final 복구 |
| Publication과 rollback 모두 실패 | `GARAK_COMPILE_PUBLISH_ROLLBACK` / `compile.publish.rollback` | `GARAK_EXPORT_PUBLISH_ROLLBACK` / `export.publish.rollback` | 새 output 없음, prior final의 exact backup path 보존·보고 |
| Pre-commit staging cleanup 실패 | `GARAK_COMPILE_PRE_COMMIT_CLEANUP` / `compile.cleanup.stage` | `GARAK_EXPORT_PRE_COMMIT_CLEANUP` / `export.cleanup.stage` | 원래 failure와 cleanup failure를 bounded deterministic error로 결합 |
| Post-commit cleanup 실패 | `GARAK_COMPILE_POST_COMMIT_CLEANUP` / `compile.cleanup` | `GARAK_EXPORT_POST_COMMIT_STAGE_CLEANUP` / `export.cleanup.stage`; `GARAK_EXPORT_POST_COMMIT_BACKUP_CLEANUP` / `export.cleanup.backup` | Valid final 성공 + bounded `cleanupDiagnostics` |

Invalid project, missing Runtime, tool/validator failure와 no-force refusal도 partial final을 만들거나 이전
valid output을 훼손하지 않는다. Atomic commit-point 변경 뒤 Product Compiler test는 36/36으로
재검증했다.

## Native build와 contract gate

| Gate | 최종 결과 |
| --- | --- |
| Product Runtime Debug fresh configure + clean aggregate build | **177/177 PASS** |
| Product Runtime Debug CTest | **7/7 PASS** |
| Product Runtime Release fresh configure + clean aggregate build | **177/177 PASS** |
| Product Runtime Release CTest | **7/7 PASS** |
| Product Runtime warnings-as-errors fresh + clean quality build | **110/110 PASS** |
| Product Runtime clang-tidy fresh + clean quality build | **110/110 PASS** |
| First-party Native clang-format dry-run/Werror | **58 files PASS** |

Final source snapshot에서는 configuration별로 `--fresh` configure → `--clean-first` aggregate 177/177 →
no-native-build evidence runner → CTest 7/7 순서로 실행했고 Debug/Release 모두 exit 0이었다.

CTest 7개는 Phase 0 version, Phase 1A pure/loaded Gain, Phase 1B descriptor/coexistence, Phase 1C.1
compiled/state와 Product Runtime contract를 포함한다. Product Runtime contract는 기존 Gain/Data/Thin
다섯 module과 Warm/Bright를 한 process에서 동시에 load하여 열네 class identity, distinct product
metadata/default, processing/state와 instance isolation, reverse unload 및 reload를 검증했다.

`GARAKCPD` parser는 factory 공개 전에 module-relative `Contents/Resources/product.garakbin`을 bounded
read하고 magic/version/size/UTF-8/FUID/category/template/parameter/default/reserved/trailing data를 모두
검증한다. Missing 또는 invalid data에서는 template/stale identity로 fallback하지 않고 factory를
공개하지 않는다. File I/O와 parsing은 audio callback에 들어가지 않는다.

## Exact Unicode process-boundary export

Supplementary-plane character를 포함한 source/output/metadata를 실제 Product Compiler CLI와 native child
process 전체로 검증했다. 실행한 exact command는 다음과 같다.

```text
node tools\product-compiler\src\cli.ts export --project "out\test-fixtures\유니코드-경계.garak" --configuration Debug --output "out\exports\phase-1c1\유니코드-검증" --force --validate
```

CLI input은 relative Windows path지만 exporter가 moduleinfotool, inspector와 validator에 넘기는 bundle
argument는 계속 forward-slash absolute **bundle path**다. Inner module path만 넘기지 않는다.

| Evidence | Exact result |
| --- | --- |
| Vendor / Product | `가락 연구소 🧪` / `가락 🎛 Gain` |
| Processor / Controller FUID | `34041DA416A3944588F29506953A3098` / `AD919FFE93E7D3CFE766C7AED441B4A6` |
| Child processes | moduleinfo create/validate, inspector, validator standard/extensive **5/5 exit 0** |
| Inventory | Exact 3 files |
| Runtime | 1,755,136 bytes / `BD9244B7B01C1EE2A3CAEA13A422D65B9A6EEFEF644DD63CE6DEB4DA7B1A4044` |
| Compiled data | 181 bytes / `E19AE344DC3E73313195E889D63512F9E002A002BD3FFEA8D0691CA859399E03` |
| `moduleinfo.json` | 1,051 bytes / `1AFBB64A281CFAABA582D044C03589FCCC2BAD1D1D8A260DF1D3E636BD5F4935` |

First-party process boundary는 다음처럼 고정했다.

- Inspector entry는 `wmain`이고 UTF-16 argument를 strict UTF-8로 변환하며 resource lookup에는 wide path를
  사용한다. Unpaired UTF-16 surrogate는 non-zero로 fail closed한다.
- `LC_CTYPE`를 `.UTF8`로 설정하고 실패하면 startup에서 종료하는 first-party object를 inspector,
  moduleinfotool과 validator에 link한다.
- Pinned SDK 3.8 host helper의 supplementary-plane conversion 결함은 SDK source를 수정하지 않고
  first-party seven-overload `StringConvert` object를 Runtime과 inspector/moduleinfotool/validator 세
  host에 link해 격리한다.
- Factory와 inspector class metadata는 `PClassInfoW`로 교환한다.
- CTest는 내부 fixture path `가락 경로 📁/가락 🎛 Gain.vst3`와 invalid surrogate argument를 모두
  process boundary에서 검사한다.

## Official Validator

Warm/Bright × Debug/Release × standard/extensive의 raw report 8개를 filter 없이 실행했다.

Validator와 bundle은 모두 repository-local path를 사용했다. 실행한 exact PowerShell 명령은 다음과
같다.

```powershell
& 'out\build\product-runtime-debug\bin\validator.exe' 'out\exports\phase-1c1\debug\Artist Gain Warm.vst3'
& 'out\build\product-runtime-debug\bin\validator.exe' '-e' 'out\exports\phase-1c1\debug\Artist Gain Warm.vst3'
& 'out\build\product-runtime-debug\bin\validator.exe' 'out\exports\phase-1c1\debug\Artist Gain Bright.vst3'
& 'out\build\product-runtime-debug\bin\validator.exe' '-e' 'out\exports\phase-1c1\debug\Artist Gain Bright.vst3'

& 'out\build\product-runtime-release\bin\validator.exe' 'out\exports\phase-1c1\release\Artist Gain Warm.vst3'
& 'out\build\product-runtime-release\bin\validator.exe' '-e' 'out\exports\phase-1c1\release\Artist Gain Warm.vst3'
& 'out\build\product-runtime-release\bin\validator.exe' 'out\exports\phase-1c1\release\Artist Gain Bright.vst3'
& 'out\build\product-runtime-release\bin\validator.exe' '-e' 'out\exports\phase-1c1\release\Artist Gain Bright.vst3'
```

| Configuration | Product | Standard | Extensive | Warning / Failure / Crash | Exit |
| --- | --- | ---: | ---: | --- | ---: |
| Debug | Artist Gain Warm | 47/47 | 537/537 | 0 / 0 / 0 | 0 / 0 |
| Debug | Artist Gain Bright | 47/47 | 537/537 | 0 / 0 / 0 | 0 / 0 |
| Release | Artist Gain Warm | 47/47 | 537/537 | 0 / 0 / 0 | 0 / 0 |
| Release | Artist Gain Bright | 47/47 | 537/537 | 0 / 0 / 0 | 0 / 0 |

요약은 `out/reports/vst3/product-runtime/product-validator-summary.json`, 원문은 같은 directory의
`<configuration>-<warm|bright>-validator-<standard|extensive>.txt`에 보존한다. Standard/extensive
process는 모두 exit 0이고 warning/failure/crash는 0이다.

## No-native-build와 reproducibility evidence

`tools/product-compiler/scripts/verify_headless_export_no_build.ps1`는 prebuilt Runtime,
`moduleinfotool`, first-party inspector와 validator를 입력으로 일반 PowerShell에서 Warm/Bright를 두 번씩
export했다. 각 pass는 product마다 moduleinfo create/validate, inspector, standard/extensive Validator의
exact 다섯 child process만 실행한다.

```powershell
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Debug
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Release
```

| Evidence | Debug | Release |
| --- | ---: | ---: |
| Build-tree manifest entries | 772 | 641 |
| Export child processes | 20, non-zero 0 | 20, non-zero 0 |
| Forbidden compiler/linker/build invocation | 0 | 0 |
| Artifact tree unchanged | `true` | `true` |
| Runtime bytes | 1,755,136 | 714,752 |
| Runtime hash before/after | `BD9244B7B01C1EE2A3CAEA13A422D65B9A6EEFEF644DD63CE6DEB4DA7B1A4044` | `219A69676C2E62BD73A3D8C8394CD862DB3C8F94D622E6272A8502260F1EC6E6` |

File manifest는 relative path, size, SHA-256와 exact `LastWriteTimeUtc` ticks를 비교하며 directory
inventory도 비교한다. Directory timestamp 자체는 Windows의 lazy metadata 갱신 때문에 artifact
immutability 기준에서 제외했다. Reports는
`out/reports/vst3/product-runtime/no-native-build-debug.json`과
`no-native-build-release.json`에 있다.

Repeated export에서 configuration별 Warm/Bright Runtime hash는 서로 같고 before/after도 같았다.
Compiled data와 moduleinfo는 같은 product의 반복 및 Debug/Release 사이에서 byte-identical했고 두 product
사이에서는 서로 달랐다. Exact artifact hash/size는
[fixture status](phase-1c1-product-fixtures.md)에 기록한다.

## Phase 1B package-only evidence 보존

Phase 1B Alternative A의 canonical build tree를 대상으로도 ordinary Windows PowerShell 5.1
package-only 증거를 다시 수집했다. Developer Command 환경은 없었고 `cl.exe`, `link.exe`, `cmake.exe`,
`ninja.exe`는 PATH에 하나도 없었다. Debug/Release Data Alpha/Beta 네 script invocation은 모두 exit 0,
각 bundle은 exact 3 files, template inner hash 일치, source descriptor hash 일치와 final moduleinfo
validation을 통과했다. Logged native command 16개는 모두 명시적 `moduleinfotool`이고 forbidden build
command는 0이다.

Debug build tree의 402 files/360 directories와 Release의 305 files/360 directories는 전후 difference
0이다. File path/size/SHA-256/mtime와 directory inventory를 비교했고 directory mtime은 비교하지 않았다.
Final evidence는
`out/reports/vst3/runtime-strategy/package-only-rerun/attempt-3/package-only-evidence.json`에 있다.
Package-only rerun 전에 canonical Phase 1B Debug/Release CTest 5/5, inspector와 각 configuration 10회
validator가 PASS했고 rerun은 같은 build tree를 변경하지 않았다. 따라서 같은 artifact를 대상으로
CTest와 validator를 불필요하게 다시 실행하지 않았다.

## Regression

| 영역 | 최종 결과 |
| --- | --- |
| Phase 0 Native Debug/Release | Fresh configure, clean build, CTest 1/1, exact smoke PASS |
| Phase 0 Native quality | Werror와 clang-tidy fresh/clean PASS |
| Phase 1A Debug/Release | Fresh configure, clean build, CTest 3/3, Gain standard 47/47 및 extensive 537/537 PASS |
| Phase 1A quality | Werror와 clang-tidy fresh/clean PASS |
| Phase 1B Debug/Release | Fresh configure, clean build, CTest 5/5 및 inspector PASS |
| Phase 1B validator | 기존 Gain/Data Alpha/Data Beta/Thin Alpha/Thin Beta, configuration별 10회 모두 PASS |
| Phase 1B quality | Werror와 clang-tidy fresh/clean PASS |
| Product Runtime 기존 five-module validator | Debug 10회 + Release 10회 모두 standard 47/47, extensive 537/537, warning/failure/crash 0, exit 0 |
| Studio | Frozen install, lint, format check, typecheck, production build PASS |
| Studio dependency/source | Direct 16, manifest와 lock Studio importer baseline 일치, source 변경 0 |

Phase 1B baseline은 Phase 1C.1 시작 전에 commit
`4203138f13a83e652c04405061fcd2c2ec362c27`로 고정했다. Phase 1C.1은 기존 Phase 1A/1B source,
descriptor/runtime와 identity를 수정하지 않았다.

## 실패, 수정과 최종 재검증

- 첫 `pnpm product:test`는 non-interactive 환경에서 pnpm의 modules directory 제거 확인 prompt를
  받을 수 없어 test 시작 전에 중단됐다. Sandboxed frozen install도 60초 이상 정지해 종료했다.
  `CI=true`인 승인된 환경에서 frozen install을 완료한 뒤 당시 초기 compiler suite 27/27을 통과했다.
- Atomic final audit는 stage→final rename의 raw filesystem `Error`가 deterministic structured-error
  contract를 위반하고 publication과 rollback double failure를 구분하지 못한다는 점을 찾았다. Backup
  준비/publication/rollback/cleanup별 stable code/path, bounded underlying detail과 preserved-backup
  reporting을 추가한 뒤 final Product Compiler 36/36을 통과했다.
- 최초 Unicode 접근은 inner module path만 확인해 source/output directory, bundle leaf, white-label
  metadata와 official child-process boundary를 함께 증명하지 못했다. Exact Unicode CLI export와 CTest
  process fixture로 범위를 넓혔다.
- Factory metadata를 `PClassInfo2` narrow field로 읽은 초기 구현은 supplementary-plane text를
  mojibake로 만들었다. `PClassInfoW` factory/inspector parity로 교체했다.
- 첫 Unicode export는 moduleinfotool output이 valid UTF-8이 아니어서
  `GARAK_EXPORT_MODULEINFO_UTF8`로 fail closed했다. `.UTF8` startup locale과 first-party seven-overload
  conversion object를 link한 뒤 exact CLI child 5/5를 통과했다.
- 초기 Debug loaded Product Runtime test는 Warm module을 unload한 뒤에도 두 번째 Warm `IPtr`가 살아
  있어 destructor가 unloaded vtable을 호출하며 segfault했다. Test lifetime을 바로잡아 모든 instance를
  module unload 전에 release하고 Debug/Release CTest 7/7을 다시 통과했다. Runtime 제품 동작 실패는
  아니었지만 crash를 숨기지 않는다.
- 기존 clang-tidy remediation 뒤 Unicode contract test에서 세 warning이 추가로 발견됐다. Test를
  수정한 뒤 final fresh/clean clang-tidy 110/110을 통과했다.
- 최초 no-native-build manifest 비교는 Windows가 directory `LastWriteTime`을 lazy 갱신해 file 변화가
  없는데도 146개 directory entry를 changed로 보고했다. Directory inventory는 유지하되 directory
  timestamp만 contract에서 제외하고 모든 file의 path/size/hash/timestamp 비교를 보존한 뒤 Debug/Release
  evidence를 다시 실행해 `artifactTreeUnchanged=true`를 얻었다.
- Exact Unicode CLI의 첫 sandbox 실행은 native child spawn `EPERM`으로 실패했다. 같은 command를 승인된
  환경에서 실행해 child 5/5 exit 0을 얻었다.
- Final validator capture의 첫 PowerShell splat은 malformed argument로 help output을 내고 intended report를
  덮어썼다. 명시적 standard/extensive argument로 raw report 8개를 다시 만들었고 모두 exit 0,
  warning/failure/crash 0이었다. 첫 help run은 PASS evidence로 세지 않았다.
- Phase 1B package-only 재증명의 attempt 1은 첫 package 전에 empty collection을 parameter에 bind하지
  못해 exit 1이었고 output bundle을 만들지 않았다. Attempt 2는 Debug Alpha package/verify 후 evidence
  aggregation에서 `OrderedDictionary`를 `Measure-Object`로 잘못 다뤄 exit 1이었다. 두 실패와 보존
  artifact를 final report의 `priorFailures`에 남겼다. Attempt 3가 네 bundle과 두 build tree 전체를
  재검증해 `result=PASS`를 기록했으며 앞선 실패를 성공으로 세지 않았다.

## 수행하지 않은 검증

- macOS Apple Clang/Xcode, arm64/x86_64/Universal VST3, AU와 official validator
- Developer ID signing, notarization, installer/updater와 package authenticity
- Windows/macOS 실제 DAW scan/load/automation/bypass/state restore matrix
- Production single-file `.garak`, general DSP graph/compiler, macro, scene, preset와 asset
- Custom editor/native renderer, Studio Product workspace/Export UX와 Studio/native IPC
- Realtime allocation/blocking instrumentation, CPU/latency/memory와 long-running stress
- Commercial redistribution, full transitive license/notice/trademark/security audit

Windows official Validator와 same-process contract test는 실제 DAW 또는 macOS evidence를 대신하지
않는다. 저장소 자체 license도 정하지 않았고 root `LICENSE`를 추가하지 않았다.

## 현재 리스크와 정확한 다음 작업

- Dynamic factory는 compiled data, actual factory, bundle/inner name과 moduleinfo parity를 계속 fail
  closed로 검증해야 한다.
- Publication rename을 commit point로 고정했으므로 post-commit cleanup failure는 CLI failure가 아니라
  valid publication 성공과 bounded `cleanupDiagnostics`다. Phase 1C.2에는 diagnostic surfacing과
  transaction-owned orphan cleanup UX만 남아 있다.
- Prebuilt Runtime Windows 성공은 signed macOS bundle의 resource lookup/signing 관계를 증명하지 않는다.
- SDK Runtime redistribution notice/trademark와 commercial legal 검토가 남아 있다.

모든 Phase 1C.1 필수 gate가 PASS했으므로 다음 제품 작업 제안은 하나뿐이다.

`Phase 1C.2 — Garak Studio Product Workspace and Export UX`

이 작업은 Phase 1C.1에서 구현하지 않았다. macOS/AU/signing/notarization/실제 DAW는 폐기하지 않고 첫
상용 배포 전 cross-platform release gate로 유지한다.
