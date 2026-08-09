# Product Identity Derivation

- 상태: Phase 1C.1 normative contract
- Algorithm: `garak.vst3-product-identity.v1`
- 관련 문서: [Minimal Garak Product Project](minimal-garak-product-project.md), [Compiled Product Data v1](compiled-product-data-v1.md), [Parameter와 state](parameter-and-state.md), [ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)

## 목적

하나의 immutable Garak Product ID에서 VST3 processor와 controller의 16-byte class identity를
platform, path와 build 환경에 무관하게 결정적으로 도출한다. Product ID는 editable project의
identity root이고 FUID는 VST3 adapter representation이다.

Name, vendor, version 또는 file path에서 identity를 만들지 않는다. Export마다 random FUID를 만들거나
기존 identity와 충돌할 때 값을 자동 변경하지 않는다.

## Inputs

Algorithm version 1의 input은 정확히 다음 세 의미다.

| Input | Exact encoding |
| --- | --- |
| Namespace/version | UTF-8 bytes of ASCII `garak.vst3-product-identity.v1` |
| Product ID | Canonical lowercase UUID textual form, UTF-8 |
| Role | ASCII/UTF-8 literal `processor` 또는 `controller` |

Namespace literal은 30 bytes이고 그 hex는 다음과 같다.

```text
676172616B2E767374332D70726F647563742D6964656E746974792E7631
```

Product ID는
[`product.json` schema](minimal-garak-product-project.md)의 canonical/non-nil validation을 먼저
통과해야 한다. Role은 위 두 lowercase literal 외 값을 허용하지 않는다.

## Algorithm v1

다음 byte sequence에 SHA-256을 한 번 적용한다.

```text
UTF-8("garak.vst3-product-identity.v1")
+ byte 0x00
+ UTF-8(canonical lowercase productId)
+ byte 0x00
+ UTF-8(role)
```

Digest의 첫 16 bytes, 즉 byte offset `0..15`를 FUID byte representation으로 사용한다. Digest나
FUID에 UUID version/variant bit를 덮어쓰지 않는다. Uppercase 32-character hexadecimal 표시는 이
16 bytes를 offset 순서 그대로 두 자리씩 변환한 값이다.

VST3 SDK의 four-integer constructor, native integer endianness 또는 Windows GUID memory layout은 이
contract가 아니다. Adapter는 32-character literal을 `Steinberg::FUID::fromString`으로 읽거나 exact
16 bytes를 `TUID`에 copy한다. UUID binary도 Windows `GUID` struct/`ToByteArray`가 아니라 textual
hex pair를 왼쪽부터 읽는다.

Pseudo-code:

```text
function derive(productId, role):
    require canonicalLowercaseNonNilUuid(productId)
    require role == "processor" or role == "controller"
    preimage = utf8("garak.vst3-product-identity.v1")
             || [0x00]
             || utf8(productId)
             || [0x00]
             || utf8(role)
    return sha256(preimage)[0:16]
```

## Normative exact vectors

Expected values는 production derivation 함수를 test 실행 중 호출해 만들지 않고 independent literal로
고정한다. Full digest와 truncation 결과는 다음과 같다.

| Product ID | Role | Full SHA-256 | FUID, first 16 bytes |
| --- | --- | --- | --- |
| `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` | `processor` | `3BA93DD6A062C97D89EC78F3652F83C46321CD004FED96F2256B6428F24FA6DF` | `3BA93DD6A062C97D89EC78F3652F83C4` |
| `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` | `controller` | `00DD9000A50F7F28F4AE084CD29C43309DEAC30B2640CC60B566919E3A0EE949` | `00DD9000A50F7F28F4AE084CD29C4330` |
| `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357` | `processor` | `FCB1FDAED3D981A2AE3AE5A20898C449A4C94C3149E61FCBB3699BD0B73AFB99` | `FCB1FDAED3D981A2AE3AE5A20898C449` |
| `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357` | `controller` | `32D933DFBD3C8110E014829EF5D62EA355F0FBA733C1ECD383AF4AF8EB70A250` | `32D933DFBD3C8110E014829EF5D62EA3` |
| `123e4567-e89b-12d3-a456-426614174000` | `processor` | `34041DA416A3944588F29506953A30981C5F619DEA7AB33B0E509EF993388B1D` | `34041DA416A3944588F29506953A3098` |
| `123e4567-e89b-12d3-a456-426614174000` | `controller` | `AD919FFE93E7D3CFE766C7AED441B4A6BAE43498840E23C38C4B36366C84D418` | `AD919FFE93E7D3CFE766C7AED441B4A6` |

