# Garak Editable Project Schema v2

- 상태: supported legacy source contract; superseded by schema v3
- Schema version documented here: `2`
- Current schema version: `3`
- Supported predecessor: schema version `1`
- 관련 문서: [Minimal Garak Product Project](minimal-garak-product-project.md), [Project Migration Engine](project-migration-engine.md), [Project Model](project-model.md), [Product Identity Derivation](product-identity-derivation.md), [Compiled Product Data v1](compiled-product-data-v1.md), [Product State v1](product-state-v1.md), [ADR 0007](../adr/0007-editable-project-schema-migration-policy.md), [ExecPlan 0007](../../plans/0007-phase-2a-editable-project-schema-migration.md), [Phase 2A fixtures](../status/phase-2a-project-migration-fixtures.md), [Phase 2A validation](../status/phase-2a-project-migration-validation.md)

## 목적과 version 경계

Schema v2는 Phase 2A에서 도입됐고 현재도 strict legacy input으로 지원되는 `.garak` source contract다.
Current writer와 canonical domain model은 [schema v3](editable-project-schema-v3.md)을 사용한다. v2는 v1의
product identity, white-label metadata와 Gain product 의미를 그대로 보존하면서 template identity와
template contract version을 별도 field로 표현한다.

Editable project schema version은 product release version, template version, node implementation version,
`GARAKCPD` compiled-data version과 `GARAKPST` state version을 대신하지 않는다. Source schema가 v2가
되어도 current generated Runtime은 계속 `GARAKCPD` v1과 `GARAKPST` v1을 사용한다.

이 문서는 legacy v2 logical/JSON contract와 v2 validator의 exact input shape를 정의한다. Legacy v1 exact shape는
[Minimal Garak Product Project](minimal-garak-product-project.md), version detection과 v1→v2 변환은
[Project Migration Engine](project-migration-engine.md)이 정의한다.

## Physical form

Phase 2A는 `.garak` physical form을 바꾸지 않는다. Valid project는 unpacked directory package다.

```text
<project-name>.garak/
└─ product.json
```

- Project directory leaf는 case-sensitive exact `.garak` suffix를 사용한다.
- Root inventory는 exact lowercase ordinary file `product.json` 하나다.
- Extra entry, subdirectory, symlink/reparse point와 filename case variant를 거부한다.
- `product.json`은 `1..65536` bytes, strict UTF-8, BOM 없음이어야 한다.
- Project source JSON은 generated VST3 bundle에 포함하지 않는다.

Single-file archive, ZIP, asset container와 general project package는 이 schema의 결정이 아니다.

## Exact schema version 2

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

Root object의 key set은 정확히 다음 여덟 개다.

| Field | Type | v2 contract |
| --- | --- | --- |
| `schemaVersion` | JSON number | Fraction/exponent 없는 lexical integer token이며 정확히 `2` |
| `productId` | string | Canonical lowercase UUID, non-nil, immutable |
| `vendor` | string | White-label vendor, valid UTF-8 `1..63` bytes |
| `name` | string | Product/bundle leaf, valid UTF-8 `1..52` bytes |
| `version` | string | Prerelease/build 없는 strict `major.minor.patch` |
| `category` | string | 정확히 `Fx` |
| `template` | object | Exact `id`, `version` key 두 개 |
| `defaults` | object | Exact `gainDb` key 하나 |

`template` contract:

| Field | Type | v2 contract |
| --- | --- | --- |
| `id` | string | 정확히 `garak.gain` |
| `version` | JSON number | Safe integer이며 정확히 `1` |

`defaults.gainDb`는 finite JSON number이고 inclusive range `-60.0..+12.0` dB다.

## Strict field validation

Version envelope가 v2로 분류된 뒤 v2 validator는 이 문서의 exact shape만 허용한다.

- `schemaVersion` raw JSON token은 `-?(?:0|[1-9][0-9]*)` 형태의 integer spelling이어야 한다. `2.0`,
  `2e0`와 parse 시 `2`로 반올림되는 `2.0000000000000001`을 exact `2`로 받아들이지 않는다.
- Root, `template`와 `defaults`의 duplicate, unknown 또는 missing key를 거부한다.
- JSON string escape decode 뒤 같은 key인 duplicate도 거부한다.
- Root array/null/scalar, wrong JSON type와 malformed JSON을 거부한다.
- `productId`는 lowercase `8-4-4-4-12` hexadecimal/hyphen canonical UUID이며 nil UUID가 아니어야 한다.
- Vendor/name은 empty 또는 Unicode whitespace-only일 수 없다. Embedded NUL,
  `U+0000..U+001F`와 `U+007F..U+009F` control을 거부한다.
- Vendor와 name byte limit은 JavaScript string length가 아니라 UTF-8 encoding 결과로 계산한다.
- Product version은 `^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`와 같고 각
  component는 `0..65535`다.
