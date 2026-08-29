#include "controller.hpp"

#include "garak/dsp/gain/gain.hpp"
#include "product_runtime_context.hpp"
#include "state_stream.hpp"

#include "public.sdk/source/vst/vstparameters.h"

namespace garak::adapter::vst3::product_runtime_v1 {

GainController::GainController(garak::runtime::product_v1::Identifier product_id,
                               const double default_gain_normalized) noexcept
    : product_id_(product_id), default_gain_normalized_(default_gain_normalized) {}

Steinberg::FUnknown* GainController::create_instance(void* const context) {
  try {
    const auto* const runtime = static_cast<const ProductRuntimeContext*>(context);
    if (runtime == nullptr) {
      return nullptr;
    }
    const auto& product = runtime->product;
    return static_cast<Steinberg::Vst::IEditController*>(
        new GainController(product.product_id, product.parameters[0].default_normalized));
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
      STR16("Gain"), garak::runtime::product_v1::kGainParameterId, STR16("dB"),
      garak::dsp::gain::kMinimumDecibels, garak::dsp::gain::kMaximumDecibels,
      garak::dsp::gain::normalized_to_decibels(default_gain_normalized_), 0,
      Steinberg::Vst::ParameterInfo::kCanAutomate);
  gain->setPrecision(2);
  parameters.addParameter(gain);
  parameters.addParameter(STR16("Bypass"), nullptr, 1, 0.0,
                          Steinberg::Vst::ParameterInfo::kCanAutomate |
                              Steinberg::Vst::ParameterInfo::kIsBypass,
                          garak::runtime::product_v1::kBypassParameterId);
  return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API GainController::setComponentState(Steinberg::IBStream* const state) {
  if (state == nullptr) {
    return Steinberg::kInvalidArgument;
  }
  garak::runtime::product_v1::ProductState decoded{};
  if (!read_state(state, product_id_, decoded)) {
    return Steinberg::kResultFalse;
  }
  setParamNormalized(garak::runtime::product_v1::kGainParameterId, decoded.gain_normalized);
  setParamNormalized(garak::runtime::product_v1::kBypassParameterId, decoded.bypass ? 1.0 : 0.0);
  return Steinberg::kResultTrue;
}

Steinberg::IPlugView* PLUGIN_API GainController::createView(const char*) { return nullptr; }

} // namespace garak::adapter::vst3::product_runtime_v1
