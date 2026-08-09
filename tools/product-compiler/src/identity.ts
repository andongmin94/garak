import { createHash } from "node:crypto";

import { fail } from "./errors.ts";
import type { ProductIdentity } from "./project_model.ts";

export const PRODUCT_IDENTITY_NAMESPACE = "garak.vst3-product-identity.v1";
export type ProductIdentityRole = "processor" | "controller";

export const PHASE_1A_1B_FUIDS = Object.freeze([
  "3D6F3C09296D49EF99334C4688F484EE",
  "2CD50BAE587A4F3E812399E550F352D4",
  "4B2B557251D44CE9914F9B105136FB7E",
  "7A90454628B34A3497F05E7CC718F8A1",
  "C29B7245261642668ADAC664B6817678",
  "1DE08859308F4A0A8473EA5CB70771D2",
  "93952A37BFA84FF1AC06CE58B9FA87EA",
  "E08F3ACCD825424AB238BBAB6B0248CC",
  "44BFB8B6F56946FF9F6F193529BCB967",
  "826C362FA2784F719351912BE834F9AB",
]);

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
