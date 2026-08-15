import { fail } from "./errors.ts";
import {
  BYPASS_PARAMETER_ID,
  GAIN_PARAMETER_ID,
  PRODUCT_TEMPLATE_ID,
  PRODUCT_TEMPLATE_VERSION,
} from "./project_model.ts";
import type { ProductProject } from "./project_model.ts";

export const STATIC_GRAPH_RESOURCE_FILENAME = "graph.garakbin";
export const STATIC_GRAPH_MAGIC = Buffer.from("GARAKGPH", "ascii");
export const STATIC_GRAPH_TOTAL_BYTES = 220;
export const STATIC_GRAPH_NO_BUFFER = 0xffff;

const HEADER_BYTES = 32;
const NODE_BYTES = 24;
const EDGE_BYTES = 16;
const OPERATION_BYTES = 28;
const NODE_COUNT = 3;
const EDGE_COUNT = 2;
const OPERATION_COUNT = 3;
const BUFFER_COUNT = 2;
const AUDIO_PORT_TYPE = 1;
const CHANNEL_POLICIES = Object.freeze({ main: 1, mono: 2, stereo: 3 });
const NODE_TYPES = Object.freeze({
  "audio-input": Object.freeze({ id: 1, audioInputs: 0, audioOutputs: 1, controls: 0 }),
  gain: Object.freeze({ id: 2, audioInputs: 1, audioOutputs: 1, controls: 2 }),
  "audio-output": Object.freeze({ id: 3, audioInputs: 1, audioOutputs: 0, controls: 0 }),
});

export type StaticGraphNodeKind = keyof typeof NODE_TYPES;
export type StaticGraphChannelPolicy = keyof typeof CHANNEL_POLICIES;

export interface StaticGraphNode {
  readonly instanceId: number;
  readonly kind: StaticGraphNodeKind;
  readonly implementation: { readonly major: number; readonly minor: number };
  readonly channelPolicy: StaticGraphChannelPolicy;
}

export interface StaticGraphEdge {
  readonly sourceNode: number;
  readonly sourcePort: number;
  readonly targetNode: number;
  readonly targetPort: number;
  readonly portType: "audio";
}

export interface StaticGraphDefinition {
  readonly nodes: readonly StaticGraphNode[];
  readonly edges: readonly StaticGraphEdge[];
}

export interface StaticGraphNodePlan {
  readonly instanceId: number;
  readonly typeId: number;
  readonly implementationMajor: number;
  readonly implementationMinor: number;
  readonly audioInputCount: number;
  readonly audioOutputCount: number;
  readonly controlInputCount: number;
  readonly channelPolicy: number;
  readonly intrinsicLatencySamples: number;
}

export interface StaticGraphEdgePlan {
  readonly sourceNode: number;
  readonly sourcePort: number;
  readonly portType: number;
  readonly targetNode: number;
  readonly targetPort: number;
}

export interface StaticGraphOperation {
  readonly instanceId: number;
  readonly typeId: number;
  readonly implementationMajor: number;
  readonly implementationMinor: number;
  readonly inputBuffer: number;
  readonly outputBuffer: number;
  readonly primaryParameterId: number;
  readonly secondaryParameterId: number;
  readonly cumulativeLatencySamples: number;
}

export interface StaticExecutionPlan {
  readonly nodes: readonly StaticGraphNodePlan[];
  readonly edges: readonly StaticGraphEdgePlan[];
  readonly operations: readonly StaticGraphOperation[];
  readonly bufferCount: number;
  readonly totalLatencySamples: number;
}

export const REFERENCE_GAIN_GRAPH: StaticGraphDefinition = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({
      instanceId: 1,
      kind: "audio-input",
      implementation: Object.freeze({ major: 1, minor: 0 }),
      channelPolicy: "main",
    }),
    Object.freeze({
      instanceId: 2,
      kind: "gain",
      implementation: Object.freeze({ major: 1, minor: 0 }),
      channelPolicy: "main",
    }),
    Object.freeze({
      instanceId: 3,
      kind: "audio-output",
      implementation: Object.freeze({ major: 1, minor: 0 }),
      channelPolicy: "main",
    }),
  ]),
  edges: Object.freeze([
    Object.freeze({ sourceNode: 1, sourcePort: 0, targetNode: 2, targetPort: 0, portType: "audio" }),
    Object.freeze({ sourceNode: 2, sourcePort: 0, targetNode: 3, targetPort: 0, portType: "audio" }),
  ]),
});

