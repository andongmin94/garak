add_executable(garak_version_tests version_tests.cpp)

target_link_libraries(garak_version_tests PRIVATE garak::core)

garak_apply_warnings(garak_version_tests)
garak_apply_clang_tidy(garak_version_tests)

add_test(NAME garak_version_tests COMMAND garak_version_tests)

add_executable(garak_gain_dsp_tests gain_dsp_tests.cpp)
target_link_libraries(garak_gain_dsp_tests PRIVATE garak::dsp_gain)
garak_apply_warnings(garak_gain_dsp_tests)
garak_apply_clang_tidy(garak_gain_dsp_tests)
add_test(NAME garak_gain_dsp_tests COMMAND garak_gain_dsp_tests)

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

  add_executable(
    garak_product_compatibility_tests
    product_compatibility_tests.cpp
    product_v1_test_fixtures.hpp
  )
  target_link_libraries(
    garak_product_compatibility_tests
    PRIVATE garak::product_contract_v1
  )
  garak_apply_warnings(garak_product_compatibility_tests)
  garak_apply_clang_tidy(garak_product_compatibility_tests)
  add_test(
    NAME garak_product_compatibility_tests
    COMMAND garak_product_compatibility_tests
  )

  string(TOLOWER "${CMAKE_BUILD_TYPE}" garak_product_runtime_configuration_slug)
  set(
    garak_product_export_root
    "${CMAKE_SOURCE_DIR}/out/exports/phase-1c1/${garak_product_runtime_configuration_slug}"
  )
  set(
    garak_warm_bundle
    "${garak_product_export_root}/Artist Gain Warm.vst3"
  )
  set(
    garak_bright_bundle
    "${garak_product_export_root}/Artist Gain Bright.vst3"
  )

  add_test(
    NAME garak_product_runtime_v1_warm_inspection
    COMMAND
      garak_product_inspector
      --bundle "${garak_warm_bundle}"
      --product-id 6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e
      --vendor "Garak Test Artist"
      --name "Artist Gain Warm"
      --version 0.1.0
      --category Fx
      --template garak.gain-v1
      --processor-fuid 3BA93DD6A062C97D89EC78F3652F83C4
      --controller-fuid 00DD9000A50F7F28F4AE084CD29C4330
      --gain-id 1001
      --gain-default-normalized 0.75
      --bypass-id 1002
      --bypass-default-normalized 0
  )
  add_test(
    NAME garak_product_runtime_v1_bright_inspection
    COMMAND
      garak_product_inspector
      --bundle "${garak_bright_bundle}"
      --product-id c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357
      --vendor "Garak Test Artist"
      --name "Artist Gain Bright"
      --version 0.1.0
      --category Fx
      --template garak.gain-v1
      --processor-fuid FCB1FDAED3D981A2AE3AE5A20898C449
      --controller-fuid 32D933DFBD3C8110E014829EF5D62EA3
      --gain-id 1001
      --gain-default-normalized 0.875
      --bypass-id 1002
      --bypass-default-normalized 0
  )
  add_test(
    NAME garak_product_runtime_v1_warm_validator
    COMMAND validator "${garak_warm_bundle}"
  )
  add_test(
    NAME garak_product_runtime_v1_warm_validator_extensive
    COMMAND validator -e "${garak_warm_bundle}"
  )
  add_test(
    NAME garak_product_runtime_v1_bright_validator
    COMMAND validator "${garak_bright_bundle}"
  )
  add_test(
    NAME garak_product_runtime_v1_bright_validator_extensive
    COMMAND validator -e "${garak_bright_bundle}"
  )
endif()
