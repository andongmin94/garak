import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  canonicalGainGraphPlan,
  encodeCompiledGraph,
} from "../src/compiled_graph.ts";
import {
  compileProductFile,
  exportWindowsProduct,
} from "../src/export_windows.ts";
import {
  canonicalProductGraphSource,
  validateProductGraphSource,
} from "../src/graph_source.ts";
import { sha256Hex } from "../src/compiled_product.ts";
import { ProductCompilerError } from "../src/errors.ts";
import { retryOwnedCleanup } from "../src/owned_cleanup.ts";
import {
  bundleSnapshot,
  createFakeArtifacts,
  expectProductError,
  fakeProcessRunner,
  loadTemporaryWarmProject,
  withTemporaryDirectory,
  writeRawProject,
} from "./helpers.ts";
import { loadProductProject } from "../src/validation.ts";

async function captureProductError(
  operation: Promise<unknown>,
): Promise<ProductCompilerError> {
  try {
    await operation;
  } catch (error) {
    assert.ok(error instanceof ProductCompilerError);
    return error;
  }
  throw new Error("Expected ProductCompilerError.");
}

test("compiles product.garakbin with default refusal and force-safe replacement", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const outputFile = path.join(temporary, "compiled", "product.garakbin");
    const first = await compileProductFile({
      project,
      outputFile,
      force: false,
      createTransactionId: () => "compile-first",
    });
    assert.equal(first.bytes, 177);
    assert.deepEqual(first.cleanupDiagnostics, []);
    assert.equal(
      first.sha256,
      "3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9",
    );
    await expectProductError(
      () =>
        compileProductFile({
          project,
          outputFile,
          force: false,
          createTransactionId: () => "compile-refuse",
        }),
      "GARAK_COMPILE_OUTPUT_EXISTS",
    );
    const replaced = await compileProductFile({
      project,
      outputFile,
      force: true,
      createTransactionId: () => "compile-force",
    });
    assert.equal(replaced.sha256, first.sha256);
    assert.deepEqual(replaced.cleanupDiagnostics, []);
    assert.equal(sha256Hex(await readFile(outputFile)), first.sha256);
  });
});

test("compile publication stays successful and reports backup cleanup failure", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const outputFile = path.join(temporary, "compiled", "product.garakbin");
    await compileProductFile({
      project,
      outputFile,
      force: false,
      createTransactionId: () => "cleanup-baseline",
    });
    const before = await readFile(outputFile);

    const result = await compileProductFile({
      project,
      outputFile,
      force: true,
      createTransactionId: () => "cleanup-warning",
      transactionFileSystem: {
        rename: async (source, destination) => {
          await rename(source, destination);
        },
        remove: async (target) => {
          if (path.basename(target).startsWith(".garak-compile-backup-")) {
            throw new Error("injected backup cleanup failure");
          }
          await rm(target, { recursive: true, force: true });
        },
      },
    });

    assert.equal(sha256Hex(await readFile(outputFile)), result.sha256);
    assert.deepEqual(result.cleanupDiagnostics, [
      {
        code: "GARAK_COMPILE_POST_COMMIT_CLEANUP",
        path: "compile.cleanup",
        message: `Published output is valid, but transaction cleanup failed for '${path.join(path.dirname(outputFile), ".garak-compile-backup-cleanup-warning")}'. injected backup cleanup failure`,
      },
    ]);
    assert.deepEqual(
      await readFile(
        path.join(
          path.dirname(outputFile),
          ".garak-compile-backup-cleanup-warning",
        ),
      ),
      before,
    );
  });
});

test("compile prepublication backup failure preserves the prior final output", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const outputFile = path.join(temporary, "compiled", "product.garakbin");
    await compileProductFile({
      project,
      outputFile,
      force: false,
      createTransactionId: () => "backup-error-baseline",
    });
    const before = await readFile(outputFile);
    const backup = path.join(
      path.dirname(outputFile),
      ".garak-compile-backup-backup-error",
    );

    const error = await captureProductError(
      compileProductFile({
        project,
        outputFile,
        force: true,
        createTransactionId: () => "backup-error",
        transactionFileSystem: {
          rename: async (source, destination) => {
            if (source === outputFile && destination === backup) {
              throw new Error("injected backup preparation failure");
            }
            await rename(source, destination);
          },
          remove: async (target) => {
            await rm(target, { recursive: true, force: true });
          },
        },
      }),
    );

    assert.equal(error.diagnostic.code, "GARAK_COMPILE_PREPUBLISH_BACKUP");
    assert.equal(error.diagnostic.path, "compile.publish.backup");
    assert.match(error.diagnostic.message, /prior output remains/u);
    assert.match(
      error.diagnostic.message,
      /injected backup preparation failure/u,
    );
    assert.deepEqual(await readFile(outputFile), before);
    assert.deepEqual(await readdir(path.dirname(outputFile)), [
      "product.garakbin",
    ]);
  });
});

