import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { fail } from "./errors.ts";
import {
  cloneProductGraphSource,
  validateProductGraphSource,
} from "./graph_source.ts";
import { deriveProductIdentity } from "./identity.ts";
import {
  LEGACY_PRODUCT_TEMPLATE,
  PRODUCT_CATEGORY,
  PRODUCT_JSON_FILENAME,
  PRODUCT_JSON_MAXIMUM_BYTES,
  PRODUCT_MAXIMUM_GAIN_DB,
  PRODUCT_MINIMUM_GAIN_DB,
  PRODUCT_NAME_MAXIMUM_BYTES,
  PRODUCT_SCHEMA_V1,
  PRODUCT_SCHEMA_V2,
  PRODUCT_SCHEMA_V3,
  PRODUCT_SCHEMA_VERSION,
  PRODUCT_TEMPLATE,
  PRODUCT_TEMPLATE_ID,
  PRODUCT_TEMPLATE_VERSION,
  PRODUCT_VENDOR_MAXIMUM_BYTES,
  containsControlCharacter,
  isJsonObject,
  isWellFormedUnicode,
  utf8ByteLength,
} from "./project_model.ts";
import type {
  ProductIdentity,
  ProductProject,
  ProductProjectSource,
  ProductProjectSourceV1,
  ProductProjectSourceV2,
  ProductVersion,
  ProjectSchemaDetection,
  ProjectSchemaStatus,
  SupportedProductSchemaVersion,
} from "./project_model.ts";
import { migrateValidatedProjectToCurrent } from "./project_migration_core.ts";
import { parseStrictJsonWithNumberTokens } from "./strict_json.ts";

const TOP_LEVEL_KEYS_V1_V2 = Object.freeze([
  "schemaVersion",
  "productId",
  "vendor",
  "name",
  "version",
  "category",
  "template",
  "defaults",
]);
const TOP_LEVEL_KEYS_V3 = Object.freeze([...TOP_LEVEL_KEYS_V1_V2, "graph"]);
const DEFAULT_KEYS = Object.freeze(["gainDb"]);
const TEMPLATE_KEYS = Object.freeze(["id", "version"]);
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
  readonly sourceLabel?: string;
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
  schemaVersion: number,
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
      `Unknown field '${unknown[0]}' is not allowed by product schema v${schemaVersion}.`,
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

export function detectProjectSchemaVersion(
  value: unknown,
): ProjectSchemaDetection {
  if (!isJsonObject(value)) {
    return { kind: "invalid", reason: "root-type" };
  }
  if (!Object.hasOwn(value, "schemaVersion")) {
    return { kind: "invalid", reason: "missing" };
  }
  const schemaVersion = value.schemaVersion;
  if (
    typeof schemaVersion !== "number" ||
    !Number.isSafeInteger(schemaVersion)
  ) {
    return { kind: "invalid", reason: "non-integer" };
  }
  if (schemaVersion < PRODUCT_SCHEMA_V1) {
    return {
      kind: "too-old",
      schemaVersion,
      minimumSupportedSchemaVersion: PRODUCT_SCHEMA_V1,
    };
  }
  if (schemaVersion > PRODUCT_SCHEMA_VERSION) {
    return {
      kind: "too-new",
      schemaVersion,
      currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
    };
  }
  if (schemaVersion === PRODUCT_SCHEMA_V1) {
    return {
      kind: "supported-legacy",
      schemaVersion: PRODUCT_SCHEMA_V1,
      currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
    };
  }
  if (schemaVersion === PRODUCT_SCHEMA_V2) {
    return {
      kind: "supported-legacy",
      schemaVersion: PRODUCT_SCHEMA_V2,
      currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
    };
  }
  if (schemaVersion === PRODUCT_SCHEMA_V3) {
    return {
      kind: "current",
      schemaVersion: PRODUCT_SCHEMA_V3,
      currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
    };
  }
  return { kind: "invalid", reason: "non-integer" };
}

