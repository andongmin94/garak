import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { ProductCompilerError } from "../src/errors.ts";
import type { ProductProject } from "../src/project_model.ts";
import {
  REFERENCE_GAIN_GRAPH,
  STATIC_GRAPH_TOTAL_BYTES,
  assertStaticGraphParity,
  compileStaticGraph,
  decodeStaticExecutionPlan,
  encodeProductStaticGraph,
  encodeStaticExecutionPlan,
} from "../src/static_graph.ts";
import type {
  StaticGraphDefinition,
  StaticGraphNode,
} from "../src/static_graph.ts";

const WARM_PROJECT = {
  schemaVersion: 2,
  productId: "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
  vendor: "Garak Test Artist",
  name: "Artist Gain Warm",
  version: "0.1.0",
  versionParts: { major: 0, minor: 1, patch: 0 },
  category: "Fx",
  template: { id: "garak.gain", version: 1 },
  defaults: { gainDb: -6 },
} as const satisfies ProductProject;

const BRIGHT_PROJECT = {
  ...WARM_PROJECT,
  productId: "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357",
  name: "Artist Gain Bright",
  defaults: { gainDb: 3 },
} as const satisfies ProductProject;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function expectGraphError(operation: () => unknown, code: string): void {
  assert.throws(operation, (error: unknown) => {
    if (!(error instanceof ProductCompilerError)) {
      return false;
    }
    assert.equal(error.diagnostic.code, code);
    return true;
  });
}

function mutableReferenceGraph(): {
  nodes: StaticGraphNode[];
  edges: {
    sourceNode: number;
    sourcePort: number;
    targetNode: number;
    targetPort: number;
    portType: "audio";
  }[];
} {
  return {
    nodes: REFERENCE_GAIN_GRAPH.nodes.map((node) => ({
      ...node,
      implementation: { ...node.implementation },
    })),
    edges: REFERENCE_GAIN_GRAPH.edges.map((edge) => ({ ...edge })),
  };
}

test("compiles the exact deterministic Input -> Gain -> Output plan", () => {
  const plan = compileStaticGraph(REFERENCE_GAIN_GRAPH);
  const bytes = encodeStaticExecutionPlan(plan);
  assert.equal(bytes.length, STATIC_GRAPH_TOTAL_BYTES);
  assert.equal(
    sha256(bytes),
    "FDA9FE1BC12E0A28FDF1B147B00AB6A3A9F8C326994659DC70C6682EDEDA143C",
  );
  assert.deepEqual(decodeStaticExecutionPlan(bytes), plan);
});

test("logical node and edge ordering does not change execution-plan bytes", () => {
  const reordered: StaticGraphDefinition = {
    nodes: [...REFERENCE_GAIN_GRAPH.nodes].reverse(),
    edges: [...REFERENCE_GAIN_GRAPH.edges].reverse(),
  };
  const canonical = encodeStaticExecutionPlan(
    compileStaticGraph(REFERENCE_GAIN_GRAPH),
  );
  const actual = encodeStaticExecutionPlan(compileStaticGraph(reordered));
  assert.deepEqual(actual, canonical);
});

test("all current gain products compile to the same template graph plan", () => {
  const warm = encodeProductStaticGraph(WARM_PROJECT);
  const bright = encodeProductStaticGraph(BRIGHT_PROJECT);
  assert.deepEqual(warm, bright);
  assertStaticGraphParity(WARM_PROJECT, warm);
  assertStaticGraphParity(BRIGHT_PROJECT, bright);
});

