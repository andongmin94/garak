import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalProductGraphSource } from '../../tools/product-compiler/src/api.ts';
import type {
  OwnedCleanupDiagnostic,
  ProductProjectSnapshot,
  ProjectMutationResult,
} from '../../tools/product-compiler/src/api.ts';
import {
  ProductService,
  type ProductCompilerPort,
  type ProductDialogPort,
} from '../electron/product_service.mts';
import type { ProductDiagnostic, ProductDraft } from '../src/shared/product_api.mts';

const PROJECT_DIRECTORY = 'C:\\Products\\Artist Gain.garak';
const OUTPUT_DIRECTORY = 'C:\\Exports';
const PRODUCT_ID = '6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e';
const DRAFT: ProductDraft = {
  vendor: 'Garak Test Artist',
  name: 'Artist Gain',
  version: '0.1.0',
  gainDb: -6,
};

function snapshot(
  revision = 'a'.repeat(64),
  sourceSchemaVersion: 1 | 2 | 3 = 3,
): ProductProjectSnapshot {
  let schemaStatus: ProductProjectSnapshot['schemaStatus'];
  if (sourceSchemaVersion === 1) {
    schemaStatus = {
      sourceSchemaVersion: 1,
      currentSchemaVersion: 3,
      migrationRequired: true,
      steps: ['project-schema-1-to-2', 'project-schema-2-to-3'],
    };
  } else if (sourceSchemaVersion === 2) {
    schemaStatus = {
      sourceSchemaVersion: 2,
      currentSchemaVersion: 3,
      migrationRequired: true,
      steps: ['project-schema-2-to-3'],
    };
  } else {
    schemaStatus = {
      sourceSchemaVersion: 3,
      currentSchemaVersion: 3,
      migrationRequired: false,
      steps: [],
    };
  }
  return {
    sourceDirectory: PROJECT_DIRECTORY,
    revision,
    schemaStatus,
    document: {
      schemaVersion: 3,
      productId: PRODUCT_ID,
      vendor: DRAFT.vendor,
      name: DRAFT.name,
      version: DRAFT.version,
      category: 'Fx',
      template: { id: 'garak.gain', version: 1 },
      graph: canonicalProductGraphSource(),
      defaults: { gainDb: DRAFT.gainDb },
    },
    inspection: {
      productId: PRODUCT_ID,
      vendor: DRAFT.vendor,
      name: DRAFT.name,
      version: DRAFT.version,
      category: 'Fx',
      template: { id: 'garak.gain', version: 1 },
      processorFuid: '00112233445566778899AABBCCDDEEFF',
      controllerFuid: 'FFEEDDCCBBAA99887766554433221100',
      gain: { id: 1001, defaultDb: -6, defaultNormalized: 0.75 },
      bypass: { id: 1002, default: false, defaultNormalized: 0 },
    },
  };
}

function mutation(
  cleanupDiagnostics: readonly OwnedCleanupDiagnostic[] = [],
): ProjectMutationResult {
  return { ...snapshot(), cleanupDiagnostics };
}

class MockCompilerError extends Error {
  readonly diagnostic: ProductDiagnostic;

  constructor(diagnostic: ProductDiagnostic) {
    super(diagnostic.message);
    this.diagnostic = diagnostic;
  }
}

function compiler(overrides: Partial<ProductCompilerPort> = {}): ProductCompilerPort {
  return {
    openProductProject: async () => snapshot(),
    inspectProductProjectDraft: () => snapshot().inspection,
    createProductProject: async () => mutation(),
    saveProductProject: async () => mutation(),
    exportProductProject: async () => ({
      bundlePath: `${OUTPUT_DIRECTORY}\\Artist Gain.vst3`,
      runtimeSha256: 'a'.repeat(64),
      compiledSha256: 'b'.repeat(64),
      compiledBytes: 100,
      moduleInfoSha256: 'c'.repeat(64),
      moduleInfoBytes: 200,
      processorFuid: '00112233445566778899AABBCCDDEEFF',
      controllerFuid: 'FFEEDDCCBBAA99887766554433221100',
      inventory: ['Contents/Resources/product.garakbin'],
      childProcesses: [
        {
          executable: 'C:\\Tools\\validator.exe',
          arguments: [],
          exitCode: 0,
        },
      ],
      cleanupDiagnostics: [],
    }),
    retryOwnedCleanup: async () => ({
      targetPath: `${OUTPUT_DIRECTORY}\\.garak-product-export-stage-owned`,
      removed: true,
    }),
    diagnosticFor: (error: unknown) =>
      error instanceof MockCompilerError
        ? error.diagnostic
        : {
            code: 'GARAK_INTERNAL_ERROR',
            path: 'product-compiler',
            message: error instanceof Error ? error.message : 'Unknown error.',
          },
    ...overrides,
  };
}

