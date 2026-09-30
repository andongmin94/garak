# Garak Runtime and Export

- 문서 상태: Phase 3D2 accepted runtime/export contract
- 최종 갱신: 2026-10-01
- Current editable project: schema v5 / graph source v3
- Current compiled formats: `GARAKCPD` 1.0, `GARAKGRF` 1.2, `GARAKPST` 1.0
- Windows x64 runtime strategy: prebuilt Product Runtime + product data

## 역할

이 문서는 validated `.garak` project가 independent native plug-in package가 되는 current path와 Runtime이 지켜야 하는 실행 계약을 정의한다. Historical spike나 과거 schema contract는 completed plans/architecture snapshots에 남긴다.

## Current product pipeline

```text
editable .garak source
→ strict project/schema/graph validation
→ ordered legacy migration when explicitly requested
→ deterministic product + graph compilation
→ prebuilt native Product Runtime selection
→ product-specific VST3 staging
→ product.garakbin + graph.garakbin + moduleinfo.json
→ first-party inspector
→ official VST3 Validator
→ atomic publication
```

앞 단계 실패를 fallback artifact나 guessed graph로 우회하지 않는다.

## Editable source

Current project schema는 v5이고 embedded graph source는 v3다. Supported legacy project schema는 v1/v2/v3/v4이며 v1→v2→v3→v4→v5 순서로 migration한다. v4→v5는 node IDs와 source node/connection array order, 기존 topology를 보존한다. Current source serialization은 authoring array order를 보존하고, compiled bytes는 semantic topology로 결정한다. Historical graph source v1의 canonical ordering은 변경하지 않는다.

Graph source v3는 정확히 세 topology만 허용한다.

```text
Audio Input → Gain → Audio Output
Audio Input → Gain → Polarity → Audio Output
Audio Input → Gain → Saturation → Audio Output
```

Node types는 `garak.audio-input`, `garak.gain`, optional `garak.polarity` 또는 `garak.saturation`, `garak.audio-output`이고 implementationVersion은 모두 1이다. Optional post-Gain node는 최대 하나이고 endpoint port는 `audio`다. Repeated types, extra properties, arbitrary DAG, branching, feedback와 sidechain은 current product contract가 아니다.

## Compiled runtime data

### `product.garakbin`

`GARAKCPD` 1.0은 product identity, metadata, template/default와 permanent public parameter contract를 담는 derived data다. Phase 3D2에서 format version은 변경되지 않는다.

### `graph.garakbin`

`GARAKGRF` 1.2는 validated source graph를 exact operation/buffer plan으로 낮춘 derived data다.

- Gain-only: 3 operations, 92 bytes, 2 logical buffers
- Gain→Polarity: 4 operations, 112 bytes, 3 logical buffers
- Gain→Saturation: 4 operations, 112 bytes, 3 logical buffers
- all zero latency

Export는 validated `project.graph`에서 graph bytes를 생성한다. Missing/invalid source graph를 canonical constant로 대체하지 않는다.

### Plug-in state

`GARAKPST` 1.0은 product-bound Gain/Bypass state를 유지한다. Polarity/Saturation은 fixed graph structure이므로 public parameter/state를 추가하지 않는다.

## Module-load Runtime boundary

Product Runtime은 realtime callback 이전에 다음을 수행한다.

1. module-relative `product.garakbin` 읽기
2. compiled product compatibility 확인
3. module-relative `graph.garakbin` 읽기
4. compiled graph compatibility 확인
5. exact current plan을 immutable `StaticExecutionBinding`으로 bind
6. product identity/FUID/default와 package metadata parity 확인
7. 성공한 context만 processor에 설치

Non-current graph는 module-load path에서 fail closed한다. Deployed Runtime은 editable source를 갖지 않으므로 rebuild나 fallback을 시도하지 않는다.

## Realtime execution

현재 DSP schedule은 exact static binding 세 개뿐이다.

### Gain-only

Gain DSP의 active branch가 normalized Gain automation을 sample-accurately 적용한다.

### Gain→Polarity

Polarity는 active Gain sample을 `-1`로 변환한다. Naive second post-Gain pass는 bypassed dry sample까지 반전시킬 수 있으므로 사용하지 않는다.

### Gain→Saturation

`garak.saturation` implementation version 1은 finite active post-Gain sample에 fixed `tanh`를 적용한다. Public drive/mix/output parameter와 state field는 없다.

Current Runtime은 하나의 exact optional post-Gain operation을 Gain DSP의 active-sample transform으로 fuse한다.

