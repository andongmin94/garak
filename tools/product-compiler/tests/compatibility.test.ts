import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  classifyCompiledGraph,
  classifyCompiledProduct,
  classifyProductState,
  inspectCompatibilityFiles,
} from "../src/compatibility.ts";
import {
  canonicalGainGraphPlan,
  encodeCompiledGraph,
} from "../src/compiled_graph.ts";
import { encodeCompiledProduct } from "../src/compiled_product.ts";
import { loadTemporaryWarmProject, withTemporaryDirectory } from "./helpers.ts";

const WARM_PRODUCT_ID = "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e";
const BRIGHT_PRODUCT_ID = "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357";
const WARM_DEFAULT_STATE = Buffer.from(
  "474152414B5053540100000040000000" +
    "60000000000000006F0E50F1A2D44B37" +
    "8C9E1F2A3B4C5D6E0200100000000000" +
    "00000000000000000000000000000000" +
    "E903000001000000000000000000E83F" +
    "EA030000020000000000000000000000",
  "hex",
);

function copyWithU16(
  source: Uint8Array,
  offset: number,
  value: number,
): Buffer {
  const result = Buffer.from(source);
  result.writeUInt16LE(value, offset);
  return result;
}

function currentGraph(): Buffer {
  return encodeCompiledGraph(canonicalGainGraphPlan());
}

test("current compiled product, graph, and same-product state are loadable together", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const compiled = encodeCompiledProduct(project);
    assert.deepEqual(classifyCompiledProduct(compiled), {
      artifact: "compiled-product",
      disposition: "load-current",
      version: { major: 1, minor: 0 },
      productId: WARM_PRODUCT_ID,
      diagnosticCode: null,
      action: "Load the compiled product with the current Runtime v1 contract.",
    });
    assert.deepEqual(classifyCompiledGraph(currentGraph()), {
      artifact: "compiled-graph",
      disposition: "load-current",
      version: { major: 1, minor: 0 },
      diagnosticCode: null,
      action: "Load the exact current GARAKGRF v1 execution plan.",
    });
    assert.deepEqual(
      classifyProductState(WARM_DEFAULT_STATE, WARM_PRODUCT_ID),
      {
        artifact: "product-state",
        disposition: "restore-current",
        version: { major: 1, minor: 0 },
        productId: WARM_PRODUCT_ID,
        diagnosticCode: null,
        action: "Restore the exact current Product State v1 contract.",
      },
    );
  });
});

test("compiled product compatibility distinguishes rebuild, future, and corruption", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const current = encodeCompiledProduct(
      await loadTemporaryWarmProject(temporary),
    );
    const old = classifyCompiledProduct(copyWithU16(current, 8, 0));
    assert.equal(old.disposition, "rebuild-from-project");
    assert.equal(old.diagnosticCode, "GARAK_COMPILED_VERSION_OLD");

    const futureMajor = classifyCompiledProduct(copyWithU16(current, 8, 2));
    assert.equal(futureMajor.disposition, "reject-too-new");
    const futureMinor = classifyCompiledProduct(copyWithU16(current, 10, 1));
    assert.equal(futureMinor.disposition, "reject-too-new");

    const corrupt = Buffer.from(current);
    corrupt.writeUInt32LE(corrupt.byteLength + 1, 16);
    const invalid = classifyCompiledProduct(corrupt);
    assert.equal(invalid.disposition, "reject-invalid");
    assert.equal(invalid.diagnosticCode, "GARAK_COMPILED_TOTAL_SIZE");
  });
});

