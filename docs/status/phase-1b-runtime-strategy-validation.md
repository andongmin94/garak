# Phase 1B Runtime Strategy Validation

- 기준일: 2026-08-09
- 상태: Windows x64 **PASS / Complete**
- 시작 baseline: `c9d92bfd800cb702a0c32442598a508b382b1df2`
- 계획: [ExecPlan 0004](../../plans/0004-phase-1b-generated-runtime-ab-spike.md)
- 비교 수치: [Phase 1B Runtime Strategy Artifacts](phase-1b-runtime-strategy-artifacts.md)
- 관련 결정: [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)

## 판정

Alternative A의 identical prebuilt Runtime + external product descriptor와 Alternative B의
product-specific thin wrapper + common static implementation은 같은 Windows x64 VST3 contract를
모두 통과했다. Data Alpha/Beta, Thin Alpha/Beta와 기존 `Garak Gain Spike`는 고유 identity를
유지하면서 한 process에서 동시에 load되고, 독립적으로 processing/state를 수행하고, reverse
unload/reload 뒤에도 stale identity 없이 다시 load됐다.

이번 PASS는 Windows x64 기술 spike에 한정된다. 두 전략 중 하나를 채택하지 않았고 ADR 0003은
계속 **Proposed**다. Binary hash, byte size, wrapper/object와 compile/link delta는 이 문서에서
반복하지 않고 [artifact status](phase-1b-runtime-strategy-artifacts.md)에 둔다.

## 시작 상태와 환경

- Branch: `master`
- Phase 1A baseline: `c9d92bfd800cb702a0c32442598a508b382b1df2`
- 시작 tree: clean
- SDK: official Steinberg VST3 SDK `v3.8.0_build_66`, superproject와 nested 7개 exact pin
- Toolchain: Visual Studio 2026 18.7.3, MSVC 19.51.36248 x64, CMake 4.3.1-msvc1,
  Ninja 1.13.2, clang-format/clang-tidy 22.1.3
- Native environment: `VsDevCmd.bat -arch=x64 -host_arch=x64`

SDK superproject와 nested repository는 detached exact pin과 clean 상태를 유지했다. VSTGUI,
automatic plugin link, global install과 system/user VST3 write는 사용하지 않았다.

## CMake runner 제한과 toolchain 확인

Codex sandbox 안에서는 CMake/Ninja child process가 compiler ABI probe와 SDK atomic capability
probe를 마친 뒤 종료되지 않았다. 같은 현상이 반복되어 ignored local configure helper에서 다음
cache fact를 실제 x64 environment 값으로 명시하고 non-sandbox build를 실행했다.

```text
CMAKE_CXX_COMPILER_WORKS=TRUE
CMAKE_CXX_ABI_COMPILED=TRUE
CMAKE_C_COMPILER_WORKS=TRUE
CMAKE_C_ABI_COMPILED=TRUE
CMAKE_SIZEOF_VOID_P=8
SMTG_USE_STDATOMIC_H=FALSE
```

Debug, Werror와 clang-tidy helper는 embedded debug information을 선택하고 build environment에서
`/Z7`을 사용해 sandbox의 program database child-process 경로도 피했다. 이 값들은 source나
`CMakePresets.json`의 portable contract가 아니며 ignored `out/` helper에만 존재한다.

이 workaround가 compiler/linker 실행을 생략한 것은 아니다. Debug/Release/Werror/clang-tidy
aggregate는 실제 MSVC compilation과 native link를 수행했고, 생성 module은 PE x64 DLL로 검사됐다.
또한 Phase 0 Debug/Release/Werror/clang-tidy fresh configure는 workaround 없이 compiler ABI와
feature detection을 완료했다. 따라서 현재 Windows toolchain 자체는 확인됐지만 sandbox child-process
lifetime 문제는 runner limitation으로 남긴다.

## Native build와 CTest

Canonical preset 명령은 다음과 같다. Actual run은 위 runner limitation 때문에 같은 preset에
ignored configure cache fact를 추가했다.

```text
cmake --preset runtime-strategy-debug --fresh
cmake --build --preset runtime-strategy-debug-build --clean-first
ctest --preset runtime-strategy-debug-test --no-tests=error

cmake --preset runtime-strategy-release --fresh
cmake --build --preset runtime-strategy-release-build --clean-first
ctest --preset runtime-strategy-release-test --no-tests=error

cmake --preset runtime-strategy-werror --fresh
cmake --build --preset runtime-strategy-werror-build --clean-first

cmake --preset runtime-strategy-clang-tidy --fresh
cmake --build --preset runtime-strategy-clang-tidy-build --clean-first
```

| Configuration | 결과 |
| --- | --- |
| Debug | Fresh configure + clean aggregate build PASS; remediation 뒤 final incremental build와 CTest 5/5 PASS |
| Release | Fresh configure + clean aggregate build PASS; remediation 뒤 final incremental build와 CTest 5/5 PASS |
| Werror | Fresh configure + clean aggregate build PASS; first-party warning 0 |
| clang-tidy | 초기 두 first-party finding으로 실패, remediation 뒤 fresh + clean aggregate analysis PASS |

