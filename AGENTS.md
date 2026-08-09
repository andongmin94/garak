# Garak Repository Constitution

이 문서는 이 저장소에서 작업하는 모든 사람과 Codex agent가 따라야 하는 지속 규칙이다. 세부 제품 범위는 [v0.1 PRD](docs/product/v0.1-prd.md), 전체 구조는 [System Overview](docs/architecture/system-overview.md), 현재 상태는 [Current Status](docs/status/current.md)를 기준으로 한다.

## 제품 미션

Garak(가락)은 음악가, 프로듀서와 사운드 디자이너가 자신의 사운드 컬러, 음향적 판단, control language, interface와 브랜드를 설계해 자신의 이름을 건 독립적인 오디오 플러그인 제품으로 출시할 수 있게 하는 오디오 제품 제작 플랫폼이다. Garak은 단순한 no-code VST builder가 아니라 아티스트의 의도를 제품 계약으로 만들며, 생성 플러그인은 Studio가 없는 컴퓨터에서도 독립적으로 오프라인 동작하고 white-label identity를 보존해야 한다.

## 문서 권위와 충돌 처리

결정의 우선순위는 다음과 같다.

1. 현재 사용자 지시
2. 이 `AGENTS.md`
3. Accepted 상태의 ADR
4. `docs/product/`와 `docs/architecture/` 문서
5. 현재 작업의 ExecPlan
6. 코드와 테스트
7. `README.md` 및 기타 설명

Proposed ADR은 검증할 제안이지 승인된 결정이 아니다. 문서, 코드 또는 테스트가 서로 충돌하면 임의로 한쪽을 숨기거나 조용히 우회하지 말고 충돌, 영향과 해결 근거를 작업 계획과 결과에 명시한다.

## 확정 기술 방향

- Garak Studio: Electron, React, TypeScript strict mode, Windows/macOS
- Native Engine과 generated plugin runtime: C++20
- Native build: CMake, Ninja, Windows의 MSVC, macOS의 Apple Clang
- Build definition은 IDE에 종속되지 않는다.
- JUCE를 사용하지 않는다.
- Plugin 검증 순서: Windows x64 VST3, macOS arm64/x86_64 VST3, 이후 macOS AU
- 첫 상용 format 목표: Windows VST3, macOS Universal VST3, macOS AU

언어와 toolchain 결정은 특정 serialization, renderer, layout engine, graph library 또는 runtime packaging 전략의 채택을 의미하지 않는다. 관련 근거는 [ADR 0001](docs/adr/0001-typescript-studio-and-cpp20-engine.md), [ADR 0002](docs/adr/0002-no-juce-and-adapter-boundaries.md), [ADR 0004](docs/adr/0004-windows-macos-and-plugin-formats.md)를 따른다.

## First-party 경계

Garak이 다음 모델과 계약을 직접 소유한다.

- `.garak` project model
- DSP node contract와 DSP graph model
- graph compiler, execution schedule와 audio buffer planning
- parameter와 macro mapping system
- state와 preset migration
- interface scene model
- product compiler와 generated plugin runtime contract
- validation과 export pipeline

외부 SDK와 library는 기능별 adapter 뒤에 격리한다. Garak public API와 persistent model에는 `garak::AudioBlock`, `garak::Parameter`, `garak::Graph`, `garak::NodeDescriptor`, `garak::ui::Scene` 같은 first-party 타입만 노출한다. `Steinberg::Vst::ProcessData`, `SkCanvas`, `YGNode` 같은 외부 타입을 adapter 밖에 노출하지 않는다.

Third-party 원본은 가능한 한 수정하지 않는다. 필요한 변경만 작고 검토 가능한 patch set으로 관리하고, 이름 변경이나 Garak style 적용을 위한 광범위한 fork 또는 재포맷을 하지 않는다. 자세한 경계는 [Module Boundaries](docs/architecture/module-boundaries.md)를 따른다.

## Generated plugin 불변식

- Garak Studio나 network 연결 없이 기본 audio processing, UI, preset과 state restore가 동작해야 한다.
- Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 포함하지 않는다.
- 제품 화면에 “Made with Garak” 표시를 강제하지 않는다.
- Product별 영구 product ID와 plugin class ID를 유지한다.
- 출시된 parameter numeric ID를 변경하지 않고 삭제된 ID를 재사용하지 않는다.
- Sound가 달라지는 node implementation은 기존 version을 덮어쓰지 않고 새 version으로 추가한다.
- `.garak`, preset과 DAW state에는 schema version과 명시적 migration 경계를 둔다. Compiled runtime data는 compatibility를 판정할 contract version을 가지되, 이전 blob을 migrate, rebuild 또는 reject할지는 runtime/export 정책으로 결정한다.

