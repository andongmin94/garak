include_guard(GLOBAL)

function(garak_apply_warnings target_name)
  if(NOT TARGET "${target_name}")
    message(FATAL_ERROR "Cannot apply Garak warnings to unknown target: ${target_name}")
  endif()

  if(MSVC)
    target_compile_options("${target_name}" PRIVATE /W4 /permissive- /Zc:__cplusplus)
    if(GARAK_WARNINGS_AS_ERRORS)
      target_compile_options("${target_name}" PRIVATE /WX)
    endif()
  elseif(CMAKE_CXX_COMPILER_ID MATCHES "^(AppleClang|Clang)$")
    target_compile_options("${target_name}" PRIVATE -Wall -Wextra -Wpedantic)
    if(GARAK_WARNINGS_AS_ERRORS)
      target_compile_options("${target_name}" PRIVATE -Werror)
    endif()
  else()
    message(WARNING "Garak has no warning policy for ${CMAKE_CXX_COMPILER_ID}")
  endif()
endfunction()

function(garak_apply_clang_tidy target_name)
  if(NOT TARGET "${target_name}")
    message(FATAL_ERROR "Cannot apply clang-tidy to unknown target: ${target_name}")
  endif()

  if(GARAK_ENABLE_CLANG_TIDY)
    set(
      garak_clang_tidy_command
      "${GARAK_CLANG_TIDY_EXECUTABLE}"
      "--config-file=${CMAKE_SOURCE_DIR}/.clang-tidy"
    )
    if(MSVC)
      # clang-tidy does not infer /EHsc when CMake invokes it as a compiler
      # launcher. Match the real target semantics without changing compile flags.
      list(APPEND garak_clang_tidy_command "--extra-arg=/EHsc")
    endif()
    set_property(
      TARGET "${target_name}"
      PROPERTY CXX_CLANG_TIDY "${garak_clang_tidy_command}"
    )
  endif()
endfunction()
