import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  deriveFuid,
  deriveProductIdentity,
  PHASE_1A_1B_FUIDS,
} from "../src/identity.ts";
import { validateProjectValue } from "../src/validation.ts";
import { mutableWarmProduct } from "./helpers.ts";

const IDENTITY_VECTORS = Object.freeze([
  {
    productId: "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
    processor: "3BA93DD6A062C97D89EC78F3652F83C4",
    controller: "00DD9000A50F7F28F4AE084CD29C4330",
  },
  {
    productId: "c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357",
    processor: "FCB1FDAED3D981A2AE3AE5A20898C449",
    controller: "32D933DFBD3C8110E014829EF5D62EA3",
  },
  {
    productId: "123e4567-e89b-12d3-a456-426614174000",
    processor: "34041DA416A3944588F29506953A3098",
    controller: "AD919FFE93E7D3CFE766C7AED441B4A6",
  },
]);

test("derives all independent literal FUID vectors exactly", () => {
  for (const vector of IDENTITY_VECTORS) {
    assert.equal(deriveFuid(vector.productId, "processor"), vector.processor);
    assert.equal(deriveFuid(vector.productId, "controller"), vector.controller);
    assert.match(vector.processor, /^[0-9A-F]{32}$/u);
    assert.match(vector.controller, /^[0-9A-F]{32}$/u);
    assert.notEqual(vector.processor, vector.controller);
  }
});

test("identity depends only on productId and role", () => {
  const productId = IDENTITY_VECTORS[0]?.productId;
  assert.ok(productId !== undefined);
  const expected = deriveProductIdentity(productId);
  const variants = [
    { field: "name", value: "Renamed Product", source: "renamed.garak" },
    { field: "vendor", value: "Renamed Vendor", source: "vendor.garak" },
    { field: "version", value: "9.8.7", source: "version.garak" },
  ] as const;
  for (const variant of variants) {
    const value = mutableWarmProduct();
    value[variant.field] = variant.value;
    const project = validateProjectValue(
      value,
      path.resolve("unrelated", variant.source),
    );
    assert.deepEqual(deriveProductIdentity(project.productId), expected);
  }

  const originalCwd = process.cwd();
  try {
    process.chdir(path.dirname(originalCwd));
    assert.deepEqual(deriveProductIdentity(productId), expected);
  } finally {
    process.chdir(originalCwd);
  }
  assert.notDeepEqual(
    expected,
    deriveProductIdentity(IDENTITY_VECTORS[1]?.productId ?? ""),
  );
});

test("reference identities do not collide with Phase 1A or Phase 1B fixtures", () => {
  const all = new Set(PHASE_1A_1B_FUIDS);
  assert.equal(all.size, 10);
  for (const vector of IDENTITY_VECTORS) {
    assert.equal(all.has(vector.processor), false);
    assert.equal(all.has(vector.controller), false);
    all.add(vector.processor);
    all.add(vector.controller);
  }
  assert.equal(all.size, 16);
});
