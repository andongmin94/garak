#include "factory_support.hpp"

namespace {

[[nodiscard]] garak::adapter::vst3::runtime_strategy_spike::ProductDefinition product_definition() {
  using garak::adapter::vst3::runtime_strategy_spike::kBypassParameterId;
  using garak::adapter::vst3::runtime_strategy_spike::kGainParameterId;
  return {"Garak",
          "Garak Thin Alpha",
          "0.1.0",
          {{0x93952A37, 0xBFA84FF1, 0xAC06CE58, 0xB9FA87EA}},
          {{0xE08F3ACC, 0xD825424A, 0xB238BBAB, 0x6B0248CC}},
          kGainParameterId,
          kBypassParameterId,
          -6.0,
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
