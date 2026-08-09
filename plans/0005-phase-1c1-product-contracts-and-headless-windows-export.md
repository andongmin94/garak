# ExecPlan 0005 — Phase 1C.1 Product Contracts and Headless Windows Export

- Status: **Complete / PASS (Windows x64 Phase 1C.1)**
- Started: 2026-08-09
- Updated: 2026-08-10
- Owner: Garak product compiler / native VST3 adapter

## 목적

최소 unpacked `.garak` directory project를 strict하게 읽고, 영구 Product ID에서 VST3
processor/controller FUID를 결정적으로 도출하고, 별도 versioned binary인 `Garak Compiled
Product Data v1`로 compile한다. Windows x64에서 한 번 build한 `Garak Product Runtime v1`
binary와 compiled data를 결합하여 제품별 C++ compile/link 없이 독립적인 white-label VST3를
local output에 export하고 official moduleinfotool, first-party inspector와 VST3 Validator로
검증한다.

이 계획은 **Phase 1C 전체가 아니라 Phase 1C.1만** 책임진다. Studio Product workspace와 Export
UX는 Phase 1C.2이며 이번 계획에서 구현하지 않는다.

## 사용자 가치

아티스트 제품의 이름, vendor, 기본 Gain과 영구 identity가 source project에서 실제 Windows
VST3까지 한 번에 전달된다. Native toolchain을 제품마다 다시 실행하지 않아도 서로 다른 두
white-label product를 재현 가능하고 원자적으로 만들 수 있으므로, Studio UI를 연결하기 전에
제품 제작의 핵심 계약과 실패 경로를 headless 환경에서 독립 검증할 수 있다.

## 시작 commit과 Git 상태

- Branch: `master`
- Phase 1B baseline commit:
  `4203138f13a83e652c04405061fcd2c2ec362c27`
  (`feat: complete Garak phase 1B runtime strategy spike`)
- 시작 working tree: clean. `git status --short --branch`는 `## master`만 출력했다.
- Phase 1B의 43-file delta는 위 commit에 tracked되어 있다.
- 이번 Phase 1C.1에서는 commit, amend, rebase, branch 변경, reset 또는 clean을 수행하지 않는다.

## 현재 Windows toolchain

| 도구 | 확인한 기준 |
| --- | --- |
| OS | Windows 10.0.26200 x64 |
| Visual Studio / MSVC | Community 2026 18.7.3 / MSVC 19.51.36248 x64 |
| CMake / Ninja | 4.3.1-msvc1 / 1.13.2 |
| clang-format / clang-tidy | 22.1.3 / 22.1.3 |
| Node.js / pnpm | 24.19.0 / 11.16.0 |
| Electron | 43.3.0 Windows x64 |

Native build는 `VsDevCmd.bat -arch=x64 -host_arch=x64` 환경에서 실행한다. Product export의
no-native-build 재현은 prebuilt Runtime/tools를 입력으로 한 일반 PowerShell에서 수행한다.

## VST3 SDK pin과 checkout

- Official tag: `v3.8.0_build_66`
- Superproject: `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`
- `base`: `3d2e82f8e6bff59c1d8b7a27491a29c2286b5206`
- `cmake`: `de6e54eeaaab35b7145f5c32c279b5e892146e04`
- `doc`: `6d4737c9e70750056e731d88d49aa06eefc8a1a4`
- `pluginterfaces`: `31d6eeba6daaa3e2a8bfbe3e7a90ca0b7fbfbc1c`
- `public.sdk`: `a3911a4615dabbfdfd9d181ee26b05c70c289a95`
- `tutorials`: `33b73dfbb87f3fde3bce8c0a10cae934dc66ad34`
- `vstgui4`: `76823bdbe286e4bdb9f79ab8986af5ce7202336c`

시작 시 superproject와 nested 7개 repository는 parent gitlink와 같은 detached HEAD이고
tracked/untracked 변경이 0이다. Pin, nested source와 SDK source는 변경하지 않는다.

## Phase 1B Alternative A 근거와 보존 경계

Phase 1B Windows x64 evidence에서 configuration별 Data Runtime Template, Data Alpha와 Data Beta의
inner module bytes와 SHA-256이 같았고, 일반 PowerShell package-only 재실행의 product-specific
compile/link invocation은 0이었다. Debug/Release five-module coexistence CTest는 5/5였고 각
bundle의 validator는 standard 47/47, extensive 537/537, warning/failure/crash 0이었다.

이 결과를 Windows v0.x product creation path의 근거로 사용하되 다음을 분리한다.

- Phase 1B의 strict 11-line `garak-product-spike-v1.txt`와 해당 Data Runtime은 수정하지 않는다.
- 그 descriptor는 production project, compiled data 또는 state contract로 이름만 바꾸지 않는다.
- Phase 1B Alternative B thin wrapper와 네 spike product도 regression/reference로 보존한다.
- Windows v0.x 선택은 새 ADR 0005에 한정한다. Cross-platform 최종 전략 ADR 0003은 Proposed다.

## 새 milestone 구조

기존 “다음 Phase 1C macOS portability spike” 제안은 다음 구조로 교체한다.

1. **Phase 1C — Windows Product Creation Vertical Slice**
2. **Phase 1C.1 — Product contracts and headless Windows export** — 본 계획
3. **Phase 1C.2 — Studio Product workspace and Export UX integration** — 후속 작업

macOS VST3, arm64/x86_64 Universal, AU, Developer ID signing, notarization, installer와 macOS DAW
validation은 폐기하지 않고 첫 상용 배포 전 **Cross-platform release gate**로 이동한다. Windows
결과를 그 gate의 통과로 일반화하지 않는다.

## 범위

