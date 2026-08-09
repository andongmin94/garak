# ExecPlan 0003 — Phase 1A Windows Minimal VST3 Gain Shell

- Status: Complete — PASS
- Started: 2026-08-09
- Updated: 2026-08-09
- Owner: Garak native/VST3 adapter

## 목적

공식 Steinberg VST3 SDK를 exact Git pin의 third-party submodule로 통합하고, Windows x64에서 `Garak Gain Spike`라는 고정 metadata의 editorless VST3 audio effect를 Debug와 Release로 빌드한다. Plugin factory, processor, controller, audio bus, Gain/Bypass parameter, sample-offset automation, versioned state와 official validator 경로를 가장 작은 기술 spike로 검증한다.

이 계획은 Phase 1 전체가 아니라 Phase 1A 하나만 책임진다. 성공하더라도 generated runtime 전략, product compiler 또는 Garak Engine API를 확정하지 않는다.

## 사용자 가치

Phase 0의 buildable scaffold 위에서 실제 DAW plugin format 경계가 작동한다는 첫 재현 가능한 증거를 만든다. 개발자는 공식 SDK의 class registration, automation, state와 validator 제약을 문서나 추측이 아닌 local Windows x64 artifact와 test 결과로 확인할 수 있다.

## 시작 commit과 Git 상태

- 시작 branch: `master`
- 시작 commit: `ef71c755ee84a9b82d6589365711211fdbc62f58` (`Establish Phase 0 baseline`)
- 시작 working tree: clean (`git status --short --branch`는 `## master`만 출력)
- Phase 0A/0B 기준선: 64개 tracked file로 보존
- 사용자 변경: 시작 시 없음
- 이번 plan에서는 후속 commit, amend, rebase 또는 branch 변경을 하지 않는다.

초기에는 commit이 없어 Phase 1A 사전조건을 충족하지 못했다. 사용자에게 보고한 뒤 사용자가 명시적으로 기준 commit 생성을 요청하여 위 root commit을 만들었고, clean 상태를 재확인한 뒤 본 작업을 재개했다.

## 현재 Windows toolchain

Phase 0B에서 검증한 환경을 기준으로 하며 Phase 1A 시작 시 실제 command와 version을 다시 확인한다.

| 도구 | 기준 version 또는 경계 |
| --- | --- |
| OS | Windows 10.0.26200, x64 |
| Visual Studio | Community 2026 18.7.3 |
| MSVC | 19.51.36248, x64 toolset 14.51.36231 |
| CMake | 4.3.1-msvc1 |
| Ninja | 1.13.2 |
| clang-format / clang-tidy | 22.1.3 / 22.1.3 |
| Git | 2.55.0.windows.3 |
| Node.js / pnpm | 24.19.0 / 11.16.0 |

Native 명령은 `VsDevCmd.bat -arch=x64 -host_arch=x64`로 구성한 Visual Studio x64 Developer 환경에서 실행한다. Windows 결과를 macOS나 Apple Clang 통과로 일반화하지 않는다.

## 범위

- 공식 `steinbergmedia/vst3sdk`의 `v3.8.0_build_66` tag를 `third_party/vst3sdk` Git submodule로 exact pin
- 필요한 nested submodule 초기화와 license/notice/dependency 기록
- `GARAK_BUILD_VST3_GAIN_SPIKE=OFF` 기본값의 opt-in CMake integration
- 별도 Debug, Release, warnings-as-errors VST3 preset과 local-only bundle output
- fixed identity의 editorless VST3 module, processor와 edit controller
- mono→mono와 stereo→stereo main audio bus, float32/float64 processing
- Gain `-60 dB..+12 dB`, default `0 dB`, normalized mapping과 sample-offset automation
- automatable VST3 bypass parameter와 sample-offset transition
- explicit byte contract의 schema 1 processor state와 controller restore
- Steinberg type에 독립적인 Gain/automation/state helper test
- factory/component/controller를 실제 생성하는 VST3 contract test
- pinned SDK source의 official validator를 Debug/Release local bundle에 실행
- Phase 0 Native와 Studio regression, first-party warnings/format/tidy, repository hygiene
- actual evidence를 dependency, identity, validation, architecture, ADR 0003, status와 plan에 기록

