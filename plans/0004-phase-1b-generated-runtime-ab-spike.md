# ExecPlan 0004 — Phase 1B Generated Runtime A/B Identity and Packaging Spike

- Status: Complete — PASS
- Started: 2026-08-09
- Updated: 2026-08-09
- Owner: Garak native/VST3 adapter

## 목적

Windows x64 VST3에서 [ADR 0003](../docs/adr/0003-generated-plugin-runtime-strategy.md)의 두
generated plugin 전략을 같은 네 제품 동작과 같은 검증 기준으로 실제 구현·비교한다.

- Alternative A는 한 번 빌드한 동일 Runtime module binary를 두 제품 bundle에 복사하고,
  module-relative 외부 descriptor로 factory identity와 default를 결정한다.
- Alternative B는 공통 spike-local implementation을 재사용하되 제품별 compile-time identity
  wrapper를 각각 compile/link한다.

두 전략 모두 서로 다른 두 제품, 고유한 processor/controller FUID, factory와
`moduleinfo.json` parity, 동일 process 내 공존, 독립 state/processing, official validator와
artifact/build delta를 증명한다. 이번 plan은 어느 전략도 기본값으로 채택하지 않으며 Phase 1
전체를 완료하지 않는다.

## 사용자 가치

제품별 white-label VST3 identity가 실제 bundle, factory, state와 host load 경계에서 충돌하지
않는지 확인한다. 이를 통해 단순 binary size 추측이 아니라 새 제품을 만들 때 필요한
compile/link/package 작업, 동일 binary 재사용 가능성, failure mode와 macOS 이식 전 확인할
사항을 재현 가능한 근거로 비교할 수 있다.

## 시작 commit과 Git 상태

- Branch: `master`
- Phase 1A baseline commit:
  `c9d92bfd800cb702a0c32442598a508b382b1df2`
  (`feat: complete Garak phase 1A VST3 gain shell`)
- 시작 working tree: clean. `git status --short --branch` 출력은 `## master`뿐이었다.
- Phase 1A commit 직전의 root baseline은
  `ef71c755ee84a9b82d6589365711211fdbc62f58`이다.
- 사용자 변경사항은 시작 시 없었다.
- 이번 plan에서는 commit, amend, rebase, branch 변경, destructive Git command를 수행하지 않는다.

## 현재 VST3 SDK pin

- Official repository: `https://github.com/steinbergmedia/vst3sdk.git`
- Tag: `v3.8.0_build_66`
- Superproject: `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`
- `base`: `3d2e82f8e6bff59c1d8b7a27491a29c2286b5206`
- `cmake`: `de6e54eeaaab35b7145f5c32c279b5e892146e04`
- `doc`: `6d4737c9e70750056e731d88d49aa06eefc8a1a4`
- `pluginterfaces`: `31d6eeba6daaa3e2a8bfbe3e7a90ca0b7fbfbc1c`
- `public.sdk`: `a3911a4615dabbfdfd9d181ee26b05c70c289a95`
- `tutorials`: `33b73dfbb87f3fde3bce8c0a10cae934dc66ad34`
- `vstgui4`: `76823bdbe286e4bdb9f79ab8986af5ce7202336c`

Phase 시작 시 superproject와 nested 7개 repository는 parent gitlink와 같은 detached HEAD이며
tracked/untracked 변경이 0이었다. 이 pin과 upstream source는 변경하지 않는다.

## 현재 toolchain

| 도구 | 검증 기준 |
| --- | --- |
| OS | Windows 10.0.26200, x64 |
| Visual Studio | Community 2026 18.7.3 |
| MSVC | 19.51.36248, x64 toolset 14.51.36231 |
| CMake | 4.3.1-msvc1 |
| Ninja | 1.13.2 |
| clang-format / clang-tidy | 22.1.3 / 22.1.3 |
| Git | 2.55.0.windows.3 |
| Node.js / pnpm | 24.19.0 / 11.16.0 |

Native build는 `VsDevCmd.bat -arch=x64 -host_arch=x64`가 구성한 Visual Studio x64 Developer
환경에서 실행한다. Alternative A의 package-only 재현은 compiler/linker가 PATH에 없는 일반
PowerShell에서도 별도로 실행한다.

## 현재 Phase 1A artifact와 contract

`Garak Gain Spike`는 삭제하거나 대체하지 않고 fixed compile-time identity regression으로
유지한다.

- Processor FUID: `3D6F3C09296D49EF99334C4688F484EE`
- Controller FUID: `2CD50BAE587A4F3E812399E550F352D4`
- Gain/Bypass ID: `1001` / `1002`
- One main mono/stereo input/output, float32/float64, editorless
- Gain `-60..+12 dB`, sample-offset automation와 exact-offset Bypass
- 20-byte `GGS1` schema 1 state와 controller restore
- Queue 최대 2, point cap `numSamples <= 1 ? 2 : min(INT_MAX, 2 * numSamples)`
- Allocation/lock/I/O/logging 없는 bounded process와 exception containment
- Debug/Release CTest 3/3, official validator 47/47와 537/537, Werror/tidy/format PASS

Phase 1B 네 variant는 같은 `native/spikes/gain` kernel, automation와 state codec을 사용하지만
Phase 1A processor/controller/factory를 대규모 refactor하지 않는다. 새 공유 코드는
`runtime_strategy_spike` private adapter 경계에만 둔다.

## 범위

