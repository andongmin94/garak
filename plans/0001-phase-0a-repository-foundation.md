# ExecPlan 0001 — Phase 0A Repository Foundation and Specification Freeze

- Status: Complete
- Started: 2026-08-09
- Updated: 2026-08-09
- Owner: Garak project

## 목적

Garak의 제품 정의, v0.1 범위, 핵심 아키텍처 원칙과 저장소 운영 규칙을 문서로 고정한다. 이후 구현 작업이 검증된 결정과 명시적인 미결정 사항을 구분해 작은 단계로 진행되도록 기준선을 만든다.

## 사용자 가치

아티스트가 자신의 사운드, 컨트롤 언어, 인터페이스와 브랜드를 독립적인 오디오 플러그인 제품으로 출시한다는 목표를 팀이 같은 의미로 이해하게 한다. 구현 전에 범위와 장기 호환성 계약을 분명히 하여 사용자 프로젝트, 프리셋, DAW 상태와 출시 제품을 불필요한 재작업으로부터 보호한다.

## 현재 저장소 상태

2026-08-09 조사 시 작업 루트에는 기존 파일이 없었고 Git 저장소가 아니었다. 보존할 사용자 변경사항은 발견되지 않았다. 요구사항이 허용한 범위에서 빈 저장소에 `git init`만 수행했으며 커밋은 만들지 않았다.

## 범위

- 제품 비전, 대상 사용자, 사용 사례와 v0.1 PRD 문서화
- 시스템 구성 요소, 모듈 경계, 프로젝트 모델, 런타임·내보내기, 실시간 품질, 파라미터·상태, 인터페이스 디자이너, 의존성 정책 문서화
- 확정 기술 결정과 제안 상태의 generated runtime 전략을 ADR로 기록
- 저장소 헌법인 `AGENTS.md`와 장기 작업 계획 규약인 `PLANS.md` 작성
- Phase 0A부터 Phase 8까지의 단계별 로드맵 작성
- 현재 상태와 다음 작업을 사실대로 기록
- Markdown 파일 경로, 상대 링크, 용어와 결정의 일관성 검증

## 비범위

- C++, CMake, Electron, React 또는 TypeScript scaffold와 제품 코드
- VST3, DSP, `.garak` parser, plugin UI 또는 export 구현
- SDK나 패키지 다운로드, 외부 의존성 설치 또는 통합
- CI, cloud backend, telemetry, DRM 또는 marketplace
- 저장소 라이선스나 완성된 법률 약관 확정
- Phase 0B 이후 작업의 선행 구현

## 전제와 제약

- Studio 기술 방향은 Electron, React, TypeScript strict mode이다.
- Native Engine은 C++20, CMake, Ninja를 사용하며 JUCE를 사용하지 않는다.
- Windows와 macOS를 공동 목표로 하되 기술 검증은 Windows x64 VST3부터 진행한다.
- 생성 플러그인은 Studio 없이 오프라인 동작하며 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 포함하지 않는다.
- first-party 모델과 API는 third-party 타입으로부터 분리한다.
- 실시간 audio process callback에서는 할당, blocking, I/O, parsing, GUI 호출, 파일 로그, 예외 전파와 그래프 구조 변경을 금지한다.
- 현재 단계에서는 외부 라이브러리의 실제 적합성이나 라이선스 세부 조건을 검증한 것으로 간주하지 않는다.
- 현재 사용자 지시와 저장소 문서 사이에 충돌이 있으면 사용자 지시를 우선하며 충돌을 명시한다.

## 설계 결정

- 제품의 편집 표현인 `.garak` project와 생성 플러그인의 실행 표현을 분리한다.
- product ID, plugin class ID, parameter numeric ID와 DSP node implementation version은 장기 호환성 계약으로 취급한다.
- 외부 라이브러리는 adapter 뒤에 격리하고 해당 타입을 Garak public API에 노출하지 않는다.
- 불필요한 내부 compatibility shim이나 obsolete code path를 보존하지 않는 개발 원칙과, 이미 출시된 product/project/parameter/preset/DAW state의 영속 호환 계약을 구분한다. 후자는 명시적 schema migration으로 지킨다.
- generated plugin runtime 패키징 방식은 결정하지 않는다. 범용 prebuilt runtime에 compiled data를 삽입하는 방식과 제품별 thin wrapper를 생성해 공통 runtime에 링크하는 방식을 VST3 기술 스파이크에서 비교한다.
- 첫 수직 reference product는 `ANDONGMIN — BLOOM`으로 고정하되 Phase 0A에서는 구현하지 않는다.
- 요청된 문서 구조를 그대로 사용한다. 추가 최상위 구조는 이 단계에 필요하지 않다.

## 구현 또는 문서화 단계

