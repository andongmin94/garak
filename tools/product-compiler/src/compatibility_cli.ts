import { inspectCompatibilityFiles } from "./compatibility.ts";
import type { CompatibilityInspection } from "./compatibility.ts";
import { diagnosticFor, fail } from "./errors.ts";

interface ParsedArguments {
  readonly compiledFile: string;
  readonly stateFile: string | undefined;
  readonly productId: string | undefined;
  readonly json: boolean;
}

function usageFailure(message: string): never {
  fail(
    "GARAK_COMPATIBILITY_CLI_USAGE",
    "compatibility.command",
    `${message} Usage: product:compatibility --compiled <product.garakbin> [--state <state.bin>] [--product-id <uuid>] [--json]`,
  );
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  let compiledFile: string | undefined;
  let stateFile: string | undefined;
  let productId: string | undefined;
  let json = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const option = arguments_[index];
    if (option === "--json") {
      if (json) {
        usageFailure("Option '--json' must not be repeated.");
      }
      json = true;
      continue;
    }
    if (
      option !== "--compiled" &&
      option !== "--state" &&
      option !== "--product-id"
    ) {
      usageFailure(`Unknown option '${option ?? ""}'.`);
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) {
      usageFailure(`Option '${option}' requires a value.`);
    }
    index += 1;
    if (option === "--compiled") {
      if (compiledFile !== undefined) {
        usageFailure("Option '--compiled' must not be repeated.");
      }
      compiledFile = value;
    } else if (option === "--state") {
      if (stateFile !== undefined) {
        usageFailure("Option '--state' must not be repeated.");
      }
      stateFile = value;
    } else {
      if (productId !== undefined) {
        usageFailure("Option '--product-id' must not be repeated.");
      }
      productId = value;
    }
  }

  if (compiledFile === undefined) {
    usageFailure("Option '--compiled' is required.");
  }
  if (productId !== undefined && stateFile === undefined) {
    usageFailure("Option '--product-id' requires --state.");
  }
  return { compiledFile, stateFile, productId, json };
}

function versionText(
  version: { readonly major: number; readonly minor: number } | null,
): string {
  return version === null ? "unavailable" : `${version.major}.${version.minor}`;
}

function writeHuman(report: CompatibilityInspection): void {
  const lines = [
    `Compiled disposition: ${report.compiled.disposition}`,
    `Compiled version: ${versionText(report.compiled.version)}`,
    `Compiled Product ID: ${report.compiled.productId ?? "unavailable"}`,
    `Compiled action: ${report.compiled.action}`,
  ];
  if (report.state !== null) {
    lines.push(
      `State disposition: ${report.state.disposition}`,
      `State version: ${versionText(report.state.version)}`,
      `State Product ID: ${report.state.productId ?? "unavailable"}`,
      `State action: ${report.state.action}`,
    );
  }
  lines.push(`Loadable together: ${String(report.loadable)}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function main(): Promise<void> {
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    const report = await inspectCompatibilityFiles({
      compiledFile: arguments_.compiledFile,
      ...(arguments_.stateFile === undefined
        ? {}
        : { stateFile: arguments_.stateFile }),
      ...(arguments_.productId === undefined
        ? {}
        : { expectedProductId: arguments_.productId }),
    });
    if (arguments_.json) {
      process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
    } else {
      writeHuman(report);
    }
  } catch (error: unknown) {
    process.stderr.write(`${JSON.stringify(diagnosticFor(error))}\n`);
    process.exitCode = 1;
  }
}

void main();
