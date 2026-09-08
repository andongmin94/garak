import { compileProductGraph, encodeCompiledGraph } from "./compiled_graph.ts";
import { fail } from "./errors.ts";
import {
  canonicalProductGraphSource,
  canonicalProductGraphSourceV1,
  cloneProductGraphSource,
  migrateProductGraphV1ToV2,
  migrateProductGraphV2ToV3,
} from "./graph_source.ts";
import { deriveProductIdentity } from "./identity.ts";
import {
  BYPASS_PARAMETER_ID,
  COMPILED_PRODUCT_TEMPLATE,
  GAIN_PARAMETER_ID,
  PRODUCT_CATEGORY,
  PRODUCT_SCHEMA_V1,
  PRODUCT_SCHEMA_V2,
  PRODUCT_SCHEMA_V3,
  PRODUCT_SCHEMA_V4,
  PRODUCT_SCHEMA_V5,
  PRODUCT_SCHEMA_VERSION,
  PRODUCT_TEMPLATE,
} from "./project_model.ts";
import type {
  ProductIdentity,
  ProductProject,
  ProductProjectSource,
  ProductProjectSourceV1,
  ProductProjectSourceV2,
  ProductProjectSourceV3,
  ProductProjectSourceV4,
  ProjectMigrationStepId,
  ProjectSchemaStatus,
} from "./project_model.ts";

export const PROJECT_MIGRATION_STEP_V1_TO_V2 =
  "project-schema-1-to-2" as const satisfies ProjectMigrationStepId;
export const PROJECT_MIGRATION_STEP_V2_TO_V3 =
  "project-schema-2-to-3" as const satisfies ProjectMigrationStepId;
export const PROJECT_MIGRATION_STEP_V3_TO_V4 =
  "project-schema-3-to-4" as const satisfies ProjectMigrationStepId;
export const PROJECT_MIGRATION_STEP_V4_TO_V5 =
  "project-schema-4-to-5" as const satisfies ProjectMigrationStepId;

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

function sourceTemplateName(source: ProductProjectSource): string {
  return typeof source.template === "string"
    ? source.template
    : `${source.template.id}-v${source.template.version}`;
}

function currentGraphForSource(source: ProductProjectSource) {
  if (
    source.schemaVersion === PRODUCT_SCHEMA_V1 ||
    source.schemaVersion === PRODUCT_SCHEMA_V2
  ) {
    return canonicalProductGraphSource();
  }
  if (source.schemaVersion === PRODUCT_SCHEMA_V3) {
    return migrateProductGraphV2ToV3(migrateProductGraphV1ToV2(source.graph));
  }
  if (source.schemaVersion === PRODUCT_SCHEMA_V4) {
    return migrateProductGraphV2ToV3(source.graph);
  }
  return source.graph;
}

function graphSemanticsChanged(
  source: ProductProjectSource,
  target: ProductProject,
): boolean {
  try {
    const sourceBytes = encodeCompiledGraph(
      compileProductGraph(currentGraphForSource(source)),
    );
    const targetBytes = encodeCompiledGraph(compileProductGraph(target.graph));
    return !sourceBytes.equals(targetBytes);
  } catch {
    return true;
  }
}

