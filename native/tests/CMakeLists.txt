add_executable(garak_version_tests version_tests.cpp)

target_link_libraries(garak_version_tests PRIVATE garak::core)

garak_apply_warnings(garak_version_tests)
garak_apply_clang_tidy(garak_version_tests)

add_test(NAME garak_version_tests COMMAND garak_version_tests)

if(GARAK_BUILD_PRODUCT_RUNTIME_V1)
  add_executable(
    garak_product_v1_contract_tests
    product_v1_contract_tests.cpp
    product_v1_test_fixtures.hpp
  )
  target_link_libraries(
    garak_product_v1_contract_tests
    PRIVATE garak::product_contract_v1
  )
  garak_apply_warnings(garak_product_v1_contract_tests)
  garak_apply_clang_tidy(garak_product_v1_contract_tests)
  add_test(NAME garak_product_v1_contract_tests COMMAND garak_product_v1_contract_tests)
endif()

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

  if(GARAK_BUILD_RUNTIME_STRATEGY_SPIKE)
    # Parse SDK JSON5 moduleinfo files with the pinned SDK implementation. Keep
    # the unmodified third-party source outside Garak warning/tidy policy.
    add_library(
      vst3_sdk_test_moduleinfo_parser
      STATIC
      "${GARAK_VST3_SDK_DIR}/public.sdk/source/vst/moduleinfo/moduleinfoparser.cpp"
    )
    target_link_libraries(vst3_sdk_test_moduleinfo_parser PRIVATE sdk_hosting)
    target_compile_features(vst3_sdk_test_moduleinfo_parser PUBLIC cxx_std_20)
    target_include_directories(
      vst3_sdk_test_moduleinfo_parser
      SYSTEM PUBLIC "${GARAK_VST3_SDK_DIR}"
    )
    if(MSVC)
      target_compile_options(vst3_sdk_test_moduleinfo_parser PRIVATE /Zc:__cplusplus)
    endif()
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

if(GARAK_BUILD_RUNTIME_STRATEGY_SPIKE)
  add_executable(
    garak_runtime_strategy_descriptor_tests
    runtime_strategy_descriptor_tests.cpp
  )
  target_link_libraries(
    garak_runtime_strategy_descriptor_tests
    PRIVATE garak_runtime_strategy_descriptor
  )
  target_include_directories(
    garak_runtime_strategy_descriptor_tests
    PRIVATE "${CMAKE_SOURCE_DIR}/native/adapters/vst3/runtime_strategy_spike"
  )
  garak_apply_warnings(garak_runtime_strategy_descriptor_tests)
  garak_apply_clang_tidy(garak_runtime_strategy_descriptor_tests)
  add_test(
    NAME garak_runtime_strategy_descriptor_tests
    COMMAND garak_runtime_strategy_descriptor_tests
  )

  add_executable(
    garak_runtime_strategy_contract_tests
    runtime_strategy_contract_tests.cpp
  )
  target_link_libraries(
    garak_runtime_strategy_contract_tests
    PRIVATE
      vst3_sdk_test_module_loader
      vst3_sdk_test_moduleinfo_parser
      garak_gain_spike_support
      sdk_hosting
  )
  target_include_directories(
    garak_runtime_strategy_contract_tests
    SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}"
  )
  add_dependencies(
    garak_runtime_strategy_contract_tests
    garak_gain_spike_vst3
    garak_data_runtime_products
    garak_thin_alpha_vst3
    garak_thin_beta_vst3
  )
  garak_apply_warnings(garak_runtime_strategy_contract_tests)
  garak_apply_clang_tidy(garak_runtime_strategy_contract_tests)
  add_test(
    NAME garak_runtime_strategy_contract_tests
    COMMAND
      garak_runtime_strategy_contract_tests
      "$<TARGET_GENEX_EVAL:garak_gain_spike_vst3,$<TARGET_PROPERTY:garak_gain_spike_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
      "$<TARGET_PROPERTY:garak_data_runtime_products,GARAK_DATA_ALPHA_BUNDLE>"
      "$<TARGET_PROPERTY:garak_data_runtime_products,GARAK_DATA_BETA_BUNDLE>"
      "$<TARGET_GENEX_EVAL:garak_thin_alpha_vst3,$<TARGET_PROPERTY:garak_thin_alpha_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
      "$<TARGET_GENEX_EVAL:garak_thin_beta_vst3,$<TARGET_PROPERTY:garak_thin_beta_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
      "$<TARGET_GENEX_EVAL:garak_data_runtime_template_vst3,$<TARGET_PROPERTY:garak_data_runtime_template_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
      "${CMAKE_BINARY_DIR}/runtime-failure-fixtures"
  )
endif()

if(GARAK_BUILD_PRODUCT_RUNTIME_V1 AND GARAK_BUILD_RUNTIME_STRATEGY_SPIKE)
  add_executable(
    garak_product_runtime_v1_contract_tests
    product_runtime_v1_contract_tests.cpp
    product_v1_test_fixtures.hpp
  )
  target_link_libraries(
    garak_product_runtime_v1_contract_tests
    PRIVATE
      garak::product_contract_v1
      garak_gain_spike_support
      vst3_sdk_product_runtime_host_support
      sdk_hosting
  )
  target_include_directories(
    garak_product_runtime_v1_contract_tests
    PRIVATE "${CMAKE_SOURCE_DIR}/native/spikes/gain"
  )
  target_include_directories(
    garak_product_runtime_v1_contract_tests
    SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}"
  )
  add_dependencies(
    garak_product_runtime_v1_contract_tests
    garak_product_runtime_v1_vst3
    garak_product_inspector
    garak_gain_spike_vst3
    garak_data_runtime_products
    garak_thin_alpha_vst3
    garak_thin_beta_vst3
  )
  garak_apply_warnings(garak_product_runtime_v1_contract_tests)
  garak_apply_clang_tidy(garak_product_runtime_v1_contract_tests)
  string(TOLOWER "${CMAKE_BUILD_TYPE}" garak_product_runtime_configuration_slug)
  set(
    garak_product_export_root
    "${CMAKE_SOURCE_DIR}/out/exports/phase-1c1/${garak_product_runtime_configuration_slug}"
  )
  add_test(
    NAME garak_product_runtime_v1_contract_tests
    COMMAND
      garak_product_runtime_v1_contract_tests
      "$<TARGET_GENEX_EVAL:garak_gain_spike_vst3,$<TARGET_PROPERTY:garak_gain_spike_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
      "$<TARGET_PROPERTY:garak_data_runtime_products,GARAK_DATA_ALPHA_BUNDLE>"
      "$<TARGET_PROPERTY:garak_data_runtime_products,GARAK_DATA_BETA_BUNDLE>"
      "$<TARGET_GENEX_EVAL:garak_thin_alpha_vst3,$<TARGET_PROPERTY:garak_thin_alpha_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
      "$<TARGET_GENEX_EVAL:garak_thin_beta_vst3,$<TARGET_PROPERTY:garak_thin_beta_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
      "${garak_product_export_root}/Artist Gain Warm.vst3"
      "${garak_product_export_root}/Artist Gain Bright.vst3"
      "$<TARGET_GENEX_EVAL:garak_product_runtime_v1_vst3,$<TARGET_PROPERTY:garak_product_runtime_v1_vst3,SMTG_PLUGIN_PACKAGE_PATH>>"
      "$<TARGET_FILE:garak_product_inspector>"
      "${CMAKE_BINARY_DIR}/inspector-utf8-fixture"
  )
endif()
