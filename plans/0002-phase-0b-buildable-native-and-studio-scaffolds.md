# ExecPlan 0002 — Phase 0B Buildable Native and Studio Scaffolds

- Status: Complete — PASS
- Started: 2026-08-09
- Updated: 2026-08-09
- Owner: Garak project

## 목적

Windows 개발 환경에서 Garak의 두 최소 개발 루프를 실제로 재현한다.

1. C++20 Native: configure → build → test → smoke executable
2. Electron/React/TypeScript Studio: install → lint → format check → typecheck → production build

이 단계는 제품 기능을 구현하지 않는다. 이후 기능이 올라갈 수 있는 가장 작은 buildable 기준선과 검증된 명령만 만든다.

## 사용자 가치

후속 개발자가 IDE에 종속되지 않은 명령으로 Native와 Studio를 즉시 검증할 수 있다. Phase 1의 VST3 spike를 시작하기 전에 compiler, package manager, warning, strict typing과 Electron security 경계가 실제로 작동하는지 확인하여 제품 기능 개발과 toolchain 문제를 분리한다.

## 현재 저장소 상태

- 2026-08-09 시작 시 branch는 commit이 없는 `master`이다.
- Phase 0A의 문서·정책 파일 24개가 모두 untracked 상태다.
- 기존 Phase 0A 변경은 사용자 작업으로 간주하고 전부 보존한다.
- Phase 0A는 [현재 상태](../docs/status/current.md)에서 PASS로 기록되어 있다.
- C++, CMake, package manifest, Studio source와 외부 dependency는 아직 없다.
- Commit 생성, branch 변경과 destructive Git 작업은 하지 않는다.

## 현재 Windows 개발환경 조사 결과

일반 PowerShell과 Visual Studio Developer 환경을 구분해 조사했다.

| 항목 | 확인 결과 | 경로 또는 비고 |
| --- | --- | --- |
| OS | Microsoft Windows 10.0.26200, x64 | 현재 검증 대상은 Windows x64뿐 |
| PowerShell | 5.1.26100.8972 | 현재 shell |
| Git | 2.55.0.windows.3 | `C:\Program Files\Git\cmd\git.exe` |
| Visual Studio | Community 2026 18.7.3 | `C:\Program Files\Microsoft Visual Studio\18\Community` |
| MSVC | 19.51.36248, x64 | Developer 환경의 MSVC 14.51.36231 toolset |
| CMake | 4.3.1-msvc1 | Visual Studio bundled, 일반 PATH에는 없음 |
| Ninja | 1.13.2 | Visual Studio bundled, 일반 PATH에는 없음 |
| clang-format | 22.1.3 | Visual Studio bundled, 일반 PATH에는 없음 |
| clang-tidy | 22.1.3 | Visual Studio bundled, 일반 PATH에는 없음 |
| Node.js | 24.19.0 | `C:\Program Files\nodejs\node.exe` |
| Corepack | 0.35.0 | Node.js 설치에 포함 |
| pnpm | 11.16.0 | Codex runtime이 제공한 executable |

`cl`, `cmake`, `ninja`, `clang-format`, `clang-tidy`는 일반 shell에서 발견되지 않았지만 `VsDevCmd.bat -arch=x64 -host_arch=x64`가 구성한 환경에서는 모두 발견된다. Native 검증은 Visual Studio x64 Developer 환경에서 실행한다. `cl /Bv`는 version을 출력한 뒤 source file 부재로 exit 1을 반환했으며, 실제 compiler 동작은 scaffold build로 검증한다.

macOS, Apple Clang, Xcode, Electron macOS launch와 Universal binary는 현재 환경에서 검증할 수 없다.

## 범위

### Native

- Root CMake project, options와 first-party warning policy
- Ninja 기반 Debug/Release configure, build와 test preset
- C++20 `garak_core` static library와 `garak::core` alias
- Version scaffold에 한정된 public header와 implementation
- `garak_smoke` executable
- External framework 없는 standalone CTest executable
- `.clang-format`, `.clang-tidy`와 선택 가능한 clang-tidy integration
- `native/AGENTS.md`

### Studio

