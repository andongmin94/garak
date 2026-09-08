add_library(garak_dsp_saturation STATIC src/saturation.cpp)
add_library(garak::dsp_saturation ALIAS garak_dsp_saturation)

target_include_directories(
  garak_dsp_saturation
  PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include"
)
target_compile_features(garak_dsp_saturation PUBLIC cxx_std_20)

garak_apply_warnings(garak_dsp_saturation)
garak_apply_clang_tidy(garak_dsp_saturation)
