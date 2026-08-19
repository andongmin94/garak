from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_exact(relative: str, old: str, new: str, expected: int = 1) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected:
        raise RuntimeError(
            f"{relative}: expected {expected} occurrence(s), found {count}: {old[:120]!r}"
        )
    path.write_text(text.replace(old, new), encoding="utf-8", newline="\n")


def write(relative: str, content: str) -> None:
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def remove(relative: str) -> None:
    path = ROOT / relative
    if not path.is_file():
        raise RuntimeError(f"Missing obsolete path: {relative}")
    path.unlink()


write(
    "native/adapters/vst3/product_runtime_v1/product_runtime_context.hpp",
    r'''#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PRODUCT_RUNTIME_CONTEXT_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PRODUCT_RUNTIME_CONTEXT_HPP_INCLUDED

#include "garak/runtime/product_v1/compiled_product.hpp"
#include "garak/runtime/static_graph/gain_plan.hpp"

namespace garak::adapter::vst3::product_runtime_v1 {

struct ProductRuntimeContext final {
  garak::runtime::product_v1::CompiledProduct product;
  garak::runtime::static_graph::GainExecutionPlan execution_plan;
};

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
''',
)

write(
    "native/adapters/vst3/product_runtime_v1/product_runtime_loader_win.hpp",
    r'''#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PRODUCT_RUNTIME_LOADER_WIN_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PRODUCT_RUNTIME_LOADER_WIN_HPP_INCLUDED

#include "product_runtime_context.hpp"

#include <optional>

namespace garak::adapter::vst3::product_runtime_v1 {

[[nodiscard]] std::optional<ProductRuntimeContext> load_module_product_runtime() noexcept;

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
''',
)

write(
    "native/adapters/vst3/product_runtime_v1/product_runtime_loader_win.cpp",
    r'''#include "product_runtime_loader_win.hpp"

#include "garak/runtime/static_graph/compiled_graph.hpp"
#include "public.sdk/source/main/moduleinit.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <algorithm>
#include <array>
#include <filesystem>
#include <fstream>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace garak::adapter::vst3::product_runtime_v1 {
namespace {

constexpr std::size_t kInitialPathCharacters = 512;
constexpr std::size_t kMaximumPathCharacters = 32'768;
constexpr wchar_t kArchitectureDirectory[] = L"x86_64-win";
constexpr wchar_t kContentsDirectory[] = L"Contents";
constexpr wchar_t kProductResourceFilename[] = L"product.garakbin";
constexpr wchar_t kGraphResourceFilename[] = L"graph.garakbin";

[[nodiscard]] std::optional<std::filesystem::path> current_module_path() {
  const auto module = Steinberg::getPlatformModuleHandle();
  if (module == nullptr) {
    return std::nullopt;
  }
  std::vector<wchar_t> buffer(kInitialPathCharacters);
  while (buffer.size() <= kMaximumPathCharacters) {
    const auto length =
        GetModuleFileNameW(module, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0) {
      return std::nullopt;
    }
    if (length < buffer.size()) {
      return std::filesystem::path(std::wstring_view(buffer.data(), length));
    }
    if (buffer.size() == kMaximumPathCharacters) {
      return std::nullopt;
    }
    buffer.resize(std::min(buffer.size() * 2, kMaximumPathCharacters));
  }
  return std::nullopt;
}

[[nodiscard]] std::optional<std::wstring> utf8_to_wide(const std::string_view value) {
  if (value.empty()) {
    return std::nullopt;
  }
  const auto required = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                            static_cast<int>(value.size()), nullptr, 0);
  if (required <= 0) {
    return std::nullopt;
  }
  std::wstring result(static_cast<std::size_t>(required), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                          static_cast<int>(value.size()), result.data(), required) != required) {
    return std::nullopt;
  }
  return result;
}

[[nodiscard]] std::optional<garak::runtime::product_v1::CompiledProduct>
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

[[nodiscard]] std::optional<garak::runtime::static_graph::GainExecutionPlan>
read_compiled_graph(const std::filesystem::path& path) {
  std::ifstream input(path, std::ios::binary);
  if (!input.is_open()) {
    return std::nullopt;
  }
  std::array<std::uint8_t, garak::runtime::static_graph::kCompiledGraphTotalBytes + 1> bytes{};
  input.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  const auto count = input.gcount();
  if (input.bad() || (input.fail() && !input.eof()) ||
      count != static_cast<std::streamsize>(garak::runtime::static_graph::kCompiledGraphTotalBytes)) {
    return std::nullopt;
  }
  return garak::runtime::static_graph::parse_compiled_gain_graph(
      std::span<const std::uint8_t>(bytes.data(), static_cast<std::size_t>(count)),
      garak::runtime::product_v1::kGainParameterId,
      garak::runtime::product_v1::kBypassParameterId);
}

} // namespace

std::optional<ProductRuntimeContext> load_module_product_runtime() noexcept {
  try {
    const auto module_path = current_module_path();
    if (!module_path) {
      return std::nullopt;
    }
    const auto inner_filename = module_path->filename();
    const auto architecture_directory = module_path->parent_path();
    const auto contents_directory = architecture_directory.parent_path();
    const auto bundle_directory = contents_directory.parent_path();
    if (inner_filename.extension() != L".vst3" ||
        architecture_directory.filename().native() != kArchitectureDirectory ||
        contents_directory.filename().native() != kContentsDirectory ||
        bundle_directory.extension() != L".vst3" || bundle_directory.filename() != inner_filename) {
      return std::nullopt;
    }

    const auto resources_directory = contents_directory / L"Resources";
    auto product = read_compiled_product(resources_directory / kProductResourceFilename);
    auto execution_plan = read_compiled_graph(resources_directory / kGraphResourceFilename);
    if (!product || !execution_plan) {
      return std::nullopt;
    }
    const auto product_name = utf8_to_wide(product->name);
    if (!product_name || inner_filename != std::filesystem::path(*product_name + L".vst3")) {
      return std::nullopt;
    }
    return ProductRuntimeContext{std::move(*product), *execution_plan};
  } catch (...) {
    return std::nullopt;
  }
}

} // namespace garak::adapter::vst3::product_runtime_v1
''',
)