- Data Alpha/Beta용 identical-binary template Runtime과 strict external descriptor
- Module-relative Windows descriptor loader와 fail-closed dynamic factory
- Compiler/linker 없는 repository-local Alternative A packaging command
- Thin Alpha/Beta용 공통 internal implementation과 제품별 factory wrapper/target
- 네 bundle 각각의 product-specific `moduleinfo.json`
- Factory/moduleinfo/identity literal parity 검사
- 기존 Gain Spike를 포함한 다섯 module 동일-process coexistence test
- 네 variant processing/state/default/instance independence test
- Descriptor failure bundle fixture와 stale identity 방지 test
- Debug/Release build, CTest, official validator standard/extensive와 PE x64 검사
- Werror, clang-format, clang-tidy와 Phase 0/1A/Studio regression
- Binary hash, size, bundle/resource size, wrapper object/source/build delta 측정
- ADR 0003 비교 증거와 status/architecture/operational 문서 갱신

## 비범위

- `.garak`, Garak Project Model 또는 범용 compiled runtime blob
- Production Product Compiler, 실제 export UX와 Studio/Native IPC
- Node native addon, DSP graph, macro, preset browser와 Phase 2 domain model
- 범용 public AudioBlock/Parameter/Plugin/Runtime API
- Custom editor, UI, VSTGUI, JUCE, Skia, CanvasKit, Yoga와 XYFlow
- MIDI, event bus, sidechain, instrument, miniaudio, KissFFT와 FlatBuffers
- macOS, AU, Universal binary, installer, signing와 notarization
- Binary/executable resource patching, DRM, cloud build와 global VST3 install
- 실제 artist product와 `ANDONGMIN BLOOM`
- Runtime A/B 최종 선택, repository license와 commercial legal 승인

Descriptor, package script, wrapper와 product variant는 Phase 1B 기술 fixture다. Production
format/API 또는 출시 identity로 승격하지 않는다.

## 전제와 제약

- Root와 nested `AGENTS.md`, Accepted ADR 0001/0002/0004, Proposed ADR 0003을 따른다.
- `third_party/vst3sdk` source, tag와 gitlink를 수정·재format하지 않는다.
- Steinberg type은 VST3 adapter 또는 VST3-only test 밖으로 노출하지 않는다.
- Product definition은 immutable하며 mutable process-global product identity를 사용하지 않는다.
- Process callback에서 descriptor, filesystem, parsing, allocation, lock, I/O 또는 logging을 하지 않는다.
- SDK factory/parameter ownership-transfer ABI의 좁은 direct `new`만 기존 예외를 적용한다.
- VSTGUI, automatic plugin link와 global install은 계속 OFF다.
- Bundle, reports와 temporary staging은 repository `out/` 아래에서만 생성하고 ignore한다.
- Windows 결과를 macOS, AU, signing, 실제 DAW 또는 commercial readiness로 일반화하지 않는다.

## 비교할 product identity

아래 8개 FUID는 이 작업에서 한 번 생성해 source/descriptor, 독립 test literal과 identity 문서에
고정한다. Phase 1A FUID와 서로 중복되지 않는다.

| Strategy | Product | Processor FUID | Controller FUID | Default Gain |
| --- | --- | --- | --- | ---: |
| A | Garak Data Alpha | `4B2B557251D44CE9914F9B105136FB7E` | `7A90454628B34A3497F05E7CC718F8A1` | `-6.0 dB` |
| A | Garak Data Beta | `C29B7245261642668ADAC664B6817678` | `1DE08859308F4A0A8473EA5CB70771D2` | `+3.0 dB` |
| B | Garak Thin Alpha | `93952A37BFA84FF1AC06CE58B9FA87EA` | `E08F3ACCD825424AB238BBAB6B0248CC` | `-6.0 dB` |
| B | Garak Thin Beta | `44BFB8B6F56946FF9F6F193529BCB967` | `826C362FA2784F719351912BE834F9AB` | `+3.0 dB` |

공통 값은 Vendor `Garak`, Version `0.1.0`, VST3 subcategory `Fx`, Gain ID `1001`, Bypass ID
`1002`, Gain range `-60..+12 dB`다. Test fixture는 production constant/header를 alias하지 않고
위 literal을 독립적으로 고정한다.

## 두 전략에서 공유할 behavior

새 `native/adapters/vst3/runtime_strategy_spike/` private implementation은 Phase 1A의 pure
Gain/automation/state support를 사용하며 네 variant에 다음을 동일하게 제공한다.

- Processor/controller 두 class, editor 없음
- One main input/output, mono↔mono와 stereo↔stereo
- Float32/Float64, in-place/out-of-place와 parameter-only/zero-sample call
- Sample-offset Gain interpolation와 exact-offset Bypass transition
- 20-byte `GGS1` schema 1 state, corrupt/short state rejection와 controller restore
- Alpha `-6 dB`, Beta `+3 dB` initial/default state
- Automation 또는 valid state가 default를 대체하는 의미
- Instance-local current/pending/snapshot state와 module 간 state isolation
- Phase 1A와 같은 queue/point cap, silence, NaN/Inf/denormal와 exception policy

Product identity와 defaults는 processor/controller construction 시 immutable value로 복사한다.
Factory 이후 descriptor를 다시 읽거나 다른 instance/module과 mutable state를 공유하지 않는다.

## Spike 전용 product descriptor 계약

Alternative A descriptor의 physical path는 정확히 다음이다.

```text
<Product>.vst3/Contents/Resources/garak-product-spike-v1.txt
```

Format은 UTF-8의 strict ASCII subset인 line-oriented text다. 외부 parser dependency, escaping,
localization과 raw struct dump를 사용하지 않는다. 전체 파일은 1024바이트 이하, BOM/NUL/CR 없음,
LF newline만 사용하고 마지막 LF가 반드시 존재한다. 정확히 아래 11개 line을 정해진 순서로
가진다.

