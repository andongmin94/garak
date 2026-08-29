#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PRODUCT_RUNTIME_LOADER_WIN_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PRODUCT_RUNTIME_LOADER_WIN_HPP_INCLUDED

#include "product_runtime_context.hpp"

#include <optional>

namespace garak::adapter::vst3::product_runtime_v1 {

[[nodiscard]] std::optional<ProductRuntimeContext> load_module_product_runtime() noexcept;

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
