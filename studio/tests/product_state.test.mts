import assert from 'node:assert/strict';
import test from 'node:test';

import type { ProductDocument } from '../src/shared/product_api.mts';
import {
  diagnosticTargetsField,
  draftMatchesDocument,
  editableDraftFrom,
  productDraftFrom,
} from '../src/features/product/product_state.mts';

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

const document: ProductDocument = {
  documentId: 'document-1',
  locationLabel: 'Artist Gain.garak',
  saved: true,
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
  cleanupWarnings: [],
  draft: {
    vendor: 'Garak Test Artist',
    name: 'Artist Gain',
    version: '0.1.0',
    gainDb: -6,
  },
};

test('editable draft round-trips the canonical document values', () => {
  const editable = editableDraftFrom(document);
  assert.equal(draftMatchesDocument(editable, document), true);
  assert.deepEqual(productDraftFrom(editable), {
    status: 'ok',
    draft: document.draft,
  });
});

test('numeric spelling does not create a semantic dirty state', () => {
  assert.equal(
    draftMatchesDocument({ ...editableDraftFrom(document), gainDb: '-6.00' }, document),
    true,
  );
});

test('empty and non-finite gain values fail before the process boundary', () => {
  for (const gainDb of ['', ' ', 'Infinity', 'NaN']) {
    const result = productDraftFrom({
      ...editableDraftFrom(document),
      gainDb,
    });
    assert.equal(result.status, 'error');
    if (result.status === 'error') {
      assert.equal(result.diagnostic.code, 'GARAK_STUDIO_GAIN_NUMBER');
      assert.equal(result.diagnostic.path, 'product.json.defaults.gainDb');
    }
  }
});

test('field diagnostic matching accepts canonical compiler paths', () => {
  const diagnostic = {
    code: 'GARAK_PROJECT_GAIN_RANGE',
    path: 'product.json.defaults.gainDb',
    message: 'Out of range.',
  };
  assert.equal(diagnosticTargetsField(diagnostic, 'gainDb'), true);
  assert.equal(diagnosticTargetsField(diagnostic, 'name'), false);
});
