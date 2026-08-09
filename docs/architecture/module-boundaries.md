# Garak Module Boundaries

- 문서 상태: Phase 0A architecture 기준선
- 최종 갱신: 2026-08-09
- 권위 범위: first-party 책임, dependency direction, public contract와 third-party adapter 경계
- 관련 문서: [시스템 개요](system-overview.md), [프로젝트 모델](project-model.md), [Runtime과 export](runtime-and-export.md), [의존성 정책](dependency-policy.md), [ADR 0002](../adr/0002-no-juce-and-adapter-boundaries.md)

## 문서의 역할

이 문서는 Garak이 직접 소유해야 하는 capability를 나누고 각 경계를 통해 어떤 의미만 오갈 수 있는지 정의한다. 표의 이름은 논리적 module responsibility이다. Phase 0B의 실제 directory, CMake target, TypeScript package, process 또는 ABI를 미리 확정하지 않는다.

Dependency 선택과 license 승인 절차는 [의존성 정책](dependency-policy.md)이 권위를 가진다. 이 문서는 어떤 external implementation을 선택하더라도 지켜야 하는 architecture 격리 규칙을 정의한다.

## 경계 원칙

1. Garak product semantics는 first-party model과 contract로 정의한다.
2. Core module은 plugin SDK, UI renderer, layout engine, audio-device library 또는 serialization library 타입에 의존하지 않는다.
3. Adapter는 외부 lifecycle, ownership, threading, error와 data representation을 Garak contract로 번역한다.
4. Dependency는 외부 integration에서 내부 contract 방향으로 향하며 core가 adapter를 역으로 알지 않는다.
5. Editable project, compiled runtime data와 host state의 경계를 명시적으로 유지한다.
6. Audio process callback에 닿는 모든 경계는 [Realtime과 quality](realtime-and-quality.md)의 제약을 만족해야 한다.

## First-party module responsibilities

| 논리적 책임 | 소유하는 것 | 소유하지 않는 것 |
| --- | --- | --- |
| Studio Authoring | Sound/Control/Interface/Product workflow, editing command와 사용자 진단 표현 | Native plugin runtime, third-party 타입을 포함한 영속 제품 계약 |
| Project Model | `.garak` semantic model, schema version, identity/reference와 project migration | DSP 실행, host format object, physical serialization library API |
| DSP Graph Model | Node instance, typed port, connection과 graph validity 의미 | Renderer interaction model, host process buffer 타입 |
| DSP Node Contract | `NodeDescriptor`에 해당하는 first-party descriptor, node configuration와 implementation version contract | Third-party DSP object를 public node contract로 노출하는 것 |
| Graph Compiler | Graph validation, execution ordering, buffer planning와 latency propagation | Audio-device I/O, plugin package 생성 |
| Parameter and Macro | Public/internal parameter, macro mapping, automation normalization와 smoothing contract | Host SDK parameter object |
| State and Preset | Default, preset, DAW/plugin state schema와 migration | `.garak` 전체 project migration, format SDK stream 타입 |
| Interface Scene | Scene tree, style, layout intent, reusable control와 binding 의미 | 특정 renderer canvas, layout-node 또는 Studio DOM 타입 |
| Product Compiler | Project의 여러 domain을 일관된 compiled product definition으로 변환 | Target package 설치와 host-specific registration 자체 |
| Native Runtime | Compiled schedule, parameter/state와 native interface 실행 | Authoring editor와 `.garak` mutation |
| Export and Validation | Target 선택, packaging orchestration, validator/host result 수집과 설명 | Format SDK 타입을 core compiler에 누출하는 것 |
| Adapters | External API와 Garak public contract 사이 변환 | Product semantics와 장기 identity 정책 결정 |

`Project Model`, `Graph Compiler` 같은 명칭은 별도 binary를 의미하지 않는다. 한 물리 target에 여러 책임을 둘 수 있지만 dependency rule과 테스트 가능한 seam은 보존해야 한다.

## Dependency direction

논리적 dependency는 다음 방향을 따른다.

