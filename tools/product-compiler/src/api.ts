import { compileProductFile, exportWindowsProduct } from "./export_windows.ts";
import type {
  CompileFileResult,
  ExportWindowsResult,
  ProductConfiguration,
  ProductRuntimeArtifacts,
  TransactionFileSystem,
} from "./export_windows.ts";
import { fail } from "./errors.ts";
import { deriveProductIdentity } from "./identity.ts";
import { inspectionFor } from "./project_model.ts";
import type {
  ProductInspection,
  ProjectMigrationStepId,
  ProjectSchemaStatus,
} from "./project_model.ts";
export {
  inspectProjectMigration,
  migrateProductProject,
} from "./project_migration.ts";
export type {
  MigrateProductProjectOptions,
  ProductMigrationIdentity,
  ProductMigrationReport,
  ProductMigrationStatus,
} from "./project_migration.ts";
import type { ProcessRunner } from "./process_runner.ts";
import {
  assertNoBatchCollisions,
  batchRecord,
  loadProductProjectSource,
} from "./validation.ts";
import type { LoadedProductProject } from "./validation.ts";

export { ProductCompilerError, diagnosticFor } from "./errors.ts";
export {
  canonicalProductGraphSource,
  cloneProductGraphSource,
  validateProductGraphSource,
} from "./graph_source.ts";
export type {
  ProductGraphConnection,
  ProductGraphEndpoint,
  ProductGraphNode,
  ProductGraphNodeType,
  ProductGraphSource,
} from "./graph_source.ts";
export type { Diagnostic } from "./errors.ts";
export type {
  ChildProcessLog,
  CompileFileResult,
  ExportWindowsResult,
  ProductConfiguration,
} from "./export_windows.ts";
export {
  OWNED_CLEANUP_CONTRACT_VERSION,
  retryOwnedCleanup,
} from "./owned_cleanup.ts";
export type {
  OwnedCleanupDiagnostic,
  OwnedCleanupKind,
  OwnedCleanupOrphan,
  OwnedCleanupResult,
} from "./owned_cleanup.ts";
export {
  documentForProject,
  inspectProductProjectDraft,
  serializeProductProjectDocument,
  validateProductProjectDocument,
  validateProductProjectDraft,
} from "./project_document.ts";
export type {
  CreateProductProjectOptions,
  ProductProjectDocument,
  ProductProjectDraft,
  ProductProjectSnapshot,
  ProjectMutationResult,
  SaveProductProjectOptions,
} from "./project_document.ts";
export {
  createDurableProductProject as createProductProject,
  fingerprintProjectTree,
  migrateProductProjectInPlace,
  openDurableProductProject as openProductProject,
  recoverProductPersistence,
  saveDurableProductProject as saveProductProject,
} from "./project_persistence.ts";
export type {
  DurableCreateProductProjectOptions,
  DurableProjectMutationResult,
  DurableSaveProductProjectOptions,
  MigrateProductProjectInPlaceOptions,
  PersistenceFaultPoint,
  PersistenceOperation,
  ProjectBackupSummary,
  ProjectRecoveryResult,
} from "./project_persistence.ts";
export type { ProductInspection } from "./project_model.ts";
export type { ProjectSchemaDetection } from "./project_model.ts";
export { detectProjectSchemaVersion } from "./validation.ts";

export interface ValidatedProductRecord {
  readonly project: string;
  readonly productId: string;
  readonly name: string;
  readonly processorFuid: string;
  readonly controllerFuid: string;
  readonly sourceSchemaVersion: number;
  readonly currentSchemaVersion: number;
  readonly migrationRequired: boolean;
  readonly migrationPath: readonly ProjectMigrationStepId[];
}

export interface ValidateProductProjectsResult {
  readonly valid: true;
  readonly products: readonly ValidatedProductRecord[];
}

export interface InspectedProductProject extends ProductInspection {
  readonly schemaStatus: ProjectSchemaStatus;
}

