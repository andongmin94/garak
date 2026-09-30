import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalPolarityProductGraphSource,
  canonicalProductGraphSource,
  canonicalSaturationProductGraphSource,
} from '../../tools/product-compiler/src/api.ts';
import { productGraphLabel } from '../src/features/product/product_state.mts';
import { isProductGraphSource } from '../src/shared/product_graph.mts';

test('Studio graph boundary accepts every current exact compiler topology and authoring order', () => {
  for (const [graph, label] of [
    [canonicalProductGraphSource(), 'Input → Gain → Output'],
    [canonicalPolarityProductGraphSource(), 'Input → Gain → Polarity → Output'],
    [canonicalSaturationProductGraphSource(), 'Input → Gain → Saturation → Output'],
  ] as const) {
    assert.equal(isProductGraphSource(graph), true);
    assert.equal(productGraphLabel(graph), label);
    const reordered = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      connections: [...graph.connections].reverse(),
    };
    assert.equal(isProductGraphSource(reordered), true);
    assert.equal(productGraphLabel(reordered), label);
  }
});

test('Studio rejects legacy, future and unsupported Saturation graph meanings at the boundary', () => {
  const graph = canonicalSaturationProductGraphSource();
  for (const schemaVersion of [1, 2, 4]) {
    assert.equal(isProductGraphSource({ ...graph, schemaVersion }), false);
  }
  assert.equal(
    isProductGraphSource({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.type === 'garak.saturation' ? { ...node, implementationVersion: 2 } : node,
      ),
    }),
    false,
  );
  assert.equal(
    isProductGraphSource({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.type === 'garak.saturation' ? { ...node, drive: 1 } : node,
      ),
    }),
    false,
  );
  assert.equal(
    isProductGraphSource({
      ...graph,
      nodes: [...graph.nodes, { id: 'polarity', type: 'garak.polarity', implementationVersion: 1 }],
    }),
    false,
  );
  assert.equal(
    isProductGraphSource({
      ...graph,
      connections: graph.connections.map((connection) => ({
        from: connection.to,
        to: connection.from,
      })),
    }),
    false,
  );
  assert.equal(
    isProductGraphSource({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.type === 'garak.saturation' ? { ...node, type: 'garak.gain' } : node,
      ),
    }),
    false,
  );
});
