# Phase 3D2 Saturation Validation

- 상태: PASS / Complete
- 기준일: 2026-10-01, Asia/Seoul
- Exact verified implementation source: `b0c8fd8eeb3aa6290b0d211808cc0c25c38f27ab`
- Clean Linux + Windows acceptance: [run 36736534651](https://github.com/andongmin94/garak/actions/runs/36736534651)
- Linux job: [109959594107](https://github.com/andongmin94/garak/actions/runs/36736534651/job/109959594107), success
- Windows job: [109959593481](https://github.com/andongmin94/garak/actions/runs/36736534651/job/109959593481), success
- Completed plan: [ExecPlan 0019](../../plans/0019-phase-3d2-saturation-node.md)

위 SHA는 acceptance를 통과한 구현 source를 식별한다. 이 결과를 기록하는 후속 documentation commit의 SHA와는 구분한다. Windows job은 2026-09-30 15:34:47 UTC에 완료됐으며 client timezone에서는 2026-10-01 00:34:47 Asia/Seoul이다.

## Accepted scope

Fixed parameterless `garak.saturation` v1은 finite active post-Gain sample에 Float32/Float64 `tanh`를 적용한다. Whole-product sample-accurate Bypass는 exact dry input을 출력한다. Current project schema v5 / graph source v3 / `GARAKGRF` 1.2는 exact Gain-only, Gain→Polarity 또는 Gain→Saturation만 받아들이며 optional post-Gain node는 최대 하나다.

`GARAKCPD` 1.0, `GARAKPST` 1.0, Gain `1001`, Bypass `1002`, Product ID와 deterministic FUID derivation은 유지한다. Supported legacy v1/v2/v3/v4는 ordered migration으로 v5에 도달한다. v4→v5는 기존 node IDs와 node/connection array order를 보존한다. Current source authoring order는 보존하면서 equivalent topology는 동일한 deterministic compiled bytes를 만든다. Historical graph v1 canonical ordering은 바뀌지 않는다.

네 reference products는 Warm, Bright, Inverted와 Saturated다. Saturated는 Product ID `8a5ce3f8-7b74-4f53-bdc2-c52e4f586072`, default Gain `0 dB`와 Gain→Saturation topology를 사용한다. 제품들은 configuration별 같은 prebuilt Runtime을 재사용하며 product identity와 state binding은 제품별이다.

## Exact-source verification

두 jobs는 요청한 `main` SHA를 clean checkout하고 frozen lockfile로 설치한 뒤 permanent [Verify workflow](../../.github/workflows/verify.yml)를 실행한다. 검증 전후 exact HEAD와 tracked/staged/untracked source cleanliness를 검사한다. 검증 명령은 source를 rewrite하거나 commit/push하지 않는다.

| 범위 | Required gates와 결과 |
| --- | --- |
| Linux Compiler | format/lint/typecheck/tests 성공 |
| Linux Studio | format/lint/typecheck/tests/build 성공 |
| Linux Native | first-party clang-format, Debug/Release CTest, Clang warnings-as-errors CTest와 clang-tidy 성공 |
| Windows Compiler/Studio | format/lint/typecheck/tests와 Studio build 성공 |
| Windows Runtime | Debug/Release clean build 성공 |
| Four-product export | Warm/Bright/Inverted/Saturated Debug/Release actual export 성공 |
| Package/module validation | first-party inspector, official Validator normal/extensive, loaded-module/CTest 성공 |
| Legacy migration export parity | v1/v2/v3/v4→v5 Debug/Release actual migration/export parity 성공 |
| Studio product workflow | Debug/Release Saturated 포함 성공 |
| Strict Windows Native | MSVC `/WX`와 Windows clang-tidy 성공 |
| Source cleanliness | 두 jobs 성공; tracked-source mutation `0` |

CTest gates는 `--no-tests=error`를 사용한다. Windows executed test counts는 registration에서 추정하지 않는다. 별도 local Linux에서 직접 확인한 Compiler 111개 중 110개 성공/1개 Windows-only skip, Studio 19개 성공, Native Debug/Release와 Clang warnings-as-errors 각각 9/9는 [current status](current.md)에 local evidence로 기록했다.

Migration parity script는 supported legacy sources의 ordered migration 뒤 두 configuration에서 실제 export를 실행한다. Compiled product/identity 의미, current compiled graph, prebuilt Runtime binary와 moduleinfo parity를 확인한다. In-memory migration만으로 actual package parity를 대신하지 않는다.

Acceptance evidence는 위 exact-source run의 ordinary workflow logs, required step results와 native failure annotations다. 성공 run에는 failure annotation이 없다. `out/reports/`와 CTest `LastTest.log`는 실행 중 생성하는 local outputs이며 이 acceptance 기록은 uploaded Actions artifact에 의존하지 않는다. Permanent workflow에는 artifact-upload 또는 cache action이 없다.

## Diagnosed verification failures

| Source / run | 확인한 결과와 실패 |
| --- | --- |
| `c4f5d86` / [36730130120](https://github.com/andongmin94/garak/actions/runs/36730130120) | Linux와 Windows Debug four-product export/inspector/Validator 성공 후 migration parity의 Node prerequisite에서 실패; 이후 Windows gates skip |
| `2a69737` / [36732013368](https://github.com/andongmin94/garak/actions/runs/36732013368) | Diagnostic 개선 후 같은 prerequisite 실패; 이후 Windows gates skip |
| `7d6c8b3` / [36733190540](https://github.com/andongmin94/garak/actions/runs/36733190540) | Windows Debug/Release export, migration parity, CTest와 Studio workflow 성공 후 MSVC `/WX` 실패; Windows clang-tidy skip |
| `aad315f` / [36735435526](https://github.com/andongmin94/garak/actions/runs/36735435526) | Native failure annotations에서 MSVC C4702/C2220 원인 확인; Windows clang-tidy skip |

PowerShell의 `(Get-Command node.exe -CommandType Application).Source`가 duplicate PATH entries에서 두 Application source를 반환해 invalid executable path가 됐다. `7d6c8b3`는 첫 PATH Application을 선택하며 ordinary-file/symlink guard를 유지했다. Real PowerShell checks는 두 duplicate PATH 순서에서 성공하고 symlink executable은 거부했다.

`aad315f`의 annotations는 `native/tests/static_graph_tests.cpp:296`에서 C4702 unreachable code가 `/WX`의 C2220으로 승격된 사실을 보여줬다. Saturation test의 expected-value lambda가 `if constexpr` 안에서 return한 뒤 identity/polarity용 trailing return을 남겼다. `b0c8fd8`는 alternative return을 explicit `else`에 넣어 numeric expectations와 strict warning settings를 유지했다. 위 failed runs는 partial evidence이며 acceptance는 모든 required gates를 실행한 최종 success run이 제공한다.

## Remaining product boundaries

이 acceptance는 Phase 3D2를 완료한다. General graph/DAG scheduling, Polarity+Saturation 조합, public Saturation controls, parameter/macro authoring, graph canvas, native plug-in UI, packaged Studio, signing/installers, representative DAW matrix, macOS Universal VST3/AU와 notarization은 별도 roadmap 작업이다. Historical accepted ADRs와 과거 Phase evidence는 원래 의미를 유지한다.
