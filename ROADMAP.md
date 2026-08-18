# Garak Roadmap

- 기준일: 2026-08-23
- Branch: `main`
- Current Windows foundation: **PASS**
- Phase 3B implementation commit: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- Authoritative run: `32634527751`
- 다음 milestone: **Phase 3C — Editable Static Graph Project Contract and Compiled Plan**

이 roadmap은 기능 목록을 미리 쌓는 문서가 아니다. 각 milestone은 직전의 실제 end-to-end 제품 경로가 clean checkout에서 통과한 뒤에만 시작한다.

## 운영 원칙

- 가장 작은 working product path를 유지하면서 한 capability 층씩 추가한다.
- 새 기능보다 깨진 current path 복구가 우선이다.
- 실행하지 않은 platform, host와 distribution gate를 완료로 표시하지 않는다.
- obsolete internal path를 compatibility shim이나 fallback으로 보존하지 않는다.
- persistent Product/FUID/Parameter ID와 지원 schema/state는 명시적 migration으로 보존한다.
- 사용하지 않는 serializer, resource와 abstraction을 미래 기능이라는 이유로 먼저 추가하지 않는다.
- 큰 변경 전 별도 ExecPlan을 작성한다.

## 완료된 foundation

### Phase 0 — Repository와 build foundation

- 제품/architecture/운영 계약
- C++20 CMake/Ninja core와 tests
- Electron/React/strict TypeScript Studio shell
- Windows native와 Studio development loop

### Phase 1 — Windows product creation foundation

#### Phase 1A — VST3 Gain 기술 spike

공식 Steinberg SDK, editorless VST3 processor/controller, Gain/Bypass automation, state와 validator 경계를 검증한 역사적 spike다. 실행 구현은 current source tree에서 제거됐고 ExecPlan·ADR·status report만 증거로 남는다.

#### Phase 1B — Runtime strategy A/B 기술 spike

Windows x64에서 same-binary data-driven Runtime과 product-specific thin wrapper를 비교했다. 실험 구현, CMake option/preset, Data/Thin bundle과 packager는 current source tree에서 제거됐다. Cross-platform runtime strategy ADR 0003은 Proposed이고, Windows v0.x current path는 ADR 0005의 prebuilt Product Runtime 방식이다.

#### Phase 1C — Windows Product Creation Vertical Slice

- strict unpacked `.garak` project
- immutable Product ID와 deterministic VST3 FUID
- permanent Gain/Bypass Parameter IDs
- deterministic `GARAKCPD` v1와 product-bound `GARAKPST` v1
- headless Product Compiler
- prebuilt Product Runtime 기반 compiler-free local VST3 export
- Studio create/open/validate/save/reopen/export workflow
- Warm/Bright identity, inspector, validator와 loaded-module tests

### Phase 2 — Project evolution과 persistence

#### Phase 2A — Editable schema migration

- current schema v2
- strict legacy v1 detection/validation
- pure deterministic v1→v2 migration
- Product/FUID/Parameter ID와 compiled/export parity 보존
- future/too-old schema fail closed

#### Phase 2B — Durable persistence와 user decisions

- deterministic project revisions와 physical path identity
- exclusive writer lock
- transaction manifest와 verified persistent backup
- crash recovery
- main-owned legacy migration, external-change conflict와 ambiguous recovery UX
- renderer filesystem/raw IPC authority 0

#### Phase 2C — Compiled/state compatibility

- current exact compiled artifact reuse
- missing/stale/corrupt same-product artifact rebuild
- foreign Product/FUID collision reject
- deployed Runtime의 unsupported/corrupt compiled data fail closed
- exact same-product plug-in state restore와 prior-state preservation on failure
- removed Parameter ID tombstone policy

### Current baseline cleanup — Complete

[ExecPlan 0011](plans/0011-remove-obsolete-runtime-spikes.md)에 따라 current product 경로를 과거 기술 spike에서 분리했다.

- Product Runtime preset/target에서 Phase 1A/1B dependency 제거
- reusable Gain DSP를 `native/dsp/gain` production module로 승격
- obsolete Gain/Data/Thin adapter, tests와 packaging tools 제거
- Warm/Bright actual export/validator/loaded-module gate만 current build graph에 유지
- active README/AGENTS/architecture/status를 current commands로 동기화

## Phase 3 — Static DSP Runtime Foundation

### Phase 3A — Minimal Native Static Execution Plan — Complete

