import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import { fail } from "./errors.ts";
import {
  bytesToUuid,
  deriveProductIdentity,
  fuidToBytes,
  uuidToBytes,
} from "./identity.ts";
import {
  BYPASS_PARAMETER_ID,
  GAIN_PARAMETER_ID,
  PRODUCT_CATEGORY,
  PRODUCT_MAXIMUM_GAIN_DB,
  PRODUCT_MINIMUM_GAIN_DB,
  PRODUCT_NAME_MAXIMUM_BYTES,
  PRODUCT_TEMPLATE,
  PRODUCT_VENDOR_MAXIMUM_BYTES,
  containsControlCharacter,
  isWellFormedUnicode,
  normalizedGainDefault,
  utf8ByteLength,
} from "./project_model.ts";
import type {
  ProductIdentity,
  ProductProject,
  ProductVersion,
} from "./project_model.ts";

export const COMPILED_PRODUCT_MAGIC = Buffer.from("GARAKCPD", "ascii");
export const COMPILED_PRODUCT_MAJOR_VERSION = 1;
export const COMPILED_PRODUCT_MINOR_VERSION = 0;
export const COMPILED_PRODUCT_HEADER_BYTES = 96;
export const COMPILED_PRODUCT_PARAMETER_BYTES = 24;
export const COMPILED_PRODUCT_PARAMETER_COUNT = 2;
export const COMPILED_PRODUCT_MAXIMUM_BYTES = 4096;

