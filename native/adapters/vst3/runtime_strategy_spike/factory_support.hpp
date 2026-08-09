#ifndef GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_FACTORY_SUPPORT_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_FACTORY_SUPPORT_HPP_INCLUDED

#include "product_definition.hpp"

#include "pluginterfaces/base/ipluginbase.h"

namespace garak::adapter::vst3::runtime_strategy_spike {

// The product definition is used as the SDK factory context and must remain alive until the
// containing module is unloaded.
[[nodiscard]] Steinberg::IPluginFactory*
get_or_create_product_factory(const ProductDefinition& product) noexcept;

} // namespace garak::adapter::vst3::runtime_strategy_spike

#endif