1. [x] 작업 디렉터리, 기존 파일과 Git 상태를 조사한다.
2. [x] 비어 있는 작업 루트에 Git 저장소를 초기화한다.
3. [x] 본 ExecPlan을 작성하고 조사 결과와 제약을 기록한다.
4. [x] 제품 비전, 사용자·사용 사례와 v0.1 PRD를 작성한다.
5. [x] 핵심 아키텍처 문서를 작성한다.
6. [x] 네 개의 ADR을 작성하고 Accepted와 Proposed 결정을 구분한다.
7. [x] `AGENTS.md`와 `PLANS.md`를 작성한다.
8. [x] 현재 사실만 반영한 `README.md`와 단계별 `ROADMAP.md`를 작성한다.
9. [x] 문서 간 용어, 범위, 링크와 결정 상태를 검토한다.
10. [x] `docs/status/current.md`를 최종 상태로 갱신한다.
11. [x] `git diff --check`, 내부 링크 검사와 생성 파일 목록 검사를 수행한다.
12. [x] 검증 결과, 발견 사항, 의사결정 로그와 완료 기록을 갱신한다.

## 변경 대상 파일

- `/AGENTS.md`
- `/PLANS.md`
- `/README.md`
- `/ROADMAP.md`
- `/.editorconfig`
- `/.gitignore`
- `/.gitattributes`
- `/docs/product/vision.md`
- `/docs/product/users-and-use-cases.md`
- `/docs/product/v0.1-prd.md`
- `/docs/architecture/system-overview.md`
- `/docs/architecture/module-boundaries.md`
- `/docs/architecture/project-model.md`
- `/docs/architecture/runtime-and-export.md`
- `/docs/architecture/realtime-and-quality.md`
- `/docs/architecture/parameter-and-state.md`
- `/docs/architecture/interface-designer.md`
- `/docs/architecture/dependency-policy.md`
- `/docs/adr/0001-typescript-studio-and-cpp20-engine.md`
- `/docs/adr/0002-no-juce-and-adapter-boundaries.md`
- `/docs/adr/0003-generated-plugin-runtime-strategy.md`
- `/docs/adr/0004-windows-macos-and-plugin-formats.md`
- `/docs/status/current.md`
- `/plans/0001-phase-0a-repository-foundation.md`

## 검증 계획

- `git diff --check`로 whitespace 오류를 검사한다.
- 저장소의 추적 대상 파일 목록과 요구 구조를 비교한다.
- Markdown 상대 링크의 대상 파일과 anchor가 존재하는지 검사한다.
- 금지된 구현 파일과 패키지·빌드 설정이 추가되지 않았는지 검사한다.
- ADR 상태, 기술 스택, 플랫폼·format 순서, v0.1 범위와 BLOOM 정의가 문서 사이에서 일치하는지 검색하고 수동 검토한다.
- 실행 가능한 코드가 없는 단계이므로 build나 test 명령을 허위로 만들거나 통과했다고 보고하지 않는다.

## 수용 기준

- 요구된 저장소 정책, 계획, 제품, 아키텍처, ADR, 로드맵과 상태 문서가 모두 존재한다.
- 확정 결정은 Accepted ADR로, 미검증 runtime 전략은 두 대안을 포함한 Proposed ADR로 기록된다.
- v0.1 포함 범위와 비범위, 실시간 규칙, 장기 ID·version·migration 정책, 의존성·라이선스 정책이 명확하다.
- `ANDONGMIN — BLOOM`이 첫 reference product와 수직 검증 범위로 기록된다.
- 실제 구현 코드, 외부 의존성, LICENSE와 Phase 0B 이후 산출물이 없다.
- 기존 사용자 파일이 손상되지 않고 검증 결과가 사실대로 기록된다.

## 리스크

- VST3 adapter와 생성 runtime 패키징 방식은 SDK 기술 스파이크 전에는 ABI, class registration, bundle packaging과 validator 제약을 확정할 수 없다.
- native UI와 Studio preview의 시각적·layout parity는 Skia/CanvasKit/Yoga 후보 검증이 필요하다.
- Windows/macOS 간 plugin ID 표현, universal binary, code signing, notarization과 AU packaging 정책이 미정이다.
- schema migration 범위와 호환성 지원 기간은 실제 project/state 사례 없이 과도하게 약속할 수 없다.
- white-label 재배포, runtime 라이선스, 상표, third-party notices와 판매 권한은 법률 검토 전 제품 정책 가설에 불과하다.
- 오디오 품질 목표를 수치화할 benchmark, reference audio, 허용 latency/CPU 기준은 후속 품질 계획에서 정해야 한다.

## Open Questions

