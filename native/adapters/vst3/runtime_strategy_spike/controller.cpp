#include "controller.hpp"

#include "gain_kernel.hpp"
#include "product_definition.hpp"
#include "state_stream.hpp"

#include "public.sdk/source/vst/vstparameters.h"

namespace garak::adapter::vst3::runtime_strategy_spike {

GainController::GainController(const double default_gain_db) noexcept
    : default_gain_db_(default_gain_db) {}

Steinberg::FUnknown* GainController::create_instance(void* const context) {
  try {
    const auto* const product = static_cast<const ProductDefinition*>(context);
    if (product == nullptr || !is_valid_product_definition(*product)) {
      return nullptr;
    }
    return static_cast<Steinberg::Vst::IEditController*>(
        new GainController(product->default_gain_db));
  } catch (...) {
    return nullptr;
  }
}

Steinberg::tresult PLUGIN_API GainController::initialize(Steinberg::FUnknown* const context) {
  const auto result = EditController::initialize(context);
  if (result != Steinberg::kResultTrue) {
    return result;
  }
  auto* const gain = new Steinberg::Vst::RangeParameter(
      STR16("Gain"), kGainParameterId, STR16("dB"), garak::spike::gain::kMinimumDecibels,
      garak::spike::gain::kMaximumDecibels, default_gain_db_, 0,
      Steinberg::Vst::ParameterInfo::kCanAutomate);
  gain->setPrecision(2);
  parameters.addParameter(gain);
  parameters.addParameter(STR16("Bypass"), nullptr, 1, 0.0,
                          Steinberg::Vst::ParameterInfo::kCanAutomate |
                              Steinberg::Vst::ParameterInfo::kIsBypass,
                          kBypassParameterId);
  return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API GainController::setComponentState(Steinberg::IBStream* const state) {
  if (state == nullptr) {
    return Steinberg::kInvalidArgument;
  }
  garak::spike::gain::SpikeState decoded{};
  if (!read_state(state, decoded)) {
    return Steinberg::kResultFalse;
  }
  setParamNormalized(kGainParameterId, decoded.gain_normalized);
  setParamNormalized(kBypassParameterId, decoded.bypass ? 1.0 : 0.0);
  return Steinberg::kResultTrue;
}

Steinberg::IPlugView* PLUGIN_API GainController::createView(const char*) { return nullptr; }

} // namespace garak::adapter::vst3::runtime_strategy_spike
