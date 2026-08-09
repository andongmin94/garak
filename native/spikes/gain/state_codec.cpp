#include "state_codec.hpp"

#include <bit>
#include <cmath>

namespace garak::spike::gain {
namespace {

inline constexpr std::array<std::uint8_t, 4> kMagic{'G', 'G', 'S', '1'};
inline constexpr std::uint64_t kBypassBit = std::uint64_t{1} << 63;

void write_u32(EncodedState& bytes, const std::size_t offset, const std::uint32_t value) noexcept {
  for (std::size_t index = 0; index < 4; ++index) {
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8));
  }
}

[[nodiscard]] std::uint32_t read_u32(const std::span<const std::uint8_t> bytes,
                                     const std::size_t offset) noexcept {
  std::uint32_t value = 0;
  for (std::size_t index = 0; index < 4; ++index) {
    value |= static_cast<std::uint32_t>(bytes[offset + index]) << (index * 8);
  }
  return value;
}

void write_u64(EncodedState& bytes, const std::size_t offset, const std::uint64_t value) noexcept {
  for (std::size_t index = 0; index < 8; ++index) {
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8));
  }
}

[[nodiscard]] std::uint64_t read_u64(const std::span<const std::uint8_t> bytes,
                                     const std::size_t offset) noexcept {
  std::uint64_t value = 0;
  for (std::size_t index = 0; index < 8; ++index) {
    value |= static_cast<std::uint64_t>(bytes[offset + index]) << (index * 8);
  }
  return value;
}

} // namespace

bool is_valid_state(const SpikeState& state) noexcept {
  return std::isfinite(state.gain_normalized) && state.gain_normalized >= 0.0 &&
         state.gain_normalized <= 1.0;
}

bool encode_state(const SpikeState& state, EncodedState& encoded) noexcept {
  if (!is_valid_state(state)) {
    return false;
  }

  encoded.fill(0);
  for (std::size_t index = 0; index < kMagic.size(); ++index) {
    encoded[index] = kMagic[index];
  }
  write_u32(encoded, 4, kStateSchemaVersion);
  write_u64(encoded, 8, std::bit_cast<std::uint64_t>(state.gain_normalized));
  write_u32(encoded, 16, state.bypass ? 1U : 0U);
  return true;
}

bool decode_state(const std::span<const std::uint8_t> encoded, SpikeState& state) noexcept {
  if (encoded.size() != kEncodedStateSize) {
    return false;
  }
  for (std::size_t index = 0; index < kMagic.size(); ++index) {
    if (encoded[index] != kMagic[index]) {
      return false;
    }
  }
  if (read_u32(encoded, 4) != kStateSchemaVersion) {
    return false;
  }

  const auto bypass = read_u32(encoded, 16);
  const SpikeState decoded{std::bit_cast<double>(read_u64(encoded, 8)), bypass == 1U};
  if (bypass > 1U || !is_valid_state(decoded)) {
    return false;
  }
  state = decoded;
  return true;
}

std::uint64_t pack_realtime_state(const SpikeState& state) noexcept {
  const auto gain_bits = std::bit_cast<std::uint64_t>(state.gain_normalized) & ~kBypassBit;
  return gain_bits | (state.bypass ? kBypassBit : 0U);
}

SpikeState unpack_realtime_state(const std::uint64_t packed) noexcept {
  return SpikeState{std::bit_cast<double>(packed & ~kBypassBit), (packed & kBypassBit) != 0};
}

} // namespace garak::spike::gain
