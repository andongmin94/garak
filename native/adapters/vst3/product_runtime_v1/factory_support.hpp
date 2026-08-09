#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_FACTORY_SUPPORT_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_FACTORY_SUPPORT_HPP_INCLUDED

#include "garak/runtime/product_v1/compiled_product.hpp"

#include "pluginterfaces/base/ipluginbase.h"

namespace garak::adapter::vst3::product_runtime_v1 {

[[nodiscard]] Steinberg::FUID
class_id(const garak::runtime::product_v1::Identifier& value) noexcept;

[[nodiscard]] Steinberg::IPluginFactory*
get_or_create_product_factory(const garak::runtime::product_v1::CompiledProduct& product) noexcept;

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