export interface CompileProductProjectOptions {
  readonly projectPath: string;
  readonly outputFile: string;
  readonly force: boolean;
  readonly createTransactionId?: () => string;
  readonly transactionFileSystem?: TransactionFileSystem;
}

export interface ExportProductProjectOptions {
  readonly projectPath: string;
  readonly configuration: ProductConfiguration;
  readonly outputDirectory: string;
  readonly repositoryRoot: string;
  readonly force: boolean;
  readonly validate: boolean;
  readonly artifacts?: ProductRuntimeArtifacts;
  readonly processRunner?: ProcessRunner;
  readonly createTransactionId?: () => string;
  readonly transactionFileSystem?: TransactionFileSystem;
}

export async function validateProductProjects(
  projectPaths: readonly string[],
): Promise<ValidateProductProjectsResult> {
  if (projectPaths.length === 0) {
    fail(
      "GARAK_VALIDATE_EMPTY_BATCH",
      "batch",
      "At least one product project is required.",
    );
  }
  const loadedProjects: LoadedProductProject[] = [];
  for (const projectPath of projectPaths) {
    loadedProjects.push(await loadProductProjectSource(projectPath));
  }
  const records = loadedProjects.map(({ project, sourceDirectory }) =>
    batchRecord(project, undefined, sourceDirectory),
  );
  assertNoBatchCollisions(records);
  return {
    valid: true,
    products: records.map((record, index) => ({
      project: record.sourceLabel ?? record.project.name,
      productId: record.project.productId,
      name: record.project.name,
      processorFuid: record.identity.processorFuid,
      controllerFuid: record.identity.controllerFuid,
      sourceSchemaVersion:
        loadedProjects[index]?.schemaStatus.sourceSchemaVersion ??
        record.project.schemaVersion,
      currentSchemaVersion:
        loadedProjects[index]?.schemaStatus.currentSchemaVersion ??
        record.project.schemaVersion,
      migrationRequired:
        loadedProjects[index]?.schemaStatus.migrationRequired ?? false,
      migrationPath: loadedProjects[index]?.schemaStatus.steps ?? [],
    })),
  };
}

export async function inspectProductProject(
  projectPath: string,
): Promise<InspectedProductProject> {
  const loaded = await loadProductProjectSource(projectPath);
  return {
    ...inspectionFor(
      loaded.project,
      deriveProductIdentity(loaded.project.productId),
    ),
    schemaStatus: loaded.schemaStatus,
  };
}

export async function compileProductProject(
  options: CompileProductProjectOptions,
): Promise<CompileFileResult> {
  const loaded = await loadProductProjectSource(options.projectPath);
  return await compileProductFile({
    project: loaded.project,
    sourceDirectory: loaded.physicalSourceDirectory,
    outputFile: options.outputFile,
    force: options.force,
    ...(options.createTransactionId === undefined
      ? {}
      : { createTransactionId: options.createTransactionId }),
    ...(options.transactionFileSystem === undefined
      ? {}
      : { transactionFileSystem: options.transactionFileSystem }),
  });
}

export async function exportProductProject(
  options: ExportProductProjectOptions,
): Promise<ExportWindowsResult> {
  const loaded = await loadProductProjectSource(options.projectPath);
  return await exportWindowsProduct({
    project: loaded.project,
    sourceDirectory: loaded.physicalSourceDirectory,
    configuration: options.configuration,
    outputDirectory: options.outputDirectory,
    repositoryRoot: options.repositoryRoot,
    force: options.force,
    validate: options.validate,
    ...(options.artifacts === undefined
      ? {}
      : { artifacts: options.artifacts }),
    ...(options.processRunner === undefined
      ? {}
      : { processRunner: options.processRunner }),
    ...(options.createTransactionId === undefined
      ? {}
      : { createTransactionId: options.createTransactionId }),
    ...(options.transactionFileSystem === undefined
      ? {}
      : { transactionFileSystem: options.transactionFileSystem }),
  });
}