write(
    "native/adapters/vst3/product_runtime_v1/factory.cpp",
    r'''#include "factory_support.hpp"
#include "product_runtime_loader_win.hpp"

extern "C" SMTG_EXPORT_SYMBOL Steinberg::IPluginFactory* PLUGIN_API GetPluginFactory() {
  try {
    static const auto runtime =
        garak::adapter::vst3::product_runtime_v1::load_module_product_runtime();
    if (!runtime) {
      return nullptr;
    }
    return garak::adapter::vst3::product_runtime_v1::get_or_create_product_factory(*runtime);
  } catch (...) {
    return nullptr;
  }
}
''',
)

write(
    "native/adapters/vst3/product_runtime_v1/factory_support.hpp",
    r'''#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_FACTORY_SUPPORT_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_FACTORY_SUPPORT_HPP_INCLUDED

#include "product_runtime_context.hpp"

#include "pluginterfaces/base/ipluginbase.h"

namespace garak::adapter::vst3::product_runtime_v1 {

[[nodiscard]] Steinberg::FUID
class_id(const garak::runtime::product_v1::Identifier& value) noexcept;

[[nodiscard]] Steinberg::IPluginFactory*
get_or_create_product_factory(const ProductRuntimeContext& runtime) noexcept;

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
''',
)

write(
    "native/adapters/vst3/product_runtime_v1/factory_support.cpp",
    r'''#include "factory_support.hpp"

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
get_or_create_product_factory(const ProductRuntimeContext& runtime) noexcept {
  try {
    if (Steinberg::gPluginFactory != nullptr) {
      Steinberg::gPluginFactory->addRef();
      return Steinberg::gPluginFactory;
    }
    const auto& product = runtime.product;
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
    auto* const context = const_cast<ProductRuntimeContext*>(std::addressof(runtime));
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
''',
)

write(
    "native/adapters/vst3/product_runtime_v1/controller.cpp",
    r'''#include "controller.hpp"

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
''',
)

