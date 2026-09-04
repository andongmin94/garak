# ExecPlan 0018 — Phase 3D1 Polarity Node

- Status: In Progress
- Started: 2026-09-04
- Updated: 2026-09-04
- Owner: Product Compiler, Native static graph Runtime and Studio product workflow

## 목적

Phase 3C에서 완성한 editable graph → deterministic compiled graph → module-load binding → realtime execution 경로에 첫 추가 DSP node인 fixed Polarity v1을 연결한다. Existing Gain-only products를 보존하면서 `Audio Input → Gain → Polarity → Audio Output` 제품을 schema, migration, compiler, Native Runtime, inspector, realtime stress와 actual Windows VST3 export까지 end-to-end로 추가한다.

## 사용자 가치

Project-owned graph의 두 번째 sound operation이 생성 plug-in의 출력에 실제로 반영된다. Polarity product는 active sample의 부호를 반전하고 whole-product Bypass sample은 원신호를 그대로 통과시킨다. 이 increment는 새로운 public parameter/state를 만들지 않으므로 Phase 4 parameter/macro system을 앞당기지 않는다.

## 현재 저장소 상태

- Starting accepted product baseline: Phase 3C main `ccdf0b89a48830bcc7ac99047e00a77b855df9fb`
- Direct-main branch-policy baseline: `edf7b71159092e51779833a8e726728d7dd98437`
- Plan-first main commit: `d9248131f02d134931414807fd63f3e88ad18df1`
- Current editable project before this increment: schema v3, graph source v1, exact Gain-only topology
- Current compiled graph before this increment: `GARAKGRF 1.0`, 3 operations, 92 bytes
- Persistent public state: Gain `1001`, Bypass `1002`, `GARAKCPD 1.0`, `GARAKPST 1.0`
- Repository development proceeds directly on `main`; no feature, verification or cleanup branch is used.

## 범위

- fixed, parameterless Polarity DSP implementation version 1
- project schema v4 and embedded graph source v2
- explicit v3→v4 migration preserving Gain-only sound semantics and authoring IDs
- exact supported topologies:
  - `Input → Gain → Output`
  - `Input → Gain → Polarity → Output`
- deterministic `GARAKGRF 1.1` 3-operation and 4-operation plans
- old `GARAKGRF 1.0` rebuild disposition and current 1.1 load disposition
- Native `StaticExecutionPlan` / `StaticExecutionBinding`
- sample-accurate whole-product Bypass-safe active transform
- direct Polarity tests and Gain/Polarity allocation-free realtime stress
- `Artist Gain Inverted` reference product
- Studio main-owned read-only graph round trip and actual export workflow coverage
- affected architecture, roadmap and current-status documentation

## 비범위

- public Polarity parameter or new Parameter ID
- `GARAKCPD 1.0`, `GARAKPST 1.0`, Product ID or FUID derivation changes
- Pan, Dry/Wet, Biquad, Tilt EQ or Saturation
- arbitrary DAG, repeated nodes, branching, feedback, sidechain or dynamic allocation
- generic node registry or speculative scheduler
- renderer graph mutation, graph canvas, undo/redo or macro mapping
- plug-in editor, presets, installer, DAW matrix, macOS or AU

## 전제와 제약

- `AGENTS.md`, subtree instructions and accepted ADRs remain authoritative.
- Whole-product Bypass applies before Polarity; bypassed samples must never be inverted.
- Graph parsing/classification/binding preparation remain outside the callback.
- Callback work is bounded and allocation/free, lock, I/O, logging and mutation remain forbidden.
- Existing version meanings are not broadened silently. Project, graph source and compiled graph versions advance explicitly.
- Pre-release gain-specific internal API is replaced directly; no alias or compatibility shim remains.
- Every repository write is made directly to `main`.

## 설계 결정

### Parameterless fixed Polarity

Presence of one `garak.polarity` implementation 1 node means active Gain output is multiplied by `-1`. No node property, host parameter or state entry is introduced.

### Explicit version evolution

Project schema advances v3→v4, graph source v1→v2 and compiled graph `1.0→1.1`. Legacy v3 graph source remains exact historical input and migrates to gain-only graph source v2. Polarity is never injected during migration.

### Two exact plans

Compiler and Runtime accept only the two approved linear plans. Gain-only remains three operations. Polarity adds one in-place operation after Gain, uses the same two fixed buffer slots and zero latency. This proves multi-operation product behavior without an unfinished generic graph engine.

### Whole-product Bypass in one pass

Gain processing accepts a compile-time active transform. Identity preserves Gain-only output; Polarity negates only the active branch. The bypass branch copies original input, preserving exact-offset behavior without a second pass.

## 구현 단계

