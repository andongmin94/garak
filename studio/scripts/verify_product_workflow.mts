import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProductService } from '../electron/product_service.mts';
import {
  isProductExportOperationResult,
  isProductGraphSource,
  type ProductConfiguration,
  type ProductDraft,
} from '../src/shared/product_api.mts';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

function configurationFrom(arguments_: readonly string[]): ProductConfiguration {
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== '--configuration' ||
    (arguments_[1] !== 'Debug' && arguments_[1] !== 'Release')
  ) {
    throw new Error('Usage: verify_product_workflow.mts --configuration Debug|Release');
  }
  return arguments_[1];
}

async function main(): Promise<void> {
  const configuration = configurationFrom(process.argv.slice(2));
  const lifecycleParent = path.join(repositoryRoot, 'out', 'phase-1c2-studio-lifecycle');
  await mkdir(lifecycleParent, { recursive: true });
  const lifecycleRoot = await mkdtemp(
    path.join(lifecycleParent, `${configuration.toLowerCase()}-`),
  );
  const lifecycleProject = path.join(lifecycleRoot, 'Studio Lifecycle.garak');
  const lifecycleDraft: ProductDraft = {
    vendor: 'Garak Studio Test',
    name: `Studio Lifecycle ${configuration}`,
    version: '0.1.0',
    gainDb: -3,
  };

  let lifecycleEvidence: {
    readonly productId: string;
    readonly processorFuid: string;
    readonly controllerFuid: string;
    readonly schemaVersion: 3;
    readonly graphSchemaVersion: 1;
    readonly saved: true;
    readonly reopened: true;
  };
  try {
    const lifecycleService = new ProductService({
      repositoryRoot,
      dialogs: {
        chooseProjectToOpen: () => Promise.resolve(lifecycleProject),
        chooseProjectToCreate: () => Promise.resolve(lifecycleProject),
        chooseExportDirectory: () => Promise.resolve(null),
        confirmExportReplacement: () => Promise.resolve(false),
        confirmOwnedCleanup: () => Promise.resolve(false),
      },
    });
    const created = await lifecycleService.newProduct();
    if (created.status !== 'ok') {
      throw new Error(`Studio Product create failed: ${JSON.stringify(created)}`);
    }
    const validated = await lifecycleService.validateProduct({
      documentId: created.value.documentId,
      draft: lifecycleDraft,
    });
    if (validated.status !== 'ok') {
      throw new Error(`Studio Product validation failed: ${JSON.stringify(validated)}`);
    }
    const saved = await lifecycleService.saveProduct({
      documentId: created.value.documentId,
      draft: lifecycleDraft,
    });
    if (saved.status !== 'ok' || !saved.value.saved) {
      throw new Error(`Studio Product save failed: ${JSON.stringify(saved)}`);
    }
    const reopened = await lifecycleService.openProduct();
    if (
      reopened.status !== 'ok' ||
      !reopened.value.saved ||
      reopened.value.schemaVersion !== 3 ||
      reopened.value.schemaStatus.sourceSchemaVersion !== 3 ||
      reopened.value.schemaStatus.migrationRequired ||
      !isProductGraphSource(reopened.value.graph) ||
      reopened.value.productId !== created.value.productId ||
      JSON.stringify(reopened.value.draft) !== JSON.stringify(lifecycleDraft) ||
      JSON.stringify(reopened.value.graph) !== JSON.stringify(created.value.graph)
    ) {
      throw new Error(`Studio Product reopen parity failed: ${JSON.stringify(reopened)}`);
    }
    lifecycleEvidence = {
      productId: reopened.value.productId,
      processorFuid: validated.value.processorFuid,
      controllerFuid: validated.value.controllerFuid,
      schemaVersion: 3,
      graphSchemaVersion: reopened.value.graph.schemaVersion,
      saved: true,
      reopened: true,
    };
  } finally {
    await rm(lifecycleRoot, { recursive: true, force: false });
  }

  const migrationRoot = await mkdtemp(
    path.join(lifecycleParent, `${configuration.toLowerCase()}-migration-`),
  );
  const migrationProject = path.join(migrationRoot, 'Legacy Gain Warm.garak');
  const legacyV2Fixture = path.join(
    repositoryRoot,
    'examples',
    'products',
    'legacy',
    'v2',
    'artist-gain-warm.garak',
  );
  let migrationEvidence: {
    readonly sourceSchemaVersion: 2;
    readonly targetSchemaVersion: 3;
    readonly backupFingerprint: string;
    readonly graphPreserved: true;
    readonly reopened: true;
  };
  try {
    await cp(legacyV2Fixture, migrationProject, { recursive: true, errorOnExist: true });
    let backupNotice:
      | { readonly projectDirectory: string; readonly fingerprint: string }
      | undefined;
    const migrationService = new ProductService({
      repositoryRoot,
      dialogs: {
        chooseProjectToOpen: () => Promise.resolve(migrationProject),
        chooseProjectToCreate: () => Promise.resolve(null),
        chooseExportDirectory: () => Promise.resolve(null),
        confirmExportReplacement: () => Promise.resolve(false),
        confirmOwnedCleanup: () => Promise.resolve(false),
        confirmProjectMigration: () => Promise.resolve(true),
        notifyProjectMigrationComplete: (notice) => {
          backupNotice = notice;
          return Promise.resolve();
        },
      },
    });
    const migrated = await migrationService.openProduct();
    if (
      migrated.status !== 'ok' ||
      migrated.value.schemaVersion !== 3 ||
      migrated.value.schemaStatus.sourceSchemaVersion !== 3 ||
      migrated.value.schemaStatus.migrationRequired ||
      !isProductGraphSource(migrated.value.graph) ||
      backupNotice === undefined
    ) {
      throw new Error(`Studio v2-to-v3 migration failed: ${JSON.stringify(migrated)}`);
    }
    const backupSource = JSON.parse(
      await readFile(path.join(backupNotice.projectDirectory, 'product.json'), 'utf8'),
    ) as unknown;
    if (
      typeof backupSource !== 'object' ||
      backupSource === null ||
      !('schemaVersion' in backupSource) ||
      backupSource.schemaVersion !== 2
    ) {
      throw new Error('Studio migration backup did not preserve the exact schema v2 source.');
    }
    const reopened = await migrationService.openProduct();
    if (
      reopened.status !== 'ok' ||
      reopened.value.productId !== migrated.value.productId ||
      JSON.stringify(reopened.value.graph) !== JSON.stringify(migrated.value.graph)
    ) {
      throw new Error(`Studio migrated project reopen failed: ${JSON.stringify(reopened)}`);
    }
    migrationEvidence = {
      sourceSchemaVersion: 2,
      targetSchemaVersion: 3,
      backupFingerprint: backupNotice.fingerprint,
      graphPreserved: true,
      reopened: true,
    };
  } finally {
    await rm(migrationRoot, { recursive: true, force: false });
  }

  const projectDirectory = path.join(
    repositoryRoot,
    'examples',
    'products',
    'artist-gain-warm.garak',
  );
  const outputDirectory = path.join(
    repositoryRoot,
    'out',
    'exports',
    'phase-1c2',
    `studio-service-${configuration.toLowerCase()}`,
  );

  const service = new ProductService({
    repositoryRoot,
    dialogs: {
      chooseProjectToOpen: () => Promise.resolve(projectDirectory),
      chooseProjectToCreate: () => Promise.resolve(null),
      chooseExportDirectory: () => Promise.resolve(outputDirectory),
      confirmExportReplacement: () => Promise.resolve(true),
      confirmOwnedCleanup: () => Promise.resolve(false),
    },
  });

  const opened = await service.openProduct();
  if (opened.status !== 'ok') {
    throw new Error(`Studio Product open failed: ${JSON.stringify(opened)}`);
  }
  const exported = await service.exportProduct({
    documentId: opened.value.documentId,
    configuration,
  });
  if (exported.status !== 'ok') {
    throw new Error(`Studio Product export failed: ${JSON.stringify(exported)}`);
  }
  if (!isProductExportOperationResult(exported)) {
    throw new Error('Studio preload response guard rejected the real Product export result.');
  }
  if (
    exported.value.inventory.length !== 4 ||
    exported.value.childProcesses.length !== 5 ||
    exported.value.childProcesses.some((child) => child.exitCode !== 0) ||
    exported.value.cleanupWarnings.length !== 0
  ) {
    throw new Error(
      `Studio Product export returned unexpected evidence: ${JSON.stringify(exported.value)}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        configuration,
        lifecycle: lifecycleEvidence,
        migration: migrationEvidence,
        project: opened.value.locationLabel,
        bundlePath: exported.value.bundlePath,
        processorFuid: exported.value.processorFuid,
        controllerFuid: exported.value.controllerFuid,
        runtimeSha256: exported.value.runtimeSha256,
        compiledSha256: exported.value.compiledSha256,
        moduleInfoSha256: exported.value.moduleInfoSha256,
        inventory: exported.value.inventory,
        childProcesses: exported.value.childProcesses,
      },
      undefined,
      2,
    )}\n`,
  );
}

await main();
