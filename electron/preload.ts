import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (cb: (max: boolean) => void) => {
      const listener = (_: unknown, max: boolean) => cb(max);
      ipcRenderer.on('window:maximized', listener);
      return () => ipcRenderer.removeListener('window:maximized', listener);
    },
  },
  theme: {
    set: (mode: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', mode),
    get: () => ipcRenderer.invoke('theme:get'),
  },
  // Backend data API: renderer calls window.api.db.invoke(channel, payload).
  db: {
    invoke: (channel: string, payload?: unknown) =>
      ipcRenderer.invoke('api:invoke', channel, payload),
    channels: () => ipcRenderer.invoke('api:channels'),
  },
});
