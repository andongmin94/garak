#include "compiled_graph_resource.hpp"

#include "garak/runtime/product_v1/compiled_product.hpp"

#include "pluginterfaces/base/funknown.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/moduleinfo/moduleinfoparser.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <Windows.h>

#include <array>
#include <charconv>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <limits>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>

namespace {

using garak::runtime::product_v1::CompiledProduct;
using garak::runtime::product_v1::Identifier;

struct Arguments final {
  std::filesystem::path bundle;
  std::string bundle_utf8;
  std::string product_id;
  std::string vendor;
  std::string name;
  std::string version;
  std::string category;
  std::string product_template;
  std::string processor_fuid;
  std::string controller_fuid;
  std::string gain_id;
  std::string gain_default_normalized;
  std::string bypass_id;
  std::string bypass_default_normalized;
};

[[nodiscard]] std::optional<std::string> utf16_to_utf8(const std::wstring_view value) {
  if (value.empty() || value.size() > static_cast<std::size_t>(std::numeric_limits<int>::max())) {
    return std::nullopt;
  }
  const auto size = static_cast<int>(value.size());
  const auto* const source = &value.front();
  const auto required = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, source, size, nullptr, 0,
                                            nullptr, nullptr);
  if (required <= 0) {
    return std::nullopt;
  }
  std::string result(static_cast<std::size_t>(required), '\0');
  if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, source, size, result.data(), required,
                          nullptr, nullptr) != required) {
    return std::nullopt;
  }
  return result;
}

[[nodiscard]] std::optional<std::string> utf16_to_utf8(const Steinberg::char16* value,
                                                       const std::size_t capacity) {
  std::size_t length = 0;
  while (length < capacity && value[length] != 0) {
    ++length;
  }
  if (length == capacity || length > static_cast<std::size_t>(std::numeric_limits<int>::max())) {
    return std::nullopt;
  }
  if (length == 0) {
    return std::string{};
  }
  const auto source_length = static_cast<int>(length);
  const auto required =
      WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, reinterpret_cast<const wchar_t*>(value),
                          source_length, nullptr, 0, nullptr, nullptr);
  if (required <= 0) {
    return std::nullopt;
  }
  std::string result(static_cast<std::size_t>(required), '\0');
  if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, reinterpret_cast<const wchar_t*>(value),
                          source_length, result.data(), required, nullptr, nullptr) != required) {
    return std::nullopt;
  }
  return result;
}

[[nodiscard]] std::string bounded_string(const Steinberg::char8* value,
                                         const std::size_t capacity) {
  std::size_t length = 0;
  while (length < capacity && value[length] != '\0') {
    ++length;
  }
  return std::string(value, length);
}

[[nodiscard]] bool set_once(std::string& target, const std::wstring_view value) {
  if (!target.empty() || value.empty()) {
    return false;
  }
  auto converted = utf16_to_utf8(value);
  if (!converted) {
    return false;
  }
  target = std::move(*converted);
  return true;
}

[[nodiscard]] bool set_bundle_once(Arguments& target, const std::wstring_view value) {
  if (!target.bundle.empty() || !target.bundle_utf8.empty() || value.empty()) {
    return false;
  }
  auto converted = utf16_to_utf8(value);
  if (!converted) {
    return false;
  }
  target.bundle = std::filesystem::path(value);
  target.bundle_utf8 = std::move(*converted);
  return true;
}

