#include "automation.hpp"
#include "gain_kernel.hpp"
#include "state_codec.hpp"

#include <array>
#include <bit>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <limits>
#include <span>
#include <string_view>

namespace {

using garak::spike::gain::AutomationPoint;

class TestContext final {
public:
  void expect(const bool condition, const std::string_view message) {
    if (!condition) {
      std::cerr << "FAIL: " << message << '\n';
      ++failures_;
    }
  }

  void expect_near(const double actual, const double expected, const double tolerance,
                   const std::string_view message) {
    if (!std::isfinite(actual) || std::abs(actual - expected) > tolerance) {
      std::cerr << "FAIL: " << message << " expected=" << expected << " actual=" << actual << '\n';
      ++failures_;
    }
  }

  [[nodiscard]] int result() const noexcept { return failures_ == 0 ? 0 : 1; }

private:
  int failures_{};
};

class SpanPointSource final {
public:
  explicit SpanPointSource(const std::span<const AutomationPoint> points) noexcept
      : points_(points) {}

  [[nodiscard]] std::int32_t point_count() const noexcept {
    return static_cast<std::int32_t>(points_.size());
  }

  [[nodiscard]] bool point(const std::int32_t index, AutomationPoint& point) const noexcept {
    if (index < 0 || static_cast<std::size_t>(index) >= points_.size()) {
      return false;
    }
    point = points_[static_cast<std::size_t>(index)];
    return true;
  }

private:
  std::span<const AutomationPoint> points_;
};

class FailingPointSource final {
public:
  [[nodiscard]] std::int32_t point_count() const noexcept { return 1; }
  [[nodiscard]] bool point(std::int32_t, AutomationPoint&) const noexcept { return false; }
};

class ReportedPointSource final {
public:
  explicit ReportedPointSource(const std::int32_t reported_count) noexcept
      : reported_count_(reported_count) {}

  [[nodiscard]] std::int32_t point_count() noexcept {
    ++point_count_calls_;
    return reported_count_;
  }

  [[nodiscard]] bool point(std::int32_t, AutomationPoint&) noexcept {
    ++point_calls_;
    return false;
  }