## 비범위

- `.garak`, compiled runtime blob, product compiler, generated runtime A/B 구현 또는 채택
- 범용 `garak::AudioBlock`, `garak::Parameter`, `garak::Plugin`, `garak::PluginRuntime` 또는 DSP graph
- product별 runtime 복제, binary patch, manifest loader, wrapper generator와 Studio/native IPC
- Node.js native addon, Studio 기능·dependency·script 변경
- macro, preset browser, custom editor, VSTGUI, meter, asset, program list와 custom GUI
- JUCE, Skia, CanvasKit, Yoga, XYFlow, miniaudio, KissFFT와 FlatBuffers
- MIDI/event bus, sidechain, instrument, synthesizer와 process-context 기능
- AU, macOS build, Universal binary, signing, notarization, installer와 DAW 설치
- global/system/user VST3 directory write, registry 변경과 관리자 권한 설치
- telemetry, network backend, repository root `LICENSE`와 Phase 2 code

## 전제와 제약

- Root와 nested `AGENTS.md`, Accepted ADR 0001/0002/0004, Proposed ADR 0003을 따른다.
- SDK와 nested source는 upstream 원본으로 유지하고 Garak formatting/tidy/warnings-as-errors를 강제하지 않는다.
- Steinberg type은 `native/adapters/vst3` 안에만 머물고 pure Gain/state helper는 SDK type에 의존하지 않는다.
- `process`와 그 하위 경로에는 allocation/deallocation, lock/wait, I/O, logging, formatting, string construction, exception 전파와 구조 변경이 없다.
- 기존 Phase 0 Native configure는 SDK가 초기화되지 않아도 VST3 option OFF로 계속 작동해야 한다.
- Plugin bundle과 validator report는 `out/` 아래에만 생성하며 Git 대상에서 제외한다.
- Root repository license는 계속 미정이다. Third-party 원문 license는 보존하고 별도로 기록한다.
- Official validator Debug/Release 실행이 하나라도 불가능하면 Phase 1A를 PASS로 판정하지 않는다.

## 공식 SDK 조사 결과

조사와 local checkout 대조 결과는 다음과 같다.

- Official repository: `https://github.com/steinbergmedia/vst3sdk.git`
- Required/exact tag: `v3.8.0_build_66`
- Superproject commit: `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`
- Acquisition: Git submodule at `third_party/vst3sdk`, recursive nested submodule initialization
- Nested gitlinks: `base` `3d2e82f8e6bff59c1d8b7a27491a29c2286b5206`, `cmake`
  `de6e54eeaaab35b7145f5c32c279b5e892146e04`, `doc`
  `6d4737c9e70750056e731d88d49aa06eefc8a1a4`, `pluginterfaces`
  `31d6eeba6daaa3e2a8bfbe3e7a90ca0b7fbfbc1c`, `public.sdk`
  `a3911a4615dabbfdfd9d181ee26b05c70c289a95`, `tutorials`
  `33b73dfbb87f3fde3bce8c0a10cae934dc66ad34`, `vstgui4`
  `76823bdbe286e4bdb9f79ab8986af5ce7202336c`
- Superproject와 7개 nested repository: initialized, detached, tracked/untracked clean
- Plugin targets: `sdk`, `sdk_common`, `base`, `pluginterfaces`; validator/contract host:
  `sdk_hosting`
- VSTGUI support, examples, plugin link와 optional moduleinfo: OFF

SDK, nested license와 hash는 inventory에 기록했다. `tutorials`의 독립 license 적용 범위와 commercial
distribution의 transitive notice/trademark audit는 아직 완료되지 않았다.

## SDK pin과 dependency 방식

- `.gitmodules`에 official HTTPS URL과 `third_party/vst3sdk` path를 기록한다.
- Superproject gitlink는 required tag가 가리키는 exact commit에 고정한다. Floating branch를 기록하지 않는다.
- `git submodule update --init --recursive`로 nested dependency를 재현한다.
- Archive copy, package manager fetch와 configure-time network fetch를 사용하지 않는다.
- SDK example source를 Garak product source로 복사하지 않는다. 공식 interface와 documentation을 근거로 first-party code를 독립 작성한다.
- 불가피한 upstream patch가 없으면 SDK source를 수정하지 않는다. 필요해지면 먼저 원인, 최소 diff와 upstream 근거를 기록하고 PASS 여부를 재평가한다.

