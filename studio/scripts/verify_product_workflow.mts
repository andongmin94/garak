import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProductService } from '../electron/product_service.mts';
import {
  isProductDocumentResult,
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
    readonly schemaVersion: 5;
    readonly graphSchemaVersion: 3;
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
      reopened.value.schemaVersion !== 5 ||
      reopened.value.schemaStatus.sourceSchemaVersion !== 5 ||
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
      schemaVersion: 5,
      graphSchemaVersion: reopened.value.graph.schemaVersion,
      saved: true,
      reopened: true,
    };
  } finally {
    await rm(lifecycleRoot, { recursive: true, force: false });
  }

  const migrations: {
    readonly sourceSchemaVersion: 1 | 2 | 3 | 4;
    readonly targetSchemaVersion: 5;
    readonly backupFingerprint: string;
    readonly graphPreserved: true;
    readonly reopened: true;
  }[] = [];
  for (const sourceSchemaVersion of [1, 2, 3, 4] as const) {
    const migrationRoot = await mkdtemp(
      path.join(
        lifecycleParent,
        `${configuration.toLowerCase()}-migration-v${sourceSchemaVersion}-`,
      ),
    );
    const migrationProject = path.join(migrationRoot, 'Legacy Gain.garak');
    const legacyFixture = path.join(
      repositoryRoot,
      'examples',
      'products',
      'legacy',
      `v${sourceSchemaVersion}`,
      sourceSchemaVersion === 4 ? 'artist-gain-inverted.garak' : 'artist-gain-warm.garak',
    );
    try {
      await cp(legacyFixture, migrationProject, { recursive: true, errorOnExist: true });
      const originalSource = await readFile(path.join(migrationProject, 'product.json'), 'utf8');
      let approveMigration = false;
      let backupNotice:
        { readonly projectDirectory: string; readonly fingerprint: string } | undefined;
      const migrationService = new ProductService({
        repositoryRoot,
        dialogs: {
          chooseProjectToOpen: () => Promise.resolve(migrationProject),
          chooseProjectToCreate: () => Promise.resolve(null),
          chooseExportDirectory: () => Promise.resolve(null),
          confirmExportReplacement: () => Promise.resolve(false),
          confirmOwnedCleanup: () => Promise.resolve(false),
          confirmProjectMigration: () => Promise.resolve(approveMigration),
          notifyProjectMigrationComplete: (notice) => {
            backupNotice = notice;
            return Promise.resolve();
          },
        },
      });
      const legacy = await migrationService.openProduct();
      if (
        legacy.status !== 'ok' ||
        legacy.value.schemaVersion !== 5 ||
        legacy.value.schemaStatus.sourceSchemaVersion !== sourceSchemaVersion ||
        !legacy.value.schemaStatus.migrationRequired ||
        !isProductGraphSource(legacy.value.graph) ||
        (await readFile(path.join(migrationProject, 'product.json'), 'utf8')) !== originalSource
      ) {
        throw new Error(
          `Studio v${sourceSchemaVersion} read-only open failed: ${JSON.stringify(legacy)}`,
        );
      }
      const refused = await migrationService.saveProduct({
        documentId: legacy.value.documentId,
        draft: legacy.value.draft,
      });
      if (
        refused.status !== 'error' ||
        refused.diagnostic.code !== 'GARAK_PROJECT_MIGRATION_REQUIRED' ||
        (await readFile(path.join(migrationProject, 'product.json'), 'utf8')) !== originalSource
      ) {
        throw new Error(`Studio legacy save changed its source: ${JSON.stringify(refused)}`);
      }
      approveMigration = true;
      const migrated = await migrationService.openProduct();
      if (
        migrated.status !== 'ok' ||
        migrated.value.schemaVersion !== 5 ||
        migrated.value.schemaStatus.sourceSchemaVersion !== 5 ||
        migrated.value.schemaStatus.migrationRequired ||
        JSON.stringify(migrated.value.graph) !== JSON.stringify(legacy.value.graph) ||
        migrated.value.productId !== legacy.value.productId ||
        backupNotice === undefined
      ) {
        throw new Error(
          `Studio v${sourceSchemaVersion}-to-v5 migration failed: ${JSON.stringify(migrated)}`,
        );
      }
      if (
        (await readFile(path.join(backupNotice.projectDirectory, 'product.json'), 'utf8')) !==
        originalSource
      ) {
        throw new Error('Studio migration backup did not preserve the exact legacy source.');
      }
      const reopened = await migrationService.openProduct();
      if (
        reopened.status !== 'ok' ||
        reopened.value.productId !== migrated.value.productId ||
        JSON.stringify(reopened.value.graph) !== JSON.stringify(migrated.value.graph)
      ) {
        throw new Error(`Studio migrated project reopen failed: ${JSON.stringify(reopened)}`);
      }
      migrations.push({
        sourceSchemaVersion,
        targetSchemaVersion: 5,
        backupFingerprint: backupNotice.fingerprint,
        graphPreserved: true,
        reopened: true,
      });
    } finally {
      await rm(migrationRoot, { recursive: true, force: false });
    }
  }

  const products = [];
  const productIds = new Set<string>();
  const classIds = new Set<string>();
  for (const [product, postGain] of [
    ['warm', null],
    ['bright', null],
    ['inverted', 'garak.polarity'],
    ['saturated', 'garak.saturation'],
  ] as const) {
    const projectDirectory = path.join(
      repositoryRoot,
      'examples',
      'products',
      `artist-gain-${product}.garak`,
    );
    const outputDirectory = path.join(
      repositoryRoot,
      'out',
      'exports',
      'phase-3d2',
      `studio-service-${product}-${configuration.toLowerCase()}`,
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
    if (
      opened.status !== 'ok' ||
      !isProductDocumentResult(opened) ||
      opened.value.schemaStatus.migrationRequired ||
      opened.value.graph.nodes.length !== (postGain === null ? 3 : 4) ||
      (postGain !== null && !opened.value.graph.nodes.some((node) => node.type === postGain))
    ) {
      throw new Error(`Studio ${product} open failed: ${JSON.stringify(opened)}`);
    }
    const inspected = await service.validateProduct({
      documentId: opened.value.documentId,
      draft: opened.value.draft,
    });
    if (inspected.status !== 'ok') {
      throw new Error(`Studio ${product} validation failed: ${JSON.stringify(inspected)}`);
    }
    const exported = await service.exportProduct({
      documentId: opened.value.documentId,
      configuration,
    });
    if (
      exported.status !== 'ok' ||
      !isProductExportOperationResult(exported) ||
      exported.value.inventory.length !== 4 ||
      exported.value.childProcesses.length !== 5 ||
      exported.value.childProcesses.some((child) => child.exitCode !== 0) ||
      exported.value.cleanupWarnings.length !== 0 ||
      exported.value.processorFuid !== inspected.value.processorFuid ||
      exported.value.controllerFuid !== inspected.value.controllerFuid ||
      productIds.has(opened.value.productId) ||
      classIds.has(exported.value.processorFuid) ||
      classIds.has(exported.value.controllerFuid)
    ) {
      throw new Error(`Studio ${product} export failed: ${JSON.stringify(exported)}`);
    }
    productIds.add(opened.value.productId);
    classIds.add(exported.value.processorFuid);
    classIds.add(exported.value.controllerFuid);
    products.push({
      product,
      productId: opened.value.productId,
      project: opened.value.locationLabel,
      bundlePath: exported.value.bundlePath,
      processorFuid: exported.value.processorFuid,
      controllerFuid: exported.value.controllerFuid,
      runtimeSha256: exported.value.runtimeSha256,
      compiledSha256: exported.value.compiledSha256,
      moduleInfoSha256: exported.value.moduleInfoSha256,
      inventory: exported.value.inventory,
      childProcesses: exported.value.childProcesses,
    });
  }
  process.stdout.write(
    `${JSON.stringify({ configuration, lifecycle: lifecycleEvidence, migrations, products }, undefined, 2)}\n`,
  );
}

await main();
