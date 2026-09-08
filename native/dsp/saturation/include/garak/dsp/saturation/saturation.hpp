#ifndef GARAK_DSP_SATURATION_SATURATION_HPP_INCLUDED
#define GARAK_DSP_SATURATION_SATURATION_HPP_INCLUDED

#include <cmath>
#include <span>

namespace garak::dsp::saturation {

// Implementation 1 is fixed hyperbolic-tangent saturation, with no parameter or
// persistent state. Signal sanitation and whole-product Bypass are the caller's
// responsibility.
[[nodiscard]] inline float processed_sample(const float input) noexcept { return std::tanh(input); }
[[nodiscard]] inline double processed_sample(const double input) noexcept { return std::tanh(input); }

// Spans must have equal lengths and must either be disjoint or refer to the same
// buffer. Partial overlap returns false without writing output. A length mismatch
// also returns false without writing output. Empty spans succeed without dereferencing storage.
[[nodiscard]] bool process_block(std::span<const float> input, std::span<float> output) noexcept;
[[nodiscard]] bool process_block(std::span<const double> input, std::span<double> output) noexcept;

} // namespace garak::dsp::saturation

#endif
