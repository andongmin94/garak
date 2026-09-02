import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  compileProductProject,
  exportProductProject,
  validateProductProjects,
} from "../src/api.ts";
import { diagnosticFor } from "../src/errors.ts";
import { canonicalProductGraphSource } from "../src/graph_source.ts";
import {
  inspectProjectMigration,
  migrateProductProject,
} from "../src/project_migration.ts";
import {
  createProductProject,
  openProductProject,
  saveProductProject,
} from "../src/project_document.ts";
import type { ProjectTransactionFileSystem } from "../src/project_document.ts";
import { serializeCanonicalProductProject } from "../src/project_migration_core.ts";
import { loadProductProjectSource } from "../src/validation.ts";
import {
  createFakeArtifacts,
  fakeProcessRunner,
  mutableLegacyWarmProduct,
  mutableWarmProduct,
  withTemporaryDirectory,
  writeProject,
} from "./helpers.ts";

const PRODUCT_ID = "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e";
const PROCESSOR_FUID = "3BA93DD6A062C97D89EC78F3652F83C4";
const CONTROLLER_FUID = "00DD9000A50F7F28F4AE084CD29C4330";
const CANONICAL_SHA =
  "A3CF6EA3C9F8E8D1BB7EB3C0A57B434F8AC80534D1857E50B6EF6EEA082B5E28";
const CLI = path.resolve(import.meta.dirname, "../src/cli.ts");
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");

function draft(gainDb = -6): {
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly gainDb: number;
  readonly graph: ReturnType<typeof canonicalProductGraphSource>;
} {
  return {
    vendor: "Garak Test Artist",
    name: "Artist Gain Warm",
    version: "0.1.0",
    gainDb,
    graph: canonicalProductGraphSource(),
  };
}

async function sourceSnapshot(projectDirectory: string): Promise<{
  readonly bytes: Buffer;
  readonly modifiedMilliseconds: number;
  readonly inventory: readonly string[];
}> {
  const source = path.join(projectDirectory, "product.json");
  return {
    bytes: await readFile(source),
    modifiedMilliseconds: (await stat(source)).mtimeMs,
    inventory: await readdir(projectDirectory),
  };
}

async function expectCode(
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert.equal(diagnosticFor(error).code, code);
    return;
  }
  assert.fail(`Expected diagnostic ${code}.`);
}

function runCli(arguments_: readonly string[]): {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
} {
  const result = spawnSync(process.execPath, [CLI, ...arguments_], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

test("migration status classifies legacy and current projects without mutation", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const current = await writeProject(
      temporary,
      mutableWarmProduct(),
      "current.garak",
    );
    const legacyBefore = await sourceSnapshot(legacy);
    const currentBefore = await sourceSnapshot(current);

    assert.deepEqual(await inspectProjectMigration(legacy), {
      detectedSchemaVersion: 1,
      currentSchemaVersion: 3,
      migrationRequired: true,
      migrationPath: ["project-schema-1-to-2", "project-schema-2-to-3"],
      identity: {
        productId: PRODUCT_ID,
        processorFuid: PROCESSOR_FUID,
        controllerFuid: CONTROLLER_FUID,
      },
      sourceModified: false,
    });
    assert.deepEqual(await inspectProjectMigration(current), {
      detectedSchemaVersion: 3,
      currentSchemaVersion: 3,
      migrationRequired: false,
      migrationPath: [],
      identity: {
        productId: PRODUCT_ID,
        processorFuid: PROCESSOR_FUID,
        controllerFuid: CONTROLLER_FUID,
      },
      sourceModified: false,
    });
    assert.deepEqual(await sourceSnapshot(legacy), legacyBefore);
    assert.deepEqual(await sourceSnapshot(current), currentBefore);
  });
});

