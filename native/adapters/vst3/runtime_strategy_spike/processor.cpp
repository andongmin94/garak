#include "processor.hpp"

#include "automation.hpp"
#include "gain_kernel.hpp"
#include "state_codec.hpp"
#include "state_stream.hpp"

#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "pluginterfaces/vst/vstspeaker.h"

#include <array>
#include <cstdint>
#include <type_traits>

namespace garak::adapter::vst3::runtime_strategy_spike {
namespace {

constexpr Steinberg::int32 kMaximumParameterQueueCount = 2;

class QueuePointSource final {
public:
  explicit QueuePointSource(Steinberg::Vst::IParamValueQueue* queue) noexcept : queue_(queue) {}

  [[nodiscard]] Steinberg::int32 point_count() const {
    return queue_ == nullptr ? 0 : queue_->getPointCount();
  }

  [[nodiscard]] bool point(const Steinberg::int32 index,
                           garak::spike::gain::AutomationPoint& point) const {
    if (queue_ == nullptr) {
      return false;
    }
    Steinberg::int32 sample_offset = 0;
    Steinberg::Vst::ParamValue value = 0.0;
    if (queue_->getPoint(index, sample_offset, value) != Steinberg::kResultTrue) {
      return false;
    }
    point = {sample_offset, value};
    return true;
  }

private:
  Steinberg::Vst::IParamValueQueue* queue_{};
};

struct ParameterQueues final {
  Steinberg::Vst::IParamValueQueue* gain{};
  Steinberg::Vst::IParamValueQueue* bypass{};
  bool duplicate_gain{};
  bool duplicate_bypass{};
};

[[nodiscard]] ParameterQueues
find_parameter_queues(Steinberg::Vst::IParameterChanges* const changes) {
  ParameterQueues result{};
  if (changes == nullptr) {
    return result;
  }
  const auto count = changes->getParameterCount();
  if (count < 0 || count > kMaximumParameterQueueCount) {
    return result;
  }
  for (Steinberg::int32 index = 0; index < count; ++index) {
    auto* const queue = changes->getParameterData(index);
    if (queue == nullptr) {
      continue;
    }
    if (queue->getParameterId() == kGainParameterId) {
      result.duplicate_gain = result.gain != nullptr;
      if (result.gain == nullptr) {
        result.gain = queue;
      }
    } else if (queue->getParameterId() == kBypassParameterId) {
      result.duplicate_bypass = result.bypass != nullptr;
      if (result.bypass == nullptr) {
        result.bypass = queue;
      }
    }
  }
  if (result.duplicate_gain) {
    result.gain = nullptr;
  }
  if (result.duplicate_bypass) {
    result.bypass = nullptr;
  }
  return result;
}

[[nodiscard]] bool supported_arrangement(const Steinberg::Vst::SpeakerArrangement arrangement) {
  return arrangement == Steinberg::Vst::SpeakerArr::kMono ||
         arrangement == Steinberg::Vst::SpeakerArr::kStereo;
}

template <typename Sample>
[[nodiscard]] Steinberg::tresult
process_audio(Steinberg::Vst::ProcessData& data, QueuePointSource& gain_source,
              QueuePointSource& bypass_source, double& current_gain, bool& current_bypass) {
  auto& input = data.inputs[0];
  auto& output = data.outputs[0];
  const auto channel_count = input.numChannels;
  std::array<Sample*, 2> input_channels{};
  std::array<Sample*, 2> output_channels{};
  if constexpr (std::is_same_v<Sample, Steinberg::Vst::Sample32>) {
    if (input.channelBuffers32 == nullptr || output.channelBuffers32 == nullptr) {
      return Steinberg::kInvalidArgument;
    }
  } else if (input.channelBuffers64 == nullptr || output.channelBuffers64 == nullptr) {
    return Steinberg::kInvalidArgument;
  }
  for (Steinberg::int32 channel = 0; channel < channel_count; ++channel) {
    if constexpr (std::is_same_v<Sample, Steinberg::Vst::Sample32>) {
      input_channels[channel] = input.channelBuffers32[channel];
      output_channels[channel] = output.channelBuffers32[channel];
    } else {
      input_channels[channel] = input.channelBuffers64[channel];
      output_channels[channel] = output.channelBuffers64[channel];
    }
    if (input_channels[channel] == nullptr || output_channels[channel] == nullptr) {
      return Steinberg::kInvalidArgument;
    }
  }

  std::uint64_t output_silence = 0;
  garak::spike::gain::process_block(
      garak::spike::gain::ProcessBlockContext<Sample, QueuePointSource, QueuePointSource>{
          input_channels.data(), output_channels.data(), channel_count, data.numSamples,
          input.silenceFlags, output_silence, gain_source, bypass_source, current_gain,
          current_bypass});
  output.silenceFlags = output_silence;
  return Steinberg::kResultTrue;
}

} // namespace

GainProcessor::GainProcessor(const ClassIdWords& controller_class_id,
                             const double default_gain_db) noexcept {
  const Steinberg::FUID controller_id(controller_class_id.words[0], controller_class_id.words[1],
                                      controller_class_id.words[2], controller_class_id.words[3]);
  setControllerClass(controller_id);
  const garak::spike::gain::SpikeState defaults{
      garak::spike::gain::decibels_to_normalized(default_gain_db), false};
  const auto packed = garak::spike::gain::pack_realtime_state(defaults);
  pending_state_.store(packed, std::memory_order_relaxed);
  snapshot_state_.store(packed, std::memory_order_relaxed);
  current_gain_normalized_ = defaults.gain_normalized;
}

Steinberg::FUnknown* GainProcessor::create_instance(void* const context) {
  try {
    const auto* const product = static_cast<const ProductDefinition*>(context);
    if (product == nullptr || !is_valid_product_definition(*product)) {
      return nullptr;
    }
    return static_cast<Steinberg::Vst::IAudioProcessor*>(
        new GainProcessor(product->controller_fuid, product->default_gain_db));
  } catch (...) {
    return nullptr;
  }
}

Steinberg::tresult PLUGIN_API GainProcessor::initialize(Steinberg::FUnknown* const context) {
  const auto result = AudioEffect::initialize(context);
  if (result != Steinberg::kResultTrue) {
    return result;
  }
  addAudioInput(STR16("Input"), Steinberg::Vst::SpeakerArr::kStereo);
  addAudioOutput(STR16("Output"), Steinberg::Vst::SpeakerArr::kStereo);
  return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API GainProcessor::setBusArrangements(
    Steinberg::Vst::SpeakerArrangement* const inputs, const Steinberg::int32 input_count,
    Steinberg::Vst::SpeakerArrangement* const outputs, const Steinberg::int32 output_count) {
  if (inputs == nullptr || outputs == nullptr || input_count != 1 || output_count != 1 ||
      inputs[0] != outputs[0] || !supported_arrangement(inputs[0])) {
    return Steinberg::kResultFalse;
  }
  getAudioInput(0)->setArrangement(inputs[0]);
  getAudioOutput(0)->setArrangement(outputs[0]);
  return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API
GainProcessor::canProcessSampleSize(const Steinberg::int32 symbolic_sample_size) {
  return symbolic_sample_size == Steinberg::Vst::kSample32 ||
                 symbolic_sample_size == Steinberg::Vst::kSample64
             ? Steinberg::kResultTrue
             : Steinberg::kResultFalse;
}

Steinberg::tresult PLUGIN_API GainProcessor::setProcessing(Steinberg::TBool) {
  return Steinberg::kResultTrue;
}

void GainProcessor::apply_pending_state() noexcept {
  const auto generation = pending_generation_.load(std::memory_order_acquire);
  if (generation == applied_generation_) {
    return;
  }
  const auto state =
      garak::spike::gain::unpack_realtime_state(pending_state_.load(std::memory_order_relaxed));
  current_gain_normalized_ = state.gain_normalized;
  current_bypass_ = state.bypass;
  applied_generation_ = generation;
}

void GainProcessor::publish_processed_state(const std::uint64_t processing_generation) noexcept {
  auto sequence = snapshot_sequence_.load(std::memory_order_relaxed);
  if ((sequence & 1U) != 0U ||
      !snapshot_sequence_.compare_exchange_strong(
          sequence, sequence + 1U, std::memory_order_acquire, std::memory_order_relaxed)) {
    return;
  }
  if (pending_generation_.load(std::memory_order_acquire) == processing_generation) {
    snapshot_state_.store(
        garak::spike::gain::pack_realtime_state({current_gain_normalized_, current_bypass_}),
        std::memory_order_relaxed);
  }
  snapshot_sequence_.store(sequence + 2U, std::memory_order_release);
}

void GainProcessor::write_snapshot_non_realtime(const std::uint64_t packed_state) noexcept {
  auto sequence = snapshot_sequence_.load(std::memory_order_acquire);
  for (;;) {
    if ((sequence & 1U) != 0U) {
      sequence = snapshot_sequence_.load(std::memory_order_acquire);
      continue;
    }
    if (snapshot_sequence_.compare_exchange_weak(sequence, sequence + 1U, std::memory_order_acquire,
                                                 std::memory_order_relaxed)) {
      break;
    }
  }
  snapshot_state_.store(packed_state, std::memory_order_relaxed);
  snapshot_sequence_.store(sequence + 2U, std::memory_order_release);
}

std::uint64_t GainProcessor::read_snapshot_non_realtime() noexcept {
  for (;;) {
    const auto sequence_before = snapshot_sequence_.load(std::memory_order_acquire);
    if ((sequence_before & 1U) != 0U) {
      continue;
    }
    const auto packed_state = snapshot_state_.load(std::memory_order_relaxed);
    const auto sequence_after = snapshot_sequence_.load(std::memory_order_acquire);
    if (sequence_before == sequence_after) {
      return packed_state;
    }
  }
}

Steinberg::tresult PLUGIN_API GainProcessor::process(Steinberg::Vst::ProcessData& data) {
  try {
    apply_pending_state();
    const auto processing_generation = applied_generation_;
    if (data.numSamples < 0 || data.numSamples > processSetup.maxSamplesPerBlock) {
      return Steinberg::kInvalidArgument;
    }
    const auto queues = find_parameter_queues(data.inputParameterChanges);
    QueuePointSource gain_source(queues.gain);
    QueuePointSource bypass_source(queues.bypass);

    if (data.numSamples == 0) {
      std::uint64_t unused_silence = 0;
      std::array<Steinberg::Vst::Sample32*, 1> unused_input{};
      std::array<Steinberg::Vst::Sample32*, 1> unused_output{};
      garak::spike::gain::process_block(
          garak::spike::gain::ProcessBlockContext<Steinberg::Vst::Sample32, QueuePointSource,
                                                  QueuePointSource>{
              unused_input.data(), unused_output.data(), 0, 0, 0, unused_silence, gain_source,
              bypass_source, current_gain_normalized_, current_bypass_});
      publish_processed_state(processing_generation);
      return Steinberg::kResultTrue;
    }

    if (data.numInputs != 1 || data.numOutputs != 1 || data.inputs == nullptr ||
        data.outputs == nullptr || data.inputs[0].numChannels != data.outputs[0].numChannels ||
        (data.inputs[0].numChannels != 1 && data.inputs[0].numChannels != 2) ||
        data.symbolicSampleSize != processSetup.symbolicSampleSize) {
      return Steinberg::kInvalidArgument;
    }

    Steinberg::tresult result = Steinberg::kResultFalse;
    if (data.symbolicSampleSize == Steinberg::Vst::kSample32) {
      result = process_audio<Steinberg::Vst::Sample32>(data, gain_source, bypass_source,
                                                       current_gain_normalized_, current_bypass_);
    } else if (data.symbolicSampleSize == Steinberg::Vst::kSample64) {
      result = process_audio<Steinberg::Vst::Sample64>(data, gain_source, bypass_source,
                                                       current_gain_normalized_, current_bypass_);
    }
    if (result == Steinberg::kResultTrue) {
      publish_processed_state(processing_generation);
    }
    return result;
  } catch (...) {
    return Steinberg::kResultFalse;
  }
}

Steinberg::tresult PLUGIN_API GainProcessor::setState(Steinberg::IBStream* const state) {
  if (state == nullptr) {
    return Steinberg::kInvalidArgument;
  }
  garak::spike::gain::SpikeState decoded{};
  if (!read_state(state, decoded)) {
    return Steinberg::kResultFalse;
  }
  const auto packed = garak::spike::gain::pack_realtime_state(decoded);
  pending_state_.store(packed, std::memory_order_relaxed);
  pending_generation_.fetch_add(1, std::memory_order_release);
  write_snapshot_non_realtime(packed);
  return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API GainProcessor::getState(Steinberg::IBStream* const state) {
  if (state == nullptr) {
    return Steinberg::kInvalidArgument;
  }
  const auto snapshot = garak::spike::gain::unpack_realtime_state(read_snapshot_non_realtime());
  return write_state(state, snapshot) ? Steinberg::kResultTrue : Steinberg::kResultFalse;
}

} // namespace garak::adapter::vst3::runtime_strategy_spike