[[nodiscard]] std::optional<Arguments> parse_arguments(const int argc, wchar_t* argv[]) {
  if (argc != 27) {
    return std::nullopt;
  }
  Arguments result{};
  for (int index = 1; index < argc; index += 2) {
    if (argv[index] == nullptr || argv[index + 1] == nullptr) {
      return std::nullopt;
    }
    const std::wstring_view option(argv[index]);
    const std::wstring_view value(argv[index + 1]);
    bool accepted = false;
    if (option == L"--bundle") {
      accepted = set_bundle_once(result, value);
    } else if (option == L"--product-id") {
      accepted = set_once(result.product_id, value);
    } else if (option == L"--vendor") {
      accepted = set_once(result.vendor, value);
    } else if (option == L"--name") {
      accepted = set_once(result.name, value);
    } else if (option == L"--version") {
      accepted = set_once(result.version, value);
    } else if (option == L"--category") {
      accepted = set_once(result.category, value);
    } else if (option == L"--template") {
      accepted = set_once(result.product_template, value);
    } else if (option == L"--processor-fuid") {
      accepted = set_once(result.processor_fuid, value);
    } else if (option == L"--controller-fuid") {
      accepted = set_once(result.controller_fuid, value);
    } else if (option == L"--gain-id") {
      accepted = set_once(result.gain_id, value);
    } else if (option == L"--gain-default-normalized") {
      accepted = set_once(result.gain_default_normalized, value);
    } else if (option == L"--bypass-id") {
      accepted = set_once(result.bypass_id, value);
    } else if (option == L"--bypass-default-normalized") {
      accepted = set_once(result.bypass_default_normalized, value);
    }
    if (!accepted) {
      return std::nullopt;
    }
  }
  return result;
}

[[nodiscard]] std::optional<std::uint32_t> parse_u32(const std::string_view text) noexcept {
  std::uint32_t value = 0;
  const auto result = std::from_chars(text.data(), text.data() + text.size(), value, 10);
  if (text.empty() || result.ec != std::errc{} || result.ptr != text.data() + text.size()) {
    return std::nullopt;
  }
  return value;
}

[[nodiscard]] std::optional<double> parse_double(const std::string_view text) noexcept {
  double value = 0.0;
  const auto result =
      std::from_chars(text.data(), text.data() + text.size(), value, std::chars_format::general);
  if (text.empty() || result.ec != std::errc{} || result.ptr != text.data() + text.size() ||
      !std::isfinite(value)) {
    return std::nullopt;
  }
  return value;
}

[[nodiscard]] std::optional<CompiledProduct>
read_compiled_product(const std::filesystem::path& path) {
  std::ifstream input(path, std::ios::binary);
  if (!input.is_open()) {
    return std::nullopt;
  }
  std::array<std::uint8_t, garak::runtime::product_v1::kMaximumCompiledProductBytes + 1> bytes{};
  input.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  const auto count = input.gcount();
  if (input.bad() || (input.fail() && !input.eof()) || count <= 0 ||
      count >
          static_cast<std::streamsize>(garak::runtime::product_v1::kMaximumCompiledProductBytes)) {
    return std::nullopt;
  }
  return garak::runtime::product_v1::parse_compiled_product(
      std::span<const std::uint8_t>(bytes.data(), static_cast<std::size_t>(count)));
}

[[nodiscard]] std::string semantic_version(const CompiledProduct& product) {
  return std::to_string(product.version.major) + "." + std::to_string(product.version.minor) + "." +
         std::to_string(product.version.patch);
}

[[nodiscard]] Steinberg::FUID class_id(const Identifier& identifier) noexcept {
  constexpr char kHex[] = "0123456789ABCDEF";
  std::array<Steinberg::char8, 33> literal{};
  for (std::size_t index = 0; index < identifier.size(); ++index) {
    literal[index * 2] = kHex[identifier[index] >> 4U];
    literal[(index * 2) + 1] = kHex[identifier[index] & 0x0FU];
  }
  Steinberg::FUID result;
  if (!result.fromString(literal.data())) {
    return {};
  }
  return result;
}

[[nodiscard]] std::string read_text(const std::filesystem::path& path) {
  std::ifstream input(path, std::ios::binary);
  return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}

[[nodiscard]] bool expected_compiled_product(const Arguments& arguments,
                                             const CompiledProduct& product) {
  const auto gain_id = parse_u32(arguments.gain_id);
  const auto bypass_id = parse_u32(arguments.bypass_id);
  const auto gain_default = parse_double(arguments.gain_default_normalized);
  const auto bypass_default = parse_double(arguments.bypass_default_normalized);
  return gain_id && bypass_id && gain_default && bypass_default && arguments.category == "Fx" &&
         arguments.product_template == "garak.gain-v1" &&
         garak::runtime::product_v1::canonical_product_id(product.product_id) ==
             arguments.product_id &&
         product.vendor == arguments.vendor && product.name == arguments.name &&
         semantic_version(product) == arguments.version &&
         garak::runtime::product_v1::identifier_hex(product.processor_fuid) ==
             arguments.processor_fuid &&
         garak::runtime::product_v1::identifier_hex(product.controller_fuid) ==
             arguments.controller_fuid &&
         product.parameters[0].id == *gain_id &&
         product.parameters[0].default_normalized == *gain_default &&
         product.parameters[1].id == *bypass_id &&
         product.parameters[1].default_normalized == *bypass_default;
}

