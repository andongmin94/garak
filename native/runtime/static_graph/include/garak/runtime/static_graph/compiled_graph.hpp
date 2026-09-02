#ifndef GARAK_RUNTIME_STATIC_GRAPH_COMPILED_GRAPH_HPP_INCLUDED
#define GARAK_RUNTIME_STATIC_GRAPH_COMPILED_GRAPH_HPP_INCLUDED

#include "garak/runtime/static_graph/gain_plan.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>

namespace garak::runtime::static_graph {

inline constexpr std::size_t kCompiledGraphHeaderBytes = 32;
inline constexpr std::size_t kCompiledGraphOperationBytes = 20;
inline constexpr std::size_t kCompiledGraphOperationCount = 3;
inline constexpr std::size_t kCompiledGraphTotalBytes =
    kCompiledGraphHeaderBytes + (kCompiledGraphOperationBytes * kCompiledGraphOperationCount);

namespace detail {

inline constexpr std::array<std::uint8_t, 8> kCompiledGraphMagic{'G', 'A', 'R', 'A',
                                                                 'K', 'G', 'R', 'F'};

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

} // namespace detail

[[nodiscard]] inline std::optional<GainExecutionBinding>
parse_compiled_gain_graph(const std::span<const std::uint8_t> bytes,
                          const std::uint32_t gain_parameter_id,
                          const std::uint32_t bypass_parameter_id) noexcept {
  if (bytes.size() != kCompiledGraphTotalBytes ||
      !std::equal(detail::kCompiledGraphMagic.begin(), detail::kCompiledGraphMagic.end(),
                  bytes.begin()) ||
      detail::read_graph_u16(bytes, 8) != 1 || detail::read_graph_u16(bytes, 10) != 0 ||
      detail::read_graph_u32(bytes, 12) != kCompiledGraphHeaderBytes ||
      detail::read_graph_u32(bytes, 16) != bytes.size() ||
      detail::read_graph_u16(bytes, 20) != kCompiledGraphOperationCount ||
      detail::read_graph_u32(bytes, 28) != 0) {
    return std::nullopt;
  }

  GainExecutionPlan plan{};
  plan.buffer_count = detail::read_graph_u16(bytes, 22);
  plan.latency_samples = detail::read_graph_u32(bytes, 24);
  auto offset = kCompiledGraphHeaderBytes;
  for (std::size_t index = 0; index < kCompiledGraphOperationCount; ++index) {
    const auto type = detail::read_graph_u16(bytes, offset + 4);
    if (type < static_cast<std::uint16_t>(OperationType::audio_input) ||
        type > static_cast<std::uint16_t>(OperationType::audio_output) ||
        detail::read_graph_u16(bytes, offset + 6) != 0) {
      return std::nullopt;
    }
    plan.operations[index] = {
        detail::read_graph_u32(bytes, offset),      static_cast<OperationType>(type),
        detail::read_graph_u16(bytes, offset + 8),  detail::read_graph_u16(bytes, offset + 10),
        detail::read_graph_u32(bytes, offset + 12), detail::read_graph_u32(bytes, offset + 16)};
    offset += kCompiledGraphOperationBytes;
  }
  return bind_gain_execution_plan(plan, gain_parameter_id, bypass_parameter_id);
}

} // namespace garak::runtime::static_graph

#endif
