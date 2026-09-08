# Garak Roadmap

- 기준일: 2026-09-08
- Branch: `main`
- Current accepted milestone: **Phase 3D1 — Polarity Node, PASS / Complete**
- Phase 3D1 exact verified source: `96ba29cf009eab00980405d7de456b5f1d431956`
- Phase 3D1 clean acceptance run: `34193494228`
- 다음 gate: **Phase 3D2 — 별도 ExecPlan 작성 후 하나의 추가 node를 end-to-end로 수용**

이 roadmap은 기능 목록을 미리 구현하는 문서가 아니다. 각 milestone은 직전의 실제 제품 경로가 clean checkout에서 통과한 뒤에만 다음 층으로 진행한다.

## 실행 원칙

- Windows x64 VST3 vertical slice를 항상 동작 가능한 상태로 유지한다.
- editable source, deterministic compiled data와 realtime Runtime execution의 경계를 분리한다.
- Product Runtime은 prebuilt process-wide implementation이고 product data만 제품별로 compile한다.
- persistent Product/FUID/Parameter ID와 released schema/state 의미는 명시적 migration/version policy로 다룬다.
- obsolete internal API는 compatibility shim 없이 제거한다.
- 미래 기능을 위한 registry, arbitrary DAG, placeholder serializer 또는 speculative scheduler를 미리 추가하지 않는다.
- 큰 변경 전 ExecPlan을 작성한다.
- 완료 근거는 exact source commit의 clean Linux/Windows command 결과로 남긴다.

---

## Phase 0A — Repository Foundation — Complete

Repository layout, constitution/architecture docs, CMake/pnpm workspace와 기본 quality foundation을 확립했다.

## Phase 0B — Buildable Native and Studio Scaffolds — Complete

C++20 Native scaffold, Electron/React/TypeScript Studio scaffold, first-party warning policy와 pinned VST3 SDK dependency를 확립했다.

## Phase 1A — Minimal Windows VST3 Gain Shell — Historical only

Fixed Gain VST3 spike로 host automation/state/Validator feasibility를 검증했다. Spike source와 build target은 제거됐고 historical evidence만 남긴다.

## Phase 1B — Generated Runtime Strategy A/B Spike — Historical only

Data/Thin runtime 전략을 비교했고 Phase 2B에서 prebuilt Product Runtime + product data 전략을 선택했다. Spike source와 packaging path는 제거됐다.

## Phase 1C1 — Product Contracts and Headless Windows Export — Complete

Immutable Product ID, deterministic processor/controller FUID, Gain `1001`, Bypass `1002`, `GARAKCPD` 1.0, atomic headless VST3 export와 first-party inspector/official Validator를 수용했다.

## Phase 1C2 — Studio Product Workspace and Export UX — Complete

Studio create/open/save/export를 Electron main의 typed capability boundary로 연결하고 renderer에서 filesystem/shell/raw IPC를 제거했다.

## Phase 2A — Editable Project Schema and Deterministic Migration — Complete

Versioned editable source, canonical serialization과 explicit migration foundation을 수용했다.

## Phase 2B1 — Durable Project Persistence Core — Complete

Atomic publication, verified backup, crash recovery와 persistent fingerprint를 수용했다.

## Phase 2B2 — Studio-owned Evolution UX — Complete

Migration decision, external modification conflict, recovery disclosure와 Save/Save As ownership을 Studio main에 두었다.

## Phase 2C — Compiled Artifact and Plug-in State Compatibility — Complete

Compiled product와 product-bound state의 current/old/future/foreign/corrupt disposition을 fail-closed로 수용했다.

---

## Phase 3A — Minimal Native Static DSP Execution Plan — Complete

SDK-independent Gain DSP, immutable Input→Gain→Output plan과 production processor dispatch를 수용했다.

## Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress — Complete

- exact source: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- Windows run: `32634527751`
- allocation/deallocation `0` long-run regression foundation

## Phase 3C — Editable Static Graph Project Contract and Compiled Plan — Complete

### Phase 3C1 — Runtime-consumed compiled graph — Complete

- exact verified source: `837e01ef96c11800b246a50eff92c4599e630080`
- clean Windows run: `33610351357`
- deterministic graph resource, module-load parse/binding, actual processor dispatch

### Phase 3C2 — Editable schema v3 — Complete

- exact verified source: `b727afb4cd1471dbd61ce775355be60e040c7000`
- clean Windows run: `33622226202`
- project schema v3 / historical graph source v1, strict validation/migration, source-derived graph compile

### Phase 3C3 — Compiled graph compatibility — Complete

- exact verified source: `d60667d8806e5dac7963ae928dcf98dc377cf0f7`
- clean Windows run: `33657806095`
- current/missing/old/future/corrupt graph disposition shared by Product Compiler, Runtime and inspector

---

## Phase 3D — Initial DSP Node Set — In Progress

Phase 3D는 node를 한꺼번에 구현하지 않는다. 각 node를 source → compiler → Runtime → actual export의 working vertical slice로 수용한 뒤 다음 node를 선택한다.

### Phase 3D1 — Polarity Node — Complete

활성 계획이었던 [`plans/0018-phase-3d1-polarity-node.md`](plans/0018-phase-3d1-polarity-node.md)는 완료됐다.

수용된 구현:

- parameterless `garak.polarity` implementation version 1
- project schema v4 / graph source v2
- ordered v3→v4 migration
- exact Gain-only 또는 Gain→Polarity source validation
- deterministic `GARAKGRF` 1.1, 3-op/4-op exact plans
- `StaticExecutionPlan` / `StaticExecutionBinding`
- whole-product sample-accurate Bypass
- allocation-free fused Polarity active transform
- `Artist Gain Inverted` reference product
- Warm/Bright/Inverted Debug/Release actual VST3 export
- first-party inspector와 official VST3 Validator
- Product Compiler/Studio/Linux Native/MSVC `/WX`/Windows clang-tidy/clean-tree full gate

검증 근거:

- exact verified source: `96ba29cf009eab00980405d7de456b5f1d431956`
- clean Linux + Windows run: `34193494228`

### Phase 3D2 — Not started

다음 node는 별도 ExecPlan을 먼저 작성한 뒤 시작한다. 후보는 Pan, Dry/Wet, Biquad, Tilt EQ, Saturation이다. 선택 전에는 이들을 위한 public parameter, macro system, generic node registry 또는 arbitrary scheduler를 추가하지 않는다.

---

## Phase 4 — Parameter and Macro System — Planned

Stable exposed Parameter IDs, node/internal parameter mapping, macro transforms, smoothing과 preset/state compatibility를 다룬다.

## Phase 5 — Visual Sound and Control Studio — Planned

Graph canvas, node palette, typed ports, inspector, undo/redo와 product workspace integration을 다룬다.

## Phase 6 — Interface Designer and Native Generated UI — Planned

Native plug-in interface scene, controls/meters와 generated native UI를 다룬다.

## Later release layers — Planned

Presets/assets, packaging, installer/signing, representative DAW matrix, macOS Universal VST3/AU와 notarization은 core product path가 충분히 성숙한 뒤 별도 milestones로 진행한다.
