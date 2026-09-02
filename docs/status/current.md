# Garak Current Status

- 기준일: 2026-09-01
- Branch: `main`
- Source of truth: current source tree, this file and `ROADMAP.md`

## 현재 판단

Garak의 현재 production 경로는 **product-bound prebuilt Product Runtime v1**이다.

```text
.garak project
  -> Product Compiler
  -> product.garakbin + graph.garakbin
  -> prebuilt Garak Product Runtime v1
  -> product-specific moduleinfo.json
  -> product-bound local VST3 bundle
  -> first-party inspector
  -> official VST3 Validator
```

Native Runtime은 C++20이며 생성된 VST3에는 Electron, Chromium, Node.js 또는 JavaScript runtime이 포함되지 않는다.
현재 exported Product Runtime은 editorless mono/stereo Float32/Float64 Gain/Bypass effect다.

## 현재 검증 기준선

Phase 3B의 전체 Windows 검증은 historical realtime-safety 기준선이다.

- verified implementation commit: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- historical workflow run: `32634527751`
- Product Compiler와 Studio quality gates success
- Debug/Release actual export와 official Validator success
- CTest, Studio product workflow, Werror와 clang-tidy success
- Float32/Float64 각각 20,000 blocks, 1,919,504 channel-samples
- first-party realtime process window allocation `0`, deallocation `0`
- output/state/silence mismatch `0`

Phase 3C1의 export/resource foundation은 commit `48807fd56e72fdae7192956bf90d6a4ed4b83572`에 반영됐고, exact source commit `510f906f45924ad4ef035f6598fc193c25eed245`를 clean Windows checkout에서 검증했다.

- historical foundation verification run: `33455352188`
- Product Compiler와 Studio format/lint/typecheck/test/build success
- Debug/Release Product Runtime clean build success
- Warm/Bright actual export와 official VST3 Validator success
- Debug/Release CTest와 Studio product workflow success
- warnings-as-errors와 clang-tidy success
- tracked source mutation `0`

2026-09-02 code audit에서 callback이 raw plan을 다시 canonical constant와 비교한 뒤 기존 Gain DSP를 호출하던 경계를 보정했다.

- corrected implementation commit: `8d3461f2e79f38b6e4268d852614eed496b46c82`
- correction verification run: `33602728928`
- module load에서 `graph.garakbin`을 private immutable `GainExecutionBinding`으로 parse/validate
- callback은 binding의 input/output buffer slot과 Gain/Bypass Parameter ID를 실제 routing과 queue lookup에 사용
- wire의 16-bit operation type과 Native enum 폭을 일치시키고 high-byte unknown type을 fail closed
- malformed automation과 binding execution focused regression 추가
- Float32/Float64 20,000-block realtime allocation/deallocation `0` 유지
- obsolete source snapshot workflow 제거

따라서 **Phase 3C1 corrected implementation은 PASS / Complete**다. Product branch에는 patch runner나 source-mutating workflow를 보존하지 않는다. Phase 3C 전체는 editable schema v3와 compatibility/full product gate가 남아 있어 여전히 In Progress다.

## 현재 지원 계약

### Project와 migration

- Current editable project schema는 v2다.
- `.garak` inventory는 physical `product.json` 한 파일이다.
- legacy schema v1은 strict deterministic v2 migration을 거쳐야 한다.
- Product ID는 create 시 생성되고 migration/save/export에서 immutable이다.
- Studio main process가 inspection, migration, save, recovery와 export authority를 가진다.
- renderer는 typed capability 외 filesystem 또는 child-process 권한을 가지지 않는다.

### Persistence

- migration은 source project를 자동 overwrite하지 않는다.
- persistent save는 atomic temp-write와 verified backup transaction을 사용한다.
- open/migrate/conflict/recovery decision은 Electron main이 소유한다.
- exact saved bytes와 persisted SHA-256 fingerprint를 conflict detection에 사용한다.
- crash recovery는 last verified backup의 strict reopen으로만 수행한다.
- 자동 백업 pruning과 임의 이전 버전 rollback은 아직 구현하지 않았다.

### Compiled artifacts와 state

- compiled product format은 `GARAKCPD` 1.0이다.
- compiled graph format은 `GARAKGRF` 1.0이다.
- plug-in state format은 `GARAKPST` 1.0이다.
- current Runtime은 major 1만 지원한다.
- compiled current exact, compiled legacy rebuild, compiled future reject 정책을 적용한다.
- state restore는 exact Product ID와 supported state major가 필요하다.
- Product ID/FUID/Parameter ID는 published compatibility contract다.
- current Parameter IDs는 Gain `1001`, Bypass `1002`다.

