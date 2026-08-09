# Garak Native Instructions

The repository-root `AGENTS.md` applies throughout this directory. These rules add constraints for
the native build and source tree.

- Use C++20 with CMake and Ninja, without compiler extensions. Keep ownership explicit and prefer
  RAII and value semantics; never introduce a raw owning pointer or call `new` or `delete`
  directly. Prefer `std::unique_ptr`, `std::span`, and `std::string_view` when those types match the
  ownership and lifetime contract.
- Put first-party code in the `garak` namespace and do not add mutable global state.
- Keep each module's public first-party headers under its `include/garak/` tree and implementation
  details under `src/`. Do not expose platform, plugin SDK, or other third-party types through
  public APIs.
- Apply `garak_apply_warnings` and `garak_apply_clang_tidy` to every first-party CMake target. Do not
  modify warning flags on imported or third-party targets.
- Keep tests deterministic and standalone. Report failed comparisons to stderr and return a
  non-zero exit code; do not use `assert` as the test contract. Do not add public behavior without
  a corresponding test.
- If realtime code is added in a later phase, follow the root realtime rules and
  `docs/architecture/realtime-and-quality.md`; Phase 0B does not add realtime code.
- Phase 0B native code is limited to the version scaffold, smoke executable, and version test. Do
  not add audio, plugin, graph, serialization, runtime packaging, or speculative domain APIs.
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
first-party `.cpp` and `.hpp` file under `native/`. Do not hide first-party warnings or analysis
findings to make a build pass.