write(
    "native/adapters/vst3/product_runtime_v1/processor.hpp",
    r'''#ifndef GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PROCESSOR_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_PRODUCT_RUNTIME_V1_PROCESSOR_HPP_INCLUDED

#include "garak/runtime/product_v1/compiled_product.hpp"
#include "garak/runtime/static_graph/gain_plan.hpp"

#include "public.sdk/source/vst/vstaudioeffect.h"

#include <atomic>
#include <cstdint>

namespace garak::adapter::vst3::product_runtime_v1 {

class GainProcessor final : public Steinberg::Vst::AudioEffect {
public:
  GainProcessor(garak::runtime::product_v1::Identifier product_id, double default_gain_normalized,
                const garak::runtime::product_v1::Identifier& controller_class_id,
                garak::runtime::static_graph::GainExecutionPlan execution_plan) noexcept;

  static Steinberg::FUnknown* create_instance(void* context);

  Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
  Steinberg::tresult PLUGIN_API setBusArrangements(Steinberg::Vst::SpeakerArrangement* inputs,
                                                   Steinberg::int32 input_count,
                                                   Steinberg::Vst::SpeakerArrangement* outputs,
                                                   Steinberg::int32 output_count) override;
  Steinberg::tresult PLUGIN_API
  canProcessSampleSize(Steinberg::int32 symbolic_sample_size) override;
  Steinberg::tresult PLUGIN_API setProcessing(Steinberg::TBool state) override;
  Steinberg::tresult PLUGIN_API process(Steinberg::Vst::ProcessData& data) override;
  Steinberg::tresult PLUGIN_API setState(Steinberg::IBStream* state) override;
  Steinberg::tresult PLUGIN_API getState(Steinberg::IBStream* state) override;

private:
  void apply_pending_state() noexcept;
  void publish_processed_state(std::uint64_t processing_generation) noexcept;
  void write_snapshot_non_realtime(std::uint64_t packed_state) noexcept;
  [[nodiscard]] std::uint64_t read_snapshot_non_realtime() noexcept;

  static_assert(std::atomic<std::uint64_t>::is_always_lock_free);

  garak::runtime::product_v1::Identifier product_id_{};
  garak::runtime::static_graph::GainExecutionPlan execution_plan_{};
  std::atomic<std::uint64_t> pending_state_{};
  std::atomic<std::uint64_t> pending_generation_{};
  std::atomic<std::uint64_t> snapshot_state_{};
  std::atomic<std::uint64_t> snapshot_sequence_{};
  std::uint64_t applied_generation_{};
  double current_gain_normalized_{};
  bool current_bypass_{};
};

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
''',
)

replace_exact(
    "native/adapters/vst3/product_runtime_v1/CMakeLists.txt",
    "  compiled_product_loader_win.cpp\n  compiled_product_loader_win.hpp\n",
    "  product_runtime_context.hpp\n  product_runtime_loader_win.cpp\n  product_runtime_loader_win.hpp\n",
)

remove("native/adapters/vst3/product_runtime_v1/compiled_product_loader_win.cpp")
remove("native/adapters/vst3/product_runtime_v1/compiled_product_loader_win.hpp")

replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    '#include "garak/runtime/static_graph/gain_plan.hpp"\n',
    '#include "product_runtime_context.hpp"\n',
)
replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    '''constexpr auto kExecutionPlan = garak::runtime::static_graph::make_gain_execution_plan(
    garak::runtime::product_v1::kGainParameterId, garak::runtime::product_v1::kBypassParameterId);
static_assert(garak::runtime::static_graph::is_supported_gain_execution_plan(
    kExecutionPlan, garak::runtime::product_v1::kGainParameterId,
    garak::runtime::product_v1::kBypassParameterId));

''',
    "",
)
replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    '''process_audio(Steinberg::Vst::ProcessData& data, QueuePointSource& gain_source,
              QueuePointSource& bypass_source, double& current_gain, bool& current_bypass) {''',
    '''process_audio(const garak::runtime::static_graph::GainExecutionPlan& execution_plan,
              Steinberg::Vst::ProcessData& data, QueuePointSource& gain_source,
              QueuePointSource& bypass_source, double& current_gain, bool& current_bypass) {''',
)
replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    "      kExecutionPlan, garak::runtime::product_v1::kGainParameterId,\n",
    "      execution_plan, garak::runtime::product_v1::kGainParameterId,\n",
)
replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    '''GainProcessor::GainProcessor(
    garak::runtime::product_v1::Identifier product_id, const double default_gain_normalized,
    const garak::runtime::product_v1::Identifier& controller_class_id) noexcept
    : product_id_(product_id) {''',
    '''GainProcessor::GainProcessor(
    garak::runtime::product_v1::Identifier product_id, const double default_gain_normalized,
    const garak::runtime::product_v1::Identifier& controller_class_id,
    garak::runtime::static_graph::GainExecutionPlan execution_plan) noexcept
    : product_id_(product_id), execution_plan_(execution_plan) {''',
)
replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    '''    const auto* const product =
        static_cast<const garak::runtime::product_v1::CompiledProduct*>(context);
    if (product == nullptr) {
      return nullptr;
    }
    return static_cast<Steinberg::Vst::IAudioProcessor*>(new GainProcessor(
        product->product_id, product->parameters[0].default_normalized, product->controller_fuid));''',
    '''    const auto* const runtime = static_cast<const ProductRuntimeContext*>(context);
    if (runtime == nullptr) {
      return nullptr;
    }
    const auto& product = runtime->product;
    return static_cast<Steinberg::Vst::IAudioProcessor*>(new GainProcessor(
        product.product_id, product.parameters[0].default_normalized, product.controller_fuid,
        runtime->execution_plan));''',
)
replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    "          kExecutionPlan, garak::runtime::product_v1::kGainParameterId,\n",
    "          execution_plan_, garak::runtime::product_v1::kGainParameterId,\n",
)
replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    '''      result = process_audio<Steinberg::Vst::Sample32>(data, gain_source, bypass_source,
                                                       current_gain_normalized_, current_bypass_);''',
    '''      result = process_audio<Steinberg::Vst::Sample32>(
          execution_plan_, data, gain_source, bypass_source, current_gain_normalized_,
          current_bypass_);''',
)
replace_exact(
    "native/adapters/vst3/product_runtime_v1/processor.cpp",
    '''      result = process_audio<Steinberg::Vst::Sample64>(data, gain_source, bypass_source,
                                                       current_gain_normalized_, current_bypass_);''',
    '''      result = process_audio<Steinberg::Vst::Sample64>(
          execution_plan_, data, gain_source, bypass_source, current_gain_normalized_,
          current_bypass_);''',
)

replace_exact(
    "tools/product-compiler/src/export_windows.ts",
    '''import {
  decodeCompiledProduct,
  encodeCompiledProduct,
  sha256Hex,
} from "./compiled_product.ts";''',
    '''import {
  canonicalGainGraphPlan,
  decodeCompiledGraph,
  encodeCompiledGraph,
} from "./compiled_graph.ts";
import {
  decodeCompiledProduct,
  encodeCompiledProduct,
  sha256Hex,
} from "./compiled_product.ts";''',
)
replace_exact(
    "tools/product-compiler/src/export_windows.ts",
    '''  const expectedFiles = [
    "Contents/Resources/moduleinfo.json",
    "Contents/Resources/product.garakbin",
    `Contents/x86_64-win/${leaf}`,
  ];''',
    '''  const expectedFiles = [
    "Contents/Resources/graph.garakbin",
    "Contents/Resources/moduleinfo.json",
    "Contents/Resources/product.garakbin",
    `Contents/x86_64-win/${leaf}`,
  ];''',
)
replace_exact(
    "tools/product-compiler/src/export_windows.ts",
    '''  const compiledBytes = encodeCompiledProduct(options.project);
  assertCompiledParity(options.project, compiledBytes);''',
    '''  const compiledBytes = encodeCompiledProduct(options.project);
  assertCompiledParity(options.project, compiledBytes);
  const graphBytes = encodeCompiledGraph(canonicalGainGraphPlan());
  decodeCompiledGraph(graphBytes);''',
)
replace_exact(
    "tools/product-compiler/src/export_windows.ts",
    '''  const stagedInnerModule = path.join(innerDirectory, bundleLeaf);
  const stagedCompiled = path.join(resourcesDirectory, "product.garakbin");
  const stagedModuleInfo = path.join(resourcesDirectory, "moduleinfo.json");''',
    '''  const stagedInnerModule = path.join(innerDirectory, bundleLeaf);
  const stagedGraph = path.join(resourcesDirectory, "graph.garakbin");
  const stagedCompiled = path.join(resourcesDirectory, "product.garakbin");
  const stagedModuleInfo = path.join(resourcesDirectory, "moduleinfo.json");''',
)
replace_exact(
    "tools/product-compiler/src/export_windows.ts",
    '''    assertCompiledParity(options.project, stagedCompiledBytes);

    await invokeRequired(''',
    '''    assertCompiledParity(options.project, stagedCompiledBytes);
    await writeFile(stagedGraph, graphBytes, { flag: "wx" });
    const stagedGraphBytes = await readFile(stagedGraph);
    if (!stagedGraphBytes.equals(graphBytes)) {
      fail(
        "GARAK_EXPORT_GRAPH_PARITY",
        "export.compiledGraph",
        "Staged compiled graph bytes changed after writing.",
      );
    }
    decodeCompiledGraph(stagedGraphBytes);

    await invokeRequired(''',
)