function reject(code: string, field: string, message: string): never {
  fail(
    code,
    field.length === 0 ? STATIC_GRAPH_RESOURCE_FILENAME : `${STATIC_GRAPH_RESOURCE_FILENAME}.${field}`,
    message,
  );
}

function nodeContract(node: StaticGraphNode) {
  const contract = NODE_TYPES[node.kind];
  if (contract === undefined) {
    reject("GARAK_GRAPH_NODE_TYPE", "nodes.kind", `Unsupported node type '${String(node.kind)}'.`);
  }
  if (node.implementation.major !== 1 || node.implementation.minor !== 0) {
    reject(
      "GARAK_GRAPH_NODE_VERSION",
      `nodes.${node.instanceId}.implementation`,
      `Node '${node.kind}' must use implementation version 1.0.`,
    );
  }
  if (!Number.isSafeInteger(node.instanceId) || node.instanceId <= 0 || node.instanceId > 0xffff_ffff) {
    reject("GARAK_GRAPH_NODE_ID", `nodes.${node.instanceId}`, "Node ID must be a unique uint32.");
  }
  return contract;
}

function topologicalSchedule(
  nodes: readonly StaticGraphNode[],
  edges: readonly StaticGraphEdge[],
): readonly StaticGraphNode[] {
  const byId = new Map(nodes.map((node) => [node.instanceId, node]));
  const indegree = new Map(nodes.map((node) => [node.instanceId, 0]));
  const outgoing = new Map(nodes.map((node) => [node.instanceId, [] as number[]]));
  for (const edge of edges) {
    indegree.set(edge.targetNode, (indegree.get(edge.targetNode) ?? 0) + 1);
    outgoing.get(edge.sourceNode)?.push(edge.targetNode);
  }
  const ready = nodes
    .filter((node) => indegree.get(node.instanceId) === 0)
    .map((node) => node.instanceId)
    .sort((left, right) => left - right);
  const result: StaticGraphNode[] = [];
  while (ready.length > 0) {
    const id = ready.shift();
    const node = id === undefined ? undefined : byId.get(id);
    if (node === undefined) {
      reject("GARAK_GRAPH_NODE_REFERENCE", "schedule", "Schedule references a missing node.");
    }
    result.push(node);
    for (const target of [...(outgoing.get(node.instanceId) ?? [])].sort((a, b) => a - b)) {
      const value = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, value);
      if (value === 0) {
        ready.push(target);
        ready.sort((a, b) => a - b);
      }
    }
  }
  if (result.length !== nodes.length) {
    reject("GARAK_GRAPH_CYCLE", "edges", "Static DSP graph must be acyclic.");
  }
  return result;
}