Debug와 Release의 다섯 test는 다음과 같다.

1. `garak_version_tests`
2. `garak_gain_spike_tests`
3. `garak_vst3_gain_contract_tests`
4. `garak_runtime_strategy_descriptor_tests`
5. `garak_runtime_strategy_contract_tests`

Final CTest는 두 configuration 모두 5/5, failed 0이다. Contract test는 실제 local bundle 여섯 개
(template 포함)을 explicit path로 받고, 배포 product 다섯 개를 동시에 load한다.

## Identity, processing, state와 coexistence

Debug/Release contract test가 다음을 확인했다.

- 네 product의 processor/controller FUID, name, vendor, version, category와 parameter ID parity
- Alternative A descriptor, loaded factory와 generated moduleinfo identity parity
- Alternative B compile-time wrapper, loaded factory와 generated moduleinfo identity parity
- Data Alpha/Beta의 byte-identical module이 서로 다른 full path와 distinct Windows module handle로
  동시에 load되는 동작
- Alpha `-6 dB`, Beta `+3 dB` default output
- Gain automation, exact-offset Bypass, mono/stereo, float32/float64, in-place/out-of-place,
  zero-sample와 parameter-only process
- 20-byte `GGS1` schema 1 state save/load, controller restore와 corrupt state no-partial-mutation
- 같은 module의 두 instance와 다섯 module 사이 processing/state isolation
- Missing/malformed/path-mismatch descriptor의 null factory fail-closed와 stale identity reuse 0
- Factory/instance release, reverse unload, handle 부재, Data Alpha reload와 identity 재검증

Phase 1A Gain Spike의 pure helper, loaded factory, automation와 state test가 같은 aggregate에 포함돼
기존 fixed identity behavior도 regression했다.

## Official Validator

