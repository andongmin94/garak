# Phase 1B Runtime Strategy Artifact Status

- 기준일: 2026-08-09
- 범위: Windows x64 Debug/Release runtime packaging A/B spike
- 결정 상태: 두 대안의 비교 evidence 확보; 선호안, 기본값과 production 선택은 없음
- 관련 계획: [Phase 1B ExecPlan](../../plans/0004-phase-1b-generated-runtime-ab-spike.md)
- Identity 근거: [Phase 1B VST3 Product Identities](phase-1b-vst3-identities.md)
- Adapter 경계: [VST3 Adapter](../architecture/vst3-adapter.md)
- Dependency 경계: [Dependency and License Policy](../architecture/dependency-policy.md)
- 전략 결정: [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)

## 실제 artifact 위치

Template, Gain Spike와 Thin 제품은 configuration별
`out/build/runtime-strategy-<config>/VST3/<Config>/` 아래에 있다. Alternative A가 package한 Data
제품의 실제 evidence path는 configuration별
`out/build/runtime-strategy-<config>/runtime-products/`다. `runtime-products`는 이번 spike의
관찰된 local path이며 production export layout 선택이 아니다.

모든 경로는 repository의 ignored `out/` 안에 있고 system/user VST3 directory에 install, copy 또는
link하지 않았다. Runtime Template은 Data 제품을 만드는 입력이며 descriptor와 product-specific
`moduleinfo.json`이 없는 비배포 template이다.

## Debug artifact

단위는 byte다. `Resources`는 descriptor와 moduleinfo를 포함한 resource file byte의 합이다.

| Bundle | Inner module bytes | Inner SHA-256 | Bundle bytes | Resources | moduleinfo | Descriptor |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Runtime Template | 1,612,288 | `5C9A4282D5956D8B67AE639BBB8C613CC8FE8681B5B6720A6B84499F3741FC15` | 1,612,288 | 0 | 0 | 0 |
| Garak Gain Spike | 1,456,128 | `81018A6F88BD4416E694815381AB8D4B6F0D1026D0A4384AAE622B6A08306B24` | 1,456,128 | 0 | 0 | 0 |
| Garak Data Alpha | 1,612,288 | `5C9A4282D5956D8B67AE639BBB8C613CC8FE8681B5B6720A6B84499F3741FC15` | 1,613,567 | 1,279 | 1,003 | 276 |
| Garak Data Beta | 1,612,288 | `5C9A4282D5956D8B67AE639BBB8C613CC8FE8681B5B6720A6B84499F3741FC15` | 1,613,562 | 1,274 | 1,000 | 274 |
| Garak Thin Alpha | 1,520,128 | `2BABCA4A6394E9DE6056429E7020DC71631769F9A3F19D6E3B556CA429D3E13E` | 1,521,131 | 1,003 | 1,003 | 0 |
| Garak Thin Beta | 1,520,128 | `1FA6CC1398BD788435F7F8F421634F11DDFBF8154D22F5E41DAA70608FB32595` | 1,521,128 | 1,000 | 1,000 | 0 |

## Release artifact

| Bundle | Inner module bytes | Inner SHA-256 | Bundle bytes | Resources | moduleinfo | Descriptor |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Runtime Template | 700,928 | `CBCE1F16C1F2A7D6C53993FEA0C6FE923C078DF02ADEB7D12A96127B3BE46C7D` | 700,928 | 0 | 0 | 0 |
| Garak Gain Spike | 602,624 | `32FF044C2F39E7CACEA5CE834A3ABC0AE4532BA0A38C84D31D0CF1F00508ACB1` | 602,624 | 0 | 0 | 0 |
| Garak Data Alpha | 700,928 | `CBCE1F16C1F2A7D6C53993FEA0C6FE923C078DF02ADEB7D12A96127B3BE46C7D` | 702,207 | 1,279 | 1,003 | 276 |
| Garak Data Beta | 700,928 | `CBCE1F16C1F2A7D6C53993FEA0C6FE923C078DF02ADEB7D12A96127B3BE46C7D` | 702,202 | 1,274 | 1,000 | 274 |
| Garak Thin Alpha | 642,560 | `CE739B7719513D8B802B4A7E49C1F03409B6720392F16102A48AEABFA08DD078` | 643,563 | 1,003 | 1,003 | 0 |
| Garak Thin Beta | 642,560 | `A91B717361A3B088708EE274F1BCA1A5B8A7D75A66AA9460CDA9A1F6F779E4D3` | 643,560 | 1,000 | 1,000 | 0 |

