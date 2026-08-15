# ExecPlan 0011 — Remove Obsolete Runtime Spikes

- Status: Complete
- Started: 2026-08-22
- Completed: 2026-08-23
- Owner: Native runtime and Windows VST3 export

## 목적

현재 제품 경로인 `.garak` → Product Compiler → prebuilt Product Runtime v1 → Warm/Bright VST3만 active build와 regression gate에 남긴다. Phase 1A/1B의 fixed Gain, Data Runtime와 Thin Runtime A/B 구현은 제거하고 당시 검증 문서만 역사적 evidence로 보존한다.

## 사용자 가치

새 기능을 추가할 때 과거 기술 spike 다섯 module을 함께 compile, package, load와 test하지 않는다. 현재 제품 실패가 역사적 실험 실패와 섞이지 않으며 Phase 3 static graph를 production namespace와 작은 build graph 위에서 시작할 수 있다.

## 시작 상태

- Branch: `main`
- 시작 authoritative baseline: `6646c60e5ee4105245d1a1ea9c7f5d28433ffaa9`
- 시작 baseline status: `garak/windows-foundation` success
- Product Runtime preset과 loaded-module tests가 Phase 1A/1B 전체에 결합돼 있었다.
- Product Runtime이 `native/spikes/gain` implementation을 production dependency로 사용했다.
- active README, AGENTS와 VST3 architecture가 삭제 대상 command/path를 current workflow로 안내했다.

## 범위

- Product Runtime의 Phase 1A/1B dependency 제거
- reusable Gain DSP production module 승격
- obsolete adapter, test, option, preset와 packaging tools 삭제
- Warm/Bright actual module output/state/identity regression 강화
- current active docs 동기화
- exact current commit의 clean Windows foundation gate

## 비범위

- historical ADR, ExecPlan와 status report 삭제
- Phase 3 graph 구현
- compatibility shim/fallback
- compiled product/state v2
- macOS/AU, installer, signing와 DAW matrix
- 새 dependency

## 구현 단계

- [x] Product Runtime preset과 target에서 Phase 1A/1B dependency를 제거했다.
- [x] Gain implementation을 `native/dsp/gain` production module로 이동했다.
- [x] Phase 1A/1B adapter, test, packager, option, preset와 obsolete source를 삭제했다.
- [x] Warm/Bright direct smoke, inspector와 official validator CTest를 current graph에 뒀다.
- [x] current source에 연결되지 않고 삭제된 spike header를 참조하던 dead contract test를 제거했다.
- [x] active README, root AGENTS, roadmap, current status와 VST3 architecture를 동기화했다.
- [x] exact implementation/documentation commit의 `garak/windows-foundation` gate를 통과했다.

## 실제 변경

### Current build와 code

- Product Runtime configure option은 `GARAK_BUILD_PRODUCT_RUNTIME_V1` 하나로 축소했다.
- Product Runtime presets는 historical spike option을 활성화하지 않는다.
- `garak_product_runtime_v1_quality`는 current contract, production Gain DSP, Product Runtime, inspector와 current tests만 의존한다.
- `native/dsp/gain`에 SDK-independent Gain mapping/automation/bypass/sample processing을 뒀다.
- `native/tests/gain_dsp_tests.cpp`와 `native/tests/product_runtime_v1_smoke_tests.cpp`가 current DSP와 actual Warm/Bright modules를 검증한다.

### 제거한 implementation

- `native/spikes/gain`
- `native/adapters/vst3/gain_spike`
- `native/adapters/vst3/runtime_strategy_spike`
- Phase 1A/1B loaded/descriptor tests
- `tools/vst3`
- obsolete Product Runtime contract test
- related CMake options, presets와 aggregate targets

### Active documentation

- `README.md`
- `AGENTS.md`
- `ROADMAP.md`
- `native/AGENTS.md`
- `native/adapters/vst3/AGENTS.md`
- `docs/status/current.md`
- `docs/architecture/vst3-adapter.md`
- 본 ExecPlan

## 검증 결과

Verified implementation/documentation commit:

```text
edf4ddb561edd317f001418c9d2935bbb35fc666
```

Authoritative GitHub Actions run:

```text
32580085187
```

Status context:

```text
garak/windows-foundation = success
```

### Product Compiler and Studio job

모든 step 성공:

- exact frozen workspace install
- LF/whitespace check
- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/build
- tracked source mutation 0

### Native Product Runtime and real export path job

모든 step 성공:

- recursive SDK pin check
- first-party clang-format
- Debug clean build
- Warm/Bright Debug export와 official validation
- Debug CTest
- actual Studio Debug ProductService workflow
- Release clean build
- Warm/Bright Release export와 official validation
- Release CTest
- actual Studio Release ProductService workflow
- warnings-as-errors
- clang-tidy
- tracked source mutation 0

## 수용 기준 판정

- Product Runtime configure/build/test에 Phase 1A/1B option, target, bundle 또는 tool이 필요하지 않음: PASS
- Warm/Bright actual export, identity inspection와 official validation: PASS
- current Runtime의 spike namespace/path/target dependency 0: PASS
- obsolete executable implementation와 packaging tools 제거: PASS
- active docs의 삭제된 current command 0: PASS
- historical evidence docs 보존: PASS
- exact authoritative Windows status success: PASS

## 발견 사항

- compatibility implementation이 당시 parser signature와 불일치해 clean native compile failure를 일으켰고 current parser contract로 수정했다.
- Windows CRLF checkout이 strict descriptor를 깨뜨려 first-party text를 LF로 고정했다.
- 과거 CI가 source를 포맷·commit·push하고 issue를 생성해 verifier와 writer 책임을 섞고 있었고 read-only gate로 교체했다.
- 첫 cleanup increment는 새 Gain DSP/test formatting 문제를 실제 CI에서 탐지했다.
- `product_runtime_v1_contract_tests.cpp`는 CMake target이 없고 삭제된 spike header를 참조한 dead code였다.
- implementation 삭제 후 active documentation에 obsolete command/path가 남아 있어 별도 동기화가 필요했다.

## 의사결정 로그

- Phase 3보다 obsolete spike removal을 우선했다.
- historical evidence는 보존하되 runnable obsolete implementation은 제거했다.
- current gate는 Warm/Bright 제품만 검증하고 Phase 1A/1B bundle을 compatibility baseline으로 두지 않는다.
- CI는 read-only verifier이고 source mutation을 failure로 취급한다.
- active root docs에는 current workflow만 두고 과거 command는 historical plans/status에 한정한다.

## 완료 기록

Current Product Runtime은 과거 A/B spike 없이 clean checkout에서 compile, export, official validation, loaded-module test와 Studio ProductService workflow를 통과한다. ExecPlan의 모든 수용 기준을 만족했다.

## 다음 단계

`Phase 3A — Minimal Static DSP Graph and Compiled Execution Plan`을 별도 ExecPlan으로 시작할 수 있다. 이번 plan에서는 Phase 3A 코드를 구현하지 않았다.
