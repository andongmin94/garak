# Garak Current Status

- 기준일: 2026-08-23
- Branch: `main`
- 기준선 cleanup: **PASS / Complete**
- Verified implementation/documentation commit: `edf4ddb561edd317f001418c9d2935bbb35fc666`
- Authoritative Windows run: `32580085187`
- Status context: `garak/windows-foundation` — **success**
- 다음 milestone: **Phase 3A — Minimal Static DSP Graph and Compiled Execution Plan**

## 실제 current product path

```text
unpacked .garak
→ Product Compiler validation/migration
→ deterministic product.garakbin
→ prebuilt Garak Product Runtime v1
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

## 완료된 기준선 cleanup

다음 pre-release implementation을 current source tree와 build graph에서 제거했다.

- Phase 1A fixed Gain VST3 adapter와 presets
- Phase 1B Data Runtime / Thin Runtime A/B modules
- runtime-strategy descriptor, tests와 packaging tools
- Product Runtime의 Phase 1A/1B dependency
- 삭제된 spike header를 참조하던 dead Product Runtime test

Reusable Gain processing은 `native/dsp/gain`, persistent contract는 `native/runtime/product_v1`, current VST3 integration은 `native/adapters/vst3/product_runtime_v1`에 있다.

Phase 1A/1B의 ADR, ExecPlan과 status report는 당시 판단의 역사적 증거로 남는다. 그 문서에 기록된 삭제된 command, preset, target, script와 bundle은 현재 실행 경로가 아니다.

## Authoritative gate 결과

Run `32580085187`에서 다음 job과 모든 하위 step이 성공했다.

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
- Debug CTest
- actual Studio Debug product workflow
- Release Product Runtime clean build
- Warm/Bright Release actual export와 official validation
- Release CTest
- actual Studio Release product workflow
- warnings-as-errors
- clang-tidy
- tracked source mutation 0

완료 판정은 앞으로도 문서상의 과거 test 수가 아니라 정확한 current commit의 `garak/windows-foundation` status를 따른다.

## Source of truth

- [ExecPlan 0011](../../plans/0011-remove-obsolete-runtime-spikes.md)
- [Repository constitution](../../AGENTS.md)
- [Roadmap](../../ROADMAP.md)
- [Current VST3 adapter](../architecture/vst3-adapter.md)
- [Runtime and export](../architecture/runtime-and-export.md)
- [Project persistence](../architecture/project-persistence-service.md)
- [Compiled/state compatibility](../architecture/compiled-and-state-compatibility.md)
- [Windows v0.x Runtime decision](../adr/0005-windows-v0x-prebuilt-product-runtime.md)
- [Compiled/state compatibility decision](../adr/0010-compiled-product-and-state-compatibility.md)

## Open product and release gates

- static DSP graph와 node library
- macro system와 functional Sound/Control workspace
- native interface designer
- preset/asset packaging
- packaged Studio와 clean-system installer
- representative DAW matrix와 long-run audio stress/quality acceptance
- backup retention/pruning와 advanced manual recovery
- macOS Universal VST3, AU, signing과 notarization
- legal/trademark/security review와 repository license decision

Phase 3A는 아직 구현하지 않았다. Windows cleanup 기준선이 green이므로 별도 ExecPlan으로 시작할 수 있다.
