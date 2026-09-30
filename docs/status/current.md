# Garak Current Status

- 기준일: 2026-10-01
- 개발 브랜치: `main` 하나
- 권위 문서: current source tree → `ROADMAP.md` → completed ExecPlan
- 수용된 기준선: **Phase 3D2 — Saturation Node, PASS / Complete**
- Phase 3D2 exact verified implementation source: `b0c8fd8eeb3aa6290b0d211808cc0c25c38f27ab`
- Phase 3D2 clean Linux + Windows acceptance run: [36736534651](https://github.com/andongmin94/garak/actions/runs/36736534651)
- 완료된 계획: [`plans/0019-phase-3d2-saturation-node.md`](../../plans/0019-phase-3d2-saturation-node.md)
- 다음 increment: 하나의 추가 DSP node 선택과 별도 ExecPlan 작성

## 현재 수용된 제품 경로

아래는 Phase 3D2 exact implementation source의 clean Linux/Windows acceptance를 통과한 current product contract다. 검증 SHA는 구현 source를 식별하며 이 완료 기록을 추가하는 후속 documentation commit의 SHA를 뜻하지 않는다.

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

## Phase 3D2 acceptance evidence

Exact implementation source `b0c8fd8eeb3aa6290b0d211808cc0c25c38f27ab`를 clean Linux/Windows checkout에서 검증한 [run 36736534651](https://github.com/andongmin94/garak/actions/runs/36736534651)의 결과다. [Linux job](https://github.com/andongmin94/garak/actions/runs/36736534651/job/109959594107)과 [Windows job](https://github.com/andongmin94/garak/actions/runs/36736534651/job/109959593481)이 모두 성공했다. Client date는 2026-10-01 Asia/Seoul이며 CI timestamps는 UTC를 사용한다.

| 범위 | 확인 결과 |
| --- | --- |
| Linux Product Compiler format/lint/typecheck/test | 성공 |
| Linux Studio format/lint/typecheck/test/build | 성공 |
| Linux first-party Native clang-format | 성공 |
| Linux Native Debug/Release build + CTest | 성공 |
| Linux Clang warnings-as-errors build + CTest | 성공 |
| Linux Clang clang-tidy build | 성공 |
| Windows Product Compiler/Studio quality gates | 성공 |
| Windows Debug/Release Product Runtime clean build | 성공 |
| Windows Warm/Bright/Inverted/Saturated actual export | Debug/Release 모두 성공 |
| First-party inspector와 official VST3 Validator | 네 제품 Debug/Release normal/extensive 성공 |
| Legacy v1/v2/v3/v4→v5 actual migration export parity | Debug/Release 모두 성공; compiled product/graph, Runtime binary와 moduleinfo parity |
| Windows Debug/Release CTest | 성공; 두 configuration 모두 `--no-tests=error` gate 실행 |
| Studio Debug/Release product workflow | Saturated 포함 성공 |
| MSVC `/WX`와 Windows clang-tidy | 성공 |
| Exact-source clean checks | 성공; tracked-source mutation `0` |

별도 local Linux cloud 검증에서는 Product Compiler 111개 중 110개 성공/0개 실패/Windows-only junction 1개 skip, Studio 19개 성공/0개 실패/0개 skip, Native Debug/Release 및 Clang warnings-as-errors 각각 9/9를 확인했다. 이 숫자는 local Linux output에서 확인한 수치이며 Windows executed test count는 추정하지 않는다.

Windows Compiler tests와 actual export/loaded-module/Validator gates가 성공했으며 SDK syntax checks를 이 acceptance 대신 사용하지 않았다. Evidence는 ordinary workflow logs, required step outcomes와 failure annotations이며 Actions artifact/cache 업로드에 의존하지 않는다. Detailed commands, failed-run diagnosis와 exact implementation evidence는 [Phase 3D2 validation](phase-3d2-saturation-validation.md)에 있다.

## 검증된 Phase 기준선

| 범위 | exact source | clean run | 상태 |
| --- | --- | --- | --- |
| Phase 3B realtime foundation | `4b2535deba302eddab86c5c02b165e8d4f168cf4` | `32634527751` | Complete |
| Phase 3C1 graph execution correction | `837e01ef96c11800b246a50eff92c4599e630080` | `33610351357` | Complete |
| Phase 3C2 editable schema v3 | `b727afb4cd1471dbd61ce775355be60e040c7000` | `33622226202` | Complete |
| Phase 3C3 compatibility matrix | `d60667d8806e5dac7963ae928dcf98dc377cf0f7` | `33657806095` | Complete |
| Phase 3D1 Polarity | `96ba29cf009eab00980405d7de456b5f1d431956` | `34193494228` | Complete |
| Phase 3D2 Saturation | `b0c8fd8eeb3aa6290b0d211808cc0c25c38f27ab` | [36736534651](https://github.com/andongmin94/garak/actions/runs/36736534651) | Complete |

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

다음 하나의 DSP node를 선택하고 별도 ExecPlan을 작성한 뒤 source → compiler → Runtime → actual export까지 검증한다. Phase 4/5/6와 cross-platform release 작업은 roadmap의 별도 milestones로 남는다.

## 아직 완료하지 않은 영역

- Saturation 이후 추가 DSP nodes
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
