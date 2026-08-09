# Phase 1A VST3 Dependency Status

- 기준일: 2026-08-09
- 상태: Phase 1A exact checkout/build/link/quality verified; commercial legal audit incomplete
- 관련 계획: [Phase 1A ExecPlan](../../plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)
- 검증 기록: [Phase 1A VST3 Validation](phase-1a-vst3-validation.md)
- 정책: [Dependency and License Policy](../architecture/dependency-policy.md)
- Inventory: [third-party dependencies](../../third_party/dependencies.yml)
- Notices: [third-party notice boundary](../../third_party/notices/README.md)

## 판정

공식 `steinbergmedia/vst3sdk`를 Git submodule로 추가했고 required tag와 full commit을 local
checkout에서 대조했다. SDK superproject와 7개 nested repository는 parent gitlink와 같은
detached HEAD이며 tracked/untracked 변경이 없다.

Dependency acquisition과 provenance, Windows x64 Debug/Release build graph와 plugin link command는
검증됐다. Garak Gain Spike의 SDK target 집합은 `sdk`, `sdk_common`, `base`, `pluginterfaces`이며,
local official validator와 contract-test host는 별도 `sdk_hosting`을 사용한다. `sdk_hosting`과
VSTGUI는 plugin에 link되지 않는다.

First-party Werror, clang-tidy와 clang-format도 SDK source를 제외한 target 경계에서 통과했다.
따라서 Phase 1A의 dependency와 기술 수용 기준은 **PASS**다. Commercial distribution을 위한
transitive legal audit는 별도 미완료 범위이며 이번 기술 PASS가 상용 재배포 승인을 뜻하지 않는다.

## Exact pin

| Path | Repository | Commit | Standalone license | Phase 1A build/link 상태 |
| --- | --- | --- | --- | --- |
| `third_party/vst3sdk` | `steinbergmedia/vst3sdk` | `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0` | MIT, `LICENSE.txt` | Debug/Release 검증; plugin은 `sdk`, `sdk_common`, `base`, `pluginterfaces` |
| `base` | `steinbergmedia/vst3_base` | `3d2e82f8e6bff59c1d8b7a27491a29c2286b5206` | MIT, `LICENSE.txt` | `base` build/link 확인 |
| `cmake` | `steinbergmedia/vst3_cmake` | `de6e54eeaaab35b7145f5c32c279b5e892146e04` | MIT, `LICENSE.txt` | Configure-only, binary link 없음 |
| `doc` | `steinbergmedia/vst3_doc` | `6d4737c9e70750056e731d88d49aa06eefc8a1a4` | MIT, `LICENSE.txt` | Build/link 안 함 |
| `pluginterfaces` | `steinbergmedia/vst3_pluginterfaces` | `31d6eeba6daaa3e2a8bfbe3e7a90ca0b7fbfbc1c` | MIT, `LICENSE.txt` | `pluginterfaces` build/link 확인 |
| `public.sdk` | `steinbergmedia/vst3_public_sdk` | `a3911a4615dabbfdfd9d181ee26b05c70c289a95` | MIT, `LICENSE.txt` | Plugin `sdk`/`sdk_common`; validator/host `sdk_hosting` |
| `tutorials` | `steinbergmedia/vst3_tutorials` | `33b73dfbb87f3fde3bce8c0a10cae934dc66ad34` | `NOASSERTION`; standalone file 없음 | Build/link 안 함 |
| `vstgui4` | `steinbergmedia/vstgui` | `76823bdbe286e4bdb9f79ab8986af5ce7202336c` | BSD-3-Clause, `LICENSE` | Checkout-only; build/link false |

SDK exact tag는 `v3.8.0_build_66`이다. Root `.gitmodules`에는 official HTTPS URL과 path만
기록하며 floating branch를 기록하지 않는다. Nested URL과 commit은 upstream superproject의
`.gitmodules`와 gitlink를 그대로 따른다.

## License와 notice

SDK, base, CMake, documentation, pluginterfaces와 public SDK의 root license 원문은 같은 MIT
text와 SHA-256을 가진다. VSTGUI는 별도 BSD 3-Clause 원문을 가진다. 원문 경로와 hash, unbuilt
sample/vendored license는 [inventory](../../third_party/dependencies.yml)에 기록했다.

`vst3_tutorials`에는 standalone license/notice 파일이나 README license statement가 없다.
SDK superproject README의 package-level MIT 설명은 확인했지만 별도 tutorials repository에 대한
적용 범위를 독립적으로 해결하지 않았다. Tutorials는 build/link하지 않으며 이 제한 때문에
모든 nested repository의 독립 license audit가 완료됐다고 표현하지 않는다.

Root Garak repository의 license는 계속 미정이다. Third-party MIT/BSD 원문은 Garak 자체의
license 선택이 아니다.

## Build와 link 경계

- Phase 1A는 VST3 plugin example을 build하지 않는다.
- `doc`와 `tutorials`는 checkout-only다.
- VSTGUI는 checkout에 존재하지만 custom editor가 없으므로 support를 비활성화하고 어떤
  VSTGUI source, target 또는 library도 Garak Gain Spike에 build/link하지 않는다.
- `public.sdk` 안의 MetalNanoVG/NanoVG sample과 VSTGUI 안의 vendored dependency도 build/link하지
  않는다.
- SDK source에는 Garak warning-as-errors, clang-format 또는 clang-tidy를 적용하지 않는다.
- SDK source와 license에는 Garak patch가 없다.
- Debug/Release Ninja와 plugin link command에서 `sdk`, `sdk_common`, `base`, `pluginterfaces`를
  확인했다. Official validator와 contract-test host는 별도 `sdk_hosting` target을 사용하며
  plugin link command에는 나타나지 않는다.
- Debug/Release CMake cache에서 `SMTG_ENABLE_VSTGUI_SUPPORT=OFF`이고 plugin link command의
  VSTGUI hit는 0이다.
- `SMTG_CREATE_PLUGIN_LINK=OFF`이므로 system VST3 directory link를 만들지 않는다. Bundle은
  `out/build/vst3-{debug,release}/VST3/` 아래 local artifact로만 존재한다.
- Final bundle의 icon과 `moduleinfo.json` scan 결과는 각각 0이며, optional module-info
  generation도 꺼져 있다.

## 후속 검토 범위

- Commercial distribution을 위한 notice, trademark와 transitive legal review
- macOS SDK checkout/build/license packaging

이 두 항목은 Phase 1A Windows 기술 spike의 비범위다. 별도 검토 없이 macOS 또는 상용 배포가
승인됐다고 표현하지 않는다.
