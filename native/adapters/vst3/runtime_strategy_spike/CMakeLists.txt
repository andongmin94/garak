project(GarakRuntimeStrategySpike VERSION 0.1.0 LANGUAGES CXX)

set(garak_runtime_strategy_common_sources
    controller.cpp
    controller.hpp
    factory_support.cpp
    factory_support.hpp
    processor.cpp
    processor.hpp
    state_stream.cpp
    state_stream.hpp)

add_library(
  garak_runtime_strategy_descriptor
  STATIC product_definition.cpp product_definition.hpp
)
target_link_libraries(garak_runtime_strategy_descriptor PRIVATE garak_gain_spike_support)
target_compile_features(garak_runtime_strategy_descriptor PRIVATE cxx_std_20)
target_include_directories(
  garak_runtime_strategy_descriptor
  PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}"
  PRIVATE "${CMAKE_SOURCE_DIR}/native/spikes/gain"
)
garak_apply_warnings(garak_runtime_strategy_descriptor)
garak_apply_clang_tidy(garak_runtime_strategy_descriptor)

add_library(garak_runtime_strategy_spike_common STATIC ${garak_runtime_strategy_common_sources})
target_link_libraries(
  garak_runtime_strategy_spike_common
  PRIVATE garak_gain_spike_support garak_runtime_strategy_descriptor
)
target_compile_features(garak_runtime_strategy_spike_common PRIVATE cxx_std_20)
target_include_directories(
  garak_runtime_strategy_spike_common
  PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}"
  PRIVATE "${CMAKE_SOURCE_DIR}/native/spikes/gain"
)
target_include_directories(
  garak_runtime_strategy_spike_common
  SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}"
)
garak_apply_warnings(garak_runtime_strategy_spike_common)
garak_apply_clang_tidy(garak_runtime_strategy_spike_common)

