#include <garak/core/version.hpp>

namespace garak::core {

Version version() noexcept { return Version{0U, 0U, 0U}; }

std::string_view version_string() noexcept { return "0.0.0"; }

} // namespace garak::core
