# ExecPlan 0017 — Phase 3C3 Compiled Graph Compatibility and Final Product Gate

- Status: Complete
- Started: 2026-09-02
- Updated: 2026-09-02
- Owner: Product Compiler, Native static graph Runtime and VST3 product inspector

## 목적

`graph.garakbin`의 compatibility disposition을 Product Compiler, Native Runtime, first-party inspector와 test fixture에서 동일하게 정의하고 실제 제품 경로에 적용한다. Phase 3C1의 Runtime-consumed compiled graph와 Phase 3C2의 editable graph source를 하나의 명시적 current/missing/old/future/corrupt 정책으로 닫고, exact final source commit의 clean Windows 전체 제품 gate를 통과해 Phase 3C를 완료한다.

## 사용자 가치

사용자는 derived compiled graph가 없거나 오래된 경우 editable `.garak` source에서 안전하게 재생성할 수 있고, future 또는 손상된 graph가 현재 형식으로 잘못 해석되거나 조용히 대체되지 않는다는 보장을 얻는다. Export, compatibility CLI, inspector와 deployed Runtime이 같은 artifact를 서로 다르게 판정하지 않는다.

## 현재 저장소 상태

- Starting `main`: `0ec4792fefc14144bc32279a2137c0583c9d3ff6`
- Phase 3C2 merge PR: `#105`
- Phase 3C2 exact verified implementation: `b727afb4cd1471dbd61ce775355be60e040c7000`
- Phase 3C2 implementation Windows run: `33622226202`
- Phase 3C2 final merge-head Windows run: `33623494448`
- Editable project schema: v3 with embedded graph source v1
- Compiled graph format: exact 92-byte `GARAKGRF` v1.0
- Product Compiler compatibility API currently classifies `GARAKCPD` and `GARAKPST` only.
- Native graph parser returns only `GainExecutionBinding` or failure, so missing, old, future and corrupt data are not distinguished.
- Product Runtime fails closed on every graph load failure, but does not expose a shared graph compatibility disposition.
- First-party product inspector verifies compiled product, moduleinfo and factory parity, but does not classify `graph.garakbin` directly.

## 범위

- authoritative compiled graph compatibility disposition and version report
- exact current/missing/unsupported-old/too-new/invalid classification
- Product Compiler compatibility API and CLI graph report
- Native static-graph compatibility classifier with current binding result
- Product Runtime module-load use of the shared classifier
- first-party inspector direct graph classification before factory inspection
- TypeScript and C++ fixed-fixture parity tests for the complete matrix
- graph compatibility architecture documentation
- Phase 3C status, roadmap and ExecPlan synchronization
- exact final source clean Windows Product Compiler/Studio/Runtime/export/Validator/CTest/Werror/clang-tidy gate

## 비범위

- changing `GARAKGRF` v1 layout or version
- migration of released compiled graph bytes
- accepting noncanonical or future graph data
- runtime rebuild from editable project source inside a deployed plug-in
- additional DSP nodes, arbitrary DAG, split/merge, feedback or sidechain
- graph canvas or renderer graph mutation
- macro/control mapping
- `GARAKCPD` v1 or `GARAKPST` v1 changes
- macOS/AU, installer or DAW matrix

## 전제와 제약

- `AGENTS.md`, accepted ADRs, ExecPlan 0014 and completed ExecPlan 0016 remain authoritative.
- `graph.garakbin` is derived from validated schema v3 `project.graph` and is not an independent source of truth.
- A current schema v3 project with invalid graph source must fail before export output mutation; compatibility handling must not synthesize a replacement for invalid source.
- Missing or supported-old derived graph data may be rebuilt only where editable source and compiler authority exist.
- Deployed Runtime has no editable source and therefore loads only exact current graph data; every other disposition fails before factory publication.
- Future and corrupt artifacts are preserved for diagnosis and never overwritten by a compatibility fallback.
- Graph parse and compatibility classification remain outside the audio callback.
- No new dependency is required.

## 설계 결정

### Shared semantic matrix

The cross-language semantic dispositions are:

| Input | Authoring/compiler action | Deployed Runtime action |
| --- | --- | --- |
| exact `GARAKGRF` 1.0 | `load-current` | load prepared binding |
| missing artifact | `rebuild-from-project` | reject module load |
| major lower than 1 | `rebuild-from-project` | reject module load |
| major higher than 1 or minor higher than 0 | `reject-too-new` | reject module load and preserve artifact |
| bad magic, truncated, malformed, noncanonical or otherwise invalid current data | `reject-invalid` | reject module load and preserve artifact |