```text
GARAK_PRODUCT_SPIKE_V1
schema=1
vendor=Garak
product_name=Garak Data Alpha
semantic_version=0.1.0
processor_fuid=4B2B557251D44CE9914F9B105136FB7E
controller_fuid=7A90454628B34A3497F05E7CC718F8A1
gain_parameter_id=1001
bypass_parameter_id=1002
default_gain_db=-6.0
category=Fx
```

Parser는 magic, schema와 key order를 정확히 요구하므로 missing, duplicate와 unexpected field를
모두 거부한다. Vendor/product/version/category의 byte 상한은 각각 63/63/63/31이다. Product
name은 Windows filename-safe ASCII `[A-Za-z0-9 ._-]`만 허용하고 앞뒤 space/dot을 거부한다.
다른 문자열도 printable ASCII만 허용하며 `=`, `/`, `\\`를 거부한다. 이와 함께 non-empty를,
FUID는 uppercase hexadecimal 32자와 processor/controller 불일치를, parameter ID는
`1..INT32_MAX` 및 상호 불일치를, default Gain은 finite `-60..+12 dB`를 검증한다. Product name은
path separator와 Windows-invalid filename character를 허용하지 않는다. 모든 field를 temporary
value에서 검증한 뒤에만 immutable product definition을 반환한다.

이 format은 Phase 1B 전용이며 `.garak`, compiled runtime blob 또는 production descriptor가 아니다.

## Alternative A 설계

### Template Runtime

`garak_data_runtime_template_vst3` VST3 target 하나만 native compile/link한다. 이 target은 dynamic
product factory와 공통 processor/controller implementation을 포함하지만 product identity를
binary에 고정하지 않는다. Template bundle 자체는 valid product로 배포하거나 validator PASS로
간주하지 않는다.

Data Alpha/Beta packaging은 template inner module을 각각 최종 제품명으로 복사한다. Folder와
`Contents/x86_64-win/` module file은 같은 `<Product>.vst3` 이름을 사용한다. 파일명만 바꾸며
binary content를 patch하지 않는다. Template, Alpha와 Beta inner module SHA-256이 모두 같아야 한다.

### Descriptor loading

Windows platform adapter는 SDK가 제공한 current module handle을 기준으로 `GetModuleFileNameW`를
사용한다. CWD, environment, registry, global VST3 path를 사용하지 않는다. 실제 inner module의
parent hierarchy에서 bundle root와 fixed Resources path를 계산하고 descriptor product name이
bundle folder 및 inner module filename과 일치하는지도 확인한다.

`GetPluginFactory`의 first call에서만 descriptor를 완전히 read/parse/validate한다. 성공 결과는
module image별 immutable value로 보존하고 processor/controller instance에는 필요한 값만 복사한다.
Factory 생성 뒤 filesystem을 다시 읽지 않으며 process와 parameter path에는 file access가 없다.

Missing, unreadable, malformed, identity/default/path mismatch는 `GetPluginFactory`가 null을 반환하는
fail-closed 결과로 고정한다. Class count 0 또는 generic fallback factory를 만들지 않고 crash,
partial factory와 다른 module의 stale identity reuse를 허용하지 않는다.

### Dynamic factory

Pinned SDK `CPluginFactory`를 기반으로 descriptor의 factory info와 정확히 두 `PClassInfo2`를
register한다. Processor/controller create callback의 context는 factory가 소유한 immutable product
definition이며 instance는 lifetime에 필요한 값을 복사한다. Processor는 descriptor controller
FUID를 association으로 설정하고 controller default/parameter ID도 descriptor와 일치한다.

SDK의 `gPluginFactory`는 module image별 factory lifetime/refcount를 위한 upstream mechanism으로만
사용한다. Product identity 자체는 mutable global로 두지 않는다. Repeated factory query는 같은
metadata를 반환하고 module unload 뒤 dangling context를 남기지 않는다.

### Packaging command

`tools/vst3/package_data_runtime_variant.ps1`은 repository root를 `$PSScriptRoot`에서 계산하고
template bundle, descriptor source, output bundle, prebuilt `moduleinfotool`을 입력으로 받는다.
Hardcoded user path, network, admin 권한, system/global VST3 write, compiler, linker, CMake build와
binary patch를 사용하지 않는다.

Script는 path를 canonicalize하고 output/staging이 repository `out/` 아래인지 확인한다. Temporary
sibling staging에 final layout을 만들고 PowerShell parser로 descriptor contract를 검증한 뒤
binary/descriptor를 복사한다. Official `moduleinfotool -create`와 `-validate`를 실행하고 hash와
size summary를 출력한 후에만 final output으로 교체한다. Existing output은 validated staging이
완성된 뒤 backup rename을 거쳐 교체하며 failure 시 partial stage를 제거하고 가능한 경우 기존
output을 복구한다. 모든 실패는 non-zero다.

## Alternative B 설계

`garak_runtime_strategy_spike_common` static library가 processor, controller,
state-stream와 factory registration helper를 한 번 compile한다. Product-specific target은 아래
얇은 factory wrapper 한 translation unit과 common support를 link한다.

- `Garak Thin Alpha`: compile-time immutable Alpha identity/default wrapper
- `Garak Thin Beta`: compile-time immutable Beta identity/default wrapper

Wrapper에는 vendor/name/version, 두 FUID, parameter IDs, default Gain와 factory entry만 둔다.
DSP, automation, state, processor/controller 구현을 복사하지 않는다. 두 target은 별도 compile/link
command와 서로 다른 inner module hash를 가져야 한다. Wrapper file/LOC/object size, compile TU와
새 product 추가 시 변경 surface를 기록한다.

## VST3 factory와 moduleinfo 전략

