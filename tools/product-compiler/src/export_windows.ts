import { randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import {
  canonicalGainGraphPlan,
  decodeCompiledGraph,
  encodeCompiledGraph,
} from "./compiled_graph.ts";
import {
  decodeCompiledProduct,
  encodeCompiledProduct,
  sha256Hex,
} from "./compiled_product.ts";
import { ProductCompilerError, fail } from "./errors.ts";
import type { Diagnostic } from "./errors.ts";
import { deriveProductIdentity } from "./identity.ts";
import { parseAndValidateModuleInfo } from "./module_info.ts";
import { ownedCleanupDiagnostic } from "./owned_cleanup.ts";
import type { OwnedCleanupDiagnostic } from "./owned_cleanup.ts";
import {
  BYPASS_PARAMETER_ID,
  compiledTemplateFor,
  GAIN_PARAMETER_ID,
  normalizedGainDefault,
} from "./project_model.ts";
import type { ProductProject } from "./project_model.ts";
import { runProcess } from "./process_runner.ts";
import type {
  ProcessRequest,
  ProcessResult,
  ProcessRunner,
} from "./process_runner.ts";

export type ProductConfiguration = "Debug" | "Release";

export interface ProductRuntimeArtifacts {
  readonly artifactRoot: string;
  readonly templateBundle: string;
  readonly templateInnerModule: string;
  readonly moduleInfoTool: string;
  readonly inspector: string;
  readonly validator: string;
}

export interface ChildProcessLog {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly exitCode: number | null;
}

export interface ExportWindowsOptions {
  readonly project: ProductProject;
  readonly sourceDirectory?: string;
  readonly configuration: ProductConfiguration;
  readonly outputDirectory: string;
  readonly repositoryRoot: string;
  readonly force: boolean;
  readonly validate: boolean;
  readonly artifacts?: ProductRuntimeArtifacts;
  readonly processRunner?: ProcessRunner;
  readonly createTransactionId?: () => string;
  readonly transactionFileSystem?: TransactionFileSystem;
}

export interface ExportWindowsResult {
  readonly bundlePath: string;
  readonly runtimeSha256: string;
  readonly compiledSha256: string;
  readonly compiledBytes: number;
  readonly moduleInfoSha256: string;
  readonly moduleInfoBytes: number;
  readonly processorFuid: string;
  readonly controllerFuid: string;
  readonly inventory: readonly string[];
  readonly childProcesses: readonly ChildProcessLog[];
  readonly cleanupDiagnostics: readonly OwnedCleanupDiagnostic[];
}

export interface CompileFileOptions {
  readonly project: ProductProject;
  readonly sourceDirectory?: string;
  readonly outputFile: string;
  readonly force: boolean;
  readonly createTransactionId?: () => string;
  readonly transactionFileSystem?: TransactionFileSystem;
}

export interface CompileFileResult {
  readonly outputFile: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly cleanupDiagnostics: readonly Diagnostic[];
}

export interface TransactionFileSystem {
  readonly rename: (source: string, destination: string) => Promise<void>;
  readonly remove: (target: string) => Promise<void>;
}

const DEFAULT_TRANSACTION_FILE_SYSTEM: TransactionFileSystem = {
  rename: async (source, destination) => {
    await rename(source, destination);
  },
  remove: async (target) => {
    await rm(target, { recursive: true, force: true });
  },
};

const ALLOWED_NATIVE_TOOLS = new Set([
  "moduleinfotool.exe",
  "garak_product_inspector.exe",
  "validator.exe",
]);

function normalizedAbsolute(value: string): string {
  return path.resolve(value).replaceAll("/", path.sep);
}

function pathKey(value: string): string {
  return normalizedAbsolute(value).toUpperCase();
}

function isContainedBy(candidate: string, boundary: string): boolean {
  const candidateKey = pathKey(candidate);
  const boundaryKey = pathKey(boundary).replace(/[\\/]+$/u, "");
  return (
    candidateKey === boundaryKey ||
    candidateKey.startsWith(`${boundaryKey}${path.sep}`)
  );
}

function pathsOverlap(first: string, second: string): boolean {
  return isContainedBy(first, second) || isContainedBy(second, first);
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function resolveProspectivePhysicalPath(
  value: string,
  failureCode: string,
  diagnosticPath: string,
): Promise<string> {
  let existingAncestor = path.resolve(value);
  const missingLeaves: string[] = [];
  while (true) {
    try {
      const physicalAncestor = await realpath(existingAncestor);
      return path.join(physicalAncestor, ...missingLeaves);
    } catch (error) {
      if (!isMissingPathError(error)) {
        fail(
          failureCode,
          diagnosticPath,
          `Path cannot be resolved through its nearest existing physical ancestor: ${path.resolve(value)}. ${boundedFailureDetail(error)}`,
        );
      }
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) {
        fail(
          failureCode,
          diagnosticPath,
          `Path has no resolvable physical ancestor: ${path.resolve(value)}.`,
        );
      }
      missingLeaves.unshift(path.basename(existingAncestor));
      existingAncestor = parent;
    }
  }
}

async function physicalPathsOverlap(
  first: string,
  second: string,
  failureCode: string,
  diagnosticPath: string,
): Promise<boolean> {
  const [physicalFirst, physicalSecond] = await Promise.all([
    resolveProspectivePhysicalPath(first, failureCode, diagnosticPath),
    resolveProspectivePhysicalPath(second, failureCode, diagnosticPath),
  ]);
  return pathsOverlap(physicalFirst, physicalSecond);
}

function forwardSlash(value: string): string {
  return path.resolve(value).replaceAll("\\", "/");
}

async function assertPhysicalPath(
  value: string,
  kind: "file" | "directory",
  label: string,
): Promise<void> {
  let item: Awaited<ReturnType<typeof lstat>>;
  try {
    item = await lstat(value);
  } catch {
    fail(
      "GARAK_EXPORT_MISSING_INPUT",
      label,
      `Required ${label} does not exist: ${value}`,
    );
  }
  if (
    item.isSymbolicLink() ||
    (kind === "file" ? !item.isFile() : !item.isDirectory())
  ) {
    fail(
      "GARAK_EXPORT_INVALID_INPUT",
      label,
      `Required ${label} must be a physical ${kind}: ${value}`,
    );
  }
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await lstat(value);
    return true;
  } catch {
    return false;
  }
}

