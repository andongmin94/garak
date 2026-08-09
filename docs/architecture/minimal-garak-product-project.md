# Minimal Garak Product Project

- 상태: Phase 2A validated minimal physical/logical project contract
- 범위: `garak.gain` template version 1, current editable schema v2와 supported legacy schema v1
- 관련 문서: [Editable Project Schema v2](editable-project-schema-v2.md), [Project Migration Engine](project-migration-engine.md), [Product Identity Derivation](product-identity-derivation.md), [Compiled Product Data v1](compiled-product-data-v1.md), [Runtime과 export](runtime-and-export.md), [v0.1 PRD](../product/v0.1-prd.md), [ExecPlan 0007](../../plans/0007-phase-2a-editable-project-schema-migration.md)

## 목적과 현재 경계

이 contract는 editable Garak product의 가장 작은 logical model과 현재 development physical form을
정의한다. Current schema v2는 하나의 editorless Gain template를 실제 Windows VST3로 export하는 데
필요한 정보만 받는다. Schema v1은 exact supported legacy input이며 Product Compiler가 source boundary에서
v2 canonical model로 memory migration한다. Graph, macro, UI, preset, asset 또는 platform build 설정을
미리 추가하지 않는다.

현재 `.garak` project는 **unpacked directory package**다. Production single-file archive, ZIP 또는
다른 container는 미결정이며 이번 schema의 일부가 아니다. 향후 physical container가 바뀌어도
logical model과 immutable Product ID는 별도 명시적 결정 없이는 바뀌지 않는다.

## Physical form

Valid project는 다음 inventory와 정확히 같아야 한다.

```text
<project-name>.garak/
└─ product.json
```

규칙:

- CLI에 전달한 project path는 실제 directory여야 한다.
- Project directory leaf는 case-sensitive exact suffix `.garak`으로 끝나야 하며 `.GARAK` 같은
  variant를 허용하지 않는다.
- Root에는 exact lowercase name의 ordinary regular file `product.json` 하나만 있어야 한다.
- Extra file, subdirectory, symlink/reparse point, `Product.json` 같은 case variant와 두 번째
  `product.json` 후보를 허용하지 않는다.
- `product.json`은 BOM 없는 valid UTF-8이어야 한다.
- Project source를 generated VST3 bundle에 복사하지 않는다. Compiler가 검증한 logical model을
  [`product.garakbin`](compiled-product-data-v1.md)으로 낮춘다.

Reference fixture 위치는 다음과 같다.

```text
examples/products/artist-gain-warm.garak/product.json             # current v2
examples/products/artist-gain-bright.garak/product.json           # current v2
examples/products/legacy/v1/artist-gain-warm.garak/product.json   # legacy v1
examples/products/legacy/v1/artist-gain-bright.garak/product.json # legacy v1
```

동일 product의 v1/v2 counterpart는 Product ID가 같으므로 일반 batch collision input이 아니라 migration
parity fixture로 비교한다. Exact byte/hash는
[Phase 2A fixture status](../status/phase-2a-project-migration-fixtures.md)가 소유한다.

## Current schema version 2

Canonical example:

```json
{
  "schemaVersion": 2,
  "productId": "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
  "vendor": "Garak Test Artist",
  "name": "Artist Gain Warm",
  "version": "0.1.0",
  "category": "Fx",
  "template": {
    "id": "garak.gain",
    "version": 1
  },
  "defaults": {
    "gainDb": -6
  }
}
```

Root object의 key set은 정확히 여덟 개이며 `template`은 exact structured object다.

| Field | Type | v2 contract |
| --- | --- | --- |
| `schemaVersion` | JSON number | Fraction/exponent 없는 lexical integer token이며 정확히 `2` |
| `productId` | string | Canonical lowercase UUID, non-nil, immutable |
| `vendor` | string | White-label vendor, valid UTF-8 `1..63` bytes |
| `name` | string | Product/bundle leaf, valid UTF-8 `1..52` bytes |
| `version` | string | Prerelease/build 없는 strict `major.minor.patch` |
| `category` | string | 정확히 `Fx` |
| `template` | object | Exact `{ "id": "garak.gain", "version": 1 }` |
| `defaults` | object | Exact key `gainDb` 하나만 포함 |

