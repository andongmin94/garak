# Garak Compiled Product Data v1

- 상태: Phase 1C.1 normative binary contract
- Resource path: `Contents/Resources/product.garakbin`
- Magic/version: `GARAKCPD`, major `1`, minor `0`
- 관련 문서: [Minimal Garak Product Project](minimal-garak-product-project.md), [Product Identity Derivation](product-identity-derivation.md), [Product State v1](product-state-v1.md), [ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)

## 목적과 경계

`Garak Compiled Product Data v1`은 strict하게 검증한 editable project를 `Garak Product Runtime v1`이
읽는 bounded immutable representation으로 낮춘다. 현재 format은 `garak.gain-v1`의 product identity,
metadata와 Gain/Bypass parameter default만 표현한다. General graph container, preset archive 또는
authoring project serialization이 아니다.

이 binary는 Phase 1B Alternative A의 ASCII 11-line
`Contents/Resources/garak-product-spike-v1.txt`와 완전히 별개다. Product Runtime은 Phase 1B
descriptor를 읽거나 `GARAKCPD` failure를 descriptor fallback으로 우회하지 않는다. Phase 1B Runtime과
descriptor는 regression fixture로 그대로 남는다.

## Common encoding rules

- 모든 multi-byte numeric field는 little-endian이다.
- Integer width는 표에 지정한 `uint16`/`uint32`로 고정한다.
- Normalized value는 IEEE-754 binary64 raw bit representation을 little-endian으로 기록한다.
- UUID와 FUID는 integer/Windows GUID가 아니라 exact 16-byte sequence다.
- Vendor/name은 length field가 지정한 BOM 없는 valid UTF-8 bytes이며 NUL terminator를 저장하지 않는다.
- Field 순서와 byte width는 고정하고 raw C++ struct, compiler padding, pointer와 `size_t`를 serialize하지
  않는다.
- 모든 reserved field와 header flags는 zero여야 한다. Parameter flags는 아래 table의 exact
  `0x0001`/`0x0003` 값만 허용하며 그 밖의 bit는 허용하지 않는다.
- Timestamp, source/output path, CWD, user, machine, PID, build directory와 random value를 포함하지 않는다.

Product ID bytes는 canonical UUID text의 hyphen을 제거하고 왼쪽부터 두 hex digit씩 읽은 표준 textual
order다. 예를 들어 Warm Product ID는 `6F0E50F1A2D44B378C9E1F2A3B4C5D6E`다. Windows GUID memory
order로 바꾸지 않는다. Processor/Controller FUID도
[identity algorithm](product-identity-derivation.md)의 digest byte order 그대로다.

## File layout

File은 96-byte header, vendor bytes, name bytes와 정확히 두 24-byte parameter record로 구성된다.

```text
96-byte header
vendorLength bytes UTF-8 vendor
nameLength bytes UTF-8 product name
24-byte Gain record
24-byte Bypass record
EOF
```

Exact total size formula:

```text
totalSize = 96 + vendorLength + nameLength + (2 * 24)
```

Vendor limit 63 bytes와 name limit 52 bytes에서 v1 maximum file size는 259 bytes다. Runtime loader는
bounded read 전에 이 maximum을 적용한다.

## 96-byte header

| Offset | Width | Encoding | Required v1 value/meaning |
| ---: | ---: | --- | --- |
| `0` | 8 | ASCII bytes | Magic `GARAKCPD` (`47 41 52 41 4B 43 50 44`) |
| `8` | 2 | `uint16` | Format major `1` |
| `10` | 2 | `uint16` | Format minor `0` |
| `12` | 4 | `uint32` | Header size `96` |
| `16` | 4 | `uint32` | Exact file total size |
| `20` | 4 | `uint32` | Header flags, exactly `0` |
| `24` | 4 | `uint32` | Reserved, exactly `0` |
| `28` | 16 | bytes | Non-nil Product ID |
| `44` | 16 | bytes | Derived Processor FUID |
| `60` | 16 | bytes | Derived Controller FUID |
| `76` | 2 | `uint16` | Product semantic version major |
| `78` | 2 | `uint16` | Product semantic version minor |
| `80` | 2 | `uint16` | Product semantic version patch |
| `82` | 2 | `uint16` | Category enum `1 = Fx` |
| `84` | 4 | `uint32` | Template ID `1 = garak.gain-v1` |
| `88` | 2 | `uint16` | Vendor UTF-8 byte length, `1..63` |
| `90` | 2 | `uint16` | Product name UTF-8 byte length, `1..52` |
| `92` | 2 | `uint16` | Parameter record count, exactly `2` |
| `94` | 2 | `uint16` | Reserved, exactly `0` |

Product version is the source `major.minor.patch` parsed into three `uint16` values. Prerelease/build syntax and
component values above `65535` are rejected at project validation rather than truncated.

