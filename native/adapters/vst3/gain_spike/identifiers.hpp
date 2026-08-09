#ifndef GARAK_ADAPTERS_VST3_GAIN_SPIKE_IDENTIFIERS_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_GAIN_SPIKE_IDENTIFIERS_HPP_INCLUDED

#include "pluginterfaces/base/funknown.h"
#include "pluginterfaces/vst/vsttypes.h"

namespace garak::adapter::vst3::gain_spike {

struct ClassIdWords final {
  Steinberg::uint32 word1;
  Steinberg::uint32 word2;
  Steinberg::uint32 word3;
  Steinberg::uint32 word4;
};

inline constexpr ClassIdWords kProcessorClassId{0x3D6F3C09, 0x296D49EF, 0x99334C46, 0x88F484EE};
inline constexpr ClassIdWords kControllerClassId{0x2CD50BAE, 0x587A4F3E, 0x812399E5, 0x50F352D4};

[[nodiscard]] inline Steinberg::FUID processor_fuid() {
  return {kProcessorClassId.word1, kProcessorClassId.word2, kProcessorClassId.word3,
          kProcessorClassId.word4};
}

[[nodiscard]] inline Steinberg::FUID controller_fuid() {
  return {kControllerClassId.word1, kControllerClassId.word2, kControllerClassId.word3,
          kControllerClassId.word4};
}

inline constexpr Steinberg::Vst::ParamID kGainParameterId = 1001;
inline constexpr Steinberg::Vst::ParamID kBypassParameterId = 1002;

} // namespace garak::adapter::vst3::gain_spike

#endif
