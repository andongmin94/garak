add_executable(garak_version_tests version_tests.cpp)

target_link_libraries(garak_version_tests PRIVATE garak::core)

garak_apply_warnings(garak_version_tests)
garak_apply_clang_tidy(garak_version_tests)

add_test(NAME garak_version_tests COMMAND garak_version_tests)

if(GARAK_BUILD_VST3_GAIN_SPIKE)
  add_executable(garak_gain_spike_tests gain_spike_tests.cpp)
  target_link_libraries(garak_gain_spike_tests PRIVATE garak_gain_spike_support)
  garak_apply_warnings(garak_gain_spike_tests)
  garak_apply_clang_tidy(garak_gain_spike_tests)
  add_test(NAME garak_gain_spike_tests COMMAND garak_gain_spike_tests)

  # The SDK keeps its platform module loader out of sdk_hosting and compiles it
  # directly into each host executable. Isolate that unmodified third-party
  # source in its own target so Garak warning and clang-tidy policy is not
  # applied to SDK code.
  add_library(
    vst3_sdk_test_module_loader
    STATIC
    "${GARAK_VST3_SDK_DIR}/public.sdk/source/vst/hosting/module_win32.cpp"
  )
  target_link_libraries(vst3_sdk_test_module_loader PRIVATE sdk_hosting)
  target_compile_features(vst3_sdk_test_module_loader PUBLIC cxx_std_20)
  if(MSVC)
    # Match the pinned SDK's own MSVC language-mode option so its C++20
    # char8_t compatibility branch is selected in module_win32.cpp.
    target_compile_options(vst3_sdk_test_module_loader PRIVATE /Zc:__cplusplus)
  endif()

  add_executable(garak_vst3_gain_contract_tests vst3_gain_contract_tests.cpp)
  target_link_libraries(
    garak_vst3_gain_contract_tests
    PRIVATE vst3_sdk_test_module_loader garak_gain_spike_support
  )
  target_include_directories(
    garak_vst3_gain_contract_tests
    PRIVATE "${CMAKE_SOURCE_DIR}/native/adapters/vst3/gain_spike"
  )
  target_include_directories(
    garak_vst3_gain_contract_tests
    SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}"
  )
  add_dependencies(garak_vst3_gain_contract_tests garak_gain_spike_vst3)
  garak_apply_warnings(garak_vst3_gain_contract_tests)
  garak_apply_clang_tidy(garak_vst3_gain_contract_tests)
  add_test(
    NAME garak_vst3_gain_contract_tests
    COMMAND
      garak_vst3_gain_contract_tests
      "$<TARGET_GENEX_EVAL:garak_gain_spike_vst3,$<TARGET_PROPERTY:garak_gain_spike_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
  )
endif()