[ExecPlan 0012](plans/0012-phase-3a-minimal-static-dsp-graph.md)에 따라 current Gain path를 immutable native execution plan 경계로 옮겼다.

실제 산출물:

- fixed operation sequence `Input → Gain → Output`
- immutable operation/parameter/buffer binding
- latency `0`
- production Gain DSP 재사용
- Product Runtime processor의 actual plan dispatch
- invalid-plan unit regression
- 삭제된 Phase 1A/1B FUID reservation 제거

의도적으로 만들지 않은 것:

- `graph.garakbin`
- TypeScript graph compiler/serializer
- editable `.garak` graph source
- generic node registry와 dynamic buffer planner

수용 근거:

- implementation commit `27e21307830edf5a6849a3bc96d6ef7ad044cacd`
- authoritative run `32617339447`
- Product Compiler, Studio, Debug/Release actual export, official Validator, loaded-module CTest, Werror와 clang-tidy 모두 success

### Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress — Complete

[ExecPlan 0013](plans/0013-phase-3b-realtime-safety-stress.md)에 따라 current static Gain process window에 first-party allocation/deallocation 계측과 deterministic long-run stress를 추가했다.

실제 산출물:

- same-thread standard aligned/unaligned C++ `new`/`delete` 계측
- tracking 시작 전 fixed-size stack storage 준비
- Float32/Float64 각각 20,000 blocks와 1,919,504 channel-samples
- block size `0..128`, mono/stereo와 in-place/out-of-place 반복
- Gain/Bypass offset-0 automation, silence flag, output와 current-state 검증
- allocation `0`, deallocation `0`, mismatch `0`
- fixed seed와 120-second CTest timeout
- current Warm/Bright Debug/Release export/validator 전체 regression

수용 근거:

- implementation commit `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- authoritative run `32634527751`
- Product Compiler, Studio, Debug/Release actual export, official Validator, CTest, real Studio workflow, Werror와 clang-tidy 모두 success

완료 근거로 일반화하지 않는 항목:

- raw C heap, Windows allocator, Steinberg SDK와 host thread 내부 allocation
- kernel-level blocking/wait와 실제 DAW deadline
- cross-thread state handoff concurrency
- NaN/Inf/subnormal automation 입력
- representative DAW performance 또는 audio-quality claim

### Phase 3C — Editable Static Graph Project Contract and Compiled Plan

Phase 3B 이후 별도 ExecPlan으로 시작한다.

- versioned editable graph source
- strict node/version/port/connection validation
- deterministic compiled execution plan
- deployed Runtime의 missing/corrupt/future plan fail closed
- `GARAKCPD`/`GARAKPST` compatibility 경계 유지 또는 명시적 version transition
- Studio canvas 없이 headless authoring/export부터 검증

### Phase 3D — Initial DSP Node Set

- Input/Output
- Gain/Pan/Polarity/Dry-Wet
- Biquad/Tilt EQ
- basic saturation
- per-node implementation version과 sound fixture

## Phase 4 — Parameter and Macro System

- realtime smoothing
- host automation through static graph
- versioned range/curve mapping
- one public macro to multiple internal targets
- preset/DAW state migration and Parameter ID tombstones

## Phase 5 — Studio Sound and Control

- visual graph authoring
- project persistence
- audio audition/preview
- macro authoring
- native runtime parity measurement path

## Phase 6 — Interface Scene and Designer

- plugin-focused design canvas
- compiled interface scene
- reusable components/instances
- parameter/macro/meter binding
- Studio preview와 native runtime parity

## Phase 7 — Commercial Cross-platform Export and Release Gate

- Windows packaged Studio/installer
- clean-system VST3 installation and representative DAW matrix
- macOS Universal VST3
- AU after VST3 validation
- signing, notarization and installer
- preset/assets and release notices
- cross-platform runtime strategy ADR decision

Windows 결과는 이 release gate의 macOS/AU 완료 증거가 아니다.

## Phase 8 — ANDONGMIN — BLOOM Vertical Product

- versioned `.garak` reference project
- Bloom/Warmth/Softness/Mix/Output controls
- compression, saturation, softening와 density graph
- reference audio and measurable acceptance criteria
- full authoring-to-package demonstration

## 계속 비범위인 항목

- AAX와 mobile
- cloud collaboration와 marketplace
- AI automatic product generation
- external VST repackaging
- DRM/license server
- Figma 완전 호환
- repository license의 법률 검토 없는 확정
