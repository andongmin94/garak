import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import { sha256Hex } from "./compiled_product.ts";
import { fail } from "./errors.ts";
import { deriveProductIdentity } from "./identity.ts";
import type {
  PRODUCT_SCHEMA_VERSION,
  ProjectMigrationStepId,
  ProjectSchemaStatus,
  ProductProject,
  ProductProjectSourceV1,
} from "./project_model.ts";
import {
  assertProjectMigrationInvariants,
  serializeCanonicalProductProject,
} from "./project_migration_core.ts";
import {
  createProductProject,
  openProductProject,
  replaceProductProjectForMigration,
  type ProjectMutationResult,
  type ProjectTransactionFileSystem,
} from "./project_document.ts";
import { loadProductProjectSource } from "./validation.ts";

export interface ProductMigrationIdentity {
  readonly productId: string;
  readonly processorFuid: string;
  readonly controllerFuid: string;
}

export interface ProductMigrationStatus {
  readonly detectedSchemaVersion: number;
  readonly currentSchemaVersion: typeof PRODUCT_SCHEMA_VERSION;
  readonly migrationRequired: boolean;
  readonly migrationPath: readonly ProjectMigrationStepId[];
  readonly identity: ProductMigrationIdentity;
  readonly sourceModified: false;
}

export interface ProductMigrationReport {
  readonly sourceSchemaVersion: number;
  readonly targetSchemaVersion: typeof PRODUCT_SCHEMA_VERSION;
  readonly steps: readonly ProjectMigrationStepId[];
  readonly sourceProductId: string;
  readonly targetProductId: string;
  readonly processorFuidBefore: string;
  readonly processorFuidAfter: string;
  readonly controllerFuidBefore: string;
  readonly controllerFuidAfter: string;
  readonly identityChanged: boolean;
  readonly productSemanticsChanged: boolean;
  readonly sourceModified: false;
  readonly outputWritten: boolean;
  readonly dryRun: boolean;
  readonly canonicalSha256: string;
  readonly outputProject: string | null;
  readonly cleanupDiagnostics: ProjectMutationResult["cleanupDiagnostics"];
}

export interface MigrateProductProjectOptions {
  readonly projectPath: string;
  readonly dryRun: boolean;
  readonly outputProject?: string;
  readonly force: boolean;
  readonly createTransactionId?: () => string;
  readonly transactionFileSystem?: ProjectTransactionFileSystem;
}

function migrationStatus(
  status: ProjectSchemaStatus,
  project: ProductProject,
): ProductMigrationStatus {
  const identity = deriveProductIdentity(project.productId);
  return {
    detectedSchemaVersion: status.sourceSchemaVersion,
    currentSchemaVersion: status.currentSchemaVersion,
    migrationRequired: status.migrationRequired,
    migrationPath: status.steps,
    identity: {
      productId: project.productId,
      processorFuid: identity.processorFuid,
      controllerFuid: identity.controllerFuid,
    },
    sourceModified: false,
  };
}

function reportFor(
  status: ProjectSchemaStatus,
  source: ProductProjectSourceV1 | ProductProject,
  project: ProductProject,
  options: {
    readonly dryRun: boolean;
    readonly outputWritten: boolean;
    readonly outputProject: string | null;
    readonly cleanupDiagnostics: ProjectMutationResult["cleanupDiagnostics"];
  },
): ProductMigrationReport {
  const invariants = assertProjectMigrationInvariants(source, project);
  const canonicalBytes = Buffer.from(
    serializeCanonicalProductProject(project),
    "utf8",
  );
  return {
    sourceSchemaVersion: status.sourceSchemaVersion,
    targetSchemaVersion: status.currentSchemaVersion,
    steps: status.steps,
    sourceProductId: source.productId,
    targetProductId: project.productId,
    processorFuidBefore: invariants.sourceIdentity.processorFuid,
    processorFuidAfter: invariants.targetIdentity.processorFuid,
    controllerFuidBefore: invariants.sourceIdentity.controllerFuid,
    controllerFuidAfter: invariants.targetIdentity.controllerFuid,
    identityChanged: invariants.identityChanged,
    productSemanticsChanged: invariants.productSemanticsChanged,
    sourceModified: false,
    outputWritten: options.outputWritten,
    dryRun: options.dryRun,
    canonicalSha256: sha256Hex(canonicalBytes),
    outputProject: options.outputProject,
    cleanupDiagnostics: options.cleanupDiagnostics,
  };
}

