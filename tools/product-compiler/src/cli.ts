import { fileURLToPath } from "node:url";

import { diagnosticFor, fail } from "./errors.ts";
import { compileProductFile, exportWindowsProduct } from "./export_windows.ts";
import type { ProductConfiguration } from "./export_windows.ts";
import { deriveProductIdentity, PHASE_1A_1B_FUIDS } from "./identity.ts";
import { inspectionFor } from "./project_model.ts";
import {
  assertNoBatchCollisions,
  batchRecord,
  loadProductProject,
} from "./validation.ts";

type Command = "validate" | "inspect" | "compile" | "export";

interface ParsedArguments {
  readonly command: Command;
  readonly projects: readonly string[];
  readonly output: string | undefined;
  readonly configuration: ProductConfiguration | undefined;
  readonly force: boolean;
  readonly validateExport: boolean;
}

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function usageFailure(message: string): never {
  fail(
    "GARAK_CLI_USAGE",
    "command",
    `${message} Usage: product:<validate|inspect|compile|export> --project <path> [--output <path>] [--configuration Debug|Release] [--force] [--validate]`,
  );
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const command = arguments_[0];
  if (
    command !== "validate" &&
    command !== "inspect" &&
    command !== "compile" &&
    command !== "export"
  ) {
    usageFailure("A supported command is required.");
  }

  const projects: string[] = [];
  let output: string | undefined;
  let configuration: ProductConfiguration | undefined;
  let force = false;
  let validateExport = false;

  for (let index = 1; index < arguments_.length; index += 1) {
    const option = arguments_[index];
    if (option === "--force" || option === "--validate") {
      if (option === "--force") {
        if (force) {
          usageFailure("Option '--force' must not be repeated.");
        }
        force = true;
      } else {
        if (validateExport) {
          usageFailure("Option '--validate' must not be repeated.");
        }
        validateExport = true;
      }
      continue;
    }

    if (
      option !== "--project" &&
      option !== "--output" &&
      option !== "--configuration"
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
    } else {
      if (configuration !== undefined) {
        usageFailure("Option '--configuration' must not be repeated.");
      }
      if (value !== "Debug" && value !== "Release") {
        usageFailure(
          "Option '--configuration' must be exactly Debug or Release.",
        );
      }
      configuration = value;
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
      validateExport
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
      validateExport
    ) {
      usageFailure("Command 'inspect' accepts only --project.");
    }
  } else if (command === "compile") {
    if (output === undefined) {
      usageFailure("Command 'compile' requires --output <product.garakbin>.");
    }
    if (configuration !== undefined || validateExport) {
      usageFailure(
        "Command 'compile' does not accept --configuration or --validate.",
      );
    }
  } else if (output === undefined || configuration === undefined) {
    usageFailure("Command 'export' requires --configuration and --output.");
  }

  return { command, projects, output, configuration, force, validateExport };
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, undefined, 2)}\n`);
}

async function execute(arguments_: ParsedArguments): Promise<void> {
  const projects = [];
  for (const projectPath of arguments_.projects) {
    projects.push(await loadProductProject(projectPath));
  }

  if (arguments_.command === "validate") {
    const records = projects.map((project) => batchRecord(project));
    assertNoBatchCollisions(records);
    for (const record of records) {
      const reservedCollision = [
        record.identity.processorFuid,
        record.identity.controllerFuid,
      ].find((fuid) => PHASE_1A_1B_FUIDS.includes(fuid));
      if (reservedCollision !== undefined) {
        fail(
          "GARAK_IDENTITY_SPIKE_COLLISION",
          "product.json.productId",
          `Derived FUID collides with a Phase 1A/1B fixture: ${reservedCollision}`,
        );
      }
    }
    writeJson({
      valid: true,
      products: records.map((record) => ({
        project: record.project.sourceDirectory,
        productId: record.project.productId,
        name: record.project.name,
        processorFuid: record.identity.processorFuid,
        controllerFuid: record.identity.controllerFuid,
      })),
    });
    return;
  }

  const project = projects[0];
  if (project === undefined) {
    usageFailure("Exactly one product project is required.");
  }
  const identity = deriveProductIdentity(project.productId);
  if (arguments_.command === "inspect") {
    writeJson(inspectionFor(project, identity));
    return;
  }

  if (arguments_.command === "compile") {
    if (arguments_.output === undefined) {
      usageFailure("Command 'compile' requires --output.");
    }
    writeJson(
      await compileProductFile({
        project,
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
  const result = await exportWindowsProduct({
    project,
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
