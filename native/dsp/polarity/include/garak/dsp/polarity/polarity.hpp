#ifndef GARAK_DSP_POLARITY_POLARITY_HPP_INCLUDED
#define GARAK_DSP_POLARITY_POLARITY_HPP_INCLUDED

#include <span>

namespace garak::dsp::polarity {

// Implementation 1 is exact unary negation, with no parameter or persistent state.
// Signal sanitation and whole-product Bypass are the caller's responsibility.
[[nodiscard]] constexpr float processed_sample(const float input) noexcept { return -input; }
[[nodiscard]] constexpr double processed_sample(const double input) noexcept { return -input; }

// Spans must have equal lengths and must either be disjoint or refer to the same
// buffer. Partial overlap is not supported. A length mismatch returns false
// without writing output. Empty spans succeed without dereferencing storage.
[[nodiscard]] bool process_block(std::span<const float> input,
                                 std::span<float> output) noexcept;
[[nodiscard]] bool process_block(std::span<const double> input,
                                 std::span<double> output) noexcept;

} // namespace garak::dsp::polarity

#endif
