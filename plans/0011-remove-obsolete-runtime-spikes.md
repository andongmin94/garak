# ExecPlan 0011 — Remove Obsolete Runtime Spikes

- Status: In Progress
- Started: 2026-08-22
- Updated: 2026-08-22
- Owner: Native runtime and Windows VST3 export

## 목적

현재 제품 경로인 `.garak` → Product Compiler → prebuilt Product Runtime v1 → Warm/Bright VST3만 active build와 regression gate에 남긴다. Phase 1A/1B의 fixed Gain, Data Runtime와 Thin Runtime A/B 구현은 제거하고 당시 검증 문서만 역사적 evidence로 보존한다.

## 사용자 가치

새 기능을 추가할 때 과거 기술 spike 다섯 module을 함께 compile, package, load와 test하지 않는다. 현재 제품 실패가 역사적 실험 실패와 섞이지 않으며 Phase 3 static graph를 production namespace와 작은 build graph 위에서 시작할 수 있다.

## 현재 저장소 상태

- Branch: `main`
- 시작 authoritative baseline: `6646c60e5ee4105245d1a1ea9c7f5d28433ffaa9`
- 시작 baseline status: `garak/windows-foundation` success
- Current Product Runtime은 Warm/Bright editorless Gain product를 실제 export한다.
- Phase 1A/1B code와 current Product Runtime build/test가 결합돼 있었다.
- README, root AGENTS와 VST3 architecture가 삭제된 preset, target, script와 source path를 active command처럼 안내했다.

## 범위

- Warm/Bright current product를 직접 load/process/state-test하는 current-path CTest
- Product Runtime CMake preset/target에서 Phase 1A/1B dependency 제거
- reusable Gain DSP를 production module로 승격
- obsolete Phase 1A/1B adapter, tests, CMake option/preset과 packaging tools 삭제
- dead Product Runtime test 삭제
- current README/AGENTS/ROADMAP/status/VST3 architecture 동기화
- exact current commit의 clean Windows foundation gate

## 비범위

- historical ADR, ExecPlan와 status report 삭제
- Phase 3 graph 구현
- compiled product/state v2
- new compatibility shim 또는 fallback
- macOS/AU, installer, signing와 DAW matrix
- 새 dependency

## 구현 단계

- [x] Product Runtime preset과 target에서 Phase 1A/1B dependency를 제거한다.
- [x] Gain implementation을 `native/dsp/gain` production module로 이동한다.
- [x] Phase 1A/1B adapter, test, packager, option, preset와 obsolete source를 삭제한다.
- [x] Warm/Bright direct smoke, inspector와 official validator CTest를 current build graph에 둔다.
- [x] current source에 연결되지 않고 삭제된 spike header를 참조하던 dead contract test를 제거한다.
- [x] active README, root AGENTS, roadmap, current status와 VST3 architecture를 동기화한다.
- [ ] documentation sync commit의 exact `garak/windows-foundation` gate를 통과한다.
- [ ] 최종 검증 결과를 plan과 current status에 기록하고 Status를 Complete로 바꾼다.

## 실제 변경 대상

### Current build와 code

- `CMakeLists.txt`
- `CMakePresets.json`
- `cmake/GarakOptions.cmake`
- `native/CMakeLists.txt`
- `native/adapters/vst3/CMakeLists.txt`
- `native/adapters/vst3/product_runtime_v1/*`
- `native/dsp/gain/*`
- `native/tests/CMakeLists.txt`
- `native/tests/gain_dsp_tests.cpp`
- `native/tests/product_runtime_v1_smoke_tests.cpp`

### 제거한 implementation

- `native/spikes/gain`
- `native/adapters/vst3/gain_spike`
- `native/adapters/vst3/runtime_strategy_spike`
- Phase 1A/1B loaded tests와 descriptor tests
- `tools/vst3`
- obsolete Product Runtime contract test

### Active documentation

- `README.md`
- `AGENTS.md`
- `ROADMAP.md`
- `native/AGENTS.md`
- `native/adapters/vst3/AGENTS.md`
- `docs/status/current.md`
- `docs/architecture/vst3-adapter.md`
- 본 ExecPlan