replace_exact(
    "tools/product-compiler/tests/export_atomicity.test.ts",
    'test("exports an exact three-file bundle through injected official-tool behavior", async () => {',
    'test("exports an exact four-file bundle through injected official-tool behavior", async () => {',
)
replace_exact(
    "tools/product-compiler/tests/export_atomicity.test.ts",
    '''    assert.deepEqual(result.inventory, [
      "Contents/Resources/moduleinfo.json",
      "Contents/Resources/product.garakbin",
      "Contents/x86_64-win/Artist Gain Warm.vst3",
    ]);''',
    '''    assert.deepEqual(result.inventory, [
      "Contents/Resources/graph.garakbin",
      "Contents/Resources/moduleinfo.json",
      "Contents/Resources/product.garakbin",
      "Contents/x86_64-win/Artist Gain Warm.vst3",
    ]);
    assert.equal(
      (
        await readFile(
          path.join(result.bundlePath, "Contents", "Resources", "graph.garakbin"),
        )
      ).length,
      92,
    );''',
)

replace_exact(
    "studio/scripts/verify_product_workflow.mts",
    "    exported.value.inventory.length !== 3 ||\n",
    "    exported.value.inventory.length !== 4 ||\n",
)

replace_exact(
    "tools/product-compiler/scripts/verify_headless_export_no_build.ps1",
    "        'Contents/Resources/moduleinfo.json',\n        'Contents/Resources/product.garakbin',\n",
    "        'Contents/Resources/graph.garakbin',\n        'Contents/Resources/moduleinfo.json',\n        'Contents/Resources/product.garakbin',\n",
)
replace_exact(
    "tools/product-compiler/scripts/verify_headless_export_no_build.ps1",
    "    $compiled = Join-Path $BundlePath 'Contents\\Resources\\product.garakbin'\n",
    "    $graph = Join-Path $BundlePath 'Contents\\Resources\\graph.garakbin'\n    $compiled = Join-Path $BundlePath 'Contents\\Resources\\product.garakbin'\n",
)
replace_exact(
    "tools/product-compiler/scripts/verify_headless_export_no_build.ps1",
    "        runtimeSha256 = (Get-FileHash -LiteralPath $inner -Algorithm SHA256).Hash\n        compiledSha256 = (Get-FileHash -LiteralPath $compiled -Algorithm SHA256).Hash\n",
    "        runtimeSha256 = (Get-FileHash -LiteralPath $inner -Algorithm SHA256).Hash\n        graphSha256 = (Get-FileHash -LiteralPath $graph -Algorithm SHA256).Hash\n        compiledSha256 = (Get-FileHash -LiteralPath $compiled -Algorithm SHA256).Hash\n",
)
replace_exact(
    "tools/product-compiler/scripts/verify_headless_export_no_build.ps1",
    "foreach ($field in @('runtimeSha256', 'compiledSha256', 'moduleInfoSha256')) {\n",
    "foreach ($field in @('runtimeSha256', 'graphSha256', 'compiledSha256', 'moduleInfoSha256')) {\n",
)
replace_exact(
    "tools/product-compiler/scripts/verify_headless_export_no_build.ps1",
    "if ($warmSecond.compiledSha256 -ceq $brightSecond.compiledSha256) {\n",
    "if ($warmSecond.graphSha256 -cne $brightSecond.graphSha256) {\n    throw 'Warm and Bright compiled graph data must be identical.'\n}\nif ($warmSecond.compiledSha256 -ceq $brightSecond.compiledSha256) {\n",
)

# Keep the active migration/export evidence runner aligned with the current four-file bundle.
replace_exact(
    "tools/product-compiler/scripts/verify_project_migration_export_parity.ps1",
    "        'Contents/Resources/moduleinfo.json',\n        'Contents/Resources/product.garakbin',\n",
    "        'Contents/Resources/graph.garakbin',\n        'Contents/Resources/moduleinfo.json',\n        'Contents/Resources/product.garakbin',\n",
)
