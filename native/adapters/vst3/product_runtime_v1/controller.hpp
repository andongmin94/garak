#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_CONTROLLER_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_CONTROLLER_HPP_INCLUDED

#include "garak/runtime/product_v1/compiled_product.hpp"

#include "public.sdk/source/vst/vsteditcontroller.h"

namespace garak::adapter::vst3::product_runtime_v1 {

class GainController final : public Steinberg::Vst::EditController {
public:
  GainController(garak::runtime::product_v1::Identifier product_id,
                 double default_gain_normalized) noexcept;

  static Steinberg::FUnknown* create_instance(void* context);

  Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
  Steinberg::tresult PLUGIN_API setComponentState(Steinberg::IBStream* state) override;
  Steinberg::IPlugView* PLUGIN_API createView(const char* name) override;

private:
  garak::runtime::product_v1::Identifier product_id_{};
  double default_gain_normalized_{};
};

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