Generated runtime을 제품과 결합하는 방식은 아직 결정되지 않았다. [ADR 0003](docs/adr/0003-generated-plugin-runtime-strategy.md)이 Proposed인 동안 prebuilt runtime 방식이나 thin wrapper 방식을 기본값으로 가정하지 않는다.

Phase 1A의 `Garak Gain Spike`는 fixed-metadata editorless VST3 adapter spike일 뿐이다. Compiled product data를 prebuilt runtime에 삽입하거나 product별 wrapper를 생성하지 않으므로 ADR 0003의 어느 대안도 구현·선호·채택한 증거로 사용하지 않는다.

## Realtime audio 규칙

Audio process callback과 그 하위 경로에서는 다음을 금지한다.

- 동적 메모리 할당 또는 해제
- mutex, blocking lock, sleep, wait 또는 thread join
- 파일 I/O와 네트워크 I/O
- JSON parsing, state parsing 또는 migration
- GUI 또는 message-loop 호출
- 로그 파일 기록
- callback 경계 밖으로의 예외 전파
- graph의 node, connection 또는 실행 구조 변경
- 실행 시간 상한을 예측할 수 없는 blocking operation

필요한 memory, buffer, execution schedule, latency, converter, mapping과 communication storage는 compile/prepare 단계에서 마련한다. 특정 lock-free 구현을 미리 가정하지 말고 bounded non-blocking behavior를 측정해 입증한다. [Realtime and Quality](docs/architecture/realtime-and-quality.md)가 상세 계약의 권위 문서다.

## Coding policy

### C++

- C++20을 사용한다.
- Ownership과 lifetime을 타입과 RAII로 명시하고 raw owning pointer를 만들지 않는다.
- Core public API를 작게 유지하고 platform, format과 third-party 세부 사항을 adapter로 밀어낸다.
- Realtime path의 capacity와 작업량을 prepare 단계에서 고정하며 암묵적 allocation이나 blocking을 허용하지 않는다.
- Exception이 audio callback 경계를 통과하지 않게 한다. Error를 숨기지 말고 non-realtime 경계에서 설명 가능한 결과로 변환한다.
- Sound-changing behavior, persistent identity 또는 serialization을 바꿀 때 version 및 migration 영향을 먼저 기록한다.

### TypeScript

- TypeScript strict mode를 유지한다. `any`, unchecked cast와 untyped IPC/persistence boundary를 기본 해결책으로 사용하지 않는다.
- External input, project data와 native boundary는 명시적인 type과 runtime validation으로 다룬다.
- React/Electron 타입과 editor-only state를 language-neutral product model에 누출하지 않는다.
- UI component, domain model, persistence와 native integration의 책임을 분리한다.
- 생성 플러그인 runtime에 Studio code나 JavaScript runtime이 전이되지 않게 한다.

### 호환성 범위

Obsolete 내부 API, pre-release draft, unused adapter와 낡은 실행 경로를 compatibility shim, fallback 또는 migration이라는 이름으로 보존하지 않는다. 현재 canonical path로 제거·통합한다. 반면 이미 출시된 product/plugin/parameter identity와 문서화된 project, preset, DAW state 계약은 사용자 영속 데이터이므로 명시적인 version migration으로 보존한다. Migration은 폐기된 내부 구현을 계속 실행하는 compatibility layer가 아니다.

## Dependency와 license policy

- 먼저 저장소에 이미 승인된 dependency의 문서와 타입을 확인하고 기능을 재구현하거나 새 package를 추가하지 않는다.
- 새 dependency는 현재 요구 능력, 유지보수성, platform/toolchain, transitive cost, realtime 적합성, generated runtime 포함 여부와 재배포 license를 검증한 뒤 도입한다.
- 기본 허용 검토 후보: MIT, MIT-0, BSD, ISC, zlib, Apache-2.0
- 격리 및 별도 검토: MPL-2.0, LGPL
- Generated runtime에서 원칙적으로 제외: GPL, AGPL, 출처·license가 불명확한 코드, 상업적 재배포를 제한하는 source-available 코드
- 허용 목록은 자동 승인이 아니다. 실제 license text, notice, transitive dependency와 배포 방식을 검토한다.
- 저장소 자체의 license는 미정이다. 지시와 법률 검토 없이 `LICENSE`를 만들거나 license를 선택하지 않는다.

