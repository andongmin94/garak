# ExecPlan 0014 — Phase 3C Editable Static Graph Project Contract and Compiled Plan

- Status: In Progress — Phase 3C1 and Phase 3C2 Complete, Phase 3C3 pending
- Started: 2026-08-23
- Updated: 2026-09-02
- Owner: Product Compiler, Native Runtime and Studio product workflow

## 목적

Current `.garak → Product Compiler → Product Runtime` 경로에 versioned graph source와 deterministic compiled execution plan을 실제 end-to-end capability로 추가한다. Graph data는 export bundle에 포함되고 deployed Runtime이 module load 시 검증한 뒤 audio callback의 immutable plan으로 사용한다.

## 사용자 가치

제품의 DSP chain이 더 이상 Runtime 소스에만 고정된 암묵적 정보가 아니라, strict project source에서 결정적으로 compile되고 실제 plug-in이 소비하는 명시적 제품 계약이 된다. 이후 additional DSP node와 Studio graph authoring은 이 검증된 경계 위에 추가할 수 있다.

## 시작 상태

- Branch: `main`
- Phase 3B verified implementation: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- Phase 3B historical Windows run: `32634527751`
- Editable project current format: schema v2
- Compiled product current format: `GARAKCPD` 1.0
- Plug-in state current format: `GARAKPST` 1.0
- Runtime execution path: immutable native `Input → Gain → Output` plan
- Current `.garak` inventory: physical `product.json` one file
- Starting VST3 resources: `product.garakbin` and `moduleinfo.json`

## 핵심 결정

### Graph는 별도 compiled resource다

`product.garakbin`은 Product ID, FUID, metadata, template와 public Parameter contract를 소유한다. DSP execution plan은 다른 변경 주기와 검증 규칙을 가지므로 `graph.garakbin`으로 분리한다.

이 결정은 legacy fallback이나 compatibility layer가 아니다. 두 resource는 current export에 모두 필수이며 deployed Runtime은 둘 중 하나라도 missing, corrupt 또는 unsupported이면 factory 공개 전에 fail closed한다.

### Source와 compiled plan을 중복 표현하지 않는다

Editable graph source는 node instance와 typed connection만 표현한다. Compiler가 다음을 결정적으로 파생한다.

- topological operation order
- parameter binding
- host input/output binding
- intermediate buffer slots
- cumulative latency

Source에 operation table이나 buffer plan을 함께 저장하지 않는다.

### 첫 graph contract는 current product capability와 정확히 일치한다

Graph source v1은 다음 node type만 지원한다.

- Audio Input implementation 1
- Gain implementation 1
- Audio Output implementation 1

Valid first graph는 `Input → Gain → Output` 한 chain이다. Generic node registry, arbitrary branching, feedback, dynamic allocation과 additional DSP node는 추가하지 않는다.

## 구현 층

### 3C1 — Runtime-consumed compiled graph resource — Complete

현재 canonical Gain template에서 deterministic `graph.garakbin` v1을 생성한다. Export가 resource를 bundle에 넣고 Native Runtime이 module load 시 parse/validate한 private immutable execution binding을 실제 processor에 전달한다.

Exact source commit `510f906f45924ad4ef035f6598fc193c25eed245`의 clean Windows verification run `33455352188`에서 전체 Phase 3C1 product path가 통과했다.

### 3C2 — Editable project schema v3 — Complete

Project schema v3에 versioned graph source를 추가한다. v2→v3 migration은 current canonical Gain graph를 명시적으로 생성하며 Product ID, FUID, Parameter ID, defaults와 state contract를 보존한다.

Studio create/open/save/migrate workflow는 canvas 없이 typed graph document를 round-trip한다. Renderer에 filesystem 또는 raw IPC authority를 추가하지 않는다.

### 3C3 — Compatibility와 full product gate

Compiled graph의 current/missing/corrupt/too-old/too-new disposition을 명시하고 Product Compiler, Runtime, inspector와 test fixture가 같은 판정을 내리게 한다. Debug/Release actual export, official Validator, CTest, Studio workflow, Werror와 clang-tidy를 모두 통과한 exact commit에서 완료한다.

