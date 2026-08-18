# Garak Current Status

- 기준일: 2026-08-23
- Branch: `main`
- Phase 3B: **PASS / Complete — Windows x64**
- Verified implementation commit: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- Authoritative Windows run: `32634527751`
- Status context: `garak/windows-foundation` — **success**
- 다음 milestone: **Phase 3C — Editable Static Graph Project Contract and Compiled Plan**

## 실제 current product path

```text
unpacked .garak
→ Product Compiler validation/migration
→ deterministic product.garakbin
→ prebuilt Garak Product Runtime v1
→ immutable native Input → Gain → Output execution plan
→ product-specific moduleinfo.json
→ local Windows x64 VST3
→ inspector + official validator + loaded-module tests
```

Studio는 current/legacy project 생성·열기·검증·저장·migration·conflict/recovery와 Debug/Release export를 main-owned typed capability로 수행한다. Renderer에는 Node.js, filesystem, shell, process 또는 raw IPC 권한이 없다.

## 구현된 persistent contract

- editable project schema v2와 strict legacy v1 migration
- immutable Product ID
- deterministic processor/controller FUID
- Gain ID `1001`, Bypass ID `1002`
- deterministic `GARAKCPD` v1
- product-bound `GARAKPST` v1
- durable save transaction, verified backup와 crash recovery
- compiled artifact `use-existing` / `rebuild` / `reject` policy
- future/foreign/corrupt data fail-closed behavior

Phase 3A와 Phase 3B는 위 persistent bytes와 ID를 변경하지 않았다.

## Phase 3A — Minimal Native Static Execution Plan

Phase 3A는 unused cross-language graph codec을 제거하고 실제 Runtime이 사용하는 가장 작은 native execution boundary만 남겼다.

```text
Audio Input
→ Gain (Gain 1001 / Bypass 1002)
→ Audio Output
```

현재 구현은 fixed operation/parameter/buffer binding, latency `0`, production Gain DSP dispatch와 invalid-plan regression을 제공한다. `graph.garakbin`, editable graph source, TypeScript graph serializer, generic node registry와 dynamic heap planner는 도입하지 않았다.

수용 근거:

- implementation commit `27e21307830edf5a6849a3bc96d6ef7ad044cacd`
- authoritative run `32617339447`

## Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress

SDK-independent static-plan/Gain process window를 별도 first-party executable에서 실제 계측한다.

계측 경계:

- same-thread standard aligned/unaligned C++ `new`/`delete`
- tracking 시작 전에 준비한 fixed-size stack input/output/automation storage
- production `execute_gain_plan`과 Gain DSP

Deterministic stress 결과:

- Float32: 20,000 blocks, 1,919,504 channel-samples
- Float64: 20,000 blocks, 1,919,504 channel-samples
- block size `0..128`
- mono/stereo
- in-place/out-of-place
- Gain/Bypass offset-0 automation
- deterministic silence flags
- allocation `0`
- deallocation `0`
- output/state/silence mismatch `0`
- CTest timeout 120 seconds, timeout/crash/hang `0`

최종 MSVC warnings-as-errors blocker였던 template의 unreachable-code 진단은 의미 변화 없이 `if constexpr ... else` 구조로 정리했다. 이 수정이 포함된 commit `4b2535deba302eddab86c5c02b165e8d4f168cf4`에서 전체 Windows gate가 성공했다.

## Authoritative gate 결과

Run `32634527751`에서 다음 job과 모든 하위 step이 성공했다.

### Product Compiler and Studio

- frozen dependency install
- repository LF/whitespace
- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/production build
- tracked source mutation 0

### Native Product Runtime and real export path

- exact recursive SDK pins
- first-party C++ format
- Debug Product Runtime clean build
- Warm/Bright Debug actual export와 official standard/extensive validation
- Debug CTest, static-plan, realtime stress와 loaded-module regression
- actual Studio Debug product workflow
- Release Product Runtime clean build
- Warm/Bright Release actual export와 official standard/extensive validation
- Release CTest, static-plan, realtime stress와 loaded-module regression
- actual Studio Release product workflow
- warnings-as-errors
- clang-tidy
- tracked source mutation 0

완료 판정은 문서상의 과거 test 수가 아니라 정확한 verified implementation commit의 `garak/windows-foundation` status를 따른다.

## Phase 3B 완료가 보장하지 않는 항목

- raw C heap 또는 Windows allocator allocation
- Steinberg SDK와 host thread 내부 allocation
- kernel-level blocking/wait
- OS scheduler latency와 실제 DAW deadline
- cross-thread automation/state handoff concurrency
- NaN/Inf/subnormal automation 입력
- representative DAW performance와 audio-quality claim

이 항목은 source audit, timeout 또는 current loaded-module regression으로 대체됐다고 주장하지 않는다.

## 아직 검증되지 않은 핵심 항목

- versioned editable graph source와 deterministic compiled plan
- deployed Runtime의 graph plan compatibility/fail-closed 경계
- additional DSP node와 macro system
- representative DAW scan/load/save/reopen matrix
- packaged Studio와 clean-system installer
- native interface designer
- preset/asset packaging
- backup retention/pruning와 advanced manual recovery
- macOS Universal VST3, AU, signing과 notarization
- legal/trademark/security review와 repository license decision

## Source of truth

- [Phase 3B ExecPlan](../../plans/0013-phase-3b-realtime-safety-stress.md)
- [Phase 3A ExecPlan](../../plans/0012-phase-3a-minimal-static-dsp-graph.md)
- [Repository constitution](../../AGENTS.md)
- [Roadmap](../../ROADMAP.md)
- [Current VST3 adapter](../architecture/vst3-adapter.md)
- [Runtime and export](../architecture/runtime-and-export.md)
- [Project persistence](../architecture/project-persistence-service.md)
- [Compiled/state compatibility](../architecture/compiled-and-state-compatibility.md)

## 다음 단계

`Phase 3C — Editable Static Graph Project Contract and Compiled Plan`

첫 increment는 Studio canvas나 additional node가 아니다. strict headless graph source validation, deterministic compilation, current compiled/state contract와의 경계, deployed Runtime의 missing/corrupt/future plan fail closed를 end-to-end로 먼저 검증한다.
