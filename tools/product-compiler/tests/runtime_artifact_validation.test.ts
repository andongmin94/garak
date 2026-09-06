import { rename, symlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportProductProject } from "../src/api.ts";
import { loadProductProject } from "../src/validation.ts";
import {
  createFakeArtifacts,
  expectProductError,
  fakeProcessRunner,
  withTemporaryDirectory,
  writeProject,
} from "./helpers.ts";

test("canonical export rejects prebuilt artifacts that physically escape their root", async () => {
  await withTemporaryDirectory(async (temporary) => {
    const projectPath = await writeProject(temporary);
    const project = await loadProductProject(projectPath);
    const artifacts = await createFakeArtifacts(temporary);
    const artifactBin = path.dirname(artifacts.moduleInfoTool);
    const outsideBin = path.join(temporary, "outside-bin");
    await rename(artifactBin, outsideBin);
    await symlink(
      outsideBin,
      artifactBin,
      process.platform === "win32" ? "junction" : "dir",
    );

    await expectProductError(
      () =>
        exportProductProject({
          projectPath,
          configuration: "Debug",
          outputDirectory: path.join(temporary, "exports"),
          repositoryRoot: temporary,
          force: false,
          validate: false,
          artifacts,
          processRunner: fakeProcessRunner(project),
          createTransactionId: () => "physical-boundary",
        }),
      "GARAK_EXPORT_ARTIFACT_BOUNDARY",
    );
  });
});
