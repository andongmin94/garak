import { randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  createProductProject,
  diagnosticFor,
  exportProductProject,
  inspectProductProjectDraft,
  openProductProject,
  retryOwnedCleanup,
  saveProductProject,
} from '../../tools/product-compiler/src/api.ts';
import type {
  OwnedCleanupDiagnostic,
  OwnedCleanupOrphan,
  ProductProjectDraft,
  ProductProjectSnapshot,
  ProjectMutationResult,
} from '../../tools/product-compiler/src/api.ts';
import {
  PRODUCT_CATEGORY,
  PRODUCT_SCHEMA_VERSION,
  PRODUCT_TEMPLATE,
} from '../src/shared/product_api.mts';
import type {
  CleanupProductArtifactRequest,
  ExportProductRequest,
  ProductCleanupWarning,
  ProductDiagnostic,
  ProductDocument,
  ProductDraft,
  ProductExportResult,
  ProductInspection,
  ProductOperationResult,
  ProductSchemaStatus,
  SaveProductRequest,
  ValidateProductRequest,
} from '../src/shared/product_api.mts';

const NEW_PRODUCT_DRAFT: ProductDraft = Object.freeze({
  vendor: 'Artist',
  name: 'New Garak Product',
  version: '0.1.0',
  gainDb: 0,
});
const CURRENT_SCHEMA_STATUS = Object.freeze({
  sourceSchemaVersion: PRODUCT_SCHEMA_VERSION,
  currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
  migrationRequired: false,
  steps: Object.freeze([]),
}) satisfies ProductSchemaStatus;
const CANCELLED = Symbol('cancelled');

interface DraftSession {
  readonly kind: 'draft';
  readonly documentId: string;
  readonly productId: string;
}

interface SavedSession {
  readonly kind: 'saved';
  readonly documentId: string;
  readonly productId: string;
  readonly projectDirectory: string;
  readonly sourceSchemaVersion: 1 | 2;
  revision: string;
}

type ProductSession = DraftSession | SavedSession;

export interface ProductDialogPort {
  readonly chooseProjectToOpen: () => Promise<string | null>;
  readonly chooseProjectToCreate: (suggestedName: string) => Promise<string | null>;
  readonly chooseExportDirectory: () => Promise<string | null>;
  readonly confirmExportReplacement: (diagnostic: ProductDiagnostic) => Promise<boolean>;
  readonly confirmOwnedCleanup: (diagnostic: ProductDiagnostic) => Promise<boolean>;
}

export interface ProductCompilerPort {
  readonly openProductProject: (projectDirectory: string) => Promise<ProductProjectSnapshot>;
  readonly inspectProductProjectDraft: (
    productId: unknown,
    draft: unknown,
    sourceDirectory?: string,
  ) => ProductInspection;
  readonly createProductProject: (options: {
    readonly projectDirectory: string;
    readonly productId: string;
    readonly draft: ProductProjectDraft;
  }) => Promise<ProjectMutationResult>;
  readonly saveProductProject: (options: {
    readonly projectDirectory: string;
    readonly expectedRevision: string;
    readonly productId: string;
    readonly draft: ProductProjectDraft;
  }) => Promise<ProjectMutationResult>;
  readonly exportProductProject: (options: {
    readonly projectPath: string;
    readonly configuration: ExportProductRequest['configuration'];
    readonly outputDirectory: string;
    readonly repositoryRoot: string;
    readonly force: boolean;
    readonly validate: boolean;
  }) => ReturnType<typeof exportProductProject>;
  readonly retryOwnedCleanup: (
    orphan: unknown,
  ) => Promise<{ readonly targetPath: string; readonly removed: boolean }>;
  readonly diagnosticFor: (error: unknown) => ProductDiagnostic;
}

const DEFAULT_COMPILER: ProductCompilerPort = {
  openProductProject,
  inspectProductProjectDraft,
  createProductProject,
  saveProductProject,
  exportProductProject,
  retryOwnedCleanup,
  diagnosticFor,
};

export interface ProductServiceOptions {
  readonly dialogs: ProductDialogPort;
  readonly repositoryRoot: string;
  readonly compiler?: ProductCompilerPort;
  readonly createCapabilityId?: () => string;
}

