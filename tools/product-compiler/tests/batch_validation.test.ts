import test from "node:test";

import type { ProductIdentity } from "../src/project_model.ts";
import {
  assertNoBatchCollisions,
  batchRecord,
  validateProjectValue,
} from "../src/validation.ts";
import { expectProductError, mutableWarmProduct } from "./helpers.ts";

function projectWith(productId: string, name: string, sourceDirectory: string) {
  const value = mutableWarmProduct();
  value.productId = productId;
  value.name = name;
  return validateProjectValue(value, sourceDirectory);
}

test("detects duplicate product IDs and case-insensitive artifact names", async () => {
  const first = projectWith(
    "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
    "First Product",
    "first.garak",
  );
  const duplicateId = projectWith(
    "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
    "Second Product",
    "second.garak",
  );
  await expectProductError(
    () =>
      assertNoBatchCollisions([batchRecord(first), batchRecord(duplicateId)]),
    "GARAK_BATCH_DUPLICATE_PRODUCT_ID",
  );

  const second = projectWith(
    "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357",
    "FIRST PRODUCT",
    "second.garak",
  );
  await expectProductError(
    () => assertNoBatchCollisions([batchRecord(first), batchRecord(second)]),
    "GARAK_BATCH_ARTIFACT_COLLISION",
  );
});

test("detects processor, controller, and cross-role FUID collisions", async () => {
  const first = projectWith(
    "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
    "First",
    "first.garak",
  );
  const second = projectWith(
    "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357",
    "Second",
    "second.garak",
  );
  const firstIdentity: ProductIdentity = {
    processorFuid: "11111111111111111111111111111111",
    controllerFuid: "22222222222222222222222222222222",
  };
  for (const secondIdentity of [
    {
      processorFuid: "11111111111111111111111111111111",
      controllerFuid: "33333333333333333333333333333333",
    },
    {
      processorFuid: "33333333333333333333333333333333",
      controllerFuid: "22222222222222222222222222222222",
    },
    {
      processorFuid: "22222222222222222222222222222222",
      controllerFuid: "33333333333333333333333333333333",
    },
  ] as const) {
    await expectProductError(
      () =>
        assertNoBatchCollisions([
          { project: first, identity: firstIdentity },
          { project: second, identity: secondIdentity },
        ]),
      "GARAK_BATCH_FUID_COLLISION",
    );
  }
});

test("detects normalized output path collision independently of names", async () => {
  const first = projectWith(
    "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
    "First",
    "first.garak",
  );
  const second = projectWith(
    "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357",
    "Second",
    "second.garak",
  );
  await expectProductError(
    () =>
      assertNoBatchCollisions([
        batchRecord(first, "out/Same.vst3"),
        batchRecord(second, "OUT/same.vst3"),
      ]),
    "GARAK_BATCH_OUTPUT_COLLISION",
  );
});
