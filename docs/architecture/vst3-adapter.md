# Garak VST3 Adapter

- 기준일: 2026-08-09
- 상태: Phase 1A Windows x64 **PASS / Complete**
- Identity: [Phase 1A VST3 Identity](../status/phase-1a-vst3-identity.md)
- SDK pin: [Phase 1A VST3 Dependency](../status/phase-1a-vst3-dependency.md)
- 검증: [Phase 1A VST3 Validation](../status/phase-1a-vst3-validation.md)
- 관련 계획: [ExecPlan 0003](../../plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)
- 상위 경계: [Module Boundaries](module-boundaries.md), [Realtime and Quality](realtime-and-quality.md)

## 역할과 결정 상태

`native/adapters/vst3`는 Steinberg VST3 ABI와 Garak이 소유하는 audio/state 동작 사이의
format adapter다. Steinberg type, header, lifecycle, factory와 host error code는 이 adapter
및 VST3 전용 contract test 밖으로 노출하지 않는다. SDK-independent Gain, automation과
state byte contract는 `native/spikes/gain`에 두며 Steinberg type에 의존하지 않는다.

현재 `Garak Gain Spike`는 이 경계를 end-to-end로 검증하는 고정된 editorless native
module이다. 범용 plugin runtime, product compiler 또는 생성 제품의 구현이 아니다.

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

현재 spike는 `SMTG_CREATE_MODULE_INFO=OFF`이고 moduleinfo를 만들거나 배포 계약으로 삼지
않는다. SDK의 자동 post-build validator 실행도 끄며 아래의 명시적인 local validation
경로만 사용한다.

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

## 명시적 비범위

- `.garak` project, compiled runtime blob, product compiler와 export pipeline
- 범용 first-party plugin runtime API, DSP graph, macro, preset과 custom product UI
- ADR 0003 Alternative A/B의 구현, 비교 결과 또는 선택
- VSTGUI/editor/resource, meter, program list와 asset pipeline
- MIDI/event, sidechain, instrument/synth와 process-context 기능
- Studio/native IPC, Node.js native addon와 Electron 통합
- AU, macOS/Universal build, signing, notarization, installer와 실제 DAW host 검증
- User/system VST3 directory write와 commercial product identity
- Commercial distribution, transitive dependency legal/notice/trademark audit
- Moduleinfo 생성/배포와 이전 state schema migration

## Generated runtime 전략과의 관계

[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속 **Proposed**다. Alternative A
(prebuilt runtime + product data)와 Alternative B(product-specific thin wrapper + common runtime)
중 어느 것도 선택, 승인 또는 기본값으로 두지 않는다. 이 spike가 fixed native module이라는
사실은 Alternative B의 채택 근거가 아니다. Phase 1A의 증거는 official VST3 SDK adapter 경계와
그 최소 host contract에만 한정된다.
