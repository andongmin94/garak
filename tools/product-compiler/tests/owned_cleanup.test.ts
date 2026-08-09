import assert from "node:assert/strict";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  OWNED_CLEANUP_CONTRACT_VERSION,
  retryOwnedCleanup,
} from "../src/owned_cleanup.ts";
import type { OwnedCleanupOrphan } from "../src/owned_cleanup.ts";
import { expectProductError, withTemporaryDirectory } from "./helpers.ts";

function descriptor(
  parentDirectory: string,
  targetPath: string,
): OwnedCleanupOrphan {
  return {
    contractVersion: OWNED_CLEANUP_CONTRACT_VERSION,
    kind: "project-stage",
    parentDirectory,
    targetPath,
  };
}

test("owned cleanup removes only a structurally owned physical directory tree", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const target = path.join(temporary, ".garak-project-stage-owned-1");
    await mkdir(path.join(target, "nested"), { recursive: true });
    await writeFile(path.join(target, "nested", "file.txt"), "owned");
    assert.deepEqual(await retryOwnedCleanup(descriptor(temporary, target)), {
      targetPath: target,
      removed: true,
    });
    assert.deepEqual(await readdir(temporary), []);
    assert.deepEqual(await retryOwnedCleanup(descriptor(temporary, target)), {
      targetPath: target,
      removed: false,
    });
  });
});

test("owned cleanup rejects malformed, escaped, and kind-confused descriptors", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const target = path.join(temporary, ".garak-project-stage-owned-2");
    await mkdir(target);
    await expectProductError(
      () =>
        retryOwnedCleanup({ ...descriptor(temporary, target), extra: true }),
      "GARAK_CLEANUP_DESCRIPTOR",
    );
    await expectProductError(
      () =>
        retryOwnedCleanup({
          ...descriptor(temporary, target),
          parentDirectory: ".",
        }),
      "GARAK_CLEANUP_DESCRIPTOR",
    );
    await expectProductError(
      () =>
        retryOwnedCleanup({
          ...descriptor(temporary, target),
          targetPath: path.join(temporary, "nested", path.basename(target)),
        }),
      "GARAK_CLEANUP_OWNERSHIP",
    );
    await expectProductError(
      () =>
        retryOwnedCleanup({
          ...descriptor(temporary, target),
          kind: "export-stage",
        }),
      "GARAK_CLEANUP_OWNERSHIP",
    );
    await expectProductError(
      () =>
        retryOwnedCleanup({
          ...descriptor(temporary, target),
          targetPath: `${temporary}${path.sep}nested${path.sep}..${path.sep}${path.basename(target)}`,
        }),
      "GARAK_CLEANUP_DESCRIPTOR",
    );
    assert.deepEqual(await readdir(temporary), [path.basename(target)]);
  });
});

test("owned cleanup rejects files and a missing ownership parent", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const target = path.join(temporary, ".garak-project-stage-file");
    await writeFile(target, "not a directory");
    await expectProductError(
      () => retryOwnedCleanup(descriptor(temporary, target)),
      "GARAK_CLEANUP_OWNERSHIP",
    );
    await expectProductError(
      () =>
        retryOwnedCleanup(
          descriptor(
            path.join(temporary, "missing"),
            path.join(temporary, "missing", ".garak-project-stage-gone"),
          ),
        ),
      "GARAK_CLEANUP_PARENT_MISSING",
    );
  });
});
