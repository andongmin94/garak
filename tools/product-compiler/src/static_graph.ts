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
export const STATIC_GRAPH_HEADER_BYTES = 32;
export const STATIC_GRAPH_OPERATION_BYTES = 28;
export const STATIC_GRAPH_OPERATION_COUNT = 3;
export const STATIC_GRAPH_BUFFER_COUNT = 2;
export const STATIC_GRAPH_TOTAL_BYTES =
  STATIC_GRAPH_HEADER_BYTES +
  STATIC_GRAPH_OPERATION_BYTES * STATIC_GRAPH_OPERATION_COUNT;
export const STATIC_GRAPH_NO_BUFFER = 0xffff;

const STATIC_GRAPH_MAJOR_VERSION = 1;
const STATIC_GRAPH_MINOR_VERSION = 0;
const MAIN_CHANNEL_POLICY = 1;
const AUDIO_INPUT_TYPE = 1;
const GAIN_TYPE = 2;
const AUDIO_OUTPUT_TYPE = 3;

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
  readonly channelPolicy: number;
  readonly operations: readonly StaticGraphOperation[];
  readonly bufferCount: number;
  readonly totalLatencySamples: number;
}

export const REFERENCE_GAIN_PLAN: StaticExecutionPlan = {
  channelPolicy: MAIN_CHANNEL_POLICY,
  operations: [
    {
      instanceId: 1,
      typeId: AUDIO_INPUT_TYPE,
      implementationMajor: 1,
      implementationMinor: 0,
      inputBuffer: STATIC_GRAPH_NO_BUFFER,
      outputBuffer: 0,
      primaryParameterId: 0,
      secondaryParameterId: 0,
      cumulativeLatencySamples: 0,
    },
    {
      instanceId: 2,
      typeId: GAIN_TYPE,
      implementationMajor: 1,
      implementationMinor: 0,
      inputBuffer: 0,
      outputBuffer: 1,
      primaryParameterId: GAIN_PARAMETER_ID,
      secondaryParameterId: BYPASS_PARAMETER_ID,
      cumulativeLatencySamples: 0,
    },
    {
      instanceId: 3,
      typeId: AUDIO_OUTPUT_TYPE,
      implementationMajor: 1,
      implementationMinor: 0,
      inputBuffer: 1,
      outputBuffer: STATIC_GRAPH_NO_BUFFER,
      primaryParameterId: 0,
      secondaryParameterId: 0,
      cumulativeLatencySamples: 0,
    },
  ],
  bufferCount: STATIC_GRAPH_BUFFER_COUNT,
  totalLatencySamples: 0,
};

function graphFailure(code: string, field: string, message: string): never {
  fail(
    code,
    field.length === 0
      ? STATIC_GRAPH_RESOURCE_FILENAME
      : `${STATIC_GRAPH_RESOURCE_FILENAME}.${field}`,
    message,
  );
}

function assertCurrentGainTemplate(project: ProductProject): void {
  if (
    project.template.id !== PRODUCT_TEMPLATE_ID ||
    project.template.version !== PRODUCT_TEMPLATE_VERSION
  ) {
    graphFailure(
      "GARAK_GRAPH_TEMPLATE",
      "template",
      "Static graph plan supports garak.gain v1 only.",
    );
  }
}

function operationMatches(
  actual: StaticGraphOperation | undefined,
  expected: StaticGraphOperation,
): boolean {
  return (
    actual !== undefined &&
    actual.instanceId === expected.instanceId &&
    actual.typeId === expected.typeId &&
    actual.implementationMajor === expected.implementationMajor &&
    actual.implementationMinor === expected.implementationMinor &&
    actual.inputBuffer === expected.inputBuffer &&
    actual.outputBuffer === expected.outputBuffer &&
    actual.primaryParameterId === expected.primaryParameterId &&
    actual.secondaryParameterId === expected.secondaryParameterId &&
    actual.cumulativeLatencySamples === expected.cumulativeLatencySamples
  );
}

function assertCanonicalPlan(plan: StaticExecutionPlan): void {
  if (
    plan.channelPolicy !== REFERENCE_GAIN_PLAN.channelPolicy ||
    plan.operations.length !== STATIC_GRAPH_OPERATION_COUNT ||
    plan.bufferCount !== STATIC_GRAPH_BUFFER_COUNT ||
    plan.totalLatencySamples !== 0
  ) {
    graphFailure(
      "GARAK_GRAPH_PLAN_SHAPE",
      "",
      "Execution plan does not match static graph v1.",
    );
  }

  for (let index = 0; index < STATIC_GRAPH_OPERATION_COUNT; index += 1) {
    if (
      !operationMatches(
        plan.operations[index],
        REFERENCE_GAIN_PLAN.operations[index]!,
      )
    ) {
      graphFailure(
        "GARAK_GRAPH_NONCANONICAL",
        `operations.${index}`,
        "Execution operation does not match static graph v1.",
      );
    }
  }
}

function writeOperation(
  output: Buffer,
  offset: number,
  operation: StaticGraphOperation,
): void {
  output.writeUInt32LE(operation.instanceId, offset);
  output.writeUInt32LE(operation.typeId, offset + 4);
  output.writeUInt16LE(operation.implementationMajor, offset + 8);
  output.writeUInt16LE(operation.implementationMinor, offset + 10);
  output.writeUInt16LE(operation.inputBuffer, offset + 12);
  output.writeUInt16LE(operation.outputBuffer, offset + 14);
  output.writeUInt32LE(operation.primaryParameterId, offset + 16);
  output.writeUInt32LE(operation.secondaryParameterId, offset + 20);
  output.writeUInt32LE(operation.cumulativeLatencySamples, offset + 24);
}

