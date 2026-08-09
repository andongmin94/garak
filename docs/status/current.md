# Garak Current Status

- 기준일: 2026-08-10
- 현재 milestone: Phase 1C — Windows Product Creation Vertical Slice
- Phase 0A 판정: **PASS / Complete**
- Phase 0B 판정: **PASS / Complete**
- Phase 1A 판정: **PASS / Complete**
- Phase 1B 판정: **PASS / Complete (Windows x64 spike)**
- Phase 1C.1 판정: **PASS / Complete (Windows x64 headless export)**
- Phase 1C.2 판정: 미착수
- Phase 1 전체 판정: 미완료
- 정확한 다음 제안: **Phase 1C.2 — Garak Studio Product Workspace and Export UX**

## 요약

Garak은 이제 두 strict editable `.garak` reference project를 deterministic identity와 first-party
compiled binary로 낮추고, configuration별로 한 번 build한 native Runtime을 사용해 제품별 C++
compile/link 없이 네 개의 repository-local Windows x64 VST3 bundle을 export한다. Warm/Bright 제품은
white-label vendor/name, 고유 Product ID와 processor/controller FUID, Gain/Bypass default 및
product-bound state를 Studio나 network 없이 보존한다.

Phase 1C.1 Product Compiler의 format/lint/typecheck와 36/36 test, Product Runtime Debug/Release clean
build 177/177와 CTest 7/7, Werror/clang-tidy 110/110, first-party clang-format 58 files, official
Validator 8회, no-native-build/reproducibility와 Phase 0/1A/1B/Studio regression이 모두 PASS했다.
Configuration별 반복 export child 20개는 전부 exit 0이고 build tree는 file inventory/size/hash/timestamp
기준으로 불변이며 forbidden native-build invocation은 0이다.