## VST3 module 구조

예상 first-party 구조는 다음 책임 경계를 따른다. 실제 pinned SDK CMake contract에 맞춰 파일 이름은 갱신할 수 있다.

```text
native/adapters/vst3/
  AGENTS.md
  CMakeLists.txt
  gain_spike/
    identifiers.hpp
    version.hpp
    processor.hpp/.cpp
    controller.hpp/.cpp
    state_codec.hpp/.cpp
    factory.cpp
native/spikes/gain/
  gain_kernel.hpp/.cpp
  automation.hpp
native/tests/
  gain_spike_tests.cpp
  vst3_gain_contract_tests.cpp
tools/vst3/
  validate.ps1
```

Plugin target은 official SDK helper와 `sdk`, `sdk_common`, `base`, `pluginterfaces`를 사용한다.
Official validator와 loaded contract host는 별도 `sdk_hosting`을 사용하며 plugin에는 link하지 않는다.
`garak_core` public API나 public include tree에는 spike API 또는 Steinberg type을 추가하지 않는다.
VSTGUI target을 build/link하지 않는다.

## Processor/Controller 경계

- Processor는 audio bus arrangement, sample precision, current Gain/Bypass state, processing과 component state를 소유한다.
- Controller는 host-visible Gain/Bypass metadata와 text conversion, fixed parameter ID, component-state restore를 소유한다.
- Processor와 controller는 서로 다른 fixed FUID를 factory에 등록하고 controller class association을 명시한다.
- Processor는 controller view 없이 initialize/setup/activate/process/state/terminate가 동작한다.
- `createView`는 custom editor를 만들지 않고 null을 반환한다.
- Event/MIDI bus, sidechain, program list, note expression과 UI data exchange를 등록하지 않는다.

## Plugin identity와 parameter 계약

- Vendor: `Garak`
- Plugin name: `Garak Gain Spike`
- Category: VST3 audio effect / `Fx`
- Version: `0.1.0`
- Component FUID: `3D6F3C09296D49EF99334C4688F484EE`
- Controller FUID: `2CD50BAE587A4F3E812399E550F352D4`
- Gain parameter: ID `1001`, automatable continuous value
- Bypass parameter: ID `1002`, automatable toggle와 VST3 bypass flag

FUID/parameter ID는 timestamp, path 또는 build마다 계산하지 않는다. 이 identity는 기술 spike 전용이고 상용 product identity가 아니다.

## Gain, automation과 bypass 처리 방안

Gain normalized domain은 `[0, 1]`이고 physical mapping은 `-60 dB..+12 dB`의 linear mapping이다. `0 dB`를 normalized default로 역산하고 dB를 `10^(dB/20)` linear amplitude로 바꾼다. Non-finite 또는 범위 밖 host value는 documented finite clamp policy로 처리한다.

Process 시작 시 이전 block의 current normalized Gain/Bypass를 사용한다. Parameter queue point는 heap
container로 복사하지 않고 bounded index traversal로 읽는다. Gain은 sample offset 순서의 유효 point
사이 normalized domain에서 sample별 선형 보간한 뒤 dB/linear gain으로 변환한다. Bypass는 각 유효
point offset부터 toggle 상태를 적용하고 crossfade/de-clicking을 만들지 않는다. 같은 offset은
마지막 point가 이기며 non-monotonic, invalid offset, failed point read 또는 같은 ParamID의 duplicate
queue는 해당 parameter의 block automation 전체를 무시한다. Block 종료 값은 다음 block current
value로 보존한다.