```text
Studio application ───────────────┐
Product Compiler / Export ────────┼──→ first-party models and contracts
Native Runtime ───────────────────┤
Format / UI / Platform Adapters ──┘

third-party or platform API → adapter implementation only
```

구체적으로 다음 coupling을 금지한다.

- Project schema가 host SDK parameter, renderer canvas 또는 layout node를 직렬화하는 것
- Graph compiler가 format-specific process data를 입력 contract로 받는 것
- Native runtime public header가 third-party type을 노출하는 것
- Interface scene이 Studio DOM 또는 native renderer의 object identity에 의존하는 것
- Core error/result model이 external library error class를 그대로 반환하는 것
- External enum 값이나 numeric identity를 검증 없이 Garak의 장기 ID로 사용하는 것

허용되는 public vocabulary의 예는 `garak::AudioBlock`, `garak::Parameter`, `garak::Graph`, `garak::NodeDescriptor`, `garak::ui::Canvas`, `garak::ui::Scene`, `garak::layout::Engine` 같은 Garak 소유 추상화이다. 이는 Phase 0A의 실제 C++ API 이름을 확정하는 선언이 아니라 public contract의 소유권을 설명하는 예시다.

## Adapter boundary

### Format adapter

DAW host의 process, parameter, state, editor와 lifecycle 호출을 Garak runtime contract로 변환한다. Format-specific class registration, stream, string, event와 bus 타입은 adapter 내부에 머문다. Product/plugin identity를 format representation으로 인코딩하는 방식은 adapter가 수행하지만 identity 자체의 정책은 [프로젝트 모델](project-model.md)이 소유한다.

VST3 output은 확정 목표지만 특정 SDK 채택은 아직 검증되지 않았다. 목표 format과 그 구현 후보를 같은 결정으로 취급하지 않는다.

### Rendering adapter

First-party scene/drawing command를 native 또는 Studio preview backend에 전달한다. Renderer resource lifecycle과 backend object는 adapter가 소유하며 scene schema에는 들어가지 않는다. Preview와 native renderer가 같은 implementation을 공유하는지는 미결정이다.

### Layout adapter

Garak layout intent를 backend 계산으로 변환하고 결과를 first-party geometry로 반환한다. External layout node나 style enum은 scene public API에 노출하지 않는다.

### Audio-device adapter

Studio audition의 device discovery, stream lifecycle와 callback representation을 authoring preview/runtime contract에 연결한다. Generated plugin의 host audio path와 Studio audio-device I/O는 서로 다른 integration boundary이다.

### Serialization and analysis adapters

Physical encoding, archive, FFT 또는 분석 implementation을 선택하더라도 project/runtime schema semantics와 analysis result vocabulary는 Garak이 소유한다. 외부 wire format이나 plan object를 domain model로 취급하지 않는다.

각 범주의 후보 상태는 [의존성 정책](dependency-policy.md)이 단일 권위를 가진다. 다른 문서에서 기술명을 언급할 때도 미설치·미검증·미승인 상태를 유지하고 채택안이나 기반 기술로 표현하지 않는다.

## Language와 process 경계

Studio는 TypeScript이고 Native Engine은 C++20이므로 다음 의미가 언어 경계를 넘어 일치해야 한다.

- project schema와 validation vocabulary
- product, plugin, parameter, node와 scene reference identity
- graph, mapping와 interface binding의 의미
- compiled runtime data compatibility
- diagnostic의 stable category와 source location

이를 JSON, generated bindings, binary schema, IPC 또는 native process 중 무엇으로 연결할지는 미결정이다. Phase 0A에서 TypeScript model과 C++ model을 독립적인 진실로 중복 정의하거나 특정 schema library를 전제하지 않는다. [프로젝트 모델](project-model.md)이 language-neutral semantic source이고 physical representation은 후속 spike에서 정한다.

## Graph와 node 경계

DSP Node Contract는 최소한 다음 의미를 first-party로 소유해야 한다.

- node type identity와 explicit implementation version
- typed input/output port와 channel/layout 제약
- configuration 및 internal parameter descriptor
- prepare와 process에 필요한 lifecycle 의미
- latency 및 resource requirement 보고
- realtime safety obligation

