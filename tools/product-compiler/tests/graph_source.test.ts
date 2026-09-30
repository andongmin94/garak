import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalGainGraphPlan,
  canonicalPolarityGraphPlan,
  canonicalSaturationGraphPlan,
  compileProductGraph,
  encodeCompiledGraph,
} from "../src/compiled_graph.ts";
import { diagnosticFor } from "../src/errors.ts";
import {
  canonicalPolarityProductGraphSource,
  canonicalProductGraphSource,
  canonicalProductGraphSourceV1,
  canonicalSaturationProductGraphSource,
  migrateProductGraphV1ToV2,
  validateProductGraphSource,
  validateProductGraphSourceV1,
  validateProductGraphSourceV2,
} from "../src/graph_source.ts";

function expectGraphError(value: unknown, code: string): void {
  assert.throws(
    () => validateProductGraphSource(value),
    (error: unknown) => diagnosticFor(error).code === code,
  );
}

interface MutableGraph {
  schemaVersion: number;
  nodes: Array<{
    id: string;
    type: string;
    implementationVersion: number;
  }>;
  connections: Array<{
    from: { nodeId: string; port: string };
    to: { nodeId: string; port: string };
  }>;
}

function mutableGraph(): MutableGraph {
  return structuredClone(canonicalProductGraphSource()) as MutableGraph;
}

test("graph source v1 remains the exact historical Gain-only contract", () => {
  const source = canonicalProductGraphSourceV1();
  assert.deepEqual(validateProductGraphSourceV1(source), source);
  assert.throws(
    () => validateProductGraphSource(source),
    (error: unknown) =>
      diagnosticFor(error).code === "GARAK_PROJECT_GRAPH_SCHEMA_VERSION",
  );
});

test("canonical graph source v3 validates and compiles to the normative Gain plan", () => {
  const source = canonicalProductGraphSource();
  assert.deepEqual(validateProductGraphSource(source), source);
  assert.deepEqual(compileProductGraph(source), canonicalGainGraphPlan());
});

test("graph source v3 accepts and compiles the exact Gain to Polarity linear topology", () => {
  const source = canonicalPolarityProductGraphSource();
  assert.deepEqual(validateProductGraphSource(source), source);
  assert.deepEqual(compileProductGraph(source), canonicalPolarityGraphPlan());
});

test("node IDs and source array order do not affect Gain-only compiled graph bytes", () => {
  const source = mutableGraph();
  source.nodes = [
    { ...source.nodes[2]!, id: "speaker-output" },
    { ...source.nodes[1]!, id: "artist-gain" },
    { ...source.nodes[0]!, id: "host-input" },
  ];
  source.connections = [
    {
      from: { nodeId: "artist-gain", port: "audio" },
      to: { nodeId: "speaker-output", port: "audio" },
    },
    {
      from: { nodeId: "host-input", port: "audio" },
      to: { nodeId: "artist-gain", port: "audio" },
    },
  ];

  const validated = validateProductGraphSource(source);
  assert.deepEqual(
    validated.nodes.map((node) => node.id),
    ["speaker-output", "artist-gain", "host-input"],
  );
  assert.deepEqual(
    validated.connections.map((connection) => connection.from.nodeId),
    ["artist-gain", "host-input"],
  );
  assert.deepEqual(
    encodeCompiledGraph(compileProductGraph(validated)),
    encodeCompiledGraph(canonicalGainGraphPlan()),
  );
});

test("graph source rejects unknown and missing fields at every structural layer", () => {
  expectGraphError(
    { ...mutableGraph(), unknown: true },
    "GARAK_PROJECT_GRAPH_UNKNOWN_FIELD",
  );

  const missingNodeField = mutableGraph();
  delete (missingNodeField.nodes[0] as { type?: unknown }).type;
  expectGraphError(missingNodeField, "GARAK_PROJECT_GRAPH_MISSING_FIELD");

  const unknownEndpointField = mutableGraph();
  Object.assign(unknownEndpointField.connections[0]!.from, { channel: 0 });
  expectGraphError(unknownEndpointField, "GARAK_PROJECT_GRAPH_UNKNOWN_FIELD");
});

