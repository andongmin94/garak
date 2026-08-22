import { createHash, randomUUID } from "node:crypto";
import { constants as fileConstants, type Dirent } from "node:fs";
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
} from "node:fs/promises";
import path from "node:path";

import { fail } from "./errors.ts";
import {
  PRODUCT_JSON_FILENAME,
  PRODUCT_SCHEMA_VERSION,
  isJsonObject,
} from "./project_model.ts";
import { parseStrictJson } from "./strict_json.ts";
import {
  createProductProject as createAtomicProductProject,
  openProductProject as openAtomicProductProject,
  replaceProductProjectForMigration as replaceAtomicProductProjectForMigration,
  saveProductProject as saveAtomicProductProject,
  serializeProductProjectDocument,
  validateProductProjectDraft,
} from "./project_document.ts";
import type {
  CreateProductProjectOptions,
  ProductProjectDocument,
  ProductProjectDraft,
  ProductProjectSnapshot,
  ProjectMutationResult,
  ProjectTransactionFileSystem,
  SaveProductProjectOptions,
} from "./project_document.ts";
import { loadProductProjectSource } from "./validation.ts";

const PERSISTENCE_ROOT = ".garak-persistence";
const BACKUP_ROOT = ".garak-backups";
const TRANSACTIONS_DIRECTORY = "transactions";
const LOCK_FILENAME = "lock.json";
const MANIFEST_FILENAME = "manifest.json";
const BACKUP_MANIFEST_FILENAME = "backup.json";
const MANIFEST_TYPE = "garak-persistence-transaction";
const LOCK_TYPE = "garak-persistence-lock";
const MANIFEST_VERSION = 1;
const TRANSACTION_ID = /^[0-9A-Za-z-]+$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const PRODUCT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export type PersistenceOperation = "save" | "migrate-in-place";
export type PersistencePhase =
  "prepared" | "backup-verified" | "candidate-published" | "committed";

export interface ProjectBackupSummary {
  readonly transactionId: string;
  readonly projectDirectory: string;
  readonly manifestPath: string;
  readonly fingerprint: string;
  readonly productId: string;
  readonly sourceSchemaVersion: number;
  readonly operation: PersistenceOperation;
}

export interface DurableProjectMutationResult extends ProjectMutationResult {
  readonly backup: ProjectBackupSummary | null;
}

export interface ProjectRecoveryResult {
  readonly recovered: boolean;
  readonly action: "none" | "aborted" | "completed" | "rolled-back";
  readonly transactionId: string | null;
}

export type PersistenceFaultPoint =
  "after-backup-verified" | "after-mutation-published";

interface DurableHooks {
  readonly createPersistenceTransactionId?: () => string;
  readonly createInnerTransactionId?: () => string;
  readonly transactionFileSystem?: ProjectTransactionFileSystem;
  readonly faultInjector?: (
    point: PersistenceFaultPoint,
  ) => void | Promise<void>;
}

export interface DurableCreateProductProjectOptions
  extends CreateProductProjectOptions, DurableHooks {}

export interface DurableSaveProductProjectOptions
  extends SaveProductProjectOptions, DurableHooks {}

export interface MigrateProductProjectInPlaceOptions extends DurableHooks {
  readonly projectDirectory: string;
  readonly expectedRevision: string;
}

interface ProjectLayout {
  readonly targetPath: string;
  readonly parentPath: string;
  readonly targetLeaf: string;
  readonly targetKey: string;
  readonly rootPath: string;
  readonly transactionsPath: string;
  readonly lockPath: string;
  readonly backupRootPath: string;
}

interface PersistenceManifest {
  readonly type: typeof MANIFEST_TYPE;
  readonly version: typeof MANIFEST_VERSION;
  readonly transactionId: string;
  readonly operation: PersistenceOperation;
  readonly targetKey: string;
  readonly targetLeaf: string;
  readonly productId: string;
  readonly sourceFingerprint: string;
  readonly candidateFingerprint: string;
  readonly backupFingerprint: string;
  readonly sourceSchemaVersion: number;
  readonly candidateSchemaVersion: number;
  readonly phase: PersistencePhase;
  readonly innerTransactionId: string;
  readonly backupRelativePath: string;
  readonly transactionRelativePath: string;
  readonly innerStageRelativePath: string;
  readonly innerBackupRelativePath: string;
}

interface PersistenceLock {
  readonly type: typeof LOCK_TYPE;
  readonly version: typeof MANIFEST_VERSION;
  readonly transactionId: string;
  readonly operation: PersistenceOperation;
  readonly targetKey: string;
  readonly productId: string;
  readonly expectedRevision: string;
  readonly processId: number;
  readonly createdAt: string;
}

const LOCK_KEYS = Object.freeze([
  "type",
  "version",
  "transactionId",
  "operation",
  "targetKey",
  "productId",
  "expectedRevision",
  "processId",
  "createdAt",
]);

