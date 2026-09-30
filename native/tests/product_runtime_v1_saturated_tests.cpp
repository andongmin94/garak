#include "product_v1_test_fixtures.hpp"

#include "garak/runtime/product_v1/product_state.hpp"

#include "pluginterfaces/base/funknownimpl.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "pluginterfaces/vst/vstspeaker.h"
#include "public.sdk/source/vst/hosting/module.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <span>
#include <string>
#include <string_view>
#include <type_traits>

namespace {

constexpr Steinberg::int32 kSampleCount = 8;

constexpr std::string_view kProcessorFuid = "5BC75D591A2E038417BFAB96E15BB0B2";

class MemoryStream final
    : public Steinberg::U::ImplementsNonDestroyable<Steinberg::U::Directly<Steinberg::IBStream>> {
public:
  explicit MemoryStream(const std::span<const std::uint8_t> bytes) noexcept {
    if (bytes.size() <= bytes_.size()) {
      std::copy(bytes.begin(), bytes.end(), bytes_.begin());
      size_ = static_cast<Steinberg::int32>(bytes.size());
    }
  }

  Steinberg::tresult PLUGIN_API read(void* const buffer, const Steinberg::int32 count,
                                     Steinberg::int32* const read_count) override {
    if (read_count != nullptr) {
      *read_count = 0;
    }
    if (buffer == nullptr || count < 0 || cursor_ < 0 || cursor_ > size_ ||
        count > size_ - cursor_) {
      return Steinberg::kResultFalse;
    }
    std::memcpy(buffer, bytes_.data() + cursor_, static_cast<std::size_t>(count));
    cursor_ += count;
    if (read_count != nullptr) {
      *read_count = count;
    }
    return Steinberg::kResultTrue;
  }

  Steinberg::tresult PLUGIN_API write(void*, Steinberg::int32, Steinberg::int32*) override {
    return Steinberg::kResultFalse;
  }

  // NOLINTNEXTLINE(bugprone-easily-swappable-parameters): fixed SDK IBStream ABI.
  Steinberg::tresult PLUGIN_API seek(const Steinberg::int64 position, const Steinberg::int32 mode,
                                     Steinberg::int64* const result) override {
    Steinberg::int64 base = 0;
    if (mode == Steinberg::IBStream::kIBSeekCur) {
      base = cursor_;
    } else if (mode == Steinberg::IBStream::kIBSeekEnd) {
      base = size_;
    } else if (mode != Steinberg::IBStream::kIBSeekSet) {
      return Steinberg::kInvalidArgument;
    }
    if (position < -base || position > size_ - base) {
      return Steinberg::kResultFalse;
    }
    cursor_ = static_cast<Steinberg::int32>(base + position);
    if (result != nullptr) {
      *result = cursor_;
    }
    return Steinberg::kResultTrue;
  }

  Steinberg::tresult PLUGIN_API tell(Steinberg::int64* const position) override {
    if (position == nullptr) {
      return Steinberg::kInvalidArgument;
    }
    *position = cursor_;
    return Steinberg::kResultTrue;
  }

private:
  std::array<std::uint8_t, 128> bytes_{};
  Steinberg::int32 size_{};
  Steinberg::int32 cursor_{};
};

[[nodiscard]] Steinberg::FUID class_id(const std::string_view literal) {
  std::array<Steinberg::char8, 33> text{};
  std::copy(literal.begin(), literal.end(), text.begin());
  Steinberg::FUID result;
  return result.fromString(text.data()) ? result : Steinberg::FUID{};
}

template <typename Sample>
[[nodiscard]] bool near(const Sample actual, const Sample expected) noexcept {
  constexpr auto tolerance = std::is_same_v<Sample, float> ? 1.0e-6 : 1.0e-12;
  return std::abs(actual - expected) <= tolerance;
}

class BypassQueue final : public Steinberg::U::ImplementsNonDestroyable<
                              Steinberg::U::Directly<Steinberg::Vst::IParamValueQueue>> {
public:
  Steinberg::Vst::ParamID PLUGIN_API getParameterId() override {
    return garak::runtime::product_v1::kBypassParameterId;
  }
  Steinberg::int32 PLUGIN_API getPointCount() override { return 4; }
  // NOLINTBEGIN(bugprone-easily-swappable-parameters): fixed SDK IParamValueQueue ABI.
  Steinberg::tresult PLUGIN_API getPoint(const Steinberg::int32 index,
                                         Steinberg::int32& sample_offset,
                                         Steinberg::Vst::ParamValue& value) override {
    // NOLINTEND(bugprone-easily-swappable-parameters)
    if (index < 0 || index >= getPointCount()) {
      return Steinberg::kResultFalse;
    }
    sample_offset = index * 2;
    value = index % 2 == 0 ? 0.0 : 1.0;
    return Steinberg::kResultTrue;
  }
  Steinberg::tresult PLUGIN_API addPoint(Steinberg::int32, Steinberg::Vst::ParamValue,
                                         Steinberg::int32&) override {
    return Steinberg::kResultFalse;
  }
};

class BypassChanges final : public Steinberg::U::ImplementsNonDestroyable<
                                Steinberg::U::Directly<Steinberg::Vst::IParameterChanges>> {
public:
  Steinberg::int32 PLUGIN_API getParameterCount() override { return 1; }
  Steinberg::Vst::IParamValueQueue* PLUGIN_API
  getParameterData(const Steinberg::int32 index) override {
    return index == 0 ? &queue_ : nullptr;
  }
  Steinberg::Vst::IParamValueQueue* PLUGIN_API addParameterData(const Steinberg::Vst::ParamID&,
                                                                Steinberg::int32&) override {
    return nullptr;
  }

private:
  BypassQueue queue_;
};

struct Session final {
  VST3::Hosting::Module::Ptr module;
  Steinberg::IPtr<Steinberg::Vst::IComponent> component;
  Steinberg::FUnknownPtr<Steinberg::Vst::IAudioProcessor> processor;
  bool initialized{};
};

template <typename Sample> [[nodiscard]] bool begin(Session& session) {
  auto input = Steinberg::Vst::SpeakerArr::kStereo;
  auto output = Steinberg::Vst::SpeakerArr::kStereo;
  Steinberg::Vst::ProcessSetup setup{};
  setup.processMode = Steinberg::Vst::kRealtime;
  setup.symbolicSampleSize =
      std::is_same_v<Sample, float> ? Steinberg::Vst::kSample32 : Steinberg::Vst::kSample64;
  setup.maxSamplesPerBlock = 64;
  setup.sampleRate = 48'000.0;
  return session.processor->setBusArrangements(&input, 1, &output, 1) == Steinberg::kResultTrue &&
         session.processor->setupProcessing(setup) == Steinberg::kResultTrue &&
         session.component->setActive(true) == Steinberg::kResultTrue &&
         session.processor->setProcessing(true) == Steinberg::kResultTrue;
}

void stop(Session& session) {
  static_cast<void>(session.processor->setProcessing(false));
  static_cast<void>(session.component->setActive(false));
}

enum class ProcessingMode : std::uint8_t { active, automated_bypass, bypassed };

template <typename Sample> [[nodiscard]] bool process(Session& session, const ProcessingMode mode) {
  const std::array<Sample, kSampleCount> reference{
      static_cast<Sample>(4),  static_cast<Sample>(0.5), static_cast<Sample>(-0.25),
      static_cast<Sample>(-2), static_cast<Sample>(1),   static_cast<Sample>(-1),
      static_cast<Sample>(0),  static_cast<Sample>(-0.0)};
  auto left = reference;
  auto right = reference;
  std::array<Sample, kSampleCount> output_left{};
  std::array<Sample, kSampleCount> output_right{};
  Sample* inputs[] = {left.data(), right.data()};
  Sample* outputs[] = {output_left.data(), output_right.data()};
  Steinberg::Vst::AudioBusBuffers input{};
  Steinberg::Vst::AudioBusBuffers output{};
  input.numChannels = 2;
  output.numChannels = 2;
  if constexpr (std::is_same_v<Sample, float>) {
    input.channelBuffers32 = inputs;
    output.channelBuffers32 = outputs;
  } else {
    input.channelBuffers64 = inputs;
    output.channelBuffers64 = outputs;
  }

  BypassChanges changes;
  Steinberg::Vst::ProcessData data{};
  data.processMode = Steinberg::Vst::kRealtime;
  data.symbolicSampleSize =
      std::is_same_v<Sample, float> ? Steinberg::Vst::kSample32 : Steinberg::Vst::kSample64;
  data.numSamples = kSampleCount;
  data.numInputs = 1;
  data.numOutputs = 1;
  data.inputs = &input;
  data.outputs = &output;
  data.inputParameterChanges = mode == ProcessingMode::automated_bypass ? &changes : nullptr;
  if (session.processor->process(data) != Steinberg::kResultTrue) {
    return false;
  }
  for (std::size_t index = 0; index < left.size(); ++index) {
    const bool bypass =
        mode == ProcessingMode::bypassed ||
        (mode == ProcessingMode::automated_bypass && (index == 2 || index == 3 || index >= 6));
    const auto dry = reference[index];
    const auto expected = bypass ? dry : std::tanh(dry);
    for (const auto actual : {output_left[index], output_right[index]}) {
      if ((bypass && (actual != dry || std::signbit(actual) != std::signbit(dry))) ||
          (!bypass && !near(actual, expected))) {
        return false;
      }
    }
  }
  return left == reference && right == reference;
}

[[nodiscard]] bool set_bypass(Session& session, const bool bypass) {
  garak::runtime::product_v1::EncodedProductState encoded{};
  if (!garak::runtime::product_v1::encode_product_state(
          garak::test::product_v1::kSaturatedProductId, {5.0 / 6.0, bypass}, encoded)) {
    return false;
  }
  MemoryStream stream(encoded);
  return session.component->setState(&stream) == Steinberg::kResultTrue;
}

template <typename Sample> [[nodiscard]] bool test_processing(Session& session) {
  if (!set_bypass(session, false) || !begin<Sample>(session)) {
    return false;
  }
  const auto active_ok = process<Sample>(session, ProcessingMode::active) &&
                         process<Sample>(session, ProcessingMode::automated_bypass);
  stop(session);
  if (!active_ok || !set_bypass(session, true) || !begin<Sample>(session)) {
    return false;
  }
  const auto bypass_ok = process<Sample>(session, ProcessingMode::bypassed);
  stop(session);
  return bypass_ok;
}

} // namespace

