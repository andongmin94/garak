#include "product_v1_test_fixtures.hpp"

#include "gain_kernel.hpp"
#include "garak/runtime/product_v1/product_state.hpp"

#include "pluginterfaces/base/funknownimpl.h"
#include "pluginterfaces/base/ibstream.h"
#include "pluginterfaces/vst/ivstaudioprocessor.h"
#include "pluginterfaces/vst/ivstcomponent.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/vst/vstspeaker.h"
#include "public.sdk/source/vst/hosting/module.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <Windows.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

namespace {

constexpr Steinberg::Vst::ParamID kGainParameterId = 1001;
constexpr Steinberg::Vst::ParamID kBypassParameterId = 1002;
constexpr Steinberg::int32 kSampleCount = 4;
constexpr double kTolerance = 1.0e-10;
constexpr std::wstring_view kUnicodeFixtureParent = L"\uAC00\uB77D \uACBD\uB85C \U0001F4C1";

struct ExpectedProduct final {
  std::string_view name;
  std::string_view processor;
  std::string_view controller;
  double default_db;
  garak::runtime::product_v1::Identifier product_id;
};

constexpr std::array<ExpectedProduct, 2> kProducts{{
    {"Artist Gain Warm", "3BA93DD6A062C97D89EC78F3652F83C4", "00DD9000A50F7F28F4AE084CD29C4330",
     -6.0, garak::test::product_v1::kWarmProductId},
    {"Artist Gain Bright", "FCB1FDAED3D981A2AE3AE5A20898C449", "32D933DFBD3C8110E014829EF5D62EA3",
     3.0, garak::test::product_v1::kBrightProductId},
}};

class TestContext final {
public:
  void expect(const bool condition, const std::string_view message) noexcept {
    if (!condition) {
      std::fprintf(stderr, "FAIL: %.*s\n", static_cast<int>(message.size()), message.data());
      ++failures_;
    }
  }

  [[nodiscard]] int result() const noexcept {
    return failures_ == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
  }

private:
  int failures_{};
};

class UniqueHandle final {
public:
  explicit UniqueHandle(const HANDLE value = nullptr) noexcept : value_(value) {}

  ~UniqueHandle() {
    if (value_ != nullptr && value_ != INVALID_HANDLE_VALUE) {
      CloseHandle(value_);
    }
  }

  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;

  UniqueHandle(UniqueHandle&& other) noexcept : value_(std::exchange(other.value_, nullptr)) {}

  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other) {
      if (value_ != nullptr && value_ != INVALID_HANDLE_VALUE) {
        CloseHandle(value_);
      }
      value_ = std::exchange(other.value_, nullptr);
    }
    return *this;
  }

  [[nodiscard]] HANDLE get() const noexcept { return value_; }

private:
  HANDLE value_{};
};

