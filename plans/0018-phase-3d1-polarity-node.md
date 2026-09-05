# ExecPlan 0018 — Phase 3D1 Polarity Node

- Status: In Progress
- Started: 2026-09-04
- Updated: 2026-09-05
- Owner: Product Compiler, Native static graph Runtime and Studio product workflow

## 목적

Phase 3C에서 완성한 editable graph → deterministic compiled graph → module-load binding → realtime execution 경로에 첫 추가 DSP node인 fixed Polarity node를 연결한다. 기존 Gain-only 제품 경로를 유지하면서 `Audio Input → Gain → Polarity → Audio Output` 제품을 schema, compiler, Native Runtime, inspector, realtime stress와 actual Windows VST3 export까지 end-to-end로 추가한다.

## 사용자 가치

Garak project가 Runtime에 암묵적으로 고정된 Gain chain만 표현하는 상태를 벗어나, project-owned graph에 존재하는 추가 sound operation이 실제 생성 plug-in의 출력에 결정적으로 반영된다. Polarity node가 포함된 제품은 active processing에서 신호를 반전하고 host Bypass에서는 원신호를 그대로 통과시키며, Gain automation과 realtime 무할당 계약을 보존한다.

## 현재 저장소 상태

- Starting `main`: `edf7b71159092e51779833a8e726728d7dd98437`
- Phase 3C accepted main: `ccdf0b89a48830bcc7ac99047e00a77b855df9fb`
- Current editable project schema: v3
- Current embedded graph source: v1, exact `Input → Gain → Output`
- Current compiled graph: `GARAKGRF` 1.0, exact three operations and 92 bytes
- Current Product Runtime public parameters/state: Gain `1001`, Bypass `1002`
- Current reference products: `Artist Gain Warm`, `Artist Gain Bright`
- Repository branch policy: development and verification proceed directly on `main`; no temporary branch or PR is created.

## 범위

- fixed, parameterless Polarity DSP node implementation version 1
- current project schema v4 and embedded graph source v2
- strict v3→v4 migration preserving existing Gain-only sound semantics
- graph source v2 support for exactly two linear topologies:
  - `Audio Input → Gain → Audio Output`
  - `Audio Input → Gain → Polarity → Audio Output`
- deterministic `GARAKGRF` 1.1 compilation for both supported topologies
- explicit old `GARAKGRF` 1.0 rebuild disposition and current 1.1 load disposition
- Native static execution plan/binding capable of gain-only or gain-plus-polarity execution
- sample-accurate whole-product Bypass semantics for both topologies
- direct Polarity DSP tests, graph codec/binding tests and no-allocation realtime stress
- one new polarity reference product and actual Debug/Release VST3 export/inspection/Validator coverage
- Studio main-owned read-only graph round-trip and ordered v1/v2/v3→v4 migration coverage
- affected architecture, status, roadmap and plan documentation

## 비범위

- user-exposed Polarity parameter or new Parameter ID
- changing `GARAKCPD` 1.0 or `GARAKPST` 1.0
- changing Product ID or processor/controller FUID derivation
- Pan, Dry/Wet, Biquad, Tilt EQ or Saturation
- arbitrary DAG, repeated node types, branching, feedback, sidechain or dynamic buffer allocation
- generic node registry or speculative scheduler framework
- Studio graph canvas, renderer graph mutation, undo/redo or macro mapping
- native plug-in editor, presets, installer, DAW matrix, macOS or AU

## 전제와 제약

- Repository `AGENTS.md`, Native/Studio subtree instructions, accepted ADRs and completed Phase 3C plans remain authoritative.
- Product ID, FUID derivation, Gain `1001`, Bypass `1002`, `GARAKCPD` 1.0 and `GARAKPST` 1.0 remain unchanged.
- A host Bypass value of true bypasses the whole product graph, not only the Gain multiplication.
- Graph parsing, version classification and binding preparation remain outside the audio callback.
- Callback execution allocates/frees zero times, performs bounded work and avoids locks, I/O, logging and mutation.
- Accepted v3/v1/1.0 meanings are not silently broadened; source and compiled contracts advance explicitly.
- Obsolete gain-only internal static-graph names are replaced directly; no compatibility aliases or shims are retained.
- Every repository write is made directly to `main` under the branch policy.

## 설계 결정

### Polarity is fixed graph structure, not a public parameter

Presence of one `garak.polarity` implementation 1 node means active audio samples are multiplied by `-1`. The first increment intentionally has no node property and no host-exposed parameter. This proves a second DSP operation without prematurely introducing the Phase 4 parameter/macro system or changing persistent plug-in state.

### Explicit source and compiled version evolution

Project schema advances to v4 and embedded graph source advances to v2. Schema v3 remains the exact historical graph-source-v1 contract. Migration v3→v4 upgrades the embedded graph document to v2 while preserving its Gain-only topology and authoring node IDs.