Template, Data Alpha와 Data Beta는 configuration 안에서 SHA-256뿐 아니라 bytes가 같다. Thin
Alpha와 Thin Beta는 같은 크기지만 서로 다른 hash다. Artifact JSON과 실제 12개 bundle의 file
count, 각 file byte/hash, bundle byte 합과 directory inventory를 다시 대조했으며 mismatch는 0이다.

## Common library와 wrapper delta

| Configuration | Artifact | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Debug | `garak_runtime_strategy_spike_common.lib` | 1,538,986 | `86729149C8C9FA5F1650F001D50796E8580DF85F67FCA245117876E9172F12B0` |
| Debug | `garak_runtime_strategy_descriptor.lib` | 599,256 | `FAF93AEB8AFF29E1F8FFE823FBDF2650DB43871E7B51DDD45AC12F763164227C` |
| Release | `garak_runtime_strategy_spike_common.lib` | 417,788 | `C6315EFDEAE421BB725C5C7B9BF13B38800BAE15461EC41BB946C8BBE9E50809` |
| Release | `garak_runtime_strategy_descriptor.lib` | 312,380 | `3F7AF4F052641801F9DE15E928BE018927D07E258F050266A17615218196A5F0` |

| Wrapper source | Physical lines | Nonblank lines | Debug object | Release object |
| --- | ---: | ---: | ---: | ---: |
| `data_runtime_factory.cpp` | 15 | 14 | 252,842 | 46,233 |
| `descriptor_loader_win.cpp` | 124 | 106 | 1,385,749 | 576,996 |
| Alternative A wrapper total | 139 | 120 | 1,638,591 | 623,229 |
| `thin_alpha_factory.cpp` | 28 | 24 | 308,534 | 49,400 |
| `thin_beta_factory.cpp` | 28 | 24 | 308,534 | 49,421 |

`garak_runtime_strategy_spike_common`은 controller, processor, factory support와 state stream 네
first-party translation unit을 configuration별 한 번 compile한다. Descriptor library는
`product_definition.cpp` 한 translation unit이다. Static common library는 source/object reuse를
보이지만 executable code는 각 final binary에 포함되므로 dynamic shared runtime으로 해석하지
않는다.

## Compile, link와 package graph

`compile_commands.json`, `build.ninja`와 CMake source를 대조한 결과는 두 configuration에서 같다.

| Output | Product-specific first-party compile TU | SDK entry TU | Module link | Package step |
| --- | ---: | ---: | ---: | --- |
| Runtime Template | 2 | 1 | 1 | 없음 |
| Garak Data Alpha | 0 | 0 | 0 | Template + descriptor + moduleinfotool |
| Garak Data Beta | 0 | 0 | 0 | Template + descriptor + moduleinfotool |
| Garak Thin Alpha | 1 | 1 | 1 | moduleinfo create/validate |
| Garak Thin Beta | 1 | 1 | 1 | moduleinfo create/validate |

Template의 first-party TU 두 개는 `data_runtime_factory.cpp`와 `descriptor_loader_win.cpp`다. Thin
제품은 각각 factory wrapper 한 TU다. 각 실제 module target은 pinned SDK `dllmain.cpp` 한 TU를
추가로 compile한다. Data Alpha/Beta는 C++ target이나 module linker edge가 없고 custom package
command로만 생성된다.

