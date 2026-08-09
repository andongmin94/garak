# Dependency and License Policy

- 상태: Phase 1A Windows VST3 admission과 Phase 1B A/B dependency evidence 반영
- 권위: dependency 도입, 후보 상태, adapter, third-party source와 license 검토
- 관련 문서: [v0.1 PRD](../product/v0.1-prd.md), [Realtime and Quality](realtime-and-quality.md), [Interface Designer](interface-designer.md), [VST3 Adapter](vst3-adapter.md), [Phase 1A VST3 Dependency](../status/phase-1a-vst3-dependency.md), [Phase 1B Runtime Strategy Artifacts](../status/phase-1b-runtime-strategy-artifacts.md)

## 목적과 현재 상태

잘 유지되는 library가 전체 복잡성과 위험을 줄이면 활용하되 `.garak`, graph/runtime, parameter/state, scene와 export contract는 Garak이 소유한다. Phase 0A에서는 외부 SDK/library를 다운로드, 설치 또는 통합하지 않았다. Phase 1A에서는 공식 Steinberg VST3 SDK의 exact tag `v3.8.0_build_66`, superproject commit `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`을 recursive Git submodule로 고정하고 Windows x64의 고정 editorless VST3 adapter 범위에서 checkout, Debug/Release build와 official validator를 검증했다. Phase 1B는 이 exact checkout과 기존 first-party Gain implementation만 사용해 runtime packaging A/B를 비교했으며 dependency를 추가하지 않았다.

이 admission과 Phase 1B evidence는 Windows 기술 spike에만 한정된다. VSTGUI는 recursive checkout에는 존재하지만 build/link하지 않는다. macOS, production generated runtime 채택, commercial distribution, trademark/notice와 전체 transitive legal audit는 승인하거나 완료하지 않았다.

상태 용어:

- **확정 방향**: architecture 선택이며 설치·build 완료를 뜻하지 않는다.
- **후보**: capability spike 대상으로 이름만 오른 상태이다.
- **미설치/미검증/미승인**: project 추가, 적합성 검증, 채택 결정이 각각 이루어지지 않았다.
- **승인**: exact scope/version에 대해 admission, test와 필요한 ADR을 마친 상태이다.

후보 또는 permissive license라는 이유만으로 승인되지 않는다.

## 확정 기술 방향

| 영역 | 방향 | 현재 검증 상태 |
| --- | --- | --- |
| Studio | Electron, React, TypeScript strict | Phase 0B Windows scaffold 검증; macOS 미검증 |
| Native Engine | C++20 | Phase 0B scaffold와 Phase 1A Gain spike 검증 |
| Build | CMake, Ninja | Windows configure/build 검증 |
| Compiler | Windows MSVC, macOS Apple Clang | Windows MSVC 검증; Apple Clang 미검증 |
| Framework | JUCE 사용 금지 | 제약 확정 |

Studio exact dependency와 Windows toolchain은 Phase 0B 상태 문서에, VST3 SDK exact source와
scope는 Phase 1A dependency 상태 문서에 기록한다.

## 외부 dependency 상태

| 후보 | 검토 capability | 현재 상태 |
| --- | --- | --- |
| Steinberg VST3 SDK | VST3 format adapter | Phase 1A admission; 같은 exact pin으로 Phase 1B Windows A/B build/validator 검증 |
| Skia | generated native UI rendering | 미설치·미검증·미승인 |
| CanvasKit | Studio interface preview rendering | 미설치·미검증·미승인 |
| Yoga | layout calculation adapter | 미설치·미검증·미승인 |
| XYFlow | Studio graph editor interaction | 미설치·미검증·미승인 |
| miniaudio | Player/Studio audio-device I/O | 미설치·미검증·미승인 |
| KissFFT | FFT와 audio analysis | 미설치·미검증·미승인 |
| FlatBuffers | compiled runtime data serialization | 미설치·미검증·미승인 |

Steinberg VST3 SDK 이외 후보는 계속 미설치·미검증·미승인이다. 후속 문서는 이 후보를
“기반”, “채택” 또는 “사용 중”이라고 표현하지 않는다. 부적합한 후보는 compatibility
wrapper나 fallback 없이 제거한다.

### Phase 1A VST3 SDK admission 경계

- Official source는 `steinbergmedia/vst3sdk`의 tag `v3.8.0_build_66`, full commit
  `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`에 고정한다.
- Windows x64 Debug와 Release의 `Garak Gain Spike` bundle을 build하고 pinned source의 official
  validator로 각각 standard 47 tests와 extensive 537 tests를 실행했다. 네 run 모두 failed test
  0으로 통과했다.
