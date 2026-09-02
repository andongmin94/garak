import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { inspectCompatibilityFiles } from "../src/compatibility.ts";
import { encodeCompiledProduct } from "../src/compiled_product.ts";
import { loadTemporaryWarmProject, withTemporaryDirectory } from "./helpers.ts";

test("an explicit non-file graph path is an I/O error rather than a missing artifact", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const compiledFile = path.join(temporary, "product.garakbin");
    const graphDirectory = path.join(temporary, "graph.garakbin");

    await writeFile(compiledFile, encodeCompiledProduct(project));
    await mkdir(graphDirectory);

    await assert.rejects(
      inspectCompatibilityFiles({
        compiledFile,
        graphFile: graphDirectory,
      }),
    );
  });
});
