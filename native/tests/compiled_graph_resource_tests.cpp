#include "compiled_graph_resource.hpp"

#include "compiled_graph_test_fixture.hpp"

#include <array>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <span>
#include <string>

namespace {

using garak::adapter::vst3::product_runtime_v1::read_compiled_graph_resource;
using garak::runtime::static_graph::CompiledGraphDiagnostic;
using garak::runtime::static_graph::CompiledGraphDisposition;

constexpr std::uint32_t kGainParameterId = 1001;
constexpr std::uint32_t kBypassParameterId = 1002;

class TemporaryDirectory final {
public:
  TemporaryDirectory()
      : path_(std::filesystem::temp_directory_path() /
              ("garak-compiled-graph-resource-" +
               std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()))) {
    std::filesystem::create_directories(path_);
  }

  TemporaryDirectory(const TemporaryDirectory&) = delete;
  TemporaryDirectory& operator=(const TemporaryDirectory&) = delete;

  ~TemporaryDirectory() {
    std::error_code ignored;
    std::filesystem::remove_all(path_, ignored);
  }

  [[nodiscard]] const std::filesystem::path& path() const noexcept { return path_; }

private:
  std::filesystem::path path_;
};

[[nodiscard]] bool write_bytes(const std::filesystem::path& path,
                               const std::span<const std::uint8_t> bytes) {
  std::ofstream output(path, std::ios::binary | std::ios::trunc);
  if (!output.is_open()) {
    return false;
  }
  output.write(reinterpret_cast<const char*>(bytes.data()),
               static_cast<std::streamsize>(bytes.size()));
  return output.good();
}

[[nodiscard]] bool current_report_is_valid(const std::filesystem::path& path) {
  const auto report = read_compiled_graph_resource(path, kGainParameterId, kBypassParameterId);
  return report.disposition == CompiledGraphDisposition::current &&
         report.diagnostic == CompiledGraphDiagnostic::none && report.version.available &&
         report.version.major == 1 && report.version.minor == 0 && report.binding &&
         report.binding->input_buffer() == 0 && report.binding->output_buffer() == 1 &&
         report.binding->gain_parameter_id() == kGainParameterId &&
         report.binding->bypass_parameter_id() == kBypassParameterId;
}

[[nodiscard]] bool test_resource_matrix() {
  TemporaryDirectory temporary;
  const auto graph = temporary.path() / "graph.garakbin";

  const auto missing = read_compiled_graph_resource(graph, kGainParameterId, kBypassParameterId);
  if (missing.disposition != CompiledGraphDisposition::rebuild_from_project ||
      missing.diagnostic != CompiledGraphDiagnostic::missing || missing.version.available ||
      missing.binding) {
    return false;
  }

  if (!write_bytes(graph, garak::test::kCompiledGraphFixture) || !current_report_is_valid(graph)) {
    return false;
  }

  auto old = garak::test::kCompiledGraphFixture;
  old[8] = 0;
  old[9] = 0;
  if (!write_bytes(graph, old)) {
    return false;
  }
  const auto old_report = read_compiled_graph_resource(graph, kGainParameterId, kBypassParameterId);
  if (old_report.disposition != CompiledGraphDisposition::rebuild_from_project ||
      old_report.diagnostic != CompiledGraphDiagnostic::unsupported_old ||
      !old_report.version.available || old_report.version.major != 0 || old_report.binding) {
    return false;
  }

  auto future = garak::test::kCompiledGraphFixture;
  future[10] = 1;
  if (!write_bytes(graph, future)) {
    return false;
  }
  const auto future_report =
      read_compiled_graph_resource(graph, kGainParameterId, kBypassParameterId);
  if (future_report.disposition != CompiledGraphDisposition::reject_too_new ||
      future_report.diagnostic != CompiledGraphDiagnostic::too_new ||
      future_report.version.major != 1 || future_report.version.minor != 1 ||
      future_report.binding) {
    return false;
  }

  auto corrupt = garak::test::kCompiledGraphFixture;
  corrupt[28] = 1;
  if (!write_bytes(graph, corrupt)) {
    return false;
  }
  const auto corrupt_report =
      read_compiled_graph_resource(graph, kGainParameterId, kBypassParameterId);
  if (corrupt_report.disposition != CompiledGraphDisposition::reject_invalid ||
      corrupt_report.diagnostic != CompiledGraphDiagnostic::invalid_current ||
      !corrupt_report.version.available || corrupt_report.binding) {
    return false;
  }

  std::filesystem::remove(graph);
  std::filesystem::create_directory(graph);
  const auto non_file = read_compiled_graph_resource(graph, kGainParameterId, kBypassParameterId);
  return non_file.disposition == CompiledGraphDisposition::reject_invalid &&
         non_file.diagnostic == CompiledGraphDiagnostic::unreadable_resource && !non_file.binding;
}

} // namespace

int main() {
  try {
    if (!test_resource_matrix()) {
      std::fputs("Compiled graph resource compatibility matrix failed\n", stderr);
      return 1;
    }
    return 0;
  } catch (...) {
    std::fputs("Compiled graph resource compatibility test threw\n", stderr);
    return 2;
  }
}