- pnpm workspace와 frozen lockfile
- Electron main/preload, React renderer와 Vite build
- TypeScript strict renderer 및 Electron configuration 분리
- Sound, Control, Interface, Product feature component와 keyboard-accessible tab shell
- Context isolation, sandbox, Node integration 차단, navigation/window 차단과 CSP
- ESLint, Prettier, typecheck, build와 dev script
- `studio/AGENTS.md`

### 문서와 검증

- Direct Studio dependency version, purpose, license와 shipping boundary 기록
- 실제 성공한 Windows 명령만 README quick start에 기록
- Root AGENTS, ROADMAP, current status와 본 ExecPlan 동기화
- Repository hygiene, 금지 dependency와 범위 검사

## 비범위

- Steinberg VST3 SDK, VST3 plugin과 Audio Unit
- JUCE, Skia, CanvasKit, Yoga, XYFlow, miniaudio, KissFFT와 FlatBuffers
- DSP node, audio callback, audio-device I/O와 audio audition
- `.garak` parser, compiled runtime blob, parameter/automation/state
- Native Engine IPC, Node.js native addon과 renderer filesystem access
- UI Designer, graph editor와 실제 Sound/Control/Interface/Product domain model
- Plugin packaging, installer, signing, notarization과 auto update
- Telemetry, analytics, cloud/network API, database, marketplace, authentication과 DRM
- Electron Forge, electron-builder, routing, state management, animation, UI component framework와 test framework
- CI, repository license 선택과 Phase 1 구현

비범위 이름을 future placeholder class, interface 또는 fake control로도 만들지 않는다. Native public API는 version scaffold에만 한정한다.

## 전제와 제약

- [AGENTS.md](../AGENTS.md), Accepted ADR 0001/0002/0004와 Proposed ADR 0003을 따른다.
- C++20, CMake, Ninja, MSVC/Apple Clang 방향과 no-JUCE 결정을 변경하지 않는다.
- External audio, graphics 또는 plugin dependency를 추가하지 않는다.
- Studio 개발에 직접 필요한 permissive-license npm package만 exact version으로 추가한다.
- Generated plugin에는 Studio dependency가 포함되지 않는다. Phase 0B에는 generated plugin 자체가 없다.
- TypeScript strict option과 Electron security option을 검증 편의를 위해 완화하지 않는다.
- Source/build output과 `node_modules`를 분리하고 Git 대상에서 제외한다.
- Windows에서 통과한 결과를 macOS 통과로 일반화하지 않는다.

## Native scaffold 설계

### Build graph

```text
Garak root project
└─ native
   ├─ garak_core (static library, alias garak::core)
   ├─ garak_smoke (executable → garak::core)
   └─ garak_version_tests (CTest executable → garak::core)
```

- `cmake_minimum_required`는 preset과 C++20 사용에 충분한 portable minimum으로 둔다.
- C++ standard는 20으로 고정하고 compiler extension을 끈다.
- `GARAK_BUILD_TESTS` 기본값은 ON이다.
- `GARAK_WARNINGS_AS_ERRORS` 기본값은 OFF이며 별도 preset에서 ON을 검증한다.
- `GARAK_ENABLE_CLANG_TIDY` 기본값은 OFF이고 first-party target에만 선택적으로 적용한다.
- Warning은 MSVC의 `/W4`, `/permissive-`, `/Zc:__cplusplus`와 Clang 계열의 `-Wall`, `-Wextra`, `-Wpedantic`에 한정한다.
- Preset 이름은 platform-neutral한 `debug`와 `release`를 사용하고 Windows Developer environment 및 향후 macOS에서 compiler absolute path 없이 소비한다.

### Public API

`garak::core::Version` value type과 다음 두 함수만 제공한다.

- Native scaffold version의 numeric value 반환
- Native scaffold version의 `std::string_view` 반환

Version은 `0.0.0`이고 상용 product version 계약이 아니다. 함수는 `[[nodiscard]]`와 `noexcept`를 사용하며 implementation은 `.cpp`에 둔다. Singleton, class hierarchy, allocator, service locator와 future domain abstraction을 만들지 않는다.

### Test와 smoke

