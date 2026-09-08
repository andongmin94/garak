import { fail } from "./errors.ts";
import { PRODUCT_JSON_FILENAME, isJsonObject } from "./project_model.ts";

export const PRODUCT_GRAPH_SCHEMA_V1 = 1 as const;
export const PRODUCT_GRAPH_SCHEMA_V2 = 2 as const;
export const PRODUCT_GRAPH_SCHEMA_VERSION = 3 as const;
export const PRODUCT_GRAPH_AUDIO_PORT = "audio" as const;
export const PRODUCT_GRAPH_NODE_ID_MAXIMUM_CHARACTERS = 64;
export const PRODUCT_GRAPH_NODE_TYPE = Object.freeze({
  audioInput: "garak.audio-input",
  gain: "garak.gain",
  polarity: "garak.polarity",
  saturation: "garak.saturation",
  audioOutput: "garak.audio-output",
});
export const PRODUCT_GRAPH_IMPLEMENTATION_VERSION = 1 as const;

export type ProductGraphNodeType =
  (typeof PRODUCT_GRAPH_NODE_TYPE)[keyof typeof PRODUCT_GRAPH_NODE_TYPE];
export type ProductGraphNodeTypeV1 = Exclude<
  ProductGraphNodeType,
  | typeof PRODUCT_GRAPH_NODE_TYPE.polarity
  | typeof PRODUCT_GRAPH_NODE_TYPE.saturation
>;
export type ProductGraphNodeTypeV2 = Exclude<
  ProductGraphNodeType,
  typeof PRODUCT_GRAPH_NODE_TYPE.saturation
>;

type ProductGraphSchemaVersion =
  | typeof PRODUCT_GRAPH_SCHEMA_V1
  | typeof PRODUCT_GRAPH_SCHEMA_V2
  | typeof PRODUCT_GRAPH_SCHEMA_VERSION;

export interface ProductGraphNode {
  readonly id: string;
  readonly type: ProductGraphNodeType;
  readonly implementationVersion: typeof PRODUCT_GRAPH_IMPLEMENTATION_VERSION;
}

export interface ProductGraphNodeV1 {
  readonly id: string;
  readonly type: ProductGraphNodeTypeV1;
  readonly implementationVersion: typeof PRODUCT_GRAPH_IMPLEMENTATION_VERSION;
}

