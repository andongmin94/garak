import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadProductProject, validateProjectValue } from "../src/validation.ts";
import {
  expectProductError,
  mutableWarmProduct,
  withTemporaryDirectory,
  writeProject,
  writeRawProject,
} from "./helpers.ts";

test("validates the Warm and Bright reference projects", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const warm = await loadProductProject(
    path.join(repositoryRoot, "examples/products/artist-gain-warm.garak"),
  );
  const bright = await loadProductProject(
    path.join(repositoryRoot, "examples/products/artist-gain-bright.garak"),
  );
  assert.equal(warm.defaults.gainDb, -6);
  assert.equal(bright.defaults.gainDb, 3);
});

test("requires an exact lowercase .garak directory suffix", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const wrong = await writeProject(
      temporary,
      mutableWarmProduct(),
      "fixture.GARAK",
    );
    await expectProductError(
      () => loadProductProject(wrong),
      "GARAK_PROJECT_PACKAGE_SUFFIX",
    );
    if (process.platform === "win32") {
      await expectProductError(
        () => loadProductProject(path.join(temporary, "fixture.garak")),
        "GARAK_PROJECT_PACKAGE_SUFFIX",
      );
    }
  });
});

test("rejects missing and malformed physical packages", async () => {
  await withTemporaryDirectory(async (temporary) => {
    await expectProductError(
      () => loadProductProject(path.join(temporary, "missing.garak")),
      "GARAK_PROJECT_NOT_FOUND",
    );

    const empty = path.join(temporary, "empty.garak");
    await mkdir(empty);
    await expectProductError(
      () => loadProductProject(empty),
      "GARAK_PROJECT_INVALID_INVENTORY",
    );

    const extra = await writeProject(
      temporary,
      mutableWarmProduct(),
      "extra.garak",
    );
    await writeFile(path.join(extra, "extra.txt"), "no");
    await expectProductError(
      () => loadProductProject(extra),
      "GARAK_PROJECT_INVALID_INVENTORY",
    );

    const wrongCase = path.join(temporary, "case.garak");
    await mkdir(wrongCase);
    await writeFile(path.join(wrongCase, "Product.json"), "{}");
    await expectProductError(
      () => loadProductProject(wrongCase),
      "GARAK_PROJECT_INVALID_INVENTORY",
    );
  });
});

test("rejects malformed JSON, duplicate escaped keys, invalid UTF-8, and BOM", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const malformed = await writeRawProject(temporary, "{", "malformed.garak");
    await expectProductError(
      () => loadProductProject(malformed),
      "GARAK_PROJECT_JSON_SYNTAX",
    );

    const duplicate = await writeRawProject(
      temporary,
      '{"schemaVersion":1,"productId":"6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e","vendor":"A","name":"Name","n\\u0061me":"Other","version":"0.1.0","category":"Fx","template":"garak.gain-v1","defaults":{"gainDb":0}}',
      "duplicate.garak",
    );
    await expectProductError(
      () => loadProductProject(duplicate),
      "GARAK_PROJECT_DUPLICATE_KEY",
    );

    const invalidUtf8 = path.join(temporary, "utf8.garak");
    await mkdir(invalidUtf8);
    await writeFile(
      path.join(invalidUtf8, "product.json"),
      Buffer.from([0xc3, 0x28]),
    );
    await expectProductError(
      () => loadProductProject(invalidUtf8),
      "GARAK_PROJECT_INVALID_UTF8",
    );

    const bom = path.join(temporary, "bom.garak");
    await mkdir(bom);
    await writeFile(
      path.join(bom, "product.json"),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("{}")]),
    );
    await expectProductError(
      () => loadProductProject(bom),
      "GARAK_PROJECT_UTF8_BOM",
    );
  });
});

