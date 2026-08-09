# Interface Designer Architecture

- 상태: Phase 0A architecture 기준선
- 권위: plugin-focused scene, binding, Studio preview와 generated native UI 경계
- 관련 문서: [v0.1 PRD](../product/v0.1-prd.md), [Parameter and State](parameter-and-state.md), [Realtime and Quality](realtime-and-quality.md), [Dependency Policy](dependency-policy.md)

## 목적과 원칙

Interface Designer는 아티스트가 생성 플러그인의 시각 정체성과 control experience를 설계하는 Studio 영역이다. 장기적으로 높은 수준의 product design 경험을 지향하지만 v0.1은 plugin UI에 필요한 scene, layout, style, reusable control과 binding에 집중한다.

Scene/binding/compiled runtime contract는 Garak first-party 자산이다. DOM, React, Figma, Skia, Yoga 등 외부 object model을 project/public API로 사용하지 않는다.

## v0.1 기능

### Scene과 visual style

- frame, group와 ordered layer tree
- shape, text, image와 SVG
- fill, stroke, gradient와 shadow
- 기본 position, size, transform, visibility와 clipping 의미

Shape 종류, mask, blend, SVG/text subset과 effect composition은 미정이며 범용 vector editor를 약속하지 않는다.

### Layout와 reuse

- alignment, snap와 grid
- plugin control 배치를 위한 기본 auto layout
- reusable component와 instance
- 허용된 property/binding override의 최소 model

Constraint solver, responsive web layout 또는 Figma 전체 semantics는 비범위이다. Nested instance, detach와 override resolution은 미정이며 export 때 resolve된 scene을 만들 수 있어야 한다.

### Plugin control와 binding

- knob, slider, toggle, meter와 preset menu
- parameter, macro와 meter binding
- focus, pointer/keyboard interaction과 value 표시를 위한 명시적 contract

Control이 그려지는 것만으로 완료하지 않으며 state, automation과 resize behavior를 검증해야 한다. Accessibility 범위와 기준은 아직 v0.1 contract가 아니라 제품 Open Question이다.

## Authoring scene과 compiled scene

### Authoring scene

Layer, style, layout, component, resource와 binding의 editable source이다. Selection, guide, canvas zoom, history와 inspector state는 Studio session 정보로 분리한다.

### Compiled runtime scene

Export 전 다음을 검증·정규화한다.

- component/instance resolution
- runtime layout/style property
- parameter/macro/meter binding
- image, SVG와 font/resource reference
- unsupported feature, invalid reference와 cycle
- authoring-only metadata 제거와 runtime schema version

Container, binary schema와 render command는 미결정이다. FlatBuffers, Skia 또는 Yoga를 선택한 것으로 간주하지 않는다.

## Identity와 binding 계약

- Scene node/component에는 project 참조를 위한 stable identity가 필요하다.
- Control은 display name이나 layer index가 아닌 stable parameter/macro identity를 참조한다.
- Host-exposed control은 released numeric ID/tombstone 계약을 따른다.
- Binding은 value domain, display conversion과 interaction direction을 검증한다.
- UI gesture, host automation과 state restore는 같은 parameter source로 수렴한다.
- Meter는 read-only signal이며 audio callback의 DSP object를 직접 읽지 않는다.
- Preset parsing/migration은 callback 밖에서 수행한다.

Meter/UI 전달은 bounded·non-blocking이어야 한다. Dropped visual update는 허용할 수 있어도 audio processing 중단은 허용하지 않으며 구체 queue/atomic 구현은 미정이다.

## Studio/web와 generated native runtime 경계

### Studio

Studio는 Electron, React와 TypeScript strict mode를 사용한다. DOM/React component와 editor state는 authoring 구현이며 scene public model이 아니다. CanvasKit은 preview renderer **후보**이고 미설치·미검증·미승인이다.

### 생성 플러그인

UI는 C++20 native runtime에서 동작하며 다음을 포함하거나 요구하지 않는다.

- Electron
- Chromium
- Node.js
- 임의 JavaScript runtime
- Garak Studio 설치 또는 기본 동작을 위한 network

Skia는 native renderer 후보, Yoga는 layout 후보일 뿐 채택되지 않았다. 후보 상태는 [Dependency Policy](dependency-policy.md)를 따른다.

### 공유 의미론

Studio preview와 native runtime은 scene hierarchy, layout/style, component resolution, control interaction, binding과 schema/version 의미를 공유한다. 동일 library, process 또는 source language를 쓴다는 결정은 아니다. Renderer/layout/input adapter는 외부 type을 노출하지 않고 같은 first-party contract를 해석한다.

## Preview/native parity

다음 영역을 reference fixture로 비교한다.

- hierarchy/layer order, position, size, alignment와 auto layout
- fill, stroke, gradient, shadow, text, image/SVG와 clipping
- component instance/override
- pointer/keyboard/value interaction
- parameter automation, state restore와 meter update
- DPI/scale와 supported resize

검증에는 primitive별 fixture, screenshot/geometry comparison, interaction sequence, binding round trip, unsupported property diagnostic와 Windows/macOS scale smoke test가 필요하다. Pixel, geometry와 behavior tolerance는 각각 수치화하며 정하기 전 parity PASS를 주장하지 않는다.

## Realtime과 resource 경계

- Audio callback에서 layout, text shaping, image/SVG decode, drawing 또는 GUI logging을 하지 않는다.
- UI가 mutable DSP graph에 직접 접근하지 않는다.
- Parameter input과 meter output은 명시적 thread handoff를 통과한다.
- Asset/preset parsing과 state migration은 callback 밖에서 수행한다.
- UI가 닫히거나 느려도 audio processing은 계속된다.

Product asset은 absolute authoring path에 의존하지 않고 generated package에서 찾을 수 있어야 한다. Export는 missing/unreadable resource, image/SVG limits, font availability/embedding 권리, third-party notice, platform path/case와 package resource 위치를 검증한다. Container, font/SVG subset과 size budget은 미정이다.

## White-label과 비범위

Product UI/metadata에 Garak badge/logo를 강제하지 않는다. Artist brand와 asset 권리 및 Runtime 재배포는 향후 license/법률 검토가 필요한 정책 가설이다.

v0.1 비범위:

- Figma 완전 호환과 범용 web/site design
- generated plugin의 arbitrary HTML/CSS/JavaScript
- third-party UI extension SDK
- cloud/realtime collaboration, mobile export
- 모든 vector, animation 또는 design feature

## 미결정 사항과 Open Questions

- Scene/compiled schema, shape/SVG/text subset과 basic auto-layout semantics
- Component override/nested instance와 resize 규칙
- Keyboard navigation, screen-reader metadata, contrast와 localization 기준
- DPI matrix와 preview/native visual tolerance
- Font embedding/text shaping, asset container와 resource budget
- Renderer/layout/input adapter와 meter update rate
- BLOOM의 최소 resize/accessibility 기준은 무엇인가?
- User asset license를 export UX와 notice에 어떻게 반영할 것인가?

Phase 0A에서는 canvas/control/renderer/parser를 구현하거나 후보 dependency를 설치하지 않는다.
