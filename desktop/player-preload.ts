import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld(
  'playerDisplay',
  Object.freeze({
    frame: () => ipcRenderer.invoke('player:frame'),
    onFrame: (callback: (frame: unknown) => void) =>
      ipcRenderer.on('player:frame-update', (_e, frame) => callback(frame)),
  }),
);
