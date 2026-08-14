#include "garak/runtime/product_v1/compatibility.hpp"

#include "product_v1_test_fixtures.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <exception>
#include <iostream>
#include <string_view>

namespace {

using garak::runtime::product_v1::classify_compiled_product_compatibility;
using garak::runtime::product_v1::classify_product_state_compatibility;
using garak::runtime::product_v1::CompatibilityDisposition;
using garak::test::product_v1::kBrightProductId;
using garak::test::product_v1::kWarmCompiledProduct;
using garak::test::product_v1::kWarmDefaultState;
using garak::test::product_v1::kWarmProductId;

int failures = 0;

void expect(const bool condition, const std::string_view message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    ++failures;
  }
}

template <std::size_t Size>
std::array<std::uint8_t, Size> with_u16(const std::array<std::uint8_t, Size>& source,
                                        const std::size_t offset, const std::uint16_t value) {
  auto result = source;
  result[offset] = static_cast<std::uint8_t>(value);
  result[offset + 1] = static_cast<std::uint8_t>(value >> 8U);
  return result;
}

void test_compiled_product_policy() {
  const auto current = classify_compiled_product_compatibility(kWarmCompiledProduct);
  expect(current.disposition == CompatibilityDisposition::current, "current GARAKCPD must load");
  expect(current.version.available && current.version.major == 1 && current.version.minor == 0,
         "current GARAKCPD version must be 1.0");

  const auto old_bytes = with_u16(kWarmCompiledProduct, 8, 0);
  expect(classify_compiled_product_compatibility(old_bytes).disposition ==
             CompatibilityDisposition::rebuild_from_project,
         "older derived GARAKCPD must be rebuilt from the editable project");

  const auto future_major = with_u16(kWarmCompiledProduct, 8, 2);
  expect(classify_compiled_product_compatibility(future_major).disposition ==
             CompatibilityDisposition::reject_too_new,
         "future GARAKCPD major must be rejected");
  const auto future_minor = with_u16(kWarmCompiledProduct, 10, 1);
  expect(classify_compiled_product_compatibility(future_minor).disposition ==
             CompatibilityDisposition::reject_too_new,
         "future GARAKCPD minor must be rejected");

  auto corrupt = kWarmCompiledProduct;
  corrupt[16] = static_cast<std::uint8_t>(corrupt[16] + 1U);
  expect(classify_compiled_product_compatibility(corrupt).disposition ==
             CompatibilityDisposition::reject_invalid,
         "corrupt current GARAKCPD must be rejected");
}

void test_product_state_policy() {
  const auto current = classify_product_state_compatibility(kWarmDefaultState, kWarmProductId);
  expect(current.disposition == CompatibilityDisposition::current,
         "current same-product GARAKPST must restore");

  expect(classify_product_state_compatibility(kWarmDefaultState, kBrightProductId).disposition ==
             CompatibilityDisposition::reject_foreign_product,
         "state from another Product ID must be rejected");

  const auto old_bytes = with_u16(kWarmDefaultState, 8, 0);
  expect(classify_product_state_compatibility(old_bytes, kWarmProductId).disposition ==
             CompatibilityDisposition::reject_unsupported_old,
         "older state without an explicit migration must be rejected");
  const auto future_major = with_u16(kWarmDefaultState, 8, 2);
  expect(classify_product_state_compatibility(future_major, kWarmProductId).disposition ==
             CompatibilityDisposition::reject_too_new,
         "future state major must be rejected");
  const auto future_minor = with_u16(kWarmDefaultState, 10, 1);
  expect(classify_product_state_compatibility(future_minor, kWarmProductId).disposition ==
             CompatibilityDisposition::reject_too_new,
         "future state minor must be rejected");

  auto malformed = kWarmDefaultState;
  malformed[64] = 0;
  malformed[65] = 0;
  malformed[66] = 0;
  malformed[67] = 0;
  expect(classify_product_state_compatibility(malformed, kWarmProductId).disposition ==
             CompatibilityDisposition::reject_invalid,
         "malformed current state must be rejected");
}

} // namespace

int main() {
  try {
    test_compiled_product_policy();
    test_product_state_policy();
    if (failures != 0) {
      std::cerr << failures << " compatibility assertion(s) failed.\n";
      return 1;
    }
    std::cout << "Garak compiled-product and state compatibility policy passed.\n";
    return 0;
  } catch (const std::exception& error) {
    std::fprintf(stderr, "UNCAUGHT: %s\n", error.what());
    return 1;
  } catch (...) {
    std::fputs("UNCAUGHT: unknown compatibility test exception.\n", stderr);
    return 1;
  }
}