```text
if bypass:
    output = original input
else:
    gained = input × gain
    output = gained                 # Gain-only
    output = -gained                # Gain→Polarity
    output = tanh(gained)           # Gain→Saturation
```

Compiled plan의 logical buffer count와 Runtime의 physical callback optimization은 구분한다. Plan은 optional Polarity/Saturation operation과 third logical buffer를 명시하지만 callback은 dynamic intermediate buffer를 할당하지 않는다.

## Realtime safety

Audio callback은 다음을 하지 않는다.

- allocation/free
- locks, waits, blocking synchronization
- file/network I/O
- logging or string formatting
- graph parsing/mutation
- exception propagation

Gain-only, Gain→Polarity와 Gain→Saturation, Float32/Float64에 대해 allocation-counted long-run stress가 CTest에 포함된다.

## Whole-product Bypass

Bypass는 Gain node만의 bypass가 아니라 product graph 전체 bypass다. Exact offset에서 Bypass=true가 되면 optional Polarity/Saturation을 포함한 모든 active graph operation을 우회하고 original dry input을 그대로 출력한다.

Gain `1001`, Bypass `1002`는 unchanged다.

## Windows VST3 export

Current reference products:

- `examples/products/artist-gain-warm.garak`
- `examples/products/artist-gain-bright.garak`
- `examples/products/artist-gain-inverted.garak`
- `examples/products/artist-gain-saturated.garak` — Product ID `8a5ce3f8-7b74-4f53-bdc2-c52e4f586072`, default Gain `0 dB`

Export는 configuration에 맞는 prebuilt `Garak Product Runtime v1.vst3`를 sibling staging directory로 복사/rename하고 다음 product resources를 배치한다.

```text
Contents/Resources/product.garakbin
Contents/Resources/graph.garakbin
Contents/Resources/moduleinfo.json
Contents/x86_64-win/<Product Name>.vst3
```

Product별 C++ source generation/compilation/linking은 하지 않는다.

## Publication semantics

Compile/export는 final output과 같은 volume의 transaction-owned sibling stage/backup을 사용한다.

- default는 existing final을 거부
- `--force`일 때만 owned backup으로 retire
- validated stage를 final path로 rename하는 순간이 commit point
- pre-commit failure는 prior valid final을 복원하고 실패
- post-commit cleanup failure는 valid publication을 rollback하지 않고 bounded cleanup diagnostic을 반환
- unowned path를 cleanup하지 않음

## Studio boundary

Studio Product workspace는 headless compiler/export path의 frontend다.

- Renderer는 typed draft/result만 다룬다.
- Product ID, physical source path, graph authority, output selection과 cleanup capability는 Electron main이 소유한다.
- Renderer에 Node/fs/shell/raw IPC를 제공하지 않는다.
- Main은 Product Compiler callable workflow를 직접 사용하며 compiler/export semantics를 재구현하지 않는다.
- Current graph는 main-owned session data이며 ordinary product metadata/default editing이 graph를 암묵적으로 변경하지 않는다.

## Current acceptance and historical baseline

Phase 3D2는 exact implementation source `b0c8fd8eeb3aa6290b0d211808cc0c25c38f27ab`의 [clean Linux + Windows run 36736534651](https://github.com/andongmin94/garak/actions/runs/36736534651)에서 수용됐다. Four-product Debug/Release export, inspector, official Validator, loaded-module/CTest, Studio workflow와 legacy migration actual-export parity를 포함한다. 자세한 결과는 [current status](../status/current.md)와 [Phase 3D2 validation](../status/phase-3d2-saturation-validation.md)를 따른다. 아래 Phase 3D1 기록은 historical accepted baseline으로 보존한다.

Phase 3D1 exact verified source:

`96ba29cf009eab00980405d7de456b5f1d431956`

Clean acceptance run:

`34193494228`

이 run에서 Linux Product Compiler/Studio/clang-format/Native Debug+Release/Clang warnings-as-errors/clang-tidy와 Windows Product Compiler/Studio, Debug+Release Runtime, Warm/Bright/Inverted export, inspector, official Validator, CTest, Studio workflow, MSVC `/WX`, Windows clang-tidy와 clean-tree가 모두 성공했다.

## 다음 확장 원칙

Phase 3D2는 fixed Saturation에 필요한 최소 source/compiled/Runtime contract만 추가한다. Polarity+Saturation 조합, Pan, Dry/Wet, Biquad, Tilt EQ, generic node registry, arbitrary scheduler와 macro system은 이 increment의 범위가 아니다.