- Unpacked directory form의 두 최소 `.garak` reference project와 strict schema v1 validation
- Versioned Product ID → processor/controller FUID derivation 및 독립 literal vectors
- `garak.gain-v1`의 fixed Gain/Bypass ID와 normalized default contract
- Formal `Garak Compiled Product Data v1` binary encoder, TypeScript decoder와 C++ strict parser
- Formal `Garak Product State v1` codec, product binding과 processor/controller restore
- Node.js built-in API만 사용하는 strict TypeScript headless Product Compiler
- Validate, inspect, compile, export CLI와 batch identity/artifact collision validation
- Separate `Garak Product Runtime v1` template module과 module-relative `product.garakbin` loader
- Product-specific moduleinfo creation, first-party structural/factory parity inspector
- Warm/Bright Debug/Release local VST3 export, validator, reproducibility와 no-native-build evidence
- 기존 다섯 module과 Warm/Bright를 함께 load하는 seven-module contract test
- Native/TypeScript quality gate와 Phase 0/1A/1B/Studio regression
- ADR 0005와 관련 architecture/status/operation 문서 동기화

## 절대 비범위

- Studio Product workspace, Export UI, Studio/native IPC와 Node native addon
- macOS VST3, Universal binary, AU, signing, notarization, installer와 updater
- Production single-file `.garak` archive 또는 ZIP container
- DSP graph, arbitrary node, macro, compressor, saturation와 BLOOM
- Custom editor, VSTGUI, JUCE, Skia, CanvasKit, Yoga, XYFlow, MIDI, sidechain와 instrument
- Preset browser, external asset, external VST repackaging, cloud/marketplace/telemetry/auth/DRM
- Cross-platform Runtime 전략 최종 선택, Alternative B 또는 Phase 1A/1B spike 삭제
- 상용 artist product, repository root license와 commercial legal approval

## Editable Garak project의 logical model

Schema v1은 정확히 다음 의미만 가진다.

| Field | 계약 |
| --- | --- |
| `schemaVersion` | integer, 정확히 `1` |
| `productId` | canonical lowercase UUID, non-nil, immutable product identity |
| `vendor` | non-empty white-label vendor, UTF-8 최대 63 bytes |
| `name` | non-empty product/bundle name, UTF-8 최대 52 bytes와 strict Windows component policy |
| `version` | prerelease/build 없는 strict `major.minor.patch`, 각 component `0..65535` |
| `category` | 정확히 `Fx` |
| `template` | 정확히 `garak.gain-v1` |
| `defaults.gainDb` | finite `-60.0..+12.0` dB |

Processor/Controller FUID, Parameter ID, path, target metadata, graph, macro, UI, asset, signing과
installer 정보는 source JSON에 넣지 않는다.

## Editable project의 현재 physical form

현재 `.garak`은 directory package이고 그 안에는 exact lowercase `product.json` 한 file만 있다.
Symlink, extra file/directory, case-variant `Product.json`과 중복 artifact는 거부한다. UTF-8 BOM은
허용하지 않고 invalid UTF-8, duplicate JSON key, unknown/missing field와 invalid type/value를
structured diagnostic으로 거부한다.

이 physical directory form은 development contract다. 향후 single-file archive를 선택해도 logical
schema와 Product ID는 장기 계약으로 유지하지만 이번 계획에서는 archive, ZIP 또는 migration
framework를 만들지 않는다.

## Product ID와 rename/clone 계약

- Product ID는 canonical lowercase UUID textual form과 그 standard textual-order 16 bytes로 표현한다.
- 같은 제품의 name/vendor/version/path 변경은 Product ID와 FUID를 바꾸지 않는다.
- Folder copy만으로 새 product가 되지 않는다. 진짜 새 product는 새 Product ID가 필요하다.
- 같은 Product ID의 renamed bundle을 동시에 유통하면 같은 FUID 충돌이 생긴다고 진단한다.
- Batch validation은 duplicate Product ID, processor/controller/cross-role FUID, case-insensitive artifact
  leaf와 normalized output path collision을 export 전에 거부한다.

Reference Product ID:

- Warm: `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e`
- Bright: `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357`

## Processor/Controller FUID derivation

Algorithm version 1은 role별 다음 byte sequence의 SHA-256 digest 첫 16 bytes다.

```text
UTF-8("garak.vst3-product-identity.v1")
+ 0x00
+ UTF-8(canonical lowercase productId)
+ 0x00
+ UTF-8("processor" | "controller")
```

표시는 digest byte order 그대로의 uppercase 32-character hexadecimal이다. SDK constructor word
order나 host integer byte order에 의존하지 않는다.

| Product ID | Role | Exact FUID |
| --- | --- | --- |
| `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` | processor | `3BA93DD6A062C97D89EC78F3652F83C4` |
| 같은 ID | controller | `00DD9000A50F7F28F4AE084CD29C4330` |
| `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357` | processor | `FCB1FDAED3D981A2AE3AE5A20898C449` |
| 같은 ID | controller | `32D933DFBD3C8110E014829EF5D62EA3` |
| `123e4567-e89b-12d3-a456-426614174000` | processor | `34041DA416A3944588F29506953A3098` |
| 같은 ID | controller | `AD919FFE93E7D3CFE766C7AED441B4A6` |

Production 함수와 test expected literal은 별도로 유지하고 Phase 1A/1B의 열 개 FUID까지 합쳐
collision 0을 검증한다.

## Parameter ID 계약

`garak.gain-v1` template 자체가 다음 ID를 부여한다.

- Gain: `1001`, continuous/automatable, normalized mapping `(-60..+12 dB)`
- Bypass: `1002`, boolean/automatable/bypass, default off

ID는 Product ID/FUID/name과 무관하고 project JSON에 저장하지 않는다. Template v1에서 변경하거나
다른 의미로 재사용하지 않는다.

## Compiled-product binary contract

