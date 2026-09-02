#ifndef GARAK_ADAPTER_VST3_PRODUCT_RUNTIME_V1_COMPILED_GRAPH_RESOURCE_HPP_INCLUDED
#define GARAK_ADAPTER_VST3_PRODUCT_RUNTIME_V1_COMPILED_GRAPH_RESOURCE_HPP_INCLUDED

#include "garak/runtime/static_graph/compatibility.hpp"

#include <array>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <optional>
#include <span>
#include <system_error>

namespace garak::adapter::vst3::product_runtime_v1 {

[[nodiscard]] inline runtime::static_graph::CompiledGraphCompatibilityReport
read_compiled_graph_resource(const std::filesystem::path& path,
                             const std::uint32_t gain_parameter_id,
                             const std::uint32_t bypass_parameter_id) {
  std::error_code status_error;
  const auto status = std::filesystem::symlink_status(path, status_error);
  if (status.type() == std::filesystem::file_type::not_found ||
      status_error == std::make_error_code(std::errc::no_such_file_or_directory)) {
    return runtime::static_graph::classify_compiled_graph_compatibility(
        std::nullopt, gain_parameter_id, bypass_parameter_id);
  }

  const auto invalid_resource = []() {
    return runtime::static_graph::CompiledGraphCompatibilityReport{
        runtime::static_graph::CompiledGraphDisposition::reject_invalid,
        runtime::static_graph::CompiledGraphDiagnostic::unreadable_resource, {}, std::nullopt};
  };
  if (status_error || !std::filesystem::is_regular_file(status)) {
    return invalid_resource();
  }

  std::ifstream input(path, std::ios::binary);
  if (!input.is_open()) {
    return invalid_resource();
  }
  std::array<std::uint8_t, runtime::static_graph::kCompiledGraphTotalBytes + 1> bytes{};
  input.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  const auto count = input.gcount();
  if (input.bad() || (input.fail() && !input.eof()) || count < 0) {
    return invalid_resource();
  }
  return runtime::static_graph::classify_compiled_graph_compatibility(
      std::optional<std::span<const std::uint8_t>>(std::span<const std::uint8_t>(
          bytes.data(), static_cast<std::size_t>(count))),
      gain_parameter_id, bypass_parameter_id);
}

} // namespace garak::adapter::vst3::product_runtime_v1

#endif
