import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { diagnosticFor } from "../src/errors.ts";
import {
  canonicalProductGraphSource,
  cloneProductGraphSource,
} from "../src/graph_source.ts";
import {
  PROJECT_MIGRATION_STEP_V1_TO_V2,
  PROJECT_MIGRATION_STEP_V2_TO_V3,
  assertProjectMigrationInvariants,
  migrateProjectV1ToV2,
  migrateProjectV2ToV3,
  migrateValidatedProjectToCurrent,
  serializeCanonicalProductProject,
} from "../src/project_migration_core.ts";
import {
  validateProjectSchemaV1,
  validateProjectSchemaV2,
  validateProjectSchemaV3,
} from "../src/validation.ts";
import {
  mutableLegacyV2WarmProduct,
  mutableLegacyWarmProduct,
  mutableWarmProduct,
} from "./helpers.ts";

const CURRENT_PROJECT_SHA256 = Object.freeze({
  warm: "A3CF6EA3C9F8E8D1BB7EB3C0A57B434F8AC80534D1857E50B6EF6EEA082B5E28",
  bright: "AE3B6B73648B93D32CEF656EB4E0BE76666FCF767160F4CEE78021BBD7F783C0",
});

const WARM_CANONICAL_V3 = `{
  "schemaVersion": 3,
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
  },
  "graph": {
    "schemaVersion": 1,
    "nodes": [
      {
        "id": "input",
        "type": "garak.audio-input",
        "implementationVersion": 1
      },
      {
        "id": "gain",
        "type": "garak.gain",
        "implementationVersion": 1
      },
      {
        "id": "output",
        "type": "garak.audio-output",
        "implementationVersion": 1
      }
    ],
    "connections": [
      {
        "from": {
          "nodeId": "input",
          "port": "audio"
        },
        "to": {
          "nodeId": "gain",
          "port": "audio"
        }
      },
      {
        "from": {
          "nodeId": "gain",
          "port": "audio"
        },
        "to": {
          "nodeId": "output",
          "port": "audio"
        }
      }
    ]
  }
}
`;

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
});

test("pure v2-to-v3 migration adds the canonical graph without mutating source", () => {
  const source = validateProjectSchemaV2(
    mutableLegacyV2WarmProduct(),
    "legacy-v2-warm.garak",
  );
  const before = structuredClone(source);
  const migrated = migrateProjectV2ToV3(source);

  assert.deepEqual(source, before);
  assert.deepEqual(migrated.graph, canonicalProductGraphSource());
  assert.equal(serializeCanonicalProductProject(migrated), WARM_CANONICAL_V3);
  const invariants = assertProjectMigrationInvariants(source, migrated);
  assert.deepEqual(invariants, {
    sourceIdentity: invariants.sourceIdentity,
    targetIdentity: invariants.targetIdentity,
    identityChanged: false,
    productSemanticsChanged: false,
  });
});

test("migration chain reports ordered v1 and v2 steps and a v3 no-op", () => {
  const legacyV1 = validateProjectSchemaV1(
    mutableLegacyWarmProduct(),
    "legacy-v1-warm.garak",
  );
  const legacyV1Result = migrateValidatedProjectToCurrent(legacyV1);
  assert.deepEqual(legacyV1Result.schemaStatus, {
    sourceSchemaVersion: 1,
    currentSchemaVersion: 3,
    migrationRequired: true,
    steps: [PROJECT_MIGRATION_STEP_V1_TO_V2, PROJECT_MIGRATION_STEP_V2_TO_V3],
  });

  const legacyV2 = validateProjectSchemaV2(
    mutableLegacyV2WarmProduct(),
    "legacy-v2-warm.garak",
  );
  const legacyV2Result = migrateValidatedProjectToCurrent(legacyV2);
  assert.deepEqual(legacyV2Result.schemaStatus, {
    sourceSchemaVersion: 2,
    currentSchemaVersion: 3,
    migrationRequired: true,
    steps: [PROJECT_MIGRATION_STEP_V2_TO_V3],
  });

  const current = validateProjectSchemaV3(
    mutableWarmProduct(),
    "current-warm.garak",
  );
  const currentResult = migrateValidatedProjectToCurrent(current);
  assert.deepEqual(currentResult.project, current);
  assert.deepEqual(currentResult.schemaStatus, {
    sourceSchemaVersion: 3,
    currentSchemaVersion: 3,
    migrationRequired: false,
    steps: [],
  });
});

test("migration invariants reject identity, defaults, metadata, and graph drift", () => {
  const source = validateProjectSchemaV2(
    mutableLegacyV2WarmProduct(),
    "legacy-v2-warm.garak",
  );
  const target = migrateProjectV2ToV3(source);
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

test("canonical v3 serialization normalizes order and negative zero", () => {
  const value = mutableWarmProduct();
  value.defaults.gainDb = -0;
  value.graph = customIdGraph();
  const project = validateProjectSchemaV3(value, "negative-zero.garak");
  const serialized = serializeCanonicalProductProject(project);
  assert.match(serialized, /"gainDb": 0/u);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.includes("\r"), false);

  const reparsed = validateProjectSchemaV3(
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

test("Warm and Bright tracked v3 fixtures are exact canonical SHA-256 oracles", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const bright = mutableWarmProduct();
  bright.productId = "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357";
  bright.name = "Artist Gain Bright";
  bright.defaults.gainDb = 3;
  for (const [name, fixture, source] of [
    ["warm", "artist-gain-warm.garak", mutableWarmProduct()],
    ["bright", "artist-gain-bright.garak", bright],
  ] as const) {
    const project = validateProjectSchemaV3(source, `${name}.garak`);
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
    validateProjectSchemaV3(
      {
        ...mutableWarmProduct(),
        graph,
      },
      "clone.garak",
    ).graph,
  );
  assert.notStrictEqual(cloned, graph);
  assert.notStrictEqual(cloned.nodes[0], graph.nodes[0]);
});
