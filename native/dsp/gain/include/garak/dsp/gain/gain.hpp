#ifndef GARAK_DSP_GAIN_GAIN_HPP_INCLUDED
#define GARAK_DSP_GAIN_GAIN_HPP_INCLUDED

#include "garak/dsp/gain/automation.hpp"

#include <cmath>
#include <cstdint>
#include <limits>

namespace garak::dsp::gain {

inline constexpr double kMinimumDecibels = -60.0;
inline constexpr double kMaximumDecibels = 12.0;
inline constexpr double kDefaultDecibels = 0.0;

[[nodiscard]] double normalized_to_decibels(double normalized) noexcept;
[[nodiscard]] double decibels_to_normalized(double decibels) noexcept;
[[nodiscard]] double decibels_to_linear(double decibels) noexcept;
[[nodiscard]] double default_normalized_gain() noexcept;

template <typename Sample>
[[nodiscard]] Sample processed_sample(const Sample input, const double linear_gain) noexcept {
  if (!std::isfinite(input)) {
    return static_cast<Sample>(0);
  }

  const auto output = static_cast<Sample>(input * static_cast<Sample>(linear_gain));
  if (!std::isfinite(output)) {
    return static_cast<Sample>(0);
  }
  if (output != static_cast<Sample>(0) && std::abs(output) < std::numeric_limits<Sample>::min()) {
    return static_cast<Sample>(0);
  }
  return output;
}

template <typename Sample, typename GainSource, typename BypassSource>
struct ProcessBlockContext final {
  Sample* const* inputs;
  Sample* const* outputs;
  std::int32_t channel_count;
  std::int32_t sample_count;
  std::uint64_t input_silence_flags;
  std::uint64_t& output_silence_flags;
  GainSource& gain_source;
  BypassSource& bypass_source;
  double& current_gain_normalized;
  bool& current_bypass;
};

template <typename Sample, typename GainSource, typename BypassSource>
void process_block(const ProcessBlockContext<Sample, GainSource, BypassSource>& context) {
  AutomationTimeline gain_timeline(
      context.gain_source, AutomationBlock{context.sample_count, context.current_gain_normalized});
  AutomationTimeline bypass_timeline(
      context.bypass_source,
      AutomationBlock{context.sample_count, context.current_bypass ? 1.0 : 0.0});

  context.output_silence_flags = 0;
  for (std::int32_t channel = 0; channel < context.channel_count; ++channel) {
    if ((context.input_silence_flags & (std::uint64_t{1} << channel)) != 0) {
      context.output_silence_flags |= std::uint64_t{1} << channel;
    }
  }

  if (context.sample_count == 0) {
    gain_timeline.consume_zero_sample_flush();
    bypass_timeline.consume_zero_sample_flush();
    context.current_gain_normalized = gain_timeline.current_value();
    context.current_bypass = bypass_timeline.current_value() >= 0.5;
    return;
  }

  for (std::int32_t sample = 0; sample < context.sample_count; ++sample) {
    const auto gain_normalized = gain_timeline.value_at(sample, true);
    const auto bypass = bypass_timeline.value_at(sample, false) >= 0.5;
    const auto linear_gain = decibels_to_linear(normalized_to_decibels(gain_normalized));

    for (std::int32_t channel = 0; channel < context.channel_count; ++channel) {
      const auto silent = (context.input_silence_flags & (std::uint64_t{1} << channel)) != 0;
      if (silent) {
        context.outputs[channel][sample] = static_cast<Sample>(0);
      } else if (bypass) {
        if (context.outputs[channel] != context.inputs[channel]) {
          context.outputs[channel][sample] = context.inputs[channel][sample];
        }
      } else {
        context.outputs[channel][sample] =
            processed_sample(context.inputs[channel][sample], linear_gain);
      }
    }
  }

  context.current_gain_normalized = gain_timeline.current_value();
  context.current_bypass = bypass_timeline.current_value() >= 0.5;
}

} // namespace garak::dsp::gain

#endif
