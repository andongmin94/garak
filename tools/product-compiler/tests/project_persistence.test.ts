import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { ProductCompilerError } from "../src/errors.ts";
import {
  createDurableProductProject,
  fingerprintProjectTree,
  migrateProductProjectInPlace,
  openDurableProductProject,
  recoverProductPersistence,
  saveDurableProductProject,
} from "../src/project_persistence.ts";
import type { ProjectTransactionFileSystem } from "../src/project_document.ts";
import {
  expectProductError,
  mutableLegacyWarmProduct,
  mutableWarmProduct,
  withTemporaryDirectory,
  writeProject,
} from "./helpers.ts";

const PRODUCT_ID = "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e";
const OTHER_PRODUCT_ID = "11111111-2222-4333-8444-555555555555";
const DRAFT = Object.freeze({
  vendor: "Garak Test Artist",
  name: "Artist Gain Warm",
  version: "0.1.0",
  gainDb: -6,
});

async function captureProductError(
  operation: Promise<unknown>,
): Promise<ProductCompilerError> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof ProductCompilerError) return error;
    throw error;
  }
  throw new Error("Expected ProductCompilerError.");
}

test("tree fingerprint is deterministic and independent of the absolute package path", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const first = await writeProject(
      temporary,
      mutableWarmProduct(),
      "first.garak",
    );
    const second = await writeProject(
      temporary,
      mutableWarmProduct(),
      "second.garak",
    );
    assert.equal(
      await fingerprintProjectTree(first),
      await fingerprintProjectTree(second),
    );
    await writeFile(path.join(second, "product.json"), "{}\n", "utf8");
    assert.notEqual(
      await fingerprintProjectTree(first),
      await fingerprintProjectTree(second),
    );
  });
});

test("durable save retains a verified persistent backup and advances the tree revision", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createDurableProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: DRAFT,
      createPersistenceTransactionId: () => "create-outer",
      createInnerTransactionId: () => "create-inner",
    });
    const oldBytes = await readFile(path.join(projectDirectory, "product.json"));
    const saved = await saveDurableProductProject({
      projectDirectory,
      expectedRevision: created.revision,
      productId: PRODUCT_ID,
      draft: { ...DRAFT, version: "0.2.0", gainDb: 3 },
      createPersistenceTransactionId: () => "save-outer",
      createInnerTransactionId: () => "save-inner",
    });
    assert.notEqual(saved.revision, created.revision);
    assert.equal(saved.document.version, "0.2.0");
    assert.equal(saved.document.defaults.gainDb, 3);
    assert.notEqual(saved.backup, null);
    if (saved.backup === null) return;
    assert.deepEqual(
      await readFile(path.join(saved.backup.projectDirectory, "product.json")),
      oldBytes,
    );
    assert.equal(
      await fingerprintProjectTree(saved.backup.projectDirectory),
      saved.backup.fingerprint,
    );
    assert.equal(
      (await openDurableProductProject(projectDirectory)).revision,
      saved.revision,
    );
  });
});

test("external future schema and Product ID replacement fail before publication", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createDurableProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: DRAFT,
      createPersistenceTransactionId: () => "create-a",
      createInnerTransactionId: () => "create-a-inner",
    });
    const future = mutableWarmProduct();
    future.schemaVersion = 3;
    await writeFile(
      path.join(projectDirectory, "product.json"),
      `${JSON.stringify(future, undefined, 2)}\n`,
      "utf8",
    );
    await expectProductError(
      () =>
        saveDurableProductProject({
          projectDirectory,
          expectedRevision: created.revision,
          productId: PRODUCT_ID,
          draft: DRAFT,
          createPersistenceTransactionId: () => "future",
          createInnerTransactionId: () => "future-inner",
        }),
      "GARAK_PROJECT_VERSION_TOO_NEW",
    );

    const replacement = mutableWarmProduct();
    replacement.productId = OTHER_PRODUCT_ID;
    await writeFile(
      path.join(projectDirectory, "product.json"),
      `${JSON.stringify(replacement, undefined, 2)}\n`,
      "utf8",
    );
    await expectProductError(
      () =>
        saveDurableProductProject({
          projectDirectory,
          expectedRevision: created.revision,
          productId: PRODUCT_ID,
          draft: DRAFT,
          createPersistenceTransactionId: () => "identity",
          createInnerTransactionId: () => "identity-inner",
        }),
      "GARAK_PROJECT_ID_IMMUTABLE",
    );
  });
});

test("recovery restores the verified backup when interruption leaves the source retired", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createDurableProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: DRAFT,
      createPersistenceTransactionId: () => "create-b",
      createInnerTransactionId: () => "create-b-inner",
    });
    const sourceBytes = await readFile(path.join(projectDirectory, "product.json"));
    const fileSystem: ProjectTransactionFileSystem = {
      rename: async (source, destination) => {
        await rename(source, destination);
        if (
          source === projectDirectory &&
          destination.includes("garak-backup")
        ) {
          throw new Error(
            "simulated process interruption after source retirement",
          );
        }
      },
      remove: async (target) => {
        await rm(target, { recursive: true, force: true });
      },
    };
    await assert.rejects(
      saveDurableProductProject({
        projectDirectory,
        expectedRevision: created.revision,
        productId: PRODUCT_ID,
        draft: { ...DRAFT, gainDb: 2 },
        createPersistenceTransactionId: () => "retired",
        createInnerTransactionId: () => "retired-inner",
        transactionFileSystem: fileSystem,
      }),
    );
    const recovered = await openDurableProductProject(projectDirectory);
    assert.equal(recovered.document.defaults.gainDb, -6);
    assert.deepEqual(
      await readFile(path.join(projectDirectory, "product.json")),
      sourceBytes,
    );
  });
});

