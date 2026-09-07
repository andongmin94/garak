import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileProductGraph } from "../src/compiled_graph.ts";
import { diagnosticFor } from "../src/errors.ts";
import {
  canonicalPolarityProductGraphSource,
  canonicalProductGraphSource,
  canonicalProductGraphSourceV1,
  cloneProductGraphSource,
} from "../src/graph_source.ts";
import {
  PROJECT_MIGRATION_STEP_V1_TO_V2,
  PROJECT_MIGRATION_STEP_V2_TO_V3,
  PROJECT_MIGRATION_STEP_V3_TO_V4,
  assertProjectMigrationInvariants,
  migrateProjectV1ToV2,
  migrateProjectV2ToV3,
  migrateProjectV3ToV4,
  migrateValidatedProjectToCurrent,
  serializeCanonicalProductProject,
} from "../src/project_migration_core.ts";
import {
  validateProjectSchemaV1,
  validateProjectSchemaV2,
  validateProjectSchemaV3,
  validateProjectSchemaV4,
} from "../src/validation.ts";
import {
  mutableLegacyV2WarmProduct,
  mutableLegacyV3WarmProduct,
  mutableLegacyWarmProduct,
  mutableWarmProduct,
} from "./helpers.ts";

const CURRENT_PROJECT_SHA256 = Object.freeze({
  warm: "318C9B3FA0D553C253239E6BF65F4141B6F120CE473F8BF2D6AF2183B8D6D597",
  bright: "4C47566B3AFEFD790CC13D10D8765BA518FD20760DF1C380E6BC8FC5888582E7",
});

function customIdGraph() {
  const graph = canonicalProductGraphSource();
  return {
    ...graph,
    nodes: [
      { ...graph.nodes[2]!, id: "main-output" },
      { ...graph.nodes[1]!, id: "main-gain" },
      { ...graph.nodes[0]!, id: "main-input" },
    ],
    connections: [
      {
        from: { nodeId: "main-gain", port: "audio" as const },
        to: { nodeId: "main-output", port: "audio" as const },
      },
      {
        from: { nodeId: "main-input", port: "audio" as const },
        to: { nodeId: "main-gain", port: "audio" as const },
      },
    ],
  };
}

test("pure v1-to-v2 migration preserves product meaning without mutating source", () => {
  const source = validateProjectSchemaV1(
    mutableLegacyWarmProduct(),
    "legacy-warm.garak",
  );
  const before = structuredClone(source);
  const migrated = migrateProjectV1ToV2(source);
  assert.deepEqual(source, before);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.productId, source.productId);
  assert.deepEqual(migrated.template, { id: "garak.gain", version: 1 });
  assert.deepEqual(migrated.defaults, { gainDb: -6 });
});

test("pure v2-to-v3 and v3-to-v4 migrations preserve the exact Gain-only graph meaning", () => {
  const v2 = validateProjectSchemaV2(
    mutableLegacyV2WarmProduct(),
    "legacy-v2-warm.garak",
  );
  const v2Before = structuredClone(v2);
  const v3 = migrateProjectV2ToV3(v2);
  assert.deepEqual(v2, v2Before);
  assert.deepEqual(v3.graph, canonicalProductGraphSourceV1());

  const v3Before = structuredClone(v3);
  const v4 = migrateProjectV3ToV4(v3);
  assert.deepEqual(v3, v3Before);
  assert.deepEqual(v4.graph, canonicalProductGraphSource());
  assert.equal(
    assertProjectMigrationInvariants(v2, v4).productSemanticsChanged,
    false,
  );
});

test("migration chain reports ordered v1/v2/v3 steps and a v4 no-op", () => {
  const legacyV1 = validateProjectSchemaV1(
    mutableLegacyWarmProduct(),
    "legacy-v1-warm.garak",
  );
  assert.deepEqual(migrateValidatedProjectToCurrent(legacyV1).schemaStatus, {
    sourceSchemaVersion: 1,
    currentSchemaVersion: 4,
    migrationRequired: true,
    steps: [
      PROJECT_MIGRATION_STEP_V1_TO_V2,
      PROJECT_MIGRATION_STEP_V2_TO_V3,
      PROJECT_MIGRATION_STEP_V3_TO_V4,
    ],
  });

  const legacyV2 = validateProjectSchemaV2(
    mutableLegacyV2WarmProduct(),
    "legacy-v2-warm.garak",
  );
  assert.deepEqual(migrateValidatedProjectToCurrent(legacyV2).schemaStatus, {
    sourceSchemaVersion: 2,
    currentSchemaVersion: 4,
    migrationRequired: true,
    steps: [PROJECT_MIGRATION_STEP_V2_TO_V3, PROJECT_MIGRATION_STEP_V3_TO_V4],
  });

  const legacyV3 = validateProjectSchemaV3(
    mutableLegacyV3WarmProduct(),
    "legacy-v3-warm.garak",
  );
  assert.deepEqual(migrateValidatedProjectToCurrent(legacyV3).schemaStatus, {
    sourceSchemaVersion: 3,
    currentSchemaVersion: 4,
    migrationRequired: true,
    steps: [PROJECT_MIGRATION_STEP_V3_TO_V4],
  });

  const current = validateProjectSchemaV4(
    mutableWarmProduct(),
    "current-warm.garak",
  );
  const currentResult = migrateValidatedProjectToCurrent(current);
  assert.deepEqual(currentResult.project, current);
  assert.deepEqual(currentResult.schemaStatus, {
    sourceSchemaVersion: 4,
    currentSchemaVersion: 4,
    migrationRequired: false,
    steps: [],
  });
});

