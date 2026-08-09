#ifndef GARAK_NATIVE_TESTS_PRODUCT_V1_TEST_FIXTURES_HPP
#define GARAK_NATIVE_TESTS_PRODUCT_V1_TEST_FIXTURES_HPP

#include <array>
#include <cstddef>
#include <cstdint>

namespace garak::test::product_v1 {

consteval std::uint8_t hex_nibble(const char value) {
  return value >= '0' && value <= '9' ? static_cast<std::uint8_t>(value - '0')
                                      : static_cast<std::uint8_t>(value - 'A' + 10);
}

template <std::size_t Size> consteval auto bytes_from_hex(const char (&text)[Size]) {
  static_assert((Size - 1) % 2 == 0);
  std::array<std::uint8_t, (Size - 1) / 2> result{};
  for (std::size_t index = 0; index < result.size(); ++index) {
    result[index] = static_cast<std::uint8_t>((hex_nibble(text[index * 2]) << 4U) |
                                              hex_nibble(text[(index * 2) + 1]));
  }
  return result;
}

inline constexpr std::array<std::uint8_t, 16> kWarmProductId{
    0x6F, 0x0E, 0x50, 0xF1, 0xA2, 0xD4, 0x4B, 0x37, 0x8C, 0x9E, 0x1F, 0x2A, 0x3B, 0x4C, 0x5D, 0x6E};
inline constexpr std::array<std::uint8_t, 16> kWarmProcessorFuid{
    0x3B, 0xA9, 0x3D, 0xD6, 0xA0, 0x62, 0xC9, 0x7D, 0x89, 0xEC, 0x78, 0xF3, 0x65, 0x2F, 0x83, 0xC4};
inline constexpr std::array<std::uint8_t, 16> kWarmControllerFuid{
    0x00, 0xDD, 0x90, 0x00, 0xA5, 0x0F, 0x7F, 0x28, 0xF4, 0xAE, 0x08, 0x4C, 0xD2, 0x9C, 0x43, 0x30};
inline constexpr std::array<std::uint8_t, 16> kBrightProductId{
    0xC8, 0xA5, 0x6D, 0x90, 0x7E, 0x4B, 0x4A, 0xF1, 0x91, 0xD3, 0x2B, 0x6C, 0x8E, 0x0F, 0x13, 0x57};
inline constexpr std::array<std::uint8_t, 16> kBrightProcessorFuid{
    0xFC, 0xB1, 0xFD, 0xAE, 0xD3, 0xD9, 0x81, 0xA2, 0xAE, 0x3A, 0xE5, 0xA2, 0x08, 0x98, 0xC4, 0x49};
inline constexpr std::array<std::uint8_t, 16> kBrightControllerFuid{
    0x32, 0xD9, 0x33, 0xDF, 0xBD, 0x3C, 0x81, 0x10, 0xE0, 0x14, 0x82, 0x9E, 0xF5, 0xD6, 0x2E, 0xA3};

inline constexpr auto kWarmCompiledProduct = bytes_from_hex(
    "474152414B4350440100000060000000B100000000000000000000006F0E50F1A2D44B378C9E1F2A3B4C5D6E"
    "3BA93DD6A062C97D89EC78F3652F83C400DD9000A50F7F28F4AE084CD29C43300000010000000100010000001100"
    "100002000000476172616B205465737420417274697374417274697374204761696E205761726DE903000001000100"
    "000000000000E83F0000000000000000EA0300000200030000000000000000000000000000000000");
static_assert(kWarmCompiledProduct.size() == 177);

inline constexpr auto kBrightCompiledProduct = bytes_from_hex(
    "474152414B4350440100000060000000B30000000000000000000000C8A56D907E4B4AF191D32B6C8E0F1357"
    "FCB1FDAED3D981A2AE3AE5A20898C44932D933DFBD3C8110E014829EF5D62EA30000010000000100010000001100"
    "120002000000476172616B205465737420417274697374417274697374204761696E20427269676874E90300000100"
    "0100000000000000EC3F0000000000000000EA0300000200030000000000000000000000000000000000");
static_assert(kBrightCompiledProduct.size() == 179);

inline constexpr auto kWarmDefaultState = bytes_from_hex("474152414B5053540100000040000000"
                                                         "60000000000000006F0E50F1A2D44B37"
                                                         "8C9E1F2A3B4C5D6E0200100000000000"
                                                         "00000000000000000000000000000000"
                                                         "E903000001000000000000000000E83F"
                                                         "EA030000020000000000000000000000");
static_assert(kWarmDefaultState.size() == 96);

inline constexpr auto kBrightDefaultState = bytes_from_hex("474152414B5053540100000040000000"
                                                           "6000000000000000C8A56D907E4B4AF1"
                                                           "91D32B6C8E0F13570200100000000000"
                                                           "00000000000000000000000000000000"
                                                           "E903000001000000000000000000EC3F"
                                                           "EA030000020000000000000000000000");
static_assert(kBrightDefaultState.size() == 96);

} // namespace garak::test::product_v1

#endif
