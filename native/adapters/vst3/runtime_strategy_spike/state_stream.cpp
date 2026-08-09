#include "state_stream.hpp"

#include "pluginterfaces/base/ibstream.h"

namespace garak::adapter::vst3::runtime_strategy_spike {

bool read_state(Steinberg::IBStream* const stream, garak::spike::gain::SpikeState& state) noexcept {
  if (stream == nullptr) {
    return false;
  }
  garak::spike::gain::EncodedState encoded{};
  const auto expected_bytes = static_cast<Steinberg::int32>(encoded.size());
  Steinberg::int32 bytes_read = 0;
  if (stream->read(encoded.data(), expected_bytes, &bytes_read) != Steinberg::kResultTrue ||
      bytes_read != expected_bytes) {
    return false;
  }
  garak::spike::gain::SpikeState decoded{};
  if (!garak::spike::gain::decode_state(encoded, decoded)) {
    return false;
  }
  state = decoded;
  return true;
}

bool write_state(Steinberg::IBStream* const stream,
                 const garak::spike::gain::SpikeState& state) noexcept {
  if (stream == nullptr) {
    return false;
  }
  garak::spike::gain::EncodedState encoded{};
  if (!garak::spike::gain::encode_state(state, encoded)) {
    return false;
  }
  const auto expected_bytes = static_cast<Steinberg::int32>(encoded.size());
  Steinberg::int32 bytes_written = 0;
  return stream->write(encoded.data(), expected_bytes, &bytes_written) == Steinberg::kResultTrue &&
         bytes_written == expected_bytes;
}

} // namespace garak::adapter::vst3::runtime_strategy_spike
