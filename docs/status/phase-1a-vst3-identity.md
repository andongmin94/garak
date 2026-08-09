# Phase 1A VST3 Identity

- 기준일: 2026-08-09
- 상태: Phase 1A 기술 spike용 identity 고정
- 관련 계획: [ExecPlan 0003](../../plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)
- Adapter 계약: [Garak VST3 Adapter](../architecture/vst3-adapter.md)
- SDK pin: [Phase 1A VST3 Dependency](phase-1a-vst3-dependency.md)

## 고정 identity

| 항목 | 값 |
| --- | --- |
| Vendor | `Garak` |
| Plugin name | `Garak Gain Spike` |
| Version | `0.1.0` |
| VST3 subcategory | `Fx` |
| Processor FUID | `3D6F3C09296D49EF99334C4688F484EE` |
| Controller FUID | `2CD50BAE587A4F3E812399E550F352D4` |

Processor와 controller는 서로 다른 위 FUID로 factory에 등록되며 processor는 controller
FUID를 명시적으로 연결한다. 이 값은 빌드 시각, 파일 경로 또는 난수로 다시 생성하지 않는다.

## Parameter identity

| Parameter | Numeric ID | 계약 |
| --- | ---: | --- |
| Gain | `1001` | 연속형, automation 가능, `-60 dB..+12 dB`, 기본값 `0 dB` |
| Bypass | `1002` | toggle, automation 가능, VST3 bypass flag, 기본값 off |

Numeric ID는 Phase 1A source, deterministic test와 VST3 contract test에서 같은 값으로
고정한다. 다른 의미에 재사용하거나 실행마다 다시 할당하지 않는다.

## Identity의 의미와 경계

이 identity는 VST3 factory 등록, component/controller 연결, parameter automation과 state
restore를 검증하기 위한 **기술 spike 전용 증거**다. 상용 product identity, 제품 생성용
template 또는 향후 출시 제품의 예약 identity가 아니다. 실제 상용 제품은 별도의 영구
product ID, plugin class ID와 parameter identity를 명시적으로 할당해야 하며 이 spike의
FUID나 parameter ID를 상용 제품으로 승격하거나 재사용하지 않는다.

이 고정 module은 generated runtime 전략을 구현하지 않는다. 따라서 이 identity가
[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)의 Alternative A 또는 B를
선택했다는 뜻은 아니다.

## Source of truth

- FUID와 parameter ID: [`identifiers.hpp`](../../native/adapters/vst3/gain_spike/identifiers.hpp)
- Vendor, name, version과 category: [`version.hpp`](../../native/adapters/vst3/gain_spike/version.hpp)
- Factory 등록: [`factory.cpp`](../../native/adapters/vst3/gain_spike/factory.cpp)
- Parameter metadata: [`controller.cpp`](../../native/adapters/vst3/gain_spike/controller.cpp)