- SDK type과 lifecycle은 [VST3 Adapter](vst3-adapter.md) 안에 격리하고 first-party public model에
  노출하지 않는다.
- VSTGUI, SDK plugin example, documentation과 tutorials는 plugin에 build/link하지 않는다.
- 이 결과는 fixed editorless module의 format-adapter admission 증거일 뿐 generated plugin runtime
  dependency 승인이나 상용 배포 준비 완료가 아니다.
- macOS/Apple Clang, Universal VST3, AU, signing/notarization, commercial redistribution와 전체
  transitive legal audit는 미검증·미승인이다.

### Phase 1B dependency delta와 재배포 경계

Phase 1B는 SDK tag, superproject/nested checkout과 license inventory를 변경하지 않았다. Plugin
module은 계속 pinned SDK의 `sdk`, `sdk_common`, `base`, `pluginterfaces`와 first-party code만 link한다.
`sdk_hosting`은 official validator와 loaded contract-test host에만 있고 final plugin link에는 없다.

Pinned SDK에 이미 포함된 `moduleinfotool`은 Phase 1B option에서만 build하는 packaging utility다.
Alternative A staging과 Alternative B Thin target의 `moduleinfo.json` create/validate에 사용한다. Contract
test의 structured parity check도 같은 pinned source의 `ModuleInfoLib` parser를 격리 target으로
compile한다. 이는 새 third-party dependency가 아니라 기존 exact SDK checkout의 build/test surface다.

VSTGUI nested checkout은 계속 존재하지만 `SMTG_ENABLE_VSTGUI_SUPPORT=OFF`이며 Phase 1B plugin link
command의 VSTGUI hit는 0이다. Final bundle에도 editor, snapshot, icon 또는 VSTGUI resource가 없다.
Electron, Chromium, Node.js와 JavaScript runtime도 PE import/resource inventory에 없다. Studio source,
manifest와 lockfile의 exact direct dependency 16개는 기능적으로 바뀌지 않았고 native plugin target에
전이되지 않는다.

Alternative A는 configuration별 prebuilt template binary를 Data Alpha/Beta에 byte-for-byte 복사하고
first-party descriptor와 generated moduleinfo만 추가한다. Product package-only 단계는 compiler/linker를
호출하지 않는다. Alternative B는 각 product wrapper와 static common implementation을 same SDK targets에
link한다. 두 방식 모두 SDK redistribution/legal 의무를 제거하지 않으며 어느 방식도 production
dependency admission의 선호안 또는 기본값이 아니다.

Repository 자체 license는 계속 미정이며 top-level `LICENSE`를 만들지 않았다. SDK superproject와
nested license/notice inventory는 [third-party dependency manifest](../../third_party/dependencies.yml)에
기록하지만 `tutorials` repository에는 standalone license file이 없다는 package-level limitation이
남아 있다. Commercial redistribution notice, Steinberg trademark, generated product notice 제공 방식과
전체 transitive legal review는 unresolved다. Phase 1B validator와 binary evidence를 법률 승인으로
해석하지 않는다.

## First-party 경계와 Adapter 규칙

Garak 소유 영역:

- `.garak` project와 DSP node/graph contract
- graph compiler, schedule, buffer/latency planning
- parameter/macro와 state/preset migration
- interface scene/binding과 product compiler
- generated runtime, validation과 export contract

외부 SDK/library/platform API는 adapter 뒤에 격리한다. Garak public API는 `garak::AudioBlock`, `Parameter`, `Graph`, `ui::Scene` 같은 first-party type만 사용하며 이름은 아직 예시이다. `Steinberg::Vst::ProcessData`, `SkCanvas`, `YGNode`, DOM/React 또는 third-party container/error type은 노출하지 않는다.

Adapter는 type 변환, lifecycle/ownership/error/thread 차이, format ID encoding과 diagnostic 변환을 맡는다. Adapter 존재만으로 승인되지 않으며 callback에 들어오면 [Realtime and Quality](realtime-and-quality.md)를 별도 증명한다.

## Dependency admission

1. 필요한 user/product capability와 first-party contract를 먼저 명시한다.
2. 기존 project dependency의 official documentation/type이 이미 지원하는지 확인한다.
3. 직접 구현 대비 전체 복잡성, 유지보수성과 교체 비용을 비교한다.
4. Upstream maintenance, security, platform/compiler support를 조사한다.
5. Direct/transitive dependency, build tool와 generated code를 목록화한다.
6. 원문 license, patent/notice/source 제공과 commercial redistribution을 검토한다.
7. Studio/build tool/core/generated runtime 중 포함 경계를 명시한다.
8. Binary size, startup, memory, performance와 realtime 최소 spike를 수행한다.
9. Adapter와 contract test를 설계한다.
10. Architecture 결정이면 ADR과 승인 scope/version을 기록한 뒤 추가한다.