async function assertNoExistingSymlinkInChain(value: string): Promise<void> {
  const absolute = path.resolve(value);
  const parsed = path.parse(absolute);
  const relativeSegments = absolute
    .slice(parsed.root.length)
    .split(path.sep)
    .filter((segment) => segment.length > 0);
  let current = parsed.root;
  for (const segment of relativeSegments) {
    current = path.join(current, segment);
    try {
      const item = await lstat(current);
      if (item.isSymbolicLink()) {
        fail(
          "GARAK_EXPORT_REPARSE_PATH",
          "export.output",
          `Export path must not traverse a symbolic link or junction: ${current}`,
        );
      }
    } catch (error) {
      if (error instanceof ProductCompilerError) {
        throw error;
      }
      return;
    }
  }
}

function ownedSiblingPath(
  outputDirectory: string,
  prefix: string,
  transactionId: string,
): string {
  if (!/^[0-9A-Za-z-]+$/u.test(transactionId)) {
    fail(
      "GARAK_EXPORT_TRANSACTION_ID",
      "export.transaction",
      "Transaction ID contains unsafe characters.",
    );
  }
  return path.join(outputDirectory, `${prefix}${transactionId}`);
}

async function removeOwnedSibling(
  value: string,
  outputDirectory: string,
  prefix: string,
  fileSystem: TransactionFileSystem,
): Promise<void> {
  if (
    pathKey(path.dirname(value)) !== pathKey(outputDirectory) ||
    !path.basename(value).startsWith(prefix)
  ) {
    fail(
      "GARAK_EXPORT_CLEANUP_BOUNDARY",
      "export.cleanup",
      `Refusing unsafe cleanup target: ${value}`,
    );
  }
  await fileSystem.remove(value);
}

function compileCleanupDiagnostic(
  code: string,
  diagnosticPath: string,
  target: string,
  error: unknown,
): Diagnostic {
  const detail =
    error instanceof Error && error.message.length > 0
      ? ` ${error.message.slice(0, 512)}`
      : "";
  return {
    code,
    path: diagnosticPath,
    message: `Published output is valid, but transaction cleanup failed for '${target}'.${detail}`,
  };
}

