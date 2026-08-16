# ExecPlan 0012 — Phase 3A Minimal Static DSP Execution Plan

- Status: Complete
- Started: 2026-08-23
- Completed: 2026-08-23
- Owner: Native runtime and Windows Product Runtime

## 목적

현재 Product Runtime의 `Input → Gain → Output` 처리를 first-party immutable execution plan으로 표현하고 실제 audio callback이 그 plan을 통해 Gain DSP를 실행하도록 만든다. 현재 제품이 표현할 수 없는 범용 graph model이나 persistent graph format은 추가하지 않는다.

## 사용자 가치

현재 green 제품 경로를 유지하면서 processor에 하드코딩된 호출을 작은 실행계획 경계로 옮겼다. 다음 node capability는 이 동작하는 경계 위에 추가할 수 있고, 사용되지 않는 graph compiler·serializer·resource가 코드베이스에 먼저 쌓이지 않는다.

## 시작 상태와 감사 결과

- Branch: `main`
- 시작 green foundation: `2e7ea533ecb0020c564bd03ee36f4087d088c89f`
- 시작 authoritative run: `32580789593`
- Current product path: `.garak → product.garakbin → Product Runtime v1 → Warm/Bright VST3`
- `GARAKCPD` v1, `GARAKPST` v1, Product/FUID/Parameter ID는 persistent contract다.
- 최초 Phase 3A increment는 TypeScript에서 node·edge·operation을 중복 직렬화했지만 export나 Native Runtime이 이를 사용하지 않았다.
- 해당 increment의 exact `main`은 Product Compiler format gate가 실패했고, Native job 성공은 기존 Gain 경로만 검증했다.

## 결정

Phase 3A는 persisted `graph.garakbin`을 정의하지 않는다. Editable `.garak` schema에 graph source가 생기기 전에는 직렬화할 사용자 의미가 없기 때문이다.

대신 다음 native-only contract를 구현했다.

- operation type: Audio Input, Gain, Audio Output
- fixed operation order: `Input → Gain → Output`
- buffer slots: host input `0`, host output `1`
- Gain ID `1001`, Bypass ID `1002`
- latency `0`
- immutable value type
- callback에서 allocation, lock, I/O, logging와 mutation 없음

Persistent graph data와 Product Compiler graph compilation은 editable graph project contract를 도입하는 후속 milestone에서 함께 설계한다.

## 범위

- `native/runtime/static_graph` execution-plan value type과 fixed executor
- existing production Gain DSP 재사용
- Product Runtime processor가 execution plan을 통해 처리
- canonical plan과 invalid-plan rejection tests
- mono/stereo, Float32/Float64, automation/state의 기존 loaded-module regression 유지
- current Windows foundation 전체 gate

## 비범위

- `graph.garakbin`
- TypeScript graph compiler 또는 serializer
- `.garak` graph source
- runtime graph mutation
- additional DSP node
- Studio graph editor
- macro/control mapping
- `GARAKCPD`/`GARAKPST` version 변경
- macOS/AU, installer와 DAW matrix

## 구현 단계

1. [x] 초기 unused TypeScript graph experiment와 CI formatter artifact 경로 제거
2. [x] minimal native static execution plan과 unit test 추가
3. [x] Product Runtime processor를 plan executor에 연결
4. [x] 삭제된 Phase 1A/1B FUID reservation을 current compiler에서 제거
5. [x] clang-format, Werror, clang-tidy 및 Debug/Release current product gate 통과
6. [x] exact implementation commit의 `garak/windows-foundation` success 확인
7. [x] active status/roadmap을 실제 결과와 동기화

## 검증 결과

Implementation commit:

- `27e21307830edf5a6849a3bc96d6ef7ad044cacd`
- `style: format minimal static graph runtime`

Authoritative Windows run:

- `32617339447`
- `garak/windows-foundation`: success

성공한 gate:

- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/production build
- exact recursive VST3 SDK pin 확인
- first-party C++ clang-format
- Debug/Release Product Runtime clean build
- Warm/Bright Debug/Release actual export와 official Validator
- Debug/Release CTest와 loaded-module processing/state/identity regression
- Studio Debug/Release ProductService workflow
- warnings-as-errors
- clang-tidy
- tracked source mutation 0

## 수용 기준 결과

- unused TypeScript graph implementation: current tree에서 제거
- Product Runtime processor: immutable plan executor를 통해 Gain DSP 실행
- 기존 Warm/Bright output, automation, bypass와 state: regression 통과
- `GARAKCPD` v1, `GARAKPST` v1, Product/FUID/Parameter ID: 변경 없음
- exact implementation commit authoritative Windows status: success

## 리스크와 한계

- 현재 plan은 단일 Gain chain에 한정된다. Generic registry, heap buffer planner와 serialization은 아직 없다.
- 별도 realtime allocation/blocking 계측은 아직 없다. 기존 Phase 1B도 source audit만 수행했고 별도 계측은 하지 않았다.
- Editable graph source와 compiled persistent graph는 아직 없다.
- 실제 DAW와 장시간 audio workload는 아직 release gate를 통과하지 않았다.

## 의사결정 로그

- 2026-08-23: 사용되지 않는 220-byte TypeScript graph codec을 제거했다.
- 2026-08-23: editable graph가 없으므로 persistent graph resource 설계를 연기했다.
- 2026-08-23: 현재 product path에서 실제 실행되는 native plan만 먼저 도입했다.
- 2026-08-23: 삭제된 pre-release Phase 1A/1B FUID reservation은 영구 product contract가 아니므로 제거했다.

## 완료 기록

Phase 3A는 Windows x64 범위에서 Complete다. 이 판정은 implementation commit `27e2130`과 authoritative run `32617339447`에 한정된다.

## 다음 단계

`Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress`

새 node나 editable graph schema를 추가하기 전에 current Gain Runtime의 process 경로에서 allocation 0, bounded work, state/process concurrency와 장시간 반복 처리를 계측으로 증명한다.
