add_library(garak_dsp_gain STATIC src/gain.cpp)
add_library(garak::dsp_gain ALIAS garak_dsp_gain)

target_include_directories(
  garak_dsp_gain
  PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include"
)
target_compile_features(garak_dsp_gain PUBLIC cxx_std_20)

garak_apply_warnings(garak_dsp_gain)
garak_apply_clang_tidy(garak_dsp_gain)
