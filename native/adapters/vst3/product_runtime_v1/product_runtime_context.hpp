#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PRODUCT_RUNTIME_CONTEXT_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PRODUCT_RUNTIME_CONTEXT_HPP_INCLUDED

#include "garak/runtime/product_v1/compiled_product.hpp"
#include "garak/runtime/static_graph/gain_plan.hpp"

namespace garak::adapter::vst3::product_runtime_v1 {

struct ProductRuntimeContext final {
  garak::runtime::product_v1::CompiledProduct product;
  garak::runtime::static_graph::GainExecutionBinding execution_binding;
};

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
