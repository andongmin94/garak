import { fail } from "./errors.ts";
import { PRODUCT_JSON_FILENAME, isJsonObject } from "./project_model.ts";

export const PRODUCT_GRAPH_SCHEMA_VERSION = 1 as const;
export const PRODUCT_GRAPH_AUDIO_PORT = "audio" as const;
export const PRODUCT_GRAPH_NODE_ID_MAXIMUM_CHARACTERS = 64;
export const PRODUCT_GRAPH_NODE_TYPE = Object.freeze({
  audioInput: "garak.audio-input",
  gain: "garak.gain",
  audioOutput: "garak.audio-output",
});
export const PRODUCT_GRAPH_IMPLEMENTATION_VERSION = 1 as const;

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

const GRAPH_KEYS = Object.freeze(["schemaVersion", "nodes", "connections"]);
const NODE_KEYS = Object.freeze(["id", "type", "implementationVersion"]);
const CONNECTION_KEYS = Object.freeze(["from", "to"]);
const ENDPOINT_KEYS = Object.freeze(["nodeId", "port"]);
const NODE_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const NODE_TYPE_ORDER = new Map<ProductGraphNodeType, number>([
  [PRODUCT_GRAPH_NODE_TYPE.audioInput, 0],
  [PRODUCT_GRAPH_NODE_TYPE.gain, 1],
  [PRODUCT_GRAPH_NODE_TYPE.audioOutput, 2],
]);

function graphFailure(code: string, field: string, message: string): never {
  fail(
    code,
    field.length === 0
      ? `${PRODUCT_JSON_FILENAME}.graph`
      : `${PRODUCT_JSON_FILENAME}.graph.${field}`,
    message,
  );
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  field: string,
): void {
  const expectedSet = new Set(expected);
  const unknown = Object.keys(value)
    .filter((key) => !expectedSet.has(key))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (unknown[0] !== undefined) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_UNKNOWN_FIELD",
      field.length === 0 ? unknown[0] : `${field}.${unknown[0]}`,
      `Unknown graph field '${unknown[0]}' is not allowed by graph source v${PRODUCT_GRAPH_SCHEMA_VERSION}.`,
    );
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_MISSING_FIELD",
        field.length === 0 ? key : `${field}.${key}`,
        `Required graph field '${key}' is missing.`,
      );
    }
  }
}

function requireObject(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isJsonObject(value)) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_WRONG_TYPE",
      field,
      `${field.length === 0 ? "graph" : field} must be a JSON object.`,
    );
  }
  return value;
}

function requireNodeId(value: unknown, field: string): string {
  if (typeof value !== "string" || !NODE_ID.test(value)) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_NODE_ID",
      field,
      `Graph node IDs must match ${NODE_ID.source} and contain at most ${PRODUCT_GRAPH_NODE_ID_MAXIMUM_CHARACTERS} characters.`,
    );
  }
  return value;
}

function requireNodeType(value: unknown, field: string): ProductGraphNodeType {
  if (
    value !== PRODUCT_GRAPH_NODE_TYPE.audioInput &&
    value !== PRODUCT_GRAPH_NODE_TYPE.gain &&
    value !== PRODUCT_GRAPH_NODE_TYPE.audioOutput
  ) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_NODE_TYPE",
      field,
      "Graph node type is not supported by graph source v1.",
    );
  }
  return value;
}

function validateNode(value: unknown, index: number): ProductGraphNode {
  const field = `nodes.${index}`;
  const node = requireObject(value, field);
  assertExactKeys(node, NODE_KEYS, field);
  const id = requireNodeId(node.id, `${field}.id`);
  const type = requireNodeType(node.type, `${field}.type`);
  if (node.implementationVersion !== PRODUCT_GRAPH_IMPLEMENTATION_VERSION) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_IMPLEMENTATION_VERSION",
      `${field}.implementationVersion`,
      `Node implementationVersion must be exactly ${PRODUCT_GRAPH_IMPLEMENTATION_VERSION}.`,
    );
  }
  return {
    id,
    type,
    implementationVersion: PRODUCT_GRAPH_IMPLEMENTATION_VERSION,
  };
}

function validateEndpoint(
  value: unknown,
  field: string,
): ProductGraphEndpoint {
  const endpoint = requireObject(value, field);
  assertExactKeys(endpoint, ENDPOINT_KEYS, field);
  const nodeId = requireNodeId(endpoint.nodeId, `${field}.nodeId`);
  if (endpoint.port !== PRODUCT_GRAPH_AUDIO_PORT) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_PORT",
      `${field}.port`,
      `Graph endpoint port must be exactly '${PRODUCT_GRAPH_AUDIO_PORT}'.`,
    );
  }
  return { nodeId, port: PRODUCT_GRAPH_AUDIO_PORT };
}

