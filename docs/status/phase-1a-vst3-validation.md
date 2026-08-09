# Phase 1A VST3 Validation Status

- 기준일: 2026-08-09
- 판정: **PASS**
- 관련 계획: [Phase 1A ExecPlan](../../plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)
- Dependency 근거: [Phase 1A VST3 Dependency](phase-1a-vst3-dependency.md)
- Identity 계약: [Phase 1A VST3 Identity](phase-1a-vst3-identity.md)

## 현재 판정

Windows x64 Debug/Release의 fresh configure, clean aggregate build, 3개 CTest, official validator
standard/extensive, first-party Werror/clang-format/clang-tidy와 Phase 0 regression이 모두
통과했다. 두 plugin module은 PE x64이고 bundle은 repository `out/` 아래에만 존재하므로 Phase
1A의 기술 수용 기준 판정은 **PASS**다.

이 판정은 macOS VST3, AU, signing/notarization, 실제 DAW host, 상용 배포 또는 전체 transitive
legal audit로 일반화하지 않는다.

## SDK와 dependency provenance

- SDK tag: `v3.8.0_build_66`
- SDK commit: `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`
- SDK superproject와 7개 nested repository는 parent gitlink와 같은 detached HEAD다.
- Superproject와 7개 nested worktree 모두 tracked/untracked 변경 없이 clean이다.
- 실제 plugin SDK target은 `sdk`, `sdk_common`, `base`, `pluginterfaces`다.
- Official validator와 contract-test host는 `sdk_hosting`을 사용하지만 plugin에는 link되지 않는다.
- 독립 tutorials license 범위와 commercial distribution notice/trademark를 포함한 transitive legal
  audit는 완료되지 않았다.

정확한 nested commit과 license hash는
[dependency inventory](../../third_party/dependencies.yml)에 기록한다.

## Windows x64 build와 CTest

모든 CMake 명령은 Visual Studio x64 Developer 환경에서 실행했다.

| Configuration | Configure/build | CTest | 결과 |
| --- | --- | --- | --- |
| Debug | `cmake --preset vst3-debug --fresh`; `cmake --build --preset vst3-debug-build --clean-first` | `ctest --preset vst3-debug-test --no-tests=error` | Aggregate build PASS; 3/3 PASS |
| Release | `cmake --preset vst3-release --fresh`; `cmake --build --preset vst3-release-build --clean-first` | `ctest --preset vst3-release-test --no-tests=error` | Aggregate build PASS; 3/3 PASS |

Aggregate target `garak_vst3_gain_spike_all`은 plugin, official `validator`와 다음 세 test executable을
함께 build한다.

- `garak_version_tests`
- `garak_gain_spike_tests`
- `garak_vst3_gain_contract_tests`

Contract test는 built bundle path를 직접 받아 module/factory/class identity, processor/controller,
bus/layout, 32/64-bit process, Gain/Bypass, editor 부재와 state restore 계약을 검증한다.

추가 edge contract는 independently pinned identity, 1..19바이트 short stream I/O, malformed와
throwing host queue, queue/point 작업량 상한, duplicate/non-monotonic automation과 20,000회
concurrent state handoff를 포함한다.

## First-party quality gates

| 검사 | 결과 |
| --- | --- |
| `vst3-werror` fresh configure + clean aggregate build | PASS; first-party compiling target에 `/WX` 적용 |
| `vst3-clang-tidy` fresh configure + clean aggregate build | PASS; first-party target만 분석, SDK source 제외 |
| `clang-format --dry-run --Werror` | `native/` 아래 first-party `.cpp`/`.hpp` 20개 PASS |
| 최종 formatter 후 rebuild | Debug/Release CTest 3/3, Werror와 clang-tidy 모두 재실행 PASS |

