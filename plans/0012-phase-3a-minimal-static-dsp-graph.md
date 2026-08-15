# ExecPlan 0012 — Phase 3A Minimal Static DSP Graph and Compiled Execution Plan

- Status: In Progress
- Started: 2026-08-23
- Updated: 2026-08-23
- Owner: Product Compiler, native graph runtime, Windows Product Runtime

## 목적

현재 `garak.gain` template의 고정 처리 경로를 versioned static DSP graph로 표현하고, Product Compiler가 결정론적 execution plan을 생성하며, exported Warm/Bright VST3가 그 plan을 실제 audio callback에서 실행하도록 만든다.

## 사용자 가치

Garak 제품이 더 이상 C++ processor에 하드코딩된 하나의 Gain chain에 머물지 않고, 검증 가능한 first-party graph contract를 통해 소리를 구성하는 첫 기반을 얻는다. 이번 단계는 기능을 늘리기보다 `Input → Gain → Output` 하나를 end-to-end로 작동시켜 이후 node catalog를 안전하게 확장할 수 있게 한다.

## 시작 상태

- Branch: `main`
- Baseline commit: `2e7ea533ecb0020c564bd03ee36f4087d088c89f`
- Baseline status: `garak/windows-foundation` success
- Authoritative run: `32580789593`
- Canonical product path: `.garak → product.garakbin → prebuilt Product Runtime v1 → Warm/Bright VST3`
- `GARAKCPD` v1과 `GARAKPST` v1은 persistent compatibility contract다.
- Gain DSP는 `native/dsp/gain`, VST3 ABI는 `native/adapters/vst3/product_runtime_v1`에 있다.

## 범위

- Input, Gain, Output node type/version과 typed port contract
- Acyclic static graph validation
- Deterministic topological schedule
- Two-buffer prepare-time execution plan
- Zero-sample latency propagation
- Versioned `graph.garakbin` resource
- Product Compiler graph compilation/decoding/parity tests
- Native graph parser와 bounded executor
- Warm/Bright export bundle, inspector, validator와 loaded-module integration
- Current Windows foundation regression

## 비범위

- Runtime graph mutation
- Studio graph editor 또는 user-authored graph persistence
- 추가 DSP node
- Macro, smoothing 또는 parameter remapping
- Compiled Product Data v2 또는 Product State v2
- Dynamic allocation-based generic graph runtime
- macOS/AU, installer, signing와 DAW matrix

## 설계 결정

### Persistent contract 분리

`GARAKCPD` v1과 `GARAKPST` v1의 bytes를 변경하지 않는다. Static graph execution plan은 별도 resource `Contents/Resources/graph.garakbin`으로 추가한다. 기존 compiled/state compatibility 정책은 유지하며, 현재 Product Compiler는 missing/stale graph resource를 재생성하고 deployed Runtime은 missing/corrupt/unsupported graph를 factory 공개 전에 fail closed한다.

### Graph v1

- Magic: `GARAKGPH`
- Version: `1.0`
- Fixed-width little-endian records
- Node IDs: Input `1`, Gain `2`, Output `3`
- Node implementation versions: `1.0`
- Typed audio edges: `1:0 → 2:0`, `2:0 → 3:0`
- Parameter bindings: Gain `1001`, Bypass `1002`
- Channel policy: host main bus, with validated mono/stereo support
- Buffer plan: input buffer `0`, gain output buffer `1`
- Total latency: `0`
- Exact plan size: `220` bytes
- Canonical SHA-256: `FDA9FE1BC12E0A28FDF1B147B00AB6A3A9F8C326994659DC70C6682EDEDA143C`

### Runtime execution

Graph parsing occurs at module load and never in `process`. The processor receives an immutable parsed plan. The callback uses fixed stack buffer views and dispatches the three precompiled operations without allocation, lock, I/O, logging or graph mutation. Gain automation/state semantics remain unchanged.

## 구현 단계