Steinberg VST3 SDK만 Phase 1A Windows x64 adapter spike를 위해 exact Git pin으로 도입·검증했으며 [Phase 1A dependency 상태](docs/status/phase-1a-vst3-dependency.md)에 기록한다. 이 검증은 generated runtime 일반 사용, macOS, 상용 재배포 또는 전체 legal audit의 승인이 아니다. Recursive checkout에 포함된 VSTGUI도 build/link하지 않는다. 그 밖의 audio/plugin/graphics 후보는 계속 미설치·미검증·미승인 상태다.

Phase 0B Studio scaffold의 exact direct dependency는 [Phase 0B dependency 상태](docs/status/phase-0b-dependencies.md)에 기록한다. Studio dependency는 generated plugin에 전이되지 않는다. 모든 추가 도입은 [Dependency and License Policy](docs/architecture/dependency-policy.md)를 따른다.

## 대표 검증 명령

Windows Native 명령은 Visual Studio x64 Developer Command 환경에서 실행한다. 세부 warning, formatter와 static-analysis 명령은 [native/AGENTS.md](native/AGENTS.md)를 따른다.

```text
cmake --preset debug
cmake --build --preset debug-build
ctest --preset debug-test --no-tests=error
out\build\debug\native\apps\garak_smoke\garak_smoke.exe
```

Studio의 대표 재현 명령은 다음과 같다. Electron 개발 실행과 세부 경계는 [studio/AGENTS.md](studio/AGENTS.md)를 따른다.

```text
pnpm install --frozen-lockfile
pnpm studio:lint
pnpm studio:format:check
pnpm studio:typecheck
pnpm studio:build
```

Windows 검증 결과를 macOS, Apple Clang 또는 macOS Electron 통과로 일반화하지 않는다.

Phase 1A VST3 검증은 recursive SDK checkout 뒤 다음 Debug/Release 흐름을 사용한다. 세부 artifact와 validator 계약은 [VST3 Adapter](docs/architecture/vst3-adapter.md)를 따른다.

```text
git submodule update --init --recursive third_party/vst3sdk
cmake --preset vst3-debug
cmake --build --preset vst3-debug-build --clean-first
ctest --preset vst3-debug-test --no-tests=error
tools\vst3\validate.ps1 -Configuration Debug

cmake --preset vst3-release
cmake --build --preset vst3-release-build --clean-first
ctest --preset vst3-release-test --no-tests=error
tools\vst3\validate.ps1 -Configuration Release
```

## 작업 방식과 저장소 안전

- 작업 전에 현재 디렉터리, `git status`, 관련 파일과 사용자 변경사항을 조사한다.
- 기존 사용자 변경을 보존한다. 관련 없는 파일을 수정하거나, 사용자의 작업을 무단으로 덮어쓰거나 삭제하지 않는다.
- `git reset --hard`, `git clean -fd`, 강제 checkout과 그에 준하는 파괴적 Git 작업을 사용하지 않는다.
- 현재 요구를 충족하는 가장 작은 end-to-end 변경을 만든다. 범위 밖 기능, speculative abstraction, compatibility fallback 또는 placeholder framework를 임의로 추가하지 않는다.
- 큰 작업을 시작하기 전에 [PLANS.md](PLANS.md) 형식의 ExecPlan을 `plans/`에 작성한다.
- 작업 중 실제 상태, 발견과 결정이 달라지면 ExecPlan, 관련 product/architecture 문서와 ADR을 같은 작업에서 갱신한다.
- 실패, 제한, 미검증 항목과 문서 충돌을 숨기지 않는다.
- 실행하지 않은 test, build, validator 또는 platform 검증을 통과했다고 보고하지 않는다.
- 실제 수용 기준과 검증이 완료되기 전에 phase나 기능을 완료로 표시하지 않는다.
- 작업 완료 시 [docs/status/current.md](docs/status/current.md)를 현재 사실, 검증 결과, 미결정 사항과 정확한 다음 단계에 맞춰 갱신한다.

## 완료 기준

작업은 요청된 산출물이 존재하는 것만으로 끝나지 않는다. 관련 수용 기준을 확인하고 가능한 검증을 실행하며, 명령과 결과를 ExecPlan 또는 status에 기록해야 한다. 수행할 수 없는 검증은 이유와 향후 재현 명령을 남긴다. 실패가 있으면 PASS로 표현하지 않는다.
