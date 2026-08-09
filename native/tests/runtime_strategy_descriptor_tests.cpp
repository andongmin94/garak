#include "product_definition.hpp"

#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <optional>
#include <string>
#include <string_view>

namespace {

using garak::adapter::vst3::runtime_strategy_spike::class_id_string;
using garak::adapter::vst3::runtime_strategy_spike::ClassIdWords;
using garak::adapter::vst3::runtime_strategy_spike::parse_product_descriptor;
using garak::adapter::vst3::runtime_strategy_spike::ProductDefinition;

constexpr std::string_view kValidAlpha = "GARAK_PRODUCT_SPIKE_V1\n"
                                         "schema=1\n"
                                         "vendor=Garak\n"
                                         "product_name=Garak Data Alpha\n"
                                         "semantic_version=0.1.0\n"
                                         "processor_fuid=4B2B557251D44CE9914F9B105136FB7E\n"
                                         "controller_fuid=7A90454628B34A3497F05E7CC718F8A1\n"
                                         "gain_parameter_id=1001\n"
                                         "bypass_parameter_id=1002\n"
                                         "default_gain_db=-6.0\n"
                                         "category=Fx\n";

class TestContext final {
public:
  void expect(const bool condition, const std::string_view message) {
    if (!condition) {
      std::cerr << "FAIL: " << message << '\n';
      ++failures_;
    }
  }

  [[nodiscard]] int result() const noexcept { return failures_ == 0 ? EXIT_SUCCESS : EXIT_FAILURE; }

private:
  int failures_{};
};

[[nodiscard]] std::string replace_once(std::string source, const std::string_view before,
                                       const std::string_view after) {
  const auto offset = source.find(before);
  if (offset != std::string::npos) {
    source.replace(offset, before.size(), after);
  }
  return source;
}

void expect_invalid(TestContext& test, const std::string& descriptor,
                    const std::string_view message) {
  test.expect(!parse_product_descriptor(descriptor).has_value(), message);
}

void test_valid_descriptor(TestContext& test) {
  const auto parsed = parse_product_descriptor(kValidAlpha);
  test.expect(parsed.has_value(), "canonical Alpha descriptor parses");
  if (!parsed) {
    return;
  }
  const ClassIdWords expected_processor{{0x4B2B5572, 0x51D44CE9, 0x914F9B10, 0x5136FB7E}};
  const ClassIdWords expected_controller{{0x7A904546, 0x28B34A34, 0x97F05E7C, 0xC718F8A1}};
  test.expect(parsed->vendor == "Garak", "vendor is exact");
  test.expect(parsed->product_name == "Garak Data Alpha", "product name is exact");
  test.expect(parsed->semantic_version == "0.1.0", "version is exact");
  test.expect(parsed->processor_fuid == expected_processor,
              "processor FUID is independently pinned");
  test.expect(parsed->controller_fuid == expected_controller,
              "controller FUID is independently pinned");
  test.expect(parsed->gain_parameter_id == 1001, "Gain ParamID is independently pinned");
  test.expect(parsed->bypass_parameter_id == 1002, "Bypass ParamID is independently pinned");
  test.expect(parsed->default_gain_db == -6.0, "Alpha default is -6 dB");
  test.expect(parsed->category == "Fx", "category is exact");
  test.expect(class_id_string(expected_processor) == "4B2B557251D44CE9914F9B105136FB7E",
              "FUID formatting is deterministic uppercase hex");
}

void test_shape_failures(TestContext& test) {
  expect_invalid(test, "", "empty descriptor is rejected");
  expect_invalid(test, std::string(kValidAlpha.substr(0, kValidAlpha.size() - 1)),
                 "missing final LF is rejected");
  expect_invalid(test, "\xEF\xBB\xBF" + std::string(kValidAlpha), "UTF-8 BOM is rejected");
  expect_invalid(test, replace_once(std::string(kValidAlpha), "schema=1\n", "schema=1\r\n"),
                 "CR is rejected");
  auto nul = std::string(kValidAlpha);
  nul[10] = '\0';
  expect_invalid(test, nul, "NUL is rejected");
  expect_invalid(test, std::string(1025, 'A') + "\n", "oversized descriptor is rejected");
  expect_invalid(
      test,
      replace_once(std::string(kValidAlpha), "GARAK_PRODUCT_SPIKE_V1", "GARAK_PRODUCT_SPIKE_V2"),
      "wrong magic is rejected");
  expect_invalid(test, replace_once(std::string(kValidAlpha), "schema=1", "schema=2"),
                 "unsupported schema is rejected");
  expect_invalid(test, replace_once(std::string(kValidAlpha), "vendor=Garak\n", ""),
                 "missing field is rejected");
  expect_invalid(
      test,
      replace_once(std::string(kValidAlpha), "vendor=Garak\n", "vendor=Garak\nvendor=Garak\n"),
      "duplicate field is rejected");
  expect_invalid(test, std::string(kValidAlpha) + "unexpected=value\n",
                 "unexpected trailing field is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha), "vendor=Garak\nproduct_name=",
                              "product_name=Garak Data Alpha\nvendor="),
                 "field reorder is rejected");
}

