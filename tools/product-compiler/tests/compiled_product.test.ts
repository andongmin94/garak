import assert from "node:assert/strict";
import { mkdir, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  decodeCompiledProduct,
  encodeCompiledProduct,
  sha256Hex,
} from "../src/compiled_product.ts";
import { loadProductProject, validateProjectValue } from "../src/validation.ts";
import {
  expectProductError,
  mutableWarmProduct,
  withTemporaryDirectory,
  writeRawProject,
} from "./helpers.ts";

const WARM_COMPILED_HEX =
  "474152414B4350440100000060000000B100000000000000000000006F0E50F1A2D44B378C9E1F2A3B4C5D6E3BA93DD6A062C97D89EC78F3652F83C400DD9000A50F7F28F4AE084CD29C43300000010000000100010000001100100002000000476172616B205465737420417274697374417274697374204761696E205761726DE903000001000100000000000000E83F0000000000000000EA0300000200030000000000000000000000000000000000";
const WARM_COMPILED_SHA256 =
  "3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9";
const BRIGHT_COMPILED_SHA256 =
  "ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52";

function warmBytes(): Buffer {
  return Buffer.from(WARM_COMPILED_HEX, "hex");
}

test("encodes the normative Warm fixture bytes and SHA-256 exactly", () => {
  const project = validateProjectValue(mutableWarmProduct(), "fixture.garak");
  const encoded = encodeCompiledProduct(project);
  assert.equal(encoded.length, 177);
  assert.equal(encoded.toString("hex").toUpperCase(), WARM_COMPILED_HEX);
  assert.equal(sha256Hex(encoded), WARM_COMPILED_SHA256);

  const decoded = decodeCompiledProduct(encoded);
  assert.equal(decoded.productId, project.productId);
  assert.equal(decoded.vendor, project.vendor);
  assert.equal(decoded.name, project.name);
  assert.equal(decoded.parameters[0].id, 1001);
  assert.equal(decoded.parameters[0].defaultNormalized, 0.75);
  assert.equal(decoded.parameters[1].id, 1002);
  assert.equal(decoded.parameters[1].defaultNormalized, 0);
});

test("encodes the independent Bright fixture size and SHA-256 exactly", () => {
  const value = mutableWarmProduct();
  value.productId = "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357";
  value.name = "Artist Gain Bright";
  value.defaults.gainDb = 3;
  const encoded = encodeCompiledProduct(
    validateProjectValue(value, "artist-gain-bright.garak"),
  );
  assert.equal(encoded.length, 179);
  assert.equal(sha256Hex(encoded), BRIGHT_COMPILED_SHA256);
});

