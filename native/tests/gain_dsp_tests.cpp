#include "garak/dsp/gain/gain.hpp"

#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <span>
#include <string_view>

namespace {

constexpr double kTolerance = 1.0e-10;

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

class PointSource final {
public:
  explicit PointSource(const std::span<const garak::dsp::gain::AutomationPoint> points) noexcept
      : points_(points) {}

  [[nodiscard]] std::int32_t point_count() const noexcept {
    return static_cast<std::int32_t>(points_.size());
  }

  [[nodiscard]] bool point(const std::int32_t index,
                           garak::dsp::gain::AutomationPoint& point) const noexcept {
    if (index < 0 || static_cast<std::size_t>(index) >= points_.size()) {
      return false;
    }
    point = points_[static_cast<std::size_t>(index)];
    return true;
  }

private:
  std::span<const garak::dsp::gain::AutomationPoint> points_;
};

[[nodiscard]] bool nearly_equal(const double left, const double right,
                                const double tolerance = kTolerance) noexcept {
  return std::abs(left - right) <= tolerance;
}

void test_conversion_contract(TestContext& test) {
  using namespace garak::dsp::gain;

  test.expect(normalized_to_decibels(0.0) == kMinimumDecibels,
              "normalized zero maps to the minimum decibels");
  test.expect(normalized_to_decibels(1.0) == kMaximumDecibels,
              "normalized one maps to the maximum decibels");
  test.expect(decibels_to_normalized(kDefaultDecibels) == default_normalized_gain(),
              "default gain round-trips through the normalized domain");
  test.expect(decibels_to_normalized(-100.0) == 0.0 && decibels_to_normalized(100.0) == 1.0,
              "decibel conversion clamps to the supported range");
  test.expect(decibels_to_linear(0.0) == 1.0, "zero decibels maps to unity linear gain");
  test.expect(processed_sample(std::numeric_limits<double>::quiet_NaN(), 1.0) == 0.0,
              "non-finite input is contained at the DSP boundary");
}

void test_mono_and_stereo_processing(TestContext& test) {
  using namespace garak::dsp::gain;

  std::array<float, 4> mono_input{1.0F, 0.5F, -1.0F, 0.0F};
  std::array<float, 4> mono_output{};
  float* mono_inputs[] = {mono_input.data()};
  float* mono_outputs[] = {mono_output.data()};
  PointSource no_gain_points(std::span<const AutomationPoint>{});
  PointSource no_bypass_points(std::span<const AutomationPoint>{});
  double gain = decibels_to_normalized(-6.0);
  bool bypass = false;
  std::uint64_t silence = 0;

  process_block(ProcessBlockContext<float, PointSource, PointSource>{
      mono_inputs, mono_outputs, 1, static_cast<std::int32_t>(mono_input.size()), 0, silence,
      no_gain_points, no_bypass_points, gain, bypass});

  const auto expected = static_cast<float>(decibels_to_linear(-6.0));
  test.expect(std::abs(mono_output[0] - expected) < 1.0e-6F &&
                  std::abs(mono_output[1] - (0.5F * expected)) < 1.0e-6F &&
                  std::abs(mono_output[2] + expected) < 1.0e-6F,
              "mono processing applies the exact configured gain");

  std::array<double, 4> left_input{1.0, 1.0, 1.0, 1.0};
  std::array<double, 4> right_input{2.0, 2.0, 2.0, 2.0};
  std::array<double, 4> left_output{};
  std::array<double, 4> right_output{};
  double* stereo_inputs[] = {left_input.data(), right_input.data()};
  double* stereo_outputs[] = {left_output.data(), right_output.data()};
  gain = default_normalized_gain();
  silence = 0;

  process_block(ProcessBlockContext<double, PointSource, PointSource>{
      stereo_inputs, stereo_outputs, 2, static_cast<std::int32_t>(left_input.size()), 0, silence,
      no_gain_points, no_bypass_points, gain, bypass});

  test.expect(left_output == left_input && right_output == right_input,
              "stereo processing preserves both channels at unity gain");
}

void test_sample_accurate_automation(TestContext& test) {
  using namespace garak::dsp::gain;

  const std::array gain_points{AutomationPoint{0, 0.0}, AutomationPoint{3, 1.0}};
  const std::array bypass_points{AutomationPoint{1, 1.0}, AutomationPoint{2, 0.0}};
  PointSource gain_source(gain_points);
  PointSource bypass_source(bypass_points);
  std::array<double, 4> input{1.0, 1.0, 1.0, 1.0};
  std::array<double, 4> output{};
  double* inputs[] = {input.data()};
  double* outputs[] = {output.data()};
  double gain = default_normalized_gain();
  bool bypass = false;
  std::uint64_t silence = 0;

  process_block(ProcessBlockContext<double, PointSource, PointSource>{
      inputs, outputs, 1, static_cast<std::int32_t>(input.size()), 0, silence, gain_source,
      bypass_source, gain, bypass});

  test.expect(nearly_equal(output[0], decibels_to_linear(kMinimumDecibels)) && output[1] == 1.0 &&
                  nearly_equal(output[3], decibels_to_linear(kMaximumDecibels)),
              "gain interpolation and exact-offset bypass are sample accurate");
  test.expect(gain == 1.0 && !bypass,
              "the block publishes the final automated gain and bypass values");
}

void test_zero_sample_and_silence_contract(TestContext& test) {
  using namespace garak::dsp::gain;

  const std::array gain_points{AutomationPoint{0, 0.25}};
  const std::array bypass_points{AutomationPoint{0, 1.0}};
  PointSource gain_source(gain_points);
  PointSource bypass_source(bypass_points);
  std::array<float*, 1> unused_inputs{};
  std::array<float*, 1> unused_outputs{};
  double gain = default_normalized_gain();
  bool bypass = false;
  std::uint64_t silence = 0;

  process_block(ProcessBlockContext<float, PointSource, PointSource>{
      unused_inputs.data(), unused_outputs.data(), 0, 0, 0, silence, gain_source, bypass_source,
      gain, bypass});
  test.expect(gain == 0.25 && bypass, "a zero-sample block consumes offset-zero parameter changes");

  PointSource no_gain_points(std::span<const AutomationPoint>{});
  PointSource no_bypass_points(std::span<const AutomationPoint>{});
  std::array<float, 2> input{1.0F, 1.0F};
  std::array<float, 2> output{1.0F, 1.0F};
  float* inputs[] = {input.data()};
  float* outputs[] = {output.data()};
  gain = default_normalized_gain();
  bypass = false;

  process_block(ProcessBlockContext<float, PointSource, PointSource>{
      inputs, outputs, 1, static_cast<std::int32_t>(input.size()), 1, silence, no_gain_points,
      no_bypass_points, gain, bypass});
  test.expect(silence == 1 && output[0] == 0.0F && output[1] == 0.0F,
              "input silence flags produce zero output and propagate exactly");
}

void test_invalid_automation_is_ignored(TestContext& test) {
  using namespace garak::dsp::gain;

  std::array<float, 4> input{0.25F, -0.5F, 0.75F, -1.0F};
  std::array<float, 4> output{};
  float* inputs[] = {input.data()};
  float* outputs[] = {output.data()};
  std::uint64_t silence = 0;

  const auto verify_ignored = [&](const std::span<const AutomationPoint> points,
                                  const std::string_view message) {
    PointSource gain_source(points);
    PointSource no_bypass_points(std::span<const AutomationPoint>{});
    output.fill(0.0F);
    double gain = default_normalized_gain();
    bool bypass = false;

    process_block(ProcessBlockContext<float, PointSource, PointSource>{
        inputs, outputs, 1, static_cast<std::int32_t>(input.size()), 0, silence, gain_source,
        no_bypass_points, gain, bypass});
    test.expect(output == input && gain == default_normalized_gain() && !bypass, message);
  };

  const std::array non_monotonic{AutomationPoint{2, 0.0}, AutomationPoint{1, 1.0}};
  verify_ignored(non_monotonic,
                 "non-monotonic automation is ignored without changing live state");

  const std::array non_finite{
      AutomationPoint{1, std::numeric_limits<double>::quiet_NaN()}};
  verify_ignored(non_finite, "non-finite automation is ignored without changing live state");

  const std::array out_of_range{AutomationPoint{4, 1.0}};
  verify_ignored(out_of_range,
                 "out-of-range automation is ignored without changing live state");

  PointSource no_gain_points(std::span<const AutomationPoint>{});
  PointSource invalid_bypass_source(out_of_range);
  output.fill(0.0F);
  double gain = default_normalized_gain();
  bool bypass = false;
  process_block(ProcessBlockContext<float, PointSource, PointSource>{
      inputs, outputs, 1, static_cast<std::int32_t>(input.size()), 0, silence, no_gain_points,
      invalid_bypass_source, gain, bypass});
  test.expect(output == input && gain == default_normalized_gain() && !bypass,
              "invalid bypass automation is ignored without changing live state");
}

} // namespace

int main() {
  TestContext test;
  test_conversion_contract(test);
  test_mono_and_stereo_processing(test);
  test_sample_accurate_automation(test);
  test_zero_sample_and_silence_contract(test);
  test_invalid_automation_is_ignored(test);
  return test.result();
}
