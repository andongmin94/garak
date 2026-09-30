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
import {
  canonicalGainGraphPlan,
  canonicalPolarityGraphPlan,
  canonicalSaturationGraphPlan,
  encodeCompiledGraph,
} from "../src/compiled_graph.ts";
import { decodeCompiledProduct } from "../src/compiled_product.ts";
import { loadProductProject } from "../src/validation.ts";
import {
  bundleSnapshot,
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
  const saturated = path.join(
    repositoryRoot,
    "examples/products/artist-gain-saturated.garak",
  );
  const validated = await validateProductProjects([
    warm,
    bright,
    inverted,
    saturated,
  ]);
  assert.equal(validated.valid, true);
  assert.equal(validated.products.length, 4);
  assert.deepEqual(
    validated.products.map((product) => ({
      sourceSchemaVersion: product.sourceSchemaVersion,
      currentSchemaVersion: product.currentSchemaVersion,
      migrationRequired: product.migrationRequired,
      migrationPath: product.migrationPath,
    })),
    [
      {
        sourceSchemaVersion: 5,
        currentSchemaVersion: 5,
        migrationRequired: false,
        migrationPath: [],
      },
      {
        sourceSchemaVersion: 5,
        currentSchemaVersion: 5,
        migrationRequired: false,
        migrationPath: [],
      },
      {
        sourceSchemaVersion: 5,
        currentSchemaVersion: 5,
        migrationRequired: false,
        migrationPath: [],
      },
      {
        sourceSchemaVersion: 5,
        currentSchemaVersion: 5,
        migrationRequired: false,
        migrationPath: [],
      },
    ],
  );
  assert.deepEqual(
    validated.products.map(({ name }) => name),
    [
      "Artist Gain Warm",
      "Artist Gain Bright",
      "Artist Gain Inverted",
      "Artist Gain Saturated",
    ],
  );
  const inspection = await inspectProductProject(warm);
  assert.equal(inspection.productId, validated.products[0]?.productId);
  assert.equal(inspection.processorFuid, validated.products[0]?.processorFuid);
  assert.deepEqual(inspection.template, { id: "garak.gain", version: 1 });
  assert.deepEqual(inspection.schemaStatus, {
    sourceSchemaVersion: 5,
    currentSchemaVersion: 5,
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

  const saturatedProject = await loadProductProject(saturated);
  const saturatedInspection = await inspectProductProject(saturated);
  assert.equal(saturatedProject.defaults.gainDb, 0);
  assert.deepEqual(
    saturatedProject.graph.nodes.map(({ type }) => type),
    [
      "garak.audio-input",
      "garak.gain",
      "garak.saturation",
      "garak.audio-output",
    ],
  );
  assert.equal(saturatedInspection.gain.id, 1001);
  assert.equal(saturatedInspection.bypass.id, 1002);
  assert.equal(saturatedInspection.gain.defaultNormalized, 5 / 6);
  assert.notEqual(
    saturatedInspection.processorFuid,
    invertedInspection.processorFuid,
  );

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

test("four reference exports carry distinct identities, exact graph plans and immutable runtime bytes", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  for (const configuration of ["Debug", "Release"] as const) {
    await withTemporaryDirectory(async (temporary) => {
      const artifacts = await createFakeArtifacts(temporary);
      const runtimeBefore = await readFile(artifacts.templateInnerModule);
      const snapshots: Array<ReadonlyMap<string, string>> = [];
      const identities = new Set<string>();
      for (const [leaf, name, plan] of [
        [
          "artist-gain-warm.garak",
          "Artist Gain Warm",
          canonicalGainGraphPlan(),
        ],
        [
          "artist-gain-bright.garak",
          "Artist Gain Bright",
          canonicalGainGraphPlan(),
        ],
        [
          "artist-gain-inverted.garak",
          "Artist Gain Inverted",
          canonicalPolarityGraphPlan(),
        ],
        [
          "artist-gain-saturated.garak",
          "Artist Gain Saturated",
          canonicalSaturationGraphPlan(),
        ],
      ] as const) {
        const projectPath = path.join(
          repositoryRoot,
          "examples/products",
          leaf,
        );
        const project = await loadProductProject(projectPath);
        const options = {
          projectPath,
          configuration,
          outputDirectory: path.join(temporary, "exports"),
          repositoryRoot: temporary,
          force: true,
          validate: true,
          artifacts,
          processRunner: fakeProcessRunner(project),
          createTransactionId: () => `four-${leaf.replace(".garak", "")}`,
        };
        const exported = await exportProductProject(options);
        assert.equal(path.basename(exported.bundlePath), `${name}.vst3`);
        assert.deepEqual(
          exported.childProcesses.map(({ exitCode }) => exitCode),
          [0, 0, 0, 0, 0],
        );
        const snapshot = await bundleSnapshot(exported.bundlePath);
        assert.deepEqual(
          [...snapshot.keys()].sort(),
          [
            "Contents/Resources/graph.garakbin",
            "Contents/Resources/moduleinfo.json",
            "Contents/Resources/product.garakbin",
            `Contents/x86_64-win/${name}.vst3`,
          ]
            .map((file) => file.split("/").join(path.sep))
            .sort(),
        );
        assert.equal(
          snapshot.get(path.join("Contents", "Resources", "graph.garakbin")),
          encodeCompiledGraph(plan).toString("hex"),
        );
        assert.equal(
          snapshot.get(path.join("Contents", "x86_64-win", `${name}.vst3`)),
          runtimeBefore.toString("hex"),
        );
        const decoded = decodeCompiledProduct(
          await readFile(
            path.join(
              exported.bundlePath,
              "Contents",
              "Resources",
              "product.garakbin",
            ),
          ),
        );
        assert.equal(decoded.productId, project.productId);
        assert.deepEqual(
          decoded.parameters.map(({ id }) => id),
          [1001, 1002],
        );
        assert.equal(identities.has(decoded.productId), false);
        identities.add(decoded.productId);
        const repeated = await exportProductProject(options);
        assert.deepEqual(await bundleSnapshot(repeated.bundlePath), snapshot);
        snapshots.push(snapshot);
      }
      assert.equal(identities.size, 4);
      const resource = (snapshot: ReadonlyMap<string, string>, name: string) =>
        snapshot.get(path.join("Contents", "Resources", name));
      assert.equal(
        new Set(
          snapshots.map((snapshot) => resource(snapshot, "product.garakbin")),
        ).size,
        4,
      );
      assert.equal(
        new Set(
          snapshots.map((snapshot) => resource(snapshot, "moduleinfo.json")),
        ).size,
        4,
      );
      assert.equal(
        new Set(
          snapshots.map((snapshot) => resource(snapshot, "graph.garakbin")),
        ).size,
        3,
      );
      assert.deepEqual(
        await readFile(artifacts.templateInnerModule),
        runtimeBefore,
      );
    });
  }
});