[[nodiscard]] bool check_module_info(const std::filesystem::path& path,
                                     const Arguments& arguments) {
  const auto text = read_text(path);
  if (text.empty()) {
    return false;
  }
  std::ostringstream errors;
  const auto info = Steinberg::ModuleInfoLib::parseJson(text, &errors);
  if (!info || info->name != arguments.name || info->version != arguments.version ||
      info->factoryInfo.vendor != arguments.vendor || info->classes.size() != 2U) {
    return false;
  }
  bool saw_processor = false;
  bool saw_controller = false;
  for (const auto& class_info : info->classes) {
    if (class_info.cid == arguments.processor_fuid) {
      saw_processor = class_info.category == "Audio Module Class" &&
                      class_info.name == arguments.name && class_info.vendor == arguments.vendor &&
                      class_info.version == arguments.version &&
                      class_info.subCategories.size() == 1U &&
                      class_info.subCategories.front() == arguments.category;
    } else if (class_info.cid == arguments.controller_fuid) {
      saw_controller = class_info.category == "Component Controller Class" &&
                       class_info.name == std::string(arguments.name) + " Controller" &&
                       class_info.vendor == arguments.vendor &&
                       class_info.version == arguments.version && class_info.subCategories.empty();
    } else {
      return false;
    }
  }
  return saw_processor && saw_controller;
}

enum class FactoryCheckResult : std::uint8_t {
  success = 0,
  module_load = 1,
  factory_metadata = 2,
  class_metadata = 3,
  instance_creation = 4,
  controller_association = 5,
  parameter_metadata = 6,
};

