#ifndef GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_DESCRIPTOR_LOADER_WIN_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_DESCRIPTOR_LOADER_WIN_HPP_INCLUDED

#include "product_definition.hpp"

#include <optional>

namespace garak::adapter::vst3::runtime_strategy_spike {

[[nodiscard]] std::optional<ProductDefinition> load_module_product_definition() noexcept;

} // namespace garak::adapter::vst3::runtime_strategy_spike

#endif
