#include "garak/runtime/product_v1/compiled_product.hpp"

#include <algorithm>
#include <array>
#include <bit>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <span>
#include <string>
#include <string_view>

namespace garak::runtime::product_v1 {
namespace {

constexpr std::array<std::uint8_t, 8> kMagic{'G', 'A', 'R', 'A', 'K', 'C', 'P', 'D'};
constexpr std::string_view kIdentityNamespace = "garak.vst3-product-identity.v1";
constexpr std::array<std::uint32_t, 64> kSha256Constants{
    0x428A2F98U, 0x71374491U, 0xB5C0FBCFU, 0xE9B5DBA5U, 0x3956C25BU, 0x59F111F1U, 0x923F82A4U,
    0xAB1C5ED5U, 0xD807AA98U, 0x12835B01U, 0x243185BEU, 0x550C7DC3U, 0x72BE5D74U, 0x80DEB1FEU,
    0x9BDC06A7U, 0xC19BF174U, 0xE49B69C1U, 0xEFBE4786U, 0x0FC19DC6U, 0x240CA1CCU, 0x2DE92C6FU,
    0x4A7484AAU, 0x5CB0A9DCU, 0x76F988DAU, 0x983E5152U, 0xA831C66DU, 0xB00327C8U, 0xBF597FC7U,
    0xC6E00BF3U, 0xD5A79147U, 0x06CA6351U, 0x14292967U, 0x27B70A85U, 0x2E1B2138U, 0x4D2C6DFCU,
    0x53380D13U, 0x650A7354U, 0x766A0ABBU, 0x81C2C92EU, 0x92722C85U, 0xA2BFE8A1U, 0xA81A664BU,
    0xC24B8B70U, 0xC76C51A3U, 0xD192E819U, 0xD6990624U, 0xF40E3585U, 0x106AA070U, 0x19A4C116U,
    0x1E376C08U, 0x2748774CU, 0x34B0BCB5U, 0x391C0CB3U, 0x4ED8AA4AU, 0x5B9CCA4FU, 0x682E6FF3U,
    0x748F82EEU, 0x78A5636FU, 0x84C87814U, 0x8CC70208U, 0x90BEFFFAU, 0xA4506CEBU, 0xBEF9A3F7U,
    0xC67178F2U};

[[nodiscard]] constexpr std::uint16_t read_u16(const std::span<const std::uint8_t> bytes,
                                               const std::size_t offset) noexcept {
  return static_cast<std::uint16_t>(bytes[offset]) |
         static_cast<std::uint16_t>(static_cast<std::uint16_t>(bytes[offset + 1]) << 8U);
}

[[nodiscard]] constexpr std::uint32_t read_u32(const std::span<const std::uint8_t> bytes,
                                               const std::size_t offset) noexcept {
  std::uint32_t value = 0;
  for (std::size_t index = 0; index < 4; ++index) {
    value |= static_cast<std::uint32_t>(bytes[offset + index]) << (index * 8U);
  }
  return value;
}

[[nodiscard]] constexpr std::uint64_t read_u64(const std::span<const std::uint8_t> bytes,
                                               const std::size_t offset) noexcept {
  std::uint64_t value = 0;
  for (std::size_t index = 0; index < 8; ++index) {
    value |= static_cast<std::uint64_t>(bytes[offset + index]) << (index * 8U);
  }
  return value;
}

[[nodiscard]] constexpr std::uint32_t rotate_right(const std::uint32_t value,
                                                   const unsigned count) noexcept {
  return (value >> count) | (value << (32U - count));
}

[[nodiscard]] std::array<std::uint8_t, 32>
sha256(const std::span<const std::uint8_t> input) noexcept {
  std::array<std::uint8_t, 128> padded{};
  std::copy(input.begin(), input.end(), padded.begin());
  padded[input.size()] = 0x80U;
  const auto bit_length = static_cast<std::uint64_t>(input.size()) * 8U;
  for (std::size_t index = 0; index < 8; ++index) {
    padded[padded.size() - 1 - index] = static_cast<std::uint8_t>(bit_length >> (index * 8U));
  }

  std::array<std::uint32_t, 8> hash{0x6A09E667U, 0xBB67AE85U, 0x3C6EF372U, 0xA54FF53AU,
                                    0x510E527FU, 0x9B05688CU, 0x1F83D9ABU, 0x5BE0CD19U};
  for (std::size_t block = 0; block < 2; ++block) {
    std::array<std::uint32_t, 64> words{};
    const auto block_offset = block * 64;
    for (std::size_t index = 0; index < 16; ++index) {
      const auto offset = block_offset + (index * 4);
      words[index] = (static_cast<std::uint32_t>(padded[offset]) << 24U) |
                     (static_cast<std::uint32_t>(padded[offset + 1]) << 16U) |
                     (static_cast<std::uint32_t>(padded[offset + 2]) << 8U) |
                     static_cast<std::uint32_t>(padded[offset + 3]);
    }
    for (std::size_t index = 16; index < words.size(); ++index) {
      const auto value15 = words[index - 15];
      const auto value2 = words[index - 2];
      const auto sigma0 = rotate_right(value15, 7) ^ rotate_right(value15, 18) ^ (value15 >> 3U);
      const auto sigma1 = rotate_right(value2, 17) ^ rotate_right(value2, 19) ^ (value2 >> 10U);
      words[index] = words[index - 16] + sigma0 + words[index - 7] + sigma1;
    }

    auto a = hash[0];
    auto b = hash[1];
    auto c = hash[2];
    auto d = hash[3];
    auto e = hash[4];
    auto f = hash[5];
    auto g = hash[6];
    auto h = hash[7];
    for (std::size_t index = 0; index < words.size(); ++index) {
      const auto sum1 = rotate_right(e, 6) ^ rotate_right(e, 11) ^ rotate_right(e, 25);
      const auto choice = (e & f) ^ ((~e) & g);
      const auto temporary1 = h + sum1 + choice + kSha256Constants[index] + words[index];
      const auto sum0 = rotate_right(a, 2) ^ rotate_right(a, 13) ^ rotate_right(a, 22);
      const auto majority = (a & b) ^ (a & c) ^ (b & c);
      const auto temporary2 = sum0 + majority;
      h = g;
      g = f;
      f = e;
      e = d + temporary1;
      d = c;
      c = b;
      b = a;
      a = temporary1 + temporary2;
    }
    hash[0] += a;
    hash[1] += b;
    hash[2] += c;
    hash[3] += d;
    hash[4] += e;
    hash[5] += f;
    hash[6] += g;
    hash[7] += h;
  }

  std::array<std::uint8_t, 32> digest{};
  for (std::size_t word = 0; word < hash.size(); ++word) {
    for (std::size_t byte = 0; byte < 4; ++byte) {
      digest[(word * 4) + byte] = static_cast<std::uint8_t>(hash[word] >> ((3U - byte) * 8U));
    }
  }
  return digest;
}

[[nodiscard]] bool is_zero(const Identifier& identifier) noexcept {
  return std::all_of(identifier.begin(), identifier.end(),
                     [](const std::uint8_t byte) { return byte == 0; });
}

[[nodiscard]] constexpr bool is_unicode_whitespace(const std::uint32_t code_point) noexcept {
  return code_point == 0x20U || code_point == 0xA0U || code_point == 0x1680U ||
         (code_point >= 0x2000U && code_point <= 0x200AU) || code_point == 0x2028U ||
         code_point == 0x2029U || code_point == 0x202FU || code_point == 0x205FU ||
         code_point == 0x3000U || code_point == 0xFEFFU;
}

[[nodiscard]] bool valid_utf8_display(const std::string_view text,
                                      const std::size_t maximum_bytes) noexcept {
  if (text.empty() || text.size() > maximum_bytes) {
    return false;
  }

  bool has_non_space = false;
  std::size_t offset = 0;
  while (offset < text.size()) {
    const auto first = static_cast<std::uint8_t>(text[offset]);
    std::uint32_t code_point = 0;
    std::size_t continuation_count = 0;
    if (first <= 0x7FU) {
      code_point = first;
    } else if (first >= 0xC2U && first <= 0xDFU) {
      code_point = first & 0x1FU;
      continuation_count = 1;
    } else if (first >= 0xE0U && first <= 0xEFU) {
      code_point = first & 0x0FU;
      continuation_count = 2;
    } else if (first >= 0xF0U && first <= 0xF4U) {
      code_point = first & 0x07U;
      continuation_count = 3;
    } else {
      return false;
    }
    if (offset + continuation_count >= text.size()) {
      return false;
    }
    for (std::size_t index = 1; index <= continuation_count; ++index) {
      const auto byte = static_cast<std::uint8_t>(text[offset + index]);
      if ((byte & 0xC0U) != 0x80U) {
        return false;
      }
      code_point = (code_point << 6U) | (byte & 0x3FU);
    }
    if ((continuation_count == 2 &&
         ((first == 0xE0U && static_cast<std::uint8_t>(text[offset + 1]) < 0xA0U) ||
          (first == 0xEDU && static_cast<std::uint8_t>(text[offset + 1]) >= 0xA0U))) ||
        (continuation_count == 3 &&
         ((first == 0xF0U && static_cast<std::uint8_t>(text[offset + 1]) < 0x90U) ||
          (first == 0xF4U && static_cast<std::uint8_t>(text[offset + 1]) >= 0x90U))) ||
        code_point > 0x10FFFFU || (code_point >= 0xD800U && code_point <= 0xDFFFU) ||
        code_point <= 0x1FU || (code_point >= 0x7FU && code_point <= 0x9FU)) {
      return false;
    }
    if (code_point == 0xFEFFU) {
      return false;
    }
    has_non_space = has_non_space || !is_unicode_whitespace(code_point);
    offset += continuation_count + 1;
  }
  return has_non_space;
}

[[nodiscard]] bool is_windows_reserved_name(const std::string_view name) {
  const auto dot = name.find('.');
  const auto base = name.substr(0, dot);
  std::string uppercase;
  uppercase.reserve(base.size());
  for (const auto character : base) {
    const auto byte = static_cast<unsigned char>(character);
    uppercase.push_back(byte <= 0x7FU && character >= 'a' && character <= 'z'
                            ? static_cast<char>(character - ('a' - 'A'))
                            : character);
  }
  if (uppercase == "CON" || uppercase == "PRN" || uppercase == "AUX" || uppercase == "NUL" ||
      uppercase == "CLOCK$" || uppercase == "CONIN$" || uppercase == "CONOUT$") {
    return true;
  }
  const auto numbered_device = uppercase.starts_with("COM") || uppercase.starts_with("LPT");
  if (numbered_device && uppercase.size() == 4 && uppercase[3] >= '1' && uppercase[3] <= '9') {
    return true;
  }
  if (!numbered_device || uppercase.size() != 5 ||
      static_cast<unsigned char>(uppercase[3]) != 0xC2U) {
    return false;
  }
  const auto superscript = static_cast<unsigned char>(uppercase[4]);
  return superscript == 0xB9U || superscript == 0xB2U || superscript == 0xB3U;
}

[[nodiscard]] bool valid_product_name(const std::string_view name) {
  if (!valid_utf8_display(name, kMaximumProductNameBytes) || name.back() == ' ' ||
      name.back() == '.' || is_windows_reserved_name(name)) {
    return false;
  }
  constexpr std::string_view kInvalidCharacters = "<>:\"/\\|?*";
  for (const auto character : name) {
    if (kInvalidCharacters.find(character) != std::string_view::npos) {
      return false;
    }
  }
  return true;
}

[[nodiscard]] Identifier read_identifier(const std::span<const std::uint8_t> bytes,
                                         const std::size_t offset) noexcept {
  Identifier result{};
  std::copy_n(bytes.begin() + static_cast<std::ptrdiff_t>(offset), result.size(), result.begin());
  return result;
}

[[nodiscard]] bool valid_parameter(const ParameterDefinition& parameter,
                                   const std::size_t index) noexcept {
  if (!std::isfinite(parameter.default_normalized) || parameter.default_normalized < 0.0 ||
      parameter.default_normalized > 1.0 || std::signbit(parameter.default_normalized)) {
    return false;
  }
  if (index == 0) {
    return parameter.id == kGainParameterId && parameter.type == ParameterType::continuous &&
           parameter.flags == ParameterFlags::automatable;
  }
  return parameter.id == kBypassParameterId && parameter.type == ParameterType::boolean &&
         parameter.flags == ParameterFlags::automatable_bypass &&
         std::bit_cast<std::uint64_t>(parameter.default_normalized) == 0;
}

} // namespace

Identifier derive_fuid(const Identifier& product_id, const IdentityRole role) noexcept {
  constexpr char kHex[] = "0123456789abcdef";
  std::array<std::uint8_t, 96> material{};
  std::size_t offset = 0;
  for (const auto character : kIdentityNamespace) {
    material[offset++] = static_cast<std::uint8_t>(character);
  }
  material[offset++] = 0;
  for (std::size_t index = 0; index < product_id.size(); ++index) {
    if (index == 4 || index == 6 || index == 8 || index == 10) {
      material[offset++] = static_cast<std::uint8_t>('-');
    }
    material[offset++] = static_cast<std::uint8_t>(kHex[product_id[index] >> 4U]);
    material[offset++] = static_cast<std::uint8_t>(kHex[product_id[index] & 0x0FU]);
  }
  material[offset++] = 0;
  const auto role_text = role == IdentityRole::processor ? std::string_view("processor")
                                                         : std::string_view("controller");
  for (const auto character : role_text) {
    material[offset++] = static_cast<std::uint8_t>(character);
  }
  const auto digest = sha256(std::span<const std::uint8_t>(material.data(), offset));
  Identifier result{};
  std::copy_n(digest.begin(), result.size(), result.begin());
  return result;
}

std::optional<CompiledProduct> parse_compiled_product(const std::span<const std::uint8_t> bytes) {
  if (bytes.size() < kCompiledProductHeaderSize || bytes.size() > kMaximumCompiledProductBytes ||
      !std::equal(kMagic.begin(), kMagic.end(), bytes.begin()) || read_u16(bytes, 8) != 1 ||
      read_u16(bytes, 10) != 0 || read_u32(bytes, 12) != kCompiledProductHeaderSize ||
      read_u32(bytes, 16) != bytes.size() || read_u32(bytes, 20) != 0 || read_u32(bytes, 24) != 0 ||
      read_u16(bytes, 82) != 1 || read_u32(bytes, 84) != 1 ||
      read_u16(bytes, 92) != kCompiledParameterCount || read_u16(bytes, 94) != 0) {
    return std::nullopt;
  }

  const auto vendor_size = static_cast<std::size_t>(read_u16(bytes, 88));
  const auto name_size = static_cast<std::size_t>(read_u16(bytes, 90));
  const auto expected_size = kCompiledProductHeaderSize + vendor_size + name_size +
                             (kCompiledParameterRecordSize * kCompiledParameterCount);
  if (vendor_size > kMaximumVendorBytes || name_size > kMaximumProductNameBytes ||
      expected_size != bytes.size()) {
    return std::nullopt;
  }

  CompiledProduct parsed{};
  parsed.product_id = read_identifier(bytes, 28);
  parsed.processor_fuid = read_identifier(bytes, 44);
  parsed.controller_fuid = read_identifier(bytes, 60);
  parsed.version = {read_u16(bytes, 76), read_u16(bytes, 78), read_u16(bytes, 80)};
  const auto vendor_offset = kCompiledProductHeaderSize;
  const auto name_offset = vendor_offset + vendor_size;
  parsed.vendor.assign(reinterpret_cast<const char*>(bytes.data() + vendor_offset), vendor_size);
  parsed.name.assign(reinterpret_cast<const char*>(bytes.data() + name_offset), name_size);

  if (is_zero(parsed.product_id) || is_zero(parsed.processor_fuid) ||
      is_zero(parsed.controller_fuid) || parsed.processor_fuid == parsed.controller_fuid ||
      parsed.processor_fuid != derive_fuid(parsed.product_id, IdentityRole::processor) ||
      parsed.controller_fuid != derive_fuid(parsed.product_id, IdentityRole::controller) ||
      !valid_utf8_display(parsed.vendor, kMaximumVendorBytes) || !valid_product_name(parsed.name)) {
    return std::nullopt;
  }

  const auto parameter_offset = name_offset + name_size;
  for (std::size_t index = 0; index < parsed.parameters.size(); ++index) {
    const auto offset = parameter_offset + (index * kCompiledParameterRecordSize);
    const auto encoded_type = read_u16(bytes, offset + 4);
    const auto encoded_flags = read_u16(bytes, offset + 6);
    const auto expected_type =
        static_cast<std::uint16_t>(index == 0 ? ParameterType::continuous : ParameterType::boolean);
    const auto expected_flags = static_cast<std::uint16_t>(
        index == 0 ? ParameterFlags::automatable : ParameterFlags::automatable_bypass);
    if (encoded_type != expected_type || encoded_flags != expected_flags) {
      return std::nullopt;
    }
    parsed.parameters[index] = {read_u32(bytes, offset), static_cast<ParameterType>(encoded_type),
                                static_cast<ParameterFlags>(encoded_flags),
                                std::bit_cast<double>(read_u64(bytes, offset + 8))};
    if (read_u32(bytes, offset + 16) != 0 || read_u32(bytes, offset + 20) != 0 ||
        !valid_parameter(parsed.parameters[index], index)) {
      return std::nullopt;
    }
  }
  return parsed;
}

std::string canonical_product_id(const Identifier& product_id) {
  constexpr char kHex[] = "0123456789abcdef";
  std::string result;
  result.reserve(36);
  for (std::size_t index = 0; index < product_id.size(); ++index) {
    if (index == 4 || index == 6 || index == 8 || index == 10) {
      result.push_back('-');
    }
    result.push_back(kHex[product_id[index] >> 4U]);
    result.push_back(kHex[product_id[index] & 0x0FU]);
  }
  return result;
}

std::string identifier_hex(const Identifier& identifier) {
  constexpr char kHex[] = "0123456789ABCDEF";
  std::string result;
  result.reserve(identifier.size() * 2);
  for (const auto byte : identifier) {
    result.push_back(kHex[byte >> 4U]);
    result.push_back(kHex[byte & 0x0FU]);
  }
  return result;
}

} // namespace garak::runtime::product_v1
