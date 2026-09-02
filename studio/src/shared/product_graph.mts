export const PRODUCT_GRAPH_SCHEMA_VERSION = 1 as const;
export const PRODUCT_GRAPH_IMPLEMENTATION_VERSION = 1 as const;
export const PRODUCT_GRAPH_AUDIO_PORT = 'audio' as const;

export const PRODUCT_GRAPH_NODE_TYPE = Object.freeze({
  audioInput: 'garak.audio-input',
  gain: 'garak.gain',
  audioOutput: 'garak.audio-output',
} as const);

export type ProductGraphNodeType =
  (typeof PRODUCT_GRAPH_NODE_TYPE)[keyof typeof PRODUCT_GRAPH_NODE_TYPE];

export interface ProductGraphNode {
  readonly id: string;
  readonly type: ProductGraphNodeType;
  readonly implementationVersion: typeof PRODUCT_GRAPH_IMPLEMENTATION_VERSION;
}

export interface ProductGraphEndpoint {
  readonly nodeId: string;
  readonly port: typeof PRODUCT_GRAPH_AUDIO_PORT;
}

export interface ProductGraphConnection {
  readonly from: ProductGraphEndpoint;
  readonly to: ProductGraphEndpoint;
}

export interface ProductGraphSource {
  readonly schemaVersion: typeof PRODUCT_GRAPH_SCHEMA_VERSION;
  readonly nodes: readonly ProductGraphNode[];
  readonly connections: readonly ProductGraphConnection[];
}

const GRAPH_NODE_ID = /^[a-z][a-z0-9-]{0,63}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isGraphNodeType(value: unknown): value is ProductGraphNodeType {
  return Object.values(PRODUCT_GRAPH_NODE_TYPE).some((nodeType) => value === nodeType);
}

function isGraphNode(value: unknown): value is ProductGraphNode {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['id', 'type', 'implementationVersion']) &&
    typeof value.id === 'string' &&
    GRAPH_NODE_ID.test(value.id) &&
    isGraphNodeType(value.type) &&
    value.implementationVersion === PRODUCT_GRAPH_IMPLEMENTATION_VERSION
  );
}

function isGraphEndpoint(value: unknown): value is ProductGraphEndpoint {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['nodeId', 'port']) &&
    typeof value.nodeId === 'string' &&
    GRAPH_NODE_ID.test(value.nodeId) &&
    value.port === PRODUCT_GRAPH_AUDIO_PORT
  );
}

function isGraphConnection(value: unknown): value is ProductGraphConnection {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['from', 'to']) &&
    isGraphEndpoint(value.from) &&
    isGraphEndpoint(value.to)
  );
}

function connectionKey(connection: ProductGraphConnection): string {
  return `${connection.from.nodeId}->${connection.to.nodeId}`;
}

export function isProductGraphSource(value: unknown): value is ProductGraphSource {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['schemaVersion', 'nodes', 'connections']) ||
    value.schemaVersion !== PRODUCT_GRAPH_SCHEMA_VERSION ||
    !Array.isArray(value.nodes) ||
    value.nodes.length !== 3 ||
    !value.nodes.every(isGraphNode) ||
    !Array.isArray(value.connections) ||
    value.connections.length !== 2 ||
    !value.connections.every(isGraphConnection)
  ) {
    return false;
  }

  const nodesById = new Map(value.nodes.map((node) => [node.id, node]));
  const nodesByType = new Map(value.nodes.map((node) => [node.type, node]));
  if (nodesById.size !== 3 || nodesByType.size !== 3) {
    return false;
  }
  const audioInput = nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.audioInput);
  const gain = nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.gain);
  const audioOutput = nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.audioOutput);
  if (audioInput === undefined || gain === undefined || audioOutput === undefined) {
    return false;
  }

  const connections = new Set<string>();
  for (const connection of value.connections) {
    if (!nodesById.has(connection.from.nodeId) || !nodesById.has(connection.to.nodeId)) {
      return false;
    }
    connections.add(connectionKey(connection));
  }
  return (
    connections.size === 2 &&
    connections.has(`${audioInput.id}->${gain.id}`) &&
    connections.has(`${gain.id}->${audioOutput.id}`)
  );
}
