# Garak

Garak(가락)은 음악가와 창작자가 자기 사운드, control language, interface와 브랜드를 설계해 독립적인 native audio plug-in 제품으로 만들 수 있게 하는 오디오 제품 제작 플랫폼이다.

## 현재 제품 경로

Phase 3D2에서 수용한 Windows x64 vertical slice는 다음 경로를 실제로 통과한다.

```text
unpacked .garak project schema v5 / graph source v3
→ Product Compiler validation and ordered v1/v2/v3/v4 migration
→ deterministic GARAKCPD 1.0 + GARAKGRF 1.2
→ prebuilt Garak Product Runtime v1
→ module-load compatibility classification
→ exact immutable StaticExecutionBinding
→ Input → Gain → Output
   또는 Input → Gain → Polarity → Output
   또는 Input → Gain → Saturation → Output
→ product-specific moduleinfo.json
→ local white-label VST3 bundle
→ first-party inspector + official VST3 Validator
```

Studio는 `.garak` 생성·열기·편집·migration·conflict/recovery 처리와 Debug/Release export를 Electron main의 typed capability 경계로 제공한다. Renderer에는 Node.js, filesystem, shell 또는 raw IPC 권한이 없다.

Native Runtime은 C++20이며 생성된 VST3에는 Electron, Chromium, Node.js 또는 임의 JavaScript runtime이 포함되지 않는다.

현재 reference products는 네 개다.

- `Artist Gain Warm` — Gain-only
- `Artist Gain Bright` — Gain-only
- `Artist Gain Inverted` — Gain→Polarity
- `Artist Gain Saturated` — Gain→Saturation, Product ID `8a5ce3f8-7b74-4f53-bdc2-c52e4f586072`, default Gain `0 dB`

네 제품은 같은 configuration의 prebuilt Runtime binary를 재사용한다. Warm/Bright는 같은 canonical Gain-only graph bytes를 사용하고 Inverted/Saturated는 각각 distinct canonical Polarity/Saturation graph bytes를 사용한다. Product ID, processor/controller FUID, metadata, defaults와 compiled product data는 제품별이다.

## 현재 검증 상태

**Phase 3D2 — Saturation Node는 PASS / Complete다.**

