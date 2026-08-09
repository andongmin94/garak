# Garak

Garak(가락)은 음악가, 프로듀서와 사운드 디자이너가 자신의 사운드 컬러, control language, interface와 브랜드를 설계해 독립적인 native audio plugin 제품으로 출시할 수 있게 하는 오디오 제품 제작 플랫폼이다.

## 현재 상태

저장소는 Phase 0A/0B, Phase 1A/1B와 Phase 1C.1 기준선을 보존한 채 **Phase 1C.2 — Garak Studio Product Workspace and Export UX**를 Windows x64에서 PASS로 완료했다. Studio Product workspace에서 minimal directory `.garak` product를 만들고 열고 편집하고 검증하고 atomic 저장한 뒤, 같은 canonical Product Compiler를 통해 Debug 또는 Release white-label VST3를 export할 수 있다.

Renderer에는 filesystem, shell, process 또는 raw IPC 권한이 없다. Electron main이 dialog, opaque document/output/cleanup capability와 trusted sender를 소유하고, preload는 new/open/validate/save/export/cleanup의 fixed typed API만 노출한다. Studio와 CLI는 같은 side-effect-free Product Compiler facade를 사용하며 Studio direct dependency 16개와 Product Compiler runtime third-party dependency 0을 유지한다.

Product Compiler quality gate와 52/52 test, Studio quality gate와 10/10 test, production build, bounded Electron launch, ProductService Debug/Release lifecycle/export와 Phase 1C.1 Runtime Debug/Release fresh clean build 177/177·CTest 7/7·no-native-build evidence가 모두 통과했다. ProductService smoke는 temp physical project의 new→validate→save→reopen parity와 immutable Product ID를 확인한 뒤 exact three-file reference export와 validator/inspection child 5/5 exit 0을 검증했다. 범용 DSP graph, final single-file `.garak`, 실제 plugin editor와 commercial packaging은 아직 없다.

생성 플러그인의 목표는 Garak Studio가 없는 컴퓨터에서 독립적으로 오프라인 동작하는 white-label native 제품이다. 생성물에는 Electron, Chromium, Node.js 또는 임의의 JavaScript runtime을 넣지 않는다.

macOS VST3/Universal, AU, Apple Clang, representative DAW, Developer ID signing, notarization과 installer는 Windows 개발의 선행 병목이 아니라 첫 상용 배포 전 **Cross-platform release gate**다. 아직 검증하지 않았으며 Windows PASS로 일반화하지 않는다.

## 빠른 시작

아래 명령은 2026-08-12 Windows x64에서 실제로 통과했다. Native 명령은 Visual Studio x64 Developer Command 환경에서 저장소 루트 기준으로 실행한다. 현재 검증 환경은 Node.js 24.19.0, pnpm 11.16.0, MSVC 19.51, CMake 4.3.1과 Ninja 1.13.2다.

### Native configure, build, test와 run

```text
cmake --preset debug
cmake --build --preset debug-build
ctest --preset debug-test --no-tests=error
out\build\debug\native\apps\garak_smoke\garak_smoke.exe

cmake --preset release
cmake --build --preset release-build
ctest --preset release-test --no-tests=error
out\build\release\native\apps\garak_smoke\garak_smoke.exe

cmake --preset debug-warnings-as-errors
cmake --build --preset warnings-as-errors-build --clean-first
cmake --preset debug-clang-tidy
cmake --build --preset clang-tidy-build --clean-first
```

### Studio install, quality와 build

Node.js 24와 pnpm 11.16.0을 사용한다. Electron 43은 desktop binary를 첫 실행에 on demand로 받으므로 GUI 전에 명시적으로 준비하려면 두 번째 명령을 사용한다.

```text
pnpm install --frozen-lockfile
pnpm --dir studio exec install-electron --no
pnpm studio:lint
pnpm studio:format:check
pnpm studio:typecheck
pnpm studio:test
pnpm studio:build
pnpm studio:dev
```

`pnpm studio:dev`는 `127.0.0.1:5173`의 local development server와 Studio 창을 계속 실행한다. 종료할 때 `Ctrl+C`를 사용한다. Production build output은 `studio/dist/`와 `studio/dist-electron/`에 생성되며 Git 대상에서 제외된다. Studio direct dependency 기준선은 runtime 2개와 development 14개, 합계 16개다.

