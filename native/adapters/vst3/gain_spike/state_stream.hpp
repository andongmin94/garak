#ifndef GARAK_ADAPTERS_VST3_GAIN_SPIKE_STATE_STREAM_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_GAIN_SPIKE_STATE_STREAM_HPP_INCLUDED

#include "state_codec.hpp"

namespace Steinberg {
class IBStream;
}

namespace garak::adapter::vst3::gain_spike {

[[nodiscard]] bool read_state(Steinberg::IBStream* stream,
                              garak::spike::gain::SpikeState& state) noexcept;
[[nodiscard]] bool write_state(Steinberg::IBStream* stream,
                               const garak::spike::gain::SpikeState& state) noexcept;

} // namespace garak::adapter::vst3::gain_spike

#endif
