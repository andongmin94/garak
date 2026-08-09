# ADR 0001 — TypeScript Studio and C++20 Engine

- Status: Accepted
- Date: 2026-08-09
- 관련 문서: [시스템 개요](../architecture/system-overview.md), [모듈 경계](../architecture/module-boundaries.md), [제품 비전](../product/vision.md), [ADR 0002](0002-no-juce-and-adapter-boundaries.md)

## Context

Garak은 서로 다른 제약을 가진 두 제품 계층을 함께 만든다. Garak Studio는 DSP graph, parameter와 macro, interface, preset, asset, metadata와 export workflow를 다루는 Windows/macOS authoring application이다. Native Engine과 생성 플러그인은 실시간 오디오, 예측 가능한 memory와 latency, native plugin ABI와 Studio 없는 독립 실행을 책임진다.

Studio의 제품 개발 생산성과 generated runtime의 realtime·배포 제약을 하나의 언어 또는 UI framework에 억지로 맞추지 않으면서도, 양쪽이 같은 first-party product semantics를 해석하는 기술 기준선이 필요하다. 전체 시스템 경계와 authoring-to-runtime 흐름은 [시스템 개요](../architecture/system-overview.md)가 정의한다.

## Decision

Garak Studio는 다음 stack을 사용한다.

- Electron
- React
- TypeScript strict mode
- Windows와 macOS 공동 지원

Native Engine과 generated plugin runtime은 다음 stack을 사용한다.

- C++20
- CMake
- Ninja
- Windows compiler: MSVC
- macOS compiler: Apple Clang
- 특정 IDE가 아니라 CMake build definition을 기준으로 하는 IDE 독립 구조

Studio의 Electron, Chromium, Node.js와 JavaScript runtime은 authoring 환경에만 속한다. 생성 플러그인은 이 기술들을 포함하거나 설치 요구사항으로 삼지 않는다.

TypeScript와 C++이 공유해야 하는 project, identity, graph, parameter, scene와 compiled runtime 의미는 Garak first-party contract가 소유한다. 이 ADR은 구체적인 serialization schema, generated binding, IPC, process 배치 또는 physical source tree를 선택하지 않는다. 해당 경계 원칙은 [모듈 경계](../architecture/module-boundaries.md)를 따른다.

## Alternatives Considered

### Studio까지 모두 native C++로 구현

Native code만으로 계층 수를 줄일 수 있지만, graph와 interface 중심 authoring product를 구축하는 현재 방향에는 채택하지 않았다. Studio와 runtime이 같은 언어를 사용한다는 사실만으로 product semantics나 preview parity가 자동으로 보장되지는 않는다.

### Native Engine과 생성 플러그인까지 TypeScript 또는 JavaScript로 구현

Studio와 언어를 통일할 수 있지만 native plugin ABI, realtime audio contract와 JavaScript runtime 없는 독립 배포 요구에 맞지 않아 채택하지 않았다.

### IDE별 project를 build 정의의 원본으로 사용

플랫폼별 IDE에 build truth가 나뉘고 재현 가능한 command-line build가 어려워지므로 채택하지 않았다. IDE는 CMake project를 소비할 수 있지만 architecture의 원본은 아니다.

### 하나의 광범위한 cross-platform framework로 Studio와 plugin을 통합

Garak은 JUCE를 사용하지 않으며 외부 implementation을 adapter 뒤에 격리한다. 이 결정의 근거와 범위는 [ADR 0002](0002-no-juce-and-adapter-boundaries.md)가 정의한다.

## Consequences

긍정적인 결과:

- Studio와 realtime runtime을 각 요구에 적합한 생태계에서 발전시킬 수 있다.
- CMake/Ninja가 MSVC와 Apple Clang build의 공통 진입점이 된다.
- Generated plugin의 설치와 실행이 Studio 기술 stack으로부터 독립된다.
- Studio UI 변경이 native runtime public contract를 직접 변경하지 않도록 경계를 세울 수 있다.

비용과 리스크:

- TypeScript와 C++ 사이에 versioned data contract와 conformance 검증이 필요하다.
- Windows와 macOS의 두 compiler/toolchain을 유지해야 한다.
- Studio preview와 native runtime의 sound, scene와 layout 의미가 일치하는지 별도 검증해야 한다.
- Electron, React와 TypeScript를 선택했다는 사실은 process topology, schema technology 또는 preview backend가 결정됐다는 뜻이 아니다.

## Follow-up and Validation

Phase 0B의 별도 ExecPlan에서 다음 최소 증거를 만든다.

- TypeScript strict mode가 실제로 활성화된 최소 Studio shell
- C++20 core library와 native smoke executable
- CMake/Ninja를 통한 build entry point
- Windows/MSVC와 macOS/Apple Clang에서 같은 source/build contract를 사용하는 검증
- IDE 생성 파일 없이 재현 가능한 command-line build
- Studio dependency가 native generated runtime dependency graph에 유입되지 않는 구조

Project schema와 TypeScript/C++ binding 방식, Studio/native process 경계와 preview implementation은 후속 spike 또는 ADR에서 결정한다.

Phase 0A에서는 source scaffold, compiler 실행, dependency 설치 또는 양 플랫폼 build를 수행하지 않았다. 따라서 이 ADR의 `Accepted` 상태는 기술 방향의 승인만 뜻하며 구현 또는 build 검증 완료를 뜻하지 않는다.
