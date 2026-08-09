# Garak Roadmap

- 문서 상태: Phase 1C Windows x64 Product Creation Vertical Slice 검증 기준선
- 최종 갱신: 2026-08-12
- 현재 단계: Phase 0B, Phase 1A, Phase 1B와 Phase 1C.1/1C.2 Windows x64 PASS. 정확한 다음 milestone은 Phase 2.
- 관련 문서: [v0.1 제품 요구사항](docs/product/v0.1-prd.md), [시스템 개요](docs/architecture/system-overview.md), [모듈 경계](docs/architecture/module-boundaries.md), [프로젝트 모델](docs/architecture/project-model.md), [Minimal Garak Product Project](docs/architecture/minimal-garak-product-project.md), [Product Identity](docs/architecture/product-identity-derivation.md), [Compiled Product Data v1](docs/architecture/compiled-product-data-v1.md), [Product State v1](docs/architecture/product-state-v1.md), [Runtime과 export](docs/architecture/runtime-and-export.md), [Realtime과 quality](docs/architecture/realtime-and-quality.md), [Parameter와 state](docs/architecture/parameter-and-state.md), [Interface Designer](docs/architecture/interface-designer.md), [의존성 정책](docs/architecture/dependency-policy.md), [VST3 Adapter](docs/architecture/vst3-adapter.md), [Phase 0A ExecPlan](plans/0001-phase-0a-repository-foundation.md), [Phase 0B ExecPlan](plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md), [Phase 1A ExecPlan](plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md), [Phase 1A validation](docs/status/phase-1a-vst3-validation.md), [Phase 1B ExecPlan](plans/0004-phase-1b-generated-runtime-ab-spike.md), [Phase 1C.1 ExecPlan](plans/0005-phase-1c1-product-contracts-and-headless-windows-export.md), [Phase 1C.2 ExecPlan](plans/0006-phase-1c2-studio-product-workspace-and-export-ux.md), [Phase 1C.2 validation](docs/status/phase-1c2-studio-product-workspace-validation.md)

## 진행 원칙

이 roadmap은 기능을 병렬로 쌓아 둔 뒤 마지막에 연결하는 목록이 아니다. 각 phase는 직전 phase에서 실제로 작동하고 검증된 가장 작은 end-to-end product를 보존하면서 한 capability 층을 추가한다.

- 다음 phase는 직전 phase의 수용 기준과 재현 가능한 검증 증거가 충족된 뒤 시작한다.
- 새 capability를 추가하는 동안 직전 phase의 build, test와 vertical path를 계속 작동하게 유지한다.
- 실패한 검증을 placeholder, compatibility fallback 또는 문서상 완료 처리로 우회하지 않는다.
- 각 phase를 시작하기 전에 [PLANS.md](PLANS.md)에 맞는 별도 ExecPlan을 작성한다.
- Future phase 항목은 계획이지 현재 구현 또는 통과 사실이 아니다.
- 제품 제작 경로는 Windows x64 VST3에서 먼저 end to end로 완성한다. macOS VST3/Universal, AU, representative DAW, signing/notarization과 installer는 첫 상용 배포 전 Cross-platform release gate에서 별도 CI 또는 Mac 장비로 검증한다. 첫 상용 목표에는 Windows VST3, macOS Universal VST3와 macOS AU를 모두 포함한다.

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

[Phase 0B ExecPlan](plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md)에 따라 2026-08-09 **PASS**로 완료했다. Windows x64에서 MSVC/Ninja Debug·Release build, CTest, smoke, warnings-as-errors와 clang 도구를 검증했고, Electron/React/strict TypeScript Studio의 frozen install, lint, format, typecheck, production build와 production/dev GUI launch를 확인했다. macOS, Apple Clang과 macOS Electron launch는 미검증이다. Phase 1A/1B/1C.1 작업 뒤에도 이 기준선의 회귀 검증은 통과했다.

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

## Phase 1 — Windows Native Product Creation Foundation

### Phase 1A 완료 증거

[Phase 1A ExecPlan](plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)에 따라 Windows x64의 고정 `Garak Gain Spike` adapter를 **PASS**로 완료했다. Exact-pinned official Steinberg SDK, editorless processor/controller, mono/stereo, float32/float64, Gain/Bypass automation, schema 1 state와 repository-local official validator 경로를 검증했다. Debug/Release의 CTest와 validator standard/extensive 결과는 [validation 상태](docs/status/phase-1a-vst3-validation.md)에 기록한다.

`Garak Gain Spike`는 fixed module 하나이며 Phase 1A 자체는 Alternative A/B 어느 쪽도 구현·선호·기본값으로 두지 않는다. Windows x64의 bounded A/B 비교는 후속 Phase 1B evidence에서 별도로 다뤘다.

