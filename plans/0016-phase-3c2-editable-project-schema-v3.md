# ExecPlan 0016 — Phase 3C2 Editable Project Schema v3

- Status: In Progress
- Started: 2026-09-02
- Updated: 2026-09-02
- Owner: Product Compiler and Studio product workflow

## 목적

Current schema v2 `.garak` project를 schema v3으로 진화시켜, 제품의 `Input → Gain → Output` DSP chain을 versioned editable graph source로 영속화한다. Product Compiler는 이 source를 strict하게 검증하고 deterministic `graph.garakbin` v1으로 compile하며, Studio는 canvas 없이 동일 typed graph document를 생성·열기·저장·migration 과정에서 보존한다.

## 사용자 가치

제품의 sound graph가 Runtime 안의 암묵적 상수가 아니라 project가 소유하는 명시적 source contract가 된다. 동일 logical graph는 source 배열 순서와 node 식별자에 관계없이 동일 compiled bytes를 만들며, 잘못되거나 지원되지 않는 graph는 export 이전에 명확하게 거부된다.

## 현재 저장소 상태

- Starting `main`: `1666c667e6e635447b387a5e25bcce7ef1ee42e5`
- Phase 3C1 implementation: merged PR `#103`
- Phase 3C1 exact verified source: `837e01ef96c11800b246a50eff92c4599e630080`
- Phase 3C1 clean Windows run: `33610351357`
- Current editable project schema: v2
- Current compiled graph: exact 92-byte `GARAKGRF` v1
- Current project inventory: one physical `product.json`
- Current Studio Product draft: vendor/name/version/Gain default only

## 범위

- project schema v3와 embedded graph source v1
- canonical Gain graph factory와 strict graph source validator
- deterministic source-to-`GARAKGRF` compiler
- strict v1→v2→v3 and v2→v3 migration chain
- canonical schema v3 serializer
- Product document/draft/persistence round-trip
- Studio main-owned graph preservation without graph editing UI
- Warm/Bright current fixtures migration to v3
- tracked legacy v2 fixtures and focused graph/migration tests
- affected architecture/status/roadmap documentation

## 비범위

- arbitrary DAG, branching, feedback, sidechain or dynamic buffer planning
- additional DSP node types
- generic node registry
- Studio graph canvas or renderer graph mutation
- macro/control mapping
- `GARAKCPD` v1 or `GARAKPST` v1 changes
- Product ID, processor/controller FUID or Parameter ID changes
- compiled graph compatibility matrix and final Phase 3C product gate; those remain Phase 3C3
- macOS/AU, installer or DAW matrix

## 전제와 제약

- `AGENTS.md`, accepted ADRs and ExecPlan 0014 remain authoritative.
- Gain ID `1001` and Bypass ID `1002` are permanent.
- Migration must preserve Product ID, derived FUIDs, metadata, defaults and compiled/state semantics.
- Project open alone does not rewrite source.
- Studio renderer receives no filesystem, shell or raw IPC authority.
- Graph parse/validation remains outside the audio callback.
- No compatibility fallback may synthesize a graph at export time for a current schema v3 project.

## 설계 결정

### Embedded graph source

Schema v3 adds a top-level `graph` object inside `product.json`. The current physical package remains one file. This is the smallest durable increment and avoids introducing a second authoring-file transaction before the product needs independent graph assets.

### Exact graph source v1

The accepted source contains exactly three nodes and two connections:

- one `garak.audio-input` implementation `1`
- one `garak.gain` implementation `1`
- one `garak.audio-output` implementation `1`
- `audio-input.audio → gain.audio`
- `gain.audio → audio-output.audio`

Node IDs are authoring identities. Compilation derives operation instance IDs, order, buffer slots and parameter bindings; authoring node IDs therefore do not affect `graph.garakbin` bytes.

### Main-owned graph in Studio

The renderer continues editing only the existing Product fields. `ProductDocument` exposes the typed graph as read-only data, while Electron main stores it in the session and includes it in validation/save requests to Product Compiler. This preserves graph data without prematurely adding graph-authoring UI.

### Migration chain

Schema v1 migrates through v2 and then v3. Schema v2 migrates directly to v3. Both append the canonical graph source exactly once. Current schema v3 is never silently rewritten.

## 구현 단계

