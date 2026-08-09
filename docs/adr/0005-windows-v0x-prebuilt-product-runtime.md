# ADR 0005 — Windows v0.x Prebuilt Product Runtime

- Status: Accepted
- Date: 2026-08-09
- Scope: Windows x64 VST3 product creation in Garak v0.x
- 관련 문서: [ADR 0003](0003-generated-plugin-runtime-strategy.md), [ADR 0004](0004-windows-macos-and-plugin-formats.md), [Runtime과 export](../architecture/runtime-and-export.md), [Compiled Product Data v1](../architecture/compiled-product-data-v1.md), [Product State v1](../architecture/product-state-v1.md), [ExecPlan 0005](../../plans/0005-phase-1c1-product-contracts-and-headless-windows-export.md)

## Context

Garak의 첫 실제 제품 제작 경로는 editable `.garak` project에서 독립적인 white-label Windows
VST3까지 이어져야 한다. 생성 제품은 Studio나 network 없이 동작하고, 제품별 영구 identity와
metadata를 보존하며, export 때마다 C++ compiler와 linker를 요구하지 않아야 한다.

Phase 1B는 Windows x64에서 두 runtime packaging 대안을 같은 Gain/Bypass 동작으로 비교했다.
Alternative A의 Data Alpha와 Data Beta는 configuration별로 byte-identical한 prebuilt inner Runtime을
사용하면서 module-relative descriptor로 서로 다른 factory identity와 default를 노출했다. 일반
PowerShell package-only 재현에서 product-specific compiler/linker invocation은 0이었고, 두 제품의
동시 load, state 격리와 official VST3 Validator도 통과했다. Alternative B의 product-specific thin
factory wrapper도 같은 수용 항목을 통과했지만 제품마다 compile/link가 필요했다.

이 evidence는 Windows v0.x의 최소 제품 제작 경로를 선택하기에는 충분하지만 cross-platform 최종
runtime 전략을 결정하기에는 충분하지 않다. 특히 Phase 1B Alternative A의 strict 11-line ASCII
`garak-product-spike-v1.txt`는 identity/default packaging을 측정하기 위한 private 기술 fixture다.
Editable product model, production compiled data, state 또는 migration contract가 아니며 이름을 바꿔
정식 format으로 승격할 수 없다.

## Decision

Windows v0.x product creation path는 Phase 1B Alternative A에서 검증한 **prebuilt Runtime plus
product data** 방식을 사용한다.

- Configuration별로 한 번 build하고 검증한 `Garak Product Runtime v1` inner binary를 여러 제품
  bundle에서 byte-for-byte 재사용한다.
- Product identity, white-label metadata, template와 parameter default는 새 formal binary인
  [`Garak Compiled Product Data v1`](../architecture/compiled-product-data-v1.md)의
  `Contents/Resources/product.garakbin`에서만 읽는다.
- Product export는 prebuilt Runtime을 copy/rename하고 product data와 product-specific
  `moduleinfo.json`을 배치한다. Product-specific C++ source generation, compilation 또는 linking을
  수행하지 않는다.
- Runtime은 loaded module path를 기준으로 resource를 찾고 factory 공개 전에 전체 data를 strict하게
  검증한다. Invalid 또는 missing data에 template/stale/default identity로 fallback하지 않고 fail
  closed한다.
- Phase 1B Data Runtime, ASCII descriptor, Alternative B thin wrapper와 네 reference spike는
  regression/reference evidence로 그대로 보존한다. 새 Product Runtime은 이 경로들을 읽거나
  compatibility fallback으로 실행하지 않는다.

이 결정은 **Windows x64 VST3와 Garak v0.x에만 Accepted**다. Cross-platform runtime 결합 전략의
권위인 [ADR 0003](0003-generated-plugin-runtime-strategy.md)은 계속 `Proposed`이고 Alternative A나
B를 macOS/AU의 기본값 또는 최종안으로 정하지 않는다.

## 근거

Alternative A를 Windows v0.x 경로로 선택하는 직접 근거는 다음과 같다.

- Phase 1B의 두 Data product와 template Runtime inner bytes가 configuration별로 동일했다.
- Product packaging만 다시 수행한 plain PowerShell evidence에서 compiler/linker invocation이 0이었다.
- 서로 다른 product identity, moduleinfo, defaults와 state가 같은 process에서 충돌 없이 공존했다.
- Official validator의 standard/extensive run과 strict module-relative resource lookup이 Windows
  x64에서 검증됐다.
- Phase 1C.1의 목표는 Studio UX 전에 가장 작은 end-to-end product creation path를 완성하는 것이다.
  이미 검증된 Runtime binary를 data와 조합하는 방식이 이 목표를 불필요한 native toolchain 공급
  문제 없이 충족한다.

