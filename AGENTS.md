# Garak Repository Constitution

이 문서는 Garak 저장소에서 작업하는 사람과 agent가 따르는 지속 규칙이다. 상세 제품 범위는 [`docs/product/v0.1-prd.md`](docs/product/v0.1-prd.md), 현재 사실은 [`docs/status/current.md`](docs/status/current.md), 단계 계획은 [`ROADMAP.md`](ROADMAP.md)를 따른다.

## 제품 미션

Garak(가락)은 음악가, 프로듀서와 사운드 디자이너가 자신의 사운드 컬러, control language, interface와 브랜드를 독립적인 native audio plug-in 제품으로 만들 수 있게 하는 제작 플랫폼이다. 생성 플러그인은 Studio와 network 없이 오프라인 동작하고 white-label identity를 보존해야 한다.

## 권위 순서

1. 현재 사용자 지시
2. 이 `AGENTS.md`
3. Accepted ADR
4. `docs/product/`와 `docs/architecture/`
5. 현재 ExecPlan
6. 코드와 테스트
7. README 및 기타 설명

충돌을 발견하면 숨기지 말고 계획과 결과에 기록한다. Proposed ADR은 승인된 결정이 아니다.

## 확정 기술 방향

- Studio: Electron, React, TypeScript strict mode
- Native engine와 generated plug-in runtime: C++20
- Build: CMake + Ninja
- Windows: MSVC
- macOS 목표: Apple Clang
- JUCE 사용 금지
- IDE-independent build definition
- 첫 상용 format 목표: Windows VST3, macOS Universal VST3, macOS AU

macOS/AU 결과를 Windows 결과로 일반화하지 않는다.

## 현재 canonical product path

현재 실행 가능한 Windows x64 제품 경로는 다음 하나다.

```text
unpacked .garak project
→ Product Compiler
→ deterministic product.garakbin + graph.garakbin
→ prebuilt Garak Product Runtime v1
→ moduleinfo.json + VST3 bundle
→ inspector + official validator + loaded-module tests
```

Current reference products는 `Artist Gain Warm`과 `Artist Gain Bright`다.

Phase 1A fixed Gain plug-in과 Phase 1B Data/Thin runtime-strategy A/B 구현은 삭제됐다. 당시 ADR, ExecPlan과 status 문서는 역사적 증거다. 삭제된 source, CMake option, preset, script 또는 test를 compatibility path나 fallback으로 복원하지 않는다.

Current reusable Gain processing은 `native/dsp/gain`, persistent compiled/state contract는 `native/runtime/product_v1`, compiled graph contract는 `native/runtime/static_graph`, VST3 ABI integration은 `native/adapters/vst3/product_runtime_v1`에 둔다.

## First-party 경계

Garak이 직접 소유한다.

- `.garak` project model과 migration
- Product ID, plug-in class ID와 Parameter ID lifecycle
- compiled product와 state contract
- DSP node/graph/compiler/execution plan
- parameter와 macro mapping
- interface scene
- product compiler, validation과 export

Third-party SDK type을 first-party public API나 persistent model에 노출하지 않는다. Steinberg type은 VST3 adapter 또는 VST3-only test 안에 격리한다.

## 영속 계약

- Product ID는 제품 생성 후 변경하지 않는다.
- Processor/Controller FUID는 versioned deterministic derivation을 사용한다.
- 출시된 Parameter numeric ID는 변경하거나 재사용하지 않는다.
- 삭제 ID는 tombstone으로 남긴다.
- Sound-changing node behavior는 기존 version을 덮어쓰지 않는다.
- `.garak`, compiled data, preset과 DAW/plug-in state는 명시적 version 경계를 가진다.
- 지원하지 않는 future data를 추측해 읽거나 overwrite하지 않는다.
- Obsolete 내부 API와 pre-release implementation은 shim으로 보존하지 않는다.

현재 `GARAKCPD` v1과 `GARAKPST` v1의 compatibility 정책은 [`docs/adr/0010-compiled-product-and-state-compatibility.md`](docs/adr/0010-compiled-product-and-state-compatibility.md)를 따른다.

## Realtime audio 규칙

Audio callback과 동기 하위 경로에서 금지한다.

- allocation/deallocation
- mutex, blocking lock, wait, sleep, thread join
- file/network I/O
- JSON/state/migration parsing
- GUI/message-loop 호출
- logging과 string formatting
- graph 구조 변경
- callback 밖으로 exception 전파

Memory, buffer, schedule, latency와 mapping은 prepare/compile 단계에서 확정한다. Realtime 변경은 allocation, blocking과 bounded-work 검증을 같은 작업에 포함한다.

## C++ 규칙

- C++20, RAII와 value semantics
- raw owning pointer와 직접 `new`/`delete` 금지
- 단, Steinberg reference-count ownership transfer 지점은 하위 AGENTS 규칙을 따른다.
- first-party target마다 warnings와 clang-tidy 적용
- public header는 모듈의 `include/garak/` 아래
- platform/SDK detail은 adapter로 격리
- test는 `assert`가 아니라 명시적 failure와 non-zero exit 사용
- public behavior에는 test가 필요

## TypeScript와 Electron 규칙

