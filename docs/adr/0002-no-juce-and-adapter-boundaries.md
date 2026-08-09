# ADR 0002 — No JUCE and Adapter Boundaries

- Status: Accepted
- Date: 2026-08-09
- 관련 문서: [모듈 경계](../architecture/module-boundaries.md), [시스템 개요](../architecture/system-overview.md), [Runtime과 export](../architecture/runtime-and-export.md), [ADR 0001](0001-typescript-studio-and-cpp20-engine.md)

## Context

Garak은 plugin format, native rendering, layout, Studio graph interaction, audio-device I/O, FFT와 serialization을 위해 외부 SDK나 library를 사용할 수 있다. 그러나 `.garak` project, DSP node와 graph, compiler와 schedule, parameter와 macro, state migration, interface scene, product compiler와 generated runtime contract는 Garak의 장기 제품 자산이다.

External type이 project model이나 public API에 노출되면 dependency update, license, ownership, threading과 error model이 core 전체로 전파된다. 특히 realtime path에서는 외부 API의 암묵적인 allocation, lock 또는 lifetime 규칙이 Garak contract를 훼손할 수 있다. First-party 책임과 dependency direction의 상세 기준은 [모듈 경계](../architecture/module-boundaries.md)가 정의한다.

## Decision

Garak은 JUCE를 사용하지 않는다.

외부 SDK, library와 platform API는 기능별 adapter 뒤에 격리한다. Garak public API와 persistent model에는 Garak이 소유한 semantic type만 노출한다.

허용되는 public vocabulary의 예:

- `garak::AudioBlock`
- `garak::Parameter`
- `garak::Graph`
- `garak::NodeDescriptor`
- `garak::ui::Canvas`
- `garak::ui::Scene`
- `garak::layout::Engine`

노출하면 안 되는 external type의 예:

- `Steinberg::Vst::ProcessData`
- `SkCanvas`
- `YGNode`

이 이름들은 Phase 0A에서 실제 C++ API를 확정하는 선언이 아니라 public contract의 소유권을 보여 주는 예이다.

각 adapter는 external lifecycle, ownership, threading, error와 data representation을 Garak contract로 변환한다. Core는 adapter implementation이나 external API를 역으로 알지 않는다. Format adapter, rendering adapter, layout adapter와 audio-device adapter는 서로 다른 integration concern으로 유지한다.

Third-party 원본은 가능한 한 수정하지 않는다. Garak naming 또는 coding style에 맞추기 위한 rename이나 전체 재포맷을 하지 않는다. 수정이 불가피하면 upstream version과 이유가 명확한 작고 검토 가능한 patch set으로 격리한다.

이 결정은 공통 기능을 모두 자체 재구현한다는 뜻이 아니다. 검증된 외부 기술은 overall complexity나 reliability를 개선할 때 adapter 뒤에서 사용할 수 있다. 다만 후보의 존재와 dependency 채택은 서로 다른 결정이다.

## Alternatives Considered

### JUCE를 application과 plugin의 공통 framework로 사용

Plugin format, UI와 platform 기능을 한 framework에서 얻을 수 있지만 no-JUCE는 현재 확정된 architecture 방향이다. Garak의 first-party model과 generated runtime 경계를 특정 광범위 framework에 결합하지 않기 위해 채택하지 않았다.

### External type을 Garak public API에 직접 노출

초기 adapter code를 줄일 수 있지만 project/runtime contract가 vendor ABI, ownership과 version에 종속되므로 채택하지 않았다.

### Third-party source를 fork해 Garak style로 광범위하게 수정

Upstream bug fix와 security update를 추적하기 어렵고 실제 기능 변경을 review하기 힘들어지므로 채택하지 않았다.

### 모든 기반 기능을 first-party로 다시 구현

이미 검증된 library가 overall complexity를 줄이는 경우까지 배제하므로 채택하지 않았다. Garak은 제품 semantics를 소유하되 implementation은 adapter 뒤에서 선택할 수 있다.

## Consequences

긍정적인 결과:

- Core model과 runtime contract를 plugin format과 vendor로부터 독립적으로 유지할 수 있다.
- Dependency 교체, license 검토와 security update의 영향 범위를 줄일 수 있다.
- Adapter contract test와 test double을 명확한 seam에 배치할 수 있다.
- Host, renderer와 layout object가 persistent project/state에 들어가는 것을 막을 수 있다.

비용과 리스크:

- 각 integration마다 adapter 구현, ownership 규칙과 error translation이 필요하다.
- Boundary conversion이 copy, allocation 또는 latency를 만들지 않는지 측정해야 한다.
- No-JUCE 결정으로 plugin lifecycle, UI와 platform integration의 일부를 직접 설계해야 한다.
- External capability가 Garak contract로 충분히 표현되지 않으면 adapter가 product semantics를 결정하는 잘못된 경계가 생길 수 있다.

## Follow-up and Validation

후속 dependency 또는 format spike는 다음을 검증해야 한다.

- Public header와 persistent schema에 external type 또는 external include가 유출되지 않음
- Adapter별 ownership, thread, realtime, error와 lifetime contract
- Realtime 경계에서 allocation과 blocking이 없고 필요한 copy는 preplanned·bounded이며 비용이 측정됨
- External error가 Garak diagnostic으로 변환되고 실패가 fallback으로 숨겨지지 않음
- Dependency license와 generated runtime 재배포 가능성
- Third-party patch가 필요한 경우 최소 diff와 upstream 추적 가능성

첫 Windows x64 VST3 spike에서는 선택된 VST3 구현의 external type이 format adapter 안에 머무는지 검사한다. Steinberg VST3 SDK를 평가할 경우에도 같은 규칙을 적용한다. UI, layout, audio I/O, FFT와 serialization 후보도 실제 채택 전에 같은 기준을 적용한다.

Phase 0A에서는 JUCE나 다른 외부 library를 추가·다운로드·통합하지 않았고 adapter 구현도 만들지 않았다. 따라서 이 ADR은 dependency boundary를 승인할 뿐 특정 후보의 적합성이나 성능을 검증한 기록이 아니다.
