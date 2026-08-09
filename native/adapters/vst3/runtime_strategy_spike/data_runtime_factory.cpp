#include "descriptor_loader_win.hpp"
#include "factory_support.hpp"

extern "C" SMTG_EXPORT_SYMBOL Steinberg::IPluginFactory* PLUGIN_API GetPluginFactory() {
  try {
    static const auto product =
        garak::adapter::vst3::runtime_strategy_spike::load_module_product_definition();
    if (!product) {
      return nullptr;
    }
    return garak::adapter::vst3::runtime_strategy_spike::get_or_create_product_factory(*product);
  } catch (...) {
    return nullptr;
  }
}
