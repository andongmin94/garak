#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_STATE_STREAM_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_STATE_STREAM_HPP_INCLUDED

#include "garak/runtime/product_v1/product_state.hpp"

namespace Steinberg {
class IBStream;
}

namespace garak::adapter::vst3::product_runtime_v1 {

[[nodiscard]] bool read_state(Steinberg::IBStream* stream,
                              const garak::runtime::product_v1::Identifier& product_id,
                              garak::runtime::product_v1::ProductState& state) noexcept;
[[nodiscard]] bool write_state(Steinberg::IBStream* stream,
                               const garak::runtime::product_v1::Identifier& product_id,
                               const garak::runtime::product_v1::ProductState& state) noexcept;

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
