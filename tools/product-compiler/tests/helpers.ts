import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductCompilerError } from "../src/errors.ts";
import { canonicalProductGraphSource } from "../src/graph_source.ts";
import { deriveProductIdentity } from "../src/identity.ts";
import type { ProductRuntimeArtifacts } from "../src/export_windows.ts";
import {
  BYPASS_PARAMETER_ID,
  GAIN_PARAMETER_ID,
  compiledTemplateFor,
  normalizedGainDefault,
} from "../src/project_model.ts";
import type { ProductProject } from "../src/project_model.ts";
import type {
  ProcessRequest,
  ProcessResult,
  ProcessRunner,
} from "../src/process_runner.ts";
import { loadProductProject } from "../src/validation.ts";

export interface MutableProductJson {
  schemaVersion: unknown;
  productId: unknown;
  vendor: unknown;
  name: unknown;
  version: unknown;
  category: unknown;
  template: unknown;
  defaults: Record<string, unknown>;
  [key: string]: unknown;
}

export const WARM_PRODUCT_JSON: Readonly<MutableProductJson> = Object.freeze({
  schemaVersion: 3,
  productId: "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
  vendor: "Garak Test Artist",
  name: "Artist Gain Warm",
  version: "0.1.0",
  category: "Fx",
  template: Object.freeze({ id: "garak.gain", version: 1 }),
  defaults: Object.freeze({ gainDb: -6 }),
  graph: Object.freeze(canonicalProductGraphSource()),
});


export const LEGACY_V2_WARM_PRODUCT_JSON: Readonly<MutableProductJson> =
  Object.freeze({
    schemaVersion: 2,
    productId: "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
    vendor: "Garak Test Artist",
    name: "Artist Gain Warm",
    version: "0.1.0",
    category: "Fx",
    template: Object.freeze({ id: "garak.gain", version: 1 }),
    defaults: Object.freeze({ gainDb: -6 }),
  });

export const LEGACY_WARM_PRODUCT_JSON: Readonly<MutableProductJson> =
  Object.freeze({
    schemaVersion: 1,
    productId: "6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e",
    vendor: "Garak Test Artist",
    name: "Artist Gain Warm",
    version: "0.1.0",
    category: "Fx",
    template: "garak.gain-v1",
    defaults: Object.freeze({ gainDb: -6 }),
  });

export function mutableWarmProduct(): MutableProductJson {
  return {
    schemaVersion: WARM_PRODUCT_JSON.schemaVersion,
    productId: WARM_PRODUCT_JSON.productId,
    vendor: WARM_PRODUCT_JSON.vendor,
    name: WARM_PRODUCT_JSON.name,
    version: WARM_PRODUCT_JSON.version,
    category: WARM_PRODUCT_JSON.category,
    template: { id: "garak.gain", version: 1 },
    defaults: { gainDb: -6 },
    graph: canonicalProductGraphSource(),
  };
}

export function mutableLegacyV2WarmProduct(): MutableProductJson {
  return {
    schemaVersion: LEGACY_V2_WARM_PRODUCT_JSON.schemaVersion,
    productId: LEGACY_V2_WARM_PRODUCT_JSON.productId,
    vendor: LEGACY_V2_WARM_PRODUCT_JSON.vendor,
    name: LEGACY_V2_WARM_PRODUCT_JSON.name,
    version: LEGACY_V2_WARM_PRODUCT_JSON.version,
    category: LEGACY_V2_WARM_PRODUCT_JSON.category,
    template: { id: "garak.gain", version: 1 },
    defaults: { gainDb: -6 },
  };
}

export function mutableLegacyWarmProduct(): MutableProductJson {
  return {
    schemaVersion: LEGACY_WARM_PRODUCT_JSON.schemaVersion,
    productId: LEGACY_WARM_PRODUCT_JSON.productId,
    vendor: LEGACY_WARM_PRODUCT_JSON.vendor,
    name: LEGACY_WARM_PRODUCT_JSON.name,
    version: LEGACY_WARM_PRODUCT_JSON.version,
    category: LEGACY_WARM_PRODUCT_JSON.category,
    template: LEGACY_WARM_PRODUCT_JSON.template,
    defaults: { gainDb: -6 },
  };
}

export async function withTemporaryDirectory<T>(
  operation: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "garak-product-compiler-"),
  );
  try {
    return await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function writeProject(
  parent: string,
  product: MutableProductJson = mutableWarmProduct(),
  leaf = "fixture.garak",
): Promise<string> {
  const directory = path.join(parent, leaf);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "product.json"),
    `${JSON.stringify(product, undefined, 2)}\n`,
    "utf8",
  );
  return directory;
}

export async function writeRawProject(
  parent: string,
  text: string,
  leaf = "fixture.garak",
): Promise<string> {
  const directory = path.join(parent, leaf);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "product.json"), text, "utf8");
  return directory;
}

export async function expectProductError(
  operation: () => Promise<unknown> | unknown,
  expectedCode: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (
      error instanceof ProductCompilerError &&
      error.diagnostic.code === expectedCode
    ) {
      return;
    }
    throw error;
  }
  throw new Error(`Expected ProductCompilerError code ${expectedCode}.`);
}

export interface FakeToolFailure {
  readonly executable:
    | "moduleinfo-create"
    | "moduleinfo-validate"
    | "inspector"
    | "validator-standard"
    | "validator-extensive";
}

