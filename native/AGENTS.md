# Garak Native Instructions

The repository-root `AGENTS.md` applies throughout this directory. These rules add constraints for
the native build and source tree. `adapters/vst3/AGENTS.md` adds a third layer below that subtree.

- Use C++20 with CMake and Ninja, without compiler extensions. Keep ownership explicit and prefer
  RAII and value semantics; never introduce a raw owning pointer or call `new` or `delete`
  directly. The only current exception is the narrow Steinberg reference-count ownership transfer
  documented in `adapters/vst3/AGENTS.md`; do not generalize it. Prefer `std::unique_ptr`,
  `std::span`, and `std::string_view` when those types match the ownership and lifetime contract.
- Put first-party code in the `garak` namespace and do not add mutable global state.
- Keep each module's public first-party headers under its `include/garak/` tree and implementation
  details under `src/`. Do not expose platform, plugin SDK, or other third-party types through
  public APIs.
- Apply `garak_apply_warnings` and `garak_apply_clang_tidy` to every first-party CMake target. Do not
  modify warning flags on imported or third-party targets.
- Keep tests deterministic and standalone. Report failed comparisons to stderr and return a
  non-zero exit code; do not use `assert` as the test contract. Do not add public behavior without
  a corresponding test.
- Realtime code follows the root realtime rules and `docs/architecture/realtime-and-quality.md`.
  The current boundary is the private `spikes/gain` kernel, the fixed Phase 1A editorless VST3
  adapter, the private Phase 1B `runtime_strategy_spike` comparison fixture, and Phase 1C.1's
  formal `runtime/product_v1` plus `adapters/vst3/product_runtime_v1` Windows path. Phase 1B is not
  a generic runtime or product compiler. Phase 1C.1 is limited to the fixed `garak.gain-v1`
  compiled-data/state contract; do not expand either path into a general graph, UI, MIDI,
  sidechain, asset, preset, installer or cross-platform packaging API without a later approved
  ExecPlan.
- Do not add a third-party native dependency without the repository-level dependency and license
  review.

Run Native commands from a Visual Studio x64 Developer Command environment on Windows:

```text
cmake --preset debug
cmake --build --preset debug-build
ctest --preset debug-test
out\build\debug\native\apps\garak_smoke\garak_smoke.exe
```

Use the equivalent `release`, `release-build`, and `release-test` presets for Release. Verify the
strict warning and static-analysis configurations with:

```text
cmake --preset debug-warnings-as-errors
cmake --build --preset warnings-as-errors-build
cmake --preset debug-clang-tidy
cmake --build --preset clang-tidy-build --clean-first
```

Check formatting without modifying files with `clang-format --dry-run --Werror` over every
first-party `.cpp` and `.hpp` file under `native/`; never format `third_party/vst3sdk`. Do not hide
first-party warnings or analysis findings to make a build pass.

Run the Phase 1A VST3 path with the recursive SDK checkout and separate build trees:

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

Run the Phase 1B Windows x64 runtime-strategy spike from the repository root. It is experimental,
uses only repository-local build products, requires no global install, and must not write to a
system or user VST3 directory. This PowerShell block supplies every mandatory validator and
inspection path for both configurations:

```powershell
function Test-GarakRuntimeStrategy {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration
  )

  $buildName = $Configuration.ToLowerInvariant()
  $artifactRoot = "out\build\runtime-strategy-$buildName"
  $reportRoot = 'out\reports\vst3\runtime-strategy'
  $vstRoot = "$artifactRoot\VST3\$Configuration"

  cmake --preset "runtime-strategy-$buildName" --fresh
  cmake --build --preset "runtime-strategy-$buildName-build" --clean-first
  ctest --preset "runtime-strategy-$buildName-test" --no-tests=error

  tools\vst3\validate_runtime_strategy.ps1 `
    -Configuration $Configuration `
    -ArtifactRootPath $artifactRoot `
    -ValidatorPath "$artifactRoot\bin\validator.exe" `
    -GainSpikeBundlePath "$vstRoot\Garak Gain Spike.vst3" `
    -DataAlphaBundlePath "$artifactRoot\runtime-products\Garak Data Alpha.vst3" `
    -DataBetaBundlePath "$artifactRoot\runtime-products\Garak Data Beta.vst3" `
    -ThinAlphaBundlePath "$vstRoot\Garak Thin Alpha.vst3" `
    -ThinBetaBundlePath "$vstRoot\Garak Thin Beta.vst3" `
    -ReportDirectory $reportRoot

  $reportName = "$buildName-artifacts.json"
  tools\vst3\inspect_runtime_strategy.ps1 `
    -Configuration $Configuration `
    -ArtifactRootPath $artifactRoot `
    -TemplateBundlePath "$vstRoot\Garak Data Runtime Template.vst3" `
    -GainSpikeBundlePath "$vstRoot\Garak Gain Spike.vst3" `
    -DataAlphaBundlePath "$artifactRoot\runtime-products\Garak Data Alpha.vst3" `
    -DataBetaBundlePath "$artifactRoot\runtime-products\Garak Data Beta.vst3" `
    -ThinAlphaBundlePath "$vstRoot\Garak Thin Alpha.vst3" `
    -ThinBetaBundlePath "$vstRoot\Garak Thin Beta.vst3" `
    -ReportPath "$reportRoot\$reportName"
}

Test-GarakRuntimeStrategy -Configuration Debug
Test-GarakRuntimeStrategy -Configuration Release
```

