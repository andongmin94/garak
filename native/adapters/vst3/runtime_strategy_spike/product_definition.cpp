#include "product_definition.hpp"

#include "gain_kernel.hpp"

#include <charconv>
#include <cmath>
#include <limits>

namespace garak::adapter::vst3::runtime_strategy_spike {
namespace {

constexpr std::string_view kMagic = "GARAK_PRODUCT_SPIKE_V1";

[[nodiscard]] bool is_printable_field(const std::string_view value,
                                      const std::size_t maximum_size) noexcept {
  if (value.empty() || value.size() > maximum_size) {
    return false;
  }
  for (const auto character : value) {
    const auto byte = static_cast<unsigned char>(character);
    if (byte < 0x20U || byte > 0x7EU || character == '=' || character == '/' || character == '\\') {
      return false;
    }
  }
  return true;
}

[[nodiscard]] bool is_safe_product_name(const std::string_view value) noexcept {
  if (!is_printable_field(value, kMaximumProductNameBytes) || value.front() == ' ' ||
      value.front() == '.' || value.back() == ' ' || value.back() == '.') {
    return false;
  }
  for (const auto character : value) {
    const bool valid = (character >= 'A' && character <= 'Z') ||
                       (character >= 'a' && character <= 'z') ||
                       (character >= '0' && character <= '9') || character == ' ' ||
                       character == '.' || character == '_' || character == '-';
    if (!valid) {
      return false;
    }
  }
  return true;
}

[[nodiscard]] bool parse_hex_word(const std::string_view text, std::uint32_t& value) noexcept {
  if (text.size() != 8) {
    return false;
  }
  for (const auto character : text) {
    if (!((character >= '0' && character <= '9') || (character >= 'A' && character <= 'F'))) {
      return false;
    }
  }
  const auto result = std::from_chars(text.data(), text.data() + text.size(), value, 16);
  return result.ec == std::errc{} && result.ptr == text.data() + text.size();
}

[[nodiscard]] bool parse_class_id(const std::string_view text, ClassIdWords& value) noexcept {
  if (text.size() != 32) {
    return false;
  }
  ClassIdWords parsed{};
  for (std::size_t index = 0; index < parsed.words.size(); ++index) {
    if (!parse_hex_word(text.substr(index * 8, 8), parsed.words[index])) {
      return false;
    }
  }
  value = parsed;
  return true;
}

[[nodiscard]] bool parse_unsigned(const std::string_view text, std::uint32_t& value) noexcept {
  std::uint32_t parsed = 0;
  const auto result = std::from_chars(text.data(), text.data() + text.size(), parsed, 10);
  if (text.empty() || result.ec != std::errc{} || result.ptr != text.data() + text.size() ||
      parsed == 0 ||
      parsed > static_cast<std::uint32_t>(std::numeric_limits<std::int32_t>::max())) {
    return false;
  }
  value = parsed;
  return true;
}

[[nodiscard]] bool parse_double_value(const std::string_view text, double& value) noexcept {
  double parsed = 0.0;
  const auto result =
      std::from_chars(text.data(), text.data() + text.size(), parsed, std::chars_format::general);
  if (text.empty() || result.ec != std::errc{} || result.ptr != text.data() + text.size() ||
      !std::isfinite(parsed)) {
    return false;
  }
  value = parsed;
  return true;
}

[[nodiscard]] bool take_line(std::string_view& remaining, std::string_view& line) noexcept {
  const auto newline = remaining.find('\n');
  if (newline == std::string_view::npos) {
    return false;
  }
  line = remaining.substr(0, newline);
  remaining.remove_prefix(newline + 1);
  return true;
}

[[nodiscard]] bool take_value(std::string_view& remaining, const std::string_view key,
                              std::string_view& value) noexcept {
  std::string_view line;
  if (!take_line(remaining, line) || !line.starts_with(key) || line.size() <= key.size()) {
    return false;
  }
  value = line.substr(key.size());
  return true;
}

[[nodiscard]] bool is_nonzero_class_id(const ClassIdWords& value) noexcept {
  for (const auto word : value.words) {
    if (word != 0) {
      return true;
    }
  }
  return false;
}

} // namespace

bool is_valid_product_definition(const ProductDefinition& product) noexcept {
  return is_printable_field(product.vendor, kMaximumVendorBytes) &&
         is_safe_product_name(product.product_name) &&
         is_printable_field(product.semantic_version, kMaximumVersionBytes) &&
         is_printable_field(product.category, kMaximumCategoryBytes) &&
         is_nonzero_class_id(product.processor_fuid) &&
         is_nonzero_class_id(product.controller_fuid) &&
         product.processor_fuid != product.controller_fuid && product.gain_parameter_id != 0 &&
         product.bypass_parameter_id != 0 &&
         product.gain_parameter_id <=
             static_cast<std::uint32_t>(std::numeric_limits<std::int32_t>::max()) &&
         product.bypass_parameter_id <=
             static_cast<std::uint32_t>(std::numeric_limits<std::int32_t>::max()) &&
         product.gain_parameter_id != product.bypass_parameter_id &&
         std::isfinite(product.default_gain_db) &&
         product.default_gain_db >= garak::spike::gain::kMinimumDecibels &&
         product.default_gain_db <= garak::spike::gain::kMaximumDecibels;
}

std::optional<ProductDefinition> parse_product_descriptor(const std::string_view descriptor) {
  if (descriptor.empty() || descriptor.size() > kMaximumDescriptorBytes ||
      descriptor.back() != '\n' || descriptor.find('\r') != std::string_view::npos ||
      descriptor.find('\0') != std::string_view::npos) {
    return std::nullopt;
  }
  for (const auto character : descriptor) {
    const auto byte = static_cast<unsigned char>(character);
    if (character != '\n' && (byte < 0x20U || byte > 0x7EU)) {
      return std::nullopt;
    }
  }

  std::string_view remaining = descriptor;
  std::string_view line;
  if (!take_line(remaining, line) || line != kMagic) {
    return std::nullopt;
  }

  ProductDefinition parsed{};
  std::string_view value;
  if (!take_value(remaining, "schema=", value) || value != "1") {
    return std::nullopt;
  }
  if (!take_value(remaining, "vendor=", value)) {
    return std::nullopt;
  }
  parsed.vendor = value;
  if (!take_value(remaining, "product_name=", value)) {
    return std::nullopt;
  }
  parsed.product_name = value;
  if (!take_value(remaining, "semantic_version=", value)) {
    return std::nullopt;
  }
  parsed.semantic_version = value;
  if (!take_value(remaining, "processor_fuid=", value) ||
      !parse_class_id(value, parsed.processor_fuid) ||
      !take_value(remaining, "controller_fuid=", value) ||
      !parse_class_id(value, parsed.controller_fuid) ||
      !take_value(remaining, "gain_parameter_id=", value) ||
      !parse_unsigned(value, parsed.gain_parameter_id) ||
      !take_value(remaining, "bypass_parameter_id=", value) ||
      !parse_unsigned(value, parsed.bypass_parameter_id) ||
      !take_value(remaining, "default_gain_db=", value) ||
      !parse_double_value(value, parsed.default_gain_db)) {
    return std::nullopt;
  }
  if (!take_value(remaining, "category=", value)) {
    return std::nullopt;
  }
  parsed.category = value;
  if (!remaining.empty() || !is_valid_product_definition(parsed)) {
    return std::nullopt;
  }
  return parsed;
}

std::string class_id_string(const ClassIdWords& class_id) {
  constexpr char kHex[] = "0123456789ABCDEF";
  std::string result(32, '0');
  for (std::size_t word = 0; word < class_id.words.size(); ++word) {
    for (std::size_t nibble = 0; nibble < 8; ++nibble) {
      const auto shift = static_cast<unsigned>((7 - nibble) * 4);
      result[(word * 8) + nibble] = kHex[(class_id.words[word] >> shift) & 0xFU];
    }
  }
  return result;
}

} // namespace garak::adapter::vst3::runtime_strategy_spike