Warm Product ID bytes in standard textual order are
`6F0E50F1A2D44B378C9E1F2A3B4C5D6E`; Bright bytes are
`C8A56D907E4B4AF191D32B6C8E0F1357`.

Warm controller FUID가 `00` byte로 시작하는 것은 valid하다. Binary ID를 C string으로 다루거나
leading-zero를 nil/invalid로 판단해서는 안 된다. Nil FUID는 16 bytes 전체가 zero인 경우뿐이다.

## Stability and sensitivity

Algorithm은 다음 성질을 가져야 한다.

- 같은 canonical Product ID와 role은 모든 실행에서 같은 16 bytes를 만든다.
- 같은 Product ID의 processor와 controller는 서로 다르다.
- Product ID가 바뀌면 두 role의 FUID가 바뀐다.
- Name, vendor, product version, source/output path, CWD, timestamp, machine, user, PID와 random state는
  preimage에 들어가지 않는다.
- JSON whitespace/key order와 source timestamp는 결과에 영향을 주지 않는다.
- Phase 1A/1B의 고정 spike FUID 열 개와 reference product FUID 네 개 사이 collision은 0이어야 한다.

SHA-256의 128-bit truncation은 deterministic namespace separation을 위한 class-ID derivation이지
authenticity, signature 또는 malicious collision 방어 정책이 아니다. Export batch는 계산 결과를
그대로 신뢰해 덮어쓰지 않고 Product ID, processor/controller 및 cross-role collision을 명시적으로
검사한다.

## Rename and clone semantics

동일 Product ID에서 다음 변경은 FUID를 유지한다.

- Product `name` 변경
- `vendor` 변경
- Semantic `version` 변경
- `.garak` directory rename/move/copy
- CWD와 output directory 변경

이 의미는 rename이 같은 VST3 product identity의 새 표시 이름이라는 뜻이다. Renamed bundle과 이전
bundle을 동시에 유통하면 host 입장에서는 같은 processor/controller class ID가 중복된다. Compiler의
batch validation은 이를 duplicate Product ID/FUID로 거부한다.

Folder copy만으로는 새 제품이 생기지 않는다. 독립적인 clone/product를 만들려면 새 canonical
Product ID를 source에 명시해야 한다. Export tool은 새 ID를 자동 발급하거나 collision 회피를 위해
role/name/path를 preimage에 몰래 추가하지 않는다.

## Parameter identity separation

VST3 class FUID와 public Parameter ID는 별도 계약이다. `garak.gain-v1`은 모든 제품에서 다음 ID를
고정한다.

| Parameter | Numeric ID | 의미 |
| --- | ---: | --- |
| Gain | `1001` | Continuous, automatable, normalized `0..1` maps to `-60..+12 dB` |
| Bypass | `1002` | Toggle, automatable, VST3 bypass, default off |

Parameter ID는 Product ID, class FUID와 product name에서 derive하지 않고 project JSON에 저장하지
않는다. Template v1에서 변경하거나 삭제 후 다른 의미로 재사용하지 않는다.

## Compiler/runtime parity

Product Compiler는 Node built-in SHA-256으로 FUID를 derive해
[`product.garakbin`](compiled-product-data-v1.md)에 exact bytes를 기록한다. Product Runtime은 loaded
data의 Product ID에서 같은 algorithm을 독립적으로 계산하고 stored FUID 두 개와 비교한다. Nonzero와
processor/controller inequality만 검사하는 것으로 충분하지 않다.

Runtime factory와 controller association은 검증한 exact bytes만 사용한다. First-party inspector는
project-derived expected identity, compiled bytes, actual factory class IDs와 `moduleinfo.json`을 다시
대조한다. 어느 단계도 stale template identity 또는 Phase 1A/1B spike identity로 fallback하지 않는다.
