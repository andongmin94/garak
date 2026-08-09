# Garak Current Status

- 기준일: 2026-08-09
- 현재 phase: Phase 1 — Minimal Native VST3 Shell
- Phase 0A 판정: PASS
- Phase 0B 판정: PASS
- Phase 1A 판정: **PASS / Complete**
- Phase 1 전체 판정: 미완료
- 다음 phase: Phase 1B 미착수

## 요약

Phase 0A/0B의 제품·architecture·운영 기준선과 두 개발 loop를 보존한 채 Phase 1A Windows x64
기술 spike를 완료했다. Exact-pin Steinberg SDK의 editorless `Garak Gain Spike`는 Debug/Release
fresh/clean build와 formatter 뒤 incremental rebuild, CTest 3/3, Werror, clang-tidy 및 first-party
20개 C++ file의 clang-format을 모두 exit 0으로 통과했다. Official validator 최종 bundle rerun도
두 configuration에서 standard 47/47, extensive 537/537, warning 0, exit 0이다. Phase 0 Native와
Studio regression도 최종 PASS다.

Phase 1A는 **PASS / Complete**지만 Phase 1 전체는 미완료다. ADR 0003은 계속 Proposed이며 macOS,
AU, 실제 DAW host, commercial distribution과 transitive legal audit는 검증하지 않았다.

## 저장소 초기 상태와 보존

- 2026-08-09 최초 조사 시 작업 루트는 비어 있었고 Git 저장소가 아니었다.
- 기존 파일, commit 또는 보존할 사용자 변경사항은 발견되지 않았다.
- Phase 0A에서는 허용된 범위에서 `git init`만 수행했고 당시 commit은 만들지 않았다.
- 사용자 파일을 삭제, 덮어쓰기 또는 reset한 작업은 없다.
- Phase 0B 시작 시 Phase 0A 파일 24개는 commit이 없는 `master`에서 모두 untracked였으며 24/24를 보존했다.
- Phase 0B에서도 commit이나 branch 변경, destructive Git 명령을 수행하지 않았다.
- Phase 1A 시작 전 사용자의 명시적 요청으로 Phase 0의 64개 파일을 root commit
  `ef71c755ee84a9b82d6589365711211fdbc62f58` (`Establish Phase 0 baseline`)에 기록했다.
- 그 commit 직후 clean working tree를 확인했으며 Phase 1A 변경은 commit하지 않았다.

## 현재 존재하는 기준선

- [제품 비전](../product/vision.md), [사용자와 사용 사례](../product/users-and-use-cases.md), [v0.1 PRD](../product/v0.1-prd.md)
- [System Overview](../architecture/system-overview.md)를 포함한 architecture 문서 8개
- Accepted ADR 3개와 Proposed ADR 1개
- 저장소 헌법 [AGENTS.md](../../AGENTS.md)와 [ExecPlan 규약](../../PLANS.md)
- [ROADMAP](../../ROADMAP.md), [README](../../README.md)와 [Phase 0A ExecPlan](../../plans/0001-phase-0a-repository-foundation.md)
- `.editorconfig`, `.gitattributes`, `.gitignore`의 최소 text/repository 정책
- CMake/Ninja root project, C++20 `garak_core`, Native smoke와 standalone CTest
- Electron main/preload, React renderer와 Sound / Control / Interface / Product placeholder
- pnpm workspace와 frozen lockfile, strict TypeScript, ESLint와 Prettier 구성
- [Phase 0B ExecPlan](../../plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md)과 [direct dependency 상태](phase-0b-dependencies.md)
- [Phase 1A ExecPlan](../../plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md),
  [VST3 adapter](../architecture/vst3-adapter.md), [dependency](phase-1a-vst3-dependency.md),
  [identity](phase-1a-vst3-identity.md)와 [validation](phase-1a-vst3-validation.md) 근거
- Exact-pin VST3 SDK submodule, editorless Gain module, pure helper, loaded bundle contract test와
  repository-local official validator wrapper

## 확정된 결정