export function compileStaticGraph(definition: StaticGraphDefinition): StaticExecutionPlan {
  if (
    definition.nodes.length === 0 ||
    definition.nodes.length > 32 ||
    definition.edges.length > 64
  ) {
    reject(
      "GARAK_GRAPH_BOUNDS",
      "",
      "Static graph must contain 1..32 nodes and at most 64 edges.",
    );
  }
  const ids = new Set<number>();
  const contracts = new Map<number, ReturnType<typeof nodeContract>>();
  for (const node of definition.nodes) {
    if (ids.has(node.instanceId)) {
      reject("GARAK_GRAPH_DUPLICATE_NODE", "nodes", "Node IDs must be unique.");
    }
    ids.add(node.instanceId);
    contracts.set(node.instanceId, nodeContract(node));
  }

  const edges = [...definition.edges].sort(
    (left, right) =>
      left.sourceNode - right.sourceNode ||
      left.sourcePort - right.sourcePort ||
      left.targetNode - right.targetNode ||
      left.targetPort - right.targetPort,
  );
  const edgeKeys = new Set<string>();
  for (const edge of edges) {
    const source = definition.nodes.find((node) => node.instanceId === edge.sourceNode);
    const target = definition.nodes.find((node) => node.instanceId === edge.targetNode);
    const sourceContract = contracts.get(edge.sourceNode);
    const targetContract = contracts.get(edge.targetNode);
    if (source === undefined || target === undefined || sourceContract === undefined || targetContract === undefined) {
      reject("GARAK_GRAPH_NODE_REFERENCE", "edges", "Every edge endpoint must exist.");
    }
    if (
      edge.portType !== "audio" ||
      edge.sourcePort < 0 ||
      edge.targetPort < 0 ||
      edge.sourcePort >= sourceContract.audioOutputs ||
      edge.targetPort >= targetContract.audioInputs
    ) {
      reject("GARAK_GRAPH_PORT_INDEX", "edges", "Edge violates the typed audio port contract.");
    }
    if (source.channelPolicy !== target.channelPolicy) {
      reject("GARAK_GRAPH_CHANNEL_MISMATCH", "edges", "Connected ports must use one channel policy.");
    }
    const key = `${edge.sourceNode}:${edge.sourcePort}>${edge.targetNode}:${edge.targetPort}`;
    if (edgeKeys.has(key)) {
      reject("GARAK_GRAPH_DUPLICATE_EDGE", "edges", "Duplicate edge is not allowed.");
    }
    edgeKeys.add(key);
  }

  const schedule = topologicalSchedule(definition.nodes, edges);
  const input = schedule[0];
  const gain = schedule[1];
  const output = schedule[2];
  if (
    input?.kind !== "audio-input" ||
    gain?.kind !== "gain" ||
    output?.kind !== "audio-output" ||
    edges[0]?.sourceNode !== input.instanceId ||
    edges[0]?.sourcePort !== 0 ||
    edges[0]?.targetNode !== gain.instanceId ||
    edges[0]?.targetPort !== 0 ||
    edges[1]?.sourceNode !== gain.instanceId ||
    edges[1]?.sourcePort !== 0 ||
    edges[1]?.targetNode !== output.instanceId ||
    edges[1]?.targetPort !== 0
  ) {
    reject(
      "GARAK_GRAPH_REFERENCE_CONNECTIONS",
      "edges",
      "Phase 3A graph must connect Input -> Gain -> Output exactly once.",
    );
  }

  const policy = CHANNEL_POLICIES[input.channelPolicy];
  const nodes = schedule.map((node): StaticGraphNodePlan => {
    const contract = contracts.get(node.instanceId);
    if (contract === undefined) {
      reject("GARAK_GRAPH_NODE_REFERENCE", "nodes", "Node contract lookup failed.");
    }
    return {
      instanceId: node.instanceId,
      typeId: contract.id,
      implementationMajor: 1,
      implementationMinor: 0,
      audioInputCount: contract.audioInputs,
      audioOutputCount: contract.audioOutputs,
      controlInputCount: contract.controls,
      channelPolicy: policy,
      intrinsicLatencySamples: 0,
    };
  });
  const edgePlan = edges.map(
    (edge): StaticGraphEdgePlan => ({
      sourceNode: edge.sourceNode,
      sourcePort: edge.sourcePort,
      portType: AUDIO_PORT_TYPE,
      targetNode: edge.targetNode,
      targetPort: edge.targetPort,
    }),
  );
  const operations: readonly StaticGraphOperation[] = [
    { instanceId: input.instanceId, typeId: 1, implementationMajor: 1, implementationMinor: 0, inputBuffer: STATIC_GRAPH_NO_BUFFER, outputBuffer: 0, primaryParameterId: 0, secondaryParameterId: 0, cumulativeLatencySamples: 0 },
    { instanceId: gain.instanceId, typeId: 2, implementationMajor: 1, implementationMinor: 0, inputBuffer: 0, outputBuffer: 1, primaryParameterId: GAIN_PARAMETER_ID, secondaryParameterId: BYPASS_PARAMETER_ID, cumulativeLatencySamples: 0 },
    { instanceId: output.instanceId, typeId: 3, implementationMajor: 1, implementationMinor: 0, inputBuffer: 1, outputBuffer: STATIC_GRAPH_NO_BUFFER, primaryParameterId: 0, secondaryParameterId: 0, cumulativeLatencySamples: 0 },
  ];
  return { nodes, edges: edgePlan, operations, bufferCount: BUFFER_COUNT, totalLatencySamples: 0 };
}

