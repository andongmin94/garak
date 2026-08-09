import { lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";

import type { Diagnostic } from "./errors.ts";
import { fail } from "./errors.ts";

export const OWNED_CLEANUP_CONTRACT_VERSION = 1 as const;

export type OwnedCleanupKind =
  "export-stage" | "export-backup" | "project-stage" | "project-backup";

export interface OwnedCleanupOrphan {
  readonly contractVersion: typeof OWNED_CLEANUP_CONTRACT_VERSION;
  readonly kind: OwnedCleanupKind;
  readonly parentDirectory: string;
  readonly targetPath: string;
}

export interface OwnedCleanupDiagnostic extends Diagnostic {
  readonly orphan: OwnedCleanupOrphan;
}

export interface OwnedCleanupResult {
  readonly targetPath: string;
  readonly removed: boolean;
}

const DESCRIPTOR_KEYS = Object.freeze([
  "contractVersion",
  "kind",
  "parentDirectory",
  "targetPath",
]);
const TRANSACTION_ID = "[0-9A-Za-z-]+";
const OWNED_LEAF_PATTERNS: Readonly<Record<OwnedCleanupKind, RegExp>> =
  Object.freeze({
    "export-stage": new RegExp(
      `^\\.garak-product-export-stage-${TRANSACTION_ID}$`,
      "u",
    ),
    "export-backup": new RegExp(
      `^.+\\.vst3\\.garak-backup-${TRANSACTION_ID}$`,
      "u",
    ),
    "project-stage": new RegExp(
      `^\\.garak-project-stage-${TRANSACTION_ID}$`,
      "u",
    ),
    "project-backup": new RegExp(
      `^.+\\.garak\\.garak-backup-${TRANSACTION_ID}$`,
      "u",
    ),
  });

function boundedFailureDetail(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return ` ${error.message.slice(0, 512)}`;
  }
  return "";
}

export function ownedCleanupDiagnostic(
  code: string,
  diagnosticPath: string,
  kind: OwnedCleanupKind,
  parentDirectory: string,
  targetPath: string,
  error: unknown,
): OwnedCleanupDiagnostic {
  const parent = path.resolve(parentDirectory);
  const target = path.resolve(targetPath);
  return {
    code,
    path: diagnosticPath,
    message: `Published output is valid, but transaction cleanup failed for '${target}'.${boundedFailureDetail(error)}`,
    orphan: {
      contractVersion: OWNED_CLEANUP_CONTRACT_VERSION,
      kind,
      parentDirectory: parent,
      targetPath: target,
    },
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedPathKey(value: string): string {
  const normalized = path.resolve(value).replaceAll("/", path.sep);
  return process.platform === "win32" ? normalized.toUpperCase() : normalized;
}

function parseOwnedCleanupOrphan(value: unknown): OwnedCleanupOrphan {
  if (!isJsonObject(value)) {
    fail(
      "GARAK_CLEANUP_DESCRIPTOR",
      "cleanup.orphan",
      "Cleanup ownership descriptor must be an object.",
    );
  }
  const keys = Object.keys(value).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const expectedKeys = [...DESCRIPTOR_KEYS].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    fail(
      "GARAK_CLEANUP_DESCRIPTOR",
      "cleanup.orphan",
      "Cleanup ownership descriptor has an invalid field inventory.",
    );
  }

  const { contractVersion, kind, parentDirectory, targetPath } = value;
  if (contractVersion !== OWNED_CLEANUP_CONTRACT_VERSION) {
    fail(
      "GARAK_CLEANUP_DESCRIPTOR",
      "cleanup.orphan.contractVersion",
      `Cleanup ownership contract version must be exactly ${OWNED_CLEANUP_CONTRACT_VERSION}.`,
    );
  }
  if (
    kind !== "export-stage" &&
    kind !== "export-backup" &&
    kind !== "project-stage" &&
    kind !== "project-backup"
  ) {
    fail(
      "GARAK_CLEANUP_DESCRIPTOR",
      "cleanup.orphan.kind",
      "Cleanup ownership kind is not supported.",
    );
  }
  if (
    typeof parentDirectory !== "string" ||
    !path.isAbsolute(parentDirectory)
  ) {
    fail(
      "GARAK_CLEANUP_DESCRIPTOR",
      "cleanup.orphan.parentDirectory",
      "Cleanup parent directory must be an absolute path.",
    );
  }
  if (typeof targetPath !== "string" || !path.isAbsolute(targetPath)) {
    fail(
      "GARAK_CLEANUP_DESCRIPTOR",
      "cleanup.orphan.targetPath",
      "Cleanup target must be an absolute path.",
    );
  }

  const parent = path.resolve(parentDirectory);
  const target = path.resolve(targetPath);
  if (
    parent !== parentDirectory.replaceAll("/", path.sep) ||
    target !== targetPath.replaceAll("/", path.sep)
  ) {
    fail(
      "GARAK_CLEANUP_DESCRIPTOR",
      "cleanup.orphan",
      "Cleanup ownership paths must already be normalized absolute paths.",
    );
  }
  if (
    normalizedPathKey(path.dirname(target)) !== normalizedPathKey(parent) ||
    !OWNED_LEAF_PATTERNS[kind].test(path.basename(target))
  ) {
    fail(
      "GARAK_CLEANUP_OWNERSHIP",
      "cleanup.orphan.targetPath",
      "Cleanup target is outside its owned sibling boundary or has an invalid transaction name.",
    );
  }
  return {
    contractVersion: OWNED_CLEANUP_CONTRACT_VERSION,
    kind,
    parentDirectory: parent,
    targetPath: target,
  };
}

async function physicalDirectoryOrAbsent(
  value: string,
  diagnosticPath: string,
): Promise<"directory" | "absent"> {
  try {
    const item = await lstat(value);
    if (!item.isDirectory() || item.isSymbolicLink()) {
      fail(
        "GARAK_CLEANUP_OWNERSHIP",
        diagnosticPath,
        `Cleanup ownership requires a physical directory: ${value}`,
      );
    }
    return "directory";
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "absent";
    }
    throw error;
  }
}

