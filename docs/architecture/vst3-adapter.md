# Garak VST3 Adapter

- 기준일: 2026-08-10
- 상태: Phase 1A/1B와 Phase 1C.1 Windows x64 **PASS / Complete**
- Identity: [Phase 1A VST3 Identity](../status/phase-1a-vst3-identity.md)
- SDK pin: [Phase 1A VST3 Dependency](../status/phase-1a-vst3-dependency.md)
- 검증: [Phase 1A VST3 Validation](../status/phase-1a-vst3-validation.md)
- Phase 1B identity: [Phase 1B VST3 Product Identities](../status/phase-1b-vst3-identities.md)
- Phase 1B artifact: [Phase 1B Runtime Strategy Artifacts](../status/phase-1b-runtime-strategy-artifacts.md)
- Phase 1C.1 fixture: [Phase 1C.1 Product Fixtures](../status/phase-1c1-product-fixtures.md)
- Phase 1C.1 검증: [Phase 1C.1 Headless Export Validation](../status/phase-1c1-headless-export-validation.md)
- 관련 계획: [ExecPlan 0003](../../plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)
- 상위 경계: [Module Boundaries](module-boundaries.md), [Realtime and Quality](realtime-and-quality.md)

## 역할과 결정 상태

`native/adapters/vst3`는 Steinberg VST3 ABI와 Garak이 소유하는 audio/state 동작 사이의
format adapter다. Steinberg type, header, lifecycle, factory와 host error code는 이 adapter
및 VST3 전용 contract test 밖으로 노출하지 않는다. SDK-independent Gain, automation과
state byte contract는 `native/spikes/gain`에 두며 Steinberg type에 의존하지 않는다.

Phase 1A `Garak Gain Spike`는 이 경계를 end-to-end로 검증하는 고정된 editorless native
module이다. Phase 1B의 runtime strategy code도 같은 adapter 아래에 격리한 비교 spike이며 범용
plugin runtime public API, product compiler 또는 production export 구현은 아니다.