Host traversal은 queue count 최대 2와 block-derived point cap으로 제한한다. Point cap은
`numSamples <= 1 ? 2 : min(INT_MAX, 2 * numSamples)`이며 overflow 없이 계산한다. Cap 초과는
`getPoint` 전에 거부하고 queue count 초과는 queue data callback 전에 거부한다. Host
`getParameterCount` 또는 `getPoint`가 throw하면 top-level exception boundary가 failure로 변환하며
live state를 변경하지 않는다.

In-place bypass는 복사하지 않고, out-of-place bypass는 채널별 정확히 복사한다. Gain/bypass를 함께 처리할 때 같은 sample의 정의된 parameter event 순서가 test와 문서에 일치해야 한다.

## State 계약

Processor state schema 1은 ASCII magic `GGS1`, little-endian `uint32` version 1, normalized Gain의
IEEE-754 binary64 bits와 little-endian `uint32` Bypass를 정확히 20바이트로 기록한다. Raw C++
struct, JSON, pointer, `size_t`와 compiler ABI representation을 사용하지 않는다.

Decode는 임시 local value에 전체 state를 읽고 magic/version/length/finite/range/bypass representation을
모두 검증한 뒤에만 live state에 commit한다. Truncated, short-success, corrupt, unsupported 또는
invalid value는 기존 유효 state를 부분 변경하지 않고 거부한다. Processor `setState`는 generation과
sequence-lock snapshot을 통해 다음 process 경계에 넘기고 controller `setComponentState`는 같은 state를
host parameter value에 반영한다. Forward migration framework는 만들지 않는다.

## Realtime와 audio policy

- Processing kernel은 SDK-independent이고 가능한 연산 경로를 `noexcept`로 둔다.
- Host-owned channel pointer, channel count, sample count와 precision을 검사한다.
- Mono/mono와 stereo/stereo만 수용하고 mismatch, zero bus, surround와 추가 main bus를 거부한다.
- Float32/float64만 지원하고 다른 symbolic precision은 거부한다.
- Zero-sample과 parameter-only call에서도 state/automation point를 안전하게 처리한다.
- Input silence flag를 실제 buffer 처리와 일치하게 전파/계산하고 output silence flag를 허위로 설정하지 않는다.
- Non-finite parameter는 finite clamp/default 정책으로 방어한다. NaN/Inf audio input은 숨기거나 heap sanitize pass를 만들지 않고 적용 정책을 test/status에 기록한다.
- Denormal 가능성을 조사하고 현재 단순 multiply에서 필요한 최소 정책만 채택한다.

## 테스트 전략

새 test framework 없이 standalone CTest executable을 사용한다. `assert`가 아니라 구체적인 stderr와 non-zero exit를 사용한다.

### Pure first-party test

- normalized↔dB endpoint/default/clamp와 dB→linear unity/minimum/positive gain
- mono/stereo, float32/float64, in-place/out-of-place, zero samples
- automation 0/1/multiple point, offset 0/middle/final, exact expected sample value
- duplicate/non-monotonic/invalid point defensive behavior
- bypass off/on/transition, parameter-only call와 block-to-block state continuity
- state schema 1 round trip, 모든 truncated length, magic/version/value corruption과 no-partial-damage

### VST3 contract test

- Factory class discovery, component/controller FUID와 category
- Component/controller initialize/terminate와 class association
- One main input/output, mono/stereo arrangement, no event/sidechain bus
- Float32/float64 capability
- Gain/Bypass metadata, fixed ID/default/flags
- Unity, automated gain, bypass와 state/controller restore processing
- Malformed/non-monotonic/invalid/duplicate queue와 prepared maximum block boundary
- 1..19-byte short-success state read/write와 processor/controller no-partial-damage
- Process thread와 20,000회 state 교환을 겹친 generation/sequence-lock handoff
- Queue count 2/3/`INT_MAX`, 4-sample point 8/9/`INT_MAX`, zero-sample point 2/3 work cap
- Throwing `getParameterCount`/`getPoint`의 failure 변환과 no-state-mutation
- Source 상수를 공유하지 않는 independent literal identity와 baseline main exception boundary
- Editor creation 부재

Black-box validator가 first-party deterministic behavior test를 대신하지 않는다.

## Official validator 전략