test("tracked legacy v1 and v2 source bytes remain independent fixed oracles", async () => {
  for (const [relative, bytes, sha256] of [
    [
      "examples/products/legacy/v1/artist-gain-warm.garak/product.json",
      256,
      "E67AE969C2712040D1455034AE9CEC27369A1F3CA661B18837F71070446CB556",
    ],
    [
      "examples/products/legacy/v1/artist-gain-bright.garak/product.json",
      257,
      "5ED2BA89333BD58410A9A97E7C01C2C1575D60529E2C916A1A6E2654B1CB3094",
    ],
    [
      "examples/products/legacy/v2/artist-gain-warm.garak/product.json",
      285,
      "3F27ED552AEC8CAE3C7D34C5AE1F4821582E1DAC3E323B353A845C8891734C33",
    ],
    [
      "examples/products/legacy/v2/artist-gain-bright.garak/product.json",
      286,
      "B50A360FD6862BFD0364D4BE95365D4B48E0AF34EE81084626EBE5F791C5932B",
    ],
  ] as const) {
    const source = await readFile(path.join(REPOSITORY_ROOT, relative));
    assert.equal(source.length, bytes);
    assert.equal(
      createHash("sha256").update(source).digest("hex").toUpperCase(),
      sha256,
    );
  }
});

test("dry-run is deterministic for legacy and is a current-schema no-op", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const current = await writeProject(
      temporary,
      mutableWarmProduct(),
      "current.garak",
    );
    const before = await sourceSnapshot(legacy);
    const first = await migrateProductProject({
      projectPath: legacy,
      dryRun: true,
      force: false,
    });
    const second = await migrateProductProject({
      projectPath: legacy,
      dryRun: true,
      force: false,
    });
    assert.deepEqual(first, second);
    assert.deepEqual(first, {
      sourceSchemaVersion: 1,
      targetSchemaVersion: 3,
      steps: ["project-schema-1-to-2", "project-schema-2-to-3"],
      sourceProductId: PRODUCT_ID,
      targetProductId: PRODUCT_ID,
      processorFuidBefore: PROCESSOR_FUID,
      processorFuidAfter: PROCESSOR_FUID,
      controllerFuidBefore: CONTROLLER_FUID,
      controllerFuidAfter: CONTROLLER_FUID,
      identityChanged: false,
      productSemanticsChanged: false,
      sourceModified: false,
      outputWritten: false,
      dryRun: true,
      canonicalSha256: CANONICAL_SHA,
      outputProject: null,
      cleanupDiagnostics: [],
    });
    const currentReport = await migrateProductProject({
      projectPath: current,
      dryRun: true,
      force: false,
    });
    assert.equal(currentReport.sourceSchemaVersion, 3);
    assert.deepEqual(currentReport.steps, []);
    assert.equal(currentReport.canonicalSha256, CANONICAL_SHA);
    assert.deepEqual(await sourceSnapshot(legacy), before);
    assert.deepEqual((await readdir(temporary)).sort(), [
      "current.garak",
      "legacy.garak",
    ]);
  });
});

test("ordinary project open migrates in memory while save refuses a legacy source rewrite", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const before = await sourceSnapshot(legacy);
    const opened = await openProductProject(legacy);
    assert.equal(opened.document.schemaVersion, 3);
    assert.deepEqual(opened.document.template, {
      id: "garak.gain",
      version: 1,
    });
    assert.deepEqual(opened.schemaStatus, {
      sourceSchemaVersion: 1,
      currentSchemaVersion: 3,
      migrationRequired: true,
      steps: ["project-schema-1-to-2", "project-schema-2-to-3"],
    });
    await expectCode(
      () =>
        saveProductProject({
          projectDirectory: legacy,
          expectedRevision: opened.revision,
          productId: PRODUCT_ID,
          draft: draft(),
        }),
      "GARAK_PROJECT_MIGRATION_REQUIRED",
    );
    assert.deepEqual(await sourceSnapshot(legacy), before);
  });
});

test("explicit migration publishes exact canonical v3 and preserves legacy bytes and metadata", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const output = path.join(temporary, "migrated.garak");
    const before = await sourceSnapshot(legacy);
    const report = await migrateProductProject({
      projectPath: legacy,
      outputProject: output,
      dryRun: false,
      force: false,
      createTransactionId: () => "explicit",
    });

    assert.equal(report.outputWritten, true);
    assert.equal(report.outputProject, output);
    assert.equal(report.canonicalSha256, CANONICAL_SHA);
    assert.equal(report.identityChanged, false);
    assert.equal(report.productSemanticsChanged, false);
    assert.deepEqual(await sourceSnapshot(legacy), before);
    assert.deepEqual(await readdir(output), ["product.json"]);
    const loaded = await loadProductProjectSource(output);
    assert.deepEqual(loaded.schemaStatus, {
      sourceSchemaVersion: 3,
      currentSchemaVersion: 3,
      migrationRequired: false,
      steps: [],
    });
    assert.equal(
      await readFile(path.join(output, "product.json"), "utf8"),
      serializeCanonicalProductProject(loaded.project),
    );
  });
});