void test_value_failures(TestContext& test) {
  expect_invalid(test, replace_once(std::string(kValidAlpha), "vendor=Garak", "vendor="),
                 "empty vendor is rejected");
  expect_invalid(
      test,
      replace_once(std::string(kValidAlpha), "vendor=Garak", "vendor=" + std::string(64, 'V')),
      "oversized vendor is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha), "product_name=Garak Data Alpha",
                              "product_name=Garak:Data"),
                 "filename-unsafe product name is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha), "product_name=Garak Data Alpha",
                              "product_name=.Garak"),
                 "leading dot is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha),
                              "processor_fuid=4B2B557251D44CE9914F9B105136FB7E",
                              "processor_fuid=4b2b557251d44ce9914f9b105136fb7e"),
                 "lowercase FUID is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha),
                              "processor_fuid=4B2B557251D44CE9914F9B105136FB7E",
                              "processor_fuid=XYZ"),
                 "malformed FUID is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha),
                              "processor_fuid=4B2B557251D44CE9914F9B105136FB7E",
                              "processor_fuid=00000000000000000000000000000000"),
                 "all-zero processor FUID is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha),
                              "controller_fuid=7A90454628B34A3497F05E7CC718F8A1",
                              "controller_fuid=4B2B557251D44CE9914F9B105136FB7E"),
                 "duplicate processor/controller FUID is rejected");
  expect_invalid(
      test, replace_once(std::string(kValidAlpha), "gain_parameter_id=1001", "gain_parameter_id=0"),
      "zero ParamID is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha), "bypass_parameter_id=1002",
                              "bypass_parameter_id=1001"),
                 "duplicate ParamID is rejected");
  expect_invalid(test,
                 replace_once(std::string(kValidAlpha), "gain_parameter_id=1001",
                              "gain_parameter_id=2147483648"),
                 "ParamID above signed range is rejected");
  expect_invalid(
      test, replace_once(std::string(kValidAlpha), "default_gain_db=-6.0", "default_gain_db=-60.1"),
      "gain below minimum is rejected");
  expect_invalid(
      test, replace_once(std::string(kValidAlpha), "default_gain_db=-6.0", "default_gain_db=12.1"),
      "gain above maximum is rejected");
  expect_invalid(
      test, replace_once(std::string(kValidAlpha), "default_gain_db=-6.0", "default_gain_db=nan"),
      "non-finite gain is rejected");
  expect_invalid(test, replace_once(std::string(kValidAlpha), "category=Fx", "category=Fx/Bad"),
                 "path separator is rejected in category");
}

} // namespace

int main() {
  try {
    TestContext test;
    test_valid_descriptor(test);
    test_shape_failures(test);
    test_value_failures(test);
    return test.result();
  } catch (...) {
    std::fputs("Unhandled descriptor test exception\n", stderr);
    return EXIT_FAILURE;
  }
}
