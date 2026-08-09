# Garak

Garak(가락)은 음악가, 프로듀서와 사운드 디자이너가 자신의 사운드 컬러, control language, interface와 브랜드를 설계해 독립적인 native audio plugin 제품으로 출시할 수 있게 하는 오디오 제품 제작 플랫폼이다.

## 현재 상태

저장소는 Phase 0A 문서 기준선과 Phase 0B buildable scaffold를 보존한 채 **Phase 1A — Windows Minimal VST3 Gain Shell**을 PASS로 완료했다. Windows x64에서 exact-pinned 공식 Steinberg SDK로 fixed-metadata editorless VST3를 Debug/Release build하고 CTest와 official validator standard/extensive run을 검증했다.

현재 구현은 `0.0.0` version API, Native smoke/test, Sound / Control / Interface / Product placeholder Studio shell, 그리고 Gain/Bypass와 20-byte state를 가진 고정 `Garak Gain Spike` VST3 기술 spike다. 범용 DSP graph, `.garak`, generated runtime, native IPC, 실제 plugin editor, product compiler, export와 packaging은 아직 없다. 실제 DAW host, macOS VST3, AU, Apple Clang과 macOS Electron launch도 검증하지 않았다.

생성 플러그인의 목표는 Garak Studio가 없는 컴퓨터에서 독립적으로 오프라인 동작하는 white-label native 제품이다. 생성물에는 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 넣지 않는다.

## 빠른 시작

아래 명령은 2026-08-09 Windows x64에서 실제로 통과했다. Native 명령은 Visual Studio x64 Developer Command 환경에서 저장소 루트 기준으로 실행한다. 현재 검증 환경은 MSVC 19.51, CMake 4.3.1과 Ninja 1.13.2다.

### Native configure, build, test와 run

```text
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
```

### Studio install, quality와 build

Node.js 24와 pnpm 11.16.0을 사용한다. Electron 43은 desktop binary를 첫 실행에 on demand로 받으므로 GUI 전에 명시적으로 준비하려면 두 번째 명령을 사용한다.

```text
pnpm install --frozen-lockfile
pnpm --dir studio exec install-electron --no
pnpm studio:lint
pnpm studio:format:check
pnpm studio:typecheck
pnpm studio:build
pnpm studio:dev
```

`pnpm studio:dev`는 `127.0.0.1:5173`의 local development server와 Studio 창을 계속 실행한다. 종료할 때 `Ctrl+C`를 사용한다. Production build output은 `studio/dist/`와 `studio/dist-electron/`에 생성되며 Git 대상에서 제외된다.

### Phase 1A Windows x64 VST3

SDK와 nested repository를 exact gitlink로 재현한 뒤 repository-local bundle만 build/validate한다.

```text
git submodule update --init --recursive third_party/vst3sdk

cmake --preset vst3-debug
cmake --build --preset vst3-debug-build --clean-first
ctest --preset vst3-debug-test --no-tests=error
tools\vst3\validate.ps1 -Configuration Debug

cmake --preset vst3-release
cmake --build --preset vst3-release-build --clean-first
ctest --preset vst3-release-test --no-tests=error
tools\vst3\validate.ps1 -Configuration Release

cmake --preset vst3-werror
cmake --build --preset vst3-werror-build --clean-first
cmake --preset vst3-clang-tidy
cmake --build --preset vst3-clang-tidy-build --clean-first
```

실제 artifact, validator 수치와 미검증 범위는 [Phase 1A validation 상태](docs/status/phase-1a-vst3-validation.md)에 기록한다. System/user VST3 directory에 설치하거나 link하지 않는다.

## 확정된 기술 방향

- Garak Studio: Electron, React, TypeScript strict mode, Windows/macOS
- Native Engine과 generated plugin runtime: C++20
- Native build: CMake, Ninja, Windows의 MSVC, macOS의 Apple Clang
- JUCE를 사용하지 않음
- First-party model/API와 third-party SDK/library를 adapter 경계로 분리
- 기술 검증 순서: Windows x64 VST3 → macOS arm64/x86_64 VST3 → macOS AU
- 첫 상용 format 목표: Windows VST3, macOS Universal VST3, macOS AU

