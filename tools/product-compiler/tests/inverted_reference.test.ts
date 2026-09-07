import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { inspectProductProject, validateProductProjects } from "../src/api.ts";
import {
  canonicalPolarityGraphPlan,
  compileProductGraph,
} from "../src/compiled_graph.ts";
import { loadProductProject } from "../src/validation.ts";

const INVERTED_PRODUCT_ID = "d1331806-9ae0-4971-b83f-871d4af677b5";
const INVERTED_PROCESSOR_FUID = "0F9440082CB44B2520D74808ABBE9BB7";
const INVERTED_CONTROLLER_FUID = "46A92FFD833F6E288AF7CCFC5C735230";

test(
  "Warm, Bright, and Inverted are collision-free current reference products",
  async () => {
    const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
    const projects = [
      path.join(repositoryRoot, "examples/products/artist-gain-warm.garak"),
      path.join(repositoryRoot, "examples/products/artist-gain-bright.garak"),
      path.join(repositoryRoot, "examples/products/artist-gain-inverted.garak"),
    ];

    const validated = await validateProductProjects(projects);
    assert.equal(validated.valid, true);
    assert.deepEqual(
      validated.products.map(({ name }) => name),
      ["Artist Gain Warm", "Artist Gain Bright", "Artist Gain Inverted"],
    );
    assert.equal(
      validated.products.every(
        ({ sourceSchemaVersion }) => sourceSchemaVersion === 4,
      ),
      true,
    );
  },
);

test(
  "Inverted is the exact current Gain-to-Polarity reference product",
  async () => {
    const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
    const projectPath = path.join(
      repositoryRoot,
      "examples/products/artist-gain-inverted.garak",
    );
    const project = await loadProductProject(projectPath);
    const inspection = await inspectProductProject(projectPath);

    assert.equal(project.productId, INVERTED_PRODUCT_ID);
    assert.equal(project.defaults.gainDb, 0);
    assert.deepEqual(
      project.graph.nodes.map(({ type }) => type),
      [
        "garak.audio-input",
        "garak.gain",
        "garak.polarity",
        "garak.audio-output",
      ],
    );
    assert.deepEqual(
      compileProductGraph(project.graph),
      canonicalPolarityGraphPlan(),
    );
    assert.equal(inspection.processorFuid, INVERTED_PROCESSOR_FUID);
    assert.equal(inspection.controllerFuid, INVERTED_CONTROLLER_FUID);
    assert.equal(inspection.gain.defaultNormalized, 5 / 6);
    assert.equal(inspection.bypass.default, false);
  },
);
