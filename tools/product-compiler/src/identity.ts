import { createHash } from "node:crypto";

import { fail } from "./errors.ts";
import type { ProductIdentity } from "./project_model.ts";

export const PRODUCT_IDENTITY_NAMESPACE = "garak.vst3-product-identity.v1";
export type ProductIdentityRole = "processor" | "controller";

export function deriveFuid(
  productId: string,
  role: ProductIdentityRole,
): string {
  const digest = createHash("sha256")
    .update(PRODUCT_IDENTITY_NAMESPACE, "utf8")
    .update(Buffer.from([0]))
    .update(productId, "utf8")
    .update(Buffer.from([0]))
    .update(role, "utf8")
    .digest();
  return digest.subarray(0, 16).toString("hex").toUpperCase();
}

export function deriveProductIdentity(productId: string): ProductIdentity {
  return {
    processorFuid: deriveFuid(productId, "processor"),
    controllerFuid: deriveFuid(productId, "controller"),
  };
}

export function uuidToBytes(productId: string): Buffer {
  const compact = productId.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/u.test(compact)) {
    fail(
      "GARAK_IDENTITY_INVALID_PRODUCT_ID",
      "productId",
      "Product ID must be a canonical lowercase UUID before identity derivation.",
    );
  }
  return Buffer.from(compact, "hex");
}

export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.byteLength !== 16) {
    fail(
      "GARAK_IDENTITY_INVALID_PRODUCT_ID_BYTES",
      "productId",
      "Product ID must contain exactly 16 bytes.",
    );
  }
  const hexadecimal = Buffer.from(bytes).toString("hex");
  return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`;
}

export function fuidToBytes(fuid: string): Buffer {
  if (!/^[0-9A-F]{32}$/u.test(fuid)) {
    fail(
      "GARAK_IDENTITY_INVALID_FUID",
      "fuid",
      "FUID must be exactly 32 uppercase hexadecimal characters.",
    );
  }
  return Buffer.from(fuid, "hex");
}
