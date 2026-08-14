# ExecPlan 0011 — Remove Obsolete Runtime Spikes

- Status: In Progress
- Started: 2026-08-22
- Updated: 2026-08-22
- Owner: Native runtime and Windows VST3 export

## 목적

현재 제품 경로인 `.garak` → Product Compiler → prebuilt Product Runtime v1 → Warm/Bright VST3만 active build와 regression gate에 남긴다. Phase 1A/1B의 fixed Gain, Data Runtime, Thin Runtime A/B 비교 구현은 검증 증거와 문서만 보존하고 production build graph에서는 제거핀다.

## 사용자 가치

새 기능을 추가할 때 과거 기술 spike 다섯 module을 함께 compile, package, load, test하지 않아도 된다. 현재 제품 경로의 실패가 역사적 실험 경로의 실패와 섞이지 않으며, Phase 3 static DSP graph를 production namespace와 작은 build graph 위에서 시작할 수 있다.

## 현재 저장소 상태

- Branch: `main`
- Baseline: `6646c60e5ee4105245d1a1ea9c7f5d28433ffaa9`
- Baseline authoritative status: `garak/windows-foundation` success
- Product Runtime presets가 Phase 1A Gain Spike와 Phase 1B Runtime Strategy Spike를 모두 활성화한다.
- Product Runtime loaded-module contract test가 Gain/Data/Thin/Warm/Bright 일곱 module을 전제로 하므로 현재 Warm/Bright 제품 경로를 독립적으로 검증할 수 없다.
- Product Runtime이 `native/spikes/gain`의 implementation target을 production dependency로 사용한다.
- Phase 1B A/B 비교 자체는 Windows x64에서 완료된 역사적 evidence이며 runtime 전략 재평가를 위해 소스 구현을 계속 active graph에 둘 필요는 없다.

## 범위

- Warm/Bright export를 직접 검사하고 official validator로 load하는 current-path CTest 추가
- Product Runtime CMake preset과 quality target에서 Phase 1B build/test dependency 제거
- reusable Gain processing곰 Product Runtime만의 private helper가 아니라 Phase 3에서 재사용할 production DSP leaf module로 승격한다.
4. 제거는 두 단계로 진행한다. 먼저 current path를 spike fixtures에서 분리해 green baseline을 만들고, 그 다음 unreachable spike implementation을 삭제한다.

## 구현 단계

- [x] Product Runtime 전용 Warm/Bright inspector/official-validator CTest를 추가한다.
- [x] Product Runtime presets와 quality target에서 Phase 1B dependency를 제거한다.
- [ ] 첨 분리 commit의 exact Windows foundation gate를 통과한다.
- [ ] Gain implementation을 `native/dsp/gain` production module로 이동하고 namespace/target을 갱신한다.
- [ ] Phase 1A/1B adapter, test, packager, option, preset과 obsolete source를 삭제한다.
- [ ] active documentation과 roadmap을 동기화한다.
- [ ] 최종 exact Windows foundation gate를 통과하고 plan을 Complete로 갱신한다.

## 변경 대상 파일

예상 변경:

- `CMakePresets.json`
- `cmake/GarakOptions.cmake`
- `CMakeLists.txt`
- `native/CMakeLists.txt`
- `native/adapters/vst3/CMakeLists.txt`
- `native/adapters/vst3/product_runtime_v1/*`
- `native/dsp/gain/*`
- `native/tests/CMakeLists.txt`
- Phase 1A/1B obsolete source/test/tool paths
- `README.md`, `ROADMAP.md`, `docs/status/current.md`와 관련 ADR/architecture 문서

실제 삭제 목록은 tree inventory와 reference search 결과에 맞춰 완료 기록에서 확정한다.

## 검증 계획

- repository LF/whitespace와 clang-format gate
- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/build
- Debug/Release Product Runtime fresh configure, clean build
- Warm/Bright actual export와 official standard/extensive validator
- Debug/Release CTest의 current Product Runtime smoke, compiled/state compatibility
- Studio ProductService Debug/Release workflow
- first-party warnings-as-errors와 clang-tidy
- tracked source mutation 0
- active code/CMake에서 obsolete spike symbol과 path reference 0

## 수용 기준

- Product Runtime configure/build/test에 Phase 1A/1B option이나 target이 필요하지 않다.
- Warm/Bright export가 exact identity 검사와 official standard/extensive validator를 통과하고 compiled/state compatibility test가 함께 유지된다.
- current Product Runtime이 `spike` namespace/path/target에 의존하지 않는다.
- obsolete Phase 1A/1B executable implementation과 packaging tool이 repository에서 제거된다.
- historical plans/status documents는 당시 evidence로 남고 current docs는 제거된 command를 실행 경로로 안내하지 않는다.
- 최종 `main` commit의 `garak/windows-foundation` status가 success다.

## 리스크

- 기존 일곱-module test에만 있던 current-path regression을 잃을 수 있다. Warm/Bright direct smoke와 official validator를 먼저 만든 뒤 삭제한다.
- CMake target 삭제가 export tool의 prebuilt path discovery를 깨뜨릴 수 있다. Debug/Release actual export를 수용 gate로 둔다.
- Gain namespace 이동 중 realtime behavior가 변할 수 있다. 구현을 byte-for-byte equivalent하게 이동하고 processing tests를 유지한다.

## 발견 사항

- 2026-08-22: authoritative Windows gate는 baseline commit에서 성공행지만 Product Runtime preset이 여전히 Phase 1B 전체를 활성화하고 있었다.
- 2026-08-22: `garak_product_runtime_v1_contract_tests`는 `GARAK_BUILD_RUNTIME_STRATEGY_SPIKE`가 true일 때만 존재하여 current product path의 독립 regression이 아니었다.

## 의사결정 로그

- 2026-08-22: Phase 3를 바로 시작하지 않고 obsolete spike 분리를 선행한다. 이유는 새 graph capability를 역사적 A/B build graph 위에 추가하지 않기 위해서다.
- 2026-08-22: 과거 evidence 문서는 삭제하지 않는다. 실행 코드 보존과 검증 기록 보존은 별개다.

## 완료 기록

진행 중. 첫 increment는 Product Runtime 전용 Warm/Bright inspector/validator CTest와 spike-free product presets를 추가한다. 최종 gate 전에는 완료로 판정하지 않는다.

## 다음 단계

이 plan이 Complete가 된 뒤 `Phase 3A — Minimal Static DSP Graph and Compiled Execution Plan` ExecPlan을 작성한다.
