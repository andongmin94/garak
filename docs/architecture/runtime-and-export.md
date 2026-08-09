# Garak Runtime and Export

- 문서 상태: Phase 1C.2 Studio Product workflow 경계 반영
- 최종 갱신: 2026-08-12
- 권위 범위: compiled runtime contract, product compilation/export 단계와 generated runtime 전략 평가 기준
- 관련 문서: [v0.1 제품 요구사항](../product/v0.1-prd.md), [시스템 개요](system-overview.md), [프로젝트 모델](project-model.md), [모듈 경계](module-boundaries.md), [Realtime과 quality](realtime-and-quality.md), [Minimal Garak Product Project](minimal-garak-product-project.md), [Product Identity Derivation](product-identity-derivation.md), [Compiled Product Data v1](compiled-product-data-v1.md), [Product State v1](product-state-v1.md), [ADR 0003 — Proposed](../adr/0003-generated-plugin-runtime-strategy.md), [ADR 0004](../adr/0004-windows-macos-and-plugin-formats.md), [ADR 0005 — Windows v0.x Accepted](../adr/0005-windows-v0x-prebuilt-product-runtime.md), [ADR 0006 — Studio workflow](../adr/0006-studio-product-workflow-boundary.md)

## 문서의 역할

이 문서는 validated `.garak` project가 independent native plugin package가 되는 흐름과 generated runtime이 지켜야 하는 format-neutral 계약을 정의한다. Phase 1C.1은 Studio UX보다 먼저 실행 가능한 headless Windows VST3 export 경계를 만들며, Phase 1C.2 Studio는 이 경로를 호출하는 authoring/product workspace가 된다.

Windows x64 VST3 v0.x의 결합 방식은 [ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)가
prebuilt Product Runtime plus product data로 Accepted했다. 이 결정 밖의 macOS VST3/AU와 장기
cross-platform 전략은 아래 A/B를 계속 비교하며 선택 권위는 **Proposed** 상태의
[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)에 있다. Windows 국소 결정과 전역 미결정을
서로 대체하거나 일반화하지 않는다.

## Runtime의 제품 계약

Generated Plugin Runtime은 한 제품의 compiled definition을 native host 안에서 실행한다.

- Compiled DSP schedule, buffer plan과 latency를 준비하고 처리한다.
- Public parameter automation, macro mapping, smoothing, bypass와 state restore를 수행한다.
- Product의 native interface scene과 control/meter binding을 실행한다.
- Product metadata, preset과 asset을 target package에서 찾고 검증한다.
- Format adapter를 통해 host의 lifecycle, audio/event, parameter, state와 editor contract를 받는다.

Runtime은 `.garak` authoring editor, Studio workspace, cloud service 또는 arbitrary scripting environment를 포함하지 않는다. 생성 제품의 audio processing, UI, preset과 state restore는 Studio와 network 없이 오프라인에서 작동해야 한다.

## Authoring project와 runtime artifact

`.garak`은 editable source of truth이고 compiled runtime data는 특정 compiler/runtime contract를 위한 derived artifact이다. Export는 source project를 plugin bundle에 그대로 넣는 과정이 아니라 authoring-only 정보와 runtime에 필요한 의미를 검증하여 target-independent product definition으로 낮추는 과정이다.

Phase 1C.1의 minimal source는 unpacked `.garak` directory와 그 안의 exact `product.json` 하나다.
현재 schema는 `garak.gain-v1`의 product ID, vendor/name/version과 Gain/Bypass default만 표현한다.
Canonical key, validation과 Windows name 제한은
[Minimal Garak Product Project](minimal-garak-product-project.md)가 소유한다. General graph, scene,
preset와 asset을 아직 이 minimal schema에 placeholder로 추가하지 않는다.

Compiled runtime data는 최소한 다음을 가능하게 해야 한다.

- data schema/contract version 식별
- product/plugin identity 확인
- required runtime capability와 node implementation version 확인
- graph schedule, buffer/latency와 parameter/macro definition 로드
- interface scene, preset, asset와 metadata reference 검증
- incompatible, newer 또는 corrupt artifact를 설명 가능한 오류로 거부

