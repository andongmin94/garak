# ExecPlan 0019 — Phase 3D2 Saturation Node

- Status: In Progress
- Started: 2026-09-08
- Updated: 2026-09-08
- Owner: Product Compiler, Native static graph Runtime and Studio product workflow

## 목적

Phase 3D1에서 수용한 exact static graph vertical slice 위에 두 번째 추가 DSP node인 parameterless Saturation을 end-to-end로 추가한다.
기존 `Input → Gain → Output`과 `Input → Gain → Polarity → Output` 제품을 그대로 보존하면서, `Input → Gain → Saturation → Output` 제품이 editable source, deterministic compiled graph, Native Runtime, Studio, actual Windows VST3 export와 official Validator까지 실제로 동작해야 한다.

## 사용자 가치

Garak이 단순 선형 부호 반전 외에 실제 비선형 sound operation도 project-owned graph로 표현하고 생성 플러그인에서 실행할 수 있게 된다.
Saturation 제품은 active processing에서 Gain 결과에 고정 soft saturation을 적용하고, host Bypass에서는 Saturation을 포함한 전체 product graph를 우회해 원신호를 그대로 통과시킨다.

## 현재 저장소 상태

- Starting `main`: `dd69817e8ca33e42924613f8dc8177118a75c480`
- Phase 3D1 exact verified source: `96ba29cf009eab00980405d7de456b5f1d431956`
- Phase 3D1 clean Linux + Windows run: `34193494228`
- Current editable project schema: v4
- Current embedded graph source: v2
- Current supported topologies:
  - `Audio Input → Gain → Audio Output`
  - `Audio Input → Gain → Polarity → Audio Output`
- Current compiled graph: `GARAKGRF` 1.1, exact 3-op or 4-op plan
- Current public parameters/state: Gain `1001`, Bypass `1002`; `GARAKCPD` 1.0 and `GARAKPST` 1.0
- Current reference products: `Artist Gain Warm`, `Artist Gain Bright`, `Artist Gain Inverted`
- Development and verification proceed directly on `main`; no feature branch or PR is used.

## 범위

- parameterless `garak.saturation` implementation version 1
- fixed saturation transfer `y = tanh(x)` for Float32 and Float64
- current project schema v5 and graph source v3
- ordered v4→v5 migration preserving all existing graph node IDs, ordering, topology, Product ID, FUID and Gain/Bypass semantics
- graph source v3 support for exactly three topologies:
  - `Input → Gain → Output`
  - `Input → Gain → Polarity → Output`
  - `Input → Gain → Saturation → Output`
- deterministic `GARAKGRF` 1.2 for the same three exact execution plans
- Native static execution binding capable of identity, polarity or saturation post-Gain active transform
- whole-product sample-accurate Bypass for Saturation
- direct Saturation DSP tests and allocation-counted realtime stress
- one `Artist Gain Saturated` reference product
- Debug/Release export, inspector, loaded-module and official Validator coverage for all four reference products where relevant
- Studio create/open/export workflow coverage for the Saturated product
- current architecture/status/roadmap documentation updates

## 비범위

- user-exposed Saturation drive/mix/output parameters
- new Parameter IDs or `GARAKPST` changes
- changing `GARAKCPD` 1.0
- combining Polarity and Saturation in one graph
- arbitrary ordering of post-Gain nodes
- repeated node types, branching, feedback, sidechain or generic DAG scheduling
- generic node registry
- Pan, Dry/Wet, Biquad or Tilt EQ
- macro mapping, graph canvas or native plug-in editor
- macOS/AU, installer, signing or DAW matrix

## 전제와 제약

