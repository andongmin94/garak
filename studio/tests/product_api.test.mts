import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCleanupProductArtifactRequest,
  isExportProductRequest,
  isProductDocumentResult,
  isProductDraft,
  isProductExportOperationResult,
  isProductInspectionResult,
  isValidateProductRequest,
} from '../src/shared/product_api.mts';

const GRAPH = {
  schemaVersion: 1,
  nodes: [
    { id: 'input', type: 'garak.audio-input', implementationVersion: 1 },
    { id: 'gain', type: 'garak.gain', implementationVersion: 1 },
    { id: 'output', type: 'garak.audio-output', implementationVersion: 1 },
  ],
  connections: [
    {
      from: { nodeId: 'input', port: 'audio' },
      to: { nodeId: 'gain', port: 'audio' },
    },
    {
      from: { nodeId: 'gain', port: 'audio' },
      to: { nodeId: 'output', port: 'audio' },
    },
  ],
} as const;

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
  assert.equal(isProductDraft({ ...draft, graph: GRAPH }), false);
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
    schemaVersion: 3,
    schemaStatus: {
      sourceSchemaVersion: 3,
      currentSchemaVersion: 3,
      migrationRequired: false,
      steps: [],
    },
    productId: '6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e',
    category: 'Fx',
    template: { id: 'garak.gain', version: 1 },
    graph: GRAPH,
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
      value: {
        ...document,
        graph: {
          ...GRAPH,
          nodes: [...GRAPH.nodes].reverse(),
          connections: [...GRAPH.connections].reverse(),
        },
      },
    }),
    true,
  );
  assert.equal(
    isProductDocumentResult({
      status: 'ok',
      value: {
        ...document,
        schemaStatus: {
          sourceSchemaVersion: 1,
          currentSchemaVersion: 3,
          migrationRequired: true,
          steps: ['project-schema-1-to-2', 'project-schema-2-to-3'],
        },
      },
    }),
    true,
  );
  assert.equal(
    isProductDocumentResult({
      status: 'ok',
      value: {
        ...document,
        schemaStatus: {
          sourceSchemaVersion: 2,
          currentSchemaVersion: 3,
          migrationRequired: true,
          steps: ['project-schema-2-to-3'],
        },
      },
    }),
    true,
  );
  assert.equal(
    isProductDocumentResult({
      status: 'ok',
      value: {
        ...document,
        schemaStatus: {
          sourceSchemaVersion: 1,
          currentSchemaVersion: 3,
          migrationRequired: false,
          steps: [],
        },
      },
    }),
    false,
  );
  assert.equal(
    isProductDocumentResult({
      status: 'ok',
      value: { ...document, template: 'garak.gain-v1' },
    }),
    false,
  );
  assert.equal(
    isProductDocumentResult({
      status: 'ok',
      value: { ...document, graph: { ...GRAPH, nodes: [] } },
    }),
    false,
  );
  assert.equal(
    isProductDocumentResult({
      status: 'ok',
      value: {
        ...document,
        graph: {
          ...GRAPH,
          connections: [GRAPH.connections[0], GRAPH.connections[0]],
        },
      },
    }),
    false,
  );
  assert.equal(
    isProductDocumentResult({
      status: 'ok',
      value: { ...document, projectDirectory: 'C:/private.garak' },
    }),
    false,
  );
  const inspection = {
    productId: document.productId,
    vendor: document.draft.vendor,
    name: document.draft.name,
    version: document.draft.version,
    category: 'Fx',
    template: { id: 'garak.gain', version: 1 },
    processorFuid: '00112233445566778899AABBCCDDEEFF',
    controllerFuid: 'FFEEDDCCBBAA99887766554433221100',
    gain: { id: 1001, defaultDb: -6, defaultNormalized: 0.75 },
    bypass: { id: 1002, default: false, defaultNormalized: 0 },
  };
  assert.equal(isProductInspectionResult({ status: 'ok', value: inspection }), true);
  assert.equal(
    isProductInspectionResult({
      status: 'ok',
      value: { ...inspection, template: 'garak.gain-v1' },
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