function boundedFailureDetail(error: unknown): string {
  if (error instanceof ProductCompilerError) {
    return `${error.diagnostic.code}: ${error.diagnostic.message}`.slice(
      0,
      512,
    );
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message.slice(0, 512);
  }
  return "Unknown filesystem failure.";
}

export function resolveProductRuntimeArtifacts(
  repositoryRoot: string,
  configuration: ProductConfiguration,
): ProductRuntimeArtifacts {
  const slug = configuration.toLowerCase();
  const artifactRoot = path.join(
    repositoryRoot,
    "out",
    "build",
    `product-runtime-${slug}`,
  );
  const templateBundle = path.join(
    artifactRoot,
    "VST3",
    configuration,
    "Garak Product Runtime v1.vst3",
  );
  return {
    artifactRoot,
    templateBundle,
    templateInnerModule: path.join(
      templateBundle,
      "Contents",
      "x86_64-win",
      "Garak Product Runtime v1.vst3",
    ),
    moduleInfoTool: path.join(artifactRoot, "bin", "moduleinfotool.exe"),
    inspector: path.join(artifactRoot, "bin", "garak_product_inspector.exe"),
    validator: path.join(artifactRoot, "bin", "validator.exe"),
  };
}

async function preflightArtifacts(
  artifacts: ProductRuntimeArtifacts,
  needsValidator: boolean,
): Promise<void> {
  await assertPhysicalPath(
    artifacts.artifactRoot,
    "directory",
    "export.artifactRoot",
  );
  await assertPhysicalPath(
    artifacts.templateBundle,
    "directory",
    "export.templateBundle",
  );
  await assertPhysicalPath(
    artifacts.templateInnerModule,
    "file",
    "export.templateRuntime",
  );
  await assertPhysicalPath(
    artifacts.moduleInfoTool,
    "file",
    "export.moduleinfotool",
  );
  await assertPhysicalPath(artifacts.inspector, "file", "export.inspector");
  if (needsValidator) {
    await assertPhysicalPath(artifacts.validator, "file", "export.validator");
  }
  for (const executable of [
    artifacts.moduleInfoTool,
    artifacts.inspector,
    ...(needsValidator ? [artifacts.validator] : []),
  ]) {
    if (!ALLOWED_NATIVE_TOOLS.has(path.basename(executable).toLowerCase())) {
      fail(
        "GARAK_EXPORT_TOOL_NOT_ALLOWED",
        "export.process",
        `Export is not allowed to invoke '${path.basename(executable)}'.`,
      );
    }
    if (!isContainedBy(executable, artifacts.artifactRoot)) {
      fail(
        "GARAK_EXPORT_TOOL_BOUNDARY",
        "export.process",
        `Prebuilt tool escaped the selected artifact root: ${executable}`,
      );
    }
  }
}

async function inventoryForBundle(
  bundlePath: string,
): Promise<readonly string[]> {
  const files: string[] = [];
  const directories: string[] = [];

  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path
        .relative(bundlePath, absolute)
        .replaceAll("\\", "/");
      if (entry.isSymbolicLink()) {
        fail(
          "GARAK_EXPORT_BUNDLE_REPARSE",
          "export.inventory",
          `Export bundle must not contain a symbolic link or junction: ${relative}`,
        );
      }
      if (entry.isDirectory()) {
        directories.push(relative);
        await visit(absolute);
      } else if (entry.isFile()) {
        files.push(relative);
      } else {
        fail(
          "GARAK_EXPORT_BUNDLE_INVENTORY",
          "export.inventory",
          `Export bundle contains an unsupported filesystem entry: ${relative}`,
        );
      }
    }
  };
  await visit(bundlePath);

  const expectedDirectories = [
    "Contents",
    "Contents/Resources",
    "Contents/x86_64-win",
  ];
  const leaf = path.basename(bundlePath);
  const expectedFiles = [
    "Contents/Resources/graph.garakbin",
    "Contents/Resources/moduleinfo.json",
    "Contents/Resources/product.garakbin",
    `Contents/x86_64-win/${leaf}`,
  ];
  directories.sort((left, right) => left.localeCompare(right, "en"));
  files.sort((left, right) => left.localeCompare(right, "en"));
  if (
    JSON.stringify(directories) !== JSON.stringify(expectedDirectories.sort())
  ) {
    fail(
      "GARAK_EXPORT_BUNDLE_INVENTORY",
      "export.inventory",
      `Bundle directories must be exact; received ${JSON.stringify(directories)}.`,
    );
  }
  if (JSON.stringify(files) !== JSON.stringify(expectedFiles.sort())) {
    fail(
      "GARAK_EXPORT_BUNDLE_INVENTORY",
      "export.inventory",
      `Bundle files must be exact; received ${JSON.stringify(files)}.`,
    );
  }
  return files;
}