- generated plugin이 runtime data를 어떤 container와 서명 가능한 위치에 보관할 것인가?
- compiled runtime data에 FlatBuffers가 적합한가, 아니면 더 단순한 versioned binary format이 필요한가?
- Studio preview와 native plugin renderer가 공유할 scene/layout 의미론의 최소 공통 집합은 무엇인가?
- v0.1의 preset 교환 형식, asset embedding 한계와 backward-compatibility 지원 정책은 어디까지인가?
- Garak Studio 라이선스와 runtime 재배포 권한을 어떤 법적 문서로 부여할 것인가?

## 발견 사항

- 2026-08-09: 작업 루트는 완전히 비어 있었고 `.git`도 없었다.
- 2026-08-09: 기존 파일이나 보존할 사용자 변경사항이 없어 요청된 문서 구조를 충돌 없이 만들 수 있다.
- 2026-08-09: 모든 문서가 새 untracked 파일이므로 `git diff --check`만으로는 whitespace를 충분히 검사할 수 없다. 별도 전 파일 whitespace 검사를 함께 수행해야 한다.
- 2026-08-09: obsolete 내부 경로 제거 원칙과 출시된 영속 데이터 호환 계약은 적용 대상이 다르므로 문서에서 명시적으로 분리해야 한다.
- 2026-08-09: Compiled runtime blob은 source project에서 재생성 가능한 derived artifact이므로 project/preset/DAW state와 같은 영구 migration 대상으로 확정할 수 없다. Contract version과 mismatch 검출만 고정하고 migrate/rebuild/reject 정책은 미결정으로 유지했다.
- 2026-08-09: Accessibility는 v0.1의 승인된 범위에 없으므로 hard acceptance gate가 아니라 Open Question으로 유지했다.
- 2026-08-09: Closeout 뒤 축약해 다시 쓴 PowerShell link checker 한 번이 경로 결합 구문 오류로 대상 검증 전에 실패했다. 파일 변경은 없었고 검증된 원래 script를 다시 실행해 Markdown 21개, local link 177개, broken link 0과 exit 0을 확인했다.

## 의사결정 로그

- 2026-08-09: 빈 작업 루트에 `git init`을 수행했다. 저장소 구조나 사용자 파일은 변경하지 않았고 커밋은 만들지 않았다.
- 2026-08-09: Phase 0A에서는 요청된 문서 구조를 유지하고 추가 문서 계층이나 구현 scaffold를 만들지 않기로 했다.
- 2026-08-09: 기술 후보는 의존성으로 확정하지 않고 후속 spike 대상으로만 기록한다.
- 2026-08-09: Realtime adapter의 zero-copy나 host error 정책을 미리 확정하지 않고 bounded copy와 format별 fail-safe/status를 후속 검증 대상으로 유지한다.
- 2026-08-09: 필수 파일, 링크, text format, ADR/roadmap 구조, 금지 산출물과 요구 내용 검사가 모두 통과하여 Phase 0A를 PASS로 마감했다.

## 완료 기록

2026-08-09에 Phase 0A를 **PASS**로 완료했다. 비어 있고 Git이 아니던 작업 루트에 Git을 초기화하고 요청된 24개 문서·정책 파일을 정확히 생성했다. 기존 사용자 파일이나 변경사항은 없었으며 C++, CMake, Electron package, DSP, plugin, UI 코드, 외부 SDK/dependency와 `LICENSE`는 추가하지 않았다.

검증 결과는 다음과 같다.

- `git status --short --branch`: commit이 없는 `master`, Phase 0A 파일은 모두 untracked
- `git diff --check`: exit 0. Untracked 파일은 검사하지 않는 한계가 있어 별도 raw-file 검사로 보완
- 필수/실제 파일: 24/24, 누락 0, 예상 외 0
- Markdown: 21개, local relative link 177개, 깨진 링크 0
- Text: 24개, trailing whitespace·tab·final newline·CRLF·UTF-8·BOM 오류 모두 0
- ADR: Accepted 3개, Proposed 1개
- ROADMAP: Phase 10개, 각 필수 subsection 4종이 phase마다 1개
- 요구 내용 검사: 16개 group 모두 통과
- 금지 source/build/package/vendor/binary/CI/license 파일·디렉터리: 0

구현물이 없는 단계이므로 native/Studio build, compiler, VST3/AU validator, DAW host, realtime, DSP/audio와 UI parity 검증은 수행하지 않았고 통과로 보고하지 않는다. 상세 결과와 미결정 사항은 [현재 상태](../docs/status/current.md)에 기록했다.

## 다음 단계

Phase 0A가 수용 기준을 충족한 뒤에만 Phase 0B ExecPlan을 새로 작성한다. Phase 0B는 buildable native/Studio scaffold, native smoke executable과 tests, 그리고 Studio workspace placeholder까지만 다루며 VST3나 DSP 기능을 선행 구현하지 않는다.
