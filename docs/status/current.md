# Garak Current Status

- 기준일: 2026-09-05
- 개발 브랜치: `main` 하나
- 권위 문서: current source tree → `ROADMAP.md` → 현재 ExecPlan
- 수용된 기준선: **Phase 3C Complete**
- 활성 increment: **Phase 3D1 — Polarity Node, In Progress**
- 현재 Phase 3D1 구현 수용 여부: **미수용 — 독립 DSP 모듈과 테스트만 구현됨**

## 현재 동작하는 제품 경로

```text
.garak project schema v3 / graph source v1
→ Product Compiler
→ deterministic product.garakbin + graph.garakbin
→ prebuilt C++20 Product Runtime v1
→ module-load product/graph validation
→ Input → Gain → Output
→ product-bound Windows VST3
→ first-party inspector + official VST3 Validator
```

현재 reference products는 `Artist Gain Warm`과 `Artist Gain Bright`다.
생성 플러그인에서 수용된 DSP node는 여전히 Gain뿐이다. `native/dsp/polarity`에 독립 Polarity primitive와 테스트가 추가됐지만, graph source/compiler/Runtime 연결이나 Inverted product는 아직 구현되지 않았다.

## 수용된 계약

- editable project schema v3, embedded graph source v1
- deterministic `GARAKCPD` 1.0, `GARAKGRF` 1.0, `GARAKPST` 1.0
- immutable Product ID와 deterministic processor/controller FUID
- permanent Gain `1001`, Bypass `1002`
- strict legacy migration과 current/missing/old/future/corrupt compatibility disposition
- Product Compiler, Studio, Native Runtime과 inspector의 shared graph compatibility semantics
- Windows x64 Debug/Release actual VST3 export와 official Validator 경로
- Float32/Float64, mono/stereo Gain과 sample-accurate Gain/Bypass automation
- audio callback allocation/deallocation, lock, I/O, logging과 graph mutation 금지

## 검증된 기준선

| 범위 | exact source | clean Windows run | 상태 |
| --- | --- | --- | --- |
| Phase 3B realtime foundation | `4b2535deba302eddab86c5c02b165e8d4f168cf4` | `32634527751` | Complete |
| Phase 3C1 graph execution correction | `837e01ef96c11800b246a50eff92c4599e630080` | `33610351357` | Complete |
| Phase 3C2 editable schema v3 | `b727afb4cd1471dbd61ce775355be60e040c7000` | `33622226202` | Complete |
| Phase 3C3 compatibility matrix | `d60667d8806e5dac7963ae928dcf98dc377cf0f7` | `33657806095` | Complete |

과거 workflow 상태나 로컬 산출물은 현재 완료 근거로 사용하지 않는다.

## 활성 작업: Phase 3D1

현재 계획은 [`plans/0018-phase-3d1-polarity-node.md`](../../plans/0018-phase-3d1-polarity-node.md) 하나다.

구현된 부분은 ExecPlan의 step 2다. Polarity primitive는 Float32/Float64의 정확한 부호 반전, in-place/out-of-place span 처리와 길이 불일치 시 무수정 거부를 제공한다. 기존 CMake quality aggregate와 직접 테스트에 연결됐으며 기존 Gain 제품 경로는 바뀌지 않았다.

Linux 검증: GCC Debug/Release, Clang warnings-as-errors, Clang ASan/UBSan에서 각각 Native CTest 5/5 통과. 독립 Polarity stress는 sample type별 20,000블록과 1,907,696 channel-samples를 처리했고 계측한 C++ allocation/deallocation은 모두 0이었다. 이는 standalone primitive 검증이며 compiled Polarity graph나 Windows 제품 수용 결과가 아니다.

이번 변경에서 Product Compiler/Studio pinned quality gate, clang-format, clang-tidy, Windows/MSVC, actual export와 official Validator는 실행하지 않았다.

남은 수용 목표:

```text
project schema v4 / graph source v2
→ explicit v3→v4 migration
→ deterministic GARAKGRF 1.1
→ exact Gain-only 또는 Gain→Polarity plan
→ immutable Native binding
→ whole-product Bypass 보존
→ Artist Gain Inverted actual export
```

위 제품 경로를 구현한 뒤 아래 순서로 검증한다.

1. Product Compiler와 Studio format/lint/typecheck/test/build
2. Native Debug/Release build와 CTest
3. Warm/Bright/Inverted actual VST3 export와 official Validator
4. warnings-as-errors, clang-tidy, realtime allocation regression
5. 정확한 최종 `main` commit의 clean Windows 재검증
6. 성공 후에만 ExecPlan을 Complete로 변경

## 아직 완료하지 않은 영역

- Polarity의 제품 통합과 그 이후 Pan, Dry/Wet, Biquad, Tilt EQ, Saturation
- arbitrary graph, split/merge, feedback와 sidechain
- parameter/macro system
- functional Sound/Control graph authoring
- native plug-in interface designer
- presets, assets와 product packaging
- packaged Studio, installer, signing과 representative DAW matrix
- macOS Universal VST3/AU와 notarization

## 저장소 정리 원칙

- `.github`에는 장기 유지할 CI만 둔다. 현재는 일회성 workflow를 유지하지 않는다.
- patch, base64 payload, 복제 계획 문서와 agent handoff 파일을 repository source로 저장하지 않는다.
- 브랜치와 PR을 임시 저장소로 사용하지 않는다.
- 동시에 하나의 ExecPlan만 진행한다.
- 완료되지 않은 기능을 README, status 또는 roadmap에서 Complete로 기록하지 않는다.