`Contents/Resources/product.garakbin`은 Phase 1B descriptor와 다른 formal little-endian binary다.
Magic은 8-byte ASCII `GARAKCPD`, format은 major `1`, minor `0`이다.

### 96-byte header

| Offset | Width | Field |
| ---: | ---: | --- |
| 0 | 8 | magic `GARAKCPD` |
| 8 | 2 | major `1` |
| 10 | 2 | minor `0` |
| 12 | 4 | header size `96` |
| 16 | 4 | exact total size |
| 20 | 4 | flags, zero |
| 24 | 4 | reserved, zero |
| 28 | 16 | Product ID bytes |
| 44 | 16 | Processor FUID bytes |
| 60 | 16 | Controller FUID bytes |
| 76 | 2 | product version major |
| 78 | 2 | product version minor |
| 80 | 2 | product version patch |
| 82 | 2 | category enum, `1 = Fx` |
| 84 | 4 | template ID, `1 = garak.gain-v1` |
| 88 | 2 | vendor UTF-8 byte length |
| 90 | 2 | name UTF-8 byte length |
| 92 | 2 | parameter count, exactly `2` |
| 94 | 2 | reserved, zero |

Header 뒤에는 vendor bytes, name bytes, 그리고 numeric ID 순서의 24-byte parameter record 두 개가
온다. Record는 `uint32 id`, `uint16 type`, `uint16 flags`, IEEE-754 binary64 normalized default,
두 `uint32` zero-reserved field다. Gain은 `(id=1001,type=1,flags=1)`, Bypass는
`(id=1002,type=2,flags=3)`이다. Gain default는 `(gainDb + 60) / 72`, Bypass default는 `0.0`이다.

Vendor는 최대 63 UTF-8 bytes, product name은 VST3의 64-byte class name buffer에
`" Controller"` suffix까지 들어가도록 최대 52 bytes이고 embedded NUL/control을 금지한다. Raw struct,
padding, pointer, `size_t`, timestamp, path, machine/user/PID/random을 쓰지 않는다. Exact size, zero
reserved와 header flags, exact parameter flags, distinct non-zero FUID, exact/sorted parameter table와 no trailing byte를
전부 검증한 뒤에만 immutable product value를 commit한다.

Normative Warm fixture는 177 bytes이며 SHA-256은
`3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9`다. Byte fixture는
architecture 문서와 TypeScript/C++ independent literal test에 기록한다.

## Runtime parser contract

새 `Garak Product Runtime v1`은 loaded Windows module path에서 fixed resource
`Contents/Resources/product.garakbin`만 찾는다. Phase 1B descriptor, `product.json`, source project,
CWD, environment, registry, Studio state와 network를 읽지 않는다.

Factory 공개 전 file 전체를 bounded read하고 compiled parser를 완전히 통과해야 한다. Missing,
oversized, bad magic/version/size/UTF-8/FUID/category/template/parameter/default/reserved/trailing data는
null factory로 fail closed한다. Parsed identity/metadata/default는 module-owned immutable value이고 각
instance가 필요한 값을 복사한다. Factory 이후와 audio callback에서는 filesystem/parsing을 하지 않는다.

## Production state contract

`Garak Product State v1`은 Phase 1A/1B의 20-byte `GGS1` state를 재사용하지 않는다. Magic은
8-byte ASCII `GARAKPST`, major `1`, minor `0`, exact total 96 bytes다.

### 64-byte header와 records

| Offset | Width | Field |
| ---: | ---: | --- |
| 0 | 8 | magic `GARAKPST` |
| 8 | 2 | major `1` |
| 10 | 2 | minor `0` |
| 12 | 4 | header size `64` |
| 16 | 4 | total size `96` |
| 20 | 4 | flags, zero |
| 24 | 16 | Product ID bytes |
| 40 | 2 | parameter entry count `2` |
| 42 | 2 | entry size `16` |
| 44 | 20 | reserved, zero |

두 16-byte record는 `uint32 id`, `uint16 value type`, `uint16 flags/reserved`, IEEE-754 binary64
normalized value다. Gain `(1001,type=1)`와 Bypass `(1002,type=2)` 순서이며 Bypass value는 정확히
`0.0` 또는 `1.0`이다. Duplicate/unknown/missing/unsorted ID, product mismatch, nonfinite/range,
truncated/trailing/unsupported version/reserved data를 거부하고 prior live state를 보존한다.

Warm default state fixture SHA-256은
`ACF05182BE9A5BD474C1048C65C045F4DB8DA1A7998A3704104D156813F13924`다. Phase 1A/1B state codec과
tests는 변경하지 않는다.

## Product Compiler 구조

`tools/product-compiler/`에 Node 24가 직접 실행할 수 있는 erasable-syntax TypeScript를 둔다.
Runtime dependency는 0이며 Node built-in `fs`, `path`, `crypto`, `child_process`, `util`만 사용한다.
TypeScript/ESLint/Prettier/@types는 기존 exact version을 재사용하는 development-only dependency다.

책임은 다음처럼 분리한다.

- `strict_json`: valid UTF-8와 JSON.parse 앞의 lexical duplicate-key detection
- `project_model` / `validation`: strict source schema, Windows filename와 batch collision
- `identity`: versioned SHA-256 derivation과 UUID byte conversion
- `compiled_product`: deterministic encoder/independent decoder
- `process_runner`: executable + argument array, captured output/exit와 child log
- `moduleinfo` / `export_windows`: prebuilt tools, staging, parity와 safe replace
- `cli` / `errors`: command parsing, structured field/code/message와 no-stack user diagnostics

Product Compiler는 Electron/Studio renderer, native addon, shell command string concatenation과 hardcoded
user path를 사용하지 않는다.

## Product Compiler CLI

Root scripts는 다음 명령을 제공한다.

