#include "processor.hpp"

#include "factory_support.hpp"
#include "garak/dsp/gain/gain.hpp"
#include "garak/runtime/product_v1/product_state.hpp"
#include "product_runtime_context.hpp"
#include "state_stream.hpp"

#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "pluginterfaces/vst/vstspeaker.h"

#include <array>
#include <cstdint>
#include <type_traits>

namespace garak::adapter::vst3::product_runtime_v1 {
namespace {

constexpr Steinberg::int32 kMaximumParameterQueueCount = 2;
class QueuePointSource final {
public:
  explicit QueuePointSource(Steinberg::Vst::IParamValueQueue* queue) noexcept : queue_(queue) {}

  [[nodiscard]] Steinberg::int32 point_count() const {
    return queue_ == nullptr ? 0 : queue_->getPointCount();
  }

  [[nodiscard]] bool point(const Steinberg::int32 index,
                           garak::dsp::gain::AutomationPoint& point) const {
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
find_parameter_queues(Steinberg::Vst::IParameterChanges* const changes,
                      const garak::runtime::static_graph::GainExecutionBinding& execution_binding) {
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
    if (queue->getParameterId() == execution_binding.gain_parameter_id()) {
      result.duplicate_gain = result.gain != nullptr;
      if (result.gain == nullptr) {
        result.gain = queue;
      }
    } else if (queue->getParameterId() == execution_binding.bypass_parameter_id()) {
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
process_audio(const garak::runtime::static_graph::GainExecutionBinding& execution_binding,
              Steinberg::Vst::ProcessData& data, QueuePointSource& gain_source,
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
  garak::runtime::static_graph::execute_gain_binding(
      execution_binding,
      garak::dsp::gain::ProcessBlockContext<Sample, QueuePointSource, QueuePointSource>{
          input_channels.data(), output_channels.data(), channel_count, data.numSamples,
          input.silenceFlags, output_silence, gain_source, bypass_source, current_gain,
          current_bypass});
  output.silenceFlags = output_silence;
  return Steinberg::kResultTrue;
}

} // namespace

GainProcessor::GainProcessor(
    garak::runtime::product_v1::Identifier product_id, const double default_gain_normalized,
    const garak::runtime::product_v1::Identifier& controller_class_id,
    garak::runtime::static_graph::GainExecutionBinding execution_binding) noexcept
    : product_id_(product_id), execution_binding_(execution_binding) {
  setControllerClass(class_id(controller_class_id));
  const garak::runtime::product_v1::ProductState defaults{default_gain_normalized, false};
  const auto packed = garak::runtime::product_v1::pack_realtime_state(defaults);
  pending_state_.store(packed, std::memory_order_relaxed);
  snapshot_state_.store(packed, std::memory_order_relaxed);
  current_gain_normalized_ = defaults.gain_normalized;
}

Steinberg::FUnknown* GainProcessor::create_instance(void* const context) {
  try {
    const auto* const runtime = static_cast<const ProductRuntimeContext*>(context);
    if (runtime == nullptr) {
      return nullptr;
    }
    const auto& product = runtime->product;
    return static_cast<Steinberg::Vst::IAudioProcessor*>(
        new GainProcessor(product.product_id, product.parameters[0].default_normalized,
                          product.controller_fuid, runtime->execution_binding));
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
  const auto state = garak::runtime::product_v1::unpack_realtime_state(
      pending_state_.load(std::memory_order_relaxed));
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
    snapshot_state_.store(garak::runtime::product_v1::pack_realtime_state(
                              {current_gain_normalized_, current_bypass_}),
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
    const auto queues = find_parameter_queues(data.inputParameterChanges, execution_binding_);
    QueuePointSource gain_source(queues.gain);
    QueuePointSource bypass_source(queues.bypass);

    if (data.numSamples == 0) {
      std::uint64_t unused_silence = 0;
      std::array<Steinberg::Vst::Sample32*, 1> unused_input{};
      std::array<Steinberg::Vst::Sample32*, 1> unused_output{};
      garak::runtime::static_graph::execute_gain_binding(
          execution_binding_,
          garak::dsp::gain::ProcessBlockContext<Steinberg::Vst::Sample32, QueuePointSource,
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
      result = process_audio<Steinberg::Vst::Sample32>(execution_binding_, data, gain_source,
                                                       bypass_source, current_gain_normalized_,
                                                       current_bypass_);
    } else if (data.symbolicSampleSize == Steinberg::Vst::kSample64) {
      result = process_audio<Steinberg::Vst::Sample64>(execution_binding_, data, gain_source,
                                                       bypass_source, current_gain_normalized_,
                                                       current_bypass_);
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
  garak::runtime::product_v1::ProductState decoded{};
  if (!read_state(state, product_id_, decoded)) {
    return Steinberg::kResultFalse;
  }
  const auto packed = garak::runtime::product_v1::pack_realtime_state(decoded);
  pending_state_.store(packed, std::memory_order_relaxed);
  pending_generation_.fetch_add(1, std::memory_order_release);
  write_snapshot_non_realtime(packed);
  return Steinberg::kResultTrue;
}

Steinberg::tresult PLUGIN_API GainProcessor::getState(Steinberg::IBStream* const state) {
  if (state == nullptr) {
    return Steinberg::kInvalidArgument;
  }
  const auto snapshot =
      garak::runtime::product_v1::unpack_realtime_state(read_snapshot_non_realtime());
  return write_state(state, product_id_, snapshot) ? Steinberg::kResultTrue
                                                   : Steinberg::kResultFalse;
}

} // namespace garak::adapter::vst3::product_runtime_v1