test("new-output publication failure leaves no partial migrated project", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const output = path.join(temporary, "never-published.garak");
    const before = await sourceSnapshot(legacy);
    const fileSystem: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        if (
          source.includes(".garak-project-stage-") &&
          destination === output
        ) {
          throw new Error("injected new-output publication failure");
        }
        await rename(source, destination);
      },
      remove: async (target) => {
        await rm(target, { recursive: true, force: true });
      },
    };
    await expectCode(
      () =>
        migrateProductProject({
          projectPath: legacy,
          outputProject: output,
          dryRun: false,
          force: false,
          createTransactionId: () => "new-publish-failure",
          transactionFileSystem: fileSystem,
        }),
      "GARAK_PROJECT_PUBLISH",
    );
    await assert.rejects(stat(output));
    assert.deepEqual(await sourceSnapshot(legacy), before);
    assert.deepEqual(await readdir(temporary), ["legacy.garak"]);
  });
});

test("migration rejects in-place, overlapping, current, and occupied output without mutation", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const current = await writeProject(
      temporary,
      mutableWarmProduct(),
      "current.garak",
    );
    const occupied = await writeProject(
      temporary,
      mutableWarmProduct(),
      "occupied.garak",
    );
    const before = await sourceSnapshot(legacy);
    await expectCode(
      () =>
        migrateProductProject({
          projectPath: legacy,
          outputProject: legacy,
          dryRun: false,
          force: false,
        }),
      "GARAK_MIGRATION_OUTPUT_OVERLAP",
    );
    await expectCode(
      () =>
        migrateProductProject({
          projectPath: legacy,
          outputProject: path.join(legacy, "nested.garak"),
          dryRun: false,
          force: false,
        }),
      "GARAK_MIGRATION_OUTPUT_OVERLAP",
    );
    await expectCode(
      () =>
        migrateProductProject({
          projectPath: current,
          outputProject: path.join(temporary, "current-copy.garak"),
          dryRun: false,
          force: false,
        }),
      "GARAK_MIGRATION_NOT_REQUIRED",
    );
    await expectCode(
      () =>
        migrateProductProject({
          projectPath: legacy,
          outputProject: occupied,
          dryRun: false,
          force: false,
        }),
      "GARAK_MIGRATION_OUTPUT_EXISTS",
    );
    await expectCode(
      () =>
        migrateProductProject({
          projectPath: legacy,
          outputProject: path.join(temporary, "missing-parent", "output.garak"),
          dryRun: false,
          force: false,
        }),
      "GARAK_PROJECT_PARENT_MISSING",
    );
    assert.deepEqual(await sourceSnapshot(legacy), before);
  });
});

test(
  "migration rejects a Windows junction alias of the physical source",
  { skip: process.platform !== "win32" },
  async () => {
    await withTemporaryDirectory(async (temporary) => {
      const physicalParent = path.join(temporary, "physical");
      await mkdir(physicalParent);
      const source = await writeProject(
        physicalParent,
        mutableLegacyWarmProduct(),
        "source.garak",
      );
      const aliasParent = path.join(temporary, "alias");
      await symlink(physicalParent, aliasParent, "junction");
      const aliasedSource = path.join(aliasParent, "source.garak");
      const before = await sourceSnapshot(source);

      for (const [projectPath, outputProject] of [
        [source, aliasedSource],
        [aliasedSource, source],
      ] as const) {
        await expectCode(
          () =>
            migrateProductProject({
              projectPath,
              outputProject,
              dryRun: false,
              force: true,
            }),
          "GARAK_MIGRATION_OUTPUT_OVERLAP",
        );
      }

      await expectCode(
        () =>
          compileProductProject({
            projectPath: aliasedSource,
            outputFile: path.join(source, "product.garakbin"),
            force: false,
          }),
        "GARAK_COMPILE_OUTPUT_OVERLAP",
      );
      const artifacts = await createFakeArtifacts(temporary);
      const loaded = await loadProductProjectSource(aliasedSource);
      await expectCode(
        () =>
          exportProductProject({
            projectPath: aliasedSource,
            configuration: "Debug",
            outputDirectory: source,
            repositoryRoot: temporary,
            force: false,
            validate: false,
            artifacts,
            processRunner: fakeProcessRunner(loaded.project),
          }),
        "GARAK_EXPORT_OUTPUT_OVERLAP",
      );
      const artifactAlias = path.join(temporary, "artifact-alias");
      await symlink(artifacts.artifactRoot, artifactAlias, "junction");
      await expectCode(
        () =>
          exportProductProject({
            projectPath: source,
            configuration: "Debug",
            outputDirectory: artifactAlias,
            repositoryRoot: temporary,
            force: false,
            validate: false,
            artifacts,
            processRunner: fakeProcessRunner(loaded.project),
          }),
        "GARAK_EXPORT_OUTPUT_OVERLAP",
      );
      assert.deepEqual(await sourceSnapshot(source), before);
    });
  },
);

