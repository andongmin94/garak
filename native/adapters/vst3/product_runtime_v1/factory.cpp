#include "compiled_product_loader_win.hpp"
#include "factory_support.hpp"

extern "C" SMTG_EXPORT_SYMBOL Steinberg::IPluginFactory* PLUGIN_API GetPluginFactory() {
  try {
    static const auto product =
        garak::adapter::vst3::product_runtime_v1::load_module_compiled_product();
    if (!product) {
      return nullptr;
    }
    return garak::adapter::vst3::product_runtime_v1::get_or_create_product_factory(*product);
  } catch (...) {
    return nullptr;
  }
}
