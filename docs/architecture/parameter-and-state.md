# Parameter and State Contract

- 상태: Phase 0A architecture 기준선
- 권위: parameter identity, automation, macro mapping, smoothing, preset/DAW state와 migration
- 관련 문서: [v0.1 PRD](../product/v0.1-prd.md), [Realtime and Quality](realtime-and-quality.md), [Interface Designer](interface-designer.md)

## 목적

이 문서는 아티스트의 control language가 host automation, DSP, preset과 DAW session에서 같은 의미를 유지하도록 장기 계약을 정의한다. Serialization format, language type와 host SDK type은 미정이며 first-party model 밖에 둔다.

## 개념

| 개념 | 역할 | 영속성 기본값 |
| --- | --- | --- |
| Internal DSP parameter | node implementation이 처리에 사용하는 값 | node/version 계약에 따름 |
| Public parameter | 최종 사용자와 host에 공개하는 product-level parameter | preset/DAW state 포함 |
| Macro/control | 하나 이상의 internal parameter를 제품 언어로 조작 | host 공개 시 public ID 계약 적용 |
| Meter signal | DSP에서 UI로 보내는 read-only 관찰 값 | 영속 state에서 제외 |
| Editor/session state | selection, zoom 등 Studio 편집 상태 | product/DAW state와 분리 |

모든 internal parameter를 공개할 필요는 없으며 하나의 macro가 여러 target을 가질 수 있다.

## Stable numeric ID와 tombstone

제품 출시 후 host-exposed public parameter의 numeric ID는 영구 계약이다.

- 표시 이름, layer 순서 또는 UI 위치가 바뀌어도 ID를 유지한다.
- 출시된 ID를 다른 의미의 parameter에 다시 할당하지 않는다.
- 삭제된 ID는 재사용하지 않고 registry/schema에 tombstone 또는 동등한 예약 기록으로 남긴다.
- Host adapter는 Garak ID를 format별 표현으로 변환하며 외부 SDK type을 core model에 노출하지 않는다.
- Range, unit, default 또는 mapping 변경이 기존 automation 결과를 바꾸면 cosmetic edit가 아니라 호환성 변경으로 검토한다.

미출시 draft ID는 정리할 수 있지만 release 경계와 beta/test 배포 정책을 먼저 명시한다. Release 직전 ID uniqueness, tombstone와 host metadata를 별도 검토한다.

## Public parameter metadata

정확한 schema는 미정이지만 다음 의미가 필요하다.

- stable numeric ID와 product scope
- display/short name
- continuous 또는 discrete 성격
- normalized domain과 physical/display mapping
- default, unit와 text 표시 규칙
- automation/host flags
- smoothing policy 참조
- preset/state 포함 여부

VST3/AU metadata를 project source of truth로 저장하지 않고 first-party 의미에서 파생한다.

## Macro mapping

각 mapping은 개념적으로 target node/parameter identity, input domain, target min/max, direction, curve, clamp와 node implementation version을 가진다. Curve primitive, 조합과 정밀도는 미정이며 임의 JavaScript expression을 native runtime에 넣지 않는다.

Compile/export 전에 다음을 검증한다.

- target과 node version의 존재
- unit/domain, range/default와 finite value
- 모든 입력에서 정의되는 curve
- 삭제된 parameter/tombstone ID의 새 target 사용 금지

Process callback은 authoring curve를 parse하거나 graph를 탐색하지 않고 compiled bounded representation만 실행한다.

## Automation과 smoothing

- Host event의 block/sample-offset 의미를 보존한다.
- Coefficient, ramp storage와 target mapping은 compile/prepare에서 마련한다.
- Process 중 allocation, lock, parsing 또는 graph mutation을 수행하지 않는다.
- Sample-rate 변화는 callback 밖의 prepare 경계에서 처리한다.
- 들리는 smoothing 변화는 versioned sound contract로 취급한다.
- Continuous, discrete/toggle, bypass와 preset change를 같은 정책으로 강제하지 않는다.

Host event, UI gesture, macro mapping, clamp와 smoothing의 정확한 적용 순서와 sample accuracy 범위는 sound를 바꾸는 미결정 사항이다. Reference case 없이 구현 편의로 정하지 않는다.

