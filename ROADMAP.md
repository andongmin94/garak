# Garak Roadmap

- 기준일: 2026-09-02
- Branch: `main`
- Phase 3B historical Windows foundation: **PASS**
- Phase 3B verified implementation: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- Phase 3C1 accepted main: `1666c667e6e635447b387a5e25bcce7ef1ee42e5`
- Phase 3C1 exact verified source: `837e01ef96c11800b246a50eff92c4599e630080`
- Phase 3C1 clean Windows run: `33610351357`
- Phase 3C1 status: **PASS / Complete**
- Phase 3C2 exact verified source: `b727afb4cd1471dbd61ce775355be60e040c7000`
- Phase 3C2 clean Windows run: `33622226202`
- Phase 3C2 status: **PASS / Complete**
- Phase 3C3 exact verified source: `d60667d8806e5dac7963ae928dcf98dc377cf0f7`
- Phase 3C3 clean Windows run: `33657806095`
- Phase 3C3 status: **PASS / Complete**
- Current Phase 3C status: **PASS / Complete**
- 다음 gate: **Phase 3D — Initial DSP Node Set ExecPlan**

이 roadmap은 기능 목록을 미리 쌓는 문서가 아니다. 각 milestone은 직전의 실제 end-to-end 제품 경로가 clean checkout에서 통과한 뒤에만 다음 층으로 진행한다.

## 실행 원칙

- 현재 Windows x64 VST3 vertical slice를 항상 동작 가능한 상태로 유지한다.
- editable source, compiled data와 runtime execution의 경계를 분리한다.
- Product Runtime은 process-wide이고 product data만 제품별로 compile한다.
- persistent Product/FUID/Parameter ID와 지원 schema/state는 명시적 migration으로 보존한다.
- 사용하지 않는 serializer, resource와 abstraction을 미래 기능이라는 이유로 먼저 추가하지 않는다.
- 큰 변경 전 별도 ExecPlan을 작성한다.
- 검증 근거는 exact source commit의 clean Windows command 결과로 남긴다.

---

## Phase 0A — Repository Foundation — Complete

목표:

- repository layout
- `AGENTS.md`, `PLANS.md`, architecture/ADR 문서
- CMake와 pnpm workspace
- CI/build/test foundation

완료 기준:

- Native, Studio와 Product Compiler source boundary가 분리됨
- 기본 quality scripts가 동작함

---

## Phase 0B — Buildable Native and Studio Scaffolds — Complete

목표:

- C++20 Native scaffold
- Electron + React + TypeScript Studio scaffold
- first-party warning policy
- pinned VST3 SDK dependency

완료 기준:

- Native Debug/Release build와 test
- Studio lint/typecheck/test/build
- dependency provenance와 notice record

---

## Phase 1A — Minimal Windows VST3 Gain Shell — Historical only

결론:

- fixed Gain VST3 spike
- mono/stereo Float32/Float64
- Gain/Bypass automation
- state round-trip
- official Validator

현재 상태:

- spike source와 build target은 제거됨
- historical validation 문서만 보존

---

## Phase 1B — Generated Runtime Strategy A/B Spike — Historical only

결론:

- Data / Thin A/B 실험 완료
- Phase 2B에서 prebuilt Product Runtime data strategy 선택

현재 상태:

- spike source, packaging scripts와 FUID reservations 제거
- historical plans와 status만 보존

---

## Phase 1C1 — Product Contracts and Headless Windows Export — Complete

목표:

- unpacked `.garak` project
- immutable Product ID
- deterministic processor/controller FUID
- permanent Gain `1001` / Bypass `1002`
- `GARAKCPD` v1 compiled product data
- prebuilt Product Runtime bundle export
- first-party inspector + official Validator

완료 기준:

- Warm/Bright fixtures export independently
- Product/FUID/default/state isolation
- exact bundle inventory/hash parity
- atomic publish와 failure rollback

---

## Phase 1C2 — Studio Product Workspace and Export UX — Complete

목표:

- Studio create/open/export workflow
- main-owned filesystem and child-process boundary
- product metadata/default editing
- structured validation/export errors