## 검증 계획

Authoritative `.github/workflows/phase-2c.yml` gate를 exact commit에서 실행한다.

- repository LF/whitespace
- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/build
- exact recursive VST3 SDK pin
- first-party clang-format
- Debug/Release Product Runtime fresh configure와 clean build
- Warm/Bright actual export와 official standard/extensive validator
- current Product Runtime CTest와 inspector parity
- actual Studio ProductService Debug/Release workflow
- warnings-as-errors
- clang-tidy
- tracked source mutation 0

## 수용 기준

- Product Runtime configure/build/test가 Phase 1A/1B option, target, bundle 또는 tool에 의존하지 않는다.
- Warm/Bright actual export가 exact identity inspection과 official standard/extensive validation을 통과한다.
- current Runtime이 `spike` namespace/path/target에 의존하지 않는다.
- obsolete executable implementation과 packaging tools가 source tree에서 제거된다.
- active docs가 삭제된 command를 current workflow로 안내하지 않는다.
- historical evidence docs는 보존되고 historical label이 명확하다.
- exact current `main` commit의 `garak/windows-foundation` status가 success다.

## 리스크

- 일곱-module coexistence test 제거로 current-path regression이 줄 수 있다. Warm/Bright actual output, foreign state rejection, instance isolation, unload/reload, inspector와 official validator를 current tests에 직접 둔다.
- CMake simplification이 export tool discovery를 깨뜨릴 수 있다. Debug/Release actual Product Compiler export와 Studio workflow를 gate에 둔다.
- Gain namespace 이동 중 realtime behavior가 변할 수 있다. SDK-independent DSP test와 actual module output test를 유지한다.
- active docs를 크게 줄이면서 persistent contract를 누락할 수 있다. ADR와 architecture source-of-truth에 link하고 root documents에는 current commands와 invariants만 둔다.

## 발견 사항

- 2026-08-22: 기존 Product Runtime preset이 Phase 1B 전체를 활성화해 current product와 historical spike를 독립적으로 검증할 수 없었다.
- 2026-08-22: compatibility implementation은 당시 current parser signature와 불일치해 clean native build에서 compile failure가 발생했다. Current parser contract로 수정했다.
- 2026-08-22: Windows checkout의 CRLF 변환이 strict descriptor를 깨뜨렸다. First-party text checkout을 LF로 고정했다.
- 2026-08-22: 과거 CI가 source formatting/commit/push와 issue 생성까지 수행해 verifier와 writer 책임이 섞였다. Workflow를 read-only authoritative gate로 바꿨다.
- 2026-08-22: first cleanup increment의 CI는 새 Gain DSP/test의 canonical formatting 차이를 탐지했고 수정했다.
- 2026-08-22: `product_runtime_v1_contract_tests.cpp`는 CMake target이 없고 이미 삭제된 spike header를 참조하는 dead code였다. 삭제했다.
- 2026-08-22: implementation 제거 후 README, root AGENTS와 VST3 architecture에 삭제된 command/path가 남아 있었다.

## 의사결정 로그

- 2026-08-22: Phase 3보다 obsolete spike removal을 우선한다.
- 2026-08-22: historical evidence 문서는 보존하되 runnable implementation은 제거한다.
- 2026-08-22: current gate는 Warm/Bright 실제 product만 검증하며 Phase 1A/1B bundle을 compatibility baseline으로 두지 않는다.
- 2026-08-22: CI는 read-only verifier이고 source mutation을 failure로 취급한다.
- 2026-08-22: active root docs는 current workflow만 설명하고 historical commands는 historical plans/status로 이동한다.

## 완료 기록

Code와 active documentation cleanup은 반영됐다. 최종 exact current-commit Windows foundation gate가 성공하기 전에는 이 plan을 Complete로 판정하지 않는다.

## 다음 단계

이 plan이 Complete이고 current `main` status가 success인 뒤에만 `Phase 3A — Minimal Static DSP Graph and Compiled Execution Plan` ExecPlan을 시작한다.
