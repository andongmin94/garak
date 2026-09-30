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
  canonicalSaturationProductGraphSource,
  migrateProductGraphV1ToV2,
  cloneProductGraphSource,
} from "../src/graph_source.ts";
import {
  PROJECT_MIGRATION_STEP_V1_TO_V2,
  PROJECT_MIGRATION_STEP_V2_TO_V3,
  PROJECT_MIGRATION_STEP_V3_TO_V4,
  PROJECT_MIGRATION_STEP_V4_TO_V5,
  assertProjectMigrationInvariants,
  migrateProjectV1ToV2,
  migrateProjectV2ToV3,
  migrateProjectV3ToV4,
  migrateProjectV4ToV5,
  serializeCanonicalProductProject,
} from "../src/project_migration_core.ts";
import {
  migrateValidatedProjectToCurrent,
  validateProjectSchemaV1,
  validateProjectSchemaV2,
  validateProjectSchemaV3,
  validateProjectSchemaV4,
  validateProjectSchemaV5,
} from "../src/validation.ts";
import {
  mutableLegacyV2WarmProduct,
  mutableLegacyV3WarmProduct,
  mutableLegacyV4WarmProduct,
  mutableLegacyWarmProduct,
  mutableWarmProduct,
} from "./helpers.ts";

const CURRENT_PROJECT_SHA256 = Object.freeze({
  warm: "C8ABCE7931D177CE1283700CF87F1101DC8E40B9D5BD7757A05D2A873EF1C008",
  bright: "0534929F36E106ADE365AF3B3AF60F6F8620665DF48CB8D0F8A21DEAF6F86E5C",
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
  assert.deepEqual(
    v4.graph,
    migrateProductGraphV1ToV2(canonicalProductGraphSourceV1()),
  );
  const v5 = migrateProjectV4ToV5(v4);
  assert.deepEqual(v5.graph, canonicalProductGraphSource());
  assert.equal(
    assertProjectMigrationInvariants(v2, v5).productSemanticsChanged,
    false,
  );
});

test("migration chain reports ordered v1/v2/v3/v4 steps and a v5 no-op", () => {
  const legacyV1 = validateProjectSchemaV1(
    mutableLegacyWarmProduct(),
    "legacy-v1-warm.garak",
  );
  assert.deepEqual(migrateValidatedProjectToCurrent(legacyV1).schemaStatus, {
    sourceSchemaVersion: 1,
    currentSchemaVersion: 5,
    migrationRequired: true,
    steps: [
      PROJECT_MIGRATION_STEP_V1_TO_V2,
      PROJECT_MIGRATION_STEP_V2_TO_V3,
      PROJECT_MIGRATION_STEP_V3_TO_V4,
      PROJECT_MIGRATION_STEP_V4_TO_V5,
    ],
  });

  const legacyV2 = validateProjectSchemaV2(
    mutableLegacyV2WarmProduct(),
    "legacy-v2-warm.garak",
  );
  assert.deepEqual(migrateValidatedProjectToCurrent(legacyV2).schemaStatus, {
    sourceSchemaVersion: 2,
    currentSchemaVersion: 5,
    migrationRequired: true,
    steps: [
      PROJECT_MIGRATION_STEP_V2_TO_V3,
      PROJECT_MIGRATION_STEP_V3_TO_V4,
      PROJECT_MIGRATION_STEP_V4_TO_V5,
    ],
  });

  const legacyV3 = validateProjectSchemaV3(
    mutableLegacyV3WarmProduct(),
    "legacy-v3-warm.garak",
  );
  assert.deepEqual(migrateValidatedProjectToCurrent(legacyV3).schemaStatus, {
    sourceSchemaVersion: 3,
    currentSchemaVersion: 5,
    migrationRequired: true,
    steps: [PROJECT_MIGRATION_STEP_V3_TO_V4, PROJECT_MIGRATION_STEP_V4_TO_V5],
  });

  const legacyV4 = validateProjectSchemaV4(
    mutableLegacyV4WarmProduct(),
    "legacy-v4.garak",
  );
  assert.deepEqual(migrateValidatedProjectToCurrent(legacyV4).schemaStatus, {
    sourceSchemaVersion: 4,
    currentSchemaVersion: 5,
    migrationRequired: true,
    steps: [PROJECT_MIGRATION_STEP_V4_TO_V5],
  });

  const current = validateProjectSchemaV5(
    mutableWarmProduct(),
    "current-warm.garak",
  );
  const currentResult = migrateValidatedProjectToCurrent(current);
  assert.deepEqual(currentResult.project, current);
  assert.deepEqual(currentResult.schemaStatus, {
    sourceSchemaVersion: 5,
    currentSchemaVersion: 5,
    migrationRequired: false,
    steps: [],
  });
});