function valueAfter(arguments_: readonly string[], option: string): string {
  const index = arguments_.indexOf(option);
  const value = index < 0 ? undefined : arguments_[index + 1];
  if (value === undefined) {
    throw new Error(`Missing fake process argument ${option}.`);
  }
  return value;
}

export function moduleInfoText(project: ProductProject): string {
  const identity = deriveProductIdentity(project.productId);
  return `{
  "Name": ${JSON.stringify(project.name)},
  "Version": ${JSON.stringify(project.version)},
  "Factory Info": {
    "Vendor": ${JSON.stringify(project.vendor)},
  },
  "Classes": [
    {
      "CID": "${identity.processorFuid}",
      "Category": "Audio Module Class",
      "Name": ${JSON.stringify(project.name)},
      "Vendor": ${JSON.stringify(project.vendor)},
      "Version": ${JSON.stringify(project.version)},
      "Sub Categories": ["Fx",],
    },
    {
      "CID": "${identity.controllerFuid}",
      "Category": "Component Controller Class",
      "Name": ${JSON.stringify(`${project.name} Controller`)},
      "Vendor": ${JSON.stringify(project.vendor)},
      "Version": ${JSON.stringify(project.version)},
    },
  ],
}\n`;
}

export function fakeProcessRunner(
  project: ProductProject,
  failure?: FakeToolFailure,
): ProcessRunner {
  return async (request: ProcessRequest): Promise<ProcessResult> => {
    const executable = path.basename(request.executable).toLowerCase();
    let phase: FakeToolFailure["executable"];
    if (
      executable === "moduleinfotool.exe" &&
      request.arguments[0] === "-create"
    ) {
      phase = "moduleinfo-create";
      if (failure?.executable !== phase) {
        const output = valueAfter(request.arguments, "-output");
        await writeFile(output, moduleInfoText(project), "utf8");
      }
    } else if (executable === "moduleinfotool.exe") {
      phase = "moduleinfo-validate";
    } else if (executable === "garak_product_inspector.exe") {
      phase = "inspector";
      const identity = deriveProductIdentity(project.productId);
      const expected = new Map<string, string>([
        ["--product-id", project.productId],
        ["--vendor", project.vendor],
        ["--name", project.name],
        ["--version", project.version],
        ["--category", project.category],
        ["--template", compiledTemplateFor(project.template)],
        ["--processor-fuid", identity.processorFuid],
        ["--controller-fuid", identity.controllerFuid],
        ["--gain-id", String(GAIN_PARAMETER_ID)],
        [
          "--gain-default-normalized",
          String(normalizedGainDefault(project.defaults.gainDb)),
        ],
        ["--bypass-id", String(BYPASS_PARAMETER_ID)],
        ["--bypass-default-normalized", "0"],
      ]);
      if (
        request.arguments.length !== 26 ||
        !request.arguments.includes("--bundle")
      ) {
        throw new Error(
          "Inspector argument inventory does not match its exact CLI contract.",
        );
      }
      for (const [option, value] of expected) {
        if (valueAfter(request.arguments, option) !== value) {
          throw new Error(
            `Inspector argument ${option} did not match the project contract.`,
          );
        }
      }
    } else if (request.arguments[0] === "-e") {
      phase = "validator-extensive";
    } else {
      phase = "validator-standard";
    }
    return failure?.executable === phase
      ? { exitCode: 17, stdout: "", stderr: `injected ${phase} failure` }
      : { exitCode: 0, stdout: `${phase} ok\n`, stderr: "" };
  };
}

export async function createFakeArtifacts(
  parent: string,
): Promise<ProductRuntimeArtifacts> {
  const artifactRoot = path.join(parent, "artifacts");
  const templateBundle = path.join(
    artifactRoot,
    "VST3",
    "Debug",
    "Garak Product Runtime v1.vst3",
  );
  const templateInnerModule = path.join(
    templateBundle,
    "Contents",
    "x86_64-win",
    "Garak Product Runtime v1.vst3",
  );
  const bin = path.join(artifactRoot, "bin");
  await mkdir(path.dirname(templateInnerModule), { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(
    templateInnerModule,
    Buffer.from("PREBUILT GARAK PRODUCT RUNTIME V1\n", "ascii"),
  );
  const moduleInfoTool = path.join(bin, "moduleinfotool.exe");
  const inspector = path.join(bin, "garak_product_inspector.exe");
  const validator = path.join(bin, "validator.exe");
  await Promise.all([
    writeFile(moduleInfoTool, ""),
    writeFile(inspector, ""),
    writeFile(validator, ""),
  ]);
  return {
    artifactRoot,
    templateBundle,
    templateInnerModule,
    moduleInfoTool,
    inspector,
    validator,
  };
}

export async function loadTemporaryWarmProject(
  parent: string,
): Promise<ProductProject> {
  return await loadProductProject(await writeProject(parent));
}

export async function bundleSnapshot(
  bundlePath: string,
): Promise<ReadonlyMap<string, string>> {
  const result = new Map<string, string>();
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        result.set(
          path.relative(bundlePath, absolute),
          (await readFile(absolute)).toString("hex"),
        );
      }
    }
  };
  await visit(bundlePath);
  return result;
}
