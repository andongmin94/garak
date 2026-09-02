#include "garak/runtime/static_graph/compiled_graph.hpp"
#include "garak/runtime/static_graph/gain_plan.hpp"

#include "garak/dsp/gain/gain.hpp"

#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <span>

namespace {

constexpr std::uint32_t kGainParameterId = 1001;
constexpr std::uint32_t kBypassParameterId = 1002;
constexpr std::array<std::uint8_t, garak::runtime::static_graph::kCompiledGraphTotalBytes>
    kCompiledGraphFixture{
        0x47U, 0x41U, 0x52U, 0x41U, 0x4BU, 0x47U, 0x52U, 0x46U, 0x01U, 0x00U, 0x00U, 0x00U,
        0x20U, 0x00U, 0x00U, 0x00U, 0x5CU, 0x00U, 0x00U, 0x00U, 0x03U, 0x00U, 0x02U, 0x00U,
        0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x01U, 0x00U, 0x00U, 0x00U,
        0x01U, 0x00U, 0x00U, 0x00U, 0xFFU, 0xFFU, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U,
        0x00U, 0x00U, 0x00U, 0x00U, 0x02U, 0x00U, 0x00U, 0x00U, 0x02U, 0x00U, 0x00U, 0x00U,
        0x00U, 0x00U, 0x01U, 0x00U, 0xE9U, 0x03U, 0x00U, 0x00U, 0xEAU, 0x03U, 0x00U, 0x00U,
        0x03U, 0x00U, 0x00U, 0x00U, 0x03U, 0x00U, 0x00U, 0x00U, 0x01U, 0x00U, 0xFFU, 0xFFU,
        0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U};

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

[[nodiscard]] bool test_canonical_plan_binding() {
  constexpr auto plan =
      garak::runtime::static_graph::make_gain_execution_plan(kGainParameterId, kBypassParameterId);
  constexpr auto binding = garak::runtime::static_graph::bind_gain_execution_plan(
      plan, kGainParameterId, kBypassParameterId);
  static_assert(binding.has_value());
  static_assert(binding->input_buffer() == 0);
  static_assert(binding->output_buffer() == 1);
  static_assert(binding->gain_parameter_id() == kGainParameterId);
  static_assert(binding->bypass_parameter_id() == kBypassParameterId);

  auto invalid_parameter = plan;
  invalid_parameter.operations[1].primary_parameter_id = 9999;
  if (garak::runtime::static_graph::bind_gain_execution_plan(invalid_parameter, kGainParameterId,
                                                             kBypassParameterId)) {
    return false;
  }

  auto invalid_buffer = plan;
  invalid_buffer.operations[1].output_buffer = 0;
  if (garak::runtime::static_graph::bind_gain_execution_plan(invalid_buffer, kGainParameterId,
                                                             kBypassParameterId)) {
    return false;
  }

  auto invalid_endpoint = plan;
  invalid_endpoint.operations[0].input_buffer = 0;
  if (garak::runtime::static_graph::bind_gain_execution_plan(invalid_endpoint, kGainParameterId,
                                                             kBypassParameterId)) {
    return false;
  }

  auto invalid_instance = plan;
  invalid_instance.operations[2].instance_id = invalid_instance.operations[1].instance_id;
  if (garak::runtime::static_graph::bind_gain_execution_plan(invalid_instance, kGainParameterId,
                                                             kBypassParameterId)) {
    return false;
  }

  auto invalid_order = plan;
  const auto first = invalid_order.operations[0];
  invalid_order.operations[0] = invalid_order.operations[1];
  invalid_order.operations[1] = first;
  if (garak::runtime::static_graph::bind_gain_execution_plan(invalid_order, kGainParameterId,
                                                             kBypassParameterId)) {
    return false;
  }

  auto invalid_latency = plan;
  invalid_latency.latency_samples = 1;
  if (garak::runtime::static_graph::bind_gain_execution_plan(invalid_latency, kGainParameterId,
                                                             kBypassParameterId)) {
    return false;
  }

  auto invalid_buffer_count = plan;
  invalid_buffer_count.buffer_count = 1;
  if (garak::runtime::static_graph::bind_gain_execution_plan(invalid_buffer_count, kGainParameterId,
                                                             kBypassParameterId)) {
    return false;
  }

  auto invalid_type = plan;
  invalid_type.operations[0].type =
      static_cast<garak::runtime::static_graph::OperationType>(0x0101U);
  return !garak::runtime::static_graph::bind_gain_execution_plan(invalid_type, kGainParameterId,
                                                                 kBypassParameterId);
}

[[nodiscard]] bool test_compiled_graph_fixture() {
  const auto binding = garak::runtime::static_graph::parse_compiled_gain_graph(
      kCompiledGraphFixture, kGainParameterId, kBypassParameterId);
  if (!binding || binding->input_buffer() != 0 || binding->output_buffer() != 1 ||
      binding->gain_parameter_id() != kGainParameterId ||
      binding->bypass_parameter_id() != kBypassParameterId) {
    return false;
  }

  const auto truncated =
      std::span<const std::uint8_t>(kCompiledGraphFixture).first(kCompiledGraphFixture.size() - 1);
  if (garak::runtime::static_graph::parse_compiled_gain_graph(truncated, kGainParameterId,
                                                              kBypassParameterId)) {
    return false;
  }

  auto future = kCompiledGraphFixture;
  future[8] = 2;
  if (garak::runtime::static_graph::parse_compiled_gain_graph(future, kGainParameterId,
                                                              kBypassParameterId)) {
    return false;
  }

  auto reserved = kCompiledGraphFixture;
  reserved[28] = 1;
  if (garak::runtime::static_graph::parse_compiled_gain_graph(reserved, kGainParameterId,
                                                              kBypassParameterId)) {
    return false;
  }

  auto unknown_wide_type = kCompiledGraphFixture;
  unknown_wide_type[36] = 0x01U;
  unknown_wide_type[37] = 0x01U;
  if (garak::runtime::static_graph::parse_compiled_gain_graph(unknown_wide_type, kGainParameterId,
                                                              kBypassParameterId)) {
    return false;
  }

  auto noncanonical = kCompiledGraphFixture;
  noncanonical[64] = 0x0FU;
  noncanonical[65] = 0x27U;
  return !garak::runtime::static_graph::parse_compiled_gain_graph(
      noncanonical, kGainParameterId, kBypassParameterId);
}

[[nodiscard]] bool test_execution() {
  constexpr auto plan =
      garak::runtime::static_graph::make_gain_execution_plan(kGainParameterId, kBypassParameterId);
  constexpr auto binding = garak::runtime::static_graph::bind_gain_execution_plan(
      plan, kGainParameterId, kBypassParameterId);
  static_assert(binding.has_value());

  std::array<float, 2> input{1.0F, -0.5F};
  std::array<float, 2> output{};
  std::array<float*, 1> input_channels{input.data()};
  std::array<float*, 1> output_channels{output.data()};
  std::uint64_t output_silence_flags = 0;
  EmptyPointSource gain_source;
  EmptyPointSource bypass_source;
  auto current_gain = garak::dsp::gain::decibels_to_normalized(-6.0);
  bool current_bypass = false;

  garak::runtime::static_graph::execute_gain_binding(
      *binding,
      garak::dsp::gain::ProcessBlockContext<float, EmptyPointSource, EmptyPointSource>{
          input_channels.data(), output_channels.data(), 1, 2, 0, output_silence_flags, gain_source,
          bypass_source, current_gain, current_bypass});
  const auto linear_gain = static_cast<float>(garak::dsp::gain::decibels_to_linear(-6.0));
  return output_silence_flags == 0 && almost_equal(output[0], input[0] * linear_gain) &&
         almost_equal(output[1], input[1] * linear_gain) && !current_bypass;
}

} // namespace

int main() {
  if (!test_canonical_plan_binding()) {
    std::fputs("Static graph binding validation failed\n", stderr);
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
