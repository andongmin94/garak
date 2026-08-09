#include "state_codec.hpp"

#include "pluginterfaces/base/funknownimpl.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/vstspeaker.h"
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/hosting/parameterchanges.h"
#include "public.sdk/source/vst/moduleinfo/moduleinfoparser.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <Windows.h>

#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <memory>
#include <optional>
#include <span>
#include <sstream>
#include <string>
#include <string_view>
#include <type_traits>

namespace {

constexpr Steinberg::Vst::ParamID kGainParameterId = 1001;
constexpr Steinberg::Vst::ParamID kBypassParameterId = 1002;
constexpr Steinberg::int32 kSampleCount = 4;
constexpr double kFloatTolerance = 1.0e-5;
constexpr double kDoubleTolerance = 1.0e-12;
constexpr std::string_view kExpectedVendor = "Garak";
constexpr std::string_view kExpectedVersion = "0.1.0";
constexpr std::string_view kExpectedProcessorCategory = "Audio Module Class";
constexpr std::string_view kExpectedControllerCategory = "Component Controller Class";
constexpr std::string_view kExpectedProcessorSubcategory = "Fx";

struct ExpectedProduct final {
  std::string_view name;
  std::array<std::uint32_t, 4> processor;
  std::string_view processor_cid;
  std::array<std::uint32_t, 4> controller;
  std::string_view controller_cid;
  double default_db;
  bool has_module_info;
};

constexpr std::array<ExpectedProduct, 5> kExpectedProducts{{
    {"Garak Gain Spike",
     {0x3D6F3C09, 0x296D49EF, 0x99334C46, 0x88F484EE},
     "3D6F3C09296D49EF99334C4688F484EE",
     {0x2CD50BAE, 0x587A4F3E, 0x812399E5, 0x50F352D4},
     "2CD50BAE587A4F3E812399E550F352D4",
     0.0,
     false},
    {"Garak Data Alpha",
     {0x4B2B5572, 0x51D44CE9, 0x914F9B10, 0x5136FB7E},
     "4B2B557251D44CE9914F9B105136FB7E",
     {0x7A904546, 0x28B34A34, 0x97F05E7C, 0xC718F8A1},
     "7A90454628B34A3497F05E7CC718F8A1",
     -6.0,
     true},
    {"Garak Data Beta",
     {0xC29B7245, 0x26164266, 0x8ADAC664, 0xB6817678},
     "C29B7245261642668ADAC664B6817678",
     {0x1DE08859, 0x308F4A0A, 0x8473EA5C, 0xB70771D2},
     "1DE08859308F4A0A8473EA5CB70771D2",
     3.0,
     true},
    {"Garak Thin Alpha",
     {0x93952A37, 0xBFA84FF1, 0xAC06CE58, 0xB9FA87EA},
     "93952A37BFA84FF1AC06CE58B9FA87EA",
     {0xE08F3ACC, 0xD825424A, 0xB238BBAB, 0x6B0248CC},
     "E08F3ACCD825424AB238BBAB6B0248CC",
     -6.0,
     true},
    {"Garak Thin Beta",
     {0x44BFB8B6, 0xF56946FF, 0x9F6F1935, 0x29BCB967},
     "44BFB8B6F56946FF9F6F193529BCB967",
     {0x826C362F, 0xA2784F71, 0x9351912B, 0xE834F9AB},
     "826C362FA2784F719351912BE834F9AB",
     3.0,
     true},
}};

constexpr std::string_view kValidDescriptor = "GARAK_PRODUCT_SPIKE_V1\n"
                                              "schema=1\n"
                                              "vendor=Garak\n"
                                              "product_name=Garak Data Alpha\n"
                                              "semantic_version=0.1.0\n"
                                              "processor_fuid=4B2B557251D44CE9914F9B105136FB7E\n"
                                              "controller_fuid=7A90454628B34A3497F05E7CC718F8A1\n"
                                              "gain_parameter_id=1001\n"
                                              "bypass_parameter_id=1002\n"
                                              "default_gain_db=-6.0\n"
                                              "category=Fx\n";

class TestContext final {
public:
  void expect(const bool condition, const std::string_view message) {
    if (!condition) {
      std::cerr << "FAIL: " << message << '\n';
      ++failures_;
    }
  }

