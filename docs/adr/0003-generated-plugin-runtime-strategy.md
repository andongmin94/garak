# ADR 0003 — Generated Plugin Runtime Strategy

- Status: Proposed
- Date: 2026-08-09
- 관련 문서: [Runtime과 export](../architecture/runtime-and-export.md), [프로젝트 모델](../architecture/project-model.md), [시스템 개요](../architecture/system-overview.md), [v0.1 제품 요구사항](../product/v0.1-prd.md), [VST3 Adapter](../architecture/vst3-adapter.md), [Phase 1A VST3 Identity](../status/phase-1a-vst3-identity.md), [Phase 1B VST3 Product Identities](../status/phase-1b-vst3-identities.md), [Phase 1B Runtime Strategy Artifacts](../status/phase-1b-runtime-strategy-artifacts.md), [ADR 0004](0004-windows-macos-and-plugin-formats.md)

## Context

Garak이 생성한 plugin은 Studio가 없는 컴퓨터에서 독립적으로 오프라인 동작해야 한다. Product별 영구 identity, compiled DSP/control/interface definition, preset, asset와 metadata를 포함하되 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 포함하지 않아야 한다.

Editable `.garak` project는 source of truth이고 compiled runtime data는 versioned derived artifact이다. Export는 이 data와 native Garak Runtime을 target plugin package로 결합해야 한다. Phase 1A는 fixed editorless module에서 VST3 class registration, Windows bundle과 official validator의 최소 format 경계를 확인했다. Phase 1B는 Windows x64의 같은 Gain/state contract로 prebuilt data runtime과 product-specific thin wrapper를 실제 구현해 identity, side-by-side load, package-only reproduction, validator와 artifact delta를 비교했다. 그러나 `.garak` compiled product data, production export, code signing과 macOS notarization은 확인하지 않았으므로 runtime 결합 전략을 장기 결정할 근거는 여전히 부족하다. Format-neutral runtime contract와 export 단계는 [Runtime과 export](../architecture/runtime-and-export.md)가 정의한다.

## Proposal

Phase 1A의 공통 Windows x64 VST3 format baseline 위에서 아래 두 대안을 같은 최소 reference
plugin과 수용 기준으로 구현·비교한다. Phase 1B Windows spike는 이 비교 evidence를 만들었지만
전략 선택에 필요한 cross-platform, signing/export와 legal evidence는 남아 있다. 현재 어느 대안도
채택안, 선호안 또는 임시 기본값이 아니다.

### Phase 1A 관찰

Phase 1A는 official Steinberg VST3 SDK tag `v3.8.0_build_66`, full commit
`9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`에 고정한 `Garak Gain Spike`를 Windows x64 Debug와
Release로 build했다. Pinned SDK의 official validator 결과는 두 configuration 모두 standard
47 tests passed, 0 failed와 extensive 537 tests passed, 0 failed였다. Processor와 controller
class가 발견됐고 fixed module은 editor view 없이 load와 audio/parameter/state contract를
제공한다. VSTGUI는 build/link하지 않았다.

이 module은 fixed metadata의 editorless VST3 adapter spike다. Product compiler, `.garak` 또는
compiled product data를 사용하지 않았고 prebuilt runtime에 product data를 삽입하지도,
product-specific wrapper를 생성해 common runtime과 link하지도 않았다. 따라서 Alternative A와
Alternative B 어느 쪽도 구현한 것이 아니며 어느 대안도 선호안이나 기본값이 아니다.

관찰 범위는 Windows x64 fixed module에 한정된다. macOS/Universal VST3, generated runtime,
side-by-side product export, commercial distribution와 전체 dependency legal audit는 검증하거나
승인하지 않았다.

### Phase 1B Windows 관찰

Phase 1B는 네 개의 editorless product를 같은 first-party Gain/Bypass/state contract로 만들었다.
Data Alpha/Beta는 Alternative A, Thin Alpha/Beta는 Alternative B다. 네 제품은 각각 고유한
processor/controller FUID를 가지며 Alpha는 -6.0 dB, Beta는 +3.0 dB default를 공유한다. Identity
literal과 moduleinfo 구조 parity는 production 상수를 재사용하지 않는 contract fixture로 검증했다.

Alternative A의 configuration별 template, Data Alpha와 Data Beta inner module은 byte-identical하다.
Data bundle의 실제 local path는
`out/build/runtime-strategy-<config>/runtime-products/<Product>.vst3`이며 product별 strict descriptor와
moduleinfo가 identity를 제공한다. Plain PowerShell package-only rerun은 `cl.exe`와 `link.exe` 없이
네 output을 재생성했고 compiler/build invocation은 0이었다. Immutable input 18개의 size, hash와
timestamp가 유지됐다.

