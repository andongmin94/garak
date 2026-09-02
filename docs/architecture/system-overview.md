# Garak System Overview

- 문서 상태: Phase 3C2 editable graph source와 deployed graph execution 경로 반영
- 최종 갱신: 2026-09-02
- 권위 범위: 전체 시스템 문맥, 최상위 구성 요소와 authoring-to-runtime 흐름
- 관련 문서: [제품 비전](../product/vision.md), [v0.1 제품 요구사항](../product/v0.1-prd.md), [모듈 경계](module-boundaries.md), [프로젝트 모델](project-model.md), [Runtime과 export](runtime-and-export.md), [Minimal Garak Product Project](minimal-garak-product-project.md), [Editable Project Schema v3](editable-project-schema-v3.md), [Editable Project Schema v2](editable-project-schema-v2.md), [Project Migration Engine](project-migration-engine.md), [ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md), [ADR 0007](../adr/0007-editable-project-schema-migration-policy.md)

## 문서의 역할

이 문서는 Garak이 제품 의도를 편집 가능한 project에서 독립적인 native audio plugin으로 바꾸는 전체 구조를 설명한다. 세부 schema, realtime 규칙, parameter/state 의미, interface scene과 dependency 승인 정책은 각각의 전문 architecture 문서가 권위를 가진다. 이 문서는 그 결정을 중복 정의하지 않고 시스템 수준의 관계와 불변식을 연결한다.

구성 요소 이름은 우선 논리적 책임을 뜻한다. 다만 Phase 1C.1이 정한 Windows x64 VST3 v0.x의
minimal project, headless Product Compiler, compiled product data와 prebuilt Runtime 경계는 현재의
구체적 canonical path다. 이 제한된 수직 경로를 아직 미결정인 general graph/UI compiler 또는
cross-platform package 구조로 일반화하지 않는다.

## 제품 architecture의 중심 계약

Garak은 아티스트가 sound graph, public parameter와 macro, plugin interface, preset, asset, metadata와 brand identity를 하나의 product project로 구성하게 한다. Garak Engine은 그 의도를 검증하고 실행 가능한 표현으로 compile하며, 생성된 제품은 일반적인 native audio effect로 DAW 안에서 동작한다.

다음은 확정된 시스템 계약이다.

- Garak Studio는 Windows/macOS용 Electron, React, TypeScript strict mode authoring application이다.
- Native Engine과 generated plugin runtime은 C++20을 사용하고 CMake/Ninja로 빌드하며 JUCE를 사용하지 않는다.
- `.garak` project는 편집 가능한 source of truth이고 compiled runtime data는 그 project에서 파생된 실행 표현이다.
- 생성 플러그인은 Studio가 설치되지 않은 컴퓨터에서 오프라인으로 기본 기능을 수행한다.
- 생성 플러그인에는 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 넣지 않는다.
- Garak이 소유하는 model과 public API는 third-party SDK 또는 library 타입을 노출하지 않는다.
- product ID, plugin class ID, 출시된 parameter numeric ID, node implementation version과 versioned persistent data는 장기 계약으로 취급한다.
- 제품 화면에 Garak branding을 강제하지 않는 white-label 방향을 따른다. 판매, 재배포와 소유권의 구체적 법적 효력은 아직 제품·사업 정책 가설이며 별도 계약 전에는 확정 권리가 아니다.

관련 stack 및 no-JUCE 결정은 [ADR 0001](../adr/0001-typescript-studio-and-cpp20-engine.md)과 [ADR 0002](../adr/0002-no-juce-and-adapter-boundaries.md)가 권위를 가진다.

## 시스템 문맥

### 제품 제작자

아티스트, 프로듀서, 사운드 디자이너 또는 작은 제작 팀은 Studio에서 제품의 sound, control language, interface, preset과 identity를 정의한다. v0.1은 local authoring과 명시적인 project file handoff를 전제로 하며 cloud collaboration이나 실시간 공동 편집을 포함하지 않는다.

### 플러그인 최종 사용자와 DAW

최종 사용자는 Garak Studio를 사용하지 않는다. DAW는 생성 플러그인의 format adapter를 통해 audio processing, parameter automation, state save/restore와 native editor를 사용한다. Garak Runtime은 host별 표현을 first-party runtime contract로 변환하여 같은 product definition을 실행한다.

### 플랫폼과 검증 도구

Windows와 macOS toolchain, plugin format packaging, validator, signing과 notarization은 export 경계 바깥의 platform capability이다. 이 capability와 연결하는 adapter 및 pipeline은 Garak이 소유하지만, 구체 SDK와 도구 채택은 별도 검증 대상이다.

## 주요 구성 요소

### Garak Studio

Studio는 다음 authoring 경험을 한 product project 위에 제공한다.

- Sound: static mono/stereo DSP graph authoring, validation과 audition
- Control: internal parameter, public parameter와 macro mapping
- Interface: plugin-focused scene, reusable control과 binding
- Product: preset, asset, metadata, stable identity, validation과 export 진입점

