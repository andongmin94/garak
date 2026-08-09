#include "state_stream.hpp"

#include "pluginterfaces/base/ibstream.h"

namespace garak::adapter::vst3::product_runtime_v1 {

bool read_state(Steinberg::IBStream* const stream,
                const garak::runtime::product_v1::Identifier& product_id,
                garak::runtime::product_v1::ProductState& state) noexcept {
  if (stream == nullptr) {
    return false;
  }
  garak::runtime::product_v1::EncodedProductState encoded{};
  const auto expected_bytes = static_cast<Steinberg::int32>(encoded.size());
  Steinberg::int32 bytes_read = 0;
  if (stream->read(encoded.data(), expected_bytes, &bytes_read) != Steinberg::kResultTrue ||
      bytes_read != expected_bytes) {
    return false;
  }
  std::uint8_t trailing_byte = 0;
  Steinberg::int32 trailing_bytes = 0;
  const auto trailing_result = stream->read(&trailing_byte, 1, &trailing_bytes);
  if ((trailing_result != Steinberg::kResultTrue && trailing_result != Steinberg::kResultFalse) ||
      trailing_bytes != 0) {
    return false;
  }
  garak::runtime::product_v1::ProductState decoded{};
  if (!garak::runtime::product_v1::decode_product_state(encoded, product_id, decoded)) {
    return false;
  }
  state = decoded;
  return true;
}

bool write_state(Steinberg::IBStream* const stream,
                 const garak::runtime::product_v1::Identifier& product_id,
                 const garak::runtime::product_v1::ProductState& state) noexcept {
  if (stream == nullptr) {
    return false;
  }
  garak::runtime::product_v1::EncodedProductState encoded{};
  if (!garak::runtime::product_v1::encode_product_state(product_id, state, encoded)) {
    return false;
  }
  const auto expected_bytes = static_cast<Steinberg::int32>(encoded.size());
  Steinberg::int32 bytes_written = 0;
  return stream->write(encoded.data(), expected_bytes, &bytes_written) == Steinberg::kResultTrue &&
         bytes_written == expected_bytes;
}

} // namespace garak::adapter::vst3::product_runtime_v1
