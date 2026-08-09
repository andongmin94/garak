# Garak Users and Use Cases

- 문서 상태: Phase 0A 기준선
- 최종 갱신: 2026-08-09
- 관련 문서: [제품 비전](vision.md), [v0.1 제품 요구사항](v0.1-prd.md)

## 사용자 모델

Garak의 1차 사용자는 자신의 음향적 취향을 제품으로 정의하고 싶은 음악가, 프로듀서와 사운드 디자이너이다. 이들은 모두 프로그래머이거나 DSP 엔지니어일 필요는 없지만, 원하는 소리를 듣고 비교하며 공개 control과 preset을 판단할 수 있는 창작자이다.

하나의 사용자가 모든 역할을 맡을 수도 있고, 작은 팀이 역할을 나눌 수도 있다. v0.1은 cloud collaboration이나 권한 관리가 아닌 한 대의 Studio와 명시적으로 주고받는 project file을 전제로 한다.

## 핵심 사용자와 가치

### 아티스트 겸 제품 오너

자신의 이름과 음악적 정체성을 제품의 기준으로 삼는다. “무슨 알고리즘을 썼는가”보다 “어떤 느낌을 누구에게 어떤 언어로 전달할 것인가”를 결정한다.

필요한 가치:

- 반복해서 사용하는 개인 chain과 판단을 하나의 제품으로 구조화한다.
- 제품명, 공개 control, 기본값, preset과 visual identity를 직접 정한다.
- Garak 브랜드가 강제되지 않는 독립적인 제품으로 export하고 배포한다.
- 출시 후에도 automation과 기존 session을 깨뜨리지 않고 제품을 발전시킨다.

### 프로듀서 또는 사운드 디자이너

음원과 처리 결과를 비교하며 DSP graph, 내부 parameter 범위와 macro 관계를 설계하는 실무 사용자이다. 아티스트 겸 제품 오너와 같은 사람일 수 있다.

필요한 가치:

- typed DSP building block을 연결하고 잘못된 graph를 export 전에 발견한다.
- 하나의 macro로 여러 내부 parameter를 의도한 범위와 곡선에 따라 움직인다.
- 실제 vocal, instrument와 mix material로 빠르게 audition한다.
- preset과 default state로 재현 가능한 결과를 저장한다.

### 인터페이스와 브랜드를 다루는 제작자

플러그인의 시각 언어와 조작 경험을 만든다. 전문 디자이너일 수도 있고 아티스트 본인일 수도 있다.

필요한 가치:

- plugin-focused canvas에서 layout, type, image, SVG와 visual style을 구성한다.
- knob, slider, toggle, meter와 preset menu를 parameter 또는 macro에 bind한다.
- Studio preview와 native exported UI 사이에서 핵심 layout과 behavior가 유지되는지 확인한다.
- 사용자 제품의 asset과 identity를 보존하고 필수 Garak branding 없이 내보낸다.

### 생성 플러그인의 최종 사용자

Studio를 사용하지 않고 완성된 플러그인을 DAW에서 사용하는 음악가와 엔지니어이다. Garak의 직접 authoring 고객과 다를 수 있지만, 이 사용자의 경험이 생성 제품의 품질 경계를 결정한다.

필요한 가치:

- 설치된 플러그인을 일반적인 native effect처럼 로드하고 오프라인으로 사용한다.
- 공개 control의 의미를 이해하고 automation할 수 있다.
- session을 다시 열었을 때 state와 preset이 복원된다.
- Garak Studio, Electron 또는 별도 runtime 설치를 요구받지 않는다.

## 핵심 Jobs to Be Done

- 내 시그니처 sound chain을 다른 사람도 일관되게 사용할 수 있게 만들고 싶을 때, 음향 의도와 허용 범위를 graph와 macro로 캡슐화하고 싶다.
- 내부 DSP가 복잡하더라도 제품 사용자는 소수의 음악적인 단어로 결과를 조절하게 하고 싶을 때, 하나의 control을 여러 parameter와 curve에 mapping하고 싶다.
- 내 이름을 건 오디오 제품을 출시하고 싶을 때, sound, interface, preset과 metadata를 한 project에서 완성해 독립적인 native plugin으로 export하고 싶다.
- 제품을 업데이트하고 싶을 때, 기존 parameter automation, preset과 DAW state를 깨뜨리지 않는 명시적인 identity와 version 규칙을 따르고 싶다.
- 실제 녹음에서 아이디어를 평가하고 싶을 때, export를 반복하기 전에 Studio에서 reference audio로 처리 결과를 audition하고 싶다.

