# Garak Project Model

- 문서 상태: Phase 2A editable project schema/migration 경계 반영
- 최종 갱신: 2026-08-12
- 권위 범위: `.garak` semantic model, product identity, node version reference, project schema와 migration
- 관련 문서: [v0.1 제품 요구사항](../product/v0.1-prd.md), [시스템 개요](system-overview.md), [모듈 경계](module-boundaries.md), [Minimal Garak Product Project](minimal-garak-product-project.md), [Editable Project Schema v2](editable-project-schema-v2.md), [Project Migration Engine](project-migration-engine.md), [Parameter와 state](parameter-and-state.md), [Interface Designer](interface-designer.md), [Runtime과 export](runtime-and-export.md), [ADR 0007](../adr/0007-editable-project-schema-migration-policy.md)

## 문서의 역할

이 문서는 하나의 Garak product project가 어떤 의미를 보존해야 하는지 정의한다. `.garak`은 Studio 편집 상태와 제품 의도를 다시 열고 발전시킬 수 있는 versioned source of truth이다. Generated plugin이 직접 실행하는 compiled runtime data나 DAW가 저장하는 plugin state와 동일한 형식으로 취급하지 않는다.

여기서 설명하는 section과 속성은 semantic aggregate이다. Current minimal physical form은 exact
`product.json` 하나를 가진 directory `.garak`이고 current editable schema는 JSON v2다. 이는 general
graph/interface/asset project의 final single-file/archive/container나 schema library를 확정하지 않는다.

## Project의 책임

하나의 `.garak` project는 최소한 다음 제품 의도를 함께 보존해야 한다.

| 영역 | 보존해야 하는 의미 |
| --- | --- |
| Schema | Project schema version과 migration 출발점 |
| Identity | 영구 product ID, 영구 plugin class ID와 제품 version/metadata |
| Sound | DSP node instance, 명시적 node implementation version, typed connection과 graph configuration |
| Control | Internal/public parameter, macro, range/default/curve와 mapping |
| Interface | Scene, reusable component/instance, asset reference와 parameter/macro/meter binding |
| Experience | Default state와 factory preset definition |
| Product | Product name, artist identity, format metadata, branding과 export intent |
| Authoring | 제품 의미를 잃지 않고 편집을 재개하는 데 필요한 Studio 전용 정보 |

이 표는 physical top-level field나 serialization layout을 확정하지 않는다. Authoring convenience data와 generated runtime에 필요한 product data는 compile 단계에서 분리할 수 있어야 한다.

## Source of truth와 파생 data

`.garak` project는 사용자가 변경하고 version control 또는 file handoff로 보존하는 원본이다. Product compilation은 여기서 다음 파생물을 만든다.

- validated graph와 execution schedule
- buffer plan과 latency 정보
- compiled parameter/macro mapping 및 smoothing configuration
- runtime interface scene와 binding
- packaged preset, asset와 product metadata
- generated plugin이 소비할 versioned runtime data

파생물은 원본 project를 대체하지 않는다. Compiler/runtime version이 바뀌어도 지원되는 `.garak` project에서 다시 생성할 수 있어야 한다. 반대로 generated plugin package만으로 완전한 authoring project를 복원할 것을 보장하지 않는다.

## Product identity

### Product ID

각 제품은 영구 product ID를 가진다. 출시 후 같은 제품을 update할 때 유지하고, 다른 제품을 만들 때 복제해서 공유하지 않는다. 이 identity는 project, export diagnostic와 제품별 persistent data를 연결하는 Garak 수준의 기준이다.

### Plugin class ID

각 제품은 영구 plugin class identity를 가진다. Windows VST3 v0.x는 Product ID에서
`garak.vst3-product-identity.v1`로 processor/controller FUID를 도출한다. AU identity 표현과
VST3/AU 간 identity sharing 방식은 아직 미결정이다. Exact Windows contract는
[Product Identity Derivation](product-identity-derivation.md)이 소유한다.

### Identity lifecycle

- 출시된 product/plugin identity는 임의로 재생성하거나 재할당하지 않는다.
- Project 복제, “새 제품으로 저장”, format 추가와 제품 rename이 identity에 미치는 동작은 출시 전에 명시한다.
- 충돌을 export 전에 검출할 수 있어야 한다.
- Product version과 schema version은 서로 다른 개념이다. 전자는 제품 release를, 후자는 data 해석 규칙을 나타낸다.

Parameter numeric ID의 발급, tombstone과 재사용 금지는 [Parameter와 state](parameter-and-state.md)가 권위를 가진다.

## Graph와 node reference

Project graph는 node instance, typed port와 connection을 first-party 의미로 저장한다. 각 node instance는 적어도 node type identity와 explicit implementation version을 참조해야 한다.