class FixedStream final
    : public Steinberg::U::ImplementsNonDestroyable<Steinberg::U::Directly<Steinberg::IBStream>> {
public:
  FixedStream() = default;
  explicit FixedStream(const std::span<const std::uint8_t> bytes) noexcept { assign(bytes); }

  Steinberg::tresult PLUGIN_API read(void* const buffer, const Steinberg::int32 count,
                                     Steinberg::int32* const read_count) override {
    if (read_count != nullptr) {
      *read_count = 0;
    }
    if (buffer == nullptr || count < 0 || cursor_ < 0 || cursor_ > size_ ||
        count > size_ - cursor_) {
      return Steinberg::kResultFalse;
    }
    const auto transferred = std::min(count, maximum_transfer_);
    std::memcpy(buffer, bytes_.data() + cursor_, static_cast<std::size_t>(transferred));
    cursor_ += transferred;
    if (read_count != nullptr) {
      *read_count = transferred;
    }
    return Steinberg::kResultTrue;
  }

  Steinberg::tresult PLUGIN_API write(void* const buffer, const Steinberg::int32 count,
                                      Steinberg::int32* const written) override {
    if (written != nullptr) {
      *written = 0;
    }
    if (buffer == nullptr || count < 0 || cursor_ < 0 ||
        count > static_cast<Steinberg::int32>(bytes_.size()) - cursor_) {
      return Steinberg::kResultFalse;
    }
    const auto transferred = std::min(count, maximum_transfer_);
    std::memcpy(bytes_.data() + cursor_, buffer, static_cast<std::size_t>(transferred));
    cursor_ += transferred;
    size_ = std::max(size_, cursor_);
    if (written != nullptr) {
      *written = transferred;
    }
    return Steinberg::kResultTrue;
  }

  // NOLINTNEXTLINE(bugprone-easily-swappable-parameters): fixed SDK IBStream ABI.
  Steinberg::tresult PLUGIN_API seek(const Steinberg::int64 position, const Steinberg::int32 mode,
                                     Steinberg::int64* const result) override {
    Steinberg::int64 base = 0;
    if (mode == Steinberg::IBStream::kIBSeekCur) {
      base = cursor_;
    } else if (mode == Steinberg::IBStream::kIBSeekEnd) {
      base = size_;
    } else if (mode != Steinberg::IBStream::kIBSeekSet) {
      return Steinberg::kInvalidArgument;
    }
    if (position < -base || position > size_ - base) {
      return Steinberg::kResultFalse;
    }
    cursor_ = static_cast<Steinberg::int32>(base + position);
    if (result != nullptr) {
      *result = cursor_;
    }
    return Steinberg::kResultTrue;
  }

  Steinberg::tresult PLUGIN_API tell(Steinberg::int64* const position) override {
    if (position == nullptr) {
      return Steinberg::kInvalidArgument;
    }
    *position = cursor_;
    return Steinberg::kResultTrue;
  }

  void assign(const std::span<const std::uint8_t> bytes) noexcept {
    bytes_.fill(0);
    if (bytes.size() <= bytes_.size()) {
      std::memcpy(bytes_.data(), bytes.data(), bytes.size());
      size_ = static_cast<Steinberg::int32>(bytes.size());
      cursor_ = 0;
    }
  }

  void rewind() noexcept { cursor_ = 0; }

  [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept {
    return {bytes_.data(), static_cast<std::size_t>(size_)};
  }

private:
  std::array<std::uint8_t, 128> bytes_{};
  Steinberg::int32 size_{};
  Steinberg::int32 cursor_{};
  Steinberg::int32 maximum_transfer_{128};
};

struct Session final {
  VST3::Hosting::Module::Ptr module;
  Steinberg::IPtr<Steinberg::Vst::IComponent> component;
  Steinberg::IPtr<Steinberg::Vst::IEditController> controller;
  Steinberg::FUnknownPtr<Steinberg::Vst::IAudioProcessor> processor;
  bool component_initialized{};
  bool controller_initialized{};
};

[[nodiscard]] Steinberg::FUID class_id(const std::string_view literal) {
  std::array<Steinberg::char8, 33> text{};
  if (literal.size() != 32) {
    return {};
  }
  std::copy(literal.begin(), literal.end(), text.begin());
  Steinberg::FUID result;
  if (!result.fromString(text.data())) {
    return {};
  }
  return result;
}

[[nodiscard]] double normalized(const double db) noexcept {
  return garak::spike::gain::decibels_to_normalized(db);
}

[[nodiscard]] double linear(const double db) noexcept {
  return garak::spike::gain::decibels_to_linear(db);
}

[[nodiscard]] bool nearly_equal(const double left, const double right) noexcept {
  return std::abs(left - right) <= kTolerance;
}

[[nodiscard]] std::unique_ptr<Session> load(TestContext& test, const std::filesystem::path& bundle,
                                            const ExpectedProduct& expected) {
  std::string error;
  auto module = VST3::Hosting::Module::create(bundle.generic_string(), error);
  test.expect(module != nullptr, "module loads");
  if (!module) {
    return nullptr;
  }

  const auto& factory = module->getFactory();
  const auto processor_id = class_id(expected.processor);
  const auto controller_id = class_id(expected.controller);
  const auto classes = factory.classInfos();
  bool saw_processor = false;
  bool saw_controller = false;
  for (const auto& info : classes) {
    const auto id = Steinberg::FUID::fromTUID(info.ID().data());
    if (id == processor_id) {
      saw_processor = info.name() == expected.name && info.subCategoriesString() == "Fx";
    } else if (id == controller_id) {
      saw_controller = info.name() == std::string(expected.name) + " Controller";
    }
  }
  test.expect(factory.classCount() == 2U && classes.size() == 2U && saw_processor && saw_controller,
              "factory exposes exact processor and controller identity");

  auto session = std::make_unique<Session>();
  session->module = std::move(module);
  session->component =
      factory.createInstance<Steinberg::Vst::IComponent>(VST3::UID(processor_id.toTUID()));
  session->controller =
      factory.createInstance<Steinberg::Vst::IEditController>(VST3::UID(controller_id.toTUID()));
  if (!session->component || !session->controller) {
    test.expect(false, "factory creates processor and controller");
    return nullptr;
  }

  session->processor = session->component.get();
  session->component_initialized =
      session->component->initialize(nullptr) == Steinberg::kResultTrue;
  session->controller_initialized =
      session->controller->initialize(nullptr) == Steinberg::kResultTrue;
  test.expect(session->processor != nullptr && session->component_initialized &&
                  session->controller_initialized,
              "processor and controller initialize");
  if (!session->processor || !session->component_initialized || !session->controller_initialized) {
    return nullptr;
  }

  Steinberg::TUID associated{};
  Steinberg::Vst::ParameterInfo gain{};
  Steinberg::Vst::ParameterInfo bypass{};
  test.expect(session->component->getControllerClassId(associated) == Steinberg::kResultTrue &&
                  Steinberg::FUID::fromTUID(associated) == controller_id &&
                  session->controller->getParameterCount() == 2 &&
                  session->controller->getParameterInfo(0, gain) == Steinberg::kResultTrue &&
                  session->controller->getParameterInfo(1, bypass) == Steinberg::kResultTrue &&
                  gain.id == kGainParameterId && bypass.id == kBypassParameterId &&
                  nearly_equal(gain.defaultNormalizedValue, normalized(expected.default_db)),
              "controller association, IDs, and default are exact");
  test.expect(
      session->component->getBusCount(Steinberg::Vst::kEvent, Steinberg::Vst::kInput) == 0 &&
          session->component->getBusCount(Steinberg::Vst::kAudio, Steinberg::Vst::kInput) == 1 &&
          session->component->getBusCount(Steinberg::Vst::kAudio, Steinberg::Vst::kOutput) == 1 &&
          session->controller->createView(Steinberg::Vst::ViewType::kEditor) == nullptr,
      "product has audio-only main buses and no custom editor");
  return session;
}

[[nodiscard]] bool begin(Session& session, const Steinberg::int32 precision) {
  auto input = Steinberg::Vst::SpeakerArr::kStereo;
  auto output = Steinberg::Vst::SpeakerArr::kStereo;
  Steinberg::Vst::ProcessSetup setup{};
  setup.processMode = Steinberg::Vst::kRealtime;
  setup.symbolicSampleSize = precision;
  setup.maxSamplesPerBlock = 64;
  setup.sampleRate = 48'000.0;
  return session.processor->setBusArrangements(&input, 1, &output, 1) == Steinberg::kResultTrue &&
         session.processor->setupProcessing(setup) == Steinberg::kResultTrue &&
         session.component->setActive(true) == Steinberg::kResultTrue &&
         session.processor->setProcessing(true) == Steinberg::kResultTrue;
}

void stop(TestContext& test, Session& session) {
  test.expect(session.processor->setProcessing(false) == Steinberg::kResultTrue &&
                  session.component->setActive(false) == Steinberg::kResultTrue,
              "processing stops cleanly");
}

template <typename Sample>
[[nodiscard]] Steinberg::tresult process_stereo(Session& session,
                                                std::array<Sample, kSampleCount>& left,
                                                std::array<Sample, kSampleCount>& right) {
  std::array<Sample, kSampleCount> output_left{};
  std::array<Sample, kSampleCount> output_right{};
  Sample* inputs[] = {left.data(), right.data()};
  Sample* outputs[] = {output_left.data(), output_right.data()};
  Steinberg::Vst::AudioBusBuffers input{};
  Steinberg::Vst::AudioBusBuffers output{};
  input.numChannels = 2;
  output.numChannels = 2;
  if constexpr (std::is_same_v<Sample, Steinberg::Vst::Sample32>) {
    input.channelBuffers32 = inputs;
    output.channelBuffers32 = outputs;
  } else {
    input.channelBuffers64 = inputs;
    output.channelBuffers64 = outputs;
  }
  Steinberg::Vst::ProcessData data{};
  data.processMode = Steinberg::Vst::kRealtime;
  data.symbolicSampleSize = std::is_same_v<Sample, Steinberg::Vst::Sample32>
                                ? Steinberg::Vst::kSample32
                                : Steinberg::Vst::kSample64;
  data.numSamples = kSampleCount;
  data.numInputs = 1;
  data.numOutputs = 1;
  data.inputs = &input;
  data.outputs = &output;
  const auto result = session.processor->process(data);
  left = output_left;
  right = output_right;
  return result;
}

[[nodiscard]] std::vector<std::uint8_t> encode_state(const ExpectedProduct& product,
                                                     const double gain) {
  garak::runtime::product_v1::EncodedProductState encoded{};
  if (!garak::runtime::product_v1::encode_product_state(product.product_id, {gain, false}, encoded)) {
    return {};
  }
  return {encoded.begin(), encoded.end()};
}

[[nodiscard]] bool decode_state(const ExpectedProduct& product,
                                const std::span<const std::uint8_t> bytes, double& gain) {
  garak::runtime::product_v1::ProductState state{};
  if (!garak::runtime::product_v1::decode_product_state(bytes, product.product_id, state)) {
    return false;
  }
  gain = state.gain_normalized;
  return !state.bypass;
}

[[nodiscard]] bool read_component_gain(Session& session, const ExpectedProduct& product,
                                       double& gain) {
  FixedStream output;
  return session.component->getState(&output) == Steinberg::kResultTrue &&
         decode_state(product, output.bytes(), gain);
}

void set_and_check_state(TestContext& test, Session& session, const ExpectedProduct& product,
                         const double gain) {
  const auto bytes = encode_state(product, gain);
  FixedStream component_input(bytes);
  test.expect(!bytes.empty() &&
                  session.component->setState(&component_input) == Steinberg::kResultTrue,
              "module accepts its product-bound state");

  FixedStream output;
  double decoded_gain = 0.0;
  test.expect(session.component->getState(&output) == Steinberg::kResultTrue &&
                  decode_state(product, output.bytes(), decoded_gain) && decoded_gain == gain,
              "module state round trip is exact");

  output.rewind();
  test.expect(session.controller->setComponentState(&output) == Steinberg::kResultTrue &&
                  session.controller->getParamNormalized(kGainParameterId) == gain,
              "controller restores the exact component state");
}

void check_foreign_state_rejection(TestContext& test, Session& bright,
                                   const ExpectedProduct& warm_product,
                                   const ExpectedProduct& bright_product) {
  double component_before = 0.0;
  test.expect(read_component_gain(bright, bright_product, component_before),
              "Bright state is readable before foreign-state rejection");
  const auto controller_gain_before = bright.controller->getParamNormalized(kGainParameterId);
  const auto controller_bypass_before = bright.controller->getParamNormalized(kBypassParameterId);
  const auto foreign = encode_state(warm_product, 0.5);

  FixedStream processor_input(foreign);
  test.expect(bright.component->setState(&processor_input) == Steinberg::kResultFalse,
              "Bright processor rejects Warm state");
  double component_after = 0.0;
  test.expect(read_component_gain(bright, bright_product, component_after) &&
                  component_after == component_before,
              "foreign processor state preserves Bright state");

  FixedStream controller_input(foreign);
  test.expect(bright.controller->setComponentState(&controller_input) == Steinberg::kResultFalse &&
                  bright.controller->getParamNormalized(kGainParameterId) ==
                      controller_gain_before &&
                  bright.controller->getParamNormalized(kBypassParameterId) ==
                      controller_bypass_before,
              "foreign controller state preserves Bright parameters");
}

[[nodiscard]] std::filesystem::path inner_module(const std::filesystem::path& bundle) {
  return bundle / "Contents" / "x86_64-win" / bundle.filename();
}

[[nodiscard]] bool files_equal(const std::array<std::filesystem::path, 2>& paths) {
  std::ifstream first(paths[0], std::ios::binary);
  std::ifstream second(paths[1], std::ios::binary);
  return first && second &&
         std::vector<char>(std::istreambuf_iterator<char>(first),
                           std::istreambuf_iterator<char>()) ==
             std::vector<char>(std::istreambuf_iterator<char>(second),
                               std::istreambuf_iterator<char>());
}

[[nodiscard]] std::wstring quote_argument(const std::wstring_view argument) {
  std::wstring result(1, L'\"');
  std::size_t backslashes = 0;
  for (const auto character : argument) {
    if (character == L'\\') {
      ++backslashes;
      continue;
    }
    if (character == L'\"') {
      result.append((backslashes * 2) + 1, L'\\');
      result.push_back(L'\"');
    } else {
      result.append(backslashes, L'\\');
      result.push_back(character);
    }
    backslashes = 0;
  }
  result.append(backslashes * 2, L'\\');
  result.push_back(L'\"');
  return result;
}

[[nodiscard]] std::optional<DWORD> run_process(const std::filesystem::path& executable,
                                               const std::vector<std::wstring>& arguments) {
  std::wstring command_line;
  for (const auto& argument : arguments) {
    if (!command_line.empty()) {
      command_line.push_back(L' ');
    }
    command_line += quote_argument(argument);
  }

  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  if (CreateProcessW(executable.c_str(), command_line.data(), nullptr, nullptr, FALSE,
                     CREATE_NO_WINDOW, nullptr, nullptr, &startup, &process) == FALSE) {
    return std::nullopt;
  }
  UniqueHandle process_handle(process.hProcess);
  UniqueHandle thread_handle(process.hThread);
  constexpr DWORD kTimeoutMilliseconds = 30'000;
  if (WaitForSingleObject(process_handle.get(), kTimeoutMilliseconds) != WAIT_OBJECT_0) {
    TerminateProcess(process_handle.get(), EXIT_FAILURE);
    return std::nullopt;
  }
  DWORD exit_code = 0;
  if (GetExitCodeProcess(process_handle.get(), &exit_code) == FALSE) {
    return std::nullopt;
  }
  return exit_code;
}

void check_inspector_unicode_path(TestContext& test, const std::filesystem::path& source_bundle,
                                  const std::filesystem::path& inspector,
                                  const std::filesystem::path& fixture_root) {
  const auto unicode_root = fixture_root / std::filesystem::path(kUnicodeFixtureParent);
  const auto bundle = unicode_root / source_bundle.filename();
  std::error_code error;
  std::filesystem::remove_all(fixture_root, error);
  error.clear();
  std::filesystem::create_directories(unicode_root, error);
  if (!error) {
    std::filesystem::copy(source_bundle, bundle, std::filesystem::copy_options::recursive, error);
  }
  test.expect(!error, "Unicode inspector fixture is created");
  if (error) {
    return;
  }

  std::vector<std::wstring> arguments{
      inspector.wstring(),
      L"--bundle",
      bundle.wstring(),
      L"--product-id",
      L"6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
      L"--vendor",
      L"Garak Test Artist",
      L"--name",
      L"Artist Gain Warm",
      L"--version",
      L"0.1.0",
      L"--category",
      L"Fx",
      L"--template",
      L"garak.gain-v1",
      L"--processor-fuid",
      L"3BA93DD6A062C97D89EC78F3652F83C4",
      L"--controller-fuid",
      L"00DD9000A50F7F28F4AE084CD29C4330",
      L"--gain-id",
      L"1001",
      L"--gain-default-normalized",
      L"0.75",
      L"--bypass-id",
      L"1002",
      L"--bypass-default-normalized",
      L"0",
  };
  const auto valid_result = run_process(inspector, arguments);
  test.expect(valid_result && *valid_result == EXIT_SUCCESS,
              "inspector accepts a valid bundle through a Unicode path");

  arguments[6] = std::wstring(1, static_cast<wchar_t>(0xD800));
  const auto invalid_result = run_process(inspector, arguments);
  test.expect(invalid_result && *invalid_result != EXIT_SUCCESS,
              "inspector fails closed on an unpaired UTF-16 surrogate");

  error.clear();
  std::filesystem::remove_all(fixture_root, error);
  test.expect(!error, "Unicode inspector fixture is removed");
}

void terminate(TestContext& test, Session& session) {
  if (session.controller_initialized) {
    test.expect(session.controller->terminate() == Steinberg::kResultTrue,
                "controller terminates cleanly");
  }
  if (session.component_initialized) {
    test.expect(session.component->terminate() == Steinberg::kResultTrue,
                "component terminates cleanly");
  }
}

} // namespace

