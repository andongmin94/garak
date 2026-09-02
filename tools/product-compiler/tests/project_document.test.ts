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

import { ProductCompilerError } from "../src/errors.ts";
import { canonicalProductGraphSource } from "../src/graph_source.ts";
import {
  createProductProject,
  inspectProductProjectDraft,
  openProductProject,
  saveProductProject,
  serializeProductProjectDocument,
  validateProductProjectDraft,
} from "../src/project_document.ts";
import type {
  ProductProjectDraft,
  ProjectTransactionFileSystem,
} from "../src/project_document.ts";
import { retryOwnedCleanup } from "../src/owned_cleanup.ts";
import { expectProductError, withTemporaryDirectory } from "./helpers.ts";

const PRODUCT_ID = "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e";

function warmDraft(): ProductProjectDraft {
  return {
    vendor: "Garak Test Artist",
    name: "Artist Gain Warm",
    version: "0.1.0",
    gainDb: -6,
    graph: canonicalProductGraphSource(),
  };
}

async function captureProductError(
  operation: Promise<unknown>,
): Promise<ProductCompilerError> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof ProductCompilerError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected ProductCompilerError.");
}

test("draft validation owns the canonical document and inspection contract", () => {
  const document = validateProductProjectDraft(PRODUCT_ID, warmDraft());
  assert.deepEqual(document, {
    schemaVersion: 3,
    productId: PRODUCT_ID,
    vendor: "Garak Test Artist",
    name: "Artist Gain Warm",
    version: "0.1.0",
    category: "Fx",
    template: { id: "garak.gain", version: 1 },
    defaults: { gainDb: -6 },
    graph: canonicalProductGraphSource(),
  });
  const inspection = inspectProductProjectDraft(PRODUCT_ID, warmDraft());
  assert.equal(inspection.productId, PRODUCT_ID);
  assert.equal(inspection.gain.id, 1001);
  assert.equal(inspection.gain.defaultDb, -6);
  assert.equal(inspection.bypass.id, 1002);
  assert.match(inspection.processorFuid, /^[0-9A-F]{32}$/u);
  assert.notEqual(inspection.processorFuid, inspection.controllerFuid);

  assert.equal(
    serializeProductProjectDocument(document),
    `${JSON.stringify(document, undefined, 2)}\n`,
  );
});

test("draft validation rejects missing and unknown authoring fields", async () => {
  await expectProductError(
    () =>
      validateProductProjectDraft(PRODUCT_ID, {
        vendor: "Artist",
        name: "Gain",
        version: "0.1.0",
      }),
    "GARAK_PROJECT_MISSING_FIELD",
  );
  await expectProductError(
    () =>
      validateProductProjectDraft(PRODUCT_ID, {
        ...warmDraft(),
        productId: PRODUCT_ID,
      }),
    "GARAK_PROJECT_UNKNOWN_FIELD",
  );
});

test("atomic create writes exact canonical bytes and reopens the same snapshot", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: warmDraft(),
      createTransactionId: () => "create",
    });
    assert.equal(created.sourceDirectory, projectDirectory);
    assert.equal(created.cleanupDiagnostics.length, 0);
    assert.match(created.revision, /^[0-9a-f]{64}$/u);
    assert.deepEqual(await readdir(projectDirectory), ["product.json"]);
    const source = await readFile(
      path.join(projectDirectory, "product.json"),
      "utf8",
    );
    assert.equal(source, serializeProductProjectDocument(created.document));
    assert.equal(
      Buffer.from(source)
        .subarray(0, 3)
        .equals(Buffer.from([0xef, 0xbb, 0xbf])),
      false,
    );

    const opened = await openProductProject(projectDirectory);
    assert.deepEqual(opened, {
      sourceDirectory: created.sourceDirectory,
      revision: created.revision,
      schemaStatus: created.schemaStatus,
      document: created.document,
      inspection: created.inspection,
    });
    assert.deepEqual(await readdir(temporary), ["warm.garak"]);
  });
});

test("create refuses existing output and invalid input without mutation", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: warmDraft(),
      createTransactionId: () => "baseline",
    });
    const before = await readFile(path.join(projectDirectory, "product.json"));
    await expectProductError(
      () =>
        createProductProject({
          projectDirectory,
          productId: PRODUCT_ID,
          draft: { ...warmDraft(), gainDb: 100 },
          createTransactionId: () => "invalid",
        }),
      "GARAK_PROJECT_OUTPUT_EXISTS",
    );
    assert.deepEqual(
      await readFile(path.join(projectDirectory, "product.json")),
      before,
    );
    assert.equal(
      (await openProductProject(projectDirectory)).revision,
      created.revision,
    );

    const invalidDirectory = path.join(temporary, "invalid.garak");
    await expectProductError(
      () =>
        createProductProject({
          projectDirectory: invalidDirectory,
          productId: PRODUCT_ID,
          draft: { ...warmDraft(), gainDb: 100 },
          createTransactionId: () => "invalid-new",
        }),
      "GARAK_PROJECT_GAIN_RANGE",
    );
    await assert.rejects(stat(invalidDirectory));
    assert.deepEqual((await readdir(temporary)).sort(), ["warm.garak"]);
  });
});

