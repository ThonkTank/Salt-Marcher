const { contextBridge, ipcRenderer } = require("electron");

const CHANNEL_CHANGED = "p03:projection-changed";

contextBridge.exposeInMainWorld(
  "partyDisplay",
  Object.freeze({
    readProjection: () => ipcRenderer.invoke("p03:read-projection"),
    subscribeProjectionChanged: (listener) => {
      if (typeof listener !== "function")
        throw new TypeError("listener required");
      const wrapped = (_event, value) => listener(value);
      ipcRenderer.on(CHANNEL_CHANGED, wrapped);
      return () => ipcRenderer.removeListener(CHANNEL_CHANGED, wrapped);
    },
    readCoreStatus: () => ipcRenderer.invoke("p03:read-core-status"),
  }),
);