Project는 node type과 implementation version을 함께 참조한다. 소리가 달라지는 implementation은 기존 version을 덮어쓰지 않는다. 실제 factory, registry, binary ABI 또는 built-in node 목록은 Phase 0A에서 정하지 않는다. v0.1은 third-party Node SDK를 지원하지 않으므로 이를 위한 public extension ABI도 설계하지 않는다.

## Compile와 runtime 경계

Compiler는 편집 가능한 graph와 mapping을 검증한 뒤 runtime에서 구조 변경 없이 실행 가능한 schedule, buffer plan, latency와 precomputed mapping으로 낮춘다. Runtime은 compiled definition을 소비하며 `.garak` graph를 audio callback에서 해석하거나 변경하지 않는다.

Compiled data의 구체 schema와 Runtime ABI는 미결정이다. 다만 서로 호환되지 않는 compiler/runtime 조합을 감지하고 설명 가능한 오류로 거부할 수 있어야 한다. Runtime artifact의 version contract는 [Runtime과 export](runtime-and-export.md)가 소유한다.

## Parameter, state와 UI 경계

- Host automation은 format adapter가 first-party parameter identity와 value representation으로 변환한다.
- Macro mapping과 smoothing은 미리 compile하여 runtime에 전달한다.
- Preset/DAW state parsing과 migration은 audio callback 밖에서 수행한다.
- Interface control은 stable parameter 또는 macro binding을 사용하며 renderer object를 직접 참조하지 않는다.
- Meter 전달은 GUI가 audio process callback을 직접 호출하지 않는 bounded non-blocking 경계를 사용해야 한다. 구체 primitive는 미정이다.

Parameter identity와 state migration은 [Parameter와 state](parameter-and-state.md), realtime 금지 규칙은 [Realtime과 quality](realtime-and-quality.md), scene 의미는 [Interface Designer](interface-designer.md)가 각각 권위를 가진다.

## Error와 diagnostic 경계

Adapter는 external error를 Garak이 소유하는 diagnostic category, message와 context로 변환한다. Unknown external status를 성공으로 처리하거나 fallback 구현으로 숨기지 않는다. Compiler/export diagnostic은 가능하면 project의 관련 graph, parameter, scene, asset 또는 target 위치를 가리켜야 한다.

Audio callback에서는 exception을 경계 밖으로 전파하거나 파일 로그를 기록하지 않는다. 초기화·prepare 단계의 실패와 callback 중 비정상 상태를 처리하는 구체 fail-safe 정책은 후속 runtime 품질 설계에서 확정한다.

## Compatibility boundary

두 종류의 compatibility를 구분한다.

- 출시된 product identity, `.garak` project, preset과 DAW state는 사용자 영속 데이터이므로 explicit version과 migration contract로 다룬다.
- 내부 module API, pre-release schema draft, experimental adapter와 obsolete implementation path는 호환 shim, 이중 경로 또는 fallback으로 보존하지 않는다.

영속 데이터 migration도 무기한 모든 version을 지원한다는 뜻은 아니다. 지원 범위와 종료 정책은 출시 전에 결정하고 fixture로 검증한다.

## Third-party source handling

Third-party 원본은 가능한 한 수정하지 않는다. Garak naming이나 formatting에 맞추기 위한 대규모 변경을 하지 않으며, 필요한 수정은 작고 검토 가능한 patch set으로 격리한다. Fork 또는 patch가 adapter 경계를 우회해 external type을 core API에 노출할 근거가 되지 않는다.

## Phase 0A에서 정하지 않는 것

- 실제 source tree, namespace, package와 build target 수
- C++ ABI 또는 plugin-internal dynamic library 경계
- TypeScript/C++ schema generation 및 IPC 방식
- 구체 dependency, renderer, layout, audio-device와 serialization 구현
- Node registry/factory API와 built-in node 목록
- Thread communication primitive
- Error code numeric layout와 logging backend

이 결정은 buildable scaffold 또는 기술 spike가 필요하며 관련 ExecPlan과 ADR 없이 확정하지 않는다.
