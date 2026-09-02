import { readFile } from "node:fs/promises";

import {
  COMPILED_GRAPH_MAJOR_VERSION,
  COMPILED_GRAPH_MAGIC,
  COMPILED_GRAPH_MINOR_VERSION,
  decodeCompiledGraph,
} from "./compiled_graph.ts";
import { decodeCompiledProduct } from "./compiled_product.ts";
import { ProductCompilerError } from "./errors.ts";

const COMPILED_MAGIC = Buffer.from("GARAKCPD", "ascii");
const STATE_MAGIC = Buffer.from("GARAKPST", "ascii");
const CURRENT_MAJOR = 1;
const CURRENT_MINOR = 0;
const PRODUCT_STATE_SIZE = 96;
const PRODUCT_STATE_HEADER_SIZE = 64;
const PRODUCT_STATE_ENTRY_SIZE = 16;
const GAIN_PARAMETER_ID = 1001;
const BYPASS_PARAMETER_ID = 1002;
const CANONICAL_PRODUCT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export interface ArtifactVersion {
  readonly major: number;
  readonly minor: number;
}

export type CompiledProductDisposition =
  | "load-current"
  | "rebuild-from-project"
  | "reject-too-new"
  | "reject-invalid";

export interface CompiledProductCompatibility {
  readonly artifact: "compiled-product";
  readonly disposition: CompiledProductDisposition;
  readonly version: ArtifactVersion | null;
  readonly productId: string | null;
  readonly diagnosticCode: string | null;
  readonly action: string;
}

export type CompiledGraphDisposition =
  | "load-current"
  | "rebuild-from-project"
  | "reject-too-new"
  | "reject-invalid";

export interface CompiledGraphCompatibility {
  readonly artifact: "compiled-graph";
  readonly disposition: CompiledGraphDisposition;
  readonly version: ArtifactVersion | null;
  readonly diagnosticCode: string | null;
  readonly action: string;
}

export type ProductStateDisposition =
  | "restore-current"
  | "reject-unsupported-old"
  | "reject-too-new"
  | "reject-foreign-product"
  | "reject-invalid";

export interface ProductStateCompatibility {
  readonly artifact: "product-state";
  readonly disposition: ProductStateDisposition;
  readonly version: ArtifactVersion | null;
  readonly productId: string | null;
  readonly diagnosticCode: string | null;
  readonly action: string;
}

export interface CompatibilityInspection {
  readonly compiled: CompiledProductCompatibility;
  readonly graph: CompiledGraphCompatibility;
  readonly state: ProductStateCompatibility | null;
  readonly loadable: boolean;
}

export interface InspectCompatibilityFilesOptions {
  readonly compiledFile: string;
  readonly graphFile?: string;
  readonly stateFile?: string;
  readonly expectedProductId?: string;
}

function hasMagic(bytes: Uint8Array, magic: Uint8Array): boolean {
  return (
    bytes.byteLength >= magic.byteLength &&
    magic.every((value, index) => bytes[index] === value)
  );
}

function readVersion(bytes: Uint8Array): ArtifactVersion | null {
  if (bytes.byteLength < 12) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    major: view.getUint16(8, true),
    minor: view.getUint16(10, true),
  };
}

function uuidFromBytes(bytes: Uint8Array): string {
  const hexadecimal = Buffer.from(bytes).toString("hex");
  return [
    hexadecimal.slice(0, 8),
    hexadecimal.slice(8, 12),
    hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20),
    hexadecimal.slice(20),
  ].join("-");
}

function allZero(bytes: Uint8Array): boolean {
  return bytes.every((value) => value === 0);
}

function invalidCompiled(
  version: ArtifactVersion | null,
  diagnosticCode: string,
): CompiledProductCompatibility {
  return {
    artifact: "compiled-product",
    disposition: "reject-invalid",
    version,
    productId: null,
    diagnosticCode,
    action:
      "Reject the artifact and preserve the source project for diagnosis.",
  };
}

