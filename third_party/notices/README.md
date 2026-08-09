# Third-party license and notice boundary

이 문서는 checkout에 존재하는 license 원문과 Phase 1A build 경계를 구분한다. License
expression은 원문 식별을 돕는 상태 기록이며 법률 의견, 재배포 허가 또는 전체 transitive
audit 완료를 의미하지 않는다. Exact pin과 hash는 [dependency inventory](../dependencies.yml)를
기준으로 한다.

## VST3 SDK package

SDK superproject와 다음 nested repository는 같은 내용의 MIT 원문을 각각 보존한다.

- [SDK LICENSE.txt](../vst3sdk/LICENSE.txt)
- [base LICENSE.txt](../vst3sdk/base/LICENSE.txt)
- [CMake LICENSE.txt](../vst3sdk/cmake/LICENSE.txt)
- [documentation LICENSE.txt](../vst3sdk/doc/LICENSE.txt)
- [pluginterfaces LICENSE.txt](../vst3sdk/pluginterfaces/LICENSE.txt)
- [public SDK LICENSE.txt](../vst3sdk/public.sdk/LICENSE.txt)

Phase 1A plugin과 official validator의 실제 compile/link 집합은 build 검증 뒤 확정한다. SDK
sample 전체가 plugin에 포함된다고 가정하지 않는다.

`public.sdk` checkout에는 disabled sample source의 별도 원문도 있다.

- [MetalNanoVG license](../vst3sdk/public.sdk/samples/vst/dataexchange/source/3rdparty/MetalNanoVG/LICENSE) — MIT
- [NanoVG license](../vst3sdk/public.sdk/samples/vst/dataexchange/source/3rdparty/nanovg/LICENSE.txt) — zlib

Phase 1A는 SDK plugin sample을 build하거나 link하지 않으므로 이 두 sample dependency는
checkout-only다.

## Tutorials limitation

`third_party/vst3sdk/tutorials`는 exact nested commit으로 checkout되지만 tracked standalone
`LICENSE`, `LICENCE`, `COPYING` 또는 `NOTICE` 파일이 없고 README에도 license 문구가 없다.
SDK superproject README는 VST3 SDK package를 MIT로 표현하지만, 그 package-level 문구가 별도
`vst3_tutorials` repository에 적용되는지는 독립적으로 해결하지 않았다. 따라서 inventory의
license expression은 `NOASSERTION`이며 tutorials는 Phase 1A에서 build/link하지 않는다.

이 제한을 해결하기 전에는 모든 nested repository의 독립 license 검토가 완료됐다고 주장하면
안 된다.

## VSTGUI

[VSTGUI license](../vst3sdk/vstgui4/LICENSE)는 BSD 3-Clause 조건에 해당한다. VSTGUI는 recursive
SDK checkout에 존재하지만 Phase 1A에는 custom editor가 없으며 VSTGUI support, source, target과
library를 build 또는 link하지 않는다.

VSTGUI checkout 내부에는 다음 원문도 존재한다.

- [miniz license](../vst3sdk/vstgui4/vstgui/thirdparty/miniz/LICENSE) — MIT
- [RapidJSON license collection](../vst3sdk/vstgui4/vstgui/thirdparty/rapidjson/license.txt) — 여러 구성의 license를 포함하므로 `NOASSERTION`
- [tiny-js license](../vst3sdk/vstgui4/vstgui/uidescription-scripting/tiny-js/LICENSE) — MIT

VSTGUI 자체와 이 vendored source는 모두 checkout-only이며 Garak Gain Spike에 build/link하지
않는다.

## Distribution boundary

- Root Garak repository license는 미정이며 root `LICENSE` 파일을 만들지 않는다.
- Upstream license 원문은 submodule 안에서 수정 없이 보존한다.
- Phase 1A local build 성공은 commercial distribution notice 검토 완료를 의미하지 않는다.
- 실제 배포 artifact에 포함되는 object/source/resource가 확정되면 해당 license와 notice를 다시
  검토해야 한다.
- VST trademark와 usage guideline 검토는 copyright license 검토와 별개다.

현재 판정은 [Phase 1A VST3 dependency status](../../docs/status/phase-1a-vst3-dependency.md)에
기록한다.