### Phase 1B 완료 증거

[Phase 1B ExecPlan](plans/0004-phase-1b-generated-runtime-ab-spike.md)에 따라 Windows x64의 generated runtime 결합 전략 기술 spike를 **PASS**로 완료했다. Alternative A는 같은 prebuilt inner binary에 module-relative descriptor와 product별 moduleinfo를 결합해 `Garak Data Alpha/Beta`를 compiler/linker 없는 package-only 흐름으로 만들었다. Alternative B는 common implementation을 재사용하되 `Garak Thin Alpha/Beta`의 product별 factory wrapper를 각각 compile/link했다.

Debug/Release 모두 네 experimental product와 Phase 1A Gain baseline의 five-module coexistence CTest 5/5를 통과했다. 각 bundle/configuration의 official validator 결과는 standard 47/47, extensive 537/537, warning/failure 0이다. Alternative A product는 `out/build/runtime-strategy-{debug|release}/runtime-products/`, Data Runtime template·Alternative B thin product·Gain baseline은 해당 build root의 `VST3/{Debug|Release}/`에 생성된다.

이 결과만으로 cross-platform runtime 전략을 결정하지 않는다. [ADR 0003](docs/adr/0003-generated-plugin-runtime-strategy.md)은 계속 Proposed이며 A/B 어느 쪽도 macOS/AU의 채택·선호·기본값이 아니다. 기존의 `Phase 1C — macOS VST3 Runtime Strategy Portability Spike` 다음 제안은 폐기했으며, macOS 검증은 아래 release gate로 이동했다.

### Phase 1C — Windows Product Creation Vertical Slice

Windows에서 `.garak` project부터 독립적인 white-label VST3까지 이어지는 실제 제품 제작 경로를 Studio UX보다 먼저 완성한다. Phase 1B의 bounded evidence를 근거로 [ADR 0005](docs/adr/0005-windows-v0x-prebuilt-product-runtime.md)는 Windows x64 VST3와 Garak v0.x에 한정해 prebuilt Product Runtime plus compiled product data 방식을 Accepted로 정했다. Cross-platform 권위인 ADR 0003은 Proposed로 유지한다.

#### Phase 1C.1 — Product Contracts and Headless Windows VST3 Export

[Phase 1C.1 ExecPlan](plans/0005-phase-1c1-product-contracts-and-headless-windows-export.md)에 따라 2026-08-10 **PASS**로 완료했다.

핵심 산출물:

- `product.json` 하나를 가진 strict minimal directory `.garak` source contract
- Product ID에서 versioned SHA-256으로 derivation하는 stable processor/controller FUID와 고정 Gain/Bypass Parameter ID
- Phase 1B descriptor와 분리된 deterministic `Garak Compiled Product Data v1`과 product-bound `Garak Product State v1`
- Runtime third-party dependency 0인 headless Product Compiler의 validate/inspect/compile/export 명령
- Configuration별 prebuilt `Garak Product Runtime v1`과 product-specific C++ compile/link 0인 atomic local export
- `Artist Gain Warm`과 `Artist Gain Bright` Debug/Release Windows VST3 및 no-native-build evidence

수용 결과:

- Product Runtime Debug/Release CTest 7/7, warnings-as-errors, clang-tidy와 first-party format gate를 통과했다.
- Warm/Bright 각각 official validator standard 47/47와 extensive 537/537를 warning/failure/crash 0으로 통과했다.
- 같은 configuration의 두 product가 byte-identical Runtime을 쓰면서 distinct compiled data, factory identity, moduleinfo, default와 state를 유지한다.
- Gain/Data/Thin/Warm/Bright 일곱 module의 same-process coexistence와 Phase 0/1A/1B/Studio regression을 통과했다.
- Studio direct dependency는 16개를 유지하고 Product Compiler runtime third-party dependency는 0이다.

명시적 비범위:

- Studio Product workspace, filesystem/IPC와 export UX
- Final single-file `.garak`, general DSP graph, macro, preset/asset와 custom editor
- Skia/Yoga/XYFlow, installer/signing, BLOOM reference product와 저장소 license 결정
- macOS VST3/Universal, AU와 실제 DAW 검증

#### Phase 1C.2 — Garak Studio Product Workspace and Export UX

[Phase 1C.2 ExecPlan](plans/0006-phase-1c2-studio-product-workspace-and-export-ux.md)에 따라 2026-08-12 **PASS**로 완료했다.

핵심 산출물:

- Studio와 CLI가 공유하는 side-effect-free Product Compiler facade, canonical project serializer와 atomic directory create/save
- Electron main이 소유하는 dialog, opaque document/output/cleanup capability와 trusted-sender 검증
- new/open/edit/validate/save와 Debug/Release export를 제공하는 Product workspace
- Identity, hash, exact inventory, validator child result와 post-commit cleanup warning/result 표시
- Renderer filesystem/shell/process/raw IPC 권한 0인 fixed typed preload API

