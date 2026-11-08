import { contextBridge, ipcRenderer } from "electron";
import type { AtlasDesktop } from "../src/editor/bridge";

const call = (method: string, argument?: unknown) =>
  ipcRenderer.invoke("atlas:p0", { method, argument });

const api: AtlasDesktop = {
  diagnostics: process.argv.includes("--atlas-diagnostics"),
  status: () => call("status"),
  readRegion: (request) => call("readRegion", request),
  readPresentation: (request) => call("readPresentation", request),
  commit: (request) =>
    call("commit", {
      sessionId: request.sessionId,
      sequence: request.sequence,
      transactionId: request.transactionId,
      // History's before-images stay in the renderer; never clone them over IPC.
      patches: request.patches.map(({ key, after }) => ({ key, after })),
    }),
  newProject: () => call("newProject"),
  openProject: () => call("openProject"),
  saveProject: (request) => call("saveProject", request),
  metrics: () => call("metrics"),
};

contextBridge.exposeInMainWorld("atlasDesktop", api);