Steinberg VST3 SDK `v3.8.0_build_66`은 Phase 1A Windows x64 adapter spike에 한정해 exact pin과 build/validator를 검증했다. 이는 generated runtime, macOS, commercial redistribution 또는 전체 legal audit의 승인이 아니다. VSTGUI는 recursive checkout에만 존재하고 build/link하지 않는다. Skia, CanvasKit, Yoga, XYFlow, miniaudio, KissFFT와 FlatBuffers는 계속 미설치·미검증·미승인 후보다. 상세 경계는 [Phase 1A dependency 상태](docs/status/phase-1a-vst3-dependency.md)에 기록한다.

Generated plugin runtime 결합 방식은 [ADR 0003](docs/adr/0003-generated-plugin-runtime-strategy.md)이 `Proposed`인 동안 미결정이다. 다음 두 대안 중 어느 것도 현재 기본값이나 채택안이 아니다.

- A: prebuilt Garak Runtime에 product별 compiled data와 metadata 삽입
- B: product별 thin native wrapper를 생성하고 common Garak Runtime과 link

두 대안은 후속 Windows x64 VST3 기술 spike의 동일한 수용 기준으로 비교한 뒤 결정한다.

## 문서 지도

### 제품

- [제품 비전](docs/product/vision.md)
- [사용자와 사용 사례](docs/product/users-and-use-cases.md)
- [v0.1 제품 요구사항](docs/product/v0.1-prd.md)

### Architecture

- [시스템 개요](docs/architecture/system-overview.md)
- [모듈 경계](docs/architecture/module-boundaries.md)
- [Project model](docs/architecture/project-model.md)
- [Runtime과 export](docs/architecture/runtime-and-export.md)
- [Realtime과 quality](docs/architecture/realtime-and-quality.md)
- [Parameter와 state](docs/architecture/parameter-and-state.md)
- [Interface Designer](docs/architecture/interface-designer.md)
- [Dependency와 license policy](docs/architecture/dependency-policy.md)
- [VST3 Adapter](docs/architecture/vst3-adapter.md)

### 결정 기록

- [ADR 0001 — TypeScript Studio and C++20 Engine](docs/adr/0001-typescript-studio-and-cpp20-engine.md) — Accepted
- [ADR 0002 — No JUCE and Adapter Boundaries](docs/adr/0002-no-juce-and-adapter-boundaries.md) — Accepted
- [ADR 0003 — Generated Plugin Runtime Strategy](docs/adr/0003-generated-plugin-runtime-strategy.md) — Proposed
- [ADR 0004 — Windows, macOS, and Plugin Formats](docs/adr/0004-windows-macos-and-plugin-formats.md) — Accepted

### 계획과 상태

- [Roadmap](ROADMAP.md)
- [현재 상태](docs/status/current.md)
- [ExecPlan 규약](PLANS.md)
- [Phase 0A ExecPlan](plans/0001-phase-0a-repository-foundation.md)
- [Phase 0B ExecPlan](plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md)
- [Phase 0B dependency 상태](docs/status/phase-0b-dependencies.md)
- [Phase 1A ExecPlan](plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)
- [Phase 1A VST3 identity](docs/status/phase-1a-vst3-identity.md)
- [Phase 1A VST3 dependency](docs/status/phase-1a-vst3-dependency.md)
- [Phase 1A VST3 validation](docs/status/phase-1a-vst3-validation.md)

저장소 작업 규칙과 문서 우선순위는 [AGENTS.md](AGENTS.md)를 따른다.

## 정확한 다음 milestone

다음 권장 작업은 별도 ExecPlan을 먼저 작성하는 **Phase 1B — Generated Runtime A/B Comparison** 기술 spike다. Phase 1A의 동일한 Windows x64 VST3 수용 기준으로 prebuilt runtime + product data와 product-specific thin wrapper + common runtime을 비교할 최소 evidence만 만든다.

Phase 1A만 완료했으며 Phase 1 전체는 아직 미완료다. ADR 0003은 계속 Proposed이고 어느 대안도 채택·선호·기본값이 아니다. Phase 1B에서는 DSP graph, `.garak`, Studio IPC, editor, export 또는 상용 제품 기능을 함께 구현하지 않는다.

## License

이 저장소의 license는 아직 결정되지 않았다. `LICENSE` 파일이 없으며, 별도의 license 결정 전에는 이 저장소가 특정 open-source 또는 상용 재배포 권한을 부여한다고 해석해서는 안 된다.