int main(const int argc, char* argv[]) {
  if (argc != 2) {
    std::fputs("Usage: garak_product_runtime_v1_saturated_tests <Saturated bundle>\n", stderr);
    return EXIT_FAILURE;
  }
  try {
    std::string error;
    Session session{};
    session.module =
        VST3::Hosting::Module::create(std::filesystem::path(argv[1]).generic_string(), error);
    if (!session.module) {
      std::fprintf(stderr, "Failed to load Saturated module: %s\n", error.c_str());
      return EXIT_FAILURE;
    }
    const auto processor_id = class_id(kProcessorFuid);
    session.component = session.module->getFactory().createInstance<Steinberg::Vst::IComponent>(
        VST3::UID(processor_id.toTUID()));
    if (!session.component) {
      return EXIT_FAILURE;
    }
    session.processor = session.component.get();
    session.initialized = session.component->initialize(nullptr) == Steinberg::kResultTrue;
    if (!session.processor || !session.initialized || !test_processing<float>(session) ||
        !test_processing<double>(session)) {
      std::fputs("Saturated module Float32/Float64 processing or sample-accurate Bypass failed\n",
                 stderr);
      return EXIT_FAILURE;
    }
    const auto terminated = session.component->terminate() == Steinberg::kResultTrue;
    session.initialized = false;
    return terminated ? EXIT_SUCCESS : EXIT_FAILURE;
  } catch (...) {
    return EXIT_FAILURE;
  }
}