test("compile publication failure rolls force replacement back and cleans staging", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const outputFile = path.join(temporary, "compiled", "product.garakbin");
    await compileProductFile({
      project,
      outputFile,
      force: false,
      createTransactionId: () => "rollback-baseline",
    });
    const before = await readFile(outputFile);

    const error = await captureProductError(
      compileProductFile({
        project,
        outputFile,
        force: true,
        createTransactionId: () => "publish-failure",
        transactionFileSystem: {
          rename: async (source, destination) => {
            if (
              path.basename(source) ===
                ".garak-compile-stage-publish-failure" &&
              destination === outputFile
            ) {
              throw new Error("injected publication failure");
            }
            await rename(source, destination);
          },
          remove: async (target) => {
            await rm(target, { recursive: true, force: true });
          },
        },
      }),
    );
    assert.equal(error.diagnostic.code, "GARAK_COMPILE_PUBLISH");
    assert.equal(error.diagnostic.path, "compile.publish");
    assert.match(error.diagnostic.message, /the prior output was restored/u);
    assert.match(error.diagnostic.message, /injected publication failure/u);
    assert.deepEqual(await readFile(outputFile), before);
    assert.deepEqual(await readdir(path.dirname(outputFile)), [
      "product.garakbin",
    ]);
  });
});

test("compile publish and staging cleanup double failure is deterministic", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const outputFile = path.join(temporary, "compiled", "product.garakbin");
    await compileProductFile({
      project,
      outputFile,
      force: false,
      createTransactionId: () => "cleanup-error-baseline",
    });
    const before = await readFile(outputFile);
    const stage = path.join(
      path.dirname(outputFile),
      ".garak-compile-stage-cleanup-error",
    );

    const error = await captureProductError(
      compileProductFile({
        project,
        outputFile,
        force: true,
        createTransactionId: () => "cleanup-error",
        transactionFileSystem: {
          rename: async (source, destination) => {
            if (source === stage && destination === outputFile) {
              throw new Error("injected publication failure");
            }
            await rename(source, destination);
          },
          remove: async (target) => {
            if (target === stage) {
              throw new Error("injected staging cleanup failure");
            }
            await rm(target, { recursive: true, force: true });
          },
        },
      }),
    );

    assert.equal(error.diagnostic.code, "GARAK_COMPILE_PRE_COMMIT_CLEANUP");
    assert.equal(error.diagnostic.path, "compile.cleanup.stage");
    assert.match(error.diagnostic.message, /injected staging cleanup failure/u);
    assert.match(error.diagnostic.message, /GARAK_COMPILE_PUBLISH/u);
    assert.match(error.diagnostic.message, /injected publication failure/u);
    assert.deepEqual(await readFile(outputFile), before);
    assert.equal((await stat(stage)).isFile(), true);
    assert.deepEqual((await readdir(path.dirname(outputFile))).sort(), [
      ".garak-compile-stage-cleanup-error",
      "product.garakbin",
    ]);
  });
});

test("compile rollback failure reports preserved backup with a distinct diagnostic", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const outputFile = path.join(temporary, "compiled", "product.garakbin");
    await compileProductFile({
      project,
      outputFile,
      force: false,
      createTransactionId: () => "rollback-error-baseline",
    });
    const before = await readFile(outputFile);
    const backup = path.join(
      path.dirname(outputFile),
      ".garak-compile-backup-rollback-error",
    );

    const error = await captureProductError(
      compileProductFile({
        project,
        outputFile,
        force: true,
        createTransactionId: () => "rollback-error",
        transactionFileSystem: {
          rename: async (source, destination) => {
            if (
              path.basename(source) === ".garak-compile-stage-rollback-error"
            ) {
              throw new Error("injected publication failure");
            }
            if (source === backup && destination === outputFile) {
              throw new Error("injected rollback failure");
            }
            await rename(source, destination);
          },
          remove: async (target) => {
            await rm(target, { recursive: true, force: true });
          },
        },
      }),
    );

    assert.equal(error.diagnostic.code, "GARAK_COMPILE_PUBLISH_ROLLBACK");
    assert.equal(error.diagnostic.path, "compile.publish.rollback");
    assert.match(error.diagnostic.message, /prior output remains at backup/u);
    assert.match(error.diagnostic.message, /injected publication failure/u);
    assert.match(error.diagnostic.message, /injected rollback failure/u);
    await assert.rejects(stat(outputFile));
    assert.deepEqual(await readFile(backup), before);
    assert.deepEqual(await readdir(path.dirname(outputFile)), [
      ".garak-compile-backup-rollback-error",
    ]);
  });
});

