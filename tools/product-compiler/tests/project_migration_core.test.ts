import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  PROJECT_MIGRATION_STEP_V1_TO_V2,
  assertProjectMigrationInvariants,
  migrateProjectV1ToV2,
  migrateValidatedProjectToCurrent,
  serializeCanonicalProductProject,
} from "../src/project_migration_core.ts";
import { diagnosticFor } from "../src/errors.ts";
import {
  validateProjectSchemaV1,
  validateProjectSchemaV2,
} from "../src/validation.ts";
import { mutableLegacyWarmProduct, mutableWarmProduct } from "./helpers.ts";

const WARM_CANONICAL_V2 = `{
  "schemaVersion": 2,
  "productId": "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
  "vendor": "Garak Test Artist",
  "name": "Artist Gain Warm",
  "version": "0.1.0",
  "category": "Fx",
  "template": {
    "id": "garak.gain",
    "version": 1
  },
  "defaults": {
    "gainDb": -6
  }
}
`;
const BRIGHT_CANONICAL_V2 = `{
  "schemaVersion": 2,
  "productId": "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357",
  "vendor": "Garak Test Artist",
  "name": "Artist Gain Bright",
  "version": "0.1.0",
  "category": "Fx",
  "template": {
    "id": "garak.gain",
    "version": 1
  },
  "defaults": {
    "gainDb": 3
  }
}
`;

test("pure v1-to-v2 migration preserves product meaning without mutating source", () => {
  const source = validateProjectSchemaV1(
    mutableLegacyWarmProduct(),
    "legacy-warm.garak",
  );
  const before = structuredClone(source);
  const migrated = migrateProjectV1ToV2(source);

  assert.deepEqual(source, before);
  assert.deepEqual(migrated, {
    schemaVersion: 2,
    productId: source.productId,
    vendor: source.vendor,
    name: source.name,
    version: source.version,
    versionParts: source.versionParts,
    category: "Fx",
    template: { id: "garak.gain", version: 1 },
    defaults: { gainDb: -6 },
  });
  assert.equal(serializeCanonicalProductProject(migrated), WARM_CANONICAL_V2);
});

test("migration chain reports the exact supported step and current no-op", () => {
  const legacy = validateProjectSchemaV1(
    mutableLegacyWarmProduct(),
    "legacy-warm.garak",
  );
  const legacyResult = migrateValidatedProjectToCurrent(legacy);
  assert.deepEqual(legacyResult.schemaStatus, {
    sourceSchemaVersion: 1,
    currentSchemaVersion: 2,
    migrationRequired: true,
    steps: [PROJECT_MIGRATION_STEP_V1_TO_V2],
  });

  const current = validateProjectSchemaV2(
    mutableWarmProduct(),
    "current-warm.garak",
  );
  const currentResult = migrateValidatedProjectToCurrent(current);
  assert.strictEqual(currentResult.project, current);
  assert.deepEqual(currentResult.schemaStatus, {
    sourceSchemaVersion: 2,
    currentSchemaVersion: 2,
    migrationRequired: false,
    steps: [],
  });
});

test("migration invariants fail before a changed canonical model can be consumed", () => {
  const source = validateProjectSchemaV1(
    mutableLegacyWarmProduct(),
    "legacy-warm.garak",
  );
  const target = migrateProjectV1ToV2(source);
  for (const changed of [
    { ...target, productId: "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357" },
    { ...target, defaults: { gainDb: 0 } },
    { ...target, name: "Changed Product" },
  ]) {
    assert.throws(
      () => assertProjectMigrationInvariants(source, changed),
      (error: unknown) =>
        diagnosticFor(error).code === "GARAK_MIGRATION_INVARIANT",
    );
  }
});

test("Bright legacy migration produces the independent exact canonical v2 literal", () => {
  const legacy = mutableLegacyWarmProduct();
  legacy.productId = "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357";
  legacy.name = "Artist Gain Bright";
  legacy.defaults.gainDb = 3;
  const source = validateProjectSchemaV1(legacy, "bright-v1.garak");
  const migrated = migrateProjectV1ToV2(source);
  assert.equal(serializeCanonicalProductProject(migrated), BRIGHT_CANONICAL_V2);
  const current = migrateValidatedProjectToCurrent(migrated);
  assert.deepEqual(current.schemaStatus.steps, []);
  assert.equal(
    serializeCanonicalProductProject(current.project),
    BRIGHT_CANONICAL_V2,
  );
});

test("canonical v2 serialization is deterministic and normalizes negative zero", () => {
  const value = mutableWarmProduct();
  value.defaults.gainDb = -0;
  const project = validateProjectSchemaV2(value, "negative-zero.garak");
  const serialized = serializeCanonicalProductProject(project);
  assert.match(serialized, /"gainDb": 0/u);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.includes("\r"), false);

  const reparsed = validateProjectSchemaV2(
    JSON.parse(serialized) as unknown,
    "reparsed.garak",
  );
  assert.equal(Object.is(reparsed.defaults.gainDb, -0), false);
});

test("Warm and Bright tracked v2 fixtures are exact canonical SHA-256 oracles", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const bright = mutableWarmProduct();
  bright.productId = "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357";
  bright.name = "Artist Gain Bright";
  bright.defaults.gainDb = 3;
  for (const [name, fixture, source, expected] of [
    [
      "warm",
      "artist-gain-warm.garak",
      mutableWarmProduct(),
      "3F27ED552AEC8CAE3C7D34C5AE1F4821582E1DAC3E323B353A845C8891734C33",
    ],
    [
      "bright",
      "artist-gain-bright.garak",
      bright,
      "B50A360FD6862BFD0364D4BE95365D4B48E0AF34EE81084626EBE5F791C5932B",
    ],
  ] as const) {
    const project = validateProjectSchemaV2(source, `${name}.garak`);
    const canonical = serializeCanonicalProductProject(project);
    const tracked = await readFile(
      path.join(repositoryRoot, "examples/products", fixture, "product.json"),
    );
    assert.equal(tracked.toString("utf8"), canonical);
    const sha = createHash("sha256")
      .update(tracked)
      .digest("hex")
      .toUpperCase();
    assert.equal(sha, expected);
  }
});
