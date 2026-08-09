include_guard(GLOBAL)

option(GARAK_BUILD_TESTS "Build the Garak native tests" ON)
option(GARAK_WARNINGS_AS_ERRORS "Treat first-party compiler warnings as errors" OFF)
option(GARAK_ENABLE_CLANG_TIDY "Run clang-tidy while compiling first-party targets" OFF)
option(GARAK_BUILD_VST3_GAIN_SPIKE "Build the opt-in Garak Gain Spike VST3" OFF)
option(
  GARAK_BUILD_RUNTIME_STRATEGY_SPIKE
  "Build the opt-in Phase 1B VST3 runtime strategy comparison"
  OFF
)
option(
  GARAK_BUILD_PRODUCT_RUNTIME_V1
  "Build the Phase 1C.1 Windows Product Runtime v1 and inspector"
  OFF
)

if(GARAK_BUILD_RUNTIME_STRATEGY_SPIKE)
  # Phase 1B's required coexistence baseline includes the Phase 1A module.
  set(GARAK_BUILD_VST3_GAIN_SPIKE ON CACHE BOOL "" FORCE)
endif()

if(GARAK_BUILD_PRODUCT_RUNTIME_V1)
  # Product Runtime v1 privately reuses the bounded Gain v1 implementation.
  set(GARAK_BUILD_VST3_GAIN_SPIKE ON CACHE BOOL "" FORCE)
endif()

if(GARAK_ENABLE_CLANG_TIDY)
  find_program(GARAK_CLANG_TIDY_EXECUTABLE NAMES clang-tidy REQUIRED)
endif()