### Export와 Runtime

- Product Compiler가 `product.garakbin`, `graph.garakbin`과 moduleinfo를 결정적으로 생성한다.
- export는 runtime source path 대신 existing prebuilt Product Runtime binary를 복사한다.
- Product Runtime은 module load에서 compiled product와 graph를 검증하고 private immutable execution binding을 processor에 전달한다.
- graph resource가 missing/corrupt/unsupported이면 factory를 공개하지 않는다.
- official Validator를 temporary environment에서 실행한 뒤 final bundle을 atomic publish한다.
- final export inventory와 staged bytes의 hash parity를 검사한다.

### Realtime

- current graph는 `Input → Gain → Output` exact three-operation plan이다.
- processor는 module-load prepared immutable binding의 buffer slot과 Parameter ID로 existing Gain kernel을 dispatch한다.
- Float32와 Float64 processing을 지원한다.
- mono와 stereo arrangement를 지원한다.
- Gain은 sample-accurate interpolation, Bypass는 exact-offset step 정책을 사용한다.
- process window에서는 heap allocation, free, mutex, file I/O, logging과 graph mutation을 금지한다.
- test storage와 point sources는 process window 전에 fixed-size stack storage로 준비한다.

## Phase 진행 상태

### Phase 0A / 0B — Complete

Repository foundation, source policy, Product Compiler/Studio/Native scaffolds와 pinned VST3 SDK가 완료됐다.

### Phase 1A / 1B — Historical only

Fixed Gain spike와 Data/Thin A/B runtime spike는 결론을 얻은 뒤 active source/build graph에서 제거했다.
Historical plans와 status만 보존한다.

### Phase 1C1 / 1C2 — Complete

- product-bound local VST3 export
- deterministic Product/FUID identity
- compiled product resource
- Studio create/open/export workflow

### Phase 2A / 2B1 / 2B2 / 2C — Complete

- strict editable project migration
- durable save와 verified backup
- Studio-owned migration/conflict/recovery UX
- compiled/state compatibility policy

### Phase 3A — Complete

Production Gain DSP가 actual processor dispatch에 연결됐다.

### Phase 3B — Complete

Separate realtime stress target이 production static plan/Gain DSP의 output/state/silence parity와 allocation-free behavior를 검증한다.

### Phase 3C — In Progress

#### 3C1 — Runtime-consumed compiled graph resource — Complete

- deterministic `graph.garakbin` v1
- actual export inventory와 hash parity
- Native module-load parser
- product+graph shared immutable Runtime context
- processor는 loaded plan으로 actual Gain kernel dispatch
- missing/corrupt/unsupported graph fail-closed
- resource foundation commit `510f906f45924ad4ef035f6598fc193c25eed245`와 corrected implementation commit `8d3461f2e79f38b6e4268d852614eed496b46c82`의 clean Windows full gate success

#### 3C2 — Editable project schema v3 — Next

- versioned editable graph source
- strict graph validator
- deterministic v2→v3 migration
- Studio document/draft round-trip
- Warm/Bright fixture migration

#### 3C3 — Compatibility and full product gate — Pending

- graph compatibility disposition
- Product Compiler/Runtime/inspector parity
- final Debug/Release/Validator/CTest/Werror/clang-tidy gate

## 명시적으로 아직 완료하지 않은 영역

- additional DSP nodes beyond Gain
- arbitrary DAG, split/merge, feedback와 sidechain
- macro/control mapping
- functional Sound/Control workspaces
- Interface Designer와 native plug-in editor
- preset/asset product packaging
- packaged Studio와 clean-system installer
- representative DAW matrix와 audio quality gate
- macOS Universal VST3/AU, signing과 notarization
- backup retention/pruning과 advanced manual recovery
- repository/commercial redistribution license decision

## 다음 작업

1. [`plans/0014-phase-3c-editable-static-graph-contract.md`](../../plans/0014-phase-3c-editable-static-graph-contract.md)의 **Phase 3C2**를 진행한다.
2. Project schema v3의 exact graph source contract와 strict validator를 정의한다.
3. v2→v3 migration, canonical serializer와 Studio document/draft round-trip을 구현한다.
4. Phase 3C3 compatibility matrix와 final full Windows product gate를 완료한다.
5. Phase 3C 완료 뒤 별도 ExecPlan으로 Phase 3D initial DSP node set을 시작한다.
