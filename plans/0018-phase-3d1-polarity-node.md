# ExecPlan 0018 — Phase 3D1 Polarity Node

- Status: Complete
- Started: 2026-09-04
- Completed: 2026-09-08
- Owner: Product Compiler, Native static graph Runtime and Studio product workflow
- Exact verified source: `96ba29cf009eab00980405d7de456b5f1d431956`
- Clean acceptance run: `34193494228`

## 목적

Phase 3C의 editable graph → deterministic compiled graph → module-load binding → realtime execution 경로에 첫 추가 DSP node인 fixed Polarity를 end-to-end로 연결한다. 기존 Gain-only 제품을 보존하면서 `Audio Input → Gain → Polarity → Audio Output` 제품이 source, compiler, Native Runtime, Studio, export와 official Validator까지 실제로 동작해야 한다.

## 수용된 결과

- current editable project schema: v4
- current embedded graph source: v2
- supported graph source v2 topologies는 정확히 두 개:
  - `Audio Input → Gain → Audio Output`
  - `Audio Input → Gain → Polarity → Audio Output`
- current compiled graph: `GARAKGRF` 1.1
  - Gain-only: 3 operations, 92 bytes, 2 logical buffers, zero latency
  - Gain→Polarity: 4 operations, 112 bytes, 3 logical buffers, zero latency
- `GARAKGRF` 1.0은 old/rebuild, future/corrupt data는 reject
- Native Runtime은 exact canonical plan만 `StaticExecutionBinding`으로 bind
- Polarity는 parameterless fixed operation이며 새 public parameter/state를 만들지 않음
- Gain `1001`, Bypass `1002`, `GARAKCPD` 1.0, `GARAKPST` 1.0은 unchanged
- whole-product Bypass=true일 때 Polarity를 포함한 전체 graph를 우회하고 exact dry input을 출력
- `Artist Gain Warm`, `Artist Gain Bright`, `Artist Gain Inverted` 3개 reference product가 실제 Windows Debug/Release VST3 export 경로에 포함됨

## 핵심 설계 결정

### Source와 compiled contract를 명시적으로 진화

Historical schema v3는 exact graph-source-v1 Gain-only 의미를 유지한다. v3→v4 migration은 graph representation만 v2로 올리고 Gain-only topology, authoring node IDs, Product ID, FUID, public Parameter IDs, defaults와 product metadata 의미를 보존한다.

`GARAKGRF`는 current parser가 3-op/4-op 두 canonical plan을 구분해야 하므로 1.0을 넓히지 않고 1.1로 진화했다. Old compiled data는 editable source에서 deterministic rebuild하며 Runtime fallback은 없다.

### Generic graph engine을 만들지 않음

현재 compiler와 Runtime은 두 exact linear plan만 허용한다. repeated node type, arbitrary DAG, branching, feedback, sidechain, registry 또는 speculative scheduler는 추가하지 않았다.

### Whole-product Bypass를 한 realtime pass에서 보존

Naive post-Gain Polarity pass는 bypassed dry sample까지 반전시킨다. 대신 Gain DSP의 active branch에 fixed transform을 적용한다. Gain-only는 identity transform, Gain→Polarity는 negation transform을 사용하며 bypass branch는 original input을 그대로 복사한다.

Compiled plan은 Polarity topology에 logical third buffer를 기록하지만 현재 exact Runtime binding은 optional Polarity operation을 active-sample transform으로 fuse한다. Audio callback에서 second scratch pass나 dynamic intermediate allocation은 발생하지 않는다.

### 내부 Gain-only API를 직접 제거

Obsolete `GainExecutionPlan`, `GainExecutionBinding`, `gain_plan.hpp`와 gain-specific parser/executor 이름을 current static execution API로 교체했다. Compatibility alias/shim은 남기지 않았다.

## 구현 단계

1. [x] ExecPlan 작성
2. [x] parameterless Polarity DSP와 direct Float32/Float64, in-place/out-of-place tests 추가
3. [x] project schema v4 / graph source v2와 strict dual-topology validation 구현
4. [x] ordered v3→v4 migration과 fixed legacy fixtures 구현
5. [x] deterministic `GARAKGRF` 1.1 dual-plan codec/fixtures 구현
6. [x] gain-specific static graph API를 `StaticExecutionPlan` / `StaticExecutionBinding`으로 교체
7. [x] whole-product sample-accurate Bypass를 보존하는 allocation-free Polarity execution 통합
8. [x] `Artist Gain Inverted` reference product와 inspector/CTest/Studio workflow 추가
9. [x] TypeScript/C++ compatibility와 realtime stress matrix를 1.0/1.1 및 두 current plan으로 확장
10. [x] current architecture/status/roadmap 문서 갱신
11. [x] Product Compiler, Studio와 Native Linux quality gates 통과
12. [x] exact-main clean Windows Debug/Release export 및 strict quality gate 실행
13. [x] MSVC `/WX`와 Windows clang-tidy 진단을 수정하고 exact current main에서 full rerun green 확인

## 검증 결과

Exact source `96ba29cf009eab00980405d7de456b5f1d431956`, workflow run `34193494228`:

### Linux

- Product Compiler format/lint/typecheck/test: success
- Studio format/lint/typecheck/test/build: success
- clang-format dry-run `/Werror` equivalent: success
- Native Debug build + CTest: success
- Native Release build + CTest: success
- Clang warnings-as-errors build + CTest: success
- Clang clang-tidy build: success

### Windows x64

- Product Compiler format/lint/typecheck/test: success
- Studio format/lint/typecheck/test/build: success
- Product Runtime Debug clean build: success
- Warm/Bright/Inverted Debug actual export, first-party inspector와 official VST3 Validator: success
- Debug CTest와 Studio product workflow: success
- Product Runtime Release clean build: success
- Warm/Bright/Inverted Release actual export, first-party inspector와 official VST3 Validator: success
- Release CTest와 Studio product workflow: success
- MSVC warnings-as-errors `/WX`: success
- Windows clang-tidy: success
- `git diff --exit-code`: success, tracked-source mutation 0

Realtime stress는 Gain-only와 Gain→Polarity, Float32/Float64를 각각 20,000 blocks로 실행하며 계측 C++ allocation/deallocation 0을 요구한다. 이 stress는 CTest matrix에 포함되어 위 Debug/Release/strict gates에서 통과했다.

## 완료 기록

Phase 3D1은 Complete다. Garak의 editable source가 이제 두 개의 실제 sound topology를 결정하고, compiled graph와 Runtime execution이 같은 topology를 fail-closed로 소비한다. Inverted 제품은 active processing에서 Gain 결과의 polarity를 반전하고 host Bypass에서는 dry input을 그대로 통과한다.

임시 acceptance workflow는 completion documentation과 함께 repository에서 제거한다. 다음 작업은 Phase 3D2를 별도 ExecPlan으로 선택하는 것이며, Pan/Dry-Wet/Biquad/Tilt EQ/Saturation 중 어느 것도 이 계획에서 미리 구현하지 않는다.
