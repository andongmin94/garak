# ADR 0004 — Windows, macOS, and Plugin Formats

- Status: Accepted
- Date: 2026-08-09
- 관련 문서: [시스템 개요](../architecture/system-overview.md), [Runtime과 export](../architecture/runtime-and-export.md), [v0.1 제품 요구사항](../product/v0.1-prd.md), [ADR 0001](0001-typescript-studio-and-cpp20-engine.md), [ADR 0003](0003-generated-plugin-runtime-strategy.md)

## Context

Garak Studio와 생성 제품은 Windows와 macOS의 desktop audio 제작 환경을 공동 목표로 한다. Native plugin format, CPU architecture, validator, package layout와 signing을 동시에 구현하면 첫 기술 위험을 분리하기 어렵다. 반대로 Windows 하나만 전제로 architecture를 만들면 macOS architecture, Universal binary와 AU 경계를 나중에 core로 누출시킬 수 있다.

따라서 기술 검증 순서와 첫 상용 제품이 지원해야 하는 최종 target 집합을 구분해 고정한다. 제품 범위의 권위는 [v0.1 제품 요구사항](../product/v0.1-prd.md), format-neutral runtime과 validation 경계는 [Runtime과 export](../architecture/runtime-and-export.md)가 가진다.

## Decision

Garak Studio는 Windows와 macOS를 공동 지원 목표로 한다. Native Engine과 generated runtime의 core contract도 처음부터 두 플랫폼과 format adapter 분리를 고려한다. Compiler와 build stack은 [ADR 0001](0001-typescript-studio-and-cpp20-engine.md)을 따른다.

기술 검증 순서는 다음과 같다.

1. Windows x64 VST3
2. macOS arm64/x86_64 VST3
3. macOS AU

첫 상용 목표는 다음 target을 모두 포함한다.

- Windows VST3
- macOS Universal VST3
- macOS AU

Windows x64 VST3 검증은 첫 기술 milestone이지 전체 commercial target 완료가 아니다. macOS arm64와 x86_64의 개별 기술 검증 및 Universal package 검증을 구분한다. AU는 VST3 경로가 검증된 뒤 추가한다.

DSP, parameter/state, interface scene와 compiled runtime contract는 format-neutral하게 유지하고 host SDK의 class, process, state와 editor type은 format adapter 안에 둔다. VST3 output 목표는 확정됐지만 특정 VST3 SDK가 Phase 0A에서 채택·설치됐다는 뜻은 아니다.

AAX, mobile과 instrument format은 v0.1 범위에 포함하지 않는다.

## Alternatives Considered

### Windows만 먼저 architecture 목표로 삼고 macOS를 나중에 추가

Platform assumption이 core, identity, path와 package contract에 굳어질 위험이 있어 채택하지 않았다. Windows 우선은 검증 순서이지 Windows 전용 설계가 아니다.

### Windows/macOS 및 VST3/AU를 처음부터 병렬 구현

Platform, CPU architecture와 format 문제를 분리해 학습하기 어렵고 최소 수직 spike 범위를 확대하므로 채택하지 않았다.

### AU를 첫 plugin format으로 검증

확정된 VST3 우선 순서와 맞지 않고 Windows/macOS에 걸친 첫 format contract를 검증할 수 없으므로 채택하지 않았다.

### AAX를 첫 상용 목표에 포함

현재 v0.1 제품 범위를 확대하므로 채택하지 않았다.

### JUCE의 multi-format abstraction 사용

No-JUCE 및 first-party adapter 경계 결정과 맞지 않으므로 채택하지 않았다.

## Consequences

긍정적인 결과:

- 가장 작은 Windows VST3 shell로 format adapter와 runtime packaging의 첫 위험을 분리할 수 있다.
- Core contract에 macOS와 AU가 후속 target임을 처음부터 반영할 수 있다.
- Windows 기술 milestone과 commercial-ready target 집합을 혼동하지 않는다.
- Platform/format별 실패와 validator evidence를 독립적으로 기록할 수 있다.

비용과 리스크:

- Windows와 macOS build 환경 및 각 format의 validator가 필요하다.
- macOS 두 architecture, Universal binary, bundle, signing와 notarization이 별도 packaging 복잡성을 만든다.
- VST3와 AU의 identity, state, parameter와 editor 표현 차이를 adapter가 책임져야 한다.
- 한 플랫폼의 통과 결과를 다른 플랫폼이나 format의 통과로 일반화할 수 없다.

## Follow-up and Validation

첫 VST3 기술 단계는 다음 최소 shell을 사용한다.

- Stereo `Input → Gain → Output`
- Automated parameter 하나
- Bypass
- State save/load
- Editor 없이 audio processing

검증 순서별 필요한 증거:

1. Windows x64 VST3 package, official validator, host load/process/automation/state smoke test
2. 같은 first-party core와 contract의 macOS arm64/x86_64 VST3 검증 및 Universal VST3 package 검증
3. VST3 경로 이후 macOS AU adapter, package와 platform validator 검증

Product ID, plugin class/component identity와 parameter ID가 각 target representation에서도 영구 계약을 유지하는지 확인한다. Supported OS/DAW/validator version, package architecture와 알려진 제한을 실제 결과와 함께 기록한다. Signing과 notarization 준비는 후속 export/package 단계에서 별도 검증하며 unsigned technical artifact를 상용 준비 완료로 보고하지 않는다.

Phase 0A에서는 C++/Studio scaffold, SDK, plugin binary, Universal package, AU adapter 또는 validator 실행을 수행하지 않았다. 따라서 이 ADR의 `Accepted` 상태는 target과 검증 순서의 승인만 뜻하며 어떤 platform 또는 format의 구현 완료를 뜻하지 않는다.
