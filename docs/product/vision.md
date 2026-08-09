# Garak Product Vision

- 문서 상태: Phase 0A 기준선
- 최종 갱신: 2026-08-09
- 관련 문서: [사용자와 사용 사례](users-and-use-cases.md), [v0.1 제품 요구사항](v0.1-prd.md)

## 한 문장 정의

Garak(가락)은 음악가, 프로듀서와 사운드 디자이너가 자신의 사운드 컬러와 작업 방식을 설계하고, 자신의 이름과 브랜드를 건 독립적인 오디오 플러그인 제품으로 출시할 수 있게 하는 오디오 제품 제작 플랫폼이다.

## 우리가 해결하려는 문제

아티스트의 음향적 취향은 보통 세션, 플러그인 체인, 개인적인 수치와 설명하기 어려운 판단에 흩어져 있다. 이를 다른 사람이 반복해서 사용할 수 있는 완결된 제품으로 바꾸려면 실시간 DSP, 플러그인 포맷, automation, state, UI runtime, 검증과 패키징에 관한 전문 엔지니어링이 필요하다. 그 결과, 분명한 사운드 정체성을 가진 아티스트도 자신의 아이디어를 독립적인 플러그인으로 만들기 어렵다.

사진가가 자신의 색감을 Lightroom preset으로, 영상 제작자가 자신의 컬러를 LUT로 표현하듯, Garak은 아티스트가 음향적 취향과 판단을 재사용 가능한 오디오 제품으로 표현하게 한다.

## 제품 약속

Garak의 핵심 가치는 단순히 “코딩 없이 VST를 만든다”는 데 있지 않다. 아티스트가 다음 제품 결정을 직접 내릴 수 있게 하는 것이 핵심이다.

- 어떤 소리가 나고 어떤 음향적 캐릭터를 가져야 하는가
- 사용자가 어떤 단어와 공개 컨트롤로 그 소리를 다루는가
- 여러 내부 파라미터가 어떤 관계와 곡선으로 움직이는가
- 어떤 시각적 정체성과 브랜드를 갖는가
- 어떤 preset과 기본 경험을 제공하는가

Garak Engine은 그 의도를 실제 제품으로 만드는 공학적 복잡성을 맡는다.

- 실시간 오디오 처리와 DSP graph 실행
- parameter smoothing과 automation
- audio buffer와 latency 관리
- project, state와 preset의 저장 및 호환성
- native plugin UI runtime
- VST3와 AU format 연결
- 제품 검증, 패키징과 export

## 제품을 이루는 세 층

### Garak Studio

아티스트가 Sound, Control, Interface와 Product를 편집하는 Windows/macOS 제작 환경이다. DSP graph, 공개 parameter와 macro mapping, plugin interface, preset, asset과 product metadata를 하나의 제품 의도로 구성하고 실제 음원으로 audition한다.

### Garak Engine

Studio에서 만든 제품 의도를 검증하고 실행 가능한 표현으로 compile하며, 실시간 오디오 처리, parameter/state 계약과 native UI 동작을 제공하는 first-party engine이다. 외부 SDK와 rendering/layout library는 Engine의 공개 모델이 아니라 adapter 뒤의 구현 세부 사항으로 유지한다.

### 생성된 플러그인 제품

Studio project의 편집기를 배포하는 것이 아니라, 특정 제품에 필요한 runtime data, DSP, UI, metadata와 preset을 포함한 독립적인 native 플러그인을 배포한다. 생성 플러그인은 다음 성질을 갖는다.

- Garak Studio가 설치되지 않은 컴퓨터에서 오프라인 동작한다.
- Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 포함하지 않는다.
- 사용자 제품의 이름, 시각 정체성과 artist identity를 전면에 둔다.
- 제품 화면에 “Made with Garak” 표시를 강제하지 않는 white-label 방향을 따른다.

## 제품 원칙

### 아티스트의 언어가 인터페이스가 된다

내부 DSP 파라미터를 그대로 노출하는 대신 Bloom, Warmth, Softness와 같이 아티스트가 의도한 언어와 관계로 재해석할 수 있어야 한다. 하나의 macro가 여러 내부 파라미터를 서로 다른 범위와 곡선으로 움직이는 것은 핵심 제품 능력이다.

### 제작 도구가 아니라 완결된 제품을 만든다

성공의 단위는 graph나 mockup이 아니라 DAW에서 로드되고, automation과 state restore가 작동하며, 다른 컴퓨터에서도 독립 실행되는 브랜드 제품이다.

### preview와 export 사이의 의미를 보존한다

Studio에서 들리고 보인 결과와 생성 플러그인에서 들리고 보인 결과가 같은 project model과 runtime contract를 따라야 한다. 완전한 parity 기준과 측정 방법은 후속 기술 검증에서 정한다.

