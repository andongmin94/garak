#include "garak/dsp/saturation/saturation.hpp"

#include <array>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <span>
#include <string_view>
#include <type_traits>

namespace {

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

template <typename Sample> [[nodiscard]] constexpr Sample tolerance() noexcept {
  if constexpr (std::is_same_v<Sample, float>) {
    return static_cast<Sample>(1.0e-6F);
  } else {
    return static_cast<Sample>(1.0e-12);
  }
}

template <typename Sample>
[[nodiscard]] bool near(const Sample left, const Sample right) noexcept {
  return std::abs(left - right) <= tolerance<Sample>();
}

template <typename Sample> void test_scalar_contract(TestContext& test) {
  using garak::dsp::saturation::processed_sample;
  constexpr std::array inputs{static_cast<Sample>(0),      static_cast<Sample>(0.125),
                              static_cast<Sample>(-0.125), static_cast<Sample>(0.5),
                              static_cast<Sample>(-0.5),   static_cast<Sample>(1),
                              static_cast<Sample>(-1),     static_cast<Sample>(4),
                              static_cast<Sample>(-4)};
  for (const auto input : inputs) {
    const auto output = processed_sample(input);
    test.expect(near(output, static_cast<Sample>(std::tanh(input))),
                "Saturation v1 matches tanh for finite samples");
    test.expect(std::isfinite(output), "finite Saturation input produces finite output");
    test.expect(near(processed_sample(-input), -output), "Saturation v1 is odd-symmetric");
    if (input > static_cast<Sample>(0)) {
      test.expect(output > static_cast<Sample>(0) && output <= input,
                  "positive Saturation output keeps sign and does not expand magnitude");
    }
  }

  const auto infinity = std::numeric_limits<Sample>::infinity();
  test.expect(processed_sample(infinity) == static_cast<Sample>(1) &&
                  processed_sample(-infinity) == static_cast<Sample>(-1),
              "Saturation v1 maps infinities to its asymptotes");
  test.expect(std::isnan(processed_sample(std::numeric_limits<Sample>::quiet_NaN())),
              "the pure Saturation primitive leaves NaN sanitation to its caller");
}

template <typename Sample> void test_channel_blocks(TestContext& test) {
  using garak::dsp::saturation::process_block;
  using garak::dsp::saturation::processed_sample;
  constexpr std::size_t sample_count = 7;
  const std::array<Sample, sample_count> left{static_cast<Sample>(0),     static_cast<Sample>(0.25),
                                              static_cast<Sample>(-0.25), static_cast<Sample>(0.75),
                                              static_cast<Sample>(-0.75), static_cast<Sample>(2),
                                              static_cast<Sample>(-2)};
  const std::array<Sample, sample_count> right{
      static_cast<Sample>(-0.5), static_cast<Sample>(0.5), static_cast<Sample>(1.5),
      static_cast<Sample>(-1.5), static_cast<Sample>(0),   static_cast<Sample>(3),
      static_cast<Sample>(-3)};
  const std::array inputs{left, right};
  for (const std::size_t channel_count : {std::size_t{1}, std::size_t{2}}) {
    auto outputs = inputs;
    for (std::size_t channel = 0; channel < channel_count; ++channel) {
      test.expect(process_block(std::span<const Sample>{inputs[channel]},
                                std::span<Sample>{outputs[channel]}),
                  "out-of-place channel saturation succeeds");
      for (std::size_t sample = 0; sample < sample_count; ++sample) {
        test.expect(near(outputs[channel][sample], processed_sample(inputs[channel][sample])),
                    "mono and stereo channels saturate independently");
      }

      const auto first_pass = outputs[channel];
      test.expect(process_block(std::span<const Sample>{outputs[channel]},
                                std::span<Sample>{outputs[channel]}),
                  "in-place channel saturation succeeds");
      for (std::size_t sample = 0; sample < sample_count; ++sample) {
        test.expect(near(outputs[channel][sample], processed_sample(first_pass[sample])),
                    "in-place saturation uses each original sample exactly once");
      }
    }
    test.expect(inputs[0] == left && inputs[1] == right, "out-of-place inputs remain unchanged");
    if (channel_count == 1) {
      test.expect(outputs[1] == right, "mono processing leaves the unused channel unchanged");
    }
  }
}

template <typename Sample> void test_span_boundaries(TestContext& test) {
  using garak::dsp::saturation::process_block;
  using garak::dsp::saturation::processed_sample;
  test.expect(process_block(std::span<const Sample>{}, std::span<Sample>{}),
              "a zero-sample block accepts empty storage");

  const std::array<Sample, 2> input{static_cast<Sample>(0.25), static_cast<Sample>(-0.5)};
  std::array<Sample, 4> output{static_cast<Sample>(3), static_cast<Sample>(4),
                               static_cast<Sample>(5), static_cast<Sample>(6)};
  const auto original = output;
  test.expect(!process_block(std::span<const Sample>{input}, std::span<Sample>{output}),
              "unequal span lengths are rejected");
  test.expect(output == original, "a rejected length mismatch never partially writes output");
  test.expect(!process_block(std::span<const Sample>{input}, std::span<Sample>{}),
              "nonempty input with empty output is rejected");
  test.expect(!process_block(std::span<const Sample>{}, std::span<Sample>{output}),
              "empty input with nonempty output is rejected");
  test.expect(output == original, "empty-input rejection leaves output unchanged");

  test.expect(
      process_block(std::span<const Sample>{input}, std::span<Sample>{output}.subspan(1, 2)),
      "an exact subspan processes only its declared samples");
  test.expect(output[0] == original[0] && output[3] == original[3],
              "block saturation does not write outside the output span");
  test.expect(near(output[1], processed_sample(input[0])) &&
                  near(output[2], processed_sample(input[1])),
              "subspan output has the exact Saturation transfer");

  std::array<Sample, 5> overlap{static_cast<Sample>(1), static_cast<Sample>(2),
                                static_cast<Sample>(3), static_cast<Sample>(4),
                                static_cast<Sample>(5)};
  const auto overlap_original = overlap;
  test.expect(!process_block(std::span<const Sample>{overlap}.first(4),
                             std::span<Sample>{overlap}.subspan(1, 4)),
              "forward partial overlap is rejected");
  test.expect(overlap == overlap_original,
              "forward partial-overlap rejection leaves storage unchanged");
  test.expect(!process_block(std::span<const Sample>{overlap}.subspan(1, 4),
                             std::span<Sample>{overlap}.first(4)),
              "backward partial overlap is rejected");
  test.expect(overlap == overlap_original,
              "backward partial-overlap rejection leaves storage unchanged");
}

} // namespace

int main() {
  TestContext test;
  test_scalar_contract<float>(test);
  test_scalar_contract<double>(test);
  test_channel_blocks<float>(test);
  test_channel_blocks<double>(test);
  test_span_boundaries<float>(test);
  test_span_boundaries<double>(test);
  return test.result();
}
