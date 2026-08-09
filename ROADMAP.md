# Garak Roadmap

- 문서 상태: Phase 1A 검증 기준선
- 최종 갱신: 2026-08-09
- 현재 단계: Phase 0B PASS 보존. Phase 1A Windows x64 PASS. Phase 1 전체 미완료.
- 관련 문서: [v0.1 제품 요구사항](docs/product/v0.1-prd.md), [시스템 개요](docs/architecture/system-overview.md), [모듈 경계](docs/architecture/module-boundaries.md), [프로젝트 모델](docs/architecture/project-model.md), [Runtime과 export](docs/architecture/runtime-and-export.md), [Realtime과 quality](docs/architecture/realtime-and-quality.md), [Parameter와 state](docs/architecture/parameter-and-state.md), [Interface Designer](docs/architecture/interface-designer.md), [의존성 정책](docs/architecture/dependency-policy.md), [VST3 Adapter](docs/architecture/vst3-adapter.md), [Phase 0A ExecPlan](plans/0001-phase-0a-repository-foundation.md), [Phase 0B ExecPlan](plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md), [Phase 1A ExecPlan](plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md), [Phase 1A validation](docs/status/phase-1a-vst3-validation.md)

## 진행 원칙

이 roadmap은 기능을 병렬로 쌓아 둔 뒤 마지막에 연결하는 목록이 아니다. 각 phase는 직전 phase에서 실제로 작동하고 검증된 가장 작은 end-to-end product를 보존하면서 한 capability 층을 추가한다.

- 다음 phase는 직전 phase의 수용 기준과 재현 가능한 검증 증거가 충족된 뒤 시작한다.
- 새 capability를 추가하는 동안 직전 phase의 build, test와 vertical path를 계속 작동하게 유지한다.
- 실패한 검증을 placeholder, compatibility fallback 또는 문서상 완료 처리로 우회하지 않는다.
- 각 phase를 시작하기 전에 [PLANS.md](PLANS.md)에 맞는 별도 ExecPlan을 작성한다.
- Future phase 항목은 계획이지 현재 구현 또는 통과 사실이 아니다.
- 기술 검증 순서는 Windows x64 VST3, macOS arm64/x86_64 VST3, macOS AU이다. 첫 상용 목표에는 Windows VST3, macOS Universal VST3와 macOS AU를 모두 포함한다.

## Phase 0A — Repository Foundation and Specification Freeze

[Phase 0A ExecPlan](plans/0001-phase-0a-repository-foundation.md)에 따라 문서 기준선과 저장소 운영 계약을 작성하고 검증했다. 이 기준선은 Phase 0B 구현 뒤에도 보존된다.

### 진입 조건

- 작업 디렉터리, 기존 파일과 Git 상태를 조사하고 사용자 변경사항 보존 원칙을 적용한다.
- 제품 정의, 확정 기술 방향, v0.1 범위와 금지 작업을 현재 사용자 지시로 확보한다.

### 핵심 산출물

- 제품 비전, 사용자·사용 사례와 v0.1 PRD
- 시스템·모듈·project·runtime·realtime·parameter/state·interface·dependency architecture 문서
- Accepted ADR 0001, 0002, 0004와 Proposed ADR 0003
- `AGENTS.md`, `PLANS.md`, 본 roadmap, Phase 0A ExecPlan, README와 current status
- 저장소 기본 text/editor/Git 정책 파일

### 수용 기준

- 제품 범위, architecture 계약, 확정 결정과 미결정 spike가 문서 사이에서 일관된다.
- Runtime 대안 A/B가 모두 미결정으로 남고 [ADR 0003](docs/adr/0003-generated-plugin-runtime-strategy.md)이 Proposed 권위를 가진다.
- 요구 파일, 상대 링크, whitespace와 금지 구현 파일 부재를 검사하고 실제 결과를 기록한다.
- C++, Studio, DSP, plugin 또는 UI 구현과 외부 dependency 설치가 없다.

### 명시적 비범위

- C++/CMake와 Electron/React/TypeScript scaffold
- VST3 SDK 또는 다른 외부 library 다운로드·통합
- DSP, `.garak` parser, Interface Designer, export, CI와 Phase 0B 이후 구현
- 저장소 license, 상용 약관 또는 법적 재배포 권한 확정

## Phase 0B — Buildable Native and Studio Scaffolds

[Phase 0B ExecPlan](plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md)에 따라 2026-08-09 **PASS**로 완료했다. Windows x64에서 MSVC/Ninja Debug·Release build, CTest, smoke, warnings-as-errors와 clang 도구를 검증했고, Electron/React/strict TypeScript Studio의 frozen install, lint, format, typecheck, production build와 production/dev GUI launch를 확인했다. macOS, Apple Clang과 macOS Electron launch는 미검증이다. Phase 1A 작업 뒤에도 이 기준선의 회귀 검증은 통과했다.

