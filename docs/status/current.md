# Garak Current Status

- 기준일: 2026-08-09
- 현재 phase: Phase 1 — Minimal Native VST3 Shell
- Phase 0A 판정: PASS
- Phase 0B 판정: PASS
- Phase 1A 판정: **PASS / Complete**
- Phase 1B 판정: **PASS / Complete (Windows x64 spike)**
- Phase 1 전체 판정: 미완료
- 정확한 다음 제안: Phase 1C — macOS VST3 Runtime Strategy Portability Spike

## 요약

Phase 0A/0B와 Phase 1A 기준선을 보존한 채 ADR 0003의 generated runtime 대안 A/B를
Windows x64 VST3 기술 spike로 구현·비교했다. Alternative A는 한 번 빌드한 Data Runtime
template module을 제품별 descriptor와 결합해 `Garak Data Alpha`와 `Garak Data Beta`를 만들며,
두 제품의 inner module bytes와 SHA-256은 configuration별로 완전히 같다. Alternative B는 한 번
compile한 internal behavior implementation과 제품별 thin factory translation unit을 link해
`Garak Thin Alpha`와 `Garak Thin Beta`를 만든다.

기존 `Garak Gain Spike`를 포함한 다섯 module은 한 process에서 고유 identity로 동시에 load되었고,
factory/moduleinfo parity, processing, state 및 instance isolation, reverse unload와 reload가 모두
통과했다. Debug/Release CTest는 각각 5/5, official validator는 다섯 제품 각각 standard 47/47과
extensive 537/537를 통과해 총 20회 모두 warning/failure/crash 0, wrapper exit 0이었다. Alternative A
네 output의 일반 PowerShell 재패키징은 `cl.exe`와 `link.exe` 없이 성공했고 immutable build input
18/18이 유지되었다.

