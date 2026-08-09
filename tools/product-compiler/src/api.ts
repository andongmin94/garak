import { compileProductFile, exportWindowsProduct } from "./export_windows.ts";
import type {
  CompileFileResult,
  ExportWindowsResult,
  ProductConfiguration,
  ProductRuntimeArtifacts,
  TransactionFileSystem,
} from "./export_windows.ts";
import { fail } from "./errors.ts";
import { deriveProductIdentity, PHASE_1A_1B_FUIDS } from "./identity.ts";
import { inspectionFor } from "./project_model.ts";
import type { ProductInspection } from "./project_model.ts";
import type { ProcessRunner } from "./process_runner.ts";
import {
  assertNoBatchCollisions,
  batchRecord,
  loadProductProject,
} from "./validation.ts";

export { ProductCompilerError, diagnosticFor } from "./errors.ts";
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
  createProductProject,
  documentForProject,
  inspectProductProjectDraft,
  openProductProject,
  saveProductProject,
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
export type { ProductInspection } from "./project_model.ts";

export interface ValidatedProductRecord {
  readonly project: string;
  readonly productId: string;
  readonly name: string;
  readonly processorFuid: string;
  readonly controllerFuid: string;
}

export interface ValidateProductProjectsResult {
  readonly valid: true;
  readonly products: readonly ValidatedProductRecord[];
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
  const projects = [];
  for (const projectPath of projectPaths) {
    projects.push(await loadProductProject(projectPath));
  }
  const records = projects.map((project) => batchRecord(project));
  assertNoBatchCollisions(records);
  for (const record of records) {
    const reservedCollision = [
      record.identity.processorFuid,
      record.identity.controllerFuid,
    ].find((fuid) => PHASE_1A_1B_FUIDS.includes(fuid));
    if (reservedCollision !== undefined) {
      fail(
        "GARAK_IDENTITY_SPIKE_COLLISION",
        "product.json.productId",
        `Derived FUID collides with a Phase 1A/1B fixture: ${reservedCollision}`,
      );
    }
  }
  return {
    valid: true,
    products: records.map((record) => ({
      project: record.project.sourceDirectory,
      productId: record.project.productId,
      name: record.project.name,
      processorFuid: record.identity.processorFuid,
      controllerFuid: record.identity.controllerFuid,
    })),
  };
}

export async function inspectProductProject(
  projectPath: string,
): Promise<ProductInspection> {
  const project = await loadProductProject(projectPath);
  return inspectionFor(project, deriveProductIdentity(project.productId));
}

export async function compileProductProject(
  options: CompileProductProjectOptions,
): Promise<CompileFileResult> {
  const project = await loadProductProject(options.projectPath);
  return await compileProductFile({
    project,
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
  const project = await loadProductProject(options.projectPath);
  return await exportWindowsProduct({
    project,
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