### 진입 조건

- Phase 0A가 검증과 status 갱신을 포함해 PASS이다.
- [ADR 0001](docs/adr/0001-typescript-studio-and-cpp20-engine.md)과 [ADR 0002](docs/adr/0002-no-juce-and-adapter-boundaries.md)의 stack·경계가 기준선이다.

### 핵심 산출물

- 최소 C++20 core library
- CMake/Ninja configure와 build preset
- Native smoke executable과 tests
- Electron/React/TypeScript strict mode Studio shell
- Sound, Control, Interface, Product workspace placeholder

### 수용 기준

- Windows/MSVC와 macOS/Apple Clang 목표를 해치지 않는 IDE-independent native build 정의가 있다.
- Native smoke executable과 test가 문서화된 명령으로 build/run되고 실제 결과가 기록된다.
- Studio shell이 strict TypeScript check와 최소 실행 검증을 통과한다.
- 네 workspace placeholder 사이를 이동할 수 있지만 구현되지 않은 기능을 작동한다고 표시하지 않는다.

### 명시적 비범위

- Plugin format adapter, VST3 package와 official validator
- 실제 DSP node, audio processing, project parser와 runtime data
- Graph/control/interface 편집 기능과 product export
- Phase 0B에 필요하지 않은 framework, compatibility layer와 CI 확장

## Phase 1 — Minimal Native VST3 Shell

### Phase 1A 완료 증거

[Phase 1A ExecPlan](plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)에 따라 Windows x64의 고정 `Garak Gain Spike` adapter를 **PASS**로 완료했다. Exact-pinned official Steinberg SDK, editorless processor/controller, mono/stereo, float32/float64, Gain/Bypass automation, schema 1 state와 repository-local official validator 경로를 검증했다. Debug/Release의 CTest와 validator standard/extensive 결과는 [validation 상태](docs/status/phase-1a-vst3-validation.md)에 기록한다.

이 결과는 Phase 1 전체 완료가 아니다. macOS VST3, representative DAW host, generated runtime 대안 A/B 비교가 남아 있고 [ADR 0003](docs/adr/0003-generated-plugin-runtime-strategy.md)은 Proposed다. `Garak Gain Spike`는 fixed module 하나이며 Alternative A/B 어느 쪽도 구현·선호·기본값으로 두지 않는다.

### 진입 조건

- Phase 0B의 native library, tests와 Studio shell이 계속 buildable하다.
- Realtime 및 adapter contract가 검토되고 VST3 spike용 ExecPlan과 dependency/license 검토가 승인된다.

### 핵심 산출물

- Stereo `Input → Gain → Output` native processing path
- 자동화 가능한 parameter 하나
- Bypass와 state save/load
- Editor 없이도 처리 가능한 VST3 shell
- Windows x64와 macOS arm64/x86_64 VST3 package 및 official validator 경로
- Generated runtime 대안 A/B의 동일 조건 spike evidence

### 수용 기준

- 두 플랫폼 VST3가 load, stereo processing, parameter automation, bypass와 state round trip을 재현한다.
- Editor를 만들지 않아도 processing과 state가 작동한다.
- 지원 target의 official validator와 대표 host smoke test 결과를 tool/version과 함께 기록한다.
- A/B 결과를 [ADR 0003](docs/adr/0003-generated-plugin-runtime-strategy.md)에 반영하기 전 어느 전략도 채택한 것으로 구현하지 않는다.

### 명시적 비범위

- `.garak` authoring model과 compiled product blob
- General DSP graph, macro system와 native plugin editor
- AU, signing/notarization, installer와 commercial packaging
- BLOOM DSP 또는 Studio graph authoring

## Phase 2 — Garak Project Model and Compiled Runtime Data

### 진입 조건

- Phase 1 VST3 shell과 state round trip이 계속 통과한다.
- A/B spike에 근거해 runtime 전략 ADR의 상태와 후속 contract가 명시된다.

### 핵심 산출물

- Editable, versioned `.garak` project
- Stable product ID, plugin class ID와 parameter numeric ID
- Versioned compiled runtime blob
- Product metadata
- Project schema validation과 migration, compiled runtime version 및 mismatch validation

### 수용 기준

