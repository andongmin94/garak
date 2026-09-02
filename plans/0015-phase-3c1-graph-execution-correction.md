# ExecPlan 0015 — Phase 3C1 Graph Execution Correction

- Status: In Progress
- Started: 2026-09-02
- Updated: 2026-09-02
- Owner: Native Runtime, VST3 Product Runtime and current product gate

## 목적

Phase 3C1의 `graph.garakbin`을 단순한 canonical-token 검사에서 실제 module-load execution binding으로 보정한다. Product Runtime은 compiled graph를 한 번 parse하고 검증해 callback이 직접 사용하는 immutable Gain binding을 만든다. 수정 후에도 현재 승인된 제품 범위는 `Audio Input → Gain → Audio Output` 한 chain뿐이다.

## 사용자 가치

현재 export된 제품의 audio path가 Runtime 소스에만 암묵적으로 고정되지 않고, bundle의 compiled graph가 지정한 buffer와 Parameter binding을 실제 처리 경로가 사용한다. 이후 editable graph source와 additional node를 추가할 때 기존 fixed Gain 경로를 다시 버리지 않고 검증된 실행 경계 위에 확장할 수 있다.

## 현재 저장소 상태

- 기준 branch: `main`
- 기준 commit: `ff90c3cfe6e729db6cbeb47d18c80e2af0fd7860`
- 문서는 Phase 3C1을 Complete로 표시하지만 코드 감사에서 다음 불일치를 확인했다.
  - Native `OperationType` underlying type은 8-bit인데 `GARAKGRF` wire field는 16-bit다.
  - `is_supported_gain_execution_plan`은 plan 전체가 hard-coded canonical 값과 같은지만 확인한다.
  - callback의 `execute_gain_plan`은 input/output operation과 buffer/parameter field를 실행에 사용하지 않고 기존 Gain DSP를 직접 호출한다.
  - plan 검증이 module load에서 끝났음에도 callback마다 다시 수행된다.
- malformed automation을 무시한다는 기존 정책은 문서화돼 있으나 focused current regression이 부족하다.
- `.github/workflows/source-snapshot-once.yml`은 목적이 끝난 일회성 source artifact workflow이며 current path에 남아 있다.
- PR #102는 실제 source correction 없이 self-modifying workflow만 포함해 2026-09-02에 병합하지 않고 닫았다.

## 범위

- Native operation type representation을 16-bit wire contract와 일치시킨다.
- current three-operation Gain plan을 module load에서 검증해 immutable `GainExecutionBinding`으로 준비한다.
- Product Runtime context와 processor는 raw plan 대신 prepared binding을 보유한다.
- callback은 binding의 input/output buffer slot과 Gain/Bypass Parameter ID를 실제 dispatch에 사용한다.
- malformed automation의 non-monotonic, non-finite와 out-of-range 입력이 해당 parameter automation 전체를 무시하고 이전 live state를 보존함을 회귀 테스트한다.
- compiled graph parser, static graph execution, realtime allocation stress와 actual Product Runtime 경로를 회귀 검증한다.
- obsolete one-time source snapshot workflow를 삭제한다.
- README, ROADMAP, current status와 ExecPlan 0014를 실제 상태에 맞춘다.

## 비범위

- `GARAKGRF` 1.0 byte layout 변경
- arbitrary DAG, split/merge, feedback, sidechain 또는 dynamic graph mutation
- generic node registry와 heap buffer planner
- additional DSP node
- editable project schema v3
- `GARAKCPD` 1.0, `GARAKPST` 1.0, Product/FUID/Parameter ID 변경
- macOS/AU, installer와 DAW matrix

## 전제와 제약

- Root `AGENTS.md`, `native/AGENTS.md`, accepted ADR과 ExecPlan 0014를 따른다.
- Gain ID `1001`, Bypass ID `1002`와 canonical compiled bytes를 보존한다.
- Runtime graph file I/O와 validation은 module load에서만 수행한다.
- Callback은 allocation, deallocation, lock, I/O, logging, string formatting, graph mutation과 exception propagation을 하지 않는다.
- 현재 compiler가 생성하지 않는 graph capability를 미래 기능을 이유로 추가하지 않는다.
- verification workflow는 source를 수정, format, commit 또는 push하지 않는다.

## 설계 결정

### Raw plan과 prepared binding을 분리한다

`GainExecutionPlan`은 parser가 wire fields를 담고 검증하는 module-load 자료다. 검증이 성공하면 `GainExecutionBinding`으로 축약한다. Product Runtime과 audio callback은 prepared binding만 보유한다. 이를 통해 callback에서 반복 validation을 제거하고 compiled graph의 buffer/Parameter field를 실제 실행 입력으로 만든다.

### 현재 graph acceptance는 좁게 유지한다

이번 보정은 current `Input → Gain → Output` 의미만 지원한다. operation order, 연결성, buffer count, latency, endpoint field, unique instance ID와 Parameter binding을 모두 fail closed로 검증한다. Generic executor는 만들지 않는다.

### Buffer table은 fixed-size stack storage다

현재 contract의 buffer count는 정확히 2다. callback은 fixed-size local array에 host input/output channel table을 binding slot대로 배치해 Gain DSP context를 만든다. Heap allocation과 dynamic planner는 도입하지 않는다.

## 구현 단계

