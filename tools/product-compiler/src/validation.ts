import { lstat, readFile, readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { fail } from "./errors.ts";
import { deriveProductIdentity } from "./identity.ts";
import {
  PRODUCT_CATEGORY,
  PRODUCT_JSON_FILENAME,
  PRODUCT_JSON_MAXIMUM_BYTES,
  PRODUCT_MAXIMUM_GAIN_DB,
  PRODUCT_MINIMUM_GAIN_DB,
  PRODUCT_NAME_MAXIMUM_BYTES,
  PRODUCT_SCHEMA_VERSION,
  PRODUCT_TEMPLATE,
  PRODUCT_VENDOR_MAXIMUM_BYTES,
  containsControlCharacter,
  isJsonObject,
  isWellFormedUnicode,
  utf8ByteLength,
} from "./project_model.ts";
import type {
  ProductIdentity,
  ProductProject,
  ProductVersion,
} from "./project_model.ts";
import { parseStrictJson } from "./strict_json.ts";

const TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion",
  "productId",
  "vendor",
  "name",
  "version",
  "category",
  "template",
  "defaults",
]);
const DEFAULT_KEYS = Object.freeze(["gainDb"]);
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const WINDOWS_INVALID_FILENAME = /[<>:"/\\|?*]/u;
const WINDOWS_RESERVED_BASENAME =
  /^(?:CON|PRN|AUX|NUL|COM(?:[1-9]|[¹²³])|LPT(?:[1-9]|[¹²³])|CONIN\$|CONOUT\$|CLOCK\$)$/iu;
const SEMANTIC_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;

export interface BatchProductRecord {
  readonly project: ProductProject;
  readonly identity: ProductIdentity;
  readonly artifactPath?: string;
}

function projectFailure(code: string, field: string, message: string): never {
  fail(
    code,
    field.length === 0
      ? PRODUCT_JSON_FILENAME
      : `${PRODUCT_JSON_FILENAME}.${field}`,
    message,
  );
}

async function statOrProjectFailure(
  projectDirectory: string,
): Promise<Awaited<ReturnType<typeof lstat>>> {
  try {
    return await lstat(projectDirectory);
  } catch {
    fail(
      "GARAK_PROJECT_NOT_FOUND",
      "project",
      `Project directory does not exist: ${projectDirectory}`,
    );
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  field: string,
): void {
  const expectedSet = new Set(expected);
  const unknown = Object.keys(value)
    .filter((key) => !expectedSet.has(key))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (unknown[0] !== undefined) {
    const child = field.length === 0 ? unknown[0] : `${field}.${unknown[0]}`;
    projectFailure(
      "GARAK_PROJECT_UNKNOWN_FIELD",
      child,
      `Unknown field '${unknown[0]}' is not allowed by product schema v1.`,
    );
  }

  for (const key of expected) {
    if (!Object.hasOwn(value, key)) {
      const child = field.length === 0 ? key : `${field}.${key}`;
      projectFailure(
        "GARAK_PROJECT_MISSING_FIELD",
        child,
        `Required field '${key}' is missing.`,
      );
    }
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    projectFailure(
      "GARAK_PROJECT_WRONG_TYPE",
      field,
      `${field} must be a string.`,
    );
  }
  return value;
}

function validateDisplayString(
  value: string,
  field: "vendor" | "name",
  maximumBytes: number,
): void {
  if (value.trim().length === 0) {
    projectFailure(
      "GARAK_PROJECT_EMPTY_STRING",
      field,
      `${field} must not be empty or whitespace-only.`,
    );
  }
  if (!isWellFormedUnicode(value)) {
    projectFailure(
      "GARAK_PROJECT_INVALID_UNICODE",
      field,
      `${field} must not contain an unpaired Unicode surrogate.`,
    );
  }
  if (containsControlCharacter(value)) {
    projectFailure(
      "GARAK_PROJECT_CONTROL_CHARACTER",
      field,
      `${field} must not contain control characters or NUL.`,
    );
  }
  if (value.includes("\uFEFF")) {
    projectFailure(
      "GARAK_PROJECT_METADATA_BOM",
      field,
      `${field} must not contain the Unicode byte-order-mark character.`,
    );
  }
  const byteLength = utf8ByteLength(value);
  if (byteLength > maximumBytes) {
    projectFailure(
      "GARAK_PROJECT_STRING_TOO_LONG",
      field,
      `${field} must contain at most ${maximumBytes} UTF-8 bytes; received ${byteLength}.`,
    );
  }
}

export function assertValidWindowsProductName(name: string): void {
  if (WINDOWS_INVALID_FILENAME.test(name)) {
    projectFailure(
      "GARAK_PROJECT_INVALID_WINDOWS_NAME",
      "name",
      "name contains a character that is invalid in a Windows filename.",
    );
  }
  if (name.endsWith(".") || name.endsWith(" ")) {
    projectFailure(
      "GARAK_PROJECT_INVALID_WINDOWS_NAME",
      "name",
      "name must not end with a dot or space on Windows.",
    );
  }
  const baseName = name.split(".", 1)[0];
  if (baseName !== undefined && WINDOWS_RESERVED_BASENAME.test(baseName)) {
    projectFailure(
      "GARAK_PROJECT_RESERVED_WINDOWS_NAME",
      "name",
      `'${baseName}' is a reserved Windows device name.`,
    );
  }
}

function parseVersion(value: string): ProductVersion {
  const match = SEMANTIC_VERSION.exec(value);
  if (match === null) {
    projectFailure(
      "GARAK_PROJECT_INVALID_VERSION",
      "version",
      "version must use canonical major.minor.patch syntax without prerelease or build metadata.",
    );
  }
  const components = match.slice(1).map((component) => Number(component));
  const major = components[0];
  const minor = components[1];
  const patch = components[2];
  if (
    major === undefined ||
    minor === undefined ||
    patch === undefined ||
    components.some(
      (component) => !Number.isInteger(component) || component > 65_535,
    )
  ) {
    projectFailure(
      "GARAK_PROJECT_VERSION_RANGE",
      "version",
      "Every version component must be an integer from 0 through 65535.",
    );
  }
  return { major, minor, patch };
}

export function validateProjectValue(
  value: unknown,
  sourceDirectory: string,
): ProductProject {
  if (!isJsonObject(value)) {
    projectFailure(
      "GARAK_PROJECT_ROOT_TYPE",
      "",
      "product.json root must be a JSON object.",
    );
  }
  assertExactKeys(value, TOP_LEVEL_KEYS, "");

  if (
    typeof value.schemaVersion !== "number" ||
    !Number.isInteger(value.schemaVersion)
  ) {
    projectFailure(
      "GARAK_PROJECT_WRONG_TYPE",
      "schemaVersion",
      "schemaVersion must be an integer.",
    );
  }
  if (value.schemaVersion !== PRODUCT_SCHEMA_VERSION) {
    projectFailure(
      "GARAK_PROJECT_SCHEMA_VERSION",
      "schemaVersion",
      `schemaVersion must be exactly ${PRODUCT_SCHEMA_VERSION}.`,
    );
  }

  const productId = requireString(value.productId, "productId");
  if (!CANONICAL_UUID.test(productId)) {
    projectFailure(
      "GARAK_PROJECT_INVALID_PRODUCT_ID",
      "productId",
      "productId must be a canonical lowercase UUID.",
    );
  }
  if (productId === NIL_UUID) {
    projectFailure(
      "GARAK_PROJECT_NIL_PRODUCT_ID",
      "productId",
      "productId must not be the nil UUID.",
    );
  }

  const vendor = requireString(value.vendor, "vendor");
  const name = requireString(value.name, "name");
  validateDisplayString(vendor, "vendor", PRODUCT_VENDOR_MAXIMUM_BYTES);
  validateDisplayString(name, "name", PRODUCT_NAME_MAXIMUM_BYTES);
  assertValidWindowsProductName(name);

  const version = requireString(value.version, "version");
  const versionParts = parseVersion(version);

  if (value.category !== PRODUCT_CATEGORY) {
    projectFailure(
      "GARAK_PROJECT_INVALID_CATEGORY",
      "category",
      `category must be exactly '${PRODUCT_CATEGORY}'.`,
    );
  }
  if (value.template !== PRODUCT_TEMPLATE) {
    projectFailure(
      "GARAK_PROJECT_INVALID_TEMPLATE",
      "template",
      `template must be exactly '${PRODUCT_TEMPLATE}'.`,
    );
  }

  if (!isJsonObject(value.defaults)) {
    projectFailure(
      "GARAK_PROJECT_WRONG_TYPE",
      "defaults",
      "defaults must be a JSON object.",
    );
  }
  assertExactKeys(value.defaults, DEFAULT_KEYS, "defaults");
  const gainDb = value.defaults.gainDb;
  if (typeof gainDb !== "number") {
    projectFailure(
      "GARAK_PROJECT_WRONG_TYPE",
      "defaults.gainDb",
      "defaults.gainDb must be a number.",
    );
  }
  if (!Number.isFinite(gainDb)) {
    projectFailure(
      "GARAK_PROJECT_NONFINITE_GAIN",
      "defaults.gainDb",
      "defaults.gainDb must be finite.",
    );
  }
  if (gainDb < PRODUCT_MINIMUM_GAIN_DB || gainDb > PRODUCT_MAXIMUM_GAIN_DB) {
    projectFailure(
      "GARAK_PROJECT_GAIN_RANGE",
      "defaults.gainDb",
      `defaults.gainDb must be between ${PRODUCT_MINIMUM_GAIN_DB} and ${PRODUCT_MAXIMUM_GAIN_DB}.`,
    );
  }

  return {
    schemaVersion: PRODUCT_SCHEMA_VERSION,
    productId,
    vendor,
    name,
    version,
    versionParts,
    category: PRODUCT_CATEGORY,
    template: PRODUCT_TEMPLATE,
    defaults: { gainDb: Object.is(gainDb, -0) ? 0 : gainDb },
    sourceDirectory,
  };
}

export interface LoadedProductProject {
  readonly project: ProductProject;
  readonly sourceBytes: Buffer;
}

export async function loadProductProjectSource(
  projectPath: string,
): Promise<LoadedProductProject> {
  const projectDirectory = path.resolve(projectPath);
  const projectLeaf = path.basename(projectDirectory);
  if (
    projectLeaf.length <= ".garak".length ||
    !projectLeaf.endsWith(".garak")
  ) {
    fail(
      "GARAK_PROJECT_PACKAGE_SUFFIX",
      "project",
      "Project directory name must end with the exact lowercase '.garak' suffix.",
    );
  }
  const directoryStat = await statOrProjectFailure(projectDirectory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    fail(
      "GARAK_PROJECT_NOT_DIRECTORY",
      "project",
      `Project path must be a physical directory, not a file or link: ${projectDirectory}`,
    );
  }

  let physicalProjectLeaf: string | undefined;
  try {
    const parentEntries = await readdir(path.dirname(projectDirectory), {
      withFileTypes: true,
    });
    physicalProjectLeaf = parentEntries.find(
      (entry) => entry.name.toLowerCase() === projectLeaf.toLowerCase(),
    )?.name;
  } catch {
    fail(
      "GARAK_PROJECT_UNREADABLE",
      "project",
      `Project parent directory cannot be read: ${path.dirname(projectDirectory)}`,
    );
  }
  if (
    physicalProjectLeaf === undefined ||
    physicalProjectLeaf.length <= ".garak".length ||
    !physicalProjectLeaf.endsWith(".garak")
  ) {
    fail(
      "GARAK_PROJECT_PACKAGE_SUFFIX",
      "project",
      "Physical project directory name must end with the exact lowercase '.garak' suffix.",
    );
  }

  let entries: Dirent<string>[];
  try {
    entries = await readdir(projectDirectory, { withFileTypes: true });
  } catch {
    fail(
      "GARAK_PROJECT_UNREADABLE",
      "project",
      `Project directory cannot be read: ${projectDirectory}`,
    );
  }

  if (
    entries.length !== 1 ||
    entries[0]?.name !== PRODUCT_JSON_FILENAME ||
    !entries[0].isFile() ||
    entries[0].isSymbolicLink()
  ) {
    fail(
      "GARAK_PROJECT_INVALID_INVENTORY",
      "project",
      `Project directory must contain exactly one physical file named '${PRODUCT_JSON_FILENAME}'.`,
    );
  }

  const productJsonPath = path.join(projectDirectory, PRODUCT_JSON_FILENAME);
  const fileStat = await lstat(productJsonPath);
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    fail(
      "GARAK_PROJECT_INVALID_INVENTORY",
      PRODUCT_JSON_FILENAME,
      `${PRODUCT_JSON_FILENAME} must be a physical file.`,
    );
  }
  if (fileStat.size <= 0 || fileStat.size > PRODUCT_JSON_MAXIMUM_BYTES) {
    fail(
      "GARAK_PROJECT_FILE_SIZE",
      PRODUCT_JSON_FILENAME,
      `${PRODUCT_JSON_FILENAME} must contain 1..${PRODUCT_JSON_MAXIMUM_BYTES} bytes.`,
    );
  }

  const bytes = await readFile(productJsonPath);
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    fail(
      "GARAK_PROJECT_UTF8_BOM",
      PRODUCT_JSON_FILENAME,
      `${PRODUCT_JSON_FILENAME} must use UTF-8 without a byte-order mark.`,
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(
      "GARAK_PROJECT_INVALID_UTF8",
      PRODUCT_JSON_FILENAME,
      `${PRODUCT_JSON_FILENAME} is not valid UTF-8.`,
    );
  }
  return {
    project: validateProjectValue(parseStrictJson(text), projectDirectory),
    sourceBytes: bytes,
  };
}

export async function loadProductProject(
  projectPath: string,
): Promise<ProductProject> {
  return (await loadProductProjectSource(projectPath)).project;
}

export function batchRecord(
  project: ProductProject,
  artifactPath?: string,
): BatchProductRecord {
  const identity = deriveProductIdentity(project.productId);
  return artifactPath === undefined
    ? { project, identity }
    : { project, identity, artifactPath: path.resolve(artifactPath) };
}

export function assertNoBatchCollisions(
  records: readonly BatchProductRecord[],
): void {
  const productIds = new Map<string, string>();
  const fuids = new Map<string, string>();
  const artifactLeaves = new Map<string, string>();
  const outputPaths = new Map<string, string>();

  for (const record of records) {
    const label = record.project.sourceDirectory;
    const previousProduct = productIds.get(record.project.productId);
    if (previousProduct !== undefined) {
      fail(
        "GARAK_BATCH_DUPLICATE_PRODUCT_ID",
        "batch.productId",
        `Projects '${previousProduct}' and '${label}' use the same productId.`,
      );
    }
    productIds.set(record.project.productId, label);

    for (const [role, fuid] of [
      ["processor", record.identity.processorFuid],
      ["controller", record.identity.controllerFuid],
    ] as const) {
      const previousFuid = fuids.get(fuid);
      if (previousFuid !== undefined) {
        fail(
          "GARAK_BATCH_FUID_COLLISION",
          `batch.${role}Fuid`,
          `FUID ${fuid} collides between '${previousFuid}' and '${label}:${role}'.`,
        );
      }
      fuids.set(fuid, `${label}:${role}`);
    }

    const artifactLeaf = `${record.project.name}.vst3`;
    const artifactKey = artifactLeaf.toUpperCase();
    const previousArtifact = artifactLeaves.get(artifactKey);
    if (previousArtifact !== undefined) {
      fail(
        "GARAK_BATCH_ARTIFACT_COLLISION",
        "batch.name",
        `Case-insensitive artifact collision between '${previousArtifact}' and '${artifactLeaf}'.`,
      );
    }
    artifactLeaves.set(artifactKey, artifactLeaf);

    if (record.artifactPath !== undefined) {
      const outputKey = path.normalize(record.artifactPath).toUpperCase();
      const previousOutput = outputPaths.get(outputKey);
      if (previousOutput !== undefined) {
        fail(
          "GARAK_BATCH_OUTPUT_COLLISION",
          "batch.output",
          `Normalized output path collision between '${previousOutput}' and '${record.artifactPath}'.`,
        );
      }
      outputPaths.set(outputKey, record.artifactPath);
    }
  }
}
