#include "garak/runtime/static_graph/gain_plan.hpp"

#include "garak/dsp/gain/gain.hpp"
#include "garak/runtime/product_v1/compiled_product.hpp"

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

void record_allocation() noexcept {
  if (enabled) {
    ++allocations;
  }
}

void record_deallocation(void* const pointer) noexcept {
  if (enabled && pointer != nullptr) {
    ++deallocations;
  }
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

[[nodiscard]] void* allocate_aligned(const std::size_t size, const std::size_t alignment) {
#ifdef _MSC_VER
  return _aligned_malloc(size == 0 ? 1 : size, alignment);
#else
  const auto actual_size = size == 0 ? alignment : size;
  if (actual_size > std::numeric_limits<std::size_t>::max() - (alignment - 1)) {
    return nullptr;
  }
  const auto rounded_size = ((actual_size + alignment - 1) / alignment) * alignment;
  return std::aligned_alloc(alignment, rounded_size);
#endif
}

void free_aligned(void* const pointer) noexcept {
#ifdef _MSC_VER
  _aligned_free(pointer);
#else
  std::free(pointer);
#endif
}

} // namespace allocation_tracking

void* operator new(const std::size_t size) {
  allocation_tracking::record_allocation();
  if (auto* const pointer = std::malloc(size == 0 ? 1 : size)) {
    return pointer;
  }
  throw std::bad_alloc{};
}

void* operator new[](const std::size_t size) { return ::operator new(size); }

void operator delete(void* const pointer) noexcept {
  allocation_tracking::record_deallocation(pointer);
  std::free(pointer);
}

void operator delete[](void* const pointer) noexcept { ::operator delete(pointer); }

void operator delete(void* const pointer, std::size_t) noexcept { ::operator delete(pointer); }

void operator delete[](void* const pointer, std::size_t) noexcept { ::operator delete(pointer); }

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

void operator delete(void* const pointer, const std::nothrow_t&) noexcept {
  ::operator delete(pointer);
}

void operator delete[](void* const pointer, const std::nothrow_t&) noexcept {
  ::operator delete(pointer);
}

void* operator new(const std::size_t size, const std::align_val_t alignment) {
  allocation_tracking::record_allocation();
  if (auto* const pointer =
          allocation_tracking::allocate_aligned(size, static_cast<std::size_t>(alignment))) {
    return pointer;
  }
  throw std::bad_alloc{};
}

void* operator new[](const std::size_t size, const std::align_val_t alignment) {
  return ::operator new(size, alignment);
}

void operator delete(void* const pointer, std::align_val_t) noexcept {
  allocation_tracking::record_deallocation(pointer);
  allocation_tracking::free_aligned(pointer);
}

void operator delete[](void* const pointer, const std::align_val_t alignment) noexcept {
  ::operator delete(pointer, alignment);
}

void operator delete(void* const pointer, std::size_t, const std::align_val_t alignment) noexcept {
  ::operator delete(pointer, alignment);
}

void operator delete[](void* const pointer, std::size_t,
                       const std::align_val_t alignment) noexcept {
  ::operator delete(pointer, alignment);
}

namespace {

constexpr std::int32_t kMaximumSamples = 128;
constexpr std::uint32_t kBlockCount = 20'000;
constexpr std::uint32_t kGainParameterId = garak::runtime::product_v1::kGainParameterId;
constexpr std::uint32_t kBypassParameterId = garak::runtime::product_v1::kBypassParameterId;
constexpr auto kPlan =
    garak::runtime::static_graph::make_gain_execution_plan(kGainParameterId, kBypassParameterId);
static_assert(garak::runtime::static_graph::is_supported_gain_execution_plan(kPlan,
                                                                             kGainParameterId,
                                                                             kBypassParameterId));

class Generator final {
public:
  explicit Generator(const std::uint64_t seed) noexcept : state_(seed) {}

