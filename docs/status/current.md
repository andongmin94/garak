# Garak Current Status

- 기준일: 2026-08-12
- 현재 milestone: Phase 1C — Windows Product Creation Vertical Slice
- Phase 0A 판정: **PASS / Complete**
- Phase 0B 판정: **PASS / Complete**
- Phase 1A 판정: **PASS / Complete**
- Phase 1B 판정: **PASS / Complete (Windows x64 spike)**
- Phase 1C.1 판정: **PASS / Complete (Windows x64 headless export)**
- Phase 1C.2 판정: **PASS / Complete (Windows x64 repository-local Studio workflow)**
- Phase 1 전체 판정: **PASS / Complete**
- 정확한 다음 제안: **Phase 2 — Project Evolution and Persistent Migration**

## 요약

Garak은 Windows x64에서 minimal directory `.garak` project를 Studio Product workspace로 만들고 열고
편집하고 검증하고 atomic 저장한 뒤, configuration별 prebuilt Product Runtime을 사용해 product-specific
C++ compile/link 없이 white-label VST3로 export하는 vertical path를 갖는다. Studio와 CLI는 동일한
Product Compiler validation, canonical serialization, project transaction과 export 구현을 사용한다.

Renderer에는 Node, filesystem, shell, process, raw IPC 또는 arbitrary path mutation 권한이 없다. Electron
main이 native dialog, trusted sender와 opaque document/output/cleanup capability를 소유하고 preload는 fixed
typed API만 노출한다. Generated plugin에는 Studio, Electron, Chromium, Node.js 또는 JavaScript runtime이
포함되지 않는다.

Phase 1C.2 final evidence는 Product Compiler quality와 52/52 test, Studio quality와 10/10 test, production
build, bounded Electron launch, actual ProductService Debug/Release lifecycle/export와 Phase 1C.1 Product
Runtime Debug/Release fresh/clean 177/177·no-native-build·CTest 7/7 regression이다. Exact 결과는
[Phase 1C.2 validation](phase-1c2-studio-product-workspace-validation.md)에 기록한다.