- strict mode와 explicit boundary type
- `any`, unchecked cast와 untyped IPC를 기본 해법으로 사용하지 않음
- external input은 runtime validation
- renderer에서 Node.js, filesystem, shell, process와 raw IPC 접근 금지
- preload는 fixed typed capability만 노출
- generic `send(channel)` 또는 `invoke(channel)` wrapper 금지
- Product Compiler와 Studio는 같은 first-party project/serialization/export 구현 사용

## Persistence 규칙

- open만으로 legacy source를 rewrite하지 않는다.
- external modification, future schema와 Product ID replacement를 overwrite하지 않는다.
- destructive save/migration은 verified backup와 transaction/recovery contract를 따른다.
- ambiguous recovery에서 artifact를 임의 삭제하지 않는다.
- process-crash consistency와 hardware power-loss guarantee를 구분한다.

## Dependency와 license

먼저 현재 dependency의 문서와 타입을 확인한다. 필요성·유지보수·transitive cost·platform·realtime 적합성·generated runtime 포함 여부·재배포 license를 검토하지 않고 새 dependency를 추가하지 않는다.

- 기본 검토 후보: MIT, MIT-0, BSD, ISC, zlib, Apache-2.0
- 별도 검토: MPL-2.0, LGPL
- generated runtime에서 원칙적으로 제외: GPL, AGPL, 불명확하거나 상업적 재배포를 제한하는 code

Steinberg VST3 SDK는 exact Git pin을 유지한다. SDK source를 수정·재포맷·first-party tidy 대상으로 만들지 않는다. VSTGUI는 checkout에 존재해도 build/link하지 않는다. 저장소 자체 license는 미정이며 지시 없이 `LICENSE`를 만들지 않는다.

## 작업 방식

- 큰 작업은 구현 전에 `PLANS.md` 형식의 ExecPlan을 작성한다.
- 가장 작은 end-to-end working increment부터 만든다.
- 기존 working path를 깨뜨린 채 미래 abstraction을 쌓지 않는다.
- 사용자 변경을 삭제하거나 되돌리지 않는다.
- `git reset --hard`, `git clean -fd`, force push와 임의 rebase 금지
- 실행하지 않은 검증을 PASS라고 쓰지 않는다.
- 실패한 gate를 test 삭제, warning 완화, fallback 또는 문서상 완료로 우회하지 않는다.
- 작업 종료 시 영향을 받은 architecture/status/roadmap/plan을 실제 상태에 맞춘다.

## 권위 있는 검증

문서의 과거 test 수나 삭제된 원격 workflow 상태가 아니라, **정확한 current commit을 clean Windows checkout에서 아래 명령으로 검증한 기록**이 기준이다. 검증 과정은 source를 포맷·commit·push하거나 issue를 자동 생성해서는 안 된다.

### TypeScript

```powershell
pnpm install --frozen-lockfile
pnpm product:format:check
pnpm product:lint
pnpm product:typecheck
pnpm product:test
pnpm studio:format:check
pnpm studio:lint
pnpm studio:typecheck
pnpm studio:test
pnpm studio:build
```

### Current Product Runtime

Visual Studio x64 Developer Command 환경에서 실행한다.

```powershell
git submodule update --init --recursive third_party/vst3sdk

cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first
pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Debug --output out/exports/phase-1c1/debug --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Debug --output out/exports/phase-1c1/debug --force --validate
ctest --preset product-runtime-debug-test --no-tests=error
pnpm --dir studio verify:product-workflow --configuration Debug

cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first
pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Release --output out/exports/phase-1c1/release --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Release --output out/exports/phase-1c1/release --force --validate
ctest --preset product-runtime-release-test --no-tests=error
pnpm --dir studio verify:product-workflow --configuration Release

cmake --preset product-runtime-werror --fresh
cmake --build --preset product-runtime-werror-build --clean-first
cmake --preset product-runtime-clang-tidy --fresh
cmake --build --preset product-runtime-clang-tidy-build --clean-first
```

Current build에 Phase 1A/1B option, preset, target 또는 package script를 다시 추가하지 않는다.

## Branch 운영 정책

- 이 저장소의 개발 작업은 사용자 지시에 따라 `main`에서 직접 수행한다.
- `agent/*`, feature, verification, cleanup 또는 release branch를 만들지 않는다.
- Pull request를 개발·검증의 중간 저장소로 사용하지 않는다.
- 검증은 정확한 `main` commit의 clean checkout을 대상으로 수행하고, 실패하면 다음 수정도 `main`에 직접 반영한다.
- 일회성 검증 workflow가 불가피하면 `main`에 추가하고 같은 작업 안에서 제거하여 최종 source tree에 남기지 않는다.
- `.github` 아래에 source patch, base64 payload, 복제된 ExecPlan 또는 agent 전달 파일을 저장하지 않는다.
- self-modifying workflow, guardian/controller workflow 묶음, workflow를 통한 source 운반을 사용하지 않는다.
- 동시에 활성화하는 ExecPlan은 하나뿐이며, 현재 increment가 검증·문서화될 때까지 다음 increment를 시작하지 않는다.
- 현재 요구를 충족하지 않는 과거 branch·workflow·compatibility path는 보존하지 않는다.