Pinned open-source SDK source의 validator target을 실제 CMake graph에서 확인해 같은 toolchain으로 build한다. Prebuilt proprietary/third-party validator를 받지 않는다. Debug와 Release `.vst3` local bundle path를 validator executable에 직접 전달하고 원문 report는 `out/reports/vst3/`에 보존한다.

각 run에 SDK tag/full commit, executable path, plugin path, exact command, exit code, discovered class, test/warning/failure count와 crash 여부를 기록한다. Exit 0, conformity failure 0, crash 0, module load와 processor/controller discovery가 모두 확인되어야 해당 configuration이 통과한다. Warning은 정보성 SDK output과 first-party defect로 분류하고 숨기지 않는다.

## 구현 또는 문서화 단계

1. [x] 필수 문서, Git, Phase 0 파일과 실제 Native/Studio 명령을 확인한다.
2. [x] baseline commit과 clean working tree를 확보하고 본 ExecPlan을 구현 전에 작성한다.
3. [x] Official upstream tag/commit, CMake API, nested dependency와 license를 조사한다.
4. [x] SDK submodule을 exact pin으로 추가하고 recursive checkout과 dependency 문서를 작성한다.
5. [x] Opt-in CMake option/preset과 third-party warning/install 경계를 구성한다.
6. [x] Pure Gain/automation/state helper와 standalone test를 구현하고 검증한다.
7. [x] Fixed identity의 processor/controller/factory와 VST3 contract test를 구현한다.
8. [x] Debug/Release/Werror/tidy/format build와 tests를 실행하고 결함을 수정한다.
9. [x] Official validator를 Debug/Release bundle에 실행하고 x64/local-only artifact를 확인한다.
10. [x] Phase 0 Native와 Studio regression을 실행한다.
11. [x] Architecture/ADR/dependency/identity/validation/status/README/ROADMAP 문서를 실제 결과로 갱신한다.
12. [x] 전체 diff, link, text, dependency, license, scope와 generated-output hygiene를 독립 감사한다.
13. [x] 수용 기준을 모두 대조하고 본 plan의 발견·결정·완료 기록과 최종 판정을 갱신한다.

## 변경 대상 파일

예상 생성·수정 범위이며 실제 SDK contract에 따라 본 목록을 갱신한다.

- `/.gitmodules`
- `/CMakeLists.txt`
- `/CMakePresets.json`
- `/.gitignore`
- `/cmake/GarakOptions.cmake`
- `/native/CMakeLists.txt`
- `/native/AGENTS.md`
- `/native/adapters/vst3/AGENTS.md`
- `/native/adapters/vst3/CMakeLists.txt`
- `/native/adapters/vst3/gain_spike/*`
- `/native/spikes/gain/*`
- `/native/tests/CMakeLists.txt`
- `/native/tests/gain_spike_tests.cpp`
- `/native/tests/vst3_gain_contract_tests.cpp`
- `/tools/vst3/validate.ps1`
- `/third_party/vst3sdk` Git submodule
- `/third_party/README.md`
- `/third_party/dependencies.yml`
- `/third_party/notices/README.md`
- `/docs/architecture/vst3-adapter.md`
- `/docs/architecture/dependency-policy.md`
- `/docs/adr/0003-generated-plugin-runtime-strategy.md`
- `/docs/status/phase-1a-vst3-dependency.md`
- `/docs/status/phase-1a-vst3-identity.md`
- `/docs/status/phase-1a-vst3-validation.md`
- `/docs/status/current.md`
- `/AGENTS.md`
- `/README.md`
- `/ROADMAP.md`
- 본 ExecPlan

Studio source, manifest, lockfile와 dependency는 수정하지 않는다.

## 검증 명령

실제 preset/target/artifact 이름을 구현 후 정확히 갱신한다. Native/CMake 명령은 Visual Studio x64 Developer 환경에서 실행한다.