`GARAKGRF` advances from 1.0 to 1.1 because the current parser must support both three- and four-operation plans. Existing 1.0 bytes remain derived old artifacts and are rebuilt from validated editable source; deployed Runtime continues to reject every non-current artifact.

### Two exact linear plans, no generic graph engine

The compiler and Runtime accept only two canonical semantic plans. Gain-only uses three operations. Gain-plus-polarity adds one Polarity operation after Gain, uses one additional deterministic intermediate buffer and zero latency, then routes that buffer to Audio Output. This is sufficient for the approved capability and does not introduce arbitrary scheduling.

### Whole-product bypass remains one realtime pass

The existing Gain automation loop is extended with an active-sample transform. The identity transform preserves Gain-only behavior; the Polarity transform negates only the non-bypassed branch. Bypassed samples copy original input unchanged, preserving exact-offset Bypass semantics without callback allocation.

### Direct internal rename instead of compatibility wrapper

`GainExecutionPlan`, `GainExecutionBinding`, `gain_plan.hpp`, and gain-specific parser/executor names no longer describe the current static graph. They are replaced with static execution plan/binding names in one change. These are pre-release internal APIs, so no alias layer is added.

## 구현 단계

1. [x] Write this ExecPlan directly on `main` before source implementation.
2. [x] Add Polarity DSP module and direct Float32/Float64/in-place tests.
3. [ ] Evolve project schema to v4 and graph source to v2 with strict dual-topology validation.
4. [ ] Add ordered v3→v4 migration and fixed legacy v3 fixtures while preserving identity and sound semantics.
5. [ ] Evolve deterministic compiled graph to `GARAKGRF` 1.1 with exact gain-only and polarity fixtures.
6. [ ] Replace gain-specific static graph plan/binding API with dual-plan static execution API.
7. [ ] Integrate polarity execution with whole-product sample-accurate Bypass and allocation-free processing.
8. [ ] Add the polarity reference product and extend inspector, CTest and Studio product workflow coverage.
9. [ ] Extend TypeScript/C++ compatibility and realtime stress matrices for old 1.0/current 1.1 and both current plans.
10. [ ] Update architecture/status/roadmap to the Phase 3D1 acceptance-pending state.
11. [ ] Run local TypeScript and non-SDK Native gates; fix every failure.
12. [ ] Commit the implementation directly to `main` and run exact-main clean Windows full product gate.
13. [ ] Fix failures directly on `main`, rerun exact current main, then mark Complete only after a green gate.

## 변경 대상 파일

Expected additions:

- `native/dsp/polarity/` public header, implementation and CMake target
- direct Polarity DSP test
- current graph source v2 / project schema v4 architecture documentation
- `examples/products/artist-gain-inverted.garak/product.json`
- fixed legacy schema v3 fixtures

Expected replacements:

- `native/runtime/static_graph/.../gain_plan.hpp` with a static execution plan header

Expected modifications:

- Product Compiler project model, graph validation, migration, compiled graph codec, compatibility and tests
- Native static graph parser/classifier, Runtime context/processor/inspector and tests
- Studio typed API, service/workflow tests and read-only graph presentation where needed
- CMake test/export registration for the new reference product
- `README.md`, `ROADMAP.md`, `docs/status/current.md`, compatibility and realtime architecture documents

The final file list will be recorded at completion.

## 검증 계획

Locally available checks:

```text
pnpm product:format:check
pnpm product:lint
pnpm product:typecheck
pnpm product:test
pnpm studio:format:check
pnpm studio:lint
pnpm studio:typecheck
pnpm studio:test
pnpm studio:build
cmake --preset debug --fresh
cmake --build --preset debug-build --clean-first
ctest --preset debug-test --no-tests=error
cmake --preset release --fresh
cmake --build --preset release-build --clean-first
ctest --preset release-test --no-tests=error
git diff --check
```

Authoritative acceptance remains a clean Windows x64 checkout of the exact `main` commit with:

- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/build
- Debug and Release Product Runtime clean build
- Warm/Bright/Inverted actual export and official VST3 Validator
- Debug and Release CTest and Studio product workflow
- warnings-as-errors and clang-tidy
- tracked-source mutation zero

## 수용 기준

- Current project schema is v4 with embedded graph source v2.
- v1/v2/v3 projects reach v4 through explicit ordered migration, and v3→v4 preserves existing Gain-only compiled sound semantics.
- Graph v2 accepts only the exact gain-only or gain-plus-polarity linear chain and rejects all other counts, node types, versions, endpoints and topology.
- Valid authoring IDs and source array order do not change compiled bytes for the same topology.
- `GARAKGRF` 1.1 encodes/decodes exact three- or four-operation current plans; 1.0 is classified old/rebuild and future/corrupt data remains rejected.
- Native Runtime obtains one validated static binding and executes the same topology represented by project source.
- Polarity products output `-input * gain` when active and exact dry input when bypassed, for Float32/Float64, mono/stereo and in-place/out-of-place processing.
- Realtime stress reports allocation/deallocation zero for both gain-only and polarity bindings.
- Warm/Bright existing output/state behavior remains unchanged.
- Inverted reference product exports and passes first-party inspector, loaded-module tests and official Validator in Debug and Release.
- Product/FUID/Parameter IDs, `GARAKCPD` and `GARAKPST` remain unchanged.
- Exact final `main` source passes the complete clean Windows matrix.