const MANIFEST_KEYS = Object.freeze([
  "type",
  "version",
  "transactionId",
  "operation",
  "targetKey",
  "targetLeaf",
  "productId",
  "sourceFingerprint",
  "candidateFingerprint",
  "backupFingerprint",
  "sourceSchemaVersion",
  "candidateSchemaVersion",
  "phase",
  "innerTransactionId",
  "backupRelativePath",
  "transactionRelativePath",
  "innerStageRelativePath",
  "innerBackupRelativePath",
]);

function persistenceFailure(
  code: string,
  field: string,
  message: string,
): never {
  fail(
    code,
    field.length === 0 ? "project.persistence" : `project.persistence.${field}`,
    message,
  );
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function assertTransactionId(value: string, field: string): void {
  if (!TRANSACTION_ID.test(value)) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_ID",
      field,
      "Persistence transaction ID contains unsafe characters.",
    );
  }
}

function pathKey(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toUpperCase() : normalized;
}

async function layoutFor(projectDirectory: string): Promise<ProjectLayout> {
  const requestedTarget = path.resolve(projectDirectory);
  const requestedParent = await realpath(path.dirname(requestedTarget));
  const prospectiveTarget = path.join(
    requestedParent,
    path.basename(requestedTarget),
  );
  const targetPath = (await pathExists(prospectiveTarget))
    ? await realpath(prospectiveTarget)
    : prospectiveTarget;
  const parentPath = path.dirname(targetPath);
  const targetLeaf = path.basename(targetPath);
  const targetKey = createHash("sha256")
    .update("garak.persistence-target.v1\0", "utf8")
    .update(pathKey(targetPath), "utf8")
    .digest("hex")
    .slice(0, 32);
  const rootPath = path.join(parentPath, PERSISTENCE_ROOT, targetKey);
  return {
    targetPath,
    parentPath,
    targetLeaf,
    targetKey,
    rootPath,
    transactionsPath: path.join(rootPath, TRANSACTIONS_DIRECTORY),
    lockPath: path.join(rootPath, LOCK_FILENAME),
    backupRootPath: path.join(parentPath, BACKUP_ROOT, targetKey),
  };
}

function updateLength(
  hash: ReturnType<typeof createHash>,
  length: number,
): void {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(length));
  hash.update(bytes);
}

async function collectProjectFiles(
  root: string,
  current: string,
  output: Array<{ readonly relativePath: string; readonly bytes: Buffer }>,
): Promise<void> {
  const entries: Dirent<string>[] = await readdir(current, {
    withFileTypes: true,
  });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  const caseFolded = new Set<string>();
  for (const entry of entries) {
    const folded = entry.name.toUpperCase();
    if (caseFolded.has(folded)) {
      persistenceFailure(
        "GARAK_PROJECT_TREE_CASE_COLLISION",
        "fingerprint",
        `Project contains a case-insensitive path collision at '${entry.name}'.`,
      );
    }
    caseFolded.add(folded);
    const absolute = path.join(current, entry.name);
    const item = await lstat(absolute);
    if (item.isSymbolicLink()) {
      persistenceFailure(
        "GARAK_PROJECT_TREE_REPARSE_ENTRY",
        "fingerprint",
        `Project tree must not contain symbolic links or junctions: ${absolute}`,
      );
    }
    if (item.isDirectory()) {
      await collectProjectFiles(root, absolute, output);
      continue;
    }
    if (!item.isFile()) {
      persistenceFailure(
        "GARAK_PROJECT_TREE_ENTRY_TYPE",
        "fingerprint",
        `Project tree contains an unsupported filesystem entry: ${absolute}`,
      );
    }
    const relativePath = path
      .relative(root, absolute)
      .split(path.sep)
      .join("/");
    if (relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
      persistenceFailure(
        "GARAK_PROJECT_TREE_ESCAPE",
        "fingerprint",
        "Project tree entry escapes the package root.",
      );
    }
    output.push({ relativePath, bytes: await readFile(absolute) });
  }
}

export async function fingerprintProjectTree(
  projectDirectory: string,
): Promise<string> {
  const root = await realpath(path.resolve(projectDirectory));
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    persistenceFailure(
      "GARAK_PROJECT_TREE_ROOT",
      "fingerprint",
      "Project fingerprint root must be a physical directory.",
    );
  }
  const files: Array<{
    readonly relativePath: string;
    readonly bytes: Buffer;
  }> = [];
  await collectProjectFiles(root, root, files);
  files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, "en"),
  );
  const hash = createHash("sha256");
  hash.update("garak.project-tree.v1\0", "utf8");
  for (const file of files) {
    const pathBytes = Buffer.from(file.relativePath, "utf8");
    updateLength(hash, pathBytes.length);
    hash.update(pathBytes);
    updateLength(hash, file.bytes.length);
    hash.update(file.bytes);
  }
  return hash.digest("hex");
}

function fingerprintSingleProductJson(bytes: Uint8Array): string {
  const hash = createHash("sha256");
  hash.update("garak.project-tree.v1\0", "utf8");
  const pathBytes = Buffer.from(PRODUCT_JSON_FILENAME, "utf8");
  updateLength(hash, pathBytes.length);
  hash.update(pathBytes);
  updateLength(hash, bytes.byteLength);
  hash.update(bytes);
  return hash.digest("hex");
}