## v0.1 대표 사용 사례

### UC-01 — 시그니처 컬러 이펙트 만들기

아티스트는 saturation, gentle dynamics, tone shaping과 output compensation 같은 processing block을 조합해 vocal 또는 instrument에 warmth, air, softness, density나 glue를 부여하는 mono/stereo effect를 만든다.

완료 신호:

- 지원되는 node와 connection만으로 유효한 static DSP graph가 구성된다.
- 실제 음원을 처리해 bypass/original과 비교할 수 있다.
- export된 플러그인에서도 의도한 graph가 같은 제품 정의를 따라 실행된다.

### UC-02 — 아티스트 시그니처 채널 스트립 만들기

프로듀서는 여러 처리 단계를 한 제품에 구성하고, 기술적인 내부 값 대신 아티스트의 작업 순서를 반영한 공개 control과 preset을 제공한다.

완료 신호:

- 입력부터 출력까지 명시적인 처리 경로가 있다.
- 공개 control과 내부 parameter의 관계, range, default와 curve가 저장된다.
- mono/stereo effect로 host에서 동작하며 instrument 생성 기능을 요구하지 않는다.

### UC-03 — 복잡한 DSP를 감각적인 macro로 재해석하기

제작자는 `Bloom` 같은 하나의 macro가 compression, saturation, tone과 compensation을 서로 다른 비율과 curve로 움직이게 한다. 최종 사용자는 내부 parameter를 알지 않아도 제품의 의도를 탐색한다.

완료 신호:

- 하나의 macro가 하나 이상의 내부 parameter에 mapping된다.
- mapping range와 curve가 project에 명시적으로 저장된다.
- smoothing과 host automation이 실시간 안전 규칙을 깨뜨리지 않는다.

### UC-04 — 브랜드에 맞는 plugin interface 만들기

제작자는 frame/group, layer, shape, text, image/SVG, fill/stroke/gradient/shadow와 기본 layout 도구로 화면을 구성한다. 재사용 가능한 control을 만들고 parameter, macro 또는 meter에 bind한다.

완료 신호:

- 인터페이스의 scene과 binding이 product project에 저장된다.
- knob, slider, toggle, meter와 preset menu 중 제품에 필요한 요소를 구성할 수 있다.
- 생성 플러그인에 필수 Garak badge나 문구가 삽입되지 않는다.

### UC-05 — 실제 음원으로 반복 audition하기

아티스트는 자신이 선택한 vocal, instrument 또는 mix material을 재생하며 graph, macro, default와 preset을 조정한다.

완료 신호:

- Studio에서 실제 audio material을 입력으로 사용해 처리 결과를 들을 수 있다.
- 변경한 sound/control 정의가 preview에 반영된다.
- preview와 exported runtime의 parity를 검증할 수 있는 경로가 있다. 정확한 허용 오차는 후속 품질 계획에서 정한다.

### UC-06 — preset과 기본 경험 만들기

아티스트는 제품의 출발점을 나타내는 default state와 대표 사용 맥락을 설명하는 preset을 만든다.

완료 신호:

- preset이 공개 parameter와 macro state를 재현한다.
- 저장, 불러오기와 host state restore 후 같은 제품 상태를 얻는다.
- schema와 node version 차이가 있는 상태는 명시적인 migration 정책으로 처리된다.

### UC-07 — 독립적인 white-label 제품으로 export하기

제품 오너는 product name, artist identity, stable IDs, preset과 asset을 포함해 native plugin package를 만든다. 이 결과물을 Garak Studio가 없는 시스템에 설치해 검증하고 판매 또는 배포할 수 있는 상태를 목표로 한다.

완료 신호:

- Windows x64 VST3, macOS Universal VST3와 macOS AU가 정해진 검증 순서에 따라 생성된다.
- 플러그인의 기본 오디오 처리와 UI는 오프라인에서 작동한다.
- 생성물 안에 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime이 없다.
- 제품 화면에 Garak branding을 강제하지 않는다.

