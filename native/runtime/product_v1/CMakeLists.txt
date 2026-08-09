add_library(
  garak_product_contract_v1
  STATIC
  src/compiled_product.cpp
  src/product_state.cpp
)

add_library(garak::product_contract_v1 ALIAS garak_product_contract_v1)

target_include_directories(
  garak_product_contract_v1
  PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include"
)
target_compile_features(garak_product_contract_v1 PUBLIC cxx_std_20)

garak_apply_warnings(garak_product_contract_v1)
garak_apply_clang_tidy(garak_product_contract_v1)