```text
pnpm product:validate --project <path>
pnpm product:inspect --project <path>
pnpm product:compile --project <path> --output <directory>/product.garakbin
pnpm product:export --project <path> --configuration Debug|Release --output <directory> [--force] [--validate]
```

`validate`는 file을 변경하지 않는다. Repeated `--project`를 받아 batch collision도 검사할 수 있다.
`inspect`는 logical metadata, FUID, Parameter ID와 defaults를 출력한다. `compile`은 sibling staging과
safe atomic file replace로 compiled size/hash를 출력하며 output leaf가 exact `product.garakbin`이
아니면 `GARAK_COMPILE_OUTPUT_NAME`으로 거부한다. `export`는 repository-relative prebuilt
Runtime/moduleinfotool/inspector/optional validator path를 사용한다.

일반 사용자 오류는 non-zero exit와 `{code,path,message}`가 있는 deterministic diagnostic을 쓰고
기본 stack trace를 노출하지 않는다.

## Local white-label Windows export 경로

Configuration별 prebuilt input:

```text
out/build/product-runtime-<debug|release>/VST3/<Debug|Release>/Garak Product Runtime v1.vst3
out/build/product-runtime-<debug|release>/bin/moduleinfotool.exe
out/build/product-runtime-<debug|release>/bin/validator.exe
out/build/product-runtime-<debug|release>/bin/garak_product_inspector.exe
```

Final bundle:

```text
<output>/<Product Name>.vst3/
  Contents/x86_64-win/<Product Name>.vst3
  Contents/Resources/product.garakbin
  Contents/Resources/moduleinfo.json
```

Vendor/name/version/category와 두 FUID는 project → compiled data → Runtime factory → moduleinfo에서
일치해야 한다. Garak branding을 vendor/name에 강제하지 않고 global/system/user VST3 directory에는
쓰지 않는다.

## moduleinfo 생성과 parity 검증

Staged bundle의 inner module과 compiled data를 먼저 배치하고 forward-slash absolute bundle path로
official `moduleinfotool -create`를 실행한 뒤 `-validate`한다. 새 prebuilt first-party inspector는
pinned `ModuleInfoLib`와 SDK hosting loader로 compiled data, actual factory, root/factory metadata,
정확히 processor/controller 두 class, CID/name/category/subcategory/version와 controller association을
CLI의 independent expected values에 비교한다.

Official tools에는 inner module path가 아니라 forward-slash absolute **bundle path**를 전달한다.
Supplementary-plane Windows process boundary를 위해 inspector는 `wmain`에서 UTF-16 argument를 strict
UTF-8로 변환하고 wide resource path를 사용한다. Fail-closed `LC_CTYPE=.UTF8` startup object는 inspector,
moduleinfotool과 validator에 link한다. Pinned SDK 3.8 host helper의 supplementary-plane conversion 결함은
SDK를 수정하지 않고 first-party seven-overload `StringConvert` object를 Runtime과 세 host에 link해
격리하며 factory metadata는 `PClassInfoW`를 사용한다.

Moduleinfo byte determinism을 반복 export에서 검사한다. Official tool이 byte difference를 만들면
원인을 기록하고 semantic structural equality를 별도로 증명하며 이유 없이 nondeterminism을 허용하지 않는다.

## Deterministic build/export 정책

동일 logical project는 repetition, CWD, absolute project/output path, JSON whitespace/key order와 source
timestamp와 무관하게 동일 FUID, `product.garakbin` bytes/hash를 만든다. Compiled bytes에는 timestamp,
user/machine/path/CWD/PID/random을 넣지 않는다.

Repeated export는 inner Runtime hash, compiled-data hash, moduleinfo bytes 또는 구조, exact inventory와
file size를 비교한다. Filesystem timestamp는 artifact contract가 아니다.

## Atomic output 정책

Export 순서는 validation → identity → compiled bytes → sibling staging → Runtime copy/rename → resource
write → moduleinfo create/validate → inspector parity → optional standard/extensive Validator → final safe
replace다.

Default는 existing final output을 거부한다. `--force`는 complete stage가 검증된 뒤 기존 bundle을
transaction-owned sibling backup으로 옮긴다. Compile의 stage file 또는 export의 staged bundle을 exact
final path로 rename하는 순간이 publication **commit point**다.

- Commit 전 backup 준비 또는 publication rename이 실패하면 stable code/path diagnostic으로 실패한다.
  Publication failure 뒤 rollback이 성공하면 prior final을 복구한다. Rollback도 실패하면 새 output은
  publish하지 않고 prior final이 보존된 exact transaction backup path를 distinct diagnostic으로 보고한다.
- Commit 뒤에는 새 final이 canonical success다. 빈 stage parent 또는 backup cleanup이 실패해도 final을
  rollback하거나 command를 failure로 바꾸지 않고 bounded structured `cleanupDiagnostics`를 반환한다.
- Cleanup target은 exact transaction-owned sibling prefix와 parent boundary를 다시 검증하며 unowned path를
  삭제하지 않는다.
- Invalid project, missing Runtime, tool/inspector/validator failure는 commit point 전에 끝나므로 partial
  final을 남기거나 이전 valid output을 훼손하지 않는다.

Fault matrix는 compile/export 각각의 prepublication backup, stage→final publication, rollback,
pre-commit staging cleanup과 post-commit cleanup 상태를 주입한다. 모든 pre-commit branch는 stable
deterministic code/path를, post-commit branch는 success+bounded diagnostic을 검증한다.

## No-native-build 검증

Product Runtime와 official/first-party tools를 먼저 build한다. 그 뒤 일반 PowerShell에서 Warm/Bright를
다시 export하며 `cl.exe`, `link.exe`, `cmake.exe`, `ninja.exe`, `msbuild.exe` invocation을 금지한다.

