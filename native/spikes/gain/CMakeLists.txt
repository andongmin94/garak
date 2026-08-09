add_library(
  garak_gain_spike_support
  STATIC
  gain_kernel.cpp
  state_codec.cpp
)

target_include_directories(
  garak_gain_spike_support
  PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}"
)
target_compile_features(garak_gain_spike_support PUBLIC cxx_std_20)

garak_apply_warnings(garak_gain_spike_support)
garak_apply_clang_tidy(garak_gain_spike_support)
