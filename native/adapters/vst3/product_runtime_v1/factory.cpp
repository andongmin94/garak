#include "factory_support.hpp"
#include "product_runtime_loader_win.hpp"

extern "C" SMTG_EXPORT_SYMBOL Steinberg::IPluginFactory* PLUGIN_API GetPluginFactory() {
  try {
    static const auto runtime =
        garak::adapter::vst3::product_runtime_v1::load_module_product_runtime();
    if (!runtime) {
      return nullptr;
    }
    return garak::adapter::vst3::product_runtime_v1::get_or_create_product_factory(*runtime);
  } catch (...) {
    return nullptr;
  }
}