test("rejects malformed header, identity, layout, parameter, and default fields", async () => {
  const mutations: readonly [string, (bytes: Buffer) => Buffer, string][] = [
    [
      "magic",
      (bytes) => {
        bytes[0] = 0;
        return bytes;
      },
      "GARAK_COMPILED_MAGIC",
    ],
    [
      "version",
      (bytes) => {
        bytes.writeUInt16LE(2, 8);
        return bytes;
      },
      "GARAK_COMPILED_VERSION",
    ],
    [
      "header size",
      (bytes) => {
        bytes.writeUInt32LE(95, 12);
        return bytes;
      },
      "GARAK_COMPILED_HEADER_SIZE",
    ],
    [
      "total size",
      (bytes) => {
        bytes.writeUInt32LE(176, 16);
        return bytes;
      },
      "GARAK_COMPILED_TOTAL_SIZE",
    ],
    [
      "flags",
      (bytes) => {
        bytes.writeUInt32LE(1, 20);
        return bytes;
      },
      "GARAK_COMPILED_RESERVED_NONZERO",
    ],
    [
      "nil product",
      (bytes) => {
        bytes.fill(0, 28, 44);
        return bytes;
      },
      "GARAK_COMPILED_NIL_PRODUCT_ID",
    ],
    [
      "identity",
      (bytes) => {
        bytes[44] = (bytes[44] ?? 0) ^ 1;
        return bytes;
      },
      "GARAK_COMPILED_IDENTITY_MISMATCH",
    ],
    [
      "category",
      (bytes) => {
        bytes.writeUInt16LE(2, 82);
        return bytes;
      },
      "GARAK_COMPILED_CATEGORY",
    ],
    [
      "template",
      (bytes) => {
        bytes.writeUInt32LE(2, 84);
        return bytes;
      },
      "GARAK_COMPILED_TEMPLATE",
    ],
    [
      "count",
      (bytes) => {
        bytes.writeUInt16LE(1, 92);
        return bytes;
      },
      "GARAK_COMPILED_PARAMETER_COUNT",
    ],
    [
      "reserved",
      (bytes) => {
        bytes.writeUInt16LE(1, 94);
        return bytes;
      },
      "GARAK_COMPILED_RESERVED_NONZERO",
    ],
    [
      "string size",
      (bytes) => {
        bytes.writeUInt16LE(62, 88);
        return bytes;
      },
      "GARAK_COMPILED_LAYOUT_SIZE",
    ],
    [
      "invalid utf8",
      (bytes) => {
        bytes[96] = 0xff;
        return bytes;
      },
      "GARAK_COMPILED_INVALID_UTF8",
    ],
    [
      "duplicate parameter",
      (bytes) => {
        bytes.writeUInt32LE(1001, 153);
        return bytes;
      },
      "GARAK_COMPILED_DUPLICATE_PARAMETER",
    ],
    [
      "unsorted parameter",
      (bytes) => {
        bytes.writeUInt32LE(1002, 129);
        bytes.writeUInt32LE(1001, 153);
        return bytes;
      },
      "GARAK_COMPILED_PARAMETER_ORDER",
    ],
    [
      "unknown gain",
      (bytes) => {
        bytes.writeUInt32LE(999, 129);
        return bytes;
      },
      "GARAK_COMPILED_GAIN_CONTRACT",
    ],
    [
      "parameter reserved",
      (bytes) => {
        bytes.writeUInt32LE(1, 145);
        return bytes;
      },
      "GARAK_COMPILED_RESERVED_NONZERO",
    ],
    [
      "nonfinite default",
      (bytes) => {
        bytes.writeDoubleLE(Number.NaN, 137);
        return bytes;
      },
      "GARAK_COMPILED_PARAMETER_DEFAULT",
    ],
    [
      "negative zero",
      (bytes) => {
        bytes.writeDoubleLE(-0, 137);
        return bytes;
      },
      "GARAK_COMPILED_PARAMETER_DEFAULT",
    ],
    [
      "bypass default",
      (bytes) => {
        bytes.writeDoubleLE(1, 161);
        return bytes;
      },
      "GARAK_COMPILED_BYPASS_CONTRACT",
    ],
    [
      "trailing byte",
      (bytes) => Buffer.concat([bytes, Buffer.from([0])]),
      "GARAK_COMPILED_TOTAL_SIZE",
    ],
    [
      "truncated",
      (bytes) => bytes.subarray(0, bytes.length - 1),
      "GARAK_COMPILED_TOTAL_SIZE",
    ],
  ];
  for (const [name, mutate, code] of mutations) {
    await expectProductError(
      () => decodeCompiledProduct(mutate(warmBytes())),
      code,
    );
    assert.ok(name.length > 0);
  }
});

test("rejects corrupt valid-UTF8 Windows metadata", async () => {
  const bytes = warmBytes();
  const nameOffset = 96 + 17;
  Buffer.from("CON             ", "ascii").copy(bytes, nameOffset);
  await expectProductError(
    () => decodeCompiledProduct(bytes),
    "GARAK_COMPILED_INVALID_NAME",
  );

  const bomBytes = warmBytes();
  Buffer.concat([
    Buffer.from("A", "ascii"),
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from("BadMetadata!", "ascii"),
  ]).copy(bomBytes, nameOffset);
  await expectProductError(
    () => decodeCompiledProduct(bomBytes),
    "GARAK_COMPILED_INVALID_STRING",
  );
});

test("compiled data ignores JSON order, whitespace, source path, timestamp, and CWD", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const firstText = JSON.stringify(mutableWarmProduct());
    const reorderedText = `{
      "defaults": { "gainDb": -6.0 },
      "template": "garak.gain-v1",
      "category": "Fx",
      "version": "0.1.0",
      "name": "Artist Gain Warm",
      "vendor": "Garak Test Artist",
      "productId": "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
      "schemaVersion": 1
    }`;
    const firstDirectory = await writeRawProject(
      temporary,
      firstText,
      "first.garak",
    );
    const secondDirectory = await writeRawProject(
      temporary,
      reorderedText,
      "second.garak",
    );
    await utimes(
      path.join(secondDirectory, "product.json"),
      new Date(1_000),
      new Date(2_000),
    );
    const first = encodeCompiledProduct(
      await loadProductProject(firstDirectory),
    );
    const originalCwd = process.cwd();
    let second: Buffer;
    try {
      process.chdir(temporary);
      second = encodeCompiledProduct(
        await loadProductProject(path.resolve(secondDirectory)),
      );
    } finally {
      process.chdir(originalCwd);
    }
    assert.deepEqual(second, first);
    assert.equal(sha256Hex(second), WARM_COMPILED_SHA256);

    const output = path.join(temporary, "unused");
    await mkdir(output);
    await writeFile(
      path.join(output, "proof.txt"),
      "paths do not enter compiled bytes",
    );
    assert.equal(
      sha256Hex(
        encodeCompiledProduct(await loadProductProject(firstDirectory)),
      ),
      WARM_COMPILED_SHA256,
    );
  });
});
