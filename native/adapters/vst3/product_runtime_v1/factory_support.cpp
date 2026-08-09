#include "factory_support.hpp"

#include "controller.hpp"
#include "processor.hpp"

#include "pluginterfaces/vst/ivstcomponent.h"
#include "public.sdk/source/main/pluginfactory.h"
#include "public.sdk/source/vst/utility/stringconvert.h"

#include <array>
#include <cstddef>
#include <memory>
#include <string>

namespace garak::adapter::vst3::product_runtime_v1 {
namespace {

constexpr char kHex[] = "0123456789ABCDEF";

} // namespace

Steinberg::FUID class_id(const garak::runtime::product_v1::Identifier& value) noexcept {
  std::array<Steinberg::char8, 33> literal{};
  for (std::size_t index = 0; index < value.size(); ++index) {
    literal[index * 2] = kHex[value[index] >> 4U];
    literal[(index * 2) + 1] = kHex[value[index] & 0x0FU];
  }
  Steinberg::FUID result;
  if (!result.fromString(literal.data())) {
    return {};
  }
  return result;
}

Steinberg::IPluginFactory*
get_or_create_product_factory(const garak::runtime::product_v1::CompiledProduct& product) noexcept {
  try {
    if (Steinberg::gPluginFactory != nullptr) {
      Steinberg::gPluginFactory->addRef();
      return Steinberg::gPluginFactory;
    }
    const std::string controller_name = product.name + " Controller";
    if (product.vendor.size() >= static_cast<std::size_t>(Steinberg::PFactoryInfo::kNameSize) ||
        product.name.size() >= static_cast<std::size_t>(Steinberg::PClassInfo::kNameSize) ||
        controller_name.size() >= static_cast<std::size_t>(Steinberg::PClassInfo::kNameSize)) {
      return nullptr;
    }

    const auto processor_id = class_id(product.processor_fuid);
    const auto controller_id = class_id(product.controller_fuid);
    if (!processor_id.isValid() || !controller_id.isValid()) {
      return nullptr;
    }
    Steinberg::TUID processor_tuid{};
    Steinberg::TUID controller_tuid{};
    processor_id.toTUID(processor_tuid);
    controller_id.toTUID(controller_tuid);
    const auto version = std::to_string(product.version.major) + "." +
                         std::to_string(product.version.minor) + "." +
                         std::to_string(product.version.patch);
    const auto name_utf16 = Steinberg::Vst::StringConvert::convert(product.name);
    const auto controller_name_utf16 = Steinberg::Vst::StringConvert::convert(controller_name);
    const auto vendor_utf16 = Steinberg::Vst::StringConvert::convert(product.vendor);
    const auto version_utf16 = Steinberg::Vst::StringConvert::convert(version);
    const auto sdk_version_utf16 =
        Steinberg::Vst::StringConvert::convert(std::string(kVstVersionString));
    Steinberg::PFactoryInfo factory_info(product.vendor.c_str(), "", "",
                                         Steinberg::PFactoryInfo::kUnicode);
    Steinberg::PClassInfoW processor_info(
        processor_tuid, Steinberg::PClassInfo::kManyInstances, kVstAudioEffectClass,
        Steinberg::Vst::toTChar(name_utf16), 0, "Fx", Steinberg::Vst::toTChar(vendor_utf16),
        Steinberg::Vst::toTChar(version_utf16), Steinberg::Vst::toTChar(sdk_version_utf16));
    Steinberg::PClassInfoW controller_info(
        controller_tuid, Steinberg::PClassInfo::kManyInstances, kVstComponentControllerClass,
        Steinberg::Vst::toTChar(controller_name_utf16), 0, "",
        Steinberg::Vst::toTChar(vendor_utf16), Steinberg::Vst::toTChar(version_utf16),
        Steinberg::Vst::toTChar(sdk_version_utf16));

    auto candidate = std::make_unique<Steinberg::CPluginFactory>(factory_info);
    auto* const context =
        const_cast<garak::runtime::product_v1::CompiledProduct*>(std::addressof(product));
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

} // namespace garak::adapter::vst3::product_runtime_v1
