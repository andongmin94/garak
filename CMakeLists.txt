cmake_minimum_required(VERSION 3.25)

project(
  Garak
  VERSION 0.0.0
  DESCRIPTION "Garak audio product creation platform"
  LANGUAGES CXX
)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

include(GarakOptions)
include(GarakWarnings)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(GARAK_BUILD_TESTS)
  enable_testing()
endif()

if(GARAK_BUILD_VST3_GAIN_SPIKE OR GARAK_BUILD_RUNTIME_STRATEGY_SPIKE)
  set(GARAK_VST3_SDK_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/vst3sdk")
  if(NOT EXISTS "${GARAK_VST3_SDK_DIR}/CMakeLists.txt")
    message(
      FATAL_ERROR
        "The VST3 SDK submodule is not initialized. Run: git submodule update --init --recursive"
    )
  endif()

  # These are exact options from VST3 SDK v3.8.0_build_66. Keep the SDK and
  # validator available while excluding examples, VSTGUI, global links, and
  # optional module-info generation from this technical spike.
  set(SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(SMTG_ENABLE_VST3_HOSTING_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(SMTG_ENABLE_VSTGUI_SUPPORT OFF CACHE BOOL "" FORCE)
  set(SMTG_CREATE_PLUGIN_LINK OFF CACHE BOOL "" FORCE)
  set(SMTG_PLUGIN_TARGET_USER_PROGRAM_FILES_COMMON OFF CACHE BOOL "" FORCE)
  set(SMTG_CREATE_BUNDLE_FOR_WINDOWS ON CACHE BOOL "" FORCE)
  set(SMTG_CREATE_MODULE_INFO OFF CACHE BOOL "" FORCE)
  set(SMTG_ADD_VST3_UTILITIES ${GARAK_BUILD_RUNTIME_STRATEGY_SPIKE} CACHE BOOL "" FORCE)
  set(SMTG_RUN_VST_VALIDATOR OFF CACHE BOOL "" FORCE)
  set(SMTG_CXX_STANDARD 20 CACHE STRING "" FORCE)

  add_subdirectory(
    "${GARAK_VST3_SDK_DIR}"
    "${CMAKE_BINARY_DIR}/third_party/vst3sdk"
    EXCLUDE_FROM_ALL
  )
endif()

add_subdirectory(native)
