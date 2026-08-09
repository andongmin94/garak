# Garak Runtime and Export

- 문서 상태: Phase 0A architecture 기준선
- 최종 갱신: 2026-08-09
- 권위 범위: compiled runtime contract, product compilation/export 단계와 generated runtime 전략 평가 기준
- 관련 문서: [v0.1 제품 요구사항](../product/v0.1-prd.md), [시스템 개요](system-overview.md), [프로젝트 모델](project-model.md), [모듈 경계](module-boundaries.md), [Realtime과 quality](realtime-and-quality.md), [ADR 0003 — Proposed](../adr/0003-generated-plugin-runtime-strategy.md), [ADR 0004](../adr/0004-windows-macos-and-plugin-formats.md)

## 문서의 역할

이 문서는 validated `.garak` project가 independent native plugin package가 되는 흐름과 generated runtime이 지켜야 하는 format-neutral 계약을 정의한다. Studio의 export 버튼이나 build command를 설계하는 문서가 아니며 Phase 0A에서 compiler, VST3, AU, packaging 또는 validator를 구현한 것으로 간주하지 않는다.

Generated plugin runtime을 제품에 결합하는 방식은 아직 결정되지 않았다. 아래의 대안 A와 B는 모두 유효한 검증 후보이며 어느 것도 현재 architecture의 채택안이 아니다. 선택 상태의 유일한 권위는 **Proposed** 상태의 [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)이다. VST3 기술 spike와 ADR 상태 변경 전에는 다른 문서나 구현 계획이 한 대안을 전제로 해서는 안 된다.

## Runtime의 제품 계약

Generated Plugin Runtime은 한 제품의 compiled definition을 native host 안에서 실행한다.

- Compiled DSP schedule, buffer plan과 latency를 준비하고 처리한다.
- Public parameter automation, macro mapping, smoothing, bypass와 state restore를 수행한다.
- Product의 native interface scene과 control/meter binding을 실행한다.
- Product metadata, preset과 asset을 target package에서 찾고 검증한다.
- Format adapter를 통해 host의 lifecycle, audio/event, parameter, state와 editor contract를 받는다.

Runtime은 `.garak` authoring editor, Studio workspace, cloud service 또는 arbitrary scripting environment를 포함하지 않는다. 생성 제품의 audio processing, UI, preset과 state restore는 Studio와 network 없이 오프라인에서 작동해야 한다.

## Authoring project와 runtime artifact

`.garak`은 editable source of truth이고 compiled runtime data는 특정 compiler/runtime contract를 위한 derived artifact이다. Export는 source project를 plugin bundle에 그대로 넣는 과정이 아니라 authoring-only 정보와 runtime에 필요한 의미를 검증하여 target-independent product definition으로 낮추는 과정이다.

Compiled runtime data는 최소한 다음을 가능하게 해야 한다.

- data schema/contract version 식별
- product/plugin identity 확인
- required runtime capability와 node implementation version 확인
- graph schedule, buffer/latency와 parameter/macro definition 로드
- interface scene, preset, asset와 metadata reference 검증
- incompatible, newer 또는 corrupt artifact를 설명 가능한 오류로 거부

Physical container, byte layout, schema technology, compression, embedded resource 위치와 integrity/signing 방식은 미결정이다. 특정 serialization 후보를 전제로 public runtime contract를 설계하지 않는다.

## Product compilation pipeline

아래 단계는 논리적 순서이며 하나의 process, executable 또는 build target을 뜻하지 않는다.

1. **Project load와 schema handling**
   - `.garak` container와 schema version을 확인한다.
   - 지원되는 이전 project라면 명시적 migration을 수행한다.
2. **Project-level validation**
   - Product/plugin identity, metadata, graph, mapping, scene, preset와 asset reference를 검증한다.
3. **Sound compilation**
   - Typed graph와 node implementation version을 확인한다.
   - Execution ordering, buffer plan과 latency propagation을 계산한다.
4. **Control/state compilation**
   - Public/internal parameter, macro curve/range, smoothing configuration와 preset definition을 runtime 표현으로 낮춘다.
5. **Interface compilation**
   - Authoring-only scene state를 제외하고 native runtime scene, interaction와 binding을 만든다.
6. **Product assembly**
   - Runtime data, metadata, preset, asset와 필요한 notices를 하나의 제품별 input set으로 만든다.
7. **Runtime packaging**
   - 아직 미결정인 대안 A 또는 B에 따라 product input과 native runtime을 결합한다.
8. **Format/platform packaging**
   - Target adapter가 class identity, binary architecture, bundle layout와 format metadata를 적용한다.
9. **Validation과 evidence**
   - Package structure, 금지 runtime 부재, official validator와 host smoke test 결과를 기록한다.

앞 단계의 실패를 fallback package로 우회하지 않는다. Export 결과는 성공 산출물과 diagnostic을 명확히 구분하고, partial/corrupt package를 완성 제품으로 보고하지 않아야 한다. Atomic output과 failure cleanup의 구체 구현은 Phase 7 계획에서 정한다.