export function classifyCompiledProduct(
  bytes: Uint8Array,
): CompiledProductCompatibility {
  if (!hasMagic(bytes, COMPILED_MAGIC)) {
    return invalidCompiled(null, "GARAK_COMPILED_MAGIC");
  }
  const version = readVersion(bytes);
  if (version === null) {
    return invalidCompiled(null, "GARAK_COMPILED_SIZE");
  }
  if (version.major < CURRENT_MAJOR) {
    return {
      artifact: "compiled-product",
      disposition: "rebuild-from-project",
      version,
      productId: null,
      diagnosticCode: "GARAK_COMPILED_VERSION_OLD",
      action:
        "Discard this derived artifact and rebuild it deterministically from the editable .garak project.",
    };
  }
  if (
    version.major > CURRENT_MAJOR ||
    (version.major === CURRENT_MAJOR && version.minor > CURRENT_MINOR)
  ) {
    return {
      artifact: "compiled-product",
      disposition: "reject-too-new",
      version,
      productId: null,
      diagnosticCode: "GARAK_COMPILED_VERSION_NEW",
      action:
        "Do not overwrite or reinterpret the artifact; open it with a compatible newer Garak runtime.",
    };
  }

  try {
    const decoded = decodeCompiledProduct(bytes);
    return {
      artifact: "compiled-product",
      disposition: "load-current",
      version,
      productId: decoded.productId,
      diagnosticCode: null,
      action: "Load the compiled product with the current Runtime v1 contract.",
    };
  } catch (error: unknown) {
    const diagnosticCode =
      error instanceof ProductCompilerError
        ? error.diagnostic.code
        : "GARAK_COMPILED_INVALID";
    return invalidCompiled(version, diagnosticCode);
  }
}

function missingGraph(): CompiledGraphCompatibility {
  return {
    artifact: "compiled-graph",
    disposition: "rebuild-from-project",
    version: null,
    diagnosticCode: "GARAK_COMPILED_GRAPH_MISSING",
    action:
      "Rebuild the missing derived graph deterministically from the validated editable .garak project.",
  };
}

function invalidGraph(
  version: ArtifactVersion | null,
  diagnosticCode: string,
): CompiledGraphCompatibility {
  return {
    artifact: "compiled-graph",
    disposition: "reject-invalid",
    version,
    diagnosticCode,
    action:
      "Reject the compiled graph and preserve both artifact and editable source for diagnosis.",
  };
}

export function classifyCompiledGraph(
  bytes: Uint8Array | null,
): CompiledGraphCompatibility {
  if (bytes === null) {
    return missingGraph();
  }
  if (!hasMagic(bytes, COMPILED_GRAPH_MAGIC)) {
    return invalidGraph(null, "GARAK_COMPILED_GRAPH_MAGIC");
  }
  const version = readVersion(bytes);
  if (version === null) {
    return invalidGraph(null, "GARAK_COMPILED_GRAPH_SIZE");
  }
  if (
    version.major < COMPILED_GRAPH_MAJOR_VERSION ||
    (version.major === COMPILED_GRAPH_MAJOR_VERSION &&
      version.minor < COMPILED_GRAPH_MINOR_VERSION)
  ) {
    return {
      artifact: "compiled-graph",
      disposition: "rebuild-from-project",
      version,
      diagnosticCode: "GARAK_COMPILED_GRAPH_VERSION_OLD",
      action:
        "Discard this old derived graph and rebuild it deterministically from the validated editable .garak project.",
    };
  }
  if (
    version.major > COMPILED_GRAPH_MAJOR_VERSION ||
    (version.major === COMPILED_GRAPH_MAJOR_VERSION &&
      version.minor > COMPILED_GRAPH_MINOR_VERSION)
  ) {
    return {
      artifact: "compiled-graph",
      disposition: "reject-too-new",
      version,
      diagnosticCode: "GARAK_COMPILED_GRAPH_VERSION_NEW",
      action:
        "Do not overwrite or reinterpret the graph; preserve it for a compatible newer Garak compiler and Runtime.",
    };
  }

  try {
    decodeCompiledGraph(bytes);
    return {
      artifact: "compiled-graph",
      disposition: "load-current",
      version,
      diagnosticCode: null,
      action: "Load the exact current GARAKGRF v1 execution plan.",
    };
  } catch (error: unknown) {
    const diagnosticCode =
      error instanceof ProductCompilerError
        ? error.diagnostic.code
        : "GARAK_COMPILED_GRAPH_INVALID";
    return invalidGraph(version, diagnosticCode);
  }
}

function invalidState(
  version: ArtifactVersion | null,
  diagnosticCode: string,
): ProductStateCompatibility {
  return {
    artifact: "product-state",
    disposition: "reject-invalid",
    version,
    productId: null,
    diagnosticCode,
    action:
      "Reject the state without changing the processor or controller's previously valid state.",
  };
}