### Phase 1C.2 Studio Product workflow 검증

아래 workflow smoke는 Phase 1C.1의 해당 configuration Runtime과 도구를 먼저 build한 뒤 실행한다. 실제 `ProductService`로 temp physical `.garak`을 new→validate→save→reopen해 field/Product ID parity를 확인하고, reference project를 연 뒤 canonical export를 호출해 exact three-file inventory와 moduleinfotool create/validate, inspector, official Validator standard/extensive의 child 5개가 모두 exit 0인지 확인한다.

```text
pnpm --dir studio verify:product-workflow --configuration Debug
pnpm --dir studio verify:product-workflow --configuration Release
```

이 명령은 repository-local development workflow다. Packaged Studio에 Runtime과 도구를 공급하는 installer contract를 검증하지 않는다.

### Phase 1C.1 Product Compiler와 Windows x64 product export

Product Compiler의 runtime third-party dependency는 0이다. `validate`와 `inspect`는 source를 읽기만 하고, `compile`은 deterministic `product.garakbin`을 만들며, `export`는 미리 build한 Runtime과 validator/inspection tool을 사용한다.

```text
pnpm product:lint
pnpm product:format:check
pnpm product:typecheck
pnpm product:test
pnpm product:validate --project examples/products/artist-gain-warm.garak
pnpm product:inspect --project examples/products/artist-gain-bright.garak
pnpm product:compile --project examples/products/artist-gain-warm.garak --output out/compiled/artist-gain-warm/product.garakbin
```

Debug와 Release prebuilt Runtime을 각각 build한 뒤 일반 PowerShell의 evidence runner로 Warm/Bright를 두 번씩 export하고, 그 산출물을 입력으로 CTest를 실행한다. Runner는 native build-tool 호출 0, build input 불변, repeated hash parity와 official validator standard/extensive 결과를 확인한다.

```text
git submodule update --init --recursive third_party/vst3sdk

cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first
pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Debug --output out/exports/phase-1c1/debug --force --validate
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Debug
ctest --preset product-runtime-debug-test --no-tests=error

cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Release --output out/exports/phase-1c1/release --force --validate
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Release
ctest --preset product-runtime-release-test --no-tests=error

cmake --preset product-runtime-werror --fresh
cmake --build --preset product-runtime-werror-build --clean-first
cmake --preset product-runtime-clang-tidy --fresh
cmake --build --preset product-runtime-clang-tidy-build --clean-first
```

Export output은 `out/exports/phase-1c1/{debug|release}/`, no-native-build report는 `out/reports/vst3/product-runtime/`에 있으며 모두 Git 대상에서 제외된다. System/user VST3 directory에는 쓰지 않는다.

### Phase 1A Windows x64 VST3

SDK와 nested repository를 exact gitlink로 재현한 뒤 repository-local bundle만 build/validate한다.

```text
git submodule update --init --recursive third_party/vst3sdk

cmake --preset vst3-debug
cmake --build --preset vst3-debug-build --clean-first
ctest --preset vst3-debug-test --no-tests=error
tools\vst3\validate.ps1 -Configuration Debug

cmake --preset vst3-release
cmake --build --preset vst3-release-build --clean-first
ctest --preset vst3-release-test --no-tests=error
tools\vst3\validate.ps1 -Configuration Release

cmake --preset vst3-werror
cmake --build --preset vst3-werror-build --clean-first
cmake --preset vst3-clang-tidy
cmake --build --preset vst3-clang-tidy-build --clean-first
```

실제 artifact, validator 수치와 미검증 범위는 [Phase 1A validation 상태](docs/status/phase-1a-vst3-validation.md)에 기록한다. System/user VST3 directory에 설치하거나 link하지 않는다.

### Phase 1B Windows x64 runtime strategy spike

이 흐름은 실험용 repository-local bundle만 만든다. Global package/tool 설치나 system/user VST3 directory write는 없으며, SDK는 위 Phase 1A와 같은 exact recursive checkout을 사용한다. 아래 명령은 모든 mandatory script path를 명시한다.

Debug build, coexistence test, validator와 artifact inspection:

```powershell
cmake --preset runtime-strategy-debug --fresh
cmake --build --preset runtime-strategy-debug-build --clean-first
ctest --preset runtime-strategy-debug-test --no-tests=error

$artifactRoot = 'out\build\runtime-strategy-debug'
$reportRoot = 'out\reports\vst3\runtime-strategy'
tools\vst3\validate_runtime_strategy.ps1 `
  -Configuration Debug `
  -ArtifactRootPath $artifactRoot `
  -ValidatorPath "$artifactRoot\bin\validator.exe" `
  -GainSpikeBundlePath "$artifactRoot\VST3\Debug\Garak Gain Spike.vst3" `
  -DataAlphaBundlePath "$artifactRoot\runtime-products\Garak Data Alpha.vst3" `
  -DataBetaBundlePath "$artifactRoot\runtime-products\Garak Data Beta.vst3" `
  -ThinAlphaBundlePath "$artifactRoot\VST3\Debug\Garak Thin Alpha.vst3" `
  -ThinBetaBundlePath "$artifactRoot\VST3\Debug\Garak Thin Beta.vst3" `
  -ReportDirectory $reportRoot
tools\vst3\inspect_runtime_strategy.ps1 `
  -Configuration Debug `
  -ArtifactRootPath $artifactRoot `
  -TemplateBundlePath "$artifactRoot\VST3\Debug\Garak Data Runtime Template.vst3" `
  -GainSpikeBundlePath "$artifactRoot\VST3\Debug\Garak Gain Spike.vst3" `
  -DataAlphaBundlePath "$artifactRoot\runtime-products\Garak Data Alpha.vst3" `
  -DataBetaBundlePath "$artifactRoot\runtime-products\Garak Data Beta.vst3" `
  -ThinAlphaBundlePath "$artifactRoot\VST3\Debug\Garak Thin Alpha.vst3" `
  -ThinBetaBundlePath "$artifactRoot\VST3\Debug\Garak Thin Beta.vst3" `
  -ReportPath "$reportRoot\debug-artifacts.json"
```

Release build, coexistence test, validator와 artifact inspection:

```powershell
cmake --preset runtime-strategy-release --fresh
cmake --build --preset runtime-strategy-release-build --clean-first
ctest --preset runtime-strategy-release-test --no-tests=error

$artifactRoot = 'out\build\runtime-strategy-release'
$reportRoot = 'out\reports\vst3\runtime-strategy'
tools\vst3\validate_runtime_strategy.ps1 `
  -Configuration Release `
  -ArtifactRootPath $artifactRoot `
  -ValidatorPath "$artifactRoot\bin\validator.exe" `
  -GainSpikeBundlePath "$artifactRoot\VST3\Release\Garak Gain Spike.vst3" `
  -DataAlphaBundlePath "$artifactRoot\runtime-products\Garak Data Alpha.vst3" `
  -DataBetaBundlePath "$artifactRoot\runtime-products\Garak Data Beta.vst3" `
  -ThinAlphaBundlePath "$artifactRoot\VST3\Release\Garak Thin Alpha.vst3" `
  -ThinBetaBundlePath "$artifactRoot\VST3\Release\Garak Thin Beta.vst3" `
  -ReportDirectory $reportRoot
tools\vst3\inspect_runtime_strategy.ps1 `
  -Configuration Release `
  -ArtifactRootPath $artifactRoot `
  -TemplateBundlePath "$artifactRoot\VST3\Release\Garak Data Runtime Template.vst3" `
  -GainSpikeBundlePath "$artifactRoot\VST3\Release\Garak Gain Spike.vst3" `
  -DataAlphaBundlePath "$artifactRoot\runtime-products\Garak Data Alpha.vst3" `
  -DataBetaBundlePath "$artifactRoot\runtime-products\Garak Data Beta.vst3" `
  -ThinAlphaBundlePath "$artifactRoot\VST3\Release\Garak Thin Alpha.vst3" `
  -ThinBetaBundlePath "$artifactRoot\VST3\Release\Garak Thin Beta.vst3" `
  -ReportPath "$reportRoot\release-artifacts.json"
```

First-party strict configurations:

```text
cmake --preset runtime-strategy-werror --fresh
cmake --build --preset runtime-strategy-werror-build --clean-first
cmake --preset runtime-strategy-clang-tidy --fresh
cmake --build --preset runtime-strategy-clang-tidy-build --clean-first
```

