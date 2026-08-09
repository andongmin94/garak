# Garak Native Instructions

The repository-root `AGENTS.md` applies throughout this directory. These rules add constraints for
the native build and source tree.

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
  The current Phase 1A boundary is the private `spikes/gain` kernel and the fixed editorless VST3
  adapter; do not expand it into a generic runtime, graph, project, export, UI, MIDI, sidechain or
  packaging API without a later approved ExecPlan.
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