test("graph source rejects duplicate nodes, node types, and connections", () => {
  const duplicateNodeId = mutableGraph();
  duplicateNodeId.nodes[1]!.id = duplicateNodeId.nodes[0]!.id;
  expectGraphError(duplicateNodeId, "GARAK_PROJECT_GRAPH_DUPLICATE_NODE_ID");

  const duplicateNodeType = mutableGraph();
  duplicateNodeType.nodes[1]!.type = duplicateNodeType.nodes[0]!.type;
  expectGraphError(
    duplicateNodeType,
    "GARAK_PROJECT_GRAPH_DUPLICATE_NODE_TYPE",
  );

  const duplicateConnection = mutableGraph();
  duplicateConnection.connections[1] = structuredClone(
    duplicateConnection.connections[0]!,
  );
  expectGraphError(
    duplicateConnection,
    "GARAK_PROJECT_GRAPH_DUPLICATE_CONNECTION",
  );
});

test("graph source rejects unsupported versions, node IDs, types, and ports", () => {
  expectGraphError(
    { ...mutableGraph(), schemaVersion: 4 },
    "GARAK_PROJECT_GRAPH_SCHEMA_VERSION",
  );

  const badImplementation = mutableGraph();
  badImplementation.nodes[1]!.implementationVersion = 2;
  expectGraphError(
    badImplementation,
    "GARAK_PROJECT_GRAPH_IMPLEMENTATION_VERSION",
  );

  const badId = mutableGraph();
  badId.nodes[1]!.id = "Gain Node";
  expectGraphError(badId, "GARAK_PROJECT_GRAPH_NODE_ID");

  const badType = mutableGraph();
  badType.nodes[1]!.type = "garak.delay";
  expectGraphError(badType, "GARAK_PROJECT_GRAPH_NODE_TYPE");

  const badPort = mutableGraph();
  badPort.connections[0]!.to.port = "sidechain";
  expectGraphError(badPort, "GARAK_PROJECT_GRAPH_PORT");
});

test("graph source rejects missing endpoints, cycles, and disconnected output", () => {
  const missingEndpoint = mutableGraph();
  missingEndpoint.connections[0]!.to.nodeId = "missing";
  expectGraphError(missingEndpoint, "GARAK_PROJECT_GRAPH_MISSING_ENDPOINT");

  const cycle = mutableGraph();
  cycle.connections = [
    {
      from: { nodeId: "gain", port: "audio" },
      to: { nodeId: "gain", port: "audio" },
    },
    {
      from: { nodeId: "input", port: "audio" },
      to: { nodeId: "output", port: "audio" },
    },
  ];
  expectGraphError(cycle, "GARAK_PROJECT_GRAPH_CYCLE");

  const disconnected = mutableGraph();
  disconnected.connections = [
    {
      from: { nodeId: "input", port: "audio" },
      to: { nodeId: "output", port: "audio" },
    },
    {
      from: { nodeId: "gain", port: "audio" },
      to: { nodeId: "output", port: "audio" },
    },
  ];
  expectGraphError(disconnected, "GARAK_PROJECT_GRAPH_DISCONNECTED");
});

