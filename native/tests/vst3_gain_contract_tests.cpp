#include "identifiers.hpp"
#include "state_codec.hpp"
#include "version.hpp"

#include "pluginterfaces/base/funknownimpl.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/gui/iplugview.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "pluginterfaces/vst/vstspeaker.h"
#include "public.sdk/source/vst/hosting/module.h"
#include "public.sdk/source/vst/utility/stringconvert.h"

#include <array>
#include <atomic>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <limits>
#include <span>
#include <string>
#include <string_view>
#include <thread>
#include <type_traits>

namespace {

using garak::spike::gain::decode_state;
using garak::spike::gain::encode_state;
using garak::spike::gain::EncodedState;
using garak::spike::gain::SpikeState;

constexpr Steinberg::int32 kSampleCount = 4;
constexpr Steinberg::int32 kChannelCount = 2;
constexpr Steinberg::Vst::ParamID kGainParameterId = 1001;
constexpr Steinberg::Vst::ParamID kBypassParameterId = 1002;
constexpr std::string_view kExpectedVendorName = "Garak";
constexpr std::string_view kExpectedPluginName = "Garak Gain Spike";
constexpr std::string_view kExpectedPluginVersion = "0.1.0";
constexpr std::string_view kExpectedPluginCategory = "Fx";
constexpr Steinberg::int32 kStateSize =
    static_cast<Steinberg::int32>(garak::spike::gain::kEncodedStateSize);
static_assert(kStateSize == 20);
constexpr double kDefaultNormalizedGain = 5.0 / 6.0;
constexpr double kFloatTolerance = 1.0e-5;
constexpr double kDoubleTolerance = 1.0e-12;

[[nodiscard]] Steinberg::FUID expected_processor_fuid() {
  return {0x3D6F3C09, 0x296D49EF, 0x99334C46, 0x88F484EE};
}

[[nodiscard]] Steinberg::FUID expected_controller_fuid() {
  return {0x2CD50BAE, 0x587A4F3E, 0x812399E5, 0x50F352D4};
}

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

[[nodiscard]] bool near(const double actual, const double expected,
                        const double tolerance = kDoubleTolerance) noexcept {
  return std::abs(actual - expected) <= tolerance;
}

[[nodiscard]] bool has_uid(const VST3::Hosting::ClassInfo& info,
                           const Steinberg::FUID& expected) noexcept {
  return Steinberg::FUID::fromTUID(info.ID().data()) == expected;
}

struct HostCallbackException final {};

class FixedStream final
    : public Steinberg::U::ImplementsNonDestroyable<Steinberg::U::Directly<Steinberg::IBStream>> {
public:
  FixedStream() = default;

  explicit FixedStream(const std::span<const std::uint8_t> bytes) noexcept { assign(bytes); }

  Steinberg::tresult PLUGIN_API read(void* const buffer, const Steinberg::int32 num_bytes,
                                     Steinberg::int32* const num_bytes_read) override {
    if (num_bytes_read != nullptr) {
      *num_bytes_read = 0;
    }
    if (buffer == nullptr || num_bytes < 0 || cursor_ < 0 || cursor_ > size_) {
      return Steinberg::kInvalidArgument;
    }

    const auto available = size_ - cursor_;
    if (num_bytes > available) {
      return Steinberg::kResultFalse;
    }
    const auto transferred = num_bytes < read_limit_ ? num_bytes : read_limit_;
    std::memcpy(buffer, bytes_.data() + cursor_, static_cast<std::size_t>(transferred));
    cursor_ += transferred;
    if (num_bytes_read != nullptr) {
      *num_bytes_read = transferred;
    }
    return Steinberg::kResultTrue;
  }

  Steinberg::tresult PLUGIN_API write(void* const buffer, const Steinberg::int32 num_bytes,
                                      Steinberg::int32* const num_bytes_written) override {
    if (num_bytes_written != nullptr) {
      *num_bytes_written = 0;
    }
    if (buffer == nullptr || num_bytes < 0 || cursor_ < 0 ||
        num_bytes > static_cast<Steinberg::int32>(bytes_.size()) - cursor_) {
      return Steinberg::kInvalidArgument;
    }

    const auto transferred = num_bytes < write_limit_ ? num_bytes : write_limit_;
    std::memcpy(bytes_.data() + cursor_, buffer, static_cast<std::size_t>(transferred));
    cursor_ += transferred;
    if (cursor_ > size_) {
      size_ = cursor_;
    }
    if (num_bytes_written != nullptr) {
      *num_bytes_written = transferred;
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

  [[nodiscard]] Steinberg::int32 size() const noexcept { return size_; }

  [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept {
    return {bytes_.data(), static_cast<std::size_t>(size_)};
  }

  void assign(const std::span<const std::uint8_t> bytes) noexcept {
    if (bytes.size() > bytes_.size()) {
      return;
    }
    bytes_.fill(0);
    std::memcpy(bytes_.data(), bytes.data(), bytes.size());
    size_ = static_cast<Steinberg::int32>(bytes.size());
    cursor_ = 0;
  }

  void rewind() noexcept { cursor_ = 0; }

  void set_read_limit(const Steinberg::int32 limit) noexcept { read_limit_ = limit; }

  void set_write_limit(const Steinberg::int32 limit) noexcept { write_limit_ = limit; }

private:
  std::array<std::uint8_t, 64> bytes_{};
  Steinberg::int32 size_{};
  Steinberg::int32 cursor_{};
  Steinberg::int32 read_limit_{64};
  Steinberg::int32 write_limit_{64};
};

class PointQueue final : public Steinberg::U::ImplementsNonDestroyable<
                             Steinberg::U::Directly<Steinberg::Vst::IParamValueQueue>> {
public:
  explicit PointQueue(const Steinberg::Vst::ParamID parameter_id) noexcept
      : parameter_id_(parameter_id) {}

  Steinberg::Vst::ParamID PLUGIN_API getParameterId() override { return parameter_id_; }

  Steinberg::int32 PLUGIN_API getPointCount() override {
    ++point_count_calls_;
    return reported_point_count_ >= 0 ? reported_point_count_ : point_count_;
  }

  // The output parameter order is fixed by Steinberg::Vst::IParamValueQueue.
  // NOLINTBEGIN(bugprone-easily-swappable-parameters)
  Steinberg::tresult PLUGIN_API getPoint(const Steinberg::int32 index,
                                         Steinberg::int32& sample_offset,
                                         Steinberg::Vst::ParamValue& value) override {
    ++point_calls_;
    if (throw_on_get_point_) {
      throw HostCallbackException{};
    }
    if (index < 0 || index >= point_count_ || index == failing_index_) {
      return Steinberg::kResultFalse;
    }
    sample_offset = points_[static_cast<std::size_t>(index)].sample_offset;
    value = points_[static_cast<std::size_t>(index)].value;
    return Steinberg::kResultTrue;
  }
  // NOLINTEND(bugprone-easily-swappable-parameters)

  void fail_at(const Steinberg::int32 index) noexcept { failing_index_ = index; }

  void report_point_count(const Steinberg::int32 count) noexcept { reported_point_count_ = count; }

  void throw_on_get_point() noexcept { throw_on_get_point_ = true; }

  [[nodiscard]] Steinberg::int32 point_count_calls() const noexcept { return point_count_calls_; }

  [[nodiscard]] Steinberg::int32 point_calls() const noexcept { return point_calls_; }

  Steinberg::tresult PLUGIN_API addPoint(const Steinberg::int32 sample_offset,
                                         const Steinberg::Vst::ParamValue value,
                                         Steinberg::int32& index) override {
    if (point_count_ >= static_cast<Steinberg::int32>(points_.size())) {
      return Steinberg::kResultFalse;
    }
    index = point_count_;
    points_[static_cast<std::size_t>(point_count_)] = {sample_offset, value};
    ++point_count_;
    return Steinberg::kResultTrue;
  }

private:
  struct Point final {
    Steinberg::int32 sample_offset{};
    Steinberg::Vst::ParamValue value{};
  };

  Steinberg::Vst::ParamID parameter_id_{};
  std::array<Point, 4> points_{};
  Steinberg::int32 point_count_{};
  Steinberg::int32 failing_index_{-1};
  Steinberg::int32 reported_point_count_{-1};
  Steinberg::int32 point_count_calls_{};
  Steinberg::int32 point_calls_{};
  bool throw_on_get_point_{};
};

class ParameterChangesView final : public Steinberg::U::ImplementsNonDestroyable<
                                       Steinberg::U::Directly<Steinberg::Vst::IParameterChanges>> {
public:
  void add(PointQueue& queue) noexcept {
    if (queue_count_ < static_cast<Steinberg::int32>(queues_.size())) {
      queues_[static_cast<std::size_t>(queue_count_)] = &queue;
      ++queue_count_;
    }
  }

  void report_queue_count(const Steinberg::int32 count) noexcept { reported_queue_count_ = count; }

  void throw_on_get_parameter_count() noexcept { throw_on_get_parameter_count_ = true; }

  void throw_on_get_parameter_data() noexcept { throw_on_get_parameter_data_ = true; }

  [[nodiscard]] Steinberg::int32 parameter_data_calls() const noexcept {
    return parameter_data_calls_;
  }

  Steinberg::int32 PLUGIN_API getParameterCount() override {
    if (throw_on_get_parameter_count_) {
      throw HostCallbackException{};
    }
    return reported_queue_count_ >= 0 ? reported_queue_count_ : queue_count_;
  }

  Steinberg::Vst::IParamValueQueue* PLUGIN_API
  getParameterData(const Steinberg::int32 index) override {
    ++parameter_data_calls_;
    if (throw_on_get_parameter_data_) {
      throw HostCallbackException{};
    }
    if (index < 0 || index >= queue_count_) {
      return nullptr;
    }
    return queues_[static_cast<std::size_t>(index)];
  }

  Steinberg::Vst::IParamValueQueue* PLUGIN_API addParameterData(const Steinberg::Vst::ParamID&,
                                                                Steinberg::int32& index) override {
    index = -1;
    return nullptr;
  }

private:
  std::array<PointQueue*, 2> queues_{};
  Steinberg::int32 queue_count_{};
  Steinberg::int32 reported_queue_count_{-1};
  Steinberg::int32 parameter_data_calls_{};
  bool throw_on_get_parameter_count_{};
  bool throw_on_get_parameter_data_{};
};

template <typename Sample>
[[nodiscard]] Steinberg::tresult process_stereo(
    Steinberg::Vst::IAudioProcessor& processor, const std::array<Sample, kSampleCount>& input_left,
    const std::array<Sample, kSampleCount>& input_right,
    std::array<Sample, kSampleCount>& output_left, std::array<Sample, kSampleCount>& output_right,
    Steinberg::Vst::IParameterChanges* const changes = nullptr) {
  std::array<Sample*, kChannelCount> input_channels{const_cast<Sample*>(input_left.data()),
                                                    const_cast<Sample*>(input_right.data())};
  std::array<Sample*, kChannelCount> output_channels{output_left.data(), output_right.data()};

  Steinberg::Vst::AudioBusBuffers input{};
  input.numChannels = kChannelCount;
  input.silenceFlags = 0;
  Steinberg::Vst::AudioBusBuffers output{};
  output.numChannels = kChannelCount;
  output.silenceFlags = 0;
  if constexpr (std::is_same_v<Sample, Steinberg::Vst::Sample32>) {
    input.channelBuffers32 = input_channels.data();
    output.channelBuffers32 = output_channels.data();
  } else {
    input.channelBuffers64 = input_channels.data();
    output.channelBuffers64 = output_channels.data();
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
  return processor.process(data);
}

[[nodiscard]] Steinberg::tresult
process_zero_samples(Steinberg::Vst::IAudioProcessor& processor,
                     Steinberg::Vst::IParameterChanges* const changes = nullptr) {
  Steinberg::Vst::ProcessData data{};
  data.processMode = Steinberg::Vst::kRealtime;
  data.symbolicSampleSize = Steinberg::Vst::kSample32;
  data.numSamples = 0;
  data.inputParameterChanges = changes;
  return processor.process(data);
}

[[nodiscard]] bool same_state(const SpikeState& actual, const SpikeState& expected) noexcept {
  return actual.gain_normalized == expected.gain_normalized && actual.bypass == expected.bypass;
}

[[nodiscard]] bool read_component_state(Steinberg::Vst::IComponent& component, SpikeState& state) {
  FixedStream stream;
  return component.getState(&stream) == Steinberg::kResultTrue &&
         decode_state(stream.bytes(), state);
}

bool expect_component_state(TestContext& test, Steinberg::Vst::IComponent& component,
                            const SpikeState& expected, const std::string_view message) {
  SpikeState actual{};
  const auto readable = read_component_state(component, actual);
  test.expect(readable, message);
  if (!readable) {
    return false;
  }
  const auto matches = same_state(actual, expected);
  test.expect(matches, message);
  return matches;
}

bool apply_component_state(TestContext& test, Steinberg::Vst::IComponent& component,
                           Steinberg::Vst::IAudioProcessor& processor, const SpikeState& state) {
  EncodedState encoded{};
  const auto encoded_ok = encode_state(state, encoded);
  test.expect(encoded_ok, "test state encodes");
  if (!encoded_ok) {
    return false;
  }

  FixedStream stream{encoded};
  const auto restored = component.setState(&stream) == Steinberg::kResultTrue;
  test.expect(restored, "test state restores");
  if (!restored) {
    return false;
  }

  const auto applied = process_zero_samples(processor) == Steinberg::kResultTrue;
  test.expect(applied, "test state applies at a zero-sample boundary");
  return applied;
}

[[nodiscard]] double normalized_to_linear_gain(const double normalized) noexcept {
  return std::pow(10.0, (-60.0 + (72.0 * normalized)) / 20.0);
}

template <typename Sample>
void expect_samples(TestContext& test, const std::array<Sample, kSampleCount>& actual,
                    const std::array<Sample, kSampleCount>& expected, double tolerance,
                    std::string_view message);

void expect_gain_curve(TestContext& test, Steinberg::Vst::IAudioProcessor& processor,
                       Steinberg::Vst::IParameterChanges& changes,
                       const std::array<double, kSampleCount>& normalized,
                       const std::string_view message) {
  const std::array<Steinberg::Vst::Sample32, kSampleCount> input_left{1.0F, 1.0F, 1.0F, 1.0F};
  const auto input_right = input_left;
  std::array<Steinberg::Vst::Sample32, kSampleCount> output_left{};
  std::array<Steinberg::Vst::Sample32, kSampleCount> output_right{};
  const auto processed = process_stereo(processor, input_left, input_right, output_left,
                                        output_right, &changes) == Steinberg::kResultTrue;
  test.expect(processed, message);
  if (!processed) {
    return;
  }

  std::array<Steinberg::Vst::Sample32, kSampleCount> expected{};
  for (std::size_t index = 0; index < expected.size(); ++index) {
    expected[index] =
        static_cast<Steinberg::Vst::Sample32>(normalized_to_linear_gain(normalized[index]));
  }
  expect_samples(test, output_left, expected, kFloatTolerance, message);
  expect_samples(test, output_right, expected, kFloatTolerance, message);
}

template <typename Sample>
void expect_samples(TestContext& test, const std::array<Sample, kSampleCount>& actual,
                    const std::array<Sample, kSampleCount>& expected, const double tolerance,
                    const std::string_view message) {
  for (std::size_t index = 0; index < actual.size(); ++index) {
    if (!near(static_cast<double>(actual[index]), static_cast<double>(expected[index]),
              tolerance)) {
      std::cerr << "FAIL: " << message << " at sample " << index << ": expected " << expected[index]
                << ", received " << actual[index] << '\n';
      test.expect(false, "sample comparison");
      return;
    }
  }
}

[[nodiscard]] bool start_processing(TestContext& test, Steinberg::Vst::IComponent& component,
                                    Steinberg::Vst::IAudioProcessor& processor,
                                    const Steinberg::int32 sample_size) {
  Steinberg::Vst::ProcessSetup setup{};
  setup.processMode = Steinberg::Vst::kRealtime;
  setup.symbolicSampleSize = sample_size;
  setup.maxSamplesPerBlock = 64;
  setup.sampleRate = 48'000.0;
  const auto setup_ok = processor.setupProcessing(setup) == Steinberg::kResultTrue;
  test.expect(setup_ok, "setupProcessing succeeds");
  if (!setup_ok) {
    return false;
  }

  const auto active = component.setActive(true) == Steinberg::kResultTrue;
  test.expect(active, "component activation succeeds");
  if (!active) {
    return false;
  }

  const auto processing = processor.setProcessing(true) == Steinberg::kResultTrue;
  test.expect(processing, "setProcessing(true) succeeds");
  if (!processing) {
    component.setActive(false);
    return false;
  }
  return true;
}

void stop_processing(TestContext& test, Steinberg::Vst::IComponent& component,
                     Steinberg::Vst::IAudioProcessor& processor) {
  test.expect(processor.setProcessing(false) == Steinberg::kResultTrue,
              "setProcessing(false) succeeds");
  test.expect(component.setActive(false) == Steinberg::kResultTrue,
              "component deactivation succeeds");
}

void check_automation_edge_contract(TestContext& test, Steinberg::Vst::IComponent& component,
                                    Steinberg::Vst::IAudioProcessor& processor) {
  Steinberg::int32 point_index = 0;

  const SpikeState zero_gain{0.0, false};
  if (apply_component_state(test, component, processor, zero_gain)) {
    PointQueue virtual_minus_one(kGainParameterId);
    test.expect(virtual_minus_one.addPoint(3, 1.0, point_index) == Steinberg::kResultTrue,
                "virtual-minus-one point is accepted by test host");
    ParameterChangesView changes;
    changes.add(virtual_minus_one);
    expect_gain_curve(test, processor, changes, {0.25, 0.5, 0.75, 1.0},
                      "first point interpolates from virtual offset minus one");
    expect_component_state(test, component, {1.0, false}, "virtual-minus-one final state persists");
  }

  if (apply_component_state(test, component, processor, zero_gain)) {
    PointQueue duplicate(kGainParameterId);
    test.expect(duplicate.addPoint(1, 0.2, point_index) == Steinberg::kResultTrue,
                "first duplicate point is accepted by test host");
    test.expect(duplicate.addPoint(1, 0.7, point_index) == Steinberg::kResultTrue,
                "second duplicate point is accepted by test host");
    ParameterChangesView changes;
    changes.add(duplicate);
    expect_gain_curve(test, processor, changes, {0.35, 0.7, 0.7, 0.7},
                      "duplicate sample offset uses its last value");
    expect_component_state(test, component, {0.7, false},
                           "duplicate sample-offset final state persists");
  }

  const SpikeState baseline{0.25, false};
  constexpr std::array<double, kSampleCount> baseline_curve{0.25, 0.25, 0.25, 0.25};

  if (apply_component_state(test, component, processor, baseline)) {
    PointQueue decreasing(kGainParameterId);
    test.expect(decreasing.addPoint(2, 0.5, point_index) == Steinberg::kResultTrue,
                "first decreasing-queue point is accepted by test host");
    test.expect(decreasing.addPoint(1, 1.0, point_index) == Steinberg::kResultTrue,
                "second decreasing-queue point is accepted by test host");
    ParameterChangesView changes;
    changes.add(decreasing);
    expect_gain_curve(test, processor, changes, baseline_curve,
                      "decreasing queue causes no partial automation");
    expect_component_state(test, component, baseline,
                           "decreasing queue leaves live state unchanged");
  }

  if (apply_component_state(test, component, processor, baseline)) {
    PointQueue out_of_range(kGainParameterId);
    test.expect(out_of_range.addPoint(kSampleCount, 0.8, point_index) == Steinberg::kResultTrue,
                "out-of-range point is accepted by malformed test host");
    ParameterChangesView changes;
    changes.add(out_of_range);
    expect_gain_curve(test, processor, changes, baseline_curve,
                      "out-of-range queue causes no partial automation");
    expect_component_state(test, component, baseline,
                           "out-of-range queue leaves live state unchanged");
  }

  if (apply_component_state(test, component, processor, baseline)) {
    PointQueue failing(kGainParameterId);
    test.expect(failing.addPoint(0, 0.5, point_index) == Steinberg::kResultTrue,
                "first failing-queue point is accepted by test host");
    test.expect(failing.addPoint(2, 0.8, point_index) == Steinberg::kResultTrue,
                "second failing-queue point is accepted by test host");
    failing.fail_at(1);
    ParameterChangesView changes;
    changes.add(failing);
    expect_gain_curve(test, processor, changes, baseline_curve,
                      "getPoint failure causes no partial automation");
    expect_component_state(test, component, baseline,
                           "getPoint failure leaves live state unchanged");
  }

  if (apply_component_state(test, component, processor, baseline)) {
    PointQueue first(kGainParameterId);
    PointQueue second(kGainParameterId);
    test.expect(first.addPoint(0, 0.4, point_index) == Steinberg::kResultTrue,
                "first duplicate-parameter queue point is accepted");
    test.expect(second.addPoint(0, 0.9, point_index) == Steinberg::kResultTrue,
                "second duplicate-parameter queue point is accepted");
    ParameterChangesView changes;
    changes.add(first);
    changes.add(second);
    expect_gain_curve(test, processor, changes, baseline_curve,
                      "duplicate parameter ID causes no partial automation");
    expect_component_state(test, component, baseline,
                           "duplicate parameter ID leaves live state unchanged");
  }

  if (apply_component_state(test, component, processor, baseline)) {
    PointQueue gain(kGainParameterId);
    PointQueue bypass(kBypassParameterId);
    test.expect(gain.addPoint(0, 0.4, point_index) == Steinberg::kResultTrue,
                "first zero-sample Gain duplicate is accepted");
    test.expect(gain.addPoint(0, 0.8, point_index) == Steinberg::kResultTrue,
                "second zero-sample Gain duplicate is accepted");
    test.expect(bypass.addPoint(0, 0.0, point_index) == Steinberg::kResultTrue,
                "first zero-sample bypass duplicate is accepted");
    test.expect(bypass.addPoint(0, 1.0, point_index) == Steinberg::kResultTrue,
                "second zero-sample bypass duplicate is accepted");
    ParameterChangesView changes;
    changes.add(gain);
    changes.add(bypass);
    test.expect(process_zero_samples(processor, &changes) == Steinberg::kResultTrue,
                "zero-sample duplicate flush succeeds");
    expect_component_state(test, component, {0.8, true},
                           "zero-sample duplicate flush uses last values");
  }

  if (apply_component_state(test, component, processor, baseline)) {
    PointQueue gain(kGainParameterId);
    PointQueue bypass(kBypassParameterId);
    test.expect(gain.addPoint(1, 0.8, point_index) == Steinberg::kResultTrue,
                "invalid zero-sample Gain point is accepted by malformed test host");
    test.expect(bypass.addPoint(1, 1.0, point_index) == Steinberg::kResultTrue,
                "invalid zero-sample bypass point is accepted by malformed test host");
    ParameterChangesView changes;
    changes.add(gain);
    changes.add(bypass);
    test.expect(process_zero_samples(processor, &changes) == Steinberg::kResultTrue,
                "invalid zero-sample queues are handled defensively");
    expect_component_state(test, component, baseline,
                           "invalid zero-sample queues leave live state unchanged");
  }

  apply_component_state(test, component, processor, {kDefaultNormalizedGain, false});
}

void check_bounded_host_input_and_exception_contract(TestContext& test,
                                                     Steinberg::Vst::IComponent& component,
                                                     Steinberg::Vst::IAudioProcessor& processor) {
  const SpikeState baseline{0.25, false};
  constexpr std::array<double, kSampleCount> baseline_curve{0.25, 0.25, 0.25, 0.25};

  for (const Steinberg::int32 reported_count :
       {Steinberg::int32{3}, std::numeric_limits<Steinberg::int32>::max()}) {
    if (apply_component_state(test, component, processor, baseline)) {
      Steinberg::int32 point_index = 0;
      PointQueue ignored_gain(kGainParameterId);
      test.expect(ignored_gain.addPoint(0, 0.9, point_index) == Steinberg::kResultTrue,
                  "ignored oversized-list Gain point is populated");
      ParameterChangesView oversized;
      oversized.add(ignored_gain);
      oversized.report_queue_count(reported_count);
      if (reported_count == std::numeric_limits<Steinberg::int32>::max()) {
        oversized.throw_on_get_parameter_data();
      }
      expect_gain_curve(test, processor, oversized, baseline_curve,
                        "oversized parameter queue list is ignored");
      test.expect(oversized.parameter_data_calls() == 0,
                  "oversized parameter queue list is not traversed");
      expect_component_state(test, component, baseline,
                             "oversized parameter queue list leaves state unchanged");
    }
  }

  if (apply_component_state(test, component, processor, baseline)) {
    PointQueue oversized_points(kGainParameterId);
    oversized_points.report_point_count(std::numeric_limits<Steinberg::int32>::max());
    ParameterChangesView changes;
    changes.add(oversized_points);
    expect_gain_curve(test, processor, changes, baseline_curve,
                      "oversized automation point list is ignored");
    test.expect(oversized_points.point_count_calls() == 1,
                "oversized automation point count is read once");
    test.expect(oversized_points.point_calls() == 0,
                "oversized automation point list is not traversed");
    expect_component_state(test, component, baseline,
                           "oversized automation point list leaves state unchanged");
  }

  if (apply_component_state(test, component, processor, baseline)) {
    ParameterChangesView throwing_count;
    throwing_count.throw_on_get_parameter_count();
    const std::array<Steinberg::Vst::Sample32, kSampleCount> input{1.0F, 1.0F, 1.0F, 1.0F};
    std::array<Steinberg::Vst::Sample32, kSampleCount> output_left{};
    std::array<Steinberg::Vst::Sample32, kSampleCount> output_right{};
    test.expect(process_stereo(processor, input, input, output_left, output_right,
                               &throwing_count) == Steinberg::kResultFalse,
                "throwing getParameterCount is contained by process");
    expect_component_state(test, component, baseline,
                           "throwing getParameterCount leaves state unchanged");
  }

  if (apply_component_state(test, component, processor, baseline)) {
    Steinberg::int32 point_index = 0;
    PointQueue throwing_point(kGainParameterId);
    test.expect(throwing_point.addPoint(0, 0.75, point_index) == Steinberg::kResultTrue,
                "throwing point queue is populated");
    throwing_point.throw_on_get_point();
    ParameterChangesView changes;
    changes.add(throwing_point);
    const std::array<Steinberg::Vst::Sample32, kSampleCount> input{1.0F, 1.0F, 1.0F, 1.0F};
    std::array<Steinberg::Vst::Sample32, kSampleCount> output_left{};
    std::array<Steinberg::Vst::Sample32, kSampleCount> output_right{};
    test.expect(process_stereo(processor, input, input, output_left, output_right, &changes) ==
                    Steinberg::kResultFalse,
                "throwing getPoint is contained by process");
    test.expect(throwing_point.point_calls() == 1, "throwing getPoint stops queue traversal");
    expect_component_state(test, component, baseline, "throwing getPoint leaves state unchanged");
  }

  apply_component_state(test, component, processor, {kDefaultNormalizedGain, false});
}

void check_short_state_io(TestContext& test, Steinberg::Vst::IComponent& component,
                          Steinberg::Vst::IAudioProcessor& processor,
                          Steinberg::Vst::IEditController& controller) {
  const SpikeState baseline{0.25, false};
  const SpikeState replacement{0.875, true};
  EncodedState baseline_encoded{};
  EncodedState replacement_encoded{};
  test.expect(encode_state(baseline, baseline_encoded), "short-I/O baseline state encodes");
  test.expect(encode_state(replacement, replacement_encoded),
              "short-I/O replacement state encodes");
  if (!apply_component_state(test, component, processor, baseline)) {
    return;
  }

  FixedStream controller_baseline{baseline_encoded};
  test.expect(controller.setComponentState(&controller_baseline) == Steinberg::kResultTrue,
              "controller short-I/O baseline restores");

  for (Steinberg::int32 transferred = 1; transferred < kStateSize; ++transferred) {
    FixedStream processor_stream{replacement_encoded};
    processor_stream.set_read_limit(transferred);
    test.expect(component.setState(&processor_stream) == Steinberg::kResultFalse,
                "processor rejects a short successful read");

    FixedStream controller_stream{replacement_encoded};
    controller_stream.set_read_limit(transferred);
    test.expect(controller.setComponentState(&controller_stream) == Steinberg::kResultFalse,
                "controller rejects a short successful read");
  }

  test.expect(process_zero_samples(processor) == Steinberg::kResultTrue,
              "short reads leave no pending processor state");
  expect_component_state(test, component, baseline, "short reads leave processor state unchanged");
  test.expect(near(controller.getParamNormalized(kGainParameterId), baseline.gain_normalized),
              "short reads leave controller Gain unchanged");
  test.expect(near(controller.getParamNormalized(kBypassParameterId), 0.0),
              "short reads leave controller bypass unchanged");

  for (Steinberg::int32 transferred = 1; transferred < kStateSize; ++transferred) {
    FixedStream output;
    output.set_write_limit(transferred);
    test.expect(component.getState(&output) == Steinberg::kResultFalse,
                "processor rejects a short successful write");
    test.expect(output.size() == transferred, "short write reports its exact partial byte count");
  }
  expect_component_state(test, component, baseline, "short writes leave processor state unchanged");

  apply_component_state(test, component, processor, {kDefaultNormalizedGain, false});
  EncodedState default_encoded{};
  test.expect(encode_state({kDefaultNormalizedGain, false}, default_encoded),
              "controller default state encodes after short-I/O checks");
  FixedStream controller_default{default_encoded};
  test.expect(controller.setComponentState(&controller_default) == Steinberg::kResultTrue,
              "controller returns to default after short-I/O checks");
}

void check_concurrent_state_handoff(TestContext& test, Steinberg::Vst::IComponent& component,
                                    Steinberg::Vst::IAudioProcessor& processor) {
  constexpr SpikeState first{0.125, false};
  constexpr SpikeState second{0.875, true};
  EncodedState first_encoded{};
  EncodedState second_encoded{};
  test.expect(encode_state(first, first_encoded), "first concurrent state encodes");
  test.expect(encode_state(second, second_encoded), "second concurrent state encodes");
  if (!apply_component_state(test, component, processor, first)) {
    return;
  }

  std::atomic<bool> running{true};
  std::atomic<bool> started{false};
  std::atomic<bool> process_failed{false};
  std::atomic<std::uint32_t> process_count{};
  std::thread processing_thread([&] {
    started.store(true, std::memory_order_release);
    while (running.load(std::memory_order_acquire)) {
      if (process_zero_samples(processor) != Steinberg::kResultTrue) {
        process_failed.store(true, std::memory_order_release);
        break;
      }
      process_count.fetch_add(1, std::memory_order_relaxed);
      std::this_thread::yield();
    }
  });

  while (!started.load(std::memory_order_acquire)) {
    std::this_thread::yield();
  }

  constexpr std::uint32_t kIterations = 20'000;
  bool handoff_ok = true;
  for (std::uint32_t iteration = 0; iteration < kIterations; ++iteration) {
    const auto use_second = (iteration & 1U) != 0U;
    const auto& expected = use_second ? second : first;
    const auto& encoded = use_second ? second_encoded : first_encoded;
    FixedStream input{encoded};
    if (component.setState(&input) != Steinberg::kResultTrue) {
      handoff_ok = false;
      break;
    }

    SpikeState observed{};
    if (!read_component_state(component, observed) || !same_state(observed, expected)) {
      handoff_ok = false;
      break;
    }
  }

  running.store(false, std::memory_order_release);
  processing_thread.join();
  test.expect(!process_failed.load(std::memory_order_acquire),
              "concurrent processing calls remain successful");
  test.expect(process_count.load(std::memory_order_relaxed) > 0,
              "concurrent processing thread executes at least one block");
  test.expect(handoff_ok,
              "completed setState is never overwritten and getState returns one whole state");

  apply_component_state(test, component, processor, {kDefaultNormalizedGain, false});
}

void check_factory_metadata(TestContext& test, const VST3::Hosting::PluginFactory& factory,
                            const VST3::Hosting::PluginFactory::ClassInfos& classes) {
  const auto processor_fuid = expected_processor_fuid();
  const auto controller_fuid = expected_controller_fuid();
  test.expect(garak::adapter::vst3::gain_spike::processor_fuid() == processor_fuid,
              "production processor FUID matches the independently pinned literal");
  test.expect(garak::adapter::vst3::gain_spike::controller_fuid() == controller_fuid,
              "production controller FUID matches the independently pinned literal");
  test.expect(garak::adapter::vst3::gain_spike::kGainParameterId == kGainParameterId,
              "production Gain ParamID matches the independently pinned literal");
  test.expect(garak::adapter::vst3::gain_spike::kBypassParameterId == kBypassParameterId,
              "production bypass ParamID matches the independently pinned literal");
  test.expect(std::string_view{garak::adapter::vst3::gain_spike::kVendorName} ==
                  kExpectedVendorName,
              "production vendor matches the independently pinned literal");
  test.expect(std::string_view{garak::adapter::vst3::gain_spike::kPluginName} ==
                  kExpectedPluginName,
              "production plugin name matches the independently pinned literal");
  test.expect(std::string_view{GARAK_GAIN_SPIKE_VERSION} == kExpectedPluginVersion,
              "production version matches the independently pinned literal");
  test.expect(std::string_view{garak::adapter::vst3::gain_spike::kPluginCategory} ==
                  kExpectedPluginCategory,
              "production category matches the independently pinned literal");
  test.expect(factory.classCount() == 2U, "factory exposes exactly two classes");
  test.expect(classes.size() == 2U, "both factory class records are readable");
  test.expect(factory.info().vendor() == kExpectedVendorName, "factory vendor is Garak");

  const VST3::Hosting::ClassInfo* processor_info = nullptr;
  const VST3::Hosting::ClassInfo* controller_info = nullptr;
  for (const auto& info : classes) {
    if (has_uid(info, processor_fuid)) {
      processor_info = &info;
    } else if (has_uid(info, controller_fuid)) {
      controller_info = &info;
    }
  }

  test.expect(processor_info != nullptr, "processor FUID is registered");
  test.expect(controller_info != nullptr, "controller FUID is registered");
  if (processor_info != nullptr) {
    test.expect(processor_info->category() == kVstAudioEffectClass,
                "processor factory category is Audio Module Class");
    test.expect(processor_info->name() == kExpectedPluginName, "processor name is fixed");
    test.expect(processor_info->vendor() == kExpectedVendorName, "processor vendor is fixed");
    test.expect(processor_info->version() == kExpectedPluginVersion, "processor version is fixed");
    test.expect(processor_info->subCategoriesString() == kExpectedPluginCategory,
                "processor subcategory is Fx");
    test.expect(processor_info->classFlags() == 0U, "processor declares no unverified flags");
  }
  if (controller_info != nullptr) {
    test.expect(controller_info->category() == kVstComponentControllerClass,
                "controller factory category is Component Controller Class");
    test.expect(controller_info->name() == "Garak Gain Spike Controller",
                "controller name is fixed");
    test.expect(controller_info->vendor() == kExpectedVendorName, "controller vendor is fixed");
    test.expect(controller_info->version() == kExpectedPluginVersion,
                "controller version is fixed");
    test.expect(controller_info->subCategoriesString().empty(),
                "controller has no audio subcategory");
    test.expect(controller_info->classFlags() == 0U, "controller declares no class flags");
  }
}

void check_component_contract(TestContext& test, Steinberg::Vst::IComponent& component,
                              Steinberg::Vst::IAudioProcessor& processor) {
  test.expect(component.getBusCount(Steinberg::Vst::kAudio, Steinberg::Vst::kInput) == 1,
              "component exposes one audio input bus");
  test.expect(component.getBusCount(Steinberg::Vst::kAudio, Steinberg::Vst::kOutput) == 1,
              "component exposes one audio output bus");
  test.expect(component.getBusCount(Steinberg::Vst::kEvent, Steinberg::Vst::kInput) == 0,
              "component exposes no event input bus");
  test.expect(component.getBusCount(Steinberg::Vst::kEvent, Steinberg::Vst::kOutput) == 0,
              "component exposes no event output bus");

  Steinberg::Vst::BusInfo input_info{};
  Steinberg::Vst::BusInfo output_info{};
  test.expect(component.getBusInfo(Steinberg::Vst::kAudio, Steinberg::Vst::kInput, 0, input_info) ==
                  Steinberg::kResultTrue,
              "input bus info is readable");
  test.expect(component.getBusInfo(Steinberg::Vst::kAudio, Steinberg::Vst::kOutput, 0,
                                   output_info) == Steinberg::kResultTrue,
              "output bus info is readable");
  test.expect(input_info.busType == Steinberg::Vst::kMain &&
                  output_info.busType == Steinberg::Vst::kMain,
              "both audio buses are main buses");
  test.expect(input_info.channelCount == 2 && output_info.channelCount == 2,
              "initial audio arrangement is stereo");
  test.expect((input_info.flags & Steinberg::Vst::BusInfo::kDefaultActive) != 0U &&
                  (output_info.flags & Steinberg::Vst::BusInfo::kDefaultActive) != 0U,
              "both audio buses request default activation");

  Steinberg::Vst::SpeakerArrangement mono_input[] = {Steinberg::Vst::SpeakerArr::kMono};
  Steinberg::Vst::SpeakerArrangement mono_output[] = {Steinberg::Vst::SpeakerArr::kMono};
  test.expect(processor.setBusArrangements(mono_input, 1, mono_output, 1) == Steinberg::kResultTrue,
              "mono to mono arrangement is accepted");

  Steinberg::Vst::SpeakerArrangement stereo_input[] = {Steinberg::Vst::SpeakerArr::kStereo};
  Steinberg::Vst::SpeakerArrangement stereo_output[] = {Steinberg::Vst::SpeakerArr::kStereo};
  test.expect(processor.setBusArrangements(stereo_input, 1, stereo_output, 1) ==
                  Steinberg::kResultTrue,
              "stereo to stereo arrangement is accepted");

  Steinberg::Vst::SpeakerArrangement mismatch_output[] = {Steinberg::Vst::SpeakerArr::kMono};
  test.expect(processor.setBusArrangements(stereo_input, 1, mismatch_output, 1) ==
                  Steinberg::kResultFalse,
              "mismatched arrangement is rejected");

  Steinberg::Vst::SpeakerArrangement surround_input[] = {Steinberg::Vst::SpeakerArr::k51};
  Steinberg::Vst::SpeakerArrangement surround_output[] = {Steinberg::Vst::SpeakerArr::k51};
  test.expect(processor.setBusArrangements(surround_input, 1, surround_output, 1) ==
                  Steinberg::kResultFalse,
              "surround arrangement is rejected");
  test.expect(processor.setBusArrangements(nullptr, 0, nullptr, 0) == Steinberg::kResultFalse,
              "empty arrangement is rejected");

  test.expect(processor.canProcessSampleSize(Steinberg::Vst::kSample32) == Steinberg::kResultTrue,
              "32-bit samples are supported");
  test.expect(processor.canProcessSampleSize(Steinberg::Vst::kSample64) == Steinberg::kResultTrue,
              "64-bit samples are supported");
  test.expect(processor.canProcessSampleSize(99) == Steinberg::kResultFalse,
              "unknown sample precision is rejected");
}

void check_controller_contract(TestContext& test, Steinberg::Vst::IEditController& controller) {
  test.expect(controller.getParameterCount() == 2, "controller exposes exactly two parameters");

  Steinberg::Vst::ParameterInfo gain{};
  Steinberg::Vst::ParameterInfo bypass{};
  test.expect(controller.getParameterInfo(0, gain) == Steinberg::kResultTrue,
              "Gain is parameter index zero");
  test.expect(controller.getParameterInfo(1, bypass) == Steinberg::kResultTrue,
              "Bypass is parameter index one");
  test.expect(gain.id == kGainParameterId, "Gain parameter ID is fixed");
  test.expect(bypass.id == kBypassParameterId, "Bypass parameter ID is fixed");
  test.expect(Steinberg::Vst::StringConvert::convert(gain.title) == "Gain", "Gain title is fixed");
  test.expect(Steinberg::Vst::StringConvert::convert(gain.units) == "dB", "Gain units are dB");
  test.expect(gain.stepCount == 0, "Gain is continuous");
  test.expect(near(gain.defaultNormalizedValue, kDefaultNormalizedGain),
              "Gain default maps to zero decibels");
  test.expect(gain.flags == Steinberg::Vst::ParameterInfo::kCanAutomate,
              "Gain is automatable without extra flags");
  test.expect(Steinberg::Vst::StringConvert::convert(bypass.title) == "Bypass",
              "Bypass title is fixed");
  test.expect(bypass.stepCount == 1, "Bypass is a toggle");
  test.expect(near(bypass.defaultNormalizedValue, 0.0), "Bypass defaults off");
  test.expect(bypass.flags == (Steinberg::Vst::ParameterInfo::kCanAutomate |
                               Steinberg::Vst::ParameterInfo::kIsBypass),
              "Bypass has automate and bypass flags only");
  test.expect(near(controller.normalizedParamToPlain(kGainParameterId, 0.0), -60.0),
              "Gain normalized minimum maps to -60 dB");
  test.expect(near(controller.normalizedParamToPlain(kGainParameterId, 1.0), 12.0),
              "Gain normalized maximum maps to +12 dB");
  test.expect(controller.createView(Steinberg::Vst::ViewType::kEditor) == nullptr,
              "controller has no editor view");
  test.expect(controller.createView("not-an-editor") == nullptr,
              "controller has no alternate view");
}

void check_processing_and_state(TestContext& test, Steinberg::Vst::IComponent& component,
                                Steinberg::Vst::IAudioProcessor& processor,
                                Steinberg::Vst::IEditController& controller) {
  test.expect(component.activateBus(Steinberg::Vst::kAudio, Steinberg::Vst::kInput, 0, true) ==
                  Steinberg::kResultTrue,
              "main input bus activates");
  test.expect(component.activateBus(Steinberg::Vst::kAudio, Steinberg::Vst::kOutput, 0, true) ==
                  Steinberg::kResultTrue,
              "main output bus activates");

  if (start_processing(test, component, processor, Steinberg::Vst::kSample32)) {
    Steinberg::Vst::ProcessData oversized_block{};
    oversized_block.processMode = Steinberg::Vst::kRealtime;
    oversized_block.symbolicSampleSize = Steinberg::Vst::kSample32;
    oversized_block.numSamples = 65;
    test.expect(processor.process(oversized_block) == Steinberg::kInvalidArgument,
                "block beyond prepared maximum is rejected");

    const std::array<Steinberg::Vst::Sample32, kSampleCount> input_left{0.25F, -0.5F, 0.75F, -1.0F};
    const std::array<Steinberg::Vst::Sample32, kSampleCount> input_right{-0.125F, 0.375F, -0.625F,
                                                                         0.875F};
    std::array<Steinberg::Vst::Sample32, kSampleCount> output_left{};
    std::array<Steinberg::Vst::Sample32, kSampleCount> output_right{};
    test.expect(process_stereo(processor, input_left, input_right, output_left, output_right) ==
                    Steinberg::kResultTrue,
                "default 32-bit processing succeeds");
    expect_samples(test, output_left, input_left, kFloatTolerance,
                   "default Gain is unity on left channel");
    expect_samples(test, output_right, input_right, kFloatTolerance,
                   "default Gain is unity on right channel");

    PointQueue gain_high(kGainParameterId);
    Steinberg::int32 point_index = 0;
    test.expect(gain_high.addPoint(0, 1.0, point_index) == Steinberg::kResultTrue,
                "Gain automation point is accepted by test host");
    ParameterChangesView gain_changes;
    gain_changes.add(gain_high);
    output_left.fill(0.0F);
    output_right.fill(0.0F);
    test.expect(process_stereo(processor, input_left, input_right, output_left, output_right,
                               &gain_changes) == Steinberg::kResultTrue,
                "sample-offset Gain automation processes");
    const auto maximum_gain = static_cast<float>(std::pow(10.0, 12.0 / 20.0));
    std::array<Steinberg::Vst::Sample32, kSampleCount> expected_high_left{};
    for (std::size_t index = 0; index < expected_high_left.size(); ++index) {
      expected_high_left[index] = input_left[index] * maximum_gain;
    }
    expect_samples(test, output_left, expected_high_left, kFloatTolerance,
                   "Gain automation applies +12 dB at offset zero");

    PointQueue bypass_on(kBypassParameterId);
    test.expect(bypass_on.addPoint(0, 1.0, point_index) == Steinberg::kResultTrue,
                "Bypass automation point is accepted by test host");
    ParameterChangesView bypass_changes;
    bypass_changes.add(bypass_on);
    output_left.fill(0.0F);
    output_right.fill(0.0F);
    test.expect(process_stereo(processor, input_left, input_right, output_left, output_right,
                               &bypass_changes) == Steinberg::kResultTrue,
                "sample-offset bypass processes");
    expect_samples(test, output_left, input_left, kFloatTolerance,
                   "bypass returns dry left channel");
    expect_samples(test, output_right, input_right, kFloatTolerance,
                   "bypass returns dry right channel");

    PointQueue gain_default(kGainParameterId);
    PointQueue bypass_off(kBypassParameterId);
    test.expect(gain_default.addPoint(0, kDefaultNormalizedGain, point_index) ==
                    Steinberg::kResultTrue,
                "zero-sample Gain point is accepted by test host");
    test.expect(bypass_off.addPoint(0, 0.0, point_index) == Steinberg::kResultTrue,
                "zero-sample bypass point is accepted by test host");
    ParameterChangesView restore_defaults;
    restore_defaults.add(gain_default);
    restore_defaults.add(bypass_off);
    test.expect(process_zero_samples(processor, &restore_defaults) == Steinberg::kResultTrue,
                "zero-sample parameter flush succeeds");

    FixedStream saved_state;
    test.expect(component.getState(&saved_state) == Steinberg::kResultTrue,
                "processor state is writable");
    test.expect(saved_state.size() == kStateSize, "processor state has the schema-1 byte size");

    PointQueue perturb_gain(kGainParameterId);
    PointQueue perturb_bypass(kBypassParameterId);
    test.expect(perturb_gain.addPoint(0, 1.0, point_index) == Steinberg::kResultTrue,
                "state perturbation Gain point is accepted");
    test.expect(perturb_bypass.addPoint(0, 1.0, point_index) == Steinberg::kResultTrue,
                "state perturbation bypass point is accepted");
    ParameterChangesView perturb_changes;
    perturb_changes.add(perturb_gain);
    perturb_changes.add(perturb_bypass);
    test.expect(process_zero_samples(processor, &perturb_changes) == Steinberg::kResultTrue,
                "processor state can be perturbed with a zero-sample flush");

    test.expect(controller.setParamNormalized(kGainParameterId, 1.0) == Steinberg::kResultTrue,
                "controller Gain can be perturbed");
    test.expect(controller.setParamNormalized(kBypassParameterId, 1.0) == Steinberg::kResultTrue,
                "controller bypass can be perturbed");
    saved_state.rewind();
    test.expect(component.setState(&saved_state) == Steinberg::kResultTrue,
                "processor state restores");
    saved_state.rewind();
    test.expect(controller.setComponentState(&saved_state) == Steinberg::kResultTrue,
                "controller restores from component state");
    test.expect(near(controller.getParamNormalized(kGainParameterId), kDefaultNormalizedGain),
                "controller Gain is synchronized from component state");
    test.expect(near(controller.getParamNormalized(kBypassParameterId), 0.0),
                "controller bypass is synchronized from component state");
    test.expect(process_zero_samples(processor) == Steinberg::kResultTrue,
                "restored processor state transfers at a zero-sample boundary");

    output_left.fill(0.0F);
    output_right.fill(0.0F);
    test.expect(process_stereo(processor, input_left, input_right, output_left, output_right) ==
                    Steinberg::kResultTrue,
                "processing after state restore succeeds");
    expect_samples(test, output_left, input_left, kFloatTolerance,
                   "restored processor Gain is unity");
    check_automation_edge_contract(test, component, processor);
    check_bounded_host_input_and_exception_contract(test, component, processor);
    check_short_state_io(test, component, processor, controller);
    check_concurrent_state_handoff(test, component, processor);
    stop_processing(test, component, processor);
  }

  if (start_processing(test, component, processor, Steinberg::Vst::kSample64)) {
    const std::array<Steinberg::Vst::Sample64, kSampleCount> input_left{0.125, -0.25, 0.5, -0.75};
    const std::array<Steinberg::Vst::Sample64, kSampleCount> input_right{-0.0625, 0.1875, -0.375,
                                                                         0.625};
    std::array<Steinberg::Vst::Sample64, kSampleCount> output_left{};
    std::array<Steinberg::Vst::Sample64, kSampleCount> output_right{};
    test.expect(process_stereo(processor, input_left, input_right, output_left, output_right) ==
                    Steinberg::kResultTrue,
                "default 64-bit processing succeeds");
    expect_samples(test, output_left, input_left, kDoubleTolerance,
                   "64-bit Gain is unity on left channel");
    expect_samples(test, output_right, input_right, kDoubleTolerance,
                   "64-bit Gain is unity on right channel");
    stop_processing(test, component, processor);
  }

  test.expect(component.activateBus(Steinberg::Vst::kAudio, Steinberg::Vst::kInput, 0, false) ==
                  Steinberg::kResultTrue,
              "main input bus deactivates");
  test.expect(component.activateBus(Steinberg::Vst::kAudio, Steinberg::Vst::kOutput, 0, false) ==
                  Steinberg::kResultTrue,
              "main output bus deactivates");
}

} // namespace

int main(const int argc, char* argv[]) {
  try {
    if (argc != 2 || argv[1] == nullptr || std::string_view{argv[1]}.empty()) {
      std::cerr << "Usage: garak_vst3_gain_contract_tests <Garak Gain Spike.vst3>\n";
      return 1;
    }

    std::string load_error;
    const auto module = VST3::Hosting::Module::create(argv[1], load_error);
    if (module == nullptr) {
      std::cerr << "Failed to load VST3 module '" << argv[1] << "': " << load_error << '\n';
      return 1;
    }

    TestContext test;
    test.expect(module->isBundle(), "module uses the VST3 bundle structure");
    const auto& factory = module->getFactory();
    const auto classes = factory.classInfos();
    check_factory_metadata(test, factory, classes);

    const auto expected_processor_uid = expected_processor_fuid();
    const auto expected_controller_uid = expected_controller_fuid();
    const VST3::UID processor_uid(expected_processor_uid.toTUID());
    const VST3::UID controller_uid(expected_controller_uid.toTUID());
    auto component = factory.createInstance<Steinberg::Vst::IComponent>(processor_uid);
    auto controller = factory.createInstance<Steinberg::Vst::IEditController>(controller_uid);
    test.expect(component != nullptr, "factory creates the processor component");
    test.expect(controller != nullptr, "factory creates the edit controller");
    if (component == nullptr || controller == nullptr) {
      return test.result();
    }

    Steinberg::TUID associated_controller{};
    test.expect(component->getControllerClassId(associated_controller) == Steinberg::kResultTrue,
                "component reports its controller class");
    test.expect(Steinberg::FUID::fromTUID(associated_controller) == expected_controller_uid,
                "component-controller FUID association is exact");

    Steinberg::FUnknownPtr<Steinberg::Vst::IAudioProcessor> processor(component.get());
    test.expect(processor != nullptr, "component implements IAudioProcessor");
    if (processor == nullptr) {
      return test.result();
    }

    const auto component_initialized = component->initialize(nullptr) == Steinberg::kResultTrue;
    const auto controller_initialized = controller->initialize(nullptr) == Steinberg::kResultTrue;
    test.expect(component_initialized, "component initializes");
    test.expect(controller_initialized, "controller initializes");

    if (component_initialized) {
      check_component_contract(test, *component, *processor);
    }
    if (controller_initialized) {
      check_controller_contract(test, *controller);
    }
    if (component_initialized && controller_initialized) {
      check_processing_and_state(test, *component, *processor, *controller);
    }

    if (controller_initialized) {
      test.expect(controller->terminate() == Steinberg::kResultTrue, "controller terminates");
    }
    if (component_initialized) {
      test.expect(component->terminate() == Steinberg::kResultTrue, "component terminates");
    }

    return test.result();
  } catch (...) {
    return 1;
  }
}