```text
git submodule status --recursive
cmake --list-presets=all

cmake --preset debug
cmake --build --preset debug-build
ctest --preset debug-test --no-tests=error
out\build\debug\native\apps\garak_smoke\garak_smoke.exe

cmake --preset release
cmake --build --preset release-build
ctest --preset release-test --no-tests=error
out\build\release\native\apps\garak_smoke\garak_smoke.exe

cmake --preset debug-warnings-as-errors
cmake --build --preset warnings-as-errors-build --clean-first
cmake --preset debug-clang-tidy
cmake --build --preset clang-tidy-build --clean-first

cmake --preset vst3-debug --fresh
cmake --build --preset vst3-debug-build --clean-first
ctest --preset vst3-debug-test --no-tests=error

cmake --preset vst3-release --fresh
cmake --build --preset vst3-release-build --clean-first
ctest --preset vst3-release-test --no-tests=error

cmake --preset vst3-werror
cmake --build --preset vst3-werror-build --clean-first
cmake --preset vst3-clang-tidy
cmake --build --preset vst3-clang-tidy-build --clean-first

tools\vst3\validate.ps1 -Configuration Debug
tools\vst3\validate.ps1 -Configuration Release

pnpm install --frozen-lockfile
pnpm studio:lint
pnpm studio:format:check
pnpm studio:typecheck
pnpm studio:build
```

추가 검사는 first-party `.cpp/.hpp`만 대상으로 한 `clang-format --dry-run --Werror`, target-scoped clang-tidy, PE x64 header, bundle/module 존재, root license 부재, VSTGUI/JUCE/Studio/Phase 2 scope와 Git/text/link hygiene를 포함한다.

## 현재 검증 결과

| 영역 | 결과 |
| --- | --- |
| VST3 Debug | Fresh configure/clean aggregate build exit 0; formatter 뒤 incremental build와 CTest 3/3 exit 0 |
| VST3 Release | Fresh configure/clean aggregate build exit 0; formatter 뒤 incremental build와 CTest 3/3 exit 0 |
| VST3 Werror | Fresh configure/clean build와 final incremental build exit 0 |
| clang-format | First-party `.cpp`/`.hpp` 20개 apply/check exit 0 |
| VST3 clang-tidy | Fresh configure/clean build와 final incremental build exit 0 |
| Debug validator | Final bundle standard 47/47, extensive 537/537, warning 0, 두 run exit 0 |
| Release validator | Final bundle standard 47/47, extensive 537/537, warning 0, 두 run exit 0 |
| Binary/bundle | Debug/Release PE `8664 machine (x64)`; local-only; VSTGUI/plugin link/resource 없음 |
| Phase 0 regression | Native Debug/Release fresh/clean 1/1와 exact smoke, Werror/tidy fresh/clean PASS; Studio frozen/lint/format/typecheck/build rerun PASS, direct dependency 16개 |

Validator 원문은 `out/reports/vst3/debug-validator-standard.txt`,
`out/reports/vst3/debug-validator-extensive.txt`,
`out/reports/vst3/release-validator-standard.txt`와
`out/reports/vst3/release-validator-extensive.txt`에 있다.
모든 Phase 1A 필수 gate와 closeout audit가 통과했으므로 최종 판정은 **PASS / Complete**다.
Windows 결과를 macOS, DAW host 또는 commercial/legal readiness로 일반화하지 않는다.

## 수용 기준

### Dependency

- Official SDK가 exact tag/commit gitlink로 존재하고 nested submodule checkout을 재현한다.
- Top-level/nested license와 실제 linked SDK 구성은 기록되며 SDK 원본 수정/재format이 없다.
- VSTGUI는 plugin link graph에 없고 floating branch나 configure-time fetch가 없다.

### Build와 regression

- Phase 0 Native Debug/Release/test/smoke/Werror/tidy와 Studio frozen install/lint/format/typecheck/build가 계속 통과한다.
- VST3 Debug/Release x64 local bundle, first-party Werror/format/tidy와 tests가 통과한다.
- SDK warning 때문에 Garak warning policy를 낮추지 않고 global VST3 directory를 쓰지 않는다.

### Plugin behavior

- Factory가 fixed component/controller class를 발견하고 one main audio input/output만 노출한다.
- Mono/mono, stereo/stereo와 float32/float64를 지원한다.
- Fixed ID의 automatable Gain/Bypass만 존재하고 custom editor/event/MIDI/sidechain이 없다.
- Default unity, exact mapping, sample-accurate multiple-point Gain과 bypass, in/out-of-place, zero/parameter-only call을 test한다.
- Queue count와 point traversal은 documented block-derived cap 안에 있고 over-cap은 data callback 전에
  거부한다.
