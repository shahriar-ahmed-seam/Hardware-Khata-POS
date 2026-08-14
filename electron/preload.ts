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
  /**
   * In-app updates. The CALLS go through db.invoke like everything else (so they
   * pass the same permission gate); this only adds a PUSH channel, because
   * download progress arrives from the main process unprompted and polling it
   * would be both wasteful and laggy.
   */
  updates: {
    onState: (cb: (state: unknown) => void) => {
      const listener = (_: unknown, state: unknown) => cb(state);
      ipcRenderer.on('update:state', listener);
      return () => ipcRenderer.removeListener('update:state', listener);
    },
  },
});