function canonicalDraft(project: ProductProject): {
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly gainDb: number;
} {
  return {
    vendor: project.vendor,
    name: project.name,
    version: project.version,
    gainDb: project.defaults.gainDb,
  };
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

function windowsPathKey(value: string): string {
  return path.normalize(path.resolve(value)).toUpperCase();
}

function isPathInside(candidate: string, boundary: string): boolean {
  const relative = path.relative(boundary, candidate);
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function assertDistinctOutput(
  source: string,
  output: string,
): Promise<void> {
  let sourceAbsolute: string;
  try {
    sourceAbsolute = await realpath(path.resolve(source));
  } catch {
    fail(
      "GARAK_MIGRATION_SOURCE_UNRESOLVABLE",
      "migration.project",
      "Migration source cannot be resolved to a physical project directory.",
    );
  }
  const outputResolved = path.resolve(output);
  let outputAbsolute: string;
  if (await pathExists(outputResolved)) {
    try {
      outputAbsolute = await realpath(outputResolved);
    } catch {
      fail(
        "GARAK_MIGRATION_OUTPUT_UNRESOLVABLE",
        "migration.output",
        "Migration output cannot be resolved to a physical project directory.",
      );
    }
  } else {
    try {
      outputAbsolute = path.join(
        await realpath(path.dirname(outputResolved)),
        path.basename(outputResolved),
      );
    } catch {
      fail(
        "GARAK_PROJECT_PARENT_MISSING",
        "migration.output",
        `Migration output parent directory does not exist: ${path.dirname(outputResolved)}`,
      );
    }
  }
  if (
    windowsPathKey(sourceAbsolute) === windowsPathKey(outputAbsolute) ||
    isPathInside(outputAbsolute, sourceAbsolute) ||
    isPathInside(sourceAbsolute, outputAbsolute)
  ) {
    fail(
      "GARAK_MIGRATION_OUTPUT_OVERLAP",
      "migration.output",
      "Migration output must be a distinct .garak directory that does not overlap the source project.",
    );
  }
}

function mutationHooks(options: MigrateProductProjectOptions): {
  readonly createTransactionId?: () => string;
  readonly transactionFileSystem?: ProjectTransactionFileSystem;
} {
  return {
    ...(options.createTransactionId === undefined
      ? {}
      : { createTransactionId: options.createTransactionId }),
    ...(options.transactionFileSystem === undefined
      ? {}
      : { transactionFileSystem: options.transactionFileSystem }),
  };
}

export async function inspectProjectMigration(
  projectPath: string,
): Promise<ProductMigrationStatus> {
  const loaded = await loadProductProjectSource(projectPath);
  return migrationStatus(loaded.schemaStatus, loaded.project);
}

export async function migrateProductProject(
  options: MigrateProductProjectOptions,
): Promise<ProductMigrationReport> {
  const loaded = await loadProductProjectSource(options.projectPath);
  if (options.dryRun) {
    if (options.outputProject !== undefined || options.force) {
      fail(
        "GARAK_MIGRATION_MODE",
        "migration",
        "Dry-run migration must not include an output project or --force.",
      );
    }
    return reportFor(
      loaded.schemaStatus,
      loaded.sourceProject,
      loaded.project,
      {
        dryRun: true,
        outputWritten: false,
        outputProject: null,
        cleanupDiagnostics: [],
      },
    );
  }

  if (options.outputProject === undefined) {
    fail(
      "GARAK_MIGRATION_OUTPUT_REQUIRED",
      "migration.output",
      "Explicit migration requires a distinct output .garak directory.",
    );
  }
  if (!loaded.schemaStatus.migrationRequired) {
    fail(
      "GARAK_MIGRATION_NOT_REQUIRED",
      "migration.project",
      "The project already uses the current schema; no migration output was created.",
    );
  }

  const preflightReport = reportFor(
    loaded.schemaStatus,
    loaded.sourceProject,
    loaded.project,
    {
      dryRun: false,
      outputWritten: false,
      outputProject: null,
      cleanupDiagnostics: [],
    },
  );

  const sourceProject = path.resolve(options.projectPath);
  const outputProject = path.resolve(options.outputProject);
  await assertDistinctOutput(sourceProject, outputProject);
  const exists = await pathExists(outputProject);
  if (exists && !options.force) {
    fail(
      "GARAK_MIGRATION_OUTPUT_EXISTS",
      "migration.output",
      `Migration output already exists; pass --force to replace the same product safely: ${outputProject}`,
    );
  }

  let mutation: ProjectMutationResult;
  if (exists) {
    const prior = await openProductProject(outputProject);
    if (prior.document.productId !== loaded.project.productId) {
      fail(
        "GARAK_MIGRATION_OUTPUT_PRODUCT_ID",
        "migration.output.productId",
        "Migration --force refuses to replace a project with a different Product ID.",
      );
    }
    mutation = await replaceProductProjectForMigration({
      projectDirectory: outputProject,
      expectedRevision: prior.revision,
      productId: loaded.project.productId,
      draft: canonicalDraft(loaded.project),
      ...mutationHooks(options),
    });
  } else {
    mutation = await createProductProject({
      projectDirectory: outputProject,
      productId: loaded.project.productId,
      draft: canonicalDraft(loaded.project),
      ...mutationHooks(options),
    });
  }

  return {
    ...preflightReport,
    outputWritten: true,
    outputProject,
    cleanupDiagnostics: mutation.cleanupDiagnostics,
  };
}
