# Garak Current Status

- 기준일: 2026-08-22
- Branch: `main`
- 현재 작업: **ExecPlan 0011 — obsolete runtime spike 제거와 current Product Runtime 기준선 재확립**
- 판정: **HOLD — exact current-commit Windows gate 검증 중**

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

- editable project schema v2, strict legacy v1 migration
- immutable Product ID
- deterministic processor/controller FUID
- Gain ID `1001`, Bypass ID `1002`
- deterministic `GARAKCPD` v1
- product-bound `GARAKPST` v1
- durable save transaction, verified backup와 crash recovery
- compiled artifact `use-existing` / `rebuild` / `reject` policy
- future/foreign/corrupt data fail-closed behavior

## 기준선 cleanup

현재 source tree에서 다음 pre-release implementation을 제거했다.

- Phase 1A fixed Gain VST3 adapter와 build presets
- Phase 1B Data Runtime / Thin Runtime A/B modules
- runtime-strategy descriptor, tests와 packaging tools
- current Product Runtime build graph의 Phase 1A/1B dependency
- obsolete spike namespace/path를 사용하던 dead Product Runtime test

Reusable Gain processing은 `native/dsp/gain`, persistent contract는 `native/runtime/product_v1`, current VST3 integration은 `native/adapters/vst3/product_runtime_v1`에 있다.

Phase 1A/1B의 ADR, ExecPlan과 status report는 당시 판단의 역사적 증거로 남는다. 그 문서에 기록된 삭제된 command, preset, target, script와 bundle은 현재 실행 경로가 아니다.

## 완료 판정 규칙

정확한 current `main` commit의 `garak/windows-foundation` status만 권위 있는 완료 증거다. Gate는 clean Windows checkout에서 다음을 모두 수행한다.

- Product Compiler와 Studio quality/test/build
- exact recursive SDK checkout
- first-party C++ format
- Debug/Release Product Runtime clean build
- Warm/Bright actual export와 official standard/extensive validation
- current loaded-module/inspector CTest
- actual Studio ProductService Debug/Release workflow
- warnings-as-errors와 clang-tidy
- tracked source mutation 0

현재 cleanup commit의 gate가 green이 되기 전에는 Phase 3를 시작하지 않는다.

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

- exact current cleanup commit의 Windows foundation success
- static DSP graph와 node library
- macro system와 functional Sound/Control workspace
- native interface designer
- preset/asset packaging
- packaged Studio와 clean-system installer
- representative DAW matrix와 long-run audio stress/quality acceptance
- backup retention/pruning와 advanced manual recovery
- macOS Universal VST3, AU, signing과 notarization
- legal/trademark/security review와 repository license decision

정확한 다음 product capability milestone은 cleanup gate가 green인 경우에만 시작하는 **Phase 3A — Minimal Static DSP Graph and Compiled Execution Plan**이다.