test("transaction-name collisions never remove unowned staging paths", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const compiledParent = path.join(temporary, "compiled");
    await mkdir(compiledParent);
    const compileCollision = path.join(
      compiledParent,
      ".garak-compile-stage-collision",
    );
    await writeFile(compileCollision, "unowned compile sentinel");
    await expectProductError(
      () =>
        compileProductFile({
          project,
          outputFile: path.join(compiledParent, "product.garakbin"),
          force: false,
          createTransactionId: () => "collision",
        }),
      "GARAK_COMPILE_TRANSACTION_COLLISION",
    );
    assert.equal(
      await readFile(compileCollision, "utf8"),
      "unowned compile sentinel",
    );

    const artifacts = await createFakeArtifacts(temporary);
    const outputDirectory = path.join(temporary, "exports");
    const exportCollision = path.join(
      outputDirectory,
      ".garak-product-export-stage-collision",
    );
    await mkdir(exportCollision, { recursive: true });
    const exportSentinel = path.join(exportCollision, "sentinel.txt");
    await writeFile(exportSentinel, "unowned export sentinel");
    await expectProductError(
      () =>
        exportWindowsProduct({
          project,
          configuration: "Debug",
          outputDirectory,
          repositoryRoot: temporary,
          force: false,
          validate: false,
          artifacts,
          processRunner: fakeProcessRunner(project),
          createTransactionId: () => "collision",
        }),
      "GARAK_EXPORT_TRANSACTION_COLLISION",
    );
    assert.equal(
      await readFile(exportSentinel, "utf8"),
      "unowned export sentinel",
    );
  });
});

test("exports an exact four-file bundle through injected official-tool behavior", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const artifacts = await createFakeArtifacts(temporary);
    const outputDirectory = path.join(temporary, "exports");
    const result = await exportWindowsProduct({
      project,
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: false,
      validate: true,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "success",
    });
    assert.deepEqual(result.inventory, [
      "Contents/Resources/graph.garakbin",
      "Contents/Resources/moduleinfo.json",
      "Contents/Resources/product.garakbin",
      "Contents/x86_64-win/Artist Gain Warm.vst3",
    ]);
    assert.equal(
      (
        await readFile(
          path.join(
            result.bundlePath,
            "Contents",
            "Resources",
            "graph.garakbin",
          ),
        )
      ).length,
      92,
    );
    assert.equal(
      result.compiledSha256,
      "3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9",
    );
    assert.equal(result.childProcesses.length, 5);
    assert.deepEqual(result.cleanupDiagnostics, []);
    assert.deepEqual(
      result.childProcesses.map((child) => child.exitCode),
      [0, 0, 0, 0, 0],
    );
    assert.equal((await stat(result.bundlePath)).isDirectory(), true);
    assert.equal(
      result.runtimeSha256,
      sha256Hex(await readFile(artifacts.templateInnerModule)),
    );
  });
});