`missing` and `unsupported-old` have different diagnostic codes but the same authoring action because both are derived data that current editable source can regenerate. There is no old compiled-graph migration implementation.

### Version-first classification

A present artifact is classified in this order:

1. magic availability and match
2. readable major/minor version
3. old/future version disposition
4. strict current parser and semantic binding

This allows an old or future artifact with a recognizable header to receive the correct version disposition without being forced through the exact current-size parser. A bad magic or unreadable header is invalid.

### Runtime classifier returns the prepared binding

The Native compatibility result contains the parsed `GainExecutionBinding` only for `current`. The Runtime loader therefore does not classify and parse the same bytes through separate paths. All non-current reports fail closed because the deployed module cannot rebuild.

### Inspector verifies graph before loading the module

The first-party inspector reads the exact graph resource, runs the same Native classifier and requires `current` before creating the VST3 module. This makes graph failure visible as an artifact compatibility failure rather than only an indirect factory-load failure.

## 구현 단계

1. [x] Write this ExecPlan before source implementation.
2. [x] Add Product Compiler compiled-graph compatibility types and classifier.
3. [x] Extend compatibility file inspection and CLI with explicit graph reporting.
4. [x] Add TypeScript current/missing/old/future/corrupt matrix tests.
5. [x] Add Native static-graph compatibility report and binding-bearing classifier.
6. [x] Route Product Runtime module loading through the shared Native classifier.
7. [x] Make the first-party product inspector classify the graph resource directly.
8. [x] Add C++ fixture-parity tests and shared inspector/Runtime resource-reader regressions.
9. [x] Update architecture/status/roadmap to the Phase 3C3 acceptance-pending state.
10. [x] Run locally available syntax, focused C++ builds, Debug/Release non-SDK CTest and diff checks.
11. [x] Run exact-source clean Windows full product gate, fix every failure and re-run the exact final head.
12. [x] Merge only the green final head and remove obsolete temporary verification paths.

## 변경 대상 파일

Expected additions:

- `plans/0017-phase-3c3-compiled-graph-compatibility.md`
- `native/runtime/static_graph/include/garak/runtime/static_graph/compatibility.hpp`

Expected modifications:

- `tools/product-compiler/src/compatibility.ts`
- `tools/product-compiler/src/compatibility_cli.ts`
- `tools/product-compiler/tests/compatibility.test.ts`
- Native Product Runtime loader and first-party inspector
- Native static graph and inspector tests/CMake registration as required
- `docs/architecture/compiled-and-state-compatibility.md`
- `README.md`, `ROADMAP.md`, `docs/status/current.md` and ExecPlan 0014

The actual list will be recorded at completion.

## 검증 계획

Locally available TypeScript checks:

```text
node --test --test-isolation=none --test-concurrency=1 tools/product-compiler/tests/*.test.ts
node --test --test-isolation=none --test-concurrency=1 studio/tests/*.test.mts
tsc -p tools/product-compiler/tsconfig.json --noEmit
tsc -p studio/tsconfig.json --noEmit
git diff --check
```

Focused C++ checks compile and run the static-graph compatibility tests with both available GCC and Clang using first-party warnings as errors. Full VST3 build and inspector integration remain authoritative only on clean Windows with the exact recursive SDK graph.

Authoritative acceptance:

- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/build
- Debug and Release Product Runtime clean build
- Warm/Bright actual export and official VST3 Validator
- Debug and Release CTest and Studio product workflow
- warnings-as-errors and clang-tidy
- tracked-source mutation zero
- exact final commit checked out and recorded before every gate

## 수용 기준

- TS and C++ classify the same current/missing/old/future/corrupt graph fixtures with the same semantic disposition.
- Compatibility CLI reports compiled product, compiled graph and optional state in one result.
- Missing/old graph is rebuildable only in the authoring/compiler report; future/corrupt graph is rejected without overwrite.
- Runtime accepts only exact current graph and obtains its prepared binding from the classifier result.
- Inspector rejects a missing, old, future or corrupt graph before factory parity inspection and accepts current exported products.
- Existing schema v3 source-derived graph export and Phase 3B realtime allocation/deallocation `0` remain unchanged.
- Product ID, FUID, Gain `1001`, Bypass `1002`, `GARAKCPD` and `GARAKPST` contracts remain unchanged.
- Exact final source commit passes the complete clean Windows matrix.
- Phase 3C is marked Complete only after the exact final gate succeeds.

