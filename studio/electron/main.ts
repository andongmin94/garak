import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { IpcMainInvokeEvent, MessageBoxOptions } from 'electron';
import path from 'node:path';

import { ProductService } from './product_service.mts';
import type { ProductDialogPort } from './product_service.mts';
import {
  PRODUCT_IPC_CHANNELS,
  isCleanupProductArtifactRequest,
  isExportProductRequest,
  isSaveProductRequest,
  isValidateProductRequest,
} from '../src/shared/product_api.mts';
import type { ProductDiagnostic, ProductOperationResult } from '../src/shared/product_api.mts';

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
const repositoryRoot = path.resolve(__dirname, '../..');

let mainWindow: BrowserWindow | null = null;

function requireMainWindow(): BrowserWindow {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    throw new Error('The Garak Studio window is not available.');
  }
  return mainWindow;
}

async function chooseProjectToOpen(): Promise<string | null> {
  const result = await dialog.showOpenDialog(requireMainWindow(), {
    title: 'Open Garak Product',
    buttonLabel: 'Open Product',
    properties: ['openDirectory', 'dontAddToRecent'],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

async function chooseProjectToCreate(suggestedName: string): Promise<string | null> {
  const result = await dialog.showSaveDialog(requireMainWindow(), {
    title: 'Create Garak Product',
    buttonLabel: 'Create Product',
    defaultPath: `${suggestedName}.garak`,
    filters: [{ name: 'Garak Product', extensions: ['garak'] }],
    properties: ['dontAddToRecent', 'showOverwriteConfirmation'],
  });
  return result.canceled ? null : (result.filePath ?? null);
}

async function chooseExportDirectory(): Promise<string | null> {
  const result = await dialog.showOpenDialog(requireMainWindow(), {
    title: 'Choose VST3 Export Folder',
    buttonLabel: 'Choose Export Folder',
    properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

async function confirmAction(options: MessageBoxOptions): Promise<boolean> {
  const result = await dialog.showMessageBox(requireMainWindow(), options);
  return result.response === 1;
}

async function notify(options: MessageBoxOptions): Promise<void> {
  await dialog.showMessageBox(requireMainWindow(), options);
}

const productDialogs: ProductDialogPort = {
  chooseProjectToOpen,
  chooseProjectToCreate,
  chooseExportDirectory,
  confirmProjectMigration: () =>
    confirmAction({
      type: 'warning',
      title: 'Upgrade This Garak Project?',
      message: 'This project uses an older editable schema.',
      detail:
        'Choose Back Up & Upgrade to retain a verified copy of the original project before Garak publishes schema 2. Product ID, VST3 FUIDs, parameter IDs, and sound defaults remain unchanged. Choose Open Read-Only to leave the source untouched.',
      buttons: ['Open Read-Only', 'Back Up & Upgrade'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }),
  notifyProjectMigrationComplete: (notice) =>
    notify({
      type: 'info',
      title: 'Project Upgrade Complete',
      message: 'The project was backed up and upgraded safely.',
      detail: `Verified backup: ${notice.projectDirectory}\nFingerprint: ${notice.fingerprint}`,
      buttons: ['OK'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }),
  notifyProjectConflict: (diagnostic) =>
    notify({
      type: 'warning',
      title: 'Project Changed Outside Garak',
      message: 'Garak did not overwrite the project.',
      detail: `${diagnostic.message}\n\nReopen the project to inspect the current disk version. Your in-memory edits remain in this window until you choose another project.`,
      buttons: ['OK'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }),
  notifyRecoveryRequired: (diagnostic) =>
    notify({
      type: 'error',
      title: 'Project Recovery Needs Review',
      message: 'Garak found an interrupted or ambiguous persistence transaction.',
      detail: `${diagnostic.message}\n\nNo project, backup, lock, or transaction artifact was deleted automatically.`,
      buttons: ['OK'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }),
  confirmExportReplacement: (diagnostic: ProductDiagnostic) =>
    confirmAction({
      type: 'warning',
      title: 'Replace Existing VST3?',
      message: 'A VST3 with this product name already exists.',
      detail: `${diagnostic.message}\n\nThe existing valid bundle is preserved unless you choose Replace.`,
      buttons: ['Cancel', 'Replace'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }),
  confirmOwnedCleanup: () =>
    confirmAction({
      type: 'warning',
      title: 'Remove Transaction Artifact?',
      message: 'Remove the compiler-owned transaction artifact?',
      detail:
        'The published product remains valid. Garak will recheck ownership and containment before cleanup.',
      buttons: ['Cancel', 'Remove Artifact'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }),
};

const productService = new ProductService({
  dialogs: productDialogs,
  repositoryRoot,
});

function boundaryError<T>(operation: string, message: string): ProductOperationResult<T> {
  return {
    status: 'error',
    diagnostic: {
      code: 'GARAK_STUDIO_IPC_REQUEST',
      path: `studio.ipc.${operation}`,
      message,
    },
  };
}

function isTrustedProductSender(event: IpcMainInvokeEvent): boolean {
  const window = mainWindow;
  return (
    window !== null &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame
  );
}

function trustedRequest<T>(
  event: IpcMainInvokeEvent,
  operation: string,
  arguments_: readonly unknown[],
  guard: (value: unknown) => value is T,
): T | ProductOperationResult<never> {
  if (!isTrustedProductSender(event)) {
    return boundaryError(operation, 'Studio rejected Product IPC from an untrusted sender.');
  }
  const request = arguments_[0];
  if (arguments_.length !== 1 || !guard(request)) {
    return boundaryError(operation, 'Studio rejected a malformed Product request.');
  }
  return request;
}

function isBoundaryResult(value: unknown): value is ProductOperationResult<never> {
  return (
    typeof value === 'object' && value !== null && 'status' in value && value.status === 'error'
  );
}

ipcMain.handle(
  PRODUCT_IPC_CHANNELS.newProduct,
  (event: IpcMainInvokeEvent, ...arguments_: unknown[]) => {
    if (!isTrustedProductSender(event)) {
      return boundaryError('newProduct', 'Studio rejected Product IPC from an untrusted sender.');
    }
    if (arguments_.length !== 0) {
      return boundaryError('newProduct', 'Studio rejected unexpected Product request data.');
    }
    return productService.newProduct();
  },
);

ipcMain.handle(
  PRODUCT_IPC_CHANNELS.openProduct,
  (event: IpcMainInvokeEvent, ...arguments_: unknown[]) => {
    if (!isTrustedProductSender(event)) {
      return boundaryError('openProduct', 'Studio rejected Product IPC from an untrusted sender.');
    }
    if (arguments_.length !== 0) {
      return boundaryError('openProduct', 'Studio rejected unexpected Product request data.');
    }
    return productService.openProduct();
  },
);

ipcMain.handle(
  PRODUCT_IPC_CHANNELS.validateProduct,
  (event: IpcMainInvokeEvent, ...arguments_: unknown[]) => {
    const request = trustedRequest(event, 'validateProduct', arguments_, isValidateProductRequest);
    return isBoundaryResult(request) ? request : productService.validateProduct(request);
  },
);

ipcMain.handle(
  PRODUCT_IPC_CHANNELS.saveProduct,
  (event: IpcMainInvokeEvent, ...arguments_: unknown[]) => {
    const request = trustedRequest(event, 'saveProduct', arguments_, isSaveProductRequest);
    return isBoundaryResult(request) ? request : productService.saveProduct(request);
  },
);

ipcMain.handle(
  PRODUCT_IPC_CHANNELS.exportProduct,
  (event: IpcMainInvokeEvent, ...arguments_: unknown[]) => {
    const request = trustedRequest(event, 'exportProduct', arguments_, isExportProductRequest);
    return isBoundaryResult(request) ? request : productService.exportProduct(request);
  },
);

ipcMain.handle(
  PRODUCT_IPC_CHANNELS.cleanupProductArtifact,
  (event: IpcMainInvokeEvent, ...arguments_: unknown[]) => {
    const request = trustedRequest(
      event,
      'cleanupProductArtifact',
      arguments_,
      isCleanupProductArtifactRequest,
    );
    return isBoundaryResult(request) ? request : productService.cleanupProductArtifact(request);
  },
);

function getDevelopmentServerUrl(): string | undefined {
  const value = process.env.VITE_DEV_SERVER_URL;

  if (value === undefined) {
    return undefined;
  }

  const url = new URL(value);
  const isAllowed =
    url.protocol === 'http:' &&
    loopbackHosts.has(url.hostname) &&
    url.username === '' &&
    url.password === '' &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '';

  if (!isAllowed) {
    throw new Error('The Studio development server must use an HTTP loopback URL.');
  }

  return url.toString();
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  const developmentServerUrl = app.isPackaged ? undefined : getDevelopmentServerUrl();

  if (developmentServerUrl !== undefined) {
    await window.loadURL(developmentServerUrl);
    return;
  }

  await window.loadFile(path.join(__dirname, '../dist/index.html'));
}

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 760,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#11120f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  mainWindow = window;

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  window.webContents.on('will-redirect', (event) => {
    event.preventDefault();
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.once('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
      productService.clearCapabilities();
    }
  });

  void loadRenderer(window).catch((error: unknown) => {
    console.error('Unable to load the Garak Studio renderer.', error);
    window.destroy();
    app.quit();
  });
}

void app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