const CATEGORY_FX = 1;
const TEMPLATE_GAIN_V1 = 1;
const PARAMETER_TYPE_CONTINUOUS = 1;
const PARAMETER_TYPE_BOOLEAN = 2;
const PARAMETER_FLAG_AUTOMATABLE = 1;
const PARAMETER_FLAG_BOOLEAN_BYPASS = 3;
const WINDOWS_INVALID_FILENAME = /[<>:"/\\|?*]/u;
const WINDOWS_RESERVED_BASENAME =
  /^(?:CON|PRN|AUX|NUL|COM(?:[1-9]|[¹²³])|LPT(?:[1-9]|[¹²³])|CONIN\$|CONOUT\$|CLOCK\$)$/iu;

export interface CompiledParameter {
  readonly id: number;
  readonly type: number;
  readonly flags: number;
  readonly defaultNormalized: number;
}

export interface CompiledProduct {
  readonly productId: string;
  readonly identity: ProductIdentity;
  readonly vendor: string;
  readonly name: string;
  readonly version: ProductVersion;
  readonly versionText: string;
  readonly category: typeof PRODUCT_CATEGORY;
  readonly template: typeof PRODUCT_TEMPLATE;
  readonly parameters: readonly [CompiledParameter, CompiledParameter];
}

function compiledFailure(code: string, field: string, message: string): never {
  fail(
    code,
    field.length === 0 ? "product.garakbin" : `product.garakbin.${field}`,
    message,
  );
}

function writeParameter(
  output: Buffer,
  offset: number,
  id: number,
  type: number,
  flags: number,
  defaultNormalized: number,
): void {
  output.writeUInt32LE(id, offset);
  output.writeUInt16LE(type, offset + 4);
  output.writeUInt16LE(flags, offset + 6);
  output.writeDoubleLE(defaultNormalized, offset + 8);
  output.writeUInt32LE(0, offset + 16);
  output.writeUInt32LE(0, offset + 20);
}

export function encodeCompiledProduct(project: ProductProject): Buffer {
  const identity = deriveProductIdentity(project.productId);
  const vendorBytes = Buffer.from(project.vendor, "utf8");
  const nameBytes = Buffer.from(project.name, "utf8");
  const totalBytes =
    COMPILED_PRODUCT_HEADER_BYTES +
    vendorBytes.length +
    nameBytes.length +
    COMPILED_PRODUCT_PARAMETER_BYTES * COMPILED_PRODUCT_PARAMETER_COUNT;
  const output = Buffer.alloc(totalBytes);

  COMPILED_PRODUCT_MAGIC.copy(output, 0);
  output.writeUInt16LE(COMPILED_PRODUCT_MAJOR_VERSION, 8);
  output.writeUInt16LE(COMPILED_PRODUCT_MINOR_VERSION, 10);
  output.writeUInt32LE(COMPILED_PRODUCT_HEADER_BYTES, 12);
  output.writeUInt32LE(totalBytes, 16);
  output.writeUInt32LE(0, 20);
  output.writeUInt32LE(0, 24);
  uuidToBytes(project.productId).copy(output, 28);
  fuidToBytes(identity.processorFuid).copy(output, 44);
  fuidToBytes(identity.controllerFuid).copy(output, 60);
  output.writeUInt16LE(project.versionParts.major, 76);
  output.writeUInt16LE(project.versionParts.minor, 78);
  output.writeUInt16LE(project.versionParts.patch, 80);
  output.writeUInt16LE(CATEGORY_FX, 82);
  output.writeUInt32LE(TEMPLATE_GAIN_V1, 84);
  output.writeUInt16LE(vendorBytes.length, 88);
  output.writeUInt16LE(nameBytes.length, 90);
  output.writeUInt16LE(COMPILED_PRODUCT_PARAMETER_COUNT, 92);
  output.writeUInt16LE(0, 94);

  let offset = COMPILED_PRODUCT_HEADER_BYTES;
  vendorBytes.copy(output, offset);
  offset += vendorBytes.length;
  nameBytes.copy(output, offset);
  offset += nameBytes.length;
  writeParameter(
    output,
    offset,
    GAIN_PARAMETER_ID,
    PARAMETER_TYPE_CONTINUOUS,
    PARAMETER_FLAG_AUTOMATABLE,
    normalizedGainDefault(project.defaults.gainDb),
  );
  offset += COMPILED_PRODUCT_PARAMETER_BYTES;
  writeParameter(
    output,
    offset,
    BYPASS_PARAMETER_ID,
    PARAMETER_TYPE_BOOLEAN,
    PARAMETER_FLAG_BOOLEAN_BYPASS,
    0,
  );
  return output;
}

function readUtf8(bytes: Buffer, field: string, maximumBytes: number): string {
  if (bytes.length === 0 || bytes.length > maximumBytes) {
    compiledFailure(
      "GARAK_COMPILED_STRING_LENGTH",
      field,
      `${field} must contain 1..${maximumBytes} UTF-8 bytes.`,
    );
  }
  let value: string;
  try {
    value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    compiledFailure(
      "GARAK_COMPILED_INVALID_UTF8",
      field,
      `${field} is not valid UTF-8.`,
    );
  }
  if (
    value.trim().length === 0 ||
    containsControlCharacter(value) ||
    value.includes("\uFEFF") ||
    !isWellFormedUnicode(value) ||
    utf8ByteLength(value) !== bytes.length
  ) {
    compiledFailure(
      "GARAK_COMPILED_INVALID_STRING",
      field,
      `${field} contains an invalid product metadata string.`,
    );
  }
  return value;
}

function readParameter(bytes: Buffer, offset: number): CompiledParameter {
  const id = bytes.readUInt32LE(offset);
  const type = bytes.readUInt16LE(offset + 4);
  const flags = bytes.readUInt16LE(offset + 6);
  const defaultNormalized = bytes.readDoubleLE(offset + 8);
  if (
    bytes.readUInt32LE(offset + 16) !== 0 ||
    bytes.readUInt32LE(offset + 20) !== 0
  ) {
    compiledFailure(
      "GARAK_COMPILED_RESERVED_NONZERO",
      `parameters.${id}.reserved`,
      "Parameter reserved fields must be zero.",
    );
  }
  if (
    !Number.isFinite(defaultNormalized) ||
    defaultNormalized < 0 ||
    defaultNormalized > 1
  ) {
    compiledFailure(
      "GARAK_COMPILED_PARAMETER_DEFAULT",
      `parameters.${id}.defaultNormalized`,
      "Parameter normalized default must be finite and within 0..1.",
    );
  }
  if (Object.is(defaultNormalized, -0)) {
    compiledFailure(
      "GARAK_COMPILED_PARAMETER_DEFAULT",
      `parameters.${id}.defaultNormalized`,
      "Parameter normalized default must not use negative zero.",
    );
  }
  return { id, type, flags, defaultNormalized };
}

export function decodeCompiledProduct(input: Uint8Array): CompiledProduct {
  const bytes = Buffer.from(input);
  if (
    bytes.length <
      COMPILED_PRODUCT_HEADER_BYTES +
        COMPILED_PRODUCT_PARAMETER_BYTES * COMPILED_PRODUCT_PARAMETER_COUNT ||
    bytes.length > COMPILED_PRODUCT_MAXIMUM_BYTES
  ) {
    compiledFailure(
      "GARAK_COMPILED_SIZE",
      "",
      `Compiled product data must contain a bounded complete v1 payload; received ${bytes.length} bytes.`,
    );
  }
  if (!bytes.subarray(0, 8).equals(COMPILED_PRODUCT_MAGIC)) {
    compiledFailure(
      "GARAK_COMPILED_MAGIC",
      "magic",
      "Magic must be exactly 'GARAKCPD'.",
    );
  }
  if (
    bytes.readUInt16LE(8) !== COMPILED_PRODUCT_MAJOR_VERSION ||
    bytes.readUInt16LE(10) !== COMPILED_PRODUCT_MINOR_VERSION
  ) {
    compiledFailure(
      "GARAK_COMPILED_VERSION",
      "version",
      "Compiled product format version must be exactly 1.0.",
    );
  }
  if (bytes.readUInt32LE(12) !== COMPILED_PRODUCT_HEADER_BYTES) {
    compiledFailure(
      "GARAK_COMPILED_HEADER_SIZE",
      "headerSize",
      `Header size must be exactly ${COMPILED_PRODUCT_HEADER_BYTES}.`,
    );
  }
  const declaredTotal = bytes.readUInt32LE(16);
  if (declaredTotal !== bytes.length) {
    compiledFailure(
      "GARAK_COMPILED_TOTAL_SIZE",
      "totalSize",
      "Declared total size must equal the exact file size; trailing or truncated data is forbidden.",
    );
  }
  if (bytes.readUInt32LE(20) !== 0 || bytes.readUInt32LE(24) !== 0) {
    compiledFailure(
      "GARAK_COMPILED_RESERVED_NONZERO",
      "headerFlags",
      "Header flags and reserved fields must be zero.",
    );
  }

  const productIdBytes = bytes.subarray(28, 44);
  if (productIdBytes.every((byte) => byte === 0)) {
    compiledFailure(
      "GARAK_COMPILED_NIL_PRODUCT_ID",
      "productId",
      "Product ID must not be nil.",
    );
  }
  const productId = bytesToUuid(productIdBytes);
  const processorFuid = bytes.subarray(44, 60).toString("hex").toUpperCase();
  const controllerFuid = bytes.subarray(60, 76).toString("hex").toUpperCase();
  if (/^0{32}$/u.test(processorFuid) || /^0{32}$/u.test(controllerFuid)) {
    compiledFailure(
      "GARAK_COMPILED_NIL_FUID",
      "identity",
      "Processor and controller FUIDs must be non-zero.",
    );
  }
  if (processorFuid === controllerFuid) {
    compiledFailure(
      "GARAK_COMPILED_DUPLICATE_FUID",
      "identity",
      "Processor and controller FUIDs must be distinct.",
    );
  }
  const expectedIdentity = deriveProductIdentity(productId);
  if (
    processorFuid !== expectedIdentity.processorFuid ||
    controllerFuid !== expectedIdentity.controllerFuid
  ) {
    compiledFailure(
      "GARAK_COMPILED_IDENTITY_MISMATCH",
      "identity",
      "Stored FUIDs do not match deterministic Product ID derivation v1.",
    );
  }

  const version: ProductVersion = {
    major: bytes.readUInt16LE(76),
    minor: bytes.readUInt16LE(78),
    patch: bytes.readUInt16LE(80),
  };
  if (bytes.readUInt16LE(82) !== CATEGORY_FX) {
    compiledFailure(
      "GARAK_COMPILED_CATEGORY",
      "category",
      "Category enum must be Fx (1).",
    );
  }
  if (bytes.readUInt32LE(84) !== TEMPLATE_GAIN_V1) {
    compiledFailure(
      "GARAK_COMPILED_TEMPLATE",
      "template",
      "Template ID must be garak.gain-v1 (1).",
    );
  }
  const vendorLength = bytes.readUInt16LE(88);
  const nameLength = bytes.readUInt16LE(90);
  if (bytes.readUInt16LE(92) !== COMPILED_PRODUCT_PARAMETER_COUNT) {
    compiledFailure(
      "GARAK_COMPILED_PARAMETER_COUNT",
      "parameterCount",
      `Parameter count must be exactly ${COMPILED_PRODUCT_PARAMETER_COUNT}.`,
    );
  }
  if (bytes.readUInt16LE(94) !== 0) {
    compiledFailure(
      "GARAK_COMPILED_RESERVED_NONZERO",
      "headerReserved",
      "Header reserved field must be zero.",
    );
  }
  const expectedTotal =
    COMPILED_PRODUCT_HEADER_BYTES +
    vendorLength +
    nameLength +
    COMPILED_PRODUCT_PARAMETER_BYTES * COMPILED_PRODUCT_PARAMETER_COUNT;
  if (expectedTotal !== bytes.length) {
    compiledFailure(
      "GARAK_COMPILED_LAYOUT_SIZE",
      "stringLengths",
      "String lengths and parameter table do not match the exact total size.",
    );
  }

  let offset = COMPILED_PRODUCT_HEADER_BYTES;
  const vendor = readUtf8(
    bytes.subarray(offset, offset + vendorLength),
    "vendor",
    PRODUCT_VENDOR_MAXIMUM_BYTES,
  );
  offset += vendorLength;
  const name = readUtf8(
    bytes.subarray(offset, offset + nameLength),
    "name",
    PRODUCT_NAME_MAXIMUM_BYTES,
  );
  const nameBase = name.split(".", 1)[0] ?? "";
  if (
    WINDOWS_INVALID_FILENAME.test(name) ||
    name.endsWith(".") ||
    name.endsWith(" ") ||
    WINDOWS_RESERVED_BASENAME.test(nameBase)
  ) {
    compiledFailure(
      "GARAK_COMPILED_INVALID_NAME",
      "name",
      "Product name is not a valid Windows artifact component.",
    );
  }
  offset += nameLength;
  const gain = readParameter(bytes, offset);
  offset += COMPILED_PRODUCT_PARAMETER_BYTES;
  const bypass = readParameter(bytes, offset);

  if (gain.id === bypass.id) {
    compiledFailure(
      "GARAK_COMPILED_DUPLICATE_PARAMETER",
      "parameters",
      `Duplicate parameter ID ${gain.id} is forbidden.`,
    );
  }
  if (gain.id >= bypass.id) {
    compiledFailure(
      "GARAK_COMPILED_PARAMETER_ORDER",
      "parameters",
      "Parameter records must be sorted by strictly increasing numeric ID.",
    );
  }
  if (
    gain.id !== GAIN_PARAMETER_ID ||
    gain.type !== PARAMETER_TYPE_CONTINUOUS ||
    gain.flags !== PARAMETER_FLAG_AUTOMATABLE
  ) {
    compiledFailure(
      "GARAK_COMPILED_GAIN_CONTRACT",
      "parameters.1001",
      "Gain parameter must use the exact garak.gain-v1 ID/type/flags contract.",
    );
  }
  if (
    bypass.id !== BYPASS_PARAMETER_ID ||
    bypass.type !== PARAMETER_TYPE_BOOLEAN ||
    bypass.flags !== PARAMETER_FLAG_BOOLEAN_BYPASS ||
    bypass.defaultNormalized !== 0
  ) {
    compiledFailure(
      "GARAK_COMPILED_BYPASS_CONTRACT",
      "parameters.1002",
      "Bypass parameter must use the exact garak.gain-v1 ID/type/flags/default contract.",
    );
  }

  const gainDb =
    gain.defaultNormalized *
      (PRODUCT_MAXIMUM_GAIN_DB - PRODUCT_MINIMUM_GAIN_DB) +
    PRODUCT_MINIMUM_GAIN_DB;
  if (gainDb < PRODUCT_MINIMUM_GAIN_DB || gainDb > PRODUCT_MAXIMUM_GAIN_DB) {
    compiledFailure(
      "GARAK_COMPILED_GAIN_DEFAULT",
      "parameters.1001.defaultNormalized",
      "Gain default is outside the template range.",
    );
  }

  return {
    productId,
    identity: { processorFuid, controllerFuid },
    vendor,
    name,
    version,
    versionText: `${version.major}.${version.minor}.${version.patch}`,
    category: PRODUCT_CATEGORY,
    template: PRODUCT_TEMPLATE,
    parameters: [gain, bypass],
  };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}
