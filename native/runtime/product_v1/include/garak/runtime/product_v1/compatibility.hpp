#ifndef GARAK_RUNTIME_PRODUCT_V1_COMPATIBILITY_HPP
#define GARAK_RUNTIME_PRODUCT_V1_COMPATIBILITY_HPP

#include "garak/runtime/product_v1/compiled_product.hpp"
#include "garak/runtime/product_v1/product_state.hpp"

#include <cstdint>
#include <span>

namespace garak::runtime::product_v1 {

enum class CompatibilityDisposition : std::uint8_t {
  current,
  rebuild_from_project,
  reject_unsupported_old,
  reject_too_new,
  reject_foreign_product,
  reject_invalid,
};

struct ArtifactVersion {
  std::uint16_t major{};
  std::uint16_t minor{};
  bool available{};
};

struct CompatibilityReport {
  CompatibilityDisposition disposition{CompatibilityDisposition::reject_invalid};
  ArtifactVersion version{};
};

[[nodiscard]] CompatibilityReport
classify_compiled_product_compatibility(std::span<const std::uint8_t> bytes) noexcept;

[[nodiscard]] CompatibilityReport
classify_product_state_compatibility(std::span<const std::uint8_t> bytes,
                                     const Identifier& expected_product_id) noexcept;

} // namespace garak::runtime::product_v1

#endif