Studio preview는 project의 sound/control/interface 의미를 빠르게 확인하는 authoring 경로이다. Preview와 generated native plugin은 같은 first-party 의미 계약을 따라야 하지만, renderer, audio-device backend 또는 실행 프로세스를 공유한다는 결정은 아니다.

### Garak Project Model

Project Model은 `.garak`에 저장되는 제품 의도를 정의한다. Product identity, graph, parameter와 macro,
interface scene, preset, asset reference와 metadata가 하나의 versioned aggregate를 이룬다. 현재 최소
source는 unpacked `.garak` directory 안의 exact `product.json` 하나다. Current schema v3는 structured
Gain template와 versioned `Audio Input → Gain → Audio Output` graph source를 사용한다. Schema v1/v2는
supported legacy input으로 ordered deterministic memory migration한다. General graph/interface/preset project의
최종 physical container, serialization technology와 asset embedding 방식은 아직 정하지 않았다.

장기 의미의 세부 권위는 [프로젝트 모델](project-model.md), 현재 최소 physical contract는
[Minimal Garak Product Project](minimal-garak-product-project.md)에 있다.

### Garak Compilers

Compiler 책임은 editable model을 검증하고 runtime에서 직접 실행할 수 있는 표현으로 낮추는 것이다. 논리적으로 다음 작업을 포함한다.

- graph와 typed connection 검증
- execution ordering, audio buffer planning과 latency propagation
- node implementation version 해석
- public parameter, macro mapping과 smoothing configuration compile
- interface scene와 binding compile
- preset, asset와 product metadata 검증

Phase 1C.1의 최소 Product Compiler는 Studio와 독립된 headless TypeScript entry point로 strict project
validation, identity derivation, deterministic `GARAKCPD` v1 compile과 Windows VST3 packaging을 수행한다.
Phase 1C.2 Studio의 Electron main은 동일한 callable workflow를 직접 호출한다. Phase 2A/2B는 이 source
boundary에 version-first validation, pure migration, canonical writer와 durable publication을 추가했다.
Phase 3C1/3C2는 deterministic `GARAKGRF` v1 resource, module-load prepared binding과 current schema v3의
strict editable graph source를 end-to-end로 연결한다. 이 경로는 general graph/interface compiler와 native
preview/audio Engine의 언어 또는 process 배치를 확정하지 않는다.

### Generated Plugin Runtime

Generated Plugin Runtime은 compiled product definition을 로드하고 다음 native 기능을 제공한다.

- realtime DSP schedule 실행
- host parameter automation, smoothing, bypass와 latency 처리
- preset과 plugin state 저장·복원
- native interface scene 실행과 meter/control binding
- plugin format 및 platform adapter와의 연결

Runtime은 authoring 기능이나 `.garak` editor를 포함하지 않는다. 필요한 memory, buffer, execution schedule과 converter는 compile/prepare 단계에서 준비하고 audio process callback의 realtime 계약을 지킨다.

### Product Compiler, Export와 Validation

Product Compiler와 export pipeline은 project validation부터 target plugin package와 검증 결과까지의
재현 가능한 경로를 소유한다. Windows x64 VST3 v0.x는 [ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)에
따라 prebuilt Product Runtime과 formal product data를 결합하며 product별 C++ compile/link를 하지
않는다. Cross-platform/macOS/AU의 장기 결합 전략은 계속 Proposed인
[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)의 권위 아래 미결정이다.

### Adapters

Adapters는 Garak contract와 plugin format, renderer, layout, audio device, operating system 또는 serialization implementation 사이를 변환한다. 외부 타입, lifecycle, ownership과 error model은 adapter 내부에 머물러야 한다. Adapter의 architecture 규칙은 [모듈 경계](module-boundaries.md)가 권위를 가진다.

## End-to-end 흐름

```text
Product creator
  → Garak Studio or headless authoring handoff
  → versioned unpacked .garak project
  → version-first validation and supported source migration
  → current canonical project and product/graph compilation
  → versioned GARAKCPD product data + GARAKGRF graph plan + format metadata
  → Windows v0.x: prebuilt Product Runtime packaging
  → VST3 adapter and bundle
  → official validator and first-party inspection
  → release gate: signing, installation and target DAW checks
  → independent native plugin product
  → DAW and plugin end user
```

Authoring audition은 같은 project 의미를 입력으로 사용하지만 export pipeline의 완료를 대신하지 않는다. Studio에서 소리가 나거나 UI가 보이는 것만으로 generated plugin parity, format validation 또는 independent operation이 검증된 것은 아니다.

## Source, derived artifact와 runtime state

세 종류의 versioned data를 혼동하지 않는다.

