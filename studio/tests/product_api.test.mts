import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCleanupProductArtifactRequest,
  isExportProductRequest,
  isProductDocumentResult,
  isProductDraft,
  isProductExportOperationResult,
  isValidateProductRequest,
} from '../src/shared/product_api.mts';

test('Product IPC request guards require exact finite payloads', () => {
  const draft = {
    vendor: 'Artist',
    name: 'Gain',
    version: '0.1.0',
    gainDb: -6,
  };
  assert.equal(isProductDraft(draft), true);
  assert.equal(isProductDraft({ ...draft, productId: 'forged' }), false);
  assert.equal(isProductDraft({ ...draft, gainDb: Number.NaN }), false);
  assert.equal(isValidateProductRequest({ documentId: 'document-1', draft }), true);
  assert.equal(
    isValidateProductRequest({
      documentId: 'document-1',
      draft,
      projectPath: 'C:/forged.garak',
    }),
    false,
  );
  assert.equal(
    isExportProductRequest({
      documentId: 'document-1',
      configuration: 'Release',
    }),
    true,
  );
  assert.equal(
    isExportProductRequest({
      documentId: 'document-1',
      configuration: 'Release',
      outputDirectory: 'C:/forged',
    }),
    false,
  );
  assert.equal(isCleanupProductArtifactRequest({ cleanupId: 'cleanup-1' }), true);
  assert.equal(isCleanupProductArtifactRequest({ cleanupId: '' }), false);
  assert.equal(
    isCleanupProductArtifactRequest({
      cleanupId: 'cleanup-1',
      targetPath: 'C:/forged',
    }),
    false,
  );
});

test('Product IPC response guards reject malformed or authority-bearing results', () => {
  const document = {
    documentId: 'document-1',
    locationLabel: null,
    saved: false,
    schemaVersion: 1,
    productId: '6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e',
    category: 'Fx',
    template: 'garak.gain-v1',
    draft: {
      vendor: 'Artist',
      name: 'Gain',
      version: '0.1.0',
      gainDb: -6,
    },
    cleanupWarnings: [],
  };
  assert.equal(isProductDocumentResult({ status: 'ok', value: document }), true);
  assert.equal(
    isProductDocumentResult({
      status: 'ok',
      value: { ...document, projectDirectory: 'C:/private.garak' },
    }),
    false,
  );
  const exportResult = {
    configuration: 'Debug',
    bundlePath: 'C:/Exports/Gain.vst3',
    runtimeSha256: 'A'.repeat(64),
    compiledSha256: 'B'.repeat(64),
    compiledBytes: 100,
    moduleInfoSha256: 'C'.repeat(64),
    moduleInfoBytes: 200,
    processorFuid: '00112233445566778899AABBCCDDEEFF',
    controllerFuid: 'FFEEDDCCBBAA99887766554433221100',
    inventory: ['Contents/Resources/product.garakbin'],
    childProcesses: [{ tool: 'validator.exe', exitCode: 0 }],
    cleanupWarnings: [],
  };
  assert.equal(isProductExportOperationResult({ status: 'ok', value: exportResult }), true);
  assert.equal(
    isProductExportOperationResult({
      status: 'ok',
      value: { ...exportResult, runtimeSha256: 'a'.repeat(64) },
    }),
    false,
  );
  assert.equal(
    isProductExportOperationResult({
      status: 'ok',
      value: { ...exportResult, outputDirectoryCapability: 'forged' },
    }),
    false,
  );
});
