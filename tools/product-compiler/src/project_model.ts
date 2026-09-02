import type { ProductGraphSource } from "./graph_source.ts";

export const PRODUCT_SCHEMA_V1 = 1 as const;
export const PRODUCT_SCHEMA_V2 = 2 as const;
export const PRODUCT_SCHEMA_V3 = 3 as const;
export const PRODUCT_SCHEMA_VERSION = PRODUCT_SCHEMA_V3;
export const PRODUCT_CATEGORY = "Fx" as const;
export const PRODUCT_TEMPLATE_ID = "garak.gain" as const;
export const PRODUCT_TEMPLATE_VERSION = 1 as const;
export const PRODUCT_TEMPLATE = Object.freeze({
  id: PRODUCT_TEMPLATE_ID,
  version: PRODUCT_TEMPLATE_VERSION,
});
export const LEGACY_PRODUCT_TEMPLATE = "garak.gain-v1" as const;
export const COMPILED_PRODUCT_TEMPLATE = LEGACY_PRODUCT_TEMPLATE;
export const PRODUCT_JSON_FILENAME = "product.json";
export const PRODUCT_JSON_MAXIMUM_BYTES = 65_536;
export const PRODUCT_VENDOR_MAXIMUM_BYTES = 63;
export const PRODUCT_NAME_MAXIMUM_BYTES = 52;
export const PRODUCT_MINIMUM_GAIN_DB = -60;
export const PRODUCT_MAXIMUM_GAIN_DB = 12;
export const GAIN_PARAMETER_ID = 1001;
export const BYPASS_PARAMETER_ID = 1002;

export interface ProductDefaults {
  readonly gainDb: number;
}

export interface ProductVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export interface ProductTemplate {
  readonly id: typeof PRODUCT_TEMPLATE_ID;
  readonly version: typeof PRODUCT_TEMPLATE_VERSION;
}

interface ProductProjectSourceCommon {
  readonly productId: string;
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly versionParts: ProductVersion;
  readonly category: typeof PRODUCT_CATEGORY;
  readonly defaults: ProductDefaults;
}

export interface ProductProjectSourceV1 extends ProductProjectSourceCommon {
  readonly schemaVersion: typeof PRODUCT_SCHEMA_V1;
  readonly template: typeof LEGACY_PRODUCT_TEMPLATE;
}

export interface ProductProjectSourceV2 extends ProductProjectSourceCommon {
  readonly schemaVersion: typeof PRODUCT_SCHEMA_V2;
  readonly template: ProductTemplate;
}

export interface ProductProjectSourceV3 extends ProductProjectSourceCommon {
  readonly schemaVersion: typeof PRODUCT_SCHEMA_V3;
  readonly template: ProductTemplate;
  readonly graph: ProductGraphSource;
}

export type ProductProject = ProductProjectSourceV3;
export type ProductProjectSource =
  ProductProjectSourceV1 | ProductProjectSourceV2 | ProductProjectSourceV3;
export type ProjectMigrationStepId =
  "project-schema-1-to-2" | "project-schema-2-to-3";
export type SupportedProductSchemaVersion =
  | typeof PRODUCT_SCHEMA_V1
  | typeof PRODUCT_SCHEMA_V2
  | typeof PRODUCT_SCHEMA_V3;

export type ProjectSchemaDetection =
  | {
      readonly kind: "supported-legacy";
      readonly schemaVersion:
        typeof PRODUCT_SCHEMA_V1 | typeof PRODUCT_SCHEMA_V2;
      readonly currentSchemaVersion: typeof PRODUCT_SCHEMA_VERSION;
    }
  | {
      readonly kind: "current";
      readonly schemaVersion: typeof PRODUCT_SCHEMA_V3;
      readonly currentSchemaVersion: typeof PRODUCT_SCHEMA_VERSION;
    }
  | {
      readonly kind: "too-old";
      readonly schemaVersion: number;
      readonly minimumSupportedSchemaVersion: typeof PRODUCT_SCHEMA_V1;
    }
  | {
      readonly kind: "too-new";
      readonly schemaVersion: number;
      readonly currentSchemaVersion: typeof PRODUCT_SCHEMA_VERSION;
    }
  | {
      readonly kind: "invalid";
      readonly reason: "root-type" | "missing" | "non-integer";
    };

export interface ProjectSchemaStatus {
  readonly sourceSchemaVersion: SupportedProductSchemaVersion;
  readonly currentSchemaVersion: typeof PRODUCT_SCHEMA_VERSION;
  readonly migrationRequired: boolean;
  readonly steps: readonly ProjectMigrationStepId[];
}

export interface ProductIdentity {
  readonly processorFuid: string;
  readonly controllerFuid: string;
}

export interface ProductInspection extends ProductIdentity {
  readonly productId: string;
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly category: typeof PRODUCT_CATEGORY;
  readonly template: ProductTemplate;
  readonly gain: {
    readonly id: typeof GAIN_PARAMETER_ID;
    readonly defaultDb: number;
    readonly defaultNormalized: number;
  };
  readonly bypass: {
    readonly id: typeof BYPASS_PARAMETER_ID;
    readonly default: false;
    readonly defaultNormalized: 0;
  };
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}

export function isWellFormedUnicode(value: string): boolean {
  return Buffer.from(value, "utf8").toString("utf8") === value;
}

export function normalizedGainDefault(gainDb: number): number {
  const normalized =
    (gainDb - PRODUCT_MINIMUM_GAIN_DB) /
    (PRODUCT_MAXIMUM_GAIN_DB - PRODUCT_MINIMUM_GAIN_DB);
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function compiledTemplateFor(
  template: ProductTemplate,
): typeof COMPILED_PRODUCT_TEMPLATE {
  if (
    template.id !== PRODUCT_TEMPLATE_ID ||
    template.version !== PRODUCT_TEMPLATE_VERSION
  ) {
    throw new Error("Unsupported canonical product template.");
  }
  return COMPILED_PRODUCT_TEMPLATE;
}

export function inspectionFor(
  project: ProductProject,
  identity: ProductIdentity,
): ProductInspection {
  return {
    productId: project.productId,
    vendor: project.vendor,
    name: project.name,
    version: project.version,
    category: project.category,
    template: { ...project.template },
    processorFuid: identity.processorFuid,
    controllerFuid: identity.controllerFuid,
    gain: {
      id: GAIN_PARAMETER_ID,
      defaultDb: project.defaults.gainDb,
      defaultNormalized: normalizedGainDefault(project.defaults.gainDb),
    },
    bypass: {
      id: BYPASS_PARAMETER_ID,
      default: false,
      defaultNormalized: 0,
    },
  };
}
