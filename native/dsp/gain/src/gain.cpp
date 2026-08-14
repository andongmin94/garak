#include "garak/dsp/gain/gain.hpp"

#include <algorithm>
#include <cmath>

namespace garak::dsp::gain {

double normalized_to_decibels(const double normalized) noexcept {
  return kMinimumDecibels + (kMaximumDecibels - kMinimumDecibels) * clamp_normalized(normalized);
}

double decibels_to_normalized(const double decibels) noexcept {
  if (!std::isfinite(decibels)) {
    return default_normalized_gain();
  }
  return clamp_normalized((decibels - kMinimumDecibels) / (kMaximumDecibels - kMinimumDecibels));
}

double decibels_to_linear(const double decibels) noexcept {
  if (!std::isfinite(decibels)) {
    return 1.0;
  }
  return std::pow(10.0, decibels / 20.0);
}

double default_normalized_gain() noexcept { return decibels_to_normalized(kDefaultDecibels); }

} // namespace garak::dsp::gain
