import { fail } from "./errors.ts";
import { canonicalProductGraphSource, validateProductGraphSource } from "./graph_source.ts";
import type { ProductGraphSource } from "./graph_source.ts";
import { BYPASS_PARAMETER_ID, GAIN_PARAMETER_ID } from "./project_model.ts";

export const COMPILED_GRAPH_FILENAME = "graph.garakbin";
export const COMPILED_GRAPH_MAGIC = Buffer.from("GARAKGRF", "ascii");
export const COMPILED_GRAPH_MAJOR_VERSION = 1;
export const COMPILED_GRAPH_MINOR_VERSION = 0;
export const COMPILED_GRAPH_HEADER_BYTES = 32;
export const COMPILED_GRAPH_OPERATION_BYTES = 20;
export const COMPILED_GRAPH_OPERATION_COUNT = 3;
export const COMPILED_GRAPH_TOTAL_BYTES =
  COMPILED_GRAPH_HEADER_BYTES +
  COMPILED_GRAPH_OPERATION_BYTES * COMPILED_GRAPH_OPERATION_COUNT;
export const COMPILED_GRAPH_NO_BUFFER = 0xffff;

export const COMPILED_GRAPH_OPERATION_TYPE = Object.freeze({
  audioInput: 1,
  gain: 2,
  audioOutput: 3,
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

export function compileProductGraph(
  source: ProductGraphSource,
): CompiledGraphPlan {
  validateProductGraphSource(source);
  return {
    operations: [
      {
        instanceId: 1,
        type: COMPILED_GRAPH_OPERATION_TYPE.audioInput,
        inputBuffer: COMPILED_GRAPH_NO_BUFFER,
        outputBuffer: 0,
        primaryParameterId: 0,
        secondaryParameterId: 0,
      },
      {
        instanceId: 2,
        type: COMPILED_GRAPH_OPERATION_TYPE.gain,
        inputBuffer: 0,
        outputBuffer: 1,
        primaryParameterId: GAIN_PARAMETER_ID,
        secondaryParameterId: BYPASS_PARAMETER_ID,
      },
      {
        instanceId: 3,
        type: COMPILED_GRAPH_OPERATION_TYPE.audioOutput,
        inputBuffer: 1,
        outputBuffer: COMPILED_GRAPH_NO_BUFFER,
        primaryParameterId: 0,
        secondaryParameterId: 0,
      },
    ],
    bufferCount: 2,
    latencySamples: 0,
  };
}

export function canonicalGainGraphPlan(): CompiledGraphPlan {
  return compileProductGraph(canonicalProductGraphSource());
}

function assertCanonicalGainGraph(plan: CompiledGraphPlan): void {
  const expected = canonicalGainGraphPlan();
  if (
    plan.operations.length !== expected.operations.length ||
    plan.bufferCount !== expected.bufferCount ||
    plan.latencySamples !== expected.latencySamples
  ) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_NONCANONICAL",
      "",
      "Compiled graph must match the current Input -> Gain -> Output execution plan.",
    );
  }
  for (let index = 0; index < expected.operations.length; index += 1) {
    const actual = plan.operations[index];
    const wanted = expected.operations[index];
    if (
      actual === undefined ||
      wanted === undefined ||
      actual.instanceId !== wanted.instanceId ||
      actual.type !== wanted.type ||
      actual.inputBuffer !== wanted.inputBuffer ||
      actual.outputBuffer !== wanted.outputBuffer ||
      actual.primaryParameterId !== wanted.primaryParameterId ||
      actual.secondaryParameterId !== wanted.secondaryParameterId
    ) {
      graphFailure(
        "GARAK_COMPILED_GRAPH_NONCANONICAL",
        `operations.${index}`,
        "Compiled graph operation does not match the current canonical execution plan.",
      );
    }
  }
}

export function encodeCompiledGraph(plan: CompiledGraphPlan): Buffer {
  assertCanonicalGainGraph(plan);
  const output = Buffer.alloc(COMPILED_GRAPH_TOTAL_BYTES);
  COMPILED_GRAPH_MAGIC.copy(output, 0);
  output.writeUInt16LE(COMPILED_GRAPH_MAJOR_VERSION, 8);
  output.writeUInt16LE(COMPILED_GRAPH_MINOR_VERSION, 10);
  output.writeUInt32LE(COMPILED_GRAPH_HEADER_BYTES, 12);
  output.writeUInt32LE(COMPILED_GRAPH_TOTAL_BYTES, 16);
  output.writeUInt16LE(COMPILED_GRAPH_OPERATION_COUNT, 20);
  output.writeUInt16LE(plan.bufferCount, 22);
  output.writeUInt32LE(plan.latencySamples, 24);
  output.writeUInt32LE(0, 28);

  let offset = COMPILED_GRAPH_HEADER_BYTES;
  for (const operation of plan.operations) {
    output.writeUInt32LE(operation.instanceId, offset);
    output.writeUInt16LE(operation.type, offset + 4);
    output.writeUInt16LE(0, offset + 6);
    output.writeUInt16LE(operation.inputBuffer, offset + 8);
    output.writeUInt16LE(operation.outputBuffer, offset + 10);
    output.writeUInt32LE(operation.primaryParameterId, offset + 12);
    output.writeUInt32LE(operation.secondaryParameterId, offset + 16);
    offset += COMPILED_GRAPH_OPERATION_BYTES;
  }
  return output;
}

export function decodeCompiledGraph(input: Uint8Array): CompiledGraphPlan {
  const bytes = Buffer.from(input);
  if (bytes.length !== COMPILED_GRAPH_TOTAL_BYTES) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_SIZE",
      "",
      `Compiled graph must contain exactly ${COMPILED_GRAPH_TOTAL_BYTES} bytes; received ${bytes.length}.`,
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
      "Compiled graph format version must be exactly 1.0.",
    );
  }
  if (
    bytes.readUInt32LE(12) !== COMPILED_GRAPH_HEADER_BYTES ||
    bytes.readUInt32LE(16) !== bytes.length ||
    bytes.readUInt16LE(20) !== COMPILED_GRAPH_OPERATION_COUNT
  ) {
    graphFailure(
      "GARAK_COMPILED_GRAPH_LAYOUT",
      "header",
      "Compiled graph header does not match the exact v1 layout.",
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
  for (let index = 0; index < COMPILED_GRAPH_OPERATION_COUNT; index += 1) {
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
  assertCanonicalGainGraph(plan);
  return plan;
}