이 Windows PASS는 macOS/AU, 실제 DAW, signing/notarization, installer, packaged Studio 또는 commercial/legal
readiness 판정이 아니다. Cross-platform runtime 전략의 [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은
계속 **Proposed**다.

## Milestone 상태와 release gate

Phase 1B 직후 제안했던 `Phase 1C — macOS VST3 Runtime Strategy Portability Spike`는 superseded됐다. 현재
제품 제작 순서는 다음과 같다.

1. **Phase 1C.1 — Product Contracts and Headless Windows VST3 Export** — 완료
2. **Phase 1C.2 — Garak Studio Product Workspace and Export UX** — 완료
3. **Phase 2 — Project Evolution and Persistent Migration** — 정확한 다음 milestone
4. 첫 상용 배포 전 **Cross-platform release gate**

macOS VST3 arm64/x86_64/Universal, AU, Developer ID signing, notarization, installer와 Windows/macOS 실제
DAW 검증은 release gate에 남아 있다. Mac 장비가 현재 Windows 제품 제작을 막지는 않지만 Windows PASS가
이 gate를 대신하지 않는다.

## Git 기준선과 저장소 보존

- Phase 0 기준선: `ef71c755ee84a9b82d6589365711211fdbc62f58` (`Establish Phase 0 baseline`)
- Phase 1A 기준선: `c9d92bfd800cb702a0c32442598a508b382b1df2` (`feat: complete Garak phase 1A VST3 gain shell`)
- Phase 1B 기준선: `4203138f13a83e652c04405061fcd2c2ec362c27` (`feat: complete Garak phase 1B runtime strategy spike`)
- Phase 1C.1 기준선: `c3f0afb6b9d42d441137e97c115ed96631cae0bc` (`feat: complete Garak phase 1C.1 headless Windows export`)
- Phase 1C.2는 위 clean local checkpoint에서 시작했다. 현재 Phase 1C.2 변경은 uncommitted이며 remote는 없다.
- Commit amend/rebase, branch 변경, reset/clean과 SDK/VSTGUI source 수정은 수행하지 않았다.
- Global/system/user VST3 install, registry write와 installer 실행은 없었다. Build/export/report는 ignored
  `out/` 아래에만 있다.

## 현재 canonical 제품 제작 경로

### Product project와 callable compiler

현재 `.garak` physical form은 exact lowercase `product.json` 하나를 가진 unpacked directory package다.
Schema v1은 immutable canonical Product ID, white-label vendor/name, strict semantic version, `Fx`,
`garak.gain-v1`과 Gain default를 표현한다. Gain ID `1001`과 Bypass ID `1002`는 template-owned persistent
contract다.

Product Compiler는 runtime third-party dependency 0인 side-effect-free callable facade를 제공하고 CLI도
이 facade에 위임한다. Draft validation, deterministic canonical serializer, open/create/save whole-directory
atomic transaction, raw SHA-256 revision, immutable Product ID와 revision conflict를 한 canonical 구현이
소유한다. Post-commit orphan은 typed owned cleanup descriptor로 반환하며 cleanup 시 containment, expected
sibling prefix, physical entry와 transaction ownership을 다시 확인한다.

### Electron process와 Product workspace

Electron main은 Product Compiler facade를 build-time import하고 다음을 소유한다.

- Native new/open/output dialog와 overwrite/cleanup confirmation
- Physical document/output/orphan path
- Opaque document, output과 cleanup capability map
- Trusted main-frame sender, runtime request validation과 concurrent-operation guard
- Canonical new/open/validate/save/export/cleanup orchestration

Preload는 구체적인 read-only method만 renderer에 노출하고 request/response를 runtime validation한다.
Renderer Product workspace는 new/open, editable vendor/name/version/Gain, immutable identity/category/template,
validate/save, Debug/Release export, cancellation/error, identity/hash/inventory/child result와 cleanup warning을
표시한다. Sound/Control/Interface는 아직 미구현임을 명시하는 placeholder다.

### Compiled Product Data, Runtime과 export

Product ID에서 versioned SHA-256 algorithm으로 processor/controller FUID를 결정적으로 도출한다.
`GARAKCPD` major 1/minor 0 compiled data와 `GARAKPST` major 1/minor 0 product-bound state는 Phase 1C.1
contract를 유지한다. Phase 1A/1B descriptor/state fixture를 fallback이나 migration input으로 읽지 않는다.

Configuration별 prebuilt `Garak Product Runtime v1`과 deterministic `product.garakbin`, product-specific
`moduleinfo.json`을 exact three-file VST3 bundle로 결합한다. Official moduleinfo create/validate, first-party
inspector와 official Validator standard/extensive가 성공한 뒤에만 atomic publish한다. Product-specific native
source generation, compile/link 또는 system VST3 install은 없다.

## Reference ProductService artifact

각 configuration에서 temp physical project의 new→validate→save→reopen이 saved/reopened true, field parity와
immutable Product ID를 확인한 뒤 수행한 `Artist Gain Warm` actual Studio service export 결과다.

| Configuration | Runtime SHA-256 | Compiled SHA-256 | moduleinfo SHA-256 | Inventory / child |
| --- | --- | --- | --- | --- |
| Debug | `64CC6BDAFE3F014265F0D7ADE1054F3625B348CDEF6625D8C294FDC3A63222BA` | `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` | `F780F3DE2D42325A3722584207C17EFCB87A7A9E30D23639FB982C61DED947B4` | 3 / 5 exit 0 |
| Release | `404AD55BA8F397F242ED4052860D2B1698EB51CE7311F5B772710525AE77BDEC` | same | same | 3 / 5 exit 0 |

Child 5개는 moduleinfotool create/validate, first-party inspector, official Validator standard/extensive다.
두 configuration 모두 cleanup warning은 0이다. Runtime hash는 final fresh native build artifact를 기록하며
compiled/moduleinfo hash는 configuration 사이에서 동일하다.

## 결정 상태

| ADR | 상태 | 현재 의미 |
| --- | --- | --- |
| [0001](../adr/0001-typescript-studio-and-cpp20-engine.md) | Accepted | Studio Electron/React/strict TypeScript, Native C++20/CMake/Ninja/MSVC/Apple Clang |
| [0002](../adr/0002-no-juce-and-adapter-boundaries.md) | Accepted | JUCE 없이 external library를 first-party adapter 뒤에 격리 |
| [0004](../adr/0004-windows-macos-and-plugin-formats.md) | Accepted | 첫 상용 format은 Windows VST3, macOS Universal VST3와 macOS AU |
| [0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md) | **Accepted, Windows x64 v0.x scope** | Prebuilt Product Runtime plus `GARAKCPD` product data |
| [0006](../adr/0006-studio-product-workflow-boundary.md) | **Accepted, Phase 1C.2 repository-local scope** | Main-owned capability와 shared Product Compiler facade |
| [0003](../adr/0003-generated-plugin-runtime-strategy.md) | **Proposed** | macOS/AU와 장기 cross-platform runtime 결합 전략은 미선택 |

ADR 0005/0006의 bounded 선택은 ADR 0003을 암묵적으로 Accepted하거나 Phase 1B comparison evidence를
소급 변경하지 않는다.

## 최종 검증

### Phase 1C.2 Product Compiler와 Studio

| 검증 | 최종 결과 |
| --- | --- |
| Frozen workspace install | PASS, existing exact lock/toolchain |
| Product Compiler format/lint/typecheck | PASS |
| Product Compiler tests | **52/52 PASS** |
| Studio format/lint/typecheck | PASS |
| Studio tests | **10/10 PASS** |
| Studio production build | renderer 21 modules/209.50 kB JS/12.70 kB CSS; main 16 modules/53.39 kB; preload 3 modules/5.07 kB |
| Actual ProductService Debug/Release | config별 lifecycle parity + immutable Product ID, exact 3 files, child 5/5 exit 0, cleanup warning 0 |
| Bounded Electron dev launch | Vite ready, Electron 4 processes 확인 뒤 exact tree 종료 |
| Dependency | Studio direct 16, Product Compiler runtime third-party 0 |

### Phase 1C.1 canonical regression

| 검증 | Debug | Release |
| --- | ---: | ---: |
| Fresh configure + clean build | 177/177 PASS | 177/177 PASS |
| No-native-build artifact manifest | 772 unchanged | 641 unchanged |
| Forbidden native-build invocation | 0 | 0 |
| Product Runtime CTest | 7/7 PASS | 7/7 PASS |

No-native-build runner는 configuration별 repeated Warm/Bright export의 first 10/10과 second 10/10 child
exit 0, Runtime hash parity와 build-tree file inventory 불변을 확인했다.

## 실패 이력과 remediation

- 첫 composite native command는 `cmd`/PowerShell quoting 때문에 intended sequence를 증명하지 못해 PASS
  evidence에서 제외했다. Configure/build, runner와 CTest를 exact command로 분리해 재실행했다.
- Sandbox의 Vite 및 native child spawn은 `EPERM`으로 실패했다. 같은 source와 exact command를 승인된
  환경에서 다시 실행해 Studio build와 ProductService Debug/Release export를 통과했다.
- 일부 pnpm wrapper 실행은 non-TTY auto-verification 문제로 중단됐다. Existing frozen toolchain에서
  official quality/test scripts를 다시 실행해 52/52 PASS를 얻었고 installed Prettier direct check로 closeout
  Studio instruction formatting도 확인했다.
- 첫 workflow smoke 호출은 `pnpm studio:verify:product-workflow -- --configuration Debug`의 literal `--`가
  script에 전달되어 usage error로 export 전에 종료됐다. Exact `pnpm --dir studio
  verify:product-workflow --configuration Debug`와 Release 명령으로 교정해 둘 다 통과했다.
- Final source audit는 response SHA guard의 canonical uppercase enforcement, export result의
  processor/controller FUID 표시와 draft edit/new export attempt 전 stale result clear 누락을 발견했다. 세
  문제를 수정하고 final production build를 다시 실행해 renderer 209.50 kB 결과로 PASS했다.

실패한 run은 최종 PASS 수치에 포함하지 않는다.

## 명시적으로 구현하지 않은 범위

- Phase 2 project/schema evolution, released migration과 compiled-data mismatch policy
- macOS VST3/AU, Universal binary, signing, notarization, installer/updater
- Packaged Studio runtime/tool distribution과 actual DAW workflow
- Production single-file `.garak`, general DSP graph/compiler, macro, scene, preset/asset
- Custom editor, audition/native preview, JUCE, VSTGUI, Skia, CanvasKit, Yoga, XYFlow
- BLOOM, cloud/marketplace/telemetry/auth/DRM과 external VST repackaging
- Root `LICENSE`, commercial artist product와 commercial legal approval

## 수행하지 않은 검증

- macOS Apple Clang/Xcode configure/build와 official validator
- macOS arm64/x86_64/Universal VST3, AU, signing/notarization
- Windows/macOS actual DAW scan/load/automation/bypass/state restore
- Installer/system deployment, packaged Studio artifact와 package authenticity
- Realtime allocation/blocking 계측, CPU/latency/memory와 장시간 stress
- Production single-file project/migration와 general graph/interface data
- Full transitive license/notice/trademark/security 및 commercial redistribution audit

이 항목은 PASS로 일반화하지 않는다. Windows official Validator와 local ProductService contract는 actual
DAW, macOS와 commercial release readiness를 대신하지 않는다.

## 현재 리스크와 남은 결정

- Repository-local Runtime/tool discovery는 installed Studio distribution contract가 아니다. Packaged Studio
  공급과 installer layout은 Phase 7 release gate에서 별도 결정·검증한다.
- Prebuilt Runtime resource lookup과 product-specific moduleinfo는 Windows에서만 검증됐다. Signed macOS
  bundle/AU와 code-signing 관계는 release gate evidence가 필요하다.
- `GARAKCPD` v1은 fixed Gain template contract이며 graph-ready general container로 확장하지 않는다.
- Final single-file `.garak` physical form은 아직 확정하지 않는다. Phase 2는 current directory form 위에서
  versioned evolution과 migration behavior를 먼저 검증한다.
- SDK redistribution notice/trademark와 generated Runtime commercial legal review는 미완료다.

## 정확한 다음 작업 제안

`Phase 2 — Project Evolution and Persistent Migration`

Phase 2는 아직 착수하지 않았다. 별도 승인과 ExecPlan 뒤 Phase 1C.1 minimal Gain schema와 Phase 1C.2
Studio project lifecycle 위에 versioned evolution, released identity lifecycle, explicit migration과
compiled-data mismatch의 migrate/rebuild/reject 정책을 추가한다. macOS/AU/signing/notarization/actual DAW는
첫 상용 배포 전 cross-platform release gate에 남는다.