### 출시된 제품의 정체성을 장기 계약으로 취급한다

product ID, plugin class ID와 출시된 parameter numeric ID는 영구 식별자이다. 삭제된 parameter ID는 재사용하지 않고, 소리가 달라지는 DSP node 변경은 기존 implementation version을 덮어쓰지 않는다. Project, preset과 DAW state에는 version과 migration 체계를 둔다.

### 플러그인 제작에 집중한다

Interface Designer는 장기적으로 높은 수준의 제품 디자인 경험을 지향하지만 범용 웹디자인 도구나 Figma 복제본이 아니다. v0.1은 오디오 플러그인에 필요한 scene, control, binding과 native rendering에 집중한다.

### 제품 가치는 네트워크 연결에 의존하지 않는다

핵심 authoring과 생성 결과물은 cloud collaboration, marketplace, telemetry, DRM 또는 license server를 전제로 설계하지 않는다. v0.1 생성 플러그인의 오디오 처리와 기본 사용은 오프라인이어야 한다.

## 만들 수 있는 제품의 중심 범주

v0.1은 mono/stereo audio effect 중 다음과 같은 아티스트 시그니처 제품에 집중한다.

- signature channel strip
- vocal 또는 instrument color effect
- saturation, bloom, glue, warmth, air, softness 또는 density 계열 effect
- 복잡한 내부 DSP를 소수의 감각적인 macro로 다루는 제품

Synthesizer, sampler와 모든 종류의 플러그인을 만드는 범용 언어는 이 비전의 첫 제품 범위가 아니다. 전체 v0.1 포함 범위와 명시적 비범위는 [v0.1 제품 요구사항](v0.1-prd.md)을 기준으로 한다.

## 첫 reference product: ANDONGMIN — BLOOM

`ANDONGMIN — BLOOM`은 보컬 또는 악기에 따뜻함, 밀도와 부드러움을 부여하는 아티스트 시그니처 컬러 플러그인이다. Garak이 추구하는 전체 수직 경로를 구체적인 한 제품으로 검증한다.

- sound graph
- macro mapping
- interface design
- parameter automation
- preset과 state restore
- product metadata
- independent plugin export

Bloom, Warmth, Softness, Mix와 Output을 공개 컨트롤의 기준안으로 사용한다. 내부 처리 개념과 정확한 음향 목표는 [v0.1 제품 요구사항](v0.1-prd.md)에 기록하며, Phase 0A에서는 DSP나 UI를 구현하거나 그 알고리즘을 확정하지 않는다.

## 성공의 모습

Garak이 성공하면 아티스트는 자신의 음악적 판단을 다음 세 가지 층에서 일관되게 소유하고 표현할 수 있다.

1. 사운드: graph와 macro가 의도한 음향적 캐릭터를 만든다.
2. 경험: control language, interface와 preset이 그 캐릭터를 이해하기 쉽게 전달한다.
3. 제품: 독립적인 native plugin이 아티스트의 이름으로 배포되고 Studio 없이 작동한다.

v0.1의 제품 증명은 기능 수가 아니라 `ANDONGMIN — BLOOM`을 포함한 한 제품이 authoring부터 실제 DAW 사용과 독립 export까지 끊기지 않고 완주하는지로 판단한다. 정량적인 CPU, latency, audio quality와 preview parity 기준은 구현 전에 별도의 품질 계획에서 수치화해야 한다.

## 사업 원칙의 현재 지위

사용자 창작물 소유, 생성 플러그인 판매, 지속 royalty 부재, runtime 재배포와 white-label에 관한 방향은 현시점의 **제품 및 사업 정책 가설**이다. 이는 이용약관, 라이선스 계약, 지식재산권 판단 또는 법률 자문이 아니며 권리를 부여하거나 보증하지 않는다. 구체적인 정책 가설과 미결정 사항은 [v0.1 제품 요구사항](v0.1-prd.md)의 “사업 정책 가설”을 기준으로 한다.

## Phase 0A의 Open Questions

- 아티스트가 전문 DSP 엔지니어의 도움 없이도 유용한 graph를 안전하게 만들 수 있게 하는 최소 guardrail은 무엇인가?
- Studio preview와 생성된 native plugin 사이의 음향·시각 parity를 어떤 reference project와 허용 오차로 검증할 것인가?
- v0.1의 “판매 가능한 제품”에 필요한 packaging, signing, notarization과 사용자 지원 경계는 어디까지인가?
- 아티스트가 만든 project와 Garak Runtime의 권리를 구분하고 재배포를 허용할 구체적인 라이선스 문서는 무엇인가?
- 첫 출시에서 지원할 DAW와 OS의 최소 버전, CPU/latency 예산과 접근성 기준은 무엇인가?

