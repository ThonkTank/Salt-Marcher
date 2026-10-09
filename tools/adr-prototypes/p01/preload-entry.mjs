import { contextBridge, ipcRenderer } from "electron";
import { SCHEMA_VERSION, validateInvalidation, validateRequest, validateResponse } from "../contracts/p01-v2/contract.mjs";

function requestId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

const api = Object.freeze({
  async invoke(operation, payload) {
    const request = validateRequest({ schemaVersion: SCHEMA_VERSION, operation, requestId: requestId(), payload });
    const response = validateResponse(await ipcRenderer.invoke("p01:invoke", request));
    if (!response.ok) throw new Error(response.error);
    return response.result;
  },
  subscribe(listener) {
    if (typeof listener !== "function") throw new Error("listener required");
    const receive = (_event, value) => listener(validateInvalidation(value));
    ipcRenderer.on("p01:invalidation", receive);
    return () => ipcRenderer.removeListener("p01:invalidation", receive);
  },
});
contextBridge.exposeInMainWorld("p01", api);