function readOperation(bytes: Buffer, offset: number): StaticGraphOperation {
  return {
    instanceId: bytes.readUInt32LE(offset),
    typeId: bytes.readUInt32LE(offset + 4),
    implementationMajor: bytes.readUInt16LE(offset + 8),
    implementationMinor: bytes.readUInt16LE(offset + 10),
    inputBuffer: bytes.readUInt16LE(offset + 12),
    outputBuffer: bytes.readUInt16LE(offset + 14),
    primaryParameterId: bytes.readUInt32LE(offset + 16),
    secondaryParameterId: bytes.readUInt32LE(offset + 20),
    cumulativeLatencySamples: bytes.readUInt32LE(offset + 24),
  };
}

export function encodeStaticExecutionPlan(plan: StaticExecutionPlan): Buffer {
  assertCanonicalPlan(plan);
  const output = Buffer.alloc(STATIC_GRAPH_TOTAL_BYTES);
  STATIC_GRAPH_MAGIC.copy(output, 0);
  output.writeUInt16LE(STATIC_GRAPH_MAJOR_VERSION, 8);
  output.writeUInt16LE(STATIC_GRAPH_MINOR_VERSION, 10);
  output.writeUInt32LE(STATIC_GRAPH_HEADER_BYTES, 12);
  output.writeUInt32LE(STATIC_GRAPH_TOTAL_BYTES, 16);
  output.writeUInt16LE(STATIC_GRAPH_OPERATION_COUNT, 20);
  output.writeUInt16LE(STATIC_GRAPH_BUFFER_COUNT, 22);
  output.writeUInt16LE(plan.channelPolicy, 24);
  output.writeUInt16LE(0, 26);
  output.writeUInt32LE(plan.totalLatencySamples, 28);

  let offset = STATIC_GRAPH_HEADER_BYTES;
  for (const operation of plan.operations) {
    writeOperation(output, offset, operation);
    offset += STATIC_GRAPH_OPERATION_BYTES;
  }
  return output;
}

export function decodeStaticExecutionPlan(
  input: Uint8Array,
): StaticExecutionPlan {
  const bytes = Buffer.from(input);
  if (bytes.length !== STATIC_GRAPH_TOTAL_BYTES) {
    graphFailure(
      "GARAK_GRAPH_SIZE",
      "",
      `Static graph plan must contain ${STATIC_GRAPH_TOTAL_BYTES} bytes.`,
    );
  }
  if (!bytes.subarray(0, 8).equals(STATIC_GRAPH_MAGIC)) {
    graphFailure("GARAK_GRAPH_MAGIC", "magic", "Magic must be 'GARAKGPH'.");
  }
  if (
    bytes.readUInt16LE(8) !== STATIC_GRAPH_MAJOR_VERSION ||
    bytes.readUInt16LE(10) !== STATIC_GRAPH_MINOR_VERSION
  ) {
    graphFailure(
      "GARAK_GRAPH_VERSION",
      "version",
      "Static graph version must be exactly 1.0.",
    );
  }
  if (
    bytes.readUInt32LE(12) !== STATIC_GRAPH_HEADER_BYTES ||
    bytes.readUInt32LE(16) !== STATIC_GRAPH_TOTAL_BYTES ||
    bytes.readUInt16LE(20) !== STATIC_GRAPH_OPERATION_COUNT ||
    bytes.readUInt16LE(22) !== STATIC_GRAPH_BUFFER_COUNT
  ) {
    graphFailure(
      "GARAK_GRAPH_HEADER",
      "header",
      "Static graph header does not match v1.",
    );
  }
  if (bytes.readUInt16LE(26) !== 0) {
    graphFailure(
      "GARAK_GRAPH_RESERVED_NONZERO",
      "header.reserved",
      "Static graph reserved field must be zero.",
    );
  }

  let offset = STATIC_GRAPH_HEADER_BYTES;
  const operations = Array.from(
    { length: STATIC_GRAPH_OPERATION_COUNT },
    () => {
      const operation = readOperation(bytes, offset);
      offset += STATIC_GRAPH_OPERATION_BYTES;
      return operation;
    },
  );
  const plan: StaticExecutionPlan = {
    channelPolicy: bytes.readUInt16LE(24),
    operations,
    bufferCount: bytes.readUInt16LE(22),
    totalLatencySamples: bytes.readUInt32LE(28),
  };
  assertCanonicalPlan(plan);
  return plan;
}

export function encodeProductStaticGraph(project: ProductProject): Buffer {
  assertCurrentGainTemplate(project);
  return encodeStaticExecutionPlan(REFERENCE_GAIN_PLAN);
}

export function assertStaticGraphParity(
  project: ProductProject,
  bytes: Uint8Array,
): void {
  assertCurrentGainTemplate(project);
  decodeStaticExecutionPlan(bytes);
  if (!Buffer.from(bytes).equals(encodeProductStaticGraph(project))) {
    graphFailure(
      "GARAK_GRAPH_PRODUCT_PARITY",
      "",
      "Compiled graph does not match the canonical product graph.",
    );
  }
}