test("historical graph v2 preserves Gain and Polarity but cannot acquire Saturation semantics", () => {
  const gain = migrateProductGraphV1ToV2(canonicalProductGraphSourceV1());
  const polarity = {
    ...canonicalPolarityProductGraphSource(),
    schemaVersion: 2,
  };
  assert.deepEqual(validateProductGraphSourceV2(gain), gain);
  assert.deepEqual(validateProductGraphSourceV2(polarity), polarity);
  for (const [validator, source, code] of [
    [
      validateProductGraphSourceV1,
      { ...polarity, schemaVersion: 1 },
      "GARAK_PROJECT_GRAPH_NODE_COUNT",
    ],
    [
      validateProductGraphSourceV2,
      { ...canonicalSaturationProductGraphSource(), schemaVersion: 2 },
      "GARAK_PROJECT_GRAPH_NODE_TYPE",
    ],
  ] as const) {
    assert.throws(
      () => validator(source),
      (error: unknown) => diagnosticFor(error).code === code,
    );
  }
  assert.throws(
    () => validateProductGraphSource(gain),
    (error: unknown) =>
      diagnosticFor(error).code === "GARAK_PROJECT_GRAPH_SCHEMA_VERSION",
  );
});

test("graph v3 Saturation compiles deterministically while preserving authoring IDs and order", () => {
  const canonical = canonicalSaturationProductGraphSource();
  assert.deepEqual(
    compileProductGraph(canonical),
    canonicalSaturationGraphPlan(),
  );
  const renamed = new Map(
    canonical.nodes.map(({ id }, index) => [id, `artist-${index}`]),
  );
  const authored = {
    schemaVersion: 3,
    nodes: canonical.nodes
      .map((node) => ({ ...node, id: renamed.get(node.id)! }))
      .reverse(),
    connections: canonical.connections
      .map(({ from, to }) => ({
        from: { ...from, nodeId: renamed.get(from.nodeId)! },
        to: { ...to, nodeId: renamed.get(to.nodeId)! },
      }))
      .reverse(),
  };
  const validated = validateProductGraphSource(authored);
  assert.deepEqual(validated, authored);
  assert.notStrictEqual(validated.nodes, authored.nodes);
  assert.notStrictEqual(
    validated.connections[0]?.from,
    authored.connections[0]?.from,
  );
  assert.deepEqual(
    encodeCompiledGraph(compileProductGraph(validated)),
    encodeCompiledGraph(canonicalSaturationGraphPlan()),
  );
});

test("Saturation rejects properties, implementation changes, pre-Gain placement, repetition and combined transforms", () => {
  const saturation = canonicalSaturationProductGraphSource();
  const properties = structuredClone(saturation);
  Object.assign(properties.nodes[2]!, { drive: 2 });
  expectGraphError(properties, "GARAK_PROJECT_GRAPH_UNKNOWN_FIELD");
  const futureImplementation = structuredClone(saturation);
  Object.assign(futureImplementation.nodes[2]!, { implementationVersion: 2 });
  expectGraphError(
    futureImplementation,
    "GARAK_PROJECT_GRAPH_IMPLEMENTATION_VERSION",
  );
  const preGain = {
    ...saturation,
    connections: [
      {
        from: { nodeId: "input", port: "audio" },
        to: { nodeId: "saturation", port: "audio" },
      },
      {
        from: { nodeId: "saturation", port: "audio" },
        to: { nodeId: "gain", port: "audio" },
      },
      {
        from: { nodeId: "gain", port: "audio" },
        to: { nodeId: "output", port: "audio" },
      },
    ],
  };
  expectGraphError(preGain, "GARAK_PROJECT_GRAPH_DISCONNECTED");
  const repeated = structuredClone(saturation);
  Object.assign(repeated.nodes[1]!, { type: "garak.saturation" });
  expectGraphError(repeated, "GARAK_PROJECT_GRAPH_DUPLICATE_NODE_TYPE");
  const combined = {
    ...saturation,
    nodes: [
      ...saturation.nodes,
      { id: "polarity", type: "garak.polarity", implementationVersion: 1 },
    ],
    connections: [
      saturation.connections[0],
      saturation.connections[1],
      {
        from: { nodeId: "saturation", port: "audio" },
        to: { nodeId: "polarity", port: "audio" },
      },
      {
        from: { nodeId: "polarity", port: "audio" },
        to: { nodeId: "output", port: "audio" },
      },
    ],
  };
  expectGraphError(combined, "GARAK_PROJECT_GRAPH_NODE_COUNT");
});
