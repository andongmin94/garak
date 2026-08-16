#include "garak/runtime/static_graph/gain_plan.hpp"

#include "garak/dsp/gain/gain.hpp"

#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>

namespace {

class EmptyPointSource final {
public:
  [[nodiscard]] std::int32_t point_count() const noexcept { return 0; }

  [[nodiscard]] bool point(std::int32_t, garak::dsp::gain::AutomationPoint&) const noexcept {
    return false;
  }
};

[[nodiscard]] bool almost_equal(const float actual, const float expected) noexcept {
  return std::abs(actual - expected) < 1.0e-6F;
}

[[nodiscard]] bool test_canonical_plan() {
  constexpr std::uint32_t kGainParameterId = 1001;
  constexpr std::uint32_t kBypassParameterId = 1002;
  constexpr auto plan = garak::runtime::static_graph::make_gain_execution_plan(
      kGainParameterId, kBypassParameterId);
  static_assert(garak::runtime::static_graph::is_supported_gain_execution_plan(
      plan, kGainParameterId, kBypassParameterId));

  auto invalid = plan;
  invalid.operations[1].primary_parameter_id = 9999;
  return !garak::runtime::static_graph::is_supported_gain_execution_plan(
      invalid, kGainParameterId, kBypassParameterId);
}

[[nodiscard]] bool test_execution() {
  constexpr std::uint32_t kGainParameterId = 1001;
  constexpr std::uint32_t kBypassParameterId = 1002;
  constexpr auto plan = garak::runtime::static_graph::make_gain_execution_plan(
      kGainParameterId, kBypassParameterId);

  std::array<float, 2> input{1.0F, -0.5F};
  std::array<float, 2> output{};
  std::array<float*, 1> input_channels{input.data()};
  std::array<float*, 1> output_channels{output.data()};
  std::uint64_t output_silence_flags = 0;
  EmptyPointSource gain_source;
  EmptyPointSource bypass_source;
  auto current_gain = garak::dsp::gain::decibels_to_normalized(-6.0);
  bool current_bypass = false;

  const auto executed = garak::runtime::static_graph::execute_gain_plan(
      plan, kGainParameterId, kBypassParameterId,
      garak::dsp::gain::ProcessBlockContext<float, EmptyPointSource, EmptyPointSource>{
          input_channels.data(), output_channels.data(), 1, 2, 0, output_silence_flags,
          gain_source, bypass_source, current_gain, current_bypass});
  const auto linear_gain = static_cast<float>(garak::dsp::gain::decibels_to_linear(-6.0));
  return executed && output_silence_flags == 0 &&
         almost_equal(output[0], input[0] * linear_gain) &&
         almost_equal(output[1], input[1] * linear_gain) && !current_bypass;
}

} // namespace

int main() {
  if (!test_canonical_plan()) {
    std::fputs("Static graph plan validation failed\n", stderr);
    return 1;
  }
  if (!test_execution()) {
    std::fputs("Static graph execution failed\n", stderr);
    return 2;
  }
  return 0;
}
