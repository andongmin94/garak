add_library(garak_static_graph INTERFACE)
add_library(garak::static_graph ALIAS garak_static_graph)

target_include_directories(
  garak_static_graph
  INTERFACE "${CMAKE_CURRENT_SOURCE_DIR}/include"
)
target_link_libraries(garak_static_graph INTERFACE garak::dsp_gain)
target_compile_features(garak_static_graph INTERFACE cxx_std_20)
