#include "product_v1_test_fixtures.hpp"

#include "garak/runtime/product_v1/product_state.hpp"
#include "state_codec.hpp"

#include "pluginterfaces/base/funknownimpl.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/vstspeaker.h"
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/hosting/parameterchanges.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <Windows.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

namespace {

constexpr Steinberg::Vst::ParamID kGainParameterId = 1001;
constexpr Steinberg::Vst::ParamID kBypassParameterId = 1002;
constexpr Steinberg::int32 kSampleCount = 4;
constexpr double kTolerance = 1.0e-10;
constexpr std::wstring_view kUtf8FixtureParentWide = L"\uAC00\uB77D \uACBD\uB85C \U0001F4C1";
constexpr std::wstring_view kUtf8ProductNameWide = L"\uAC00\uB77D \U0001F39B Gain";
constexpr std::wstring_view kUtf8VendorWide = L"\uAC00\uB77D \uC5F0\uAD6C\uC18C \U0001F9EA";
constexpr std::u8string_view kUtf8ProductName = u8"\uAC00\uB77D \U0001F39B Gain";
constexpr std::u8string_view kUtf8Vendor = u8"\uAC00\uB77D \uC5F0\uAD6C\uC18C \U0001F9EA";

struct ExpectedProduct final {
  std::string_view name;
  std::string_view processor;
  std::string_view controller;
  double default_db;
  bool production_state;
  garak::runtime::product_v1::Identifier product_id;
};

constexpr std::array<ExpectedProduct, 7> kProducts{{
    {"Garak Gain Spike",
     "3D6F3C09296D49EF99334C4688F484EE",
     "2CD50BAE587A4F3E812399E550F352D4",
     0.0,
     false,
     {}},
    {"Garak Data Alpha",
     "4B2B557251D44CE9914F9B105136FB7E",
     "7A90454628B34A3497F05E7CC718F8A1",
     -6.0,
     false,
     {}},
    {"Garak Data Beta",
     "C29B7245261642668ADAC664B6817678",
     "1DE08859308F4A0A8473EA5CB70771D2",
     3.0,
     false,
     {}},
    {"Garak Thin Alpha",
     "93952A37BFA84FF1AC06CE58B9FA87EA",
     "E08F3ACCD825424AB238BBAB6B0248CC",
     -6.0,
     false,
     {}},
    {"Garak Thin Beta",
     "44BFB8B6F56946FF9F6F193529BCB967",
     "826C362FA2784F719351912BE834F9AB",
     3.0,
     false,
     {}},
    {"Artist Gain Warm", "3BA93DD6A062C97D89EC78F3652F83C4", "00DD9000A50F7F28F4AE084CD29C4330",
     -6.0, true, garak::test::product_v1::kWarmProductId},
    {"Artist Gain Bright", "FCB1FDAED3D981A2AE3AE5A20898C449", "32D933DFBD3C8110E014829EF5D62EA3",
     3.0, true, garak::test::product_v1::kBrightProductId},
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

class UniqueHandle final {
public:
  explicit UniqueHandle(const HANDLE value = nullptr) noexcept : value_(value) {}
  ~UniqueHandle() {
    if (value_ != nullptr && value_ != INVALID_HANDLE_VALUE) {
      CloseHandle(value_);
    }
  }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  UniqueHandle(UniqueHandle&& other) noexcept : value_(std::exchange(other.value_, nullptr)) {}
  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other) {
      if (value_ != nullptr && value_ != INVALID_HANDLE_VALUE) {
        CloseHandle(value_);
      }
      value_ = std::exchange(other.value_, nullptr);
    }
    return *this;
  }
  [[nodiscard]] HANDLE get() const noexcept { return value_; }

private:
  HANDLE value_{};
};

class FixedStream final
    : public Steinberg::U::ImplementsNonDestroyable<Steinberg::U::Directly<Steinberg::IBStream>> {
public:
  FixedStream() = default;
  explicit FixedStream(const std::span<const std::uint8_t> bytes) noexcept { assign(bytes); }

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
  void rewind() noexcept { cursor_ = 0; }
  void limit_transfers(const Steinberg::int32 maximum) noexcept { maximum_transfer_ = maximum; }
  [[nodiscard]] Steinberg::int32 size() const noexcept { return size_; }
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
  if (literal.size() != 32) {
    return {};
  }
  std::copy(literal.begin(), literal.end(), text.begin());
  Steinberg::FUID result;
  if (!result.fromString(text.data())) {
    return {};
  }
  return result;
}

[[nodiscard]] double normalized(const double db) noexcept { return (db + 60.0) / 72.0; }
[[nodiscard]] double linear(const double db) noexcept { return std::pow(10.0, db / 20.0); }
[[nodiscard]] bool nearly_equal(const double left, const double right) noexcept {
  return std::abs(left - right) <= kTolerance;
}

[[nodiscard]] std::unique_ptr<Session> load(TestContext& test, const std::filesystem::path& bundle,
                                            const ExpectedProduct& expected) {
  std::string error;
  auto module = VST3::Hosting::Module::create(bundle.generic_string(), error);
  test.expect(module != nullptr, "module loads");
  if (!module) {
    return nullptr;
  }
  const auto& factory = module->getFactory();
  const auto processor_id = class_id(expected.processor);
  const auto controller_id = class_id(expected.controller);
  const auto classes = factory.classInfos();
  bool saw_processor = false;
  bool saw_controller = false;
  for (const auto& info : classes) {
    const auto id = Steinberg::FUID::fromTUID(info.ID().data());
    if (id == processor_id) {
      saw_processor = info.name() == expected.name && info.subCategoriesString() == "Fx";
    } else if (id == controller_id) {
      saw_controller = info.name() == std::string(expected.name) + " Controller";
    }
  }
  test.expect(factory.classCount() == 2U && classes.size() == 2U && saw_processor && saw_controller,
              "factory exposes the exact processor/controller identity");

  auto session = std::make_unique<Session>();
  session->module = std::move(module);
  session->component =
      factory.createInstance<Steinberg::Vst::IComponent>(VST3::UID(processor_id.toTUID()));
  session->controller =
      factory.createInstance<Steinberg::Vst::IEditController>(VST3::UID(controller_id.toTUID()));
  if (!session->component || !session->controller) {
    test.expect(false, "factory creates processor and controller");
    return nullptr;
  }
  session->processor = session->component.get();
  session->component_initialized =
      session->component->initialize(nullptr) == Steinberg::kResultTrue;
  session->controller_initialized =
      session->controller->initialize(nullptr) == Steinberg::kResultTrue;
  test.expect(session->processor != nullptr && session->component_initialized &&
                  session->controller_initialized,
              "processor and controller initialize");
  if (!session->processor || !session->component_initialized || !session->controller_initialized) {
    return nullptr;
  }
  Steinberg::TUID associated{};
  Steinberg::Vst::ParameterInfo gain{};
  Steinberg::Vst::ParameterInfo bypass{};
  test.expect(session->component->getControllerClassId(associated) == Steinberg::kResultTrue &&
                  Steinberg::FUID::fromTUID(associated) == controller_id &&
                  session->controller->getParameterCount() == 2 &&
                  session->controller->getParameterInfo(0, gain) == Steinberg::kResultTrue &&
                  session->controller->getParameterInfo(1, bypass) == Steinberg::kResultTrue &&
                  gain.id == kGainParameterId && bypass.id == kBypassParameterId &&
                  nearly_equal(gain.defaultNormalizedValue, normalized(expected.default_db)),
              "controller association, IDs, and default are exact");
  test.expect(
      session->component->getBusCount(Steinberg::Vst::kEvent, Steinberg::Vst::kInput) == 0 &&
          session->component->getBusCount(Steinberg::Vst::kAudio, Steinberg::Vst::kInput) == 1 &&
          session->component->getBusCount(Steinberg::Vst::kAudio, Steinberg::Vst::kOutput) == 1 &&
          session->controller->createView(Steinberg::Vst::ViewType::kEditor) == nullptr,
      "product has audio-only main buses and no custom editor");
  return session;
}

[[nodiscard]] bool begin(const Steinberg::int32 precision, Session& session,
                         const Steinberg::Vst::SpeakerArrangement arrangement) {
  auto input = arrangement;
  auto output = arrangement;
  Steinberg::Vst::ProcessSetup setup{};
  setup.processMode = Steinberg::Vst::kRealtime;
  setup.symbolicSampleSize = precision;
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

template <typename Sample>
[[nodiscard]] Steinberg::tresult
process_stereo(Session& session, std::array<Sample, kSampleCount>& left,
               std::array<Sample, kSampleCount>& right, const bool in_place,
               Steinberg::Vst::IParameterChanges* changes = nullptr) {
  std::array<Sample, kSampleCount> output_left{};
  std::array<Sample, kSampleCount> output_right{};
  Sample* inputs[] = {left.data(), right.data()};
  Sample* outputs[] = {in_place ? left.data() : output_left.data(),
                       in_place ? right.data() : output_right.data()};
  Steinberg::Vst::AudioBusBuffers input{};
  Steinberg::Vst::AudioBusBuffers output{};
  input.numChannels = 2;
  output.numChannels = 2;
  if constexpr (std::is_same_v<Sample, Steinberg::Vst::Sample32>) {
    input.channelBuffers32 = inputs;
    output.channelBuffers32 = outputs;
  } else {
    input.channelBuffers64 = inputs;
    output.channelBuffers64 = outputs;
  }
  Steinberg::Vst::ProcessData data{};
  data.processMode = Steinberg::Vst::kRealtime;
  data.symbolicSampleSize = std::is_same_v<Sample, Steinberg::Vst::Sample32>
                                ? Steinberg::Vst::kSample32
                                : Steinberg::Vst::kSample64;
  data.numSamples = kSampleCount;
  data.numInputs = 1;
  data.numOutputs = 1;
  data.inputs = &input;
  data.outputs = &output;
  data.inputParameterChanges = changes;
  const auto result = session.processor->process(data);
  if (!in_place) {
    left = output_left;
    right = output_right;
  }
  return result;
}

template <typename Sample>
[[nodiscard]] Steinberg::tresult process_mono(Session& session,
                                              std::array<Sample, kSampleCount>& samples) {
  std::array<Sample, kSampleCount> output_samples{};
  Sample* inputs[] = {samples.data()};
  Sample* outputs[] = {output_samples.data()};
  Steinberg::Vst::AudioBusBuffers input{};
  Steinberg::Vst::AudioBusBuffers output{};
  input.numChannels = 1;
  output.numChannels = 1;
  if constexpr (std::is_same_v<Sample, Steinberg::Vst::Sample32>) {
    input.channelBuffers32 = inputs;
    output.channelBuffers32 = outputs;
  } else {
    input.channelBuffers64 = inputs;
    output.channelBuffers64 = outputs;
  }
  Steinberg::Vst::ProcessData data{};
  data.processMode = Steinberg::Vst::kRealtime;
  data.symbolicSampleSize = std::is_same_v<Sample, Steinberg::Vst::Sample32>
                                ? Steinberg::Vst::kSample32
                                : Steinberg::Vst::kSample64;
  data.numSamples = kSampleCount;
  data.numInputs = 1;
  data.numOutputs = 1;
  data.inputs = &input;
  data.outputs = &output;
  const auto result = session.processor->process(data);
  samples = output_samples;
  return result;
}

[[nodiscard]] Steinberg::tresult process_zero(Session& session,
                                              Steinberg::Vst::IParameterChanges* changes) {
  Steinberg::Vst::ProcessData data{};
  data.processMode = Steinberg::Vst::kRealtime;
  data.symbolicSampleSize = Steinberg::Vst::kSample64;
  data.numSamples = 0;
  data.inputParameterChanges = changes;
  return session.processor->process(data);
}

void check_product_behavior(TestContext& test, Session& session, const ExpectedProduct& expected) {
  test.expect(begin(Steinberg::Vst::kSample32, session, Steinberg::Vst::SpeakerArr::kMono),
              "Float32 mono processing starts");
  std::array<Steinberg::Vst::Sample32, kSampleCount> mono{1.0F, 1.0F, 1.0F, 1.0F};
  test.expect(process_mono(session, mono) == Steinberg::kResultTrue &&
                  std::abs(static_cast<double>(mono.front()) - linear(expected.default_db)) < 1e-5,
              "out-of-place Float32 mono uses the exact product default");
  stop(test, session);

  test.expect(begin(Steinberg::Vst::kSample32, session, Steinberg::Vst::SpeakerArr::kStereo),
              "Float32 stereo processing starts");
  std::array<Steinberg::Vst::Sample32, kSampleCount> left{1.0F, 1.0F, 1.0F, 1.0F};
  auto right = left;
  test.expect(process_stereo(session, left, right, false) == Steinberg::kResultTrue &&
                  std::abs(static_cast<double>(left.front()) - linear(expected.default_db)) < 1e-5,
              "out-of-place Float32 uses the exact product default");
  Steinberg::Vst::ParameterChanges changes(2);
  Steinberg::int32 queue_index = 0;
  Steinberg::int32 point_index = 0;
  auto* gain = changes.addParameterData(kGainParameterId, queue_index);
  auto* bypass = changes.addParameterData(kBypassParameterId, queue_index);
  const bool points_ok = gain != nullptr && bypass != nullptr &&
                         gain->addPoint(0, 0.0, point_index) == Steinberg::kResultTrue &&
                         gain->addPoint(3, 1.0, point_index) == Steinberg::kResultTrue &&
                         bypass->addPoint(1, 1.0, point_index) == Steinberg::kResultTrue &&
                         bypass->addPoint(2, 0.0, point_index) == Steinberg::kResultTrue;
  left.fill(1.0F);
  right.fill(1.0F);
  test.expect(points_ok &&
                  process_stereo(session, left, right, true, &changes) == Steinberg::kResultTrue &&
                  left[1] == 1.0F && std::abs(static_cast<double>(left[3]) - linear(12.0)) < 1e-5,
              "sample-offset Gain automation and exact-offset Bypass process in-place");
  stop(test, session);

  test.expect(begin(Steinberg::Vst::kSample64, session, Steinberg::Vst::SpeakerArr::kStereo),
              "Float64 processing starts");
  Steinberg::Vst::ParameterChanges zero_changes(1);
  queue_index = 0;
  point_index = 0;
  auto* zero_gain = zero_changes.addParameterData(kGainParameterId, queue_index);
  test.expect(zero_gain != nullptr &&
                  zero_gain->addPoint(0, normalized(expected.default_db), point_index) ==
                      Steinberg::kResultTrue &&
                  process_zero(session, &zero_changes) == Steinberg::kResultTrue,
              "zero-sample parameter-only call applies offset-zero automation");
  std::array<Steinberg::Vst::Sample64, kSampleCount> double_left{1.0, 1.0, 1.0, 1.0};
  auto double_right = double_left;
  test.expect(process_stereo(session, double_left, double_right, false) == Steinberg::kResultTrue &&
                  nearly_equal(double_left.front(), linear(expected.default_db)),
              "out-of-place Float64 behavior is exact");
  stop(test, session);

  test.expect(begin(Steinberg::Vst::kSample64, session, Steinberg::Vst::SpeakerArr::kMono),
              "Float64 mono processing starts");
  std::array<Steinberg::Vst::Sample64, kSampleCount> double_mono{1.0, 1.0, 1.0, 1.0};
  test.expect(process_mono(session, double_mono) == Steinberg::kResultTrue &&
                  nearly_equal(double_mono.front(), linear(expected.default_db)),
              "out-of-place Float64 mono behavior is exact");
  stop(test, session);
}

[[nodiscard]] std::vector<std::uint8_t> encode_state(const ExpectedProduct& product,
                                                     const double gain) {
  if (product.production_state) {
    garak::runtime::product_v1::EncodedProductState encoded{};
    if (garak::runtime::product_v1::encode_product_state(product.product_id, {gain, false},
                                                         encoded)) {
      return {encoded.begin(), encoded.end()};
    }
  } else {
    garak::spike::gain::EncodedState encoded{};
    if (garak::spike::gain::encode_state({gain, false}, encoded)) {
      return {encoded.begin(), encoded.end()};
    }
  }
  return {};
}

[[nodiscard]] bool decode_state(const ExpectedProduct& product,
                                const std::span<const std::uint8_t> bytes, double& gain) {
  if (product.production_state) {
    garak::runtime::product_v1::ProductState state{};
    if (!garak::runtime::product_v1::decode_product_state(bytes, product.product_id, state)) {
      return false;
    }
    gain = state.gain_normalized;
    return !state.bypass;
  }
  garak::spike::gain::SpikeState state{};
  if (!garak::spike::gain::decode_state(bytes, state)) {
    return false;
  }
  gain = state.gain_normalized;
  return !state.bypass;
}

void set_and_check_state(TestContext& test, Session& session, const ExpectedProduct& product,
                         const double gain) {
  const auto bytes = encode_state(product, gain);
  FixedStream input(bytes);
  test.expect(!bytes.empty() && session.component->setState(&input) == Steinberg::kResultTrue,
              "module accepts its product-bound state");
  FixedStream output;
  double decoded_gain = 0.0;
  test.expect(session.component->getState(&output) == Steinberg::kResultTrue &&
                  decode_state(product, output.bytes(), decoded_gain) && decoded_gain == gain,
              "module state round trip is exact");
  output.rewind();
  test.expect(session.controller->setComponentState(&output) == Steinberg::kResultTrue &&
                  session.controller->getParamNormalized(kGainParameterId) == gain,
              "controller restores the exact component state");
}

[[nodiscard]] bool read_component_gain(Session& session, const ExpectedProduct& product,
                                       double& gain) {
  FixedStream output;
  return session.component->getState(&output) == Steinberg::kResultTrue &&
         decode_state(product, output.bytes(), gain);
}

void expect_product_state_failure_preserves(TestContext& test, Session& session,
                                            const ExpectedProduct& product,
                                            const std::span<const std::uint8_t> bytes,
                                            const Steinberg::int32 maximum_transfer = 128) {
  double component_before = 0.0;
  const auto controller_gain_before = session.controller->getParamNormalized(kGainParameterId);
  const auto controller_bypass_before = session.controller->getParamNormalized(kBypassParameterId);
  test.expect(read_component_gain(session, product, component_before),
              "prior Product Runtime component state is readable");

  FixedStream processor_input(bytes);
  processor_input.limit_transfers(maximum_transfer);
  test.expect(session.component->setState(&processor_input) == Steinberg::kResultFalse,
              "Product Runtime processor rejects invalid or physically incomplete state");
  double component_after = 0.0;
  test.expect(read_component_gain(session, product, component_after) &&
                  component_after == component_before,
              "Product Runtime processor failure preserves prior state");

  FixedStream controller_input(bytes);
  controller_input.limit_transfers(maximum_transfer);
  test.expect(
      session.controller->setComponentState(&controller_input) == Steinberg::kResultFalse &&
          session.controller->getParamNormalized(kGainParameterId) == controller_gain_before &&
          session.controller->getParamNormalized(kBypassParameterId) == controller_bypass_before,
      "Product Runtime controller failure preserves both parameters");
}

void check_product_state_failure_boundaries(TestContext& test, Session& warm, Session& bright,
                                            const ExpectedProduct& warm_product,
                                            const ExpectedProduct& bright_product) {
  const auto warm_state = encode_state(warm_product, 0.25);
  auto truncated = warm_state;
  truncated.pop_back();
  expect_product_state_failure_preserves(test, warm, warm_product, truncated);

  auto trailing = warm_state;
  trailing.push_back(0);
  expect_product_state_failure_preserves(test, warm, warm_product, trailing);

  auto malformed = warm_state;
  malformed[0] ^= 0xFFU;
  expect_product_state_failure_preserves(test, warm, warm_product, malformed);
  expect_product_state_failure_preserves(test, warm, warm_product, warm_state, 95);

  garak::spike::gain::EncodedState legacy{};
  if (garak::spike::gain::encode_state({0.25, false}, legacy)) {
    expect_product_state_failure_preserves(test, warm, warm_product, legacy);
  } else {
    test.expect(false, "legacy GGS1 fixture encodes");
  }

  expect_product_state_failure_preserves(test, bright, bright_product, warm_state);

  double gain_before_short_write = 0.0;
  test.expect(read_component_gain(warm, warm_product, gain_before_short_write),
              "state is readable before short-success write");
  FixedStream short_write;
  short_write.limit_transfers(95);
  test.expect(warm.component->getState(&short_write) == Steinberg::kResultFalse &&
                  short_write.size() == 95,
              "Product Runtime rejects a short-success state write");
  double preserved_gain = 0.0;
  test.expect(read_component_gain(warm, warm_product, preserved_gain) &&
                  preserved_gain == gain_before_short_write,
              "short-success write failure preserves Product Runtime state");
}

[[nodiscard]] std::string utf8_bytes(const std::u8string_view value) {
  std::string result;
  result.reserve(value.size());
  for (const auto code_unit : value) {
    result.push_back(static_cast<char>(code_unit));
  }
  return result;
}

void write_u16(std::vector<std::uint8_t>& bytes, const std::size_t offset,
               const std::uint16_t value) {
  bytes[offset] = static_cast<std::uint8_t>(value);
  bytes[offset + 1] = static_cast<std::uint8_t>(value >> 8U);
}

void write_u32(std::vector<std::uint8_t>& bytes, const std::size_t offset,
               const std::uint32_t value) {
  for (std::size_t index = 0; index < 4; ++index) {
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
  }
}

[[nodiscard]] std::vector<std::uint8_t> utf8_compiled_product() {
  const auto vendor = utf8_bytes(kUtf8Vendor);
  const auto name = utf8_bytes(kUtf8ProductName);
  constexpr std::size_t kParameterBytes = 48;
  std::vector<std::uint8_t> result(
      garak::test::product_v1::kWarmCompiledProduct.begin(),
      garak::test::product_v1::kWarmCompiledProduct.begin() +
          static_cast<std::ptrdiff_t>(garak::runtime::product_v1::kCompiledProductHeaderSize));
  result.insert(result.end(), vendor.begin(), vendor.end());
  result.insert(result.end(), name.begin(), name.end());
  result.insert(result.end(),
                garak::test::product_v1::kWarmCompiledProduct.end() -
                    static_cast<std::ptrdiff_t>(kParameterBytes),
                garak::test::product_v1::kWarmCompiledProduct.end());
  write_u32(result, 16, static_cast<std::uint32_t>(result.size()));
  write_u16(result, 88, static_cast<std::uint16_t>(vendor.size()));
  write_u16(result, 90, static_cast<std::uint16_t>(name.size()));
  return result;
}

[[nodiscard]] std::string utf8_module_info() {
  const auto vendor = utf8_bytes(kUtf8Vendor);
  const auto name = utf8_bytes(kUtf8ProductName);
  return "{\n"
         "  \"Name\": \"" +
         name +
         "\",\n"
         "  \"Version\": \"0.1.0\",\n"
         "  \"Factory Info\": {\n"
         "    \"Vendor\": \"" +
         vendor +
         "\",\n"
         "    \"URL\": \"\",\n"
         "    \"E-Mail\": \"\",\n"
         "    \"Flags\": { \"Unicode\": true },\n"
         "  },\n"
         "  \"Classes\": [\n"
         "    {\n"
         "      \"CID\": \"3BA93DD6A062C97D89EC78F3652F83C4\",\n"
         "      \"Category\": \"Audio Module Class\",\n"
         "      \"Name\": \"" +
         name +
         "\",\n"
         "      \"Vendor\": \"" +
         vendor +
         "\",\n"
         "      \"Version\": \"0.1.0\",\n"
         "      \"SDKVersion\": \"VST 3.8.0\",\n"
         "      \"Sub Categories\": [\"Fx\"],\n"
         "      \"Class Flags\": 0,\n"
         "      \"Cardinality\": 2147483647,\n"
         "      \"Snapshots\": [],\n"
         "    },\n"
         "    {\n"
         "      \"CID\": \"00DD9000A50F7F28F4AE084CD29C4330\",\n"
         "      \"Category\": \"Component Controller Class\",\n"
         "      \"Name\": \"" +
         name +
         " Controller\",\n"
         "      \"Vendor\": \"" +
         vendor +
         "\",\n"
         "      \"Version\": \"0.1.0\",\n"
         "      \"SDKVersion\": \"VST 3.8.0\",\n"
         "      \"Class Flags\": 0,\n"
         "      \"Cardinality\": 2147483647,\n"
         "      \"Snapshots\": [],\n"
         "    },\n"
         "  ],\n"
         "}\n";
}

[[nodiscard]] bool write_binary(const std::filesystem::path& path,
                                const std::span<const std::uint8_t> bytes) {
  std::ofstream output(path, std::ios::binary | std::ios::trunc);
  output.write(reinterpret_cast<const char*>(bytes.data()),
               static_cast<std::streamsize>(bytes.size()));
  return output.good();
}

[[nodiscard]] bool write_text(const std::filesystem::path& path, const std::string_view text) {
  std::ofstream output(path, std::ios::binary | std::ios::trunc);
  output.write(text.data(), static_cast<std::streamsize>(text.size()));
  return output.good();
}

struct Utf8BundleFixture {
  std::filesystem::path source_bundle;
  std::filesystem::path fixture_root;
};

[[nodiscard]] std::optional<std::filesystem::path>
prepare_utf8_bundle(const Utf8BundleFixture& fixture) {
  std::error_code error;
  std::filesystem::remove_all(fixture.fixture_root, error);
  if (error || !std::filesystem::create_directories(fixture.fixture_root, error) || error) {
    return std::nullopt;
  }
  auto bundle =
      fixture.fixture_root / std::filesystem::path(std::wstring(kUtf8ProductNameWide) + L".vst3");
  std::filesystem::copy(fixture.source_bundle, bundle, std::filesystem::copy_options::recursive,
                        error);
  if (error) {
    return std::nullopt;
  }
  const auto module_directory = bundle / L"Contents" / L"x86_64-win";
  std::filesystem::rename(module_directory / fixture.source_bundle.filename(),
                          module_directory / bundle.filename(), error);
  if (error) {
    return std::nullopt;
  }
  const auto resources = bundle / L"Contents" / L"Resources";
  const auto compiled = utf8_compiled_product();
  const auto module_info = utf8_module_info();
  if (!write_binary(resources / L"product.garakbin", compiled) ||
      !write_text(resources / L"moduleinfo.json", module_info)) {
    return std::nullopt;
  }
  return bundle;
}

[[nodiscard]] std::wstring quote_argument(const std::wstring_view argument) {
  std::wstring result(1, L'\"');
  std::size_t backslashes = 0;
  for (const auto character : argument) {
    if (character == L'\\') {
      ++backslashes;
      continue;
    }
    if (character == L'\"') {
      result.append((backslashes * 2) + 1, L'\\');
      result.push_back(L'\"');
    } else {
      result.append(backslashes, L'\\');
      result.push_back(character);
    }
    backslashes = 0;
  }
  result.append(backslashes * 2, L'\\');
  result.push_back(L'\"');
  return result;
}

[[nodiscard]] std::optional<DWORD> run_process(const std::filesystem::path& executable,
                                               const std::vector<std::wstring>& arguments) {
  std::wstring command_line;
  for (const auto& argument : arguments) {
    if (!command_line.empty()) {
      command_line.push_back(L' ');
    }
    command_line += quote_argument(argument);
  }
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  if (CreateProcessW(executable.c_str(), command_line.data(), nullptr, nullptr, FALSE,
                     CREATE_NO_WINDOW, nullptr, nullptr, &startup, &process) == FALSE) {
    return std::nullopt;
  }
  UniqueHandle process_handle(process.hProcess);
  UniqueHandle thread_handle(process.hThread);
  constexpr DWORD kTimeoutMilliseconds = 30'000;
  if (WaitForSingleObject(process_handle.get(), kTimeoutMilliseconds) != WAIT_OBJECT_0) {
    return std::nullopt;
  }
  DWORD exit_code = 0;
  if (GetExitCodeProcess(process_handle.get(), &exit_code) == FALSE) {
    return std::nullopt;
  }
  return exit_code;
}

struct InspectorProcessFixture {
  std::filesystem::path source_bundle;
  std::filesystem::path inspector;
  std::filesystem::path fixture_root;
};

void check_inspector_utf8_process_boundary(TestContext& test,
                                           const InspectorProcessFixture& fixture) {
  const auto unicode_fixture_root =
      fixture.fixture_root / std::filesystem::path(kUtf8FixtureParentWide);
  const auto bundle = prepare_utf8_bundle({fixture.source_bundle, unicode_fixture_root});
  test.expect(bundle.has_value(), "UTF-8 inspector fixture is created outside canonical exports");
  if (!bundle) {
    return;
  }
  std::vector<std::wstring> arguments{
      fixture.inspector.wstring(),
      L"--bundle",
      bundle->wstring(),
      L"--product-id",
      L"6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
      L"--vendor",
      std::wstring(kUtf8VendorWide),
      L"--name",
      std::wstring(kUtf8ProductNameWide),
      L"--version",
      L"0.1.0",
      L"--category",
      L"Fx",
      L"--template",
      L"garak.gain-v1",
      L"--processor-fuid",
      L"3BA93DD6A062C97D89EC78F3652F83C4",
      L"--controller-fuid",
      L"00DD9000A50F7F28F4AE084CD29C4330",
      L"--gain-id",
      L"1001",
      L"--gain-default-normalized",
      L"0.75",
      L"--bypass-id",
      L"1002",
      L"--bypass-default-normalized",
      L"0",
  };
  const auto valid_result = run_process(fixture.inspector, arguments);
  if (!valid_result) {
    std::fputs("UTF-8 inspector process could not be observed\n", stderr);
  } else if (*valid_result != EXIT_SUCCESS) {
    std::fprintf(stderr, "UTF-8 inspector process exited with code %lu\n",
                 static_cast<unsigned long>(*valid_result));
  }
  test.expect(
      valid_result && *valid_result == EXIT_SUCCESS,
      "inspector preserves exact UTF-8 metadata and an emoji bundle path across process boundary");

  arguments[6] = std::wstring(1, static_cast<wchar_t>(0xD800));
  const auto invalid_result = run_process(fixture.inspector, arguments);
  test.expect(invalid_result && *invalid_result != EXIT_SUCCESS,
              "inspector fails closed on an unpaired UTF-16 surrogate argument");

  std::error_code cleanup_error;
  std::filesystem::remove_all(fixture.fixture_root, cleanup_error);
  test.expect(!cleanup_error, "UTF-8 inspector fixture is removed after the process test");
}

[[nodiscard]] bool files_equal(const std::array<std::filesystem::path, 2>& paths) {
  std::ifstream first(paths[0], std::ios::binary);
  std::ifstream second(paths[1], std::ios::binary);
  return std::vector<char>(std::istreambuf_iterator<char>(first),
                           std::istreambuf_iterator<char>()) ==
         std::vector<char>(std::istreambuf_iterator<char>(second),
                           std::istreambuf_iterator<char>());
}

[[nodiscard]] std::filesystem::path inner_module(const std::filesystem::path& bundle) {
  return bundle / "Contents" / "x86_64-win" / bundle.filename();
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
    if (argc != 11) {
      std::fputs("Usage: product_runtime_v1_contract_tests <seven bundles> <template> <inspector> "
                 "<UTF-8 fixture root>\n",
                 stderr);
      return EXIT_FAILURE;
    }
    TestContext test;
    std::string template_error;
    test.expect(VST3::Hosting::Module::create(argv[8], template_error) == nullptr,
                "Product Runtime template without product.garakbin fails closed");
    std::array<std::filesystem::path, 7> bundles{};
    std::array<std::unique_ptr<Session>, 7> sessions{};
    std::array<HMODULE, 7> handles{};
    std::array<Steinberg::FUID, 14> ids{};
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      bundles[index] = argv[index + 1];
      sessions[index] = load(test, bundles[index], kProducts[index]);
      if (!sessions[index]) {
        return test.result();
      }
      handles[index] = GetModuleHandleW(bundles[index].filename().c_str());
      test.expect(handles[index] != nullptr, "loaded product has a distinct module handle");
      ids[index * 2] = class_id(kProducts[index].processor);
      ids[(index * 2) + 1] = class_id(kProducts[index].controller);
    }
    for (std::size_t left = 0; left < ids.size(); ++left) {
      for (std::size_t right = left + 1; right < ids.size(); ++right) {
        test.expect(ids[left] != ids[right], "all fourteen class FUIDs are unique");
      }
    }
    for (std::size_t left = 0; left < handles.size(); ++left) {
      for (std::size_t right = left + 1; right < handles.size(); ++right) {
        test.expect(handles[left] != handles[right], "all seven modules have distinct handles");
      }
    }
    test.expect(bundles[5] != bundles[6] &&
                    files_equal({inner_module(bundles[5]), inner_module(bundles[6])}),
                "Warm/Bright use byte-identical Runtime files at distinct paths and handles");

    check_product_behavior(test, *sessions[5], kProducts[5]);
    check_product_behavior(test, *sessions[6], kProducts[6]);

    std::array<double, 7> state_values{};
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      state_values[index] = 0.1 * static_cast<double>(index + 1);
      set_and_check_state(test, *sessions[index], kProducts[index], state_values[index]);
    }

