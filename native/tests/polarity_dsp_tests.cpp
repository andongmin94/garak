#include "garak/dsp/polarity/polarity.hpp"

#include <array>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <initializer_list>
#include <limits>
#include <span>
#include <string_view>

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

template <typename Sample>
[[nodiscard]] bool same_value_and_sign(const Sample left, const Sample right) noexcept {
  return left == right && std::signbit(left) == std::signbit(right);
}

template <typename Sample> void test_scalar_contract(TestContext& test) {
  using garak::dsp::polarity::processed_sample;
  constexpr std::array inputs{static_cast<Sample>(0), -static_cast<Sample>(0),
                               static_cast<Sample>(1), static_cast<Sample>(-1),
                               static_cast<Sample>(0.25), static_cast<Sample>(-0.75),
                               std::numeric_limits<Sample>::denorm_min(),
                               std::numeric_limits<Sample>::min(),
                               std::numeric_limits<Sample>::max(),
                               std::numeric_limits<Sample>::lowest()};
  for (const auto input : inputs) {
    const auto output = processed_sample(input);
    test.expect(same_value_and_sign(output, -input), "Polarity v1 exactly negates finite samples");
    test.expect(same_value_and_sign(processed_sample(output), input),
                "two inversions restore the original value and zero sign");
  }
  const auto infinity = std::numeric_limits<Sample>::infinity();
  test.expect(processed_sample(infinity) == -infinity && processed_sample(-infinity) == infinity,
              "the pure inverter does not silently clamp infinities");
  test.expect(std::isnan(processed_sample(std::numeric_limits<Sample>::quiet_NaN())),
              "the pure inverter leaves signal sanitation to its caller");
}

template <typename Sample> void test_channel_blocks(TestContext& test) {
  using garak::dsp::polarity::process_block;
  constexpr std::size_t sample_count = 7;
  const std::array<Sample, sample_count> left{static_cast<Sample>(0), static_cast<Sample>(1),
                                            static_cast<Sample>(-1), static_cast<Sample>(0.5),
                                            static_cast<Sample>(-0.25), static_cast<Sample>(0.75),
                                            -static_cast<Sample>(0)};
  const std::array<Sample, sample_count> right{static_cast<Sample>(-0.5), static_cast<Sample>(0.25),
                                             static_cast<Sample>(0), static_cast<Sample>(-0.75),
                                             static_cast<Sample>(1), static_cast<Sample>(-1),
                                             static_cast<Sample>(0.125)};
  const std::array inputs{left, right};
  for (const std::size_t channel_count : {std::size_t{1}, std::size_t{2}}) {
    auto outputs = inputs;
    for (std::size_t channel = 0; channel < channel_count; ++channel) {
      test.expect(process_block(std::span<const Sample>{inputs[channel]},
                                std::span<Sample>{outputs[channel]}),
                  "out-of-place channel inversion succeeds");
      for (std::size_t sample = 0; sample < sample_count; ++sample) {
        test.expect(same_value_and_sign(outputs[channel][sample], -inputs[channel][sample]),
                    "mono and stereo channels invert independently");
      }
      test.expect(process_block(std::span<const Sample>{outputs[channel]},
                                std::span<Sample>{outputs[channel]}),
                  "in-place channel inversion succeeds");
      for (std::size_t sample = 0; sample < sample_count; ++sample) {
        test.expect(same_value_and_sign(outputs[channel][sample], inputs[channel][sample]),
                    "in-place inversion restores each original channel sample");
      }
    }
    test.expect(inputs[0] == left && inputs[1] == right, "out-of-place inputs remain unchanged");
    if (channel_count == 1) {
      test.expect(outputs[1] == right, "mono processing leaves the unused channel unchanged");
    }
  }
}

template <typename Sample> void test_span_boundaries(TestContext& test) {
  using garak::dsp::polarity::process_block;
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
  test.expect(process_block(std::span<const Sample>{input}, std::span<Sample>{output}.subspan(1, 2)),
              "an exact subspan processes only its declared samples");
  test.expect(output[0] == original[0] && output[3] == original[3],
              "block inversion does not write outside the output span");
  test.expect(output[1] == -input[0] && output[2] == -input[1],
              "subspan output has the exact expected polarity");
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
