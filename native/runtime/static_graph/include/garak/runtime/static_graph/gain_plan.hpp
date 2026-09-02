#ifndef GARAK_RUNTIME_STATIC_GRAPH_GAIN_PLAN_HPP_INCLUDED
#define GARAK_RUNTIME_STATIC_GRAPH_GAIN_PLAN_HPP_INCLUDED

#include "garak/dsp/gain/gain.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>

namespace garak::runtime::static_graph {

inline constexpr std::uint16_t kNoBuffer = 0xffffU;
inline constexpr std::uint16_t kGainExecutionBufferCount = 2;

enum class OperationType : std::uint8_t {
  audio_input = 1,
  gain = 2,
  audio_output = 3,
};

using OperationTypeCode = std::uint16_t;

[[nodiscard]] constexpr OperationTypeCode operation_type_code(const OperationType type) noexcept {
  return static_cast<OperationTypeCode>(type);
}

struct Operation final {
  std::uint32_t instance_id{};
  OperationTypeCode type_code{};
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

class GainExecutionBinding final {
public:
  [[nodiscard]] constexpr std::uint16_t input_buffer() const noexcept { return input_buffer_; }
  [[nodiscard]] constexpr std::uint16_t output_buffer() const noexcept { return output_buffer_; }
  [[nodiscard]] constexpr std::uint32_t gain_parameter_id() const noexcept {
    return gain_parameter_id_;
  }
  [[nodiscard]] constexpr std::uint32_t bypass_parameter_id() const noexcept {
    return bypass_parameter_id_;
  }

  [[nodiscard]] friend constexpr bool operator==(const GainExecutionBinding&,
                                                 const GainExecutionBinding&) noexcept = default;

private:
  friend constexpr std::optional<GainExecutionBinding>
  bind_gain_execution_plan(const GainExecutionPlan&, std::uint32_t, std::uint32_t) noexcept;

  explicit constexpr GainExecutionBinding(const Operation& gain) noexcept
      : input_buffer_(gain.input_buffer), output_buffer_(gain.output_buffer),
        gain_parameter_id_(gain.primary_parameter_id),
        bypass_parameter_id_(gain.secondary_parameter_id) {}

  std::uint16_t input_buffer_{};
  std::uint16_t output_buffer_{};
  std::uint32_t gain_parameter_id_{};
  std::uint32_t bypass_parameter_id_{};
};

[[nodiscard]] constexpr GainExecutionPlan
make_gain_execution_plan(const std::uint32_t gain_parameter_id,
                         const std::uint32_t bypass_parameter_id) noexcept {
  return GainExecutionPlan{{{{1, operation_type_code(OperationType::audio_input), kNoBuffer, 0, 0,
                              0},
                             {2, operation_type_code(OperationType::gain), 0, 1,
                              gain_parameter_id, bypass_parameter_id},
                             {3, operation_type_code(OperationType::audio_output), 1, kNoBuffer, 0,
                              0}}},
                           kGainExecutionBufferCount,
                           0};
}

[[nodiscard]] constexpr std::optional<GainExecutionBinding>
bind_gain_execution_plan(const GainExecutionPlan& plan, const std::uint32_t gain_parameter_id,
                         const std::uint32_t bypass_parameter_id) noexcept {
  const auto expected = make_gain_execution_plan(gain_parameter_id, bypass_parameter_id);
  if (plan.buffer_count != expected.buffer_count ||
      plan.latency_samples != expected.latency_samples) {
    return std::nullopt;
  }

  for (std::size_t index = 0; index < plan.operations.size(); ++index) {
    const auto& actual = plan.operations[index];
    const auto& wanted = expected.operations[index];
    if (actual.instance_id != wanted.instance_id || actual.type_code != wanted.type_code ||
        actual.input_buffer != wanted.input_buffer ||
        actual.output_buffer != wanted.output_buffer ||
        actual.primary_parameter_id != wanted.primary_parameter_id ||
        actual.secondary_parameter_id != wanted.secondary_parameter_id) {
      return std::nullopt;
    }
  }

  return GainExecutionBinding{plan.operations[1]};
}

template <typename Sample, typename GainSource, typename BypassSource>
void execute_gain_binding(
    const GainExecutionBinding& binding,
    const garak::dsp::gain::ProcessBlockContext<Sample, GainSource, BypassSource>& context) {
  std::array<Sample* const*, kGainExecutionBufferCount> buffers{};
  buffers[binding.input_buffer()] = context.inputs;
  buffers[binding.output_buffer()] = context.outputs;

  auto routed_context = context;
  routed_context.inputs = buffers[binding.input_buffer()];
  routed_context.outputs = buffers[binding.output_buffer()];
  garak::dsp::gain::process_block(routed_context);
}

} // namespace garak::runtime::static_graph

#endif
