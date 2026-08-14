#ifndef GARAK_DSP_GAIN_AUTOMATION_HPP_INCLUDED
#define GARAK_DSP_GAIN_AUTOMATION_HPP_INCLUDED

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>

namespace garak::dsp::gain {

struct AutomationPoint final {
  std::int32_t sample_offset;
  double normalized;
};

struct AutomationBlock final {
  std::int32_t sample_count;
  double initial_value;
};

[[nodiscard]] constexpr double clamp_normalized(const double value) noexcept {
  return std::clamp(value, 0.0, 1.0);
}

template <typename PointSource> class AutomationTimeline final {
public:
  AutomationTimeline(PointSource& source, const AutomationBlock block)
      : source_(source), sample_count_(block.sample_count),
        current_{-1, clamp_normalized(block.initial_value)} {
    valid_ = validate_source();
    if (valid_ && point_count_ > 0) {
      has_next_ = read_next_group(next_);
    }
  }

  [[nodiscard]] bool valid() const noexcept { return valid_; }

  [[nodiscard]] double value_at(const std::int32_t sample_offset, const bool interpolate) {
    while (has_next_ && next_.sample_offset <= sample_offset) {
      current_ = next_;
      has_next_ = read_next_group(next_);
    }

    if (!interpolate || !has_next_) {
      return current_.normalized;
    }

    const auto distance = next_.sample_offset - current_.sample_offset;
    if (distance <= 0) {
      return current_.normalized;
    }

    const auto progress =
        static_cast<double>(sample_offset - current_.sample_offset) / static_cast<double>(distance);
    return current_.normalized + (next_.normalized - current_.normalized) * progress;
  }

  void consume_zero_sample_flush() {
    if (sample_count_ != 0) {
      return;
    }
    while (has_next_) {
      current_ = next_;
      has_next_ = read_next_group(next_);
    }
  }

  [[nodiscard]] double current_value() const noexcept { return current_.normalized; }

private:
  [[nodiscard]] static constexpr std::int32_t
  maximum_point_count(const std::int32_t sample_count) noexcept {
    constexpr std::int32_t kMinimumPointCount = 2;
    constexpr std::int32_t kMaximumPointCount = std::numeric_limits<std::int32_t>::max();
    if (sample_count <= 1) {
      return kMinimumPointCount;
    }
    if (sample_count > kMaximumPointCount / 2) {
      return kMaximumPointCount;
    }
    return sample_count * 2;
  }

  [[nodiscard]] bool validate_source() {
    if (sample_count_ < 0) {
      return false;
    }

    point_count_ = source_.point_count();
    if (point_count_ < 0 || point_count_ > maximum_point_count(sample_count_)) {
      point_count_ = 0;
      return false;
    }

    std::int32_t previous_offset = -1;
    for (std::int32_t index = 0; index < point_count_; ++index) {
      AutomationPoint point{};
      if (!source_.point(index, point) || !std::isfinite(point.normalized)) {
        point_count_ = 0;
        return false;
      }

      const bool offset_is_valid =
          sample_count_ == 0 ? point.sample_offset == 0
                             : point.sample_offset >= 0 && point.sample_offset < sample_count_;
      if (!offset_is_valid || point.sample_offset < previous_offset) {
        point_count_ = 0;
        return false;
      }
      previous_offset = point.sample_offset;
    }
    return true;
  }

  [[nodiscard]] bool read_next_group(AutomationPoint& result) {
    if (next_index_ >= point_count_) {
      return false;
    }

    if (!source_.point(next_index_, result)) {
      return false;
    }
    result.normalized = clamp_normalized(result.normalized);
    ++next_index_;

    while (next_index_ < point_count_) {
      AutomationPoint candidate{};
      if (!source_.point(next_index_, candidate) ||
          candidate.sample_offset != result.sample_offset) {
        break;
      }
      result.normalized = clamp_normalized(candidate.normalized);
      ++next_index_;
    }
    return true;
  }

  PointSource& source_;
  std::int32_t sample_count_{};
  std::int32_t point_count_{};
  std::int32_t next_index_{};
  bool valid_{};
  bool has_next_{};
  AutomationPoint current_{};
  AutomationPoint next_{};
};

} // namespace garak::dsp::gain

#endif
