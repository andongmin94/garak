# ExecPlan 0012 — Phase 3A Minimal Static DSP Execution Plan

- Status: In Progress
- Started: 2026-08-23
- Updated: 2026-08-23
- Owner: Native runtime and Windows Product Runtime

## 목적

현재 Product Runtime의 `Input → Gain → Output` 처리를 first-party immutable execution plan으로 표현하고 실제 audio callback이 그 plan을 통해 Gain DSP를 실행하도록 만든다. 현재 제품이 표현할 수 없는 범용 graph model이나 persistent graph format은 추가하지 않는다.

## 사용자 가치

현재 green 제품 경로를 유지하면서 processor에 하드코딩된 호출을 작은 실행계획 경계로 옮긴다. 다음 node capability는 이 동작하는 경계 위에 추가할 수 있고, 사용되지 않는 graph compiler·serializer·resource가 코드베이스에 먼저 쌓이지 않는다.

## 시작 상태와 감사 결과

- Branch: `main`
- 마지막 green foundation: `2e7ea533ecb0020c564bd03ee36f4087d088c89f`
- Authoritative run: `32580789593`
- Current product path: `.garak → product.garakbin → Product Runtime v1 → Warm/Bright VST3`
- `GARAKCPD` v1, `GARAKPST` v1, Product/FUID/Parameter ID는 persistent contract다.
- 최초 Phase 3A increment는 TypeScript에서 node·edge·operation을 중복 직렬화했지만 export나 Native Runtime이 이를 사용하지 않았다.
- 해당 increment의 exact `main`은 Product Compiler format gate가 실패했고, Native job 성공은 기존 Gain 경로만 검증했다.

## 결정

Phase 3A는 persisted `graph.garakbin`을 정의하지 않는다. Editable `.garak` schema에 graph source가 생기기 전에는 직렬화할 사용자 의미가 없기 때문이다.

대신 다음 native-only contract를 구현한다.

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
4. [ ] clang-format, Werror, clang-tidy 및 Debug/Release current product gate 통과
5. [ ] exact final commit의 `garak/windows-foundation` success 확인
6. [ ] active architecture/status/roadmap을 실제 결과와 동기화하고 Complete로 마감

## 검증 계획

- canonical plan compile-time validation
- parameter ID, operation order, buffer binding과 latency mutation rejection
- fixed executor output parity
- Product Runtime Debug/Release clean build
- Warm/Bright actual export와 official Validator standard/extensive
- loaded-module processing/state/identity tests
- Studio Debug/Release ProductService workflow
- first-party clang-format, warnings-as-errors와 clang-tidy
- Product Compiler/Studio format/lint/typecheck/test/build
- tracked source mutation 0

## 수용 기준

- unused TypeScript graph implementation이 current tree에 없다.
- Product Runtime processor는 direct Gain call 대신 supported immutable plan executor를 사용한다.
- 기존 Warm/Bright output, automation, bypass와 state contract가 동일하다.
- `GARAKCPD` v1, `GARAKPST` v1, Product/FUID/Parameter ID bytes가 바뀌지 않는다.
- exact final commit의 authoritative Windows status가 success다.

## 리스크

- execution plan이 단일 Gain chain을 과도하게 감쌀 수 있다. 그래서 이번 API는 세 operation과 fixed topology에 제한하고 generic registry, heap buffer planner와 serialization을 넣지 않는다.
- wrapper 이동 중 audio semantics가 달라질 수 있다. 기존 Gain DSP와 loaded-module regression을 그대로 유지한다.

## 의사결정 로그

- 2026-08-23: 사용되지 않는 220-byte TypeScript graph codec을 제거한다.
- 2026-08-23: editable graph가 없으므로 persistent graph resource 설계를 연기한다.
- 2026-08-23: 현재 product path에서 실제 실행되는 native plan만 먼저 도입한다.

## 완료 기록

진행 중. 최종 Windows gate가 green이 되기 전에는 Phase 3A 완료로 판정하지 않는다.

## 다음 단계

이 계획이 Complete가 된 뒤 editable graph project contract 또는 initial node set 중 제품에 더 작은 end-to-end increment를 별도 ExecPlan으로 선택한다.