첫 clang-tidy 실행은 새 header의 `#pragma once`, 쉽게 뒤바뀌는 인자와 MSVC 예외 분석 설정을
찾아 실패했다. Include guard와 context value로 수정하고 clang-tidy의 MSVC 분석 인자를 실제
compiler와 같은 `/EHsc`로 맞췄다. 첫 전체 format check도 구현 파일 네 곳의 줄바꿈을 찾아
실패했으며 formatter 적용 뒤 전체 20개를 재검사하고 모든 build/test를 다시 동기화했다.

## Official validator

Pinned SDK source로 build한 각 configuration의 `validator.exe`에 local bundle path를 직접 전달했다.
Wrapper 명령은 다음과 같다.

```text
tools\vst3\validate.ps1 -Configuration Debug
tools\vst3\validate.ps1 -Configuration Release
```

각 wrapper는 standard와 `-e` extensive run을 별도 실행한다. 최종 bundle에 대한 네 validator
process는 모두 exit 0이고 processor/controller 두 class를 발견했으며 crash, warning과 failed
test는 0이다.

| Configuration | Mode | 결과 | 원문 report |
| --- | --- | --- | --- |
| Debug | Standard | 47/47 PASS, exit 0 | `out/reports/vst3/debug-validator-standard.txt` |
| Debug | Extensive | 537/537 PASS, exit 0 | `out/reports/vst3/debug-validator-extensive.txt` |
| Release | Standard | 47/47 PASS, exit 0 | `out/reports/vst3/release-validator-standard.txt` |
| Release | Extensive | 537/537 PASS, exit 0 | `out/reports/vst3/release-validator-extensive.txt` |

Reports는 ignored local evidence이며 source 또는 distributable plugin payload가 아니다.

## Binary와 bundle 경계

| 검사 | 결과 |
| --- | --- |
| Debug module | `out/build/vst3-debug/VST3/Debug/Garak Gain Spike.vst3/Contents/x86_64-win/Garak Gain Spike.vst3`; PE `8664 machine (x64)` |
| Release module | `out/build/vst3-release/VST3/Release/Garak Gain Spike.vst3/Contents/x86_64-win/Garak Gain Spike.vst3`; PE `8664 machine (x64)` |
| VSTGUI configure | Debug/Release CMake cache 모두 `SMTG_ENABLE_VSTGUI_SUPPORT=OFF` |
| VSTGUI link | Debug/Release plugin link command hit 0 |
| Optional resources | Final bundle icon 0, `moduleinfo.json` 0 |
| Plugin install/link | `SMTG_CREATE_PLUGIN_LINK=OFF`; system/global VST3 link 없음 |

두 bundle은 각각 `out/build/vst3-debug`와 `out/build/vst3-release` 아래 local artifact다. Validator는
이 local path를 검사했으며 system VST3 directory에 copy/install/link하지 않았다.

## Phase 0 regression

Phase 1A opt-in integration 뒤에도 기본 Phase 0 path를 다시 실행했다.

| 영역 | 결과 |
| --- | --- |
| Native Debug | Configure/build PASS; `garak_version_tests` 1/1 PASS; smoke PASS |
| Native Release | Configure/build PASS; `garak_version_tests` 1/1 PASS; smoke PASS |
| Native quality | Phase 0 warnings-as-errors와 clang-tidy fresh/clean build PASS |
| Studio | `pnpm install --frozen-lockfile`, lint, format check, typecheck와 production build 모두 PASS |

Studio dependency나 JavaScript runtime은 plugin target 또는 bundle에 포함되지 않는다.

## 수행하지 않은 검증

- macOS VST3, Apple Clang/Xcode와 Universal binary
- AU, signing, notarization, installer와 실제 DAW host compatibility
- Commercial distribution을 위한 transitive license/notice/trademark legal review
- Generated runtime A/B, `.garak`, Studio/native IPC와 product export

이 항목은 Phase 1A의 명시적 비범위다. 후속 단계의 별도 수용 기준 없이 이번 Windows 기술
PASS를 해당 영역의 승인이나 완료로 해석하지 않는다.