int main(const int argc, char* argv[]) {
  try {
    if (argc != 6) {
      std::fputs(
          "Usage: product_runtime_v1_contract_tests <Warm bundle> <Bright bundle> "
          "<template> <inspector> <Unicode fixture root>\n",
          stderr);
      return EXIT_FAILURE;
    }

    TestContext test;
    std::string template_error;
    test.expect(VST3::Hosting::Module::create(argv[3], template_error) == nullptr,
                "Product Runtime template without product.garakbin fails closed");

    std::array<std::filesystem::path, 2> bundles{argv[1], argv[2]};
    std::array<std::unique_ptr<Session>, 2> sessions{};
    std::array<HMODULE, 2> handles{};
    std::array<Steinberg::FUID, 4> class_ids{};
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      sessions[index] = load(test, bundles[index], kProducts[index]);
      if (!sessions[index]) {
        return test.result();
      }
      handles[index] = GetModuleHandleW(bundles[index].filename().c_str());
      test.expect(handles[index] != nullptr, "loaded product has a module handle");
      class_ids[index * 2] = class_id(kProducts[index].processor);
      class_ids[(index * 2) + 1] = class_id(kProducts[index].controller);
    }

    for (std::size_t left = 0; left < class_ids.size(); ++left) {
      for (std::size_t right = left + 1; right < class_ids.size(); ++right) {
        test.expect(class_ids[left] != class_ids[right],
                    "all Product Runtime processor and controller FUIDs are unique");
      }
    }
    test.expect(handles[0] != handles[1], "Warm and Bright have distinct module handles");
    test.expect(bundles[0] != bundles[1] &&
                    files_equal({inner_module(bundles[0]), inner_module(bundles[1])}),
                "Warm and Bright use the byte-identical Runtime at distinct paths");

    for (std::size_t index = 0; index < sessions.size(); ++index) {
      test.expect(begin(*sessions[index], Steinberg::Vst::kSample32),
                  "default Float32 processing starts");
      std::array<Steinberg::Vst::Sample32, kSampleCount> left{1.0F, 1.0F, 1.0F, 1.0F};
      auto right = left;
      test.expect(process_stereo(*sessions[index], left, right) == Steinberg::kResultTrue &&
                      std::abs(static_cast<double>(left.front()) -
                               linear(kProducts[index].default_db)) < 1.0e-5,
                  "default Float32 output matches the product definition");
      stop(test, *sessions[index]);
    }

    constexpr std::array<double, 2> kStateValues{0.25, 0.75};
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      set_and_check_state(test, *sessions[index], kProducts[index], kStateValues[index]);
    }
    check_foreign_state_rejection(test, *sessions[1], kProducts[0], kProducts[1]);

    for (auto& session : sessions) {
      test.expect(begin(*session, Steinberg::Vst::kSample64),
                  "interleaved Float64 processing starts");
    }
    for (std::size_t index = 0; index < sessions.size(); ++index) {
      std::array<Steinberg::Vst::Sample64, kSampleCount> left{1.0, 1.0, 1.0, 1.0};
      auto right = left;
      const auto expected_db = (kStateValues[index] * 72.0) - 60.0;
      test.expect(process_stereo(*sessions[index], left, right) == Steinberg::kResultTrue &&
                      nearly_equal(left.front(), linear(expected_db)),
                  "interleaved output uses only its product-bound state");
    }
    for (std::size_t reverse = sessions.size(); reverse > 0; --reverse) {
      stop(test, *sessions[reverse - 1]);
    }

    const auto& warm_factory = sessions[0]->module->getFactory();
    auto second_warm = warm_factory.createInstance<Steinberg::Vst::IComponent>(
        VST3::UID(class_id(kProducts[0].processor).toTUID()));
    const bool second_initialized =
        second_warm && second_warm->initialize(nullptr) == Steinberg::kResultTrue;
    FixedStream second_state;
    double second_gain = 0.0;
    test.expect(second_initialized &&
                    second_warm->getState(&second_state) == Steinberg::kResultTrue &&
                    decode_state(kProducts[0], second_state.bytes(), second_gain) &&
                    second_gain == normalized(kProducts[0].default_db),
                "second Warm instance keeps an independent default state");
    if (second_initialized) {
      test.expect(second_warm->terminate() == Steinberg::kResultTrue,
                  "second Warm instance terminates cleanly");
    }
    second_warm.reset();

    for (std::size_t reverse = sessions.size(); reverse > 0; --reverse) {
      terminate(test, *sessions[reverse - 1]);
      sessions[reverse - 1].reset();
    }
    for (std::size_t index = 0; index < handles.size(); ++index) {
      test.expect(GetModuleHandleW(bundles[index].filename().c_str()) == nullptr,
                  "reverse unload releases each Product Runtime module handle");
    }

    auto reloaded = load(test, bundles[0], kProducts[0]);
    test.expect(reloaded != nullptr, "Warm reload preserves identity and default");
    if (reloaded) {
      terminate(test, *reloaded);
      reloaded.reset();
    }

    check_inspector_unicode_path(test, bundles[0], argv[4], argv[5]);
    return test.result();
  } catch (...) {
    std::fputs("Unhandled Product Runtime v1 contract test exception\n", stderr);
    return EXIT_FAILURE;
  }
}