test("save publishes a canonical edit while preserving immutable identity", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: warmDraft(),
      createTransactionId: () => "create",
    });
    const saved = await saveProductProject({
      projectDirectory,
      expectedRevision: created.revision,
      productId: PRODUCT_ID,
      draft: {
        ...warmDraft(),
        vendor: "새 가락",
        name: "Warm Two",
        version: "0.2.0",
        gainDb: 3,
      },
      createTransactionId: () => "save",
    });
    assert.notEqual(saved.revision, created.revision);
    assert.equal(saved.document.productId, PRODUCT_ID);
    assert.equal(saved.document.vendor, "새 가락");
    assert.equal(saved.document.defaults.gainDb, 3);
    assert.equal(
      saved.inspection.processorFuid,
      created.inspection.processorFuid,
    );
    assert.deepEqual(await openProductProject(projectDirectory), {
      sourceDirectory: saved.sourceDirectory,
      revision: saved.revision,
      schemaStatus: saved.schemaStatus,
      document: saved.document,
      inspection: saved.inspection,
    });
    assert.deepEqual(await readdir(temporary), ["warm.garak"]);
  });
});

test("save rejects revision conflicts and Product ID changes before staging", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: warmDraft(),
      createTransactionId: () => "create",
    });
    const productJson = path.join(projectDirectory, "product.json");
    const before = await readFile(productJson);

    await expectProductError(
      () =>
        saveProductProject({
          projectDirectory,
          expectedRevision: "0".repeat(64),
          productId: PRODUCT_ID,
          draft: { ...warmDraft(), gainDb: 0 },
          createTransactionId: () => "conflict",
        }),
      "GARAK_PROJECT_REVISION_CONFLICT",
    );
    assert.deepEqual(await readFile(productJson), before);

    await expectProductError(
      () =>
        saveProductProject({
          projectDirectory,
          expectedRevision: created.revision,
          productId: "11111111-2222-4333-8444-555555555555",
          draft: warmDraft(),
          createTransactionId: () => "identity",
        }),
      "GARAK_PROJECT_ID_IMMUTABLE",
    );
    assert.deepEqual(await readFile(productJson), before);
    assert.deepEqual(await readdir(temporary), ["warm.garak"]);

    await writeFile(productJson, `${before.toString("utf8")}\n`, "utf8");
    await expectProductError(
      () =>
        saveProductProject({
          projectDirectory,
          expectedRevision: created.revision,
          productId: PRODUCT_ID,
          draft: warmDraft(),
          createTransactionId: () => "external-edit",
        }),
      "GARAK_PROJECT_REVISION_CONFLICT",
    );
  });
});

test("save backup and publish failures preserve or restore the prior project", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: warmDraft(),
      createTransactionId: () => "create",
    });
    const before = await readFile(path.join(projectDirectory, "product.json"));

    const backupFailure: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        if (
          source === projectDirectory &&
          destination.includes("garak-backup")
        ) {
          throw new Error("injected backup failure");
        }
        await rename(source, destination);
      },
      remove: async (target) => {
        await rm(target, { recursive: true, force: true });
      },
    };
    await expectProductError(
      () =>
        saveProductProject({
          projectDirectory,
          expectedRevision: created.revision,
          productId: PRODUCT_ID,
          draft: { ...warmDraft(), gainDb: 1 },
          createTransactionId: () => "backup-failure",
          transactionFileSystem: backupFailure,
        }),
      "GARAK_PROJECT_PREPUBLISH_BACKUP",
    );
    assert.deepEqual(
      await readFile(path.join(projectDirectory, "product.json")),
      before,
    );

    const publishFailure: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        if (
          source.includes(".garak-project-stage-") &&
          destination === projectDirectory
        ) {
          throw new Error("injected publish failure");
        }
        await rename(source, destination);
      },
      remove: async (target) => {
        await rm(target, { recursive: true, force: true });
      },
    };
    await expectProductError(
      () =>
        saveProductProject({
          projectDirectory,
          expectedRevision: created.revision,
          productId: PRODUCT_ID,
          draft: { ...warmDraft(), gainDb: 2 },
          createTransactionId: () => "publish-failure",
          transactionFileSystem: publishFailure,
        }),
      "GARAK_PROJECT_PUBLISH",
    );
    assert.deepEqual(
      await readFile(path.join(projectDirectory, "product.json")),
      before,
    );
    assert.deepEqual(await readdir(temporary), ["warm.garak"]);
  });
});

