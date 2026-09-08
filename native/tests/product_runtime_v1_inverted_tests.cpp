#include "product_v1_test_fixtures.hpp"

#include "garak/runtime/product_v1/product_state.hpp"

#include "pluginterfaces/base/funknownimpl.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
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

namespace {

constexpr Steinberg::int32 kSampleCount = 4;
constexpr double kTolerance = 1.0e-10;
constexpr std::string_view kProcessorFuid = "0F9440082CB44B2520D74808ABBE9BB7";

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

[[nodiscard]] bool near(const double actual, const double expected) noexcept {
  return std::abs(actual - expected) <= kTolerance;
}

struct Session final {
  VST3::Hosting::Module::Ptr module;
  Steinberg::IPtr<Steinberg::Vst::IComponent> component;
  Steinberg::FUnknownPtr<Steinberg::Vst::IAudioProcessor> processor;
  bool initialized{};
};

[[nodiscard]] bool begin(Session& session) {
  auto input = Steinberg::Vst::SpeakerArr::kStereo;
  auto output = Steinberg::Vst::SpeakerArr::kStereo;
  Steinberg::Vst::ProcessSetup setup{};
  setup.processMode = Steinberg::Vst::kRealtime;
  setup.symbolicSampleSize = Steinberg::Vst::kSample64;
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

[[nodiscard]] bool process(Session& session, const double expected_scale) {
  std::array<double, kSampleCount> left{1.0, 0.5, -0.25, -1.0};
  auto right = left;
  std::array<double, kSampleCount> output_left{};
  std::array<double, kSampleCount> output_right{};
  double* inputs[] = {left.data(), right.data()};
  double* outputs[] = {output_left.data(), output_right.data()};
  Steinberg::Vst::AudioBusBuffers input{};
  Steinberg::Vst::AudioBusBuffers output{};
  input.numChannels = 2;
  output.numChannels = 2;
  input.channelBuffers64 = inputs;
  output.channelBuffers64 = outputs;

  Steinberg::Vst::ProcessData data{};
  data.processMode = Steinberg::Vst::kRealtime;
  data.symbolicSampleSize = Steinberg::Vst::kSample64;
  data.numSamples = kSampleCount;
  data.numInputs = 1;
  data.numOutputs = 1;
  data.inputs = &input;
  data.outputs = &output;
  if (session.processor->process(data) != Steinberg::kResultTrue) {
    return false;
  }
  for (std::size_t index = 0; index < left.size(); ++index) {
    if (!near(output_left[index], left[index] * expected_scale) ||
        !near(output_right[index], right[index] * expected_scale)) {
      return false;
    }
  }
  return true;
}

[[nodiscard]] bool set_bypass(Session& session) {
  garak::runtime::product_v1::EncodedProductState encoded{};
  if (!garak::runtime::product_v1::encode_product_state(garak::test::product_v1::kInvertedProductId,
                                                        {5.0 / 6.0, true}, encoded)) {
    return false;
  }
  MemoryStream stream(encoded);
  return session.component->setState(&stream) == Steinberg::kResultTrue;
}

} // namespace

int main(const int argc, char* argv[]) {
  if (argc != 2) {
    std::fputs("Usage: garak_product_runtime_v1_inverted_tests <Inverted bundle>\n", stderr);
    return EXIT_FAILURE;
  }
  try {
    std::string error;
    Session session{};
    session.module =
        VST3::Hosting::Module::create(std::filesystem::path(argv[1]).generic_string(), error);
    if (!session.module) {
      std::fprintf(stderr, "Failed to load Inverted module: %s\n", error.c_str());
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
    if (!session.processor || !session.initialized || !begin(session) || !process(session, -1.0)) {
      return EXIT_FAILURE;
    }

    stop(session);
    if (!set_bypass(session) || !begin(session) || !process(session, 1.0)) {
      return EXIT_FAILURE;
    }
    stop(session);
    const auto terminated = session.component->terminate() == Steinberg::kResultTrue;
    session.initialized = false;
    return terminated ? EXIT_SUCCESS : EXIT_FAILURE;
  } catch (...) {
    return EXIT_FAILURE;
  }
}
