#include "product_runtime_loader_win.hpp"

#include "garak/runtime/static_graph/compiled_graph.hpp"
#include "public.sdk/source/main/moduleinit.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <algorithm>
#include <array>
#include <filesystem>
#include <fstream>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace garak::adapter::vst3::product_runtime_v1 {
namespace {

constexpr std::size_t kInitialPathCharacters = 512;
constexpr std::size_t kMaximumPathCharacters = 32'768;
constexpr wchar_t kArchitectureDirectory[] = L"x86_64-win";
constexpr wchar_t kContentsDirectory[] = L"Contents";
constexpr wchar_t kProductResourceFilename[] = L"product.garakbin";
constexpr wchar_t kGraphResourceFilename[] = L"graph.garakbin";

[[nodiscard]] std::optional<std::filesystem::path> current_module_path() {
  const auto module = Steinberg::getPlatformModuleHandle();
  if (module == nullptr) {
    return std::nullopt;
  }
  std::vector<wchar_t> buffer(kInitialPathCharacters);
  while (buffer.size() <= kMaximumPathCharacters) {
    const auto length =
        GetModuleFileNameW(module, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0) {
      return std::nullopt;
    }
    if (length < buffer.size()) {
      return std::filesystem::path(std::wstring_view(buffer.data(), length));
    }
    if (buffer.size() == kMaximumPathCharacters) {
      return std::nullopt;
    }
    buffer.resize(std::min(buffer.size() * 2, kMaximumPathCharacters));
  }
  return std::nullopt;
}

[[nodiscard]] std::optional<std::wstring> utf8_to_wide(const std::string_view value) {
  if (value.empty()) {
    return std::nullopt;
  }
  const auto required = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                            static_cast<int>(value.size()), nullptr, 0);
  if (required <= 0) {
    return std::nullopt;
  }
  std::wstring result(static_cast<std::size_t>(required), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                          static_cast<int>(value.size()), result.data(), required) != required) {
    return std::nullopt;
  }
  return result;
}

[[nodiscard]] std::optional<garak::runtime::product_v1::CompiledProduct>
read_compiled_product(const std::filesystem::path& path) {
  std::ifstream input(path, std::ios::binary);
  if (!input.is_open()) {
    return std::nullopt;
  }
  std::array<std::uint8_t, garak::runtime::product_v1::kMaximumCompiledProductBytes + 1> bytes{};
  input.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  const auto count = input.gcount();
  if (input.bad() || (input.fail() && !input.eof()) || count <= 0 ||
      count >
          static_cast<std::streamsize>(garak::runtime::product_v1::kMaximumCompiledProductBytes)) {
    return std::nullopt;
  }
  return garak::runtime::product_v1::parse_compiled_product(
      std::span<const std::uint8_t>(bytes.data(), static_cast<std::size_t>(count)));
}

[[nodiscard]] std::optional<garak::runtime::static_graph::GainExecutionBinding>
read_compiled_graph(const std::filesystem::path& path) {
  std::ifstream input(path, std::ios::binary);
  if (!input.is_open()) {
    return std::nullopt;
  }
  std::array<std::uint8_t, garak::runtime::static_graph::kCompiledGraphTotalBytes + 1> bytes{};
  input.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  const auto count = input.gcount();
  if (input.bad() || (input.fail() && !input.eof()) ||
      count !=
          static_cast<std::streamsize>(garak::runtime::static_graph::kCompiledGraphTotalBytes)) {
    return std::nullopt;
  }
  return garak::runtime::static_graph::parse_compiled_gain_graph(
      std::span<const std::uint8_t>(bytes.data(), static_cast<std::size_t>(count)),
      garak::runtime::product_v1::kGainParameterId, garak::runtime::product_v1::kBypassParameterId);
}

} // namespace

std::optional<ProductRuntimeContext> load_module_product_runtime() noexcept {
  try {
    const auto module_path = current_module_path();
    if (!module_path) {
      return std::nullopt;
    }
    const auto inner_filename = module_path->filename();
    const auto architecture_directory = module_path->parent_path();
    const auto contents_directory = architecture_directory.parent_path();
    const auto bundle_directory = contents_directory.parent_path();
    if (inner_filename.extension() != L".vst3" ||
        architecture_directory.filename().native() != kArchitectureDirectory ||
        contents_directory.filename().native() != kContentsDirectory ||
        bundle_directory.extension() != L".vst3" || bundle_directory.filename() != inner_filename) {
      return std::nullopt;
    }

    const auto resources_directory = contents_directory / L"Resources";
    auto product = read_compiled_product(resources_directory / kProductResourceFilename);
    auto execution_binding = read_compiled_graph(resources_directory / kGraphResourceFilename);
    if (!product || !execution_binding) {
      return std::nullopt;
    }
    const auto product_name = utf8_to_wide(product->name);
    if (!product_name || inner_filename != std::filesystem::path(*product_name + L".vst3")) {
      return std::nullopt;
    }
    return ProductRuntimeContext{std::move(*product), *execution_binding};
  } catch (...) {
    return std::nullopt;
  }
}

} // namespace garak::adapter::vst3::product_runtime_v1