  [[nodiscard]] int result() const noexcept { return failures_ == 0 ? 0 : 1; }

private:
  int failures_{};
};

class FixedStream final
    : public Steinberg::U::ImplementsNonDestroyable<Steinberg::U::Directly<Steinberg::IBStream>> {
public:
  FixedStream() = default;
  explicit FixedStream(const std::span<const std::uint8_t> bytes) noexcept { assign(bytes); }

  Steinberg::tresult PLUGIN_API read(void* const buffer, const Steinberg::int32 byte_count,
                                     Steinberg::int32* const bytes_read) override {
    if (bytes_read != nullptr) {
      *bytes_read = 0;
    }
    if (buffer == nullptr || byte_count < 0 || cursor_ < 0 || cursor_ > size_ ||
        byte_count > size_ - cursor_) {
      return Steinberg::kResultFalse;
    }
    std::memcpy(buffer, bytes_.data() + cursor_, static_cast<std::size_t>(byte_count));
    cursor_ += byte_count;
    if (bytes_read != nullptr) {
      *bytes_read = byte_count;
    }
    return Steinberg::kResultTrue;
  }

  Steinberg::tresult PLUGIN_API write(void* const buffer, const Steinberg::int32 byte_count,
                                      Steinberg::int32* const bytes_written) override {
    if (bytes_written != nullptr) {
      *bytes_written = 0;
    }
    if (buffer == nullptr || byte_count < 0 || cursor_ < 0 ||
        byte_count > static_cast<Steinberg::int32>(bytes_.size()) - cursor_) {
      return Steinberg::kResultFalse;
    }
    std::memcpy(bytes_.data() + cursor_, buffer, static_cast<std::size_t>(byte_count));
    cursor_ += byte_count;
    size_ = cursor_ > size_ ? cursor_ : size_;
    if (bytes_written != nullptr) {
      *bytes_written = byte_count;
    }
    return Steinberg::kResultTrue;
  }

  // The parameter order is fixed by Steinberg::IBStream.
  // NOLINTNEXTLINE(bugprone-easily-swappable-parameters)
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
  [[nodiscard]] Steinberg::int32 size() const noexcept { return size_; }
  [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept {
    return {bytes_.data(), static_cast<std::size_t>(size_)};
  }

private:
  std::array<std::uint8_t, 64> bytes_{};
  Steinberg::int32 size_{};
  Steinberg::int32 cursor_{};
};

[[nodiscard]] Steinberg::FUID class_id(const std::array<std::uint32_t, 4>& words) {
  return {words[0], words[1], words[2], words[3]};
}

[[nodiscard]] double normalized(const double db) noexcept { return (db + 60.0) / 72.0; }

[[nodiscard]] double linear_gain(const double db) noexcept { return std::pow(10.0, db / 20.0); }

[[nodiscard]] bool approximately_equal(const double actual, const double expected,
                                       const double tolerance) noexcept {
  return std::abs(actual - expected) <= tolerance;
}

struct ProductSession final {
  VST3::Hosting::Module::Ptr module;
  Steinberg::IPtr<Steinberg::Vst::IComponent> component;
  Steinberg::IPtr<Steinberg::Vst::IEditController> controller;
  Steinberg::FUnknownPtr<Steinberg::Vst::IAudioProcessor> processor;
  bool component_initialized{};
  bool controller_initialized{};
};

struct ProcessingConfiguration final {
  Steinberg::int32 sample_size;
  Steinberg::Vst::SpeakerArrangement arrangement;
};

[[nodiscard]] std::unique_ptr<ProductSession> load_product(TestContext& test,
                                                           const std::filesystem::path& bundle,
                                                           const ExpectedProduct& expected) {
  std::string error;
  auto module = VST3::Hosting::Module::create(bundle.generic_string(), error);
  test.expect(module != nullptr, "module loads");
  if (module == nullptr) {
    std::cerr << "Load error for " << bundle << ": " << error << '\n';
    return nullptr;
  }
  const auto& factory = module->getFactory();
  const auto classes = factory.classInfos();
  test.expect(factory.classCount() == 2U && classes.size() == 2U,
              "factory exposes exactly two classes");
  test.expect(factory.info().vendor() == "Garak", "factory vendor is Garak");

  const auto processor_id = class_id(expected.processor);
  const auto controller_id = class_id(expected.controller);
  const VST3::UID processor_uid(processor_id.toTUID());
  const VST3::UID controller_uid(controller_id.toTUID());
  bool saw_processor = false;
  bool saw_controller = false;
  for (const auto& info : classes) {
    const auto id = Steinberg::FUID::fromTUID(info.ID().data());
    if (id == processor_id) {
      saw_processor = true;
      test.expect(info.name() == expected.name, "processor product name is exact");
      test.expect(info.vendor() == "Garak", "processor vendor is exact");
      test.expect(info.version() == "0.1.0", "processor version is exact");
      test.expect(info.subCategoriesString() == "Fx", "processor category is Fx");
      test.expect(info.category() == kVstAudioEffectClass, "processor class category is exact");
    } else if (id == controller_id) {
      saw_controller = true;
      test.expect(info.name() == std::string(expected.name) + " Controller",
                  "controller product name is exact");
      test.expect(info.category() == kVstComponentControllerClass,
                  "controller class category is exact");
    }
  }
  test.expect(saw_processor && saw_controller, "both independently pinned FUIDs are present");

  const auto repeated_classes = factory.classInfos();
  bool repeated_metadata_matches =
      repeated_classes.size() == classes.size() && factory.classCount() == 2U;
  if (repeated_metadata_matches) {
    for (std::size_t index = 0; index < classes.size(); ++index) {
      const auto& first = classes[index];
      const auto& repeated = repeated_classes[index];
      repeated_metadata_matches =
          repeated_metadata_matches && first.ID() == repeated.ID() &&
          first.name() == repeated.name() && first.vendor() == repeated.vendor() &&
          first.version() == repeated.version() && first.category() == repeated.category() &&
          first.subCategoriesString() == repeated.subCategoriesString();
    }
  }
  test.expect(repeated_metadata_matches, "repeated factory metadata lookup is consistent");

  auto session = std::make_unique<ProductSession>();
  session->module = std::move(module);
  session->component = factory.createInstance<Steinberg::Vst::IComponent>(processor_uid);
  session->controller = factory.createInstance<Steinberg::Vst::IEditController>(controller_uid);
  test.expect(session->component != nullptr && session->controller != nullptr,
              "factory creates processor and controller");
  if (session->component == nullptr || session->controller == nullptr) {
    return nullptr;
  }
  session->processor = session->component.get();
  test.expect(session->processor != nullptr, "component implements IAudioProcessor");
  if (session->processor == nullptr) {
    return nullptr;
  }
  Steinberg::TUID associated{};
  test.expect(session->component->getControllerClassId(associated) == Steinberg::kResultTrue &&
                  Steinberg::FUID::fromTUID(associated) == controller_id,
              "processor/controller association is exact");
  session->component_initialized =
      session->component->initialize(nullptr) == Steinberg::kResultTrue;
  session->controller_initialized =
      session->controller->initialize(nullptr) == Steinberg::kResultTrue;
  test.expect(session->component_initialized && session->controller_initialized,
              "component and controller initialize");
  if (!session->component_initialized || !session->controller_initialized) {
    return nullptr;
  }

  test.expect(
      session->component->getBusCount(Steinberg::Vst::kAudio, Steinberg::Vst::kInput) == 1 &&
          session->component->getBusCount(Steinberg::Vst::kAudio, Steinberg::Vst::kOutput) == 1,
      "one audio input and output are exposed");
  test.expect(session->component->getBusCount(Steinberg::Vst::kEvent, Steinberg::Vst::kInput) == 0,
              "no MIDI/event input is exposed");
  test.expect(session->controller->getParameterCount() == 2,
              "controller exposes Gain and Bypass only");
  Steinberg::Vst::ParameterInfo gain{};
  Steinberg::Vst::ParameterInfo bypass{};
  test.expect(session->controller->getParameterInfo(0, gain) == Steinberg::kResultTrue &&
                  session->controller->getParameterInfo(1, bypass) == Steinberg::kResultTrue,
              "parameter metadata is readable");
  test.expect(gain.id == kGainParameterId && bypass.id == kBypassParameterId,
              "parameter IDs are independently pinned");
  test.expect(approximately_equal(gain.defaultNormalizedValue, normalized(expected.default_db),
                                  kDoubleTolerance),
              "product default Gain is exact");
  test.expect(bypass.defaultNormalizedValue == 0.0 &&
                  (bypass.flags & Steinberg::Vst::ParameterInfo::kIsBypass) != 0U,
              "Bypass defaults off and is marked bypass");
  test.expect(session->controller->createView(Steinberg::Vst::ViewType::kEditor) == nullptr,
              "product is editorless");
  return session;
}

template <typename Sample>
[[nodiscard]] Steinberg::tresult
process_block(Steinberg::Vst::IAudioProcessor& processor, std::array<Sample, kSampleCount>& left,
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
  const auto result = processor.process(data);
  if (!in_place) {
    left = output_left;
    right = output_right;
  }
  return result;
}

[[nodiscard]] Steinberg::tresult
process_mono_in_place(Steinberg::Vst::IAudioProcessor& processor,
                      std::array<Steinberg::Vst::Sample64, kSampleCount>& samples) {
  Steinberg::Vst::Sample64* channels[] = {samples.data()};
  Steinberg::Vst::AudioBusBuffers input{};
  Steinberg::Vst::AudioBusBuffers output{};
  input.numChannels = 1;
  output.numChannels = 1;
  input.channelBuffers64 = channels;
  output.channelBuffers64 = channels;
  Steinberg::Vst::ProcessData data{};
  data.processMode = Steinberg::Vst::kRealtime;
  data.symbolicSampleSize = Steinberg::Vst::kSample64;
  data.numSamples = kSampleCount;
  data.numInputs = 1;
  data.numOutputs = 1;
  data.inputs = &input;
  data.outputs = &output;
  return processor.process(data);
}

[[nodiscard]] bool begin_processing(ProductSession& session,
                                    const ProcessingConfiguration configuration) {
  auto input = configuration.arrangement;
  auto output = configuration.arrangement;
  Steinberg::Vst::ProcessSetup setup{};
  setup.processMode = Steinberg::Vst::kRealtime;
  setup.symbolicSampleSize = configuration.sample_size;
  setup.maxSamplesPerBlock = 64;
  setup.sampleRate = 48'000.0;
  return session.processor->setBusArrangements(&input, 1, &output, 1) == Steinberg::kResultTrue &&
         session.processor->setupProcessing(setup) == Steinberg::kResultTrue &&
         session.component->setActive(true) == Steinberg::kResultTrue &&
         session.processor->setProcessing(true) == Steinberg::kResultTrue;
}

void end_processing(TestContext& test, ProductSession& session) {
  const auto processing_result = session.processor->setProcessing(false);
  const auto active_result = session.component->setActive(false);
  test.expect(processing_result == Steinberg::kResultTrue &&
                  active_result == Steinberg::kResultTrue,
              "processing stops and the component deactivates");
}

void check_processing(TestContext& test, ProductSession& session, const ExpectedProduct& expected) {
  test.expect(
      begin_processing(session, {Steinberg::Vst::kSample32, Steinberg::Vst::SpeakerArr::kStereo}),
      "Float32 stereo processing starts");
  std::array<Steinberg::Vst::Sample32, kSampleCount> left{1.0F, 1.0F, 1.0F, 1.0F};
  auto right = left;
  test.expect(process_block(*session.processor, left, right, false) == Steinberg::kResultTrue,
              "Float32 out-of-place block processes");
  const auto expected_default = linear_gain(expected.default_db);
  test.expect(approximately_equal(left[0], expected_default, kFloatTolerance) &&
                  approximately_equal(right[3], expected_default, kFloatTolerance),
              "initial processing uses the product default Gain");

  Steinberg::Vst::ParameterChanges changes(2);
  Steinberg::int32 queue_index = 0;
  auto* gain = changes.addParameterData(kGainParameterId, queue_index);
  Steinberg::int32 point_index = 0;
  test.expect(gain != nullptr && gain->addPoint(0, 0.0, point_index) == Steinberg::kResultTrue &&
                  gain->addPoint(3, 1.0, point_index) == Steinberg::kResultTrue,
              "multiple Gain points are accepted");
  auto* bypass = changes.addParameterData(kBypassParameterId, queue_index);
  test.expect(bypass != nullptr &&
                  bypass->addPoint(1, 1.0, point_index) == Steinberg::kResultTrue &&
                  bypass->addPoint(2, 0.0, point_index) == Steinberg::kResultTrue,
              "Bypass transition points are accepted");
  left.fill(1.0F);
  right.fill(1.0F);
  test.expect(process_block(*session.processor, left, right, true, &changes) ==
                  Steinberg::kResultTrue,
              "in-place automation and bypass block processes");
  test.expect(approximately_equal(left[0], linear_gain(-60.0), kFloatTolerance),
              "Gain point at offset zero is exact");
  test.expect(left[1] == 1.0F && right[1] == 1.0F, "Bypass transition returns dry samples");
  test.expect(approximately_equal(left[3], linear_gain(12.0), kFloatTolerance),
              "final Gain point is exact");
  end_processing(test, session);

  test.expect(
      begin_processing(session, {Steinberg::Vst::kSample64, Steinberg::Vst::SpeakerArr::kMono}),
      "Float64 mono processing starts");
  Steinberg::Vst::ProcessData zero{};
  zero.processMode = Steinberg::Vst::kRealtime;
  zero.symbolicSampleSize = Steinberg::Vst::kSample64;
  zero.numSamples = 0;
  test.expect(session.processor->process(zero) == Steinberg::kResultTrue,
              "zero-sample parameter-only call succeeds without buffers");
  std::array<Steinberg::Vst::Sample64, kSampleCount> double_left{0.25, -0.5, 0.75, -1.0};
  test.expect(process_mono_in_place(*session.processor, double_left) == Steinberg::kResultTrue,
              "Float64 mono in-place processing succeeds");
  end_processing(test, session);
}

void check_state(TestContext& test, ProductSession& session, const std::size_t product_index) {
  const garak::spike::gain::SpikeState target{0.1 * static_cast<double>(product_index + 1),
                                              (product_index % 2) != 0};
  garak::spike::gain::EncodedState encoded{};
  test.expect(garak::spike::gain::encode_state(target, encoded), "test state encodes");
  FixedStream input(encoded);
  test.expect(session.component->setState(&input) == Steinberg::kResultTrue,
              "component accepts a valid state");
  FixedStream saved;
  test.expect(session.component->getState(&saved) == Steinberg::kResultTrue && saved.size() == 20,
              "component writes the 20-byte state");
  garak::spike::gain::SpikeState decoded{};
  test.expect(garak::spike::gain::decode_state(saved.bytes(), decoded) &&
                  decoded.gain_normalized == target.gain_normalized &&
                  decoded.bypass == target.bypass,
              "module state is independent and exact");
  saved.rewind();
  test.expect(
      session.controller->setComponentState(&saved) == Steinberg::kResultTrue &&
          session.controller->getParamNormalized(kGainParameterId) == target.gain_normalized &&
          session.controller->getParamNormalized(kBypassParameterId) == (target.bypass ? 1.0 : 0.0),
      "controller restores the component state");

  auto corrupted = encoded;
  corrupted[0] ^= 0xFFU;
  FixedStream bad(corrupted);
  test.expect(session.component->setState(&bad) == Steinberg::kResultFalse,
              "corrupt state is rejected");
  FixedStream after_bad;
  test.expect(session.component->getState(&after_bad) == Steinberg::kResultTrue,
              "state remains readable after corrupt input");
  garak::spike::gain::SpikeState after{};
  test.expect(garak::spike::gain::decode_state(after_bad.bytes(), after) &&
                  after.gain_normalized == target.gain_normalized && after.bypass == target.bypass,
              "corrupt state causes no partial mutation");

  const auto& factory = session.module->getFactory();
  const auto processor_id = class_id(kExpectedProducts[product_index].processor);
  auto second =
      factory.createInstance<Steinberg::Vst::IComponent>(VST3::UID(processor_id.toTUID()));
  const bool second_initialized =
      second != nullptr && second->initialize(nullptr) == Steinberg::kResultTrue;
  test.expect(second_initialized, "a second instance initializes independently");
  if (second_initialized) {
    FixedStream second_state;
    test.expect(second->getState(&second_state) == Steinberg::kResultTrue,
                "second instance state is readable");
    garak::spike::gain::SpikeState second_decoded{};
    test.expect(garak::spike::gain::decode_state(second_state.bytes(), second_decoded) &&
                    approximately_equal(second_decoded.gain_normalized,
                                        normalized(kExpectedProducts[product_index].default_db),
                                        kDoubleTolerance) &&
                    !second_decoded.bypass,
                "same-module instances do not share mutable state");
    test.expect(second->terminate() == Steinberg::kResultTrue,
                "second instance terminates cleanly");
  }
}

[[nodiscard]] garak::spike::gain::SpikeState
isolation_state(const std::size_t product_index) noexcept {
  return {0.125 * static_cast<double>(product_index + 1), false};
}

void expect_session_state(TestContext& test, ProductSession& session,
                          const garak::spike::gain::SpikeState& expected,
                          const std::string_view message) {
  FixedStream saved;
  const auto state_result = session.component->getState(&saved);
  garak::spike::gain::SpikeState actual{};
  test.expect(state_result == Steinberg::kResultTrue && saved.size() == 20 &&
                  garak::spike::gain::decode_state(saved.bytes(), actual) &&
                  actual.gain_normalized == expected.gain_normalized &&
                  actual.bypass == expected.bypass,
              message);
}

void check_cross_module_isolation(
    TestContext& test,
    std::array<std::unique_ptr<ProductSession>, kExpectedProducts.size()>& sessions) {
  std::array<garak::spike::gain::SpikeState, kExpectedProducts.size()> states{};
  for (std::size_t index = 0; index < sessions.size(); ++index) {
    states[index] = isolation_state(index);
    garak::spike::gain::EncodedState encoded{};
    const bool encoded_ok = garak::spike::gain::encode_state(states[index], encoded);
    FixedStream input(encoded);
    test.expect(encoded_ok &&
                    sessions[index]->component->setState(&input) == Steinberg::kResultTrue,
                "distinct cross-module state is set");
  }

  for (std::size_t index = 0; index < sessions.size(); ++index) {
    expect_session_state(test, *sessions[index], states[index],
                         "all cross-module states remain distinct after every write");
  }

  std::array<bool, kExpectedProducts.size()> processing_started{};
  bool all_started = true;
  for (std::size_t index = 0; index < sessions.size(); ++index) {
    processing_started[index] = begin_processing(
        *sessions[index], {Steinberg::Vst::kSample64, Steinberg::Vst::SpeakerArr::kMono});
    test.expect(processing_started[index], "interleaved cross-module processing starts");
    all_started = all_started && processing_started[index];
  }

  std::array<double, kExpectedProducts.size()> first_outputs{};
  if (all_started) {
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      std::array<Steinberg::Vst::Sample64, kSampleCount> samples{};
      samples.fill(1.0);
      const auto process_result = process_mono_in_place(*sessions[index]->processor, samples);
      first_outputs[index] = samples.front();
      const auto expected_db = (states[index].gain_normalized * 72.0) - 60.0;
      test.expect(
          process_result == Steinberg::kResultTrue &&
              approximately_equal(first_outputs[index], linear_gain(expected_db), kDoubleTolerance),
          "interleaved module output uses only its own state");
    }

    for (std::size_t reverse = sessions.size(); reverse > 0; --reverse) {
      const auto index = reverse - 1;
      std::array<Steinberg::Vst::Sample64, kSampleCount> samples{};
      samples.fill(1.0);
      const auto process_result = process_mono_in_place(*sessions[index]->processor, samples);
      test.expect(process_result == Steinberg::kResultTrue &&
                      approximately_equal(samples.front(), first_outputs[index], kDoubleTolerance),
                  "reverse interleave preserves each module's prior processing result");
    }
  }

  for (std::size_t reverse = sessions.size(); reverse > 0; --reverse) {
    const auto index = reverse - 1;
    if (processing_started[index]) {
      end_processing(test, *sessions[index]);
    }
  }
  for (std::size_t index = 0; index < sessions.size(); ++index) {
    expect_session_state(test, *sessions[index], states[index],
                         "interleaved processing does not leak or mutate module state");
  }
}

[[nodiscard]] std::string read_text_file(const std::filesystem::path& path) {
  std::ifstream input(path, std::ios::binary);
  return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}

[[nodiscard]] std::string replace_once(std::string source, const std::string_view before,
                                       const std::string_view after) {
  const auto offset = source.find(before);
  if (offset != std::string::npos) {
    source.replace(offset, before.size(), after);
  }
  return source;
}

void check_module_info(TestContext& test, const std::filesystem::path& bundle,
                       const ExpectedProduct& expected) {
  if (!expected.has_module_info) {
    return;
  }
  const auto content = read_text_file(bundle / "Contents" / "Resources" / "moduleinfo.json");
  test.expect(!content.empty(), "moduleinfo.json exists and is non-empty");
  if (content.empty()) {
    return;
  }

  std::ostringstream parse_errors;
  const auto module_info = Steinberg::ModuleInfoLib::parseJson(content, &parse_errors);
  test.expect(module_info.has_value(), "moduleinfo parses with the pinned SDK parser");
  if (!module_info) {
    std::cerr << "moduleinfo parse error for " << bundle << ": " << parse_errors.str();
    return;
  }

  test.expect(module_info->name == expected.name, "moduleinfo root Name is exact");
  test.expect(module_info->version == kExpectedVersion, "moduleinfo root Version is exact");
  test.expect(module_info->factoryInfo.vendor == kExpectedVendor,
              "moduleinfo Factory Vendor is exact");
  test.expect(module_info->classes.size() == 2U, "moduleinfo has exactly two classes");

  bool saw_processor = false;
  bool saw_controller = false;
  for (const auto& class_info : module_info->classes) {
    if (class_info.cid == expected.processor_cid) {
      saw_processor = true;
      test.expect(class_info.name == expected.name, "moduleinfo processor Name is exact");
      test.expect(class_info.vendor == kExpectedVendor, "moduleinfo processor Vendor is exact");
      test.expect(class_info.version == kExpectedVersion, "moduleinfo processor Version is exact");
      test.expect(class_info.category == kExpectedProcessorCategory,
                  "moduleinfo processor Category is exact");
      test.expect(class_info.subCategories.size() == 1U &&
                      class_info.subCategories.front() == kExpectedProcessorSubcategory,
                  "moduleinfo processor Sub Categories are exactly Fx");
    } else if (class_info.cid == expected.controller_cid) {
      saw_controller = true;
      test.expect(class_info.name == std::string(expected.name) + " Controller",
                  "moduleinfo controller Name is exact");
      test.expect(class_info.vendor == kExpectedVendor, "moduleinfo controller Vendor is exact");
      test.expect(class_info.version == kExpectedVersion, "moduleinfo controller Version is exact");
      test.expect(class_info.category == kExpectedControllerCategory,
                  "moduleinfo controller Category is exact");
      test.expect(class_info.subCategories.empty(), "moduleinfo controller has no Sub Categories");
    } else {
      test.expect(false, "moduleinfo contains no unexpected class CID");
    }
  }
  test.expect(saw_processor && saw_controller,
              "moduleinfo processor/controller CIDs are independently pinned");
}

[[nodiscard]] std::filesystem::path inner_module_path(const std::filesystem::path& bundle) {
  return bundle / "Contents" / "x86_64-win" / bundle.filename();
}

[[nodiscard]] bool
create_failure_fixture(const std::filesystem::path& template_bundle,
                       const std::filesystem::path& fixture_bundle,
                       const std::optional<std::string_view> descriptor,
                       const std::optional<std::string_view> inner_name = std::nullopt) {
  std::error_code error;
  // Zero removed entries is valid on the first run; the error code is the cleanup contract.
  static_cast<void>(std::filesystem::remove_all(fixture_bundle, error));
  if (error) {
    return false;
  }
  const bool module_directory_created =
      std::filesystem::create_directories(fixture_bundle / "Contents" / "x86_64-win", error);
  if (error || !module_directory_created) {
    return false;
  }
  const bool resources_directory_created =
      std::filesystem::create_directories(fixture_bundle / "Contents" / "Resources", error);
  if (error || !resources_directory_created) {
    return false;
  }
  const auto fixture_inner = inner_name ? fixture_bundle / "Contents" / "x86_64-win" / *inner_name
                                        : inner_module_path(fixture_bundle);
  const bool module_copied =
      std::filesystem::copy_file(inner_module_path(template_bundle), fixture_inner,
                                 std::filesystem::copy_options::overwrite_existing, error);
  if (error || !module_copied) {
    return false;
  }
  if (descriptor) {
    std::ofstream output(fixture_bundle / "Contents" / "Resources" / "garak-product-spike-v1.txt",
                         std::ios::binary | std::ios::trunc);
    if (!output) {
      return false;
    }
    output.write(descriptor->data(), static_cast<std::streamsize>(descriptor->size()));
    return output.good();
  }
  return true;
}

struct FailureFixturePaths final {
  std::filesystem::path template_bundle;
  std::filesystem::path fixture_root;
};

void check_failure_fixtures(TestContext& test, const FailureFixturePaths& paths) {
  const bool fixture_root_created = std::filesystem::create_directories(paths.fixture_root);
  const bool fixture_root_ready =
      fixture_root_created || std::filesystem::is_directory(paths.fixture_root);
  test.expect(fixture_root_ready, "descriptor failure fixture root is available");
  if (!fixture_root_ready) {
    return;
  }
  std::array<std::optional<std::string>, 14> descriptors{
      std::nullopt,
      std::string{},
      replace_once(std::string(kValidDescriptor), "GARAK_PRODUCT_SPIKE_V1", "BAD_MAGIC"),
      replace_once(std::string(kValidDescriptor), "schema=1", "schema=2"),
      replace_once(std::string(kValidDescriptor), "vendor=Garak\n", ""),
      replace_once(std::string(kValidDescriptor), "product_name=Garak Data Alpha\n", ""),
      replace_once(std::string(kValidDescriptor), "processor_fuid=4B2B557251D44CE9914F9B105136FB7E",
                   "processor_fuid=BAD"),
      replace_once(std::string(kValidDescriptor),
                   "controller_fuid=7A90454628B34A3497F05E7CC718F8A1",
                   "controller_fuid=4B2B557251D44CE9914F9B105136FB7E"),
      replace_once(std::string(kValidDescriptor), "gain_parameter_id=1001", "gain_parameter_id=0"),
      replace_once(std::string(kValidDescriptor), "bypass_parameter_id=1002",
                   "bypass_parameter_id=1001"),
      replace_once(std::string(kValidDescriptor), "default_gain_db=-6.0", "default_gain_db=-61.0"),
      replace_once(std::string(kValidDescriptor), "default_gain_db=-6.0", "default_gain_db=13.0"),
      replace_once(std::string(kValidDescriptor), "vendor=Garak\n", "vendor=Garak\nvendor=Garak\n"),
      replace_once(std::string(kValidDescriptor), "category=Fx\n",
                   "category=Fx\nunexpected=value\n"),
  };

  for (std::size_t index = 0; index < descriptors.size(); ++index) {
    const auto fixture =
        paths.fixture_root / ("malformed-" + std::to_string(index)) / "Garak Data Alpha.vst3";
    const std::optional<std::string_view> descriptor =
        descriptors[index] ? std::optional<std::string_view>(*descriptors[index]) : std::nullopt;
    const bool fixture_created = create_failure_fixture(paths.template_bundle, fixture, descriptor);
    test.expect(fixture_created, "malformed descriptor fixture is created");
    if (!fixture_created) {
      continue;
    }
    std::string error;
    const auto module = VST3::Hosting::Module::create(fixture.generic_string(), error);
    test.expect(module == nullptr, "malformed descriptor fails closed at module load");
  }

  const auto oversized_fixture = paths.fixture_root / "oversized" / "Garak Data Alpha.vst3";
  const auto oversized = std::string(1025, 'A') + "\n";
  const bool oversized_fixture_created =
      create_failure_fixture(paths.template_bundle, oversized_fixture, oversized);
  test.expect(oversized_fixture_created, "oversized descriptor fixture is created");
  if (oversized_fixture_created) {
    std::string error;
    test.expect(VST3::Hosting::Module::create(oversized_fixture.generic_string(), error) == nullptr,
                "oversized descriptor fails closed");
  }

  const auto descriptor_name_fixture =
      paths.fixture_root / "descriptor-name-mismatch" / "Garak Wrong Product.vst3";
  const bool descriptor_name_fixture_created =
      create_failure_fixture(paths.template_bundle, descriptor_name_fixture, kValidDescriptor);
  test.expect(descriptor_name_fixture_created,
              "descriptor/product basename mismatch fixture is created");
  if (descriptor_name_fixture_created) {
    std::string error;
    test.expect(VST3::Hosting::Module::create(descriptor_name_fixture.generic_string(), error) ==
                    nullptr,
                "descriptor product name mismatch fails closed");
  }

  const auto inner_name_fixture =
      paths.fixture_root / "bundle-inner-mismatch" / "Garak Data Alpha.vst3";
  const bool inner_name_fixture_created = create_failure_fixture(
      paths.template_bundle, inner_name_fixture, kValidDescriptor, "Garak Wrong Inner.vst3");
  test.expect(inner_name_fixture_created, "bundle/inner basename mismatch fixture is created");
  if (inner_name_fixture_created) {
    std::string error;
    test.expect(VST3::Hosting::Module::create(inner_name_fixture.generic_string(), error) ==
                    nullptr,
                "bundle/inner basename mismatch fails closed");
  }
}

void terminate(TestContext& test, ProductSession& session) {
  if (session.controller_initialized) {
    test.expect(session.controller->terminate() == Steinberg::kResultTrue,
                "controller terminates cleanly");
    session.controller_initialized = false;
  }
  if (session.component_initialized) {
    test.expect(session.component->terminate() == Steinberg::kResultTrue,
                "component terminates cleanly");
    session.component_initialized = false;
  }
}

} // namespace

