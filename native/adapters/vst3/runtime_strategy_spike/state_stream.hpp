#ifndef GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_STATE_STREAM_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_STATE_STREAM_HPP_INCLUDED

#include "state_codec.hpp"

namespace Steinberg {
class IBStream;
}

namespace garak::adapter::vst3::runtime_strategy_spike {

[[nodiscard]] bool read_state(Steinberg::IBStream* stream,
                              garak::spike::gain::SpikeState& state) noexcept;
[[nodiscard]] bool write_state(Steinberg::IBStream* stream,
                               const garak::spike::gain::SpikeState& state) noexcept;

} // namespace garak::adapter::vst3::runtime_strategy_spike

#endif