function requireSupportedProjectSchemaVersion(
  value: unknown,
): SupportedProductSchemaVersion {
  const detection = detectProjectSchemaVersion(value);
  switch (detection.kind) {
    case "supported-legacy":
    case "current":
      return detection.schemaVersion;
    case "too-old":
      return projectFailure(
        "GARAK_PROJECT_VERSION_TOO_OLD",
        "schemaVersion",
        `schemaVersion ${detection.schemaVersion} is older than the minimum supported version ${detection.minimumSupportedSchemaVersion}.`,
      );
    case "too-new":
      return projectFailure(
        "GARAK_PROJECT_VERSION_TOO_NEW",
        "schemaVersion",
        `schemaVersion ${detection.schemaVersion} is newer than the current version ${detection.currentSchemaVersion}.`,
      );
    case "invalid":
      if (detection.reason === "root-type") {
        projectFailure(
          "GARAK_PROJECT_ROOT_TYPE",
          "",
          "product.json root must be a JSON object.",
        );
      }
      if (detection.reason === "missing") {
        projectFailure(
          "GARAK_PROJECT_VERSION_MISSING",
          "schemaVersion",
          "Required field 'schemaVersion' is missing.",
        );
      }
      return projectFailure(
        "GARAK_PROJECT_VERSION_INVALID",
        "schemaVersion",
        "schemaVersion must be a safe integer.",
      );
  }
}

interface ValidatedCommonFields {
  readonly productId: string;
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly versionParts: ProductVersion;
  readonly gainDb: number;
}

function validateCommonFields(
  value: Record<string, unknown>,
  schemaVersion: SupportedProductSchemaVersion,
  topLevelKeys: readonly string[],
): ValidatedCommonFields {
  assertExactKeys(value, topLevelKeys, "", schemaVersion);

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

  if (!isJsonObject(value.defaults)) {
    projectFailure(
      "GARAK_PROJECT_WRONG_TYPE",
      "defaults",
      "defaults must be a JSON object.",
    );
  }
  assertExactKeys(value.defaults, DEFAULT_KEYS, "defaults", schemaVersion);
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
    productId,
    vendor,
    name,
    version,
    versionParts,
    gainDb: Object.is(gainDb, -0) ? 0 : gainDb,
  };
}

function validateStructuredTemplate(
  value: unknown,
  schemaVersion: typeof PRODUCT_SCHEMA_V2 | typeof PRODUCT_SCHEMA_V3,
): void {
  if (!isJsonObject(value)) {
    projectFailure(
      "GARAK_PROJECT_WRONG_TYPE",
      "template",
      `schema v${schemaVersion} template must be a JSON object.`,
    );
  }
  assertExactKeys(value, TEMPLATE_KEYS, "template", schemaVersion);
  if (value.id !== PRODUCT_TEMPLATE_ID) {
    projectFailure(
      "GARAK_PROJECT_INVALID_TEMPLATE",
      "template.id",
      `template.id must be exactly '${PRODUCT_TEMPLATE_ID}'.`,
    );
  }
  if (value.version !== PRODUCT_TEMPLATE_VERSION) {
    projectFailure(
      "GARAK_PROJECT_INVALID_TEMPLATE",
      "template.version",
      `template.version must be exactly ${PRODUCT_TEMPLATE_VERSION}.`,
    );
  }
}

