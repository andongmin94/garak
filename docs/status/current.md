# Garak Current Status

- 기준일: 2026-09-30
- 개발 브랜치: `main` 하나
- 권위 문서: current source tree → `ROADMAP.md` → active ExecPlan
- 수용된 기준선: **Phase 3D1 — Polarity Node, PASS / Complete**
- Phase 3D1 exact verified source: `96ba29cf009eab00980405d7de456b5f1d431956`
- Phase 3D1 clean Linux + Windows acceptance run: `34193494228`
- 현재 increment: **Phase 3D2 — Saturation Node, In Progress**
- 활성 계획: [`plans/0019-phase-3d2-saturation-node.md`](../../plans/0019-phase-3d2-saturation-node.md)
- Phase 3D2 Windows exact-source acceptance: **pending**

## 현재 구현·검증 중인 제품 경로

아래는 Phase 3D2 current source contract다. 아직 accepted Phase 3D1의 Windows 결과를 현재 변경의 검증 결과로 사용할 수 없다.

```text
.garak project schema v5 / graph source v3
→ Product Compiler strict validation and ordered legacy migration
→ deterministic product.garakbin + graph.garakbin
→ GARAKCPD 1.0 + GARAKGRF 1.2
→ prebuilt C++20 Product Runtime v1
→ module-load product/graph compatibility classification
→ exact immutable StaticExecutionBinding
→ Input → Gain → Output
   또는
   Input → Gain → Polarity → Output
   또는
   Input → Gain → Saturation → Output
→ product-bound Windows x64 VST3
→ first-party inspector + official VST3 Validator
```

현재 reference products는 `Artist Gain Warm`, `Artist Gain Bright`, `Artist Gain Inverted`, `Artist Gain Saturated`다. Warm/Bright는 Gain-only, Inverted는 Gain→Polarity, Saturated는 Gain→Saturation compiled graph를 사용한다. 네 제품은 같은 configuration의 prebuilt Product Runtime binary를 재사용하며 Product ID/FUID/metadata/default와 compiled product data는 제품별이다. Saturated의 Product ID는 `8a5ce3f8-7b74-4f53-bdc2-c52e4f586072`이고 default Gain은 `0 dB`다.

## 현재 persistent contract

- editable project schema v5
- embedded graph source v3
- supported legacy project inputs: v1, v2, v3, v4
- ordered source migration: v1→v2→v3→v4→v5
- v4→v5는 기존 node IDs와 node/connection array order, topology를 보존
- current source parse/serialize는 authoring array order를 보존; compiled bytes는 topology로 결정
- historical graph source v1 canonical ordering은 기존 계약 유지
- graph source v3 exact supported topologies:
  - `garak.audio-input → garak.gain → garak.audio-output`
  - `garak.audio-input → garak.gain → garak.polarity → garak.audio-output`
  - `garak.audio-input → garak.gain → garak.saturation → garak.audio-output`
- optional post-Gain node는 Polarity 또는 Saturation 중 최대 하나
- deterministic `GARAKCPD` 1.0
- deterministic `GARAKGRF` 1.2
- product-bound `GARAKPST` 1.0
- immutable Product ID와 deterministic processor/controller FUID
- permanent Gain `1001`, Bypass `1002`
- Polarity/Saturation은 public parameter/state가 없는 fixed graph operations
- `GARAKGRF` 1.0/1.1은 old/rebuild, future/corrupt graph data는 reject

## Runtime semantics

- Native Runtime은 세 exact canonical static plan만 bind한다.
- Gain-only는 identity active transform을 사용한다.
- Gain→Polarity는 Gain의 non-bypassed active sample에 fixed negation transform을 적용한다.
- Gain→Saturation은 finite non-bypassed post-Gain sample에 fixed `tanh` transform을 적용한다.
- host Bypass=true이면 whole product graph를 우회하고 exact dry input을 출력한다.
- Polarity/Saturation plan의 logical buffer count는 3이지만 callback에서는 하나의 optional post-Gain transform을 Gain active pass에 fuse하며 dynamic scratch allocation을 하지 않는다.
- callback에서는 allocation/free, lock/wait, I/O, logging/string formatting, graph mutation과 exception propagation을 허용하지 않는다.

## Phase 3D2 검증 상태

2026-09-30 Linux cloud working tree에서 확인한 결과다. 아직 clean exact-final-source Windows acceptance 기록은 아니다.

| Linux 범위 | 확인 결과 |
| --- | --- |
| Product Compiler format/lint/typecheck | 성공 |
| Product Compiler tests | 111개 중 110개 성공, 0개 실패, Windows-only junction test 1개 skip |
| Studio format/lint/typecheck/test/build | 성공; tests 19개 성공, 0개 실패/skip |
| First-party Native clang-format 19 dry-run | 49개 files 성공 |
| Native Debug build + CTest | 9/9 성공 |
| Clang 19 warnings-as-errors build + CTest | 9/9 성공 |
| Clang 19 clang-tidy build | 성공 |
| Native Release build + CTest | 9/9 성공 |
| Pinned recursive VST3 SDK checkout | exact pin 초기화 성공 |
| VST3 adapter/Saturated loaded-module test static checks | Clang 19 warnings-as-errors syntax checks 성공; Saturated test clang-tidy 성공 |

Windows Debug/Release four-product export, inspector, loaded-module tests, official Validator, Studio workflow, MSVC `/WX`, Windows clang-tidy와 clean exact-source acceptance는 아직 pending이다. Linux 결과와 SDK syntax/static checks는 Windows-only junction test, Windows module loading, actual export와 official Validator acceptance를 대체하지 않는다.

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

[ExecPlan 0019](../../plans/0019-phase-3d2-saturation-node.md)의 Phase 3D2 Saturation 구현과 Linux gates를 마친 뒤 exact final source의 clean Windows acceptance matrix를 실행한다. 모든 required gates의 실제 증거가 확보되기 전에는 Complete로 바꾸거나 다음 increment를 시작하지 않는다.

## 아직 완료하지 않은 영역

- Phase 3D2 Windows acceptance와 이후 추가 DSP nodes
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
