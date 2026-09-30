#include "garak/dsp/gain/gain.hpp"
#include "garak/runtime/static_graph/static_execution.hpp"

#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <new>
#include <type_traits>

#ifdef _MSC_VER
#include <malloc.h>
#endif

namespace allocation_tracking {
thread_local bool enabled = false;
thread_local std::uint64_t allocations = 0;
thread_local std::uint64_t deallocations = 0;
void allocation() noexcept {
  if (enabled)
    ++allocations;
}
void deallocation(void* pointer) noexcept {
  if (enabled && pointer != nullptr)
    ++deallocations;
}
void begin() noexcept {
  allocations = 0;
  deallocations = 0;
  enabled = true;
}
struct Counts final {
  std::uint64_t allocations{};
  std::uint64_t deallocations{};
};
[[nodiscard]] Counts end() noexcept {
  enabled = false;
  return {allocations, deallocations};
}
[[nodiscard]] void* aligned_allocate(std::size_t size, std::size_t alignment) {
#ifdef _MSC_VER
  return _aligned_malloc(size == 0 ? 1 : size, alignment);
#else
  const auto actual = size == 0 ? alignment : size;
  if (actual > std::numeric_limits<std::size_t>::max() - (alignment - 1))
    return nullptr;
  const auto rounded = ((actual + alignment - 1) / alignment) * alignment;
  return std::aligned_alloc(alignment, rounded);
#endif
}
void aligned_free(void* pointer) noexcept {
#ifdef _MSC_VER
  _aligned_free(pointer);
#else
  std::free(pointer);
#endif
}
} // namespace allocation_tracking

void* operator new(const std::size_t size) {
  allocation_tracking::allocation();
  if (auto* pointer = std::malloc(size == 0 ? 1 : size))
    return pointer;
  throw std::bad_alloc{};
}
void* operator new[](const std::size_t size) { return ::operator new(size); }
void operator delete(void* pointer) noexcept {
  allocation_tracking::deallocation(pointer);
  std::free(pointer);
}
void operator delete[](void* pointer) noexcept { ::operator delete(pointer); }
void operator delete(void* pointer, std::size_t) noexcept { ::operator delete(pointer); }
void operator delete[](void* pointer, std::size_t) noexcept { ::operator delete(pointer); }
void* operator new(const std::size_t size, const std::nothrow_t&) noexcept {
  try {
    return ::operator new(size);
  } catch (...) {
    return nullptr;
  }
}
void* operator new[](const std::size_t size, const std::nothrow_t&) noexcept {
  return ::operator new(size, std::nothrow);
}
void operator delete(void* pointer, const std::nothrow_t&) noexcept { ::operator delete(pointer); }
void operator delete[](void* pointer, const std::nothrow_t&) noexcept {
  ::operator delete(pointer);
}
void* operator new(const std::size_t size, const std::align_val_t alignment) {
  allocation_tracking::allocation();
  if (auto* pointer =
          allocation_tracking::aligned_allocate(size, static_cast<std::size_t>(alignment)))
    return pointer;
  throw std::bad_alloc{};
}
void* operator new[](const std::size_t size, const std::align_val_t alignment) {
  return ::operator new(size, alignment);
}
void operator delete(void* pointer, std::align_val_t) noexcept {
  allocation_tracking::deallocation(pointer);
  allocation_tracking::aligned_free(pointer);
}
void operator delete[](void* pointer, const std::align_val_t alignment) noexcept {
  ::operator delete(pointer, alignment);
}
void operator delete(void* pointer, std::size_t, const std::align_val_t alignment) noexcept {
  ::operator delete(pointer, alignment);
}
void operator delete[](void* pointer, std::size_t, const std::align_val_t alignment) noexcept {
  ::operator delete(pointer, alignment);
}

