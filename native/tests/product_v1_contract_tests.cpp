#include "product_v1_test_fixtures.hpp"

#include "garak/runtime/product_v1/compiled_product.hpp"
#include "garak/runtime/product_v1/product_state.hpp"

#include <algorithm>
#include <array>
#include <bit>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <span>
#include <string>
#include <string_view>
#include <vector>

namespace {

using garak::runtime::product_v1::CompiledProduct;
using garak::runtime::product_v1::Identifier;
using garak::runtime::product_v1::IdentityRole;
using garak::runtime::product_v1::ProductState;
using garak::test::product_v1::kBrightCompiledProduct;
using garak::test::product_v1::kBrightControllerFuid;
using garak::test::product_v1::kBrightDefaultState;
using garak::test::product_v1::kBrightProcessorFuid;
using garak::test::product_v1::kWarmCompiledProduct;
using garak::test::product_v1::kWarmControllerFuid;
using garak::test::product_v1::kWarmDefaultState;
using garak::test::product_v1::kWarmProcessorFuid;
using garak::test::product_v1::kWarmProductId;

class TestContext final {
public:
  void expect(const bool condition, const std::string_view message) noexcept {
    if (!condition) {
      std::fprintf(stderr, "FAIL: %.*s\n", static_cast<int>(message.size()), message.data());
      ++failures_;
    }
  }