1. [x] Write this ExecPlan before source implementation.
2. [ ] Add schema v3 graph types, constants and canonical source factory.
3. [ ] Add strict graph validation and deterministic compiled-plan derivation.
4. [ ] Extend version detection, migration chain and canonical serialization to v3.
5. [ ] Extend Product document/draft/persistence APIs while preserving immutable identity.
6. [ ] Move Warm/Bright current fixtures to v3 and retain explicit v2 migration fixtures.
7. [ ] Extend Studio typed API and main-owned session round-trip.
8. [ ] Add focused graph, migration, document, export and Studio regressions.
9. [ ] Run available local format/type/test checks and fix all failures.
10. [ ] Update ExecPlan 0014, architecture, current status and roadmap to the verified Phase 3C2 state.
11. [ ] Record exact source commit and prepare a clean Windows verifier for the source commit without allowing the verifier to mutate source.

## 변경 대상 파일

Expected additions:

- `plans/0016-phase-3c2-editable-project-schema-v3.md`
- `tools/product-compiler/src/graph_source.ts`
- `tools/product-compiler/tests/graph_source.test.ts`
- `docs/architecture/editable-project-schema-v3.md`

Expected modifications:

- Product Compiler project model, validation, migration, document, export and tests
- current and legacy product fixtures
- Studio shared API, Product service and tests
- `README.md`, `ROADMAP.md`, `docs/status/current.md`, ExecPlan 0014 and related architecture docs

The actual list will be recorded at completion.

## 검증 계획

Local first-party checks where the current environment supports them:

```text
node --test --test-isolation=none --test-concurrency=1 tools/product-compiler/tests/*.test.ts
node --test --test-isolation=none --test-concurrency=1 studio/tests/*.test.mts
```

Authoritative acceptance remains a clean Windows x64 checkout of the exact source commit with:

- Product Compiler format/lint/typecheck/test
- Studio format/lint/typecheck/test/build
- Debug and Release Runtime clean build
- Warm/Bright actual export and official VST3 Validator
- Debug and Release CTest and Studio product workflow
- warnings-as-errors and clang-tidy
- tracked-source mutation zero

## 수용 기준

- current canonical project serialization uses schema v3 and contains graph source v1
- v2→v3 migration creates the canonical graph and preserves all existing product semantics
- v1 migration reports both ordered steps and reaches the same canonical v3 model
- current v3 validation rejects unknown/missing fields, duplicate nodes/connections, invalid IDs/types/versions/ports/endpoints and noncanonical topology
- source node/connection order and valid authoring IDs do not change compiled graph bytes
- export compiles `graph.garakbin` from `project.graph`, not a hardcoded canonical plan
- Studio create/open/save/reopen/migrate preserves the exact validated graph without renderer authority expansion
- current/legacy project regressions remain green
- no `GARAKCPD`, `GARAKPST`, Product/FUID/Parameter identity contract changes

## 리스크

- Existing tests assume schema v2 literals. Central fixture helpers and explicit legacy-v2 fixtures will separate current-schema expectations from migration expectations.
- Passing graph through an editable renderer request would widen authority. The graph remains main-owned and read-only in Phase 3C2.
- Over-general validation would create an unfinished graph framework. The validator deliberately accepts only the current three-node chain.
- Source/compiled drift is prevented by deriving the plan from the validated graph and checking exact canonical bytes in tests.

## 발견 사항

- 2026-09-02: The preceding automation report did not correspond to a real Phase 3C2 branch. GitHub `main` was still at the pre-3C1 baseline until PR #103 was accepted.
- 2026-09-02: PR #103 subsequently merged as `1666c667e6e635447b387a5e25bcce7ef1ee42e5`; this plan starts from that accepted baseline.

## 의사결정 로그

- 2026-09-02: Keep graph source embedded in `product.json` for schema v3 to preserve the existing atomic one-file editable package.
- 2026-09-02: Keep graph editing out of renderer requests; Electron main owns the graph until a later explicit graph-authoring increment.
- 2026-09-02: Treat authoring node IDs and array order as non-semantic for compiled bytes while validating them strictly for uniqueness and references.

## 완료 기록

In progress. Completion will list actual files, checks and any unverified platform gates. Phase 3C3 must not be reported complete from this work.

## 다음 단계

After Phase 3C2 is accepted, execute Phase 3C3: compiled graph compatibility matrix and the final clean Windows product gate for Phase 3C.