검증 실패를 임시 direct call, dual implementation 또는 shipping fallback으로 우회하지 않는다.

## 평가와 후보별 spike

공통 기준은 Windows/macOS 지원, MSVC/Apple Clang 및 CMake/Ninja 통합, 유지보수/보안, transitive cost, adapter 격리, package size/performance와 redistribution 적합성이다. Realtime 경로는 allocation/lock/I/O/예외/unbounded work 부재와 prepare 가능성을 instrumented test로 입증한다.

| 후보 | 결정 전 핵심 질문 |
| --- | --- |
| VST3 SDK | no-JUCE adapter, stable class ID, package/validator와 redistribution 조건 |
| Skia/CanvasKit | scene parity, text/SVG/DPI, binary/startup, Studio-only 분리 |
| Yoga | basic auto-layout 적합성, `YGNode` 격리, cross-platform tolerance |
| XYFlow | interaction-only 경계, strict TypeScript와 graph 규모 |
| miniaudio | device lifecycle/callback 안전, generated runtime 제외 |
| KissFFT | 실제 v0.1 요구, prepare/process 분리, precision/license |
| FlatBuffers | 단순 format 대비 이점, evolution/validation, generated-code 비용 |

최신 official documentation, source와 license 원문을 확인하기 전 답을 추정하지 않는다.

## License 정책

### 기본 허용 검토 후보

- MIT, MIT-0, BSD, ISC, zlib, Apache-2.0

목록은 자동 승인이 아니다. Exact version의 license, copyright, patent, transitive dependency와 generated runtime 의무를 확인한다.

### 격리 및 별도 검토

- MPL-2.0, LGPL

File-level copyleft, 수정 source, relinking, static/dynamic linking과 배포 의무를 별도 법률 검토한다. Adapter가 license 의무를 없애지 않는다.

### Generated runtime에서 원칙적으로 제외

- GPL, AGPL
- 출처 또는 license가 불명확한 code
- 상업적 재배포를 제한하는 source-available code

예외를 암묵적으로 만들지 않고 필요하면 사업·법률 영향과 대안을 먼저 결정한다.

저장소 license, Studio license와 generated Runtime redistribution permission은 미결정이다. Phase 0A에서 `LICENSE`를 만들지 않으며 제품 정책 가설을 법적 허가로 표현하지 않는다.

## 배포 경계와 third-party source

Dependency graph는 Studio-only, build/export tool, native core, generated runtime과 development/test 의존성을 분리한다. Studio-only code가 transitive link, asset 또는 generated code로 plugin에 유출되지 않는지 검사한다. Electron, Chromium, Node.js, CanvasKit와 임의 JavaScript runtime은 generated plugin에 포함하지 않는다.

- Upstream 원본은 가능한 한 수정하지 않는다.
- 이름 변경이나 전체 reformat을 하지 않는다.
- 변경은 upstream version과 이유가 있는 작은 patch set으로 관리한다.
- Source/version/integrity와 direct/transitive notice를 target별로 추적한다.
- Obsolete candidate/patch path는 shim 없이 제거한다.

Phase 1A VST3 SDK acquisition에는 recursive Git submodule을 사용한다. 다른 native dependency의
vendor 방식, package manager와 공통 SBOM/checksum/signature/scanner 정책은 계속 미정이다.

## 승인 증거

- 해결 요구와 exact version/source/scope
- Official documentation와 license 원문 검토
- Direct/transitive 목록과 adapter/public API leak 검사
- Target platform build/test와 관련 benchmark
- Generated runtime 포함 여부 및 redistribution/notice 판단
- risk, update/removal 조건과 필요한 ADR 갱신

실행하지 않은 build, benchmark, license/legal review를 통과했다고 기록하지 않는다.

## 현재 미결정과 Open Questions

Phase 0A에서는 dependency를 도입하지 않았다. Phase 1A/1B는 위 exact VST3 SDK와 Windows 기술
spike 범위만 해결했으며 다음 질문을 일반화해 결정하지 않았다.

- 후속 native dependency의 공통 acquisition과 update 정책은 무엇인가?
- Source/binary integrity와 generated package dependency budget은 얼마인가?
- Studio-only/runtime target 분리를 build에서 어떻게 검증할 것인가?
- MPL-2.0/LGPL을 허용할 packaging/legal 조건은 무엇인가?
- White-label generated product의 third-party notice를 어떻게 제공할 것인가?
- 재평가 주기, security response와 upstream abandonment 기준은 무엇인가?
