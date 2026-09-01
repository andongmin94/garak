# Garak Current Status

- 기준일: 2026-09-01
- Branch: `main`
- Phase 3B: **PASS / Complete — historical Windows x64 realtime-safety baseline**
- Phase 3B verified implementation: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- Phase 3B historical run: `32634527751`
- Phase 3C1 implementation: `48807fd56e72fdae7192956bf90d6a4ed4b83572`
- Phase 3C1 verified source: `510f906f45924ad4ef035f6598fc193c25eed245`
- Phase 3C1 clean Windows verification run: `33455352188`
- Phase 3C1: **PASS / Complete**
- Phase 3C: **IN PROGRESS — Phase 3C2 and Phase 3C3 pending**
- 다음 increment: **Phase 3C2 — Editable project schema v3**

## 실제 current product path

```text
unpacked .garak
→ Product Compiler validation/migration
→ deterministic product.garakbin + graph.garakbin
→ prebuilt Garak Product Runtime v1
→ module-load parse/validation of both resources
→ immutable loaded Input → Gain → Output execution plan
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
- deterministic `GARAKGRF` v1 compiled graph
- product-bound `GARAKPST` v1
- durable save transaction, verified backup와 crash recovery
- compiled artifact `use-existing` / `rebuild` / `reject` policy
- future/foreign/corrupt data fail-closed behavior

Phase 3A와 Phase 3B는 persistent Product/FUID/Parameter/state bytes를 변경하지 않았다. Phase 3C1은 graph를 별도 required resource로 추가하며 `GARAKCPD`와 `GARAKPST` 형식을 변경하지 않는다.

## Phase 3A — Minimal Native Static Execution Plan

Phase 3A는 unused cross-language graph prototype을 제거하고 실제 Runtime이 사용하는 가장 작은 native execution boundary를 남겼다.

```text
Audio Input
→ Gain (Gain 1001 / Bypass 1002)
→ Audio Output
```

역사적 수용 근거:

- implementation commit `27e21307830edf5a6849a3bc96d6ef7ad044cacd`
- historical run `32617339447`

## Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress

SDK-independent static-plan/Gain process window를 별도 first-party executable에서 실제 계측했다.

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

이 결과는 commit `4b2535deba302eddab86c5c02b165e8d4f168cf4`의 historical clean Windows run `32634527751`에서 확인됐다.

## Phase 3C1 — Runtime-consumed compiled graph resource — PASS / Complete

Commit `48807fd56e72fdae7192956bf90d6a4ed4b83572`에 다음 implementation이 반영됐다.

- canonical Gain graph의 deterministic `graph.garakbin`
- export bundle의 exact four-file inventory와 graph hash parity
- Native module-load graph parser
- product와 graph resource가 하나라도 missing/corrupt/unsupported이면 factory 공개 전 fail closed
- loaded immutable graph plan을 Product Runtime context에 전달
- processor가 source-derived loaded plan을 실제 실행
- one-time patch workflow와 patch script 제거

Exact source commit `510f906f45924ad4ef035f6598fc193c25eed245`를 clean Windows checkout으로 고정한 일회성 검증 run `33455352188`에서 다음 두 job이 모두 success로 종료됐다.

### Product Compiler and Studio

- exact source SHA 확인
- frozen dependency install
- repository LF/whitespace 확인
- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/production build
- tracked source mutation `0`

### Native Product Runtime and real export path

- exact source SHA와 recursive SDK pins 확인
- first-party C++ format
- Debug/Release Product Runtime clean build
- Warm/Bright actual export와 official VST3 Validator
- Debug/Release CTest와 loaded-module regression
- Studio Debug/Release product workflow
- warnings-as-errors
- clang-tidy
- tracked source mutation `0`

검증 wrapper commit은 source commit과 분리됐고 두 job은 gate 실행 전에 `510f906f45924ad4ef035f6598fc193c25eed245`를 직접 checkout하고 SHA를 확인했다. 결과 확인 뒤 일회성 workflow는 삭제했으며 상시 CI 또는 obsolete product path로 보존하지 않는다.

## 현재 검증 방법

새 implementation은 exact source commit을 clean Windows checkout에서 [`AGENTS.md`](../../AGENTS.md)의 권위 있는 명령으로 검증하고 결과를 기록한다. 검증용 wrapper나 runner가 존재하더라도 source SHA 확인, required command 전체 실행, tracked source mutation `0`이 충족되지 않으면 수용 근거로 사용하지 않는다.

## 완료가 보장하지 않는 항목

- raw C heap 또는 Windows allocator allocation
- Steinberg SDK와 host thread 내부 allocation
- kernel-level blocking/wait
- OS scheduler latency와 실제 DAW deadline
- cross-thread automation/state handoff concurrency
- NaN/Inf/subnormal automation 입력
- representative DAW performance와 audio-quality claim

## 아직 검증되지 않은 핵심 항목

- project schema v3 graph source와 deterministic v2→v3 migration
- Studio graph document/draft persistence
- compiled graph compatibility matrix
- additional DSP node와 macro system
- representative DAW scan/load/save/reopen matrix
- packaged Studio와 clean-system installer
- native interface designer
- preset/asset packaging
- backup retention/pruning와 advanced manual recovery
- macOS Universal VST3, AU, signing과 notarization
- legal/trademark/security review와 repository license decision

## Source of truth

- [Phase 3C ExecPlan](../../plans/0014-phase-3c-editable-static-graph-contract.md)
- [Phase 3B ExecPlan](../../plans/0013-phase-3b-realtime-safety-stress.md)
- [Repository constitution](../../AGENTS.md)
- [Roadmap](../../ROADMAP.md)
- [Current VST3 adapter](../architecture/vst3-adapter.md)
- [Runtime and export](../architecture/runtime-and-export.md)
- [Project persistence](../architecture/project-persistence-service.md)
- [Compiled/state compatibility](../architecture/compiled-and-state-compatibility.md)

## 다음 단계

1. Phase 3C2에서 project schema v3의 strict editable graph source를 구현한다.
2. deterministic v2→v3 migration과 Product/FUID/Parameter/default parity를 검증한다.
3. Studio document/draft create/open/save/reopen workflow가 graph source를 손실 없이 round-trip하도록 연결한다.
4. Phase 3C3에서 compiled graph compatibility matrix와 final full product gate를 완료한다.