- 최소 Gain product project를 저장·재개방하고 identity와 metadata를 동일하게 복원한다.
- Project를 compiled blob으로 변환하고 Phase 1 runtime이 이를 로드해 같은 Gain product를 실행한다.
- 지원되는 이전 project schema fixture를 current model로 migration하고 corrupt/newer data는 설명 가능한 오류로 거부한다. Compiled runtime blob은 contract version mismatch를 감지하며 이전 blob의 migrate/rebuild/reject 정책은 별도로 결정한다.
- Released persistent migration과 obsolete 내부 compatibility path 제거가 별개의 정책으로 유지된다.

### 명시적 비범위

- 범용 static DSP graph execution과 node library
- Macro curve, one-to-many mapping과 Interface Designer
- Physical schema 후보의 검증 없는 장기 확정
- 모든 역사적 또는 pre-release schema의 무기한 지원

## Phase 3 — Static DSP Graph Runtime

### 진입 조건

- Phase 2 project, compiled blob, stable identity와 migration fixture가 검증된다.
- Phase 1 plugin shell이 compiled product data를 통해 계속 처리할 수 있다.

### 핵심 산출물

- Typed audio/control port
- Graph validation
- Deterministic execution ordering
- Audio buffer planning
- Latency propagation
- v0.1 vertical path에 필요한 initial DSP node

### 수용 기준

- Valid static mono/stereo graph를 compile하여 VST3 runtime에서 실행한다.
- Invalid port, missing node version, unsupported cycle와 incompatible channel 연결을 export 전에 거부한다.
- Schedule, buffer와 latency가 prepare/compile에서 확정되고 audio callback 중 graph 구조를 변경하지 않는다.
- Initial node의 processing, latency와 realtime contract를 automated test로 검증한다.

### 명시적 비범위

- Runtime graph mutation과 dynamic patching
- Synthesizer, sampler, polyphonic instrument, convolution과 외부 VST hosting
- Third-party Node SDK와 public extension ABI
- 완전한 DSP node catalog 또는 BLOOM sound 확정

## Phase 4 — Parameter and Macro System

### 진입 조건

- Phase 3 static graph, initial node와 realtime test가 통과한다.
- [Parameter와 state](docs/architecture/parameter-and-state.md)의 identity와 state 계층을 구현 계획으로 좁힌다.

### 핵심 산출물

- Realtime-safe parameter smoothing
- Host automation
- Versioned macro curve와 range mapping
- 하나의 public control을 여러 internal parameter에 mapping
- Preset과 DAW/plugin state compatibility 및 migration fixture

### 수용 기준

- Automation과 smoothing이 allocation/blocking 없이 static graph를 제어한다.
- 하나의 macro가 둘 이상의 target을 저장된 range/curve대로 움직이고 preset/state round trip에서 재현된다.
- 출시된 numeric ID를 변경·재사용하지 않고 삭제 ID를 tombstone으로 유지한다.
- 지원 schema의 preset/DAW state를 current model로 migration하고 obsolete runtime path 없이 current code만 실행한다.

### 명시적 비범위

- Studio visual graph와 macro authoring UI
- 임의 scripting/expression language와 무제한 mapping system
- Interface Designer와 native visual control
- Cloud preset, marketplace와 DRM

## Phase 5 — Garak Studio Sound and Control

### 진입 조건

- Phase 4 native graph, parameter, macro, preset과 state path가 end to end로 검증된다.
- Studio가 first-party project/runtime contract를 사용할 경계와 audition dependency spike가 승인된다.

### 핵심 산출물

- Visual graph editing
- 실제 audio material을 사용하는 audition과 preview
- Public parameter와 macro authoring
- `.garak` project persistence
- Sound와 Control workspace의 functional vertical path

### 수용 기준

- Studio에서 graph를 편집·검증하고 저장·재개방한 뒤 같은 project를 native preview path에서 처리한다.
- 실제 vocal/instrument material로 bypass/A-B 가능한 audition 경로가 있다.
- Macro mapping 변경이 compiled runtime에 반영되고 Phase 4 automation/state test를 계속 통과한다.
- Preview와 exported runtime 비교에 필요한 측정 경로를 마련하고 아직 정하지 않은 parity를 통과했다고 주장하지 않는다.

### 명시적 비범위

- Interface Designer의 functional canvas와 native plugin UI
- Product-specific package와 commercial export workflow
- Cloud collaboration, real-time co-editing와 marketplace
- AI graph/plugin generation

## Phase 6 — Garak Interface Scene and Designer

### 진입 조건

- Phase 5에서 sound graph와 macro가 Studio에서 authoring·audition·persistence된다.
- [Interface Designer](docs/architecture/interface-designer.md)의 scene, binding와 parity 기준을 구현 ExecPlan으로 좁힌다.

### 핵심 산출물

- Plugin-focused design canvas와 compiled interface scene
- Reusable control/component와 instance
- Parameter와 macro binding
- Meter binding
- Studio preview와 generated native runtime rendering parity 경로