test("export derives graph.garakbin from the validated project graph without an export fallback", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const canonical = canonicalProductGraphSource();
    const authoredGraph = validateProductGraphSource({
      schemaVersion: 1,
      nodes: [
        { ...canonical.nodes[2], id: "artist-output" },
        { ...canonical.nodes[0], id: "artist-input" },
        { ...canonical.nodes[1], id: "artist-gain" },
      ],
      connections: [
        {
          from: { nodeId: "artist-gain", port: "audio" },
          to: { nodeId: "artist-output", port: "audio" },
        },
        {
          from: { nodeId: "artist-input", port: "audio" },
          to: { nodeId: "artist-gain", port: "audio" },
        },
      ],
    });
    const artifacts = await createFakeArtifacts(temporary);
    const outputDirectory = path.join(temporary, "exports");
    const result = await exportWindowsProduct({
      project: { ...project, graph: authoredGraph },
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: false,
      validate: true,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "authored-graph",
    });
    assert.deepEqual(
      await readFile(
        path.join(result.bundlePath, "Contents", "Resources", "graph.garakbin"),
      ),
      encodeCompiledGraph(canonicalGainGraphPlan()),
    );

    const invalidProject = structuredClone(project);
    Object.assign(invalidProject.graph.nodes[1]!, { implementationVersion: 2 });
    const invalidOutput = path.join(temporary, "invalid-exports");
    await expectProductError(
      () =>
        exportWindowsProduct({
          project: invalidProject,
          configuration: "Debug",
          outputDirectory: invalidOutput,
          repositoryRoot: temporary,
          force: false,
          validate: false,
          artifacts,
          processRunner: fakeProcessRunner(project),
          createTransactionId: () => "invalid-graph",
        }),
      "GARAK_PROJECT_GRAPH_IMPLEMENTATION_VERSION",
    );
    await assert.rejects(stat(invalidOutput));
  });
});

test("export failure stages leave no final output for every external phase", async () => {
  const failureCases = [
    ["moduleinfo-create", "GARAK_EXPORT_MODULEINFO_CREATE"],
    ["moduleinfo-validate", "GARAK_EXPORT_MODULEINFO_VALIDATE"],
    ["inspector", "GARAK_EXPORT_INSPECTOR"],
    ["validator-standard", "GARAK_EXPORT_VALIDATOR_STANDARD"],
    ["validator-extensive", "GARAK_EXPORT_VALIDATOR_EXTENSIVE"],
  ] as const;
  for (const [phase, code] of failureCases) {
    await withTemporaryDirectory(async (temporary) => {
      const project = await loadTemporaryWarmProject(temporary);
      const artifacts = await createFakeArtifacts(temporary);
      const outputDirectory = path.join(temporary, "exports");
      await expectProductError(
        () =>
          exportWindowsProduct({
            project,
            configuration: "Debug",
            outputDirectory,
            repositoryRoot: temporary,
            force: false,
            validate: true,
            artifacts,
            processRunner: fakeProcessRunner(project, { executable: phase }),
            createTransactionId: () => `failure-${phase}`,
          }),
        code,
      );
      await assert.rejects(
        stat(path.join(outputDirectory, "Artist Gain Warm.vst3")),
      );
      const outputExists = await stat(outputDirectory).then(
        () => true,
        () => false,
      );
      if (outputExists) {
        const leftovers = await import("node:fs/promises").then(({ readdir }) =>
          readdir(outputDirectory),
        );
        assert.deepEqual(leftovers, []);
      }
    });
  }
});

test("missing prebuilt Runtime fails before output or staging is created", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const artifacts = await createFakeArtifacts(temporary);
    await rm(artifacts.templateInnerModule);
    const outputDirectory = path.join(temporary, "exports");
    await expectProductError(
      () =>
        exportWindowsProduct({
          project,
          configuration: "Debug",
          outputDirectory,
          repositoryRoot: temporary,
          force: false,
          validate: false,
          artifacts,
          processRunner: fakeProcessRunner(project),
        }),
      "GARAK_EXPORT_MISSING_INPUT",
    );
    await assert.rejects(stat(outputDirectory));
  });
});

test("invalid source project fails before export output is created", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const invalidProject = await writeRawProject(
      temporary,
      '{"schemaVersion":1}',
      "invalid.garak",
    );
    const outputDirectory = path.join(temporary, "exports");
    await expectProductError(async () => {
      const project = await loadProductProject(invalidProject);
      await exportWindowsProduct({
        project,
        configuration: "Debug",
        outputDirectory,
        repositoryRoot: temporary,
        force: false,
        validate: false,
      });
    }, "GARAK_PROJECT_MISSING_FIELD");
    await assert.rejects(stat(outputDirectory));
  });
});

