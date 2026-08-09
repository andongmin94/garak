#ifndef GARAK_CORE_VERSION_HPP_INCLUDED
#define GARAK_CORE_VERSION_HPP_INCLUDED

#include <cstdint>
#include <string_view>

namespace garak::core {

struct Version {
  std::uint32_t major;
  std::uint32_t minor;
  std::uint32_t patch;
};

[[nodiscard]] Version version() noexcept;
[[nodiscard]] std::string_view version_string() noexcept;

} // namespace garak::core

#endif
