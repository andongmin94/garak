#include "garak/runtime/product_v1/product_state.hpp"

#include <algorithm>
#include <bit>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace garak::runtime::product_v1 {
namespace {

constexpr std::array<std::uint8_t, 8> kMagic{'G', 'A', 'R', 'A', 'K', 'P', 'S', 'T'};
constexpr std::size_t kStateHeaderSize = 64;
constexpr std::size_t kStateEntrySize = 16;
constexpr std::uint64_t kBypassBit = std::uint64_t{1} << 63U;

void write_u16(EncodedProductState& bytes, const std::size_t offset,
               const std::uint16_t value) noexcept {
  for (std::size_t index = 0; index < 2; ++index) {
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
  }
}

void write_u32(EncodedProductState& bytes, const std::size_t offset,
               const std::uint32_t value) noexcept {
  for (std::size_t index = 0; index < 4; ++index) {
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
  }
}

void write_u64(EncodedProductState& bytes, const std::size_t offset,
               const std::uint64_t value) noexcept {
  for (std::size_t index = 0; index < 8; ++index) {
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
  }
}

[[nodiscard]] std::uint16_t read_u16(const std::span<const std::uint8_t> bytes,
                                     const std::size_t offset) noexcept {
  return static_cast<std::uint16_t>(bytes[offset]) |
         static_cast<std::uint16_t>(static_cast<std::uint16_t>(bytes[offset + 1]) << 8U);
}

[[nodiscard]] std::uint32_t read_u32(const std::span<const std::uint8_t> bytes,
                                     const std::size_t offset) noexcept {
  std::uint32_t value = 0;
  for (std::size_t index = 0; index < 4; ++index) {
    value |= static_cast<std::uint32_t>(bytes[offset + index]) << (index * 8U);
  }
  return value;
}

[[nodiscard]] std::uint64_t read_u64(const std::span<const std::uint8_t> bytes,
                                     const std::size_t offset) noexcept {
  std::uint64_t value = 0;
  for (std::size_t index = 0; index < 8; ++index) {
    value |= static_cast<std::uint64_t>(bytes[offset + index]) << (index * 8U);
  }
  return value;
}

[[nodiscard]] bool all_zero(const std::span<const std::uint8_t> bytes) noexcept {
  return std::all_of(bytes.begin(), bytes.end(), [](const std::uint8_t byte) { return byte == 0; });
}

} // namespace

bool is_valid_product_state(const ProductState& state) noexcept {
  return std::isfinite(state.gain_normalized) && state.gain_normalized >= 0.0 &&
         state.gain_normalized <= 1.0 && !std::signbit(state.gain_normalized);
}

bool encode_product_state(const Identifier& product_id, const ProductState& state,
                          EncodedProductState& encoded) noexcept {
  if (!is_valid_product_state(state) ||
      std::all_of(product_id.begin(), product_id.end(),
                  [](const std::uint8_t byte) { return byte == 0; })) {
    return false;
  }

  encoded.fill(0);
  std::copy(kMagic.begin(), kMagic.end(), encoded.begin());
  write_u16(encoded, 8, 1);
  write_u16(encoded, 10, 0);
  write_u32(encoded, 12, static_cast<std::uint32_t>(kStateHeaderSize));
  write_u32(encoded, 16, static_cast<std::uint32_t>(kProductStateSize));
  std::copy(product_id.begin(), product_id.end(), encoded.begin() + 24);
  write_u16(encoded, 40, 2);
  write_u16(encoded, 42, static_cast<std::uint16_t>(kStateEntrySize));

  write_u32(encoded, 64, kGainParameterId);
  write_u16(encoded, 68, static_cast<std::uint16_t>(ParameterType::continuous));
  write_u64(encoded, 72, std::bit_cast<std::uint64_t>(state.gain_normalized));
  write_u32(encoded, 80, kBypassParameterId);
  write_u16(encoded, 84, static_cast<std::uint16_t>(ParameterType::boolean));
  write_u64(encoded, 88, std::bit_cast<std::uint64_t>(state.bypass ? 1.0 : 0.0));
  return true;
}

bool decode_product_state(const std::span<const std::uint8_t> encoded,
                          const Identifier& expected_product_id, ProductState& state) noexcept {
  if (encoded.size() != kProductStateSize ||
      !std::equal(kMagic.begin(), kMagic.end(), encoded.begin()) || read_u16(encoded, 8) != 1 ||
      read_u16(encoded, 10) != 0 || read_u32(encoded, 12) != kStateHeaderSize ||
      read_u32(encoded, 16) != kProductStateSize || read_u32(encoded, 20) != 0 ||
      all_zero(expected_product_id) || all_zero(encoded.subspan(24, 16)) ||
      !std::equal(expected_product_id.begin(), expected_product_id.end(), encoded.begin() + 24) ||
      read_u16(encoded, 40) != 2 || read_u16(encoded, 42) != kStateEntrySize ||
      !all_zero(encoded.subspan(44, 20)) || read_u32(encoded, 64) != kGainParameterId ||
      read_u16(encoded, 68) != static_cast<std::uint16_t>(ParameterType::continuous) ||
      read_u16(encoded, 70) != 0 || read_u32(encoded, 80) != kBypassParameterId ||
      read_u16(encoded, 84) != static_cast<std::uint16_t>(ParameterType::boolean) ||
      read_u16(encoded, 86) != 0) {
    return false;
  }

  const auto gain = std::bit_cast<double>(read_u64(encoded, 72));
  const auto bypass = std::bit_cast<double>(read_u64(encoded, 88));
  const ProductState decoded{gain, bypass == 1.0};
  if (!is_valid_product_state(decoded) || (bypass != 0.0 && bypass != 1.0) ||
      std::signbit(bypass)) {
    return false;
  }
  state = decoded;
  return true;
}

std::uint64_t pack_realtime_state(const ProductState& state) noexcept {
  const auto gain_bits = std::bit_cast<std::uint64_t>(state.gain_normalized) & ~kBypassBit;
  return gain_bits | (state.bypass ? kBypassBit : 0U);
}

ProductState unpack_realtime_state(const std::uint64_t packed) noexcept {
  return {std::bit_cast<double>(packed & ~kBypassBit), (packed & kBypassBit) != 0};
}

} // namespace garak::runtime::product_v1