export function validateProjectSchemaV1(
  value: unknown,
  sourceDirectory: string,
): ProductProjectSourceV1 {
  void sourceDirectory;
  const detectedVersion = requireSupportedProjectSchemaVersion(value);
  if (detectedVersion !== PRODUCT_SCHEMA_V1) {
    projectFailure(
      "GARAK_PROJECT_SCHEMA_VERSION",
      "schemaVersion",
      `schemaVersion must be exactly ${PRODUCT_SCHEMA_V1} for a v1 source validator.`,
    );
  }
  if (!isJsonObject(value)) {
    throw new Error("Unreachable project root validation state.");
  }
  const common = validateCommonFields(
    value,
    PRODUCT_SCHEMA_V1,
    TOP_LEVEL_KEYS_V1_V2,
  );
  if (value.template !== LEGACY_PRODUCT_TEMPLATE) {
    projectFailure(
      "GARAK_PROJECT_INVALID_TEMPLATE",
      "template",
      `schema v1 template must be exactly '${LEGACY_PRODUCT_TEMPLATE}'.`,
    );
  }
  return {
    schemaVersion: PRODUCT_SCHEMA_V1,
    productId: common.productId,
    vendor: common.vendor,
    name: common.name,
    version: common.version,
    versionParts: common.versionParts,
    category: PRODUCT_CATEGORY,
    template: LEGACY_PRODUCT_TEMPLATE,
    defaults: { gainDb: common.gainDb },
  };
}

export function validateProjectSchemaV2(
  value: unknown,
  sourceDirectory: string,
): ProductProjectSourceV2 {
  void sourceDirectory;
  const detectedVersion = requireSupportedProjectSchemaVersion(value);
  if (detectedVersion !== PRODUCT_SCHEMA_V2) {
    projectFailure(
      "GARAK_PROJECT_SCHEMA_VERSION",
      "schemaVersion",
      `schemaVersion must be exactly ${PRODUCT_SCHEMA_V2} for a v2 source validator.`,
    );
  }
  if (!isJsonObject(value)) {
    throw new Error("Unreachable project root validation state.");
  }
  const common = validateCommonFields(
    value,
    PRODUCT_SCHEMA_V2,
    TOP_LEVEL_KEYS_V1_V2,
  );
  validateStructuredTemplate(value.template, PRODUCT_SCHEMA_V2);
  return {
    schemaVersion: PRODUCT_SCHEMA_V2,
    productId: common.productId,
    vendor: common.vendor,
    name: common.name,
    version: common.version,
    versionParts: common.versionParts,
    category: PRODUCT_CATEGORY,
    template: { ...PRODUCT_TEMPLATE },
    defaults: { gainDb: common.gainDb },
  };
}

export function validateProjectSchemaV3(
  value: unknown,
  sourceDirectory: string,
): ProductProject {
  void sourceDirectory;
  const detectedVersion = requireSupportedProjectSchemaVersion(value);
  if (detectedVersion !== PRODUCT_SCHEMA_V3) {
    projectFailure(
      "GARAK_PROJECT_SCHEMA_VERSION",
      "schemaVersion",
      `schemaVersion must be exactly ${PRODUCT_SCHEMA_V3} for a v3 source validator.`,
    );
  }
  if (!isJsonObject(value)) {
    throw new Error("Unreachable project root validation state.");
  }
  const common = validateCommonFields(
    value,
    PRODUCT_SCHEMA_V3,
    TOP_LEVEL_KEYS_V3,
  );
  validateStructuredTemplate(value.template, PRODUCT_SCHEMA_V3);
  return {
    schemaVersion: PRODUCT_SCHEMA_V3,
    productId: common.productId,
    vendor: common.vendor,
    name: common.name,
    version: common.version,
    versionParts: common.versionParts,
    category: PRODUCT_CATEGORY,
    template: { ...PRODUCT_TEMPLATE },
    defaults: { gainDb: common.gainDb },
    graph: validateProductGraphSource(value.graph),
  };
}

function sourceValueForCurrentProject(
  project: ProductProject,
): Record<string, unknown> {
  return {
    schemaVersion: PRODUCT_SCHEMA_V3,
    productId: project.productId,
    vendor: project.vendor,
    name: project.name,
    version: project.version,
    category: PRODUCT_CATEGORY,
    template: { ...project.template },
    defaults: { gainDb: project.defaults.gainDb },
    graph: cloneProductGraphSource(project.graph),
  };
}

