import { fail } from "./errors.ts";
import { isJsonObject, PRODUCT_CATEGORY } from "./project_model.ts";
import type { ProductProject, ProductIdentity } from "./project_model.ts";
import { parseStrictJson } from "./strict_json.ts";

export interface ModuleInfoSummary {
  readonly name: string;
  readonly version: string;
  readonly vendor: string;
  readonly processorFuid: string;
  readonly controllerFuid: string;
  readonly category: typeof PRODUCT_CATEGORY;
}

function moduleInfoFailure(
  code: string,
  field: string,
  message: string,
): never {
  fail(
    code,
    field.length === 0 ? "moduleinfo.json" : `moduleinfo.json.${field}`,
    message,
  );
}

export function removeJsonTrailingCommas(text: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === undefined) {
      continue;
    }
    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (character !== ",") {
      output += character;
      continue;
    }

    let lookahead = index + 1;
    while (/\s/u.test(text[lookahead] ?? "")) {
      lookahead += 1;
    }
    const next = text[lookahead];
    if (next !== "}" && next !== "]") {
      output += character;
    }
  }
  return output;
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!isJsonObject(value)) {
    moduleInfoFailure(
      "GARAK_MODULEINFO_STRUCTURE",
      field,
      `${field || "root"} must be an object.`,
    );
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    moduleInfoFailure(
      "GARAK_MODULEINFO_STRUCTURE",
      field,
      `${field} must be a string.`,
    );
  }
  return value;
}

function requireArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    moduleInfoFailure(
      "GARAK_MODULEINFO_STRUCTURE",
      field,
      `${field} must be an array.`,
    );
  }
  return value;
}

function assertExact(value: string, expected: string, field: string): void {
  if (value !== expected) {
    moduleInfoFailure(
      "GARAK_MODULEINFO_PARITY",
      field,
      `${field} must be '${expected}'; received '${value}'.`,
    );
  }
}

export function parseAndValidateModuleInfo(
  text: string,
  project: ProductProject,
  identity: ProductIdentity,
): ModuleInfoSummary {
  const normalized = removeJsonTrailingCommas(text);
  const parsed = parseStrictJson(normalized, {
    sourcePath: "moduleinfo.json",
    syntaxCode: "GARAK_MODULEINFO_JSON_SYNTAX",
    duplicateCode: "GARAK_MODULEINFO_DUPLICATE_KEY",
  });
  const root = requireObject(parsed, "");
  assertExact(requireString(root.Name, "Name"), project.name, "Name");
  assertExact(
    requireString(root.Version, "Version"),
    project.version,
    "Version",
  );
  const factory = requireObject(root["Factory Info"], "Factory Info");
  assertExact(
    requireString(factory.Vendor, "Factory Info.Vendor"),
    project.vendor,
    "Factory Info.Vendor",
  );

  const classes = requireArray(root.Classes, "Classes");
  if (classes.length !== 2) {
    moduleInfoFailure(
      "GARAK_MODULEINFO_CLASS_COUNT",
      "Classes",
      `moduleinfo.json must contain exactly two classes; received ${classes.length}.`,
    );
  }
  const classObjects = classes.map((value, index) =>
    requireObject(value, `Classes[${index}]`),
  );
  const processor = classObjects.find(
    (value) => value.Category === "Audio Module Class",
  );
  const controller = classObjects.find(
    (value) => value.Category === "Component Controller Class",
  );
  if (processor === undefined || controller === undefined) {
    moduleInfoFailure(
      "GARAK_MODULEINFO_CLASS_CATEGORY",
      "Classes",
      "moduleinfo.json must contain one audio processor and one component controller class.",
    );
  }

  assertExact(
    requireString(processor.CID, "Classes.processor.CID"),
    identity.processorFuid,
    "Classes.processor.CID",
  );
  assertExact(
    requireString(processor.Name, "Classes.processor.Name"),
    project.name,
    "Classes.processor.Name",
  );
  assertExact(
    requireString(processor.Vendor, "Classes.processor.Vendor"),
    project.vendor,
    "Classes.processor.Vendor",
  );
  assertExact(
    requireString(processor.Version, "Classes.processor.Version"),
    project.version,
    "Classes.processor.Version",
  );
  const subCategories = requireArray(
    processor["Sub Categories"],
    "Classes.processor.Sub Categories",
  );
  if (subCategories.length !== 1 || subCategories[0] !== PRODUCT_CATEGORY) {
    moduleInfoFailure(
      "GARAK_MODULEINFO_PARITY",
      "Classes.processor.Sub Categories",
      `Processor subcategory must be exactly '${PRODUCT_CATEGORY}'.`,
    );
  }

  assertExact(
    requireString(controller.CID, "Classes.controller.CID"),
    identity.controllerFuid,
    "Classes.controller.CID",
  );
  assertExact(
    requireString(controller.Name, "Classes.controller.Name"),
    `${project.name} Controller`,
    "Classes.controller.Name",
  );
  assertExact(
    requireString(controller.Vendor, "Classes.controller.Vendor"),
    project.vendor,
    "Classes.controller.Vendor",
  );
  assertExact(
    requireString(controller.Version, "Classes.controller.Version"),
    project.version,
    "Classes.controller.Version",
  );

  return {
    name: project.name,
    version: project.version,
    vendor: project.vendor,
    processorFuid: identity.processorFuid,
    controllerFuid: identity.controllerFuid,
    category: PRODUCT_CATEGORY,
  };
}