class StudioProductError extends Error {
  readonly diagnostic: ProductDiagnostic;

  constructor(code: string, diagnosticPath: string, message: string) {
    super(message);
    this.name = 'StudioProductError';
    this.diagnostic = { code, path: diagnosticPath, message };
  }
}

function studioFailure(code: string, diagnosticPath: string, message: string): never {
  throw new StudioProductError(code, diagnosticPath, message);
}

function diagnosticView(diagnostic: ProductDiagnostic): ProductDiagnostic {
  return {
    code: diagnostic.code,
    path: diagnostic.path,
    message: diagnostic.message,
  };
}

export class ProductService {
  readonly #dialogs: ProductDialogPort;
  readonly #repositoryRoot: string;
  readonly #compiler: ProductCompilerPort;
  readonly #createCapabilityId: () => string;
  readonly #sessions = new Map<string, ProductSession>();
  readonly #cleanupCapabilities = new Map<string, OwnedCleanupOrphan>();
  #operationInFlight = false;

  constructor(options: ProductServiceOptions) {
    this.#dialogs = options.dialogs;
    this.#repositoryRoot = options.repositoryRoot;
    this.#compiler = options.compiler ?? DEFAULT_COMPILER;
    this.#createCapabilityId = options.createCapabilityId ?? randomUUID;
  }

  clearCapabilities(): void {
    this.#sessions.clear();
    this.#cleanupCapabilities.clear();
  }