test("force migration preserves prior output on backup and publication failures", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const output = path.join(temporary, "output.garak");
    const baseline = await createProductProject({
      projectDirectory: output,
      productId: PRODUCT_ID,
      draft: draft(4),
      createTransactionId: () => "baseline",
    });
    const before = await sourceSnapshot(output);
    const backupFailure: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        if (source === output && destination.includes("garak-backup")) {
          throw new Error("injected migration backup failure");
        }
        await rename(source, destination);
      },
      remove: async (target) => {
        await rm(target, { recursive: true, force: true });
      },
    };
    await expectCode(
      () =>
        migrateProductProject({
          projectPath: legacy,
          outputProject: output,
          dryRun: false,
          force: true,
          createTransactionId: () => "backup-failure",
          transactionFileSystem: backupFailure,
        }),
      "GARAK_PROJECT_PREPUBLISH_BACKUP",
    );
    assert.deepEqual(await sourceSnapshot(output), before);

    const publishFailure: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        if (
          source.includes(".garak-project-stage-") &&
          destination === output
        ) {
          throw new Error("injected migration publication failure");
        }
        await rename(source, destination);
      },
      remove: async (target) => {
        await rm(target, { recursive: true, force: true });
      },
    };
    await expectCode(
      () =>
        migrateProductProject({
          projectPath: legacy,
          outputProject: output,
          dryRun: false,
          force: true,
          createTransactionId: () => "publish-failure",
          transactionFileSystem: publishFailure,
        }),
      "GARAK_PROJECT_PUBLISH",
    );
    assert.deepEqual(await sourceSnapshot(output), before);
    assert.equal(
      (await openProductProject(output)).revision,
      baseline.revision,
    );
    assert.deepEqual((await readdir(temporary)).sort(), [
      "legacy.garak",
      "output.garak",
    ]);

    const succeeded = await migrateProductProject({
      projectPath: legacy,
      outputProject: output,
      dryRun: false,
      force: true,
      createTransactionId: () => "replace-success",
    });
    assert.equal(succeeded.outputWritten, true);
    assert.equal(
      (await openProductProject(output)).document.defaults.gainDb,
      -6,
    );
  });
});

test("force migration may safely replace a legacy same-product output without enabling ordinary save", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "source.garak",
    );
    const output = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy-output.garak",
    );
    const sourceBefore = await sourceSnapshot(legacy);
    const report = await migrateProductProject({
      projectPath: legacy,
      outputProject: output,
      dryRun: false,
      force: true,
      createTransactionId: () => "legacy-replace",
    });
    assert.equal(report.outputWritten, true);
    assert.deepEqual(await sourceSnapshot(legacy), sourceBefore);
    assert.deepEqual((await loadProductProjectSource(output)).schemaStatus, {
      sourceSchemaVersion: 3,
      currentSchemaVersion: 3,
      migrationRequired: false,
      steps: [],
    });
  });
});