- Throwing host count/point callback은 top-level failure로 변환하며 live state를 변경하지 않는다.
- Schema 1 state round trip, corruption rejection와 processor/controller restore가 통과한다.
- Process 경로에 allocation, blocking, I/O, logging, formatting 또는 exception propagation이 없다.

### Validation와 documentation

- Official validator Debug와 Release가 exit 0, conformity failure 0, crash 0으로 module/classes를 확인한다.
- Bundle module의 x64 architecture와 actual paths/commands/results를 기록한다.
- Exact SDK pin, identity/FUID/parameter ID, license와 미검증 macOS가 문서화된다.
- ADR 0003은 Proposed이며 Phase 1 전체 또는 A/B 전략이 완료/채택으로 표시되지 않는다.

필수 항목 하나라도 실행되지 않으면 PASS가 아니다. 특히 official validator를 build/run하지 못하면 Phase 1A는 `CONDITIONAL PASS` 또는 `FAIL`이다.

## 리스크

- SDK 3.8.0과 MSVC 19.51/CMake 4.3의 compatibility 문제 또는 upstream warning이 있을 수 있다.
- SDK superproject의 nested submodule과 license graph가 예상보다 크며 VSTGUI가 checkout되더라도 plugin link에서 명시적으로 제외해야 한다.
- SDK helper의 default plugin link/install 동작이 system VST3 directory를 쓸 수 있어 exact option 검증이 필요하다.
- Validator가 broad SDK test target과 결합되어 build 시간이나 optional GUI dependency를 끌어올 수 있다.
- VST3 process queue의 ordering/duplicate semantics를 잘못 추정하면 sample-offset behavior가 host마다 달라질 수 있다.
- Silence flag, parameter-only block과 controller state restore는 host/validator가 unit test와 다른 lifecycle 순서를 사용할 수 있다.
- Windows validator 성공은 actual DAW, macOS VST3, AU 또는 commercial package readiness가 아니다.
- Fixed C++ metadata 한 개의 성공은 runtime packaging A/B 비교를 완료하지 않는다.

## 발견 사항

- 2026-08-09: 첫 사전확인에서는 Git repository에 commit이 없어 사용자 지시대로 작업을 중단했다.
- 2026-08-09: 사용자가 local baseline commit 생성을 명시적으로 요청하여 Phase 0의 64개 파일을 root commit `ef71c755ee84a9b82d6589365711211fdbc62f58`로 기록했다. 이후 working tree가 clean임을 확인했다.
- 2026-08-09: Existing docs의 Debug/Release/Werror/tidy 및 Studio script 이름은 실제 `CMakePresets.json`과 package manifest에 일치한다.
- 2026-08-09: Existing VST3 option/target/dependency는 없으며 SDK가 초기화되지 않은 Phase 0 path를 보존할 수 있다.
- 2026-08-09: Sandboxed first configure는 compiler ABI detection에서 CMake 오류 없이 60초/180초
  timeout됐다. Visual Studio x64 Developer 환경의 escalated `--fresh` configure는 성공했다.
- 2026-08-09: Pure test compile은 MSVC의 nested-brace `std::array` CTAD 실패를 explicit element
  type/size로 수정했다. Contract compile은 namespace-qualified VST3 string macro를 bare SDK macro로
  바꿔 해결했다.
- 2026-08-09: Contract link의 unresolved `VST3::Hosting::Module::create`는 pinned SDK
  `module_win32.cpp`를 isolated third-party loader target으로 만들고 `/Zc:__cplusplus`로
  `sdk_hosting`에 연결해 해결했다.
- 2026-08-09: 첫 CTest는 aggregate의 version test dependency 누락과 nested generator expression의
  bundle path 미평가로 실패했다. Dependency와 `TARGET_GENEX_EVAL`을 추가한 뒤 Debug/Release 3/3을
  확인했다.
