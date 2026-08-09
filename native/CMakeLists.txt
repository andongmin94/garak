add_subdirectory(core)
add_subdirectory(apps/garak_smoke)

if(GARAK_BUILD_VST3_GAIN_SPIKE OR GARAK_BUILD_RUNTIME_STRATEGY_SPIKE)
  add_subdirectory(spikes/gain)
  add_subdirectory(adapters/vst3)
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
  if(GARAK_BUILD_TESTS)
    add_dependencies(
      garak_runtime_strategy_spike_all
      garak_version_tests
      garak_gain_spike_tests
      garak_vst3_gain_contract_tests
      garak_runtime_strategy_descriptor_tests
      garak_runtime_strategy_contract_tests
    )
  endif()
endif()

if(GARAK_BUILD_TESTS)
  add_subdirectory(tests)
endif()

if(GARAK_BUILD_VST3_GAIN_SPIKE)
  add_custom_target(
    garak_vst3_gain_spike_all
    DEPENDS garak_gain_spike_vst3 validator
  )
  if(GARAK_BUILD_TESTS)
    add_dependencies(
      garak_vst3_gain_spike_all
      garak_version_tests
      garak_gain_spike_tests
      garak_vst3_gain_contract_tests
    )
  endif()
endif()
