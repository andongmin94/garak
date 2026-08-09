#include "factory_support.hpp"

#include "controller.hpp"
#include "processor.hpp"

#include "pluginterfaces/vst/ivstcomponent.h"
#include "public.sdk/source/main/pluginfactory.h"

#include <memory>
#include <string>

namespace garak::adapter::vst3::runtime_strategy_spike {
namespace {

[[nodiscard]] Steinberg::FUID class_id(const ClassIdWords& value) noexcept {
  return {value.words[0], value.words[1], value.words[2], value.words[3]};
}

[[nodiscard]] bool is_supported_product(const ProductDefinition& product) noexcept {
  if (!is_valid_product_definition(product) || product.gain_parameter_id != kGainParameterId ||
      product.bypass_parameter_id != kBypassParameterId || product.category != "Fx") {
    return false;
  }
  const auto processor_id = class_id(product.processor_fuid);
  const auto controller_id = class_id(product.controller_fuid);
  return processor_id.isValid() && controller_id.isValid();
}

} // namespace

Steinberg::IPluginFactory*
get_or_create_product_factory(const ProductDefinition& product) noexcept {
  try {
    if (!is_supported_product(product)) {
      return nullptr;
    }
    if (Steinberg::gPluginFactory != nullptr) {
      Steinberg::gPluginFactory->addRef();
      return Steinberg::gPluginFactory;
    }

    const std::string controller_name = product.product_name + " Controller";
    if (controller_name.size() >= static_cast<std::size_t>(Steinberg::PClassInfo::kNameSize)) {
      return nullptr;
    }

    Steinberg::PFactoryInfo factory_info(product.vendor.c_str(), "", "",
                                         Steinberg::PFactoryInfo::kUnicode);
    const auto processor_id = class_id(product.processor_fuid);
    const auto controller_id = class_id(product.controller_fuid);
    Steinberg::TUID processor_tuid{};
    Steinberg::TUID controller_tuid{};
    processor_id.toTUID(processor_tuid);
    controller_id.toTUID(controller_tuid);

    Steinberg::PClassInfo2 processor_info(processor_tuid, Steinberg::PClassInfo::kManyInstances,
                                          kVstAudioEffectClass, product.product_name.c_str(), 0,
                                          product.category.c_str(), product.vendor.c_str(),
                                          product.semantic_version.c_str(), kVstVersionString);
    Steinberg::PClassInfo2 controller_info(controller_tuid, Steinberg::PClassInfo::kManyInstances,
                                           kVstComponentControllerClass, controller_name.c_str(), 0,
                                           "", product.vendor.c_str(),
                                           product.semantic_version.c_str(), kVstVersionString);

    auto candidate = std::make_unique<Steinberg::CPluginFactory>(factory_info);
    auto* const context = const_cast<ProductDefinition*>(std::addressof(product));
    if (!candidate->registerClass(&processor_info, GainProcessor::create_instance, context) ||
        !candidate->registerClass(&controller_info, GainController::create_instance, context) ||
        candidate->countClasses() != 2) {
      return nullptr;
    }

    Steinberg::gPluginFactory = candidate.release();
    return Steinberg::gPluginFactory;
  } catch (...) {
    return nullptr;
  }
}

} // namespace garak::adapter::vst3::runtime_strategy_spike