## State 계층

| 계층 | 목적 | 경계 |
| --- | --- | --- |
| `.garak` project | graph, parameter/macro, scene, preset, metadata의 editable source | physical format은 `project-model.md`에서 미결정 |
| Compiled runtime data | 검증된 project의 bounded 실행 표현 | editor history/session state 제외, 자체 version 필요 |
| Product preset | 공개 control과 필요한 DSP state의 재사용 snapshot | catalog, factory/user, 교환 format 미결정 |
| DAW/plugin state | host session의 instance 복원 | product identity, schema version, parameter와 필요한 DSP state |
| Transient UI/runtime state | meter, hover, animation 등 일시 정보 | 영속 state와 분리 |

Preset을 다른 product ID나 호환되지 않는 node version에 조용히 적용하지 않는다.

## Versioning과 migration

출시 후 보존 대상은 product/plugin ID, public parameter ID/tombstone, project/preset/DAW state schema와 sound-changing node implementation version이다. Compiled runtime data는 자체 contract version으로 compatibility를 감지하지만 source project에서 재생성 가능한 derived artifact이다. 이전 blob을 migrate, compatible compiler로 rebuild 또는 reject할지는 [Runtime과 export](runtime-and-export.md)의 별도 정책으로 정한다.

Migration은 다음 경계를 따른다.

1. Identity와 source schema version을 읽고 size/구조를 안전 검증한다.
2. 알려진 source→target migration step을 명시적으로 적용한다.
3. Stable ID, node version과 reference integrity를 검증한다.
4. Current runtime representation으로 compile한다.
5. 검증된 snapshot만 audio/runtime 경계에 전달한다.

Parsing, allocation과 migration은 callback 밖에서 수행한다. Unknown version, missing target, corrupt value와 incompatible product는 명시적인 오류 정책을 따르며 field 추측, ID 재해석 또는 silent fallback으로 성공 처리하지 않는다.

Sound를 바꾸는 node implementation은 같은 version을 덮어쓰지 않고 새 version으로 추가한다. Sound-changing migration은 사용자 영향과 reference audio를 기록한다.

## 영속 호환성과 obsolete 내부 경로

### 보존 대상

이미 출시된 product identity, automation, user project, preset과 DAW state는 사용자 작업에 저장된 계약이다. 문서화된 지원 범위에서는 versioned schema와 migration으로 보존한다.

### 제거 대상

출시 persistent data 계약이 아닌 obsolete internal API, class/build path, experimental schema draft와 미사용 implementation에는 shim, dual path 또는 fallback을 남기지 않는다. Old persistent data를 current model로 변환한 뒤 current execution path만 유지한다.

내부 단순화는 사용자 data 폐기를 뜻하지 않고, migration은 폐기된 내부 구현을 영구 실행한다는 뜻도 아니다.

## 검증

- Active/released/tombstone ID uniqueness와 rename/reorder 안정성
- Product identity가 다른 state의 오적용 거부
- Host adapter ID round trip
- Macro endpoint/midpoint/reverse/clamp와 one-to-many mapping
- Slow/rapid/dense automation, discrete/bypass와 sample-rate/block-size 변화
- Project, preset, DAW state round trip과 지원 source version별 migration fixture
- Missing/unknown/corrupt/truncated data와 removed parameter state
- Node version별 reference audio, plugin reload와 DAW reopen

Test하지 않은 source version이나 host state를 “호환”이라고 보고하지 않는다.

## 미결정 사항과 Open Questions

- Numeric ID bit width, allocation authority, reserved range와 host encoding
- Macro/public parameter의 host exposure 규칙
- Normalized precision, text formatting, automation/mapping/smoothing 순서
- Smoothing primitive와 versioning 단위
- Preset 교환 format과 DAW state에 포함할 DSP history 범위
- Corrupt state의 fail-safe 결과, migration 지원 기간과 end-of-support
- BLOOM의 다섯 control은 모두 host parameter인가?
- Range/default/unit 변경 시 새 ID와 product version을 나누는 기준은 무엇인가?

Phase 0A에서는 parameter/serialization/migration code, ID algorithm, curve editor 또는 smoothing DSP를 구현하지 않는다.