test("migration invariants reject identity, defaults, metadata, and graph drift", () => {
  const source = validateProjectSchemaV3(
    mutableLegacyV3WarmProduct(),
    "legacy-v3-warm.garak",
  );
  const target = migrateProjectV4ToV5(migrateProjectV3ToV4(source));
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
    { ...target, graph: canonicalSaturationProductGraphSource() },
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

test("canonical v5 serialization preserves authoring order and normalizes negative zero", () => {
  const value = mutableWarmProduct();
  value.defaults.gainDb = -0;
  value.graph = customIdGraph();
  const project = validateProjectSchemaV5(value, "negative-zero.garak");
  const serialized = serializeCanonicalProductProject(project);
  assert.match(serialized, /"schemaVersion": 5/u);
  assert.match(serialized, /"schemaVersion": 3/u);
  assert.match(serialized, /"gainDb": 0/u);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.includes("\r"), false);

  const reparsed = validateProjectSchemaV5(
    JSON.parse(serialized) as unknown,
    "reparsed.garak",
  );
  assert.equal(Object.is(reparsed.defaults.gainDb, -0), false);
  assert.deepEqual(
    reparsed.graph.nodes.map((node) => node.type),
    ["garak.audio-output", "garak.gain", "garak.audio-input"],
  );
  assert.deepEqual(
    reparsed.graph.connections.map((connection) => connection.from.nodeId),
    ["main-gain", "main-input"],
  );
});

test("Warm and Bright tracked v5 fixtures are exact canonical SHA-256 oracles", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const bright = mutableWarmProduct();
  bright.productId = "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357";
  bright.name = "Artist Gain Bright";
  bright.defaults.gainDb = 3;
  for (const [name, fixture, source] of [
    ["warm", "artist-gain-warm.garak", mutableWarmProduct()],
    ["bright", "artist-gain-bright.garak", bright],
  ] as const) {
    const project = validateProjectSchemaV5(source, `${name}.garak`);
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
    validateProjectSchemaV5({ ...mutableWarmProduct(), graph }, "clone.garak")
      .graph,
  );
  assert.notStrictEqual(cloned, graph);
  assert.notStrictEqual(cloned.nodes[0], graph.nodes[0]);
});

test("Polarity source compiles to the current four-operation GARAKGRF plan", () => {
  const plan = compileProductGraph(canonicalPolarityProductGraphSource());
  assert.equal(plan.operations.length, 4);
  assert.equal(plan.bufferCount, 3);
  assert.equal(plan.latencySamples, 0);
  assert.equal(plan.operations[2]?.type, 4);
});

test("v4-to-v5 changes only version boundaries for custom Gain and Polarity graphs", () => {
  for (const graph of [
    canonicalProductGraphSource(),
    canonicalPolarityProductGraphSource(),
  ]) {
    const renamed = new Map(
      graph.nodes.map(({ id }, index) => [id, `kept-${index}`]),
    );
    const rawGraph = {
      schemaVersion: 2,
      nodes: graph.nodes
        .map((node) => ({ ...node, id: renamed.get(node.id)! }))
        .reverse(),
      connections: graph.connections
        .map(({ from, to }) => ({
          from: { ...from, nodeId: renamed.get(from.nodeId)! },
          to: { ...to, nodeId: renamed.get(to.nodeId)! },
        }))
        .reverse(),
    };
    const legacy = validateProjectSchemaV4(
      { ...mutableLegacyV4WarmProduct(), graph: rawGraph },
      "legacy-v4-custom.garak",
    );
    assert.deepEqual(legacy.graph, rawGraph);
    const before = structuredClone(legacy);
    const migrated = migrateProjectV4ToV5(legacy);
    assert.deepEqual(legacy, before);
    assert.deepEqual(migrated, {
      ...legacy,
      schemaVersion: 5,
      graph: { ...rawGraph, schemaVersion: 3 },
    });
    assert.notStrictEqual(migrated.graph.nodes[0], legacy.graph.nodes[0]);
    assert.notStrictEqual(
      migrated.graph.connections[0]?.from,
      legacy.graph.connections[0]?.from,
    );
    const invariants = assertProjectMigrationInvariants(legacy, migrated);
    assert.equal(invariants.identityChanged, false);
    assert.equal(invariants.productSemanticsChanged, false);
    assert.deepEqual(invariants.targetIdentity, invariants.sourceIdentity);
    assert.deepEqual(JSON.parse(serializeCanonicalProductProject(migrated)), {
      ...mutableLegacyV4WarmProduct(),
      schemaVersion: 5,
      graph: { ...rawGraph, schemaVersion: 3 },
    });
    assert.deepEqual(
      compileProductGraph(migrated.graph),
      compileProductGraph(graph),
    );
  }
});