## Package-only reproduction

Plain Windows PowerShell에서 `cl.exe`와 `link.exe`가 PATH에 없는 상태로 Debug/Release의 Data
Alpha/Beta output 네 개를 다시 package했다. Evidence JSON은 compiler 또는 build tool invocation
count `0`, `clOnPath=false`, `linkOnPath=false`를 기록한다. Package transcript의 12개
`moduleinfotool` create/validate command는 모두 exit 0이다.

두 configuration의 template binary, common/descriptor library, wrapper object와 Thin binary로 구성된
immutable input 18개는 package-only run 전후 byte length, SHA-256과 last-write tick이 모두 같았고,
현재 파일과 evidence를 다시 비교한 mismatch도 0이다. Regenerated Data output 네 개의 inner
hash/size는 위 표와 일치한다.

## PE, import와 resource inventory

12개 inner module은 모두 machine `0x8664`, PE32+, DLL이다. Debug module의 static imports는
`KERNEL32.dll`, `MSVCP140D.dll`, `ole32.dll`, `ucrtbased.dll`, `USER32.dll`,
`VCRUNTIME140D.dll`, `VCRUNTIME140_1D.dll`이다. Release는 해당 release CRT와 Windows system DLL을
사용하며 descriptor loader가 포함된 Template/Data만 filesystem CRT import 하나가 추가된다.

PE import와 delay-import directory 검사 범위에서 delay import와 forbidden Electron, Chromium,
Node.js 또는 JavaScript runtime import는 0이다. 각 bundle의 directory는 `Contents`,
`Contents/Resources`, `Contents/x86_64-win`뿐이다. File count는 Template/Gain 1, Data 3, Thin 2이며
icon, `desktop.ini`, snapshot, editor 또는 VSTGUI resource는 없다.

## Validator evidence

Debug/Release, Gain/Data Alpha/Data Beta/Thin Alpha/Thin Beta, standard/extensive 조합의 raw report
20개가 정확히 존재한다. Standard는 각 47 passed/0 failed, extensive는 각 537/0이며 warning,
failed marker와 crash marker는 0이다. 각 report의 processor/controller name과 CID도 독립 identity
fixture와 일치한다. Raw report 자체에는 process exit code field가 없으므로 command-level exit 0은
validator wrapper 실행 결과와 함께 인용한다.

## A/B 관찰과 남은 경계

| 관찰 | Alternative A | Alternative B |
| --- | --- | --- |
| Product export native work | Product별 compile/link 0; prebuilt template byte reuse | Product별 wrapper compile 1, module link 1 |
| Product variation | Strict descriptor와 generated moduleinfo | Compile-time wrapper identity와 generated moduleinfo |
| Final binary | Alpha/Beta byte-identical | Alpha/Beta hash distinct |
| Runtime identity | Module-relative descriptor load 뒤 dynamic factory | Static wrapper가 common implementation factory에 immutable definition 전달 |
| Toolchain | Package 시 PowerShell과 prebuilt moduleinfotool 필요 | Native compiler/linker와 SDK build graph 필요 |

어느 관찰도 production 선호나 기본값을 뜻하지 않는다. Alternative A는 final bundle staging 후
서명해야 하며 signed template을 다시 package하면 signature가 무효가 될 수 있다. Alternative B도
product-specific final binary와 bundle을 link/resource 생성 뒤 서명해야 한다. 이번 spike는 Windows
code signing, certificate, installer 또는 signature verification을 실행하지 않았다.

macOS Apple Clang, arm64/x86_64, Universal VST3, bundle resource lookup, signing/notarization과 AU는
검증하지 않았다. 특히 Alternative A loader는 현재 Windows module path implementation이고,
Alternative B의 C++ wrapper가 존재한다는 사실만으로 Apple toolchain과 Universal packaging을
통과했다고 볼 수 없다. [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속
**Proposed**이며 이 Windows evidence만으로 전략을 선택하지 않는다.
