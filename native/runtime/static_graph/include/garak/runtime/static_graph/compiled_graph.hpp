#ifndef GARAK_RUNTIME_STATIC_GRAPH_COMPILED_GRAPH_HPP_INCLUDED
#define GARAK_RUNTIME_STATIC_GRAPH_COMPILED_GRAPH_HPP_INCLUDED

#include "garak/runtime/static_graph/static_execution.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>

namespace garak::runtime::static_graph {

inline constexpr std::uint16_t kCompiledGraphMajorVersion = 1;
inline constexpr std::uint16_t kCompiledGraphMinorVersion = 1;
inline constexpr std::size_t kCompiledGraphHeaderBytes = 32;
inline constexpr std::size_t kCompiledGraphOperationBytes = 20;
inline constexpr std::size_t kCompiledGraphMinimumOperationCount = 3;
inline constexpr std::size_t kCompiledGraphMaximumOperationCount = 4;
inline constexpr std::array<std::uint8_t, 8> kCompiledGraphMagic{'G', 'A', 'R', 'A',
                                                                 'K', 'G', 'R', 'F'};

namespace detail {

[[nodiscard]] constexpr std::uint16_t read_graph_u16(const std::span<const std::uint8_t> bytes,
                                                     const std::size_t offset) noexcept {
  return static_cast<std::uint16_t>(bytes[offset]) |
         static_cast<std::uint16_t>(static_cast<std::uint16_t>(bytes[offset + 1]) << 8U);
}

[[nodiscard]] constexpr std::uint32_t read_graph_u32(const std::span<const std::uint8_t> bytes,
                                                     const std::size_t offset) noexcept {
  std::uint32_t value = 0;
  for (std::size_t index = 0; index < 4; ++index) {
    value |= static_cast<std::uint32_t>(bytes[offset + index]) << (index * 8U);
  }
  return value;
}

[[nodiscard]] constexpr std::size_t compiled_graph_total_bytes(const std::size_t operation_count) {
  return kCompiledGraphHeaderBytes + (kCompiledGraphOperationBytes * operation_count);
}

} // namespace detail

[[nodiscard]] inline std::optional<StaticExecutionBinding>
parse_compiled_static_graph(const std::span<const std::uint8_t> bytes,
                            const std::uint32_t gain_parameter_id,
                            const std::uint32_t bypass_parameter_id) noexcept {
  if (bytes.size() < kCompiledGraphHeaderBytes ||
      !std::equal(kCompiledGraphMagic.begin(), kCompiledGraphMagic.end(), bytes.begin()) ||
      detail::read_graph_u16(bytes, 8) != kCompiledGraphMajorVersion ||
      detail::read_graph_u16(bytes, 10) != kCompiledGraphMinorVersion ||
      detail::read_graph_u32(bytes, 12) != kCompiledGraphHeaderBytes ||
      detail::read_graph_u32(bytes, 16) != bytes.size() || detail::read_graph_u32(bytes, 28) != 0) {
    return std::nullopt;
  }

  const auto operation_count = detail::read_graph_u16(bytes, 20);
  if (operation_count < kCompiledGraphMinimumOperationCount ||
      operation_count > kCompiledGraphMaximumOperationCount ||
      bytes.size() != detail::compiled_graph_total_bytes(operation_count)) {
    return std::nullopt;
  }

  StaticExecutionPlan plan{};
  plan.operation_count = operation_count;
  plan.buffer_count = detail::read_graph_u16(bytes, 22);
  plan.latency_samples = detail::read_graph_u32(bytes, 24);
  auto offset = kCompiledGraphHeaderBytes;
  for (std::size_t index = 0; index < operation_count; ++index) {
    if (detail::read_graph_u16(bytes, offset + 6) != 0) {
      return std::nullopt;
    }
    plan.operations[index] = {
        detail::read_graph_u32(bytes, offset),      detail::read_graph_u16(bytes, offset + 4),
        detail::read_graph_u16(bytes, offset + 8),  detail::read_graph_u16(bytes, offset + 10),
        detail::read_graph_u32(bytes, offset + 12), detail::read_graph_u32(bytes, offset + 16)};
    offset += kCompiledGraphOperationBytes;
  }
  return bind_static_execution_plan(plan, gain_parameter_id, bypass_parameter_id);
}

} // namespace garak::runtime::static_graph

#endif