test("rollback failure preserves the exact prior project at its owned backup", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: warmDraft(),
      createTransactionId: () => "create",
    });
    const before = await readFile(path.join(projectDirectory, "product.json"));
    const backup = path.join(
      temporary,
      "warm.garak.garak-backup-rollback-failure",
    );
    const fileSystem: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        if (
          source.includes(".garak-project-stage-") &&
          destination === projectDirectory
        ) {
          throw new Error("injected publish failure");
        }
        if (source === backup && destination === projectDirectory) {
          throw new Error("injected rollback failure");
        }
        await rename(source, destination);
      },
      remove: async (target) => {
        await rm(target, { recursive: true, force: true });
      },
    };
    const error = await captureProductError(
      saveProductProject({
        projectDirectory,
        expectedRevision: created.revision,
        productId: PRODUCT_ID,
        draft: { ...warmDraft(), gainDb: 4 },
        createTransactionId: () => "rollback-failure",
        transactionFileSystem: fileSystem,
      }),
    );
    assert.equal(error.diagnostic.code, "GARAK_PROJECT_PUBLISH_ROLLBACK");
    await assert.rejects(stat(projectDirectory));
    assert.deepEqual(await readFile(path.join(backup, "product.json")), before);
    assert.deepEqual(await readdir(temporary), [path.basename(backup)]);
  });
});

test("project transaction names never overwrite unowned siblings", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const collision = path.join(temporary, ".garak-project-stage-collision");
    await mkdir(collision);
    await writeFile(path.join(collision, "sentinel.txt"), "unowned");
    await expectProductError(
      () =>
        createProductProject({
          projectDirectory: path.join(temporary, "warm.garak"),
          productId: PRODUCT_ID,
          draft: warmDraft(),
          createTransactionId: () => "collision",
        }),
      "GARAK_PROJECT_TRANSACTION_COLLISION",
    );
    assert.equal(
      await readFile(path.join(collision, "sentinel.txt"), "utf8"),
      "unowned",
    );
    await expectProductError(
      () =>
        createProductProject({
          projectDirectory: path.join(temporary, "unsafe.garak"),
          productId: PRODUCT_ID,
          draft: warmDraft(),
          createTransactionId: () => "../escape",
        }),
      "GARAK_PROJECT_TRANSACTION_ID",
    );
  });
});

test("publish and staging cleanup double failure is explicit and preserves prior data", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: warmDraft(),
      createTransactionId: () => "create",
    });
    const before = await readFile(path.join(projectDirectory, "product.json"));
    const fileSystem: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        if (
          source.includes(".garak-project-stage-") &&
          destination === projectDirectory
        ) {
          throw new Error("injected publish failure");
        }
        await rename(source, destination);
      },
      remove: async () => {
        throw new Error("injected staging cleanup failure");
      },
    };
    const error = await captureProductError(
      saveProductProject({
        projectDirectory,
        expectedRevision: created.revision,
        productId: PRODUCT_ID,
        draft: { ...warmDraft(), gainDb: 6 },
        createTransactionId: () => "double-failure",
        transactionFileSystem: fileSystem,
      }),
    );
    assert.equal(error.diagnostic.code, "GARAK_PROJECT_PRE_COMMIT_CLEANUP");
    assert.match(error.diagnostic.message, /injected staging cleanup failure/u);
    assert.match(error.diagnostic.message, /GARAK_PROJECT_PUBLISH/u);
    assert.deepEqual(
      await readFile(path.join(projectDirectory, "product.json")),
      before,
    );
    assert.deepEqual((await readdir(temporary)).sort(), [
      ".garak-project-stage-double-failure",
      "warm.garak",
    ]);
  });
});

test("post-commit project cleanup returns typed owned orphans that can be retried", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: warmDraft(),
      createTransactionId: () => "create",
    });
    const fileSystem: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        await rename(source, destination);
      },
      remove: async () => {
        throw new Error("injected cleanup failure");
      },
    };
    const saved = await saveProductProject({
      projectDirectory,
      expectedRevision: created.revision,
      productId: PRODUCT_ID,
      draft: { ...warmDraft(), gainDb: 5 },
      createTransactionId: () => "cleanup-warning",
      transactionFileSystem: fileSystem,
    });
    assert.equal(saved.document.defaults.gainDb, 5);
    assert.deepEqual(
      saved.cleanupDiagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        kind: diagnostic.orphan.kind,
      })),
      [
        {
          code: "GARAK_PROJECT_POST_COMMIT_STAGE_CLEANUP",
          kind: "project-stage",
        },
        {
          code: "GARAK_PROJECT_POST_COMMIT_BACKUP_CLEANUP",
          kind: "project-backup",
        },
      ],
    );
    for (const diagnostic of saved.cleanupDiagnostics) {
      assert.equal((await retryOwnedCleanup(diagnostic.orphan)).removed, true);
      assert.equal((await retryOwnedCleanup(diagnostic.orphan)).removed, false);
    }
    assert.deepEqual(await readdir(temporary), ["warm.garak"]);
    assert.equal(
      (await openProductProject(projectDirectory)).revision,
      saved.revision,
    );
  });
});
