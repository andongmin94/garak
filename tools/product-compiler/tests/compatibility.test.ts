import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  classifyCompiledProduct,
  classifyProductState,
  inspectCompatibilityFiles,
} from "../src/compatibility.ts";
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

test("current compiled product and same-product state are loadable together", async () => {
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

test("compiled compatibility distinguishes rebuild, future, and corruption", async () => {
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

test("file inspection derives the state Product ID boundary from current compiled data", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const compiledFile = path.join(temporary, "product.garakbin");
    const stateFile = path.join(temporary, "state.bin");
    await writeFile(compiledFile, encodeCompiledProduct(project));
    await writeFile(stateFile, WARM_DEFAULT_STATE);

    const report = await inspectCompatibilityFiles({
      compiledFile,
      stateFile,
    });
    assert.equal(report.loadable, true);
    assert.equal(report.compiled.disposition, "load-current");
    assert.equal(report.state?.disposition, "restore-current");

    await writeFile(stateFile, copyWithU16(WARM_DEFAULT_STATE, 10, 1));
    const future = await inspectCompatibilityFiles({
      compiledFile,
      stateFile,
    });
    assert.equal(future.loadable, false);
    assert.equal(future.state?.disposition, "reject-too-new");
  });
});
