#include "public.sdk/source/common/commonstringconvert.h"
#include "public.sdk/source/vst/utility/stringconvert.h"

#include <cstddef>
#include <cstdint>
#include <string>

namespace Steinberg::Vst::StringConvert {

// The pinned VST3 SDK 3.8.0 host helper converts bounded UTF-16 one code unit
// at a time. These complete public overloads preserve supplementary Unicode
// without changing the exact third-party checkout.

std::u16string convert(const std::string& utf8_string) {
  return Steinberg::StringConvert::convert(utf8_string);
}

std::string convert(const std::u16string& string) {
  return Steinberg::StringConvert::convert(string);
}

std::string convert(const char* string, const std::uint32_t maximum) {
  return Steinberg::StringConvert::convert(string, maximum);
}

bool convert(const std::string& utf8_string, Steinberg::Vst::String128 output) {
  return convert(utf8_string, output, 128);
}

bool convert(const std::string& utf8_string, Steinberg::Vst::TChar* output,
             const std::uint32_t maximum_characters) {
  if (output == nullptr || maximum_characters == 0) {
    return false;
  }
  const auto converted = Steinberg::StringConvert::convert(utf8_string);
  if (converted.size() >= maximum_characters) {
    return false;
  }
  for (std::size_t index = 0; index < converted.size(); ++index) {
    output[index] = static_cast<Steinberg::Vst::TChar>(converted[index]);
  }
  output[converted.size()] = 0;
  return true;
}

std::string convert(const Steinberg::Vst::TChar* string) {
  if (string == nullptr) {
    return {};
  }
  std::size_t length = 0;
  while (string[length] != 0) {
    ++length;
  }
  std::u16string value;
  value.reserve(length);
  for (std::size_t index = 0; index < length; ++index) {
    value.push_back(static_cast<char16_t>(string[index]));
  }
  return Steinberg::StringConvert::convert(value);
}

std::string convert(const Steinberg::Vst::TChar* string, const std::uint32_t maximum) {
  if (string == nullptr) {
    return {};
  }
  std::u16string value;
  value.reserve(maximum);
  for (std::uint32_t index = 0; index < maximum && string[index] != 0; ++index) {
    value.push_back(static_cast<char16_t>(string[index]));
  }
  return Steinberg::StringConvert::convert(value);
}

} // namespace Steinberg::Vst::StringConvert
