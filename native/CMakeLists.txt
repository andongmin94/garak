add_subdirectory(core)
add_subdirectory(apps/garak_smoke)
add_subdirectory(runtime)

if(GARAK_BUILD_VST3_GAIN_SPIKE OR GARAK_BUILD_RUNTIME_STRATEGY_SPIKE OR
   GARAK_BUILD_PRODUCT_RUNTIME_V1)
  add_subdirectory(spikes/gain)
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
      garak_product_runtime_v1_objects
      garak_product_runtime_v1_vst3
      garak_product_inspector
  )
  if(GARAK_BUILD_TESTS)
    add_dependencies(
      garak_product_runtime_v1_quality
      garak_version_tests
      garak_product_v1_contract_tests
      garak_product_compatibility_tests
      garak_gain_support_tests
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

if(GARAK_BUILD_RUNTIME_STRATEGY_SPIKE)
  add_custom_target(
    garak_runtime_strategy_spike_all
    DEPENDS
      garak_data_runtime_template_vst3
      garak_data_runtime_products
      garak_thin_alpha_vst3
      garak_thin_beta_vst3
      moduleinfotool
      validator
  )
endif()

if(GARAK_BUILD_VST3_GAIN_SPIKE)
  add_custom_target(
    garak_vst3_gain_spike_all
    DEPENDS garak_gain_spike_vst3 validator
  )
endif()