export interface ProductGraphNodeV2 {
  readonly id: string;
  readonly type: ProductGraphNodeTypeV2;
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

export interface ProductGraphSourceV1 {
  readonly schemaVersion: typeof PRODUCT_GRAPH_SCHEMA_V1;
  readonly nodes: readonly ProductGraphNodeV1[];
  readonly connections: readonly ProductGraphConnection[];
}

export interface ProductGraphSourceV2 {
  readonly schemaVersion: typeof PRODUCT_GRAPH_SCHEMA_V2;
  readonly nodes: readonly ProductGraphNodeV2[];
  readonly connections: readonly ProductGraphConnection[];
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
  schemaVersion: number,
): void {
  const expectedSet = new Set(expected);
  const unknown = Object.keys(value)
    .filter((key) => !expectedSet.has(key))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (unknown[0] !== undefined) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_UNKNOWN_FIELD",
      field.length === 0 ? unknown[0] : `${field}.${unknown[0]}`,
      `Unknown graph field '${unknown[0]}' is not allowed by graph source v${schemaVersion}.`,
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

function requireObject(value: unknown, field: string): Record<string, unknown> {
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

function requireNodeType(
  value: unknown,
  schemaVersion: ProductGraphSchemaVersion,
  field: string,
): ProductGraphNodeType {
  if (
    value === PRODUCT_GRAPH_NODE_TYPE.audioInput ||
    value === PRODUCT_GRAPH_NODE_TYPE.gain ||
    value === PRODUCT_GRAPH_NODE_TYPE.audioOutput
  ) {
    return value;
  }
  if (
    schemaVersion >= PRODUCT_GRAPH_SCHEMA_V2 &&
    value === PRODUCT_GRAPH_NODE_TYPE.polarity
  ) {
    return value;
  }
  if (
    schemaVersion === PRODUCT_GRAPH_SCHEMA_VERSION &&
    value === PRODUCT_GRAPH_NODE_TYPE.saturation
  ) {
    return value;
  }
  graphFailure(
    "GARAK_PROJECT_GRAPH_NODE_TYPE",
    field,
    `Graph node type is not supported by graph source v${schemaVersion}.`,
  );
}

function validateNode(
  value: unknown,
  index: number,
  schemaVersion: ProductGraphSchemaVersion,
): ProductGraphNode {
  const field = `nodes.${index}`;
  const node = requireObject(value, field);
  assertExactKeys(node, NODE_KEYS, field, schemaVersion);
  const id = requireNodeId(node.id, `${field}.id`);
  const type = requireNodeType(node.type, schemaVersion, `${field}.type`);
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
  schemaVersion: number,
): ProductGraphEndpoint {
  const endpoint = requireObject(value, field);
  assertExactKeys(endpoint, ENDPOINT_KEYS, field, schemaVersion);
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
  schemaVersion: number,
): ProductGraphConnection {
  const field = `connections.${index}`;
  const connection = requireObject(value, field);
  assertExactKeys(connection, CONNECTION_KEYS, field, schemaVersion);
  return {
    from: validateEndpoint(connection.from, `${field}.from`, schemaVersion),
    to: validateEndpoint(connection.to, `${field}.to`, schemaVersion),
  };
}

function connectionKey(connection: ProductGraphConnection): string {
  return `${connection.from.nodeId}.${connection.from.port}->${connection.to.nodeId}.${connection.to.port}`;
}

function copyConnection(fromNodeId: string, toNodeId: string): ProductGraphConnection {
  return {
    from: { nodeId: fromNodeId, port: PRODUCT_GRAPH_AUDIO_PORT },
    to: { nodeId: toNodeId, port: PRODUCT_GRAPH_AUDIO_PORT },
  };
}

interface ValidatedGraphCommon {
  readonly nodes: readonly ProductGraphNode[];
  readonly nodesById: ReadonlyMap<string, ProductGraphNode>;
  readonly nodesByType: ReadonlyMap<ProductGraphNodeType, ProductGraphNode>;
  readonly connections: readonly ProductGraphConnection[];
  readonly connectionKeys: ReadonlySet<string>;
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
      "Current graph source must be acyclic.",
    );
  }
}

function validateGraphCommon(
  value: unknown,
  schemaVersion: ProductGraphSchemaVersion,
): ValidatedGraphCommon {
  const graph = requireObject(value, "");
  assertExactKeys(graph, GRAPH_KEYS, "", schemaVersion);
  if (graph.schemaVersion !== schemaVersion) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_SCHEMA_VERSION",
      "schemaVersion",
      `Graph schemaVersion must be exactly ${schemaVersion}.`,
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
  if (
    schemaVersion === PRODUCT_GRAPH_SCHEMA_V1
      ? graph.nodes.length !== 3
      : graph.nodes.length !== 3 && graph.nodes.length !== 4
  ) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_NODE_COUNT",
      "nodes",
      `Graph source v${schemaVersion} has an unsupported node count.`,
    );
  }
  if (graph.connections.length !== graph.nodes.length - 1) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_CONNECTION_COUNT",
      "connections",
      `Graph source v${schemaVersion} has an unsupported connection count.`,
    );
  }

  const nodes = graph.nodes.map((node, index) =>
    validateNode(node, index, schemaVersion),
  );
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

  const connections: ProductGraphConnection[] = [];
  const connectionKeys = new Set<string>();
  for (let index = 0; index < graph.connections.length; index += 1) {
    const connection = validateConnection(
      graph.connections[index],
      index,
      schemaVersion,
    );
    if (
      !nodesById.has(connection.from.nodeId) ||
      !nodesById.has(connection.to.nodeId)
    ) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_MISSING_ENDPOINT",
        `connections.${index}`,
        "Every graph connection endpoint must identify an existing node.",
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
    connections.push(connection);
    connectionKeys.add(key);
  }
  assertConnectionDirections(connections, nodesById);
  assertAcyclic(connections, nodesById);
  return { nodes, nodesById, nodesByType, connections, connectionKeys };
}

function requiredNode<T extends ProductGraphNodeType>(
  nodesByType: ReadonlyMap<ProductGraphNodeType, ProductGraphNode>,
  type: T,
): ProductGraphNode & { readonly type: T } {
  const node = nodesByType.get(type);
  if (node === undefined || node.type !== type) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_MISSING_NODE_TYPE",
      "nodes",
      `Graph requires one '${type}' node.`,
    );
  }
  return { ...node, type };
}