- Smoke는 `Garak native scaffold 0.0.0`을 stdout에 쓰고 종료한다.
- Test는 numeric version, string과 두 표현의 기본 일관성을 확인한다.
- `assert` 대신 명시적인 비교, 이해 가능한 stderr와 non-zero exit code를 사용한다.

## Studio scaffold 설계

### Build와 process 경계

- Root package는 private workspace orchestration만 담당하고 dependency를 갖지 않는다.
- `studio` package는 Vite renderer와 `vite-plugin-electron/simple`로 main/preload build를 구성한다.
- Electron main은 window lifecycle과 보안 정책만 소유한다.
- Preload는 Phase 0B에서 renderer에 API를 노출하지 않는다.
- Renderer는 React local state로 네 workspace tab만 전환하며 Node/Electron API를 import하지 않는다.
- Production은 bundled local `index.html`만 load한다. Dev URL은 loopback address만 허용한다.

### Electron security

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webviewTag: false`
- `setWindowOpenHandler`로 새 창 거부
- `will-navigate`로 renderer navigation 거부
- Raw `ipcRenderer`, filesystem, shell, generic send/invoke API를 노출하지 않음
- CSP는 self와 Vite loopback development connection만 허용

### React shell

- Semantic tablist/tab/tabpanel과 keyboard-accessible button을 사용한다.
- 선택 workspace를 시각적·ARIA state로 표시한다.
- 각 feature component는 Phase 0B placeholder와 후속 phase 설명만 표시한다.
- Open/save/export/DSP control이나 fake interactive product feature를 만들지 않는다.
- Plain CSS와 system font만 사용한다.

## 선택한 직접 dependency와 선택 이유

Registry의 exact version, license와 peer constraint를 2026-08-09에 확인했다. TypeScript latest 7.0.2는 `typescript-eslint` 8.66.0의 `<6.1.0` peer range와 맞지 않아 6.0.3을 선택했다.

| Package | Version | 구분 | 목적 | License |
| --- | --- | --- | --- | --- |
| react | 19.2.8 | Runtime | Renderer component model | MIT |
| react-dom | 19.2.8 | Runtime | Renderer DOM mount | MIT |
| electron | 43.3.0 | Studio runtime/dev | Phase 0B desktop runtime; packaging 전이므로 devDependency | MIT |
| vite | 8.2.1 | Development | Renderer build와 dev server | MIT |
| @vitejs/plugin-react | 6.0.5 | Development | React transform | MIT |
| vite-plugin-electron | 1.1.1 | Development | Main/preload Vite build와 dev lifecycle | MIT |
| typescript | 6.0.3 | Development | Strict static typecheck | Apache-2.0 |
| eslint | 10.8.1 | Development | Lint runner | MIT |
| @eslint/js | 10.0.1 | Development | ESLint core recommended rules | MIT |
| typescript-eslint | 8.66.0 | Development | TypeScript parser/rules | MIT |
| eslint-plugin-react-hooks | 7.1.1 | Development | React Hooks rules | MIT |
| eslint-plugin-react-refresh | 0.5.3 | Development | Vite React refresh export rule | MIT |
| prettier | 3.9.6 | Development | Deterministic formatting | MIT |
| @types/node | 24.13.3 | Development | Node 24/main tooling types | MIT |
| @types/react | 19.2.18 | Development | React types | MIT |
| @types/react-dom | 19.2.4 | Development | React DOM types | MIT |

`vite-plugin-electron-renderer`는 optional peer이고 renderer에 Node capability가 필요하지 않으므로 추가하지 않는다. 모든 Studio dependency는 authoring application과 development loop에만 속하며 generated plugin에는 포함되지 않는다. Transitive license audit는 이 단계에서 완료로 주장하지 않는다.

## 구현 또는 문서화 단계

1. [x] 저장소와 Git 상태를 조사한다.
2. [x] AGENTS, PLANS, PRD, architecture, ADR, status와 Phase 0A plan을 읽는다.
3. [x] Windows toolchain, path와 npm dependency compatibility를 조사한다.
4. [x] 본 ExecPlan을 구현 전에 작성한다.
5. [x] Root/native CMake, core, smoke, test와 nested AGENTS를 작성한다.
6. [x] Native Debug/Release configure, build, CTest와 smoke를 실행한다.
7. [x] Warnings-as-errors, clang-format과 clang-tidy를 검증한다.
8. [x] pnpm workspace, Electron/React shell, TypeScript/ESLint/Prettier와 nested AGENTS를 작성한다.
9. [x] `pnpm install`, frozen install, lint, format check, typecheck와 production build를 실행한다.
10. [x] Electron main/preload/renderer output과 가능한 GUI launch 범위를 확인한다.
11. [x] Repository hygiene, dependency, security와 Phase 0B 범위를 검사한다.
12. [x] 발견된 오류를 수정하고 같은 검증을 재실행한다.
13. [x] README, ROADMAP, root AGENTS, dependency status와 current status를 갱신한다.
14. [x] 본 ExecPlan의 실제 결과, 실패, 결정과 완료 기록을 갱신한다.
15. [x] 최종 diff와 전체 범위 검사를 수행하고 Phase 0B를 판정한다.

## 변경 대상 파일과 디렉터리

### Root와 Native

- `/CMakeLists.txt`
- `/CMakePresets.json`
- `/.clang-format`
- `/.clang-tidy`
- `/cmake/GarakOptions.cmake`
- `/cmake/GarakWarnings.cmake`
- `/native/AGENTS.md`
- `/native/CMakeLists.txt`
- `/native/core/CMakeLists.txt`
- `/native/core/include/garak/core/version.hpp`
- `/native/core/src/version.cpp`
- `/native/apps/garak_smoke/CMakeLists.txt`
- `/native/apps/garak_smoke/main.cpp`
- `/native/tests/CMakeLists.txt`
- `/native/tests/version_tests.cpp`

### Studio

- `/package.json`
- `/pnpm-workspace.yaml`
- `/pnpm-lock.yaml`
- `/studio/AGENTS.md`
- `/studio/package.json`
- `/studio/index.html`
- `/studio/tsconfig.json`
- `/studio/tsconfig.node.json`
- `/studio/vite.config.mts`
- `/studio/eslint.config.js`
- `/studio/prettier.config.mjs`
- `/studio/.prettierignore`
- `/studio/electron/main.ts`
- `/studio/electron/preload.ts`
- `/studio/src/main.tsx`
- `/studio/src/App.tsx`
- `/studio/src/app.css`
- `/studio/src/vite-env.d.ts`
- `/studio/src/global.d.ts`
- `/studio/src/features/sound/SoundWorkspace.tsx`
- `/studio/src/features/control/ControlWorkspace.tsx`
- `/studio/src/features/interface/InterfaceWorkspace.tsx`
- `/studio/src/features/product/ProductWorkspace.tsx`

### 문서와 정책

- `/.gitignore`
- `/AGENTS.md`
- `/README.md`
- `/ROADMAP.md`
- `/docs/status/current.md`
- `/docs/status/phase-0b-dependencies.md`
- `/plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md`

Architecture-level 결정은 바꾸지 않으므로 새 ADR은 예상하지 않는다. 실제 구현이 장기 경계를 바꾸면 해당 문서와 ADR 필요성을 먼저 검토한다.

## 검증 명령

Native 명령은 Visual Studio x64 Developer Command 환경에서 실행한다.

```text
cmake --preset debug
cmake --build --preset debug-build
ctest --preset debug-test
out\build\debug\native\apps\garak_smoke\garak_smoke.exe