Vendor/name bytes must decode strictly as UTF-8, contain no embedded NUL or Unicode control
`U+0000..U+001F`/`U+007F..U+009F`, and not be empty or whitespace-only. Product name must also satisfy the
[Windows leaf policy](minimal-garak-product-project.md#windows-product-name-policy). Padding or terminator bytes
between strings and parameter records are not allowed.

## 24-byte parameter record

Record offsets are relative to the record start.

| Offset | Width | Encoding | Meaning |
| ---: | ---: | --- | --- |
| `0` | 4 | `uint32` | Stable numeric Parameter ID |
| `4` | 2 | `uint16` | Value type enum |
| `6` | 2 | `uint16` | Parameter flags |
| `8` | 8 | IEEE-754 binary64 | Normalized default |
| `16` | 4 | `uint32` | Reserved, exactly `0` |
| `20` | 4 | `uint32` | Reserved, exactly `0` |

Value type enum:

| Value | Meaning |
| ---: | --- |
| `1` | Continuous normalized parameter |
| `2` | Toggle normalized parameter |

Flag bits:

| Bit | Value | Meaning |
| ---: | ---: | --- |
| 0 | `0x0001` | Automatable/public |
| 1 | `0x0002` | Host bypass parameter |

All other flag bits are unknown and invalid in v1. Exact table:

| Order | ID | Type | Flags | Default contract |
| ---: | ---: | ---: | ---: | --- |
| 1 | `1001` | `1` | `0x0001` | Gain: finite normalized `(gainDb + 60.0) / 72.0`, range `0..1` |
| 2 | `1002` | `2` | `0x0003` | Bypass: canonical positive `0.0` |

Compiler는 records를 numeric ID ascending order로 항상 emit한다. Runtime은 count만 맞는 임의 table을
허용하지 않고 exact IDs/order/type/flags/default semantics를 검증한다. Duplicate, swapped, missing 또는
unknown ID는 invalid다.

## Sectionless v1 and unknown-feature policy

Version 1은 section directory, optional extension block 또는 “skip unknown” mechanism이 없는
**sectionless fixed schema**다. Header 뒤의 모든 byte는 두 length-bound strings 또는 두 mandatory
parameter records에 속한다.

따라서 parser는 unknown mandatory content를 조용히 건너뛸 수 없다.

- Nonzero header flag/reserved field는 unknown required feature로 보고 거부한다.
- Header size `96`, parameter count `2`와 exact total-size formula가 다르면 거부한다.
- Unknown category, template, parameter ID/type/flag 또는 unexpected body shape를 거부한다.
- Declared total 뒤의 trailing byte와 header/string/record extension을 거부한다.
- Unknown minor version을 current layout으로 추측하지 않고 거부한다.

향후 field/section이 필요하면 지원 version과 parser를 명시적으로 추가한다. v1 parser에 optional skip,
Phase 1B descriptor fallback 또는 compatibility heuristic을 넣지 않는다.

## Normative Warm fixture

Logical input:

| Field | Value |
| --- | --- |
| Product ID | `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` |
| Vendor | `Garak Test Artist` (17 bytes) |
| Name | `Artist Gain Warm` (16 bytes) |
| Version | `0.1.0` |
| Processor FUID | `3BA93DD6A062C97D89EC78F3652F83C4` |
| Controller FUID | `00DD9000A50F7F28F4AE084CD29C4330` |
| Gain default | `-6.0 dB = 0.75 normalized` |
| Bypass default | off, `0.0 normalized` |

Exact file length is 177 bytes. Exact bytes, shown as 16 bytes per line except the final line:

```text
474152414B4350440100000060000000
B100000000000000000000006F0E50F1
A2D44B378C9E1F2A3B4C5D6E3BA93DD6
A062C97D89EC78F3652F83C400DD9000
A50F7F28F4AE084CD29C433000000100
00000100010000001100100002000000
476172616B2054657374204172746973
74417274697374204761696E20576172
6DE903000001000100000000000000E8
3F0000000000000000EA030000020003
00000000000000000000000000000000
00
```

SHA-256 of these 177 bytes:

```text
3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9
```

The hash is an external conformance fixture, not a hash field embedded in the format.

## Bright fixture summary

Bright uses Product ID `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357`, processor FUID
`FCB1FDAED3D981A2AE3AE5A20898C449`, controller FUID
`32D933DFBD3C8110E014829EF5D62EA3`, name `Artist Gain Bright` (18 bytes) and Gain default
`+3.0 dB = 0.875 normalized`. Its exact size is 179 bytes and SHA-256 is:

```text
ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52
```

## Strict parser and commit boundary

Runtime parsing is non-realtime and follows validate-then-commit semantics.

1. Reject missing file and physical size outside `146..259` before unbounded allocation. The practical minimum
   also requires nonempty vendor/name and exactly two records.
2. Read the bounded file completely and compare physical length with header `totalSize`.
3. Validate magic, exact `1.0` format, header size, flags/reserved and all length arithmetic with overflow-safe
   operations.
4. Decode Product ID, strict UTF-8 metadata, category/template/version and exact parameter table into temporary
   first-party values.
5. Recompute processor/controller FUIDs from Product ID and compare exact bytes. Reject nil, mismatch or
   processor/controller equality.
6. Validate every normalized value and reserved bit, and require the parser cursor to equal EOF.
7. Publish one immutable product value only after all checks pass.

Failure never exposes a partial factory, partially updated identity/default or stale template metadata. File I/O,
SHA-256, UTF-8 parsing and validation finish before factory publication and never run in the audio process callback.

## Determinism

The compiler serializes the validated logical model, not source JSON text. Repeated compilation of equivalent
content must produce identical bytes and hash despite JSON key order/whitespace, source timestamp, absolute path,
CWD, output directory, machine or user. Name/vendor/version edits change their compiled fields and therefore may
change the binary hash, but Product ID-derived FUIDs remain stable.
