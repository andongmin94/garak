#include "product_v1_test_fixtures.hpp"

#include "garak/runtime/product_v1/product_state.hpp"

#include "pluginterfaces/base/funknownimpl.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
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
#include <memory>
#include <span>
#include <string>
#include <string_view>

namespace {

constexpr Steinberg::int32 kSampleCount = 4;
constexpr Steinberg::Vst::ParamID kGainParameterId = 1001;
constexpr double kTolerance = 1.0e-10;

struct Product final {
  std::string_view name;
  std::string_view processor_fuid;
  double default_db;
  garak::runtime::product_v1::Identifier product_id;
};

constexpr std::array<Product, 2> kProducts{{
    {"Artist Gain Warm", "3BA93DD6A062C97D89EC78F3652F83C4", -6.0,
     garak::test::product_v1::kWarmProductId},
    {"Artist Gain Bright", "FCB1FDAED3D981A2AE3AE5A20898C449", 3.0,
     garak::test::product_v1::kBrightProductId},
}};

class TestContext final {
public:
  void expect(const bool condition, const std::string_view message) noexcept {
    if (!condition) {
      std::fprintf(stderr, "FAIL: %.*s\n", static_cast<int>(message.size()), message.data());
      ++failures_;
    }
  }

  [[nodiscard]] int result() const noexcept { return failures_ == 0 ? EXIT_SUCCESS : EXIT_FAILURE; }

private:
  int failures_{};
};

class MemoryStream final
    : public Steinberg::U::ImplementsNonDestroyable<Steinberg::U::Directly<Steinberg::IBStream>> {
public:
  MemoryStream() = default;
  explicit MemoryStream(const std::span<const std::uint8_t> bytes) noexcept { assign(bytes); }

  Steinberg::tresult PLUGIN_API read(void* const buffer, const Steinberg::int32 count,
                                     Steinberg::int32* const read_count) override {
    if (read_count != nullptr) {
      *read_count = 0;
    }
    if (buffer == nullptr || count < 0 || cursor_ < 0 || cursor_ > size_ ||
        count > size_ - cursor_) {
      return Steinberg::kResultFalse;
    }
    const auto transferred = std::min(count, maximum_transfer_);
    std::memcpy(buffer, bytes_.data() + cursor_, static_cast<std::size_t>(transferred));
    cursor_ += transferred;
    if (read_count != nullptr) {
      *read_count = transferred;
    }
    return Steinberg::kResultTrue;
  }

  Steinberg::tresult PLUGIN_API write(void* const buffer, const Steinberg::int32 count,
                                      Steinberg::int32* const written) override {
    if (written != nullptr) {
      *written = 0;
    }
    const auto transferred = std::min(count, maximum_transfer_);
    if (buffer == nullptr || count < 0 || cursor_ < 0 ||
        transferred > static_cast<Steinberg::int32>(bytes_.size()) - cursor_) {
      return Steinberg::kResultFalse;
    }
    std::memcpy(bytes_.data() + cursor_, buffer, static_cast<std::size_t>(transferred));
    cursor_ += transferred;
    size_ = std::max(size_, cursor_);
    if (written != nullptr) {
      *written = transferred;
    }
    return Steinberg::kResultTrue;
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

  void assign(const std::span<const std::uint8_t> bytes) noexcept {
    bytes_.fill(0);
    if (bytes.size() <= bytes_.size()) {
      std::memcpy(bytes_.data(), bytes.data(), bytes.size());
      size_ = static_cast<Steinberg::int32>(bytes.size());
      cursor_ = 0;
    }
  }

  void limit_transfers(const Steinberg::int32 maximum) noexcept { maximum_transfer_ = maximum; }

  [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept {
    return {bytes_.data(), static_cast<std::size_t>(size_)};
  }

private:
  std::array<std::uint8_t, 128> bytes_{};
  Steinberg::int32 size_{};
  Steinberg::int32 cursor_{};
  Steinberg::int32 maximum_transfer_{128};
};

struct Session final {
  VST3::Hosting::Module::Ptr module;
  Steinberg::IPtr<Steinberg::Vst::IComponent> component;
  Steinberg::IPtr<Steinberg::Vst::IEditController> controller;
  Steinberg::FUnknownPtr<Steinberg::Vst::IAudioProcessor> processor;
  bool component_initialized{};
  bool controller_initialized{};
};

[[nodiscard]] Steinberg::FUID class_id(const std::string_view literal) {
  std::array<Steinberg::char8, 33> text{};
  std::copy(literal.begin(), literal.end(), text.begin());
  Steinberg::FUID result;
  return result.fromString(text.data()) ? result : Steinberg::FUID{};
}

[[nodiscard]] double normalized(const double db) noexcept { return (db + 60.0) / 72.0; }
[[nodiscard]] double linear(const double db) noexcept { return std::pow(10.0, db / 20.0); }
[[nodiscard]] bool nearly_equal(const double left, const double right) noexcept {
  return std::abs(left - right) <= kTolerance;
}

[[nodiscard]] std::unique_ptr<Session> load(TestContext& test, const std::filesystem::path& bundle,
                                            const Product& product) {
  std::string error;
  auto module = VST3::Hosting::Module::create(bundle.generic_string(), error);
  test.expect(module != nullptr, "product module loads");
  if (!module) {
    return nullptr;
  }

  const auto processor_id = class_id(product.processor_fuid);
  auto session = std::make_unique<Session>();
  session->module = std::move(module);
  session->component = session->module->getFactory().createInstance<Steinberg::Vst::IComponent>(
      VST3::UID(processor_id.toTUID()));
  test.expect(session->component != nullptr, "factory creates the product processor");
  if (!session->component) {
    return nullptr;
  }

  session->processor = session->component.get();
  session->component_initialized =
      session->component->initialize(nullptr) == Steinberg::kResultTrue;
  Steinberg::TUID controller_id{};
  if (session->component->getControllerClassId(controller_id) == Steinberg::kResultTrue) {
    session->controller = session->module->getFactory().createInstance<Steinberg::Vst::IEditController>(
        VST3::UID(controller_id));
  }
  session->controller_initialized =
      session->controller && session->controller->initialize(nullptr) == Steinberg::kResultTrue;
  test.expect(session->processor != nullptr && session->component_initialized &&
                  session->controller_initialized &&
                  session->controller->getParamNormalized(kGainParameterId) ==
                      normalized(product.default_db),
              "processor/controller initialize with the exact product default");
  return session;
}

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

void stop(TestContext& test, Session& session) {
  test.expect(session.processor->setProcessing(false) == Steinberg::kResultTrue &&
                  session.component->setActive(false) == Steinberg::kResultTrue,
              "processing stops cleanly");
}

[[nodiscard]] bool process(Session& session, const double expected_gain) {
  std::array<double, kSampleCount> left{1.0, 1.0, 1.0, 1.0};
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
  return session.processor->process(data) == Steinberg::kResultTrue &&
         nearly_equal(output_left.front(), expected_gain) &&
         nearly_equal(output_right.front(), expected_gain);
}

[[nodiscard]] garak::runtime::product_v1::EncodedProductState
encode_state(TestContext& test, const Product& product, const double gain) {
  garak::runtime::product_v1::EncodedProductState encoded{};
  test.expect(garak::runtime::product_v1::encode_product_state(product.product_id, {gain, false},
                                                               encoded),
              "product state encodes");
  return encoded;
}

[[nodiscard]] bool read_state(Session& session, const Product& product,
                              garak::runtime::product_v1::ProductState& state) {
  MemoryStream output;
  return session.component->getState(&output) == Steinberg::kResultTrue &&
         garak::runtime::product_v1::decode_product_state(output.bytes(), product.product_id, state);
}

void set_state(TestContext& test, Session& session, const Product& product, const double gain) {
  const auto encoded = encode_state(test, product, gain);
  MemoryStream input(encoded);
  test.expect(session.component->setState(&input) == Steinberg::kResultTrue,
              "product accepts its own state");
  garak::runtime::product_v1::ProductState restored{};
  test.expect(read_state(session, product, restored) && restored.gain_normalized == gain,
              "product state round trip is exact");
}

void terminate(TestContext& test, Session& session) {
  if (session.controller_initialized) {
    test.expect(session.controller->terminate() == Steinberg::kResultTrue,
                "controller terminates cleanly");
  }
  if (session.component_initialized) {
    test.expect(session.component->terminate() == Steinberg::kResultTrue,
                "component terminates cleanly");
  }
}

} // namespace

int main(const int argc, char* argv[]) {
  try {
    if (argc != 3) {
      std::fputs("Usage: garak_product_runtime_v1_smoke_tests <Warm bundle> <Bright bundle>\n",
                 stderr);
      return EXIT_FAILURE;
    }

    TestContext test;
    std::array<std::unique_ptr<Session>, 2> sessions{};
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      sessions[index] = load(test, argv[index + 1], kProducts[index]);
      if (!sessions[index]) {
        return test.result();
      }
      test.expect(begin(*sessions[index]), "product processing starts");
      test.expect(process(*sessions[index], linear(kProducts[index].default_db)),
                  "actual module output uses the compiled product default");
      stop(test, *sessions[index]);
    }

    set_state(test, *sessions[0], kProducts[0], 0.25);
    set_state(test, *sessions[1], kProducts[1], 0.75);

    const auto warm_state = encode_state(test, kProducts[0], 0.5);
    garak::runtime::product_v1::ProductState bright_before{};
    test.expect(read_state(*sessions[1], kProducts[1], bright_before),
                "Bright state is readable before foreign-state rejection");
    MemoryStream foreign_input(warm_state);
    test.expect(sessions[1]->component->setState(&foreign_input) == Steinberg::kResultFalse,
                "Bright rejects a valid Warm state");
    garak::runtime::product_v1::ProductState bright_after{};
    test.expect(read_state(*sessions[1], kProducts[1], bright_after) &&
                    bright_after == bright_before,
                "foreign-state rejection preserves Bright state");

    garak::runtime::product_v1::ProductState warm_before{};
    test.expect(read_state(*sessions[0], kProducts[0], warm_before),
                "Warm state is readable before short-stream rejection");
    MemoryStream short_input(warm_state);
    short_input.limit_transfers(95);
    test.expect(sessions[0]->component->setState(&short_input) == Steinberg::kResultFalse,
                "short-success state stream is rejected");
    garak::runtime::product_v1::ProductState warm_after{};
    test.expect(read_state(*sessions[0], kProducts[0], warm_after) && warm_after == warm_before,
                "short-stream rejection preserves Warm state");

    for (std::size_t index = 0; index < sessions.size(); ++index) {
      test.expect(begin(*sessions[index]), "interleaved product processing starts");
      const auto state_gain = index == 0 ? 0.25 : 0.75;
      test.expect(process(*sessions[index], linear((state_gain * 72.0) - 60.0)),
                  "each loaded product processes only its own state");
    }
    for (std::size_t reverse = sessions.size(); reverse > 0; --reverse) {
      stop(test, *sessions[reverse - 1]);
      terminate(test, *sessions[reverse - 1]);
      sessions[reverse - 1].reset();
    }
    return test.result();
  } catch (...) {
    std::fputs("Unhandled Product Runtime v1 smoke test exception\n", stderr);
    return EXIT_FAILURE;
  }
}
