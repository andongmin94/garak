# ExecPlan 0013 — Phase 3B Realtime Safety Instrumentation and Long-run Runtime Stress

- Status: Complete
- Started: 2026-08-23
- Completed: 2026-08-23
- Updated: 2026-08-23
- Owner: Native DSP/runtime quality

## 목적

새 DSP node와 editable graph schema를 추가하기 전에 current `Input → Gain → Output` process 경로의 realtime 불변식을 실제 계측과 반복 실행으로 검증한다.

## 사용자 가치

Garak이 단위 테스트와 소스 감사만 통과하는 데 그치지 않고, 수많은 variable audio block을 처리하는 동안 allocation/deallocation 없이 안정적으로 동작한다는 회귀 기준을 갖는다. 이후 node를 추가할 때 같은 gate를 통과하지 못하면 기능을 완료로 판정하지 않는다.

## 시작 상태

- Branch: `main`
- Phase 3A implementation commit: `27e21307830edf5a6849a3bc96d6ef7ad044cacd`
- Authoritative run: `32617339447`
- Current path: Product Runtime processor → immutable static plan → production Gain DSP
- Existing loaded-module tests cover identity, state isolation, Float64 processing와 validator parity.
- Existing Gain tests cover representative mono/stereo, automation, zero-sample와 silence cases.
- 별도 process-window allocation/deallocation 계측과 long-run randomized block stress는 없었다.

## 범위

- SDK-independent static-plan/Gain process window의 allocation/deallocation counter
- deterministic long-run mono/stereo Float32/Float64 stress
- zero/variable/max block-size 반복
- in-place/out-of-place 반복
- exact offset-0 Gain/Bypass automation 반복
- silence flag와 output/state invariant 반복
- bounded CTest timeout
- current Product Compiler, Studio, actual VST3 export/validator와 loaded-module regression

## 비범위

- 새 DSP node
- editable graph schema 또는 `graph.garakbin`
- production allocator 교체
- Windows kernel/ETW profiler
- representative DAW performance claim
- audio quality benchmark
- macOS/AU

## 설계

Test executable이 global C++ allocation/deallocation operator를 계수하되, counter는 thread-local process window에서만 활성화한다. 모든 input, output, automation point와 execution-plan storage는 tracking 시작 전에 fixed-size stack storage로 준비한다.

이 계측이 보장하는 범위:

- first-party SDK-independent Gain DSP와 static-plan executor의 C++ heap allocation/deallocation 0
- 동일 thread의 standard aligned/unaligned new/delete 경로

이 계측이 보장하지 않는 범위:

- 외부 host/SDK가 다른 module 또는 raw Windows heap API로 수행하는 allocation
- OS scheduler latency와 실제 DAW deadline
- mutex/blocking의 kernel-level tracing

VST3 adapter는 기존 loaded-module regression, source boundary와 timeout으로 계속 검증한다.

## 구현 단계

1. [x] allocation/deallocation tracking test executable 추가
2. [x] deterministic Float32/Float64 long-run stress 추가
3. [x] CTest timeout과 Product Runtime quality target 연결
4. [x] first-party format/Werror/tidy 통과
5. [x] Debug/Release actual export/validator/loaded-module 전체 gate 통과
6. [x] exact final commit status success 후 문서와 plan Complete

## 수용 기준

- instrumented process window allocation count `0`
- instrumented process window deallocation count `0`
- deterministic stress의 output/state mismatch `0`
- zero/mono/stereo/Float32/Float64/in-place/out-of-place 모두 실행
- CTest timeout, crash와 hang `0`
- current Warm/Bright Debug/Release actual export와 official Validator success
- exact final commit의 `garak/windows-foundation` success

## 리스크

- Global operator replacement가 test setup allocation까지 잘못 세면 false positive가 된다. tracking scope를 fixed storage 준비 이후로 제한한다.
- Test executable 계측은 separate VST3 DLL 내부의 non-standard allocator를 포착하지 못한다. 해당 한계를 문서화하고 loaded-module regression을 유지한다.
- 과도한 iteration은 CI 변동성을 높인다. fixed seed와 bounded block count를 사용하고 absolute throughput 목표는 두지 않는다.

## 완료 기록

Phase 3B는 다음 verified implementation에서 완료됐다.

- implementation commit: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- authoritative Windows run: `32634527751`
- status context: `garak/windows-foundation` — success

계측 결과:

- Float32: 20,000 blocks, 1,919,504 channel-samples, allocation `0`, deallocation `0`
- Float64: 20,000 blocks, 1,919,504 channel-samples, allocation `0`, deallocation `0`
- block size: `0..128` 반복
- channel layout: mono/stereo 반복
- processing: in-place/out-of-place 반복
- controls: Gain/Bypass offset-0 automation 반복
- silence flag, output, current Gain/Bypass state mismatch `0`
- fixed seed와 120-second CTest timeout 사용

동일 run에서 Product Compiler와 Studio quality gates, Debug/Release Product Runtime clean build, Warm/Bright actual export, official standard/extensive Validator, CTest, real Studio product workflow, warnings-as-errors, clang-tidy와 tracked-source immutability가 모두 성공했다.

이번 완료가 보장하지 않는 항목은 raw C heap/Windows allocator, Steinberg SDK 또는 host thread 내부 allocation, kernel-level blocking/wait, cross-thread state handoff, 실제 DAW deadline이다. 이 항목을 Phase 3B 완료 근거로 일반화하지 않는다.

## 다음 단계

`Phase 3C — Editable Static Graph Project Contract and Compiled Plan`을 별도 ExecPlan으로 시작한다. Studio canvas보다 strict headless project validation, deterministic compilation과 deployed Runtime fail-closed 경계를 먼저 검증한다.
