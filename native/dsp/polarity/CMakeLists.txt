add_library(garak_dsp_polarity STATIC src/polarity.cpp)
add_library(garak::dsp_polarity ALIAS garak_dsp_polarity)

target_include_directories(
  garak_dsp_polarity
  PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include"
)
target_compile_features(garak_dsp_polarity PUBLIC cxx_std_20)

garak_apply_warnings(garak_dsp_polarity)
garak_apply_clang_tidy(garak_dsp_polarity)