1. [x] Write this ExecPlan directly on `main` before source implementation.
2. [x] Add Polarity DSP module and direct Float32/Float64 tests.
3. [x] Evolve project schema to v4 and graph source to v2 with strict dual-topology validation.
4. [x] Add ordered v3→v4 migration and fixed legacy-v3 fixtures while preserving identity and sound semantics.
5. [x] Evolve deterministic compiled graph to `GARAKGRF 1.1` with exact Gain and Polarity fixtures.
6. [x] Replace gain-specific static graph plan/binding API with dual-plan static execution API.
7. [x] Integrate Polarity execution with whole-product sample-accurate Bypass and allocation-free processing.
8. [x] Add the Inverted reference product and extend inspector, CTest and Studio workflow coverage.
9. [x] Extend TypeScript/C++ compatibility and realtime stress matrices for old 1.0/current 1.1 and both current plans.
10. [x] Update architecture/status/roadmap to the Phase 3D1 acceptance-pending state.
11. [x] Run local TypeScript direct tests/typecheck, Debug/Release Native CTest, warnings-as-errors and diff checks; fix all failures.
12. [ ] Commit implementation directly to `main` and pass exact-main clean Windows full product gate.
13. [ ] Fix any Windows failure directly on `main`, rerun the new exact commit, then mark Complete and remove the one-time verifier.

## 실제 변경 파일

Additions include:

- `native/dsp/polarity/`
- `native/runtime/static_graph/include/garak/runtime/static_graph/execution_plan.hpp`
- `native/tests/polarity_dsp_tests.cpp`
- `examples/products/artist-gain-inverted.garak/product.json`
- `examples/products/legacy/v3/`
- `docs/architecture/editable-project-schema-v4.md`

Replaced obsolete internal path:

- removed `native/runtime/static_graph/include/garak/runtime/static_graph/gain_plan.hpp`

Modified areas include Product Compiler graph/schema/migration/compatibility/export tests, Native Runtime and adapter bindings, Studio typed graph/session/workflow tests, CMake registrations and product/status documentation.

## 검증 결과와 계획

Local completed results:

- Product Compiler direct tests: 102 total, 101 pass, 1 Windows-only skip, 0 fail
- Studio typed tests: 15/15 pass
- Product Compiler TypeScript typecheck: pass
- Debug Native build/CTest: 5/5 pass
- Release Native build/CTest: 5/5 pass
- first-party warnings-as-errors build: pass
- `git diff --check`: pass

Authoritative acceptance remains a clean Windows x64 checkout of the exact direct-main candidate with:

- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/build
- Debug/Release Product Runtime clean build
- Warm/Bright/Inverted actual export and official VST3 Validator
- Debug/Release CTest and Studio product workflow
- warnings-as-errors and clang-tidy
- tracked-source mutation `0`

## 수용 기준

- Current project schema is v4 with graph source v2.
- v1/v2/v3 reach v4 through explicit ordered migration; v3→v4 preserves Gain-only compiled sound semantics.
- Graph v2 accepts only exact Gain-only or Gain→Polarity chains.
- Authoring IDs and array order do not alter compiled bytes for the same topology.
- `GARAKGRF 1.1` encodes exact 3/4-operation plans; 1.0 rebuilds and future/corrupt data rejects.
- Runtime executes the topology represented by project source through one prepared binding.
- Polarity output is `-(input × gain)` when active and exact input when bypassed.
- Float32/Float64, mono/stereo and in-place/out-of-place processing remain valid.
- Gain and Polarity stress show allocation/deallocation `0`.
- Warm/Bright output/state behavior remains unchanged.
- Inverted exports and passes inspector, loaded-module and official Validator checks in Debug/Release.
- Product/FUID/Parameter IDs, `GARAKCPD` and `GARAKPST` remain unchanged.
- Exact final `main` passes the full clean Windows matrix.

## 리스크

- A post-Gain second pass would invert bypassed dry samples; active-transform execution avoids that bug.
- Silent broadening of v1/1.0 contracts would make historical data ambiguous; explicit v2/v4/1.1 boundaries avoid it.
- Variable-node scheduling would overgrow before a second operation is proven; two exact plans keep the increment complete and small.
- A third product exposes hard-coded two-product assumptions; export, Studio, CTest and smoke coverage are updated together.
- Renaming internal static-graph APIs can leave stale includes; repository search and strict compiler gates must remain clean.

## 발견 사항

- 2026-09-04: Repository cleanup removed all non-main branches and open PRs; the branch policy is now explicit in `AGENTS.md`.
- 2026-09-04: Existing Gain automation owns Bypass semantics; Polarity must be applied only to the active branch.
- 2026-09-04: Local foundation gates are green, but VST3 adapter/export acceptance still requires clean Windows and the pinned SDK.

## 의사결정 로그

- 2026-09-04: Select fixed Polarity before Pan/Dry-Wet because it proves a second operation without persistent parameter/state changes.
- 2026-09-04: Advance project/schema/compiled graph versions rather than reinterpret accepted historical versions.
- 2026-09-04: Keep `GARAKCPD 1.0`, `GARAKPST 1.0`, Gain `1001` and Bypass `1002` unchanged.
- 2026-09-04: Replace pre-release gain-specific internal names directly without compatibility aliases.

## 완료 기록

Implementation candidate and locally available gates are complete. Phase 3D1 is not accepted yet because the exact direct-main source has not passed the authoritative clean Windows matrix. Completion evidence and final main SHA will be recorded only after that gate succeeds.

## 다음 단계

Publish the candidate directly to `main`, run the exact-main Windows matrix, fix any failure directly on `main`, and mark Phase 3D1 Complete only when green. Select the next Phase 3D node after acceptance.
