#include <garak/core/version.hpp>

#include <iostream>

int main() {
  std::cout << "Garak native scaffold " << garak::core::version_string() << '\n';
  return 0;
}