- Node type은 처리 capability의 계보를 식별한다.
- Implementation version은 실제 sound behavior를 식별한다.
- 소리가 달라지는 변경은 기존 implementation version을 덮어쓰지 않고 새 version을 추가한다.
- 단순 project migration이 node version을 조용히 바꾸어 sound를 변경해서는 안 된다.
- 더 이상 지원되지 않는 version을 열 수 없다면 명시적인 diagnostic과 지원 정책을 적용하며 임의의 최신 version으로 fallback하지 않는다.

Node ID 형식, version numbering scheme, registry/factory와 built-in node 목록은 미결정이다. Node contract의 module 책임은 [모듈 경계](module-boundaries.md)가 정의한다.

## Reference integrity

Project의 graph, mapping, preset과 interface binding은 이름이나 표시 label이 아니라 안정적으로 해석 가능한 reference를 사용해야 한다. 다음 상태는 compile/export 전에 거부해야 한다.

- 존재하지 않는 node, port, parameter, macro, component, asset 또는 meter를 가리키는 reference
- 지원되지 않는 node implementation version
- 호환되지 않는 typed port connection 또는 허용되지 않는 graph cycle
- 같은 scope에서 충돌하는 identity
- 삭제된 parameter ID를 새 의미로 재사용한 정의
- runtime에 포함할 수 없는 asset 또는 target metadata

Graph/UI object의 exact ID 범위와 영속성 규칙은 schema spike에서 좁힌다. Phase 0A는 display name에 의존한 참조를 피하고 validation 가능한 identity가 필요하다는 계약만 고정한다.

## Project schema version

모든 `.garak` project는 reader가 해석 규칙을 선택할 수 있는 명시적 schema version을 가진다. Schema version은 product version, node implementation version, parameter ID 또는 compiled runtime data version을 대신하지 않는다.

Reader는 최소한 다음 경우를 구분해야 한다.

- 현재 schema로 직접 읽을 수 있음
- 지원되는 이전 schema이며 migration이 필요함
- 알려졌지만 지원 범위 밖임
- 현재 구현보다 새로운 schema임
- 손상되었거나 version을 신뢰할 수 없음

지원하지 않는 data를 현재 schema로 추측하거나 unknown field를 근거 없이 성공 처리하지 않는다. Forward-compatible extension rule을 둘지는 physical schema를 정할 때 별도로 결정한다.

## Project migration

Migration은 version이 명시된 source project를 검증 가능한 target schema로 변환하는 serialization-boundary 작업이다.

필수 원칙:

- 각 migration은 source와 target schema version을 명시한다.
- 적용 순서와 결과가 결정적이고 test fixture로 재현 가능해야 한다.
- Product/plugin/parameter identity와 명시적 node implementation version을 임의로 바꾸지 않는다.
- Sound 또는 control semantics가 달라지는 변환은 일반 schema migration으로 숨기지 않는다.
- 실패를 성공으로 위장하거나 default project로 fallback하지 않는다.
- Migration이 완전히 성공하기 전에 source project를 덮어쓰지 않는다.
- 실행된 migration과 warning을 사용자가 확인할 수 있어야 한다.

Phase 2A의 initial chain은 exact supported legacy v1에서 current v2로 가는 pure
`project-schema-1-to-2` 하나다. Version-first reader와 headless status/dry-run/explicit distinct-output
publication은 [Project Migration Engine](project-migration-engine.md)이 정의한다. Studio confirmation,
backup/recovery와 in-place publication은 Phase 2B이고, schema v1 이후 장기 support 기간은 아직
미결정이다. 이 initial chain은 모든 역사적 또는 pre-release draft를 무기한 지원한다는 뜻이 아니다.

## Released data와 내부 compatibility의 구분

다음 경계를 명시적으로 유지한다.

- 출시되어 사용자가 보유한 `.garak` project는 선언된 지원 범위 안에서 explicit schema migration 대상이다.
- Preset과 DAW/plugin state 역시 별도의 persistent migration 계약을 갖지만 그 규칙은 [Parameter와 state](parameter-and-state.md)가 정의한다.
- 내부 C++/TypeScript API, pre-release schema draft, experiment와 obsolete compiler/adapter path는 compatibility shim, dual-write, legacy fallback으로 보존하지 않는다.

새 schema로 이동할 때도 obsolete 내부 구현을 계속 실행하는 대신 입력 경계에서 현재 canonical model로 명시적으로 변환한다.

## Domain별 의미

### Sound graph

Project는 mono/stereo static audio effect에 필요한 supported node와 connection을 표현한다. Synthesizer, sampler, polyphonic instrument, convolution 또는 외부 VST hosting을 위한 범용 graph 의미를 미리 포함하지 않는다.

