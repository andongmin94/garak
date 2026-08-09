import { contextBridge, ipcRenderer } from 'electron';

import {
  PRODUCT_IPC_CHANNELS,
  isCleanupProductArtifactRequest,
  isExportProductRequest,
  isProductCleanupResult,
  isProductDocumentResult,
  isProductExportOperationResult,
  isProductInspectionResult,
  isSaveProductRequest,
  isValidateProductRequest,
} from '../src/shared/product_api.mts';
import type {
  CleanupProductArtifactRequest,
  ExportProductRequest,
  GarakStudioApi,
  ProductOperationResult,
  SaveProductRequest,
  ValidateProductRequest,
} from '../src/shared/product_api.mts';

type ResultGuard<T> = (value: unknown) => value is ProductOperationResult<T>;

function boundaryError<T>(
  operation: string,
  kind: 'request' | 'response' | 'transport',
  detail?: string,
): ProductOperationResult<T> {
  const suffix = detail === undefined || detail.length === 0 ? '' : ` ${detail}`;
  return {
    status: 'error',
    diagnostic: {
      code: `GARAK_STUDIO_IPC_${kind.toUpperCase()}`,
      path: `studio.ipc.${operation}`,
      message: `Studio rejected an invalid Product ${kind}.${suffix}`,
    },
  };
}

async function invokeProduct<T>(
  operation: string,
  channel: string,
  resultGuard: ResultGuard<T>,
  request?: unknown,
): Promise<ProductOperationResult<T>> {
  let response: unknown;
  try {
    response =
      request === undefined
        ? await ipcRenderer.invoke(channel)
        : await ipcRenderer.invoke(channel, request);
  } catch (error: unknown) {
    const detail =
      error instanceof Error && error.message.length > 0 ? error.message.slice(0, 512) : undefined;
    return boundaryError(operation, 'transport', detail);
  }

  return resultGuard(response) ? response : boundaryError(operation, 'response');
}

function rejectInvalidRequest<T>(operation: string): Promise<ProductOperationResult<T>> {
  return Promise.resolve(boundaryError(operation, 'request'));
}

const garakStudioApi = Object.freeze({
  newProduct: () =>
    invokeProduct('newProduct', PRODUCT_IPC_CHANNELS.newProduct, isProductDocumentResult),
  openProduct: () =>
    invokeProduct('openProduct', PRODUCT_IPC_CHANNELS.openProduct, isProductDocumentResult),
  validateProduct: (request: ValidateProductRequest) =>
    isValidateProductRequest(request)
      ? invokeProduct(
          'validateProduct',
          PRODUCT_IPC_CHANNELS.validateProduct,
          isProductInspectionResult,
          request,
        )
      : rejectInvalidRequest('validateProduct'),
  saveProduct: (request: SaveProductRequest) =>
    isSaveProductRequest(request)
      ? invokeProduct(
          'saveProduct',
          PRODUCT_IPC_CHANNELS.saveProduct,
          isProductDocumentResult,
          request,
        )
      : rejectInvalidRequest('saveProduct'),
  exportProduct: (request: ExportProductRequest) =>
    isExportProductRequest(request)
      ? invokeProduct(
          'exportProduct',
          PRODUCT_IPC_CHANNELS.exportProduct,
          isProductExportOperationResult,
          request,
        )
      : rejectInvalidRequest('exportProduct'),
  cleanupProductArtifact: (request: CleanupProductArtifactRequest) =>
    isCleanupProductArtifactRequest(request)
      ? invokeProduct(
          'cleanupProductArtifact',
          PRODUCT_IPC_CHANNELS.cleanupProductArtifact,
          isProductCleanupResult,
          request,
        )
      : rejectInvalidRequest('cleanupProductArtifact'),
} satisfies GarakStudioApi);

contextBridge.exposeInMainWorld('garakStudio', garakStudioApi);