export function assertProjectMigrationInvariants(
  source: ProductProjectSource,
  target: ProductProject,
): ProjectMigrationInvariants {
  const sourceIdentity = deriveProductIdentity(source.productId);
  const targetIdentity = deriveProductIdentity(target.productId);
  const identityChanged =
    source.productId !== target.productId ||
    sourceIdentity.processorFuid !== targetIdentity.processorFuid ||
    sourceIdentity.controllerFuid !== targetIdentity.controllerFuid;
  const targetTemplate = `${target.template.id}-v${target.template.version}`;
  const productSemanticsChanged =
    source.vendor !== target.vendor ||
    source.name !== target.name ||
    source.version !== target.version ||
    source.category !== target.category ||
    source.defaults.gainDb !== target.defaults.gainDb ||
    sourceTemplateName(source) !== COMPILED_PRODUCT_TEMPLATE ||
    targetTemplate !== COMPILED_PRODUCT_TEMPLATE ||
    graphSemanticsChanged(source, target) ||
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
): ProductProjectSourceV2 {
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

export function migrateProjectV2ToV3(
  source: ProductProjectSourceV2,
): ProductProjectSourceV3 {
  return {
    schemaVersion: PRODUCT_SCHEMA_V3,
    productId: source.productId,
    vendor: source.vendor,
    name: source.name,
    version: source.version,
    versionParts: { ...source.versionParts },
    category: PRODUCT_CATEGORY,
    template: { ...PRODUCT_TEMPLATE },
    defaults: { gainDb: source.defaults.gainDb },
    graph: canonicalProductGraphSourceV1(),
  };
}

export function migrateProjectV3ToV4(
  source: ProductProjectSourceV3,
): ProductProjectSourceV4 {
  return {
    schemaVersion: PRODUCT_SCHEMA_V4,
    productId: source.productId,
    vendor: source.vendor,
    name: source.name,
    version: source.version,
    versionParts: { ...source.versionParts },
    category: PRODUCT_CATEGORY,
    template: { ...PRODUCT_TEMPLATE },
    defaults: { gainDb: source.defaults.gainDb },
    graph: migrateProductGraphV1ToV2(source.graph),
  };
}

export function migrateProjectV4ToV5(
  source: ProductProjectSourceV4,
): ProductProject {
  return {
    schemaVersion: PRODUCT_SCHEMA_V5,
    productId: source.productId,
    vendor: source.vendor,
    name: source.name,
    version: source.version,
    versionParts: { ...source.versionParts },
    category: PRODUCT_CATEGORY,
    template: { ...PRODUCT_TEMPLATE },
    defaults: { gainDb: source.defaults.gainDb },
    graph: migrateProductGraphV2ToV3(source.graph),
  };
}

function migratedResult(
  source: ProductProjectSource,
  project: ProductProject,
  steps: readonly ProjectMigrationStepId[],
): MigratedProductProject {
  assertProjectMigrationInvariants(source, project);
  return {
    project,
    schemaStatus: {
      sourceSchemaVersion: source.schemaVersion,
      currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
      migrationRequired: steps.length > 0,
      steps,
    },
  };
}

export function migrateValidatedProjectToCurrent(
  source: ProductProjectSource,
): MigratedProductProject {
  if (source.schemaVersion === PRODUCT_SCHEMA_V1) {
    const v2 = migrateProjectV1ToV2(source);
    const v3 = migrateProjectV2ToV3(v2);
    const v4 = migrateProjectV3ToV4(v3);
    return migratedResult(source, migrateProjectV4ToV5(v4), [
      PROJECT_MIGRATION_STEP_V1_TO_V2,
      PROJECT_MIGRATION_STEP_V2_TO_V3,
      PROJECT_MIGRATION_STEP_V3_TO_V4,
      PROJECT_MIGRATION_STEP_V4_TO_V5,
    ]);
  }
  if (source.schemaVersion === PRODUCT_SCHEMA_V2) {
    const v3 = migrateProjectV2ToV3(source);
    const v4 = migrateProjectV3ToV4(v3);
    return migratedResult(source, migrateProjectV4ToV5(v4), [
      PROJECT_MIGRATION_STEP_V2_TO_V3,
      PROJECT_MIGRATION_STEP_V3_TO_V4,
      PROJECT_MIGRATION_STEP_V4_TO_V5,
    ]);
  }
  if (source.schemaVersion === PRODUCT_SCHEMA_V3) {
    const v4 = migrateProjectV3ToV4(source);
    return migratedResult(source, migrateProjectV4ToV5(v4), [
      PROJECT_MIGRATION_STEP_V3_TO_V4,
      PROJECT_MIGRATION_STEP_V4_TO_V5,
    ]);
  }
  if (source.schemaVersion === PRODUCT_SCHEMA_V4) {
    return migratedResult(source, migrateProjectV4ToV5(source), [
      PROJECT_MIGRATION_STEP_V4_TO_V5,
    ]);
  }
  return {
    project: {
      ...source,
      versionParts: { ...source.versionParts },
      template: { ...source.template },
      defaults: { ...source.defaults },
      graph: cloneProductGraphSource(source.graph),
    },
    schemaStatus: {
      sourceSchemaVersion: PRODUCT_SCHEMA_V5,
      currentSchemaVersion: PRODUCT_SCHEMA_VERSION,
      migrationRequired: false,
      steps: [],
    },
  };
}

export function serializeCanonicalProductProject(
  project: ProductProject,
): string {
  const graph = cloneProductGraphSource(project.graph);
  const document = {
    schemaVersion: PRODUCT_SCHEMA_VERSION,
    productId: project.productId,
    vendor: project.vendor,
    name: project.name,
    version: project.version,
    category: PRODUCT_CATEGORY,
    template: { id: project.template.id, version: project.template.version },
    defaults: {
      gainDb: Object.is(project.defaults.gainDb, -0)
        ? 0
        : project.defaults.gainDb,
    },
    graph: {
      schemaVersion: graph.schemaVersion,
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        implementationVersion: node.implementationVersion,
      })),
      connections: graph.connections.map((connection) => ({
        from: { nodeId: connection.from.nodeId, port: connection.from.port },
        to: { nodeId: connection.to.nodeId, port: connection.to.port },
      })),
    },
  };
  return `${JSON.stringify(document, undefined, 2)}\n`;
}
