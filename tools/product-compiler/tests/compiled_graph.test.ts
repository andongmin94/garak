import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPILED_GRAPH_TOTAL_BYTES,
  canonicalGainGraphPlan,
  decodeCompiledGraph,
  encodeCompiledGraph,
} from "../src/compiled_graph.ts";
import { expectProductError } from "./helpers.ts";

const CANONICAL_GRAPH_HEX =
  "474152414b47524601000000200000005c0000000300020000000000000000000100000001000000ffff00000000000000000000020000000200000000000100e9030000ea03000003000000030000000100ffff0000000000000000";

test("encodes the exact canonical Gain graph fixture", () => {
  const plan = canonicalGainGraphPlan();
  const encoded = encodeCompiledGraph(plan);
  assert.equal(encoded.length, COMPILED_GRAPH_TOTAL_BYTES);
  assert.equal(encoded.toString("hex"), CANONICAL_GRAPH_HEX);
  assert.deepEqual(decodeCompiledGraph(encoded), plan);
});

test("rejects a noncanonical plan before encoding", async () => {
  const plan = canonicalGainGraphPlan();
  const operations = plan.operations.map((operation) => ({ ...operation }));
  const gain = operations[1];
  assert.ok(gain !== undefined);
  gain.primaryParameterId = 9999;
  await expectProductError(
    () => encodeCompiledGraph({ ...plan, operations }),
    "GARAK_COMPILED_GRAPH_NONCANONICAL",
  );
});

test("rejects truncated, trailing, future, reserved and noncanonical bytes", async () => {
  const canonical = Buffer.from(CANONICAL_GRAPH_HEX, "hex");
  await expectProductError(
    () => decodeCompiledGraph(canonical.subarray(0, canonical.length - 1)),
    "GARAK_COMPILED_GRAPH_SIZE",
  );
  await expectProductError(
    () => decodeCompiledGraph(Buffer.concat([canonical, Buffer.from([0])])),
    "GARAK_COMPILED_GRAPH_SIZE",
  );

  const future = Buffer.from(canonical);
  future.writeUInt16LE(2, 8);
  await expectProductError(
    () => decodeCompiledGraph(future),
    "GARAK_COMPILED_GRAPH_VERSION",
  );

  const reserved = Buffer.from(canonical);
  reserved.writeUInt32LE(1, 28);
  await expectProductError(
    () => decodeCompiledGraph(reserved),
    "GARAK_COMPILED_GRAPH_RESERVED",
  );

  const noncanonical = Buffer.from(canonical);
  noncanonical.writeUInt32LE(9999, 64);
  await expectProductError(
    () => decodeCompiledGraph(noncanonical),
    "GARAK_COMPILED_GRAPH_NONCANONICAL",
  );
});