function canonicalPlan(plan: StaticExecutionPlan): void {
  const policy = plan.nodes[0]?.channelPolicy;
  const supportedPolicy = Object.values(CHANNEL_POLICIES).includes(policy ?? 0);
  if (
    plan.nodes.length !== NODE_COUNT ||
    plan.edges.length !== EDGE_COUNT ||
    plan.operations.length !== OPERATION_COUNT ||
    plan.bufferCount !== BUFFER_COUNT ||
    plan.totalLatencySamples !== 0 ||
    !supportedPolicy ||
    plan.nodes.some((node) => node.channelPolicy !== policy)
  ) {
    reject("GARAK_GRAPH_PLAN_SHAPE", "", "Execution plan does not match graph v1.");
  }
  const expected = compileStaticGraph({
    nodes: REFERENCE_GAIN_GRAPH.nodes.map((node) => ({ ...node, channelPolicy: policy === 2 ? "mono" : policy === 3 ? "stereo" : "main" })),
    edges: REFERENCE_GAIN_GRAPH.edges,
  });
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    reject("GARAK_GRAPH_NONCANONICAL", "", "Execution plan is not canonical.");
  }
}

export function encodeStaticExecutionPlan(plan: StaticExecutionPlan): Buffer {
  canonicalPlan(plan);
  const output = Buffer.alloc(STATIC_GRAPH_TOTAL_BYTES);
  STATIC_GRAPH_MAGIC.copy(output, 0);
  output.writeUInt16LE(1, 8);
  output.writeUInt16LE(0, 10);
  output.writeUInt32LE(HEADER_BYTES, 12);
  output.writeUInt32LE(STATIC_GRAPH_TOTAL_BYTES, 16);
  output.writeUInt16LE(NODE_COUNT, 20);
  output.writeUInt16LE(EDGE_COUNT, 22);
  output.writeUInt16LE(OPERATION_COUNT, 24);
  output.writeUInt16LE(BUFFER_COUNT, 26);
  output.writeUInt32LE(0, 28);
  let offset = HEADER_BYTES;
  for (const node of plan.nodes) {
    output.writeUInt32LE(node.instanceId, offset);
    output.writeUInt32LE(node.typeId, offset + 4);
    output.writeUInt16LE(node.implementationMajor, offset + 8);
    output.writeUInt16LE(node.implementationMinor, offset + 10);
    output.writeUInt16LE(node.audioInputCount, offset + 12);
    output.writeUInt16LE(node.audioOutputCount, offset + 14);
    output.writeUInt16LE(node.controlInputCount, offset + 16);
    output.writeUInt16LE(node.channelPolicy, offset + 18);
    output.writeUInt32LE(node.intrinsicLatencySamples, offset + 20);
    offset += NODE_BYTES;
  }
  for (const edge of plan.edges) {
    output.writeUInt32LE(edge.sourceNode, offset);
    output.writeUInt16LE(edge.sourcePort, offset + 4);
    output.writeUInt16LE(edge.portType, offset + 6);
    output.writeUInt32LE(edge.targetNode, offset + 8);
    output.writeUInt16LE(edge.targetPort, offset + 12);
    output.writeUInt16LE(0, offset + 14);
    offset += EDGE_BYTES;
  }
  for (const operation of plan.operations) {
    output.writeUInt32LE(operation.instanceId, offset);
    output.writeUInt32LE(operation.typeId, offset + 4);
    output.writeUInt16LE(operation.implementationMajor, offset + 8);
    output.writeUInt16LE(operation.implementationMinor, offset + 10);
    output.writeUInt16LE(operation.inputBuffer, offset + 12);
    output.writeUInt16LE(operation.outputBuffer, offset + 14);
    output.writeUInt32LE(operation.primaryParameterId, offset + 16);
    output.writeUInt32LE(operation.secondaryParameterId, offset + 20);
    output.writeUInt32LE(operation.cumulativeLatencySamples, offset + 24);
    offset += OPERATION_BYTES;
  }
  return output;
}

function readNode(bytes: Buffer, offset: number): StaticGraphNodePlan {
  return { instanceId: bytes.readUInt32LE(offset), typeId: bytes.readUInt32LE(offset + 4), implementationMajor: bytes.readUInt16LE(offset + 8), implementationMinor: bytes.readUInt16LE(offset + 10), audioInputCount: bytes.readUInt16LE(offset + 12), audioOutputCount: bytes.readUInt16LE(offset + 14), controlInputCount: bytes.readUInt16LE(offset + 16), channelPolicy: bytes.readUInt16LE(offset + 18), intrinsicLatencySamples: bytes.readUInt32LE(offset + 20) };
}