Phase 1C.1은 Phase 1B descriptor를 재사용하지 않고 별도 project, identity, compiled-data와
product-bound state contract를 만든다. 따라서 이 ADR은 spike schema의 승인이 아니라 Windows
prebuilt packaging 전략과 production contract의 분리를 승인한다.

## Alternatives Considered

### Alternative B를 Windows v0.x 기본 경로로 사용

Thin wrapper도 Phase 1B 수용 기준을 통과했고 fallback/reference로 가치가 있다. 그러나 제품별
compile/link, SDK와 native toolchain 공급이 필요하므로 현재 headless/local export의 가장 작은 경로로
선택하지 않는다. 구현과 evidence는 삭제하지 않는다.

### Phase 1B ASCII descriptor를 production data로 재사용

Descriptor는 11-line ASCII spike schema이고 product source/state/versioned binary의 장기 요구를
표현하지 않는다. Compatibility 이름 변경이나 dual parser를 만들지 않고 새 `GARAKCPD` v1 binary를
canonical path로 사용한다.

### macOS 검증을 먼저 완료할 때까지 Windows product path를 보류

Windows에서 project-to-product vertical slice를 독립적으로 완성할 수 있고 Phase 1B evidence도 있다.
macOS 장비 부재를 현재 제품 제작 병목으로 만들지 않는다. 다만 Windows 결과를 macOS나 commercial
release readiness로 일반화하지 않는다.

### Studio/Electron이 export 중 Runtime 역할을 수행

생성 제품의 offline independence와 JavaScript-runtime 금지 불변식에 위배되므로 제외한다. Studio는
후속 Phase 1C.2에서 검증된 headless compiler/export를 호출하는 authoring UX만 제공한다.

## Consequences

긍정적 결과:

- Product마다 native build를 반복하지 않고 검증된 Windows Runtime binary를 재사용할 수 있다.
- Product-specific 차이가 versioned first-party data, resources와 package metadata로 좁아진다.
- Headless compiler/export를 Studio와 분리해 determinism, atomicity와 failure behavior를 직접 검증할
  수 있다.
- Alternative B와 Phase 1B evidence를 보존하므로 이후 cross-platform 비교의 기준을 잃지 않는다.

비용과 위험:

- Dynamic factory identity는 compiled data, actual factory, bundle name과 moduleinfo 사이의 stale
  mismatch를 항상 fail closed해야 한다.
- 같은 Runtime bytes라도 product-specific resource를 배치한 최종 bundle은 제품별로 다시 검증하고
  향후 signing 전에 완성해야 한다.
- Windows module-relative lookup 성공은 signed macOS bundle, Universal binary 또는 AU resource
  lookup의 증거가 아니다.
- Corrupt/tampered data의 구조 검증과 derived FUID parity는 제공하지만 commercial authenticity,
  code signing 또는 DRM을 제공하는 결정은 아니다.
- Prebuilt Runtime에 capability가 늘면 불필요한 code/size가 모든 제품에 포함될 수 있으므로 v0.x
  Runtime은 현재 `garak.gain-v1` 범위보다 앞서 범용화하지 않는다.

## Validation and Release Boundary

Phase 1C.1은 최소 Warm/Bright 제품에 대해 다음 evidence를 요구한다.

- Same prebuilt Runtime inner bytes와 서로 다른 `product.garakbin`, factory identity와 moduleinfo
- Product-specific compiler/linker invocation 0인 일반 PowerShell export
- Project → compiled data → factory → moduleinfo identity/metadata parity
- Debug/Release standard 및 extensive official VST3 Validator
- 기존 Phase 1A/1B 다섯 module과 새 두 product의 same-process coexistence, state/instance isolation
- Deterministic compiled bytes, atomic export failure와 prior valid output preservation
- Studio, network, Electron, Node.js와 JavaScript runtime 없이 generated VST3 operation

이 ADR은 macOS VST3, arm64/x86_64 Universal, AU, Developer ID signing, notarization, installer 또는
실제 macOS DAW validation을 완료했다고 주장하지 않는다. 이 항목은 첫 상용 배포 전에
**Cross-platform release gate**에서 별도 CI 또는 Mac 장비로 검증한다. 그 evidence와 trade-off를
바탕으로 ADR 0003을 Accepted/Superseded하거나 다른 대안을 제안한다.

Phase 1C.1 이후 `Phase 1C.2 — Garak Studio Product Workspace and Export UX`와 Phase 2A editable project
migration이 완료됐다. Studio와 migration engine은 이 ADR의 headless 경로를 대체하거나 별도
compiler/runtime path를 만들지 않으며, schema v1/v2는 같은 `GARAKCPD` v1과 prebuilt Runtime으로
lower/export된다. 정확한 다음 milestone은 Phase 2B Studio migration publication/backup/recovery UX다.
