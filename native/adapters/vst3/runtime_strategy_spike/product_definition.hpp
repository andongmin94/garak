#ifndef GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_PRODUCT_DEFINITION_HPP_INCLUDED
#define GARAK_ADAPTERS_VST3_RUNTIME_STRATEGY_SPIKE_PRODUCT_DEFINITION_HPP_INCLUDED

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace garak::adapter::vst3::runtime_strategy_spike {

inline constexpr std::size_t kMaximumDescriptorBytes = 1024;
inline constexpr std::size_t kMaximumVendorBytes = 63;
inline constexpr std::size_t kMaximumProductNameBytes = 63;
inline constexpr std::size_t kMaximumVersionBytes = 63;
inline constexpr std::size_t kMaximumCategoryBytes = 31;
inline constexpr std::uint32_t kGainParameterId = 1001;
inline constexpr std::uint32_t kBypassParameterId = 1002;

struct ClassIdWords final {
  std::array<std::uint32_t, 4> words;

  [[nodiscard]] friend constexpr bool operator==(const ClassIdWords&,
                                                 const ClassIdWords&) = default;
};

struct ProductDefinition final {
  std::string vendor;
  std::string product_name;
  std::string semantic_version;
  ClassIdWords processor_fuid;
  ClassIdWords controller_fuid;
  std::uint32_t gain_parameter_id{};
  std::uint32_t bypass_parameter_id{};
  double default_gain_db{};
  std::string category;
};

[[nodiscard]] bool is_valid_product_definition(const ProductDefinition& product) noexcept;
[[nodiscard]] std::optional<ProductDefinition>
parse_product_descriptor(std::string_view descriptor);
[[nodiscard]] std::string class_id_string(const ClassIdWords& class_id);

} // namespace garak::adapter::vst3::runtime_strategy_spike

#endif
