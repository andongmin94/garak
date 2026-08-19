#include "garak/runtime/static_graph/compiled_graph.hpp"
#include "garak/runtime/static_graph/gain_plan.hpp"

#include "garak/dsp/gain/gain.hpp"

#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <span>

namespace {

constexpr std::array<std::uint8_t, garak::runtime::static_graph::kCompiledGraphTotalBytes>
    kCompiledGraphFixture{
        0x47U, 0x41U, 0x52U, 0x41U, 0x4BU, 0x47U, 0x52U, 0x46U, 0x01U, 0x00U, 0x00U,
        0x00U, 0x20U, 0x00U, 0x00U, 0x00U, 0x5CU, 0x00U, 0x00U, 0x00U, 0x03U, 0x00U,
        0x02U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x01U,
        0x00U, 0x00U, 0x00U, 0x01U, 0x00U, 0x00U, 0x00U, 0xFFU, 0xFFU, 0x00U, 0x00U,
        0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x02U, 0x00U, 0x00U,
        0x00U, 0x02U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x01U, 0x00U, 0xE9U, 0x03U,
        0x00U, 0x00U, 0xEAU, 0x03U, 0x00U, 0x00U, 0x03U, 0x00U, 0x00U, 0x00U, 0x03U,
        0x00U, 0x00U, 0x00U, 0x01U, 0x00U, 0xFFU, 0xFFU, 0x00U, 0x00U, 0x00U, 0x00U,
        0x00U, 0x00U, 0x00U, 0x00U};

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
  constexpr auto plan =
      garak::runtime::static_graph::make_gain_execution_plan(kGainParameterId, kBypassParameterId);
  static_assert(garak::runtime::static_graph::is_supported_gain_execution_plan(
      plan, kGainParameterId, kBypassParameterId));

  auto invalid = plan;
  invalid.operations[1].primary_parameter_id = 9999;
  return !garak::runtime::static_graph::is_supported_gain_execution_plan(invalid, kGainParameterId,
                                                                         kBypassParameterId);
}

[[nodiscard]] bool test_compiled_graph_fixture() {
  constexpr std::uint32_t kGainParameterId = 1001;
  constexpr std::uint32_t kBypassParameterId = 1002;
  const auto parsed = garak::runtime::static_graph::parse_compiled_gain_graph(
      kCompiledGraphFixture, kGainParameterId, kBypassParameterId);
  if (!parsed || !garak::runtime::static_graph::is_supported_gain_execution_plan(
                     *parsed, kGainParameterId, kBypassParameterId)) {
    return false;
  }

  const auto truncated = std::span<const std::uint8_t>(kCompiledGraphFixture).first(
      kCompiledGraphFixture.size() - 1);
  if (garak::runtime::static_graph::parse_compiled_gain_graph(
          truncated, kGainParameterId, kBypassParameterId)) {
    return false;
  }

  auto future = kCompiledGraphFixture;
  future[8] = 2;
  if (garak::runtime::static_graph::parse_compiled_gain_graph(
          future, kGainParameterId, kBypassParameterId)) {
    return false;
  }

  auto reserved = kCompiledGraphFixture;
  reserved[28] = 1;
  if (garak::runtime::static_graph::parse_compiled_gain_graph(
          reserved, kGainParameterId, kBypassParameterId)) {
    return false;
  }

  auto noncanonical = kCompiledGraphFixture;
  noncanonical[64] = 0x0FU;
  noncanonical[65] = 0x27U;
  return !garak::runtime::static_graph::parse_compiled_gain_graph(
      noncanonical, kGainParameterId, kBypassParameterId);
}

[[nodiscard]] bool test_execution() {
  constexpr std::uint32_t kGainParameterId = 1001;
  constexpr std::uint32_t kBypassParameterId = 1002;
  constexpr auto plan =
      garak::runtime::static_graph::make_gain_execution_plan(kGainParameterId, kBypassParameterId);

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
          input_channels.data(), output_channels.data(), 1, 2, 0, output_silence_flags, gain_source,
          bypass_source, current_gain, current_bypass});
  const auto linear_gain = static_cast<float>(garak::dsp::gain::decibels_to_linear(-6.0));
  return executed && output_silence_flags == 0 && almost_equal(output[0], input[0] * linear_gain) &&
         almost_equal(output[1], input[1] * linear_gain) && !current_bypass;
}

} // namespace

int main() {
  if (!test_canonical_plan()) {
    std::fputs("Static graph plan validation failed\n", stderr);
    return 1;
  }
  if (!test_compiled_graph_fixture()) {
    std::fputs("Compiled graph fixture validation failed\n", stderr);
    return 2;
  }
  if (!test_execution()) {
    std::fputs("Static graph execution failed\n", stderr);
    return 3;
  }
  return 0;
}
