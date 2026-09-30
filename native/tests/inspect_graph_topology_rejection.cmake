# Run against the real exported Saturated bundle. A launch/metadata/resource
# failure must not count as proof that a mismatched graph was rejected.
execute_process(
  COMMAND "${INSPECTOR}" ${INSPECTION_ARGUMENTS} --post-gain-transform identity
  RESULT_VARIABLE inspection_result
  OUTPUT_VARIABLE inspection_output
  ERROR_VARIABLE inspection_error
)
if(NOT inspection_result STREQUAL "6" OR
   NOT inspection_error MATCHES "compiled graph topology parity")
  message(
    FATAL_ERROR
    "Inspector did not reject the Saturated/identity topology mismatch: ${inspection_result}\n${inspection_output}${inspection_error}"
  )
endif()
