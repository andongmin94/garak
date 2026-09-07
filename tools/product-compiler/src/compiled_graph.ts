import { fail } from "./errors.ts";
import {
  canonicalPolarityProductGraphSource,
  canonicalProductGraphSource,
  PRODUCT_GRAPH_NODE_TYPE,
  validateProductGraphSource,
} from "./graph_source.ts";
import type { ProductGraphSource } from "./graph_source.ts";
import { BYPASS_PARAMETER_ID, GAIN_PARAMETER_ID } from "./project_model.ts";

export const COMPILED_GRAPH_FILENAME = "graph.garakbin";
export const COMPILED_GRAPH_MAGIC = Buffer.from("GARAKGRF", "ascii");
export const COMPILED_GRAPH_MAJOR_VERSION = 1;
export const COMPILED_GRAPH_MINOR_VERSION = 1;
export const COMPILED_GRAPH_HEADER_BYTES = 32;
export const COMPILED_GRAPH_OPERATION_BYTES = 20;
export const COMPILED_GRAPH_MINIMUM_OPERATION_COUNT = 3;
export const COMPILED_GRAPH_MAXIMUM_OPERATION_COUNT = 4;
export const COMPILED_GRAPH_NO_BUFFER = 0xffff;

export const COMPILED_GRAPH_OPERATION_TYPE = Object.freeze({
  audioInput: 1,
  gain: 2,
  audioOutput: 3,
  polarity: 4,
});

export interface CompiledGraphOperation {
  readonly instanceId: number;
  readonly type: number;
  readonly inputBuffer: number;
  readonly outputBuffer: number;
  readonly primaryParameterId: number;
  readonly secondaryParameterId: number;
}

export interface CompiledGraphPlan {
  readonly operations: readonly CompiledGraphOperation[];
  readonly bufferCount: number;
  readonly latencySamples: number;
}

function graphFailure(code: string, field: string, message: string): never {
  fail(
    code,
    field.length === 0
      ? COMPILED_GRAPH_FILENAME
      : `${COMPILED_GRAPH_FILENAME}.${field}`,
    message,
  );
}

function operation(
  instanceId: number,
  type: number,
  inputBuffer: number,
  outputBuffer: number,
  primaryParameterId = 0,
  secondaryParameterId = 0,
): CompiledGraphOperation {
  return {
    instanceId,
    type,
    inputBuffer,
    outputBuffer,
    primaryParameterId,
    secondaryParameterId,
  };
}

export function compileProductGraph(
  source: ProductGraphSource,
): CompiledGraphPlan {
  const graph = validateProductGraphSource(source);
  const hasPolarity = graph.nodes.some(
    (node) => node.type === PRODUCT_GRAPH_NODE_TYPE.polarity,
  );
  if (!hasPolarity) {
    return {
      operations: [
        operation(
          1,
          COMPILED_GRAPH_OPERATION_TYPE.audioInput,
          COMPILED_GRAPH_NO_BUFFER,
          0,
        ),
        operation(
          2,
          COMPILED_GRAPH_OPERATION_TYPE.gain,
          0,
          1,
          GAIN_PARAMETER_ID,
          BYPASS_PARAMETER_ID,
        ),
        operation(
          3,
          COMPILED_GRAPH_OPERATION_TYPE.audioOutput,
          1,
          COMPILED_GRAPH_NO_BUFFER,
        ),
      ],
      bufferCount: 2,
      latencySamples: 0,
    };
  }
  return {
    operations: [
      operation(
        1,
        COMPILED_GRAPH_OPERATION_TYPE.audioInput,
        COMPILED_GRAPH_NO_BUFFER,
        0,
      ),
      operation(
        2,
        COMPILED_GRAPH_OPERATION_TYPE.gain,
        0,
        1,
        GAIN_PARAMETER_ID,
        BYPASS_PARAMETER_ID,
      ),
      operation(3, COMPILED_GRAPH_OPERATION_TYPE.polarity, 1, 2),
      operation(
        4,
        COMPILED_GRAPH_OPERATION_TYPE.audioOutput,
        2,
        COMPILED_GRAPH_NO_BUFFER,
      ),
    ],
    bufferCount: 3,
    latencySamples: 0,
  };
}

export function canonicalGainGraphPlan(): CompiledGraphPlan {
  return compileProductGraph(canonicalProductGraphSource());
}

export function canonicalPolarityGraphPlan(): CompiledGraphPlan {
  return compileProductGraph(canonicalPolarityProductGraphSource());
}

function plansEqual(left: CompiledGraphPlan, right: CompiledGraphPlan): boolean {
  return (
    left.bufferCount === right.bufferCount &&
    left.latencySamples === right.latencySamples &&
    left.operations.length === right.operations.length &&
    left.operations.every((actual, index) => {
      const wanted = right.operations[index];
      return (
        wanted !== undefined &&
        actual.instanceId === wanted.instanceId &&
        actual.type === wanted.type &&
        actual.inputBuffer === wanted.inputBuffer &&
        actual.outputBuffer === wanted.outputBuffer &&
        actual.primaryParameterId === wanted.primaryParameterId &&
        actual.secondaryParameterId === wanted.secondaryParameterId
      );
    })
  );
}