### 수용 기준

- v0.1 scene 요소로 interface를 만들고 `.garak`에 저장·복원한 뒤 native runtime scene으로 compile한다.
- Knob, slider와 toggle이 stable parameter/macro binding을 사용하고 meter가 realtime 경계를 침범하지 않는다.
- Reusable component/instance 변경과 binding validation이 결정적으로 동작한다.
- Layout, interaction와 visual parity를 정의된 fixture와 tolerance로 검증하며 backend type이 public scene에 노출되지 않는다.

### 명시적 비범위

- Figma 완전 호환과 범용 웹디자인 도구
- Generated plugin 안의 Electron, Chromium, Node.js 또는 arbitrary JavaScript runtime
- Arbitrary plugin UI scripting와 third-party component SDK
- Product installer, signing와 final export automation

## Phase 7 — Product Export Pipeline

### 진입 조건

- Phase 6까지 sound, control, state와 interface가 하나의 compiled product definition으로 동작한다.
- Generated runtime 전략 ADR이 spike evidence에 따라 Accepted 또는 명시적으로 Superseded되어 있다.

### 핵심 산출물

- Product-specific runtime data, metadata와 package
- Preset과 asset packaging
- Windows/macOS VST3 export와 validation
- VST3 경로 검증 뒤 macOS AU adapter, package와 validation
- Windows/macOS packaging pipeline
- Code signing과 notarization 준비 절차

### 수용 기준

- 서로 다른 identity의 제품 package가 side by side로 설치·scan되고 resource가 충돌하지 않는다.
- Windows x64 VST3, macOS Universal VST3와 이후 macOS AU가 official validator 및 대표 host test를 통과한다.
- Package가 Studio/network 없이 audio, native UI, preset과 state restore를 수행하고 금지 runtime을 포함하지 않는다.
- Signing/notarization 전제, tool/version, 재현 명령과 미완료 항목을 기록하며 준비 상태를 commercial signing 완료로 표현하지 않는다.

### 명시적 비범위

- ANDONGMIN — BLOOM sound/UI를 완성하는 reference product 작업
- Marketplace, cloud distribution, DRM와 license server
- AAX, mobile, synthesizer와 sampler format
- 법률 검토 없는 상용 재배포 허가 또는 저장소 license 확정

## Phase 8 — ANDONGMIN — BLOOM Vertical Prototype

### 진입 조건

- Phase 7의 전체 authoring-to-package path가 synthetic/minimal reference products로 검증된다.
- BLOOM의 sound 목표, public control, reference audio와 품질 수용 기준을 별도 ExecPlan에서 확정한다.

### 핵심 산출물

- `ANDONGMIN — BLOOM` versioned `.garak` reference project
- Gentle Compression, Harmonic Saturation, High-frequency Softening, Low-mid Density, Output Compensation, Dry/Wet와 Output을 검증하는 sound graph
- Bloom, Warmth, Softness, Mix와 Output public control 및 one-to-many macro mapping
- Branded interface, preset, state, asset와 product metadata
- Windows VST3, macOS Universal VST3와 macOS AU vertical prototype package 및 검증 evidence

### 수용 기준

- Studio에서 BLOOM graph, macro, interface, preset과 metadata를 편집·저장·복원하고 실제 audio로 audition한다.
- Host automation, smoothing, bypass, preset과 DAW state restore가 stable identity/version 계약을 지킨다.
- 세 commercial target package가 official validator와 대표 host에서 검증되고 Studio 없는 offline system에서 독립 동작한다.
- Preview와 exported product의 audio/visual parity, CPU/latency와 compatibility fixture가 사전에 정한 기준을 충족한다.

### 명시적 비범위

- Roadmap만으로 BLOOM algorithm, node order, control range/curve 또는 visual design을 미리 확정하는 것
- Technical vertical prototype을 법률·사업·지원 준비가 끝난 commercial release로 표현하는 것
- 다른 artist product, marketplace, AI generation와 범용 plugin language로 확장
- Phase 8 검증을 생략한 채 개별 subsystem demo를 v0.1 완료로 간주하는 것

## Roadmap 변경 통제

Phase 순서, 상용 format 목표 또는 v0.1 범위를 바꾸려면 [v0.1 제품 요구사항](docs/product/v0.1-prd.md), 관련 architecture, ADR, 현재 ExecPlan과 status를 함께 갱신한다. 특히 Windows 우선 검증을 Windows 전용 architecture로 바꾸거나, macOS AU를 근거 없이 상용 목표에서 제거하거나, Proposed runtime 전략을 암묵적으로 채택해서는 안 된다.
