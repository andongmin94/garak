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

add_subdirectory(native)
