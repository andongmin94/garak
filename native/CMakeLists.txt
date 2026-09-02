add_subdirectory(core)
add_subdirectory(dsp)
add_subdirectory(apps/garak_smoke)
add_subdirectory(runtime)

if(GARAK_BUILD_PRODUCT_RUNTIME_V1)
  add_subdirectory(adapters/vst3)
endif()

if(GARAK_BUILD_TESTS)
  add_subdirectory(tests)
endif()

if(GARAK_BUILD_PRODUCT_RUNTIME_V1)
  add_custom_target(
    garak_product_runtime_v1_quality
    DEPENDS
      garak_product_contract_v1
      garak_dsp_gain
      garak_product_runtime_v1_objects
      garak_product_runtime_v1_vst3
      garak_product_inspector
  )
  if(GARAK_BUILD_TESTS)
    add_dependencies(
      garak_product_runtime_v1_quality
      garak_version_tests
      garak_gain_dsp_tests
      garak_static_graph_tests
      garak_realtime_stress_tests
      garak_product_v1_contract_tests
      garak_product_compatibility_tests
      garak_compiled_graph_resource_tests
      garak_product_runtime_v1_smoke_tests
    )
  endif()

  add_custom_target(
    garak_product_runtime_v1_all
    DEPENDS
      garak_product_runtime_v1_quality
      moduleinfotool
      validator
  )
endif()