function assertCompiledParity(
  project: ProductProject,
  bytes: Uint8Array,
): void {
  const compiled = decodeCompiledProduct(bytes);
  const identity = deriveProductIdentity(project.productId);
  const gain = compiled.parameters[0];
  const bypass = compiled.parameters[1];
  if (
    compiled.productId !== project.productId ||
    compiled.vendor !== project.vendor ||
    compiled.name !== project.name ||
    compiled.versionText !== project.version ||
    compiled.category !== project.category ||
    compiled.template !== compiledTemplateFor(project.template) ||
    compiled.identity.processorFuid !== identity.processorFuid ||
    compiled.identity.controllerFuid !== identity.controllerFuid ||
    gain.id !== GAIN_PARAMETER_ID ||
    gain.defaultNormalized !== normalizedGainDefault(project.defaults.gainDb) ||
    bypass.id !== BYPASS_PARAMETER_ID ||
    bypass.defaultNormalized !== 0
  ) {
    fail(
      "GARAK_EXPORT_COMPILED_PARITY",
      "export.compiledData",
      "Staged compiled product data does not match the validated project contract.",
    );
  }
}

async function invokeRequired(
  runner: ProcessRunner,
  request: ProcessRequest,
  failureCode: string,
  failurePath: string,
  childProcesses: ChildProcessLog[],
): Promise<ProcessResult> {
  const record: ChildProcessLog = {
    executable: request.executable,
    arguments: request.arguments,
    exitCode: null,
  };
  childProcesses.push(record);
  let result: ProcessResult;
  try {
    result = await runner(request);
  } catch (error) {
    const detail =
      error instanceof Error && error.message.length > 0
        ? ` ${error.message}`
        : "";
    fail(
      failureCode,
      failurePath,
      `Failed to start ${path.basename(request.executable)}.${detail}`,
    );
  }
  childProcesses[childProcesses.length - 1] = {
    executable: request.executable,
    arguments: request.arguments,
    exitCode: result.exitCode,
  };
  if (result.exitCode !== 0) {
    const detail = (result.stderr || result.stdout).trim().slice(-2000);
    fail(
      failureCode,
      failurePath,
      `${path.basename(request.executable)} exited with code ${result.exitCode}.${detail.length === 0 ? "" : ` ${detail}`}`,
    );
  }
  return result;
}