test("migration invariants reject identity, defaults, metadata, and graph drift", () => {
  const source = validateProjectSchemaV3(
    mutableLegacyV3WarmProduct(),
    "legacy-v3-warm.garak",
  );
  const target = migrateProjectV3ToV4(source);
  const disconnectedGraph = {
    ...target.graph,
    connections: [
      {
        from: { nodeId: "input", port: "audio" as const },
        to: { nodeId: "output", port: "audio" as const },
      },
      target.graph.connections[1]!,
    ],
  };
  for (const changed of [
    { ...target, productId: "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357" },
    { ...target, defaults: { gainDb: 0 } },
    { ...target, name: "Changed Product" },
    { ...target, graph: disconnectedGraph },
    { ...target, graph: canonicalPolarityProductGraphSource() },
  ]) {
    assert.throws(
      () => assertProjectMigrationInvariants(source, changed),
      (error: unknown) =>
        diagnosticFor(error).code === "GARAK_MIGRATION_INVARIANT",
    );
  }
  assert.equal(
    assertProjectMigrationInvariants(source, {
      ...target,
      graph: customIdGraph(),
    }).productSemanticsChanged,
    false,
  );
});

test("canonical v4 serialization normalizes order and negative zero", () => {
  const value = mutableWarmProduct();
  value.defaults.gainDb = -0;
  value.graph = customIdGraph();
  const project = validateProjectSchemaV4(value, "negative-zero.garak");
  const serialized = serializeCanonicalProductProject(project);
  assert.match(serialized, /"schemaVersion": 4/u);
  assert.match(serialized, /"schemaVersion": 2/u);
  assert.match(serialized, /"gainDb": 0/u);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.includes("\r"), false);

  const reparsed = validateProjectSchemaV4(
    JSON.parse(serialized) as unknown,
    "reparsed.garak",
  );
  assert.equal(Object.is(reparsed.defaults.gainDb, -0), false);
  assert.deepEqual(
    reparsed.graph.nodes.map((node) => node.type),
    ["garak.audio-input", "garak.gain", "garak.audio-output"],
  );
  assert.deepEqual(
    reparsed.graph.connections.map((connection) => connection.from.nodeId),
    ["main-input", "main-gain"],
  );
});

test("Warm and Bright tracked v4 fixtures are exact canonical SHA-256 oracles", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const bright = mutableWarmProduct();
  bright.productId = "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357";
  bright.name = "Artist Gain Bright";
  bright.defaults.gainDb = 3;
  for (const [name, fixture, source] of [
    ["warm", "artist-gain-warm.garak", mutableWarmProduct()],
    ["bright", "artist-gain-bright.garak", bright],
  ] as const) {
    const project = validateProjectSchemaV4(source, `${name}.garak`);
    const canonical = serializeCanonicalProductProject(project);
    const tracked = await readFile(
      path.join(repositoryRoot, "examples/products", fixture, "product.json"),
    );
    assert.equal(tracked.toString("utf8"), canonical);
    const sha = createHash("sha256")
      .update(tracked)
      .digest("hex")
      .toUpperCase();
    assert.equal(sha, CURRENT_PROJECT_SHA256[name]);
  }
});

test("graph cloning preserves authoring identity without sharing nested objects", () => {
  const graph = customIdGraph();
  const cloned = cloneProductGraphSource(graph);
  assert.deepEqual(
    cloned,
    validateProjectSchemaV4({ ...mutableWarmProduct(), graph }, "clone.garak")
      .graph,
  );
  assert.notStrictEqual(cloned, graph);
  assert.notStrictEqual(cloned.nodes[0], graph.nodes[0]);
});

test("Polarity source is valid v2 authoring data but GARAKGRF 1.0 rejects it fail-closed", () => {
  assert.throws(
    () => compileProductGraph(canonicalPolarityProductGraphSource()),
    (error: unknown) =>
      diagnosticFor(error).code === "GARAK_COMPILED_GRAPH_SOURCE_UNSUPPORTED",
  );
});