Pinned SDK의 `moduleinfotool` target을 build하려고 `SMTG_ADD_VST3_UTILITIES=ON`을 Phase 1B option에서만
사용한다. Global/cache `SMTG_CREATE_MODULE_INFO`는 Phase 1A 보존을 위해 OFF로 유지한다.

- Alternative A: final descriptor와 renamed binary를 staging한 뒤 package script가
  `moduleinfotool -create -version 0.1.0 -path <bundle> -output <Resources/moduleinfo.json>`을 실행한다.
- Alternative B: 두 thin target에만 `SMTG_CREATE_MODULE_INFO=ON` normal-variable scope 또는 동등한
  explicit post-build command를 적용해 actual bundle factory에서 moduleinfo를 생성한다.
- 네 bundle 모두 `moduleinfotool -validate -path <bundle>`을 실행한다.

`moduleinfo.json`은 official tool이 쓰는 JSON5이며 strict JSON으로 재해석하지 않는다. SDK validate는
factory/classes/snapshot parity를 확인하지만 root Name/Version은 비교하지 않으므로 contract test가
ModuleInfoLib 또는 pinned parser로 top-level Name/Version, factory info, class names/CIDs/category를
identity fixture와 별도로 비교한다. Generic template identity나 stale moduleinfo는 실패다.

## Bundle packaging 전략

Alternative A final product는 template build tree와 분리된 `runtime-products` 아래에 있고,
Alternative B와 Phase 1A baseline은 SDK bundle output 아래에 있다.

```text
out/build/runtime-strategy-<config>/runtime-products/Garak Data <Alpha|Beta>.vst3/
  Contents/x86_64-win/Garak Data <Alpha|Beta>.vst3
  Contents/Resources/moduleinfo.json
  Contents/Resources/garak-product-spike-v1.txt

out/build/runtime-strategy-<config>/VST3/<Config>/Garak Thin <Alpha|Beta>.vst3/
  Contents/x86_64-win/Garak Thin <Alpha|Beta>.vst3
  Contents/Resources/moduleinfo.json

out/build/runtime-strategy-<config>/VST3/<Config>/Garak Gain Spike.vst3/
  Contents/x86_64-win/Garak Gain Spike.vst3
```

Steinberg sample icon, `desktop.ini`, snapshot, editor resource와 VSTGUI resource를 최종 bundle에
포함하지 않는다. System/user VST3 directory에 copy/link/install하지 않는다.

## Simultaneous-load 검증 계획

Windows x64 CTest process 하나가 local path의 다음 다섯 module을 동시에 load한다.

1. `Garak Gain Spike`
2. `Garak Data Alpha`
3. `Garak Data Beta`
4. `Garak Thin Alpha`
5. `Garak Thin Beta`

Test는 factory/class count와 independent literal identity, vendor/version/category/default를 확인하고
processor/controller를 만든다. 각 module과 같은 module의 두 instance에 서로 다른 valid state와
processing을 적용해 cross-module/instance leakage 0을 확인한다. Alpha/Beta default output,
automation, bypass, mono/stereo, float32/float64, in/out-of-place, zero/parameter-only와 corrupt state를
검사한다.

각 loaded inner path의 Windows module handle을 관찰해 identical bytes인 Data Alpha/Beta가 서로
다른 full path와 distinct loaded handle을 갖는지 기록한다. Instance/factory를 release한 뒤 reverse
order unload, handle 부재, reload와 identity 재검증을 수행한다. Release CTest에서도 같은 test를
실행한다.

## Descriptor failure 검증 계획

Contract test가 template binary를 repository `out/` 아래 temporary fixture bundle에 복사하고 다음
descriptor를 각각 load한다.

- Missing, empty, wrong magic, unsupported schema
- Missing vendor/product name
- Malformed processor/controller FUID, 같은 FUID
- Zero/invalid/duplicate parameter ID
- Default Gain below/above range와 non-finite
- Excessive string, duplicate field, unexpected field
- Invalid ASCII/UTF-8 policy, CR/BOM/NUL, missing final LF
- Bundle/inner filename/product name mismatch

각 fixture는 load/factory 전에 clean failure, crash 0, partial class 0, stale identity reuse 0을
증명한다. Valid Alpha를 먼저 load한 뒤 invalid fixture와 valid Beta를 순서대로 load해 이전 identity가
누출되지 않는지도 확인한다.

## Official validator 계획

`tools/vst3/validate_runtime_strategy.ps1`는 configuration, artifact root, build tree의 local validator,
다섯 bundle과 report directory를 모두 explicit path로 받아 실행한다. 네 새 variant와 기존 Gain Spike
각각에 standard와 `-e` extensive를 실행하고 report 원문을
`out/reports/vst3/runtime-strategy/`에 보존한다.

각 variant/configuration은 exit 0, discovered processor/controller, failed test 0, warning 0, crash 0을
요구한다. 네 새 variant는 Debug/Release 각각 standard/extensive를 모두 통과해야 하며 기존 Gain
Spike도 두 configuration에서 regression한다. Test filter나 suite 제외로 PASS를 만들지 않는다.

## Artifact 비교 지표

Debug/Release 각각 다음을 수집한다.

- Template/Data Alpha/Data Beta inner SHA-256, byte equality와 inner size
- Alternative A descriptor/moduleinfo/total bundle size
- Thin Alpha/Beta inner SHA-256, inner/total bundle/moduleinfo size
- Common support library/object와 thin wrapper object size
- 제품별 wrapper source file, logical LOC, compile TU와 link command
- Compiler/linker required, prebuilt reuse, executable/resource delta와 package steps
- Product-specific delta size와 output reproducibility
- Final PE machine x64와 final resource inventory

