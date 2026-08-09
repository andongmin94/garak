import { fileURLToPath } from "node:url";

import {
  compileProductProject,
  diagnosticFor,
  exportProductProject,
  inspectProjectMigration,
  inspectProductProject,
  migrateProductProject,
  validateProductProjects,
} from "./api.ts";
import type {
  ProductConfiguration,
  ProductMigrationReport,
  ProductMigrationStatus,
} from "./api.ts";
import { fail } from "./errors.ts";

type Command =
  | "validate"
  | "inspect"
  | "compile"
  | "export"
  | "migration-status"
  | "migrate";

interface ParsedArguments {
  readonly command: Command;
  readonly projects: readonly string[];
  readonly output: string | undefined;
  readonly configuration: ProductConfiguration | undefined;
  readonly force: boolean;
  readonly validateExport: boolean;
  readonly target: string | undefined;
  readonly dryRun: boolean;
  readonly json: boolean;
}

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function usageFailure(message: string): never {
  fail(
    "GARAK_CLI_USAGE",
    "command",
    `${message} Usage: product:<validate|inspect|compile|export|migration-status|migrate> --project <path> [--output <path>] [--configuration Debug|Release] [--to latest] [--dry-run] [--force] [--validate] [--json]`,
  );
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const command = arguments_[0];
  if (
    command !== "validate" &&
    command !== "inspect" &&
    command !== "compile" &&
    command !== "export" &&
    command !== "migration-status" &&
    command !== "migrate"
  ) {
    usageFailure("A supported command is required.");
  }

  const projects: string[] = [];
  let output: string | undefined;
  let configuration: ProductConfiguration | undefined;
  let force = false;
  let validateExport = false;
  let target: string | undefined;
  let dryRun = false;
  let json = false;

  for (let index = 1; index < arguments_.length; index += 1) {
    const option = arguments_[index];
    if (
      option === "--force" ||
      option === "--validate" ||
      option === "--dry-run" ||
      option === "--json"
    ) {
      if (option === "--force") {
        if (force) {
          usageFailure("Option '--force' must not be repeated.");
        }
        force = true;
      } else if (option === "--validate") {
        if (validateExport) {
          usageFailure("Option '--validate' must not be repeated.");
        }
        validateExport = true;
      } else if (option === "--dry-run") {
        if (dryRun) {
          usageFailure("Option '--dry-run' must not be repeated.");
        }
        dryRun = true;
      } else {
        if (json) {
          usageFailure("Option '--json' must not be repeated.");
        }
        json = true;
      }
      continue;
    }

    if (
      option !== "--project" &&
      option !== "--output" &&
      option !== "--configuration" &&
      option !== "--to"
    ) {
      usageFailure(`Unknown option '${option ?? ""}'.`);
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) {
      usageFailure(`Option '${option}' requires a value.`);
    }
    index += 1;
    if (option === "--project") {
      projects.push(value);
    } else if (option === "--output") {
      if (output !== undefined) {
        usageFailure("Option '--output' must not be repeated.");
      }
      output = value;
    } else if (option === "--configuration") {
      if (configuration !== undefined) {
        usageFailure("Option '--configuration' must not be repeated.");
      }
      if (value !== "Debug" && value !== "Release") {
        usageFailure(
          "Option '--configuration' must be exactly Debug or Release.",
        );
      }
      configuration = value;
    } else {
      if (target !== undefined) {
        usageFailure("Option '--to' must not be repeated.");
      }
      target = value;
    }
  }

  if (projects.length === 0) {
    usageFailure("At least one '--project <path>' is required.");
  }
  if (command !== "validate" && projects.length !== 1) {
    usageFailure(`Command '${command}' requires exactly one project.`);
  }

  if (command === "validate") {
    if (
      output !== undefined ||
      configuration !== undefined ||
      force ||
      validateExport ||
      target !== undefined ||
      dryRun ||
      json
    ) {
      usageFailure(
        "Command 'validate' accepts only one or more --project options.",
      );
    }
  } else if (command === "inspect") {
    if (
      output !== undefined ||
      configuration !== undefined ||
      force ||
      validateExport ||
      target !== undefined ||
      dryRun ||
      json
    ) {
      usageFailure("Command 'inspect' accepts only --project.");
    }
  } else if (command === "compile") {
    if (output === undefined) {
      usageFailure("Command 'compile' requires --output <product.garakbin>.");
    }
    if (
      configuration !== undefined ||
      validateExport ||
      target !== undefined ||
      dryRun ||
      json
    ) {
      usageFailure(
        "Command 'compile' does not accept --configuration or --validate.",
      );
    }
  } else if (command === "export") {
    if (output === undefined || configuration === undefined) {
      usageFailure("Command 'export' requires --configuration and --output.");
    }
    if (target !== undefined || dryRun || json) {
      usageFailure(
        "Command 'export' does not accept --to, --dry-run, or --json.",
      );
    }
  } else if (command === "migration-status") {
    if (
      output !== undefined ||
      configuration !== undefined ||
      force ||
      validateExport ||
      target !== undefined ||
      dryRun
    ) {
      usageFailure(
        "Command 'migration-status' accepts only --project and optional --json.",
      );
    }
  } else {
    if (target !== "latest") {
      usageFailure("Command 'migrate' requires --to latest.");
    }
    if (configuration !== undefined || validateExport) {
      usageFailure(
        "Command 'migrate' does not accept --configuration or --validate.",
      );
    }
    if (dryRun === (output !== undefined)) {
      usageFailure(
        "Command 'migrate' requires exactly one of --dry-run or --output <new-project.garak>.",
      );
    }
    if (dryRun && force) {
      usageFailure("Command 'migrate' dry-run does not accept --force.");
    }
  }

  return {
    command,
    projects,
    output,
    configuration,
    force,
    validateExport,
    target,
    dryRun,
    json,
  };
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, undefined, 2)}\n`);
}

function writeMigrationStatusHuman(value: ProductMigrationStatus): void {
  const path =
    value.migrationPath.length === 0
      ? "none"
      : value.migrationPath.join(" -> ");
  process.stdout.write(
    [
      `Detected schema: ${value.detectedSchemaVersion}`,
      `Current schema: ${value.currentSchemaVersion}`,
      `Migration required: ${String(value.migrationRequired)}`,
      `Migration path: ${path}`,
      `Product ID: ${value.identity.productId}`,
      `Processor FUID: ${value.identity.processorFuid}`,
      `Controller FUID: ${value.identity.controllerFuid}`,
      "Source modified: false",
    ].join("\n") + "\n",
  );
}

function writeMigrationReportHuman(value: ProductMigrationReport): void {
  const steps = value.steps.length === 0 ? "none" : value.steps.join(" -> ");
  process.stdout.write(
    [
      `Migration: schema ${value.sourceSchemaVersion} -> ${value.targetSchemaVersion}`,
      `Steps: ${steps}`,
      `Dry run: ${String(value.dryRun)}`,
      `Output written: ${String(value.outputWritten)}`,
      `Source modified: ${String(value.sourceModified)}`,
      `Identity changed: ${String(value.identityChanged)}`,
      `Product semantics changed: ${String(value.productSemanticsChanged)}`,
      `Product ID before: ${value.sourceProductId}`,
      `Product ID after: ${value.targetProductId}`,
      `Processor FUID before: ${value.processorFuidBefore}`,
      `Processor FUID after: ${value.processorFuidAfter}`,
      `Controller FUID before: ${value.controllerFuidBefore}`,
      `Controller FUID after: ${value.controllerFuidAfter}`,
      `Canonical SHA-256: ${value.canonicalSha256}`,
      `Output project: ${value.outputProject ?? "none"}`,
    ].join("\n") + "\n",
  );
}

async function execute(arguments_: ParsedArguments): Promise<void> {
  if (arguments_.command === "validate") {
    writeJson(await validateProductProjects(arguments_.projects));
    return;
  }

  const projectPath = arguments_.projects[0];
  if (projectPath === undefined) {
    usageFailure("Exactly one product project is required.");
  }
  if (arguments_.command === "inspect") {
    writeJson(await inspectProductProject(projectPath));
    return;
  }

  if (arguments_.command === "migration-status") {
    const status = await inspectProjectMigration(projectPath);
    if (arguments_.json) {
      writeJson(status);
    } else {
      writeMigrationStatusHuman(status);
    }
    return;
  }

  if (arguments_.command === "migrate") {
    const report = await migrateProductProject({
      projectPath,
      dryRun: arguments_.dryRun,
      force: arguments_.force,
      ...(arguments_.output === undefined
        ? {}
        : { outputProject: arguments_.output }),
    });
    if (arguments_.json) {
      writeJson(report);
    } else {
      writeMigrationReportHuman(report);
    }
    return;
  }

  if (arguments_.command === "compile") {
    if (arguments_.output === undefined) {
      usageFailure("Command 'compile' requires --output.");
    }
    writeJson(
      await compileProductProject({
        projectPath,
        outputFile: arguments_.output,
        force: arguments_.force,
      }),
    );
    return;
  }

  if (
    arguments_.output === undefined ||
    arguments_.configuration === undefined
  ) {
    usageFailure("Command 'export' requires --output and --configuration.");
  }
  const result = await exportProductProject({
    projectPath,
    configuration: arguments_.configuration,
    outputDirectory: arguments_.output,
    repositoryRoot: REPOSITORY_ROOT,
    force: arguments_.force,
    validate: arguments_.validateExport,
  });
  for (const child of result.childProcesses) {
    process.stdout.write(`CHILD_PROCESS ${JSON.stringify(child)}\n`);
  }
  writeJson(result);
}

async function main(): Promise<void> {
  try {
    await execute(parseArguments(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${JSON.stringify(diagnosticFor(error))}\n`);
    process.exitCode = 1;
  }
}

void main();