async function assertPhysicalDirectoryTree(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    const item = await lstat(child);
    if (item.isSymbolicLink()) {
      fail(
        "GARAK_CLEANUP_REPARSE_ENTRY",
        "cleanup.orphan.targetPath",
        `Owned cleanup target contains a symbolic link or junction: ${child}`,
      );
    }
    if (item.isDirectory()) {
      await assertPhysicalDirectoryTree(child);
    } else if (!item.isFile()) {
      fail(
        "GARAK_CLEANUP_ENTRY_TYPE",
        "cleanup.orphan.targetPath",
        `Owned cleanup target contains an unsupported filesystem entry: ${child}`,
      );
    }
  }
}

async function assertNoReparsePath(value: string): Promise<void> {
  const absolute = path.resolve(value);
  const parsed = path.parse(absolute);
  const segments = absolute
    .slice(parsed.root.length)
    .split(path.sep)
    .filter((segment) => segment.length > 0);
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const item = await lstat(current);
    if (item.isSymbolicLink()) {
      fail(
        "GARAK_CLEANUP_REPARSE_PATH",
        "cleanup.orphan.parentDirectory",
        `Owned cleanup path must not traverse a symbolic link or junction: ${current}`,
      );
    }
  }
}

export async function retryOwnedCleanup(
  value: unknown,
): Promise<OwnedCleanupResult> {
  const orphan = parseOwnedCleanupOrphan(value);
  const parentState = await physicalDirectoryOrAbsent(
    orphan.parentDirectory,
    "cleanup.orphan.parentDirectory",
  );
  if (parentState === "absent") {
    fail(
      "GARAK_CLEANUP_PARENT_MISSING",
      "cleanup.orphan.parentDirectory",
      `Cleanup parent directory no longer exists: ${orphan.parentDirectory}`,
    );
  }
  await assertNoReparsePath(orphan.parentDirectory);
  const targetState = await physicalDirectoryOrAbsent(
    orphan.targetPath,
    "cleanup.orphan.targetPath",
  );
  if (targetState === "absent") {
    return { targetPath: orphan.targetPath, removed: false };
  }

  await assertPhysicalDirectoryTree(orphan.targetPath);
  await rm(orphan.targetPath, { recursive: true, force: false });
  return { targetPath: orphan.targetPath, removed: true };
}