function dialogs(overrides: Partial<ProductDialogPort> = {}): ProductDialogPort {
  return {
    chooseProjectToOpen: async () => PROJECT_DIRECTORY,
    chooseProjectToCreate: async () => PROJECT_DIRECTORY,
    chooseExportDirectory: async () => OUTPUT_DIRECTORY,
    confirmExportReplacement: async () => false,
    confirmOwnedCleanup: async () => false,
    ...overrides,
  };
}

function service(dialogPort: ProductDialogPort, compilerPort: ProductCompilerPort): ProductService {
  let capability = 0;
  return new ProductService({
    dialogs: dialogPort,
    compiler: compilerPort,
    repositoryRoot: 'C:\\Repository\\garak',
    createCapabilityId: () => `capability-${(capability += 1)}`,
  });
}

test('main-owned session keeps Product ID out of editable requests', async () => {
  let createdProductId = '';
  let submittedGraph: unknown;
  const productService = service(
    dialogs(),
    compiler({
      createProductProject: async (options) => {
        createdProductId = String(options.productId);
        submittedGraph = options.draft.graph;
        return {
          ...mutation(),
          document: { ...mutation().document, productId: createdProductId },
          inspection: {
            ...mutation().inspection,
            productId: createdProductId,
          },
        };
      },
    }),
  );

  const created = await productService.newProduct();
  assert.equal(created.status, 'ok');
  if (created.status !== 'ok') return;

  const saved = await productService.saveProduct({
    documentId: created.value.documentId,
    draft: DRAFT,
  });
  assert.equal(saved.status, 'ok');
  assert.equal(createdProductId, created.value.productId);
  assert.deepEqual(submittedGraph, created.value.graph);
  if (saved.status === 'ok') {
    assert.equal(saved.value.productId, created.value.productId);
    assert.equal(saved.value.saved, true);
  }

  const forged = await productService.validateProduct({
    documentId: 'forged-document',
    draft: DRAFT,
  });
  assert.deepEqual(forged, {
    status: 'error',
    diagnostic: {
      code: 'GARAK_STUDIO_DOCUMENT_CAPABILITY',
      path: 'studio.document.documentId',
      message: 'The Product document capability is unknown or has expired.',
    },
  });
});

test('legacy open remains read-only when migration is declined', async () => {
  let saveCalls = 0;
  const productService = service(
    dialogs({ confirmProjectMigration: async () => false }),
    compiler({
      openProductProject: async () => snapshot('a'.repeat(64), 2),
      saveProductProject: async () => {
        saveCalls += 1;
        return mutation();
      },
    }),
  );

  const opened = await productService.openProduct();
  assert.equal(opened.status, 'ok');
  if (opened.status !== 'ok') return;
  assert.equal(opened.value.schemaVersion, 3);
  assert.deepEqual(opened.value.template, { id: 'garak.gain', version: 1 });
  assert.deepEqual(opened.value.schemaStatus, {
    sourceSchemaVersion: 2,
    currentSchemaVersion: 3,
    migrationRequired: true,
    steps: ['project-schema-2-to-3'],
  });

  const saved = await productService.saveProduct({
    documentId: opened.value.documentId,
    draft: opened.value.draft,
  });
  assert.deepEqual(saved, {
    status: 'error',
    diagnostic: {
      code: 'GARAK_PROJECT_MIGRATION_REQUIRED',
      path: 'project.schemaVersion',
      message:
        'This legacy project is open read-only. Reopen it and approve Back Up & Upgrade before saving.',
    },
  });
  assert.equal(saveCalls, 0);
});