test("default overwrite refuses and force failure preserves the prior valid bundle exactly", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const artifacts = await createFakeArtifacts(temporary);
    const outputDirectory = path.join(temporary, "exports");
    const first = await exportWindowsProduct({
      project,
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: false,
      validate: false,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "baseline",
    });
    const before = await bundleSnapshot(first.bundlePath);

    await expectProductError(
      () =>
        exportWindowsProduct({
          project,
          configuration: "Debug",
          outputDirectory,
          repositoryRoot: temporary,
          force: false,
          validate: false,
          artifacts,
          processRunner: fakeProcessRunner(project),
          createTransactionId: () => "no-force",
        }),
      "GARAK_EXPORT_OUTPUT_EXISTS",
    );
    assert.deepEqual(await bundleSnapshot(first.bundlePath), before);

    await expectProductError(
      () =>
        exportWindowsProduct({
          project,
          configuration: "Debug",
          outputDirectory,
          repositoryRoot: temporary,
          force: true,
          validate: false,
          artifacts,
          processRunner: fakeProcessRunner(project, {
            executable: "inspector",
          }),
          createTransactionId: () => "force-failure",
        }),
      "GARAK_EXPORT_INSPECTOR",
    );
    assert.deepEqual(await bundleSnapshot(first.bundlePath), before);

    const replaced = await exportWindowsProduct({
      project,
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: true,
      validate: false,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "force-success",
    });
    assert.equal(replaced.compiledSha256, first.compiledSha256);
    assert.equal(replaced.moduleInfoSha256, first.moduleInfoSha256);
    assert.deepEqual(await bundleSnapshot(replaced.bundlePath), before);
  });
});

test("export publication stays successful and reports bounded cleanup failures", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const artifacts = await createFakeArtifacts(temporary);
    const outputDirectory = path.join(temporary, "exports");
    const first = await exportWindowsProduct({
      project,
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: false,
      validate: false,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "cleanup-baseline",
    });
    const before = await bundleSnapshot(first.bundlePath);

    const replaced = await exportWindowsProduct({
      project,
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: true,
      validate: false,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "cleanup-warning",
      transactionFileSystem: {
        rename: async (source, destination) => {
          await rename(source, destination);
        },
        remove: async () => {
          throw new Error("injected cleanup failure");
        },
      },
    });

    assert.deepEqual(await bundleSnapshot(replaced.bundlePath), before);
    assert.deepEqual(
      replaced.cleanupDiagnostics.map(({ code, path: diagnosticPath }) => ({
        code,
        path: diagnosticPath,
      })),
      [
        {
          code: "GARAK_EXPORT_POST_COMMIT_STAGE_CLEANUP",
          path: "export.cleanup.stage",
        },
        {
          code: "GARAK_EXPORT_POST_COMMIT_BACKUP_CLEANUP",
          path: "export.cleanup.backup",
        },
      ],
    );
    assert.equal(replaced.cleanupDiagnostics.length, 2);
    assert.deepEqual(
      replaced.cleanupDiagnostics.map((diagnostic) => diagnostic.orphan.kind),
      ["export-stage", "export-backup"],
    );
    assert.deepEqual((await readdir(outputDirectory)).sort(), [
      ".garak-product-export-stage-cleanup-warning",
      "Artist Gain Warm.vst3",
      "Artist Gain Warm.vst3.garak-backup-cleanup-warning",
    ]);
    for (const diagnostic of replaced.cleanupDiagnostics) {
      assert.deepEqual(await retryOwnedCleanup(diagnostic.orphan), {
        targetPath: diagnostic.orphan.targetPath,
        removed: true,
      });
    }
    assert.deepEqual(await readdir(outputDirectory), ["Artist Gain Warm.vst3"]);
  });
});

test("export prepublication backup failure preserves the prior final bundle", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const artifacts = await createFakeArtifacts(temporary);
    const outputDirectory = path.join(temporary, "exports");
    const first = await exportWindowsProduct({
      project,
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: false,
      validate: false,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "backup-error-baseline",
    });
    const before = await bundleSnapshot(first.bundlePath);
    const backup = path.join(
      outputDirectory,
      "Artist Gain Warm.vst3.garak-backup-backup-error",
    );

    const error = await captureProductError(
      exportWindowsProduct({
        project,
        configuration: "Debug",
        outputDirectory,
        repositoryRoot: temporary,
        force: true,
        validate: false,
        artifacts,
        processRunner: fakeProcessRunner(project),
        createTransactionId: () => "backup-error",
        transactionFileSystem: {
          rename: async (source, destination) => {
            if (source === first.bundlePath && destination === backup) {
              throw new Error("injected backup preparation failure");
            }
            await rename(source, destination);
          },
          remove: async (target) => {
            await rm(target, { recursive: true, force: true });
          },
        },
      }),
    );

    assert.equal(error.diagnostic.code, "GARAK_EXPORT_PREPUBLISH_BACKUP");
    assert.equal(error.diagnostic.path, "export.publish.backup");
    assert.match(error.diagnostic.message, /prior bundle remains/u);
    assert.match(
      error.diagnostic.message,
      /injected backup preparation failure/u,
    );
    assert.deepEqual(await bundleSnapshot(first.bundlePath), before);
    assert.deepEqual(await readdir(outputDirectory), ["Artist Gain Warm.vst3"]);
  });
});

