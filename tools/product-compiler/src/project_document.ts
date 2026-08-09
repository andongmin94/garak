import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";

import { sha256Hex } from "./compiled_product.ts";
import { ProductCompilerError, fail } from "./errors.ts";
import { deriveProductIdentity } from "./identity.ts";
import {
  PRODUCT_CATEGORY,
  PRODUCT_JSON_FILENAME,
  PRODUCT_SCHEMA_VERSION,
  PRODUCT_TEMPLATE,
  inspectionFor,
  isJsonObject,
} from "./project_model.ts";
import type {
  ProductDefaults,
  ProductInspection,
  ProductProject,
} from "./project_model.ts";
import { ownedCleanupDiagnostic } from "./owned_cleanup.ts";
import type { OwnedCleanupDiagnostic } from "./owned_cleanup.ts";
import {
  loadProductProjectSource,
  validateProjectValue,
} from "./validation.ts";

export interface ProductProjectDraft {
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly gainDb: number;
}

export interface ProductProjectDocument {
  readonly schemaVersion: typeof PRODUCT_SCHEMA_VERSION;
  readonly productId: string;
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly category: typeof PRODUCT_CATEGORY;
  readonly template: typeof PRODUCT_TEMPLATE;
  readonly defaults: ProductDefaults;
}

export interface ProductProjectSnapshot {
  readonly sourceDirectory: string;
  readonly revision: string;
  readonly document: ProductProjectDocument;
  readonly inspection: ProductInspection;
}

export interface ProjectMutationResult extends ProductProjectSnapshot {
  readonly cleanupDiagnostics: readonly OwnedCleanupDiagnostic[];
}

export interface ProjectTransactionFileSystem {
  readonly rename: (source: string, destination: string) => Promise<void>;
  readonly remove: (target: string) => Promise<void>;
}

interface ProjectMutationHooks {
  readonly createTransactionId?: () => string;
  readonly transactionFileSystem?: ProjectTransactionFileSystem;
}

export interface CreateProductProjectOptions extends ProjectMutationHooks {
  readonly projectDirectory: string;
  readonly productId: unknown;
  readonly draft: unknown;
}

export interface SaveProductProjectOptions extends ProjectMutationHooks {
  readonly projectDirectory: string;
  readonly expectedRevision: string;
  readonly productId: unknown;
  readonly draft: unknown;
}

const DRAFT_KEYS = Object.freeze(["vendor", "name", "version", "gainDb"]);
const REVISION = /^[0-9a-f]{64}$/u;
const TRANSACTION_ID = /^[0-9A-Za-z-]+$/u;
const DEFAULT_TRANSACTION_FILE_SYSTEM: ProjectTransactionFileSystem = {
  rename: async (source, destination) => {
    await rename(source, destination);
  },
  remove: async (target) => {
    await rm(target, { recursive: true, force: true });
  },
};

function projectFailure(code: string, field: string, message: string): never {
  fail(
    code,
    field.length === 0
      ? PRODUCT_JSON_FILENAME
      : `${PRODUCT_JSON_FILENAME}.${field}`,
    message,
  );
}

function assertExactDraft(
  value: unknown,
): asserts value is ProductProjectDraft {
  if (!isJsonObject(value)) {
    projectFailure(
      "GARAK_PROJECT_WRONG_TYPE",
      "",
      "Product draft must be an object.",
    );
  }
  const expected = new Set(DRAFT_KEYS);
  const unknown = Object.keys(value)
    .filter((key) => !expected.has(key))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (unknown[0] !== undefined) {
    projectFailure(
      "GARAK_PROJECT_UNKNOWN_FIELD",
      unknown[0],
      `Unknown draft field '${unknown[0]}' is not allowed by product schema v1.`,
    );
  }
  for (const key of DRAFT_KEYS) {
    if (!Object.hasOwn(value, key)) {
      projectFailure(
        "GARAK_PROJECT_MISSING_FIELD",
        key,
        `Required draft field '${key}' is missing.`,
      );
    }
  }
}

