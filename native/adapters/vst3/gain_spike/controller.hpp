#ifndef GARAK_ADAPTERS_VST3_GAIN_SPIKE_CONTROLLER_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_GAIN_SPIKE_CONTROLLER_HPP_INCLUDED

#include "public.sdk/source/vst/vsteditcontroller.h"

namespace garak::adapter::vst3::gain_spike {

class GainController final : public Steinberg::Vst::EditController {
public:
  static Steinberg::FUnknown* create_instance(void* context);

  Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
  Steinberg::tresult PLUGIN_API setComponentState(Steinberg::IBStream* state) override;
  Steinberg::IPlugView* PLUGIN_API createView(const char* name) override;
};

} // namespace garak::adapter::vst3::gain_spike

#endif