`defaults.gainDb`는 finite JSON number이고 inclusive range `-60.0..+12.0` dB다.

Property order, UTF-8/LF/final-newline와 negative-zero normalization을 포함한 exact current writer contract는
[Editable Project Schema v2](editable-project-schema-v2.md)가 단일 권위를 가진다.

## Supported legacy schema version 1

Schema v1은 위 root metadata/default를 유지하면서 exact string
`template: "garak.gain-v1"`을 사용한다. V1 validator는 structured v2 template를 거부하고 v2 validator는
legacy string을 거부한다. Valid v1은 pure `project-schema-1-to-2` step으로 current v2 model에 변환되며
Product ID, FUID, Parameter ID, metadata, default와 compiled template meaning을 보존한다. Legacy source의
exact shape, explicit-output publication과 failure behavior는
[Project Migration Engine](project-migration-engine.md)이 정의한다.

## Strict JSON and field validation

Product Compiler는 standard `JSON.parse` 전에 작고 독립적으로 테스트한 lexical pass로 모든 object
scope의 duplicate key를 JSON string escape decode 이후의 key 값으로 감지한다. 따라서 `"name"`과
`"\u006eame"`도 같은 key로 충돌한다. Duplicate를 마지막 값으로 덮어쓰거나 warning으로 낮추지 않는다.
전체 JSON parser를 재구현하거나 새 범용 JSON dependency를 추가하지 않는다.

다음 input은 오류다.

- Malformed JSON, root array/null/scalar, invalid UTF-8 또는 UTF-8 BOM
- Root/template/defaults의 duplicate key, unknown key 또는 missing key
- Field의 incorrect JSON type
- `schemaVersion` raw token이 fraction/exponent 없는 integer spelling이 아니거나 version-first detection에서
  supported legacy/current로 분류되지 않음. `2.0`, `2e0`, `2.0000000000000001`도 거부함
- UUID가 `8-4-4-4-12` lowercase hexadecimal/hyphen canonical form이 아님
- Nil UUID `00000000-0000-0000-0000-000000000000`
- Vendor/name이 empty 또는 Unicode whitespace-only임
- Vendor가 63 UTF-8 bytes, name이 52 UTF-8 bytes를 초과함
- Vendor/name에 embedded NUL, `U+0000..U+001F` 또는 `U+007F..U+009F` control이 있음
- Version이 `^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`와 다르거나
  각 component가 `65535`를 초과함
- Category 또는 version-specific template contract가 위 exact 값과 다름
- `gainDb`가 nonfinite이거나 template range 밖임

JSON lexical spellings `NaN`과 `Infinity`는 malformed JSON이다. `1e309`처럼 parse 후 nonfinite가 되는
number도 finite validation에서 거부한다. Compiler는 invalid value를 clamp, trim, slug 또는 자동
교정하지 않는다.

## Windows product-name policy

`name`은 display metadata이면서 final `<name>.vst3` bundle leaf와 inner module basename이다. Export가
조용히 다른 slug를 만들지 않도록 source 단계에서 Windows component policy를 적용한다.