[[nodiscard]] FactoryCheckResult check_factory(const Arguments& arguments,
                                               const CompiledProduct& product) {
  std::string error;
  const auto module = VST3::Hosting::Module::create(arguments.bundle_utf8, error);
  if (!module) {
    return FactoryCheckResult::module_load;
  }
  const auto& factory = module->getFactory();
  if (factory.classCount() != 2U || factory.info().vendor() != arguments.vendor) {
    return FactoryCheckResult::factory_metadata;
  }
  Steinberg::IPluginFactory3* factory3_raw = nullptr;
  if (factory.get()->queryInterface(Steinberg::IPluginFactory3::iid,
                                    reinterpret_cast<void**>(&factory3_raw)) !=
          Steinberg::kResultTrue ||
      factory3_raw == nullptr) {
    return FactoryCheckResult::class_metadata;
  }
  const Steinberg::IPtr<Steinberg::IPluginFactory3> factory3(factory3_raw, false);
  const auto processor_id = class_id(product.processor_fuid);
  const auto controller_id = class_id(product.controller_fuid);
  bool saw_processor = false;
  bool saw_controller = false;
  for (Steinberg::int32 index = 0; index < 2; ++index) {
    Steinberg::PClassInfoW info{};
    if (factory3->getClassInfoUnicode(index, &info) != Steinberg::kResultTrue) {
      return FactoryCheckResult::class_metadata;
    }
    const auto name = utf16_to_utf8(info.name, Steinberg::PClassInfo::kNameSize);
    const auto vendor = utf16_to_utf8(info.vendor, Steinberg::PClassInfoW::kVendorSize);
    const auto version = utf16_to_utf8(info.version, Steinberg::PClassInfoW::kVersionSize);
    if (!name || !vendor || !version) {
      return FactoryCheckResult::class_metadata;
    }
    const auto id = Steinberg::FUID::fromTUID(info.cid);
    const auto category = bounded_string(info.category, Steinberg::PClassInfo::kCategorySize);
    const auto subcategories =
        bounded_string(info.subCategories, Steinberg::PClassInfoW::kSubCategoriesSize);
    if (id == processor_id) {
      saw_processor = *name == arguments.name && *vendor == arguments.vendor &&
                      *version == arguments.version && category == kVstAudioEffectClass &&
                      subcategories == arguments.category;
    } else if (id == controller_id) {
      saw_controller = *name == std::string(arguments.name) + " Controller" &&
                       *vendor == arguments.vendor && *version == arguments.version &&
                       category == kVstComponentControllerClass && subcategories.empty();
    } else {
      return FactoryCheckResult::class_metadata;
    }
  }
  if (!saw_processor || !saw_controller) {
    return FactoryCheckResult::class_metadata;
  }

  auto component =
      factory.createInstance<Steinberg::Vst::IComponent>(VST3::UID(processor_id.toTUID()));
  auto controller =
      factory.createInstance<Steinberg::Vst::IEditController>(VST3::UID(controller_id.toTUID()));
  if (!component || !controller) {
    return FactoryCheckResult::instance_creation;
  }
  Steinberg::TUID associated{};
  if (component->getControllerClassId(associated) != Steinberg::kResultTrue ||
      Steinberg::FUID::fromTUID(associated) != controller_id ||
      controller->initialize(nullptr) != Steinberg::kResultTrue) {
    return FactoryCheckResult::controller_association;
  }
  Steinberg::Vst::ParameterInfo gain{};
  Steinberg::Vst::ParameterInfo bypass{};
  const bool metadata_matches =
      controller->getParameterCount() == 2 &&
      controller->getParameterInfo(0, gain) == Steinberg::kResultTrue &&
      controller->getParameterInfo(1, bypass) == Steinberg::kResultTrue &&
      gain.id == product.parameters[0].id &&
      gain.defaultNormalizedValue == product.parameters[0].default_normalized &&
      bypass.id == product.parameters[1].id &&
      bypass.defaultNormalizedValue == product.parameters[1].default_normalized;
  const auto terminate_result = controller->terminate();
  return metadata_matches && terminate_result == Steinberg::kResultTrue
             ? FactoryCheckResult::success
             : FactoryCheckResult::parameter_metadata;
}

} // namespace

int wmain(const int argc, wchar_t* argv[]) {
  try {
    const auto arguments = parse_arguments(argc, argv);
    if (!arguments) {
      std::fputs("Invalid inspector arguments\n", stderr);
      return 10;
    }
    const auto resources = arguments->bundle / L"Contents" / L"Resources";
    const auto product = read_compiled_product(resources / L"product.garakbin");
    if (!product) {
      std::fputs("Product parity inspection failed at compiled product read\n", stderr);
      return 2;
    }
    if (!expected_compiled_product(*arguments, *product)) {
      std::fputs("Product parity inspection failed at compiled product parity\n", stderr);
      return 3;
    }
    const auto graph = garak::adapter::vst3::product_runtime_v1::read_compiled_graph_resource(
        resources / L"graph.garakbin", garak::runtime::product_v1::kGainParameterId,
        garak::runtime::product_v1::kBypassParameterId);
    if (graph.disposition != garak::runtime::static_graph::CompiledGraphDisposition::current ||
        !graph.binding) {
      std::fprintf(stderr, "Product parity inspection failed at compiled graph compatibility (%s)\n",
                   garak::runtime::static_graph::compiled_graph_diagnostic_code(graph.diagnostic));
      return 5;
    }
    if (!check_module_info(resources / L"moduleinfo.json", *arguments)) {
      std::fputs("Product parity inspection failed at moduleinfo parity\n", stderr);
      return 4;
    }
    const auto factory_result = check_factory(*arguments, *product);
    if (factory_result != FactoryCheckResult::success) {
      std::fputs("Product parity inspection failed at factory parity\n", stderr);
      return 20 + static_cast<int>(factory_result);
    }
    std::printf("Product parity inspection passed: %.*s\n",
                static_cast<int>(arguments->name.size()), arguments->name.data());
    return EXIT_SUCCESS;
  } catch (...) {
    std::fputs("Product parity inspection failed\n", stderr);
    return 6;
  }
}
