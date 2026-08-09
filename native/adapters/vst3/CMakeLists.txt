project(GarakGainSpike VERSION 0.1.0 LANGUAGES CXX)

set(garak_gain_spike_sources
    gain_spike/controller.cpp
    gain_spike/controller.hpp
    gain_spike/factory.cpp
    gain_spike/identifiers.hpp
    gain_spike/processor.cpp
    gain_spike/processor.hpp
    gain_spike/state_stream.cpp
    gain_spike/state_stream.hpp
    gain_spike/version.hpp)

add_library(garak_gain_spike_vst3_objects OBJECT ${garak_gain_spike_sources})
target_link_libraries(
  garak_gain_spike_vst3_objects
  PRIVATE garak_gain_spike_support
)
target_compile_features(garak_gain_spike_vst3_objects PRIVATE cxx_std_20)
target_include_directories(
  garak_gain_spike_vst3_objects
  PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/gain_spike"
)
target_include_directories(
  garak_gain_spike_vst3_objects
  SYSTEM PRIVATE "${GARAK_VST3_SDK_DIR}"
)
garak_apply_warnings(garak_gain_spike_vst3_objects)
garak_apply_clang_tidy(garak_gain_spike_vst3_objects)

smtg_enable_vst3_sdk()

smtg_add_vst3plugin(
  garak_gain_spike_vst3
  PACKAGE_NAME "Garak Gain Spike"
  SOURCES_LIST $<TARGET_OBJECTS:garak_gain_spike_vst3_objects>
)

target_link_libraries(garak_gain_spike_vst3 PRIVATE sdk garak_gain_spike_support)
target_compile_features(garak_gain_spike_vst3 PRIVATE cxx_std_20)

smtg_target_configure_version_file(garak_gain_spike_vst3)

# The pinned helper otherwise copies Steinberg's folder icon into every Windows
# bundle. This editorless white-label spike keeps no bitmap or branded icon.
if(SMTG_WIN AND SMTG_CREATE_BUNDLE_FOR_WINDOWS)
  get_target_property(
    garak_gain_spike_package_path
    garak_gain_spike_vst3
    SMTG_PLUGIN_PACKAGE_PATH
  )
  add_custom_command(
    TARGET garak_gain_spike_vst3
    POST_BUILD
    COMMAND
      "${CMAKE_COMMAND}" -E rm -f
      "${garak_gain_spike_package_path}/PlugIn.ico"
      "${garak_gain_spike_package_path}/desktop.ini"
    VERBATIM
  )
endif()
