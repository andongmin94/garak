import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  compileProductProject,
  exportProductProject,
  inspectProductProject,
  validateProductProjects,
} from "../src/api.ts";
import { decodeCompiledProduct } from "../src/compiled_product.ts";
import { loadProductProject } from "../src/validation.ts";
import {
  createFakeArtifacts,
  expectProductError,
  fakeProcessRunner,
  withTemporaryDirectory,
  writeProject,
} from "./helpers.ts";

test("callable validation and inspection facade preserves the CLI result contract", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const warm = path.join(
    repositoryRoot,
    "examples/products/artist-gain-warm.garak",
  );
  const bright = path.join(
    repositoryRoot,
    "examples/products/artist-gain-bright.garak",
  );
  const validated = await validateProductProjects([warm, bright]);
  assert.equal(validated.valid, true);
  assert.equal(validated.products.length, 2);
  assert.deepEqual(
    validated.products.map(({ name }) => name),
    ["Artist Gain Warm", "Artist Gain Bright"],
  );
  const inspection = await inspectProductProject(warm);
  assert.equal(inspection.productId, validated.products[0]?.productId);
  assert.equal(inspection.processorFuid, validated.products[0]?.processorFuid);
  await expectProductError(
    () => validateProductProjects([]),
    "GARAK_VALIDATE_EMPTY_BATCH",
  );
});

test("callable compile and export facade reuse canonical project loading", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectPath = await writeProject(temporary);
    const compiledFile = path.join(temporary, "compiled", "product.garakbin");
    const compiled = await compileProductProject({
      projectPath,
      outputFile: compiledFile,
      force: false,
      createTransactionId: () => "facade-compile",
    });
    assert.equal(compiled.outputFile, compiledFile);
    assert.equal(
      decodeCompiledProduct(await readFile(compiledFile)).productId,
      "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
    );

    const project = await loadProductProject(projectPath);
    const artifacts = await createFakeArtifacts(temporary);
    const exported = await exportProductProject({
      projectPath,
      configuration: "Debug",
      outputDirectory: path.join(temporary, "exports"),
      repositoryRoot: temporary,
      force: false,
      validate: true,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "facade-export",
    });
    assert.equal(path.basename(exported.bundlePath), "Artist Gain Warm.vst3");
    assert.deepEqual(
      exported.childProcesses.map(({ exitCode }) => exitCode),
      [0, 0, 0, 0, 0],
    );
    assert.equal(exported.cleanupDiagnostics.length, 0);
  });
});
