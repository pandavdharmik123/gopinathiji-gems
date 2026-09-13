const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');
const path = require('node:path');
const os = require('node:os');

// Windows 7 compatibility fallbacks
const isWindows7 = os.platform() === 'win32' && os.release().startsWith('6.1');
if (isWindows7) {
  // Disable hardware acceleration on Windows 7 to prevent GPU crashes
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-sandbox');
}

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true' || !app.isPackaged;
const devServerUrl = process.env.DEV_SERVER_URL || 'http://localhost:8443';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Gopinathji Gems',
    icon: path.join(__dirname, '../public/logoTwo.png'),
    backgroundColor: '#0f172a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Remove default menu bar on Windows and Linux (File, Edit, View, Window, Help)
  if (process.platform !== 'darwin') {
    mainWindow.removeMenu();
    mainWindow.setMenu(null);
  }

  // Graceful show on ready-to-show
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in default OS browser instead of Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev && !app.isPackaged) {
    mainWindow.loadURL(devServerUrl).catch(() => {
      // Retry loading if dev server is still starting
      setTimeout(() => {
        mainWindow.loadURL(devServerUrl);
      }, 1500);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('app:get-info', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isWindows7,
  };
});

// App Lifecycle
app.whenReady().then(() => {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }
  createWindow();

  app.on('activate', () => {
    // macOS: Re-create a window when dock icon is clicked and no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS apps generally remain open until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
