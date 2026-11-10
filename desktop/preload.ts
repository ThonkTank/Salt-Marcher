import { contextBridge, ipcRenderer } from "electron";
import type { AtlasDesktop, FileActionRequest } from "../src/editor/bridge";

const call = (method: string, argument?: unknown) =>
  ipcRenderer.invoke("atlas:p0", { method, argument });

const api: AtlasDesktop = {
  diagnostics: process.argv.includes("--atlas-diagnostics"),
  onFileAction: (handler) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      request: FileActionRequest & { id: number },
    ) => {
      void Promise.resolve()
        .then(() => handler(request))
        .then(
          (value) =>
            ipcRenderer.send("atlas:p0:file-action", { id: request.id, value }),
          (error: unknown) =>
            ipcRenderer.send("atlas:p0:file-action", {
              id: request.id,
              error: error instanceof Error ? error.message : String(error),
            }),
        );
    };
    ipcRenderer.on("atlas:p0:file-action", listener);
    return () => ipcRenderer.removeListener("atlas:p0:file-action", listener);
  },
  status: () => call("status"),
  readRegion: (request) => call("readRegion", request),
  readPresentation: (request) => call("readPresentation", request),
  readLandscapeRegion: (request) => call("readLandscapeRegion", request),
  readLandscapePresentation: (request) =>
    call("readLandscapePresentation", request),
  commit: (request) =>
    call("commit", {
      sessionId: request.sessionId,
      sequence: request.sequence,
      transactionId: request.transactionId,
      // History's before-images stay in the renderer; never clone them over IPC.
      patches: request.patches.map(({ kind, key, after }) => ({
        kind,
        key,
        after,
      })),
    }),
  newProject: (prepared) => call("newProject", prepared),
  openProject: (prepared) => call("openProject", prepared),
  saveProject: (request) => call("saveProject", request),
  metrics: () => call("metrics"),
};

contextBridge.exposeInMainWorld("atlasDesktop", api);
