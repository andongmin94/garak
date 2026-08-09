#include "controller.hpp"
#include "identifiers.hpp"
#include "processor.hpp"
#include "version.hpp"

#include "public.sdk/source/main/pluginfactory.h"

using namespace Steinberg;
using namespace Steinberg::Vst;
using namespace garak::adapter::vst3::gain_spike;

BEGIN_FACTORY_DEF(kVendorName, "", "")

DEF_CLASS2(INLINE_UID(kProcessorClassId.word1, kProcessorClassId.word2, kProcessorClassId.word3,
                      kProcessorClassId.word4),
           PClassInfo::kManyInstances, kVstAudioEffectClass, kPluginName, 0, kPluginCategory,
           GARAK_GAIN_SPIKE_VERSION, kVstVersionString, GainProcessor::create_instance)

DEF_CLASS2(INLINE_UID(kControllerClassId.word1, kControllerClassId.word2, kControllerClassId.word3,
                      kControllerClassId.word4),
           PClassInfo::kManyInstances, kVstComponentControllerClass, "Garak Gain Spike Controller",
           0, "", GARAK_GAIN_SPIKE_VERSION, kVstVersionString, GainController::create_instance)

END_FACTORY
