#ifndef GARAK_SPIKES_GAIN_STATE_CODEC_HPP_INCLUDED
#define GARAK_SPIKES_GAIN_STATE_CODEC_HPP_INCLUDED

#include <array>
#include <cstddef>
#include <cstdint>
#include <span>

namespace garak::spike::gain {

inline constexpr std::uint32_t kStateSchemaVersion = 1;
inline constexpr std::size_t kEncodedStateSize = 20;
using EncodedState = std::array<std::uint8_t, kEncodedStateSize>;

struct SpikeState final {
  double gain_normalized;
  bool bypass;
};

[[nodiscard]] bool is_valid_state(const SpikeState& state) noexcept;
[[nodiscard]] bool encode_state(const SpikeState& state, EncodedState& encoded) noexcept;
[[nodiscard]] bool decode_state(std::span<const std::uint8_t> encoded, SpikeState& state) noexcept;

[[nodiscard]] std::uint64_t pack_realtime_state(const SpikeState& state) noexcept;
[[nodiscard]] SpikeState unpack_realtime_state(std::uint64_t packed) noexcept;

} // namespace garak::spike::gain

#endif