## 범위

- `graph.garakbin` v1 binary contract
- Product Compiler encode/decode/canonical parity
- current export bundle의 required graph resource
- Native module-load parser와 immutable plan context
- actual processor dispatch가 module-load prepared immutable binding 사용
- missing/truncated/trailing/reserved/version/node/connection corruption fail closed
- project schema v3 graph source
- strict v2→v3 migration
- Studio typed document/draft persistence
- Warm/Bright fixture migration
- deterministic graph source와 compiled bytes tests
- current Windows foundation 전체 regression

## 비범위

- additional DSP node
- arbitrary DAG, split/merge, feedback 또는 sidechain
- generic plugin registry
- dynamic heap buffer planner
- runtime graph mutation
- Studio graph canvas
- macro/control mapping
- `GARAKCPD` 1.0 변경
- `GARAKPST` 1.0 변경
- Product/FUID/Gain 1001/Bypass 1002 변경
- macOS/AU, installer와 DAW matrix

## 불변식

- Product ID는 migration/save/export에서 immutable이다.
- Processor/controller FUID derivation은 변경하지 않는다.
- Gain ID `1001`과 Bypass ID `1002`는 유지한다.
- `product.garakbin`과 plug-in state bytes는 graph 도입 때문에 임의로 재해석하지 않는다.
- Runtime은 graph file I/O와 parse를 module load에서만 수행한다.
- Audio callback은 immutable value plan만 읽고 allocation, lock, I/O, logging와 mutation을 수행하지 않는다.
- Source order가 달라도 동일 logical graph는 동일 compiled bytes를 만든다.
- Unknown field, duplicate node/connection, missing endpoint, invalid port/version, cycle와 disconnected output은 fail closed한다.

## 구현 단계

1. [x] `graph.garakbin` v1 최소 binary contract와 TypeScript codec 추가
2. [x] current Gain template에서 canonical graph compile 및 exact byte fixtures 추가
3. [x] Windows export에 required graph resource와 inventory/hash parity 추가
4. [x] Native graph parser와 module-load fail-closed 추가
5. [x] Processor가 loaded immutable plan을 실제 실행하도록 연결
6. [x] inspector/CTest에서 missing/corrupt/future graph rejection 검증
7. [x] project schema v3와 strict graph source validator 추가
8. [x] deterministic v2→v3 migration과 canonical serializer 추가
9. [x] Studio document/workflow와 Warm/Bright fixture를 schema v3로 이동하고 graph를 main-owned로 round-trip
10. [x] schema v3 architecture 문서와 acceptance-pending active status 동기화
11. [ ] Phase 3C3 format/lint/typecheck/test, Debug/Release actual export/Validator, Werror, clang-tidy 전체 통과
12. [ ] exact final commit의 clean Windows gate 전체 성공과 검증 기록 보관 후 Phase 3C Complete

체크박스는 implementation이 존재한다는 이유만으로 닫지 않는다. 해당 층의 exact source commit에서 요구된 clean Windows gate를 실제로 통과한 뒤에만 완료 표시한다.

## 수용 기준

- export bundle inventory에 exact `Contents/Resources/graph.garakbin` 포함
- graph resource가 없거나 한 byte라도 invalid이면 `GetPluginFactory` fail closed
- Runtime processor가 source-derived loaded plan을 사용
- canonical Warm/Bright graph compiled bytes 동일
- graph source key/order variation이 canonical output에 영향 없음
- v2→v3 migration 후 Product ID/FUID/Parameter/default parity 유지
- current/legacy project open/save/reopen/export regression success
- Phase 3B allocation/deallocation `0` stress 유지
- exact final commit의 clean Windows gate success와 재현 가능한 명령 기록

## 리스크