  [[nodiscard]] int result() const noexcept { return failures_ == 0 ? EXIT_SUCCESS : EXIT_FAILURE; }

private:
  int failures_{};
};

template <std::size_t Size>
[[nodiscard]] std::vector<std::uint8_t>
copy_fixture(const std::array<std::uint8_t, Size>& fixture) {
  return {fixture.begin(), fixture.end()};
}

void write_u16(std::vector<std::uint8_t>& bytes, const std::size_t offset,
               const std::uint16_t value) {
  bytes[offset] = static_cast<std::uint8_t>(value);
  bytes[offset + 1] = static_cast<std::uint8_t>(value >> 8U);
}

void write_u32(std::vector<std::uint8_t>& bytes, const std::size_t offset,
               const std::uint32_t value) {
  for (std::size_t index = 0; index < 4; ++index) {
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
  }
}

void write_u64(std::vector<std::uint8_t>& bytes, const std::size_t offset,
               const std::uint64_t value) {
  for (std::size_t index = 0; index < 8; ++index) {
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
  }
}

[[nodiscard]] std::vector<std::uint8_t> compiled_with_metadata(const std::string_view vendor,
                                                               const std::string_view name) {
  constexpr std::size_t kWarmParameterOffset = 129;
  std::vector<std::uint8_t> result(kWarmCompiledProduct.begin(), kWarmCompiledProduct.begin() + 96);
  for (const auto character : vendor) {
    result.push_back(static_cast<std::uint8_t>(character));
  }
  for (const auto character : name) {
    result.push_back(static_cast<std::uint8_t>(character));
  }
  result.insert(result.end(), kWarmCompiledProduct.begin() + kWarmParameterOffset,
                kWarmCompiledProduct.end());
  write_u32(result, 16, static_cast<std::uint32_t>(result.size()));
  write_u16(result, 88, static_cast<std::uint16_t>(vendor.size()));
  write_u16(result, 90, static_cast<std::uint16_t>(name.size()));
  return result;
}

void expect_invalid_compiled(TestContext& test, const std::vector<std::uint8_t>& bytes,
                             const std::string_view message) {
  test.expect(!garak::runtime::product_v1::parse_compiled_product(bytes).has_value(), message);
}

void check_valid_compiled_products(TestContext& test) {
  const auto warm = garak::runtime::product_v1::parse_compiled_product(kWarmCompiledProduct);
  test.expect(warm.has_value(), "literal Warm compiled product parses");
  if (warm) {
    test.expect(warm->product_id == kWarmProductId, "Warm Product ID is exact");
    test.expect(warm->processor_fuid == kWarmProcessorFuid, "Warm processor FUID is exact");
    test.expect(warm->controller_fuid == kWarmControllerFuid, "Warm controller FUID is exact");
    test.expect(warm->vendor == "Garak Test Artist" && warm->name == "Artist Gain Warm",
                "Warm white-label metadata is exact");
    test.expect(warm->version == garak::runtime::product_v1::SemanticVersion{0, 1, 0},
                "Warm semantic version is exact");
    test.expect(warm->parameters[0].id == 1001 && warm->parameters[0].default_normalized == 0.75 &&
                    warm->parameters[1].id == 1002 && warm->parameters[1].default_normalized == 0.0,
                "Warm parameter table and defaults are exact");
  }
  const auto bright = garak::runtime::product_v1::parse_compiled_product(kBrightCompiledProduct);
  test.expect(bright.has_value() && bright->processor_fuid == kBrightProcessorFuid &&
                  bright->controller_fuid == kBrightControllerFuid &&
                  bright->parameters[0].default_normalized == 0.875,
              "literal Bright compiled product parses with exact identity and default");
}

void check_identity_vectors(TestContext& test) {
  test.expect(garak::runtime::product_v1::derive_fuid(kWarmProductId, IdentityRole::processor) ==
                  kWarmProcessorFuid,
              "Warm processor derivation matches the independent literal");
  test.expect(garak::runtime::product_v1::derive_fuid(kWarmProductId, IdentityRole::controller) ==
                  kWarmControllerFuid,
              "Warm controller derivation matches the independent literal");
  test.expect(garak::runtime::product_v1::derive_fuid(garak::test::product_v1::kBrightProductId,
                                                      IdentityRole::processor) ==
                  kBrightProcessorFuid,
              "Bright processor derivation matches the independent literal");
  test.expect(garak::runtime::product_v1::derive_fuid(garak::test::product_v1::kBrightProductId,
                                                      IdentityRole::controller) ==
                  kBrightControllerFuid,
              "Bright controller derivation matches the independent literal");
  constexpr Identifier third_product{0x12, 0x3E, 0x45, 0x67, 0xE8, 0x9B, 0x12, 0xD3,
                                     0xA4, 0x56, 0x42, 0x66, 0x14, 0x17, 0x40, 0x00};
  constexpr Identifier third_processor{0x34, 0x04, 0x1D, 0xA4, 0x16, 0xA3, 0x94, 0x45,
                                       0x88, 0xF2, 0x95, 0x06, 0x95, 0x3A, 0x30, 0x98};
  constexpr Identifier third_controller{0xAD, 0x91, 0x9F, 0xFE, 0x93, 0xE7, 0xD3, 0xCF,
                                        0xE7, 0x66, 0xC7, 0xAE, 0xD4, 0x41, 0xB4, 0xA6};
  test.expect(garak::runtime::product_v1::derive_fuid(third_product, IdentityRole::processor) ==
                      third_processor &&
                  garak::runtime::product_v1::derive_fuid(
                      third_product, IdentityRole::controller) == third_controller,
              "third independent processor/controller vector is exact");
  test.expect(garak::runtime::product_v1::canonical_product_id(kWarmProductId) ==
                      "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e" &&
                  garak::runtime::product_v1::identifier_hex(kWarmProcessorFuid) ==
                      "3BA93DD6A062C97D89EC78F3652F83C4",
              "canonical Product ID and uppercase FUID formatting are exact");
}

void check_compiled_failures(TestContext& test) {
  constexpr std::size_t kWarmParameterOffset = 129;
  constexpr std::size_t kWarmBypassOffset = kWarmParameterOffset + 24;
  test.expect(garak::runtime::product_v1::parse_compiled_product(
                  compiled_with_metadata(std::string(63, 'V'), std::string(52, 'N')))
                  .has_value(),
              "63-byte vendor and 52-byte product-name boundaries are valid");
  auto bytes = copy_fixture(kWarmCompiledProduct);
  bytes[0] ^= 0xFFU;
  expect_invalid_compiled(test, bytes, "bad compiled magic is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, 8, 2);
  expect_invalid_compiled(test, bytes, "unsupported compiled major is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, 10, 1);
  expect_invalid_compiled(test, bytes, "unsupported compiled minor is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, 12, 95);
  expect_invalid_compiled(test, bytes, "wrong compiled header size is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, 16, 176);
  expect_invalid_compiled(test, bytes, "wrong compiled total size is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, 20, 1);
  expect_invalid_compiled(test, bytes, "unknown compiled flags are rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, 24, 1);
  expect_invalid_compiled(test, bytes, "nonzero compiled header reserved field is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, 94, 1);
  expect_invalid_compiled(test, bytes, "nonzero compiled tail reserved field is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  std::fill(bytes.begin() + 28, bytes.begin() + 44, std::uint8_t{0});
  expect_invalid_compiled(test, bytes, "nil Product ID is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  bytes[44] ^= 1U;
  expect_invalid_compiled(test, bytes, "processor FUID mismatch is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  bytes[60] ^= 1U;
  expect_invalid_compiled(test, bytes, "controller FUID mismatch is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  std::copy(bytes.begin() + 44, bytes.begin() + 60, bytes.begin() + 60);
  expect_invalid_compiled(test, bytes, "processor/controller FUID collision is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, 82, 2);
  expect_invalid_compiled(test, bytes, "unknown category enum is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, 84, 2);
  expect_invalid_compiled(test, bytes, "unknown template ID is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  bytes[96] = 0xC0U;
  expect_invalid_compiled(test, bytes, "malformed vendor UTF-8 is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", std::string_view("\xC0", 1)),
                          "malformed product-name UTF-8 is rejected");
  expect_invalid_compiled(test, compiled_with_metadata(std::string_view("Ga\0rak", 6), "Warm"),
                          "embedded vendor NUL is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", std::string_view("Wa\x1Frm", 5)),
                          "embedded product-name control is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("\xEF\xBB\xBFGarak", "Warm"),
                          "vendor UTF-8 BOM is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", "Wa\xEF\xBB\xBFrm"),
                          "embedded product-name U+FEFF is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  for (std::size_t offset = 96; offset < 111; offset += 3) {
    bytes[offset] = 0xE3U;
    bytes[offset + 1] = 0x80U;
    bytes[offset + 2] = 0x80U;
  }
  bytes[111] = 0x20U;
  bytes[112] = 0x20U;
  expect_invalid_compiled(test, bytes, "Unicode-whitespace-only vendor is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("", "Warm"),
                          "empty vendor is rejected after structural validation");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", ""),
                          "empty product name is rejected after structural validation");
  expect_invalid_compiled(test, compiled_with_metadata(std::string(64, 'V'), "Warm"),
                          "vendor length above 63 bytes is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", std::string(53, 'N')),
                          "product-name length above 52 bytes is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", "CON"),
                          "Windows reserved product name is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", "conin$.v1"),
                          "Windows CONIN$ stem is rejected case-insensitively");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", "CONOUT$"),
                          "Windows CONOUT$ stem is rejected");
  for (const auto reserved :
       std::array<std::string_view, 6>{"COM\xC2\xB9", "COM\xC2\xB2", "COM\xC2\xB3", "LPT\xC2\xB9",
                                       "LPT\xC2\xB2", "LPT\xC2\xB3"}) {
    expect_invalid_compiled(test, compiled_with_metadata("Garak", reserved),
                            "Windows superscript device stem is rejected");
  }
  expect_invalid_compiled(test, compiled_with_metadata("Garak", "com\xC2\xB9.txt"),
                          "Windows superscript device stem rejects suffixes case-insensitively");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", "Warm."),
                          "trailing product-name period is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", "Warm "),
                          "trailing product-name space is rejected");
  expect_invalid_compiled(test, compiled_with_metadata("Garak", "Bad<Name"),
                          "Windows-invalid product-name character is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, 92, 1);
  expect_invalid_compiled(test, bytes, "missing parameter is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, kWarmParameterOffset + 24, 1001);
  expect_invalid_compiled(test, bytes, "duplicate parameter ID is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, kWarmParameterOffset, 1003);
  expect_invalid_compiled(test, bytes, "unknown parameter ID is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  std::swap_ranges(bytes.begin() + kWarmParameterOffset, bytes.begin() + kWarmParameterOffset + 24,
                   bytes.begin() + kWarmBypassOffset);
  expect_invalid_compiled(test, bytes, "swapped parameter records are rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, kWarmParameterOffset + 4, 2);
  expect_invalid_compiled(test, bytes, "wrong parameter type is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, kWarmParameterOffset + 4, 0x0101);
  expect_invalid_compiled(test, bytes, "high-byte parameter type corruption is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, kWarmParameterOffset + 6, 0);
  expect_invalid_compiled(test, bytes, "wrong parameter flags are rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, kWarmParameterOffset + 6, 0x0101);
  expect_invalid_compiled(test, bytes, "high-byte parameter flag corruption is rejected");
  for (const auto value : std::array<double, 6>{
           std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity(),
           -std::numeric_limits<double>::infinity(), -0.0, -0.1, 1.1}) {
    bytes = copy_fixture(kWarmCompiledProduct);
    write_u64(bytes, kWarmParameterOffset + 8, std::bit_cast<std::uint64_t>(value));
    expect_invalid_compiled(test, bytes, "invalid Gain default is rejected");
  }
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, kWarmParameterOffset + 16, 1);
  expect_invalid_compiled(test, bytes, "first parameter reserved word one is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, kWarmParameterOffset + 20, 1);
  expect_invalid_compiled(test, bytes, "first parameter reserved word two is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, kWarmBypassOffset + 4, 1);
  expect_invalid_compiled(test, bytes, "wrong Bypass type is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u16(bytes, kWarmBypassOffset + 6, 1);
  expect_invalid_compiled(test, bytes, "wrong Bypass flags are rejected");
  for (const auto value : std::array<double, 6>{
           std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity(),
           -std::numeric_limits<double>::infinity(), -0.0, 0.5, 1.0}) {
    bytes = copy_fixture(kWarmCompiledProduct);
    write_u64(bytes, kWarmBypassOffset + 8, std::bit_cast<std::uint64_t>(value));
    expect_invalid_compiled(test, bytes, "invalid Bypass default is rejected");
  }
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, kWarmBypassOffset + 16, 1);
  expect_invalid_compiled(test, bytes, "second parameter reserved word one is rejected");
  bytes = copy_fixture(kWarmCompiledProduct);
  write_u32(bytes, kWarmBypassOffset + 20, 1);
  expect_invalid_compiled(test, bytes, "second parameter reserved word two is rejected");
  for (std::size_t length = 0; length < kWarmCompiledProduct.size(); ++length) {
    bytes.assign(kWarmCompiledProduct.begin(),
                 kWarmCompiledProduct.begin() + static_cast<std::ptrdiff_t>(length));
    expect_invalid_compiled(test, bytes, "every truncated compiled-product length is rejected");
  }
  bytes = copy_fixture(kWarmCompiledProduct);
  bytes.push_back(0);
  write_u32(bytes, 16, static_cast<std::uint32_t>(bytes.size()));
  expect_invalid_compiled(test, bytes, "compiled trailing byte is rejected");
}

void expect_state_failure_preserves(TestContext& test, const std::vector<std::uint8_t>& bytes,
                                    const Identifier& product_id, const std::string_view message) {
  ProductState state{0.25, true};
  const ProductState before = state;
  test.expect(!garak::runtime::product_v1::decode_product_state(bytes, product_id, state) &&
                  state == before,
              message);
}

void check_product_state(TestContext& test) {
  garak::runtime::product_v1::EncodedProductState encoded{};
  test.expect(
      garak::runtime::product_v1::encode_product_state(kWarmProductId, {0.75, false}, encoded) &&
          encoded == kWarmDefaultState,
      "Product State encoder matches the exact 96-byte fixture");
  ProductState decoded{};
  test.expect(garak::runtime::product_v1::decode_product_state(kWarmDefaultState, kWarmProductId,
                                                               decoded) &&
                  decoded == ProductState{0.75, false},
              "Product State exact fixture round trips");
  garak::runtime::product_v1::EncodedProductState bright_encoded{};
  ProductState bright_decoded{};
  test.expect(
      garak::runtime::product_v1::encode_product_state(garak::test::product_v1::kBrightProductId,
                                                       {0.875, false}, bright_encoded) &&
          bright_encoded == kBrightDefaultState &&
          garak::runtime::product_v1::decode_product_state(
              kBrightDefaultState, garak::test::product_v1::kBrightProductId, bright_decoded) &&
          bright_decoded == ProductState{0.875, false},
      "Bright Product State encoder and decoder match the independent exact fixture");

  for (const auto& expected :
       std::array<ProductState, 4>{{{0.0, false}, {0.5, false}, {1.0, false}, {0.25, true}}}) {
    garak::runtime::product_v1::EncodedProductState canonical{};
    ProductState round_trip{};
    test.expect(
        garak::runtime::product_v1::encode_product_state(kWarmProductId, expected, canonical) &&
            garak::runtime::product_v1::decode_product_state(canonical, kWarmProductId,
                                                             round_trip) &&
            round_trip == expected,
        "Gain endpoints/interior and canonical Bypass values round trip");
  }

  auto bytes = copy_fixture(kWarmDefaultState);
  bytes[0] ^= 0xFFU;
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "bad state magic preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u16(bytes, 8, 2);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "unsupported state major preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u16(bytes, 10, 1);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "unsupported state minor preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u32(bytes, 12, 63);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "wrong state header size preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u32(bytes, 16, 95);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "wrong state total size preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u32(bytes, 20, 1);
  expect_state_failure_preserves(test, bytes, kWarmProductId, "state flags preserve prior state");
  bytes = copy_fixture(kWarmDefaultState);
  std::fill(bytes.begin() + 24, bytes.begin() + 40, std::uint8_t{0});
  expect_state_failure_preserves(test, bytes, Identifier{},
                                 "nil encoded and expected Product IDs are rejected");
  bytes = copy_fixture(kWarmDefaultState);
  bytes[24] ^= 1U;
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "wrong state Product ID preserves prior state");
  expect_state_failure_preserves(test, copy_fixture(kWarmDefaultState),
                                 garak::test::product_v1::kBrightProductId,
                                 "cross-product state is rejected without mutation");
  bytes = copy_fixture(kWarmDefaultState);
  write_u16(bytes, 40, 1);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "missing state parameter preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u16(bytes, 42, 15);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "wrong state entry size preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u32(bytes, 80, 1001);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "duplicate state parameter preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u32(bytes, 64, 1003);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "unknown state parameter preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  std::swap_ranges(bytes.begin() + 64, bytes.begin() + 80, bytes.begin() + 80);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "swapped state parameter records preserve prior state");
  bytes = copy_fixture(kWarmDefaultState);
  bytes[44] = 1;
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "state reserved bytes preserve prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u16(bytes, 68, 2);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "wrong Gain state type preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u16(bytes, 84, 1);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "wrong Bypass state type preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u16(bytes, 70, 1);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "Gain record flags preserve prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u16(bytes, 86, 1);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "Bypass record flags preserve prior state");
  for (const auto value : std::array<double, 6>{
           std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity(),
           -std::numeric_limits<double>::infinity(), -0.0, -0.1, 1.1}) {
    bytes = copy_fixture(kWarmDefaultState);
    write_u64(bytes, 72, std::bit_cast<std::uint64_t>(value));
    expect_state_failure_preserves(test, bytes, kWarmProductId,
                                   "invalid Gain encoding preserves prior state");
  }
  for (const auto value : std::array<double, 6>{
           std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity(),
           -std::numeric_limits<double>::infinity(), -0.0, 0.5, 1.1}) {
    bytes = copy_fixture(kWarmDefaultState);
    write_u64(bytes, 88, std::bit_cast<std::uint64_t>(value));
    expect_state_failure_preserves(test, bytes, kWarmProductId,
                                   "invalid Bypass encoding preserves prior state");
  }
  bytes = copy_fixture(kWarmDefaultState);
  write_u64(bytes, 72, std::bit_cast<std::uint64_t>(-0.1));
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "out-of-range state value preserves prior state");
  bytes = copy_fixture(kWarmDefaultState);
  write_u64(bytes, 88, std::bit_cast<std::uint64_t>(0.5));
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "non-boolean bypass preserves prior state");
  for (std::size_t length = 0; length < kWarmDefaultState.size(); ++length) {
    bytes.assign(kWarmDefaultState.begin(),
                 kWarmDefaultState.begin() + static_cast<std::ptrdiff_t>(length));
    expect_state_failure_preserves(test, bytes, kWarmProductId,
                                   "every truncated state length preserves prior state");
  }
  bytes = copy_fixture(kWarmDefaultState);
  bytes.push_back(0);
  expect_state_failure_preserves(test, bytes, kWarmProductId,
                                 "state trailing byte preserves prior state");
}

} // namespace

int main() {
  try {
    TestContext test;
    check_valid_compiled_products(test);
    check_identity_vectors(test);
    check_compiled_failures(test);
    check_product_state(test);
    return test.result();
  } catch (...) {
    std::fputs("Unhandled Product v1 contract test exception\n", stderr);
    return EXIT_FAILURE;
  }
}