Alternative A package-only rerun은 A output 두 개만 제거한 뒤 일반 PowerShell에서 package script를
재실행한다. `Get-Command cl/link` 부재, package log의 실행 executable, build tree/object timestamp
불변과 regenerated hash를 기록하고 다시 moduleinfo validate 및 official validator를 수행한다.

## Compile/package 단계 비교 방법

- Ninja `-t commands`와 compile database로 Alternative B wrapper별 `cl` invocation과 module link를
  식별한다.
- Alternative A package custom target/script graph가 product-specific C++ target에 의존하지 않고
  prebuilt template와 moduleinfotool만 소비하는지 inspect한다.
- Package-only transcript에는 PowerShell과 moduleinfotool 외 native build executable이 없어야 한다.
- 시간은 참고로만 기록하며 단독 decision 근거로 사용하지 않는다.

## CMake와 tool 구조

- Option: `GARAK_BUILD_RUNTIME_STRATEGY_SPIKE`, default `OFF`
- Configure preset: `runtime-strategy-debug`, `runtime-strategy-release`,
  `runtime-strategy-werror`, `runtime-strategy-clang-tidy`
- 대응 build/test preset과 aggregate target `garak_runtime_strategy_spike_all`
- SDK source/loader/parser는 isolated third-party target이고 Garak warning/tidy/format 대상이 아니다.
- 모든 new first-party compiling target은 C++20, `/W4`, optional `/WX`와 target-scoped clang-tidy를
  적용한다.

## 변경 대상 파일

예상 범위이며 실제 pinned SDK/CMake behavior가 다르면 발견·결정과 함께 갱신한다.

- `/CMakeLists.txt`
- `/CMakePresets.json`
- `/.gitignore`
- `/cmake/GarakOptions.cmake`
- `/native/CMakeLists.txt`
- `/native/AGENTS.md`
- `/native/adapters/vst3/AGENTS.md`
- `/native/adapters/vst3/CMakeLists.txt`
- `/native/adapters/vst3/runtime_strategy_spike/*`
- `/native/tests/CMakeLists.txt`
- `/native/tests/runtime_strategy_descriptor_tests.cpp`
- `/native/tests/runtime_strategy_contract_tests.cpp`
- `/tools/vst3/package_data_runtime_variant.ps1`
- `/tools/vst3/validate_runtime_strategy.ps1`
- `/tools/vst3/inspect_runtime_strategy.ps1`
- `/docs/status/phase-1b-vst3-identities.md`
- `/docs/status/phase-1b-runtime-strategy-artifacts.md`
- `/docs/status/phase-1b-runtime-strategy-validation.md`
- `/docs/architecture/runtime-strategy-spike.md` if comparison detail needs a dedicated authority
- `/docs/architecture/vst3-adapter.md`
- `/docs/architecture/dependency-policy.md`
- `/docs/adr/0003-generated-plugin-runtime-strategy.md`
- `/docs/status/current.md`
- `/AGENTS.md`
- `/README.md`
- `/ROADMAP.md`
- 본 ExecPlan

Studio source, manifest, lockfile와 direct dependency는 변경하지 않는다.

## 구현 또는 문서화 단계

1. [x] Phase 1A 변경을 사용자 지정 message로 commit하고 clean baseline을 확인한다.
2. [x] 필수 문서, SDK pin/nested checkout, toolchain, Phase 1A build/validator 명령을 대조한다.
3. [x] 본 ExecPlan을 구현 전에 작성하고 descriptor/FUID/A/B/moduleinfo contract를 고정한다.
4. [x] Spike-local product definition, descriptor parser/Windows loader와 failure tests를 구현한다.
5. [x] 공통 processor/controller/factory helper와 네 variant identity contract를 구현한다.
6. [x] Alternative A template와 atomic packaging-only path로 Data Alpha/Beta를 생성한다.
7. [x] Alternative B thin wrapper 두 target과 product-specific moduleinfo를 생성한다.
8. [x] Factory/moduleinfo parity, descriptor failure와 processing/state contract tests를 통과한다.
9. [x] 다섯 module Debug/Release simultaneous load, state/instance isolation와 unload/reload를 검증한다.
10. [x] Debug/Release fresh/clean build, CTest와 네 variant+baseline official validator를 실행한다.
11. [x] Werror, clang-format, clang-tidy, PE/resource/link/dependency graph를 검증한다.
12. [x] 일반 PowerShell package-only rerun과 no-compiler/linker evidence를 기록한다.
13. [x] Phase 0 Native, Phase 1A와 Studio regression을 모두 재실행한다.
14. [x] Hash/size/wrapper/build delta를 측정하고 artifact/identity/validation 문서를 작성한다.
15. [x] ADR 0003, architecture, README, ROADMAP, AGENTS, current status와 본 plan을 동기화한다.
16. [x] Git/text/link/ignore/submodule/dependency/license/forbidden-scope hygiene를 독립 감사한다.
17. [x] 모든 수용 기준을 대조하고 실제 결과에 따라 PASS/CONDITIONAL PASS/FAIL을 기록한다.

## 테스트 계획

### Descriptor와 identity

- Canonical Alpha/Beta descriptor exact bytes와 independent expected product values
- 모든 required failure fixture와 no-partial product result
- Source/descriptor, loaded factory, moduleinfo와 independent test literal parity
- 네 processor/controller FUID 및 Phase 1A FUID 전체 uniqueness

### Processing와 state

- Alpha `-6 dB`, Beta `+3 dB` unity-input default output
- Gain automation multiple point와 Bypass off/on/transition
- Mono/stereo, float32/float64와 in/out-of-place
- Zero-sample와 parameter-only call
- State save/load, corrupt rejection, controller component-state restore
- 같은 module 두 instance와 다섯 module 사이 state/process independence
- Phase 1A pure/loaded queue cap, realtime와 state regression