Phase 1B는 **PASS / Complete**지만 Windows-only private experiment다. Phase 1 전체는 미완료이며
[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속 **Proposed**다. A/B 어느 쪽도
채택·선호·기본값이 아니고, production descriptor/runtime format이나 Product Compiler를 정하지 않았다.

## 저장소 기준선과 보존

- Phase 0 기준선 commit은 `ef71c755ee84a9b82d6589365711211fdbc62f58`
  (`Establish Phase 0 baseline`)이다.
- 사용자의 명시적 지시에 따라 Phase 1A를 commit
  `c9d92bfd800cb702a0c32442598a508b382b1df2`
  (`feat: complete Garak phase 1A VST3 gain shell`)로 기록했다.
- Phase 1B 시작 시 branch는 `master`, HEAD는 위 Phase 1A commit, working tree는 clean이었다.
- Phase 1B에서는 commit, amend, rebase, branch 변경, reset, clean 또는 submodule pin 변경을 하지 않았다.
- 현재 Phase 1B first-party 변경은 의도적으로 uncommitted이며 build/report는 ignored `out/` 아래에만 있다.
- SDK superproject와 nested checkout은 모두 initialized, detached, exact gitlink와 일치하며 clean하다.
- 사용자 파일 삭제, global VST3 install, registry write와 system/user plugin link는 수행하지 않았다.

## 현재 존재하는 기준선

- [제품 비전](../product/vision.md), [v0.1 PRD](../product/v0.1-prd.md)와 Phase 0 architecture/ADR 기준선
- CMake/Ninja C++20 Native scaffold와 Electron/React/strict TypeScript Studio scaffold
- Exact-pin Steinberg VST3 SDK와 Phase 1A editorless [Gain Spike](phase-1a-vst3-validation.md)
- Phase 1B opt-in runtime-strategy Debug/Release/Werror/clang-tidy preset
- Alternative A Data Runtime template, strict descriptor loader/dynamic factory와 packaging-only script
- Alternative B static common implementation과 두 product-specific thin factory wrapper
- 독립 identity, descriptor failure, moduleinfo structure, simultaneous-load, processing/state contract tests
- Repository-local validator와 artifact inspector; global plugin directory에는 아무것도 설치하지 않음
- [Phase 1B ExecPlan](../../plans/0004-phase-1b-generated-runtime-ab-spike.md),
  [identities](phase-1b-vst3-identities.md), [artifacts](phase-1b-runtime-strategy-artifacts.md),
  [validation](phase-1b-runtime-strategy-validation.md)

## 확정된 결정과 미결정

| ADR | 상태 | 결정 |
| --- | --- | --- |
| [0001](../adr/0001-typescript-studio-and-cpp20-engine.md) | Accepted | Studio는 Electron/React/TypeScript strict mode, Native Engine은 C++20/CMake/Ninja/MSVC/Apple Clang |
| [0002](../adr/0002-no-juce-and-adapter-boundaries.md) | Accepted | JUCE를 사용하지 않고 external library를 first-party adapter 뒤에 격리 |
| [0004](../adr/0004-windows-macos-and-plugin-formats.md) | Accepted | Windows x64 VST3 → macOS VST3 → AU 검증 순서와 첫 상용 format 집합 |
| [0003](../adr/0003-generated-plugin-runtime-strategy.md) | **Proposed** | Alternative A/B 모두 Windows에서 성립했으나 runtime 전략은 미선택 |

Phase 1B는 기술 가능성과 실제 build/package surface를 비교한 증거다. macOS bundle/resource/loading,
code signing/notarization, Studio export, 다수 제품 scale, real compiled data, runtime update와 released-data
compatibility, artist UI/assets, commercial distribution/legal 근거가 없으므로 ADR 0003을 Accepted로 바꾸지 않는다.

## 보존한 장기 계약

- `.garak`은 editable authoring source이고 compiled runtime data는 재생성 가능한 derived artifact다.
- 출시된 Product/plugin/parameter identity와 project/preset/DAW state는 versioned contract로 보존한다.
- Obsolete 내부 API와 pre-release path는 compatibility shim으로 유지하지 않는다.
- Audio callback에서는 allocation, blocking, I/O, parsing, GUI, logging과 예외 전파를 금지한다.
- Generated plugin은 Studio 없이 offline 동작하고 Electron/Chromium/Node/JavaScript runtime을 포함하지 않는다.
- Steinberg 타입은 VST3 adapter에 격리하며 VSTGUI를 build/link하지 않는다.
- 저장소 자체 license는 미정이며 이번 단계에서 root `LICENSE`를 추가하지 않았다.

## Phase 1B 구현 기준선

### Alternative A — Data-driven prebuilt Runtime

- 한 Data Runtime template module을 configuration별로 한 번 compile/link한다.
- `package_data_runtime_variant.ps1`가 template bundle, canonical descriptor, output bundle과 prebuilt
  `moduleinfotool.exe`를 명시적으로 받아 제품별 bundle을 atomic staging으로 생성한다.
- 최종 A output은 build root의 `runtime-products/Garak Data <Alpha|Beta>.vst3/`에 둔다.
- Inner module은 template bytes를 그대로 copy/rename하며 bundle leaf와 inner filename을 일치시킨다.
- `Contents/Resources/garak-product-spike-v1.txt`는 1024-byte 이하 strict ASCII/LF, exact 11-line,
  schema 1 spike descriptor다. `.garak` 또는 production runtime blob이 아니다.
- Windows loaded-module path에서 descriptor를 한 번 읽고 완전히 검증한 뒤 immutable product definition을
  만들며, CWD/environment/registry에 의존하지 않는다. Invalid descriptor는 factory를 노출하지 않는다.
- Dynamic SDK factory가 descriptor의 product/FUID/default를 반영해 processor/controller 두 class만 노출한다.
- Product-specific `moduleinfo.json`은 official tool로 생성·검증하고 별도 structural parser test가 root,
  factory와 exact two-class metadata를 독립 literal과 대조한다.
- Data Alpha/Beta product 생성에는 별도 C++ compile과 module link edge가 0개다.

### Alternative B — Product-specific thin wrapper

- Processor/controller/state behavior는 spike-local static common library에서 한 번 compile한다.
- Thin Alpha와 Thin Beta는 각각 product-local constexpr metadata/FUID를 가진 factory translation unit
  하나와 SDK entry object를 별도 module로 link한다.
- 제품별 moduleinfo를 생성하고 factory identity와 구조적으로 대조한다.
- Common implementation은 source/object reuse이지 final product 간 dynamic shared library가 아니다.
- 새 thin 제품에는 제품별 compile/link가 필요하며 final executable bytes도 서로 다르다.

### Product identity

| Product | Strategy | Processor FUID | Controller FUID | Default Gain |
| --- | --- | --- | --- | ---: |
| Garak Data Alpha | A | `4B2B557251D44CE9914F9B105136FB7E` | `7A90454628B34A3497F05E7CC718F8A1` | -6.0 dB |
| Garak Data Beta | A | `C29B7245261642668ADAC664B6817678` | `1DE08859308F4A0A8473EA5CB70771D2` | +3.0 dB |
| Garak Thin Alpha | B | `93952A37BFA84FF1AC06CE58B9FA87EA` | `E08F3ACCD825424AB238BBAB6B0248CC` | -6.0 dB |
| Garak Thin Beta | B | `44BFB8B6F56946FF9F6F193529BCB967` | `826C362FA2784F719351912BE834F9AB` | +3.0 dB |

모든 제품은 Vendor `Garak`, Version `0.1.0`, Category `Fx`, Gain ID `1001`, Bypass ID `1002`를
사용한다. 여덟 FUID는 서로 다르고 Phase 1A processor/controller FUID와도 충돌하지 않는다.

## 검증 환경

| 항목 | 확인한 version 또는 상태 |
| --- | --- |
| OS | Microsoft Windows 10.0.26200, x64 |
| Visual Studio / MSVC | Community 2026 18.7.3 / 19.51.36248 x64 |
| CMake / Ninja | 4.3.1-msvc1 / 1.13.2 |
| clang-format / clang-tidy | 22.1.3 / 22.1.3 |
| Node.js / pnpm | 24.19.0 / 11.16.0 |
| Electron | 43.3.0 Windows x64 |
| VST3 SDK | `v3.8.0_build_66` / `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0` |

Native 명령은 `VsDevCmd.bat -arch=x64 -host_arch=x64`로 구성한 Visual Studio x64 Developer
환경에서 실행했다. 이 환경에서는 sandboxed CMake compiler ABI probe가 출력 없이 정지해, fresh
runtime-strategy configure에 compiler/ABI 확인 cache 값을 명시한 뒤 실제 clean compile/link와 PE x64
검사로 toolchain을 검증했다. 이 우회는 source나 product artifact를 생략하지 않았다.

## 수행한 검증

### Phase 1B build, quality와 CTest

| 검증 | 최종 결과 |
| --- | --- |
| Runtime Debug fresh configure + clean aggregate build | PASS, exit 0 |
| Runtime Release fresh configure + clean aggregate build | PASS, exit 0 |
| Debug CTest | 5/5 PASS, failed 0 |
| Release CTest | 5/5 PASS, failed 0 |
| Runtime warnings-as-errors fresh/clean build | PASS, first-party `/WX` |
| Runtime clang-tidy fresh/clean build | PASS, SDK source 제외 |
| First-party Native clang-format | 37 `.cpp`/`.hpp`, dry-run/Werror PASS |
| PowerShell scripts | Windows PowerShell 5.1 AST parse 및 failure-exit contract PASS |

CTest는 Phase 0 version, Phase 1A pure/loaded Gain과 Phase 1B descriptor/coexistence contract를 포함한다.
Descriptor failure fixtures는 missing/empty/schema/field/FUID/ID/default/size/duplicate/encoding/name mismatch를
각 canonical bundle path에서 fail closed로 검증한다.

### 동시 load, processing과 state

- `Garak Gain Spike`, Data Alpha/Beta, Thin Alpha/Beta 다섯 module을 동시에 load했다.
- 각 factory는 정확히 processor/controller 두 class와 independent literal identity를 일치시켰다.
- Identical-byte Data Alpha/Beta는 서로 다른 full path와 distinct loaded module handle을 가졌다.
- Mono/stereo, float32/float64, in/out-of-place, default Gain, multi-point automation, exact-offset Bypass,
  zero-sample와 parameter-only process를 네 variant 모두 통과했다.
- 다섯 session에 서로 다른 state를 먼저 설정한 뒤 read-all, forward/reverse interleaved processing,
  final read-all을 수행해 module/instance state leakage 0을 확인했다.
- Corrupt state와 short stream은 prior live state를 변경하지 않았다.
- Factory/instances를 release하고 reverse unload한 뒤 handle 부재를 확인했으며 Data Alpha reload에서
  identity/default/factory parity를 다시 검증했다. 충돌, stale context와 crash는 0이었다.

### Official validator

| Product | Debug Standard / Extensive | Release Standard / Extensive | Warning / Failure / Crash |
| --- | --- | --- | --- |
| Garak Gain Spike | 47/47 / 537/537 | 47/47 / 537/537 | 0 / 0 / 0 |
| Garak Data Alpha | 47/47 / 537/537 | 47/47 / 537/537 | 0 / 0 / 0 |
| Garak Data Beta | 47/47 / 537/537 | 47/47 / 537/537 | 0 / 0 / 0 |
| Garak Thin Alpha | 47/47 / 537/537 | 47/47 / 537/537 | 0 / 0 / 0 |
| Garak Thin Beta | 47/47 / 537/537 | 47/47 / 537/537 | 0 / 0 / 0 |

총 20회 raw report가 expected set과 정확히 일치하고 wrapper invocation은 모두 exit 0이다. Test filter나
suite 제외를 사용하지 않았다. Report는 ignored `out/reports/vst3/runtime-strategy/`에 보존한다.

### Artifact와 package-only evidence

- Debug/Release 각각 Template/Data Alpha/Data Beta inner bytes와 SHA-256이 완전히 같다.
- Release A inner는 700,928 bytes이며 Data A/B bundle은 각각 702,207 / 702,202 bytes다.
- Release Thin A/B inner는 각각 642,560 bytes이며 hash는 서로 다르다. Bundle은 643,563 / 643,560 bytes다.
- 모든 final module은 PE machine `0x8664`, PE32+ DLL이고 forbidden/delay import는 0이다.
- Exact directory/file inventory는 Template/Gain 1 file, Data 3 files, Thin 2 files이며 icon, snapshot,
  editor, desktop metadata와 VSTGUI resource leak는 0이다.
- 일반 PowerShell package-only rerun은 Data Debug/Release Alpha/Beta 네 output만 재생성했다.
- `cl.exe`와 `link.exe`는 PATH에 없었고 compiler/build invocation은 0, immutable input 18/18의
  bytes/hash/timestamps는 불변이었다. 재생성 뒤 inspector, CTest와 validator를 다시 통과했다.
- 상세 hash/size/object/translation-unit/link graph는 [artifact status](phase-1b-runtime-strategy-artifacts.md)에 있다.

### 기존 기능 regression

| 영역 | 최종 결과 |
| --- | --- |
| Phase 0 Native Debug/Release | Fresh configure, clean build, CTest 1/1, exact smoke 모두 PASS |
| Phase 0 Native quality | Werror와 clang-tidy fresh/clean PASS |
| Phase 1A | Runtime CTest에 pure/loaded contract 포함; Gain Debug/Release validator 47/537 모두 PASS |
| Studio | Frozen install, lint, format check, typecheck, production build PASS |
| Studio dependency | Direct 2 runtime + 14 dev = 16; manifest/lock importer 16/16, tracked diff 0 |

Studio build의 첫 sandbox 실행은 Vite child spawn `EPERM`으로 실패했고 같은 명령을 승인된 non-sandbox
환경에서 재실행해 통과했다. Phase 1B는 Studio source, manifest와 lockfile를 변경하지 않았다.

## 실패, 수정과 재검증

- Sandboxed CMake ABI detection이 C/C++ compiler probe에서 정지했다. VS x64 Developer 환경의 명시적
  ABI cache 조건으로 fresh configure한 뒤 실제 clean build, tests와 PE x64 검사를 모두 수행했다.
- 초기 moduleinfo A output은 Windows backslash path 때문에 top-level `Name`이 빈 문자열이었다.
  Moduleinfotool 입력을 forward-slash absolute path로 정규화하고 exact root/factory/class structural
  assertions를 추가한 뒤 packaging, CTest, inspector와 validator를 다시 통과했다.
- A CMake graph가 처음에는 moduleinfo만 output으로 추적해 stale/partial bundle을 놓칠 수 있었다.
  Inner module/descriptor/moduleinfo 여섯 file을 모델링하고 always-run `-VerifyOnly` inventory/hash/tool
  validation을 추가했다.
- Initial coexistence tests는 malformed descriptor 원인을 bundle-name mismatch가 가릴 수 있었고,
  cross-module state read-all과 full reload identity 검증이 부족했다. Canonical isolated fixtures,
  five-session interleave/re-read, repeated factory와 exact reload 검증으로 보강했다.
- Artifact inspector의 overwrite test가 Windows PowerShell에서 null backup의 `File.Replace`를 호출해
  실패했다. Real temporary backup으로 수정하고 Debug/Release inspector를 다시 통과했다.
- First clang-tidy는 descriptor-test `main` exception boundary에서 실패했고, catch 안의 C++ stream도
  throw 가능하다는 두 번째 진단이 있었다. Catch-all과 non-throwing C output으로 정리한 뒤 targeted 및
  full fresh/clean tidy를 통과했다.

## 수행하지 않은 검증

- macOS Apple Clang/Xcode configure, build, VST3 bundle/resource/loading과 official validator
- macOS arm64/x86_64/Universal binary, code signing, notarization과 AU
- Windows/macOS 실제 DAW host의 scan/load/automation/state restore matrix
- Production `.garak`, compiled runtime data, Product Compiler와 Studio export/IPC
- Artist asset/custom editor/native renderer와 package signing/installer
- 대규모 제품 수, incremental export, runtime update와 released-data compatibility/migration
- Realtime allocation/blocking 계측, CPU/latency/memory와 long-running stress
- Commercial distribution, full transitive license/notice/trademark/security audit

이 항목은 PASS로 일반화하지 않는다. Phase 1B validator와 hosting contract test는 실제 DAW 및 macOS
검증을 대신하지 않는다.

## 현재 리스크와 남은 미결정

- Alternative A는 Windows에서 compiler 없는 product packaging을 입증했지만 descriptor parsing,
  resource integrity, moduleinfo regeneration과 final package signing 경계를 운영해야 한다.
- Alternative B는 단순한 compile-time identity와 SDK의 일반 module lifecycle을 쓰지만 제품마다
  wrapper compile/link, executable bytes와 재서명이 필요하다.
- 동일 module bytes를 다른 macOS bundle에서 load하고 descriptor/resource를 찾는 방식, bundle ID,
  hardened runtime와 code signing의 관계는 미검증이다.
- Thin common code는 static reuse이므로 제품 간 binary deduplication이나 shared-runtime update를 보장하지 않는다.
- Spike descriptor는 production persistence/compatibility 계약이 아니며 real compiled data schema로 승격할 수 없다.
- Moduleinfo와 factory parity는 product packaging pipeline에서 계속 독립 검증해야 한다.
- VST3 SDK tutorials license, commercial notices/trademark와 generated Runtime redistribution legal review는 미완료다.
- `.garak`, compiled data, Studio/Native boundary, DSP graph, UI scene/rendering과 migration 정책은 계속 미결정이다.

## 정확한 다음 작업 제안

Phase 1B는 Windows x64에서 A/B 모두 성립했으므로 다음 제안은 하나뿐이다.

`Phase 1C — macOS VST3 Runtime Strategy Portability Spike`

이 작업은 아직 시작하지 않는다. 별도 ExecPlan에서 Apple Clang, arm64/x86_64/Universal artifacts,
macOS bundle/resource lookup, simultaneous load, moduleinfo, validator, signing/notarization 경계를 먼저
정의해야 한다. ADR 0003은 그 증거 전까지 Proposed로 유지하고 A/B를 선택하지 않는다.
