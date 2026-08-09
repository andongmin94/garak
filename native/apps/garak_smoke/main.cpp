#include <garak/core/version.hpp>

#include <iostream>

namespace {

int run_smoke() {
  std::cout << "Garak native scaffold " << garak::core::version_string() << '\n';
  return 0;
}

} // namespace

int main() {
  try {
    return run_smoke();
  } catch (...) {
    return 1;
  }
}
