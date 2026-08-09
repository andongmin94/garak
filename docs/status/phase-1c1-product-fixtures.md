# Phase 1C.1 Product Fixtures

- 기준일: 2026-08-10
- 상태: Windows x64 reference fixture **PASS / Complete**
- 시작 baseline: `4203138f13a83e652c04405061fcd2c2ec362c27`
- 계획: [ExecPlan 0005](../../plans/0005-phase-1c1-product-contracts-and-headless-windows-export.md)
- 검증: [Phase 1C.1 Headless Export Validation](phase-1c1-headless-export-validation.md)
- 계약: [Minimal Garak Product Project](../architecture/minimal-garak-product-project.md),
  [Product Identity Derivation](../architecture/product-identity-derivation.md),
  [Compiled Product Data v1](../architecture/compiled-product-data-v1.md),
  [Product State v1](../architecture/product-state-v1.md)

## 역할과 범위

이 문서는 Phase 1C.1의 두 editable `.garak` reference project와 그 project에서 결정적으로 파생된
identity, compiled data, state 및 Windows VST3 artifact의 exact fixture를 기록한다. Source project는
각각 exact lowercase `product.json` 한 file만 가진 unpacked directory package다. Production
single-file `.garak`, general DSP graph, custom editor, preset/asset container와 installer 형식은 이
fixture가 결정하지 않는다.

