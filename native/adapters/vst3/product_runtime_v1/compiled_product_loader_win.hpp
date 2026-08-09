#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_COMPILED_PRODUCT_LOADER_WIN_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_COMPILED_PRODUCT_LOADER_WIN_HPP_INCLUDED

#include "garak/runtime/product_v1/compiled_product.hpp"

#include <optional>

namespace garak::adapter::vst3::product_runtime_v1 {

[[nodiscard]] std::optional<garak::runtime::product_v1::CompiledProduct>
load_module_compiled_product() noexcept;

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