function assertExactLinearTopology(
  connectionKeys: ReadonlySet<string>,
  orderedNodes: readonly ProductGraphNode[],
  schemaVersion: number,
): void {
  if (connectionKeys.size !== orderedNodes.length - 1) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_DISCONNECTED",
      "connections",
      `Graph source v${schemaVersion} must connect every node in one supported linear chain.`,
    );
  }
  for (let index = 0; index + 1 < orderedNodes.length; index += 1) {
    const from = orderedNodes[index];
    const to = orderedNodes[index + 1];
    if (
      from === undefined ||
      to === undefined ||
      !connectionKeys.has(connectionKey(copyConnection(from.id, to.id)))
    ) {
      graphFailure(
        "GARAK_PROJECT_GRAPH_DISCONNECTED",
        "connections",
        `Graph source v${schemaVersion} must connect every node in one supported linear chain.`,
      );
    }
  }
}

function canonicalNode(
  id: string,
  type: ProductGraphNodeType,
): ProductGraphNode {
  return { id, type, implementationVersion: PRODUCT_GRAPH_IMPLEMENTATION_VERSION };
}

export function canonicalProductGraphSourceV1(): ProductGraphSourceV1 {
  return {
    schemaVersion: PRODUCT_GRAPH_SCHEMA_V1,
    nodes: [
      canonicalNode("input", PRODUCT_GRAPH_NODE_TYPE.audioInput),
      canonicalNode("gain", PRODUCT_GRAPH_NODE_TYPE.gain),
      canonicalNode("output", PRODUCT_GRAPH_NODE_TYPE.audioOutput),
    ],
    connections: [
      copyConnection("input", "gain"),
      copyConnection("gain", "output"),
    ],
  };
}

export function canonicalProductGraphSource(): ProductGraphSource {
  return migrateProductGraphV2ToV3(
    migrateProductGraphV1ToV2(canonicalProductGraphSourceV1()),
  );
}

export function canonicalPolarityProductGraphSource(): ProductGraphSource {
  return validateProductGraphSource({
    schemaVersion: PRODUCT_GRAPH_SCHEMA_VERSION,
    nodes: [
      canonicalNode("input", PRODUCT_GRAPH_NODE_TYPE.audioInput),
      canonicalNode("gain", PRODUCT_GRAPH_NODE_TYPE.gain),
      canonicalNode("polarity", PRODUCT_GRAPH_NODE_TYPE.polarity),
      canonicalNode("output", PRODUCT_GRAPH_NODE_TYPE.audioOutput),
    ],
    connections: [
      copyConnection("input", "gain"),
      copyConnection("gain", "polarity"),
      copyConnection("polarity", "output"),
    ],
  });
}

export function canonicalSaturationProductGraphSource(): ProductGraphSource {
  return validateProductGraphSource({
    schemaVersion: PRODUCT_GRAPH_SCHEMA_VERSION,
    nodes: [
      canonicalNode("input", PRODUCT_GRAPH_NODE_TYPE.audioInput),
      canonicalNode("gain", PRODUCT_GRAPH_NODE_TYPE.gain),
      canonicalNode("saturation", PRODUCT_GRAPH_NODE_TYPE.saturation),
      canonicalNode("output", PRODUCT_GRAPH_NODE_TYPE.audioOutput),
    ],
    connections: [
      copyConnection("input", "gain"),
      copyConnection("gain", "saturation"),
      copyConnection("saturation", "output"),
    ],
  });
}

export function validateProductGraphSourceV1(
  value: unknown,
): ProductGraphSourceV1 {
  const validated = validateGraphCommon(value, PRODUCT_GRAPH_SCHEMA_V1);
  const input = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.audioInput);
  const gain = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.gain);
  const output = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.audioOutput);
  const ordered: readonly ProductGraphNodeV1[] = [input, gain, output];
  if (validated.nodes.length !== ordered.length) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_NODE_COUNT",
      "nodes",
      "Graph source v1 must contain exactly Audio Input, Gain, and Audio Output.",
    );
  }
  assertExactLinearTopology(validated.connectionKeys, ordered, PRODUCT_GRAPH_SCHEMA_V1);
  return {
    schemaVersion: PRODUCT_GRAPH_SCHEMA_V1,
    nodes: ordered.map((node) => ({ ...node })),
    connections: [
      copyConnection(input.id, gain.id),
      copyConnection(gain.id, output.id),
    ],
  };
}