Windows v0.x의 prebuilt Runtime 선택은 [ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)에
한정해 Accepted다. Cross-platform 최종 전략의 권위인
[ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속 **Proposed**다.

## Editable project literals

| Field | Artist Gain Warm | Artist Gain Bright |
| --- | --- | --- |
| Source | `examples/products/artist-gain-warm.garak/product.json` | `examples/products/artist-gain-bright.garak/product.json` |
| `schemaVersion` | `1` | `1` |
| `productId` | `6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e` | `c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357` |
| `vendor` | `Garak Test Artist` | `Garak Test Artist` |
| `name` | `Artist Gain Warm` | `Artist Gain Bright` |
| `version` | `0.1.0` | `0.1.0` |
| `category` | `Fx` | `Fx` |
| `template` | `garak.gain-v1` | `garak.gain-v1` |
| `defaults.gainDb` | `-6.0` | `+3.0` |

FUID와 numeric Parameter ID는 source JSON에 저장하지 않는다. Product ID를 identity root로 사용하며
template가 parameter table을 부여한다.

## Derived identity와 parameter literals

| Product | Processor FUID | Controller FUID | Gain default normalized |
| --- | --- | --- | ---: |
| Artist Gain Warm | `3BA93DD6A062C97D89EC78F3652F83C4` | `00DD9000A50F7F28F4AE084CD29C4330` | `0.75` |
| Artist Gain Bright | `FCB1FDAED3D981A2AE3AE5A20898C449` | `32D933DFBD3C8110E014829EF5D62EA3` | `0.875` |

두 제품의 Gain ID는 `1001`, Bypass ID는 `1002`이고 Bypass default는 normalized `0.0`이다. Identity
algorithm의 production 구현과 별개인 세 번째 literal vector도 다음 값으로 통과했다.

| Product ID | Processor FUID | Controller FUID |
| --- | --- | --- |
| `123e4567-e89b-12d3-a456-426614174000` | `34041DA416A3944588F29506953A3098` | `AD919FFE93E7D3CFE766C7AED441B4A6` |

Name, vendor, version, project/output path와 CWD를 바꾸어도 Product ID와 두 FUID가 바뀌지 않는다는
독립 test를 통과했다. Folder copy만으로 새 product가 되지는 않으며 같은 Product ID의 renamed product를
동시에 export하려는 batch는 collision으로 거부한다.

## Compiled Product Data v1 fixtures

`product.garakbin`은 exact `GARAKCPD` major `1`, minor `0`, 96-byte header와 두 24-byte parameter
record를 가진 little-endian first-party binary다. Phase 1B의 ASCII spike descriptor와 parser를
재사용하거나 fallback하지 않는다.

| Product | Bytes | SHA-256 |
| --- | ---: | --- |
| Artist Gain Warm | 177 | `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` |
| Artist Gain Bright | 179 | `ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52` |

Whitespace/key order, source timestamp, absolute source/output path와 CWD가 달라도 동일 logical project의
compiled bytes는 같다. TypeScript encoder/independent decoder와 C++ parser는 exact literal, size,
FUID recomputation, UTF-8, parameter ordering/default, zero-reserved 및 malformed/trailing input을 서로
독립적으로 검증했다.

## Product State v1 fixtures

Product Runtime은 Phase 1A/1B의 20-byte `GGS1` codec 대신 Product ID에 bind된 exact 96-byte
`GARAKPST` major `1`, minor `0` state를 사용한다.

| Product default state | Bytes | SHA-256 |
| --- | ---: | --- |
| Artist Gain Warm | 96 | `ACF05182BE9A5BD474C1048C65C045F4DB8DA1A7998A3704104D156813F13924` |
| Artist Gain Bright | 96 | `9B2641E69CDB5887EC1BBE4C4ACA85FA1A28AB39D734FAE461107047F445D7A4` |

Processor/controller round trip, cross-product rejection, corrupt/truncated/trailing/unknown/duplicate parameter
거부와 failure 뒤 prior live state 보존을 검증했다. Phase 1A/1B state는 원래 spike module에서만 계속
동작하고 Product Runtime의 compatibility input이 아니다.

## Final Windows VST3 artifacts

아래 값은 final Debug/Release export를 다시 inventory하고 hash한
`out/reports/vst3/product-runtime/artifact-summary.json`의 exact 결과다. `Bundle bytes`는 세 file의
byte 합이며 filesystem directory metadata는 포함하지 않는다.

| Config | Product | Runtime bytes / SHA-256 | Compiled bytes / SHA-256 | `moduleinfo.json` bytes / SHA-256 | Bundle bytes | Files | PE |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Debug | Warm | 1,755,136 / `BD9244B7B01C1EE2A3CAEA13A422D65B9A6EEFEF644DD63CE6DEB4DA7B1A4044` | 177 / `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` | 1,039 / `F780F3DE2D42325A3722584207C17EFCB87A7A9E30D23639FB982C61DED947B4` | 1,756,352 | 3 | `0x8664` |
| Debug | Bright | 1,755,136 / `BD9244B7B01C1EE2A3CAEA13A422D65B9A6EEFEF644DD63CE6DEB4DA7B1A4044` | 179 / `ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52` | 1,045 / `F187C9232AF570D3347655813000759AC0D1D0655ABB65F1485B291E17F0FBFC` | 1,756,360 | 3 | `0x8664` |
| Release | Warm | 714,752 / `219A69676C2E62BD73A3D8C8394CD862DB3C8F94D622E6272A8502260F1EC6E6` | 177 / `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` | 1,039 / `F780F3DE2D42325A3722584207C17EFCB87A7A9E30D23639FB982C61DED947B4` | 715,968 | 3 | `0x8664` |
| Release | Bright | 714,752 / `219A69676C2E62BD73A3D8C8394CD862DB3C8F94D622E6272A8502260F1EC6E6` | 179 / `ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52` | 1,045 / `F187C9232AF570D3347655813000759AC0D1D0655ABB65F1485B291E17F0FBFC` | 715,976 | 3 | `0x8664` |

각 final bundle inventory는 정확히 다음 세 file이다.

```text
<Product Name>.vst3/
  Contents/x86_64-win/<Product Name>.vst3
  Contents/Resources/product.garakbin
  Contents/Resources/moduleinfo.json
```

Configuration 안에서 Warm/Bright inner Runtime bytes는 완전히 같고 product data와 moduleinfo는
서로 다르다. 같은 product의 compiled data와 moduleinfo는 Debug/Release에서 byte-identical하며,
Runtime binary만 configuration에 따라 다르다. Bundle 이름과 inner module filename에는 Garak branding을
강제하지 않았고 output은 repository-local `out/exports/phase-1c1/<debug|release>/`에만 생성했다.

## Supplementary-plane Unicode export fixture

Product ID literal vector로도 사용하는 `123e4567-e89b-12d3-a456-426614174000`을 exact Unicode
process-boundary fixture에 재사용했다. 이 fixture는 tracked reference product가 아니라 ignored
`out/test-fixtures/유니코드-경계.garak/product.json`의 final local evidence다.

| Field | Exact value |
| --- | --- |
| Vendor | `가락 연구소 🧪` |
| Product / bundle leaf | `가락 🎛 Gain` / `가락 🎛 Gain.vst3` |
| Product ID | `123e4567-e89b-12d3-a456-426614174000` |
| Processor / Controller FUID | `34041DA416A3944588F29506953A3098` / `AD919FFE93E7D3CFE766C7AED441B4A6` |
| Default | -3.0 dB |
| Debug Runtime | 1,755,136 bytes / `BD9244B7B01C1EE2A3CAEA13A422D65B9A6EEFEF644DD63CE6DEB4DA7B1A4044` |
| Compiled data | 181 bytes / `E19AE344DC3E73313195E889D63512F9E002A002BD3FFEA8D0691CA859399E03` |
| `moduleinfo.json` | 1,051 bytes / `1AFBB64A281CFAABA582D044C03589FCCC2BAD1D1D8A260DF1D3E636BD5F4935` |
| Bundle file-byte sum | 1,756,368 bytes |

Final bundle inventory는 Unicode leaf를 보존한 exact three files다.

```text
가락 🎛 Gain.vst3/
  Contents/x86_64-win/가락 🎛 Gain.vst3
  Contents/Resources/product.garakbin
  Contents/Resources/moduleinfo.json
```

Official moduleinfotool create/validate, first-party inspector와 official Validator standard/extensive의
다섯 child process는 모두 exit 0이었다. 이 fixture는 Korean BMP text뿐 아니라 `🎛`, `🧪` 같은
supplementary-plane character가 project → compiled data → Windows process arguments/path → factory
`PClassInfoW` → moduleinfo와 official host tools를 통과한다는 bounded Windows x64 evidence다.

## 이 fixture가 증명하지 않는 것

- macOS arm64/x86_64/Universal VST3, AU, code signing, notarization과 installer
- Windows/macOS 실제 DAW scan/load/automation/state restore
- Production single-file `.garak`, general graph/scene/preset/asset와 schema migration
- Custom editor/native renderer, Studio workspace/IPC와 Phase 1C.2 UX
- Commercial redistribution, full license/notice/trademark/security approval

이 항목은 첫 상용 배포 전 cross-platform release gate와 후속 제품 milestone에서 별도 검증한다.