test("rejects every strict schema and identity failure category", async () => {
  const cases: readonly [
    string,
    (product: ReturnType<typeof mutableWarmProduct>) => void,
    string,
  ][] = [
    [
      "unknown field",
      (product) => {
        product.unknown = true;
      },
      "GARAK_PROJECT_UNKNOWN_FIELD",
    ],
    [
      "missing field",
      (product) => {
        Reflect.deleteProperty(product, "vendor");
      },
      "GARAK_PROJECT_MISSING_FIELD",
    ],
    [
      "schema type",
      (product) => {
        product.schemaVersion = "1";
      },
      "GARAK_PROJECT_WRONG_TYPE",
    ],
    [
      "schema version",
      (product) => {
        product.schemaVersion = 2;
      },
      "GARAK_PROJECT_SCHEMA_VERSION",
    ],
    [
      "nil uuid",
      (product) => {
        product.productId = "00000000-0000-0000-0000-000000000000";
      },
      "GARAK_PROJECT_NIL_PRODUCT_ID",
    ],
    [
      "malformed uuid",
      (product) => {
        product.productId = "not-a-uuid";
      },
      "GARAK_PROJECT_INVALID_PRODUCT_ID",
    ],
    [
      "noncanonical uuid",
      (product) => {
        product.productId = "6F0E50F1-A2D4-4B37-8C9E-1F2A3B4C5D6E";
      },
      "GARAK_PROJECT_INVALID_PRODUCT_ID",
    ],
    [
      "empty vendor",
      (product) => {
        product.vendor = "  ";
      },
      "GARAK_PROJECT_EMPTY_STRING",
    ],
    [
      "empty name",
      (product) => {
        product.name = "";
      },
      "GARAK_PROJECT_EMPTY_STRING",
    ],
    [
      "vendor bytes",
      (product) => {
        product.vendor = "é".repeat(32);
      },
      "GARAK_PROJECT_STRING_TOO_LONG",
    ],
    [
      "name bytes",
      (product) => {
        product.name = "x".repeat(53);
      },
      "GARAK_PROJECT_STRING_TOO_LONG",
    ],
    [
      "control",
      (product) => {
        product.vendor = "Bad\u0000Vendor";
      },
      "GARAK_PROJECT_CONTROL_CHARACTER",
    ],
    [
      "metadata bom",
      (product) => {
        product.vendor = "\uFEFFBadVendor";
      },
      "GARAK_PROJECT_METADATA_BOM",
    ],
    [
      "unpaired surrogate",
      (product) => {
        product.vendor = "Bad\uD800Vendor";
      },
      "GARAK_PROJECT_INVALID_UNICODE",
    ],
    [
      "filename character",
      (product) => {
        product.name = "Bad:Name";
      },
      "GARAK_PROJECT_INVALID_WINDOWS_NAME",
    ],
    [
      "trailing dot",
      (product) => {
        product.name = "Bad.";
      },
      "GARAK_PROJECT_INVALID_WINDOWS_NAME",
    ],
    [
      "reserved device",
      (product) => {
        product.name = "CON.txt";
      },
      "GARAK_PROJECT_RESERVED_WINDOWS_NAME",
    ],
    [
      "reserved superscript device",
      (product) => {
        product.name = "COM¹.txt";
      },
      "GARAK_PROJECT_RESERVED_WINDOWS_NAME",
    ],
    [
      "version syntax",
      (product) => {
        product.version = "01.2.3";
      },
      "GARAK_PROJECT_INVALID_VERSION",
    ],
    [
      "version range",
      (product) => {
        product.version = "65536.0.0";
      },
      "GARAK_PROJECT_VERSION_RANGE",
    ],
    [
      "category",
      (product) => {
        product.category = "Instrument";
      },
      "GARAK_PROJECT_INVALID_CATEGORY",
    ],
    [
      "template",
      (product) => {
        product.template = "unknown";
      },
      "GARAK_PROJECT_INVALID_TEMPLATE",
    ],
    [
      "gain type",
      (product) => {
        product.defaults.gainDb = "zero";
      },
      "GARAK_PROJECT_WRONG_TYPE",
    ],
    [
      "gain below",
      (product) => {
        product.defaults.gainDb = -60.1;
      },
      "GARAK_PROJECT_GAIN_RANGE",
    ],
    [
      "gain above",
      (product) => {
        product.defaults.gainDb = 12.1;
      },
      "GARAK_PROJECT_GAIN_RANGE",
    ],
    [
      "defaults unknown",
      (product) => {
        product.defaults.extra = 1;
      },
      "GARAK_PROJECT_UNKNOWN_FIELD",
    ],
  ];

  for (const [name, mutate, code] of cases) {
    const product = mutableWarmProduct();
    mutate(product);
    await expectProductError(
      () => validateProjectValue(product, `test:${name}`),
      code,
    );
  }
  await expectProductError(
    () =>
      validateProjectValue(
        {
          ...mutableWarmProduct(),
          defaults: { gainDb: Number.POSITIVE_INFINITY },
        },
        "test:nonfinite",
      ),
    "GARAK_PROJECT_NONFINITE_GAIN",
  );
});

test("accepts exact UTF-8 byte boundaries and canonical gain endpoints", () => {
  const product = mutableWarmProduct();
  product.vendor = `${"é".repeat(31)}a`;
  product.name = "x".repeat(52);
  product.defaults.gainDb = 12;
  const validated = validateProjectValue(product, "boundary.garak");
  assert.equal(Buffer.byteLength(validated.vendor), 63);
  assert.equal(Buffer.byteLength(validated.name), 52);
});
