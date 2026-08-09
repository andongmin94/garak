add_library(garak_core STATIC src/version.cpp)
add_library(garak::core ALIAS garak_core)

target_include_directories(garak_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include")
target_compile_features(garak_core PUBLIC cxx_std_20)

garak_apply_warnings(garak_core)
garak_apply_clang_tidy(garak_core)