Evidence runner는 exact child executable/argument log, immutable template/build input의 size/hash/timestamp,
두 Runtime inner byte equality, 서로 다른 compiled/moduleinfo, repeated output와 official Validator 결과를
ignored `out/reports/vst3/product-runtime/`에 기록한다. Export가 호출할 수 있는 native executable은
prebuilt moduleinfotool, inspector와 optional validator뿐이다.

## Reference fixtures

| Product | Product ID | Vendor | Version | Default | Processor / Controller FUID |
| --- | --- | --- | --- | ---: | --- |
| Artist Gain Warm | `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` | Garak Test Artist | 0.1.0 | -6.0 dB | `3BA93DD6A062C97D89EC78F3652F83C4` / `00DD9000A50F7F28F4AE084CD29C4330` |
| Artist Gain Bright | `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357` | Garak Test Artist | 0.1.0 | +3.0 dB | `FCB1FDAED3D981A2AE3AE5A20898C449` / `32D933DFBD3C8110E014829EF5D62EA3` |

두 project는 `examples/products/<fixture>.garak/product.json`만 가진다. Warm/Bright Debug/Release final
artifact는 ignored `out/exports/phase-1c1/<debug|release>/` 아래에 둔다.

## 테스트와 validator matrix

### TypeScript built-in tests

- 모든 project validation failure, duplicate key/unknown field/Windows name/UTF-8 boundary
- Exact FUID literals, role/ID separation, rename/vendor/version/path/CWD independence와 collision
- Exact compiled bytes/hash/layout, malformed/trailing/duplicate parameter와 determinism
- Batch Product/FUID/name/output collision
- Atomic compile/export의 invalid project, missing Runtime, moduleinfotool/inspector/validator failure,
  no-force, pre-commit rollback/staging cleanup과 post-commit success/cleanup diagnostics

### Native tests

- Compiled data Warm/Bright와 모든 magic/version/size/UTF-8/FUID/table/default/reserved corruption
- Product State exact fixture/round trip/product binding/duplicate/unknown/corrupt/controller restore/no mutation
- Warm -6 dB, Bright +3 dB, automation, bypass, mono/stereo, Float32/Float64,
  in/out-of-place, zero-sample와 parameter-only
- Gain/Bypass ID, exact factory identity, no editor/MIDI/sidechain
- Gain/Data/Thin/Warm/Bright 7 module simultaneous load, distinct FUID/name/handle, state/instance isolation,
  interleaved process, reverse unload와 reload
- Inspector process fixture `가락 경로 📁/가락 🎛 Gain.vst3`, exact supplementary-plane metadata와
  unpaired UTF-16 surrogate fail-closed

### Build/validator

- Product Runtime Debug/Release fresh configure, clean aggregate build와 CTest
- Product Runtime Werror, clang-tidy와 전체 first-party clang-format
- Warm/Bright Debug/Release official standard/extensive, filter 없음, exit `0`, failure/crash `0`와
  warning 원문 분석
- Exact Unicode CLI export의 moduleinfo create/validate, inspector, validator standard/extensive 5/5
- Existing Gain/Data/Thin Release와 가능하면 Debug validator regression도 exit/failure/crash/warning을
  같은 기준으로 확인
- Phase 0 Native, Phase 1A, Phase 1B와 Studio regression

## 구현 또는 문서화 단계

1. [x] Phase 1B를 지정 message로 commit하고 clean baseline을 확인한다.
2. [x] 모든 사전 문서, nested instruction, Git/SDK pin, A/B source와 dependency를 조사한다.
3. [x] 본 ExecPlan을 구현 전에 작성하고 identity/data/state initial contract를 고정한다.
4. [x] ADR 0005와 normative project/identity/compiled/state architecture 문서를 작성한다.
5. [x] Minimal project fixtures와 strict TypeScript validation/identity/compiled compiler를 구현한다.
6. [x] Product Compiler CLI, tests, workspace scripts와 atomic Windows export orchestration을 구현한다.
7. [x] First-party compiled/state C++ contract와 malformed tests를 구현한다.
8. [x] Separate Product Runtime v1 processor/controller/factory/module loader와 inspector를 구현한다.
9. [x] Product Runtime presets/aggregate/CTest와 Warm/Bright Debug/Release export를 연결한다.
10. [x] Seven-module behavior/coexistence, identity/moduleinfo parity와 official validator를 통과한다.
11. [x] Reproducibility, atomic failure와 plain-PowerShell no-native-build evidence를 통과한다.
12. [x] Werror/format/tidy와 Phase 0/1A/1B/Studio regression을 재실행한다.
13. [x] README/ROADMAP/AGENTS/architecture/ADR/status와 본 plan을 실제 결과로 동기화한다.
14. [x] Git/text/link/ignore/submodule/dependency/license/forbidden-scope hygiene를 독립 감사한다.
15. [x] 모든 필수 gate를 대조하고 PASS/CONDITIONAL PASS/FAIL을 사실대로 기록한다.

## 변경 대상 파일

예상 범위이며 실제 SDK/CMake/Node behavior가 다르면 이 목록과 발견 사항을 갱신한다.

- `/package.json`, `/pnpm-workspace.yaml`, `/pnpm-lock.yaml`, `/.gitignore`
- `/tools/product-compiler/**`
- `/tools/vst3/validate_product_runtime.ps1` 또는 동일 책임의 evidence script
- `/examples/products/artist-gain-{warm,bright}.garak/product.json`
- `/CMakeLists.txt`, `/CMakePresets.json`, `/cmake/GarakOptions.cmake`
- `/native/CMakeLists.txt`, `/native/runtime/product_v1/**`
- `/native/adapters/vst3/CMakeLists.txt`, `/native/adapters/vst3/product_runtime_v1/**`
- `/native/tests/CMakeLists.txt`, Product contract/runtime/coexistence test source
- `/AGENTS.md`, `/native/AGENTS.md`, `/studio/AGENTS.md`, `/README.md`, `/ROADMAP.md`
- `/docs/adr/0003-generated-plugin-runtime-strategy.md`
- `/docs/adr/0005-windows-v0x-prebuilt-product-runtime.md`
- `/docs/architecture/minimal-garak-product-project.md`
- `/docs/architecture/product-identity-derivation.md`
- `/docs/architecture/compiled-product-data-v1.md`
- `/docs/architecture/product-state-v1.md`
- `/docs/architecture/system-overview.md`, `module-boundaries.md`, `runtime-and-export.md`,
  `parameter-and-state.md`, `dependency-policy.md`, `vst3-adapter.md`