    check_product_state_failure_boundaries(test, *sessions[5], *sessions[6], kProducts[5],
                                           kProducts[6]);

    std::array<bool, 7> started{};
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      started[index] =
          begin(Steinberg::Vst::kSample64, *sessions[index], Steinberg::Vst::SpeakerArr::kStereo);
      test.expect(started[index], "interleaved product processing starts");
    }
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      std::array<double, kSampleCount> left{1.0, 1.0, 1.0, 1.0};
      auto right = left;
      const auto expected_db = (state_values[index] * 72.0) - 60.0;
      test.expect(process_stereo(*sessions[index], left, right, true) == Steinberg::kResultTrue &&
                      nearly_equal(left.front(), linear(expected_db)),
                  "interleaved output uses only its module state");
    }
    for (std::size_t reverse = sessions.size(); reverse > 0; --reverse) {
      stop(test, *sessions[reverse - 1]);
    }

    const auto& warm_factory = sessions[5]->module->getFactory();
    auto second_warm = warm_factory.createInstance<Steinberg::Vst::IComponent>(
        VST3::UID(class_id(kProducts[5].processor).toTUID()));
    const bool second_initialized =
        second_warm && second_warm->initialize(nullptr) == Steinberg::kResultTrue;
    FixedStream second_state;
    double second_gain = 0.0;
    test.expect(second_initialized &&
                    second_warm->getState(&second_state) == Steinberg::kResultTrue &&
                    decode_state(kProducts[5], second_state.bytes(), second_gain) &&
                    second_gain == normalized(kProducts[5].default_db),
                "same-module second instance retains its independent default state");
    if (second_initialized) {
      test.expect(second_warm->terminate() == Steinberg::kResultTrue,
                  "second Warm instance terminates cleanly");
    }
    second_warm.reset();

    for (std::size_t reverse = sessions.size(); reverse > 0; --reverse) {
      terminate(test, *sessions[reverse - 1]);
      sessions[reverse - 1].reset();
    }
    for (std::size_t index = 0; index < handles.size(); ++index) {
      test.expect(GetModuleHandleW(bundles[index].filename().c_str()) == nullptr,
                  "reverse unload releases every module handle");
    }
    auto reloaded = load(test, bundles[5], kProducts[5]);
    test.expect(reloaded != nullptr, "Warm reload preserves exact identity and default");
    if (reloaded) {
      terminate(test, *reloaded);
      reloaded.reset();
    }
    check_inspector_utf8_process_boundary(test, {bundles[5], argv[9], argv[10]});
    return test.result();
  } catch (...) {
    std::fputs("Unhandled Product Runtime v1 contract test exception\n", stderr);
    return EXIT_FAILURE;
  }
}
