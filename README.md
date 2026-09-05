# Garak

Garak(가락)은 음악가와 창작자가 자기 사운드, control language, interface와 브랜드를 설계해 독립적인 native audio plug-in 제품으로 만들 수 있게 하는 오디오 제품 제작 플랫폼이다.

## 현재 제품 경로

현재 source tree의 Windows x64 기준 경로는 다음 하나다.

```text
unpacked .garak project
→ Product Compiler validation/migration
→ deterministic product.garakbin + graph.garakbin
→ prebuilt Garak Product Runtime v1
→ module-load validation of product and graph resources
→ module-load prepared Input → Gain → Output execution binding
→ product-specific moduleinfo.json
→ local white-label VST3 bundle
→ first-party inspector + official VST3 Validator
```

Studio는 `.garak` 생성·열기·편집·migration·conflict/recovery 처리와 Debug/Release export를 Electron main의 typed capability 경계로 제공한다. Renderer에는 Node.js, filesystem, shell 또는 raw IPC 권한이 없다.

Native Runtime은 C++20이며 생성된 VST3에는 Electron, Chromium, Node.js 또는 임의 JavaScript runtime이 포함되지 않는다. 현재 reference products는 `Artist Gain Warm`과 `Artist Gain Bright`이고, 둘은 같은 prebuilt Runtime bytes와 같은 canonical compiled graph를 사용하면서 서로 다른 Product ID, VST3 FUID, metadata, default와 state를 가진다.

## 현재 검증 상태

Phase 3B의 전체 Windows 검증은 historical realtime-safety 기준선으로 남아 있다.

- verified implementation commit: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- historical workflow run: `32634527751`
- result: Product Compiler, Studio, Debug/Release export, Validator, CTest, Werror와 clang-tidy success

Phase 3C1은 PR `#103`으로 `main`에 squash merge됐다.

- accepted main commit: `1666c667e6e635447b387a5e25bcce7ef1ee42e5`
- exact verified product head: `837e01ef96c11800b246a50eff92c4599e630080`
- clean Windows run: `33610351357`
- Product Compiler와 Studio format/lint/typecheck/test/build success
- Debug/Release Product Runtime clean build success
- Warm/Bright actual export와 official VST3 Validator success
- Debug/Release CTest와 Studio product workflow success
- warnings-as-errors와 clang-tidy success
- tracked source mutation `0`

Phase 3C2는 current schema v3, embedded graph source v1, strict v1/v2 migration, source-derived
`graph.garakbin`과 Studio main-owned graph round-trip을 실제 제품 경로에 연결했다. Exact source
`b727afb4cd1471dbd61ce775355be60e040c7000`의 clean Windows run `33622226202`에서 Product Compiler/Studio format·lint·typecheck·test·build,
Debug/Release Runtime build, Warm/Bright actual export와 official Validator, CTest, Studio workflow,
warnings-as-errors, clang-tidy와 tracked-source mutation `0`이 모두 통과했다. 따라서 **Phase 3C2는 PASS /
Complete**다.

Phase 3C3는 compiled graph의 current/missing/old/future/corrupt disposition을 Product Compiler,
Native Runtime과 first-party inspector에 통일했다. Exact source `d60667d8806e5dac7963ae928dcf98dc377cf0f7`의 clean Windows run `33657806095`에서
Product Compiler와 Studio quality gate, Debug/Release Runtime build, Warm/Bright actual export와 official
Validator, CTest, Studio workflow, warnings-as-errors, clang-tidy와 tracked-source mutation `0`이 모두
통과했다. 따라서 **Phase 3C3와 Phase 3C는 PASS / Complete**다.

Phase 3D는 `plans/0018-phase-3d1-polarity-node.md`의 Polarity increment로 시작했지만, 현재 production source와 Windows acceptance는 아직 완료되지 않았다. 현재 사실은 [`docs/status/current.md`](docs/status/current.md)를 따른다.

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

- editable project schema v3, embedded graph source v1과 strict legacy v1/v2 migration
- immutable Product ID와 deterministic processor/controller FUID derivation
- permanent Gain `1001` / Bypass `1002` Parameter IDs
- deterministic `GARAKCPD` v1 compiled product data
- validated `project.graph`에서 파생되는 deterministic `GARAKGRF` v1 compiled graph data
- product-bound `GARAKPST` v1 plug-in state
- durable project save, persistent verified backup와 crash recovery core
- main-owned migration/conflict/recovery decisions
- compiled product/graph와 state의 explicit load/rebuild/reject compatibility policy
- Windows local white-label VST3 export
- editorless mono/stereo Float32/Float64 Gain Runtime
- module-load graph parse/validation과 immutable prepared execution binding
- first-party static-plan/Gain process window의 C++ allocation/deallocation `0` regression
- deterministic Float32/Float64 long-run runtime stress와 bounded CTest timeout

## Phase 3 진행 상태

### Phase 3A — Minimal Native Static Execution Plan — Complete

Phase 3A는 production Gain DSP를 실제 processor dispatch와 연결하는 최소 native execution boundary를 확립했다. 당시 `graph.garakbin`과 editable graph source는 의도적으로 범위 밖이었다.

### Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress — Complete

별도 first-party executable에서 production static plan과 Gain DSP를 fixed-size stack storage로 실행해 Float32/Float64 각각 20,000 blocks를 검증했다. 역사적 full Windows gate에서 allocation `0`, deallocation `0`, output/state/silence mismatch `0`을 확인했다.

### Phase 3C — Editable Static Graph Project Contract and Compiled Plan — Complete

#### Phase 3C1 — Runtime-consumed compiled graph resource — Complete

- deterministic `graph.garakbin` v1
- actual export inventory와 hash parity
- Native module-load parser
- module-load prepared immutable binding을 사용하는 processor dispatch
- missing/corrupt/unsupported resource fail-closed 기반
- resource foundation commit `510f906f45924ad4ef035f6598fc193c25eed245`와 corrected implementation commit `8d3461f2e79f38b6e4268d852614eed496b46c82`의 clean Windows full gate success

#### Phase 3C2 — Editable project schema v3 — Complete

수용된 구현:

- current project schema v3와 embedded graph source v1
- strict graph/node/port/connection validation
- ordered v1→v2→v3와 v2→v3 migration
- canonical v3 serialization과 exact legacy/current fixture oracle
- valid authoring ID/order에 독립적인 source-derived `graph.garakbin`
- Studio main-owned read-only graph create/open/save/reopen/migrate round-trip
- invalid current graph의 export-before-output fail-closed

검증 근거:

- exact verified source: `b727afb4cd1471dbd61ce775355be60e040c7000`
- clean Windows run: `33622226202`
- Product Compiler와 Studio format/lint/typecheck/test/build success
- Debug/Release Runtime clean build, Warm/Bright actual export와 official Validator success
- Debug/Release CTest와 Studio product workflow success
- warnings-as-errors, clang-tidy와 tracked-source mutation `0`

Phase 3C2는 **Complete**다.

#### Phase 3C3 — Compiled graph compatibility and final product gate — Complete

수용된 구현:

- `GARAKGRF` current/missing/old/future/corrupt semantic disposition
- Product Compiler compatibility API/CLI의 compiled graph report
- Native current classifier가 actual `GainExecutionBinding` 반환
- Product Runtime과 first-party inspector가 같은 Native classifier 및 resource reader 사용
- TypeScript/C++ fixed-fixture compatibility matrix와 filesystem regression
- missing/old derived data만 authoring context에서 rebuild, future/corrupt data는 preserve/reject

검증 근거:

- exact verified source: `d60667d8806e5dac7963ae928dcf98dc377cf0f7`
- clean Windows run: `33657806095`
- Product Compiler와 Studio format/lint/typecheck/test/build success
- Debug/Release Runtime clean build, Warm/Bright actual export와 official Validator success
- Debug/Release CTest와 Studio product workflow success
- warnings-as-errors와 clang-tidy success
- tracked-source mutation `0`

Phase 3C는 **Complete**다. 다음 increment는 **Phase 3D — Initial DSP Node Set**이다.

## 제거된 기술 spike

Phase 1A의 fixed Gain module과 Phase 1B의 Data/Thin A/B runtime-strategy 구현은 의사결정용 pre-release 기술 spike였다. 현재 제품 build graph와 source tree에서는 제거됐다. 당시 결과는 역사적 문서에만 남긴다. 삭제된 spike source, preset, packaging path 또는 FUID reservations를 compatibility layer로 복원하지 않는다.

## 아직 제품이 아닌 부분

현재 Garak은 repository-local Windows vertical slice다. 다음은 아직 완료되지 않았다.

- additional DSP node library
- cross-thread automation/state handoff 및 kernel-level blocking 계측
- macro mapping과 functional Sound/Control workspaces
- native plug-in interface designer
- preset/asset product packaging
- packaged Studio와 clean-system installer
- representative DAW matrix와 audio quality 기준
- macOS Universal VST3, AU, signing과 notarization
- backup retention/pruning과 advanced manual recovery
- repository 및 commercial redistribution legal decision

## 문서

- [Repository constitution](AGENTS.md)
- [Roadmap](ROADMAP.md)
- [Current status](docs/status/current.md)
- [Phase 3C ExecPlan](plans/0014-phase-3c-editable-static-graph-contract.md)
- [Phase 3C1 execution correction](plans/0015-phase-3c1-graph-execution-correction.md)
- [Phase 3C2 editable schema v3](plans/0016-phase-3c2-editable-project-schema-v3.md)
- [Phase 3C3 compiled graph compatibility](plans/0017-phase-3c3-compiled-graph-compatibility.md)
- [Editable Project Schema v3](docs/architecture/editable-project-schema-v3.md)
- [System overview](docs/architecture/system-overview.md)
- [Runtime and export](docs/architecture/runtime-and-export.md)
- [VST3 adapter](docs/architecture/vst3-adapter.md)
- [Project persistence](docs/architecture/project-persistence-service.md)
- [Compiled/state compatibility](docs/architecture/compiled-and-state-compatibility.md)

저장소 자체의 라이선스는 아직 결정되지 않았다. 별도 법률 검토와 명시적 결정 없이 `LICENSE`를 추가하지 않는다.