완료 기준:

- renderer는 typed capability만 사용
- Studio product workflow가 Debug/Release actual export를 검증

---

## Phase 2A — Editable Project Schema and Deterministic Migration — Complete

목표:

- schema v2
- explicit `schema` object와 immutable Product ID
- strict v1→v2 migration
- canonical serializer
- fixture/output/hash oracle

완료 기준:

- legacy open은 source를 자동 overwrite하지 않음
- Product/FUID/Parameter/default/export parity 유지

---

## Phase 2B1 — Durable Project Persistence Core — Complete

목표:

- atomic temp-write/replace
- verified backup
- crash recovery
- exact saved bytes와 persisted fingerprint

완료 기준:

- save failure 시 existing source와 verified backup 보존
- recovery는 strict project validator 재통과

---

## Phase 2B2 — Studio-owned Evolution UX — Complete

목표:

- main-owned migration decision
- external modification conflict
- recovery source disclosure
- Save/Save As 명시성

완료 기준:

- renderer는 source path와 backup path를 직접 조작하지 않음
- migration/conflict/recovery UI가 product service result를 그대로 반영

---

## Phase 2C — Compiled Artifact and Plug-in State Compatibility — Complete

목표:

- compiled product current/legacy/future disposition
- state current/product mismatch/future rejection
- `use-existing` / `rebuild` / `reject`

완료 기준:

- capability/CLI/test fixture가 같은 disposition 사용
- Product ID와 Parameter ID contract 유지

---

## Phase 3A — Minimal Native Static DSP Execution Plan — Complete

목표:

- SDK-independent Gain DSP module
- immutable Input→Gain→Output plan
- actual processor dispatch
- mono/stereo Float32/Float64 parity
- Gain interpolation, exact-offset Bypass와 silence propagation

완료 기준:

- production Product Runtime이 plan을 실제 사용
- direct kernel/plan/loaded module inspector test
- Debug/Release actual export/Validator 통과

---

## Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress — Complete

목표:

- first-party allocation instrumentation
- process-window allocation/deallocation `0`
- deterministic long-run Float32/Float64 stress
- output/state/silence parity
- timeout-bounded CTest registration

검증 근거:

- exact source commit: `4b2535deba302eddab86c5c02b165e8d4f168cf4`
- historical Windows run: `32634527751`
- Float32: 20,000 blocks, 1,919,504 channel-samples, allocation/deallocation `0`
- Float64: 20,000 blocks, 1,919,504 channel-samples, allocation/deallocation `0`

Phase 3B는 **Complete**다.

---

## Phase 3C — Editable Static Graph Project Contract and Compiled Plan — Complete

Phase 3C는 [`plans/0014-phase-3c-editable-static-graph-contract.md`](plans/0014-phase-3c-editable-static-graph-contract.md)를 따른다.

### Phase 3C1 — Runtime-consumed compiled graph resource — Complete

구현:

- deterministic `graph.garakbin` v1
- export bundle required graph resource
- first-party inventory/hash parity
- Native module-load parser
- product+graph shared immutable Runtime context
- actual processor dispatch가 loaded graph plan 사용
- missing/truncated/trailing/reserved/future/noncanonical graph fail-closed

검증 근거:

- accepted main: `1666c667e6e635447b387a5e25bcce7ef1ee42e5`
- exact verified source: `837e01ef96c11800b246a50eff92c4599e630080`
- clean Windows run: `33610351357`
- Product Compiler와 Studio format/lint/typecheck/test/build success
- Debug/Release Product Runtime build, actual Warm/Bright export, official Validator success
- Debug/Release CTest와 Studio product workflow success
- warnings-as-errors와 clang-tidy success
- Float32/Float64 realtime allocation/deallocation `0`
- tracked source mutation `0`

Correction 이후 Runtime은 graph를 module load에서 private immutable binding으로 준비하고 callback은 해당 binding의 buffer slot과 Parameter ID를 실제 dispatch에 사용한다. Phase 3C1은 **Complete**다. 다음 increment는 schema v3 editable graph source다.

### Phase 3C2 — Editable project schema v3 — Complete

