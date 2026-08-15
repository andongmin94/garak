# Garak Roadmap

- 기준일: 2026-08-22
- Branch: `main`
- 완료 판정 권위: 정확한 current commit의 `garak/windows-foundation` status
- 현재 작업: obsolete Phase 1A/1B implementation 제거와 current Product Runtime 기준선 재확립

이 roadmap은 기능 목록을 미리 쌓는 문서가 아니다. 각 milestone은 직전의 실제 end-to-end 제품 경로가 clean checkout에서 통과한 뒤에만 시작한다.

## 운영 원칙

- 가장 작은 working product path를 유지하면서 한 capability 층씩 추가한다.
- 새 기능보다 깨진 current path 복구가 우선이다.
- 실행하지 않은 platform, host와 distribution gate를 완료로 표시하지 않는다.
- obsolete internal path를 compatibility shim이나 fallback으로 보존하지 않는다.
- persistent Product/FUID/Parameter ID와 지원 schema/state는 명시적 migration으로 보존한다.
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

## Current baseline cleanup — ExecPlan 0011

Phase 3 전에 current product 경로를 과거 기술 spike에서 분리한다.

- Product Runtime preset/target에서 Phase 1A/1B dependency 제거
- reusable Gain DSP를 `native/dsp/gain` production module로 승격
- obsolete Gain/Data/Thin adapter, tests와 packaging tools 제거
- Warm/Bright actual export/validator/loaded-module gate만 current build graph에 유지
- active README/AGENTS/architecture/status를 current commands로 동기화
- exact current commit의 Windows foundation gate 성공

이 cleanup이 green이 되기 전 Phase 3를 시작하지 않는다.

## Phase 3 — Static DSP Graph Runtime

### Phase 3A — Minimal Static Graph Contract and Execution Plan

진입 조건:

- ExecPlan 0011 완료
- exact current `main`의 Windows foundation status 성공
- Warm/Bright current path가 spike implementation 없이 통과

핵심 산출물:

- versioned Node ID와 Node implementation version
- typed audio/control port
- acyclic static graph validation
- deterministic topological schedule
- prepare-time buffer plan
- latency propagation
- Input → Gain → Output reference graph
- graph execution을 사용하는 exported VST3

수용 기준:

- valid mono/stereo graph를 compile하고 current Runtime에서 실행
- missing node/version, invalid port, cycle와 channel mismatch를 export 전에 거부
- 같은 logical graph가 같은 execution plan bytes를 생성
- callback 중 allocation, lock, I/O와 graph mutation 0
- old fixed Gain semantic fixture와 output/state parity 또는 명시적 version transition
- current Windows foundation gate 전체 통과

비범위:

- runtime graph mutation
- full node catalog
- synthesizer/sampler/convolution
- third-party Node SDK
- Studio graph editor

### Phase 3B — Initial DSP Node Set and Realtime Instrumentation

- Input/Output
- Gain/Pan/Polarity/Dry-Wet
- Biquad/Tilt EQ
- basic saturation
- bounded realtime allocation/blocking instrumentation
- per-node version/sound fixtures

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