- Cross-language binary layout mismatch를 피하려면 TypeScript fixed fixtures와 Native parser fixture를 같은 byte contract로 검증해야 한다.
- Project schema와 compiled graph를 한 commit에서 동시에 크게 바꾸면 failure localization이 어렵다. Runtime-consumed compiled resource를 먼저 green으로 만든 뒤 editable source를 연결한다.
- Node/edge와 operation/buffer plan을 함께 persist하면 이전 unused prototype의 중복 복잡도가 재발한다. Operation과 buffer는 compiler output에만 존재한다.
- Separate resource publication이 partial bundle을 만들면 안 된다. Existing atomic export stage에서 product, graph와 moduleinfo를 모두 검증한 뒤 한 번에 publish한다.

## 진행 기록

- 2026-08-23: commit `8286fa4362e8708c94bbb353b8e3e5204e24b826`에서 exact 92-byte `GARAKGRF` 1.0 contract, TypeScript encode/decode, Native parser와 동일 고정 fixture를 추가했다. Export와 deployed Runtime 연결 전이므로 단계 1–2는 검증 전 완료 표시하지 않았다.
- 2026-08-29: commit `48807fd56e72fdae7192956bf90d6a4ed4b83572`에서 canonical graph export, exact bundle inventory, Native module-load graph parse, Product Runtime context와 loaded-plan processor dispatch를 연결했다. 같은 commit에서 one-time patch workflow와 patch script를 제거했다.
- 2026-08-30: GitHub Actions 검증 workflow를 제거하고, exact source commit의 clean Windows command 결과를 권위 있는 검증 기준으로 전환했다. Phase 3C1 이후 full Windows gate는 아직 실행하지 않았으므로 단계 1–6을 완료 표시하지 않았다.
- 2026-09-01: 일회성 verification wrapper를 통해 두 job이 gate 실행 전 exact source commit `510f906f45924ad4ef035f6598fc193c25eed245`를 직접 checkout하고 SHA를 확인했다. Run `33455352188`에서 Product Compiler와 Studio의 format/lint/typecheck/test/build, Debug/Release Runtime build, Warm/Bright actual export와 official Validator, CTest, Studio workflow, warnings-as-errors, clang-tidy, tracked source mutation `0`이 모두 통과했다. 결과 확인 후 workflow는 제거했으며 단계 1–6과 Phase 3C1을 완료 처리했다.
- 2026-09-02: code audit correction에서 raw plan의 callback-time canonical 재검증을 module-load prepared `GainExecutionBinding`으로 교체하고 binding의 buffer slot과 Parameter ID를 actual dispatch에 연결했다. Final product head `837e01ef96c11800b246a50eff92c4599e630080`는 clean Windows run `33610351357`에서 전체 gate를 통과했고 PR `#103`이 main commit `1666c667e6e635447b387a5e25bcce7ef1ee42e5`로 squash merge됐다.
- 2026-09-02: Phase 3C2가 schema v3 embedded graph source, strict validation, v1→v2→v3/v2→v3 migration, source-derived `GARAKGRF`와 Studio main-owned round-trip을 연결했다. Exact source `b727afb4cd1471dbd61ce775355be60e040c7000`의 clean Windows run `33622226202`에서 Product Compiler/Studio quality gate, Debug/Release actual export와 official Validator, CTest, Studio workflow, Werror, clang-tidy와 tracked-source mutation `0`이 모두 통과했다. Phase 3C2를 Complete로 수용했다.

## 완료 기록

Phase 3C1과 Phase 3C2는 완료됐다. `graph.garakbin`은 실제 export bundle에 포함되고 deployed Runtime이
module load에서 검증한 private immutable execution binding을 processor가 사용한다. Schema v3 project는
versioned graph source를 소유하고 exact source `b727afb4cd1471dbd61ce775355be60e040c7000`의 clean Windows run `33622226202`에서 전체 Phase 3C2
acceptance matrix가 성공했다.

전체 ExecPlan은 계속 진행 중이다. Phase 3C3 compatibility/final gate가 완료되기 전에는 Phase 3C 전체를
Complete로 표시하지 않는다.

## 다음 단계

1. Phase 3C3 compatibility matrix와 final clean Windows gate를 완료한다.
2. Phase 3C가 Complete가 된 뒤 `Phase 3D — Initial DSP Node Set`을 별도 ExecPlan으로 시작한다.