- `AGENTS.md`, accepted ADRs, Phase 3D1 completion evidence and current source remain authoritative.
- Product ID, deterministic FUID derivation, Gain `1001`, Bypass `1002`, `GARAKCPD` 1.0 and `GARAKPST` 1.0 do not change.
- Saturation presence is graph structure, not public state.
- Sound-changing node behavior is versioned; `garak.saturation` implementation version 1 permanently means `tanh` of the finite post-Gain sample.
- Source v2 and `GARAKGRF` 1.1 meanings are not silently broadened; new accepted semantics advance to graph v3 / project v5 / `GARAKGRF` 1.2.
- Compatibility parsing, migration, file I/O and graph binding remain outside the audio callback.
- Realtime callback remains allocation/free, lock/wait, I/O, logging/string formatting, graph mutation and exception propagation free.
- Obsolete internal bool-only polarity execution representation is replaced directly; no alias or compatibility shim is kept.

## 설계 결정

### Saturation is fixed graph structure

`garak.saturation` implementation version 1 has no property and no host-exposed parameter.
It applies `std::tanh` to each finite active sample after Gain processing.
This adds a nonlinear DSP capability without prematurely introducing Phase 4 parameter/macro contracts.

### Explicit source and compiled version evolution

Project schema advances v4→v5 and embedded graph source advances v2→v3 because the set of accepted graph meanings expands.
Migration only updates the graph source version while preserving an existing Gain-only or Gain→Polarity graph exactly.

`GARAKGRF` advances 1.1→1.2 because operation type 5 (`saturation`) becomes current.
1.0 and 1.1 are derived old artifacts and are rebuilt from validated current editable source; future/corrupt artifacts remain rejected.

### One optional post-Gain node, no generic scheduler

Current graph v3 still allows at most four operations.
The optional post-Gain operation is exactly one of Polarity or Saturation.
The Runtime binding stores a small explicit post-Gain transform kind instead of boolean feature flags or a registry.

### Whole-product bypass stays fused

Saturation is applied only through the non-bypassed active transform inside the existing Gain sample loop.
Bypassed samples continue to copy exact dry input, so no second callback pass or intermediate allocation is introduced.

## 구현 단계

1. [x] Write this ExecPlan on `main` before implementation.
2. [ ] Align stale current constitution/status text with the accepted three-product Phase 3D1 baseline.
3. [ ] Add `native/dsp/saturation` and direct Float32/Float64 tests.
4. [ ] Evolve graph source to v3 and project schema to v5 with strict v4→v5 migration.
5. [ ] Extend exact graph validation for Gain-only, Polarity or Saturation only.
6. [ ] Evolve deterministic compiled graph to `GARAKGRF` 1.2 and add fixed Gain/Polarity/Saturation fixtures.
7. [ ] Replace polarity boolean binding representation with exact post-Gain transform kind and execute Saturation in the fused active branch.
8. [ ] Extend compatibility/resource/static-graph/realtime stress tests for old 1.0/1.1, current 1.2 and all three plans.
9. [ ] Add `Artist Gain Saturated` and extend headless export, inspector, loaded-module and Studio workflow coverage.
10. [ ] Run Product Compiler, Studio, Native Debug/Release, warnings-as-errors and clang-tidy gates; fix all failures.
11. [ ] Run clean exact-main Windows Debug/Release four-product export/Validator/CTest/Studio workflow plus `/WX`, clang-tidy and clean-tree.
12. [ ] Update README, roadmap, current status, compatibility/runtime architecture and this ExecPlan; mark Complete only after green acceptance.
13. [ ] Remove any temporary verification workflow from final `main`.

## 변경 대상 파일

Expected additions:

- `native/dsp/saturation/`
- direct Saturation DSP tests
- `examples/products/artist-gain-saturated.garak/product.json`
- current editable project schema v5 architecture document if the existing documentation pattern requires a new current-version document

Expected modifications:

- Product Compiler graph source, project model/validation/migration/serialization, compiled graph codec and compatibility tests
- Native static graph parser/binding/execution and resource compatibility
- realtime stress and Product Runtime loaded-module tests
- CMake/export registration and Studio product workflow
- `README.md`, `ROADMAP.md`, `docs/status/current.md`, runtime/export and compatibility architecture docs
- `AGENTS.md` only where its current canonical-product statement is stale; durable engineering rules do not change

## 검증 계획