Verify the first-party strict configurations separately:

```text
cmake --preset runtime-strategy-werror --fresh
cmake --build --preset runtime-strategy-werror-build --clean-first
cmake --preset runtime-strategy-clang-tidy --fresh
cmake --build --preset runtime-strategy-clang-tidy-build --clean-first
```

Alternative A's standalone package-only path consumes a previously built template and
`moduleinfotool`; it must work from ordinary PowerShell without `cl.exe` or `link.exe`. The same
block works for Release by setting `$configuration = 'Release'`:

```powershell
$configuration = 'Debug'
$buildName = $configuration.ToLowerInvariant()
$artifactRoot = "out\build\runtime-strategy-$buildName"
$templateBundle = "$artifactRoot\VST3\$configuration\Garak Data Runtime Template.vst3"
$moduleInfoTool = "$artifactRoot\bin\moduleinfotool.exe"

Get-Command cl.exe, link.exe -ErrorAction SilentlyContinue
tools\vst3\package_data_runtime_variant.ps1 `
  -TemplateBundlePath $templateBundle `
  -DescriptorPath 'native\adapters\vst3\runtime_strategy_spike\descriptors\data-alpha.txt' `
  -OutputBundlePath "$artifactRoot\runtime-products\Garak Data Alpha.vst3" `
  -ModuleInfoToolPath $moduleInfoTool
tools\vst3\package_data_runtime_variant.ps1 `
  -TemplateBundlePath $templateBundle `
  -DescriptorPath 'native\adapters\vst3\runtime_strategy_spike\descriptors\data-beta.txt' `
  -OutputBundlePath "$artifactRoot\runtime-products\Garak Data Beta.vst3" `
  -ModuleInfoToolPath $moduleInfoTool
```

The Windows x64 closeout result is Debug/Release CTest 5/5 for the two Alternative A products,
two Alternative B products, and the Gain baseline loaded together. Every one of those five
bundles in each configuration passed official validator standard 47/47 and extensive 537/537
with zero warnings or failures. Alternative A outputs are under
`out/build/runtime-strategy-{debug|release}/runtime-products/`; the template, thin products, and
Gain baseline are under the corresponding `VST3/{Debug|Release}/` directory. This does not select
Alternative A or B for cross-platform use: ADR 0003 remains Proposed. Phase 1B itself did not
verify macOS, AU, representative DAWs, signing/notarization, installers or a production Product
Compiler.

Run the Phase 1C.1 Windows x64 Product Runtime v1 path after the same exact recursive SDK checkout.
The aggregate presets preserve the Phase 0, Phase 1A and Phase 1B modules and add the formal
compiled-product/state Runtime, inspector and seven-module coexistence tests:

```text
cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Debug
ctest --preset product-runtime-debug-test --no-tests=error

cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Release
ctest --preset product-runtime-release-test --no-tests=error

cmake --preset product-runtime-werror --fresh
cmake --build --preset product-runtime-werror-build --clean-first
cmake --preset product-runtime-clang-tidy --fresh
cmake --build --preset product-runtime-clang-tidy-build --clean-first
```

After each Debug or Release build and before CTest, run the export-only evidence from ordinary PowerShell. The
script exports Warm and Bright twice, admits only the prebuilt `moduleinfotool`, first-party
inspector and official validator child processes, rejects native build-tool invocation, and proves
that the input build tree is unchanged.

Final products are under `out/exports/phase-1c1/{debug|release}/`; evidence is under
`out/reports/vst3/product-runtime/`. Debug/Release CTest 7/7 and Warm/Bright official validator
standard 47/47 plus extensive 537/537 passed with zero warnings, failures or crashes. This is the
[ADR 0005](../docs/adr/0005-windows-v0x-prebuilt-product-runtime.md) Windows x64 v0.x path only.
ADR 0003 remains Proposed, and macOS VST3/Universal, AU, representative DAWs,
signing/notarization and installers remain a pre-commercial cross-platform release gate.