- Name은 [Windows product-name policy](minimal-garak-product-project.md#windows-product-name-policy)를
  만족해야 한다.
- Category, template ID와 template version은 현재 exact literal/number만 허용한다.
- Gain을 clamp, trim, default substitution 또는 자동 교정하지 않는다. Negative zero는 canonical
  serialization에서 positive zero로 normalize한다.

V1 string `"garak.gain-v1"`은 v2 `template` 값으로 valid하지 않다. 반대로 structured template는 v1
validator가 받아들이지 않는다. Unknown future field를 current schema extension으로 추측하지 않는다.

## Current model로의 lowering

Product Compiler는 versioned source representation과 current domain model을 분리한다.

```text
Exact v2 source value
  → exact v2 validation
  → project-schema-2-to-3
  → canonical ProductProject v3
  → identity / inspect / compile / export
```

Legacy v1 source는 v1 validator와 `project-schema-1-to-2`, `project-schema-2-to-3`을 순서대로 거쳐 같은
canonical v3 model에 도달한다. Compile과 export는 `string | object` 같은 legacy union을 받지 않는다. Canonical `ProductProject`와 versioned source
model에는 filesystem path가 없다. `LoadedProductProject`는 lexical `sourceDirectory`와 resolved
`physicalSourceDirectory`를 별도로 가지고 document snapshot과 compile/export operation option도 source
provenance를 semantic model 밖에서 운반해 collision/output safety에 사용한다. Studio document/session ID,
Electron type, output directory와 migration transaction metadata도 product semantics에 포함하지 않는다.

## Historical canonical serialization

Phase 2A writer가 사용했던 v2 canonical 규칙은 legacy fixture의 exact byte oracle로 유지한다. Current writer는
schema v3만 serialize하며 ordinary open이 v2 source를 다시 쓰지 않는다. v2 fixture의 규칙은 다음과 같다.

- UTF-8 without BOM
- LF line ending, 2-space indentation와 final newline
- Root order: `schemaVersion`, `productId`, `vendor`, `name`, `version`, `category`, `template`, `defaults`
- Template order: `id`, `version`
- Defaults order: `gainDb`
- Canonical lowercase UUID와 canonical product semantic version
- Finite Gain과 positive-zero normalization
- Timestamp, absolute/relative path, CWD, machine, user, PID, random과 build 정보 0

동일한 validated v2 logical product는 original whitespace/key order와 실행 환경에 관계없이 동일한
legacy canonical v2 bytes와 SHA-256을 만든다. Current publication은 v2를 쓰지 않고 explicit migration을
통해 canonical v3 bytes를 기록한다. Source open 자체는 어느 version도 수정하지 않는다.

## Legacy v1 semantic mapping

V1→v2 migration은 다음 representation만 바꾼다.

| Meaning | v1 source | v2 source |
| --- | --- | --- |
| Project schema | `schemaVersion: 1` | `schemaVersion: 2` |
| Template identity/version | `template: "garak.gain-v1"` | `template: { "id": "garak.gain", "version": 1 }` |

Product ID, vendor, name, product version, category와 `defaults.gainDb`는 값과 의미를 그대로 보존한다.
Migration은 Product ID를 생성하거나 canonicalize를 명분으로 rename, trim, clamp 또는 semantic-version
upgrade를 수행하지 않는다. Invalid v1 input은 먼저 실패하며 migration이 자동 수리하지 않는다.

## Identity, parameter와 compiled lowering

Product identity derivation input은 canonical Product ID와 role뿐이다. 따라서 v1/v2 representation,
source path와 canonical JSON bytes는 Processor/Controller FUID를 바꾸지 않는다.

Current structured template는 compiled boundary에서 다음 existing contract로 명시적으로 낮춘다.

- Source `{ id: "garak.gain", version: 1 }`
- Logical/inspector template `garak.gain-v1`
- `GARAKCPD` v1 template enum `1`
- Gain numeric Parameter ID `1001`
- Bypass numeric Parameter ID `1002`

같은 v1/v2/v3 logical product는 exact same `GARAKCPD` v1 bytes, Product ID/FUID, parameter table,
moduleinfo semantics와 Windows Runtime behavior를 만들어야 한다. Phase 2A는 compiled-data layout,
Product Runtime factory, VST3 state codec와 `GARAKPST` bytes를 migrate하거나 변경하지 않는다.

## Source와 mutation boundary

Validate, inspect, compile, export, open, migration-status와 migration dry-run은 v2 source를 수정하지
않는다. Legacy v1도 memory migration만으로 이 operation을 수행한다. Explicit output migration과 Studio
save 제약은 [Project Migration Engine](project-migration-engine.md)이 정의한다.

Invalid/too-old/too-new source는 partial canonical model이나 generated output을 만들지 않는다. Validation
failure가 existing valid project, compiled file 또는 export bundle을 변경해서도 안 된다.

## Scope boundary

Schema v2는 Phase 2A editorless Gain product의 최소 evolution이었다. Graph, arbitrary node, macro, interface,
preset, asset, MIDI, sidechain, instrument, signing, installer와 platform build configuration을 미리
추가하지 않는다.

Studio migration confirmation, backup/recovery와 in-place publication은 Phase 2B다. Compiled product data,
Product Runtime, preset/DAW/plugin state의 compatibility policy는 Phase 2C다. Future project schema는 명시적 plan/decision, exact validator, sequential migration step과 fixture 없이
current v3로 읽지 않는다.

Phase 2A의 exact source/compiled hash와 Debug/Release export evidence는
[fixture status](../status/phase-2a-project-migration-fixtures.md)와
[validation status](../status/phase-2a-project-migration-validation.md)에 기록한다.
