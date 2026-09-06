import { realpath } from "node:fs/promises";
import path from "node:path";

import { fail } from "./errors.ts";
import type { ProductRuntimeArtifacts } from "./export_windows.ts";

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isContainedBy(candidate: string, boundary: string): boolean {
  const relative = path.relative(boundary, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function resolveExistingPath(
  value: string,
  diagnosticPath: string,
): Promise<string | null> {
  try {
    return await realpath(value);
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }
    fail(
      "GARAK_EXPORT_ARTIFACT_RESOLUTION",
      diagnosticPath,
      `Prebuilt artifact path cannot be resolved physically: ${path.resolve(value)}.`,
    );
  }
}

export async function assertProductRuntimeArtifactContainment(
  artifacts: ProductRuntimeArtifacts,
  needsValidator: boolean,
): Promise<void> {
  const physicalRoot = await resolveExistingPath(
    artifacts.artifactRoot,
    "export.artifactRoot",
  );
  if (physicalRoot === null) {
    return;
  }

  const members: Array<readonly [string, string]> = [
    [artifacts.templateBundle, "export.templateBundle"],
    [artifacts.templateInnerModule, "export.templateRuntime"],
    [artifacts.moduleInfoTool, "export.moduleinfotool"],
    [artifacts.inspector, "export.inspector"],
  ];
  if (needsValidator) {
    members.push([artifacts.validator, "export.validator"]);
  }

  for (const [member, diagnosticPath] of members) {
    const physicalMember = await resolveExistingPath(member, diagnosticPath);
    if (physicalMember === null) {
      continue;
    }
    if (!isContainedBy(physicalMember, physicalRoot)) {
      fail(
        "GARAK_EXPORT_ARTIFACT_BOUNDARY",
        diagnosticPath,
        `Prebuilt artifact escaped the selected artifact root: ${path.resolve(member)}.`,
      );
    }
  }
}