export async function compileProductFile(
  options: CompileFileOptions,
): Promise<CompileFileResult> {
  const fileSystem =
    options.transactionFileSystem ?? DEFAULT_TRANSACTION_FILE_SYSTEM;
  const outputFile = path.resolve(options.outputFile);
  if (path.basename(outputFile) !== "product.garakbin") {
    fail(
      "GARAK_COMPILE_OUTPUT_NAME",
      "compile.output",
      "Compiled output filename must be exactly 'product.garakbin'.",
    );
  }
  if (
    options.sourceDirectory !== undefined &&
    (await physicalPathsOverlap(
      outputFile,
      options.sourceDirectory,
      "GARAK_COMPILE_PATH_RESOLUTION",
      "compile.output",
    ))
  ) {
    fail(
      "GARAK_COMPILE_OUTPUT_OVERLAP",
      "compile.output",
      "Compiled output must not overlap the source .garak directory.",
    );
  }
  await assertNoExistingSymlinkInChain(path.dirname(outputFile));
  const existed = await pathExists(outputFile);
  if (existed && !options.force) {
    fail(
      "GARAK_COMPILE_OUTPUT_EXISTS",
      "compile.output",
      `Compiled output already exists; pass --force to replace it safely: ${outputFile}`,
    );
  }
  if (existed) {
    await assertPhysicalPath(outputFile, "file", "compile.output");
  }

  const bytes = encodeCompiledProduct(options.project);
  assertCompiledParity(options.project, bytes);
  const parent = path.dirname(outputFile);
  await mkdir(parent, { recursive: true });
  const transactionId = (options.createTransactionId ?? randomUUID)();
  const stage = ownedSiblingPath(
    parent,
    ".garak-compile-stage-",
    transactionId,
  );
  const backup = ownedSiblingPath(
    parent,
    ".garak-compile-backup-",
    transactionId,
  );
  if ((await pathExists(stage)) || (await pathExists(backup))) {
    fail(
      "GARAK_COMPILE_TRANSACTION_COLLISION",
      "compile.transaction",
      "Compile staging or backup path already exists; refusing to overwrite an unowned path.",
    );
  }
  let backupMoved = false;
  let stageMoved = false;
  let stageCreated = false;
  let operationFailed = false;
  let operationFailure: unknown;
  try {
    const stageFile = await open(stage, "wx");
    stageCreated = true;
    try {
      await stageFile.writeFile(bytes);
    } finally {
      await stageFile.close();
    }
    const stagedBytes = await readFile(stage);
    if (!stagedBytes.equals(bytes)) {
      fail(
        "GARAK_COMPILE_STAGE_PARITY",
        "compile.stage",
        "Staged compiled bytes changed after writing.",
      );
    }
    if (existed) {
      try {
        await fileSystem.rename(outputFile, backup);
      } catch (error) {
        fail(
          "GARAK_COMPILE_PREPUBLISH_BACKUP",
          "compile.publish.backup",
          `Failed to move the prior compiled output to a transaction backup before publication. No new output was published; the prior output remains at '${outputFile}'. ${boundedFailureDetail(error)}`,
        );
      }
      backupMoved = true;
    }
    try {
      await fileSystem.rename(stage, outputFile);
      stageMoved = true;
    } catch (publishError) {
      if (backupMoved) {
        try {
          await fileSystem.rename(backup, outputFile);
          backupMoved = false;
        } catch (rollbackError) {
          fail(
            "GARAK_COMPILE_PUBLISH_ROLLBACK",
            "compile.publish.rollback",
            `Failed to publish compiled output '${outputFile}', and rollback could not restore the prior output. No new output was published; the prior output remains at backup '${backup}'. Publish failure: ${boundedFailureDetail(publishError)} Rollback failure: ${boundedFailureDetail(rollbackError)}`,
          );
        }
      }
      fail(
        "GARAK_COMPILE_PUBLISH",
        "compile.publish",
        `Failed to publish compiled output '${outputFile}'. No new output was published; ${existed ? "the prior output was restored" : "no prior output existed"}. ${boundedFailureDetail(publishError)}`,
      );
    }
  } catch (error) {
    operationFailed = true;
    operationFailure = error;
  }

  if (stageCreated && !stageMoved && (await pathExists(stage))) {
    try {
      await removeOwnedSibling(
        stage,
        parent,
        ".garak-compile-stage-",
        fileSystem,
      );
    } catch (cleanupError) {
      fail(
        "GARAK_COMPILE_PRE_COMMIT_CLEANUP",
        "compile.cleanup.stage",
        `Compile failed before publication and staging cleanup also failed for '${stage}'. Cleanup failure: ${boundedFailureDetail(cleanupError)} Original failure: ${boundedFailureDetail(operationFailure)}`,
      );
    }
  }

  if (operationFailed) {
    throw operationFailure;
  }

  const cleanupDiagnostics: Diagnostic[] = [];
  if (backupMoved) {
    try {
      await removeOwnedSibling(
        backup,
        parent,
        ".garak-compile-backup-",
        fileSystem,
      );
    } catch (error) {
      cleanupDiagnostics.push(
        compileCleanupDiagnostic(
          "GARAK_COMPILE_POST_COMMIT_CLEANUP",
          "compile.cleanup",
          backup,
          error,
        ),
      );
    }
  }
  return {
    outputFile,
    bytes: bytes.length,
    sha256: sha256Hex(bytes),
    cleanupDiagnostics,
  };
}