1. [x] 현재 source, tests, status와 잘못된 PR #102를 조사하고 새 clean branch를 만들었다.
2. [ ] `GainExecutionBinding`과 strict module-load binder를 구현한다.
3. [ ] Product Runtime context, loader와 processor를 prepared binding 기반으로 전환한다.
4. [ ] static graph와 malformed automation focused regression을 추가한다.
5. [ ] obsolete source snapshot workflow를 삭제한다.
6. [ ] active architecture/status/roadmap 문서를 correction 진행 상태로 동기화한다.
7. [ ] local TypeScript와 generic Native Debug/Release/strict gates를 통과한다.
8. [ ] direct source commit을 clean Windows checkout에서 full product gate로 검증한다.
9. [ ] 검증된 exact commit과 run을 기록하고 correction을 Complete로 바꾼다.
10. [ ] 제품 코드·테스트·문서만 남은 PR을 검토 후 main에 병합한다.

## 변경 대상 파일

- `native/runtime/static_graph/include/garak/runtime/static_graph/gain_plan.hpp`
- `native/runtime/static_graph/include/garak/runtime/static_graph/compiled_graph.hpp`
- `native/adapters/vst3/product_runtime_v1/product_runtime_context.hpp`
- `native/adapters/vst3/product_runtime_v1/product_runtime_loader_win.cpp`
- `native/adapters/vst3/product_runtime_v1/processor.hpp`
- `native/adapters/vst3/product_runtime_v1/processor.cpp`
- `native/tests/static_graph_tests.cpp`
- `native/tests/gain_dsp_tests.cpp`
- `native/tests/realtime_stress_tests.cpp`
- `.github/workflows/source-snapshot-once.yml` 삭제
- `README.md`
- `ROADMAP.md`
- `docs/status/current.md`
- `plans/0014-phase-3c-editable-static-graph-contract.md`
- 이 ExecPlan

실제 구현에서 불필요한 파일은 수정하지 않으며 목록이 달라지면 완료 기록에 반영한다.

## 검증 계획

### Local preflight

```text
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

cmake --preset debug --fresh
cmake --build --preset debug-build --clean-first
ctest --preset debug-test --no-tests=error
cmake --preset release --fresh
cmake --build --preset release-build --clean-first
ctest --preset release-test --no-tests=error
```

가능한 local compiler에서 first-party formatting, warnings와 tests를 추가 확인한다. Local non-Windows 결과를 Windows VST3 acceptance로 일반화하지 않는다.

### Exact Windows product gate

수정 source가 직접 들어 있는 exact commit을 별도 non-mutating workflow가 checkout해 root `AGENTS.md`의 Product Compiler, Studio, Debug/Release export/Validator, CTest, Studio workflow, warnings-as-errors와 clang-tidy 명령을 모두 실행한다. 검증 branch의 workflow는 product PR에 병합하지 않는다.

## 수용 기준

- Product Runtime이 raw execution plan이 아니라 module-load prepared binding을 processor에 전달한다.
- callback에서 plan validation을 반복하지 않는다.
- callback이 binding의 buffer slots와 parameter IDs를 사용한다.
- invalid type/order/instance/buffer/endpoint/parameter/latency plan은 binding 생성 전에 fail closed한다.
- canonical `graph.garakbin` bytes와 Product/FUID/Parameter/state contract는 변하지 않는다.
- malformed automation regression이 기존 ignore-and-preserve 정책을 고정한다.
- Phase 3B realtime stress에서 allocation/deallocation `0`을 유지한다.
- obsolete one-time workflow가 current source tree에 남지 않는다.
- exact direct-source commit의 clean Windows full gate가 성공한다.
- 최종 PR diff에 self-modifying patch workflow나 generated source mutation이 없다.

## 리스크

- Parser와 callback responsibility를 섞으면 validation이 다시 realtime path로 유입될 수 있다. prepared binding type으로 경계를 고정한다.
- Runtime만 acceptance 범위를 넓히면 TypeScript decoder와 compatibility 판정이 어긋날 수 있다. current canonical contract보다 넓은 graph를 수용하지 않는다.
- Buffer slot을 사용한다는 명목으로 dynamic planner를 추가하면 현재 요구보다 복잡해진다. 정확히 두 slot의 stack table만 사용한다.
- Automation invalidity 정책을 변경하면 host behavior와 기존 state continuity가 달라질 수 있다. 이번 작업은 정책 변경 없이 회귀만 추가한다.

## 발견 사항

- 2026-09-02: PR #102의 successful Windows run은 actual correction source가 아니라 workflow-only predecessor commit을 검증했다. 해당 PR은 수용 근거가 아니며 closed 처리했다.
- 2026-09-02: Native parser는 16-bit type value를 range-check한 뒤 8-bit enum으로 cast하므로 알려진 current values의 high-byte alias를 직접 허용하지는 않는다. 그래도 wire/in-memory representation 불일치는 제거해 contract를 명확히 한다.

## 의사결정 로그

- 2026-09-02: 기존 PR을 고쳐 쓰지 않고 current main에서 새 direct-source branch를 시작했다. 실패한 self-modifying machinery를 current path로 보존하지 않기 위해서다.
- 2026-09-02: generic graph engine 대신 current Gain capability에 필요한 prepared binding만 구현하기로 했다.

## 완료 기록

아직 미완료다. Direct source implementation, local gates와 exact Windows acceptance가 남아 있다.

## 다음 단계

이 correction이 exact commit gate를 통과해 main에 병합된 뒤에만 ExecPlan 0014의 Phase 3C2 editable project schema v3를 재개한다.