1. `.garak` project는 사용자가 계속 편집할 수 있는 source of truth이다.
2. Compiled runtime data는 특정 compiler/runtime contract를 위한 재생성 가능한 derived artifact이다.
3. Preset과 DAW/plugin state는 출시된 제품 instance의 값을 보존하는 persistent user data이다.

각각의 schema, compatibility와 failure policy는 동일하지 않다. Project schema는 [프로젝트 모델](project-model.md), preset/DAW state는 [Parameter와 state](parameter-and-state.md), compiled artifact와 package는 [Runtime과 export](runtime-and-export.md)가 정의한다.

## 플랫폼과 format 경로

제품 제작의 현재 milestone 순서는 다음과 같다.

1. Phase 1C.1 — Product Contracts and Headless Windows VST3 Export — 완료
2. Phase 1C.2 — Studio Product Workspace and Export UX — 완료
3. Phase 2A/2B/2C — migration, durable persistence와 compiled/state compatibility — 완료
4. Phase 3A/3B — production static execution과 realtime stress — 완료
5. Phase 3C1 — Runtime-consumed compiled graph resource — 완료
6. Phase 3C2 — Editable project schema v3 — 구현 및 검증 진행
7. Phase 3C3 — Compiled graph compatibility matrix와 final product gate — pending
8. 후속 product capability를 단계적으로 구현한 뒤 첫 상용 배포 전 cross-platform release gate

Release gate에는 macOS arm64/x86_64 및 Universal VST3, macOS AU, signing/notarization, installer와
Windows/macOS 실제 DAW 검증이 포함된다. 첫 상용 v0.1 목표는 계속 Windows VST3, macOS Universal VST3와 macOS
AU이며 macOS/AU를 제거하거나 Windows 결과로 대체하지 않는다. Format 목표의 권위는
[ADR 0004](../adr/0004-windows-macos-and-plugin-formats.md)에 있다.

## Reference product가 검증하는 경로

`ANDONGMIN — BLOOM`은 architecture 기능을 따로 시연하는 demo가 아니라 다음 경계를 모두 통과하는 첫 수직 증거이다.

- versioned product project
- static sound graph와 node implementation version
- one-to-many macro mapping
- host automation과 realtime-safe smoothing
- interface scene과 control/meter binding
- default state, preset과 DAW state restore
- stable product metadata와 identity
- Windows/macOS native package와 format validation
- Studio가 없는 환경에서의 offline operation

Phase 0A에서는 BLOOM의 DSP algorithm, node 목록, control range/curve 또는 UI를 구현하거나 확정하지 않는다. 현재 처리 개념과 public control 기준안은 [v0.1 제품 요구사항](../product/v0.1-prd.md)을 따른다.

## Architecture 불변식

- Authoring model과 runtime representation을 분리한다.
- Runtime audio path는 UI, file/network I/O와 authoring mutation에 의존하지 않는다.
- External implementation은 first-party semantic model을 대체하지 않는다.
- Preview와 export는 같은 project 의미를 해석하며 차이를 검증 가능하게 만든다.
- Released persistent identity와 state는 명시적인 version/migration 계약으로 발전시킨다.
- Obsolete 내부 API, pre-release draft와 구현 경로를 보존하기 위한 compatibility shim은 만들지 않는다.
- 오류는 validation 또는 export 결과로 드러내며, 미지원 data를 임의 fallback으로 성공시킨 것으로 처리하지 않는다.
- v0.1 비범위 기능을 placeholder framework로 선행 구현하지 않는다.

## 명시적 비범위

전체 v0.1 비범위는 [v0.1 제품 요구사항](../product/v0.1-prd.md)이 권위를 가진다. Architecture는 synthesizer, sampler, polyphonic instrument engine, 외부 VST hosting, third-party Node SDK, cloud backend, marketplace, DRM, AAX, mobile, Figma 완전 호환 또는 범용 웹디자인 기능을 위한 확장점을 미리 설계하지 않는다.

## 미결정 사항과 필요한 검증

- General graph/interface compiler와 native preview/audio Engine의 process/language 배치. Phase 1C.2의
  project authoring/export는 Electron main이 callable Product Compiler를 직접 호출하는 경계로 확정됐지만,
  이 결정은 realtime preview 또는 general graph compiler topology를 정하지 않는다.
- Minimal schema v3 이후 general `.garak`/compiled runtime data의 physical container 및 schema technology
- macOS VST3/AU와 장기 cross-platform generated runtime packaging 선택
- Format adapter SDK와 renderer/layout/audio-device 등 외부 구현의 적합성
- Preview와 native runtime의 audio/visual parity 측정 방법과 허용 오차
- 지원 OS/DAW matrix, CPU/latency/memory budget와 accessibility threshold
- Signing, notarization, installer와 최종 고객 지원의 v0.1 경계
- Schema v1/v2 legacy project, preset와 state migration 지원 범위와 기간

이 항목은 후속 spike, 품질 계획 또는 ADR 전에는 확정 구현 선택으로 표현하지 않는다.
