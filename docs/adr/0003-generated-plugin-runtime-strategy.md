# ADR 0003 — Generated Plugin Runtime Strategy

- Status: Proposed
- Date: 2026-08-09
- 관련 문서: [Runtime과 export](../architecture/runtime-and-export.md), [프로젝트 모델](../architecture/project-model.md), [시스템 개요](../architecture/system-overview.md), [v0.1 제품 요구사항](../product/v0.1-prd.md), [ADR 0004](0004-windows-macos-and-plugin-formats.md)

## Context

Garak이 생성한 plugin은 Studio가 없는 컴퓨터에서 독립적으로 오프라인 동작해야 한다. Product별 영구 identity, compiled DSP/control/interface definition, preset, asset와 metadata를 포함하되 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 포함하지 않아야 한다.

Editable `.garak` project는 source of truth이고 compiled runtime data는 versioned derived artifact이다. Export는 이 data와 native Garak Runtime을 target plugin package로 결합해야 한다. 그러나 VST3 class registration, bundle metadata, resource 위치, validator, side-by-side installation, code signing과 향후 notarization 제약을 실제로 확인하기 전에는 결합 전략을 장기 결정할 근거가 없다. Format-neutral runtime contract와 export 단계는 [Runtime과 export](../architecture/runtime-and-export.md)가 정의한다.

## Proposal

Windows x64 VST3 기술 spike에서 아래 두 대안을 같은 최소 reference plugin과 수용 기준으로 구현·비교한 뒤 전략을 결정한다. 현재는 어느 대안도 채택안, 선호안 또는 임시 기본값이 아니다.

### Alternative A — Prebuilt Garak Runtime plus Product Data

Platform과 format별 범용 Garak Runtime을 미리 빌드하고, export 시 product-specific compiled data, identity, metadata, preset과 asset을 runtime이 읽을 수 있는 binary 또는 bundle 위치에 삽입한다.

검증할 가능성:

- Product export에서 native compile/link 작업을 줄일 수 있는가
- 동일한 검증된 runtime binary를 여러 제품에 재사용할 수 있는가
- Product별 차이를 versioned data와 resource로 제한할 수 있는가

검증할 위험:

- Product별 plugin class ID와 factory registration을 안전하게 설정하는 방법
- Binary 또는 resource 수정이 validator와 code signing에 미치는 영향
- 여러 제품의 side-by-side install, host discovery와 cache 충돌
- 범용 runtime의 package size와 불필요한 capability
- Compiled data의 위치, integrity와 corruption detection

### Alternative B — Product-specific Thin Wrapper plus Common Garak Runtime

Export 시 product identity, target integration과 compiled data 연결을 담은 얇은 native wrapper를 생성하고 공통 Garak Runtime과 link하여 제품별 native binary/package를 만든다.

검증할 가능성:

- Product별 class registration과 metadata를 native build input으로 명시할 수 있는가
- Format별 entry point와 resource를 일반 build/signing 흐름에 맞출 수 있는가
- Product별 필요 capability만 포함할 수 있는가

검증할 위험:

- Studio export 환경에 compiler, linker와 SDK를 재현 가능하게 공급하는 복잡성
- Product별 build 시간, cache, diagnostic과 support 부담
- Generated wrapper surface와 template version 관리
- Common Runtime의 static/dynamic link 및 compiler/runtime compatibility
- Windows, macOS architecture와 Universal binary toolchain 차이

두 대안은 다음 불변식을 공통으로 만족해야 한다.

- 동일한 first-party compiled runtime contract 사용
- 영구 product ID, plugin class ID와 parameter ID 보존
- Explicit schema와 node implementation version 확인
- Studio와 network 없이 audio, UI, preset과 state restore 동작
- Electron, Chromium, Node.js와 임의 JavaScript runtime 미포함
- Product별 Engine fork 또는 obsolete runtime fallback 미사용
- White-label product identity와 dependency/license 경계 보존

## Alternatives Considered

### Studio 또는 Electron runtime을 plugin에 포함

독립적인 native plugin과 금지 runtime 요구에 위배되므로 비교 대상에서 제외한다.

### Garak 설치나 외부 service가 필요한 shared runtime

Studio가 없는 offline system에서 동작해야 한다는 제품 계약에 위배되므로 제외한다.

### Product마다 Garak Engine 전체 source를 복제 또는 fork

공통 runtime contract와 version 관리가 무너지고 제품별 수정 경로가 생기므로 제외한다.

### Graph마다 전체 DSP C++ source를 생성

Compiled runtime data 모델보다 훨씬 큰 code-generation surface를 도입한다. v0.1에 필요한 가장 작은 비교가 아니므로 현재 A/B spike 범위에서 제외한다.

## Consequences

긍정적인 결과:

- Packaging, validator와 signing evidence에 근거해 장기 전략을 선택할 수 있다.
- A/B가 공유해야 하는 compiled data와 runtime contract를 먼저 명확히 할 수 있다.
- 먼저 작동한 prototype을 검증 없이 architecture로 고정하는 일을 피할 수 있다.

비용과 리스크:

- Product compiler와 export architecture는 spike 전까지 A/B 모두를 허용하는 contract 수준에 머물러야 한다.
- 같은 reference plugin을 두 방식으로 만드는 spike 비용이 든다.
- Physical runtime/data layout, wrapper generator와 linking 방식은 현재 미결정으로 남는다.
- 다른 architecture 문서나 Phase 계획이 한 대안을 전제로 작성되면 Proposed 상태와 충돌한다.

## Follow-up and Validation

Phase 0A 이후 실제 Windows x64 VST3 기술 spike에서 두 대안을 비교한다. 최소 reference plugin은 stereo `Input → Gain → Output`, automated parameter 하나, bypass와 state save/load를 제공하며 editor 없이도 처리할 수 있어야 한다.

두 대안에 동일하게 요구할 증거:

- 서로 다른 영구 ID와 metadata를 가진 최소 두 제품의 side-by-side scan과 instantiate
- Official VST3 validator 및 실제 host의 load, process, automation, bypass와 state round trip
- Product data, preset와 asset의 package 위치 및 corruption/schema mismatch 진단
- Studio가 설치되지 않고 network가 없는 환경에서의 operation
- Package dependency와 binary inspection을 통한 금지 runtime 부재 확인
- Export/build 시간, package size, cache와 reproducibility 비교
- Compiler/runtime/data version mismatch의 명시적인 실패
- Partial export와 실패 artifact 처리
- 이후 macOS Universal VST3, signing/notarization과 AU로 확장할 수 있는 구조
- Dependency license, notice와 Garak Runtime 재배포 조건 검토

Spike는 tool/SDK version, 재현 명령, package 구조, validator output과 실패를 기록해야 한다. 한 대안이 먼저 동작했다는 이유만으로 선택하지 않는다. 결과에 따라 이 ADR을 `Accepted`로 갱신하거나 선택을 기록한 후속 ADR로 `Superseded`한다. 둘 다 수용 기준을 만족하지 못하면 실패를 숨기지 않고 새 대안을 `Proposed`로 기록한다.

Phase 0A에서는 VST3 SDK, compiler나 validator를 설치·실행하지 않았고 A/B prototype도 만들지 않았다. 따라서 이 ADR은 제안 상태이며 runtime packaging 전략은 미결정이다.