function assertSupportedPlan(plan: CompiledGraphPlan): void {
  if (
    !plansEqual(plan, canonicalGainGraphPlan()) &&
    !plansEqual(plan, canonicalPolarityGraphPlan())
  ) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_NONCANONICAL",
      "",
      "Compiled graph must match one exact current Gain-only or Gain-to-Polarity execution plan.",
    );
  }
}

function totalBytes(operationCount: number): number {
  return (
    COMPILED_GRAPH_HEADER_BYTES +
    COMPILED_GRAPH_OPERATION_BYTES * operationCount
  );
}

export function encodeCompiledGraph(plan: CompiledGraphPlan): Buffer {
  assertSupportedPlan(plan);
  const output = Buffer.alloc(totalBytes(plan.operations.length));
  COMPILED_GRAPH_MAGIC.copy(output, 0);
  output.writeUInt16LE(COMPILED_GRAPH_MAJOR_VERSION, 8);
  output.writeUInt16LE(COMPILED_GRAPH_MINOR_VERSION, 10);
  output.writeUInt32LE(COMPILED_GRAPH_HEADER_BYTES, 12);
  output.writeUInt32LE(output.length, 16);
  output.writeUInt16LE(plan.operations.length, 20);
  output.writeUInt16LE(plan.bufferCount, 22);
  output.writeUInt32LE(plan.latencySamples, 24);
  output.writeUInt32LE(0, 28);

  let offset = COMPILED_GRAPH_HEADER_BYTES;
  for (const current of plan.operations) {
    output.writeUInt32LE(current.instanceId, offset);
    output.writeUInt16LE(current.type, offset + 4);
    output.writeUInt16LE(0, offset + 6);
    output.writeUInt16LE(current.inputBuffer, offset + 8);
    output.writeUInt16LE(current.outputBuffer, offset + 10);
    output.writeUInt32LE(current.primaryParameterId, offset + 12);
    output.writeUInt32LE(current.secondaryParameterId, offset + 16);
    offset += COMPILED_GRAPH_OPERATION_BYTES;
  }
  return output;
}

export function decodeCompiledGraph(input: Uint8Array): CompiledGraphPlan {
  const bytes = Buffer.from(input);
  if (bytes.length < COMPILED_GRAPH_HEADER_BYTES) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_SIZE",
      "",
      "Compiled graph is shorter than its header.",
    );
  }
  if (!bytes.subarray(0, 8).equals(COMPILED_GRAPH_MAGIC)) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_MAGIC",
      "magic",
      "Magic must be exactly 'GARAKGRF'.",
    );
  }
  if (
    bytes.readUInt16LE(8) !== COMPILED_GRAPH_MAJOR_VERSION ||
    bytes.readUInt16LE(10) !== COMPILED_GRAPH_MINOR_VERSION
  ) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_VERSION",
      "version",
      "Compiled graph format version must be exactly 1.1.",
    );
  }
  const operationCount = bytes.readUInt16LE(20);
  if (
    operationCount < COMPILED_GRAPH_MINIMUM_OPERATION_COUNT ||
    operationCount > COMPILED_GRAPH_MAXIMUM_OPERATION_COUNT ||
    bytes.readUInt32LE(12) !== COMPILED_GRAPH_HEADER_BYTES ||
    bytes.readUInt32LE(16) !== bytes.length ||
    bytes.length !== totalBytes(operationCount)
  ) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_LAYOUT",
      "header",
      "Compiled graph header does not match the exact v1.1 variable-operation layout.",
    );
  }
  if (bytes.readUInt32LE(28) !== 0) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_RESERVED",
      "header.reserved",
      "Compiled graph reserved header field must be zero.",
    );
  }

  const operations: CompiledGraphOperation[] = [];
  let offset = COMPILED_GRAPH_HEADER_BYTES;
  for (let index = 0; index < operationCount; index += 1) {
    if (bytes.readUInt16LE(offset + 6) !== 0) {
      graphFailure(
        "GARAK_COMPILED_GRAPH_RESERVED",
        `operations.${index}.reserved`,
        "Compiled graph operation reserved field must be zero.",
      );
    }
    operations.push({
      instanceId: bytes.readUInt32LE(offset),
      type: bytes.readUInt16LE(offset + 4),
      inputBuffer: bytes.readUInt16LE(offset + 8),
      outputBuffer: bytes.readUInt16LE(offset + 10),
      primaryParameterId: bytes.readUInt32LE(offset + 12),
      secondaryParameterId: bytes.readUInt32LE(offset + 16),
    });
    offset += COMPILED_GRAPH_OPERATION_BYTES;
  }

  const plan: CompiledGraphPlan = {
    operations,
    bufferCount: bytes.readUInt16LE(22),
    latencySamples: bytes.readUInt32LE(24),
  };
  assertSupportedPlan(plan);
  return plan;
}
