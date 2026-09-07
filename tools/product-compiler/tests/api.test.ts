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
  const inverted = path.join(
    repositoryRoot,
    "examples/products/artist-gain-inverted.garak",
  );
  const validated = await validateProductProjects([warm, bright, inverted]);
  assert.equal(validated.valid, true);
  assert.equal(validated.products.length, 3);
  assert.deepEqual(
    validated.products.map((product) => ({
      sourceSchemaVersion: product.sourceSchemaVersion,
      currentSchemaVersion: product.currentSchemaVersion,
      migrationRequired: product.migrationRequired,
      migrationPath: product.migrationPath,
    })),
    [
      {
        sourceSchemaVersion: 4,
        currentSchemaVersion: 4,
        migrationRequired: false,
        migrationPath: [],
      },
      {
        sourceSchemaVersion: 4,
        currentSchemaVersion: 4,
        migrationRequired: false,
        migrationPath: [],
      },
      {
        sourceSchemaVersion: 4,
        currentSchemaVersion: 4,
        migrationRequired: false,
        migrationPath: [],
      },
    ],
  );
  assert.deepEqual(
    validated.products.map(({ name }) => name),
    ["Artist Gain Warm", "Artist Gain Bright", "Artist Gain Inverted"],
  );
  const inspection = await inspectProductProject(warm);
  assert.equal(inspection.productId, validated.products[0]?.productId);
  assert.equal(inspection.processorFuid, validated.products[0]?.processorFuid);
  assert.deepEqual(inspection.template, { id: "garak.gain", version: 1 });
  assert.deepEqual(inspection.schemaStatus, {
    sourceSchemaVersion: 4,
    currentSchemaVersion: 4,
    migrationRequired: false,
    steps: [],
  });

  const invertedProject = await loadProductProject(inverted);
  const invertedInspection = await inspectProductProject(inverted);
  assert.equal(invertedProject.defaults.gainDb, 0);
  assert.deepEqual(
    invertedProject.graph.nodes.map(({ type }) => type),
    ["garak.audio-input", "garak.gain", "garak.polarity", "garak.audio-output"],
  );
  assert.equal(
    invertedInspection.processorFuid,
    "0F9440082CB44B2520D74808ABBE9BB7",
  );
  assert.equal(
    invertedInspection.controllerFuid,
    "46A92FFD833F6E288AF7CCFC5C735230",
  );
  assert.equal(invertedInspection.gain.defaultNormalized, 5 / 6);

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
