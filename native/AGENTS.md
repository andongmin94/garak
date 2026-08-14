# Garak Native Instructions

The repository-root `AGENTS.md` applies throughout this directory. These rules add constraints for
the native build and source tree. `adapters/vst3/AGENTS.md` adds a third layer below that subtree.

- Use C++20 with CMake and Ninja, without compiler extensions. Keep ownership explicit and prefer
  RAII and value semantics. The only direct `new` exception is the narrow Steinberg
  reference-count ownership transfer documented in `adapters/vst3/AGENTS.md`.
- Put first-party code in the `garak` namespace and do not add mutable global state.
- Put reusable DSP under `native/dsp`, persistent runtime contracts under `native/runtime`, and
  plugin-format integration under `native/adapters`. Do not place production code under a spike,
  sample, or fixture namespace.
- Keep public first-party headers under a module's `include/garak/` tree and implementation details
  under `src/`. Do not expose platform or plugin SDK types through public first-party APIs.
- Apply `garak_apply_warnings` and `garak_apply_clang_tidy` to every first-party CMake
  target. Do not modify warning flags on imported or third-party targets.
- Keep tests deterministic and standalone. Report failed comparisons to stderr and return a
  non-zero exit code; do not use `assert` as the test contract.
- Realtime code follows `docs/architecture/realtime-and-quality.md`. The current callback path is
  the production Gain DSP module plus `runtime/product_v1` and
  `adapters/vst3/product_runtime_v1`. It must not allocate, free, lock, wait, perform I/O, log,
  format strings, mutate graph structure, or propagate exceptions.
- Do not add a third-party native dependency without the repository-level dependency and license
  review.

Run generic Native gates from a Visual Studio x64 Developer Command environment on Windows:

```text
cmake --preset debug --fresh
cmake --build --preset debug-build --clean-first
ctest --preset debug-test --no-tests=error

cmake --preset release --fresh
cmake --build --preset release-build --clean-first
ctest --preset release-test --no-tests=error
```

Run the current Windows Product Runtime path after initializing the exact recursive SDK checkout:

```text
git submodule update --init --recursive third_party/vst3sdk

cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first
pnpm product:export --project examples/products/artist-gain-warm.garak `
  --configuration Debug --output out/exports/phase-1c1/debug --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak `
  --configuration Debug --output out/exports/phase-1c1/debug --force --validate
ctest --preset product-runtime-debug-test --no-tests=error

cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first
pnpm product:export --project examples/products/artist-gain-warm.garak `
  --configuration Release --output out/exports/phase-1c1/release --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak `
  --configuration Release --output out/exports/phase-1c1/release --force --validate
ctest --preset product-runtime-release-test --no-tests=error
```

Verify first-party strict configurations separately:

```text
cmake --preset product-runtime-werror --fresh
cmake --build --preset product-runtime-werror-build --clean-first
cmake --preset product-runtime-clang-tidy --fresh
cmake --build --preset product-runtime-clang-tidy-build --clean-first
```

Check formatting without modifying files with `clang-format --dry-run --Werror --style=file` over
every first-party C/C++ file under `native/`; never format `third_party/vst3sdk`.