### Parameter와 macro

Project는 internal/public parameter, macro, target mapping, range, default와 curve intent를 보존한다. Exact normalization, automation ordering, curve primitive와 smoothing 실행 규칙은 [Parameter와 state](parameter-and-state.md)에서 후속 설계한다.

### Interface scene

Project는 plugin-focused scene, reusable component/instance, visual property와 parameter/macro/meter binding을 보존한다. Renderer/layout backend object는 저장하지 않는다. Authoring-only selection, zoom, guides 또는 history와 runtime scene을 구분한다. 세부 권위는 [Interface Designer](interface-designer.md)에 있다.

### Preset과 default state

Factory preset definition과 제품 default는 product project의 authoring 자산이다. 실제 preset exchange와 DAW state encoding은 project schema와 별개의 version contract를 가질 수 있다. Project migration과 preset/state migration을 하나의 암묵적 fallback으로 합치지 않는다.

### Asset와 metadata

Project는 export에 필요한 image, SVG, font 등 asset의 identity와 사용 위치를 검증할 수 있어야 한다. Embedded, relative reference, content-addressed storage 또는 별도 package 중 어느 방식을 쓸지는 미결정이다. Asset이 project에 기록됐다는 사실이 저작권, 상표 또는 재배포 권한을 보증하지 않는다.

Format-specific metadata는 first-party product 의미와 target adapter용 표현을 구분한다. SDK object나 platform path를 canonical project model로 저장하지 않는다.

## Validation 단계

Project validation은 최소한 다음 층을 구분해 설명 가능한 diagnostic을 만든다.

1. Container와 schema version을 읽을 수 있는가
2. Required identity와 reference가 일관적인가
3. Graph, parameter/macro와 interface 각 domain이 유효한가
4. Domain 간 binding과 preset reference가 유효한가
5. 선택 target에서 compile/package할 수 있는가

앞 단계가 실패한 상태를 뒤 단계의 default나 자동 수리로 숨기지 않는다. 자동 수정 기능을 제공한다면 원본 의미의 변화와 새 project 저장을 사용자가 명시적으로 확인할 수 있어야 하며, 구체 UX는 미정이다.

## ANDONGMIN — BLOOM coverage

첫 reference project는 최소한 다음 의미를 한 aggregate로 보존해야 한다.

- BLOOM의 영구 product/plugin identity와 artist/product metadata
- 현재 처리 개념을 표현하는 static sound graph와 node versions
- Bloom, Warmth, Softness, Mix와 Output public control 기준안
- 여러 internal parameter를 다루는 macro mapping
- Interface scene과 control/meter binding
- Default state와 factory preset
- Windows/macOS target intent와 필요한 assets

이는 Phase 0A에서 BLOOM의 실제 DSP algorithm, node 종류, control numeric ID/range/curve, scene layout 또는 package metadata 값을 확정한다는 뜻이 아니다. 출시 identity와 parameter ID는 구현 중 임시 값이 아니라 release 전 별도 검토를 거쳐야 한다.

## Physical format을 정하기 전 평가할 사항

Phase 2A는 minimal directory package와 JSON v2/v1 migration을 검증했다. 아래 항목은 general/final
container를 정하기 전에 계속 평가한다.

- Human-readable diff와 merge 필요 수준
- Large/binary asset 처리와 project portability
- Atomic save, corruption detection과 recovery
- TypeScript/C++ 양쪽 validation 및 binding 생성
- Unknown/newer schema 처리
- Migration fixture 작성과 diagnostic source location
- Compiled runtime data와 authoring schema의 분리 비용
- Security boundary와 untrusted asset/parser 입력

FlatBuffers를 포함한 알려진 기술은 검증 후보일 뿐이다. Candidate 존재 여부는 `.garak` 또는 compiled runtime data 형식 채택을 의미하지 않는다.

## Open Questions

- General/final `.garak` container와 schema technology는 current directory JSON v2 이후 무엇인가?
- 새 제품·복제 workflow가 current canonical Product ID를 언제 명시적으로 재발급하는가?
- Graph, scene, component와 asset reference의 ID scope와 lifecycle은 무엇인가?
- Authoring-only data와 product-semantic data를 어느 경계에서 분리할 것인가?
- Asset embedding, font/SVG subset과 project portability 한계는 무엇인가?
- Schema v1 이후 migration support range는 무엇이며 Phase 2B backup/warning/failure UX는 어떻게 동작하는가?
- Studio와 native compiler가 같은 schema를 검증하도록 보장하는 생성 또는 conformance 방식은 무엇인가?

이 결정은 prototype fixture와 schema spike 없이 확정하지 않는다.
