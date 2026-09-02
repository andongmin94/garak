import { isProductGraphSource } from './product_graph.mts';
import type { ProductGraphSource } from './product_graph.mts';

export {
  PRODUCT_GRAPH_AUDIO_PORT,
  PRODUCT_GRAPH_IMPLEMENTATION_VERSION,
  PRODUCT_GRAPH_NODE_TYPE,
  PRODUCT_GRAPH_SCHEMA_VERSION,
  isProductGraphSource,
} from './product_graph.mts';
export type {
  ProductGraphConnection,
  ProductGraphEndpoint,
  ProductGraphNode,
  ProductGraphNodeType,
  ProductGraphSource,
} from './product_graph.mts';

export const PRODUCT_SCHEMA_V1 = 1 as const;
export const PRODUCT_SCHEMA_V2 = 2 as const;
export const PRODUCT_SCHEMA_VERSION = 3 as const;
export const PRODUCT_CATEGORY = 'Fx' as const;
export const PRODUCT_TEMPLATE_ID = 'garak.gain' as const;
export const PRODUCT_TEMPLATE_VERSION = 1 as const;
export const PRODUCT_TEMPLATE = Object.freeze({
  id: PRODUCT_TEMPLATE_ID,
  version: PRODUCT_TEMPLATE_VERSION,
});
export const PROJECT_MIGRATION_STEP_V1_TO_V2 = 'project-schema-1-to-2' as const;
export const PROJECT_MIGRATION_STEP_V2_TO_V3 = 'project-schema-2-to-3' as const;

export type ProductConfiguration = 'Debug' | 'Release';

export interface ProductDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ProductDraft {
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly gainDb: number;
}

export interface ProductSchemaStatus {
  readonly sourceSchemaVersion:
    | typeof PRODUCT_SCHEMA_V1
    | typeof PRODUCT_SCHEMA_V2
    | typeof PRODUCT_SCHEMA_VERSION;
  readonly currentSchemaVersion: typeof PRODUCT_SCHEMA_VERSION;
  readonly migrationRequired: boolean;
  readonly steps: readonly (
    | typeof PROJECT_MIGRATION_STEP_V1_TO_V2
    | typeof PROJECT_MIGRATION_STEP_V2_TO_V3
  )[];
}

export interface ProductDocument {
  readonly documentId: string;
  readonly locationLabel: string | null;
  readonly saved: boolean;
  readonly schemaVersion: typeof PRODUCT_SCHEMA_VERSION;
  readonly schemaStatus: ProductSchemaStatus;
  readonly productId: string;
  readonly category: typeof PRODUCT_CATEGORY;
  readonly template: typeof PRODUCT_TEMPLATE;
  readonly graph: ProductGraphSource;
  readonly draft: ProductDraft;
  readonly cleanupWarnings: readonly ProductCleanupWarning[];
}

export interface ProductInspection {
  readonly productId: string;
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly category: typeof PRODUCT_CATEGORY;
  readonly template: typeof PRODUCT_TEMPLATE;
  readonly processorFuid: string;
  readonly controllerFuid: string;
  readonly gain: {
    readonly id: 1001;
    readonly defaultDb: number;
    readonly defaultNormalized: number;
  };
  readonly bypass: {
    readonly id: 1002;
    readonly default: false;
    readonly defaultNormalized: 0;
  };
}

export interface ProductExportChildProcess {
  readonly tool: string;
  readonly exitCode: number;
}

export interface ProductCleanupWarning {
  readonly cleanupId: string | null;
  readonly diagnostic: ProductDiagnostic;
}

export interface ProductExportResult {
  readonly configuration: ProductConfiguration;
  readonly bundlePath: string;
  readonly runtimeSha256: string;
  readonly compiledSha256: string;
  readonly compiledBytes: number;
  readonly moduleInfoSha256: string;
  readonly moduleInfoBytes: number;
  readonly processorFuid: string;
  readonly controllerFuid: string;
  readonly inventory: readonly string[];
  readonly childProcesses: readonly ProductExportChildProcess[];
  readonly cleanupWarnings: readonly ProductCleanupWarning[];
}

export type ProductOperationResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'cancelled' }
  | { readonly status: 'error'; readonly diagnostic: ProductDiagnostic };

export interface ValidateProductRequest {
  readonly documentId: string;
  readonly draft: ProductDraft;
}

export interface SaveProductRequest {
  readonly documentId: string;
  readonly draft: ProductDraft;
}

export interface ExportProductRequest {
  readonly documentId: string;
  readonly configuration: ProductConfiguration;
}

export interface CleanupProductArtifactRequest {
  readonly cleanupId: string;
}