test("recovery completes a candidate published before the outer transaction commits", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createDurableProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: DRAFT,
      createPersistenceTransactionId: () => "create-c",
      createInnerTransactionId: () => "create-c-inner",
    });
    const saved = await saveDurableProductProject({
      projectDirectory,
      expectedRevision: created.revision,
      productId: PRODUCT_ID,
      draft: { ...DRAFT, gainDb: 4 },
      createPersistenceTransactionId: () => "published",
      createInnerTransactionId: () => "published-inner",
      faultInjector: (point) => {
        if (point === "after-mutation-published") {
          throw new Error(
            "simulated outer process interruption after candidate publish",
          );
        }
      },
    });
    assert.equal(saved.document.defaults.gainDb, 4);
    assert.equal(
      (await openDurableProductProject(projectDirectory)).document.defaults
        .gainDb,
      4,
    );
  });
});

test("exclusive persistence lock rejects a second writer without deleting the lock", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = path.join(temporary, "warm.garak");
    const created = await createDurableProductProject({
      projectDirectory,
      productId: PRODUCT_ID,
      draft: DRAFT,
      createPersistenceTransactionId: () => "create-d",
      createInnerTransactionId: () => "create-d-inner",
    });
    let unblock: (() => void) | undefined;
    let markEntered: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    const first = saveDurableProductProject({
      projectDirectory,
      expectedRevision: created.revision,
      productId: PRODUCT_ID,
      draft: { ...DRAFT, gainDb: 1 },
      createPersistenceTransactionId: () => "writer-one",
      createInnerTransactionId: () => "writer-one-inner",
      faultInjector: async (point) => {
        if (point === "after-backup-verified") {
          markEntered?.();
          await blocked;
        }
      },
    });
    await entered;
    await expectProductError(
      () =>
        saveDurableProductProject({
          projectDirectory,
          expectedRevision: created.revision,
          productId: PRODUCT_ID,
          draft: { ...DRAFT, gainDb: 2 },
          createPersistenceTransactionId: () => "writer-two",
          createInnerTransactionId: () => "writer-two-inner",
        }),
      "GARAK_PROJECT_TRANSACTION_LOCKED",
    );
    unblock?.();
    await first;
  });
});

test("explicit in-place migration keeps identity and retains the exact legacy backup", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = await writeProject(
      temporary,
      mutableLegacyWarmProduct(),
      "legacy.garak",
    );
    const legacyBytes = await readFile(path.join(projectDirectory, "product.json"));
    const opened = await openDurableProductProject(projectDirectory);
    assert.equal(opened.schemaStatus.migrationRequired, true);
    const migrated = await migrateProductProjectInPlace({
      projectDirectory,
      expectedRevision: opened.revision,
      createPersistenceTransactionId: () => "migrate",
      createInnerTransactionId: () => "migrate-inner",
    });
    assert.equal(migrated.document.schemaVersion, 2);
    assert.equal(migrated.document.productId, PRODUCT_ID);
    assert.equal(
      migrated.inspection.processorFuid,
      opened.inspection.processorFuid,
    );
    assert.notEqual(migrated.backup, null);
    if (migrated.backup === null) return;
    assert.deepEqual(
      await readFile(path.join(migrated.backup.projectDirectory, "product.json")),
      legacyBytes,
    );
    assert.equal(
      (await openDurableProductProject(projectDirectory)).schemaStatus
        .migrationRequired,
      false,
    );
  });
});

test("a lock without a transaction manifest fails closed as ambiguous recovery", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectDirectory = await writeProject(temporary);
    const fingerprint = await fingerprintProjectTree(projectDirectory);
    const key = (await import("node:crypto"))
      .createHash("sha256")
      .update("garak.persistence-target.v1\0", "utf8")
      .update(path.normalize(projectDirectory).toUpperCase(), "utf8")
      .digest("hex")
      .slice(0, 32);
    const root = path.join(temporary, ".garak-persistence", key);
    await mkdir(root, { recursive: true });
    await writeFile(
      path.join(root, "lock.json"),
      `${JSON.stringify({
        type: "garak-persistence-lock",
        version: 1,
        transactionId: "orphan",
        operation: "save",
        targetKey: key,
        productId: PRODUCT_ID,
        expectedRevision: fingerprint,
        processId: 1,
        createdAt: new Date(0).toISOString(),
      })}\n`,
      "utf8",
    );
    const error = await captureProductError(
      recoverProductPersistence(projectDirectory),
    );
    assert.equal(error.diagnostic.code, "GARAK_PROJECT_RECOVERY_AMBIGUOUS");
  });
});
