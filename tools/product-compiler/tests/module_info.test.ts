import assert from "node:assert/strict";
import test from "node:test";

import { deriveProductIdentity } from "../src/identity.ts";
import {
  parseAndValidateModuleInfo,
  removeJsonTrailingCommas,
} from "../src/module_info.ts";
import { validateProjectValue } from "../src/validation.ts";
import {
  expectProductError,
  moduleInfoText,
  mutableWarmProduct,
} from "./helpers.ts";

test("normalizes only structural trailing commas outside strings", () => {
  const source = '{"value":"text,]}","array":[1,2,],"object":{"x":1,},}';
  assert.deepEqual(JSON.parse(removeJsonTrailingCommas(source)), {
    value: "text,]}",
    array: [1, 2],
    object: { x: 1 },
  });
});

test("validates official trailing-comma moduleinfo structure and parity", () => {
  const project = validateProjectValue(mutableWarmProduct(), "fixture.garak");
  const summary = parseAndValidateModuleInfo(
    moduleInfoText(project),
    project,
    deriveProductIdentity(project.productId),
  );
  assert.equal(summary.name, project.name);
  assert.equal(summary.category, "Fx");
});

test("rejects stale factory identity and duplicate moduleinfo keys", async () => {
  const project = validateProjectValue(mutableWarmProduct(), "fixture.garak");
  const identity = deriveProductIdentity(project.productId);
  await expectProductError(
    () =>
      parseAndValidateModuleInfo(
        moduleInfoText(project).replace("Garak Test Artist", "Stale Vendor"),
        project,
        identity,
      ),
    "GARAK_MODULEINFO_PARITY",
  );
  await expectProductError(
    () =>
      parseAndValidateModuleInfo(
        moduleInfoText(project).replace(
          `"Name": "${project.name}",`,
          `"Name": "${project.name}", "N\\u0061me": "${project.name}",`,
        ),
        project,
        identity,
      ),
    "GARAK_MODULEINFO_DUPLICATE_KEY",
  );
});