export interface GarakStudioApi {
  readonly newProduct: () => Promise<ProductOperationResult<ProductDocument>>;
  readonly openProduct: () => Promise<ProductOperationResult<ProductDocument>>;
  readonly validateProduct: (
    request: ValidateProductRequest,
  ) => Promise<ProductOperationResult<ProductInspection>>;
  readonly saveProduct: (
    request: SaveProductRequest,
  ) => Promise<ProductOperationResult<ProductDocument>>;
  readonly exportProduct: (
    request: ExportProductRequest,
  ) => Promise<ProductOperationResult<ProductExportResult>>;
  readonly cleanupProductArtifact: (
    request: CleanupProductArtifactRequest,
  ) => Promise<ProductOperationResult<{ readonly cleaned: true }>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isProductTemplate(value: unknown): value is typeof PRODUCT_TEMPLATE {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['id', 'version']) &&
    value.id === PRODUCT_TEMPLATE_ID &&
    value.version === PRODUCT_TEMPLATE_VERSION
  );
}

function isProductSchemaStatus(value: unknown): value is ProductSchemaStatus {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'sourceSchemaVersion',
      'currentSchemaVersion',
      'migrationRequired',
      'steps',
    ]) ||
    value.currentSchemaVersion !== PRODUCT_SCHEMA_VERSION ||
    !Array.isArray(value.steps)
  ) {
    return false;
  }
  if (value.sourceSchemaVersion === PRODUCT_SCHEMA_V1) {
    return (
      value.migrationRequired === true &&
      value.steps.length === 2 &&
      value.steps[0] === PROJECT_MIGRATION_STEP_V1_TO_V2 &&
      value.steps[1] === PROJECT_MIGRATION_STEP_V2_TO_V3
    );
  }
  if (value.sourceSchemaVersion === PRODUCT_SCHEMA_V2) {
    return (
      value.migrationRequired === true &&
      value.steps.length === 1 &&
      value.steps[0] === PROJECT_MIGRATION_STEP_V2_TO_V3
    );
  }
  return (
    value.sourceSchemaVersion === PRODUCT_SCHEMA_VERSION &&
    value.migrationRequired === false &&
    value.steps.length === 0
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

const OPAQUE_CAPABILITY = /^[0-9A-Za-z-]{1,128}$/u;
const CANONICAL_PRODUCT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9A-F]{64}$/u;
const FUID = /^[0-9A-F]{32}$/u;

function isOpaqueCapability(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_CAPABILITY.test(value);
}

export function isProductDiagnostic(value: unknown): value is ProductDiagnostic {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['code', 'path', 'message']) &&
    typeof value.code === 'string' &&
    typeof value.path === 'string' &&
    typeof value.message === 'string'
  );
}

export function isProductDraft(value: unknown): value is ProductDraft {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['vendor', 'name', 'version', 'gainDb']) &&
    typeof value.vendor === 'string' &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    isFiniteNumber(value.gainDb)
  );
}

export function isValidateProductRequest(value: unknown): value is ValidateProductRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['documentId', 'draft']) &&
    isOpaqueCapability(value.documentId) &&
    isProductDraft(value.draft)
  );
}

export function isSaveProductRequest(value: unknown): value is SaveProductRequest {
  return isValidateProductRequest(value);
}

export function isExportProductRequest(value: unknown): value is ExportProductRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['documentId', 'configuration']) &&
    isOpaqueCapability(value.documentId) &&
    (value.configuration === 'Debug' || value.configuration === 'Release')
  );
}

export function isCleanupProductArtifactRequest(
  value: unknown,
): value is CleanupProductArtifactRequest {
  return (
    isRecord(value) && hasExactKeys(value, ['cleanupId']) && isOpaqueCapability(value.cleanupId)
  );
}

function isProductDocument(value: unknown): value is ProductDocument {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'documentId',
      'locationLabel',
      'saved',
      'schemaVersion',
      'schemaStatus',
      'productId',
      'category',
      'template',
      'graph',
      'draft',
      'cleanupWarnings',
    ]) &&
    isOpaqueCapability(value.documentId) &&
    (typeof value.locationLabel === 'string' || value.locationLabel === null) &&
    typeof value.saved === 'boolean' &&
    value.schemaVersion === PRODUCT_SCHEMA_VERSION &&
    isProductSchemaStatus(value.schemaStatus) &&
    typeof value.productId === 'string' &&
    CANONICAL_PRODUCT_ID.test(value.productId) &&
    value.category === PRODUCT_CATEGORY &&
    isProductTemplate(value.template) &&
    isProductGraphSource(value.graph) &&
    isProductDraft(value.draft) &&
    Array.isArray(value.cleanupWarnings) &&
    value.cleanupWarnings.every(isProductCleanupWarning)
  );
}