Phase 1C.1의 compiled subset은 first-party fixed binary인 `GARAKCPD` v1이며 exact layout과
module-relative resource path `Contents/Resources/product.garakbin`은
[Compiled Product Data v1](compiled-product-data-v1.md)이 소유한다. Phase 1B Alternative A의
11-line ASCII `garak-product-spike-v1.txt`는 별도 private fixture이고 production data로 rename, parse,
migrate 또는 fallback하지 않는다. General graph/interface data의 후속 container, compression,
integrity/signing 방식은 아직 미결정이다.

## Product compilation pipeline

아래 단계는 논리적 순서이며 하나의 process, executable 또는 build target을 뜻하지 않는다.

1. **Project load와 schema handling**
   - `.garak` container와 schema version을 확인한다.
   - 지원되는 이전 project라면 명시적 migration을 수행한다.
2. **Project-level validation**
   - Product/plugin identity, metadata, graph, mapping, scene, preset와 asset reference를 검증한다.
3. **Sound compilation**
   - Typed graph와 node implementation version을 확인한다.
   - Execution ordering, buffer plan과 latency propagation을 계산한다.
4. **Control/state compilation**
   - Public/internal parameter, macro curve/range, smoothing configuration와 preset definition을 runtime 표현으로 낮춘다.
5. **Interface compilation**
   - Authoring-only scene state를 제외하고 native runtime scene, interaction와 binding을 만든다.
6. **Product assembly**
   - Runtime data, metadata, preset, asset와 필요한 notices를 하나의 제품별 input set으로 만든다.
7. **Runtime packaging**
   - Windows x64 VST3 v0.x는 ADR 0005에 따라 prebuilt Runtime과 product data를 결합한다.
   - 다른 target은 ADR 0003이 해결되기 전 A/B 어느 쪽도 기본값으로 가정하지 않는다.
8. **Format/platform packaging**
   - Target adapter가 class identity, binary architecture, bundle layout와 format metadata를 적용한다.
9. **Validation과 evidence**
   - Package structure, 금지 runtime 부재와 official validator/first-party inspector 결과를 기록한다.
   - 실제 DAW, signing과 installation evidence는 첫 상용 배포 전 release gate에서 별도로 기록한다.

앞 단계의 실패를 fallback package로 우회하지 않는다. Export 결과는 성공 산출물과 diagnostic을 명확히 구분하고, partial/corrupt package를 완성 제품으로 보고하지 않아야 한다.

### Phase 1C.1 headless Windows slice

현재 최소 경로는 Studio/Electron 없이 다음 순서를 한 headless Product Compiler에서 수행한다.

1. Unpacked `.garak` directory와 exact `product.json`을 bounded, strict, fail-closed 규칙으로 읽는다.
2. Canonical Product ID에서 processor/controller FUID를 deterministic하게 derive한다.
3. Validated logical model만 canonical `GARAKCPD` v1 bytes로 compile한다.
4. Configuration에 맞는 prebuilt `Garak Product Runtime v1.vst3` template을 staging directory로
   copy/rename한다. Product별 C++ source generation, compilation 또는 linking은 하지 않는다.
5. `product.garakbin`과 product-specific `moduleinfo.json`을 배치하고 compiled data, actual factory와
   package metadata의 identity를 대조한다.
6. 요청된 official validator/first-party inspector가 모두 성공한 뒤 완성된 sibling stage를 exact final
   path로 rename해 atomic하게 publish한다. 이 rename이 publication commit point다. Commit 전 실패는
   prior final rollback과 staging cleanup 뒤 실패하고, commit 뒤 cleanup 실패는 valid publication 성공과
   bounded cleanup diagnostic으로 반환한다.

Compiler는 source timestamp, absolute path, CWD, output directory, user/machine과 random value를
compiled bytes에 넣지 않는다. Source와 compile/inspect/export는 별도 command boundary를 가져
Studio가 같은 headless entry point를 재구현 없이 호출할 수 있어야 한다.

### Publication commit point와 cleanup

Compile과 export는 output parent와 같은 volume의 transaction-owned sibling stage/backup만 사용한다.
Default는 existing final을 거부하고 `--force`일 때만 기존 final을 owned backup으로 rename한다.

- Compile stage file 또는 fully validated staged bundle을 exact final path로 rename하는 순간이 commit
  point다.