- `/docs/status/current.md`
- `/docs/status/phase-1c1-product-fixtures.md`
- `/docs/status/phase-1c1-headless-export-validation.md`
- 본 ExecPlan

Phase 1B source/descriptor/runtime, Studio source/manifest direct dependency와 SDK source는 수정하지 않는다.

## 검증 계획

정확한 preset/target/output 이름은 구현 뒤 이 문서와 operation docs에 갱신한다.

```text
pnpm install --frozen-lockfile
pnpm product:lint
pnpm product:format:check
pnpm product:typecheck
pnpm product:test
pnpm product:validate --project examples/products/artist-gain-warm.garak
pnpm product:inspect --project examples/products/artist-gain-bright.garak
pnpm product:compile --project examples/products/artist-gain-warm.garak --output out/compiled/artist-gain-warm/product.garakbin --force

cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Debug
ctest --preset product-runtime-debug-test --no-tests=error

cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Release
ctest --preset product-runtime-release-test --no-tests=error

node tools\product-compiler\src\cli.ts export --project "out\test-fixtures\유니코드-경계.garak" --configuration Debug --output "out\exports\phase-1c1\유니코드-검증" --force --validate

cmake --preset product-runtime-werror --fresh
cmake --build --preset product-runtime-werror-build --clean-first
cmake --preset product-runtime-clang-tidy --fresh
cmake --build --preset product-runtime-clang-tidy-build --clean-first
```

Phase 0, Phase 1A, Phase 1B와 Studio canonical regression은 해당 nested AGENTS/previous ExecPlan의
full command를 재실행한다. Official validator는 Warm/Bright Debug/Release standard/extensive와
existing five product Debug/Release를 filter 없이 실행했다.

## 수용 기준

- Minimal directory `.garak`, strict schema/duplicate/unknown/filename validation과 immutable Product ID
- Exact versioned FUID algorithm/literals, rename stability, fixed Parameter ID와 collision 0
- Phase 1B descriptor와 분리된 formal/deterministic compiled binary와 strict TypeScript/C++ parser
- Product-bound formal state, processor/controller round trip와 no-partial-mutation
- Strict TypeScript, runtime third-party dependency 0, four CLI command와 structured errors
- Warm/Bright Debug/Release VST3, byte-identical Runtime, distinct data/factory/moduleinfo와 local-only output
- Product-specific compile/link 0, no-native-build evidence와 atomic failure/force preservation
- Warm/Bright standard/extensive PASS와 seven-module behavior/coexistence PASS
- Product Runtime Werror/format/tidy, TypeScript lint/format/typecheck/test와 모든 regression PASS
- ADR 0005 Accepted, ADR 0003 Proposed, Windows-only scope와 Cross-platform release gate 문서 일치
- Studio dependency 16, SDK exact/clean, VSTGUI/JUCE/forbidden scope/root LICENSE 0

필수 검증 하나라도 실행하지 못하거나 실패가 남으면 PASS가 아니라 CONDITIONAL PASS 또는 FAIL이다.

## 리스크

- Dynamic factory는 compiled data, bundle name, moduleinfo와 product project의 네-way parity를 계속
  검증해야 하며 stale template identity를 fail closed해야 한다.
- Official moduleinfo JSON5가 deterministic하지 않을 수 있으므로 byte와 structured semantic 비교를
  분리하고 원인을 기록해야 한다.
- Windows rename/backup atomicity는 same-volume directory operation을 전제로 한다. Publication rename을
  commit point로 고정했고 post-commit cleanup failure는 bounded diagnostic과 transaction-owned orphan으로
  표현한다. Studio는 이 의미를 바꾸지 않고 diagnostic 표시와 safe orphan cleanup UX를 제공해야 한다.
- Node 24 direct TypeScript execution은 project toolchain requirement다. Node version drift를 engine과
  status에 기록하고 erasable syntax만 사용한다.
- Prebuilt Runtime 재사용은 Windows v0.x 범위에서만 Accepted다. Signed macOS bundle/resource lookup,
  Universal/AU와 notarization에는 별도 evidence가 필요하다.
- SDK redistribution notice/trademark와 commercial transitive legal audit는 여전히 미완료다.
- 이 최소 Gain format을 미래 graph container로 무리하게 확장하면 schema v1의 단순성과 strict parser
  경계가 무너질 수 있으므로 현재 두 parameter 밖의 extension을 만들지 않는다.

## 최종 검증 결과