| ADR | 상태 | 결정 |
| --- | --- | --- |
| [0001](../adr/0001-typescript-studio-and-cpp20-engine.md) | Accepted | Studio는 Electron/React/TypeScript strict mode, Native Engine은 C++20/CMake/Ninja/MSVC/Apple Clang |
| [0002](../adr/0002-no-juce-and-adapter-boundaries.md) | Accepted | JUCE를 사용하지 않고 external library를 first-party adapter 뒤에 격리 |
| [0004](../adr/0004-windows-macos-and-plugin-formats.md) | Accepted | Windows/macOS 공동 목표, Windows x64 VST3 → macOS VST3 → AU 검증 순서와 첫 상용 format 집합 |

Generated plugin runtime 전략은 [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)이 계속
**Proposed** 상태다. Prebuilt Runtime에 product data를 삽입하는 대안 A와 product별 thin wrapper를
생성해 공통 Runtime과 link하는 대안 B 중 어느 것도 채택되지 않았다. 이번 fixed-metadata Windows
x64 module은 두 대안을 비교하지 않았으므로 어느 쪽의 선택 근거도 아니다.

## Phase 0A에서 고정한 계약

- `.garak`은 editable, versioned authoring source이고 compiled runtime data는 재생성 가능한 derived artifact다.
- Product ID와 plugin class ID는 영구적이며 출시된 parameter numeric ID는 변경·재사용하지 않는다.
- Sound-changing node implementation은 기존 version을 덮어쓰지 않는다.
- 출시된 project, preset과 DAW state는 명시적인 schema migration 경계를 가진다.
- Obsolete 내부 API와 pre-release path는 compatibility shim으로 보존하지 않는다.
- Audio callback에서는 allocation, blocking, I/O, parsing, GUI 호출, 파일 로그, 예외 전파와 graph mutation을 금지한다.
- Generated plugin은 Studio 없이 offline 동작하고 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 포함하지 않는다.
- 기술 후보와 license 분류는 채택이나 법적 재배포 허가가 아니다.
- `ANDONGMIN — BLOOM`은 첫 vertical reference product이며 DSP/UI는 아직 구현되거나 확정되지 않았다.

Phase 0B와 Phase 1A는 이 계약을 변경하지 않았다. 특히 generated plugin runtime 전략은 계속
Proposed이고 Studio에 설치한 Electron/React/Node tooling은 plugin 경계 밖에 있다.

## Phase 0B 구현 기준선

### Native

- `garak_core` static library와 `garak::core` alias
- `garak::core::Version`, `version()`과 `version_string()`만 공개하는 `0.0.0` scaffold API
- 정확히 `Garak native scaffold 0.0.0`을 출력하는 `garak_smoke`
- `assert` 없이 numeric/string version 계약을 확인하는 `garak_version_tests`
- Ninja Debug, Release, warnings-as-errors와 clang-tidy 전용 preset
- First-party target에만 적용되는 MSVC/Clang warning과 target-scoped clang-tidy

### Studio

