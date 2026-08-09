if(NOT CMAKE_ARGC EQUAL 10)
  message(FATAL_ERROR "package_data_products.cmake received an unexpected argument count")
endif()

set(template_bundle "${CMAKE_ARGV3}")
set(moduleinfo_tool "${CMAKE_ARGV4}")
set(package_script "${CMAKE_ARGV5}")
set(alpha_descriptor "${CMAKE_ARGV6}")
set(alpha_bundle "${CMAKE_ARGV7}")
set(beta_descriptor "${CMAKE_ARGV8}")
set(beta_bundle "${CMAKE_ARGV9}")

foreach(product IN ITEMS alpha beta)
  execute_process(
    COMMAND
      powershell -NoProfile -ExecutionPolicy Bypass -File "${package_script}"
      -TemplateBundlePath "${template_bundle}"
      -DescriptorPath "${${product}_descriptor}"
      -OutputBundlePath "${${product}_bundle}"
      -ModuleInfoToolPath "${moduleinfo_tool}"
    RESULT_VARIABLE package_result
  )
  if(NOT package_result EQUAL 0)
    message(FATAL_ERROR "Alternative A ${product} packaging failed: ${package_result}")
  endif()
endforeach()