1. [ ] TypeScript graph model, validation, compiler, serializer, decoder와 deterministic fixtures
2. [ ] Product export에 `graph.garakbin` 추가, exact four-file inventory와 reproducibility evidence 갱신
3. [ ] Native graph parser/executor와 CMake/test target 추가
4. [ ] Product Runtime loader/factory/processor/inspector를 graph resource에 연결
5. [ ] Debug/Release actual export, official validator, CTest, Studio workflow, Werror/tidy 전체 gate
6. [ ] ADR/architecture/status/roadmap 문서를 실제 결과로 동기화
7. [ ] exact final commit의 `garak/windows-foundation` success 후 Complete 판정

## 변경 대상 파일

- `tools/product-compiler/src/static_graph.ts`
- Product Compiler tests/API/export 및 evidence scripts
- `native/graph/static_v1/*`
- Product Runtime loader/factory/processor/inspector/CMake
- Native graph tests와 test CMake
- `docs/adr/0011-static-dsp-graph-plan-v1.md`
- `docs/architecture/static-dsp-graph-v1.md`
- `docs/status/phase-3a-static-graph-validation.md`
- README, ROADMAP, AGENTS, current status와 관련 architecture 문서

## 검증 계획

- Graph compile/decode exact bytes와 hash
- Node/version/port/channel/cycle/cardinality failure fixtures
- Reordered logical input의 deterministic output
- Native parser corruption/future-version failure
- Native executor mono/stereo, float32/float64, in-place/out-of-place와 automation parity
- Missing/corrupt graph resource factory fail-closed
- Warm/Bright Debug/Release actual export와 exact four-file inventory
- Inspector graph parity와 official validator standard/extensive
- Loaded-module DSP/state/identity isolation
- Product Compiler/Studio full quality gates
- Werror, clang-format, clang-tidy와 tracked source mutation 0

## 수용 기준

- Product Compiler가 같은 logical graph에서 byte-identical plan을 생성한다.
- Missing node/version, invalid typed port, cycle와 channel mismatch를 export 전에 거부한다.
- Warm/Bright bundle이 byte-identical `graph.garakbin`을 포함한다.
- Runtime은 graph resource가 없거나 invalid하면 factory를 노출하지 않는다.
- Exported VST3의 output/state behavior가 기존 Gain fixture와 동일하다.
- Callback에서 allocation, lock, I/O와 graph mutation이 없다.
- `GARAKCPD` v1, `GARAKPST` v1, Product/FUID/Parameter IDs가 변경되지 않는다.
- exact final commit의 authoritative Windows gate가 success다.

## 리스크

- 별도 resource 추가로 exact bundle inventory와 export atomicity tests가 모두 갱신돼야 한다.
- Runtime parser와 TypeScript serializer가 drift할 수 있어 exact fixture/hash를 양쪽 test에 고정한다.
- Generic graph abstraction을 너무 일찍 키울 위험이 있으므로 Phase 3A는 세 node와 두 buffer에 제한한다.
- Existing state automation semantics를 executor 이동 중 바꿀 수 있어 loaded-module output/state regression을 유지한다.

## 발견 사항

- Current `product.garakbin`은 identity/metadata/parameter contract이며 graph bytes를 추가할 reserved extension area가 없다. v1을 변경하지 않고 별도 resource를 두는 것이 compatibility 경계에 맞다.
- Current Runtime은 module load 시 product resource를 한 번 읽고 immutable factory context를 만든다. 같은 시점에 graph를 읽어 묶는 것이 realtime 규칙과 기존 architecture에 가장 작게 맞는다.

## 의사결정 로그

- 2026-08-23: `GARAKCPD` v2를 만들지 않고 별도 `graph.garakbin` v1을 채택한다.
- 2026-08-23: project schema에는 아직 graph field를 추가하지 않는다. `garak.gain` template가 canonical reference graph를 결정한다.
- 2026-08-23: node catalog 확장과 Studio authoring은 Phase 3B/5로 미룬다.

## 완료 기록

진행 중. 각 increment는 current Windows foundation을 유지한 뒤 다음 layer를 추가한다.

## 다음 단계

이 plan이 Complete가 된 뒤 `Phase 3B — Initial DSP Node Set and Realtime Instrumentation`을 별도 ExecPlan으로 시작한다.