- 2026-08-09: Loaded processing test는 inherited `AudioEffect::setProcessing`이 `kNotImplemented`를
  반환해 실패했다. Stateless minimal override를 추가한 뒤 contract test와 validator를 통과했다.
- 2026-08-09: 후속 감사에서 `maxSamplesPerBlock` 경계와 state snapshot race를 발견했다. Bound
  reject/test, generation/sequence-lock handoff와 20,000회 concurrent test를 추가하고 주요
  build/test/validator를 재검증했다.
- 2026-08-09: Phase 1A 첫 clang-tidy는 `portability-avoid-pragma-once`,
  `bugprone-easily-swappable-parameters`와 exceptions-disabled `try` diagnostic 등으로 실패했다.
  Header guard, parameter API와 exception boundary를 수정하고 fresh/clean 및 final incremental
  clang-tidy build를 모두 exit 0으로 재검증했다.
- 2026-08-09: 첫 전체 clang-format check는 새 first-party source의 format 차이로 실패했다. 20개
  `.cpp`/`.hpp`에 formatter를 적용한 뒤 Debug/Release/CTest/Werror/tidy incremental regression과
  전체 format check를 모두 exit 0으로 재실행했다.
- 2026-08-09: Automation traversal 감사에서 arbitrary host queue/point count가 unbounded work를
  만들 수 있음을 발견했다. Queue count 2와 block-derived point cap을 추가하고 4-sample 8/9,
  zero-sample 2/3, `INT_MAX`, throwing host 경계를 contract test로 고정했다.

## 의사결정 로그

- 2026-08-09: Phase 0 baseline은 사용자의 직접 요청으로 한 번만 commit했고 Phase 1A 변경은 commit하지 않기로 했다.
- 2026-08-09: VST3 integration은 default OFF option과 separate build directory로 격리하여 core build가 SDK checkout에 의존하지 않게 한다.
- 2026-08-09: Spike helper는 private first-party source로 유지하고 `garak_core` 또는 추측성 generic plugin API로 승격하지 않는다.
- 2026-08-09: State는 schema 1 explicit binary contract만 구현하고 migration framework나 compiled runtime blob을 만들지 않는다.
- 2026-08-09: ADR 0003 A/B는 모두 미결정으로 유지하며 fixed-metadata module에서 관찰한 사실만 추가한다.
- 2026-08-09: VSTGUI, examples, optional moduleinfo/icon과 system/user plugin link를 끄고 validator와
  bundle을 repository `out/` 아래 local artifact로만 유지한다.
- 2026-08-09: Non-realtime completed state를 더 오래된 process snapshot이 덮지 않도록 generation과
  sequence-lock publication을 채택하되 범용 Garak runtime abstraction으로 승격하지 않는다.
- 2026-08-09: Host automation traversal은 queue 2와
  `numSamples <= 1 ? 2 : min(INT_MAX, 2 * numSamples)` point로 제한해 realtime 작업량 상한을
  block 크기와 연결한다.

## 완료 기록

**PASS / Complete.** Final source의 Debug/Release fresh configure와 clean aggregate build,
formatter-triggered incremental build, CTest 3/3, Werror, clang-tidy와 first-party 20-file
clang-format이 모두 exit 0이다. Final Debug/Release bundle validator는 standard 47/47, extensive
537/537, warning 0, exit 0이며 두 module은 PE x64다. Phase 0 Native/Studio regression과 repository
closeout audit도 PASS다.

이 판정은 Phase 1A Windows x64 fixed-metadata adapter spike에만 적용한다. Phase 1 전체, macOS,
AU, 실제 DAW host, commercial distribution과 transitive legal audit는 완료 또는 승인하지 않는다.

## 다음 단계

Phase 1B는 시작하지 않았다. 후속 작업은 별도 ExecPlan에서 fixed plugin evidence를 사용해 product
identity와 runtime A/B 전략을 같은 수용 기준으로 비교해야 한다. ADR 0003은 계속 Proposed이며 이
계획에서는 A/B 어느 대안도 선택하거나 구현하지 않는다. macOS VST3, AU, 실제 DAW host와
commercial/transitive legal 검증도 후속 범위로 남긴다.
