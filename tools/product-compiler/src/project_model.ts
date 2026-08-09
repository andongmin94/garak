export const PRODUCT_SCHEMA_VERSION = 1 as const;
export const PRODUCT_CATEGORY = "Fx" as const;
export const PRODUCT_TEMPLATE = "garak.gain-v1" as const;
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

export interface ProductProject {
  readonly schemaVersion: typeof PRODUCT_SCHEMA_VERSION;
  readonly productId: string;
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly versionParts: ProductVersion;
  readonly category: typeof PRODUCT_CATEGORY;
  readonly template: typeof PRODUCT_TEMPLATE;
  readonly defaults: ProductDefaults;
  readonly sourceDirectory: string;
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
  readonly template: typeof PRODUCT_TEMPLATE;
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
    template: project.template,
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
