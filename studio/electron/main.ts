import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

let mainWindow: BrowserWindow | null = null;

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