| Gate | 최종 결과 |
| --- | --- |
| Product Compiler frozen install | PASS, packages reused 171, downloaded 0 |
| Product Compiler format/lint/typecheck | PASS |
| Product Compiler tests | 36/36 PASS; atomic backup/publish/rollback/cleanup fault matrix 포함 |
| Product Runtime Debug/Release fresh + clean build | 각각 177/177 PASS |
| Product Runtime Debug/Release CTest | 각각 7/7 PASS |
| Product Runtime Werror/clang-tidy fresh + clean quality build | 각각 110/110 PASS |
| First-party Native clang-format | 58 files dry-run/Werror PASS |
| Warm/Bright official Validator | 8 runs, standard 47/47, extensive 537/537, warning/failure/crash 0, exit 0 |
| No-native-build Debug/Release | config별 child 20/20 exit 0, forbidden invocation 0, artifact tree unchanged |
| Exact Unicode Debug export | child 5/5 exit 0, exact 3 files, Runtime/compiled/moduleinfo parity PASS |
| Existing five-module validator regression | Debug 10 + Release 10 runs PASS |
| Phase 0 | Debug/Release fresh+clean, CTest 1/1, smoke, Werror/tidy PASS |
| Phase 1A | Debug/Release fresh+clean, CTest 3/3, validator와 Werror/tidy PASS |
| Phase 1B | Debug/Release fresh+clean, CTest 5/5, inspector/validator와 Werror/tidy PASS |
| Phase 1B package-only ordinary PowerShell | 4 bundles PASS, native log는 moduleinfotool 16개뿐, forbidden build command 0, build-tree diff 0 |
| Studio | Frozen install, lint/format/typecheck/build PASS, direct dependency 16 unchanged |

Final source snapshot에서 Debug/Release 각각 `--fresh` configure → `--clean-first` aggregate 177/177 →
no-native-build runner → CTest 7/7 순서로 exit 0이었다. Atomic commit-point fault matrix를 포함한 Product
Compiler 36/36도 final source에서 통과했다.

Final no-native manifests는 Debug 772 entries와 Release 641 entries이며 각각 child 20/non-zero 0,
forbidden build invocation 0, artifact tree unchanged다. Runtime은 Debug 1,755,136 bytes /
`BD9244B7B01C1EE2A3CAEA13A422D65B9A6EEFEF644DD63CE6DEB4DA7B1A4044`, Release 714,752 bytes /
`219A69676C2E62BD73A3D8C8394CD862DB3C8F94D622E6272A8502260F1EC6E6`다. Unicode Debug fixture는
compiled 181 bytes / `E19AE344DC3E73313195E889D63512F9E002A002BD3FFEA8D0691CA859399E03`,
moduleinfo 1,051 bytes / `1AFBB64A281CFAABA582D044C03589FCCC2BAD1D1D8A260DF1D3E636BD5F4935`다.

No-native-build reports는 `out/reports/vst3/product-runtime/no-native-build-{debug,release}.json`, product
validator 요약은 `out/reports/vst3/product-runtime/product-validator-summary.json`, exact artifact는
`out/reports/vst3/product-runtime/artifact-summary.json`에 있다. Phase 1B package-only final evidence는
`out/reports/vst3/runtime-strategy/package-only-rerun/attempt-3/package-only-evidence.json`이다. `out/`은
ignored local evidence이고 tracked source contract는
[fixture status](../docs/status/phase-1c1-product-fixtures.md)와
[validation status](../docs/status/phase-1c1-headless-export-validation.md)에 기록했다.

## 발견 사항

- 2026-08-09: Phase 1B는 시작 시 uncommitted였고 사용자 지시에 따라 43-file change를 baseline
  `4203138f13a83e652c04405061fcd2c2ec362c27`로 commit했다. 이후 tree가 clean임을 확인했다.
- 2026-08-09: Git-for-Windows의 `git submodule status --recursive`는 이 runner에서 sh signal-pipe
  error를 낼 수 있다. Root gitlink와 각 repository의 `rev-parse`, detached branch, porcelain status를
  직접 대조해 superproject/nested 7개 exact/clean을 확인했다.
- 2026-08-09: Phase 1B의 moduleinfo root Name은 Windows backslash path에서 비어 버릴 수 있었으므로
  Product Compiler도 official tool에 forward-slash absolute bundle path를 전달하고 root identity를
  independent inspector로 확인해야 한다.
- 2026-08-09: Existing Studio manifest는 runtime 2 + development 14 = direct 16이며 Product Compiler의
  separate workspace가 추가되어도 이 manifest를 변경하지 않는다.
- 2026-08-10: First Product Compiler test는 pnpm의 non-TTY modules removal prompt 때문에 test 시작 전에
  중단됐고 sandbox frozen install은 60초 이상 정지해 종료했다. `CI=true`인 승인 환경에서 frozen
  install을 완료한 뒤 당시 초기 suite의 format/lint/typecheck와 27/27 test를 통과했다.
- 2026-08-10: Compiler audit에서 physical `.garak` suffix case alias가 Windows path lookup으로 우회될
  수 있음과 identity independence test가 production 값을 다시 사용한다는 점, Bright exact hash literal
  부재를 찾았다. Actual parent entry case 확인과 독립 mutation/literal test를 추가해 해당 intermediate
  compiler checkpoint를 다시 통과했다.
- 2026-08-10: `product:compile` CLI smoke는 product-name leaf output을
  `GARAK_COMPILE_OUTPUT_NAME`으로 거부했고 exact `product.garakbin` leaf에서 PASS했다. CLI usage와
  canonical compiled-artifact boundary를 이 실제 동작에 맞췄다.
- 2026-08-10: Initial Debug loaded Runtime test는 second Warm `IPtr`가 module unload 뒤까지 살아 있어
  destructor가 unloaded vtable을 호출하며 segfault했다. 모든 instance를 reverse unload 전에 release하도록
  test lifetime을 수정하고 Debug/Release CTest 7/7을 다시 통과했다.
- 2026-08-10: Clang-tidy는 enum wire-width/default, constructor/helper parameter order, narrowing test,
  SDK seek override와 array comparison을 두 차례 진단했다. On-wire raw width를 narrowing 전에 검증하고
  code/tests를 정리했다. Unicode contract test에서 추가 세 warning을 수정한 뒤 final full fresh/clean
  clang-tidy 110/110을 통과했다.
