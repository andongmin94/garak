import {
  BYPASS_PARAMETER_ID,
  COMPILED_PRODUCT_TEMPLATE,
  GAIN_PARAMETER_ID,
  PRODUCT_CATEGORY,
  PRODUCT_SCHEMA_V1,
  PRODUCT_SCHEMA_V2,
  PRODUCT_SCHEMA_VERSION,
  PRODUCT_TEMPLATE,
} from "./project_model.ts";
import { fail } from "./errors.ts";
import { deriveProductIdentity } from "./identity.ts";
import type {
  ProductIdentity,
  ProductProject,
  ProductProjectSourceV1,
  ProjectMigrationStepId,
  ProjectSchemaStatus,
} from "./project_model.ts";

export const PROJECT_MIGRATION_STEP_V1_TO_V2 =
  "project-schema-1-to-2" as const satisfies ProjectMigrationStepId;

export interface MigratedProductProject {
  readonly project: ProductProject;
  readonly schemaStatus: ProjectSchemaStatus;
}

export interface ProjectMigrationInvariants {
  readonly sourceIdentity: ProductIdentity;
  readonly targetIdentity: ProductIdentity;
  readonly identityChanged: boolean;
  readonly productSemanticsChanged: boolean;
}

export function assertProjectMigrationInvariants(
  source: ProductProjectSourceV1 | ProductProject,
  target: ProductProject,
): ProjectMigrationInvariants {
  const sourceIdentity = deriveProductIdentity(source.productId);
  const targetIdentity = deriveProductIdentity(target.productId);
  const identityChanged =
    source.productId !== target.productId ||
    sourceIdentity.processorFuid !== targetIdentity.processorFuid ||
    sourceIdentity.controllerFuid !== targetIdentity.controllerFuid;
  const sourceTemplate =
    typeof source.template === "string"
      ? source.template
      : `${source.template.id}-v${source.template.version}`;
  const targetTemplate = `${target.template.id}-v${target.template.version}`;
  const productSemanticsChanged =
    source.vendor !== target.vendor ||
    source.name !== target.name ||
    source.version !== target.version ||
    source.category !== target.category ||
    source.defaults.gainDb !== target.defaults.gainDb ||
    sourceTemplate !== COMPILED_PRODUCT_TEMPLATE ||
    targetTemplate !== COMPILED_PRODUCT_TEMPLATE ||
    GAIN_PARAMETER_ID !== 1001 ||
    BYPASS_PARAMETER_ID !== 1002;
  if (identityChanged || productSemanticsChanged) {
    fail(
      "GARAK_MIGRATION_INVARIANT",
      "migration.invariants",
      "Project migration changed persistent identity or product semantics.",
    );
  }
  return {
    sourceIdentity,
    targetIdentity,
    identityChanged,
    productSemanticsChanged,
  };
}

export function migrateProjectV1ToV2(
  source: ProductProjectSourceV1,
): ProductProject {
  return {
    schemaVersion: PRODUCT_SCHEMA_V2,
    productId: source.productId,
    vendor: source.vendor,
    name: source.name,
    version: source.version,
    versionParts: { ...source.versionParts },
    category: PRODUCT_CATEGORY,
    template: { ...PRODUCT_TEMPLATE },
    defaults: { gainDb: source.defaults.gainDb },
  };
}

export function migrateValidatedProjectToCurrent(
  source: ProductProjectSourceV1 | ProductProject,
): MigratedProductProject {
  if (source.schemaVersion === PRODUCT_SCHEMA_V1) {
    const project = migrateProjectV1ToV2(source);
    assertProjectMigrationInvariants(source, project);
    return {
      project,
      schemaStatus: {
        sourceSchemaVersion: PRODUCT_SCHEMA_V1,
        currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
        migrationRequired: true,
        steps: [PROJECT_MIGRATION_STEP_V1_TO_V2],
      },
    };
  }
  return {
    project: source,
    schemaStatus: {
      sourceSchemaVersion: PRODUCT_SCHEMA_V2,
      currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
      migrationRequired: false,
      steps: [],
    },
  };
}

export function serializeCanonicalProductProject(
  project: ProductProject,
): string {
  const document = {
    schemaVersion: PRODUCT_SCHEMA_VERSION,
    productId: project.productId,
    vendor: project.vendor,
    name: project.name,
    version: project.version,
    category: PRODUCT_CATEGORY,
    template: {
      id: project.template.id,
      version: project.template.version,
    },
    defaults: {
      gainDb: Object.is(project.defaults.gainDb, -0)
        ? 0
        : project.defaults.gainDb,
    },
  };
  return `${JSON.stringify(document, undefined, 2)}\n`;
}