  [[nodiscard]] std::uint32_t next() noexcept {
    state_ = (state_ * 6'364'136'223'846'793'005ULL) + 1'442'695'040'888'963'407ULL;
    return static_cast<std::uint32_t>(state_ >> 32U);
  }

private:
  std::uint64_t state_;
};

class SinglePointSource final {
public:
  void set(const double value) noexcept { point_ = {0, value}; }

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

struct StressResult final {
  bool output_matches{};
  std::uint64_t processed_blocks{};
  std::uint64_t processed_samples{};
  allocation_tracking::Counts counts{};
};

template <typename Sample>
[[nodiscard]] bool nearly_equal(const Sample actual, const Sample expected) noexcept {
  if constexpr (std::is_same_v<Sample, float>) {
    return std::abs(actual - expected) <= 1.0e-5F;
  }
  return std::abs(actual - expected) <= 1.0e-12;
}

template <typename Sample>
[[nodiscard]] StressResult run_stress(const std::uint64_t seed) noexcept {
  std::array<std::array<Sample, kMaximumSamples>, 2> input{};
  std::array<std::array<Sample, kMaximumSamples>, 2> original{};
  std::array<std::array<Sample, kMaximumSamples>, 2> output{};
  std::array<Sample*, 2> input_channels{input[0].data(), input[1].data()};
  std::array<Sample*, 2> output_channels{};
  SinglePointSource gain_source;
  SinglePointSource bypass_source;
  Generator generator(seed);
  double current_gain = garak::dsp::gain::default_normalized_gain();
  bool current_bypass = false;
  StressResult result{true, 0, 0, {}};

  allocation_tracking::begin();
  for (std::uint32_t block = 0; block < kBlockCount && result.output_matches; ++block) {
    const auto sample_count = static_cast<std::int32_t>(generator.next() % (kMaximumSamples + 1U));
    const auto channel_count = static_cast<std::int32_t>((generator.next() % 2U) + 1U);
    const auto in_place = (generator.next() & 1U) != 0U;
    const auto gain_index = generator.next() % 5U;
    const auto target_gain = static_cast<double>(gain_index) * 0.25;
    const auto target_bypass = (generator.next() % 5U) == 0U;
    gain_source.set(target_gain);
    bypass_source.set(target_bypass ? 1.0 : 0.0);

    for (std::int32_t channel = 0; channel < channel_count; ++channel) {
      output_channels[static_cast<std::size_t>(channel)] =
          in_place ? input[static_cast<std::size_t>(channel)].data()
                   : output[static_cast<std::size_t>(channel)].data();
      for (std::int32_t sample = 0; sample < sample_count; ++sample) {
        const auto raw = static_cast<std::int32_t>(generator.next() % 2'001U) - 1'000;
        const auto value = static_cast<Sample>(static_cast<double>(raw) / 997.0);
        input[static_cast<std::size_t>(channel)][static_cast<std::size_t>(sample)] = value;
        original[static_cast<std::size_t>(channel)][static_cast<std::size_t>(sample)] = value;
        output[static_cast<std::size_t>(channel)][static_cast<std::size_t>(sample)] =
            std::numeric_limits<Sample>::quiet_NaN();
      }
    }

    std::uint64_t input_silence_flags = 0;
    for (std::int32_t channel = 0; channel < channel_count; ++channel) {
      if ((generator.next() % 11U) == 0U) {
        input_silence_flags |= std::uint64_t{1} << channel;
      }
    }
    std::uint64_t output_silence_flags = 0;
    garak::runtime::static_graph::execute_gain_plan(
        kPlan,
        garak::dsp::gain::ProcessBlockContext<Sample, SinglePointSource, SinglePointSource>{
            input_channels.data(), output_channels.data(), channel_count, sample_count,
            input_silence_flags, output_silence_flags, gain_source, bypass_source, current_gain,
            current_bypass});
    if (current_gain != target_gain || current_bypass != target_bypass ||
        output_silence_flags != input_silence_flags) {
      result.output_matches = false;
      break;
    }

    const auto linear_gain =
        garak::dsp::gain::decibels_to_linear(garak::dsp::gain::normalized_to_decibels(target_gain));
    for (std::int32_t channel = 0; channel < channel_count && result.output_matches; ++channel) {
      const auto silent = (input_silence_flags & (std::uint64_t{1} << channel)) != 0U;
      for (std::int32_t sample = 0; sample < sample_count; ++sample) {
        const auto source =
            original[static_cast<std::size_t>(channel)][static_cast<std::size_t>(sample)];
        const auto expected = silent ? static_cast<Sample>(0)
                                     : target_bypass
                                           ? source
                                           : static_cast<Sample>(
                                                 source * static_cast<Sample>(linear_gain));
        const auto actual =
            output_channels[static_cast<std::size_t>(channel)][static_cast<std::size_t>(sample)];
        if (!nearly_equal(actual, expected)) {
          result.output_matches = false;
          break;
        }
      }
    }
    ++result.processed_blocks;
    result.processed_samples +=
        static_cast<std::uint64_t>(sample_count) * static_cast<std::uint64_t>(channel_count);
  }
  result.counts = allocation_tracking::end();
  return result;
}

[[nodiscard]] bool report(const char* const label, const StressResult& result) noexcept {
  if (!result.output_matches) {
    std::fprintf(stderr, "%s realtime stress output/state mismatch after %llu blocks\n", label,
                 static_cast<unsigned long long>(result.processed_blocks));
    return false;
  }
  if (result.counts.allocations != 0 || result.counts.deallocations != 0) {
    std::fprintf(stderr, "%s realtime window allocated %llu and deallocated %llu times\n", label,
                 static_cast<unsigned long long>(result.counts.allocations),
                 static_cast<unsigned long long>(result.counts.deallocations));
    return false;
  }
  std::printf("%s realtime stress passed: %llu blocks, %llu channel-samples, allocation 0\n", label,
              static_cast<unsigned long long>(result.processed_blocks),
              static_cast<unsigned long long>(result.processed_samples));
  return true;
}

} // namespace

int main() {
  const auto float_result = run_stress<float>(0xB10C'F32A'1234'5678ULL);
  const auto double_result = run_stress<double>(0xB10C'F64A'8765'4321ULL);
  return report("Float32", float_result) && report("Float64", double_result) ? EXIT_SUCCESS
                                                                             : EXIT_FAILURE;
}
