import assert from "node:assert/strict";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  detectProjectSchemaVersion,
  loadProductProject,
  loadProductProjectSource,
  validateProjectSchemaV1,
  validateProjectSchemaV2,
  validateProjectSchemaV3,
  validateProjectValue,
} from "../src/validation.ts";
import {
  expectProductError,
  mutableLegacyV2WarmProduct,
  mutableLegacyWarmProduct,
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
  assert.equal(warm.schemaVersion, 3);
  assert.deepEqual(warm.template, { id: "garak.gain", version: 1 });
  assert.equal(Object.hasOwn(warm, "sourceDirectory"), false);

  const legacyWarmDirectory = path.join(
    repositoryRoot,
    "examples/products/legacy/v1/artist-gain-warm.garak",
  );
  const legacySourcePath = path.join(legacyWarmDirectory, "product.json");
  const legacyBytesBefore = await readFile(legacySourcePath);
  const legacyWarm = await loadProductProjectSource(legacyWarmDirectory);
  assert.equal(legacyWarm.project.schemaVersion, 3);
  assert.deepEqual(legacyWarm.project.template, {
    id: "garak.gain",
    version: 1,
  });
  assert.equal(Object.hasOwn(legacyWarm.project, "sourceDirectory"), false);
  assert.equal(legacyWarm.sourceDirectory, legacyWarmDirectory);
  assert.equal(
    legacyWarm.physicalSourceDirectory,
    await realpath(legacyWarmDirectory),
  );
  assert.deepEqual(legacyWarm.schemaStatus, {
    sourceSchemaVersion: 1,
    currentSchemaVersion: 3,
    migrationRequired: true,
    steps: ["project-schema-1-to-2", "project-schema-2-to-3"],
  });
  assert.deepEqual(await readFile(legacySourcePath), legacyBytesBefore);
  assert.match(legacyBytesBefore.toString("utf8"), /"schemaVersion": 1/u);

  for (const [leaf, gainDb] of [
    ["artist-gain-warm.garak", -6],
    ["artist-gain-bright.garak", 3],
  ] as const) {
    const legacyV2Directory = path.join(
      repositoryRoot,
      "examples/products/legacy/v2",
      leaf,
    );
    const sourcePath = path.join(legacyV2Directory, "product.json");
    const bytesBefore = await readFile(sourcePath);
    const loaded = await loadProductProjectSource(legacyV2Directory);
    assert.equal(loaded.project.schemaVersion, 3);
    assert.equal(loaded.project.defaults.gainDb, gainDb);
    assert.deepEqual(loaded.schemaStatus, {
      sourceSchemaVersion: 2,
      currentSchemaVersion: 3,
      migrationRequired: true,
      steps: ["project-schema-2-to-3"],
    });
    assert.deepEqual(await readFile(sourcePath), bytesBefore);
    assert.match(bytesBefore.toString("utf8"), /"schemaVersion": 2/u);
  }
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

    const duplicateVersion = await writeRawProject(
      temporary,
      '{"schemaVersion":1,"schemaV\\u0065rsion":2,"productId":"6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e","vendor":"A","name":"Name","version":"0.1.0","category":"Fx","template":"garak.gain-v1","defaults":{"gainDb":0}}',
      "duplicate-version.garak",
    );
    await expectProductError(
      () => loadProductProject(duplicateVersion),
      "GARAK_PROJECT_DUPLICATE_KEY",
    );

    const nestedDuplicate = await writeRawProject(
      temporary,
      '{"schemaVersion":2,"productId":"6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e","vendor":"A","name":"Name","version":"0.1.0","category":"Fx","template":{"id":"garak.gain","\\u0069d":"garak.gain","version":1},"defaults":{"gainDb":0}}',
      "nested-duplicate.garak",
    );
    await expectProductError(
      () => loadProductProject(nestedDuplicate),
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

test("classifies schema version before version-specific fields", async () => {
  assert.deepEqual(detectProjectSchemaVersion({ schemaVersion: 1 }), {
    kind: "supported-legacy",
    schemaVersion: 1,
    currentSchemaVersion: 3,
  });
  assert.deepEqual(detectProjectSchemaVersion({ schemaVersion: 2 }), {
    kind: "supported-legacy",
    schemaVersion: 2,
    currentSchemaVersion: 3,
  });
  assert.deepEqual(detectProjectSchemaVersion({ schemaVersion: 3 }), {
    kind: "current",
    schemaVersion: 3,
    currentSchemaVersion: 3,
  });
  assert.deepEqual(detectProjectSchemaVersion({ schemaVersion: 0 }), {
    kind: "too-old",
    schemaVersion: 0,
    minimumSupportedSchemaVersion: 1,
  });
  assert.deepEqual(detectProjectSchemaVersion({ schemaVersion: 4 }), {
    kind: "too-new",
    schemaVersion: 4,
    currentSchemaVersion: 3,
  });
  assert.deepEqual(detectProjectSchemaVersion({}), {
    kind: "invalid",
    reason: "missing",
  });
  assert.deepEqual(detectProjectSchemaVersion([]), {
    kind: "invalid",
    reason: "root-type",
  });
  assert.deepEqual(detectProjectSchemaVersion({ schemaVersion: 1.5 }), {
    kind: "invalid",
    reason: "non-integer",
  });

  for (const [schemaVersion, code] of [
    [0, "GARAK_PROJECT_VERSION_TOO_OLD"],
    [-1, "GARAK_PROJECT_VERSION_TOO_OLD"],
    [4, "GARAK_PROJECT_VERSION_TOO_NEW"],
    [Number.MAX_SAFE_INTEGER, "GARAK_PROJECT_VERSION_TOO_NEW"],
    [1.5, "GARAK_PROJECT_VERSION_INVALID"],
    [Number.MAX_SAFE_INTEGER + 1, "GARAK_PROJECT_VERSION_INVALID"],
    ["3", "GARAK_PROJECT_VERSION_INVALID"],
  ] as const) {
    await expectProductError(
      () =>
        validateProjectValue(
          { schemaVersion, futureField: "must not mask version" },
          "version.garak",
        ),
      code,
    );
  }

  await expectProductError(
    () => validateProjectValue({ futureField: true }, "missing.garak"),
    "GARAK_PROJECT_VERSION_MISSING",
  );
});

test("rejects non-integer schemaVersion tokens before JSON numeric rounding", async () => {
  await withTemporaryDirectory(async (temporary) => {
    for (const [leaf, token] of [
      ["rounded-fraction.garak", "3.0000000000000001"],
      ["fraction.garak", "1.0"],
      ["exponent.garak", "3e0"],
      ["excessive-exponent.garak", "3e999"],
    ] as const) {
      const source = JSON.stringify(mutableWarmProduct()).replace(
        '"schemaVersion":3',
        `"schemaVersion":${token}`,
      );
      const project = await writeRawProject(temporary, source, leaf);
      await expectProductError(
        () => loadProductProject(project),
        "GARAK_PROJECT_VERSION_INVALID",
      );
    }
  });
});

test("uses separate exact v1, v2, and v3 template validators", async () => {
  const legacy = mutableLegacyWarmProduct();
  const legacyV2 = mutableLegacyV2WarmProduct();
  const current = mutableWarmProduct();
  assert.equal(
    validateProjectSchemaV1(legacy, "legacy.garak").schemaVersion,
    1,
  );
  assert.equal(
    validateProjectSchemaV2(legacyV2, "legacy-v2.garak").schemaVersion,
    2,
  );
  assert.equal(
    validateProjectSchemaV3(current, "current.garak").schemaVersion,
    3,
  );

  await expectProductError(
    () => validateProjectSchemaV1(current, "current.garak"),
    "GARAK_PROJECT_SCHEMA_VERSION",
  );
  await expectProductError(
    () => validateProjectSchemaV2(current, "current.garak"),
    "GARAK_PROJECT_SCHEMA_VERSION",
  );

  const legacyUnknown = mutableLegacyWarmProduct();
  legacyUnknown.unknown = true;
  await expectProductError(
    () => validateProjectSchemaV1(legacyUnknown, "legacy-unknown.garak"),
    "GARAK_PROJECT_UNKNOWN_FIELD",
  );
  await expectProductError(
    () => validateProjectSchemaV2(legacy, "legacy.garak"),
    "GARAK_PROJECT_SCHEMA_VERSION",
  );

  for (const [name, template, code] of [
    ["string", "garak.gain-v1", "GARAK_PROJECT_WRONG_TYPE"],
    [
      "wrong id",
      { id: "garak.other", version: 1 },
      "GARAK_PROJECT_INVALID_TEMPLATE",
    ],
    [
      "wrong version",
      { id: "garak.gain", version: 2 },
      "GARAK_PROJECT_INVALID_TEMPLATE",
    ],
    ["missing", { id: "garak.gain" }, "GARAK_PROJECT_MISSING_FIELD"],
    [
      "extra",
      { id: "garak.gain", version: 1, extra: true },
      "GARAK_PROJECT_UNKNOWN_FIELD",
    ],
  ] as const) {
    await expectProductError(
      () =>
        validateProjectValue(
          { ...mutableWarmProduct(), template },
          `template-${name}.garak`,
        ),
      code,
    );
  }
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
      "GARAK_PROJECT_VERSION_INVALID",
    ],
    [
      "future schema version",
      (product) => {
        product.schemaVersion = 4;
      },
      "GARAK_PROJECT_VERSION_TOO_NEW",
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
        product.template = { id: "unknown", version: 1 };
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