test("future and unsupported-old projects fail closed before any migration output", async () => {
  await withTemporaryDirectory(async (temporary) => {
    for (const [version, code] of [
      [0, "GARAK_PROJECT_VERSION_TOO_OLD"],
      [4, "GARAK_PROJECT_VERSION_TOO_NEW"],
    ] as const) {
      const value = mutableWarmProduct();
      value.schemaVersion = version;
      const source = await writeProject(
        temporary,
        value,
        `schema-${version}.garak`,
      );
      const output = path.join(temporary, `output-${version}.garak`);
      const compiledOutput = path.join(
        temporary,
        `compiled-${version}`,
        "product.garakbin",
      );
      const exportOutput = path.join(temporary, `export-${version}`);
      const before = await sourceSnapshot(source);
      await expectCode(() => inspectProjectMigration(source), code);
      await expectCode(() => validateProductProjects([source]), code);
      await expectCode(
        () =>
          compileProductProject({
            projectPath: source,
            outputFile: compiledOutput,
            force: false,
          }),
        code,
      );
      await expectCode(
        () =>
          exportProductProject({
            projectPath: source,
            configuration: "Debug",
            outputDirectory: exportOutput,
            repositoryRoot: temporary,
            force: false,
            validate: true,
          }),
        code,
      );
      await expectCode(
        () =>
          migrateProductProject({
            projectPath: source,
            outputProject: output,
            dryRun: false,
            force: false,
          }),
        code,
      );
      await assert.rejects(stat(output));
      await assert.rejects(stat(compiledOutput));
      await assert.rejects(stat(exportOutput));
      assert.deepEqual(await sourceSnapshot(source), before);
    }
  });
});

test("headless CLI exposes human and JSON status, dry-run, and explicit output", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const before = await sourceSnapshot(legacy);
    const statusHuman = runCli(["migration-status", "--project", legacy]);
    assert.equal(statusHuman.status, 0, statusHuman.stderr);
    assert.match(statusHuman.stdout, /Detected schema: 1/u);
    assert.match(statusHuman.stdout, /Migration required: true/u);
    const statusJson = runCli([
      "migration-status",
      "--project",
      legacy,
      "--json",
    ]);
    assert.equal(statusJson.status, 0, statusJson.stderr);
    assert.equal(
      (JSON.parse(statusJson.stdout) as { detectedSchemaVersion: number })
        .detectedSchemaVersion,
      1,
    );
    const dryRun = runCli([
      "migrate",
      "--project",
      legacy,
      "--to",
      "latest",
      "--dry-run",
      "--json",
    ]);
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(
      (JSON.parse(dryRun.stdout) as { canonicalSha256: string })
        .canonicalSha256,
      CANONICAL_SHA,
    );
    const output = path.join(temporary, "cli-output.garak");
    const migrate = runCli([
      "migrate",
      "--project",
      legacy,
      "--to",
      "latest",
      "--output",
      output,
      "--json",
    ]);
    assert.equal(migrate.status, 0, migrate.stderr);
    assert.equal(
      (JSON.parse(migrate.stdout) as { outputWritten: boolean }).outputWritten,
      true,
    );
    assert.deepEqual((await loadProductProjectSource(output)).schemaStatus, {
      sourceSchemaVersion: 3,
      currentSchemaVersion: 3,
      migrationRequired: false,
      steps: [],
    });
    assert.deepEqual(await sourceSnapshot(legacy), before);
  });
});

test("headless CLI reports future/old failures and rejects in-place output", async () => {
  await withTemporaryDirectory(async (temporary) => {
    for (const [version, code] of [
      [0, "GARAK_PROJECT_VERSION_TOO_OLD"],
      [4, "GARAK_PROJECT_VERSION_TOO_NEW"],
    ] as const) {
      const value = mutableWarmProduct();
      value.schemaVersion = version;
      const source = await writeProject(
        temporary,
        value,
        `cli-${version}.garak`,
      );
      const result = runCli([
        "migrate",
        "--project",
        source,
        "--to",
        "latest",
        "--output",
        path.join(temporary, `never-${version}.garak`),
        "--json",
      ]);
      assert.equal(result.status, 1);
      assert.equal((JSON.parse(result.stderr) as { code: string }).code, code);
    }

    const legacy = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "cli-overlap.garak",
    );
    const result = runCli([
      "migrate",
      "--project",
      legacy,
      "--to",
      "latest",
      "--output",
      legacy,
      "--json",
    ]);
    assert.equal(result.status, 1);
    assert.equal(
      (JSON.parse(result.stderr) as { code: string }).code,
      "GARAK_MIGRATION_OUTPUT_OVERLAP",
    );
  });
});