- Electron main, API를 노출하지 않는 빈 preload와 Node type이 없는 React renderer
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`
- 새 창, navigation과 redirect 차단; production local file과 HTTP loopback dev URL만 허용
- `vite-plugin-electron`의 기본 `--no-sandbox`를 명시적으로 제거한 development startup
- 별도 feature component인 Sound, Control, Interface, Product placeholder와 keyboard/ARIA tab pattern
- Exact direct dependency 16개, pnpm lockfile, strict TypeScript, ESLint 10과 Prettier

## Phase 1A 구현 기준선

- Official `steinbergmedia/vst3sdk` tag `v3.8.0_build_66`, superproject commit
  `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`과 exact 7개 nested gitlink
- Superproject와 nested repository 모두 detached, initialized, tracked/untracked clean
- Default-OFF `GARAK_BUILD_VST3_GAIN_SPIKE` option과 분리된 Debug/Release/Werror/tidy preset
- Fixed processor/controller FUID, Gain ID `1001`, Bypass ID `1002`의 editorless VST3 audio effect
- One main mono/stereo audio input/output, no event/sidechain, float32/float64, sample-offset
  Gain/Bypass automation과 20-byte schema 1 state
- Pure helper test와 실제 bundle을 load하는 factory/component/controller/processing contract test
- State codec의 모든 truncated length, loaded stream의 1..19-byte short read/write, malformed 및
  duplicate queue, prepared maximum block boundary 검증
- Parameter queue count 최대 2, block별 point cap
  `numSamples <= 1 ? 2 : min(INT_MAX, 2 * numSamples)`의 bounded host traversal
- Cap 초과는 point callback 전에 거부하고 host `getParameterCount`/`getPoint` 예외는 top-level에서
  failure로 변환해 live state를 변경하지 않는 계약
- Generation/sequence-lock state handoff와 process/setState를 교차한 20,000회 concurrent test
- Source 상수를 재사용하지 않는 independent literal identity 검증과 baseline smoke/version main의
  top-level exception boundary
- Pinned source의 official validator standard/extensive를 local bundle path에만 실행하는 wrapper
- VSTGUI, example, optional moduleinfo/icon, system/user plugin link와 registry mutation 제외

## 검증 환경

| 항목 | 확인한 version 또는 상태 |
| --- | --- |
| OS | Microsoft Windows 10.0.26200, x64 |
| Visual Studio | Community 2026 18.7.3 |
| MSVC | 19.51.36248, x64 toolset 14.51.36231 |
| CMake / Ninja | 4.3.1-msvc1 / 1.13.2 |
| clang-format / clang-tidy | 22.1.3 / 22.1.3 |
| Node.js / pnpm | 24.19.0 / 11.16.0 |
| Electron | 43.3.0 Windows x64 binary와 responding window 확인 |

Native tool은 일반 PowerShell PATH가 아니라 `VsDevCmd.bat -arch=x64 -host_arch=x64`가 구성한 Visual Studio x64 Developer 환경에서 실행했다.

## 수행한 검증

### Phase 0A 보존 확인

| 검사 | 결과 |
| --- | --- |
| `git status --short --branch` | Exit 0. Commit이 없는 `master`; Phase 0A 생성물은 모두 untracked |
| `git diff --check` | Exit 0, 출력 없음 |
| 필수 파일과 실제 파일 비교 | 24/24, 누락 0, 예상 외 0 |
| Markdown local relative link 검사 | Markdown 21개, link 177개, anchor link 0, 깨진 link 0 |
| Raw text 검사 | Text 24개; strict UTF-8 오류, BOM, CRLF, trailing whitespace, tab, final newline 누락 모두 0 |
| ADR 상태 검사 | 0001·0002·0004 Accepted, 0003 Proposed |
| ROADMAP 구조 검사 | Phase 10개; 진입 조건·핵심 산출물·수용 기준·명시적 비범위가 각 10개 |
| 요구 내용 pattern 검사 | 제품·architecture·ADR·운영 규칙 16개 group 모두 통과 |
| 금지 산출물 검사 | Source/build/package/lockfile/SDK/vendor/binary/CI 디렉터리·파일 0, `LICENSE`/`COPYING` 없음 |
| 수동 교차 검토 | Runtime A/B 중립성, 후보 상태, Studio/no-JS 경계, platform 순서, realtime, identity/migration과 business hypothesis 일치; blocking defect 0 |

모든 파일이 새 untracked 파일이므로 `git diff --check`만으로는 내용을 검사하지 못한다. 따라서 전체 파일을 직접 읽는 raw whitespace/encoding 검사와 local link 검사를 PASS 근거로 함께 사용했다.

Closeout 뒤 축약한 link checker 한 번은 PowerShell 경로 결합 구문 오류로 대상 검증 전에 실패했다. 파일을 변경하지 않았으며, 검증된 원래 checker를 다시 실행해 Markdown 21개, local link 177개, broken link 0과 exit 0을 확인했다.

### Phase 0B Native

모든 Native 명령은 Visual Studio x64 Developer 환경에서 실행했다.

| 명령 또는 검사 | 최종 결과 |
| --- | --- |
| `cmake --list-presets=all` | Exit 0; configure 4개, build 4개, test 2개 확인 |
| `cmake --preset debug` | Exit 0; MSVC 19.51과 Ninja Debug configure |
| `cmake --build --preset debug-build --verbose` | Exit 0; core/smoke/test 3개 target, `/W4 /permissive- /Zc:__cplusplus` 확인 |
| `ctest --preset debug-test --no-tests=error` | Exit 0; `garak_version_tests` 1/1 통과 |
| Debug `garak_smoke.exe` | Exit 0; `Garak native scaffold 0.0.0`; PE `8664 machine (x64)` |
| `cmake --preset release` | Exit 0; Release configure |
| `cmake --build --preset release-build --verbose` | Exit 0 |
| `ctest --preset release-test --no-tests=error` | Exit 0; `garak_version_tests` 1/1 통과 |
| Release `garak_smoke.exe` | Exit 0; `Garak native scaffold 0.0.0` |
| Werror configure와 `--clean-first` build | Exit 0; core/smoke/test 모두 `/WX` 확인 |
| `clang-format --dry-run --Werror` | Exit 0; `.cpp`/`.hpp` 4개 |
| clang-tidy configure와 `--clean-first` build | Exit 0; core/smoke/test에 clang-tidy 22.1.3 실제 적용 |

### Phase 0B Studio

| 명령 또는 검사 | 최종 결과 |
| --- | --- |
| `pnpm install` | Exit 0; workspace package 171개, lockfile 생성 |
| `pnpm --dir studio exec install-electron --no` | Exit 0; Electron 43.3.0 Windows x64 binary 준비 |
| `pnpm install --frozen-lockfile` | Exit 0; lockfile와 manifest 일치 |
| `pnpm studio:lint` | Exit 0; warning 0 정책 |
| `pnpm studio:format:check` | Exit 0 |
| `pnpm studio:typecheck` | Exit 0; renderer와 Electron config 모두 strict |
| `pnpm studio:build` | Exit 0; renderer 20 modules, main/preload 각 2 modules |
| Build output | `studio/dist/index.html`, `dist-electron/main.js`, `preload.js` 존재 |
| Production GUI bounded launch | Exit 0; Electron process 4개, responding window 1개, title `Garak Studio — Phase 0B` |
| `pnpm studio:dev` bounded launch | Exit 0; Vite `127.0.0.1:5173`, responding window 1개 |
| Dev main command line | `electron.exe .`; `--no-sandbox` 없음 |
| Cleanup | Garak Electron process 0, port 5173 listener 0 |

### Phase 0B repository

- Tracked/untracked와 `.gitignore` 제외 대상을 합친 source 후보 전체의 UTF-8, BOM, CR/LF, trailing whitespace, tab과 final newline을 raw byte로 검사했다.
- Markdown local link, direct dependency allowlist/exact version, installed direct license metadata와 frozen lockfile를 검사했다.
- Renderer TypeScript AST에서 Node/Electron/network identifier와 Phase 1 금지 identifier를 검사했다.
- Native external dependency 구문, 금지 implementation path, repository `LICENSE`/`COPYING`, generated output Git 유출을 검사했다.
- 최종 source 후보 64개에서 raw text issue 0, Markdown 25개와 local link 192개에서 broken link 0, dependency/security/scope issue 0이었다.
- `git diff --check`와 cached check는 exit 0이지만 전 파일이 untracked인 현재 저장소에서는 보조 증거로만 사용한다.

### Phase 1A Windows x64 build와 tests

모든 VST3 build는 Visual Studio x64 Developer 환경에서 separate build tree를 사용했다.

| 명령 또는 검사 | 최종 결과 |
| --- | --- |
| `cmake --preset vst3-debug --fresh` | Exit 0; exact SDK pin과 Debug graph configure |
| `cmake --build --preset vst3-debug-build --clean-first` | Exit 0; plugin, validator와 test aggregate build PASS |
| Debug formatter-triggered incremental rebuild와 CTest | Build exit 0; version, pure Gain, loaded VST3 contract 3/3 exit 0 |
| `cmake --preset vst3-release --fresh` | Exit 0; Release graph configure |
| `cmake --build --preset vst3-release-build --clean-first` | Exit 0; aggregate build PASS |
| Release formatter-triggered incremental rebuild와 CTest | Build exit 0; 3/3 exit 0 |
| `vst3-werror` fresh configure/clean build와 final incremental build | 모두 exit 0 |
| `vst3-clang-tidy` fresh configure/clean build와 final incremental build | 모두 exit 0 |
| First-party clang-format | `.cpp`/`.hpp` 20개 apply 뒤 `--dry-run --Werror` exit 0 |

Pure/loaded tests는 state truncation과 1..19-byte short stream I/O, malformed/non-monotonic/invalid 및
duplicate automation queues, `maxSamplesPerBlock` 초과를 확인한다. Queue count는 최대 2이고 point
cap은 `numSamples <= 1 ? 2 : min(INT_MAX, 2 * numSamples)`이다. 4-sample block은 8 point를 받고 9와
`INT_MAX`를 거부하며 zero-sample은 2를 받고 3을 거부한다. Queue count 3과 `INT_MAX`는 queue data
callback 전에 거부한다. Host `getParameterCount`/`getPoint`가 throw해도 top-level boundary가 failure로
변환하고 state를 변경하지 않는다. Identity test는 source 상수와 독립된 literal을 사용한다.

Generation/sequence-lock handoff는 process thread와 20,000회 `setState`/`getState`를 교차해 완료된 새
state가 이전 process snapshot으로 덮이지 않고 한 whole state만 관찰되는지 검사한다. Baseline
smoke/version executable도 main top-level exception boundary를 가진다.

### Phase 1A official validator와 artifact

| Configuration | Standard | Extensive | Report |
| --- | --- | --- | --- |
| Debug | 47/47 PASS, exit 0 | 537/537 PASS, exit 0 | `out/reports/vst3/debug-validator-standard.txt`; `out/reports/vst3/debug-validator-extensive.txt` |
| Release | 47/47 PASS, exit 0 | 537/537 PASS, exit 0 | `out/reports/vst3/release-validator-standard.txt`; `out/reports/vst3/release-validator-extensive.txt` |

- 네 validator run 모두 processor/controller를 발견했고 warning line, failed test와 crash는 0이다.
- Debug/Release module은 모두 PE `8664 machine (x64)`다.
- Debug/Release cache의 `SMTG_ENABLE_VSTGUI_SUPPORT`와 `SMTG_CREATE_PLUGIN_LINK`는 OFF이고 plugin
  link command의 VSTGUI hit는 0이다.
- Final bundle의 icon과 `moduleinfo.json`은 각각 0이며 bundle/report는 `out/` 아래 local
  artifact로만 존재한다.
- System/user VST3 directory, registry와 global validator를 변경하지 않았다.

### Phase 1A 이후 Phase 0 regression

| 영역 | 최종 결과 |
| --- | --- |
| Native Debug | Fresh configure/clean build PASS; `garak_version_tests` 1/1; exact smoke PASS |
| Native Release | Fresh configure/clean build PASS; `garak_version_tests` 1/1; exact smoke PASS |
| Native Werror | Fresh configure/clean build PASS |
| Native clang-tidy | Fresh configure/clean build PASS |
| Studio | Frozen install, lint, format check, typecheck와 production build rerun PASS; direct dependency 16개 유지 |

### 실패, 수정과 재검증

- 첫 sandboxed CMake Debug configure는 MSVC ABI link 단계에서 교착되어 중단했다. 같은 configure를 승인된 sandbox 외부에서 `--fresh`로 재실행한 뒤 통과했다.
- 첫 clang-format 검사는 test 조건식 줄바꿈 1건으로 실패했다. 설치된 formatter로 4개 source를 정규화하고 Debug/Release/CTest/Werror를 다시 통과했다.
- 첫 PE header filter는 PowerShell/cmd 인용 오류로 전체 command exit 1이었다. Smoke 자체 출력은 성공했고 header 검사와 smoke를 각각 재실행해 exit 0을 확인했다.
- 첫 Studio format check는 CSS 1개에서 실패했다. `pnpm studio:format` 뒤 format check와 lint를 재실행해 통과했다.
- 첫 Studio build는 sandbox의 child-process `spawn EPERM`으로 실패했다. 같은 build를 승인된 sandbox 외부에서 실행해 통과했다.
- CommonJS package의 `vite.config.ts`가 향후 Vite config loader 경고를 냈다. Electron output은 CommonJS로 유지하고 config만 `vite.config.mts`로 분리한 뒤 무경고 build를 확인했다.
- `vite-plugin-electron` 1.1.1의 기본 dev startup이 `--no-sandbox`를 붙이는 사실을 감사에서 발견했다. `startup(['.'])` override 후 lint/typecheck/build/dev를 재검증하고 실제 command line에서 flag 부재를 확인했다.
- 첫 금지 dependency helper는 PowerShell variable 인용 오류로 대상 검사 전에 실패했다. 수정한 helper를 재실행해 hit 0을 확인했다.
- 첫 sandboxed VST3 configure는 compiler ABI detection에서 CMake 오류 없이 60초와 180초 timeout이
  발생했다. Visual Studio x64 Developer 환경의 escalated `--fresh` configure로 재실행해 통과했다.
- Pure test 첫 compile은 MSVC가 nested-brace `std::array` CTAD를 해석하지 못해 실패했다. Element
  type과 size를 명시한 뒤 재빌드했다.
- Contract test 첫 compile은 VST3 string macro를 namespace-qualified해서 실패했다. Pinned SDK가
  정의한 bare macro 사용으로 수정했다.
- Contract test 첫 link는 `VST3::Hosting::Module::create` unresolved symbol로 실패했다. Pinned SDK의
  `module_win32.cpp`를 isolated third-party loader target으로 추가하고 SDK와 같은
  `/Zc:__cplusplus` mode로 `sdk_hosting`과 연결했다.
- 첫 CTest graph는 aggregate target의 version test dependency 누락과 nested generator expression의
  bundle path 미평가 때문에 실패했다. Dependency를 추가하고 `TARGET_GENEX_EVAL`로 package path를
  평가한 뒤 Debug/Release 3/3을 확인했다.
- Loaded contract의 첫 processing lifecycle은 SDK `AudioEffect::setProcessing` 기본 구현이
  `kNotImplemented`를 반환해 실패했다. Stateless spike의 최소 override가 `kResultTrue`를 반환하도록
  수정한 뒤 contract test와 validator를 재실행했다.
- 후속 감사에서 prepared `maxSamplesPerBlock` 경계 누락과 non-realtime `setState`가 더 오래된 process
  snapshot에 덮일 race를 발견했다. Oversized-block reject/test 및 generation/sequence-lock handoff와
  20,000회 concurrent test를 추가하고 Debug/Release/CTest/validator를 다시 통과했다.
- Phase 1A 첫 clang-tidy는 `state_codec.hpp`의 `portability-avoid-pragma-once`, `automation.hpp`의
  `bugprone-easily-swappable-parameters`, exceptions-disabled build에서 `processor.cpp`의 `try` 사용
  diagnostic 등으로 실패했다. Header guard, parameter API와 exception boundary를 정리한 뒤
  `vst3-clang-tidy` fresh/clean 및 final incremental build를 모두 exit 0으로 재검증했다.
- 첫 전체 Phase 1A clang-format check는 새 first-party source의 format 차이로 실패했다. 20개
  `.cpp`/`.hpp`에 formatter를 적용하고 Debug/Release incremental build와 CTest, Werror/tidy
  incremental build 및 전체 `--dry-run --Werror`를 다시 실행해 모두 exit 0을 확인했다.
- Automation traversal 감사에서 host가 임의로 큰 queue/point count를 반환할 때 작업량 상한이
  없음을 발견했다. Queue count 2와 block-derived point cap을 추가하고 over-cap/throwing host가 data
  callback이나 state mutation에 도달하지 않는 contract test를 추가했다.

## 수행하지 않은 검증

다음은 Phase 1A 범위 밖이거나 아직 완료되지 않아 수행한 것으로 간주하지 않는다.

- macOS Apple Clang configure/build/test와 macOS Electron launch
- Xcode와 macOS Universal binary
- macOS VST3/AU SDK integration, plugin build와 validator
- Windows/macOS 실제 DAW host load, automation, state restore와 compatibility matrix
- Realtime allocation/blocking 계측, DSP processing와 audio quality test
- `.garak` parse, schema migration과 preset/DAW state round trip
- Studio preview와 generated native UI parity
- Windows/macOS packaging, signing와 notarization
- VST3 SDK와 npm의 commercial distribution, transitive dependency license, notice, trademark,
  취약점과 재배포 audit

이 항목들은 통과한 것으로 간주하지 않는다. 해당 구현 phase의 ExecPlan에서 재현 명령과 수용 기준을 정한다.

## 남은 미결정 사항

- Generated runtime packaging 대안 A/B와 비교 spike의 수용 기준
- `.garak`과 compiled runtime data의 physical container 및 schema technology
- Studio와 Native Engine 사이의 process/IPC 및 language binding
- Built-in DSP node의 최소 목록과 BLOOM의 실제 sound algorithm, range와 macro curve
- Studio preview와 native renderer/layout backend 및 parity tolerance
- 지원 OS/DAW matrix, CPU/latency/memory와 audio-quality budget
- Compiled runtime blob의 migrate/rebuild/reject 정책
- 상용 product의 VST3/AU identity mapping, macOS Universal packaging, signing와 notarization 절차
- 저장소 license, Studio license, Runtime redistribution terms와 제품 정책 가설의 법률 문구
- 외부 후보 8개의 API, 성능, realtime, license와 재배포 적합성

## 현재 리스크

- Native command는 일반 PATH에서 찾을 수 없는 Visual Studio bundled toolchain과 x64 Developer 환경을 전제로 한다.
- Windows만 검증했으므로 CMake preset과 Electron shell의 macOS 적합성은 Apple Clang/macOS 실행 전까지 미확정이다.
- Electron 43 desktop binary는 첫 CLI 실행의 cache miss에서 network download가 필요하다. 이는 authoring tool 설치 경로이며 Studio 기능의 network API는 아니다.
- CSP의 inline style과 loopback connect 허용은 Vite development를 위한 Phase 0B 타협이다. 배포 전 production CSP를 dev CSP와 분리해야 한다.
- Direct dependency metadata만 검토했으며 npm transitive license, notice와 취약점 audit는 남아 있다.
- Fixed-metadata VST3 class registration, bundle과 validator 성공만으로 runtime packaging A/B를
  선택할 수 없다. 두 대안의 product-data binding과 identity/export evidence가 별도로 필요하다.
- TypeScript authoring model과 C++ runtime contract가 중복된 source of truth가 되면 drift가 발생할 수 있다.
- Studio preview와 native UI의 scene/layout 의미가 달라질 수 있어 fixture와 tolerance가 필요하다.
- 출시 ID, node sound version과 persistent state migration은 release 전에 test fixture와 지원 기간을 정해야 한다.
- White-label, 사용자 창작물 소유, 판매, 기본 무로열티와 Runtime 재배포는 현재 제품 정책 가설이며 법적 권리가 확정되지 않았다.

## 정확한 다음 작업

Phase 1A는 PASS / Complete다. Phase 1 전체는 완료하지 않았으며 Phase 1B도 시작하지 않는다.

- ADR 0003 A/B를 계속 Proposed로 유지하고 별도 Phase 1B ExecPlan 전에는 구현 대안을 선택하지 않는다.
- macOS VST3를 arm64/x86_64와 Universal artifact로 검증한 뒤 AU 순서로 진행한다.
- 실제 DAW host matrix, commercial distribution과 transitive legal/notice/trademark audit는 별도
  범위와 근거를 마련한다.
- DSP graph, `.garak` parser, native IPC, functional Interface Designer와 export pipeline은 이후
  phase에서만 시작한다.
