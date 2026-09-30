import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalGainGraphPlan,
  canonicalPolarityGraphPlan,
  canonicalSaturationGraphPlan,
  decodeCompiledGraph,
  encodeCompiledGraph,
} from "../src/compiled_graph.ts";
import { expectProductError } from "./helpers.ts";

const GAIN_GRAPH_HEX =
  "474152414b47524601000200200000005c0000000300020000000000000000000100000001000000ffff00000000000000000000020000000200000000000100e9030000ea03000003000000030000000100ffff0000000000000000";
const POLARITY_GRAPH_HEX =
  "474152414b4752460100020020000000700000000400030000000000000000000100000001000000ffff00000000000000000000020000000200000000000100e9030000ea030000030000000400000001000200000000000000000004000000030000000200ffff0000000000000000";

const SATURATION_GRAPH_HEX =
  "474152414b4752460100020020000000700000000400030000000000000000000100000001000000ffff00000000000000000000020000000200000000000100e9030000ea030000030000000500000001000200000000000000000004000000030000000200ffff0000000000000000";

test("encodes exact GARAKGRF 1.2 Gain, Polarity, and Saturation fixtures", () => {
  for (const [plan, hexadecimal] of [
    [canonicalGainGraphPlan(), GAIN_GRAPH_HEX],
    [canonicalPolarityGraphPlan(), POLARITY_GRAPH_HEX],
    [canonicalSaturationGraphPlan(), SATURATION_GRAPH_HEX],
  ] as const) {
    const encoded = encodeCompiledGraph(plan);
    assert.equal(encoded.toString("hex"), hexadecimal);
    assert.deepEqual(decodeCompiledGraph(encoded), plan);
  }
});

test("rejects a noncanonical plan before encoding", async () => {
  const plan = canonicalPolarityGraphPlan();
  const operations = plan.operations.map((operation) => ({ ...operation }));
  const polarity = operations[2];
  assert.ok(polarity !== undefined);
  polarity.type = 9999;
  await expectProductError(
    () => encodeCompiledGraph({ ...plan, operations }),
    "GARAK_COMPILED_GRAPH_NONCANONICAL",
  );
});

test("rejects truncated, trailing, old/current-mismatch, reserved and noncanonical bytes", async () => {
  const canonical = Buffer.from(GAIN_GRAPH_HEX, "hex");
  await expectProductError(
    () => decodeCompiledGraph(canonical.subarray(0, canonical.length - 1)),
    "GARAK_COMPILED_GRAPH_LAYOUT",
  );
  await expectProductError(
    () => decodeCompiledGraph(Buffer.concat([canonical, Buffer.from([0])])),
    "GARAK_COMPILED_GRAPH_LAYOUT",
  );

  for (const minor of [0, 1, 3]) {
    const unsupported = Buffer.from(canonical);
    unsupported.writeUInt16LE(minor, 10);
    await expectProductError(
      () => decodeCompiledGraph(unsupported),
      "GARAK_COMPILED_GRAPH_VERSION",
    );
  }

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
