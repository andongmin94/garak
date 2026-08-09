#include "descriptor_loader_win.hpp"

#include "public.sdk/source/main/moduleinit.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

#include <algorithm>
#include <array>
#include <filesystem>
#include <fstream>
#include <string>
#include <string_view>
#include <vector>

namespace garak::adapter::vst3::runtime_strategy_spike {
namespace {

constexpr std::size_t kInitialPathCharacters = 512;
constexpr std::size_t kMaximumPathCharacters = 32'768;
constexpr wchar_t kArchitectureDirectory[] = L"x86_64-win";
constexpr wchar_t kContentsDirectory[] = L"Contents";
constexpr wchar_t kDescriptorFilename[] = L"garak-product-spike-v1.txt";

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

[[nodiscard]] std::optional<std::string>
ascii_product_name(const std::filesystem::path& inner_filename) {
  const auto name = inner_filename.stem().native();
  if (name.empty() || name.size() > kMaximumProductNameBytes) {
    return std::nullopt;
  }

  std::string ascii;
  ascii.reserve(name.size());
  for (const auto character : name) {
    if (character < 0x20 || character > 0x7E) {
      return std::nullopt;
    }
    ascii.push_back(static_cast<char>(character));
  }
  return ascii;
}

[[nodiscard]] std::optional<ProductDefinition>
read_descriptor(const std::filesystem::path& descriptor_path) {
  std::ifstream input(descriptor_path, std::ios::binary);
  if (!input.is_open()) {
    return std::nullopt;
  }

  std::array<char, kMaximumDescriptorBytes + 1> bytes{};
  input.read(bytes.data(), static_cast<std::streamsize>(bytes.size()));
  const auto count = input.gcount();
  if (input.bad() || (input.fail() && !input.eof()) || count <= 0 ||
      count > static_cast<std::streamsize>(kMaximumDescriptorBytes)) {
    return std::nullopt;
  }

  return parse_product_descriptor(std::string_view(bytes.data(), static_cast<std::size_t>(count)));
}

} // namespace

std::optional<ProductDefinition> load_module_product_definition() noexcept {
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

    const auto product_name = ascii_product_name(inner_filename);
    if (!product_name) {
      return std::nullopt;
    }

    const auto descriptor_path =
        contents_directory / L"Resources" / std::filesystem::path(kDescriptorFilename);
    auto product = read_descriptor(descriptor_path);
    if (!product || product->product_name != *product_name) {
      return std::nullopt;
    }
    return product;
  } catch (...) {
    return std::nullopt;
  }
}

} // namespace garak::adapter::vst3::runtime_strategy_spike