- `<`, `>`, `:`, `"`, `/`, `\`, `|`, `?`, `*`를 금지한다.
- 마지막 character가 space 또는 dot이면 거부한다.
- Case-insensitive device stem `CON`, `PRN`, `AUX`, `NUL`, `CLOCK$`, `CONIN$`, `CONOUT$`,
  `COM1..COM9`, `LPT1..LPT9`, 그리고 Windows가 같은 device digit으로 취급하는
  `COM¹`/`COM²`/`COM³`와 `LPT¹`/`LPT²`/`LPT³`를 금지한다. Extension처럼 보이는 suffix가 있어도
  첫 dot 전 stem으로 검사한다.
- `.`와 `..`는 product name이 될 수 없다.
- Batch validation은 Unicode/Windows case-insensitive 비교를 적용한 artifact leaf collision과
  normalized absolute output path collision을 export 전에 거부한다.

52-byte limit은 product name 뒤에 ASCII suffix ` Controller`를 붙여도 VST3의 64-byte class-name
buffer에 terminating NUL과 함께 들어가게 하는 현재 adapter contract다. Byte length는 JavaScript
UTF-16 code unit이나 Unicode code-point count가 아니라 UTF-8 encoding 결과로 측정한다.

## Source에 포함하지 않는 값

다음 값은 project author가 입력하지 않는다.

- Processor/Controller FUID
- Gain/Bypass numeric Parameter ID
- Absolute project/output path, CWD 또는 target build directory
- VST3 SDK type, moduleinfo structure 또는 platform-specific class metadata
- Timestamp, machine/user/PID 또는 random export value
- Graph, macro, UI, preset, asset, MIDI, sidechain 또는 instrument definition
- Signing identity, installer, updater 또는 commercial distribution 설정

FUID는 Product ID에서 [versioned algorithm](product-identity-derivation.md)으로 도출한다. Gain `1001`과
Bypass `1002`는 source `{ id: "garak.gain", version: 1 }`이 가리키는 existing compiled
`garak.gain-v1` contract가 부여한다.

## Product ID, rename and clone semantics

Product ID는 제품 생성 시 한 번 할당하고 이후 immutable하게 보존한다. Compiler/export가 missing 또는
invalid ID를 새 UUID로 대체하거나 매 실행마다 다시 생성하지 않는다.

- `name`, `vendor`, `version`, directory path, CWD 또는 output path 변경은 같은 제품의 edit이며
  Processor/Controller FUID를 바꾸지 않는다.
- Rename은 같은 VST3 class identity의 새 표시 이름이다. Old-name과 renamed bundle을 함께 배포하면
  같은 FUID를 가진 duplicate product가 되므로 batch validation에서 거부한다.
- Project directory를 복사해도 새 제품이 되지 않는다. 진짜 clone/new product를 만들려면 source에서
  명시적으로 새 Product ID를 할당해야 한다.
- Product ID가 바뀌면 두 FUID가 모두 바뀌고 이전 제품의
  [Product State](product-state-v1.md)는 새 제품에서 거부된다.
- Batch validation은 duplicate Product ID, processor/controller/cross-role FUID와 case-insensitive
  artifact/output collision을 staging 전에 검사한다.

## Diagnostics and mutation boundary

Validation failure는 non-zero exit와 project-relative field path, stable error code와 이해 가능한
message를 제공한다. 일반 사용자 오류에 stack trace를 기본 노출하지 않는다.

Project validation과 batch collision validation은 output/staging을 만들기 전에 모두 끝나야 한다.
Invalid project는 existing compiled file 또는 valid exported bundle을 변경하지 않는다. Compatibility
fallback, unknown field ignore, duplicate overwrite와 automatic filename correction은 허용하지 않는다.

## Version boundary

Reader는 physical/JSON boundary를 통과한 뒤 schema field validation 전에 version envelope를
`supported-legacy`, `current`, `too-old`, `too-new` 또는 `invalid`로 분류한다. Exact v1/v2만 해당
version validator에 전달한다. Unknown schema를 v1/v2로 추측하거나 obsolete draft path로 fallback하지
않는다. V1은 current v2 model로 sequential migration하고 compile/export downstream은 legacy union을
소비하지 않는다.

Current v2 open/save/export와 legacy v1 read/memory-migration/explicit distinct-output migration은 Phase 2A
PASS다. Legacy ordinary Studio save는 source rewrite 대신 migration-required로 실패한다. Studio confirmation,
backup/recovery와 in-place publication은 Phase 2B이고 compiled/state compatibility는 Phase 2C다. 이 문서는
production single-file `.garak` container를 결정하지 않는다.
