include_guard(GLOBAL)

option(GARAK_BUILD_TESTS "Build the Garak native tests" ON)
option(GARAK_WARNINGS_AS_ERRORS "Treat first-party compiler warnings as errors" OFF)
option(GARAK_ENABLE_CLANG_TIDY "Run clang-tidy while compiling first-party targets" OFF)
option(GARAK_BUILD_VST3_GAIN_SPIKE "Build the opt-in Garak Gain Spike VST3" OFF)

if(GARAK_ENABLE_CLANG_TIDY)
  find_program(GARAK_CLANG_TIDY_EXECUTABLE NAMES clang-tidy REQUIRED)
endif()
