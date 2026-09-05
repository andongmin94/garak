#include "garak/dsp/polarity/polarity.hpp"

#include <cstddef>

namespace garak::dsp::polarity {
namespace {

template <typename Sample>
[[nodiscard]] bool invert_block(const std::span<const Sample> input,
                                const std::span<Sample> output) noexcept {
  if (input.size() != output.size()) {
    return false;
  }
  for (std::size_t index = 0; index < input.size(); ++index) {
    output[index] = processed_sample(input[index]);
  }
  return true;
}

} // namespace

bool process_block(const std::span<const float> input, const std::span<float> output) noexcept {
  return invert_block(input, output);
}

bool process_block(const std::span<const double> input, const std::span<double> output) noexcept {
  return invert_block(input, output);
}

} // namespace garak::dsp::polarity