## 리스크

- Applying Polarity after the existing Gain kernel as an independent second pass would invert bypassed dry samples. The active-transform execution keeps whole-product bypass semantics in one pass.
- Broadening graph source v1 or compiled graph 1.0 would make accepted historical meanings ambiguous. Explicit v2/v4/1.1 boundaries avoid silent reinterpretation.
- A generic variable-node executor could overgrow before a second node is proven. Current code supports only two exact plans with fixed-size storage.
- Renaming the static graph API can leave stale includes or tests. Repository-wide search and warnings-as-errors/tidy gates must show no old symbol path remains.
- Adding a third reference product can expose hard-coded two-product assumptions in Studio, CMake and smoke tests. Those assumptions are updated in the same increment.

## 발견 사항

- 2026-09-05: The available source archive has the exact same `native`, `studio`, `tools`, `examples`, and `cmake` tree hashes as main `9d7431dae8539ef02d13b5c2ded5c744ae3bb863`. Implementation was written against those verified source trees.

- 2026-09-04: Repository-wide branch cleanup left only `main`; all Phase 3D work proceeds directly on `main`.
- 2026-09-04: Polarity is the smallest additional node because it needs no new persistent host parameter or state entry while still proving project-owned multi-operation sound execution.
- 2026-09-04: The existing Gain kernel owns sample-accurate Bypass, so a naive post-Gain polarity pass would violate whole-product bypass behavior.

## 의사결정 로그

- 2026-09-04: Select fixed Polarity as Phase 3D1 before Pan or Dry/Wet because it minimizes persistent-contract changes.
- 2026-09-04: Advance project schema to v4, graph source to v2 and compiled graph to 1.1 instead of broadening accepted version meanings.
- 2026-09-04: Keep `GARAKCPD`, `GARAKPST`, Gain `1001` and Bypass `1002` unchanged.
- 2026-09-04: Preserve whole-product Bypass by applying Polarity only to the active branch inside the existing sample-accurate loop.

## 완료 기록

Only step 2 is implemented: a standalone `garak::dsp_polarity` module, Float32/Float64 scalar and span processing, direct mono/stereo in-place/out-of-place tests, and standalone Polarity coverage in the existing allocation-counted stress executable. Span length mismatches are rejected without partial output. The pure inverter does not own signal sanitation or host Bypass.

Changed source files are `native/dsp/polarity/{CMakeLists.txt,include/garak/dsp/polarity/polarity.hpp,src/polarity.cpp}`, `native/dsp/CMakeLists.txt`, `native/CMakeLists.txt`, `native/tests/{CMakeLists.txt,polarity_dsp_tests.cpp,realtime_stress_tests.cpp}`. The Product Runtime quality aggregate builds the module and its tests, but the plug-in processing path is unchanged.

Actual local verification on Linux, using CMake 3.31.6, GCC 14.2 and Clang 17:

- `cmake --preset debug --fresh`, `cmake --build --preset debug-build --clean-first`, `ctest --preset debug-test --no-tests=error`: 5/5 passed.
- Corresponding `release`, `release-build`, `release-test` commands: 5/5 passed.
- `cmake --preset debug-warnings-as-errors --fresh -DCMAKE_CXX_COMPILER=clang++`, `cmake --build --preset warnings-as-errors-build --clean-first`, then CTest in that build directory: 5/5 passed.
- A separate Clang Debug build with `-fsanitize=address,undefined -fno-omit-frame-pointer`, matching linker flags and warnings-as-errors: 5/5 passed.
- The standalone Polarity stress processes 20,000 blocks per sample type, 1,907,696 channel-samples each, with measured C++ allocations and deallocations both zero. Existing Gain stress also passes. This is not a compiled Polarity graph test.
- `git diff --check`: passed.

Not run: pinned Product Compiler/Studio quality gates, clang-format, clang-tidy, Windows/MSVC builds, VST3 export or official Validator. No package, dependency, source schema, binary contract, public parameter, plug-in state, or existing Gain processing behavior was changed. Graph-source/compiler/Runtime integration and the Inverted product remain unimplemented. Phase 3D1 remains In Progress; the accepted product baseline is still Phase 3C.

## 다음 단계

Complete and accept Phase 3D1 on `main` before selecting the next Phase 3D node. Pan, Dry/Wet, Biquad, Tilt EQ and Saturation remain separate increments.
