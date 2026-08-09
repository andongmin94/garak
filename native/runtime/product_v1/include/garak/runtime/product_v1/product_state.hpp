#ifndef GARAK_RUNTIME_PRODUCT_V1_PRODUCT_STATE_HPP_INCLUDED
#define GARAK_RUNTIME_PRODUCT_V1_PRODUCT_STATE_HPP_INCLUDED

#include "garak/runtime/product_v1/compiled_product.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <span>

namespace garak::runtime::product_v1 {

inline constexpr std::size_t kProductStateSize = 96;
using EncodedProductState = std::array<std::uint8_t, kProductStateSize>;

struct ProductState final {
  double gain_normalized{};
  bool bypass{};

  [[nodiscard]] friend constexpr bool operator==(const ProductState&,
                                                 const ProductState&) = default;
};

[[nodiscard]] bool is_valid_product_state(const ProductState& state) noexcept;
[[nodiscard]] bool encode_product_state(const Identifier& product_id, const ProductState& state,
                                        EncodedProductState& encoded) noexcept;
[[nodiscard]] bool decode_product_state(std::span<const std::uint8_t> encoded,
                                        const Identifier& expected_product_id,
                                        ProductState& state) noexcept;

[[nodiscard]] std::uint64_t pack_realtime_state(const ProductState& state) noexcept;
[[nodiscard]] ProductState unpack_realtime_state(std::uint64_t packed) noexcept;

} // namespace garak::runtime::product_v1

#endif