test('legacy open upgrades only after native confirmation and reports the verified backup', async () => {
  const backup = {
    transactionId: 'migration-transaction',
    projectDirectory: 'C:\\Backups\\Artist Gain.garak',
    manifestPath: 'C:\\Backups\\backup.json',
    fingerprint: 'd'.repeat(64),
    productId: PRODUCT_ID,
    sourceSchemaVersion: 1 as const,
    operation: 'migrate-in-place' as const,
  };
  let migrations = 0;
  let notice: { readonly projectDirectory: string; readonly fingerprint: string } | undefined;
  const productService = service(
    dialogs({
      confirmProjectMigration: async () => true,
      notifyProjectMigrationComplete: async (value) => {
        notice = value;
      },
    }),
    compiler({
      openProductProject: async () => snapshot('a'.repeat(64), 1),
      migrateProductProjectInPlace: async () => {
        migrations += 1;
        return { ...mutation(), backup };
      },
    }),
  );

  const opened = await productService.openProduct();
  assert.equal(opened.status, 'ok');
  assert.equal(migrations, 1);
  assert.deepEqual(notice, {
    projectDirectory: backup.projectDirectory,
    fingerprint: backup.fingerprint,
  });
  if (opened.status === 'ok') {
    assert.equal(opened.value.schemaStatus.migrationRequired, false);
    assert.equal(opened.value.schemaStatus.sourceSchemaVersion, 3);
  }
});

test('future-schema open failure creates no session that can overwrite the source', async () => {
  let saveCalls = 0;
  const productService = service(
    dialogs(),
    compiler({
      openProductProject: async () => {
        throw new MockCompilerError({
          code: 'GARAK_PROJECT_VERSION_TOO_NEW',
          path: 'product.json.schemaVersion',
          message: 'schemaVersion 4 is newer than the current version 3.',
        });
      },
      saveProductProject: async () => {
        saveCalls += 1;
        return mutation();
      },
    }),
  );

  assert.deepEqual(await productService.openProduct(), {
    status: 'error',
    diagnostic: {
      code: 'GARAK_PROJECT_VERSION_TOO_NEW',
      path: 'product.json.schemaVersion',
      message: 'schemaVersion 4 is newer than the current version 3.',
    },
  });
  assert.equal(
    (
      await productService.saveProduct({
        documentId: 'future-document',
        draft: DRAFT,
      })
    ).status,
    'error',
  );
  assert.equal(saveCalls, 0);
});

test('save conflict notifies the user and preserves the compiler diagnostic', async () => {
  let notified: ProductDiagnostic | undefined;
  const conflict: ProductDiagnostic = {
    code: 'GARAK_PROJECT_REVISION_CONFLICT',
    path: 'project.persistence.revision',
    message: 'Project tree changed on disk since this Studio session opened.',
  };
  const productService = service(
    dialogs({
      notifyProjectConflict: async (diagnostic) => {
        notified = diagnostic;
      },
    }),
    compiler({
      saveProductProject: async () => {
        throw new MockCompilerError(conflict);
      },
    }),
  );
  const opened = await productService.openProduct();
  assert.equal(opened.status, 'ok');
  if (opened.status !== 'ok') return;

  const result = await productService.saveProduct({
    documentId: opened.value.documentId,
    draft: DRAFT,
  });
  assert.deepEqual(result, { status: 'error', diagnostic: conflict });
  assert.deepEqual(notified, conflict);
});

test('ambiguous recovery is surfaced without inventing a writable session', async () => {
  let notified: ProductDiagnostic | undefined;
  const recovery: ProductDiagnostic = {
    code: 'GARAK_PROJECT_RECOVERY_AMBIGUOUS',
    path: 'project.persistence.recovery',
    message: 'Multiple valid recovery artifacts require explicit review.',
  };
  const productService = service(
    dialogs({
      notifyRecoveryRequired: async (diagnostic) => {
        notified = diagnostic;
      },
    }),
    compiler({
      openProductProject: async () => {
        throw new MockCompilerError(recovery);
      },
    }),
  );

  assert.deepEqual(await productService.openProduct(), {
    status: 'error',
    diagnostic: recovery,
  });
  assert.deepEqual(notified, recovery);
});

