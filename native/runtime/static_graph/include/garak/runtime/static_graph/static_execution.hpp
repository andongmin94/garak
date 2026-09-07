#ifndef GARAK_RUNTIME_STATIC_GRAPH_STATIC_EXECUTION_HPP_INCLUDED
#define GARAK_RUNTIME_STATIC_GRAPH_STATIC_EXECUTION_HPP_INCLUDED

#include "garak/dsp/gain/gain.hpp"
#include "garak/dsp/polarity/polarity.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>

namespace garak::runtime::static_graph {

inline constexpr std::uint16_t kNoBuffer = 0xffffU;
inline constexpr std::size_t kMaximumOperationCount = 4;

enum class OperationKind : std::uint8_t {
  audio_input = 1,
  gain = 2,
  audio_output = 3,
  polarity = 4,
};

using OperationType = std::uint16_t;

[[nodiscard]] constexpr OperationType operation_type_code(const OperationKind kind) noexcept {
  return static_cast<OperationType>(kind);
}

struct Operation final {
  std::uint32_t instance_id{};
  OperationType type{};
  std::uint16_t input_buffer{};
  std::uint16_t output_buffer{};
  std::uint32_t primary_parameter_id{};
  std::uint32_t secondary_parameter_id{};
};

struct StaticExecutionPlan final {
  std::array<Operation, kMaximumOperationCount> operations{};
  std::uint16_t operation_count{};
  std::uint16_t buffer_count{};
  std::uint32_t latency_samples{};
};

class StaticExecutionBinding final {
public:
  [[nodiscard]] constexpr std::uint32_t gain_parameter_id() const noexcept {
    return gain_parameter_id_;
  }
  [[nodiscard]] constexpr std::uint32_t bypass_parameter_id() const noexcept {
    return bypass_parameter_id_;
  }
  [[nodiscard]] constexpr bool has_polarity() const noexcept { return has_polarity_; }

  [[nodiscard]] friend constexpr bool operator==(const StaticExecutionBinding&,
                                                 const StaticExecutionBinding&) noexcept = default;

private:
  friend constexpr std::optional<StaticExecutionBinding>
  bind_static_execution_plan(const StaticExecutionPlan&, std::uint32_t, std::uint32_t) noexcept;

  constexpr StaticExecutionBinding(const std::uint32_t gain_parameter_id,
                                   const std::uint32_t bypass_parameter_id,
                                   const bool has_polarity) noexcept
      : gain_parameter_id_(gain_parameter_id), bypass_parameter_id_(bypass_parameter_id),
        has_polarity_(has_polarity) {}

  std::uint32_t gain_parameter_id_{};
  std::uint32_t bypass_parameter_id_{};
  bool has_polarity_{};
};

[[nodiscard]] constexpr StaticExecutionPlan
make_gain_only_execution_plan(const std::uint32_t gain_parameter_id,
                              const std::uint32_t bypass_parameter_id) noexcept {
  StaticExecutionPlan plan{};
  plan.operations[0] = {1, operation_type_code(OperationKind::audio_input), kNoBuffer, 0, 0, 0};
  plan.operations[1] = {2, operation_type_code(OperationKind::gain), 0, 1, gain_parameter_id,
                        bypass_parameter_id};
  plan.operations[2] = {3, operation_type_code(OperationKind::audio_output), 1, kNoBuffer, 0, 0};
  plan.operation_count = 3;
  plan.buffer_count = 2;
  return plan;
}

[[nodiscard]] constexpr StaticExecutionPlan
make_gain_polarity_execution_plan(const std::uint32_t gain_parameter_id,
                                  const std::uint32_t bypass_parameter_id) noexcept {
  StaticExecutionPlan plan{};
  plan.operations[0] = {1, operation_type_code(OperationKind::audio_input), kNoBuffer, 0, 0, 0};
  plan.operations[1] = {2, operation_type_code(OperationKind::gain), 0, 1, gain_parameter_id,
                        bypass_parameter_id};
  plan.operations[2] = {3, operation_type_code(OperationKind::polarity), 1, 2, 0, 0};
  plan.operations[3] = {4, operation_type_code(OperationKind::audio_output), 2, kNoBuffer, 0, 0};
  plan.operation_count = 4;
  plan.buffer_count = 3;
  return plan;
}

[[nodiscard]] constexpr bool operation_equal(const Operation& left, const Operation& right) noexcept {
  return left.instance_id == right.instance_id && left.type == right.type &&
         left.input_buffer == right.input_buffer && left.output_buffer == right.output_buffer &&
         left.primary_parameter_id == right.primary_parameter_id &&
         left.secondary_parameter_id == right.secondary_parameter_id;
}

[[nodiscard]] constexpr bool plan_equal(const StaticExecutionPlan& left,
                                        const StaticExecutionPlan& right) noexcept {
  if (left.operation_count != right.operation_count || left.buffer_count != right.buffer_count ||
      left.latency_samples != right.latency_samples) {
    return false;
  }
  for (std::size_t index = 0; index < kMaximumOperationCount; ++index) {
    if (!operation_equal(left.operations[index], right.operations[index])) {
      return false;
    }
  }
  return true;
}

[[nodiscard]] constexpr std::optional<StaticExecutionBinding>
bind_static_execution_plan(const StaticExecutionPlan& plan,
                           const std::uint32_t gain_parameter_id,
                           const std::uint32_t bypass_parameter_id) noexcept {
  if (plan.latency_samples != 0) {
    return std::nullopt;
  }
  if (plan_equal(plan, make_gain_only_execution_plan(gain_parameter_id, bypass_parameter_id))) {
    return StaticExecutionBinding{gain_parameter_id, bypass_parameter_id, false};
  }
  if (plan_equal(plan,
                 make_gain_polarity_execution_plan(gain_parameter_id, bypass_parameter_id))) {
    return StaticExecutionBinding{gain_parameter_id, bypass_parameter_id, true};
  }
  return std::nullopt;
}

template <typename Sample> class BoundActiveTransform final {
public:
  explicit constexpr BoundActiveTransform(const bool invert) noexcept : invert_(invert) {}

  [[nodiscard]] Sample operator()(const Sample sample) const noexcept {
    return invert_ ? garak::dsp::polarity::processed_sample(sample) : sample;
  }

private:
  bool invert_{};
};

template <typename Sample, typename GainSource, typename BypassSource>
void execute_static_binding(
    const StaticExecutionBinding& binding,
    const garak::dsp::gain::ProcessBlockContext<Sample, GainSource, BypassSource>& context) {
  garak::dsp::gain::process_block(context, BoundActiveTransform<Sample>{binding.has_polarity()});
}

} // namespace garak::runtime::static_graph

#endif