function validateConnection(
  value: unknown,
  index: number,
): ProductGraphConnection {
  const field = `connections.${index}`;
  const connection = requireObject(value, field);
  assertExactKeys(connection, CONNECTION_KEYS, field);
  return {
    from: validateEndpoint(connection.from, `${field}.from`),
    to: validateEndpoint(connection.to, `${field}.to`),
  };
}

function connectionKey(connection: ProductGraphConnection): string {
  return `${connection.from.nodeId}.${connection.from.port}->${connection.to.nodeId}.${connection.to.port}`;
}

function copyConnection(
  fromNodeId: string,
  toNodeId: string,
): ProductGraphConnection {
  return {
    from: { nodeId: fromNodeId, port: PRODUCT_GRAPH_AUDIO_PORT },
    to: { nodeId: toNodeId, port: PRODUCT_GRAPH_AUDIO_PORT },
  };
}

function assertConnectionDirections(
  connections: readonly ProductGraphConnection[],
  nodesById: ReadonlyMap<string, ProductGraphNode>,
): void {
  for (let index = 0; index < connections.length; index += 1) {
    const connection = connections[index];
    if (connection === undefined) {
      continue;
    }
    const from = nodesById.get(connection.from.nodeId);
    const to = nodesById.get(connection.to.nodeId);
    if (from?.type === PRODUCT_GRAPH_NODE_TYPE.audioOutput) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_INVALID_DIRECTION",
        `connections.${index}.from.nodeId`,
        "Audio Output cannot be a graph connection source.",
      );
    }
    if (to?.type === PRODUCT_GRAPH_NODE_TYPE.audioInput) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_INVALID_DIRECTION",
        `connections.${index}.to.nodeId`,
        "Audio Input cannot be a graph connection target.",
      );
    }
  }
}

function assertAcyclic(
  connections: readonly ProductGraphConnection[],
  nodesById: ReadonlyMap<string, ProductGraphNode>,
): void {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const nodeId of nodesById.keys()) {
    indegree.set(nodeId, 0);
    outgoing.set(nodeId, []);
  }
  for (const connection of connections) {
    indegree.set(
      connection.to.nodeId,
      (indegree.get(connection.to.nodeId) ?? 0) + 1,
    );
    outgoing.get(connection.from.nodeId)?.push(connection.to.nodeId);
  }
  const queue = [...nodesById.keys()].filter(
    (nodeId) => indegree.get(nodeId) === 0,
  );
  let visited = 0;
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (nodeId === undefined) {
      break;
    }
    visited += 1;
    for (const next of outgoing.get(nodeId) ?? []) {
      const nextIndegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(next);
      }
    }
  }
  if (visited !== nodesById.size) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_CYCLE",
      "connections",
      "Graph source v1 must be acyclic.",
    );
  }
}

function assertConnectedGainChain(
  connections: readonly ProductGraphConnection[],
  audioInput: ProductGraphNode,
  gain: ProductGraphNode,
  audioOutput: ProductGraphNode,
): void {
  const outgoing = new Map<string, string[]>();
  for (const connection of connections) {
    const targets = outgoing.get(connection.from.nodeId) ?? [];
    targets.push(connection.to.nodeId);
    outgoing.set(connection.from.nodeId, targets);
  }
  const firstTargets = outgoing.get(audioInput.id) ?? [];
  const gainTargets = outgoing.get(gain.id) ?? [];
  const outputTargets = outgoing.get(audioOutput.id) ?? [];
  if (
    firstTargets.length !== 1 ||
    firstTargets[0] !== gain.id ||
    gainTargets.length !== 1 ||
    gainTargets[0] !== audioOutput.id ||
    outputTargets.length !== 0
  ) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_DISCONNECTED",
      "connections",
      "Graph source v1 must connect every node as Audio Input -> Gain -> Audio Output.",
    );
  }
}