Alternative B는 common implementation을 static library로 한 번 compile하고 Alpha/Beta 각각 한
factory wrapper translation unit과 module을 별도로 compile/link한다. Thin inner binaries는 서로 다른
hash다. Static library reuse는 build/source reuse이며 common executable bytes는 각 final binary에
포함된다.

Debug/Release에서 Gain Spike와 네 product, standard/extensive 조합의 official validator raw report
20개는 각각 47/47 또는 537/537, failure/warning/crash 0을 기록한다. 한 process에서 다섯 module의
distinct handle, identity, state, interleaved processing과 reverse unload/reload도 통과했다. 모든 inner
module은 Windows x64 PE32+ DLL이고 import/resource inspection에서 Electron, Chromium, Node.js,
JavaScript runtime와 VSTGUI가 없다. Exact hash와 size는
[artifact status](../status/phase-1b-runtime-strategy-artifacts.md)에 기록한다.

이 관찰은 data-driven factory와 thin wrapper가 모두 최소 Windows contract를 만족할 수 있음을
보인다. Code signing, signed artifact mutation, macOS module-relative resource lookup, Universal
binary, notarization, AU, production compiled data와 export UX는 검증하지 않았다. 따라서 어느
대안에도 우선순위나 기본값을 부여하지 않는다.

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

Phase 1B에서는 module-relative strict descriptor와 fail-closed dynamic factory가 두 byte-identical
product를 같은 process에서 분리했고 product별 compile/link를 0으로 만들었다. 반면 현재 loader는
Windows module path에 한정되고 descriptor schema는 spike identity/default만 담는다. Final resource를
추가한 뒤 bundle을 서명해야 하며 signed template을 다시 package하는 순서는 사용할 수 없다.

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

Phase 1B에서는 28 physical line/24 nonblank line wrapper 한 개씩과 module link 한 번으로 두 제품을
만들었고 identity/moduleinfo가 native factory에 고정됐다. 반면 product export에 compiler/linker와
SDK graph가 필요하며 static common implementation의 executable bytes는 각 product binary에 다시
포함된다. Windows 성공만으로 Apple toolchain이나 Universal/signing 흐름은 확인되지 않는다.

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

- Product compiler와 export architecture는 선택 전까지 A/B 모두를 허용하는 contract 수준에 머물러야 한다.
- 같은 reference plugin을 두 방식과 두 configuration으로 계속 검증하는 비용이 든다.
- Windows spike의 physical layout과 linking evidence는 생겼지만 production runtime/data container,
  wrapper generator, signing 순서와 cross-platform layout은 미결정으로 남는다.
- 다른 architecture 문서나 Phase 계획이 한 대안을 전제로 작성되면 Proposed 상태와 충돌한다.

## Follow-up and Validation

Phase 1B Windows spike는 Phase 1A가 확립한 VST3 format baseline에서 두 대안을 같은 editorless
Gain/Bypass/state reference로 비교했다. 다음 validation은 이 결과를 선택으로 승격하는 것이 아니라
아직 없는 production/cross-platform evidence를 채우는 단계다.

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

Evidence는 tool/SDK version, 재현 명령, package 구조, validator output과 실패를 기록해야 한다.
다음 단계는 최소한 macOS arm64/x86_64와 Universal VST3, module-relative data lookup, signing과
notarization, package-only/export reproducibility, production compiled-data schema와 corruption/version
failure, dependency redistribution/legal scope를 같은 기준으로 비교한다. Alternative B에는 export
toolchain 공급/caching/diagnostic evidence, Alternative A에는 signed artifact staging과 resource
integrity evidence가 추가로 필요하다.

한 대안이 Windows에서 작거나 먼저 package됐다는 이유만으로 선택하지 않는다. 필요한 evidence와
제품 요구 trade-off를 결정한 뒤 이 ADR을 `Accepted`로 갱신하거나 선택을 기록한 후속 ADR로
`Superseded`한다. 둘 다 수용 기준을 만족하지 못하면 실패를 숨기지 않고 새 대안을 `Proposed`로
기록한다.

Phase 1B는 Windows x64 A/B prototype, product packaging과 비교 evidence를 만들었지만 macOS,
signing/notarization, production `.garak` export와 legal acceptance를 만들지 않았다. 따라서 이 ADR은
계속 `Proposed`이며 runtime packaging 전략은 미결정이다.
