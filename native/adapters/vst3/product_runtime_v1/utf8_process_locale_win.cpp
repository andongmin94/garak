#include <clocale>
#include <cstdlib>

namespace garak::adapter::vst3::product_runtime_v1 {
namespace {

class Utf8ProcessLocale final {
public:
  Utf8ProcessLocale() noexcept {
    if (std::setlocale(LC_CTYPE, ".UTF8") == nullptr) {
      std::_Exit(EXIT_FAILURE);
    }
  }
};

const Utf8ProcessLocale kUtf8ProcessLocale{};

} // namespace
} // namespace garak::adapter::vst3::product_runtime_v1