Windows v0.x의 prebuilt Product Runtime plus product data 경로는
[ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)로 범위를 한정해 Accepted했다. 장기
cross-platform 결합 전략의 [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속
**Proposed**다. 이 결과는 macOS/AU, 실제 DAW, signing/notarization, installer 또는 commercial/legal
ready 판정이 아니다.

## Milestone 교체와 release gate

Phase 1B 직후 제안했던 `Phase 1C — macOS VST3 Runtime Strategy Portability Spike`는 superseded됐다.
현재 제품 제작 순서는 다음과 같다.

1. **Phase 1C — Windows Product Creation Vertical Slice**
2. **Phase 1C.1 — Product Contracts and Headless Windows VST3 Export** — 완료
3. **Phase 1C.2 — Garak Studio Product Workspace and Export UX** — 다음 작업
4. 첫 상용 배포 전 **Cross-platform release gate**

macOS VST3 arm64/x86_64/Universal, AU, Developer ID signing, notarization, installer와 Windows/macOS
실제 DAW 검증은 폐기하지 않고 release gate로 이동했다. Mac 장비가 현재 Windows 제품 제작을 막지는
않지만 Windows PASS가 이 gate를 대신하지 않는다.

## Git 기준선과 저장소 보존

- Phase 0 기준선: `ef71c755ee84a9b82d6589365711211fdbc62f58`
  (`Establish Phase 0 baseline`)
- Phase 1A 기준선: `c9d92bfd800cb702a0c32442598a508b382b1df2`
  (`feat: complete Garak phase 1A VST3 gain shell`)
- Phase 1B 기준선: `4203138f13a83e652c04405061fcd2c2ec362c27`
  (`feat: complete Garak phase 1B runtime strategy spike`)
- Phase 1C.1 시작 branch는 `master`, 시작 tree는 clean이었다.
- Phase 1C.1 변경은 의도적으로 uncommitted다. Commit/amend/rebase/branch 변경/reset/clean을 수행하지
  않았다.
- SDK superproject와 nested 7개 checkout은 exact gitlink, detached HEAD와 clean 상태를 유지했다.
- Phase 1A/1B source, descriptor/runtime, Studio source/manifest, SDK/VSTGUI source를 변경하지 않았다.
- Global/system/user VST3 install, registry write와 installer 실행은 없었다. Build/export/report는 ignored
  `out/` 아래에만 있다.

## 현재 존재하는 제품 제작 경로

### Editable project와 identity

현재 `.garak` physical form은 exact lowercase `product.json` 한 file만 가진 unpacked directory package다.
Schema v1은 immutable canonical Product ID, white-label vendor/name, strict semantic version, `Fx`,
`garak.gain-v1`과 Gain default만 표현한다. BOM/invalid UTF-8, escaped duplicate key, unknown/missing field,
symlink/extra entry, case-variant suffix/file, invalid Windows name와 batch identity/output collision은 staging
전에 거부한다.

Product ID에서 versioned SHA-256 algorithm으로 processor/controller FUID를 결정적으로 도출한다.
Name/vendor/version/path/CWD 변경은 FUID를 바꾸지 않고 진짜 새 product에는 새 Product ID가 필요하다.
Gain ID `1001`, Bypass ID `1002`는 project author input이 아니라 template-owned persistent contract다.

### Compiled Product Data와 state

- `GARAKCPD` major 1/minor 0은 exact 96-byte header, UTF-8 vendor/name와 두 24-byte parameter record를
  가진 little-endian derived artifact다.
- TypeScript encoder/decoder와 C++ parser가 size, Product ID/FUID, UTF-8, version/category/template,
  parameter ID/type/flags/default/order, reserved와 trailing data를 독립적으로 검증한다.
- `GARAKPST` major 1/minor 0은 exact 96-byte product-bound state다. Cross-product/corrupt/partial input은
  prior live state를 변경하지 않는다.
- Phase 1A/1B의 ASCII descriptor와 20-byte `GGS1` state는 원래 spike에만 남고 새 Runtime의 fallback이나
  migration input이 아니다.

### Product Compiler와 Windows export

`tools/product-compiler`의 strict TypeScript CLI는 `validate`, `inspect`, `compile`, `export` 네 command를
제공한다. Runtime third-party dependency는 0이고 Node built-in `fs`, `path`, `crypto`, `child_process`,
`util`만 사용한다. Source model, deterministic identity/binary, child process boundary와 atomic staging/
replace 책임을 분리한다.

Compile/export publication의 commit point는 완전히 검증된 sibling stage를 exact final path로 rename하는
순간이다. `--force`에서 기존 final은 먼저 transaction-owned sibling backup으로 이동한다. Backup 준비,
publication, rollback과 pre-commit staging cleanup failure는 각각 stable code/path의 deterministic
diagnostic으로 실패한다. Publication failure 뒤 rollback도 실패하면 새 output은 publish되지 않고 이전
output이 남은 exact backup path를 보고한다. Commit 뒤 빈 stage parent 또는 backup cleanup이 실패해도
이미 검증된 final은 성공으로 유지하고 bounded structured `cleanupDiagnostics`를 결과에 포함한다. 이
post-commit cleanup은 성공을 error로 바꾸거나 새 final을 rollback하지 않는다.

Configuration별 prebuilt `Garak Product Runtime v1`과 `moduleinfotool`, first-party inspector 및 optional
validator를 입력으로 exact three-file VST3 bundle을 만든다. Official moduleinfo create/validate,
compiled data/factory/moduleinfo parity와 요청한 standard/extensive Validator가 전부 성공한 뒤에만 final
output을 publish한다. Product-specific native source generation, compile/link와 system VST3 install은 없다.

### Native Runtime

Runtime은 loaded Windows module path에서 exact
`Contents/Resources/product.garakbin`만 bounded read한다. CWD, environment, registry, source project,
Studio state 또는 network에 의존하지 않는다. Factory 공개 전에 strict parser와 derived FUID parity를
완료하고 malformed/missing/stale data에는 fallback 없이 null factory로 fail closed한다.

Processor/controller는 mono/stereo, Float32/Float64, in/out-of-place Gain, exact-offset Bypass,
zero-sample/parameter-only와 product-bound state를 지원한다. Audio callback에서는 allocation, blocking,
file/network I/O, parsing, logging, GUI call과 exception propagation을 허용하지 않는다.

Windows Unicode process boundary는 supplementary-plane text를 canonical data로 보존한다. Inspector는
`wmain`에서 UTF-16 argument를 strict UTF-8로 변환하고 wide resource path를 사용한다. Fail-closed
`LC_CTYPE=.UTF8` startup object는 inspector, moduleinfotool과 validator에 link한다. Pinned SDK 3.8의
supplementary-plane host conversion 결함은 SDK source를 수정하지 않고 first-party seven-overload
`StringConvert` object를 Runtime과 세 host tool에 link해 격리했다. Factory/inspector metadata는
`PClassInfoW`를 사용한다.

Exact Unicode CLI evidence는 다음 command다.

```text
node tools\product-compiler\src\cli.ts export --project "out\test-fixtures\유니코드-경계.garak" --configuration Debug --output "out\exports\phase-1c1\유니코드-검증" --force --validate
```

`가락 연구소 🧪` / `가락 🎛 Gain`은 moduleinfo create/validate, inspector와 official Validator
standard/extensive 다섯 child process를 모두 exit 0으로 통과했다. Official tools에는 inner module path가
아니라 forward-slash absolute **bundle path**를 전달한다.

## Reference products와 exact artifact

| Product | Product ID | Default | Processor / Controller FUID |
| --- | --- | ---: | --- |
| Artist Gain Warm | `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` | -6.0 dB | `3BA93DD6A062C97D89EC78F3652F83C4` / `00DD9000A50F7F28F4AE084CD29C4330` |
| Artist Gain Bright | `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357` | +3.0 dB | `FCB1FDAED3D981A2AE3AE5A20898C449` / `32D933DFBD3C8110E014829EF5D62EA3` |

| Configuration | Runtime bytes / hash | Warm compiled | Bright compiled |
| --- | --- | --- | --- |
| Debug | 1,755,136 / `BD9244B7B01C1EE2A3CAEA13A422D65B9A6EEFEF644DD63CE6DEB4DA7B1A4044` | 177 / `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` | 179 / `ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52` |
| Release | 714,752 / `219A69676C2E62BD73A3D8C8394CD862DB3C8F94D622E6272A8502260F1EC6E6` | 177 / same hash | 179 / same hash |

Warm/Bright inner Runtime은 configuration별로 byte-identical하고 compiled data, factory identity와
moduleinfo는 서로 다르다. 두 product의 final bundle은 각각 exact three-file inventory와 x64 PE machine
`0x8664`를 가진다. Full size/hash/state fixture는
[Phase 1C.1 Product Fixtures](phase-1c1-product-fixtures.md)가 기록한다.

## 결정 상태

| ADR | 상태 | 현재 의미 |
| --- | --- | --- |
| [0001](../adr/0001-typescript-studio-and-cpp20-engine.md) | Accepted | Studio Electron/React/strict TypeScript, Native C++20/CMake/Ninja/MSVC/Apple Clang |
| [0002](../adr/0002-no-juce-and-adapter-boundaries.md) | Accepted | JUCE 없이 external library를 first-party adapter 뒤에 격리 |
| [0004](../adr/0004-windows-macos-and-plugin-formats.md) | Accepted | 첫 상용 format은 Windows VST3, macOS Universal VST3와 macOS AU |
| [0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md) | **Accepted, Windows x64 v0.x scope** | Prebuilt Product Runtime plus `GARAKCPD` product data |
| [0003](../adr/0003-generated-plugin-runtime-strategy.md) | **Proposed** | macOS/AU와 장기 cross-platform runtime 결합 전략은 미선택 |

ADR 0005의 local 선택은 Alternative B를 삭제하거나 Phase 1B 비교 evidence를 소급 변경하지 않는다.
기존 Gain/Data/Thin 다섯 module은 regression/reference로 보존한다.

## 최종 검증

### Product Compiler와 Product Runtime

| 검증 | 최종 결과 |
| --- | --- |
| Frozen install | PASS, 171 reused, downloaded 0 |
| Product Compiler format/lint/typecheck | PASS |
| Product Compiler tests | **36/36 PASS** |
| Runtime Debug/Release fresh configure + clean build | 각각 **177/177 PASS** |
| Runtime Debug/Release CTest | 각각 **7/7 PASS** |
| Runtime Werror / clang-tidy | 각각 fresh/clean **110/110 PASS** |
| First-party Native clang-format | **58 files PASS** |
| Warm/Bright official Validator | 8회: standard 47/47, extensive 537/537, warning/failure/crash 0, exit 0 |
| No-native-build repeat export | config별 child 20/20 exit 0, forbidden invocation 0, build tree unchanged |

Final source snapshot에서 Debug/Release는 각각 `--fresh` configure → `--clean-first` aggregate 177/177 →
no-native-build runner → CTest 7/7 순서로 exit 0이었다. Atomic commit-point 변경 뒤 Product Compiler
36/36은 compile/export의 backup 준비, stage→final
publication, rollback failure와 cleanup 상태를 fault injection으로 구분한다. Pre-commit failure는
stable deterministic error code/path와 prior-final 또는 preserved-backup 위치를, post-commit cleanup
failure는 success+bounded diagnostic을 검증한다.

Seven-module contract는 Gain Spike, Data Alpha/Beta, Thin Alpha/Beta와 Warm/Bright를 한 process에서
동시에 load해 distinct identity/handle, factory/moduleinfo parity, processing/state/instance isolation,
reverse unload와 reload를 통과했다.

### Regression

| 영역 | 최종 결과 |
| --- | --- |
| Phase 0 Native | Debug/Release fresh+clean, CTest 1/1, exact smoke, Werror/tidy PASS |
| Phase 1A | Debug/Release fresh+clean, CTest 3/3, validator 47/537, Werror/tidy PASS |
| Phase 1B | Debug/Release fresh+clean, CTest 5/5, inspector, config별 validator 10회, Werror/tidy PASS |
| Existing five modules in Product Runtime roots | Debug 10회 + Release 10회 validator PASS |
| Phase 1B package-only | PATH build tools 0, logged moduleinfotool 16개, forbidden build command 0, Debug 402 files/360 dirs 및 Release 305 files/360 dirs diff 0 |
| Studio | Frozen install, lint, format, typecheck, production build PASS; direct dependency 16 |

Exact command/result, no-native-build reports와 수정 이력은
[Phase 1C.1 Headless Export Validation](phase-1c1-headless-export-validation.md)이 기록한다.

## 실패 이력 요약

- 첫 Product Compiler test는 non-TTY pnpm modules prompt 전에 중단됐고 sandbox install은 정지해
  종료했다. `CI=true` 승인 환경의 frozen install 뒤 당시 초기 suite 27/27을 통과했다.
- Atomic final audit에서 stage→final rename의 raw filesystem `Error`가 structured-error contract를
  위반하고 rollback failure와 구분되지 않음을 발견했다. Backup 준비/publication/rollback/cleanup별
  stable code/path와 bounded detail을 추가하고 final Product Compiler 36/36을 통과했다.
- 첫 Unicode proof는 inner module path 접근만 확인해 project/output/bundle/metadata와 official process
  boundary 전체를 증명하지 못했다. Exact Unicode project와 output directory, bundle leaf, vendor/name을
  함께 통과하는 CLI export와 CTest로 확대했다.
- `PClassInfo2` narrow factory metadata는 supplementary-plane text를 mojibake로 만들었다. Factory와
  inspector를 `PClassInfoW`로 바꾸고 Runtime/host conversion boundary를 독립 object로 고정했다.
- 첫 Unicode CLI export는 moduleinfotool output이 valid UTF-8이 아니어서
  `GARAK_EXPORT_MODULEINFO_UTF8`로 fail closed했다. `.UTF8` process locale과 first-party seven-overload
  `StringConvert` object를 세 host tool과 Runtime에 link한 뒤 exact Unicode export 5/5를 통과했다.
- 초기 loaded Runtime test는 test-owned `IPtr`를 module unload 뒤까지 보존해 segfault했다. Lifetime을
  바로잡아 모든 instance를 먼저 release하고 Debug/Release 7/7을 다시 통과했다.
- 기존 두 차례 clang-tidy 진단 뒤 Unicode contract test에서 세 warning이 추가로 발견됐다. Test를
  수정하고 final fresh/clean clang-tidy 110/110을 통과했다.
- 초기 no-native-build 비교의 146개 변화는 file이 아니라 Windows directory timestamp lazy update였다.
  Directory inventory와 모든 file path/size/hash/timestamp를 보존해 다시 실행했고 tree unchanged를
  확인했다.
- Unicode CLI의 첫 sandbox 실행은 native child spawn `EPERM`으로 실패했다. 같은 exact command를 승인된
  환경에서 실행해 다섯 child 모두 exit 0을 확인했다.
- Final validator capture의 첫 PowerShell splat은 argument를 잘못 전달해 help output으로 intended report를
  덮어썼다. 명시적 standard/extensive argument로 8개 raw report를 다시 수집했고 모두 통과했다. 첫
  help run은 PASS evidence로 세지 않았다.
- Phase 1B package-only evidence attempt 1은 empty collection binding 때문에 첫 package 전에, attempt 2는
  Debug Alpha 뒤 `OrderedDictionary` aggregation 때문에 중단됐다. 두 실패를 final report에 보존했고
  attempt 3에서 네 bundle, logged moduleinfotool 16회, forbidden build command 0과 두 build tree diff 0을
  확인했다.

## 명시적으로 구현하지 않은 범위

- Phase 1C.2 Studio Product workspace, Export UI, Studio/native IPC와 native addon
- macOS VST3/AU, Universal binary, signing, notarization, installer/updater
- Production single-file `.garak`, general DSP graph/compiler, macro, scene, preset/asset
- Custom editor, JUCE, VSTGUI, Skia, CanvasKit, Yoga, XYFlow, MIDI/sidechain/instrument
- BLOOM, cloud/marketplace/telemetry/auth/DRM과 external VST repackaging
- Root `LICENSE`, commercial artist product와 commercial legal approval

## 수행하지 않은 검증

- macOS Apple Clang/Xcode configure/build와 official validator
- macOS arm64/x86_64/Universal VST3, AU, signing/notarization
- Windows/macOS 실제 DAW scan/load/automation/bypass/state restore
- Installer/system deployment와 package authenticity
- Realtime allocation/blocking 계측, CPU/latency/memory 및 장시간 stress
- Production single-file project/migration와 general graph/interface data
- Full transitive license/notice/trademark/security 및 commercial redistribution audit

이 항목은 PASS로 일반화하지 않는다. Windows official Validator와 local hosting contract는 실제 DAW,
macOS와 상용 배포 readiness를 대신하지 않는다.

## 현재 리스크와 남은 결정

- Compiled data, actual factory, bundle/inner name과 moduleinfo의 four-way parity를 모든 export에서 계속
  fail closed로 확인해야 한다.
- Publication rename을 commit point로 고정해 cleanup failure의 성공/실패 ambiguity는 제거했다.
  Post-commit cleanup failure는 bounded `cleanupDiagnostics`와 transaction-owned orphan path를 남길 수
  있으므로 Phase 1C.2는 이를 사용자에게 surface하고 안전한 orphan cleanup UX를 제공해야 한다.
- Prebuilt Runtime resource lookup과 product-specific moduleinfo는 Windows에서만 검증됐다. Signed macOS
  bundle/AU 및 code-signing 관계는 release gate evidence가 필요하다.
- `GARAKCPD` v1은 fixed Gain template contract이며 graph-ready general container로 확장하지 않는다.
- SDK redistribution notice/trademark와 generated Runtime commercial legal review는 미완료다.

## 정확한 다음 작업 제안

모든 Phase 1C.1 필수 gate가 PASS했으므로 다음 제품 작업은 하나뿐이다.

`Phase 1C.2 — Garak Studio Product Workspace and Export UX`

Phase 1C.2는 아직 구현하지 않았다. 검증된 headless compiler/export를 Studio Product workspace와 UX에
연결하되 별도 compiler/runtime 경로를 만들지 않는다. Atomic publication 의미를 다시 결정하지 않고
`cleanupDiagnostics` 표시와 transaction-owned orphan cleanup UX만 추가한다. macOS/AU/signing/
notarization/실제 DAW는 첫 상용 배포 전 cross-platform release gate에 남는다.