Linux/non-SDK and repository gates:

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
clang-format --dry-run --Werror on first-party native source
cmake --preset debug --fresh
cmake --build --preset debug-build --clean-first
ctest --preset debug-test --no-tests=error
cmake --preset release --fresh
cmake --build --preset release-build --clean-first
ctest --preset release-test --no-tests=error
Clang warnings-as-errors build/test
Clang clang-tidy build
```

Authoritative Windows acceptance is a clean x64 checkout of the exact final `main` commit with:

- Product Compiler and Studio format/lint/typecheck/test/build
- Debug and Release Product Runtime clean builds
- Warm/Bright/Inverted/Saturated headless actual VST3 export
- first-party inspector and official VST3 Validator for all products
- Debug and Release CTest
- Studio Debug/Release product workflow including Saturated
- MSVC warnings-as-errors
- Windows clang-tidy
- `git diff --exit-code`

## 수용 기준

- Current project schema is v5 with graph source v3.
- v1/v2/v3/v4 projects reach v5 through explicit ordered migration; v4→v5 preserves existing topology and sound semantics.
- Graph v3 accepts only exact Gain-only, Gain→Polarity or Gain→Saturation chains.
- Valid authoring IDs/order do not affect compiled bytes for the same topology.
- `GARAKGRF` 1.2 encodes/decodes exact current plans; 1.0 and 1.1 are old/rebuild; future/corrupt data fail closed.
- `garak.saturation` v1 computes `tanh` for active finite post-Gain samples in Float32/Float64.
- Whole-product Bypass returns exact dry input and bypasses Saturation sample-accurately.
- Realtime stress reports zero allocation/deallocation for Gain-only, Polarity and Saturation bindings.
- Warm/Bright/Inverted behavior and state remain unchanged.
- Saturated product exports and passes inspector, loaded-module tests and official Validator in Debug and Release.
- No new public parameter/state or generic graph engine is introduced.
- Exact final `main` passes the complete clean Windows matrix.

## 리스크

- A separate Saturation pass would require another buffer walk and could accidentally process bypassed samples. Fused active transform avoids both.
- Broadening graph v2 or `GARAKGRF` 1.1 would make historical accepted meanings ambiguous. Explicit v3/v5/1.2 boundaries avoid that.
- Reusing the current boolean `has_polarity` shape by adding more booleans would scale poorly and allow impossible combinations. Replace it with one explicit transform kind now that a third plan exists.
- `std::tanh` is a platform math implementation, so tests must assert defined transfer behavior with numeric tolerance rather than bit-identical cross-platform output.
- A fourth reference product can expose hidden three-product assumptions in scripts/tests; update those assumptions in the same increment.

## 발견 사항

- 2026-09-08: `AGENTS.md` still names only Warm/Bright as current reference products although Phase 3D1 accepted Inverted. This stale current statement must be corrected before Phase 3D2 completion and does not change engineering policy.
- 2026-09-08: Current static binding represents the optional post-Gain operation as `has_polarity` boolean. Saturation is the point where an exact enum-like post-Gain transform representation becomes simpler than accumulating feature booleans.

## 의사결정 로그

- 2026-09-08: Select Saturation before Pan/Dry-Wet/Biquad/Tilt EQ. It adds nonlinear sound behavior while remaining stateless, parameterless and single-path, so it is the smallest next end-to-end capability.
- 2026-09-08: Define `garak.saturation` implementation version 1 as fixed `tanh(x)` after Gain.
- 2026-09-08: Advance project schema v5, graph source v3 and `GARAKGRF` 1.2 instead of broadening existing accepted version meanings.
- 2026-09-08: Keep only one optional post-Gain node; Polarity+Saturation combinations remain out of scope.

## 완료 기록

Phase 3D2 is in progress. Only the ExecPlan has been created so far; no product source, compiled contract, Runtime behavior or public state has changed yet.

## 다음 단계

Correct the stale Phase 3D1 canonical-product statement, then add the standalone Saturation DSP module and direct tests before evolving persistent source/compiled contracts.