async function copyProjectTree(
  source: string,
  destination: string,
): Promise<void> {
  const sourceStat = await lstat(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) {
    persistenceFailure(
      "GARAK_PROJECT_BACKUP_SOURCE",
      "backup",
      "Backup source must be a physical project directory.",
    );
  }
  await mkdir(destination, { recursive: false });
  const copyDirectory = async (from: string, to: string): Promise<void> => {
    const entries: Dirent<string>[] = await readdir(from, {
      withFileTypes: true,
    });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const sourceEntry = path.join(from, entry.name);
      const targetEntry = path.join(to, entry.name);
      const item = await lstat(sourceEntry);
      if (item.isSymbolicLink()) {
        persistenceFailure(
          "GARAK_PROJECT_BACKUP_REPARSE_ENTRY",
          "backup",
          `Backup source contains a symbolic link or junction: ${sourceEntry}`,
        );
      }
      if (item.isDirectory()) {
        await mkdir(targetEntry);
        await copyDirectory(sourceEntry, targetEntry);
      } else if (item.isFile()) {
        await copyFile(sourceEntry, targetEntry, fileConstants.COPYFILE_EXCL);
      } else {
        persistenceFailure(
          "GARAK_PROJECT_BACKUP_ENTRY_TYPE",
          "backup",
          `Backup source contains an unsupported entry: ${sourceEntry}`,
        );
      }
    }
  };
  await copyDirectory(source, destination);
}