export function documentForProject(
  project: ProductProject,
): ProductProjectDocument {
  return {
    schemaVersion: PRODUCT_SCHEMA_VERSION,
    productId: project.productId,
    vendor: project.vendor,
    name: project.name,
    version: project.version,
    category: PRODUCT_CATEGORY,
    template: PRODUCT_TEMPLATE,
    defaults: { gainDb: project.defaults.gainDb },
  };
}

export function validateProductProjectDocument(
  value: unknown,
  sourceDirectory = "document.garak",
): ProductProjectDocument {
  return documentForProject(validateProjectValue(value, sourceDirectory));
}

function projectForDraft(
  productId: unknown,
  draft: unknown,
  sourceDirectory: string,
): ProductProject {
  assertExactDraft(draft);
  return validateProjectValue(
    {
      schemaVersion: PRODUCT_SCHEMA_VERSION,
      productId,
      vendor: draft.vendor,
      name: draft.name,
      version: draft.version,
      category: PRODUCT_CATEGORY,
      template: PRODUCT_TEMPLATE,
      defaults: { gainDb: draft.gainDb },
    },
    sourceDirectory,
  );
}

export function validateProductProjectDraft(
  productId: unknown,
  draft: unknown,
  sourceDirectory = "draft.garak",
): ProductProjectDocument {
  return documentForProject(projectForDraft(productId, draft, sourceDirectory));
}

export function inspectProductProjectDraft(
  productId: unknown,
  draft: unknown,
  sourceDirectory = "draft.garak",
): ProductInspection {
  const project = projectForDraft(productId, draft, sourceDirectory);
  return inspectionFor(project, deriveProductIdentity(project.productId));
}

export function serializeProductProjectDocument(
  value: unknown,
  sourceDirectory = "document.garak",
): string {
  const document = validateProductProjectDocument(value, sourceDirectory);
  return `${JSON.stringify(document, undefined, 2)}\n`;
}

function snapshotForProject(
  project: ProductProject,
  sourceBytes: Uint8Array,
): ProductProjectSnapshot {
  return {
    sourceDirectory: project.sourceDirectory,
    revision: sha256Hex(sourceBytes).toLowerCase(),
    document: documentForProject(project),
    inspection: inspectionFor(
      project,
      deriveProductIdentity(project.productId),
    ),
  };
}

export async function openProductProject(
  projectDirectory: string,
): Promise<ProductProjectSnapshot> {
  const loaded = await loadProductProjectSource(projectDirectory);
  return snapshotForProject(loaded.project, loaded.sourceBytes);
}

function assertProjectLeaf(projectDirectory: string): void {
  const leaf = path.basename(projectDirectory);
  if (leaf.length <= ".garak".length || !leaf.endsWith(".garak")) {
    fail(
      "GARAK_PROJECT_PACKAGE_SUFFIX",
      "project",
      "Project directory name must end with the exact lowercase '.garak' suffix.",
    );
  }
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function assertPhysicalDirectory(
  value: string,
  diagnosticPath: string,
): Promise<void> {
  let item: Awaited<ReturnType<typeof lstat>>;
  try {
    item = await lstat(value);
  } catch {
    fail(
      "GARAK_PROJECT_PARENT_MISSING",
      diagnosticPath,
      `Project parent directory does not exist: ${value}`,
    );
  }
  if (!item.isDirectory() || item.isSymbolicLink()) {
    fail(
      "GARAK_PROJECT_PARENT_INVALID",
      diagnosticPath,
      `Project parent must be a physical directory: ${value}`,
    );
  }
}

async function assertNoExistingSymlinkInChain(value: string): Promise<void> {
  const absolute = path.resolve(value);
  const parsed = path.parse(absolute);
  const segments = absolute
    .slice(parsed.root.length)
    .split(path.sep)
    .filter((segment) => segment.length > 0);
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const item = await lstat(current);
    if (item.isSymbolicLink()) {
      fail(
        "GARAK_PROJECT_REPARSE_PATH",
        "project",
        `Project path must not traverse a symbolic link or junction: ${current}`,
      );
    }
  }
}

function boundedFailureDetail(error: unknown): string {
  if (error instanceof ProductCompilerError) {
    return `${error.diagnostic.code}: ${error.diagnostic.message}`.slice(
      0,
      512,
    );
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message.slice(0, 512);
  }
  return "Unknown filesystem failure.";
}

