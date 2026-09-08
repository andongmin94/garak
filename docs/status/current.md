# Garak Current Status

- 기준일: 2026-09-08
- 개발 브랜치: `main` 하나
- 권위 문서: current source tree → `ROADMAP.md` → active ExecPlan
- 수용된 기준선: **Phase 3D1 — Polarity Node, PASS / Complete**
- exact verified source: `96ba29cf009eab00980405d7de456b5f1d431956`
- clean Linux + Windows acceptance run: `34193494228`
- 다음 increment: Phase 3D2, 아직 시작하지 않음

## 현재 동작하는 제품 경로

```text
.garak project schema v4 / graph source v2
→ Product Compiler strict validation and ordered legacy migration
→ deterministic product.garakbin + graph.garakbin
→ GARAKCPD 1.0 + GARAKGRF 1.1
→ prebuilt C++20 Product Runtime v1
→ module-load product/graph compatibility classification
→ exact immutable StaticExecutionBinding
→ Input → Gain → Output
   또는
   Input → Gain → Polarity → Output
→ product-bound Windows x64 VST3
→ first-party inspector + official VST3 Validator
```

현재 reference products는 `Artist Gain Warm`, `Artist Gain Bright`, `Artist Gain Inverted`다. Warm/Bright는 Gain-only compiled graph를 사용하고 Inverted는 Gain→Polarity compiled graph를 사용한다. 세 제품은 같은 configuration의 prebuilt Product Runtime binary를 재사용하며 Product ID/FUID/metadata/default와 compiled product data는 제품별이다.

## 현재 persistent contract

- editable project schema v4
- embedded graph source v2
- supported legacy project inputs: v1, v2, v3
- ordered source migration: v1→v2→v3→v4
- graph source v2 exact supported topologies:
  - `garak.audio-input → garak.gain → garak.audio-output`
  - `garak.audio-input → garak.gain → garak.polarity → garak.audio-output`
- deterministic `GARAKCPD` 1.0
- deterministic `GARAKGRF` 1.1
- product-bound `GARAKPST` 1.0
- immutable Product ID와 deterministic processor/controller FUID
- permanent Gain `1001`, Bypass `1002`
- Polarity는 public parameter/state가 없는 fixed graph operation
- `GARAKGRF` 1.0은 old/rebuild, future/corrupt graph data는 reject

## Runtime semantics

- Native Runtime은 두 exact canonical static plan만 bind한다.
- Gain-only는 identity active transform을 사용한다.
- Gain→Polarity는 Gain의 non-bypassed active sample에 fixed negation transform을 적용한다.
- host Bypass=true이면 whole product graph를 우회하고 exact dry input을 출력한다.
- Polarity plan의 logical buffer count는 3이지만 callback에서는 optional Polarity를 Gain active pass에 fuse하며 dynamic scratch allocation을 하지 않는다.
- callback에서는 allocation/free, lock/wait, I/O, logging/string formatting, graph mutation과 exception propagation을 허용하지 않는다.

## 검증된 Phase 기준선

| 범위 | exact source | clean run | 상태 |
| --- | --- | --- | --- |
| Phase 3B realtime foundation | `4b2535deba302eddab86c5c02b165e8d4f168cf4` | `32634527751` | Complete |
| Phase 3C1 graph execution correction | `837e01ef96c11800b246a50eff92c4599e630080` | `33610351357` | Complete |
| Phase 3C2 editable schema v3 | `b727afb4cd1471dbd61ce775355be60e040c7000` | `33622226202` | Complete |
| Phase 3C3 compatibility matrix | `d60667d8806e5dac7963ae928dcf98dc377cf0f7` | `33657806095` | Complete |
| Phase 3D1 Polarity | `96ba29cf009eab00980405d7de456b5f1d431956` | `34193494228` | Complete |

## Phase 3D1 acceptance evidence

Linux:

- Product Compiler format/lint/typecheck/test green
- Studio format/lint/typecheck/test/build green
- clang-format dry-run green
- Native Debug/Release build + CTest green
- Clang warnings-as-errors + CTest green
- Clang clang-tidy green

Windows x64:

- Product Compiler와 Studio quality gates green
- Debug/Release Product Runtime clean build green
- Warm/Bright/Inverted actual export green
- first-party inspector green
- official VST3 Validator normal/extensive green
- Debug/Release CTest green
- Studio product workflow green
- MSVC `/WX` green
- Windows clang-tidy green
- tracked-source mutation `0`

## 다음 단계

Phase 3D2는 아직 선택하지 않았다. 다음 node는 새 ExecPlan을 먼저 작성하고, 다시 source → compiler → Runtime → actual export까지 하나의 working vertical slice로 추가한다. 후보는 Pan, Dry/Wet, Biquad, Tilt EQ, Saturation이지만 현재 repository에는 이들을 위한 generic DAG, registry, macro system 또는 speculative scheduler를 미리 추가하지 않는다.

## 아직 완료하지 않은 영역

- Phase 3D2 이후 추가 DSP nodes
- arbitrary graph, split/merge, feedback, sidechain
- parameter/macro system
- functional Sound/Control graph authoring UI
- native plug-in interface designer
- presets/assets/product packaging
- packaged Studio, installer, signing, representative DAW matrix
- macOS Universal VST3/AU와 notarization

## 저장소 정리 원칙

- `.github`에는 장기 유지할 CI만 둔다. Phase acceptance용 임시 workflow는 완료 후 제거한다.
- patch/base64 payload/agent handoff를 repository source로 저장하지 않는다.
- 임시 branch/PR을 작업 저장소로 사용하지 않는다.
- 한 번에 하나의 ExecPlan만 진행한다.