test("rejects corrupt, truncated, future, and noncanonical plan bytes", () => {
  const valid = encodeProductStaticGraph(WARM_PROJECT);

  const badMagic = Buffer.from(valid);
  badMagic[0] = 0;
  expectGraphError(() => decodeStaticExecutionPlan(badMagic), "GARAK_GRAPH_MAGIC");

  const futureVersion = Buffer.from(valid);
  futureVersion.writeUInt16LE(2, 8);
  expectGraphError(
    () => decodeStaticExecutionPlan(futureVersion),
    "GARAK_GRAPH_VERSION",
  );

  expectGraphError(
    () => decodeStaticExecutionPlan(valid.subarray(0, valid.length - 1)),
    "GARAK_GRAPH_SIZE",
  );

  const badHeader = Buffer.from(valid);
  badHeader.writeUInt16LE(4, 20);
  expectGraphError(
    () => decodeStaticExecutionPlan(badHeader),
    "GARAK_GRAPH_HEADER",
  );

  const nonzeroReserved = Buffer.from(valid);
  const firstEdgeOffset = 32 + 24 * 3;
  nonzeroReserved.writeUInt16LE(1, firstEdgeOffset + 14);
  expectGraphError(
    () => decodeStaticExecutionPlan(nonzeroReserved),
    "GARAK_GRAPH_RESERVED_NONZERO",
  );

  const noncanonicalOperation = Buffer.from(valid);
  const gainOperationOffset = 32 + 24 * 3 + 16 * 2 + 28;
  noncanonicalOperation.writeUInt32LE(9999, gainOperationOffset + 16);
  expectGraphError(
    () => decodeStaticExecutionPlan(noncanonicalOperation),
    "GARAK_GRAPH_NONCANONICAL",
  );
});

test("rejects missing nodes, unsupported versions, invalid ports, and channel mismatch", () => {
  const missing = mutableReferenceGraph();
  missing.nodes.pop();
  expectGraphError(
    () => compileStaticGraph(missing),
    "GARAK_GRAPH_NODE_REFERENCE",
  );

  const unsupportedVersion = mutableReferenceGraph();
  const gainIndex = unsupportedVersion.nodes.findIndex(
    (node) => node.kind === "gain",
  );
  assert.notEqual(gainIndex, -1);
  unsupportedVersion.nodes[gainIndex] = {
    ...unsupportedVersion.nodes[gainIndex]!,
    implementation: { major: 2, minor: 0 },
  };
  expectGraphError(
    () => compileStaticGraph(unsupportedVersion),
    "GARAK_GRAPH_NODE_VERSION",
  );

  const invalidPort = mutableReferenceGraph();
  invalidPort.edges[0] = { ...invalidPort.edges[0]!, sourcePort: 1 };
  expectGraphError(
    () => compileStaticGraph(invalidPort),
    "GARAK_GRAPH_PORT_INDEX",
  );

  const mismatched = mutableReferenceGraph();
  const outputIndex = mismatched.nodes.findIndex(
    (node) => node.kind === "audio-output",
  );
  assert.notEqual(outputIndex, -1);
  mismatched.nodes[outputIndex] = {
    ...mismatched.nodes[outputIndex]!,
    channelPolicy: "stereo",
  };
  expectGraphError(
    () => compileStaticGraph(mismatched),
    "GARAK_GRAPH_CHANNEL_MISMATCH",
  );
});

test("rejects cycles before producing an execution schedule", () => {
  const cyclic: StaticGraphDefinition = {
    nodes: [
      {
        instanceId: 1,
        kind: "audio-input",
        implementation: { major: 1, minor: 0 },
        channelPolicy: "main",
      },
      {
        instanceId: 2,
        kind: "gain",
        implementation: { major: 1, minor: 0 },
        channelPolicy: "main",
      },
      {
        instanceId: 4,
        kind: "gain",
        implementation: { major: 1, minor: 0 },
        channelPolicy: "main",
      },
      {
        instanceId: 3,
        kind: "audio-output",
        implementation: { major: 1, minor: 0 },
        channelPolicy: "main",
      },
    ],
    edges: [
      {
        sourceNode: 1,
        sourcePort: 0,
        targetNode: 2,
        targetPort: 0,
        portType: "audio",
      },
      {
        sourceNode: 2,
        sourcePort: 0,
        targetNode: 4,
        targetPort: 0,
        portType: "audio",
      },
      {
        sourceNode: 4,
        sourcePort: 0,
        targetNode: 2,
        targetPort: 0,
        portType: "audio",
      },
      {
        sourceNode: 4,
        sourcePort: 0,
        targetNode: 3,
        targetPort: 0,
        portType: "audio",
      },
    ],
  };
  expectGraphError(() => compileStaticGraph(cyclic), "GARAK_GRAPH_CYCLE");
});