- Publication rename이 commit 전에 실패하면 owned backup을 final로 되돌리고 stage를 정리한 뒤 실패를
  반환한다. Backup 준비가 실패하면 prior final은 제자리에 남는다. Rollback 자체가 실패하면 새 output은
  publish하지 않고 prior final이 남은 exact owned backup path를 distinct diagnostic으로 반환한다.
- Commit 뒤 새 final은 canonical success다. 빈 stage parent나 backup cleanup이 실패해도 final을 rollback
  또는 failure로 바꾸지 않고 bounded structured `cleanupDiagnostics`를 성공 결과에 포함한다.
- Pre-commit diagnostic은 backup 준비, publication, rollback과 staging cleanup phase를 구분하는 stable
  code/path를 가지며 underlying error detail은 bounded한다. Post-commit `cleanupDiagnostics`도 stage와
  backup cleanup을 구분한다. 남은 path는 transaction-owned prefix와 parent boundary 안에만 있다.
- Cleanup은 owned sibling boundary를 다시 확인하고 collision이 있는 unowned staging/backup path를
  덮어쓰거나 삭제하지 않는다.

Stable taxonomy는 compile의 `PREPUBLISH_BACKUP`/`compile.publish.backup`, `PUBLISH`/
`compile.publish`, `PUBLISH_ROLLBACK`/`compile.publish.rollback`, `PRE_COMMIT_CLEANUP`/
`compile.cleanup.stage`, post-commit `POST_COMMIT_CLEANUP`/`compile.cleanup`이다. Export는 같은
`PREPUBLISH_BACKUP`/`export.publish.backup`, `PUBLISH`/`export.publish`, `PUBLISH_ROLLBACK`/
`export.publish.rollback`, `PRE_COMMIT_CLEANUP`/`export.cleanup.stage`와 post-commit
`POST_COMMIT_STAGE_CLEANUP`/`export.cleanup.stage`, `POST_COMMIT_BACKUP_CLEANUP`/
`export.cleanup.backup`을 사용한다. 모든 code에는 `GARAK_COMPILE_` 또는 `GARAK_EXPORT_` prefix가 붙는다.

Phase 1C.1 fault matrix는 compile/export의 backup 준비, publication, rollback과 cleanup 상태를 검증한다.
Phase 1C.2 Studio는 이 commit 의미를 다시 구현하거나 바꾸지 않고 diagnostic을 사용자에게 표시하고
transaction-owned orphan을 안전하게 정리하는 UX만 제공한다.

### Phase 1C.2 Studio authoring boundary

Studio Product workspace는 headless path의 별도 frontend이지 두 번째 compiler/exporter가 아니다.

1. Renderer는 vendor, name, version과 Gain default의 editable draft만 다룬다. Product ID, physical path,
   category/template와 cleanup target은 main-owned session/capability다.
2. Sandboxed preload는 new/open/validate/save/export/cleanup의 fixed typed methods만 노출한다. Raw IPC,
   generic invoke/send, Node/filesystem/shell/process를 renderer에 제공하지 않는다.
3. Electron main은 callable Product Compiler workflow를 직접 호출한다. CLI text output을 parse하거나
   native addon/별도 compiler subprocess를 만들지 않는다.
4. Project create/save는 compiler-owned canonical serializer와 whole-directory atomic transaction을
   사용한다. Invalid draft, Product ID mismatch와 external revision conflict는 mutation 전에 거부한다.
5. Export는 disk의 saved project를 다시 읽고 main-owned output dialog와 explicit overwrite confirmation을
   거친 뒤 validator를 포함한 canonical export를 호출한다.
6. Success result의 identity/hash/inventory/child exit와 `cleanupDiagnostics`를 그대로 표시한다. Cleanup은
   main이 보관한 opaque ID를 compiler-owned revalidation 함수에 전달하며 arbitrary path deletion API를
   만들지 않는다.

상세 process/security 결정은 [ADR 0006](../adr/0006-studio-product-workflow-boundary.md)이 소유한다.
Repository-local prebuilt Runtime tree를 소비하는 현재 Windows workflow는 installed Studio의
resource/installer layout을 결정하지 않으며 missing artifact에는 structured failure로 fail closed한다.

### Windows Unicode export boundary