## Runtime lifecycle

정확한 API 이름은 미정이지만 lifecycle 의미는 다음 경계를 가져야 한다.

### Load와 validation

Runtime data schema, product identity, node capability, preset와 asset을 확인한다. Parsing, migration, filesystem access와 allocation은 audio process callback 밖에서 수행한다.

### Prepare

Sample rate, block size, channel layout와 host configuration에 맞춰 memory, audio buffer, execution schedule, converter, smoothing과 communication storage를 준비한다. Unsupported configuration은 activation 전에 diagnostic으로 거부해야 한다.

### Process

Prepared schedule만 실행하고 graph structure를 변경하지 않는다. Allocation, blocking, file/network I/O, parsing, GUI call, 파일 로그와 exception propagation을 금지한다. 정확한 계약은 [Realtime과 quality](realtime-and-quality.md)가 권위를 가진다.

### State와 editor

Format adapter는 host state 및 editor lifecycle을 first-party contract로 번역한다. State parsing/migration은 callback 밖에서 하고 validated value snapshot만 realtime 경계로 전달한다. UI는 audio callback을 직접 호출하지 않는다.

## Generated package 불변식

- Product는 영구 product ID와 plugin class ID를 유지한다.
- Package는 target format과 CPU architecture가 요구하는 native binary/bundle이다.
- Generated plugin은 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 포함하지 않는다.
- 기본 audio processing, native UI, preset과 state restore는 Garak Studio와 network 없이 동작한다.
- Product UI와 metadata에 의무적인 Garak branding을 넣지 않는다.
- 서로 다른 Garak 제품이 같은 시스템에 설치되어도 identity와 resource가 충돌하지 않아야 한다.
- Package에 포함되는 third-party code, asset와 notice는 해당 재배포 정책을 만족해야 한다.

White-label, 판매와 Garak Runtime 재배포의 법적 권리는 아직 제품·사업 정책 가설이다. Architecture가 license grant를 대신하지 않는다.

## Runtime packaging 대안

### 대안 A — Prebuilt 범용 Garak Runtime에 product data 삽입

미리 빌드한 범용 native runtime을 target별로 준비하고 export 시 product-specific compiled data와 metadata를 runtime이 읽을 수 있는 위치에 삽입한다.

가능 이점은 제품 export 때 native compile/link 작업을 줄이고, 한 번 검증한 Runtime binary를 재사용하며,
제품별 차이를 data와 resource로 제한할 수 있다는 점이다. Phase 1B Windows x64 spike는 동일 inner
binary를 두 제품에서 재사용하고 product packaging 때 native compile/link가 0인 bounded 사례를
측정했다. Production data, 여러 target과 대규모 export에 대한 일반 주장은 아직 측정되지 않았다.

검증할 위험:

- Plugin class identity와 format registration을 제품별로 안전하게 변경하는 방법
- Binary/resource 수정이 code signing와 notarization에 미치는 영향
- 여러 제품의 side-by-side installation과 cache/host discovery
- 범용 runtime이 불필요한 capability와 크기를 포함할 가능성
- 어느 resource 위치와 container가 format validator 규칙을 만족하는지

### 대안 B — Product별 thin native wrapper 생성 후 공통 Runtime과 link

Export가 제품 identity와 target integration을 담은 얇은 native wrapper를 생성하고 공통 Garak Runtime과 link하여 제품별 native binary/package를 만든다.

가능 이점은 class registration과 product metadata를 build input으로 명시하고, 제품별 capability를
줄이며, native signing/notarization pipeline에 맞추기 쉬울 수 있다는 점이다. Phase 1B Windows x64
spike는 두 thin factory wrapper의 제품별 compile/link와 artifact delta를 측정했다. macOS,
signing/notarization과 production scale에 대한 일반 주장은 아직 측정되지 않았다.

검증할 위험:

- Studio export 환경에 compiler/linker와 SDK를 안정적으로 공급해야 하는 복잡성
- 제품별 build 시간, cache와 reproducibility
- Generated source surface와 diagnostic/support 부담
- 공통 Runtime을 static/dynamic 중 어떻게 link하고 배포할지
- Windows/macOS 및 Universal binary toolchain 차이

### 현재 결정 상태

두 대안은 모두 **미결정**이다. Phase 1B에서 측정한 Windows x64 bounded evidence는
[runtime strategy artifact 상태](../status/phase-1b-runtime-strategy-artifacts.md)와
[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)에 기록한다. 나머지 이점과 위험은 후속
spike에서 검증할 질문이며, 대안 결합, 제3안 또는 표현 조정이 필요하면 ADR 0003을 먼저 갱신해야 한다.

## VST3 runtime strategy spike

첫 Windows x64 VST3 비교 spike는 Phase 1B에서 Gain/Bypass와 state contract, 제품별 identity,
same-process coexistence, package/build delta와 official validator를 사용해 완료했다. 이는 production
runtime 전략을 선택하지 않았으며 다음 항목 중 실제 DAW, installation, version mismatch와
cross-platform/signing 질문은 계속 미검증이다.