- exact verified implementation source: `b0c8fd8eeb3aa6290b0d211808cc0c25c38f27ab`
- clean Linux + Windows acceptance run: [36736534651](https://github.com/andongmin94/garak/actions/runs/36736534651)
- Product Compiler format/lint/typecheck/test: success
- Studio format/lint/typecheck/test/build: success
- Linux Native Debug/Release, Clang warnings-as-errors, clang-format와 clang-tidy: success
- Windows Debug/Release Product Runtime clean build: success
- Warm/Bright/Inverted/Saturated actual export, first-party inspector와 official VST3 Validator normal/extensive: success
- supported legacy v1/v2/v3/v4→v5 migration actual-export parity, Debug/Release: success
- Windows Debug/Release CTest와 Studio product workflow: success
- MSVC `/WX`, Windows clang-tidy와 source-clean checks: success
- tracked-source mutation: `0`

별도 local Linux 검증에는 Windows-only junction test 한 개가 skip된다. Local test counts와 exact implementation acceptance 기록은 [`docs/status/current.md`](docs/status/current.md)와 [Phase 3D2 validation](docs/status/phase-3d2-saturation-validation.md)을 따른다. 위 SHA는 검증한 구현 source이며 이후 완료 기록을 추가하는 documentation commit의 SHA를 뜻하지 않는다. Historical Phase 3B/3C/3D1 acceptance evidence는 current status와 completed ExecPlans에 보존한다.

## 현재 persistent contract

- editable project schema v5
- embedded graph source v3
- strict ordered project migration v1→v2→v3→v4→v5
- graph v3는 정확히 세 linear topology만 지원하며 optional post-Gain node는 최대 하나
- deterministic `GARAKCPD` 1.0
- deterministic `GARAKGRF` 1.2
- product-bound `GARAKPST` 1.0
- permanent Gain Parameter ID `1001`
- permanent Bypass Parameter ID `1002`
- parameterless fixed Polarity와 Saturation (`tanh` after Gain) operations
- v4→v5는 기존 node IDs와 node/connection array order 보존
- current source authoring order 보존, 동일 topology의 compiled bytes는 deterministic
- immutable Product ID와 deterministic processor/controller FUID
- missing/old compiled graph는 authoring에서 rebuild, future/corrupt는 reject
- deployed Runtime은 non-current graph artifact에 fallback하지 않음

## Realtime contract

세 topology는 같은 sample-accurate processing loop를 사용한다. Gain-only active branch는 identity transform, Polarity는 negation, Saturation은 post-Gain `tanh` transform이다. Bypass=true인 sample은 whole product graph를 우회해 original dry input을 그대로 출력한다.

Polarity/Saturation compiled plans는 logical third buffer를 기록하지만 current exact Runtime binding은 하나의 optional post-Gain transform을 Gain active pass에 fuse한다. Callback에서 second dynamic scratch pass를 만들지 않는다.

Audio callback에는 다음을 허용하지 않는다.

- allocation/free
- locks/waits
- filesystem/network I/O
- logging/string formatting
- graph mutation
- exception propagation

## 빠른 시작

### 요구 도구

- Windows x64
- Visual Studio x64 Developer Command environment
- CMake + Ninja
- Node.js 24
- pnpm 11
- exact recursive Steinberg VST3 SDK submodule

```powershell
git submodule update --init --recursive third_party/vst3sdk
corepack enable
pnpm install --frozen-lockfile
```

### Product Compiler와 Studio

```powershell
pnpm product:format:check
pnpm product:lint
pnpm product:typecheck
pnpm product:test

pnpm studio:format:check
pnpm studio:lint
pnpm studio:typecheck
pnpm studio:test
pnpm studio:build
```

### Native foundation

```powershell
cmake --preset debug --fresh
cmake --build --preset debug-build --clean-first
ctest --preset debug-test --no-tests=error

cmake --preset release --fresh
cmake --build --preset release-build --clean-first
ctest --preset release-test --no-tests=error
```

### Windows Product Runtime와 실제 VST3 export

Debug:

```powershell
cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first

pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Debug --output out/exports/phase-3d2/debug --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Debug --output out/exports/phase-3d2/debug --force --validate
pnpm product:export --project examples/products/artist-gain-inverted.garak --configuration Debug --output out/exports/phase-3d2/debug --force --validate
pnpm product:export --project examples/products/artist-gain-saturated.garak --configuration Debug --output out/exports/phase-3d2/debug --force --validate

ctest --preset product-runtime-debug-test --no-tests=error
pnpm --dir studio verify:product-workflow --configuration Debug
```

Release:

```powershell
cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first

pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Release --output out/exports/phase-3d2/release --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Release --output out/exports/phase-3d2/release --force --validate
pnpm product:export --project examples/products/artist-gain-inverted.garak --configuration Release --output out/exports/phase-3d2/release --force --validate
pnpm product:export --project examples/products/artist-gain-saturated.garak --configuration Release --output out/exports/phase-3d2/release --force --validate

ctest --preset product-runtime-release-test --no-tests=error
pnpm --dir studio verify:product-workflow --configuration Release
```

Strict first-party gates:

```powershell
cmake --preset product-runtime-werror --fresh
cmake --build --preset product-runtime-werror-build --clean-first

cmake --preset product-runtime-clang-tidy --fresh
cmake --build --preset product-runtime-clang-tidy-build --clean-first
```

## Phase 3 진행 상태

- Phase 3A — Minimal Native Static DSP Execution Plan: Complete
- Phase 3B — Realtime Safety Instrumentation and Long-run Runtime Stress: Complete
- Phase 3C — Editable Static Graph Project Contract and Compiled Plan: Complete
- Phase 3D1 — Polarity Node: Complete
- Phase 3D2 — Saturation Node: Complete

Phase 3D는 node를 하나씩 working vertical slice로 수용한다. Pan, Dry/Wet, Biquad, Tilt EQ 또는 generic graph engine을 다음 increment가 요구하기 전에 미리 구현하지 않는다.

## 문서

- [Repository constitution](AGENTS.md)
- [Roadmap](ROADMAP.md)
- [Current status](docs/status/current.md)
- [Phase 3D2 validation](docs/status/phase-3d2-saturation-validation.md)
- [Completed Phase 3D2 ExecPlan](plans/0019-phase-3d2-saturation-node.md)
- [Accepted Phase 3D1 ExecPlan](plans/0018-phase-3d1-polarity-node.md)
- [Editable Project Schema v5](docs/architecture/editable-project-schema-v5.md)
- [Compiled/state compatibility](docs/architecture/compiled-and-state-compatibility.md)
- [Runtime and export](docs/architecture/runtime-and-export.md)
- [System overview](docs/architecture/system-overview.md)
- [Project persistence](docs/architecture/project-persistence-service.md)

저장소 자체의 라이선스는 아직 결정되지 않았다. 별도 법률 검토와 명시적 결정 없이 `LICENSE`를 추가하지 않는다.