### Factory, package와 coexistence

- 정확히 processor/controller class 2개, dynamic association/default와 repeated query
- Bundle/inner filename 일치와 Data Alpha/Beta byte-identical module
- Official moduleinfo creation/validation와 top-level/class parity
- 다섯 local module simultaneous load, unique FUID/name, distinct Data handles
- Reverse unload/reload, crash/leak/stale identity 0
- Invalid descriptor bundle fail-closed

### Quality와 regression

- Debug/Release fresh configure/clean aggregate build와 CTest
- Runtime-strategy Werror/clang-tidy와 전체 first-party clang-format
- 네 variant Debug/Release official standard/extensive와 Gain Spike regression
- Phase 0 Native Debug/Release/smoke/Werror/tidy
- Phase 1A Debug/Release CTest와 validator/identity/state/automation
- Studio frozen install/lint/format/typecheck/build와 direct dependency 16개

## 검증 명령

Native 명령은 Visual Studio x64 Developer 환경에서 실행한다. Debug/Release aggregate는 fresh
configure와 clean-first build를 통과한 뒤 defect remediation 후 final incremental build와 CTest를
다시 실행했다.

```powershell
cmake --preset runtime-strategy-debug --fresh
cmake --build --preset runtime-strategy-debug-build --clean-first
ctest --preset runtime-strategy-debug-test --no-tests=error

cmake --preset runtime-strategy-release --fresh
cmake --build --preset runtime-strategy-release-build --clean-first
ctest --preset runtime-strategy-release-test --no-tests=error

cmake --preset runtime-strategy-werror --fresh
cmake --build --preset runtime-strategy-werror-build --clean-first
cmake --preset runtime-strategy-clang-tidy --fresh
cmake --build --preset runtime-strategy-clang-tidy-build --clean-first
```

Validator wrapper는 discovery에 의존하지 않고 모든 input을 명시했다. Debug exact command는
다음과 같다.

```powershell
& .\tools\vst3\validate_runtime_strategy.ps1 `
  -Configuration Debug `
  -ArtifactRootPath 'out\build\runtime-strategy-debug' `
  -ValidatorPath 'out\build\runtime-strategy-debug\bin\validator.exe' `
  -GainSpikeBundlePath 'out\build\runtime-strategy-debug\VST3\Debug\Garak Gain Spike.vst3' `
  -DataAlphaBundlePath 'out\build\runtime-strategy-debug\runtime-products\Garak Data Alpha.vst3' `
  -DataBetaBundlePath 'out\build\runtime-strategy-debug\runtime-products\Garak Data Beta.vst3' `
  -ThinAlphaBundlePath 'out\build\runtime-strategy-debug\VST3\Debug\Garak Thin Alpha.vst3' `
  -ThinBetaBundlePath 'out\build\runtime-strategy-debug\VST3\Debug\Garak Thin Beta.vst3' `
  -ReportDirectory 'out\reports\vst3\runtime-strategy'
```

Release exact command는 다음과 같다.

```powershell
& .\tools\vst3\validate_runtime_strategy.ps1 `
  -Configuration Release `
  -ArtifactRootPath 'out\build\runtime-strategy-release' `
  -ValidatorPath 'out\build\runtime-strategy-release\bin\validator.exe' `
  -GainSpikeBundlePath 'out\build\runtime-strategy-release\VST3\Release\Garak Gain Spike.vst3' `
  -DataAlphaBundlePath 'out\build\runtime-strategy-release\runtime-products\Garak Data Alpha.vst3' `
  -DataBetaBundlePath 'out\build\runtime-strategy-release\runtime-products\Garak Data Beta.vst3' `
  -ThinAlphaBundlePath 'out\build\runtime-strategy-release\VST3\Release\Garak Thin Alpha.vst3' `
  -ThinBetaBundlePath 'out\build\runtime-strategy-release\VST3\Release\Garak Thin Beta.vst3' `
  -ReportDirectory 'out\reports\vst3\runtime-strategy'
```

Artifact inspector도 여섯 bundle과 output report를 모두 명시했다.

```powershell
& .\tools\vst3\inspect_runtime_strategy.ps1 `
  -Configuration Debug `
  -ArtifactRootPath 'out\build\runtime-strategy-debug' `
  -TemplateBundlePath 'out\build\runtime-strategy-debug\VST3\Debug\Garak Data Runtime Template.vst3' `
  -GainSpikeBundlePath 'out\build\runtime-strategy-debug\VST3\Debug\Garak Gain Spike.vst3' `
  -DataAlphaBundlePath 'out\build\runtime-strategy-debug\runtime-products\Garak Data Alpha.vst3' `
  -DataBetaBundlePath 'out\build\runtime-strategy-debug\runtime-products\Garak Data Beta.vst3' `
  -ThinAlphaBundlePath 'out\build\runtime-strategy-debug\VST3\Debug\Garak Thin Alpha.vst3' `
  -ThinBetaBundlePath 'out\build\runtime-strategy-debug\VST3\Debug\Garak Thin Beta.vst3' `
  -ReportPath 'out\reports\vst3\runtime-strategy\debug-artifacts.json'