test("compiled graph compatibility distinguishes missing, old, future, and corruption", () => {
  const current = currentGraph();

  const missing = classifyCompiledGraph(null);
  assert.equal(missing.disposition, "rebuild-from-project");
  assert.equal(missing.version, null);
  assert.equal(missing.diagnosticCode, "GARAK_COMPILED_GRAPH_MISSING");

  const old = classifyCompiledGraph(copyWithU16(current, 8, 0));
  assert.equal(old.disposition, "rebuild-from-project");
  assert.deepEqual(old.version, { major: 0, minor: 0 });
  assert.equal(old.diagnosticCode, "GARAK_COMPILED_GRAPH_VERSION_OLD");

  const futureMajor = classifyCompiledGraph(copyWithU16(current, 8, 2));
  assert.equal(futureMajor.disposition, "reject-too-new");
  assert.equal(
    futureMajor.diagnosticCode,
    "GARAK_COMPILED_GRAPH_VERSION_NEW",
  );
  const futureMinor = classifyCompiledGraph(copyWithU16(current, 10, 1));
  assert.equal(futureMinor.disposition, "reject-too-new");

  const corrupt = Buffer.from(current);
  corrupt.writeUInt32LE(1, 28);
  const invalid = classifyCompiledGraph(corrupt);
  assert.equal(invalid.disposition, "reject-invalid");
  assert.deepEqual(invalid.version, { major: 1, minor: 0 });
  assert.equal(invalid.diagnosticCode, "GARAK_COMPILED_GRAPH_RESERVED");

  const badMagic = Buffer.from(current);
  badMagic[0] = 0;
  const invalidMagic = classifyCompiledGraph(badMagic);
  assert.equal(invalidMagic.disposition, "reject-invalid");
  assert.equal(invalidMagic.version, null);
  assert.equal(invalidMagic.diagnosticCode, "GARAK_COMPILED_GRAPH_MAGIC");
});

test("state compatibility rejects old, future, foreign, and malformed state", () => {
  const old = classifyProductState(
    copyWithU16(WARM_DEFAULT_STATE, 8, 0),
    WARM_PRODUCT_ID,
  );
  assert.equal(old.disposition, "reject-unsupported-old");

  const futureMajor = classifyProductState(
    copyWithU16(WARM_DEFAULT_STATE, 8, 2),
    WARM_PRODUCT_ID,
  );
  assert.equal(futureMajor.disposition, "reject-too-new");
  const futureMinor = classifyProductState(
    copyWithU16(WARM_DEFAULT_STATE, 10, 1),
    WARM_PRODUCT_ID,
  );
  assert.equal(futureMinor.disposition, "reject-too-new");

  const foreign = classifyProductState(WARM_DEFAULT_STATE, BRIGHT_PRODUCT_ID);
  assert.equal(foreign.disposition, "reject-foreign-product");
  assert.equal(foreign.productId, WARM_PRODUCT_ID);

  const malformed = Buffer.from(WARM_DEFAULT_STATE);
  malformed.writeUInt32LE(9999, 64);
  const invalid = classifyProductState(malformed, WARM_PRODUCT_ID);
  assert.equal(invalid.disposition, "reject-invalid");
  assert.equal(invalid.diagnosticCode, "GARAK_STATE_INVALID");
});

test("file inspection requires current compiled product and graph", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const compiledFile = path.join(temporary, "product.garakbin");
    const graphFile = path.join(temporary, "graph.garakbin");
    const stateFile = path.join(temporary, "state.bin");
    await writeFile(compiledFile, encodeCompiledProduct(project));
    await writeFile(graphFile, currentGraph());
    await writeFile(stateFile, WARM_DEFAULT_STATE);

    const report = await inspectCompatibilityFiles({
      compiledFile,
      graphFile,
      stateFile,
    });
    assert.equal(report.loadable, true);
    assert.equal(report.compiled.disposition, "load-current");
    assert.equal(report.graph.disposition, "load-current");
    assert.equal(report.state?.disposition, "restore-current");

    const omittedGraph = await inspectCompatibilityFiles({
      compiledFile,
      stateFile,
    });
    assert.equal(omittedGraph.loadable, false);
    assert.equal(omittedGraph.graph.disposition, "rebuild-from-project");
    assert.equal(
      omittedGraph.graph.diagnosticCode,
      "GARAK_COMPILED_GRAPH_MISSING",
    );

    const absentGraph = await inspectCompatibilityFiles({
      compiledFile,
      graphFile: path.join(temporary, "absent.garakbin"),
      stateFile,
    });
    assert.equal(absentGraph.loadable, false);
    assert.equal(absentGraph.graph.disposition, "rebuild-from-project");

    await writeFile(stateFile, copyWithU16(WARM_DEFAULT_STATE, 10, 1));
    const future = await inspectCompatibilityFiles({
      compiledFile,
      graphFile,
      stateFile,
    });
    assert.equal(future.loadable, false);
    assert.equal(future.state?.disposition, "reject-too-new");
  });
});
