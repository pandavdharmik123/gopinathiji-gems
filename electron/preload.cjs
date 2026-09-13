const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer window (React)
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
});
