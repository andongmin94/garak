#ifndef GARAK_RUNTIME_PRODUCT_V1_COMPILED_PRODUCT_HPP_INCLUDED
#define GARAK_RUNTIME_PRODUCT_V1_COMPILED_PRODUCT_HPP_INCLUDED

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <string_view>

namespace garak::runtime::product_v1 {

inline constexpr std::size_t kIdentifierSize = 16;
inline constexpr std::size_t kCompiledProductHeaderSize = 96;
inline constexpr std::size_t kCompiledParameterRecordSize = 24;
inline constexpr std::size_t kCompiledParameterCount = 2;
inline constexpr std::size_t kMaximumVendorBytes = 63;
inline constexpr std::size_t kMaximumProductNameBytes = 52;
inline constexpr std::size_t kMaximumCompiledProductBytes =
    kCompiledProductHeaderSize + kMaximumVendorBytes + kMaximumProductNameBytes +
    (kCompiledParameterRecordSize * kCompiledParameterCount);

inline constexpr std::uint32_t kGainParameterId = 1001;
inline constexpr std::uint32_t kBypassParameterId = 1002;

using Identifier = std::array<std::uint8_t, kIdentifierSize>;

enum class IdentityRole : std::uint8_t { processor, controller };

enum class ParameterType : std::uint8_t {
  invalid = 0,
  continuous = 1,
  boolean = 2,
};

enum class ParameterFlags : std::uint8_t {
  invalid = 0,
  automatable = 1,
  automatable_bypass = 3,
};

struct SemanticVersion final {
  std::uint16_t major{};
  std::uint16_t minor{};
  std::uint16_t patch{};

  [[nodiscard]] friend constexpr bool operator==(const SemanticVersion&,
                                                 const SemanticVersion&) = default;
};

struct ParameterDefinition final {
  std::uint32_t id{};
  ParameterType type{};
  ParameterFlags flags{};
  double default_normalized{};

  [[nodiscard]] friend constexpr bool operator==(const ParameterDefinition&,
                                                 const ParameterDefinition&) = default;
};

struct CompiledProduct final {
  Identifier product_id{};
  Identifier processor_fuid{};
  Identifier controller_fuid{};
  SemanticVersion version{};
  std::string vendor;
  std::string name;
  std::array<ParameterDefinition, kCompiledParameterCount> parameters{};
};

[[nodiscard]] std::optional<CompiledProduct>
parse_compiled_product(std::span<const std::uint8_t> bytes);

[[nodiscard]] Identifier derive_fuid(const Identifier& product_id, IdentityRole role) noexcept;
[[nodiscard]] std::string canonical_product_id(const Identifier& product_id);
[[nodiscard]] std::string identifier_hex(const Identifier& identifier);

} // namespace garak::runtime::product_v1

#endif
