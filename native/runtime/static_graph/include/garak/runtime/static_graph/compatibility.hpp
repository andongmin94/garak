#ifndef GARAK_RUNTIME_STATIC_GRAPH_COMPATIBILITY_HPP_INCLUDED
#define GARAK_RUNTIME_STATIC_GRAPH_COMPATIBILITY_HPP_INCLUDED

#include "garak/runtime/static_graph/compiled_graph.hpp"

#include <algorithm>
#include <cstdint>
#include <optional>
#include <span>
#include <utility>

namespace garak::runtime::static_graph {

enum class CompiledGraphDisposition : std::uint8_t {
  current,
  rebuild_from_project,
  reject_too_new,
  reject_invalid,
};

enum class CompiledGraphDiagnostic : std::uint8_t {
  none,
  missing,
  unreadable_resource,
  invalid_magic,
  invalid_header,
  unsupported_old,
  too_new,
  invalid_current,
};

struct CompiledGraphVersion final {
  std::uint16_t major{};
  std::uint16_t minor{};
  bool available{};
};

struct CompiledGraphCompatibilityReport final {
  CompiledGraphDisposition disposition{CompiledGraphDisposition::reject_invalid};
  CompiledGraphDiagnostic diagnostic{CompiledGraphDiagnostic::invalid_header};
  CompiledGraphVersion version{};
  std::optional<GainExecutionBinding> binding{};
};

[[nodiscard]] constexpr const char*
compiled_graph_diagnostic_code(const CompiledGraphDiagnostic diagnostic) noexcept {
  switch (diagnostic) {
  case CompiledGraphDiagnostic::none:
    return "none";
  case CompiledGraphDiagnostic::missing:
    return "GARAK_COMPILED_GRAPH_MISSING";
  case CompiledGraphDiagnostic::unreadable_resource:
    return "GARAK_COMPILED_GRAPH_IO";
  case CompiledGraphDiagnostic::invalid_magic:
    return "GARAK_COMPILED_GRAPH_MAGIC";
  case CompiledGraphDiagnostic::invalid_header:
    return "GARAK_COMPILED_GRAPH_SIZE";
  case CompiledGraphDiagnostic::unsupported_old:
    return "GARAK_COMPILED_GRAPH_VERSION_OLD";
  case CompiledGraphDiagnostic::too_new:
    return "GARAK_COMPILED_GRAPH_VERSION_NEW";
  case CompiledGraphDiagnostic::invalid_current:
    return "GARAK_COMPILED_GRAPH_INVALID";
  }
  return "GARAK_COMPILED_GRAPH_INVALID";
}

[[nodiscard]] inline CompiledGraphCompatibilityReport classify_compiled_graph_compatibility(
    const std::optional<std::span<const std::uint8_t>> bytes,
    const std::uint32_t gain_parameter_id,
    const std::uint32_t bypass_parameter_id) noexcept {
  if (!bytes) {
    return {CompiledGraphDisposition::rebuild_from_project, CompiledGraphDiagnostic::missing, {},
            std::nullopt};
  }
  if (bytes->size() < kCompiledGraphMagic.size() ||
      !std::equal(kCompiledGraphMagic.begin(), kCompiledGraphMagic.end(), bytes->begin())) {
    return {CompiledGraphDisposition::reject_invalid, CompiledGraphDiagnostic::invalid_magic, {},
            std::nullopt};
  }
  if (bytes->size() < 12) {
    return {CompiledGraphDisposition::reject_invalid, CompiledGraphDiagnostic::invalid_header, {},
            std::nullopt};
  }

  const CompiledGraphVersion version{detail::read_graph_u16(*bytes, 8),
                                     detail::read_graph_u16(*bytes, 10), true};
  if (version.major < kCompiledGraphMajorVersion ||
      (version.major == kCompiledGraphMajorVersion &&
       version.minor < kCompiledGraphMinorVersion)) {
    return {CompiledGraphDisposition::rebuild_from_project,
            CompiledGraphDiagnostic::unsupported_old, version, std::nullopt};
  }
  if (version.major > kCompiledGraphMajorVersion ||
      (version.major == kCompiledGraphMajorVersion &&
       version.minor > kCompiledGraphMinorVersion)) {
    return {CompiledGraphDisposition::reject_too_new, CompiledGraphDiagnostic::too_new, version,
            std::nullopt};
  }

  auto binding =
      parse_compiled_gain_graph(*bytes, gain_parameter_id, bypass_parameter_id);
  if (!binding) {
    return {CompiledGraphDisposition::reject_invalid, CompiledGraphDiagnostic::invalid_current,
            version, std::nullopt};
  }
  return {CompiledGraphDisposition::current, CompiledGraphDiagnostic::none, version,
          std::move(binding)};
}

} // namespace garak::runtime::static_graph

#endif
