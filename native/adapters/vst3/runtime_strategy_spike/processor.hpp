#ifndef GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_PROCESSOR_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_PROCESSOR_HPP_INCLUDED

#include "product_definition.hpp"

#include "public.sdk/source/vst/vstaudioeffect.h"

#include <atomic>
#include <cstdint>

namespace garak::adapter::vst3::runtime_strategy_spike {

class GainProcessor final : public Steinberg::Vst::AudioEffect {
public:
  GainProcessor(const ClassIdWords& controller_class_id, double default_gain_db) noexcept;

  static Steinberg::FUnknown* create_instance(void* context);

  Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
  Steinberg::tresult PLUGIN_API setBusArrangements(Steinberg::Vst::SpeakerArrangement* inputs,
                                                   Steinberg::int32 input_count,
                                                   Steinberg::Vst::SpeakerArrangement* outputs,
                                                   Steinberg::int32 output_count) override;
  Steinberg::tresult PLUGIN_API
  canProcessSampleSize(Steinberg::int32 symbolic_sample_size) override;
  Steinberg::tresult PLUGIN_API setProcessing(Steinberg::TBool state) override;
  Steinberg::tresult PLUGIN_API process(Steinberg::Vst::ProcessData& data) override;
  Steinberg::tresult PLUGIN_API setState(Steinberg::IBStream* state) override;
  Steinberg::tresult PLUGIN_API getState(Steinberg::IBStream* state) override;

private:
  void apply_pending_state() noexcept;
  void publish_processed_state(std::uint64_t processing_generation) noexcept;
  void write_snapshot_non_realtime(std::uint64_t packed_state) noexcept;
  [[nodiscard]] std::uint64_t read_snapshot_non_realtime() noexcept;

  static_assert(std::atomic<std::uint64_t>::is_always_lock_free);

  std::atomic<std::uint64_t> pending_state_{};
  std::atomic<std::uint64_t> pending_generation_{};
  std::atomic<std::uint64_t> snapshot_state_{};
  std::atomic<std::uint64_t> snapshot_sequence_{};
  std::uint64_t applied_generation_{};
  double current_gain_normalized_{};
  bool current_bypass_{};
};

} // namespace garak::adapter::vst3::runtime_strategy_spike

#endif
