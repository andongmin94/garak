add_subdirectory(core)
add_subdirectory(apps/garak_smoke)

if(GARAK_BUILD_TESTS)
  add_subdirectory(tests)
endif()
