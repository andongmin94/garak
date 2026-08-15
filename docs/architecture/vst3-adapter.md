# Garak VST3 Adapter

- 기준일: 2026-08-22
- Active implementation: `native/adapters/vst3/product_runtime_v1`
- Persistent contract: `native/runtime/product_v1`
- Reusable DSP: `native/dsp/gain`
- Official SDK: `steinbergmedia/vst3sdk` `v3.8.0_build_66`
- Exact superproject pin: `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`

## 역할

VST3 adapter는 Steinberg ABI와 Garak이 소유하는 compiled product, state와 DSP 사이의 경계다. Steinberg type, lifecycle, factory와 host error code는 adapter 또는 VST3-only test 밖으로 노출하지 않는다.

Current Windows v0.x path는 하나의 prebuilt Product Runtime module을 제품별 bundle에 복사하고 다음 resource를 결합한다.

```text
<Product Name>.vst3/
└─ Contents/
   ├─ x86_64-win/<Product Name>.vst3
   └─ Resources/
      ├─ product.garakbin
      └─ moduleinfo.json
```

Runtime은 loaded module 위치에서 `product.garakbin`을 읽고 factory 공개 전에 strict validation한다. CWD, environment, registry와 Studio path에 의존하지 않는다. Missing, corrupt, future 또는 incompatible data는 fail closed한다.

## Current module boundary

| 경계 | 책임 |
| --- | --- |
| `native/dsp/gain` | Gain mapping, automation timeline, bypass와 sample processing |
| `native/runtime/product_v1` | `GARAKCPD` v1, `GARAKPST` v1, Product/Parameter identity contract |
| `native/adapters/vst3/product_runtime_v1` | module resource loading, dynamic factory, processor/controller, stream adapter, inspector |
| `native/tests/gain_dsp_tests.cpp` | SDK-independent DSP behavior |
| `native/tests/product_v1_contract_tests.cpp` | compiled/state byte contract |
| `native/tests/product_compatibility_tests.cpp` | compiled artifact compatibility policy |
| `native/tests/product_runtime_v1_smoke_tests.cpp` | Warm/Bright actual module output와 state isolation |
| CTest inspector/validator entries | metadata parity와 official standard/extensive validation |

## 제거된 spike

Phase 1A fixed Gain module과 Phase 1B Data/Thin runtime-strategy A/B implementation은 pre-release 기술 spike였다. Source, CMake option/preset, test target과 packaging tools는 current tree에서 제거됐다. 당시 evidence는 다음에만 남긴다.

- `plans/0003-phase-1a-windows-minimal-vst3-gain-shell.md`
- `plans/0004-phase-1b-generated-runtime-ab-spike.md`
- `docs/adr/0003-generated-plugin-runtime-strategy.md`
- `docs/status/phase-1b-runtime-strategy-*.md`

해당 문서의 command와 path는 historical record이며 current validation procedure가 아니다. Obsolete spike implementation을 compatibility fallback으로 복원하지 않는다.

## SDK와 build 경계

- SDK와 nested repositories는 recursive Git submodule exact pin으로 재현한다.
- Configure/build 중 network fetch를 하지 않는다.
- SDK source를 수정, 재포맷 또는 first-party clang-tidy 대상으로 만들지 않는다.
- VSTGUI support와 examples는 끈다.
- automatic system/user VST3 link는 끈다.
- `moduleinfotool`과 official `validator`는 matching Product Runtime configuration에서 build한다.
- 모든 bundle은 repository `out/` 아래에서만 생성·검증한다.

## Factory와 identity

`product.garakbin`은 다음 product-specific metadata를 제공한다.

- Product ID
- vendor/name/version/category
- processor/controller FUID
- Gain/Bypass Parameter ID와 default

Processor와 controller FUID는 Product ID에서 versioned deterministic algorithm으로 derivation한다. Gain ID `1001`, Bypass ID `1002`는 permanent contract다. Factory는 processor와 controller 두 class만 노출한다.

Controller는 custom editor를 제공하지 않는다. Event/MIDI bus, sidechain, program, meter와 VSTGUI resource를 포함하지 않는다.

## Audio processing contract

- 하나의 main audio input과 output
- mono→mono 또는 stereo→stereo
- Float32와 Float64
- variable block size와 zero-sample parameter-only call
- sample-offset Gain automation
- exact-offset Bypass automation
- in-place와 out-of-place processing
- input silence flags 처리
- invalid pointer/bus/precision fail closed

Gain normalized domain은 `[0, 1]`, physical range는 `-60 dB..+12 dB`다. Automation queue는 host storage를 bounded하게 순회하며 heap container로 복사하지 않는다.

Audio callback에서 allocation/deallocation, lock/wait, I/O, logging, formatting, parser, graph mutation과 exception propagation을 허용하지 않는다.

## State contract

Product Runtime은 exact versioned `GARAKPST` v1을 사용한다.

- Product ID binding
- Gain `1001`, Bypass `1002`
- duplicate/missing/unknown Parameter ID rejection
- finite normalized value validation
- malformed, truncated, foreign-product와 unsupported version rejection
- failure 시 prior processor/controller state 불변

State parsing과 serialization은 callback 밖에서 수행하고 lock-free packed state handoff를 사용한다.

## Inspector와 moduleinfo parity

Product Compiler export는 matching `moduleinfotool`로 `moduleinfo.json`을 생성한다. First-party inspector는 다음 네 source의 identity parity를 검사한다.

1. `.garak` logical metadata
2. `product.garakbin`
3. Runtime factory
4. `moduleinfo.json`

Bundle leaf와 inner module filename이 일치해야 한다. Stale template identity를 허용하지 않는다.

## Current validation

Visual Studio x64 Developer Command 환경에서 실행한다.

```powershell
git submodule update --init --recursive third_party/vst3sdk

cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first
pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Debug --output out/exports/phase-1c1/debug --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Debug --output out/exports/phase-1c1/debug --force --validate
ctest --preset product-runtime-debug-test --no-tests=error

cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first
pnpm product:export --project examples/products/artist-gain-warm.garak --configuration Release --output out/exports/phase-1c1/release --force --validate
pnpm product:export --project examples/products/artist-gain-bright.garak --configuration Release --output out/exports/phase-1c1/release --force --validate
ctest --preset product-runtime-release-test --no-tests=error
```

CTest includes current Product Runtime DSP/contract/compatibility tests, Warm/Bright loaded-module smoke, inspector parity and official standard/extensive validator runs. The exact current commit's `garak/windows-foundation` status is authoritative.

## 미검증 release boundary

- actual representative DAW matrix
- packaged Studio and clean-system installation
- macOS arm64/x86_64 Universal VST3
- AU
- Developer ID signing and notarization
- commercial redistribution/trademark review

Windows validation을 이 항목의 완료로 일반화하지 않는다.