  async newProduct(): Promise<ProductOperationResult<ProductDocument>> {
    return this.#run(() => {
      const documentId = this.#nextCapabilityId(this.#sessions);
      const session: DraftSession = {
        kind: 'draft',
        documentId,
        productId: randomUUID(),
      };
      this.#sessions.set(documentId, session);
      return Promise.resolve(this.#documentForDraft(session, NEW_PRODUCT_DRAFT));
    });
  }

  async openProduct(): Promise<ProductOperationResult<ProductDocument>> {
    return this.#run(async () => {
      const projectDirectory = await this.#dialogs.chooseProjectToOpen();
      if (projectDirectory === null) {
        return CANCELLED;
      }
      const snapshot = await this.#compiler.openProductProject(projectDirectory);
      const documentId = this.#nextCapabilityId(this.#sessions);
      const session: SavedSession = {
        kind: 'saved',
        documentId,
        productId: snapshot.document.productId,
        projectDirectory: snapshot.sourceDirectory,
        sourceSchemaVersion: snapshot.schemaStatus.sourceSchemaVersion,
        revision: snapshot.revision,
      };
      this.#sessions.set(documentId, session);
      return this.#documentForSnapshot(session, snapshot, []);
    });
  }

  async validateProduct(
    request: ValidateProductRequest,
  ): Promise<ProductOperationResult<ProductInspection>> {
    return this.#run(() => {
      const session = this.#requireSession(request.documentId);
      const sourceDirectory = session.kind === 'saved' ? session.projectDirectory : undefined;
      return Promise.resolve(
        this.#compiler.inspectProductProjectDraft(
          session.productId,
          request.draft,
          sourceDirectory,
        ),
      );
    });
  }

  async saveProduct(request: SaveProductRequest): Promise<ProductOperationResult<ProductDocument>> {
    return this.#run(async () => {
      const session = this.#requireSession(request.documentId);
      if (session.kind === 'saved' && session.sourceSchemaVersion === 1) {
        studioFailure(
          'GARAK_PROJECT_MIGRATION_REQUIRED',
          'project.schemaVersion',
          'Legacy projects must be migrated to a distinct output before they can be saved. Phase 2A does not rewrite a source project in place.',
        );
      }
      this.#compiler.inspectProductProjectDraft(
        session.productId,
        request.draft,
        session.kind === 'saved' ? session.projectDirectory : undefined,
      );

      if (session.kind === 'draft') {
        const projectDirectory = await this.#dialogs.chooseProjectToCreate(request.draft.name);
        if (projectDirectory === null) {
          return CANCELLED;
        }
        const result = await this.#compiler.createProductProject({
          projectDirectory,
          productId: session.productId,
          draft: request.draft,
        });
        const savedSession: SavedSession = {
          kind: 'saved',
          documentId: session.documentId,
          productId: session.productId,
          projectDirectory: result.sourceDirectory,
          sourceSchemaVersion: 2,
          revision: result.revision,
        };
        this.#sessions.set(savedSession.documentId, savedSession);
        return this.#documentForSnapshot(savedSession, result, result.cleanupDiagnostics);
      }

      const result = await this.#compiler.saveProductProject({
        projectDirectory: session.projectDirectory,
        expectedRevision: session.revision,
        productId: session.productId,
        draft: request.draft,
      });
      session.revision = result.revision;
      return this.#documentForSnapshot(session, result, result.cleanupDiagnostics);
    });
  }

  async exportProduct(
    request: ExportProductRequest,
  ): Promise<ProductOperationResult<ProductExportResult>> {
    return this.#run(async () => {
      const session = this.#requireSession(request.documentId);
      if (session.kind !== 'saved') {
        studioFailure(
          'GARAK_STUDIO_EXPORT_UNSAVED',
          'studio.export.project',
          'Save the product before exporting it.',
        );
      }

      const current = await this.#compiler.openProductProject(session.projectDirectory);
      if (
        current.document.productId !== session.productId ||
        current.revision !== session.revision
      ) {
        studioFailure(
          'GARAK_STUDIO_PROJECT_CHANGED',
          'studio.export.project',
          'The saved project changed outside this Studio document. Reopen it before exporting.',
        );
      }

      const outputDirectory = await this.#dialogs.chooseExportDirectory();
      if (outputDirectory === null) {
        return CANCELLED;
      }

      let exported: Awaited<ReturnType<typeof exportProductProject>>;
      try {
        exported = await this.#export(session, request, outputDirectory, false);
      } catch (error: unknown) {
        const outputDiagnostic = this.#compiler.diagnosticFor(error);
        if (outputDiagnostic.code !== 'GARAK_EXPORT_OUTPUT_EXISTS') {
          throw error;
        }
        const replace = await this.#dialogs.confirmExportReplacement(
          diagnosticView(outputDiagnostic),
        );
        if (!replace) {
          return CANCELLED;
        }
        exported = await this.#export(session, request, outputDirectory, true);
      }

      const childProcesses = exported.childProcesses.map((child) => {
        if (child.exitCode === null) {
          studioFailure(
            'GARAK_STUDIO_EXPORT_CHILD_RESULT',
            'studio.export.childProcesses',
            'A completed export returned an indeterminate child process result.',
          );
        }
        return {
          tool: path.basename(child.executable),
          exitCode: child.exitCode,
        };
      });
      return {
        configuration: request.configuration,
        bundlePath: exported.bundlePath,
        runtimeSha256: exported.runtimeSha256,
        compiledSha256: exported.compiledSha256,
        compiledBytes: exported.compiledBytes,
        moduleInfoSha256: exported.moduleInfoSha256,
        moduleInfoBytes: exported.moduleInfoBytes,
        processorFuid: exported.processorFuid,
        controllerFuid: exported.controllerFuid,
        inventory: exported.inventory,
        childProcesses,
        cleanupWarnings: this.#registerCleanupWarnings(exported.cleanupDiagnostics),
      };
    });
  }

  async cleanupProductArtifact(
    request: CleanupProductArtifactRequest,
  ): Promise<ProductOperationResult<{ readonly cleaned: true }>> {
    return this.#run(async () => {
      const orphan = this.#cleanupCapabilities.get(request.cleanupId);
      if (orphan === undefined) {
        studioFailure(
          'GARAK_STUDIO_CLEANUP_CAPABILITY',
          'studio.cleanup.cleanupId',
          'The cleanup capability is unknown or has expired.',
        );
      }
      const confirm = await this.#dialogs.confirmOwnedCleanup({
        code: 'GARAK_STUDIO_CLEANUP_CONFIRMATION',
        path: 'studio.cleanup',
        message:
          'Remove the compiler-owned transaction artifact left after a successful publication?',
      });
      if (!confirm) {
        return CANCELLED;
      }
      await this.#compiler.retryOwnedCleanup(orphan);
      this.#cleanupCapabilities.delete(request.cleanupId);
      return { cleaned: true } as const;
    });
  }

  async #export(
    session: SavedSession,
    request: ExportProductRequest,
    outputDirectory: string,
    force: boolean,
  ): ReturnType<typeof exportProductProject> {
    return this.#compiler.exportProductProject({
      projectPath: session.projectDirectory,
      configuration: request.configuration,
      outputDirectory,
      repositoryRoot: this.#repositoryRoot,
      force,
      validate: true,
    });
  }

  #requireSession(documentId: string): ProductSession {
    const session = this.#sessions.get(documentId);
    if (session === undefined) {
      studioFailure(
        'GARAK_STUDIO_DOCUMENT_CAPABILITY',
        'studio.document.documentId',
        'The Product document capability is unknown or has expired.',
      );
    }
    return session;
  }

  #nextCapabilityId<T>(map: ReadonlyMap<string, T>): string {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = this.#createCapabilityId();
      if (candidate.length > 0 && !map.has(candidate)) {
        return candidate;
      }
    }
    studioFailure(
      'GARAK_STUDIO_CAPABILITY_ID',
      'studio.capability',
      'Studio could not issue a unique workflow capability.',
    );
  }

  #documentForDraft(session: DraftSession, draft: ProductDraft): ProductDocument {
    return {
      documentId: session.documentId,
      locationLabel: null,
      saved: false,
      schemaVersion: PRODUCT_SCHEMA_VERSION,
      schemaStatus: CURRENT_SCHEMA_STATUS,
      productId: session.productId,
      category: PRODUCT_CATEGORY,
      template: PRODUCT_TEMPLATE,
      draft,
      cleanupWarnings: [],
    };
  }

  #documentForSnapshot(
    session: SavedSession,
    snapshot: ProductProjectSnapshot,
    cleanupDiagnostics: readonly OwnedCleanupDiagnostic[],
  ): ProductDocument {
    return {
      documentId: session.documentId,
      locationLabel: snapshot.sourceDirectory,
      saved: true,
      schemaVersion: snapshot.document.schemaVersion,
      schemaStatus: {
        sourceSchemaVersion: snapshot.schemaStatus.sourceSchemaVersion,
        currentSchemaVersion: snapshot.schemaStatus.currentSchemaVersion,
        migrationRequired: snapshot.schemaStatus.migrationRequired,
        steps: [...snapshot.schemaStatus.steps],
      },
      productId: snapshot.document.productId,
      category: snapshot.document.category,
      template: snapshot.document.template,
      draft: {
        vendor: snapshot.document.vendor,
        name: snapshot.document.name,
        version: snapshot.document.version,
        gainDb: snapshot.document.defaults.gainDb,
      },
      cleanupWarnings: this.#registerCleanupWarnings(cleanupDiagnostics),
    };
  }

  #registerCleanupWarnings(
    diagnostics: readonly OwnedCleanupDiagnostic[],
  ): readonly ProductCleanupWarning[] {
    return diagnostics.map((diagnostic) => {
      const cleanupId = this.#nextCapabilityId(this.#cleanupCapabilities);
      this.#cleanupCapabilities.set(cleanupId, diagnostic.orphan);
      return {
        cleanupId,
        diagnostic: diagnosticView(diagnostic),
      };
    });
  }

  async #run<T>(
    operation: () => Promise<T | typeof CANCELLED> | T | typeof CANCELLED,
  ): Promise<ProductOperationResult<T>> {
    if (this.#operationInFlight) {
      return {
        status: 'error',
        diagnostic: {
          code: 'GARAK_STUDIO_OPERATION_BUSY',
          path: 'studio.operation',
          message:
            'Another Product operation is still in progress. Wait for it to finish before trying again.',
        },
      };
    }
    this.#operationInFlight = true;
    try {
      const value = await operation();
      if (value === CANCELLED) {
        return { status: 'cancelled' };
      }
      return { status: 'ok', value };
    } catch (error: unknown) {
      const productDiagnostic =
        error instanceof StudioProductError
          ? error.diagnostic
          : this.#compiler.diagnosticFor(error);
      return { status: 'error', diagnostic: diagnosticView(productDiagnostic) };
    } finally {
      this.#operationInFlight = false;
    }
  }
}
