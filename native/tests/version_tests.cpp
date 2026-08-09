#include <garak/core/version.hpp>

#include <iostream>
#include <sstream>
#include <string_view>

namespace {

int run_tests() {
  const auto numeric_version = garak::core::version();
  if (numeric_version.major != 0U || numeric_version.minor != 0U || numeric_version.patch != 0U) {
    std::cerr << "Expected numeric version 0.0.0, received " << numeric_version.major << '.'
              << numeric_version.minor << '.' << numeric_version.patch << '\n';
    return 1;
  }

  const auto text_version = garak::core::version_string();
  if (text_version != "0.0.0") {
    std::cerr << "Expected string version 0.0.0, received " << text_version << '\n';
    return 1;
  }

  std::ostringstream numeric_stream;
  numeric_stream << numeric_version.major << '.' << numeric_version.minor << '.'
                 << numeric_version.patch;
  const auto numeric_text = numeric_stream.str();
  if (std::string_view{numeric_text} != text_version) {
    std::cerr << "Numeric and string versions disagree: " << numeric_text << " versus "
              << text_version << '\n';
    return 1;
  }

  return 0;
}

} // namespace

int main() {
  try {
    return run_tests();
  } catch (...) {
    return 1;
  }
}