Alternative A product output은 `out/build/runtime-strategy-{debug|release}/runtime-products/`에 있다. Data Runtime template, Alternative B thin products와 Gain baseline은 같은 build root의 `VST3/{Debug|Release}/`에 있다. 별도 일반 PowerShell package-only rerun에서도 `cl.exe`와 `link.exe` 없이 같은 Alternative A inner binary와 product별 descriptor/moduleinfo를 재생성했다.

Alternative A의 Debug product만 다시 package하는 실제 명령은 다음과 같다. 이미 build한 template과
official `moduleinfotool.exe`만 사용하며 product-specific C++ compile/link를 실행하지 않는다.

```powershell
$artifactRoot = 'out\build\runtime-strategy-debug'
$template = "$artifactRoot\VST3\Debug\Garak Data Runtime Template.vst3"
$moduleInfoTool = "$artifactRoot\bin\moduleinfotool.exe"

tools\vst3\package_data_runtime_variant.ps1 `
  -TemplateBundlePath $template `
  -DescriptorPath 'native\adapters\vst3\runtime_strategy_spike\descriptors\data-alpha.txt' `
  -OutputBundlePath "$artifactRoot\runtime-products\Garak Data Alpha.vst3" `
  -ModuleInfoToolPath $moduleInfoTool
tools\vst3\package_data_runtime_variant.ps1 `
  -TemplateBundlePath $template `
  -DescriptorPath 'native\adapters\vst3\runtime_strategy_spike\descriptors\data-beta.txt' `
  -OutputBundlePath "$artifactRoot\runtime-products\Garak Data Beta.vst3" `
  -ModuleInfoToolPath $moduleInfoTool
```

## 확정된 기술 방향

- Garak Studio: Electron, React, TypeScript strict mode, Windows/macOS
- Native Engine과 generated plugin runtime: C++20
- Native build: CMake, Ninja, Windows의 MSVC, macOS의 Apple Clang
- JUCE를 사용하지 않음
- First-party model/API와 third-party SDK/library를 adapter 경계로 분리
- 제품 개발 우선순위: Windows x64 VST3 vertical path를 먼저 완성하고 macOS VST3/Universal과 AU는 첫 상용 배포 전 release gate에서 검증
- 첫 상용 format 목표: Windows VST3, macOS Universal VST3, macOS AU

Steinberg VST3 SDK `v3.8.0_build_66`은 exact pin으로 Phase 1A adapter, Phase 1B comparison fixture와 Phase 1C.1 Windows x64 Product Runtime에서 build/validator를 검증했다. 이는 macOS/AU, commercial redistribution 또는 전체 legal audit의 승인이 아니다. VSTGUI는 recursive checkout에만 존재하고 build/link하지 않는다. Skia, CanvasKit, Yoga, XYFlow, miniaudio, KissFFT와 FlatBuffers는 계속 미설치·미검증·미승인 후보다. 상세 경계는 [Phase 1A dependency 상태](docs/status/phase-1a-vst3-dependency.md)와 [dependency policy](docs/architecture/dependency-policy.md)에 기록한다.

Cross-platform generated plugin runtime 결합 방식은 [ADR 0003](docs/adr/0003-generated-plugin-runtime-strategy.md)이 `Proposed`인 동안 미결정이다. Phase 1B의 다음 두 대안 중 어느 것도 macOS/AU의 기본값이나 최종 채택안이 아니다.

- A: 같은 prebuilt inner binary에 product별 module-relative descriptor와 metadata를 package
- B: product별 thin native factory wrapper를 compile/link하고 common implementation을 재사용

Phase 1B는 두 대안을 Windows x64의 동일한 Gain behavior와 identity/packaging/validation 기준으로 구현·비교했다. 이 bounded evidence를 근거로 [ADR 0005](docs/adr/0005-windows-v0x-prebuilt-product-runtime.md)는 Windows x64 VST3와 Garak v0.x에만 prebuilt Product Runtime plus compiled product data 방식을 Accepted로 정했다. ADR 0003은 계속 Proposed다.

## 문서 지도

### 제품

- [제품 비전](docs/product/vision.md)
- [사용자와 사용 사례](docs/product/users-and-use-cases.md)
- [v0.1 제품 요구사항](docs/product/v0.1-prd.md)

### Architecture

