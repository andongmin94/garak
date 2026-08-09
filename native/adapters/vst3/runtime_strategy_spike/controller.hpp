#ifndef GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_CONTROLLER_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_CONTROLLER_HPP_INCLUDED

#include "public.sdk/source/vst/vsteditcontroller.h"

namespace garak::adapter::vst3::runtime_strategy_spike {

class GainController final : public Steinberg::Vst::EditController {
public:
  explicit GainController(double default_gain_db) noexcept;

  static Steinberg::FUnknown* create_instance(void* context);

  Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
  Steinberg::tresult PLUGIN_API setComponentState(Steinberg::IBStream* state) override;
  Steinberg::IPlugView* PLUGIN_API createView(const char* name) override;

private:
  double default_gain_db_{};
};

} // namespace garak::adapter::vst3::runtime_strategy_spike

#endif