`tools/vst3/validate_runtime_strategy.ps1`에 configuration, artifact root, local validator와 다섯
bundle path, report directory를 모두 명시했다. Full exact command는
[ExecPlan의 검증 명령](../../plans/0004-phase-1b-generated-runtime-ab-spike.md#검증-명령)에 기록한다.

| Configuration | Bundle | Standard | Extensive | Warning / failed / crash |
| --- | ---: | ---: | ---: | ---: |
| Debug | 5 | 각 47/47 | 각 537/537 | 0 / 0 / 0 |
| Release | 5 | 각 47/47 | 각 537/537 | 0 / 0 / 0 |

총 20개 process와 raw report가 존재한다. Naming contract는 다음과 같다.

```text
out/reports/vst3/runtime-strategy/
  <debug|release>-<gain-spike|data-alpha|data-beta|thin-alpha|thin-beta>-validator-standard.txt
  <debug|release>-<gain-spike|data-alpha|data-beta|thin-alpha|thin-beta>-validator-extensive.txt
```

Wrapper는 standard report에 정확히 `47 tests passed, 0 tests failed`, extensive report에 정확히
`537 tests passed, 0 tests failed`가 한 번 있는지 확인하고 warning/error/failed marker, factory
vendor, 두 class, product/controller name과 FUID도 독립 literal로 검사한다. Filter나 suite 제외는
사용하지 않았다.

## Compiler 없는 Alternative A package-only 재현

일반 PowerShell에서 `cl.exe`와 `link.exe`가 PATH에 없음을 확인하고 Debug/Release의 Data
Alpha/Beta output 네 개만 exact path로 제거했다. 각 product에 template bundle, canonical
descriptor, `runtime-products` output과 prebuilt `moduleinfotool.exe`를 명시해 package script를
실행했다.

- `clOnPath=false`, `linkOnPath=false`
- compiler/CMake/Ninja/build-tool invocation 0
- Template, common/descriptor library, wrapper object와 Thin module timestamp/hash 불변
- 네 Data output atomic regenerate PASS
- Staging과 final bundle의 exact inventory, module/descriptor hash와 moduleinfo validation PASS

Raw transcript는 `out/reports/vst3/runtime-strategy/package-only.log`, structured evidence는
`package-only-evidence.json`에 있다. Package-only run 뒤 Debug/Release CTest 5/5, official validator
20개 run과 두 artifact inspector를 모두 다시 실행해 regenerated output을 최종 검증했다.

## Artifact와 PE 경계

`inspect_runtime_strategy.ps1`은 configuration, artifact root, template/Gain/Data A/B/Thin A/B exact
bundle path와 report path를 모두 요구한다. Full exact command는
[ExecPlan](../../plans/0004-phase-1b-generated-runtime-ab-spike.md#검증-명령)에 기록한다.

Debug/Release의 template, Gain Spike와 네 product module은 모두 PE x64 DLL이다. Exact bundle
inventory, forbidden runtime import 0, Template/Data A/Data B byte equality와 Thin A/B distinct binary를
검사했다. Numeric hash, module/bundle/resource byte size와 object/build delta는
[artifact status](phase-1b-runtime-strategy-artifacts.md)의 단일 표를 권위로 사용한다.

## Quality remediation

### clang-tidy

첫 analysis는 descriptor test `main`의 exception escape 가능성을 찾아 실패했다. Top-level catch를
추가한 뒤 두 번째 analysis는 그 catch가 `std::cerr`로 실패를 보고하는 동안 다시 예외를 만들 수
있음을 찾아 실패했다. Catch-all과 `std::fputs` 기반 non-throwing failure reporting으로 수정한 뒤
targeted analysis와 `runtime-strategy-clang-tidy` fresh configure + clean aggregate build가 PASS했다.
Finding을 suppress하거나 SDK source에 Garak tidy policy를 적용하지 않았다.

### Formatting과 warnings

- First-party `native/` `.cpp/.hpp` 37개에 `clang-format --dry-run --Werror`: PASS
- `runtime-strategy-werror` fresh configure + clean aggregate build: PASS
- SDK 원본은 formatting, `/W4 /WX`와 clang-tidy 대상에서 제외

## 발견하고 수정한 packaging defect

### moduleinfo Windows path

첫 package는 `moduleinfotool`에 backslash absolute path를 전달했다. Generated JSON5의 root `Name`이
product leaf와 달라졌지만 SDK validate는 root Name/Version을 비교하지 않아 자체 validate는
성공했다. Pinned parser를 사용하는 contract test의 root identity parity가 이 결함을 발견했다.

Tool에 전달하는 path만 forward slash absolute path로 바꾸고 `-infopath`를 명시했으며, package
script에도 root Name/Version/Factory Vendor와 두 CID/class name assertion을 추가했다. 네 Data
bundle을 재package한 뒤 Debug/Release CTest, 20 validator run과 inspector를 다시 통과했다.

### Alternative A output graph

첫 CMake custom command는 `moduleinfo.json`만 output으로 추적해 inner module/descriptor 삭제·변조나
stale extra file을 놓칠 수 있었다. 각 product의 inner module, descriptor와 moduleinfo 세 파일을
모두 output으로 모델링하고 `garak_data_runtime_products`가 aggregate build마다 verify-only mode로
exact inventory, template/descriptor hash와 moduleinfo identity를 재검사하게 했다. Product-specific
compile/link dependency는 추가하지 않았다.

## 기존 기능 regression

### Phase 0 Native

| 경로 | 결과 |
| --- | --- |
| Debug | Fresh configure, clean-first build, CTest 1/1 PASS, smoke exit 0 |
| Release | Fresh configure, clean-first build, CTest 1/1 PASS, smoke exit 0 |
| Werror | Fresh configure + clean-first build PASS |
| clang-tidy | Fresh configure + clean-first build PASS |

Debug/Release smoke stdout은 정확히 `Garak native scaffold 0.0.0`이다. 네 Phase 0 cache에서
`GARAK_BUILD_RUNTIME_STRATEGY_SPIKE=OFF`와 `GARAK_BUILD_VST3_GAIN_SPIKE=OFF`를 확인했다.

### Studio

다음 명령이 통과했다.

```text
pnpm install --frozen-lockfile
pnpm studio:lint
pnpm studio:format:check
pnpm studio:typecheck
pnpm studio:build
```

첫 sandboxed production build는 child-process spawn `EPERM`으로 실패했다.
같은 exact build를 non-sandbox environment에서 다시 실행해 PASS했다. Direct dependency는 16개로
유지됐고 Studio source, manifest와 lockfile의 기능 변경은 없다.

## 수행하지 않은 검증

- macOS arm64/x86_64 VST3, Apple Clang/Xcode와 Universal binary
- macOS bundle entry/resource lookup, code signing와 notarization
- AU
- 실제 DAW host scan, session save/reload와 multi-host compatibility
- Installer, system/global VST3 deployment와 commercial redistribution legal review
- Studio Product Compiler/export integration, `.garak`와 production compiled runtime data
- Runtime A/B 최종 선택 또는 ADR 0003 Accepted 전환

Windows validator와 local hosting test 결과를 위 항목의 통과로 일반화하지 않는다.

## 후속 milestone 정합화

Phase 1B 완료 당시의 `Phase 1C — macOS VST3 Runtime Strategy Portability Spike` 제안은 후속 사용자
지시와 [ExecPlan 0005](../../plans/0005-phase-1c1-product-contracts-and-headless-windows-export.md)에
따라 superseded됐다. 현재 milestone은 `Phase 1C — Windows Product Creation Vertical Slice`이고,
Phase 1C.1 headless Windows export 뒤 Phase 1C.2 Studio Product Workspace/Export UX가 이어진다.
macOS VST3/AU/signing/notarization/실제 DAW 검증은 폐기하지 않고 첫 상용 배포 전 cross-platform
release gate로 이동했다. 이 변경은 Phase 1B Windows-only PASS나 ADR 0003 Proposed 상태를 바꾸지 않는다.
