# Phase 1B VST3 Product Identity Status

- 기준일: 2026-08-09
- 범위: Windows x64 runtime packaging A/B spike의 네 제품
- 결정 상태: identity와 coexistence evidence 확보; runtime 전략은 미결정
- 관련 계획: [Phase 1B ExecPlan](../../plans/0004-phase-1b-generated-runtime-ab-spike.md)
- Artifact 근거: [Phase 1B Runtime Strategy Artifacts](phase-1b-runtime-strategy-artifacts.md)
- Adapter 경계: [VST3 Adapter](../architecture/vst3-adapter.md)
- 전략 결정: [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)

## 고정 identity

Phase 1B spike의 네 제품은 vendor `Garak`, semantic version `0.1.0`, processor category
`Audio Module Class`, subcategory `Fx`와 controller category `Component Controller Class`를
사용한다. 각 factory는 processor와 controller 두 class만 노출한다. Gain과 Bypass parameter
numeric ID는 네 제품 모두 각각 `1001`과 `1002`이며 Bypass 기본값은 off다.

| Product | Processor FUID | Controller FUID | Gain ID | Bypass ID | Default Gain |
| --- | --- | --- | ---: | ---: | ---: |
| Garak Data Alpha | `4B2B557251D44CE9914F9B105136FB7E` | `7A90454628B34A3497F05E7CC718F8A1` | 1001 | 1002 | -6.0 dB (`0.75` normalized) |
| Garak Data Beta | `C29B7245261642668ADAC664B6817678` | `1DE08859308F4A0A8473EA5CB70771D2` | 1001 | 1002 | +3.0 dB (`0.875` normalized) |
| Garak Thin Alpha | `93952A37BFA84FF1AC06CE58B9FA87EA` | `E08F3ACCD825424AB238BBAB6B0248CC` | 1001 | 1002 | -6.0 dB (`0.75` normalized) |
| Garak Thin Beta | `44BFB8B6F56946FF9F6F193529BCB967` | `826C362FA2784F719351912BE834F9AB` | 1001 | 1002 | +3.0 dB (`0.875` normalized) |

`Alpha`와 `Beta`는 같은 sound default를 A/B packaging 방식 사이에서 비교하기 위한 쌍이다.
Data와 Thin 제품의 FUID는 서로 다르며, Phase 1A `Garak Gain Spike`의 processor/controller FUID와도
겹치지 않는다. 이번 값은 기술 spike fixture이고 출시된 commercial product identity라는 주장은
하지 않는다.

## Alternative A descriptor identity

`Garak Data Alpha`와 `Garak Data Beta`는 같은 prebuilt template binary를 사용하지만 각 bundle의
`Contents/Resources/garak-product-spike-v1.txt`가 product name, processor/controller FUID,
parameter ID와 default Gain을 고정한다. Descriptor는 ASCII, LF-only, final LF 포함, 최대
1024바이트인 strict 11-line schema다. Alpha descriptor는 276바이트, Beta descriptor는
274바이트다.

Windows module loader는 current working directory가 아니라 실제 loaded module image의 bundle을
기준으로 descriptor를 찾는다. Bundle leaf, inner module basename과 descriptor product name이
일치해야 하며 missing, malformed, duplicate, out-of-range, identity mismatch 또는 oversized
descriptor는 factory를 노출하지 않고 fail closed한다.

## Alternative B wrapper identity

`Garak Thin Alpha`와 `Garak Thin Beta`는 각각 한 개의 product-specific factory wrapper translation
unit에 위 identity와 default를 compile-time immutable value로 둔다. Processor, controller,
state와 DSP 동작은 `garak_runtime_strategy_spike_common`에 한 번 정의하며 wrapper가 그 구현을
복사하지 않는다. 두 wrapper는 별도 object와 별도 module link를 만들고 서로 다른 inner module
SHA-256을 가진다.

## Independent fixture parity

Identity acceptance는 production identifier 상수를 기대값으로 재사용하지 않는다.

- `runtime_strategy_contract_tests.cpp`는 네 제품 이름, 8개 FUID, version, vendor, category,
  parameter ID와 default를 test-local literal로 별도 고정한다.
- Loaded factory metadata와 processor/controller association을 위 literal에 대조하고, 같은 factory를
  반복 조회해 class metadata가 변하지 않는지 확인한다.
- Pinned SDK `ModuleInfoLib` parser로 `moduleinfo.json`을 구조적으로 읽어 root Name/Version,
  Factory Vendor, 정확히 두 class, CID/name/category/subcategory/version을 같은 독립 fixture와
  비교한다. Substring 존재만으로 parity를 판정하지 않는다.
- PowerShell package path도 허용 product name을 Alpha/Beta 두 개로 제한하고 각각의 FUID와
  `-6.0`/`3.0` default를 independent literal mapping으로 검증한다.
- Descriptor parser pure test와 loaded malformed fixtures는 canonical `Garak Data Alpha.vst3`
  bundle/inner basename을 유지한다. Descriptor/product-name mismatch와 bundle/inner mismatch는
  별도 fixture이므로 다른 loader failure가 parser defect를 가리지 않는다.

## Coexistence evidence

하나의 Windows test process가 Phase 1A Gain Spike와 네 Phase 1B 제품, 총 다섯 module을 동시에
load한다. 열 개 processor/controller FUID가 모두 고유하고 Data Alpha/Beta의 byte-identical inner
module도 서로 다른 Windows module handle을 가진다.

각 session에 서로 다른 whole state를 먼저 쓴 뒤 별도 loop에서 모두 다시 읽으며, 다섯 processor를
forward/reverse 순서로 interleave processing한 뒤 output과 state를 다시 확인한다. 같은 module의
두 instance도 mutable state를 공유하지 않는다. Reverse-order teardown 뒤 Data Alpha를 다시 load해
factory class count, name, FUID와 default를 재검증하고 clean unload한다.

Official validator raw reports는 Debug/Release의 네 제품 각각 standard 47/47과 extensive 537/537,
failed test, warning과 crash 0을 기록한다. Phase 1A Gain Spike regression을 포함하면 report는 총
20개다. 이 Windows evidence를 macOS host discovery, signing identity, AU 또는 commercial product
identity의 통과로 일반화하지 않는다.