function readEdge(bytes: Buffer, offset: number): StaticGraphEdgePlan {
  if (bytes.readUInt16LE(offset + 14) !== 0) {
    reject("GARAK_GRAPH_RESERVED_NONZERO", "edges.reserved", "Edge reserved field must be zero.");
  }
  return { sourceNode: bytes.readUInt32LE(offset), sourcePort: bytes.readUInt16LE(offset + 4), portType: bytes.readUInt16LE(offset + 6), targetNode: bytes.readUInt32LE(offset + 8), targetPort: bytes.readUInt16LE(offset + 12) };
}

function readOperation(bytes: Buffer, offset: number): StaticGraphOperation {
  return { instanceId: bytes.readUInt32LE(offset), typeId: bytes.readUInt32LE(offset + 4), implementationMajor: bytes.readUInt16LE(offset + 8), implementationMinor: bytes.readUInt16LE(offset + 10), inputBuffer: bytes.readUInt16LE(offset + 12), outputBuffer: bytes.readUInt16LE(offset + 14), primaryParameterId: bytes.readUInt32LE(offset + 16), secondaryParameterId: bytes.readUInt32LE(offset + 20), cumulativeLatencySamples: bytes.readUInt32LE(offset + 24) };
}

export function decodeStaticExecutionPlan(input: Uint8Array): StaticExecutionPlan {
  const bytes = Buffer.from(input);
  if (bytes.length !== STATIC_GRAPH_TOTAL_BYTES) {
    reject("GARAK_GRAPH_SIZE", "", `Static graph plan must contain ${STATIC_GRAPH_TOTAL_BYTES} bytes.`);
  }
  if (!bytes.subarray(0, 8).equals(STATIC_GRAPH_MAGIC)) {
    reject("GARAK_GRAPH_MAGIC", "magic", "Magic must be 'GARAKGPH'.");
  }
  if (bytes.readUInt16LE(8) !== 1 || bytes.readUInt16LE(10) !== 0) {
    reject("GARAK_GRAPH_VERSION", "version", "Static graph version must be 1.0.");
  }
  if (
    bytes.readUInt32LE(12) !== HEADER_BYTES ||
    bytes.readUInt32LE(16) !== bytes.length ||
    bytes.readUInt16LE(20) !== NODE_COUNT ||
    bytes.readUInt16LE(22) !== EDGE_COUNT ||
    bytes.readUInt16LE(24) !== OPERATION_COUNT ||
    bytes.readUInt16LE(26) !== BUFFER_COUNT
  ) {
    reject("GARAK_GRAPH_HEADER", "header", "Static graph header does not match v1.");
  }
  let offset = HEADER_BYTES;
  const nodes = Array.from({ length: NODE_COUNT }, () => {
    const value = readNode(bytes, offset);
    offset += NODE_BYTES;
    return value;
  });
  const edges = Array.from({ length: EDGE_COUNT }, () => {
    const value = readEdge(bytes, offset);
    offset += EDGE_BYTES;
    return value;
  });
  const operations = Array.from({ length: OPERATION_COUNT }, () => {
    const value = readOperation(bytes, offset);
    offset += OPERATION_BYTES;
    return value;
  });
  const plan = { nodes, edges, operations, bufferCount: bytes.readUInt16LE(26), totalLatencySamples: bytes.readUInt32LE(28) };
  canonicalPlan(plan);
  return plan;
}

export function encodeProductStaticGraph(project: ProductProject): Buffer {
  if (project.template.id !== PRODUCT_TEMPLATE_ID || project.template.version !== PRODUCT_TEMPLATE_VERSION) {
    reject("GARAK_GRAPH_TEMPLATE", "template", "Static graph compiler supports garak.gain v1 only.");
  }
  return encodeStaticExecutionPlan(compileStaticGraph(REFERENCE_GAIN_GRAPH));
}

export function assertStaticGraphParity(project: ProductProject, bytes: Uint8Array): void {
  if (project.template.id !== PRODUCT_TEMPLATE_ID || project.template.version !== PRODUCT_TEMPLATE_VERSION) {
    reject("GARAK_GRAPH_TEMPLATE", "template", "Static graph compiler supports garak.gain v1 only.");
  }
  decodeStaticExecutionPlan(bytes);
}