Project vendor/name와 output/bundle path는 valid UTF-8 contract이고 Windows system ACP에 의미를 맡기지
않는다. Headless CLI가 받은 relative path는 resolve한 뒤 official moduleinfotool/validator와 first-party
inspector에 forward-slash absolute **bundle path**로 전달한다. Inner module path만 넘겨 bundle identity를
우회하지 않는다.

Native adapter는 inspector `wmain`의 strict UTF-16→UTF-8 conversion, wide resource path,
`PClassInfoW` factory metadata와 fail-closed `.UTF8` host process locale을 사용한다. Pinned VST3 SDK 3.8의
supplementary-plane host conversion 결함은 third-party checkout을 수정하지 않고 first-party
seven-overload `StringConvert` object를 Runtime과 inspector/moduleinfotool/validator에 link해 격리한다.
Unpaired surrogate, invalid UTF-8 moduleinfo 또는 locale setup failure는 fallback/replace 없이 fail
closed한다. Exact Windows fixture와 검증 결과는
[Phase 1C.1 validation](../status/phase-1c1-headless-export-validation.md)이 기록한다.

## Runtime lifecycle

정확한 API 이름은 미정이지만 lifecycle 의미는 다음 경계를 가져야 한다.

### Load와 validation

Runtime data schema, product identity, node capability, preset와 asset을 확인한다. Parsing, migration, filesystem access와 allocation은 audio process callback 밖에서 수행한다.

### Prepare

Sample rate, block size, channel layout와 host configuration에 맞춰 memory, audio buffer, execution schedule, converter, smoothing과 communication storage를 준비한다. Unsupported configuration은 activation 전에 diagnostic으로 거부해야 한다.

### Process

Prepared schedule만 실행하고 graph structure를 변경하지 않는다. Allocation, blocking, file/network I/O, parsing, GUI call, 파일 로그와 exception propagation을 금지한다. 정확한 계약은 [Realtime과 quality](realtime-and-quality.md)가 권위를 가진다.

### State와 editor

Format adapter는 host state 및 editor lifecycle을 first-party contract로 번역한다. State parsing/migration은 callback 밖에서 하고 validated value snapshot만 realtime 경계로 전달한다. Phase 1C.1 Runtime은 exact `GARAKPST` v1 state를 loaded Product ID에 bind하고 전체 snapshot을 validate한 뒤에만 commit한다. Phase 1A/1B의 20-byte `GGS1` state는 기존 spike에만 남으며 새 Runtime의 migration/fallback input이 아니다. UI는 audio callback을 직접 호출하지 않는다.

## Generated package 불변식

- Product는 영구 product ID와 plugin class ID를 유지한다.
- Package는 target format과 CPU architecture가 요구하는 native binary/bundle이다.
- Generated plugin은 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 포함하지 않는다.
- 기본 audio processing, native UI, preset과 state restore는 Garak Studio와 network 없이 동작한다.
- Product UI와 metadata에 의무적인 Garak branding을 넣지 않는다.
- 서로 다른 Garak 제품이 같은 시스템에 설치되어도 identity와 resource가 충돌하지 않아야 한다.
- Package에 포함되는 third-party code, asset와 notice는 해당 재배포 정책을 만족해야 한다.

White-label, 판매와 Garak Runtime 재배포의 법적 권리는 아직 제품·사업 정책 가설이다. Architecture가 license grant를 대신하지 않는다.

## Runtime packaging 대안

### 대안 A — Prebuilt 범용 Garak Runtime에 product data 삽입

미리 빌드한 범용 native runtime을 target별로 준비하고 export 시 product-specific compiled data와 metadata를 runtime이 읽을 수 있는 위치에 삽입한다.

가능 이점은 제품 export 때 native compile/link 작업을 줄이고, 한 번 검증한 Runtime binary를 재사용하며,
제품별 차이를 data와 resource로 제한할 수 있다는 점이다. Phase 1B Windows x64 spike는 동일 inner
binary를 두 제품에서 재사용하고 product packaging 때 native compile/link가 0인 bounded 사례를
측정했다. Production data, 여러 target과 대규모 export에 대한 일반 주장은 아직 측정되지 않았다.

검증할 위험:

- Plugin class identity와 format registration을 제품별로 안전하게 변경하는 방법
- Binary/resource 수정이 code signing와 notarization에 미치는 영향
- 여러 제품의 side-by-side installation과 cache/host discovery
- 범용 runtime이 불필요한 capability와 크기를 포함할 가능성
- 어느 resource 위치와 container가 format validator 규칙을 만족하는지

### 대안 B — Product별 thin native wrapper 생성 후 공통 Runtime과 link

Export가 제품 identity와 target integration을 담은 얇은 native wrapper를 생성하고 공통 Garak Runtime과 link하여 제품별 native binary/package를 만든다.

가능 이점은 class registration과 product metadata를 build input으로 명시하고, 제품별 capability를
줄이며, native signing/notarization pipeline에 맞추기 쉬울 수 있다는 점이다. Phase 1B Windows x64
spike는 두 thin factory wrapper의 제품별 compile/link와 artifact delta를 측정했다. macOS,
signing/notarization과 production scale에 대한 일반 주장은 아직 측정되지 않았다.

검증할 위험:

- Studio export 환경에 compiler/linker와 SDK를 안정적으로 공급해야 하는 복잡성
- 제품별 build 시간, cache와 reproducibility
- Generated source surface와 diagnostic/support 부담
- 공통 Runtime을 static/dynamic 중 어떻게 link하고 배포할지
- Windows/macOS 및 Universal binary toolchain 차이

### 현재 결정 상태

Windows x64 VST3 v0.x는 **대안 A를 Accepted**했고 세부 결정은 ADR 0005가 소유한다. Phase 1B의
bounded evidence는 [runtime strategy artifact 상태](../status/phase-1b-runtime-strategy-artifacts.md)와
[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)에 남는다. Alternative B와 네 Phase 1B
product는 cross-platform 비교 및 regression/reference로 보존하지만 Windows canonical exporter의
fallback은 아니다.

macOS VST3/AU와 장기 cross-platform 결합은 여전히 **미결정**이다. 대안 결합, 제3안 또는 범위 조정이
필요하면 ADR 0003 또는 후속 ADR에서 먼저 결정한다.

## VST3 runtime strategy spike

첫 Windows x64 VST3 비교 spike는 Phase 1B에서 Gain/Bypass와 state contract, 제품별 identity,
same-process coexistence, package/build delta와 official validator를 사용해 완료했다. Phase 1B
descriptor와 20-byte state는 기술 fixture로 그대로 격리한다. ADR 0005의 Windows v0.x 선택은 이
fixture를 production schema로 승격하지 않는다. 다음 항목 중 실제 DAW, installation과
cross-platform/signing 질문은 계속 별도 검증 대상이다.

- Stable class ID registration과 product별 identity
- Official validator 및 실제 host에서 load/process/state round trip
- Product data와 asset의 bundle 위치 및 corruption detection
- 여러 생성 제품의 side-by-side install
- Export/build time, package size와 reproducibility
- Runtime/compiler version mismatch diagnostic
- Crash/failure isolation과 partial export 처리
- 이후 macOS universal, signing/notarization과 AU 추가 가능성
- Studio가 없는 offline system에서의 operation
- Package에 금지된 JavaScript runtime이 없음을 검사하는 방법

Spike 결과는 재현 명령, tool/SDK version, package 구조, validator output과 실패를 기록해야 한다. 한 대안이 단지 먼저 작동했다는 이유만으로 장기 전략을 채택하지 않고 두 대안의 동일한 수용 항목을 비교한다.

## Product milestone과 release gate

현재 제품 제작 순서:

1. Phase 1C.1 — Product Contracts and Headless Windows VST3 Export — 완료
2. Phase 1C.2 — Studio Product Workspace and Export UX — 완료
3. Phase 2 — Project Evolution and Persistent Migration — 다음 milestone
4. 후속 product capability를 단계적으로 구현한 뒤 첫 상용 배포 전 cross-platform release gate

첫 상용 목표:

- Windows VST3
- macOS Universal VST3
- macOS AU

Release gate는 macOS arm64/x86_64와 Universal VST3, macOS AU, signing/notarization, installer와
Windows/macOS 실제 DAW 검증을 포함한다. Windows VST3 결과는 전체 v0.1 format 또는 commercial-ready package 수용이
아니다. macOS를 현재 Windows 제품 제작의 선행 병목으로 두지는 않지만 범위에서 제거하거나 Windows
결과로 일반화하지 않는다. 플랫폼/format 결정의 권위는
[ADR 0004](../adr/0004-windows-macos-and-plugin-formats.md)에 둔다.

