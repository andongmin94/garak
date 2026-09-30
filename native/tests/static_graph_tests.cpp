#include "garak/runtime/static_graph/compatibility.hpp"
#include "garak/runtime/static_graph/compiled_graph.hpp"
#include "garak/runtime/static_graph/static_execution.hpp"

#include "compiled_graph_test_fixture.hpp"

#include "garak/dsp/gain/gain.hpp"

#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <limits>
#include <optional>
#include <span>
#include <type_traits>

namespace {

constexpr std::uint32_t kGainParameterId = 1001;
constexpr std::uint32_t kBypassParameterId = 1002;
using StaticExecutionBinding = garak::runtime::static_graph::StaticExecutionBinding;
using StaticExecutionParameterIds = garak::runtime::static_graph::StaticExecutionParameterIds;
using PostGainTransform = garak::runtime::static_graph::PostGainTransform;
using StaticExecutionPlan = garak::runtime::static_graph::StaticExecutionPlan;
constexpr StaticExecutionParameterIds kParameterIds{kGainParameterId, kBypassParameterId};

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

[[nodiscard]] constexpr bool plan_binds(const StaticExecutionPlan& plan) noexcept {
  return garak::runtime::static_graph::bind_static_execution_plan(plan, kGainParameterId,
                                                                  kBypassParameterId)
      .has_value();
}

template <PostGainTransform Transform>
[[nodiscard]] constexpr auto make_test_execution_binding() noexcept {
  if constexpr (Transform == PostGainTransform::polarity) {
    return StaticExecutionBinding::gain_polarity(kParameterIds);
  }
  if constexpr (Transform == PostGainTransform::saturation) {
    return StaticExecutionBinding::gain_saturation(kParameterIds);
  }
  return StaticExecutionBinding::gain_only(kParameterIds);
}

[[nodiscard]] bool test_plan_binding() {
  constexpr auto gain = garak::runtime::static_graph::make_gain_only_execution_plan(
      kGainParameterId, kBypassParameterId);
  constexpr auto polarity = garak::runtime::static_graph::make_gain_polarity_execution_plan(
      kGainParameterId, kBypassParameterId);
  static_assert(plan_binds(gain));
  static_assert(plan_binds(polarity));
  constexpr auto saturation = garak::runtime::static_graph::make_gain_saturation_execution_plan(
      kGainParameterId, kBypassParameterId);
  static_assert(plan_binds(saturation));
  constexpr auto saturation_binding = StaticExecutionBinding::gain_saturation(kParameterIds);
  static_assert(saturation_binding.post_gain_transform() == PostGainTransform::saturation);
  constexpr auto gain_binding = StaticExecutionBinding::gain_only(kParameterIds);
  constexpr auto polarity_binding = StaticExecutionBinding::gain_polarity(kParameterIds);
  static_assert(gain_binding.post_gain_transform() == PostGainTransform::identity);
  static_assert(polarity_binding.post_gain_transform() == PostGainTransform::polarity);
  static_assert(gain_binding.gain_parameter_id() == kGainParameterId);
  static_assert(gain_binding.bypass_parameter_id() == kBypassParameterId);

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
  auto invalid_saturation_parameter = saturation;
  invalid_saturation_parameter.operations[2].primary_parameter_id = kGainParameterId;
  if (plan_binds(invalid_saturation_parameter)) {
    return false;
  }
  auto invalid_saturation_order = saturation;
  invalid_saturation_order.operations[1] = saturation.operations[2];
  invalid_saturation_order.operations[2] = saturation.operations[1];
  if (plan_binds(invalid_saturation_order)) {
    return false;
  }
  auto combined_transforms = polarity;
  combined_transforms.operations[3].type = garak::runtime::static_graph::operation_type_code(
      garak::runtime::static_graph::OperationKind::saturation);
  if (plan_binds(combined_transforms)) {
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
  const auto saturation = parse_compiled_static_graph(garak::test::kCompiledSaturationGraphFixture,
                                                      kGainParameterId, kBypassParameterId);
  if (!gain || gain->post_gain_transform() != PostGainTransform::identity || !polarity ||
      polarity->post_gain_transform() != PostGainTransform::polarity || !saturation ||
      saturation->post_gain_transform() != PostGainTransform::saturation) {
    return false;
  }

  const auto truncated = std::span<const std::uint8_t>(garak::test::kCompiledGainGraphFixture)
                             .first(garak::test::kCompiledGainGraphFixture.size() - 1);
  if (parse_compiled_static_graph(truncated, kGainParameterId, kBypassParameterId)) {
    return false;
  }
  auto future = garak::test::kCompiledGainGraphFixture;
  future[10] = 3;
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
      current.version.major != 1 || current.version.minor != 2 || !current.binding ||
      current.binding->post_gain_transform() != PostGainTransform::polarity) {
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

  old[10] = 1;
  const auto old_minor_report = classify_compiled_graph_compatibility(
      std::optional<std::span<const std::uint8_t>>(old), kGainParameterId, kBypassParameterId);
  if (old_minor_report.disposition != CompiledGraphDisposition::rebuild_from_project ||
      old_minor_report.diagnostic != CompiledGraphDiagnostic::unsupported_old ||
      old_minor_report.version.minor != 1 || old_minor_report.binding) {
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

template <PostGainTransform Transform> [[nodiscard]] bool test_execution() {
  constexpr auto execution_binding = make_test_execution_binding<Transform>();

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
  const auto expected = [](const float sample) {
    if constexpr (Transform == PostGainTransform::saturation) {
      return std::tanh(sample);
    } else {
      return Transform == PostGainTransform::polarity ? -sample : sample;
    }
  };
  if (!almost_equal(output[0], expected(input[0] * linear)) ||
      !almost_equal(output[1], expected(input[1] * linear))) {
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

class PointsSource final {
public:
  explicit PointsSource(const std::span<const garak::dsp::gain::AutomationPoint> points) noexcept
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

template <typename Sample> [[nodiscard]] bool test_saturation_sample_accurate_bypass() {
  constexpr auto binding = StaticExecutionBinding::gain_saturation(kParameterIds);
  constexpr std::array<garak::dsp::gain::AutomationPoint, 4> bypass_points{
      {{0, 0.0}, {2, 1.0}, {4, 0.0}, {6, 1.0}}};
  constexpr std::size_t sample_count = 8;
  constexpr std::array<Sample, sample_count> original{
      static_cast<Sample>(4),  static_cast<Sample>(-4),   static_cast<Sample>(2),
      static_cast<Sample>(-2), static_cast<Sample>(0.25), static_cast<Sample>(-0.25),
      static_cast<Sample>(0),  static_cast<Sample>(-0.0)};
  const auto normalized_gain = garak::dsp::gain::decibels_to_normalized(6.0);
  const auto linear_gain = garak::dsp::gain::decibels_to_linear(6.0);
  const auto tolerance = std::is_same_v<Sample, float> ? 1.0e-6 : 1.0e-12;
  for (const bool in_place : {false, true}) {
    for (const std::int32_t channel_count : {1, 2}) {
      std::array<std::array<Sample, sample_count>, 2> inputs{original, original};
      std::array<std::array<Sample, sample_count>, 2> outputs{};
      std::array<Sample*, 2> input_channels{inputs[0].data(), inputs[1].data()};
      std::array<Sample*, 2> output_channels{in_place ? inputs[0].data() : outputs[0].data(),
                                             in_place ? inputs[1].data() : outputs[1].data()};
      std::uint64_t output_silence_flags = 0;
      PointSource gain_source(normalized_gain);
      PointsSource bypass_source(bypass_points);
      auto current_gain = garak::dsp::gain::default_normalized_gain();
      bool current_bypass = true;
      garak::runtime::static_graph::execute_static_binding(
          binding, garak::dsp::gain::ProcessBlockContext<Sample, PointSource, PointsSource>{
                       input_channels.data(), output_channels.data(), channel_count,
                       static_cast<std::int32_t>(sample_count), 0, output_silence_flags,
                       gain_source, bypass_source, current_gain, current_bypass});
      for (std::int32_t channel = 0; channel < channel_count; ++channel) {
        for (std::size_t index = 0; index < sample_count; ++index) {
          const auto actual = output_channels[static_cast<std::size_t>(channel)][index];
          const auto dry = original[index];
          const bool bypass = index == 2 || index == 3 || index >= 6;
          const auto expected =
              bypass ? dry : std::tanh(static_cast<Sample>(dry * static_cast<Sample>(linear_gain)));
          if ((bypass && (actual != dry || std::signbit(actual) != std::signbit(dry))) ||
              (!bypass && std::abs(actual - expected) > tolerance)) {
            return false;
          }
        }
      }
      if (!current_bypass || current_gain != normalized_gain || output_silence_flags != 0) {
        return false;
      }
    }
  }

  // A silent channel skips input sanitation and Saturation. Active non-finite
  // samples are sanitized by Gain before the fixed nonlinear transfer.
  std::array<Sample, 3> unsafe_input{std::numeric_limits<Sample>::quiet_NaN(),
                                     std::numeric_limits<Sample>::infinity(),
                                     std::numeric_limits<Sample>::denorm_min()};
  std::array<Sample, 3> output{};
  std::array<Sample*, 2> inputs{unsafe_input.data(), unsafe_input.data()};
  std::array<Sample*, 2> outputs{output.data(), output.data()};
  PointSource gain_source(normalized_gain);
  PointSource bypass_source(0.0);
  auto current_gain = normalized_gain;
  bool current_bypass = false;
  std::uint64_t output_silence_flags = 0;
  garak::runtime::static_graph::execute_static_binding(
      binding, garak::dsp::gain::ProcessBlockContext<Sample, PointSource, PointSource>{
                   inputs.data(), outputs.data(), 1, 3, 0, output_silence_flags, gain_source,
                   bypass_source, current_gain, current_bypass});
  if (output != std::array<Sample, 3>{}) {
    return false;
  }
  output.fill(static_cast<Sample>(1));
  garak::runtime::static_graph::execute_static_binding(
      binding, garak::dsp::gain::ProcessBlockContext<Sample, PointSource, PointSource>{
                   inputs.data(), outputs.data(), 1, 3, 1, output_silence_flags, gain_source,
                   bypass_source, current_gain, current_bypass});
  if (output != std::array<Sample, 3>{} || output_silence_flags != 1) {
    return false;
  }
  PointSource bypass_on(1.0);
  garak::runtime::static_graph::execute_static_binding(
      binding, garak::dsp::gain::ProcessBlockContext<Sample, PointSource, PointSource>{
                   nullptr, nullptr, 0, 0, 0, output_silence_flags, gain_source, bypass_on,
                   current_gain, current_bypass});
  return current_bypass && current_gain == normalized_gain;
}

} // namespace

int main() {
  if (!test_plan_binding()) {
    std::fputs("Static graph plan/binding validation failed\n", stderr);
    return 1;
  }
  if (!test_compiled_graph_fixtures()) {
    std::fputs("Compiled graph 1.2 fixture validation failed\n", stderr);
    return 2;
  }
  if (!test_compiled_graph_compatibility()) {
    std::fputs("Compiled graph compatibility validation failed\n", stderr);
    return 3;
  }
  if (!test_execution<PostGainTransform::identity>() ||
      !test_execution<PostGainTransform::polarity>() ||
      !test_execution<PostGainTransform::saturation>()) {
    std::fputs("Static graph execution/bypass validation failed\n", stderr);
    return 4;
  }
  if (!test_saturation_sample_accurate_bypass<float>() ||
      !test_saturation_sample_accurate_bypass<double>()) {
    std::fputs("Saturation Float32/Float64 sample-accurate Bypass and boundaries failed\n", stderr);
    return 5;
  }
  return 0;
}