export async function exportWindowsProduct(
  options: ExportWindowsOptions,
): Promise<ExportWindowsResult> {
  const fileSystem =
    options.transactionFileSystem ?? DEFAULT_TRANSACTION_FILE_SYSTEM;
  const identity = deriveProductIdentity(options.project.productId);
  const compiledBytes = encodeCompiledProduct(options.project);
  assertCompiledParity(options.project, compiledBytes);
  const graphBytes = encodeCompiledGraph(canonicalGainGraphPlan());
  decodeCompiledGraph(graphBytes);
  const artifacts =
    options.artifacts ??
    resolveProductRuntimeArtifacts(
      options.repositoryRoot,
      options.configuration,
    );
  await preflightArtifacts(artifacts, options.validate);

  const outputDirectory = path.resolve(options.outputDirectory);
  const bundleLeaf = `${options.project.name}.vst3`;
  const finalBundle = path.join(outputDirectory, bundleLeaf);
  if (
    options.sourceDirectory !== undefined &&
    (await physicalPathsOverlap(
      finalBundle,
      options.sourceDirectory,
      "GARAK_EXPORT_PATH_RESOLUTION",
      "export.output",
    ))
  ) {
    fail(
      "GARAK_EXPORT_OUTPUT_OVERLAP",
      "export.output",
      "Export bundle must not overlap the source .garak project.",
    );
  }
  if (
    await physicalPathsOverlap(
      finalBundle,
      artifacts.artifactRoot,
      "GARAK_EXPORT_PATH_RESOLUTION",
      "export.output",
    )
  ) {
    fail(
      "GARAK_EXPORT_OUTPUT_OVERLAP",
      "export.output",
      "Export bundle must not overlap the immutable prebuilt artifact root.",
    );
  }
  await assertNoExistingSymlinkInChain(outputDirectory);
  const finalExisted = await pathExists(finalBundle);
  if (finalExisted && !options.force) {
    fail(
      "GARAK_EXPORT_OUTPUT_EXISTS",
      "export.output",
      `Export bundle already exists; pass --force to replace it safely: ${finalBundle}`,
    );
  }
  if (finalExisted) {
    await assertPhysicalPath(finalBundle, "directory", "export.output");
  }

  await mkdir(outputDirectory, { recursive: true });
  const transactionId = (options.createTransactionId ?? randomUUID)();
  const stageParent = ownedSiblingPath(
    outputDirectory,
    ".garak-product-export-stage-",
    transactionId,
  );
  const stageBundle = path.join(stageParent, bundleLeaf);
  const backupBundle = ownedSiblingPath(
    outputDirectory,
    `${bundleLeaf}.garak-backup-`,
    transactionId,
  );
  const innerDirectory = path.join(stageBundle, "Contents", "x86_64-win");
  const resourcesDirectory = path.join(stageBundle, "Contents", "Resources");
  const stagedInnerModule = path.join(innerDirectory, bundleLeaf);
  const stagedGraph = path.join(resourcesDirectory, "graph.garakbin");
  const stagedCompiled = path.join(resourcesDirectory, "product.garakbin");
  const stagedModuleInfo = path.join(resourcesDirectory, "moduleinfo.json");
  const childProcesses: ChildProcessLog[] = [];
  const runner = options.processRunner ?? runProcess;
  let backupMoved = false;
  let stageParentCreated = false;
  let publicationCommitted = false;
  let operationFailed = false;
  let operationFailure: unknown;
  let result: ExportWindowsResult | undefined;
  const cleanupDiagnostics: OwnedCleanupDiagnostic[] = [];

  try {
    if ((await pathExists(stageParent)) || (await pathExists(backupBundle))) {
      fail(
        "GARAK_EXPORT_TRANSACTION_COLLISION",
        "export.transaction",
        "Export staging or backup path already exists; refusing to overwrite an unowned path.",
      );
    }
    await mkdir(stageParent);
    stageParentCreated = true;
    await mkdir(innerDirectory, { recursive: true });
    await mkdir(resourcesDirectory, { recursive: true });
    await copyFile(artifacts.templateInnerModule, stagedInnerModule);
    const templateRuntime = await readFile(artifacts.templateInnerModule);
    const stagedRuntime = await readFile(stagedInnerModule);
    if (!templateRuntime.equals(stagedRuntime)) {
      fail(
        "GARAK_EXPORT_RUNTIME_PARITY",
        "export.runtime",
        "Staged Product Runtime bytes do not match the prebuilt template.",
      );
    }
    await writeFile(stagedCompiled, compiledBytes, { flag: "wx" });
    const stagedCompiledBytes = await readFile(stagedCompiled);
    if (!stagedCompiledBytes.equals(compiledBytes)) {
      fail(
        "GARAK_EXPORT_COMPILED_PARITY",
        "export.compiledData",
        "Staged compiled data bytes changed after writing.",
      );
    }
    assertCompiledParity(options.project, stagedCompiledBytes);
    await writeFile(stagedGraph, graphBytes, { flag: "wx" });
    const stagedGraphBytes = await readFile(stagedGraph);
    if (!stagedGraphBytes.equals(graphBytes)) {
      fail(
        "GARAK_EXPORT_GRAPH_PARITY",
        "export.compiledGraph",
        "Staged compiled graph bytes changed after writing.",
      );
    }
    decodeCompiledGraph(stagedGraphBytes);

    await invokeRequired(
      runner,
      {
        executable: artifacts.moduleInfoTool,
        arguments: [
          "-create",
          "-version",
          options.project.version,
          "-path",
          forwardSlash(stageBundle),
          "-output",
          forwardSlash(stagedModuleInfo),
        ],
        cwd: options.repositoryRoot,
      },
      "GARAK_EXPORT_MODULEINFO_CREATE",
      "export.moduleinfo.create",
      childProcesses,
    );
    await assertPhysicalPath(stagedModuleInfo, "file", "export.moduleinfo");
    const moduleInfoBytes = await readFile(stagedModuleInfo);
    if (moduleInfoBytes.length <= 0 || moduleInfoBytes.length > 65_536) {
      fail(
        "GARAK_EXPORT_MODULEINFO_SIZE",
        "export.moduleinfo",
        "moduleinfo.json must contain 1..65536 bytes.",
      );
    }
    let moduleInfoText: string;
    try {
      moduleInfoText = new TextDecoder("utf-8", { fatal: true }).decode(
        moduleInfoBytes,
      );
    } catch {
      fail(
        "GARAK_EXPORT_MODULEINFO_UTF8",
        "export.moduleinfo",
        "moduleinfo.json is not valid UTF-8.",
      );
    }
    parseAndValidateModuleInfo(moduleInfoText, options.project, identity);

    await invokeRequired(
      runner,
      {
        executable: artifacts.moduleInfoTool,
        arguments: [
          "-validate",
          "-path",
          forwardSlash(stageBundle),
          "-infopath",
          forwardSlash(stagedModuleInfo),
        ],
        cwd: options.repositoryRoot,
      },
      "GARAK_EXPORT_MODULEINFO_VALIDATE",
      "export.moduleinfo.validate",
      childProcesses,
    );

    await invokeRequired(
      runner,
      {
        executable: artifacts.inspector,
        arguments: [
          "--bundle",
          forwardSlash(stageBundle),
          "--product-id",
          options.project.productId,
          "--vendor",
          options.project.vendor,
          "--name",
          options.project.name,
          "--version",
          options.project.version,
          "--category",
          options.project.category,
          "--template",
          compiledTemplateFor(options.project.template),
          "--processor-fuid",
          identity.processorFuid,
          "--controller-fuid",
          identity.controllerFuid,
          "--gain-id",
          String(GAIN_PARAMETER_ID),
          "--gain-default-normalized",
          String(normalizedGainDefault(options.project.defaults.gainDb)),
          "--bypass-id",
          String(BYPASS_PARAMETER_ID),
          "--bypass-default-normalized",
          "0",
        ],
        cwd: options.repositoryRoot,
      },
      "GARAK_EXPORT_INSPECTOR",
      "export.inspector",
      childProcesses,
    );

    if (options.validate) {
      await invokeRequired(
        runner,
        {
          executable: artifacts.validator,
          arguments: [forwardSlash(stageBundle)],
          cwd: options.repositoryRoot,
        },
        "GARAK_EXPORT_VALIDATOR_STANDARD",
        "export.validator.standard",
        childProcesses,
      );
      await invokeRequired(
        runner,
        {
          executable: artifacts.validator,
          arguments: ["-e", forwardSlash(stageBundle)],
          cwd: options.repositoryRoot,
        },
        "GARAK_EXPORT_VALIDATOR_EXTENSIVE",
        "export.validator.extensive",
        childProcesses,
      );
    }

    const inventory = await inventoryForBundle(stageBundle);
    const runtimeSha256 = sha256Hex(stagedRuntime);
    const compiledSha256 = sha256Hex(stagedCompiledBytes);
    const moduleInfoSha256 = sha256Hex(moduleInfoBytes);

    if (finalExisted) {
      try {
        await fileSystem.rename(finalBundle, backupBundle);
      } catch (error) {
        fail(
          "GARAK_EXPORT_PREPUBLISH_BACKUP",
          "export.publish.backup",
          `Failed to move the prior export bundle to a transaction backup before publication. No new bundle was published; the prior bundle remains at '${finalBundle}'. ${boundedFailureDetail(error)}`,
        );
      }
      backupMoved = true;
    }
    try {
      await fileSystem.rename(stageBundle, finalBundle);
      publicationCommitted = true;
    } catch (publishError) {
      if (backupMoved) {
        try {
          await fileSystem.rename(backupBundle, finalBundle);
          backupMoved = false;
        } catch (rollbackError) {
          fail(
            "GARAK_EXPORT_PUBLISH_ROLLBACK",
            "export.publish.rollback",
            `Failed to publish export bundle '${finalBundle}', and rollback could not restore the prior bundle. No new bundle was published; the prior bundle remains at backup '${backupBundle}'. Publish failure: ${boundedFailureDetail(publishError)} Rollback failure: ${boundedFailureDetail(rollbackError)}`,
          );
        }
      }
      fail(
        "GARAK_EXPORT_PUBLISH",
        "export.publish",
        `Failed to publish export bundle '${finalBundle}'. No new bundle was published; ${finalExisted ? "the prior bundle was restored" : "no prior bundle existed"}. ${boundedFailureDetail(publishError)}`,
      );
    }

    result = {
      bundlePath: finalBundle,
      runtimeSha256,
      compiledSha256,
      compiledBytes: stagedCompiledBytes.length,
      moduleInfoSha256,
      moduleInfoBytes: moduleInfoBytes.length,
      processorFuid: identity.processorFuid,
      controllerFuid: identity.controllerFuid,
      inventory,
      childProcesses,
      cleanupDiagnostics,
    };
  } catch (error) {
    operationFailed = true;
    operationFailure = error;
  }

  if (stageParentCreated && (await pathExists(stageParent))) {
    try {
      await removeOwnedSibling(
        stageParent,
        outputDirectory,
        ".garak-product-export-stage-",
        fileSystem,
      );
    } catch (error) {
      if (!publicationCommitted) {
        const operationDetail =
          operationFailure instanceof Error &&
          operationFailure.message.length > 0
            ? ` Original failure: ${operationFailure.message.slice(0, 512)}`
            : "";
        fail(
          "GARAK_EXPORT_PRE_COMMIT_CLEANUP",
          "export.cleanup.stage",
          `Export failed before publication and staging cleanup also failed for '${stageParent}'. Cleanup failure: ${boundedFailureDetail(error)}${operationDetail}`,
        );
      }
      cleanupDiagnostics.push(
        ownedCleanupDiagnostic(
          "GARAK_EXPORT_POST_COMMIT_STAGE_CLEANUP",
          "export.cleanup.stage",
          "export-stage",
          outputDirectory,
          stageParent,
          error,
        ),
      );
    }
  }

  if (operationFailed) {
    throw operationFailure;
  }

  if (result === undefined) {
    fail(
      "GARAK_EXPORT_FINAL_MOVE",
      "export.finalize",
      "Export did not install a complete final bundle.",
    );
  }
  if (backupMoved) {
    try {
      await removeOwnedSibling(
        backupBundle,
        outputDirectory,
        `${bundleLeaf}.garak-backup-`,
        fileSystem,
      );
    } catch (error) {
      cleanupDiagnostics.push(
        ownedCleanupDiagnostic(
          "GARAK_EXPORT_POST_COMMIT_BACKUP_CLEANUP",
          "export.cleanup.backup",
          "export-backup",
          outputDirectory,
          backupBundle,
          error,
        ),
      );
    }
  }
  return result;
}
