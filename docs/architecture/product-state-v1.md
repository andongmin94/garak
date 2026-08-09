# Garak Product State v1

- 상태: Phase 1C.1 normative DAW/plugin state contract
- Magic/version: `GARAKPST`, major `1`, minor `0`
- Exact encoded size: 96 bytes
- 관련 문서: [Product Identity Derivation](product-identity-derivation.md), [Compiled Product Data v1](compiled-product-data-v1.md), [Parameter와 state](parameter-and-state.md), [VST3 Adapter](vst3-adapter.md)

## 목적과 분리 경계

`Garak Product State v1`은 한 generated product instance의 host-visible Gain/Bypass 값을 저장하고
정확한 Product ID에 bind한다. Stable numeric Parameter ID를 사용하므로 record order가 UI order나
표시 이름에 의존하지 않는다.

이 format은 Phase 1A/1B의 exact 20-byte `GGS1` technical-spike state를 production contract로
승격하지 않는다. 기존 spike Runtime과 tests는 `GGS1`을 계속 사용하지만 새 `Garak Product Runtime
v1`은 그것을 읽거나 fallback/migration input으로 허용하지 않는다. 반대로 Phase 1A/1B code도
`GARAKPST`를 해석하지 않는다.

## Common encoding rules

- 모든 integer와 IEEE-754 binary64 value는 little-endian이다.
- UUID는 canonical textual hex pair order의 exact 16 bytes다. Windows GUID memory order를 사용하지
  않는다.
- Field order와 width는 고정하고 raw C++ struct, padding, pointer와 `size_t`를 serialize하지 않는다.
- Header/record flags와 reserved bytes는 모두 zero다.
- State는 exact 96 bytes이고 trailing data 또는 padding을 허용하지 않는다.
- Parameter records는 numeric ID ascending order로 canonical하게 emit한다.

## 64-byte header

| Offset | Width | Encoding | Required v1 value/meaning |
| ---: | ---: | --- | --- |
| `0` | 8 | ASCII bytes | Magic `GARAKPST` (`47 41 52 41 4B 50 53 54`) |
| `8` | 2 | `uint16` | State major `1` |
| `10` | 2 | `uint16` | State minor `0` |
| `12` | 4 | `uint32` | Header size `64` |
| `16` | 4 | `uint32` | Exact total size `96` |
| `20` | 4 | `uint32` | Header flags, exactly `0` |
| `24` | 16 | bytes | Bound Product ID |
| `40` | 2 | `uint16` | Parameter entry count, exactly `2` |
| `42` | 2 | `uint16` | Parameter entry size, exactly `16` |
| `44` | 20 | bytes | Reserved, every byte `0` |

Product ID는 Runtime이 validated
[`product.garakbin`](compiled-product-data-v1.md)에서 소유한 Product ID와 byte-for-byte 같아야 한다.
다른 Garak 제품의 구조적으로 valid한 state도 mismatch로 거부한다.

## 16-byte parameter entry

Entry offsets are relative to entry start.

| Offset | Width | Encoding | Meaning |
| ---: | ---: | --- | --- |
| `0` | 4 | `uint32` | Stable numeric Parameter ID |
| `4` | 2 | `uint16` | Value type enum |
| `6` | 2 | `uint16` | Flags/reserved, exactly `0` |
| `8` | 8 | IEEE-754 binary64 | Normalized value |

Exact v1 entry table:

| Order | ID | Type | Value contract |
| ---: | ---: | ---: | --- |
| 1 | `1001` | `1` continuous | Finite normalized Gain in inclusive range `0.0..1.0` |
| 2 | `1002` | `2` toggle | Exactly canonical positive `0.0` or `1.0` |

Unknown type/flag, duplicate, missing, unknown 또는 unsorted Parameter ID를 거부한다. Bypass의 다른 finite
normalized 값에 threshold를 적용하거나 Gain을 clamp하지 않는다. State input은 already-canonical
representation이어야 한다.

## Normative Warm default fixture

Warm Product ID는 `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e`, Gain은 `0.75` (`-6.0 dB`),
Bypass는 `0.0`이다. Exact 96 bytes:

```text
474152414B5053540100000040000000
60000000000000006F0E50F1A2D44B37
8C9E1F2A3B4C5D6E0200100000000000
00000000000000000000000000000000
E903000001000000000000000000E83F
EA030000020000000000000000000000
```

SHA-256:

```text
ACF05182BE9A5BD474C1048C65C045F4DB8DA1A7998A3704104D156813F13924
```

The hash is a conformance fixture and is not embedded in the state.

## Bright default fixture summary

Bright Product ID는 `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357`, Gain은 `0.875` (`+3.0 dB`),
Bypass는 `0.0`이다. Exact size는 96 bytes이고 SHA-256은 다음과 같다.

```text
9B2641E69CDB5887EC1BBE4C4ACA85FA1A28AB39D734FAE461107047F445D7A4
```

## Decode and commit semantics

Codec는 input 전체를 temporary value로 parse/validate한 뒤 한 번에 commit한다.

1. Physical payload가 exact 96 bytes인지 확인한다.
2. Magic, exact version `1.0`, header/total/entry size, count와 모든 flags/reserved bytes를 확인한다.
3. State Product ID를 loaded immutable Product ID와 비교한다.
4. 두 entry의 sorted ID, exact type/flags와 value domain을 확인한다.
5. Parser cursor가 exact EOF인지 확인한다.
6. 두 parameter를 하나의 validated snapshot으로 publish한다.

Bad magic/version/size, truncated/trailing data, Product ID mismatch, duplicate/unknown/missing/unsorted ID,
nonfinite/out-of-range value와 nonzero reserved input은 failure다. Failure는 processor의 pending/live/saved
state와 controller parameter를 전혀 변경하지 않는다.

VST3 stream adapter도 codec에 exact payload를 전달해야 한다. Short-success read/write와 additional
payload를 성공으로 취급하지 않는다. Serializer는 항상 canonical 96 bytes를 한 번의 logical state로
생성한다.

## Processor and controller behavior

- Processor `setState`는 non-realtime boundary에서 decode하고 complete validated snapshot만 realtime
  handoff에 publish한다. Audio callback에서 stream I/O, parsing, allocation 또는 migration을 하지 않는다.
- Processor `getState`는 한 instance의 whole Gain/Bypass snapshot을 canonical record order로 encode한다.
- Controller `setComponentState`는 동일 codec과 expected Product ID를 사용하고 두 host parameter를
  complete validation 뒤에만 동기화한다.
- Processor state를 controller에 전달한 round trip은 exact normalized values를 보존한다.
- 각 module instance는 별도 mutable state를 가진다. 같은 module의 두 instance와 Warm/Bright 사이에
  product-global mutable Gain/Bypass storage를 두지 않는다.
- Product default는 compiled data에서 오지만 persisted state가 valid하면 state value가 default를
  대체한다. State failure 시 default나 zero로 조용히 reset하지 않고 prior state를 유지한다.

## Version and migration policy

현재 Runtime은 exact state version `1.0`만 지원한다. Unknown major/minor, larger header, extra record 또는
unknown Parameter ID를 v1로 추측하거나 건너뛰지 않는다. Phase 1A/1B `GGS1` input도 거부한다.

출시 후 schema 변화가 필요하면 source version, target version, Product ID/Parameter ID 의미와 explicit
migration step을 별도 결정한다. Migration이 필요한 경우에도 input boundary에서 current canonical
snapshot으로 변환한 뒤 현재 execution path만 사용한다. Obsolete codec을 audio/runtime fallback으로
영구 보존하는 방식은 허용하지 않는다.

## Required conformance cases

- Warm/Bright exact literal fixture와 encode/decode round trip
- Gain endpoints/interior, Bypass off/on과 canonical serialization
- Every truncated length, one-byte trailing input와 wrong total/header/entry size
- Bad magic, unsupported major/minor, nonzero header/record reserved bytes
- Nil/wrong/cross-product Product ID
- Duplicate, missing, unknown, swapped Parameter ID와 wrong type
- NaN, positive/negative infinity, Gain below/above range와 noncanonical Bypass
- Processor/controller parity and prior-state preservation after every failure
- Same-module multi-instance isolation, Warm/Bright isolation, unload/reload
- Regression that Phase 1A/1B 20-byte state remains accepted only by its original spike modules
