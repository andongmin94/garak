#include "factory_support.hpp"

namespace {

[[nodiscard]] garak::adapter::vst3::runtime_strategy_spike::ProductDefinition product_definition() {
  using garak::adapter::vst3::runtime_strategy_spike::kBypassParameterId;
  using garak::adapter::vst3::runtime_strategy_spike::kGainParameterId;
  return {"Garak",
          "Garak Thin Beta",
          "0.1.0",
          {{0x44BFB8B6, 0xF56946FF, 0x9F6F1935, 0x29BCB967}},
          {{0x826C362F, 0xA2784F71, 0x9351912B, 0xE834F9AB}},
          kGainParameterId,
          kBypassParameterId,
          3.0,
          "Fx"};
}

} // namespace

extern "C" SMTG_EXPORT_SYMBOL Steinberg::IPluginFactory* PLUGIN_API GetPluginFactory() {
  try {
    static const auto product = product_definition();
    return garak::adapter::vst3::runtime_strategy_spike::get_or_create_product_factory(product);
  } catch (...) {
    return nullptr;
  }
}