& .\tools\vst3\inspect_runtime_strategy.ps1 `
  -Configuration Release `
  -ArtifactRootPath 'out\build\runtime-strategy-release' `
  -TemplateBundlePath 'out\build\runtime-strategy-release\VST3\Release\Garak Data Runtime Template.vst3' `
  -GainSpikeBundlePath 'out\build\runtime-strategy-release\VST3\Release\Garak Gain Spike.vst3' `
  -DataAlphaBundlePath 'out\build\runtime-strategy-release\runtime-products\Garak Data Alpha.vst3' `
  -DataBetaBundlePath 'out\build\runtime-strategy-release\runtime-products\Garak Data Beta.vst3' `
  -ThinAlphaBundlePath 'out\build\runtime-strategy-release\VST3\Release\Garak Thin Alpha.vst3' `
  -ThinBetaBundlePath 'out\build\runtime-strategy-release\VST3\Release\Garak Thin Beta.vst3' `
  -ReportPath 'out\reports\vst3\runtime-strategy\release-artifacts.json'
```

Package-only run은 compiler와 linker가 PATH에 없는 일반 PowerShell에서 Debug/Release의 Data
Alpha/Beta output만 제거하고 `package_data_runtime_variant.ps1`에 template bundle, canonical
descriptor, exact `runtime-products` output과 prebuilt `moduleinfotool.exe` 네 input을 명시해 각각
실행했다. 이후 위 validator 두 command, CTest 5/5와 inspector 두 command를 다시 실행했다.

## 수용 기준

### Precondition

- Phase 1A baseline commit `c9d92bfd...`가 존재하고 시작 tree가 clean이다.
- Branch는 master이고 SDK/nested exact pin과 clean 상태가 유지된다.

### Alternative A

- Template binary 하나로 Data Alpha/Beta bundle을 생성한다.
- Template/Alpha/Beta inner SHA-256과 bytes가 같다.
- Strict descriptor, module-relative one-time load와 fail-closed factory가 동작한다.
- Bundle/inner name, descriptor, factory와 product-specific moduleinfo가 일치한다.
- Package-only rerun에 product compile/link가 없고 일반 PowerShell에서 성공한다.
- Alpha/Beta가 같은 process에 distinct handle/identity로 동시에 load된다.

### Alternative B

- 공통 implementation과 제품별 wrapper 한 개씩을 별도 compile/link한다.
- Thin Alpha/Beta identity/default/moduleinfo가 고유하고 일치한다.
- Wrapper source/object/build delta와 새 제품 추가 surface를 측정한다.
- Alpha/Beta가 같은 process에 동시에 load된다.

### Behavior와 coexistence

- 네 variant의 정확한 default, automation, bypass, precision, channel, state와 instance independence가
  통과한다.
- 기존 Gain Spike 포함 다섯 module의 identity/name/state/instance 충돌이 0이다.
- Reverse unload/reload와 descriptor failure fixture가 crash/stale identity 없이 통과한다.

### Validation와 quality

- 네 variant Debug/Release standard/extensive validator가 모두 exit 0, failure/warning/crash 0이다.
- Gain Spike Debug/Release validator regression이 통과한다.
- Debug/Release CTest, Werror, clang-format, clang-tidy와 PE x64 검사가 통과한다.
- VSTGUI/global install/resource leak와 SDK source modification이 없다.

### Regression와 documentation

- Phase 0 Native, Phase 1A와 Studio 전체 요구 regression이 통과한다.
- Studio dependency는 direct 16개이며 source/manifest/lockfile가 기능적으로 변하지 않는다.
- Identity/artifact/validation 표와 exact command/report가 기록된다.
- ADR 0003은 Proposed이고 A/B 선택, macOS 통과 또는 production export를 주장하지 않는다.
- Phase 1 전체를 완료로 표시하지 않는다.

필수 검증 하나라도 실행되지 않거나 실패가 남으면 PASS로 기록하지 않는다.

## 리스크

- 테스트한 Windows x64 환경에서는 identical template bytes의 separate full-path load와 unload/reload를
  simultaneous-load test로 확인했다. 다른 host와 macOS loader 동작은 아직 일반화할 수 없다.
- `moduleinfotool -validate`는 top-level Name/Version을 비교하지 않는다. 현재 pinned parser와 packaging
  root identity assertion으로 보완했지만 두 검증 경로의 parity는 계속 함께 유지해야 한다.
- SDK helper option scope를 잘못 적용하면 Phase 1A bundle에 moduleinfo/resource behavior가 바뀔 수 있다.
- Dynamic factory의 descriptor load failure, factory refcount와 module unload context lifetime은 현재
  regression으로 고정했으며 이후 변경에서도 함께 보존해야 한다.
- Simple text descriptor의 runtime/PowerShell parser drift는 canonical/failure fixture를 양쪽에 적용해
  방지하고 있으며 descriptor contract 변경 때 동일 fixture를 갱신해야 한다.
- Alternative B static common support는 source/object reuse이지만 final binary마다 common executable
  bytes가 포함되므로 dynamic shared-runtime이라고 과장하면 안 된다.
- Windows-only module path/loader code는 macOS bundle entry/resource/signing 검증 없이 portable하다고
  주장할 수 없다.
- VST3 SDK tutorials license, commercial notices/trademark와 Runtime redistribution legal review는
  계속 미완료다.

## 발견 사항

- 2026-08-09: Phase 1A 변경 45개 파일을 사용자 지정 message로 commit해 baseline
  `c9d92bfd800cb702a0c32442598a508b382b1df2`와 clean tree를 확보했다. GitHub remote는 필요 없었다.
- 2026-08-09: 처음 sandbox 안에서 commit을 시도했으나 `.git/index.lock` 쓰기가 permission denied로
  실행 전에 실패했다. 같은 exact commit을 승인된 Git metadata 쓰기 환경에서 재실행해 성공했다.
- 2026-08-09: Pinned `moduleinfotool`의 create는 bundle을 실제 load해 factory/classes에서 JSON5를
  만들며 validate는 factory/classes/snapshot parity를 검사한다. Root Name/Version은 별도 비교해야 한다.
