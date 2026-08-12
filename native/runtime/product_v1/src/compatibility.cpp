#include "garak/runtime/product_v1/compatibility.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>

namespace garak::runtime::product_v1 {
namespace {

constexpr std::array<std::uint8_t, 8> kCompiledMagic{'G', 'A', 'R', 'A', 'K', 'C', 'P', 'D'};
constexpr std::array<std::uint8_t, 8> kStateMagic{'G', 'A', 'R', 'A', 'K', 'P', 'S', 'T'};
constexpr std::uint16_t kCurrentMajor = 1;
constexpr std::uint16_t kCurrentMinor = 0;

[[nodiscard]] bool has_magic(const std::span<const std::uint8_t> bytes,
                             const std::span<const std::uint8_t> magic) noexcept {
  return bytes.size() >= magic.size() &&
         std::equal(magic.begin(), magic.end(), bytes.begin());
}

[[nodiscard]] std::uint16_t read_u16(const std::span<const std::uint8_t> bytes,
                                     const std::size_t offset) noexcept {
  return static_cast<std::uint16_t>(bytes[offset]) |
         static_cast<std::uint16_t>(static_cast<std::uint16_t>(bytes[offset + 1]) << 8U);
}

[[nodiscard]] ArtifactVersion read_version(
    const std::span<const std::uint8_t> bytes) noexcept {
  if (bytes.size() < 12) {
    return {};
  }
  return {read_u16(bytes, 8), read_u16(bytes, 10), true};
}

[[nodiscard]] bool all_zero(const Identifier& identifier) noexcept {
  return std::all_of(identifier.begin(), identifier.end(),
                     [](const std::uint8_t value) { return value == 0; });
}

[[nodiscard]] CompatibilityReport version_decision(
    const ArtifactVersion version, const bool compiled) noexcept {
  if (!version.available) {
    return {CompatibilityDisposition::reject_invalid, version};
  }
  if (version.major < kCurrentMajor) {
    return {compiled ? CompatibilityDisposition::rebuild_from_project
                     : CompatibilityDisposition::reject_unsupported_old,
            version};
  }
  if (version.major > kCurrentMajor ||
      (version.major == kCurrentMajor && version.minor > kCurrentMinor)) {
    return {CompatibilityDisposition::reject_too_new, version};
  }
  return {CompatibilityDisposition::current, version};
}

} // namespace

CompatibilityReport classify_compiled_product_compatibility(
    const std::span<const std::uint8_t> bytes) noexcept {
  if (!has_magic(bytes, kCompiledMagic)) {
    return {CompatibilityDisposition::reject_invalid, {}};
  }
  const auto version = read_version(bytes);
  const auto version_report = version_decision(version, true);
  if (version_report.disposition != CompatibilityDisposition::current) {
    return version_report;
  }

  return parse_compiled_product(bytes).has_value()
             ? CompatibilityReport{CompatibilityDisposition::current, version}
             : CompatibilityReport{CompatibilityDisposition::reject_invalid, version};
}

CompatibilityReport classify_product_state_compatibility(
    const std::span<const std::uint8_t> bytes,
    const Identifier& expected_product_id) noexcept {
  if (!has_magic(bytes, kStateMagic)) {
    return {CompatibilityDisposition::reject_invalid, {}};
  }
  const auto version = read_version(bytes);
  const auto version_report = version_decision(version, false);
  if (version_report.disposition != CompatibilityDisposition::current) {
    return version_report;
  }
  if (bytes.size() < 40 || all_zero(expected_product_id)) {
    return {CompatibilityDisposition::reject_invalid, version};
  }

  Identifier embedded_product_id{};
  std::copy_n(bytes.begin() + 24, embedded_product_id.size(),
              embedded_product_id.begin());
  if (all_zero(embedded_product_id)) {
    return {CompatibilityDisposition::reject_invalid, version};
  }

  ProductState decoded{};
  if (!decode_product_state(bytes, embedded_product_id, decoded)) {
    return {CompatibilityDisposition::reject_invalid, version};
  }
  if (embedded_product_id != expected_product_id) {
    return {CompatibilityDisposition::reject_foreign_product, version};
  }
  return {CompatibilityDisposition::current, version};
}

} // namespace garak::runtime::product_v1