export function canonicalProductGraphSource(): ProductGraphSource {
  return {
    schemaVersion: PRODUCT_GRAPH_SCHEMA_VERSION,
    nodes: [
      {
        id: "input",
        type: PRODUCT_GRAPH_NODE_TYPE.audioInput,
        implementationVersion: PRODUCT_GRAPH_IMPLEMENTATION_VERSION,
      },
      {
        id: "gain",
        type: PRODUCT_GRAPH_NODE_TYPE.gain,
        implementationVersion: PRODUCT_GRAPH_IMPLEMENTATION_VERSION,
      },
      {
        id: "output",
        type: PRODUCT_GRAPH_NODE_TYPE.audioOutput,
        implementationVersion: PRODUCT_GRAPH_IMPLEMENTATION_VERSION,
      },
    ],
    connections: [copyConnection("input", "gain"), copyConnection("gain", "output")],
  };
}

export function validateProductGraphSource(value: unknown): ProductGraphSource {
  const graph = requireObject(value, "");
  assertExactKeys(graph, GRAPH_KEYS, "");
  if (graph.schemaVersion !== PRODUCT_GRAPH_SCHEMA_VERSION) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_SCHEMA_VERSION",
      "schemaVersion",
      `Graph schemaVersion must be exactly ${PRODUCT_GRAPH_SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(graph.nodes)) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_WRONG_TYPE",
      "nodes",
      "graph.nodes must be an array.",
    );
  }
  if (!Array.isArray(graph.connections)) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_WRONG_TYPE",
      "connections",
      "graph.connections must be an array.",
    );
  }
  if (graph.nodes.length !== 3) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_NODE_COUNT",
      "nodes",
      "Graph source v1 must contain exactly three nodes.",
    );
  }
  if (graph.connections.length !== 2) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_CONNECTION_COUNT",
      "connections",
      "Graph source v1 must contain exactly two connections.",
    );
  }

  const nodes = graph.nodes.map(validateNode);
  const nodesById = new Map<string, ProductGraphNode>();
  const nodesByType = new Map<ProductGraphNodeType, ProductGraphNode>();
  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_DUPLICATE_NODE_ID",
        "nodes",
        `Graph node ID '${node.id}' is duplicated.`,
      );
    }
    if (nodesByType.has(node.type)) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_DUPLICATE_NODE_TYPE",
        "nodes",
        `Graph node type '${node.type}' is duplicated.`,
      );
    }
    nodesById.set(node.id, node);
    nodesByType.set(node.type, node);
  }

  const audioInput = nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.audioInput);
  const gain = nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.gain);
  const audioOutput = nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.audioOutput);
  if (audioInput === undefined || gain === undefined || audioOutput === undefined) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_MISSING_NODE_TYPE",
      "nodes",
      "Graph source v1 requires one audio input, one Gain, and one audio output node.",
    );
  }

  const connections = graph.connections.map(validateConnection);
  const connectionKeys = new Set<string>();
  for (const connection of connections) {
    if (!nodesById.has(connection.from.nodeId)) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_MISSING_ENDPOINT",
        "connections",
        `Graph connection source '${connection.from.nodeId}' does not identify a node.`,
      );
    }
    if (!nodesById.has(connection.to.nodeId)) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_MISSING_ENDPOINT",
        "connections",
        `Graph connection target '${connection.to.nodeId}' does not identify a node.`,
      );
    }
    const key = connectionKey(connection);
    if (connectionKeys.has(key)) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_DUPLICATE_CONNECTION",
        "connections",
        `Graph connection '${key}' is duplicated.`,
      );
    }
    connectionKeys.add(key);
  }

  assertConnectionDirections(connections, nodesById);
  assertAcyclic(connections, nodesById);
  assertConnectedGainChain(connections, audioInput, gain, audioOutput);

  const inputToGain = connectionKey(copyConnection(audioInput.id, gain.id));
  const gainToOutput = connectionKey(copyConnection(gain.id, audioOutput.id));
  if (
    connectionKeys.size !== 2 ||
    !connectionKeys.has(inputToGain) ||
    !connectionKeys.has(gainToOutput)
  ) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_TOPOLOGY",
      "connections",
      "Graph source v1 must be the exact current Gain execution chain.",
    );
  }

  const orderedNodes = [...nodes].sort(
    (left, right) =>
      (NODE_TYPE_ORDER.get(left.type) ?? Number.MAX_SAFE_INTEGER) -
      (NODE_TYPE_ORDER.get(right.type) ?? Number.MAX_SAFE_INTEGER),
  );
  return {
    schemaVersion: PRODUCT_GRAPH_SCHEMA_VERSION,
    nodes: orderedNodes.map((node) => ({ ...node })),
    connections: [
      copyConnection(audioInput.id, gain.id),
      copyConnection(gain.id, audioOutput.id),
    ],
  };
}

export function cloneProductGraphSource(
  source: ProductGraphSource,
): ProductGraphSource {
  return validateProductGraphSource(source);
}