async function writeTextAtomic(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${randomUUID()}`;
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(text, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, filePath);
}

async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  await writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const expectedSet = new Set(expected);
  const actual = Object.keys(value);
  const unknown = actual.find((key) => !expectedSet.has(key));
  if (
    unknown !== undefined ||
    expected.some((key) => !Object.hasOwn(value, key))
  ) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_MANIFEST_SHAPE",
      "manifest",
      "Persistence transaction manifest has an unexpected field set.",
    );
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_MANIFEST_SHAPE",
      `manifest.${field}`,
      `${field} must be a string.`,
    );
  }
  return value;
}

function assertManagedRelativePath(value: string, field: string): void {
  if (
    value.length === 0 ||
    path.isAbsolute(value) ||
    value
      .split(/[\\/]/u)
      .some((segment) => segment === ".." || segment.length === 0)
  ) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_PATH",
      `manifest.${field}`,
      `${field} must be a bounded relative managed path.`,
    );
  }
}

function parseManifest(text: string): PersistenceManifest {
  const parsed = parseStrictJson(text, {
    sourcePath: "project.persistence.manifest",
    syntaxCode: "GARAK_PROJECT_TRANSACTION_MANIFEST_JSON",
    duplicateCode: "GARAK_PROJECT_TRANSACTION_MANIFEST_DUPLICATE",
  });
  if (!isJsonObject(parsed)) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_MANIFEST_SHAPE",
      "manifest",
      "Persistence transaction manifest must be a JSON object.",
    );
  }
  assertExactKeys(parsed, MANIFEST_KEYS);
  const transactionId = requireString(parsed.transactionId, "transactionId");
  const operation = requireString(parsed.operation, "operation");
  const phase = requireString(parsed.phase, "phase");
  const manifest: PersistenceManifest = {
    type: requireString(parsed.type, "type") as typeof MANIFEST_TYPE,
    version: parsed.version as typeof MANIFEST_VERSION,
    transactionId,
    operation: operation as PersistenceOperation,
    targetKey: requireString(parsed.targetKey, "targetKey"),
    targetLeaf: requireString(parsed.targetLeaf, "targetLeaf"),
    productId: requireString(parsed.productId, "productId"),
    sourceFingerprint: requireString(
      parsed.sourceFingerprint,
      "sourceFingerprint",
    ),
    candidateFingerprint: requireString(
      parsed.candidateFingerprint,
      "candidateFingerprint",
    ),
    backupFingerprint: requireString(
      parsed.backupFingerprint,
      "backupFingerprint",
    ),
    sourceSchemaVersion: parsed.sourceSchemaVersion as number,
    candidateSchemaVersion: parsed.candidateSchemaVersion as number,
    phase: phase as PersistencePhase,
    innerTransactionId: requireString(
      parsed.innerTransactionId,
      "innerTransactionId",
    ),
    backupRelativePath: requireString(
      parsed.backupRelativePath,
      "backupRelativePath",
    ),
    transactionRelativePath: requireString(
      parsed.transactionRelativePath,
      "transactionRelativePath",
    ),
    innerStageRelativePath: requireString(
      parsed.innerStageRelativePath,
      "innerStageRelativePath",
    ),
    innerBackupRelativePath: requireString(
      parsed.innerBackupRelativePath,
      "innerBackupRelativePath",
    ),
  };
  if (
    manifest.type !== MANIFEST_TYPE ||
    manifest.version !== MANIFEST_VERSION ||
    !TRANSACTION_ID.test(manifest.transactionId) ||
    !TRANSACTION_ID.test(manifest.innerTransactionId) ||
    (manifest.operation !== "save" &&
      manifest.operation !== "migrate-in-place") ||
    ![
      "prepared",
      "backup-verified",
      "candidate-published",
      "committed",
    ].includes(manifest.phase) ||
    !/^[0-9a-f]{32}$/u.test(manifest.targetKey) ||
    !PRODUCT_ID.test(manifest.productId) ||
    !SHA256.test(manifest.sourceFingerprint) ||
    !SHA256.test(manifest.candidateFingerprint) ||
    !SHA256.test(manifest.backupFingerprint) ||
    !Number.isInteger(manifest.sourceSchemaVersion) ||
    !Number.isInteger(manifest.candidateSchemaVersion)
  ) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_MANIFEST_VALUE",
      "manifest",
      "Persistence transaction manifest contains an invalid value.",
    );
  }
  assertManagedRelativePath(manifest.backupRelativePath, "backupRelativePath");
  assertManagedRelativePath(
    manifest.transactionRelativePath,
    "transactionRelativePath",
  );
  assertManagedRelativePath(
    manifest.innerStageRelativePath,
    "innerStageRelativePath",
  );
  assertManagedRelativePath(
    manifest.innerBackupRelativePath,
    "innerBackupRelativePath",
  );
  return manifest;
}

async function readManifest(filePath: string): Promise<PersistenceManifest> {
  return parseManifest(await readFile(filePath, "utf8"));
}

function parseLock(text: string): PersistenceLock {
  const parsed = parseStrictJson(text, {
    sourcePath: "project.persistence.lock",
    syntaxCode: "GARAK_PROJECT_TRANSACTION_LOCK_JSON",
    duplicateCode: "GARAK_PROJECT_TRANSACTION_LOCK_DUPLICATE",
  });
  if (!isJsonObject(parsed)) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_LOCK_SHAPE",
      "lock",
      "Persistence lock must be a JSON object.",
    );
  }
  assertExactKeys(parsed, LOCK_KEYS);
  const operation = requireString(parsed.operation, "operation");
  const lock: PersistenceLock = {
    type: requireString(parsed.type, "type") as typeof LOCK_TYPE,
    version: parsed.version as typeof MANIFEST_VERSION,
    transactionId: requireString(parsed.transactionId, "transactionId"),
    operation: operation as PersistenceOperation,
    targetKey: requireString(parsed.targetKey, "targetKey"),
    productId: requireString(parsed.productId, "productId"),
    expectedRevision: requireString(
      parsed.expectedRevision,
      "expectedRevision",
    ),
    processId: parsed.processId as number,
    createdAt: requireString(parsed.createdAt, "createdAt"),
  };
  if (
    lock.type !== LOCK_TYPE ||
    lock.version !== MANIFEST_VERSION ||
    !TRANSACTION_ID.test(lock.transactionId) ||
    (lock.operation !== "save" && lock.operation !== "migrate-in-place") ||
    !/^[0-9a-f]{32}$/u.test(lock.targetKey) ||
    !PRODUCT_ID.test(lock.productId) ||
    !SHA256.test(lock.expectedRevision) ||
    !Number.isSafeInteger(lock.processId) ||
    lock.processId <= 0 ||
    Number.isNaN(Date.parse(lock.createdAt))
  ) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_LOCK_VALUE",
      "lock",
      "Persistence lock contains an invalid value.",
    );
  }
  return lock;
}

async function readLock(
  layout: ProjectLayout,
): Promise<PersistenceLock | null> {
  if (!(await pathExists(layout.lockPath))) return null;
  return parseLock(await readFile(layout.lockPath, "utf8"));
}

function processIsAlive(processId: number): boolean {
  if (processId === process.pid) return true;
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return false;
    }
    return true;
  }
}

function resolveManaged(parent: string, relative: string): string {
  const resolved = path.resolve(parent, relative);
  const relation = path.relative(parent, resolved);
  if (
    relation.length === 0 ||
    relation === ".." ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  ) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_PATH",
      "manifest",
      "Persistence artifact escapes its managed parent.",
    );
  }
  return resolved;
}

async function acquireLock(
  layout: ProjectLayout,
  lock: PersistenceLock,
): Promise<void> {
  await mkdir(layout.rootPath, { recursive: true });
  const handle = await open(layout.lockPath, "wx").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      persistenceFailure(
        "GARAK_PROJECT_TRANSACTION_LOCKED",
        "lock",
        "Another process owns the project persistence lock.",
      );
    }
    throw error;
  });
  try {
    await handle.writeFile(`${JSON.stringify(lock, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function releaseLock(
  layout: ProjectLayout,
  transactionId: string,
): Promise<void> {
  if (!(await pathExists(layout.lockPath))) {
    return;
  }
  try {
    const value: unknown = JSON.parse(await readFile(layout.lockPath, "utf8"));
    if (
      !isJsonObject(value) ||
      value.type !== LOCK_TYPE ||
      value.version !== MANIFEST_VERSION ||
      value.transactionId !== transactionId
    ) {
      persistenceFailure(
        "GARAK_PROJECT_TRANSACTION_LOCK_OWNERSHIP",
        "lock",
        "Persistence lock does not belong to the completing transaction.",
      );
    }
    await rm(layout.lockPath, { force: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function loadTarget(targetPath: string): Promise<{
  readonly fingerprint: string;
  readonly productId: string;
} | null> {
  if (!(await pathExists(targetPath))) {
    return null;
  }
  try {
    const loaded = await loadProductProjectSource(targetPath);
    return {
      fingerprint: await fingerprintProjectTree(targetPath),
      productId: loaded.project.productId,
    };
  } catch {
    return null;
  }
}

async function removeOwnedInnerArtifacts(
  layout: ProjectLayout,
  manifest: PersistenceManifest,
): Promise<void> {
  const transactionPath = resolveManaged(
    layout.parentPath,
    manifest.transactionRelativePath,
  );
  const innerStage = resolveManaged(
    layout.parentPath,
    manifest.innerStageRelativePath,
  );
  const innerBackup = resolveManaged(
    layout.parentPath,
    manifest.innerBackupRelativePath,
  );
  await rm(innerStage, { recursive: true, force: true });
  await rm(innerBackup, { recursive: true, force: true });
  await rm(transactionPath, { recursive: true, force: true });
}

async function restoreBackup(
  layout: ProjectLayout,
  manifest: PersistenceManifest,
  backupProject: string,
): Promise<void> {
  const recoveryStage = path.join(
    layout.rootPath,
    `recovery-${manifest.transactionId}`,
    layout.targetLeaf,
  );
  await rm(path.dirname(recoveryStage), { recursive: true, force: true });
  await mkdir(path.dirname(recoveryStage), { recursive: true });
  await copyProjectTree(backupProject, recoveryStage);
  if (
    (await fingerprintProjectTree(recoveryStage)) !== manifest.backupFingerprint
  ) {
    persistenceFailure(
      "GARAK_PROJECT_RECOVERY_BACKUP_PARITY",
      "recovery",
      "Recovery copy does not match the verified backup fingerprint.",
    );
  }
  let quarantineDirectory: string | null = null;
  if (await pathExists(layout.targetPath)) {
    const quarantine = path.join(
      layout.rootPath,
      `quarantine-${manifest.transactionId}`,
      layout.targetLeaf,
    );
    quarantineDirectory = path.dirname(quarantine);
    await mkdir(quarantineDirectory, { recursive: true });
    await rename(layout.targetPath, quarantine);
  }
  await rename(recoveryStage, layout.targetPath);
  const restored = await loadTarget(layout.targetPath);
  if (
    restored === null ||
    restored.fingerprint !== manifest.backupFingerprint ||
    restored.productId !== manifest.productId
  ) {
    persistenceFailure(
      "GARAK_PROJECT_RECOVERY_VERIFY",
      "recovery",
      "Restored project did not match the verified backup.",
    );
  }
  await rm(path.dirname(recoveryStage), { recursive: true, force: true });
  if (quarantineDirectory !== null) {
    await rm(quarantineDirectory, { recursive: true, force: true });
  }
}

export async function recoverProductPersistence(
  projectDirectory: string,
): Promise<ProjectRecoveryResult> {
  const layout = await layoutFor(projectDirectory);
  if (!(await pathExists(layout.transactionsPath))) {
    if (await pathExists(layout.lockPath)) {
      persistenceFailure(
        "GARAK_PROJECT_RECOVERY_AMBIGUOUS",
        "recovery",
        "A persistence lock exists without a recoverable transaction manifest.",
      );
    }
    return { recovered: false, action: "none", transactionId: null };
  }
  const transactionEntries: Dirent<string>[] = await readdir(
    layout.transactionsPath,
    { withFileTypes: true },
  );
  const entries = transactionEntries.filter(
    (entry) => entry.isDirectory() && !entry.isSymbolicLink(),
  );
  if (entries.length === 0) {
    if (await pathExists(layout.lockPath)) {
      persistenceFailure(
        "GARAK_PROJECT_RECOVERY_AMBIGUOUS",
        "recovery",
        "A persistence lock exists without a recoverable transaction manifest.",
      );
    }
    return { recovered: false, action: "none", transactionId: null };
  }
  if (entries.length !== 1) {
    persistenceFailure(
      "GARAK_PROJECT_RECOVERY_AMBIGUOUS",
      "recovery",
      "Multiple unresolved persistence transactions require explicit user review.",
    );
  }
  const transactionEntry = entries[0];
  if (transactionEntry === undefined) {
    throw new Error("Unreachable transaction inventory state.");
  }
  const transactionDirectory = path.join(
    layout.transactionsPath,
    transactionEntry.name,
  );
  const manifest = await readManifest(
    path.join(transactionDirectory, MANIFEST_FILENAME),
  );
  const lock = await readLock(layout);
  if (
    lock !== null &&
    (lock.transactionId !== manifest.transactionId ||
      lock.targetKey !== manifest.targetKey ||
      lock.productId !== manifest.productId ||
      lock.operation !== manifest.operation)
  ) {
    persistenceFailure(
      "GARAK_PROJECT_RECOVERY_AMBIGUOUS",
      "recovery",
      "Persistence lock does not match the unresolved transaction manifest.",
    );
  }
  if (lock !== null && processIsAlive(lock.processId)) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_LOCKED",
      "lock",
      "Another process still owns the project persistence transaction.",
    );
  }
  if (
    manifest.targetKey !== layout.targetKey ||
    manifest.targetLeaf !== layout.targetLeaf ||
    manifest.transactionId !== transactionEntry.name
  ) {
    persistenceFailure(
      "GARAK_PROJECT_RECOVERY_AMBIGUOUS",
      "recovery",
      "Persistence manifest does not match the requested physical project target.",
    );
  }
  const expectedTransactionRelative = path.relative(
    layout.parentPath,
    transactionDirectory,
  );
  const expectedBackupRelative = path.relative(
    layout.parentPath,
    path.join(layout.backupRootPath, manifest.transactionId, layout.targetLeaf),
  );
  if (
    manifest.transactionRelativePath !== expectedTransactionRelative ||
    manifest.backupRelativePath !== expectedBackupRelative ||
    manifest.innerStageRelativePath !==
      `.garak-project-stage-${manifest.innerTransactionId}` ||
    manifest.innerBackupRelativePath !==
      `${layout.targetLeaf}.garak-backup-${manifest.innerTransactionId}`
  ) {
    persistenceFailure(
      "GARAK_PROJECT_RECOVERY_AMBIGUOUS",
      "recovery",
      "Persistence manifest artifact paths do not match their owned transaction layout.",
    );
  }
  const backupProject = resolveManaged(
    layout.parentPath,
    manifest.backupRelativePath,
  );
  const target = await loadTarget(layout.targetPath);
  if (
    manifest.phase === "prepared" &&
    target !== null &&
    target.productId === manifest.productId &&
    target.fingerprint === manifest.sourceFingerprint
  ) {
    await rm(path.dirname(backupProject), { recursive: true, force: true });
    await removeOwnedInnerArtifacts(layout, manifest);
    if (await pathExists(layout.lockPath)) {
      await releaseLock(layout, manifest.transactionId);
    }
    return {
      recovered: true,
      action: "aborted",
      transactionId: manifest.transactionId,
    };
  }
  const backup = await loadTarget(backupProject);
  if (
    backup === null ||
    backup.fingerprint !== manifest.backupFingerprint ||
    backup.productId !== manifest.productId
  ) {
    persistenceFailure(
      "GARAK_PROJECT_RECOVERY_BACKUP_INVALID",
      "recovery",
      "Persistence transaction does not have a valid verified backup.",
    );
  }
  let action: ProjectRecoveryResult["action"];
  if (
    target !== null &&
    target.productId === manifest.productId &&
    target.fingerprint === manifest.candidateFingerprint
  ) {
    action = "completed";
  } else if (
    target !== null &&
    target.productId === manifest.productId &&
    target.fingerprint === manifest.sourceFingerprint
  ) {
    action = "aborted";
  } else if (target === null) {
    await restoreBackup(layout, manifest, backupProject);
    action = "rolled-back";
  } else {
    persistenceFailure(
      "GARAK_PROJECT_RECOVERY_AMBIGUOUS",
      "recovery",
      "Current project, candidate, and backup form an ambiguous recovery state.",
    );
  }
  await removeOwnedInnerArtifacts(layout, manifest);
  if (await pathExists(layout.lockPath)) {
    await releaseLock(layout, manifest.transactionId);
  }
  return { recovered: true, action, transactionId: manifest.transactionId };
}

function draftForDocument(
  document: ProductProjectDocument,
): ProductProjectDraft {
  return {
    vendor: document.vendor,
    name: document.name,
    version: document.version,
    gainDb: document.defaults.gainDb,
  };
}

async function durableMutation(
  options: DurableSaveProductProjectOptions,
  operation: PersistenceOperation,
): Promise<DurableProjectMutationResult> {
  await recoverProductPersistence(options.projectDirectory);
  const layout = await layoutFor(options.projectDirectory);
  const loaded = await loadProductProjectSource(layout.targetPath);
  const sourceFingerprint = await fingerprintProjectTree(layout.targetPath);
  if (loaded.project.productId !== options.productId) {
    persistenceFailure(
      "GARAK_PROJECT_ID_IMMUTABLE",
      "productId",
      "Product ID changed outside the current project session.",
    );
  }
  if (
    !SHA256.test(options.expectedRevision) ||
    sourceFingerprint !== options.expectedRevision
  ) {
    persistenceFailure(
      "GARAK_PROJECT_REVISION_CONFLICT",
      "revision",
      "Project tree changed on disk since this Studio session opened.",
    );
  }
  if (operation === "save" && loaded.schemaStatus.migrationRequired) {
    persistenceFailure(
      "GARAK_PROJECT_MIGRATION_REQUIRED",
      "schemaVersion",
      "Legacy projects require an explicit in-place migration operation.",
    );
  }

  const candidateDocument = validateProductProjectDraft(
    options.productId,
    options.draft,
    layout.targetPath,
  );
  const candidateBytes = Buffer.from(
    serializeProductProjectDocument(candidateDocument, layout.targetPath),
    "utf8",
  );
  const candidateFingerprint = fingerprintSingleProductJson(candidateBytes);
  const transactionId = (
    options.createPersistenceTransactionId ?? randomUUID
  )();
  const innerTransactionId = (options.createInnerTransactionId ?? randomUUID)();
  assertTransactionId(transactionId, "transactionId");
  assertTransactionId(innerTransactionId, "innerTransactionId");
  const transactionDirectory = path.join(
    layout.transactionsPath,
    transactionId,
  );
  const manifestPath = path.join(transactionDirectory, MANIFEST_FILENAME);
  const backupDirectory = path.join(layout.backupRootPath, transactionId);
  const backupProject = path.join(backupDirectory, layout.targetLeaf);
  const backupManifestPath = path.join(
    backupDirectory,
    BACKUP_MANIFEST_FILENAME,
  );
  const transactionRelativePath = path.relative(
    layout.parentPath,
    transactionDirectory,
  );
  const backupRelativePath = path.relative(layout.parentPath, backupProject);
  const innerStageRelativePath = `.garak-project-stage-${innerTransactionId}`;
  const innerBackupRelativePath = `${layout.targetLeaf}.garak-backup-${innerTransactionId}`;
  if (
    (await pathExists(transactionDirectory)) ||
    (await pathExists(backupDirectory))
  ) {
    persistenceFailure(
      "GARAK_PROJECT_TRANSACTION_COLLISION",
      "transaction",
      "Persistence transaction or backup path already exists.",
    );
  }

  const lock: PersistenceLock = {
    type: LOCK_TYPE,
    version: MANIFEST_VERSION,
    transactionId,
    operation,
    targetKey: layout.targetKey,
    productId: loaded.project.productId,
    expectedRevision: sourceFingerprint,
    processId: process.pid,
    createdAt: new Date().toISOString(),
  };
  await acquireLock(layout, lock);

  let manifest: PersistenceManifest | null = null;
  let backupSummary: ProjectBackupSummary | null = null;
  try {
    const reloaded = await loadProductProjectSource(layout.targetPath);
    const currentFingerprint = await fingerprintProjectTree(layout.targetPath);
    if (
      currentFingerprint !== sourceFingerprint ||
      reloaded.project.productId !== loaded.project.productId
    ) {
      persistenceFailure(
        "GARAK_PROJECT_REVISION_CONFLICT",
        "revision",
        "Project changed while the persistence lock was being acquired.",
      );
    }
    manifest = {
      type: MANIFEST_TYPE,
      version: MANIFEST_VERSION,
      transactionId,
      operation,
      targetKey: layout.targetKey,
      targetLeaf: layout.targetLeaf,
      productId: loaded.project.productId,
      sourceFingerprint,
      candidateFingerprint,
      backupFingerprint: sourceFingerprint,
      sourceSchemaVersion: loaded.schemaStatus.sourceSchemaVersion,
      candidateSchemaVersion: PRODUCT_SCHEMA_VERSION,
      phase: "prepared",
      innerTransactionId,
      backupRelativePath,
      transactionRelativePath,
      innerStageRelativePath,
      innerBackupRelativePath,
    };
    await writeJsonAtomic(manifestPath, manifest);
    await mkdir(backupDirectory, { recursive: true });
    await copyProjectTree(layout.targetPath, backupProject);
    const backupFingerprint = await fingerprintProjectTree(backupProject);
    if (backupFingerprint !== sourceFingerprint) {
      persistenceFailure(
        "GARAK_PROJECT_BACKUP_PARITY",
        "backup",
        "Persistent backup fingerprint does not match the source project.",
      );
    }
    backupSummary = {
      transactionId,
      projectDirectory: backupProject,
      manifestPath: backupManifestPath,
      fingerprint: backupFingerprint,
      productId: loaded.project.productId,
      sourceSchemaVersion: loaded.schemaStatus.sourceSchemaVersion,
      operation,
    };
    await writeJsonAtomic(backupManifestPath, {
      type: "garak-project-backup",
      version: MANIFEST_VERSION,
      ...backupSummary,
    });
    manifest = {
      ...manifest,
      backupFingerprint,
      phase: "backup-verified",
    };
    await writeJsonAtomic(manifestPath, manifest);
    await options.faultInjector?.("after-backup-verified");

    const innerOptions: SaveProductProjectOptions = {
      projectDirectory: layout.targetPath,
      expectedRevision: createHash("sha256")
        .update(loaded.sourceBytes)
        .digest("hex"),
      productId: loaded.project.productId,
      draft: options.draft,
      createTransactionId: () => innerTransactionId,
      ...(options.transactionFileSystem === undefined
        ? {}
        : { transactionFileSystem: options.transactionFileSystem }),
    };
    const mutation =
      operation === "save"
        ? await saveAtomicProductProject(innerOptions)
        : await replaceAtomicProductProjectForMigration(innerOptions);
    const publishedFingerprint = await fingerprintProjectTree(
      layout.targetPath,
    );
    const published = await loadProductProjectSource(layout.targetPath);
    if (
      publishedFingerprint !== candidateFingerprint ||
      published.project.productId !== manifest.productId ||
      published.schemaStatus.sourceSchemaVersion !== PRODUCT_SCHEMA_VERSION
    ) {
      persistenceFailure(
        "GARAK_PROJECT_PUBLISH_VERIFY",
        "publish",
        "Published project does not match the validated persistence candidate.",
      );
    }
    manifest = { ...manifest, phase: "candidate-published" };
    await writeJsonAtomic(manifestPath, manifest);
    await options.faultInjector?.("after-mutation-published");
    manifest = { ...manifest, phase: "committed" };
    await writeJsonAtomic(manifestPath, manifest);
    await removeOwnedInnerArtifacts(layout, manifest);
    await releaseLock(layout, transactionId);
    return {
      ...mutation,
      revision: publishedFingerprint,
      backup: backupSummary,
    };
  } catch (error) {
    if (manifest === null) {
      await rm(backupDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
      await rm(transactionDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
      await releaseLock(layout, transactionId).catch(() => undefined);
      throw error;
    }
    await releaseLock(layout, transactionId).catch(() => undefined);
    try {
      const recovery = await recoverProductPersistence(layout.targetPath);
      if (recovery.action === "completed" && backupSummary !== null) {
        const snapshot = await openDurableProductProject(layout.targetPath);
        return {
          ...snapshot,
          cleanupDiagnostics: [],
          backup: backupSummary,
        };
      }
    } catch {
      // Preserve the original failure and transaction artifacts for the next open.
    }
    throw error;
  }
}

export async function openDurableProductProject(
  projectDirectory: string,
): Promise<ProductProjectSnapshot> {
  await recoverProductPersistence(projectDirectory);
  const snapshot = await openAtomicProductProject(projectDirectory);
  return {
    ...snapshot,
    revision: await fingerprintProjectTree(projectDirectory),
  };
}

export async function createDurableProductProject(
  options: DurableCreateProductProjectOptions,
): Promise<DurableProjectMutationResult> {
  const validated = validateProductProjectDraft(
    options.productId,
    options.draft,
    options.projectDirectory,
  );
  const layout = await layoutFor(options.projectDirectory);
  await recoverProductPersistence(options.projectDirectory);
  const transactionId = (
    options.createPersistenceTransactionId ?? randomUUID
  )();
  assertTransactionId(transactionId, "transactionId");
  await acquireLock(layout, {
    type: LOCK_TYPE,
    version: MANIFEST_VERSION,
    transactionId,
    operation: "save",
    targetKey: layout.targetKey,
    productId: validated.productId,
    expectedRevision: "0".repeat(64),
    processId: process.pid,
    createdAt: new Date().toISOString(),
  });
  try {
    const mutation = await createAtomicProductProject({
      projectDirectory: options.projectDirectory,
      productId: options.productId,
      draft: options.draft,
      ...(options.createInnerTransactionId === undefined
        ? options.createTransactionId === undefined
          ? {}
          : { createTransactionId: options.createTransactionId }
        : { createTransactionId: options.createInnerTransactionId }),
      ...(options.transactionFileSystem === undefined
        ? {}
        : { transactionFileSystem: options.transactionFileSystem }),
    });
    return {
      ...mutation,
      revision: await fingerprintProjectTree(options.projectDirectory),
      backup: null,
    };
  } finally {
    await releaseLock(layout, transactionId);
  }
}

export async function saveDurableProductProject(
  options: DurableSaveProductProjectOptions,
): Promise<DurableProjectMutationResult> {
  return await durableMutation(options, "save");
}

export async function migrateProductProjectInPlace(
  options: MigrateProductProjectInPlaceOptions,
): Promise<DurableProjectMutationResult> {
  const snapshot = await openDurableProductProject(options.projectDirectory);
  if (!snapshot.schemaStatus.migrationRequired) {
    persistenceFailure(
      "GARAK_MIGRATION_NOT_REQUIRED",
      "migration",
      "Project already uses the current editable schema.",
    );
  }
  if (snapshot.revision !== options.expectedRevision) {
    persistenceFailure(
      "GARAK_PROJECT_REVISION_CONFLICT",
      "revision",
      "Project changed before in-place migration began.",
    );
  }
  return await durableMutation(
    {
      ...options,
      productId: snapshot.document.productId,
      draft: draftForDocument(snapshot.document),
    },
    "migrate-in-place",
  );
}
