import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalGainGraphPlan,
  compileProductGraph,
  encodeCompiledGraph,
} from "../src/compiled_graph.ts";
import { diagnosticFor } from "../src/errors.ts";
import {
  canonicalProductGraphSource,
  validateProductGraphSource,
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

test("canonical graph source v1 validates and compiles to the normative Gain plan", () => {
  const source = canonicalProductGraphSource();
  assert.deepEqual(validateProductGraphSource(source), source);
  assert.deepEqual(compileProductGraph(source), canonicalGainGraphPlan());
});

test("node IDs and source array order do not affect compiled graph bytes", () => {
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
    ["host-input", "artist-gain", "speaker-output"],
  );
  assert.deepEqual(
    validated.connections.map((connection) => connection.from.nodeId),
    ["host-input", "artist-gain"],
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
    { ...mutableGraph(), schemaVersion: 2 },
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