Phase 1C.1의 `product_runtime_v1`은 Phase 1A/1B spike를 수정하거나 fallback으로 재사용하지 않는
Windows x64 v0.x 제품 경로다. First-party `GARAKCPD`/`GARAKPST` contract는
`native/runtime/product_v1`에 두고, VST3 factory, module-relative resource lookup, processor/controller,
stream과 factory/moduleinfo inspector만 adapter 아래에 둔다. Windows v0.x prebuilt Runtime 결합은
[ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)에 한정해 Accepted이며 cross-platform
결정인 [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속 Proposed다.

## 공식 SDK pin과 build 경계

- Official upstream: `steinbergmedia/vst3sdk`
- Tag: `v3.8.0_build_66`
- Superproject commit: `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`
- 공급 방식: `third_party/vst3sdk` Git submodule과 그 nested submodule의 recursive checkout
- Plugin 생성 API: pinned SDK의 `smtg_add_vst3plugin`
- Plugin SDK targets: `sdk`, `sdk_common`, `base`, `pluginterfaces`
- Validator/loaded-contract host target: `sdk_hosting`; plugin link에서는 제외

Configure 또는 build 중 network fetch를 하지 않고 SDK 및 nested source를 수정하지 않는다.
VSTGUI는 재현 가능한 nested checkout에는 포함되지만 support를 끄고 plugin에 build/link하지
않는다. 자동 user/system plugin link, VST3 examples와 hosting examples도 끈다. Windows bundle은
오직 repository의 `out/` 아래에 생성한다.

Phase 1A Gain Spike는 `SMTG_CREATE_MODULE_INFO=OFF`이고 moduleinfo를 만들거나 배포 계약으로
삼지 않는다. Phase 1B는 같은 pinned SDK의 `moduleinfotool`을 opt-in build utility로 사용하되
global/cache `SMTG_CREATE_MODULE_INFO`는 OFF로 유지하고 Thin target과 Data package staging에서만
moduleinfo를 명시적으로 create/validate한다. SDK의 자동 post-build validator에 의존하지 않고
repository-local validation 경로만 사용한다.

## Adapter와 module 구조

| 경계 | 책임 |
| --- | --- |
| `native/spikes/gain` | 정규화 Gain mapping, sample 처리, automation timeline, schema 1 state codec |
| `native/adapters/vst3/gain_spike` | VST3 factory, processor/controller lifecycle, bus와 parameter queue 변환, stream adapter |
| `native/tests/gain_spike_tests.cpp` | SDK-independent 동작과 실패 정책 검증 |
| `native/tests/vst3_gain_contract_tests.cpp` | 실제 bundle을 load해 Steinberg ABI 계약 검증 |
| `tools/vst3/validate.ps1` | pinned SDK validator의 Debug/Release local 실행과 report 보존 |

Module은 processor와 edit controller 두 class만 등록한다. Processor/controller FUID와
Gain/Bypass parameter ID는 [identity 문서](../status/phase-1a-vst3-identity.md)의 고정값을
사용한다. Controller의 `createView`는 모든 요청에 null을 반환하며 editor, VSTGUI와 UI
resource를 포함하지 않는다.

Processor는 initialize/setup/activate/process/state/terminate lifecycle을 editor 없이 수행한다.
SDK `AudioEffect`의 inherited `kNotImplemented`를 사용하지 않고 stateless `setProcessing`을
`kResultTrue`로 명시한다.

## Audio bus와 precision 계약

- Audio input과 output은 각각 하나의 default-active main bus다. 초기 arrangement는 stereo다.
- 정확히 mono-to-mono 또는 stereo-to-stereo인 matching arrangement만 허용한다.
- Input/output mismatch, zero/additional bus와 surround arrangement는 거부한다.
- Event/MIDI bus와 sidechain은 등록하지 않는다.
- `float32`와 `float64` processing만 지원한다. 설정된 symbolic sample size와 다른 process
  call 및 알 수 없는 precision은 거부한다.
- 양수 sample block은 정확히 하나의 input/output bus, 같은 1개 또는 2개 channel, 유효한
  bus/channel pointer를 요구한다.
- `setupProcessing`에서 받은 `maxSamplesPerBlock`을 넘는 block은 buffer 접근 전에 거부한다.
- Zero-sample call은 audio buffer 없이 offset 0 automation과 pending state를 적용할 수 있다.

구조가 잘못된 positive-sample call은 실패를 반환한다. 성공하지 않은 call의 output buffer나
silence flag를 정리했다고 가정해서는 안 된다.

## Gain, automation과 bypass 계약

Gain의 normalized domain은 `[0, 1]`이고 physical mapping은 `-60 dB..+12 dB`의 선형 mapping이다.
기본 `0 dB`는 normalized `5/6`이며 amplitude는 `10^(dB/20)`으로 계산한다.

Parameter queue는 heap container로 복사하지 않고 host queue를 직접 검증하고 순회한다.

- Parameter queue count는 최대 2다. 3 이상 또는 `INT_MAX`는 queue data callback 전에 거부한다.
- Block별 point cap은 `numSamples <= 1 ? 2 : min(INT_MAX, 2 * numSamples)`이다. 4-sample block은
  최대 8 point, zero-sample block은 최대 2 point만 순회하며 cap 계산은 overflow를 피한다. Cap
  초과는 `getPoint` 전에 거부한다.
- 모든 point 조회가 성공하고 offset이 block 안에서 비감소 순서이며 normalized value가
  finite여야 한다. 하나라도 어기면 그 parameter queue 전체를 버리고 이전 current value를
  유지한다.
- 양수 block의 offset 범위는 `0..numSamples-1`이고 zero-sample block은 offset 0만 허용한다.
- Finite한 범위 밖 normalized value는 `[0, 1]`로 clamp한다.
- 같은 queue의 같은 offset에서는 마지막 point가 이긴다.
- 같은 ParamID의 queue가 둘 이상이면 해당 ID의 queue들을 그 block에서 모두 무시한다.
  알 수 없는 ParamID는 무시한다.
- Gain은 이전 block의 current value를 virtual offset `-1`의 시작점으로 두고 다음 point까지
  normalized domain에서 sample별 선형 보간한다.
- Bypass는 보간하지 않고 normalized value `0.5` 이상을 on으로 해석해 point의 정확한 sample
  offset부터 전환한다. Crossfade나 de-clicking은 하지 않는다.
- Block 종료 값은 다음 block으로 이어지며 Gain timeline은 bypass 중에도 전진한다.

In-place bypass는 dry buffer를 그대로 두고 out-of-place bypass는 input sample을 그대로
복사한다. 단, host가 silent라고 표시한 channel에는 아래 silence 계약이 먼저 적용된다.

## State 계약

Processor와 controller는 같은 schema 1 codec을 사용한다. State는 정확히 20바이트이고 C++
struct layout, JSON, pointer 또는 `size_t` 표현에 의존하지 않는다.

| Byte | 내용 |
| --- | --- |
| `0..3` | ASCII magic `GGS1` |
| `4..7` | little-endian `uint32`, schema version `1` |
| `8..15` | normalized Gain의 IEEE-754 binary64 raw bits, little-endian |
| `16..19` | little-endian `uint32`, Bypass `0` 또는 `1` |

Pure codec은 정확히 20바이트인 input span만 받고 magic, version, finite Gain과 `[0, 1]` 범위,
Bypass 표현을 임시 값에서 모두 확인한 뒤 한 번에 commit한다. Truncated, trailing, corrupt,
unsupported 또는 범위 밖 codec input은 live state를 일부 변경하지 않고 거부한다. VST3 stream
adapter는 한 번에 정확히 20바이트를 요청하며 API가 success를 반환해도 1..19바이트만 전송한
short read/write를 거부한다. Payload 뒤의 host stream byte를 별도로 probe하지는 않는다. 이
spike는 schema 1 이외의 fallback이나 migration framework를 만들지 않는다.

`setState`가 받은 유효 state는 lock-free pending state와 generation으로 넘기고 processor는 다음
process 경계에서 적용한다. 성공한 process 결과는 sequence-lock snapshot으로 publish하되 process가
시작한 generation보다 새 `setState`가 도착했으면 이전 process 결과를 publish하지 않는다.
Non-realtime `getState`는 같은 sequence의 whole snapshot만 읽는다. State byte parsing과
serialization은 process callback에서 하지 않는다. Controller의 `setComponentState`는 같은 codec으로
Gain/Bypass host parameter를 동기화한다.

## Realtime와 실패 계약

Process callback과 그 하위 경로에서는 다음을 허용하지 않는다.

- 동적 allocation/deallocation과 host queue의 heap copy
- mutex, blocking lock, wait, sleep와 thread join
- 파일/network I/O, logging, formatting와 string 생성
- bus, channel 또는 graph 구조 변경
- callback 경계 밖으로의 exception 전파

Channel 작업 storage는 mono/stereo용 fixed stack array다. Automation traversal은 queue 최대 2와
block-derived point cap으로 제한되므로 host가 임의로 큰 count를 반환해도 data callback에 진입하지
않는다. 허용된 작업량은 sample 수와 cap 안의 point 수에 선형이다. State handoff에 쓰는 `uint64_t`
atomics는 compile-time lock-free 조건을 요구한다.

Process 진입점은 exception을 host로 전파하지 않는다. Contract host의 `getParameterCount` 또는
`getPoint`가 throw하면 top-level boundary가 VST3 failure로 변환하며 live Gain/Bypass state를
변경하지 않는다. Baseline smoke와 version-test executable도 main top-level exception boundary에서
non-zero 결과로 변환한다.

## Silence, NaN/Inf와 denormal 계약

- 성공한 audio path는 output silence flags를 먼저 0으로 설정한다.
- 활성 channel의 input silence bit만 전파한다. 해당 bit가 있으면 buffer 내용과 bypass 여부에
  관계없이 output channel을 0으로 채우고 그 output bit를 설정한다.
- Numeric zero, `-60 dB` Gain, 비정상 sample을 0으로 치환한 결과만 보고 새로운 silence bit를
  추론하지 않는다. 활성 channel 수 밖의 input bits도 전파하지 않는다.
- Gain path는 NaN/Inf input 또는 비정상 multiplication 결과를 0으로 치환한다. 0이 아닌
  subnormal output도 sample별로 0으로 치환한다.
- Bypass dry path는 input-silent channel을 제외하고 NaN/Inf와 subnormal을 포함한 raw sample을
  그대로 보존한다.
- Global FTZ/DAZ floating-point mode는 변경하지 않는다.

Non-finite automation은 위에서 정의한 대로 queue 전체를 거부한다. Non-finite 또는 범위 밖
persisted Gain state도 거부한다.

## Local validation 계약

`garak_vst3_gain_spike_all` build target은 plugin bundle과 pinned SDK source의 official
`validator`를 한 build graph에 묶는다. `GARAK_BUILD_TESTS=ON`이면 pure Gain test와 VST3 bundle
contract test도 이 aggregate target의 dependency다. CTest contract test는 local bundle을 직접
load해 factory class/FUID, bus, precision, parameter metadata, processing, state restore와 editor
부재를 검증한다. Pure test는 모든 truncated state length와 automation edge를 검사하고 loaded
contract는 1..19-byte short-success stream read/write, malformed/non-monotonic/invalid 및 duplicate
queue, `maxSamplesPerBlock` 초과를 방어한다. Process thread와 20,000회 state handoff를 겹쳐
generation 및 whole-snapshot invariant도 검증한다.

Work-cap contract는 4-sample block의 8 point를 받고 9와 `INT_MAX`를 거부하며 zero-sample의 2
point를 받고 3을 거부한다. Queue count 3과 `INT_MAX`는 queue data callback을 한 번도 호출하지
않고 거부한다. Throwing `getParameterCount`/`getPoint`도 state mutation 없이 failure로 변환한다.
Factory/identity 기대값은 production identifier 상수를 재사용하지 않는 independent literal이다.

[`tools/vst3/validate.ps1`](../../tools/vst3/validate.ps1)은 Debug 또는 Release의 repository-local
build tree에서 validator executable과 `Garak Gain Spike.vst3` bundle이 각각 정확히 하나인지
확인한다. 이어 official validator의 standard run과 extensive `-e` run을 모두 실행하고 원문
report를 `out/reports/vst3/`에 보존한다. 이 경로는 system/user VST3 directory 설치, registry
변경 또는 global validator에 의존하지 않는다.

Final source의 Windows x64 Debug/Release fresh configure와 clean aggregate build, formatter 뒤
incremental build와 CTest 3/3은 모두 exit 0이다. Werror와 clang-tidy도 각각 fresh/clean 및 final
incremental build가 exit 0이고 first-party `.cpp`/`.hpp` 20개 clang-format apply/check도 exit 0이다.
Official validator는 최종 두 bundle 모두 standard 47/47, extensive 537/537, warning 0, 네 process
exit 0이며 원문은
`out/reports/vst3/debug-validator-standard.txt`,
`out/reports/vst3/debug-validator-extensive.txt`,
`out/reports/vst3/release-validator-standard.txt`와
`out/reports/vst3/release-validator-extensive.txt`에 있다. 두 module은 PE `8664 machine (x64)`다.
VSTGUI CMake cache는 OFF, plugin link command hit는 0이고 bundle의 icon과 `moduleinfo.json`도 0이다.
System/user plugin link나 registry mutation은 없다.

Phase 0 Native Debug/Release fresh/clean CTest 1/1와 exact smoke, Phase 0 Werror/tidy fresh/clean 및
Studio frozen install/lint/format/typecheck/build도 최종 rerun PASS이며 Studio direct dependency는
16개로 유지됐다. 이 근거로 Phase 1A Windows x64 adapter spike는 PASS / Complete다.

Phase 1 전체는 미완료다. Windows 결과를 macOS/AU, 실제 DAW host, commercial distribution 또는
transitive legal audit의 통과로 일반화하지 않는다.

## Phase 1C.1 Product Runtime v1 경계

`Garak Product Runtime v1`은 configuration별로 한 번 build한 editorless Windows x64 VST3 template다.
Headless Product Compiler는 template inner binary를 제품 bundle에 copy/rename하고
`Contents/Resources/product.garakbin`과 product-specific `moduleinfo.json`을 배치한다. Product마다 C++
source를 생성, compile 또는 link하지 않는다. Final bundle은 repository-local output에만 생성하며
global/system/user VST3 directory, registry와 installer를 사용하지 않는다.

Windows adapter는 loaded module image의 actual path에서 exact resource를 찾는다. CWD, environment,
registry, Studio state와 network를 identity나 resource lookup에 사용하지 않는다. Factory 공개 전
bounded file read와 first-party strict parser를 완료하고 다음 값이 모두 일치할 때만 processor/controller
두 class를 등록한다.

- `GARAKCPD` v1의 Product ID와 deterministic processor/controller FUID
- Product version, white-label vendor/name, category `Fx`와 template `garak.gain-v1`
- Gain ID `1001`, Bypass ID `1002`, normalized default와 exact flags/type
- Bundle leaf/inner module basename, actual factory와 product-specific moduleinfo metadata

Missing, oversized, malformed, unsupported, reserved/trailing data 또는 identity mismatch에서는 stale
template identity나 Phase 1B descriptor로 fallback하지 않고 null factory로 fail closed한다. Parsed
definition은 module-owned immutable value이고 instance가 필요한 값을 복사한다. Factory construction
이후와 audio callback에서는 filesystem access, compiled-data parsing과 migration을 하지 않는다.

Processor/controller state는 exact 96-byte `GARAKPST` v1을 사용하고 loaded Product ID에 bind한다.
Whole snapshot을 임시 값에서 검증한 뒤 commit하며 cross-product, malformed, duplicate/unknown/missing
parameter, nonfinite/range와 reserved/trailing input은 prior live state를 보존한 채 거부한다. Phase 1A/1B
20-byte `GGS1` state는 기존 spike에만 남고 Product Runtime의 compatibility input이 아니다.

Warm/Bright는 mono/stereo, Float32/Float64, in/out-of-place, Gain automation, exact-offset Bypass,
zero-sample/parameter-only, state/instance isolation과 reverse unload/reload를 통과했다. 기존 Gain/Data
Alpha/Data Beta/Thin Alpha/Thin Beta까지 일곱 module을 한 process에서 함께 load해 identity와 state
leakage가 없음을 검증했다.

### Windows Unicode process boundary

UTF-8 product contract는 system active code page(ACP), narrow `main` argument와 filesystem locale에
의존하지 않는다.

- Inspector는 `wmain`에서 UTF-16 argument를 strict UTF-8로 변환하고 loaded bundle/resource에는 wide
  Windows path를 사용한다. Unpaired surrogate는 process boundary에서 fail closed한다.
- `LC_CTYPE`를 exact `.UTF8`로 설정하고 실패하면 startup에서 종료하는 first-party object를 inspector,
  pinned moduleinfotool과 validator에 link한다.
- Pinned SDK 3.8의 bounded host-side conversion은 UTF-16 code unit을 따로 처리해 supplementary-plane
  character를 보존하지 못한다. Third-party source는 수정하지 않고 complete public seven-overload
  first-party `Steinberg::Vst::StringConvert` object를 Product Runtime과 inspector/moduleinfotool/validator
  세 host에 link한다.
- Factory와 inspector metadata는 narrow `PClassInfo2`가 아니라 `PClassInfoW`를 사용한다.
- Export child에게는 inner module path가 아니라 forward-slash absolute **bundle path**를 전달한다.

최초 inner-path-only test는 project/output/bundle/metadata와 process boundary를 충분히 덮지 못했고,
`PClassInfo2`에서는 emoji metadata가 mojibake였다. 첫 exact Unicode export는 invalid moduleinfo UTF-8을
`GARAK_EXPORT_MODULEINFO_UTF8`로 거부했다. 위 boundary 뒤 CTest의
`가락 경로 📁/가락 🎛 Gain.vst3`와 invalid surrogate, exact CLI의 `가락 연구소 🧪` /
`가락 🎛 Gain`이 통과했다. CLI child는 moduleinfo create/validate, inspector와 validator
standard/extensive exact 5/5 exit 0이고 bundle inventory는 3 files다.

Final source snapshot의 Debug/Release fresh configure와 clean aggregate build는 각각 177/177,
no-native-build runner 뒤 CTest는 각각 7/7, Werror/clang-tidy quality target은 각각 110/110 통과했다.
First-party clang-format은 58 files가 통과했다. Warm/Bright 네 bundle의 official Validator 8회는 standard 47/47,
extensive 537/537, warning/failure/crash 0, exit 0이다. 일반 PowerShell 반복 export는 build-tree file
inventory/size/hash/timestamp 불변, forbidden native-build invocation 0과 exact 20 child process exit 0을
configuration별로 기록했다. Exact artifact와 report는 위 Phase 1C.1 status 문서가 소유한다.

## Phase 1B runtime strategy spike 경계

Phase 1B는 Phase 1A의 Gain/audio/state 구현을 보존하고
`native/adapters/vst3/runtime_strategy_spike` 안에서만 두 packaging 방식을 비교한다. 네 제품의
exact FUID, parameter ID와 default는
[identity 문서](../status/phase-1b-vst3-identities.md), binary/resource/build delta는
[artifact 문서](../status/phase-1b-runtime-strategy-artifacts.md)가 기록한다.

### Alternative A module-relative data runtime

`Garak Data Runtime Template`은 product descriptor와 moduleinfo가 없는 prebuilt input module이다.
Package script는 같은 template inner bytes를 configuration별
`out/build/runtime-strategy-<config>/runtime-products/Garak Data Alpha.vst3`와
`Garak Data Beta.vst3`에 stage하고 strict descriptor와 product-specific `moduleinfo.json`을 더한다.
이 `runtime-products` 경로는 현재 Windows spike의 실제 local evidence path이지 production export
layout 결정이 아니다.

Windows loader는 SDK `dllmain`이 보존한 module image handle에서 bundle path를 얻고
`Contents/Resources/garak-product-spike-v1.txt`를 module load/factory 경계에서 한 번 읽는다. Current
working directory, registry와 system VST path를 사용하지 않는다. Descriptor는 최대 1024바이트,
ASCII/LF-only인 fixed 11-line schema이며 bundle leaf, inner basename과 product name도 일치해야 한다.
Missing, malformed, duplicate, out-of-range 또는 identity mismatch이면 factory를 만들지 않고 null로
fail closed한다.

검증된 product definition은 module image가 소유한 immutable value다. Dynamic factory는 그
definition으로 processor와 controller 두 class만 등록하고 instance construction 시 필요한 값을
복사한다. Descriptor file I/O와 parsing은 audio process callback에 들어가지 않는다. Mutable
process-global current product identity 또는 fallback identity는 없다.

### Alternative B thin wrapper와 static common implementation

`garak_runtime_strategy_spike_common`은 processor, controller, factory support와 state stream을
configuration별 한 번 compile하는 static common implementation이다. `Garak Thin Alpha`와
`Garak Thin Beta`는 각각 한 개의 product-specific factory wrapper translation unit을 별도로
compile하고 별도 VST3 module로 link한다. Wrapper는 immutable product definition과 factory entry만
가지며 DSP, automation, state 구현을 복제하지 않는다.

Static library reuse는 source/object build reuse다. Common executable code는 각 final module에
포함되므로 외부 shared service나 dynamic shared runtime으로 표현하지 않는다. Thin wrapper가
작다는 사실도 Alternative B의 production 선택 근거가 아니다.

### Moduleinfo와 coexistence

Alternative A는 final staged bundle의 renamed inner module과 descriptor를 먼저 배치한 뒤 pinned
`moduleinfotool -create`와 `-validate`를 실행한다. Alternative B는 각 Thin target의 실제 factory에서
moduleinfo를 생성하고 검증한다. Contract test는 pinned SDK `ModuleInfoLib` parser로 root
Name/Version, Factory Vendor와 정확히 두 class의 CID/name/category/subcategory/version을 독립 literal
fixture에 구조적으로 대조한다. Template과 Phase 1A Gain Spike는 moduleinfo 대상이 아니다.

한 contract-test process가 Gain Spike와 Data/Thin Alpha/Beta 다섯 module을 동시에 load한다. Module
handle, 열 개 class FUID, factory metadata, default, state와 interleaved processing이 서로 새지 않는지
검증하고 reverse unload 뒤 Data Alpha를 exact metadata/default와 함께 reload한다. Malformed descriptor
fixture는 canonical bundle/inner basename을 유지하며 descriptor-name mismatch와 bundle-inner mismatch는
각각 별도 failure다. Callback exception은 VST failure로 변환하고 state를 변경하지 않는다.

이 구현은 Windows A/B evidence를 만들기 위한 spike-local adapter다. First-party persistent model이나
format-neutral runtime public API에 Steinberg type, Windows handle 또는 descriptor physical path를
노출하지 않는다.

## 명시적 비범위

- Production single-file `.garak`, general compiled container와 released schema migration
- 범용 DSP graph/compiler, arbitrary node, macro, preset/asset와 custom product UI
- ADR 0003의 cross-platform 최종 선택/기본값과 macOS/AU export pipeline
- VSTGUI/editor/resource, meter, program list와 asset pipeline
- MIDI/event, sidechain, instrument/synth와 process-context 기능
- Studio/native IPC, Node.js native addon와 Electron 통합
- AU, macOS/Universal build, signing, notarization, installer와 실제 DAW host 검증
- User/system VST3 directory write와 commercial product identity
- Commercial distribution, transitive dependency legal/notice/trademark audit
- Production moduleinfo/signing 정책과 이전 state schema migration

## Generated runtime 전략과의 관계

[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속 **Proposed**다. Phase 1B는
Alternative A(prebuilt runtime + product data)와 Alternative B(product-specific thin wrapper +
static common implementation)를 같은 Windows contract로 구현·측정했지만 어느 것도 선택, 승인,
선호 또는 cross-platform 기본값으로 두지 않는다. Phase 1C.1은 별도 ADR 0005로 **Windows x64 v0.x**
canonical exporter에 prebuilt Product Runtime plus product data를 선택했으며, 이 local 결정은 ADR 0003의
상태를 바꾸지 않는다. Phase 1A 증거는 official VST3 SDK adapter baseline에, Phase 1B 증거는 Windows
x64 A/B spike에, Phase 1C.1 증거는 minimal headless Windows product path에 각각 한정된다. macOS
Universal/AU/signing과 cross-platform export evidence 전에는 장기 runtime 전략을 확정하지 않는다.