- 2026-08-09: Official Windows bundle contract는 folder와 inner `.vst3` filename 일치를 요구한다.
- 2026-08-09: SDK `dllmain.cpp`는 module image별 handle을 보존하므로 GetPluginFactory에서 descriptor를
  CWD 없이 실제 loaded module path 기준으로 찾을 수 있다.
- 2026-08-09: Sandboxed CMake/Ninja child process는 compiler ABI probe와 SDK atomic capability probe
  뒤에 종료되지 않았다. Local ignored configure helper에서
  `CMAKE_CXX_COMPILER_WORKS`, `CMAKE_CXX_ABI_COMPILED`, `CMAKE_C_COMPILER_WORKS`,
  `CMAKE_C_ABI_COMPILED`, `CMAKE_SIZEOF_VOID_P`를 실제 x64 toolchain 값으로 고정하고
  `SMTG_USE_STDATOMIC_H=FALSE`로 같은 probe를 건너뛴 뒤 non-sandbox x64 build를 실행했다. 이
  workaround는 preset/source 계약이 아니다. 실제 MSVC compile/link, official tools, PE x64 검사와
  별도 Phase 0 canonical fresh configure가 toolchain을 확인했다.
- 2026-08-09: Pinned `moduleinfotool`에 backslash Windows absolute path를 전달하면 생성 JSON5의 root
  `Name`이 product leaf와 달라지는 결함을 contract test가 발견했다. Tool에 전달하는 path만
  forward slash absolute path로 정규화하고 root Name/Version/Vendor/CID assertion을 추가한 뒤 네
  product를 재package해 Debug/Release CTest, validator와 inspector를 다시 통과했다.
- 2026-08-09: 첫 clang-tidy 분석은 exported/host exception boundary와 top-level catch 안의
  `std::cerr`가 다시 예외를 만들 수 있는 경로 두 가지를 발견해 실패했다. Boundary를 명시하고
  catch reporting의 throwing stream 사용을 제거한 뒤 clean aggregate 분석이 통과했다.
- 2026-08-09: Alternative A custom command가 처음에는 `moduleinfo.json`만 output으로 추적해 inner
  module/descriptor 삭제나 extra file을 놓칠 수 있었다. 제품당 세 파일을 모두 output으로 모델링하고
  aggregate마다 exact inventory, template/descriptor hash와 moduleinfo identity를 verify-only mode로
  재검증하도록 수정했다. 이 검증 graph에는 product-specific compile/link dependency가 없다.

## 의사결정 로그

- 2026-08-09: Descriptor는 parser/library 비용과 escaping ambiguity를 피하려고 1024-byte 이하의
  fixed-order strict ASCII line format으로 정했다. Phase 1B fixture로만 사용한다.
- 2026-08-09: Data Runtime은 valid descriptor가 없으면 factory null로 fail closed하며 generic identity
  fallback이나 class-count-0 factory를 만들지 않는다.
- 2026-08-09: A/B behavior 차이를 줄이되 Phase 1A를 대규모 refactor하지 않기 위해 새
  `runtime_strategy_spike` private implementation만 네 variant가 공유한다.
- 2026-08-09: Alternative B의 common implementation은 static/object reuse로 비교하고 product별
  factory wrapper만 별도 compile한다. Dynamic shared library architecture를 추가하지 않는다.
- 2026-08-09: Global `SMTG_CREATE_MODULE_INFO`는 OFF를 유지하고 A는 package script, B는 target-local
  official helper/post-build 경계에서만 moduleinfo를 생성한다.
- 2026-08-09: ADR 0003은 Windows 결과와 무관하게 Proposed로 유지하며 macOS/Studio export/scale/
  signing/real compiled data 전에는 최종 선택하지 않는다.

## 완료 기록

Phase 1B는 Windows x64 범위에서 **PASS / Complete**다. Baseline
`c9d92bfd800cb702a0c32442598a508b382b1df2`에서 시작해 Alternative A와 B의 네 product를 구현했고,
기존 Gain Spike와 함께 Debug/Release CTest 5/5, simultaneous load/unload/reload, processing/state,
descriptor fail-closed와 identity/moduleinfo parity를 통과했다. Official validator 20개 run은 모두
standard 47/47 또는 extensive 537/537이며 failed test, warning과 crash가 0이다. Werror,
clang-format 37개, remediation 뒤 clang-tidy, PE x64, package-only compiler/linker 0, Phase 0 Native와
Studio regression도 통과했다.

Exact validation history와 runner 제한은
[Phase 1B validation](../docs/status/phase-1b-runtime-strategy-validation.md), hash/size/object/build delta는
[Phase 1B artifacts](../docs/status/phase-1b-runtime-strategy-artifacts.md)에 분리했다. ADR 0003은 계속
Proposed이며 이번 PASS는 A/B 선택, macOS/AU, 실제 DAW, signing/notarization 또는 production export
승인이 아니다. 이번 plan에서는 commit, amend, rebase와 branch 변경을 수행하지 않았다.

## 다음 단계

이 계획을 완료할 당시 제안했던 `Phase 1C — macOS VST3 Runtime Strategy Portability Spike`는
2026-08-09 사용자 지시와 [ExecPlan 0005](0005-phase-1c1-product-contracts-and-headless-windows-export.md)에
따라 후속 milestone 지위를 잃고 첫 상용 배포 전 cross-platform release gate로 이동했다. 현재 제품
순서는 `Phase 1C — Windows Product Creation Vertical Slice`, 그 안의 Phase 1C.1 headless export와
Phase 1C.2 Studio Product Workspace/Export UX다. 이 정합화는 Phase 1B 결과나 ADR 0003 Proposed 상태를
소급해 바꾸지 않는다.