namespace {
constexpr std::int32_t kMaximumSamples = 128;
constexpr std::uint32_t kBlockCount = 20'000;
constexpr std::uint32_t kGainParameterId = 1001;
constexpr std::uint32_t kBypassParameterId = 1002;
using PostGainTransform = garak::runtime::static_graph::PostGainTransform;
using StaticExecutionBinding = garak::runtime::static_graph::StaticExecutionBinding;
using StaticExecutionParameterIds = garak::runtime::static_graph::StaticExecutionParameterIds;
constexpr StaticExecutionParameterIds kParameterIds{kGainParameterId, kBypassParameterId};

class PointSource final {
public:
  void set(const double value) noexcept {
    points_[0] = {0, value};
    count_ = 1;
  }
  void set_bypass(const bool bypass, const std::int32_t sample_count) noexcept {
    set(bypass ? 1.0 : 0.0);
    if (sample_count >= 3) {
      points_[1] = {sample_count / 3, bypass ? 0.0 : 1.0};
      points_[2] = {(sample_count * 2) / 3, bypass ? 1.0 : 0.0};
      count_ = 3;
    }
  }
  [[nodiscard]] std::int32_t point_count() const noexcept { return count_; }
  [[nodiscard]] bool point(const std::int32_t index,
                           garak::dsp::gain::AutomationPoint& point) const noexcept {
    if (index < 0 || index >= count_)
      return false;
    point = points_[static_cast<std::size_t>(index)];
    return true;
  }

private:
  std::array<garak::dsp::gain::AutomationPoint, 3> points_{};
  std::int32_t count_{1};
};

struct StressResult final {
  bool ok{};
  std::uint64_t blocks{};
  std::uint64_t samples{};
  allocation_tracking::Counts counts{};
};

template <PostGainTransform Transform>
[[nodiscard]] constexpr auto make_stress_execution_binding() noexcept {
  if constexpr (Transform == PostGainTransform::polarity) {
    return StaticExecutionBinding::gain_polarity(kParameterIds);
  } else if constexpr (Transform == PostGainTransform::saturation) {
    return StaticExecutionBinding::gain_saturation(kParameterIds);
  } else {
    return StaticExecutionBinding::gain_only(kParameterIds);
  }
}

template <typename Sample>
[[nodiscard]] bool near(const Sample actual, const Sample expected) noexcept {
  if constexpr (std::is_same_v<Sample, float>) {
    return std::abs(actual - expected) <= 1.0e-5F;
  } else {
    return std::abs(actual - expected) <= 1.0e-12;
  }
}

template <typename Sample, PostGainTransform Transform> [[nodiscard]] StressResult run() noexcept {
  constexpr auto execution_binding = make_stress_execution_binding<Transform>();

  std::array<std::array<Sample, kMaximumSamples>, 2> input{};
  std::array<std::array<Sample, kMaximumSamples>, 2> output{};
  std::array<Sample*, 2> inputs{input[0].data(), input[1].data()};
  std::array<Sample*, 2> outputs{output[0].data(), output[1].data()};
  PointSource gain_source;
  PointSource bypass_source;
  double current_gain = garak::dsp::gain::default_normalized_gain();
  bool current_bypass = false;
  StressResult result{true, 0, 0, {}};

  allocation_tracking::begin();
  for (std::uint32_t block = 0; block < kBlockCount && result.ok; ++block) {
    const auto sample_count = static_cast<std::int32_t>(block % (kMaximumSamples + 1));
    const auto channel_count = static_cast<std::int32_t>((block % 2U) + 1U);
    const auto gain_normalized = static_cast<double>(block % 5U) * 0.25;
    const bool bypass = (block % 7U) == 0U;
    gain_source.set(gain_normalized);
    bypass_source.set_bypass(bypass, sample_count);
    for (std::int32_t channel = 0; channel < channel_count; ++channel) {
      for (std::int32_t sample = 0; sample < sample_count; ++sample) {
        input[static_cast<std::size_t>(channel)][static_cast<std::size_t>(sample)] =
            static_cast<Sample>((static_cast<int>(block + sample + channel) % 65 - 32) / 32.0);
      }
    }
    std::uint64_t output_silence = 0;
    garak::runtime::static_graph::execute_static_binding(
        execution_binding,
        garak::dsp::gain::ProcessBlockContext<Sample, PointSource, PointSource>{
            inputs.data(), outputs.data(), channel_count, sample_count, 0, output_silence,
            gain_source, bypass_source, current_gain, current_bypass});
    const auto linear = garak::dsp::gain::decibels_to_linear(
        garak::dsp::gain::normalized_to_decibels(gain_normalized));
    for (std::int32_t channel = 0; channel < channel_count && result.ok; ++channel) {
      for (std::int32_t sample = 0; sample < sample_count; ++sample) {
        const auto source =
            input[static_cast<std::size_t>(channel)][static_cast<std::size_t>(sample)];
        const auto active = static_cast<Sample>(source * static_cast<Sample>(linear));
        const auto transformed =
            Transform == PostGainTransform::saturation
                ? std::tanh(active)
                : (Transform == PostGainTransform::polarity ? -active : active);
        const auto sample_bypass =
            sample_count >= 3 && sample >= sample_count / 3 && sample < (sample_count * 2) / 3
                ? !bypass
                : bypass;
        const auto expected = sample_bypass ? source : transformed;
        if (!near(output[static_cast<std::size_t>(channel)][static_cast<std::size_t>(sample)],
                  expected)) {
          result.ok = false;
          break;
        }
      }
    }
    result.ok = result.ok && current_gain == gain_normalized && current_bypass == bypass;
    ++result.blocks;
    result.samples +=
        static_cast<std::uint64_t>(sample_count) * static_cast<std::uint64_t>(channel_count);
  }
  result.counts = allocation_tracking::end();
  return result;
}

[[nodiscard]] bool report(const char* label, const StressResult& result) noexcept {
  if (!result.ok || result.counts.allocations != 0 || result.counts.deallocations != 0) {
    std::fprintf(stderr, "%s failed after %llu blocks; alloc=%llu free=%llu\n", label,
                 static_cast<unsigned long long>(result.blocks),
                 static_cast<unsigned long long>(result.counts.allocations),
                 static_cast<unsigned long long>(result.counts.deallocations));
    return false;
  }
  std::printf("%s passed: %llu blocks, %llu channel-samples, allocation 0, deallocation 0\n", label,
              static_cast<unsigned long long>(result.blocks),
              static_cast<unsigned long long>(result.samples));
  return true;
}
} // namespace

int main() {
  const bool a = report("Gain Float32", run<float, PostGainTransform::identity>());
  const bool b = report("Gain Float64", run<double, PostGainTransform::identity>());
  const bool c = report("Gain+Polarity Float32", run<float, PostGainTransform::polarity>());
  const bool d = report("Gain+Polarity Float64", run<double, PostGainTransform::polarity>());
  const bool e = report("Gain+Saturation Float32", run<float, PostGainTransform::saturation>());
  const bool f = report("Gain+Saturation Float64", run<double, PostGainTransform::saturation>());
  return a && b && c && d && e && f ? EXIT_SUCCESS : EXIT_FAILURE;
}