## 리스크

- Treating every absent `--graph` argument as an invalid CLI invocation would hide the required missing disposition. The CLI intentionally allows omission and reports a missing derived artifact.
- Treating filesystem permission or read errors as missing would be unsafe. Only an intentionally omitted graph path or `ENOENT` is classified as missing; other read failures remain explicit command errors.
- Reusing the product/state enum without artifact-specific diagnostics can obscure graph behavior. Cross-language reports share semantic disposition names but keep graph-specific diagnostic codes.
- A separate compatibility parser could drift from the runtime parser. Native current classification owns and returns the actual prepared binding from the existing strict parser.
- Inspector-only checks are insufficient because the deployed Runtime must independently fail closed. Both use the same Native classifier.

## 발견 사항

- 2026-09-02: Phase 3C2 draft PR `#104` could not be marked ready through the connected GitHub App because its GraphQL response schema and Actions token lacked the required mutation access. The unchanged verified head was reopened as non-draft PR `#105` and squash-merged as `0ec4792fefc14144bc32279a2137c0583c9d3ff6`.
- 2026-09-02: The current TypeScript compatibility model has no compiled graph field, the Native graph parser collapses all failures to `nullopt`, and the inspector does not read `graph.garakbin` directly. These are the exact Phase 3C3 gaps.
- 2026-09-02: The local execution environment cannot resolve `github.com`; exact source was obtained from a read-only artifact generated from accepted main. Full Windows validation will use a separate read-only verifier branch.
- 2026-09-02: The source archive does not contain workspace dependencies and the local Node 22 runtime cannot execute the repository's Node 24 TypeScript test runner. TypeScript compiler syntax transpilation passed, while dependency-backed format/lint/typecheck/tests remain mandatory in the exact-source Windows verifier.
- 2026-09-02: `std::filesystem::symlink_status` reports a missing path through `no_such_file_or_directory` in the local standard library. The shared resource reader handles both `file_type::not_found` and that portable error condition as missing; directories, links and other unreadable resources remain invalid.
- 2026-09-02: GCC and Clang focused graph compatibility/resource tests passed with `-Wall -Wextra -Wpedantic -Werror`. Debug and Release non-SDK CMake builds and CTest passed 4/4 while preserving the Phase 3B realtime stress path.
- 2026-09-02: The first exact Windows run exposed six unformatted C++ files; a direct formatter commit corrected them. A later Debug CTest failure came from the verifier exporting outside the repository's canonical `phase-1c1` test path, so the verifier—not product code—was corrected. The strict clang-tidy gate then found one ineffective `std::move` on a trivially copyable optional binding; the move and unused include were removed.
- 2026-09-02: Exact source `d60667d8806e5dac7963ae928dcf98dc377cf0f7` passed clean Windows run `33657806095`, including Product Compiler/Studio quality, Debug/Release export and Validator, CTest, Studio workflow, Werror, clang-tidy and tracked-source mutation `0`.

## 의사결정 로그

- 2026-09-02: Use `rebuild-from-project` for both missing and supported-old compiled graph data in authoring contexts, distinguished by diagnostic code.
- 2026-09-02: Preserve `reject-too-new` and `reject-invalid` as non-destructive terminal dispositions.
- 2026-09-02: Keep the Native current classifier binding-bearing so the Runtime has one parser and one compatibility decision.
- 2026-09-02: Do not add a compiled graph fallback or migration implementation; current source recompilation is the only rebuild path.

## 완료 기록

Phase 3C3 is complete at exact source `d60667d8806e5dac7963ae928dcf98dc377cf0f7`. Clean Windows run `33657806095` passed Product Compiler and
Studio quality gates, Debug/Release actual Warm/Bright exports and official Validator, CTest, Studio workflows,
warnings-as-errors, clang-tidy and tracked-source mutation `0`. Product Compiler, Native Runtime and the
first-party inspector now distinguish current, missing, corrupt, too-old and too-new `GARAKGRF` artifacts
through explicit shared compatibility semantics. Runtime remains read-only and fail-closed; repair and rebuild
decisions remain outside the loaded plug-in.
## 다음 단계

Phase 3C is complete. Phase 3D — Initial DSP Node Set을 별도 ExecPlan으로 시작한다.
