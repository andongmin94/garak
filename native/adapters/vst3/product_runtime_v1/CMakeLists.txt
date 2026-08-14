project(GarakProductRuntimeV1 VERSION 0.1.0 LANGUAGES CXX)

set(
  garak_product_runtime_v1_sources
  compiled_product_loader_win.cpp
  compiled_product_loader_win.hpp
  controller.cpp
  controller.hpp
  factory.cpp
  factory_support.cpp
  factory_support.hpp
  processor.cpp
  processor.hpp
  state_stream.cpp
  state_stream.hpp
)

add_library(garak_product_runtime_v1_objects OBJECT ${garak_product_runtime_v1_sources})
target_link_libraries(
  garak_product_runtime_v1_objects
  PRIVATE garak::product_contract_v1 garak::dsp_gain
)
target_compile_features(garak_product_runtime_v1_objects PRIVATE cxx_std_20)
target_include_directories(
  garak_product_runtime_v1_objects
  PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}"
)
target_include_directories(
  garak_product_runtime_v1_objects
  SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}"
)
garak_apply_warnings(garak_product_runtime_v1_objects)
garak_apply_clang_tidy(garak_product_runtime_v1_objects)

add_library(garak_product_host_utf8_locale OBJECT utf8_process_locale_win.cpp)
target_compile_features(garak_product_host_utf8_locale PRIVATE cxx_std_20)
garak_apply_warnings(garak_product_host_utf8_locale)
garak_apply_clang_tidy(garak_product_host_utf8_locale)

add_library(garak_vst3_utf8_string_convert OBJECT utf8_string_convert_win.cpp)
target_compile_features(garak_vst3_utf8_string_convert PRIVATE cxx_std_20)
target_include_directories(
  garak_vst3_utf8_string_convert
  SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}"
)
garak_apply_warnings(garak_vst3_utf8_string_convert)
garak_apply_clang_tidy(garak_vst3_utf8_string_convert)

add_library(
  vst3_sdk_product_runtime_host_support
  STATIC
  "${GARAK_VST3_SDK_DIR}/public.sdk/source/vst/hosting/module_win32.cpp"
  "${GARAK_VST3_SDK_DIR}/public.sdk/source/vst/moduleinfo/moduleinfoparser.cpp"
)
target_link_libraries(vst3_sdk_product_runtime_host_support PRIVATE sdk_hosting)
target_compile_features(vst3_sdk_product_runtime_host_support PUBLIC cxx_std_20)
target_include_directories(
  vst3_sdk_product_runtime_host_support
  SYSTEM PUBLIC "${GARAK_VST3_SDK_DIR}"
)
if(MSVC)
  target_compile_options(vst3_sdk_product_runtime_host_support PRIVATE /Zc:__cplusplus)
endif()

set(garak_previous_create_module_info "${SMTG_CREATE_MODULE_INFO}")
set(SMTG_CREATE_MODULE_INFO OFF)
smtg_add_vst3plugin(
  garak_product_runtime_v1_vst3
  PACKAGE_NAME "Garak Product Runtime v1"
  SOURCES_LIST
    $<TARGET_OBJECTS:garak_product_runtime_v1_objects>
    $<TARGET_OBJECTS:garak_vst3_utf8_string_convert>
)
set(SMTG_CREATE_MODULE_INFO "${garak_previous_create_module_info}")
target_link_libraries(
  garak_product_runtime_v1_vst3
  PRIVATE sdk garak::product_contract_v1 garak::dsp_gain
)
target_compile_features(garak_product_runtime_v1_vst3 PRIVATE cxx_std_20)

add_executable(garak_product_inspector inspector.cpp)
target_sources(
  garak_product_inspector
  PRIVATE
    $<TARGET_OBJECTS:garak_product_host_utf8_locale>
    $<TARGET_OBJECTS:garak_vst3_utf8_string_convert>
)
target_link_libraries(
  garak_product_inspector
  PRIVATE garak::product_contract_v1 vst3_sdk_product_runtime_host_support sdk_hosting
)
target_include_directories(
  garak_product_inspector
  SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}"
)
target_compile_features(garak_product_inspector PRIVATE cxx_std_20)
set_target_properties(
  garak_product_inspector
  PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)
garak_apply_warnings(garak_product_inspector)
garak_apply_clang_tidy(garak_product_inspector)

target_sources(
  moduleinfotool
  PRIVATE
    $<TARGET_OBJECTS:garak_product_host_utf8_locale>
    $<TARGET_OBJECTS:garak_vst3_utf8_string_convert>
)
target_sources(
  validator
  PRIVATE
    $<TARGET_OBJECTS:garak_product_host_utf8_locale>
    $<TARGET_OBJECTS:garak_vst3_utf8_string_convert>
)

if(SMTG_WIN AND SMTG_CREATE_BUNDLE_FOR_WINDOWS)
  get_target_property(
    garak_product_runtime_v1_package_path
    garak_product_runtime_v1_vst3
    SMTG_PLUGIN_PACKAGE_PATH
  )
  add_custom_command(
    TARGET garak_product_runtime_v1_vst3
    POST_BUILD
    COMMAND
      "${CMAKE_COMMAND}" -E rm -f
      "${garak_product_runtime_v1_package_path}/PlugIn.ico"
      "${garak_product_runtime_v1_package_path}/desktop.ini"
      "${garak_product_runtime_v1_package_path}/Contents/x86_64-win/Garak Product Runtime v1.ilk"
    VERBATIM
  )
endif()