- [시스템 개요](docs/architecture/system-overview.md)
- [모듈 경계](docs/architecture/module-boundaries.md)
- [Project model](docs/architecture/project-model.md)
- [Minimal Garak Product Project](docs/architecture/minimal-garak-product-project.md)
- [Product Identity Derivation](docs/architecture/product-identity-derivation.md)
- [Compiled Product Data v1](docs/architecture/compiled-product-data-v1.md)
- [Product State v1](docs/architecture/product-state-v1.md)
- [Runtime과 export](docs/architecture/runtime-and-export.md)
- [Realtime과 quality](docs/architecture/realtime-and-quality.md)
- [Parameter와 state](docs/architecture/parameter-and-state.md)
- [Interface Designer](docs/architecture/interface-designer.md)
- [Dependency와 license policy](docs/architecture/dependency-policy.md)
- [VST3 Adapter](docs/architecture/vst3-adapter.md)

### 결정 기록

- [ADR 0001 — TypeScript Studio and C++20 Engine](docs/adr/0001-typescript-studio-and-cpp20-engine.md) — Accepted
- [ADR 0002 — No JUCE and Adapter Boundaries](docs/adr/0002-no-juce-and-adapter-boundaries.md) — Accepted
- [ADR 0003 — Generated Plugin Runtime Strategy](docs/adr/0003-generated-plugin-runtime-strategy.md) — Proposed
- [ADR 0004 — Windows, macOS, and Plugin Formats](docs/adr/0004-windows-macos-and-plugin-formats.md) — Accepted
- [ADR 0005 — Windows v0.x Prebuilt Product Runtime](docs/adr/0005-windows-v0x-prebuilt-product-runtime.md) — Accepted (Windows x64 v0.x scope)
- [ADR 0006 — Studio Product Workflow Boundary](docs/adr/0006-studio-product-workflow-boundary.md) — Accepted (repository-local Phase 1C.2 scope)

### 계획과 상태

- [Roadmap](ROADMAP.md)
- [현재 상태](docs/status/current.md)
- [ExecPlan 규약](PLANS.md)
- [Phase 0A ExecPlan](plans/0001-phase-0a-repository-foundation.md)
- [Phase 0B ExecPlan](plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md)
- [Phase 0B dependency 상태](docs/status/phase-0b-dependencies.md)
- [Phase 1A ExecPlan](plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md)
- [Phase 1A VST3 identity](docs/status/phase-1a-vst3-identity.md)
- [Phase 1A VST3 dependency](docs/status/phase-1a-vst3-dependency.md)
- [Phase 1A VST3 validation](docs/status/phase-1a-vst3-validation.md)
- [Phase 1B ExecPlan](plans/0004-phase-1b-generated-runtime-ab-spike.md)
- [Phase 1C.1 ExecPlan](plans/0005-phase-1c1-product-contracts-and-headless-windows-export.md)
- [Phase 1C.1 product fixtures](docs/status/phase-1c1-product-fixtures.md)
- [Phase 1C.1 headless export validation](docs/status/phase-1c1-headless-export-validation.md)
- [Phase 1C.2 ExecPlan](plans/0006-phase-1c2-studio-product-workspace-and-export-ux.md)
- [Phase 1C.2 Studio Product workflow validation](docs/status/phase-1c2-studio-product-workspace-validation.md)

저장소 작업 규칙과 문서 우선순위는 [AGENTS.md](AGENTS.md)를 따른다.

## 정확한 다음 milestone

다음 권장 작업은 별도 승인과 ExecPlan이 필요한 **Phase 2 — Project Evolution and Persistent Migration**이다. Phase 1C.1의 minimal Gain schema와 Phase 1C.2의 Studio project lifecycle 위에 versioned project evolution, released identity lifecycle, explicit migration과 compiled-data mismatch 정책을 추가한다.

Phase 1C의 Windows Product Creation Vertical Slice는 완료했다. ADR 0003은 계속 Proposed이고 ADR 0005와 ADR 0006은 각각 Windows x64 v0.x Runtime 및 repository-local Studio workflow 범위에서만 Accepted다. macOS VST3/Universal, AU, representative DAW, signing/notarization, installer와 commercial packaging은 첫 상용 배포 전 release gate로 미검증 상태다.

## License

이 저장소의 license는 아직 결정되지 않았다. `LICENSE` 파일이 없으며, 별도의 license 결정 전에는 이 저장소가 특정 open-source 또는 상용 재배포 권한을 부여한다고 해석해서는 안 된다.