- Stable class ID registration과 product별 identity
- Official validator 및 실제 host에서 load/process/state round trip
- Product data와 asset의 bundle 위치 및 corruption detection
- 여러 생성 제품의 side-by-side install
- Export/build time, package size와 reproducibility
- Runtime/compiler version mismatch diagnostic
- Crash/failure isolation과 partial export 처리
- 이후 macOS universal, signing/notarization과 AU 추가 가능성
- Studio가 없는 offline system에서의 operation
- Package에 금지된 JavaScript runtime이 없음을 검사하는 방법

Spike 결과는 재현 명령, tool/SDK version, package 구조, validator output과 실패를 기록해야 한다. 한 대안이 단지 먼저 작동했다는 이유만으로 장기 전략을 채택하지 않고 두 대안의 동일한 수용 항목을 비교한다.

## Platform와 format 순서

기술 검증 순서:

1. Windows x64 VST3
2. macOS arm64/x86_64 VST3
3. macOS AU

첫 상용 목표:

- Windows VST3
- macOS Universal VST3
- macOS AU

Windows VST3 spike 통과는 전체 v0.1 format 수용이 아니다. macOS architecture 결합, bundle identity, signing/notarization과 AU adapter는 후속 단계에서 별도 검증한다. 플랫폼/format 결정의 권위는 [ADR 0004](../adr/0004-windows-macos-and-plugin-formats.md)에 둔다.

VST3가 확정 output format이라는 사실은 특정 SDK가 이미 dependency로 승인되었다는 뜻이 아니다. Format adapter 구현 후보의 license, redistribution, API와 validator 적합성은 [의존성 정책](dependency-policy.md)에 따라 검증한다.

## Validation layers

Export 성공을 한 단계의 boolean으로 축소하지 않는다.

| 층 | 필요한 증거 |
| --- | --- |
| Project | Schema, identity, graph, mapping, scene, preset와 asset validation |
| Compile | Schedule, buffer/latency, node/runtime capability와 binding validation |
| Package | Target layout, architecture, metadata, resource와 dependency inspection |
| Format | 해당 target의 official validator 결과 |
| Host | 실제 DAW에서 load, processing, automation, bypass, editor와 state smoke test |
| Independence | Studio/network 없이 offline operation, 금지 runtime 부재 |
| Compatibility | 지원 schema/node/state fixture의 migration과 restore 결과 |

Validator를 실행하지 않았거나 host/version이 기록되지 않았다면 통과했다고 보고하지 않는다. Signing/notarization이 아직 준비 단계라면 unsigned technical artifact와 commercial-ready package를 명확히 구분한다.

## Version와 compatibility

Runtime/export 영역은 다음 version을 구분한다.

- Product release version
- `.garak` project schema version
- Node implementation version
- Compiled runtime data contract version
- Preset/DAW state schema version
- Runtime binary/compiler compatibility

한 version을 다른 version의 대용으로 사용하지 않는다. Released `.garak`, preset과 DAW state는 선언된 지원 범위에서 명시적 migration을 제공한다. Compiled data는 source project에서 재생성 가능한 derived artifact이므로 무기한 migration할지, compatible compiler로 rebuild할지, 또는 거부할지는 별도 정책으로 정한다.

Obsolete 내부 compiler API, adapter, generated wrapper template 또는 pre-release binary ABI는 compatibility shim으로 보존하지 않는다. Persistent data migration은 입력 경계에서 현재 canonical contract로 변환하며 obsolete runtime path를 계속 실행하는 방식으로 구현하지 않는다.

## Phase 0A에서 정하지 않는 것

- A/B runtime packaging 전략의 선택
- Runtime data container와 schema technology
- VST3/AU adapter 구현 dependency
- Static/dynamic linking 방식과 binary partition
- Package resource layout와 signing 위치
- 정확한 OS/DAW/validator version matrix
- CPU, latency, memory, package size와 export-time threshold

## Open Questions

- Product data를 각 format의 서명 가능한 package 안 어디에 둘 것인가?
- Compiler/runtime/data version mismatch를 어떤 compatibility matrix로 판단할 것인가?
- Product별 identity를 Windows VST3, macOS VST3와 AU에서 어떻게 안정적으로 인코딩할 것인가?
- macOS Universal binary와 AU packaging에 필요한 build/signing toolchain을 Studio가 어떻게 제공할 것인가?
- Export diagnostic과 partial artifact를 어떤 구조로 보존할 것인가?
- Factory preset, user preset와 asset packaging 경계를 어디까지 export가 소유할 것인가?
- Generated runtime redistribution와 third-party notices를 실제 license가 어떻게 허용할 것인가?

이 질문은 VST3 spike, dependency/license 검토와 packaging prototype 후에 ADR 또는 구현 ExecPlan에서 결정한다.