- 2026-08-10: Initial no-native-build manifest는 Windows directory mtime lazy update 때문에 file change가
  없는데도 146개 directory를 changed로 보고했다. Directory inventory는 비교하되 directory mtime만
  제외하고 모든 file path/size/hash/mtime 비교를 유지한 뒤 Debug/Release evidence를 다시 실행해
  artifact tree unchanged를 얻었다.
- 2026-08-10: Final product validator raw-report를 만드는 첫 inline wrapper가 bundle argument를 누락해
  help output으로 intended report를 덮어썼다. Standard/extensive argument를 명시해 최종 8 runs를 다시
  수집했으며 첫 help run은 PASS evidence에 포함하지 않았다.
- 2026-08-10: Phase 1B package-only rerun attempt 1은 empty collection binding 때문에 첫 package 전,
  attempt 2는 Debug Alpha 뒤 OrderedDictionary aggregation 때문에 종료됐다. 두 실패를 final report의
  `priorFailures`에 보존했다. Attempt 3는 ordinary PowerShell 5.1에서 four bundle, exact inventory,
  template/descriptor hash, moduleinfo, native command log와 Debug 402 files/360 directories 및 Release
  305 files/360 directories 전후 diff 0을 검증해 PASS했다.
- 2026-08-10: Atomic final audit에서 stage→final rename의 raw filesystem `Error`가 structured-error
  contract를 위반하고 rollback double failure와 구분되지 않음을 발견했다. Compile/export rename을
  explicit commit point로 두고 backup 준비, publication, rollback과 pre-commit staging cleanup failure에
  stable deterministic code/path를 부여했으며 rollback 실패에서는 prior output이 보존된 backup path를
  보고한다. Post-commit stage/backup cleanup failure는 valid final 성공과 bounded
  `cleanupDiagnostics`를 반환한다. 전체 fault matrix를 포함한 final Product Compiler suite 36/36을
  통과했다. Phase 1C.2에는 diagnostics surfacing과 transaction-owned orphan cleanup UX만 남겼다.
- 2026-08-10: 최초 Unicode proof는 inner module path만 확인해 project/output/bundle/metadata와 official
  process boundary를 함께 증명하지 못했고 `PClassInfo2` metadata는 supplementary-plane text를 mojibake로
  만들었다. 첫 exact Unicode export도 moduleinfo UTF-8 검증에서
  `GARAK_EXPORT_MODULEINFO_UTF8`로 fail closed했다. Inspector `wmain` strict conversion, wide resource
  path, `PClassInfoW`, fail-closed `.UTF8` host locale와 SDK source를 건드리지 않는 first-party
  seven-overload conversion object를 적용했다. 첫 sandbox CLI는 child spawn `EPERM`이었고 승인 환경에서
  exact command를 다시 실행해 5/5 exit 0, exact 3 files와 independent hash/FUID parity를 통과했다.

## 의사결정 로그

- 2026-08-09: 현재 Windows v0.x product path는 Phase 1B Alternative A evidence를 사용하고 새 ADR 0005에
  범위를 한정한다. Alternative B를 제거하거나 ADR 0003의 cross-platform 상태를 바꾸지 않는다.
- 2026-08-09: `.garak` physical form은 exact one-file directory package로 두고 single-file container는
  미결정으로 유지한다.
- 2026-08-09: Product ID를 identity root로 두고 versioned namespace SHA-256의 첫 16 digest bytes를
  explicit FUID bytes로 사용한다.
- 2026-08-09: Compiled data는 graph-ready container가 아니라 exact Gain template를 위한
  `GARAKCPD` v1 binary로, state는 product-bound `GARAKPST` v1 fixed binary로 분리한다.
- 2026-08-09: Product Compiler runtime은 Node built-in만 쓰고 project schema/compiled encoder는
  first-party TypeScript로, Runtime parser/state는 first-party C++로 각각 conformance test한다.
- 2026-08-09: Product export는 prebuilt moduleinfotool/inspector/validator만 실행하며 compiler/linker와
  system/global VST3 installation을 허용하지 않는다.

## 완료 기록

Phase 1C.1은 **Complete / PASS (Windows x64)**다. Strict one-file `.garak` project, Product ID 기반
identity, deterministic `GARAKCPD` v1, product-bound `GARAKPST` v1, headless TypeScript Product Compiler,
prebuilt Product Runtime v1, atomic local export와 inspector/validator/no-native-build 경로를 가장 작은
Gain/Bypass vertical slice로 구현했다. Warm/Bright Debug/Release artifact, seven-module coexistence,
supplementary-plane Unicode process boundary, Product/Native quality, Phase 0/1A/1B/Studio regression과
repository hygiene가 모두 위 수용 기준을 충족했다.

Phase 1C.1 변경은 baseline commit 이후 의도적으로 uncommitted이고 Phase 1C.2 code는 만들지 않았다.
macOS/AU/Universal/signing/notarization/installer/실제 DAW 및 commercial/legal 검증은 수행하지 않았으며
이 PASS로 일반화하지 않는다. ADR 0005는 Windows x64 v0.x 범위에서만 Accepted이고 ADR 0003은 계속
Proposed다.

## Phase 1C.2 진입 조건과 다음 단계

Phase 1C.1의 모든 project/identity/compiled/state/compiler/export/validator/atomicity/no-native-build 및
regression 수용 기준이 PASS이고 status/architecture가 실제 결과와 일치할 때만 다음 하나를 제안한다.

`Phase 1C.2 — Garak Studio Product Workspace and Export UX`

Phase 1C.2는 이 계획에서 구현하지 않는다. macOS/AU/signing/notarization은 Phase 1C.2의 대체물이
아니며 첫 상용 배포 전 Cross-platform release gate로 남는다. Studio는 headless transaction contract를
다시 정의하지 않고 `cleanupDiagnostics` surfacing과 transaction-owned orphan cleanup UX만 더한다.
