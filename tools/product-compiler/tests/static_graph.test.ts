import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { ProductCompilerError } from "../src/errors.ts";
import type { ProductProject } from "../src/project_model.ts";
import {
  REFERENCE_GAIN_PLAN,
  STATIC_GRAPH_HEADER_BYTES,
  STATIC_GRAPH_OPERATION_BYTES,
  STATIC_GRAPH_TOTAL_BYTES,
  assertStaticGraphParity,
  decodeStaticExecutionPlan,
  encodeProductStaticGraph,
  encodeStaticExecutionPlan,
} from "../src/static_graph.ts";

const WARM_PROJECT: ProductProject = {
  schemaVersion: 2,
  productId: "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
  vendor: "Garak Test Artist",
  name: "Artist Gain Warm",
  version: "0.1.0",
  versionParts: { major: 0, minor: 1, patch: 0 },
  category: "Fx",
  template: { id: "garak.gain", version: 1 },
  defaults: { gainDb: -6 },
};

const BRIGHT_PROJECT: ProductProject = {
  ...WARM_PROJECT,
  productId: "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357",
  name: "Artist Gain Bright",
  defaults: { gainDb: 3 },
};

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

test("encodes the deterministic Input -> Gain -> Output plan", () => {
  const bytes = encodeStaticExecutionPlan(REFERENCE_GAIN_PLAN);
  assert.equal(bytes.length, STATIC_GRAPH_TOTAL_BYTES);
  assert.equal(
    sha256(bytes),
    "AE6C509EF4E6243549522A92E71ADB1DB06B38BB418E5425D296ECD6FF53940D",
  );
  assert.deepEqual(decodeStaticExecutionPlan(bytes), REFERENCE_GAIN_PLAN);
});

test("current gain products use one canonical graph plan", () => {
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
  expectGraphError(
    () => decodeStaticExecutionPlan(badMagic),
    "GARAK_GRAPH_MAGIC",
  );

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
  nonzeroReserved.writeUInt16LE(1, 26);
  expectGraphError(
    () => decodeStaticExecutionPlan(nonzeroReserved),
    "GARAK_GRAPH_RESERVED_NONZERO",
  );

  const noncanonicalOperation = Buffer.from(valid);
  const gainOperationOffset =
    STATIC_GRAPH_HEADER_BYTES + STATIC_GRAPH_OPERATION_BYTES;
  noncanonicalOperation.writeUInt32LE(9999, gainOperationOffset + 16);
  expectGraphError(
    () => decodeStaticExecutionPlan(noncanonicalOperation),
    "GARAK_GRAPH_NONCANONICAL",
  );
});

test("rejects unsupported product templates", () => {
  const unsupported: ProductProject = {
    ...WARM_PROJECT,
    template: { id: "garak.other", version: 1 },
  } as unknown as ProductProject;
  expectGraphError(
    () => encodeProductStaticGraph(unsupported),
    "GARAK_GRAPH_TEMPLATE",
  );
});