export function validateProductGraphSourceV2(
  value: unknown,
): ProductGraphSourceV2 {
  const validated = validateGraphCommon(value, PRODUCT_GRAPH_SCHEMA_V2);
  const input = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.audioInput);
  const gain = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.gain);
  const output = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.audioOutput);
  const polarity = validated.nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.polarity);
  const ordered: readonly ProductGraphNodeV2[] =
    polarity === undefined
      ? [input, gain, output]
      : [
          input,
          gain,
          requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.polarity),
          output,
        ];
  if (validated.nodes.length !== ordered.length) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_NODE_COUNT",
      "nodes",
      "Graph source v2 contains an unsupported node set.",
    );
  }
  assertExactLinearTopology(validated.connectionKeys, ordered, PRODUCT_GRAPH_SCHEMA_V2);
  return {
    schemaVersion: PRODUCT_GRAPH_SCHEMA_V2,
    nodes: ordered.map((node) => ({ ...node })),
    connections: ordered.slice(0, -1).map((node, index) => {
      const next = ordered[index + 1];
      if (next === undefined) {
        graphFailure(
          "GARAK_PROJECT_GRAPH_DISCONNECTED",
          "connections",
          "Graph source v2 contains an incomplete linear chain.",
        );
      }
      return copyConnection(node.id, next.id);
    }),
  };
}

export function validateProductGraphSource(value: unknown): ProductGraphSource {
  const validated = validateGraphCommon(value, PRODUCT_GRAPH_SCHEMA_VERSION);
  const input = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.audioInput);
  const gain = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.gain);
  const output = requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.audioOutput);
  const polarity = validated.nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.polarity);
  const saturation = validated.nodesByType.get(PRODUCT_GRAPH_NODE_TYPE.saturation);
  if (polarity !== undefined && saturation !== undefined) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_NODE_COUNT",
      "nodes",
      "Graph source v3 supports at most one post-Gain node.",
    );
  }
  const ordered: readonly ProductGraphNode[] =
    polarity !== undefined
      ? [
          input,
          gain,
          requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.polarity),
          output,
        ]
      : saturation !== undefined
        ? [
            input,
            gain,
            requiredNode(validated.nodesByType, PRODUCT_GRAPH_NODE_TYPE.saturation),
            output,
          ]
        : [input, gain, output];
  if (validated.nodes.length !== ordered.length) {
    graphFailure(
      "GARAK_PROJECT_GRAPH_NODE_COUNT",
      "nodes",
      "Graph source v3 contains an unsupported node set.",
    );
  }
  assertExactLinearTopology(
    validated.connectionKeys,
    ordered,
    PRODUCT_GRAPH_SCHEMA_VERSION,
  );
  return {
    schemaVersion: PRODUCT_GRAPH_SCHEMA_VERSION,
    nodes: ordered.map((node) => ({ ...node })),
    connections: ordered.slice(0, -1).map((node, index) => {
      const next = ordered[index + 1];
      if (next === undefined) {
        graphFailure(
          "GARAK_PROJECT_GRAPH_DISCONNECTED",
          "connections",
          "Graph source v3 contains an incomplete linear chain.",
        );
      }
      return copyConnection(node.id, next.id);
    }),
  };
}

export function migrateProductGraphV1ToV2(
  source: ProductGraphSourceV1,
): ProductGraphSourceV2 {
  const validated = validateProductGraphSourceV1(source);
  return validateProductGraphSourceV2({
    schemaVersion: PRODUCT_GRAPH_SCHEMA_V2,
    nodes: validated.nodes.map((node) => ({ ...node })),
    connections: validated.connections.map((connection) => ({
      from: { ...connection.from },
      to: { ...connection.to },
    })),
  });
}

export function migrateProductGraphV2ToV3(
  source: ProductGraphSourceV2,
): ProductGraphSource {
  const validated = validateProductGraphSourceV2(source);
  return validateProductGraphSource({
    schemaVersion: PRODUCT_GRAPH_SCHEMA_VERSION,
    nodes: validated.nodes.map((node) => ({ ...node })),
    connections: validated.connections.map((connection) => ({
      from: { ...connection.from },
      to: { ...connection.to },
    })),
  });
}

export function cloneProductGraphSource(source: ProductGraphSource): ProductGraphSource {
  return validateProductGraphSource(source);
}

export function cloneProductGraphSourceV2(
  source: ProductGraphSourceV2,
): ProductGraphSourceV2 {
  return validateProductGraphSourceV2(source);
}

export function cloneProductGraphSourceV1(
  source: ProductGraphSourceV1,
): ProductGraphSourceV1 {
  return validateProductGraphSourceV1(source);
}