cmake --preset release
cmake --build --preset release-build
ctest --preset release-test
out\build\release\native\apps\garak_smoke\garak_smoke.exe

cmake --preset debug-warnings-as-errors
cmake --build --preset warnings-as-errors-build
```

Formatter와 static analysis는 Developer 환경의 installed LLVM tool을 사용한다. 실제 source 목록 또는 clang-tidy-enabled preset은 구현 후 정확히 기록한다.

Studio:

```text
pnpm install
pnpm --dir studio exec install-electron --no
pnpm install --frozen-lockfile
pnpm studio:lint
pnpm studio:format:check
pnpm studio:typecheck
pnpm studio:build
```

`pnpm studio:dev`는 장시간 GUI command이므로 bounded launch 확인만 시도하고 production build 성공과 GUI 검증을 구분한다.

Repository:

- `git status --short --branch`
- `git diff --check`
- Tracked/untracked 전체 text encoding, LF, final newline, tab과 trailing whitespace 검사
- Markdown relative link 검사
- Required/forbidden file 및 dependency 이름 검사
- `node_modules`, `out`, renderer/main/preload output이 ignore되는지 검사
- `LICENSE` 부재와 Proposed ADR 0003의 미변경 상태 확인

## 수용 기준

### Native

- `garak_core`, `garak::core`, smoke와 standalone CTest target이 존재한다.
- Public header/implementation이 분리되고 API가 version scaffold에만 한정된다.
- Debug/Release configure, build, test와 smoke output이 Windows MSVC/Ninja에서 통과한다.
- Warnings-as-errors build가 통과한다.
- First-party source가 formatter/static-analysis policy를 만족한다.
- C++ third-party dependency가 없다.

### Studio

- pnpm workspace와 frozen lockfile이 존재한다.
- Electron main/preload와 React renderer가 별도 경계로 build된다.
- Strict/noImplicitAny/noUncheckedIndexedAccess/exactOptionalPropertyTypes가 활성화된다.
- 네 feature component와 accessible workspace selection이 존재한다.
- Electron security 설정, CSP와 no-preload-API 경계가 코드에 명시된다.
- Install/frozen install, lint, format check, typecheck와 production build가 통과한다.
- Main, preload와 renderer output이 실제로 존재한다.
- 금지 dependency가 없다.

### Repository

- Nested AGENTS와 root quick-start가 실제 검증 명령과 일치한다.
- Dependency status가 exact direct version/license/purpose와 generated-plugin 부재를 기록한다.
- ROADMAP, current status와 ExecPlan이 같은 Phase 0B 판정을 가진다.
- Phase 1 code, product domain placeholder, package/installer와 `LICENSE`가 없다.
- Phase 0A 문서와 untracked 사용자 변경이 보존된다.

필수 toolchain 부재나 실행 검증 누락이 남으면 PASS가 아니라 CONDITIONAL PASS 또는 FAIL로 기록한다.

## 리스크

- 일반 PATH에는 Native tool이 없어 검증 명령은 Visual Studio Developer environment를 전제로 한다.
- Electron/Vite tooling의 current major versions가 빠르게 변하므로 exact lockfile과 Node engine을 함께 기록해야 한다.
- Electron 43 desktop binary는 첫 CLI 실행의 cache miss에서 network download가 필요하므로 JS dependency install과 GUI runtime 준비를 구분해야 한다.
- npm transitive dependency와 license의 전체 audit는 Phase 0B 범위를 넘어가며 direct dependency 검토와 구분해야 한다.
- Electron GUI는 production과 loopback development mode를 bounded launch로 확인했지만 macOS launch는 미검증이다.
- Windows에서 portable CMake/TypeScript 구조를 만들 수 있지만 macOS 적합성은 실제 Apple Clang/Electron 검증 전에는 확정할 수 없다.
- Phase 0B CSP의 inline style과 loopback connect 허용은 Vite development 타협이며 실제 distribution 전 production CSP와 분리해야 한다.
- 모든 Phase 0A 파일이 untracked이므로 `git diff --check`만으로 baseline과 Phase 0B 변경을 구분하거나 전체 hygiene를 증명할 수 없다.
- `vite-plugin-electron` output naming과 sandboxed preload compatibility는 설치된 exact version의 build output으로 확인해야 한다.

## 발견 사항

- 2026-08-09: Phase 0A의 24개 파일과 PASS 문서가 실제 저장소에 존재하지만 commit 없이 모두 untracked이다.
- 2026-08-09: Visual Studio 2026은 필요한 MSVC, CMake, Ninja와 LLVM 도구를 포함하지만 일반 shell PATH에는 노출하지 않는다.
- 2026-08-09: `VsDevCmd.bat -arch=x64 -host_arch=x64` 환경에서는 `cl`, `cmake`, `ninja`, `clang-format`, `clang-tidy`가 모두 발견된다.
- 2026-08-09: 첫 sandboxed `pnpm view`는 network timeout으로 실패했고 registry 조회를 승인된 network 환경에서 다시 실행해 exact version/license를 확인했다.
- 2026-08-09: TypeScript latest 7.0.2는 선택한 typescript-eslint의 peer range와 맞지 않아 compatible latest 6.x인 6.0.3을 사용한다.
- 2026-08-09: 첫 sandboxed Debug configure는 MSVC ABI link 단계에서 출력 없이 교착되어 중단했다. 동일 명령을 승인된 sandbox 외부 환경에서 `--fresh`로 다시 실행하자 정상 완료됐고 이후 Native compiler/link command도 같은 환경에서 검증했다.
- 2026-08-09: 첫 clang-format dry run은 `native/tests/version_tests.cpp`의 조건식 줄바꿈 한 곳을 지적했다. 설치된 clang-format 22.1.3으로 first-party C++ 파일 4개를 포맷하고 dry run, Debug/Release build와 CTest, warnings-as-errors clean build를 다시 실행해 모두 통과했다.
- 2026-08-09: Debug/Release CTest는 각각 정확히 `garak_version_tests` 한 개를 실행해 통과했다. 두 smoke binary는 `Garak native scaffold 0.0.0`을 출력했고 Debug binary의 PE machine은 x64(`8664`)였다.
- 2026-08-09: 별도 `debug-clang-tidy` build directory의 clean build에서 clang-tidy 22.1.3이 core, smoke와 test source에 모두 실제 적용됐고 exit 0이었다.
- 2026-08-09: Electron 43 npm package는 더 이상 binary를 postinstall로 받지 않고 첫 CLI 실행에 on demand로 준비한다. `install-electron --no`를 실행해 Windows x64 binary와 runtime version 43.3.0을 확인한 뒤 frozen install을 통과했다.
- 2026-08-09: 첫 Studio format check는 `src/app.css` 한 파일로 실패했다. `pnpm studio:format` 뒤 format check와 lint를 다시 실행해 통과했다.
- 2026-08-09: 첫 Vite production build는 sandbox의 Windows realpath child process가 `spawn EPERM`으로 차단되어 실패했다. 동일 build를 승인된 sandbox 외부에서 실행해 renderer/main/preload output을 생성했다.
- 2026-08-09: CommonJS package 안의 `vite.config.ts`가 향후 native config loader 경고를 냈다. Config만 ESM을 명시하는 `vite.config.mts`로 바꾸고 Electron main/preload output은 CommonJS로 유지한 뒤 무경고 build를 확인했다.
- 2026-08-09: `vite-plugin-electron` 1.1.1 기본 startup이 `--no-sandbox`를 붙이는 security blocker를 독립 감사에서 발견했다. `startup(['.'])` override 후 실제 dev main command가 `electron.exe .`이고 flag가 없음을 확인했다.
- 2026-08-09: Production과 loopback dev GUI는 각각 Electron process 4개, responding window 1개와 `Garak Studio — Phase 0B` title을 확인했다. Bounded 검증 뒤 관련 process와 port 5173 listener는 0개였다.

## 의사결정 로그

- 2026-08-09: Native version API는 value type과 두 free function으로 제한하고 product/domain abstraction을 만들지 않기로 했다.
- 2026-08-09: Preset은 compiler path를 고정하지 않고 Visual Studio Developer environment 또는 macOS developer environment가 compiler를 제공하게 했다.
- 2026-08-09: Warnings-as-errors는 기본 OFF, 별도 configure/build preset에서 ON으로 검증한다.
- 2026-08-09: Preload는 Phase 0B에서 renderer API를 전혀 노출하지 않기로 했다.
- 2026-08-09: Electron main/preload build의 최소 반복 코드를 줄이기 위해 MIT `vite-plugin-electron`을 사용하되 optional renderer bridge는 설치하지 않는다.
- 2026-08-09: Electron package는 Studio runtime이지만 packaging이 없는 Phase 0B에서는 표준 관례대로 devDependency에 둔다.
- 2026-08-09: Direct dependency는 exact version으로 pin하고 root `packageManager`도 pnpm 11.16.0으로 고정한다.
- 2026-08-09: Studio package는 CommonJS로 유지하되 Vite config만 `.mts`로 두어 CJS Electron preload/main과 ESM build configuration을 분리한다.
- 2026-08-09: Plugin helper의 개발 편의 기본값보다 repository security policy가 우선하므로 Electron dev startup argument를 `['.']`로 명시한다.
- 2026-08-09: Remote redirect가 initial loopback URL 검증을 우회하지 않도록 `will-navigate`와 함께 `will-redirect`도 거부한다.
- 2026-08-09: Packaged Studio는 environment와 무관하게 bundled local file만 사용하도록 development URL을 `!app.isPackaged` 경로로 제한한다.

## 완료 기록

2026-08-09 Phase 0B를 **PASS**로 완료했다.

- Native: MSVC 19.51/CMake 4.3.1/Ninja 1.13.2에서 Debug·Release configure/build, CTest 1/1, 두 smoke 실행, `/WX` clean build, clang-format 4개와 target-scoped clang-tidy clean build가 모두 exit 0이었다. Smoke output은 두 configuration 모두 `Garak native scaffold 0.0.0`이고 Debug PE는 x64였다.
- Studio install: pnpm 11.16.0 `install`과 frozen install이 exit 0이었다. Electron 43 공식 on-demand installer로 Windows x64 binary를 준비하고 runtime version 43.3.0을 확인했다.
- Studio quality/build: 최종 lint, format check, renderer/main strict typecheck와 production build가 모두 exit 0이었다. `studio/dist/index.html`, `studio/dist-electron/main.js`와 빈 CJS `preload.js`가 존재한다.
- Studio runtime: Production과 `pnpm studio:dev`를 각각 bounded launch했다. 두 경우 모두 `Garak Studio — Phase 0B` responding window를 확인했으며 dev server는 `127.0.0.1:5173`만 사용했다. Dev main command는 `electron.exe .`이고 `--no-sandbox`가 없었다. 종료 뒤 관련 Electron process와 listener는 0개였다.
- Dependency: Studio direct 16개는 exact manifest/installed version과 license metadata가 일치했다. React/Electron/tooling은 Studio에만 속하고 generated plugin에는 포함되지 않는다. Native third-party dependency는 0개이며 transitive audit 완료를 주장하지 않는다.
- Repository: Phase 0A 24개 기준선은 24/24 보존했다. 최종 source 후보 64개에서 strict UTF-8, BOM, CR, trailing whitespace, tab과 final LF 문제 0; Markdown 25개와 local link 192개에서 broken 0이었다. Generated output/`node_modules` Git 후보, 금지 dependency/path, Phase 1 code identifier, repository `LICENSE`/`COPYING`은 모두 0이었다.
- Git: 여전히 commit이 없는 `master`이고 모든 source는 untracked다. Commit, branch 변경과 destructive Git 작업을 수행하지 않았다. `git diff --check`/cached check는 exit 0이지만 untracked를 보지 못하므로 raw-file 검사를 권위 증거로 사용했다.
- Architecture: 기존 architecture 계약을 바꾸지 않았고 새 ADR을 만들지 않았다. ADR 0001/0002/0004는 Accepted, runtime 전략 ADR 0003은 계속 Proposed다.
- 미검증: macOS, Apple Clang, Xcode, macOS Electron, VST3/AU, validator/host, DSP/realtime, `.garak`, state, packaging/signing과 전체 transitive license audit는 수행하지 않았다.

첫 시도의 sandbox 교착/EPERM, formatter 실패, Vite config 경고와 plugin 기본 `--no-sandbox` 문제는 발견 사항에 기록한 방식으로 수정했고 같은 검증을 재실행했다. 미해결 필수 검증이나 blocking defect는 없다.

## 다음 단계

권장하는 다음 작업은 별도 Phase 1 ExecPlan과 Steinberg SDK dependency/license 검토를 먼저 작성하는 최소 VST3 shell spike다. 범위는 stereo `Input → Gain → Output`, automated parameter 하나, bypass, state save/load, editor 없는 Windows x64 우선 VST3 shell, official validator 경로와 ADR 0003 A/B 비교 증거로 제한한다. Phase 1은 시작하거나 구현하지 않았다.
