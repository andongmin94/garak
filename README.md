# Garak

Garak(가락)은 음악가, 프로듀서와 사운드 디자이너가 자신의 사운드 컬러, control language, interface와 브랜드를 설계해 독립적인 native audio plug-in 제품으로 만들 수 있게 하는 오디오 제품 제작 플랫폼이다.

## 현재 제품 경로

현재 `main`의 Windows x64 기준 경로는 다음 하나다.

```text
unpacked .garak project
→ Product Compiler validation/migration
→ deterministic product.garakbin
→ prebuilt Garak Product Runtime v1
→ product-specific moduleinfo.json
→ local white-label VST3 bundle
→ first-party inspector + official VST3 Validator
```

Studio는 `.garak` 생성·열기·검증·저장·migration·conflict/recovery 처리와 Debug/Release export를 Electron main의 typed capability 경계로 제공한다. Renderer에는 Node.js, filesystem, shell 또는 raw IPC 권한이 없다.

Native Runtime은 C++20이며 생성된 VST3에는 Electron, Chromium, Node.js 또는 임의 JavaScript runtime이 포함되지 않는다. 현재 reference products는 `Artist Gain Warm`과 `Artist Gain Bright`이고, 둘은 같은 prebuilt Runtime bytes를 사용하면서 서로 다른 Product ID, VST3 FUID, metadata, default와 state를 가진다.

## 권위 있는 기준선

완료 판정은 문서에 적힌 과거 test 수가 아니라, **정확한 현재 `main` commit**에서 `garak/windows-foundation` status가 성공한 경우에만 유효하다. 이 gate는 clean Windows checkout에서 다음을 한 번에 수행한다.

- frozen pnpm install
- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/production build
- exact recursive VST3 SDK checkout 확인
- first-party C++ format
- Debug/Release Product Runtime clean build
- Warm/Bright actual export와 official standard/extensive validation
- loaded-module CTest와 inspector parity
- Studio ProductService Debug/Release workflow
- warnings-as-errors와 clang-tidy
- gate 실행 후 tracked source mutation 0 확인

현재 상태는 [`docs/status/current.md`](docs/status/current.md)를 따른다.

## 빠른 시작

### 요구 도구

- Windows x64
- Visual Studio x64 Developer Command environment
- CMake + Ninja
- Node.js 24.19.0
- pnpm 11.16.0
- exact recursive Steinberg VST3 SDK submodule

```powershell
git submodule update --init --recursive third_party/vst3sdk
corepack enable
corepack prepare pnpm@11.16.0 --activate
pnpm install --frozen-lockfile
```

### Product Compiler와 Studio

```powershell
pnpm product:format:check
pnpm product:lint
pnpm product:typecheck
pnpm product:test

pnpm studio:format:check
pnpm studio:lint
pnpm studio:typecheck
pnpm studio:test
pnpm studio:build
```

Studio development shell:

```powershell
pnpm --dir studio exec install-electron --no
pnpm studio:dev
```

### Native foundation

Visual Studio x64 Developer Command 환경에서 실행한다.

```powershell
cmake --preset debug --fresh
cmake --build --preset debug-build --clean-first
ctest --preset debug-test --no-tests=error

cmake --preset release --fresh
cmake --build --preset release-build --clean-first
ctest --preset release-test --no-tests=error
```

### 현재 Product Runtime과 실제 VST3 export

Debug:

```powershell
cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first

pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Debug --output out/exports/phase-1c1/debug --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Debug --output out/exports/phase-1c1/debug --force --validate

ctest --preset product-runtime-debug-test --no-tests=error
pnpm --dir studio verify:product-workflow --configuration Debug
```

Release:

```powershell
cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first

pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Release --output out/exports/phase-1c1/release --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Release --output out/exports/phase-1c1/release --force --validate

ctest --preset product-runtime-release-test --no-tests=error
pnpm --dir studio verify:product-workflow --configuration Release
```

Strict first-party gates:

```powershell
cmake --preset product-runtime-werror --fresh
cmake --build --preset product-runtime-werror-build --clean-first

cmake --preset product-runtime-clang-tidy --fresh
cmake --build --preset product-runtime-clang-tidy-build --clean-first
```

## 현재 구현된 계약

- editable project schema v2와 strict legacy v1 migration
- immutable Product ID와 deterministic processor/controller FUID derivation
- permanent Gain `1001` / Bypass `1002` Parameter IDs
- deterministic `GARAKCPD` v1 compiled product data
- product-bound `GARAKPST` v1 plug-in state
- durable project save, persistent verified backup와 crash recovery core
- main-owned migration/conflict/recovery decisions
- compiled artifact `use-existing` / `rebuild` / `reject` compatibility policy
- Windows local white-label VST3 export
- editorless mono/stereo Float32/Float64 Gain Runtime

## 제거된 기술 spike

Phase 1A의 fixed Gain module과 Phase 1B의 Data/Thin A/B runtime-strategy 구현은 의사결정을 위한 pre-release 기술 spike였다. 현재 제품 build graph와 source tree에서는 제거됐다. 당시 결과는 다음 문서에 역사적 증거로만 남긴다.

- [`plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md`](plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)
- [`plans/0004-phase-1b-generated-runtime-ab-spike.md`](plans/0004-phase-1b-generated-runtime-ab-spike.md)
- [`docs/adr/0003-generated-plugin-runtime-strategy.md`](docs/adr/0003-generated-plugin-runtime-strategy.md)
- [`docs/status/phase-1b-runtime-strategy-validation.md`](docs/status/phase-1b-runtime-strategy-validation.md)

이 문서에 기록된 삭제된 preset, target, script 또는 bundle은 현재 실행 명령이 아니다. Obsolete implementation을 compatibility path로 복구하지 않는다.

## 아직 제품이 아닌 부분

현재 Garak은 repository-local Windows vertical slice다. 다음은 아직 완료되지 않았다.

- general static DSP graph와 node library
- macro mapping과 functional Sound/Control workspaces
- native plug-in interface designer
- preset/asset product packaging
- packaged Studio와 clean-system installer
- representative DAW matrix와 장시간 audio stress/quality 기준
- macOS Universal VST3, AU, signing과 notarization
- backup retention/pruning과 advanced manual recovery
- repository 및 commercial redistribution legal decision

다음 product capability milestone은 current Windows foundation gate가 green인 뒤 시작하는 **Phase 3A — Minimal Static DSP Graph and Compiled Execution Plan**이다.

## 문서

- [Repository constitution](AGENTS.md)
- [Roadmap](ROADMAP.md)
- [Current status](docs/status/current.md)
- [System overview](docs/architecture/system-overview.md)
- [Runtime and export](docs/architecture/runtime-and-export.md)
- [VST3 adapter](docs/architecture/vst3-adapter.md)
- [Project persistence](docs/architecture/project-persistence-service.md)
- [Compiled/state compatibility](docs/architecture/compiled-and-state-compatibility.md)

저장소 자체의 라이선스는 아직 결정되지 않았다. 법률 검토와 명시적 결정 없이 `LICENSE`를 추가하지 않는다.