test("export publication failure rolls force replacement back and cleans staging", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const artifacts = await createFakeArtifacts(temporary);
    const outputDirectory = path.join(temporary, "exports");
    const first = await exportWindowsProduct({
      project,
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: false,
      validate: false,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "rollback-baseline",
    });
    const before = await bundleSnapshot(first.bundlePath);

    const error = await captureProductError(
      exportWindowsProduct({
        project,
        configuration: "Debug",
        outputDirectory,
        repositoryRoot: temporary,
        force: true,
        validate: false,
        artifacts,
        processRunner: fakeProcessRunner(project),
        createTransactionId: () => "publish-failure",
        transactionFileSystem: {
          rename: async (source, destination) => {
            if (
              source.includes(
                `${path.sep}.garak-product-export-stage-publish-failure${path.sep}`,
              ) &&
              destination === first.bundlePath
            ) {
              throw new Error("injected publication failure");
            }
            await rename(source, destination);
          },
          remove: async (target) => {
            await rm(target, { recursive: true, force: true });
          },
        },
      }),
    );
    assert.equal(error.diagnostic.code, "GARAK_EXPORT_PUBLISH");
    assert.equal(error.diagnostic.path, "export.publish");
    assert.match(error.diagnostic.message, /the prior bundle was restored/u);
    assert.match(error.diagnostic.message, /injected publication failure/u);
    assert.deepEqual(await bundleSnapshot(first.bundlePath), before);
    assert.deepEqual(await readdir(outputDirectory), ["Artist Gain Warm.vst3"]);
  });
});

test("export rollback failure reports preserved backup with a distinct diagnostic", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const project = await loadTemporaryWarmProject(temporary);
    const artifacts = await createFakeArtifacts(temporary);
    const outputDirectory = path.join(temporary, "exports");
    const first = await exportWindowsProduct({
      project,
      configuration: "Debug",
      outputDirectory,
      repositoryRoot: temporary,
      force: false,
      validate: false,
      artifacts,
      processRunner: fakeProcessRunner(project),
      createTransactionId: () => "rollback-error-baseline",
    });
    const before = await bundleSnapshot(first.bundlePath);
    const backup = path.join(
      outputDirectory,
      "Artist Gain Warm.vst3.garak-backup-rollback-error",
    );

    const error = await captureProductError(
      exportWindowsProduct({
        project,
        configuration: "Debug",
        outputDirectory,
        repositoryRoot: temporary,
        force: true,
        validate: false,
        artifacts,
        processRunner: fakeProcessRunner(project),
        createTransactionId: () => "rollback-error",
        transactionFileSystem: {
          rename: async (source, destination) => {
            if (
              source.includes(
                `${path.sep}.garak-product-export-stage-rollback-error${path.sep}`,
              )
            ) {
              throw new Error("injected publication failure");
            }
            if (source === backup && destination === first.bundlePath) {
              throw new Error("injected rollback failure");
            }
            await rename(source, destination);
          },
          remove: async (target) => {
            await rm(target, { recursive: true, force: true });
          },
        },
      }),
    );

    assert.equal(error.diagnostic.code, "GARAK_EXPORT_PUBLISH_ROLLBACK");
    assert.equal(error.diagnostic.path, "export.publish.rollback");
    assert.match(error.diagnostic.message, /prior bundle remains at backup/u);
    assert.match(error.diagnostic.message, /injected publication failure/u);
    assert.match(error.diagnostic.message, /injected rollback failure/u);
    await assert.rejects(stat(first.bundlePath));
    assert.deepEqual(await bundleSnapshot(backup), before);
    assert.deepEqual(await readdir(outputDirectory), [
      "Artist Gain Warm.vst3.garak-backup-rollback-error",
    ]);
  });
});