int main(const int argc, char* argv[]) {
  try {
    if (argc != 8) {
      std::cerr << "Usage: garak_runtime_strategy_contract_tests <gain> <data-a> <data-b> "
                   "<thin-a> <thin-b> <template> <fixture-root>\n";
      return 1;
    }
    TestContext test;
    std::array<std::filesystem::path, 5> bundles{};
    for (std::size_t index = 0; index < bundles.size(); ++index) {
      bundles[index] = argv[index + 1];
    }

    std::array<std::unique_ptr<ProductSession>, 5> sessions{};
    std::array<HMODULE, 5> handles{};
    std::array<Steinberg::FUID, 10> ids{};
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      sessions[index] = load_product(test, bundles[index], kExpectedProducts[index]);
      if (sessions[index] == nullptr) {
        return test.result();
      }
      handles[index] = GetModuleHandleW(bundles[index].filename().c_str());
      test.expect(handles[index] != nullptr, "loaded module has a Windows module handle");
      ids[index * 2] = class_id(kExpectedProducts[index].processor);
      ids[(index * 2) + 1] = class_id(kExpectedProducts[index].controller);
      check_module_info(test, bundles[index], kExpectedProducts[index]);
    }
    for (std::size_t left = 0; left < ids.size(); ++left) {
      for (std::size_t right = left + 1; right < ids.size(); ++right) {
        test.expect(ids[left] != ids[right],
                    "all ten loaded processor/controller FUIDs are unique");
      }
    }
    test.expect(handles[1] != handles[2],
                "byte-identical Data Alpha and Beta have distinct Windows module handles");

    for (std::size_t index = 0; index < sessions.size(); ++index) {
      check_processing(test, *sessions[index], kExpectedProducts[index]);
      check_state(test, *sessions[index], index);
    }
    check_cross_module_isolation(test, sessions);

    check_failure_fixtures(test, {argv[6], argv[7]});

    for (auto iterator = sessions.rbegin(); iterator != sessions.rend(); ++iterator) {
      terminate(test, **iterator);
      iterator->reset();
    }
    for (std::size_t index = 0; index < handles.size(); ++index) {
      test.expect(GetModuleHandleW(bundles[index].filename().c_str()) == nullptr,
                  "reverse-order unload releases each product module");
    }

    auto reloaded = load_product(test, bundles[1], kExpectedProducts[1]);
    test.expect(reloaded != nullptr,
                "Data Alpha reload repeats exact factory identity and default checks");
    if (reloaded != nullptr) {
      terminate(test, *reloaded);
      reloaded.reset();
      test.expect(GetModuleHandleW(bundles[1].filename().c_str()) == nullptr,
                  "reloaded Data Alpha tears down and unloads cleanly");
    }
    return test.result();
  } catch (...) {
    return 1;
  }
}
