#include "garak/dsp/saturation/saturation.hpp"

#include <cstddef>
#include <functional>

namespace garak::dsp::saturation {
namespace {

template <typename Sample>
[[nodiscard]] bool saturate_block(const std::span<const Sample> input,
                                  const std::span<Sample> output) noexcept {
  if (input.size() != output.size()) {
    return false;
  }
  if (input.empty()) {
    return true;
  }

  const auto* const input_begin = input.data();
  const auto* const input_end = input_begin + input.size();
  const auto* const output_begin = static_cast<const Sample*>(output.data());
  const auto* const output_end = output_begin + output.size();
  const bool same_buffer = input_begin == output_begin;
  const auto pointer_less_equal = std::less_equal<const Sample*>{};
  const bool disjoint =
      pointer_less_equal(input_end, output_begin) || pointer_less_equal(output_end, input_begin);
  if (!same_buffer && !disjoint) {
    return false;
  }

  for (std::size_t index = 0; index < input.size(); ++index) {
    output[index] = processed_sample(input[index]);
  }
  return true;
}

} // namespace

bool process_block(const std::span<const float> input, const std::span<float> output) noexcept {
  return saturate_block(input, output);
}

bool process_block(const std::span<const double> input, const std::span<double> output) noexcept {
  return saturate_block(input, output);
}

} // namespace garak::dsp::saturation