Windows x64 VST3에는 Phase 1A에서 admission한 exact SDK pin을 사용한다. 그 사실이 macOS VST3,
다른 adapter 범위, commercial redistribution 또는 전체 legal review의 승인은 아니다. 각 범위의
license, redistribution, API와 validator 적합성은 [의존성 정책](dependency-policy.md)에 따라 검증한다.

## Validation layers

Export 성공을 한 단계의 boolean으로 축소하지 않는다.

| 층 | 필요한 증거 |
| --- | --- |
| Project | Schema, identity, graph, mapping, scene, preset와 asset validation |
| Compile | Schedule, buffer/latency, node/runtime capability와 binding validation |
| Package | Target layout, architecture, metadata, resource와 dependency inspection |
| Format | 해당 target의 official validator 결과 |
| Host | 실제 DAW에서 load, processing, automation, bypass, editor와 state smoke test |
| Independence | Studio/network 없이 offline operation, 금지 runtime 부재 |
| Compatibility | 지원 schema/node/state fixture의 migration과 restore 결과 |

Validator를 실행하지 않았거나 host/version이 기록되지 않았다면 통과했다고 보고하지 않는다. Signing/notarization이 아직 준비 단계라면 unsigned technical artifact와 commercial-ready package를 명확히 구분한다.

## Version와 compatibility

Runtime/export 영역은 다음 version을 구분한다.

- Product release version
- `.garak` project schema version
- Node implementation version
- Compiled runtime data contract version
- Preset/DAW state schema version
- Runtime binary/compiler compatibility

한 version을 다른 version의 대용으로 사용하지 않는다. Released `.garak`, preset과 DAW state는 선언된 지원 범위에서 명시적 migration을 제공한다. Compiled data는 source project에서 재생성 가능한 derived artifact이므로 무기한 migration할지, compatible compiler로 rebuild할지, 또는 거부할지는 별도 정책으로 정한다.

Obsolete 내부 compiler API, adapter, generated wrapper template 또는 pre-release binary ABI는 compatibility shim으로 보존하지 않는다. Persistent data migration은 입력 경계에서 현재 canonical contract로 변환하며 obsolete runtime path를 계속 실행하는 방식으로 구현하지 않는다.

## 현재 경로가 정하지 않는 것

- macOS VST3/AU와 장기 cross-platform runtime packaging 전략
- `GARAKCPD` v1 minimal subset 이후 general graph/interface runtime data container
- VST3/AU adapter 구현 dependency
- Static/dynamic linking 방식과 binary partition
- macOS/AU package resource layout와 signing 위치
- 정확한 OS/DAW/validator version matrix
- CPU, latency, memory, package size와 export-time threshold

## Open Questions

- macOS VST3/AU의 서명 가능한 package 안에서 product data를 어디에 둘 것인가?
- Compiler/runtime/data version mismatch를 어떤 compatibility matrix로 판단할 것인가?
- Windows에서 정한 Product ID 의미를 macOS VST3와 AU class identity에 어떻게 안정적으로 적용할 것인가?
- macOS Universal binary와 AU packaging에 필요한 build/signing toolchain을 Studio가 어떻게 제공할 것인가?
- Export diagnostic과 partial artifact를 어떤 구조로 보존할 것인가?
- Factory preset, user preset와 asset packaging 경계를 어디까지 export가 소유할 것인가?
- Generated runtime redistribution와 third-party notices를 실제 license가 어떻게 허용할 것인가?

Windows v0.x 범위를 넘어서는 질문은 cross-platform release gate, dependency/license 검토와 packaging
prototype evidence 뒤 ADR 또는 구현 ExecPlan에서 결정한다. 완료된 Phase 1C.2는 headless
compiler/export contract를 바꾸지 않고 Studio Product Workspace와 Export UX를 연결했다. Atomic
publication에 대해서는 `cleanupDiagnostics` 표시와 transaction-owned orphan cleanup UX만 추가했으며,
다음 milestone인 Phase 2는 이 검증된 project lifecycle 위에서 project evolution과 persistent migration을
다룬다.
