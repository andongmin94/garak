import { spawn } from "node:child_process";
import path from "node:path";

import { fail } from "./errors.ts";

const MAXIMUM_CAPTURED_BYTES = 32 * 1024 * 1024;

export interface ProcessRequest {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
}

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

export const runProcess: ProcessRunner = async (request) => {
  if (!path.isAbsolute(request.executable)) {
    fail(
      "GARAK_PROCESS_EXECUTABLE_PATH",
      "export.process",
      "Child executable path must be absolute.",
    );
  }

  return await new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(request.executable, [...request.arguments], {
      cwd: request.cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let capturedBytes = 0;
    let captureFailure = false;

    const capture = (target: Buffer[], chunk: Buffer | string): void => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      capturedBytes += bytes.length;
      if (capturedBytes > MAXIMUM_CAPTURED_BYTES) {
        captureFailure = true;
        child.kill();
        return;
      }
      target.push(bytes);
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      capture(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      capture(stderr, chunk);
    });
    child.once("error", (error) => {
      reject(error);
    });
    child.once("close", (exitCode, signal) => {
      if (captureFailure) {
        reject(
          new Error(
            `Child process output exceeded ${MAXIMUM_CAPTURED_BYTES} bytes.`,
          ),
        );
        return;
      }
      if (exitCode === null) {
        reject(
          new Error(
            `Child process ended without an exit code${signal === null ? "" : ` (${signal})`}.`,
          ),
        );
        return;
      }
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
};
