add_executable(garak_smoke main.cpp)

target_link_libraries(garak_smoke PRIVATE garak::core)

garak_apply_warnings(garak_smoke)
garak_apply_clang_tidy(garak_smoke)