function(garak_add_runtime_strategy_wrapper wrapper_target source)
  add_library(${wrapper_target} OBJECT "${source}")
  target_compile_features(${wrapper_target} PRIVATE cxx_std_20)
  target_include_directories(${wrapper_target} PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
  target_include_directories(${wrapper_target} SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}")
  garak_apply_warnings(${wrapper_target})
  garak_apply_clang_tidy(${wrapper_target})
endfunction()

garak_add_runtime_strategy_wrapper(
  garak_data_runtime_wrapper
  data_runtime_factory.cpp
)
target_sources(garak_data_runtime_wrapper PRIVATE descriptor_loader_win.cpp descriptor_loader_win.hpp)

garak_add_runtime_strategy_wrapper(
  garak_thin_alpha_wrapper
  thin_alpha_factory.cpp
)
garak_add_runtime_strategy_wrapper(
  garak_thin_beta_wrapper
  thin_beta_factory.cpp
)

function(garak_add_runtime_strategy_plugin target package_name wrapper_target create_module_info)
  set(garak_previous_create_module_info "${SMTG_CREATE_MODULE_INFO}")
  set(SMTG_CREATE_MODULE_INFO "${create_module_info}")
  smtg_add_vst3plugin(
    ${target}
    PACKAGE_NAME "${package_name}"
    SOURCES_LIST $<TARGET_OBJECTS:${wrapper_target}>
  )
  set(SMTG_CREATE_MODULE_INFO "${garak_previous_create_module_info}")
  target_link_libraries(
    ${target}
    PRIVATE sdk garak_runtime_strategy_spike_common garak_gain_spike_support
  )
  target_compile_features(${target} PRIVATE cxx_std_20)
  if(SMTG_WIN AND SMTG_CREATE_BUNDLE_FOR_WINDOWS)
    get_target_property(garak_package_path ${target} SMTG_PLUGIN_PACKAGE_PATH)
    add_custom_command(
      TARGET ${target}
      POST_BUILD
      COMMAND "${CMAKE_COMMAND}" -E rm -f
              "${garak_package_path}/PlugIn.ico"
              "${garak_package_path}/desktop.ini"
              "${garak_package_path}/Contents/x86_64-win/${package_name}.ilk"
      VERBATIM
    )
    if(create_module_info)
      add_custom_command(
        TARGET ${target}
        POST_BUILD
        COMMAND
          "$<TARGET_FILE:moduleinfotool>" -validate
          -path "${garak_package_path}"
          -infopath "${garak_package_path}/Contents/Resources/moduleinfo.json"
        VERBATIM
      )
    endif()
  endif()
endfunction()

# The template has no descriptor and is not a loadable product bundle, so it
# deliberately has no automatic moduleinfo generation.
garak_add_runtime_strategy_plugin(
  garak_data_runtime_template_vst3
  "Garak Data Runtime Template"
  garak_data_runtime_wrapper
  OFF
)
garak_add_runtime_strategy_plugin(
  garak_thin_alpha_vst3
  "Garak Thin Alpha"
  garak_thin_alpha_wrapper
  ON
)
garak_add_runtime_strategy_plugin(
  garak_thin_beta_vst3
  "Garak Thin Beta"
  garak_thin_beta_wrapper
  ON
)

get_target_property(
  garak_data_template_package_path
  garak_data_runtime_template_vst3
  SMTG_PLUGIN_PACKAGE_PATH
)
set(garak_runtime_products_dir "${CMAKE_BINARY_DIR}/runtime-products")
set(garak_data_alpha_bundle "${garak_runtime_products_dir}/Garak Data Alpha.vst3")
set(garak_data_beta_bundle "${garak_runtime_products_dir}/Garak Data Beta.vst3")
set(
  garak_data_alpha_inner_module
  "${garak_data_alpha_bundle}/Contents/x86_64-win/Garak Data Alpha.vst3"
)
set(
  garak_data_beta_inner_module
  "${garak_data_beta_bundle}/Contents/x86_64-win/Garak Data Beta.vst3"
)
set(
  garak_data_alpha_descriptor
  "${garak_data_alpha_bundle}/Contents/Resources/garak-product-spike-v1.txt"
)
set(
  garak_data_beta_descriptor
  "${garak_data_beta_bundle}/Contents/Resources/garak-product-spike-v1.txt"
)
set(
  garak_data_alpha_moduleinfo
  "${garak_data_alpha_bundle}/Contents/Resources/moduleinfo.json"
)
set(
  garak_data_beta_moduleinfo
  "${garak_data_beta_bundle}/Contents/Resources/moduleinfo.json"
)

add_custom_command(
  OUTPUT
    "${garak_data_alpha_inner_module}"
    "${garak_data_alpha_descriptor}"
    "${garak_data_alpha_moduleinfo}"
    "${garak_data_beta_inner_module}"
    "${garak_data_beta_descriptor}"
    "${garak_data_beta_moduleinfo}"
  COMMAND
    "${CMAKE_COMMAND}" -P
    "${CMAKE_CURRENT_SOURCE_DIR}/package_data_products.cmake"
    "${garak_data_template_package_path}"
    "$<TARGET_FILE:moduleinfotool>"
    "${CMAKE_SOURCE_DIR}/tools/vst3/package_data_runtime_variant.ps1"
    "${CMAKE_CURRENT_SOURCE_DIR}/descriptors/data-alpha.txt"
    "${garak_data_alpha_bundle}"
    "${CMAKE_CURRENT_SOURCE_DIR}/descriptors/data-beta.txt"
    "${garak_data_beta_bundle}"
  DEPENDS
    garak_data_runtime_template_vst3
    moduleinfotool
    "${CMAKE_SOURCE_DIR}/tools/vst3/package_data_runtime_variant.ps1"
    "${CMAKE_CURRENT_SOURCE_DIR}/package_data_products.cmake"
    "${CMAKE_CURRENT_SOURCE_DIR}/descriptors/data-alpha.txt"
    "${CMAKE_CURRENT_SOURCE_DIR}/descriptors/data-beta.txt"
  VERBATIM
)
# Ninja tracks the three files in each product. The phony target also verifies
# their contents and exact inventory on every aggregate build.
add_custom_target(
  garak_data_runtime_products
  COMMAND
    pwsh -NoProfile -File
    "${CMAKE_SOURCE_DIR}/tools/vst3/package_data_runtime_variant.ps1"
    -TemplateBundlePath "${garak_data_template_package_path}"
    -DescriptorPath "${CMAKE_CURRENT_SOURCE_DIR}/descriptors/data-alpha.txt"
    -OutputBundlePath "${garak_data_alpha_bundle}"
    -ModuleInfoToolPath "$<TARGET_FILE:moduleinfotool>"
    -VerifyOnly
  COMMAND
    pwsh -NoProfile -File
    "${CMAKE_SOURCE_DIR}/tools/vst3/package_data_runtime_variant.ps1"
    -TemplateBundlePath "${garak_data_template_package_path}"
    -DescriptorPath "${CMAKE_CURRENT_SOURCE_DIR}/descriptors/data-beta.txt"
    -OutputBundlePath "${garak_data_beta_bundle}"
    -ModuleInfoToolPath "$<TARGET_FILE:moduleinfotool>"
    -VerifyOnly
  DEPENDS
    "${garak_data_alpha_inner_module}"
    "${garak_data_alpha_descriptor}"
    "${garak_data_alpha_moduleinfo}"
    "${garak_data_beta_inner_module}"
    "${garak_data_beta_descriptor}"
    "${garak_data_beta_moduleinfo}"
  VERBATIM
)
set_property(
  TARGET garak_data_runtime_products
  PROPERTY GARAK_DATA_ALPHA_BUNDLE "${garak_data_alpha_bundle}"
)
set_property(
  TARGET garak_data_runtime_products
  PROPERTY GARAK_DATA_BETA_BUNDLE "${garak_data_beta_bundle}"
)