function stateStructureIsValid(bytes: Uint8Array): boolean {
  if (bytes.byteLength !== PRODUCT_STATE_SIZE) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(12, true) !== PRODUCT_STATE_HEADER_SIZE ||
    view.getUint32(16, true) !== PRODUCT_STATE_SIZE ||
    view.getUint32(20, true) !== 0 ||
    allZero(bytes.subarray(24, 40)) ||
    view.getUint16(40, true) !== 2 ||
    view.getUint16(42, true) !== PRODUCT_STATE_ENTRY_SIZE ||
    !allZero(bytes.subarray(44, 64)) ||
    view.getUint32(64, true) !== GAIN_PARAMETER_ID ||
    view.getUint16(68, true) !== 1 ||
    view.getUint16(70, true) !== 0 ||
    view.getUint32(80, true) !== BYPASS_PARAMETER_ID ||
    view.getUint16(84, true) !== 2 ||
    view.getUint16(86, true) !== 0
  ) {
    return false;
  }
  const gain = view.getFloat64(72, true);
  const bypass = view.getFloat64(88, true);
  return (
    Number.isFinite(gain) &&
    gain >= 0 &&
    gain <= 1 &&
    !Object.is(gain, -0) &&
    (bypass === 0 || bypass === 1) &&
    !Object.is(bypass, -0)
  );
}

export function classifyProductState(
  bytes: Uint8Array,
  expectedProductId?: string,
): ProductStateCompatibility {
  if (
    expectedProductId !== undefined &&
    !CANONICAL_PRODUCT_ID.test(expectedProductId)
  ) {
    return invalidState(null, "GARAK_STATE_EXPECTED_PRODUCT_ID");
  }
  if (!hasMagic(bytes, STATE_MAGIC)) {
    return invalidState(null, "GARAK_STATE_MAGIC");
  }
  const version = readVersion(bytes);
  if (version === null) {
    return invalidState(null, "GARAK_STATE_SIZE");
  }
  if (version.major < CURRENT_MAJOR) {
    return {
      artifact: "product-state",
      disposition: "reject-unsupported-old",
      version,
      productId: null,
      diagnosticCode: "GARAK_STATE_VERSION_OLD",
      action:
        "Reject the state. A released, explicit state migration must exist before an older DAW state can be restored.",
    };
  }
  if (
    version.major > CURRENT_MAJOR ||
    (version.major === CURRENT_MAJOR && version.minor > CURRENT_MINOR)
  ) {
    return {
      artifact: "product-state",
      disposition: "reject-too-new",
      version,
      productId: null,
      diagnosticCode: "GARAK_STATE_VERSION_NEW",
      action:
        "Reject the state and preserve it for a compatible newer plug-in; never reinterpret it as v1.",
    };
  }
  if (!stateStructureIsValid(bytes)) {
    return invalidState(version, "GARAK_STATE_INVALID");
  }

  const productId = uuidFromBytes(bytes.subarray(24, 40));
  if (expectedProductId !== undefined && productId !== expectedProductId) {
    return {
      artifact: "product-state",
      disposition: "reject-foreign-product",
      version,
      productId,
      diagnosticCode: "GARAK_STATE_PRODUCT_ID_MISMATCH",
      action:
        "Reject the state because host state is permanently bound to its originating Product ID.",
    };
  }
  return {
    artifact: "product-state",
    disposition: "restore-current",
    version,
    productId,
    diagnosticCode: null,
    action: "Restore the exact current Product State v1 contract.",
  };
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { readonly code?: unknown }).code === "ENOENT"
  );
}

async function readOptionalDerivedFile(
  file: string | undefined,
): Promise<Uint8Array | null> {
  if (file === undefined) {
    return null;
  }
  try {
    return await readFile(file);
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

export async function inspectCompatibilityFiles(
  options: InspectCompatibilityFilesOptions,
): Promise<CompatibilityInspection> {
  const compiled = classifyCompiledProduct(
    await readFile(options.compiledFile),
  );
  const graph = classifyCompiledGraph(
    await readOptionalDerivedFile(options.graphFile),
  );
  let state: ProductStateCompatibility | null = null;
  if (options.stateFile !== undefined) {
    state = classifyProductState(
      await readFile(options.stateFile),
      options.expectedProductId ?? compiled.productId ?? undefined,
    );
  }
  return {
    compiled,
    graph,
    state,
    loadable:
      compiled.disposition === "load-current" &&
      graph.disposition === "load-current" &&
      (state === null || state.disposition === "restore-current"),
  };
}