test('export owns output selection, validates, and confirms before replacement', async () => {
  const calls: Array<{ readonly force: boolean; readonly validate: boolean }> = [];
  const productService = service(
    dialogs({ confirmExportReplacement: async () => true }),
    compiler({
      exportProductProject: async (options) => {
        calls.push({ force: options.force, validate: options.validate });
        if (!options.force) {
          throw new MockCompilerError({
            code: 'GARAK_EXPORT_OUTPUT_EXISTS',
            path: 'export.output',
            message: 'The output exists.',
          });
        }
        return await compiler().exportProductProject(options);
      },
    }),
  );
  const opened = await productService.openProduct();
  assert.equal(opened.status, 'ok');
  if (opened.status !== 'ok') return;

  const exported = await productService.exportProduct({
    documentId: opened.value.documentId,
    configuration: 'Release',
  });
  assert.equal(exported.status, 'ok');
  assert.deepEqual(calls, [
    { force: false, validate: true },
    { force: true, validate: true },
  ]);
  if (exported.status === 'ok') {
    assert.equal(exported.value.configuration, 'Release');
    assert.deepEqual(exported.value.childProcesses, [{ tool: 'validator.exe', exitCode: 0 }]);
  }
});

test('cleanup requires an opaque capability and explicit confirmation', async () => {
  const orphan = {
    contractVersion: 1 as const,
    kind: 'project-backup' as const,
    parentDirectory: 'C:\\Products',
    targetPath: 'C:\\Products\\Artist Gain.garak.garak-backup-owned',
  };
  const warning: OwnedCleanupDiagnostic = {
    code: 'GARAK_PROJECT_POST_COMMIT_BACKUP_CLEANUP',
    path: 'project.cleanup.backup',
    message: 'Published output is valid, but cleanup failed.',
    orphan,
  };
  let retried: unknown;
  const productService = service(
    dialogs({ confirmOwnedCleanup: async () => true }),
    compiler({
      saveProductProject: async () => mutation([warning]),
      retryOwnedCleanup: async (ownedOrphan) => {
        retried = ownedOrphan;
        return { targetPath: orphan.targetPath, removed: true };
      },
    }),
  );
  const opened = await productService.openProduct();
  assert.equal(opened.status, 'ok');
  if (opened.status !== 'ok') return;
  const saved = await productService.saveProduct({
    documentId: opened.value.documentId,
    draft: DRAFT,
  });
  assert.equal(saved.status, 'ok');
  if (saved.status !== 'ok') return;
  const cleanupId = saved.value.cleanupWarnings[0]?.cleanupId;
  assert.equal(typeof cleanupId, 'string');
  if (cleanupId === null || cleanupId === undefined) return;

  const forged = await productService.cleanupProductArtifact({
    cleanupId: 'forged-cleanup',
  });
  assert.equal(forged.status, 'error');

  const cleaned = await productService.cleanupProductArtifact({ cleanupId });
  assert.deepEqual(cleaned, { status: 'ok', value: { cleaned: true } });
  assert.deepEqual(retried, orphan);

  const replayed = await productService.cleanupProductArtifact({ cleanupId });
  assert.equal(replayed.status, 'error');
});

test('overlapping Product operations fail closed', async () => {
  let releaseDialog: ((value: string | null) => void) | undefined;
  const waitingDialog = new Promise<string | null>((resolve) => {
    releaseDialog = resolve;
  });
  const productService = service(dialogs({ chooseProjectToOpen: () => waitingDialog }), compiler());

  const opening = productService.openProduct();
  const overlapping = await productService.newProduct();
  assert.deepEqual(overlapping, {
    status: 'error',
    diagnostic: {
      code: 'GARAK_STUDIO_OPERATION_BUSY',
      path: 'studio.operation',
      message:
        'Another Product operation is still in progress. Wait for it to finish before trying again.',
    },
  });
  releaseDialog?.(null);
  assert.deepEqual(await opening, { status: 'cancelled' });
});