수용 결과:

- Product Compiler format/lint/typecheck와 52/52 test, Studio format/lint/typecheck와 10/10 test가 PASS했다.
- Production build는 renderer 21 modules, main 16 modules, preload 3 modules로 완료했고 bounded Electron dev launch도 통과했다.
- Actual ProductService Debug/Release smoke가 각각 temp physical project의 new→validate→save→reopen parity와 immutable Product ID를 확인한 뒤 exact three-file reference export, child 5/5 exit 0와 stable compiled/moduleinfo hash를 검증했다.
- Product Runtime Debug/Release fresh configure와 clean build 177/177, no-native-build artifact 772/641개 불변·forbidden invocation 0, CTest 7/7이 PASS했다.
- Studio external direct dependency 16개와 Product Compiler runtime third-party dependency 0을 유지했다.

명시적 비범위:

- Packaged Studio runtime/tool distribution, installer, signing/notarization과 actual DAW
- macOS VST3/Universal, AU와 Apple Clang/Xcode 검증
- Final single-file `.garak`, version migration, general DSP graph, macro, preset/asset와 custom editor
- Sound/Control/Interface functional workspace와 native audition

#### Cross-platform release gate

macOS VST3/Universal, AU, Apple Clang, representative DAW, Developer ID signing, notarization과 installer는 Phase 1C.2의 선행 조건이 아니다. 첫 상용 배포 전에 별도 CI 또는 Mac 장비에서 검증하고 그 evidence로 ADR 0003의 Accepted/Superseded 여부를 결정한다. 현재 Windows PASS를 이 항목의 완료로 표현하지 않는다.

## Phase 2 — Project Evolution and Persistent Migration

**정확한 다음 milestone이며 아직 착수하지 않았다.** 별도 승인과 ExecPlan 뒤 Phase 1C의 canonical project lifecycle을 versioned evolution과 persistent migration으로 확장한다.

### 진입 조건

- Phase 1C.1의 minimal project, identity, compiled-data/state와 Windows export가 계속 통과한다.
- Phase 1C.2에서 같은 headless contract를 사용하는 Studio project lifecycle이 검증된다.

### 핵심 산출물

- Phase 1C.1 minimal Gain schema를 확장하는 versioned project evolution 규칙
- Released Product/plugin/parameter identity lifecycle과 tombstone 정책
- 지원되는 이전 project/state fixture의 explicit migration
- Compiled-data version mismatch의 migrate/rebuild/reject 정책과 tooling
- Obsolete pre-release/internal path를 제거한 current canonical implementation

### 수용 기준

- Phase 1C.1 Gain fixture를 현재 schema로 읽고 저장·재개방해 identity와 metadata를 동일하게 복원한다.
- 지원되는 이전 project/state fixture를 current model로 migration하고 같은 canonical compiled product를 만든다.
- Corrupt/newer project, state와 unsupported compiled data는 설명 가능한 오류로 거부하며 prior valid data를 보존한다.
- Released persistent migration과 obsolete 내부 compatibility path 제거가 별개의 정책으로 유지된다.

### 명시적 비범위

- 범용 static DSP graph execution과 node library
- Macro curve, one-to-many mapping과 Interface Designer
- Final single-file `.garak` physical container의 검증 없는 장기 확정
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

## Phase 7 — Commercial Cross-platform Export and Release Gate

### 진입 조건

- Phase 1C.1/1C.2의 Windows headless export와 Studio Product workflow 위에서 Phase 6까지 sound, control, state와 interface가 하나의 compiled product definition으로 동작한다.
- Generated runtime 전략 ADR이 spike evidence에 따라 Accepted 또는 명시적으로 Superseded되어 있다.

### 핵심 산출물

- Phase 1C.1 Windows product path를 full sound/control/interface contract로 확장한 release package
- Preset과 asset packaging
- Windows VST3와 macOS Universal VST3 export, official validation과 representative host evidence
- VST3 경로 검증 뒤 macOS AU adapter, package와 validation
- Windows/macOS installer와 clean-system installation evidence
- Code signing, notarization과 재현 가능한 release 절차

### 수용 기준

- 서로 다른 identity의 제품 package가 side by side로 설치·scan되고 resource가 충돌하지 않는다.
- Windows x64 VST3, macOS Universal VST3와 이후 macOS AU가 official validator 및 대표 host test를 통과한다.
- Package가 Studio/network 없이 audio, native UI, preset과 state restore를 수행하고 금지 runtime을 포함하지 않는다.
- Release candidate signing/notarization, installer, tool/version과 재현 명령을 기록하고 실행하지 않은 platform/host 검증을 완료로 표현하지 않는다.

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