export interface ValidatedProductProject {
  readonly sourceProject: ProductProjectSource;
  readonly project: ProductProject;
  readonly schemaStatus: ProjectSchemaStatus;
}

export function validateVersionedProjectValue(
  value: unknown,
  sourceDirectory: string,
): ValidatedProductProject {
  const schemaVersion = requireSupportedProjectSchemaVersion(value);
  let source: ProductProjectSource;
  if (schemaVersion === PRODUCT_SCHEMA_V1) {
    source = validateProjectSchemaV1(value, sourceDirectory);
  } else if (schemaVersion === PRODUCT_SCHEMA_V2) {
    source = validateProjectSchemaV2(value, sourceDirectory);
  } else {
    source = validateProjectSchemaV3(value, sourceDirectory);
  }
  const migrated = migrateValidatedProjectToCurrent(source);
  const project = validateProjectSchemaV3(
    sourceValueForCurrentProject(migrated.project),
    sourceDirectory,
  );
  return {
    sourceProject: source,
    project,
    schemaStatus: migrated.schemaStatus,
  };
}

export function validateProjectValue(
  value: unknown,
  sourceDirectory: string,
): ProductProject {
  return validateVersionedProjectValue(value, sourceDirectory).project;
}

export interface LoadedProductProject {
  readonly sourceDirectory: string;
  readonly physicalSourceDirectory: string;
  readonly sourceProject: ProductProjectSource;
  readonly project: ProductProject;
  readonly sourceBytes: Buffer;
  readonly schemaStatus: ProjectSchemaStatus;
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

  let physicalProjectDirectory: string;
  try {
    physicalProjectDirectory = await realpath(projectDirectory);
  } catch {
    fail(
      "GARAK_PROJECT_UNREADABLE",
      "project",
      `Project directory cannot be resolved physically: ${projectDirectory}`,
    );
  }
  const physicalLeaf = path.basename(physicalProjectDirectory);
  if (
    physicalLeaf.length <= ".garak".length ||
    !physicalLeaf.endsWith(".garak")
  ) {
    fail(
      "GARAK_PROJECT_PACKAGE_SUFFIX",
      "project",
      "Resolved physical project directory name must end with the exact lowercase '.garak' suffix.",
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
  const parsed = parseStrictJsonWithNumberTokens(text);
  const schemaVersionToken = parsed.numberTokens.get(
    `${PRODUCT_JSON_FILENAME}.schemaVersion`,
  );
  if (
    schemaVersionToken !== undefined &&
    !/^-?(?:0|[1-9][0-9]*)$/u.test(schemaVersionToken)
  ) {
    projectFailure(
      "GARAK_PROJECT_VERSION_INVALID",
      "schemaVersion",
      "schemaVersion must use an exact integer JSON token without a fraction or exponent.",
    );
  }
  const validated = validateVersionedProjectValue(
    parsed.value,
    projectDirectory,
  );
  return {
    sourceDirectory: projectDirectory,
    physicalSourceDirectory: physicalProjectDirectory,
    sourceProject: validated.sourceProject,
    project: validated.project,
    sourceBytes: bytes,
    schemaStatus: validated.schemaStatus,
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
  sourceLabel?: string,
): BatchProductRecord {
  const identity = deriveProductIdentity(project.productId);
  return {
    project,
    identity,
    ...(sourceLabel === undefined ? {} : { sourceLabel }),
    ...(artifactPath === undefined
      ? {}
      : { artifactPath: path.resolve(artifactPath) }),
  };
}

export function assertNoBatchCollisions(
  records: readonly BatchProductRecord[],
): void {
  const productIds = new Map<string, string>();
  const fuids = new Map<string, string>();
  const artifactLeaves = new Map<string, string>();
  const outputPaths = new Map<string, string>();

  for (const record of records) {
    const label = record.sourceLabel ?? record.project.name;
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
