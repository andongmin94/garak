# Garak Current Status

- 기준일: 2026-08-23
- Branch: `main`
- Phase 3A: **PASS / Complete — Windows x64**
- Verified implementation commit: `27e21307830edf5a6849a3bc96d6ef7ad044cacd`
- Authoritative Windows run: `32617339447`
- Status context: `garak/windows-foundation` — **success**
- 다음 milestone: **Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress**

## 실제 current product path

```text
unpacked .garak
→ Product Compiler validation/migration
→ deterministic product.garakbin
→ prebuilt Garak Product Runtime v1
→ immutable native Input → Gain → Output execution plan
→ product-specific moduleinfo.json
→ local Windows x64 VST3
→ inspector + official validator + loaded-module tests
```

Studio는 current/legacy project 생성·열기·검증·저장·migration·conflict/recovery와 Debug/Release export를 main-owned typed capability로 수행한다. Renderer에는 Node.js, filesystem, shell, process 또는 raw IPC 권한이 없다.

## 구현된 persistent contract

- editable project schema v2와 strict legacy v1 migration
- immutable Product ID
- deterministic processor/controller FUID
- Gain ID `1001`, Bypass ID `1002`
- deterministic `GARAKCPD` v1
- product-bound `GARAKPST` v1
- durable save transaction, verified backup와 crash recovery
- compiled artifact `use-existing` / `rebuild` / `reject` policy
- future/foreign/corrupt data fail-closed behavior

Phase 3A는 위 persistent bytes와 ID를 변경하지 않았다.

## Phase 3A 감사와 정리

최초 Phase 3A increment는 TypeScript에서 node, edge와 operation을 중복 표현한 graph codec을 만들었지만 Product Compiler export나 Native Runtime에서 사용하지 않았다. 해당 `main`은 Product Compiler formatter gate도 실패했다.

감사 후 다음처럼 정리했다.

- unused TypeScript graph compiler/serializer/test 제거
- 임시 formatter artifact workflow 제거
- `graph.garakbin` 도입 취소
- `native/runtime/static_graph`에 세 operation의 immutable plan만 추가
- Product Runtime processor가 그 plan을 통해 production Gain DSP 실행
- plan order, parameter/buffer binding과 latency unit regression 추가
- 삭제된 Phase 1A/1B 실험 FUID 10개의 current compiler reservation 제거
- generic registry, heap planner, dynamic graph와 persistent graph format 미도입

현재 plan은 다음 하나다.

```text
Audio Input
→ Gain (Gain 1001 / Bypass 1002)
→ Audio Output
```

## Authoritative gate 결과

Run `32617339447`에서 다음 job과 모든 하위 step이 성공했다.

### Product Compiler and Studio

- frozen dependency install
- repository LF/whitespace
- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/production build
- tracked source mutation 0

### Native Product Runtime and real export path

- exact recursive SDK pins
- first-party C++ format
- Debug Product Runtime clean build
- Warm/Bright Debug actual export와 official validation
- Debug CTest와 static-plan/loaded-module regression
- actual Studio Debug product workflow
- Release Product Runtime clean build
- Warm/Bright Release actual export와 official validation
- Release CTest와 static-plan/loaded-module regression
- actual Studio Release product workflow
- warnings-as-errors
- clang-tidy
- tracked source mutation 0

완료 판정은 문서상의 과거 test 수가 아니라 정확한 current implementation commit의 `garak/windows-foundation` status를 따른다.

## 이번 감사에서 제거한 불필요한 복잡도

- 실행되지 않는 cross-language graph codec과 220-byte 계획 포맷
- node/edge/operation의 중복 직렬화
- CI 진단용 temporary artifact workflow
- 삭제된 pre-release spike FUID reservation과 collision branch
- current product path에서 사용하지 않는 future graph resource 설계

과거 Phase 1A/1B의 ADR, ExecPlan과 status report는 역사적 판단 근거로만 보존한다. 실행 구현이나 compatibility fallback은 복구하지 않는다.

## 아직 검증되지 않은 핵심 항목

- process-thread allocation/deallocation의 실제 계측
- blocking/wait의 runtime 계측
- 장시간 randomized block/automation/state stress
- representative DAW scan/load/save/reopen matrix
- packaged Studio와 clean-system installer
- editable graph source와 persistent compiled graph
- additional DSP node와 macro system
- native interface designer
- preset/asset packaging
- backup retention/pruning와 advanced manual recovery
- macOS Universal VST3, AU, signing과 notarization
- legal/trademark/security review와 repository license decision

Phase 1B에서는 realtime path source audit는 수행했지만 별도 allocation/blocking 계측은 수행하지 않았다. 따라서 다음 단계는 새 node 추가보다 계측과 장시간 stress를 우선한다.

## Source of truth

- [ExecPlan 0012](../../plans/0012-phase-3a-minimal-static-dsp-graph.md)
- [Repository constitution](../../AGENTS.md)
- [Roadmap](../../ROADMAP.md)
- [Current VST3 adapter](../architecture/vst3-adapter.md)
- [Runtime and export](../architecture/runtime-and-export.md)
- [Project persistence](../architecture/project-persistence-service.md)
- [Compiled/state compatibility](../architecture/compiled-and-state-compatibility.md)

## 다음 단계

`Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress`

이 단계가 green이 된 뒤에만 editable graph contract 또는 additional DSP node로 넘어간다.