판매와 runtime 재배포 권한은 현재 제품 정책 가설이며, 실제 권한은 향후 확정될 라이선스 계약과 사용자가 포함한 third-party material의 권리에 따른다.

### UC-08 — 출시 제품의 session 호환성 유지하기

제품 오너는 제품의 sound나 preset을 발전시키되 기존 사용자의 automation과 session을 불필요하게 깨뜨리지 않는다.

완료 신호:

- product ID와 plugin class ID가 유지된다.
- 출시된 parameter numeric ID는 변경하거나 재사용하지 않는다.
- 소리가 달라지는 node implementation은 새 version으로 추가된다.
- project, preset과 DAW state의 schema version 및 migration 결과를 검증할 수 있다.

## 대표 end-to-end 여정

1. 제품 오너가 제품명, artist identity와 target sound를 정의한다.
2. 제작자가 static DSP graph를 만들고 실제 음원으로 audition한다.
3. 내부 parameter를 공개 parameter와 macro에 mapping하고 range, curve와 default를 조정한다.
4. 인터페이스를 디자인하고 control/meter binding을 연결한다.
5. preset, asset와 product metadata를 완성한다.
6. project validation으로 graph, identity, binding과 packaging 오류를 확인한다.
7. 지원 format으로 export하고 Studio가 없는 깨끗한 환경과 실제 DAW에서 검증한다.
8. 기존 state/automation 계약을 보존하며 제품 version을 발전시킨다.

## v0.1에서 의도적으로 지원하지 않는 사용자 요구

- oscillator, note event와 polyphony가 필요한 synthesizer 제작
- sample library를 포함하는 sampler 또는 polyphonic instrument 제작
- pitch correction이나 convolution 제품 제작
- 외부 VST를 내부에 host하거나 재패키징하기
- AI가 sound, graph와 UI를 자동으로 결정하게 하기
- cloud workspace, marketplace 또는 실시간 공동 편집으로 팀을 운영하기
- third-party developer가 새로운 node를 배포하는 SDK 사용
- mobile 또는 AAX 제품 export
- DRM 또는 license server로 최종 고객의 사용 권한 관리
- Figma 파일을 완전히 import/export하거나 범용 웹사이트를 디자인하기

이는 사용자의 가치가 없다는 판단이 아니라 v0.1의 검증 초점을 지키기 위한 범위 경계이다.

## 사용자·시장 가설

다음은 Phase 0A에서 검증되지 않은 제품 가설이다.

- 사운드 정체성이 분명한 아티스트는 완전한 DSP 자유도보다 안전한 building block과 표현력 있는 macro를 선호할 수 있다.
- 최종 고객은 Garak이라는 제작 도구보다 아티스트의 이름, sound와 간결한 control language에 가치를 둘 수 있다.
- white-label과 지속 매출 royalty가 없는 방향은 제품 오너가 Garak을 채택하는 중요한 이유가 될 수 있다.
- 실제 음원 audition과 exported plugin parity는 단순한 graph 편집보다 신뢰 형성에 더 중요할 수 있다.
- 한 사람 또는 작은 팀의 local workflow만으로도 첫 reference product를 완성할 수 있다.

이 가설은 사용자 조사, prototype test와 사업·법률 검토를 거쳐 유지, 수정 또는 폐기해야 한다.

## Open Questions

- 첫 사용자가 graph를 이해하고 안전하게 완주하는 데 필요한 template, guardrail와 교육 수준은 무엇인가?
- primary adopter는 solo artist, producer-led studio, sound designer 또는 기존 plugin brand 중 누구인가?
- 한 제품을 여러 역할이 함께 만들 때 v0.1의 file handoff만으로 충분한가?
- 최종 plugin 사용자가 기대하는 preset 탐색, resize, accessibility와 localization의 최소 기준은 무엇인가?
- “preview와 export가 같다”는 신뢰를 사용자에게 어떤 비교 도구와 품질 지표로 보여줄 것인가?
- 사용자가 직접 제작한 asset, font, sample과 third-party material의 권리를 export 전에 어떻게 확인하게 할 것인가?

