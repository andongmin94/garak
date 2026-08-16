#ifndef GARAK_RUNTIME_STATIC_GRAPH_GAIN_PLAN_HPP_INCLUDED
#define GARAK_RUNTIME_STATIC_GRAPH_GAIN_PLAN_HPP_INCLUDED

#include "garak/dsp/gain/gain.hpp"

#include <array>
#include <cstddef>
#include <cstdint>

namespace garak::runtime::static_graph {

inline constexpr std::uint16_t kNoBuffer = 0xffffU;

enum class OperationType : std::uint8_t {
  audio_input = 1,
  gain = 2,
  audio_output = 3,
};

struct Operation final {
  std::uint32_t instance_id{};
  OperationType type{};
  std::uint16_t input_buffer{};
  std::uint16_t output_buffer{};
  std::uint32_t primary_parameter_id{};
  std::uint32_t secondary_parameter_id{};
};

struct GainExecutionPlan final {
  std::array<Operation, 3> operations{};
  std::uint16_t buffer_count{};
  std::uint32_t latency_samples{};
};

[[nodiscard]] constexpr GainExecutionPlan
make_gain_execution_plan(const std::uint32_t gain_parameter_id,
                         const std::uint32_t bypass_parameter_id) noexcept {
  return GainExecutionPlan{{{{1, OperationType::audio_input, kNoBuffer, 0, 0, 0},
                             {2, OperationType::gain, 0, 1, gain_parameter_id, bypass_parameter_id},
                             {3, OperationType::audio_output, 1, kNoBuffer, 0, 0}}},
                           2,
                           0};
}

[[nodiscard]] constexpr bool
is_supported_gain_execution_plan(const GainExecutionPlan& plan,
                                 const std::uint32_t gain_parameter_id,
                                 const std::uint32_t bypass_parameter_id) noexcept {
  const auto expected = make_gain_execution_plan(gain_parameter_id, bypass_parameter_id);
  for (std::size_t index = 0; index < plan.operations.size(); ++index) {
    const auto& actual_operation = plan.operations[index];
    const auto& expected_operation = expected.operations[index];
    if (actual_operation.instance_id != expected_operation.instance_id ||
        actual_operation.type != expected_operation.type ||
        actual_operation.input_buffer != expected_operation.input_buffer ||
        actual_operation.output_buffer != expected_operation.output_buffer ||
        actual_operation.primary_parameter_id != expected_operation.primary_parameter_id ||
        actual_operation.secondary_parameter_id != expected_operation.secondary_parameter_id) {
      return false;
    }
  }
  return plan.buffer_count == expected.buffer_count &&
         plan.latency_samples == expected.latency_samples;
}

template <typename Sample, typename GainSource, typename BypassSource>
[[nodiscard]] bool execute_gain_plan(
    const GainExecutionPlan& plan, const std::uint32_t gain_parameter_id,
    const std::uint32_t bypass_parameter_id,
    const garak::dsp::gain::ProcessBlockContext<Sample, GainSource, BypassSource>& context) {
  if (!is_supported_gain_execution_plan(plan, gain_parameter_id, bypass_parameter_id)) {
    return false;
  }

  for (const auto& operation : plan.operations) {
    switch (operation.type) {
    case OperationType::audio_input:
    case OperationType::audio_output:
      break;
    case OperationType::gain:
      garak::dsp::gain::process_block(context);
      break;
    }
  }
  return true;
}

} // namespace garak::runtime::static_graph

#endif