구현:

- project schema v3와 embedded graph source v1
- exact three-node/two-connection validator
- deterministic v1→v2→v3와 v2→v3 migration
- canonical serializer와 legacy v1/v2/current v3 fixed oracles
- `project.graph`에서 deterministic `GARAKGRF` v1 compile
- Studio main-owned graph create/open/save/reopen/migrate round-trip
- invalid current graph의 export-before-output fail-closed

검증 근거:

- exact verified source: `b727afb4cd1471dbd61ce775355be60e040c7000`
- clean Windows run: `33622226202`
- Product Compiler와 Studio format/lint/typecheck/test/build success
- Debug/Release Runtime clean build, actual Warm/Bright export와 official Validator success
- Debug/Release CTest와 Studio product workflow success
- warnings-as-errors와 clang-tidy success
- tracked-source mutation `0`

Phase 3C2는 **Complete**다. Phase 3C 전체는 Phase 3C3 compatibility와 final product gate가 남아 있어
계속 In Progress다.

### Phase 3C3 — Compatibility and full product gate — Complete

구현:

- current/missing/old/future/corrupt compiled graph classification
- Product Compiler compatibility API/CLI report
- Native binding-bearing classifier
- shared Product Runtime/inspector resource reader
- TypeScript/C++ fixture and filesystem parity regressions

검증 근거:

- exact verified source: `d60667d8806e5dac7963ae928dcf98dc377cf0f7`
- clean Windows run: `33657806095`
- Product Compiler/Studio quality gates success
- Debug/Release actual Warm/Bright export and official Validator success
- Debug/Release CTest and Studio workflow success
- warnings-as-errors and clang-tidy success
- tracked-source mutation `0`

Phase 3C is **Complete**. Phase 3D starts under a separate ExecPlan.
---

## Phase 3D — Initial DSP Node Set — Planned

Phase 3C 완료 뒤 별도 ExecPlan으로 시작한다.

목표:

- Pan
- Polarity
- Dry/Wet
- Biquad
- Tilt EQ
- Saturation
- node metadata와 parameter declaration

수용 기준:

- 각 node direct DSP test
- graph compilation/execution regression
- no-allocation realtime stress
- actual exported product verification

---

## Phase 4 — Parameter and Macro System — Planned

목표:

- stable exposed Parameter IDs
- node/internal parameter mapping
- macro source → target transforms
- renamed display text와 immutable identity 분리
- preset/state compatibility

---

## Phase 5 — Visual Sound and Control Studio — Planned

목표:

- graph canvas
- node palette
- typed ports
- selection, pan/zoom, undo/redo
- inspector
- internal control/macro authoring
- product workspace integration

---

## Phase 6 — Interface Designer and Native Generated UI — Planned

목표:

- native plug-in editor
- generated interface resources
- control mapping
- branding, typography, assets와 responsive layout
- editorless fallback policy 또는 supported UI requirement

---

## Phase 7 — Presets and Product Packaging — Planned

목표:

- preset schema와 browser
- migration-aware product preset state
- embedded assets
- user content location
- white-label metadata and product packaging

---

## Phase 8 — Studio Packaging and Windows Productization — Planned

목표:

- packaged Studio artifact
- clean-system Windows installer
- runtime toolchain discovery
- signing-ready export
- support diagnostics와 redistribution review

---

## Phase 9 — DAW Matrix and Audio Quality — Planned

목표:

- representative Windows DAWs
- plug-in scan/rescan
- automation and preset restore
- block-size/sample-rate variation
- denormal/NaN/extreme automation
- subjective and objective audio checks

---

## Phase 10 — macOS Universal VST3 and AU — Planned

목표:

- Universal Binary
- VST3
- AUv2 or AUv3 decision
- signing, hardened runtime and notarization
- platform-specific bundle validation

---

## Backlog — Later Product Layers

- AAX feasibility
- offline render and batch audition
- cloud preset/library exchange
- collaboration/version history
- generated SDK/extensions
- large-graph optimization and multithread scheduling

이 backlog는 현재 architecture를 미리 복잡하게 만들 이유가 아니다.
