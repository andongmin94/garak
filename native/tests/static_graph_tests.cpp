#include "garak/runtime/static_graph/compatibility.hpp"
#include "garak/runtime/static_graph/compiled_graph.hpp"
#include "garak/runtime/static_graph/static_execution.hpp"

#include "compiled_graph_test_fixture.hpp"

#include "garak/dsp/gain/gain.hpp"

#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <optional>
#include <span>

namespace {

constexpr std::uint32_t kGainParameterId = 1001;
constexpr std::uint32_t kBypassParameterId = 1002;

class PointSource final {
public:
  explicit PointSource(const double value) noexcept : point_{0, value} {}
  [[nodiscard]] std::int32_t point_count() const noexcept { return 1; }
  [[nodiscard]] bool point(const std::int32_t index,
                           garak::dsp::gain::AutomationPoint& point) const noexcept {
    if (index != 0) {
      return false;
    }
    point = point_;
    return true;
  }

private:
  garak::dsp::gain::AutomationPoint point_{};
};

[[nodiscard]] bool almost_equal(const float actual, const float expected) noexcept {
  return std::abs(actual - expected) < 1.0e-6F;
}

[[nodiscard]] bool test_plan_binding() {
  constexpr auto gain = garak::runtime::static_graph::make_gain_only_execution_plan(
      kGainParameterId, kBypassParameterId);
  constexpr auto polarity = garak::runtime::static_graph::make_gain_polarity_execution_plan(
      kGainParameterId, kBypassParameterId);
  constexpr auto gain_binding = garak::runtime::static_graph::bind_static_execution_plan(
      gain, kGainParameterId, kBypassParameterId);
  constexpr auto polarity_binding = garak::runtime::static_graph::bind_static_execution_plan(
      polarity, kGainParameterId, kBypassParameterId);
  static_assert(gain_binding.has_value() && !gain_binding->has_polarity());
  static_assert(polarity_binding.has_value() && polarity_binding->has_polarity());
  static_assert(gain_binding->gain_parameter_id() == kGainParameterId);
  static_assert(gain_binding->bypass_parameter_id() == kBypassParameterId);

  auto invalid_parameter = gain;
  invalid_parameter.operations[1].primary_parameter_id = 9999;
  if (garak::runtime::static_graph::bind_static_execution_plan(invalid_parameter, kGainParameterId,
                                                               kBypassParameterId)) {
    return false;
  }
  auto invalid_buffer = gain;
  invalid_buffer.operations[1].output_buffer = 0;
  if (garak::runtime::static_graph::bind_static_execution_plan(invalid_buffer, kGainParameterId,
                                                               kBypassParameterId)) {
    return false;
  }
  auto invalid_endpoint = gain;
  invalid_endpoint.operations[0].input_buffer = 0;
  if (garak::runtime::static_graph::bind_static_execution_plan(invalid_endpoint, kGainParameterId,
                                                               kBypassParameterId)) {
    return false;
  }
  auto invalid_instance = polarity;
  invalid_instance.operations[3].instance_id = invalid_instance.operations[2].instance_id;
  if (garak::runtime::static_graph::bind_static_execution_plan(invalid_instance, kGainParameterId,
                                                               kBypassParameterId)) {
    return false;
  }
  auto invalid_order = gain;
  const auto first = invalid_order.operations[0];
  invalid_order.operations[0] = invalid_order.operations[1];
  invalid_order.operations[1] = first;
  if (garak::runtime::static_graph::bind_static_execution_plan(invalid_order, kGainParameterId,
                                                               kBypassParameterId)) {
    return false;
  }
  auto invalid_latency = gain;
  invalid_latency.latency_samples = 1;
  if (garak::runtime::static_graph::bind_static_execution_plan(invalid_latency, kGainParameterId,
                                                               kBypassParameterId)) {
    return false;
  }
  auto invalid_count = gain;
  invalid_count.operation_count = 4;
  if (garak::runtime::static_graph::bind_static_execution_plan(invalid_count, kGainParameterId,
                                                               kBypassParameterId)) {
    return false;
  }
  auto invalid_buffer_count = polarity;
  invalid_buffer_count.buffer_count = 2;
  if (garak::runtime::static_graph::bind_static_execution_plan(
          invalid_buffer_count, kGainParameterId, kBypassParameterId)) {
    return false;
  }
  auto invalid_type = polarity;
  invalid_type.operations[2].type =
      static_cast<garak::runtime::static_graph::OperationType>(0x0101U);
  return !garak::runtime::static_graph::bind_static_execution_plan(invalid_type, kGainParameterId,
                                                                   kBypassParameterId);
}

[[nodiscard]] bool test_compiled_graph_fixtures() {
  using garak::runtime::static_graph::parse_compiled_static_graph;
  const auto gain = parse_compiled_static_graph(garak::test::kCompiledGainGraphFixture,
                                                kGainParameterId, kBypassParameterId);
  const auto polarity = parse_compiled_static_graph(garak::test::kCompiledPolarityGraphFixture,
                                                    kGainParameterId, kBypassParameterId);
  if (!gain || gain->has_polarity() || !polarity || !polarity->has_polarity()) {
    return false;
  }

  const auto truncated = std::span<const std::uint8_t>(garak::test::kCompiledGainGraphFixture)
                             .first(garak::test::kCompiledGainGraphFixture.size() - 1);
  if (parse_compiled_static_graph(truncated, kGainParameterId, kBypassParameterId)) {
    return false;
  }
  auto future = garak::test::kCompiledGainGraphFixture;
  future[10] = 2;
  if (parse_compiled_static_graph(future, kGainParameterId, kBypassParameterId)) {
    return false;
  }
  auto reserved = garak::test::kCompiledGainGraphFixture;
  reserved[28] = 1;
  if (parse_compiled_static_graph(reserved, kGainParameterId, kBypassParameterId)) {
    return false;
  }
  auto unknown_wide_type = garak::test::kCompiledPolarityGraphFixture;
  unknown_wide_type[76] = 0x01U;
  unknown_wide_type[77] = 0x01U;
  if (parse_compiled_static_graph(unknown_wide_type, kGainParameterId, kBypassParameterId)) {
    return false;
  }
  auto noncanonical = garak::test::kCompiledGainGraphFixture;
  noncanonical[64] = 0x0FU;
  noncanonical[65] = 0x27U;
  return !parse_compiled_static_graph(noncanonical, kGainParameterId, kBypassParameterId);
}

[[nodiscard]] bool test_compiled_graph_compatibility() {
  using garak::runtime::static_graph::classify_compiled_graph_compatibility;
  using garak::runtime::static_graph::CompiledGraphDiagnostic;
  using garak::runtime::static_graph::CompiledGraphDisposition;

  const auto current = classify_compiled_graph_compatibility(
      std::optional<std::span<const std::uint8_t>>(garak::test::kCompiledPolarityGraphFixture),
      kGainParameterId, kBypassParameterId);
  if (current.disposition != CompiledGraphDisposition::current ||
      current.diagnostic != CompiledGraphDiagnostic::none || !current.version.available ||
      current.version.major != 1 || current.version.minor != 1 || !current.binding ||
      !current.binding->has_polarity()) {
    return false;
  }

  const auto missing =
      classify_compiled_graph_compatibility(std::nullopt, kGainParameterId, kBypassParameterId);
  if (missing.disposition != CompiledGraphDisposition::rebuild_from_project ||
      missing.diagnostic != CompiledGraphDiagnostic::missing || missing.version.available ||
      missing.binding) {
    return false;
  }

  auto old = garak::test::kCompiledGainGraphFixture;
  old[10] = 0;
  const auto old_report = classify_compiled_graph_compatibility(
      std::optional<std::span<const std::uint8_t>>(old), kGainParameterId, kBypassParameterId);
  if (old_report.disposition != CompiledGraphDisposition::rebuild_from_project ||
      old_report.diagnostic != CompiledGraphDiagnostic::unsupported_old ||
      old_report.version.minor != 0 || old_report.binding) {
    return false;
  }

  auto future_major = garak::test::kCompiledGainGraphFixture;
  future_major[8] = 2;
  const auto future_major_report = classify_compiled_graph_compatibility(
      std::optional<std::span<const std::uint8_t>>(future_major), kGainParameterId,
      kBypassParameterId);
  if (future_major_report.disposition != CompiledGraphDisposition::reject_too_new ||
      future_major_report.diagnostic != CompiledGraphDiagnostic::too_new ||
      future_major_report.binding) {
    return false;
  }

  auto corrupt = garak::test::kCompiledGainGraphFixture;
  corrupt[28] = 1;
  const auto corrupt_report = classify_compiled_graph_compatibility(
      std::optional<std::span<const std::uint8_t>>(corrupt), kGainParameterId, kBypassParameterId);
  if (corrupt_report.disposition != CompiledGraphDisposition::reject_invalid ||
      corrupt_report.diagnostic != CompiledGraphDiagnostic::invalid_current ||
      corrupt_report.binding) {
    return false;
  }

  auto bad_magic = garak::test::kCompiledGainGraphFixture;
  bad_magic[0] = 0;
  const auto bad_magic_report =
      classify_compiled_graph_compatibility(std::optional<std::span<const std::uint8_t>>(bad_magic),
                                            kGainParameterId, kBypassParameterId);
  return bad_magic_report.disposition == CompiledGraphDisposition::reject_invalid &&
         bad_magic_report.diagnostic == CompiledGraphDiagnostic::invalid_magic &&
         !bad_magic_report.version.available && !bad_magic_report.binding;
}

template <bool Polarity> [[nodiscard]] bool test_execution() {
  constexpr auto plan = Polarity ? garak::runtime::static_graph::make_gain_polarity_execution_plan(
                                       kGainParameterId, kBypassParameterId)
                                 : garak::runtime::static_graph::make_gain_only_execution_plan(
                                       kGainParameterId, kBypassParameterId);
  constexpr auto binding = garak::runtime::static_graph::bind_static_execution_plan(
      plan, kGainParameterId, kBypassParameterId);
  static_assert(binding.has_value());
  if (!binding) {
    return false;
  }
  const auto execution_binding = binding.value();

  std::array<float, 3> input{1.0F, -0.5F, 0.25F};
  std::array<float, 3> output{};
  std::array<float*, 1> input_channels{input.data()};
  std::array<float*, 1> output_channels{output.data()};
  std::uint64_t output_silence_flags = 0;
  PointSource gain_source(garak::dsp::gain::decibels_to_normalized(-6.0));
  PointSource bypass_source(0.0);
  auto current_gain = garak::dsp::gain::default_normalized_gain();
  bool current_bypass = false;

  garak::runtime::static_graph::execute_static_binding(
      execution_binding,
      garak::dsp::gain::ProcessBlockContext<float, PointSource, PointSource>{
          input_channels.data(), output_channels.data(), 1, 3, 0, output_silence_flags, gain_source,
          bypass_source, current_gain, current_bypass});
  const auto linear = static_cast<float>(garak::dsp::gain::decibels_to_linear(-6.0));
  const auto sign = Polarity ? -1.0F : 1.0F;
  if (!almost_equal(output[0], input[0] * linear * sign) ||
      !almost_equal(output[1], input[1] * linear * sign)) {
    return false;
  }

  PointSource bypass_on(1.0);
  current_bypass = false;
  garak::runtime::static_graph::execute_static_binding(
      execution_binding,
      garak::dsp::gain::ProcessBlockContext<float, PointSource, PointSource>{
          input_channels.data(), output_channels.data(), 1, 3, 0, output_silence_flags, gain_source,
          bypass_on, current_gain, current_bypass});
  return output == input && current_bypass;
}

} // namespace

int main() {
  if (!test_plan_binding()) {
    std::fputs("Static graph plan/binding validation failed\n", stderr);
    return 1;
  }
  if (!test_compiled_graph_fixtures()) {
    std::fputs("Compiled graph 1.1 fixture validation failed\n", stderr);
    return 2;
  }
  if (!test_compiled_graph_compatibility()) {
    std::fputs("Compiled graph compatibility validation failed\n", stderr);
    return 3;
  }
  if (!test_execution<false>() || !test_execution<true>()) {
    std::fputs("Static graph execution/bypass validation failed\n", stderr);
    return 4;
  }
  return 0;
}