function transactionPath(
  parentDirectory: string,
  leaf: string,
  transactionId: string,
): string {
  if (!TRANSACTION_ID.test(transactionId)) {
    fail(
      "GARAK_PROJECT_TRANSACTION_ID",
      "project.transaction",
      "Project transaction ID contains unsafe characters.",
    );
  }
  return path.join(parentDirectory, `${leaf}${transactionId}`);
}

interface MutationInput extends ProjectMutationHooks {
  readonly mode: "create" | "save";
  readonly projectDirectory: string;
  readonly expectedRevision: string | undefined;
  readonly productId: unknown;
  readonly draft: unknown;
}

async function mutateProductProject(
  options: MutationInput,
): Promise<ProjectMutationResult> {
  const projectDirectory = path.resolve(options.projectDirectory);
  assertProjectLeaf(projectDirectory);
  const parentDirectory = path.dirname(projectDirectory);
  await assertNoExistingSymlinkInChain(parentDirectory);
  await assertPhysicalDirectory(parentDirectory, "project.parent");

  const finalExists = await pathExists(projectDirectory);
  if (options.mode === "create" && finalExists) {
    fail(
      "GARAK_PROJECT_OUTPUT_EXISTS",
      "project",
      `Project directory already exists: ${projectDirectory}`,
    );
  }
  if (options.mode === "save" && !finalExists) {
    fail(
      "GARAK_PROJECT_NOT_FOUND",
      "project",
      `Project directory does not exist: ${projectDirectory}`,
    );
  }

  let priorProject: ProductProject | undefined;
  if (options.mode === "save") {
    if (
      options.expectedRevision === undefined ||
      !REVISION.test(options.expectedRevision)
    ) {
      fail(
        "GARAK_PROJECT_REVISION_FORMAT",
        "project.revision",
        "Expected project revision must be a lowercase SHA-256 value.",
      );
    }
    const current = await loadProductProjectSource(projectDirectory);
    const currentRevision = sha256Hex(current.sourceBytes).toLowerCase();
    if (currentRevision !== options.expectedRevision) {
      fail(
        "GARAK_PROJECT_REVISION_CONFLICT",
        "project.revision",
        `Project changed on disk; expected revision ${options.expectedRevision}, current revision ${currentRevision}.`,
      );
    }
    priorProject = current.project;
  }

  const project = projectForDraft(
    options.productId,
    options.draft,
    projectDirectory,
  );
  if (
    priorProject !== undefined &&
    project.productId !== priorProject.productId
  ) {
    fail(
      "GARAK_PROJECT_ID_IMMUTABLE",
      `${PRODUCT_JSON_FILENAME}.productId`,
      `Product ID is immutable; existing '${priorProject.productId}' cannot be changed to '${project.productId}'.`,
    );
  }
  const document = documentForProject(project);
  const sourceBytes = Buffer.from(
    serializeProductProjectDocument(document, projectDirectory),
    "utf8",
  );
  const fileSystem =
    options.transactionFileSystem ?? DEFAULT_TRANSACTION_FILE_SYSTEM;
  const transactionId = (options.createTransactionId ?? randomUUID)();
  const stageParent = transactionPath(
    parentDirectory,
    ".garak-project-stage-",
    transactionId,
  );
  const stageProject = path.join(stageParent, path.basename(projectDirectory));
  const backupProject = transactionPath(
    parentDirectory,
    `${path.basename(projectDirectory)}.garak-backup-`,
    transactionId,
  );
  if ((await pathExists(stageParent)) || (await pathExists(backupProject))) {
    fail(
      "GARAK_PROJECT_TRANSACTION_COLLISION",
      "project.transaction",
      "Project staging or backup path already exists; refusing to overwrite an unowned path.",
    );
  }

  let stageParentCreated = false;
  let backupMoved = false;
  let publicationCommitted = false;
  let operationFailed = false;
  let operationFailure: unknown;
  const cleanupDiagnostics: OwnedCleanupDiagnostic[] = [];
  try {
    await mkdir(stageProject, { recursive: true });
    stageParentCreated = true;
    const stageFile = await open(
      path.join(stageProject, PRODUCT_JSON_FILENAME),
      "wx",
    );
    try {
      await stageFile.writeFile(sourceBytes);
    } finally {
      await stageFile.close();
    }
    const staged = await loadProductProjectSource(stageProject);
    if (!staged.sourceBytes.equals(sourceBytes)) {
      fail(
        "GARAK_PROJECT_STAGE_PARITY",
        "project.stage",
        "Staged project bytes changed after writing.",
      );
    }
    if (
      serializeProductProjectDocument(
        documentForProject(staged.project),
        stageProject,
      ) !== sourceBytes.toString("utf8")
    ) {
      fail(
        "GARAK_PROJECT_STAGE_PARITY",
        "project.stage",
        "Staged project logical model does not match the validated draft.",
      );
    }

    if (options.mode === "save") {
      try {
        await fileSystem.rename(projectDirectory, backupProject);
      } catch (error) {
        fail(
          "GARAK_PROJECT_PREPUBLISH_BACKUP",
          "project.publish.backup",
          `Failed to move the prior project to a transaction backup. The prior project remains at '${projectDirectory}'. ${boundedFailureDetail(error)}`,
        );
      }
      backupMoved = true;
    }
    try {
      await fileSystem.rename(stageProject, projectDirectory);
      publicationCommitted = true;
    } catch (publishError) {
      if (backupMoved) {
        try {
          await fileSystem.rename(backupProject, projectDirectory);
          backupMoved = false;
        } catch (rollbackError) {
          fail(
            "GARAK_PROJECT_PUBLISH_ROLLBACK",
            "project.publish.rollback",
            `Failed to publish project '${projectDirectory}', and rollback could not restore the prior project. The prior project remains at backup '${backupProject}'. Publish failure: ${boundedFailureDetail(publishError)} Rollback failure: ${boundedFailureDetail(rollbackError)}`,
          );
        }
      }
      fail(
        "GARAK_PROJECT_PUBLISH",
        "project.publish",
        `Failed to publish project '${projectDirectory}'. ${options.mode === "save" ? "The prior project was restored." : "No project was published."} ${boundedFailureDetail(publishError)}`,
      );
    }
  } catch (error) {
    operationFailed = true;
    operationFailure = error;
  }

  if (stageParentCreated && (await pathExists(stageParent))) {
    try {
      await fileSystem.remove(stageParent);
    } catch (error) {
      if (!publicationCommitted) {
        fail(
          "GARAK_PROJECT_PRE_COMMIT_CLEANUP",
          "project.cleanup.stage",
          `Project mutation failed before publication and staging cleanup also failed for '${stageParent}'. Cleanup failure: ${boundedFailureDetail(error)} Original failure: ${boundedFailureDetail(operationFailure)}`,
        );
      }
      cleanupDiagnostics.push(
        ownedCleanupDiagnostic(
          "GARAK_PROJECT_POST_COMMIT_STAGE_CLEANUP",
          "project.cleanup.stage",
          "project-stage",
          parentDirectory,
          stageParent,
          error,
        ),
      );
    }
  }
  if (operationFailed) {
    throw operationFailure;
  }
  if (!publicationCommitted) {
    fail(
      "GARAK_PROJECT_FINAL_MOVE",
      "project.finalize",
      "Project transaction did not install a complete final project.",
    );
  }

  if (backupMoved) {
    try {
      await fileSystem.remove(backupProject);
    } catch (error) {
      cleanupDiagnostics.push(
        ownedCleanupDiagnostic(
          "GARAK_PROJECT_POST_COMMIT_BACKUP_CLEANUP",
          "project.cleanup.backup",
          "project-backup",
          parentDirectory,
          backupProject,
          error,
        ),
      );
    }
  }
  return {
    ...snapshotForProject(project, sourceBytes),
    cleanupDiagnostics,
  };
}

export async function createProductProject(
  options: CreateProductProjectOptions,
): Promise<ProjectMutationResult> {
  return await mutateProductProject({
    ...options,
    mode: "create",
    expectedRevision: undefined,
  });
}

export async function saveProductProject(
  options: SaveProductProjectOptions,
): Promise<ProjectMutationResult> {
  return await mutateProductProject({ ...options, mode: "save" });
}