function isProductInspection(value: unknown): value is ProductInspection {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'productId',
      'vendor',
      'name',
      'version',
      'category',
      'template',
      'processorFuid',
      'controllerFuid',
      'gain',
      'bypass',
    ]) ||
    typeof value.productId !== 'string' ||
    !CANONICAL_PRODUCT_ID.test(value.productId) ||
    typeof value.vendor !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.version !== 'string' ||
    value.category !== PRODUCT_CATEGORY ||
    !isProductTemplate(value.template) ||
    typeof value.processorFuid !== 'string' ||
    !FUID.test(value.processorFuid) ||
    typeof value.controllerFuid !== 'string' ||
    !FUID.test(value.controllerFuid) ||
    !isRecord(value.gain) ||
    !isRecord(value.bypass)
  ) {
    return false;
  }
  return (
    hasExactKeys(value.gain, ['id', 'defaultDb', 'defaultNormalized']) &&
    value.gain.id === 1001 &&
    isFiniteNumber(value.gain.defaultDb) &&
    isFiniteNumber(value.gain.defaultNormalized) &&
    hasExactKeys(value.bypass, ['id', 'default', 'defaultNormalized']) &&
    value.bypass.id === 1002 &&
    value.bypass.default === false &&
    value.bypass.defaultNormalized === 0
  );
}

function isProductExportChildProcess(value: unknown): value is ProductExportChildProcess {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['tool', 'exitCode']) &&
    typeof value.tool === 'string' &&
    value.tool.length > 0 &&
    !/[\\/]/u.test(value.tool) &&
    isNonNegativeInteger(value.exitCode)
  );
}

function isProductCleanupWarning(value: unknown): value is ProductCleanupWarning {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['cleanupId', 'diagnostic']) &&
    (isOpaqueCapability(value.cleanupId) || value.cleanupId === null) &&
    isProductDiagnostic(value.diagnostic)
  );
}

function isProductExportResult(value: unknown): value is ProductExportResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'configuration',
      'bundlePath',
      'runtimeSha256',
      'compiledSha256',
      'compiledBytes',
      'moduleInfoSha256',
      'moduleInfoBytes',
      'processorFuid',
      'controllerFuid',
      'inventory',
      'childProcesses',
      'cleanupWarnings',
    ]) &&
    (value.configuration === 'Debug' || value.configuration === 'Release') &&
    typeof value.bundlePath === 'string' &&
    value.bundlePath.length > 0 &&
    typeof value.runtimeSha256 === 'string' &&
    SHA256.test(value.runtimeSha256) &&
    typeof value.compiledSha256 === 'string' &&
    SHA256.test(value.compiledSha256) &&
    isNonNegativeInteger(value.compiledBytes) &&
    typeof value.moduleInfoSha256 === 'string' &&
    SHA256.test(value.moduleInfoSha256) &&
    isNonNegativeInteger(value.moduleInfoBytes) &&
    typeof value.processorFuid === 'string' &&
    FUID.test(value.processorFuid) &&
    typeof value.controllerFuid === 'string' &&
    FUID.test(value.controllerFuid) &&
    Array.isArray(value.inventory) &&
    value.inventory.every((item) => typeof item === 'string') &&
    Array.isArray(value.childProcesses) &&
    value.childProcesses.every(isProductExportChildProcess) &&
    Array.isArray(value.cleanupWarnings) &&
    value.cleanupWarnings.every(isProductCleanupWarning)
  );
}

function isCleanedResult(value: unknown): value is { readonly cleaned: true } {
  return isRecord(value) && hasExactKeys(value, ['cleaned']) && value.cleaned === true;
}

function isProductOperationResultWith<T>(
  value: unknown,
  isValue: (candidate: unknown) => candidate is T,
): value is ProductOperationResult<T> {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false;
  }
  if (value.status === 'cancelled') {
    return hasExactKeys(value, ['status']);
  }
  if (value.status === 'error') {
    return hasExactKeys(value, ['status', 'diagnostic']) && isProductDiagnostic(value.diagnostic);
  }
  if (value.status !== 'ok' || !hasExactKeys(value, ['status', 'value'])) {
    return false;
  }
  return isValue(value.value);
}

export function isProductDocumentResult(
  value: unknown,
): value is ProductOperationResult<ProductDocument> {
  return isProductOperationResultWith(value, isProductDocument);
}

export function isProductInspectionResult(
  value: unknown,
): value is ProductOperationResult<ProductInspection> {
  return isProductOperationResultWith(value, isProductInspection);
}

export function isProductExportOperationResult(
  value: unknown,
): value is ProductOperationResult<ProductExportResult> {
  return isProductOperationResultWith(value, isProductExportResult);
}

export function isProductCleanupResult(
  value: unknown,
): value is ProductOperationResult<{ readonly cleaned: true }> {
  return isProductOperationResultWith(value, isCleanedResult);
}

export const PRODUCT_IPC_CHANNELS = Object.freeze({
  newProduct: 'garak:product:new',
  openProduct: 'garak:product:open',
  validateProduct: 'garak:product:validate',
  saveProduct: 'garak:product:save',
  exportProduct: 'garak:product:export',
  cleanupProductArtifact: 'garak:product:cleanup',
});