  [[nodiscard]] std::int32_t point_count_calls() const noexcept { return point_count_calls_; }
  [[nodiscard]] std::int32_t point_calls() const noexcept { return point_calls_; }

private:
  std::int32_t reported_count_{};
  std::int32_t point_count_calls_{};
  std::int32_t point_calls_{};
};

template <typename Sample, std::size_t SampleCount> struct MonoBlock final {
  std::array<Sample, SampleCount>& input;
  std::array<Sample, SampleCount>& output;
  std::span<const AutomationPoint> gain_points;
  std::span<const AutomationPoint> bypass_points;
  double& current_gain;
  bool& current_bypass;
  std::uint64_t input_silence{};
  std::uint64_t* output_silence_result{};
};

template <typename Sample, std::size_t SampleCount>
void run_mono(const MonoBlock<Sample, SampleCount>& block) {
  SpanPointSource gain_source(block.gain_points);
  SpanPointSource bypass_source(block.bypass_points);
  std::array<Sample*, 1> input_channels{block.input.data()};
  std::array<Sample*, 1> output_channels{block.output.data()};
  std::uint64_t output_silence = 0;
  garak::spike::gain::process_block(
      garak::spike::gain::ProcessBlockContext<Sample, SpanPointSource, SpanPointSource>{
          input_channels.data(), output_channels.data(), 1, static_cast<std::int32_t>(SampleCount),
          block.input_silence, output_silence, gain_source, bypass_source, block.current_gain,
          block.current_bypass});
  if (block.output_silence_result != nullptr) {
    *block.output_silence_result = output_silence;
  }
}

void test_mapping(TestContext& test) {
  using namespace garak::spike::gain;
  test.expect_near(normalized_to_decibels(0.0), -60.0, 1e-12, "normalized minimum");
  test.expect_near(normalized_to_decibels(1.0), 12.0, 1e-12, "normalized maximum");
  test.expect_near(normalized_to_decibels(-2.0), -60.0, 1e-12, "normalized low clamp");
  test.expect_near(normalized_to_decibels(2.0), 12.0, 1e-12, "normalized high clamp");
  test.expect_near(default_normalized_gain(), 5.0 / 6.0, 1e-12, "zero dB normalized default");
  test.expect_near(decibels_to_normalized(0.0), default_normalized_gain(), 1e-12,
                   "dB to normalized default");
  test.expect_near(decibels_to_linear(0.0), 1.0, 1e-12, "unity linear gain");
  test.expect_near(decibels_to_linear(-60.0), 0.001, 1e-12, "minimum linear gain");
  test.expect_near(decibels_to_linear(12.0), std::pow(10.0, 0.6), 1e-12, "positive linear gain");
  test.expect_near(decibels_to_normalized(std::numeric_limits<double>::infinity()),
                   default_normalized_gain(), 1e-12, "non-finite dB default");
}

template <typename Sample>
void test_basic_audio_type(TestContext& test, const std::string_view label) {
  using namespace garak::spike::gain;
  constexpr std::array<AutomationPoint, 0> no_points{};
  std::array<Sample, 4> input{static_cast<Sample>(1), static_cast<Sample>(-0.5),
                              static_cast<Sample>(0.25), static_cast<Sample>(0)};
  std::array<Sample, 4> output{};
  double gain = default_normalized_gain();
  bool bypass = false;
  run_mono(MonoBlock{input, output, no_points, no_points, gain, bypass});
  for (std::size_t index = 0; index < input.size(); ++index) {
    test.expect_near(output[index], input[index], 1e-6, label);
  }

  gain = 0.0;
  output.fill(static_cast<Sample>(0));
  run_mono(MonoBlock{input, output, no_points, no_points, gain, bypass});
  test.expect_near(output[0], 0.001, 1e-6, "minimum gain audio");

  gain = 1.0;
  output.fill(static_cast<Sample>(0));
  run_mono(MonoBlock{input, output, no_points, no_points, gain, bypass});
  test.expect_near(output[0], std::pow(10.0, 0.6), 1e-5, "positive gain audio");

  auto in_place = input;
  gain = default_normalized_gain();
  SpanPointSource gain_source(no_points);
  SpanPointSource bypass_source(no_points);
  std::array<Sample*, 1> channels{in_place.data()};
  std::uint64_t output_silence = 0;
  garak::spike::gain::process_block(
      garak::spike::gain::ProcessBlockContext<Sample, SpanPointSource, SpanPointSource>{
          channels.data(), channels.data(), 1, 4, 0, output_silence, gain_source, bypass_source,
          gain, bypass});
  for (std::size_t index = 0; index < input.size(); ++index) {
    test.expect_near(in_place[index], input[index], 1e-6, "in-place unity");
  }
}

void test_stereo_and_silence(TestContext& test) {
  using namespace garak::spike::gain;
  constexpr std::array<AutomationPoint, 0> no_points{};
  std::array<float, 3> left{1.0F, 1.0F, 1.0F};
  std::array<float, 3> right{0.5F, 0.25F, 0.125F};
  std::array<float, 3> out_left{9.0F, 9.0F, 9.0F};
  std::array<float, 3> out_right{};
  std::array<float*, 2> inputs{left.data(), right.data()};
  std::array<float*, 2> outputs{out_left.data(), out_right.data()};
  SpanPointSource gain_source(no_points);
  SpanPointSource bypass_source(no_points);
  double gain = default_normalized_gain();
  bool bypass = false;
  std::uint64_t output_silence = 0;
  process_block(ProcessBlockContext<float, SpanPointSource, SpanPointSource>{
      inputs.data(), outputs.data(), 2, 3, 1, output_silence, gain_source, bypass_source, gain,
      bypass});
  test.expect(output_silence == 1, "per-channel output silence mask");
  for (const auto sample : out_left) {
    test.expect_near(sample, 0.0, 1e-7, "silent input channel is zeroed");
  }
  for (std::size_t index = 0; index < right.size(); ++index) {
    test.expect_near(out_right[index], right[index], 1e-7, "non-silent stereo channel");
  }
}

void test_gain_automation(TestContext& test) {
  using namespace garak::spike::gain;
  constexpr std::array<AutomationPoint, 0> no_points{};
  std::array<double, 4> input{1.0, 1.0, 1.0, 1.0};
  std::array<double, 4> output{};
  bool bypass = false;

  const std::array<AutomationPoint, 1> single{{AutomationPoint{3, 1.0}}};
  double gain = 0.0;
  run_mono(MonoBlock{input, output, single, no_points, gain, bypass});
  for (std::size_t sample = 0; sample < output.size(); ++sample) {
    const auto normalized = static_cast<double>(sample + 1) / 4.0;
    const auto expected = decibels_to_linear(normalized_to_decibels(normalized));
    test.expect_near(output[sample], expected, 1e-12, "first point virtual-minus-one ramp");
  }
  test.expect_near(gain, 1.0, 1e-12, "final automation value persists");

  const std::array<AutomationPoint, 2> multiple{{AutomationPoint{1, 0.4}, AutomationPoint{3, 0.8}}};
  gain = 0.0;
  output.fill(0.0);
  run_mono(MonoBlock{input, output, multiple, no_points, gain, bypass});
  const std::array expected_normalized{0.2, 0.4, 0.6, 0.8};
  for (std::size_t sample = 0; sample < output.size(); ++sample) {
    test.expect_near(output[sample],
                     decibels_to_linear(normalized_to_decibels(expected_normalized[sample])), 1e-12,
                     "multiple automation points");
  }

  const std::array<AutomationPoint, 1> at_zero{{AutomationPoint{0, default_normalized_gain()}}};
  gain = 0.0;
  output.fill(0.0);
  run_mono(MonoBlock{input, output, at_zero, no_points, gain, bypass});
  test.expect_near(output[0], 1.0, 1e-12, "point at sample zero");

  const std::array<AutomationPoint, 2> duplicate{
      {AutomationPoint{1, 0.2}, AutomationPoint{1, 0.7}}};
  gain = 0.0;
  run_mono(MonoBlock{input, output, duplicate, no_points, gain, bypass});
  test.expect_near(gain, 0.7, 1e-12, "duplicate offset last value wins");

  const std::array<AutomationPoint, 2> decreasing{
      {AutomationPoint{2, 0.5}, AutomationPoint{1, 1.0}}};
  gain = 0.25;
  run_mono(MonoBlock{input, output, decreasing, no_points, gain, bypass});
  test.expect_near(gain, 0.25, 1e-12, "decreasing queue rejected without mutation");

  const std::array<AutomationPoint, 1> negative{{AutomationPoint{-1, 0.8}}};
  gain = 0.3;
  run_mono(MonoBlock{input, output, negative, no_points, gain, bypass});
  test.expect_near(gain, 0.3, 1e-12, "negative offset queue rejected");

  const std::array<AutomationPoint, 1> past_end{{AutomationPoint{4, 0.8}}};
  gain = 0.3;
  run_mono(MonoBlock{input, output, past_end, no_points, gain, bypass});
  test.expect_near(gain, 0.3, 1e-12, "offset equal to sample count rejected");

  const std::array<AutomationPoint, 1> non_finite{
      {AutomationPoint{0, std::numeric_limits<double>::quiet_NaN()}}};
  gain = 0.3;
  run_mono(MonoBlock{input, output, non_finite, no_points, gain, bypass});
  test.expect_near(gain, 0.3, 1e-12, "non-finite queue rejected");

  const std::array<AutomationPoint, 1> clamped{{AutomationPoint{0, 2.0}}};
  gain = 0.0;
  run_mono(MonoBlock{input, output, clamped, no_points, gain, bypass});
  test.expect_near(gain, 1.0, 1e-12, "finite automation value clamped");

  FailingPointSource failing;
  SpanPointSource empty(no_points);
  std::array<double*, 1> input_channels{input.data()};
  std::array<double*, 1> output_channels{output.data()};
  std::uint64_t silence = 0;
  gain = 0.4;
  process_block(ProcessBlockContext<double, FailingPointSource, SpanPointSource>{
      input_channels.data(), output_channels.data(), 1, 4, 0, silence, failing, empty, gain,
      bypass});
  test.expect_near(gain, 0.4, 1e-12, "getPoint failure rejects queue");

  ReportedPointSource oversized(std::numeric_limits<std::int32_t>::max());
  process_block(ProcessBlockContext<double, ReportedPointSource, SpanPointSource>{
      input_channels.data(), output_channels.data(), 1, 4, 0, silence, oversized, empty, gain,
      bypass});
  test.expect_near(gain, 0.4, 1e-12, "oversized queue does not mutate automation state");
  test.expect(oversized.point_count_calls() == 1, "oversized queue count is read once");
  test.expect(oversized.point_calls() == 0, "oversized queue points are not traversed");
}

void test_automation_bounds(TestContext& test) {
  using namespace garak::spike::gain;
  constexpr std::array<AutomationPoint, 0> no_points{};
  std::array<double, 4> input{1.0, 1.0, 1.0, 1.0};
  std::array<double, 4> output{};
  std::array<double*, 1> input_channels{input.data()};
  std::array<double*, 1> output_channels{output.data()};
  SpanPointSource empty(no_points);
  std::uint64_t silence = 0;
  bool bypass = false;

  const std::array<AutomationPoint, 8> maximum_points{
      {AutomationPoint{0, 0.1}, AutomationPoint{0, 0.2}, AutomationPoint{1, 0.3},
       AutomationPoint{1, 0.4}, AutomationPoint{2, 0.5}, AutomationPoint{2, 0.6},
       AutomationPoint{3, 0.7}, AutomationPoint{3, 0.8}}};
  SpanPointSource maximum_source(maximum_points);
  double gain = 0.0;
  process_block(ProcessBlockContext<double, SpanPointSource, SpanPointSource>{
      input_channels.data(), output_channels.data(), 1, 4, 0, silence, maximum_source, empty, gain,
      bypass});
  test.expect_near(gain, 0.8, 0.0, "two automation points per sample are accepted");

  for (const std::int32_t reported_count :
       {std::int32_t{9}, std::numeric_limits<std::int32_t>::max()}) {
    ReportedPointSource over_limit(reported_count);
    gain = 0.4;
    process_block(ProcessBlockContext<double, ReportedPointSource, SpanPointSource>{
        input_channels.data(), output_channels.data(), 1, 4, 0, silence, over_limit, empty, gain,
        bypass});
    test.expect_near(gain, 0.4, 0.0, "over-limit automation queue leaves state unchanged");
    test.expect(over_limit.point_count_calls() == 1, "over-limit automation count is read once");
    test.expect(over_limit.point_calls() == 0, "over-limit automation points are not traversed");
  }

  const std::array<AutomationPoint, 2> zero_sample_maximum{
      {AutomationPoint{0, 0.2}, AutomationPoint{0, 0.6}}};
  SpanPointSource zero_sample_source(zero_sample_maximum);
  std::array<double*, 1> unused_input{};
  std::array<double*, 1> unused_output{};
  gain = 0.4;
  process_block(ProcessBlockContext<double, SpanPointSource, SpanPointSource>{
      unused_input.data(), unused_output.data(), 0, 0, 0, silence, zero_sample_source, empty, gain,
      bypass});
  test.expect_near(gain, 0.6, 0.0, "two zero-sample automation points are accepted");

  ReportedPointSource zero_sample_over_limit(3);
  gain = 0.4;
  process_block(ProcessBlockContext<double, ReportedPointSource, SpanPointSource>{
      unused_input.data(), unused_output.data(), 0, 0, 0, silence, zero_sample_over_limit, empty,
      gain, bypass});
  test.expect_near(gain, 0.4, 0.0, "three zero-sample points are rejected without mutation");
  test.expect(zero_sample_over_limit.point_calls() == 0,
              "over-limit zero-sample points are not traversed");

  SpanPointSource overflow_empty(no_points);
  AutomationTimeline overflow_timeline(
      overflow_empty,
      AutomationBlock{std::numeric_limits<std::int32_t>::max(), default_normalized_gain()});
  test.expect(overflow_timeline.valid(), "maximum sample count computes a valid saturated cap");
}

void test_bypass_and_zero_sample(TestContext& test) {
  using namespace garak::spike::gain;
  constexpr std::array<AutomationPoint, 0> no_points{};
  const std::array<AutomationPoint, 1> bypass_points{{AutomationPoint{2, 1.0}}};
  std::array<float, 4> input{1.0F, 1.0F, 1.0F, 1.0F};
  std::array<float, 4> output{};
  double gain = 0.0;
  bool bypass = false;
  run_mono(MonoBlock{input, output, no_points, bypass_points, gain, bypass});
  test.expect_near(output[0], 0.001, 1e-7, "bypass remains off before point");
  test.expect_near(output[1], 0.001, 1e-7, "bypass remains off before middle point");
  test.expect_near(output[2], 1.0, 1e-7, "bypass starts at exact offset");
  test.expect_near(output[3], 1.0, 1e-7, "bypass holds after point");
  test.expect(bypass, "bypass state persists");

  const std::array<AutomationPoint, 1> gain_while_bypassed{{AutomationPoint{3, 1.0}}};
  gain = 0.0;
  bypass = true;
  output.fill(0.0F);
  run_mono(MonoBlock{input, output, gain_while_bypassed, no_points, gain, bypass});
  for (const auto sample : output) {
    test.expect_near(sample, 1.0, 1e-7, "bypass dry copy");
  }
  test.expect_near(gain, 1.0, 1e-12, "gain advances while bypassed");

  SpanPointSource gain_source(no_points);
  const std::array<AutomationPoint, 1> zero_bypass{{AutomationPoint{0, 1.0}}};
  SpanPointSource bypass_source(zero_bypass);
  std::array<float*, 1> unused_input{};
  std::array<float*, 1> unused_output{};
  std::uint64_t silence = 0;
  gain = default_normalized_gain();
  bypass = false;
  process_block(ProcessBlockContext<float, SpanPointSource, SpanPointSource>{
      unused_input.data(), unused_output.data(), 0, 0, 0, silence, gain_source, bypass_source, gain,
      bypass});
  test.expect(bypass, "zero-sample offset-zero bypass flush");
}

void test_non_finite_and_denormal(TestContext& test) {
  using namespace garak::spike::gain;
  constexpr std::array<AutomationPoint, 0> no_points{};
  std::array<float, 4> input{std::numeric_limits<float>::quiet_NaN(),
                             std::numeric_limits<float>::infinity(),
                             std::numeric_limits<float>::denorm_min(), 1.0F};
  std::array<float, 4> output{};
  double gain = default_normalized_gain();
  bool bypass = false;
  run_mono(MonoBlock{input, output, no_points, no_points, gain, bypass});
  test.expect_near(output[0], 0.0, 0.0, "NaN input sanitized in gain path");
  test.expect_near(output[1], 0.0, 0.0, "infinite input sanitized in gain path");
  test.expect_near(output[2], 0.0, 0.0, "denormal output flushed");

  bypass = true;
  run_mono(MonoBlock{input, output, no_points, no_points, gain, bypass});
  test.expect(std::isinf(output[1]), "bypass preserves dry non-finite input");
}

void test_state(TestContext& test) {
  using namespace garak::spike::gain;
  const SpikeState expected{default_normalized_gain(), true};
  EncodedState encoded{};
  test.expect(encode_state(expected, encoded), "state encode");
  test.expect(encoded[0] == 'G' && encoded[1] == 'G' && encoded[2] == 'S' && encoded[3] == '1',
              "state magic");
  test.expect(encoded[4] == 1 && encoded[5] == 0 && encoded[6] == 0 && encoded[7] == 0,
              "little-endian schema version");
  test.expect(encoded[16] == 1 && encoded[17] == 0 && encoded[18] == 0 && encoded[19] == 0,
              "little-endian bypass value");

  SpikeState decoded{0.25, false};
  test.expect(decode_state(encoded, decoded), "state decode");
  test.expect_near(decoded.gain_normalized, expected.gain_normalized, 0.0, "state gain round trip");
  test.expect(decoded.bypass, "state bypass round trip");

  for (std::size_t size = 0; size < kEncodedStateSize; ++size) {
    SpikeState unchanged{0.25, false};
    test.expect(!decode_state(std::span<const std::uint8_t>(encoded.data(), size), unchanged),
                "truncated state rejected");
    test.expect_near(unchanged.gain_normalized, 0.25, 0.0,
                     "truncated state does not partially mutate gain");
    test.expect(!unchanged.bypass, "truncated state does not partially mutate bypass");
  }

  auto corrupt = encoded;
  corrupt[0] ^= 1U;
  test.expect(!decode_state(corrupt, decoded), "invalid magic rejected");
  corrupt = encoded;
  corrupt[4] = 2;
  test.expect(!decode_state(corrupt, decoded), "unsupported version rejected");
  corrupt = encoded;
  const auto nan_bits = std::bit_cast<std::uint64_t>(std::numeric_limits<double>::quiet_NaN());
  for (std::size_t index = 0; index < 8; ++index) {
    corrupt[8 + index] = static_cast<std::uint8_t>(nan_bits >> (index * 8));
  }
  test.expect(!decode_state(corrupt, decoded), "non-finite state gain rejected");
  corrupt = encoded;
  corrupt[16] = 2;
  test.expect(!decode_state(corrupt, decoded), "invalid bypass state rejected");

  EncodedState unused{};
  test.expect(!encode_state({-0.1, false}, unused), "out-of-range state encode rejected");
  const auto packed = pack_realtime_state(expected);
  const auto unpacked = unpack_realtime_state(packed);
  test.expect_near(unpacked.gain_normalized, expected.gain_normalized, 0.0,
                   "atomic state gain packing");
  test.expect(unpacked.bypass, "atomic state bypass packing");
}

} // namespace

int main() {
  try {
    TestContext test;
    test_mapping(test);
    test_basic_audio_type<float>(test, "float32 unity");
    test_basic_audio_type<double>(test, "float64 unity");
    test_stereo_and_silence(test);
    test_gain_automation(test);
    test_automation_bounds(test);
    test_bypass_and_zero_sample(test);
    test_non_finite_and_denormal(test);
    test_state(test);
    return test.result();
  } catch (...) {
    return 1;
  }
}
