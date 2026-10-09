import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { app, BrowserWindow, ipcMain, utilityProcess } from "electron";
import { validateRequest, validateResponse } from "../contracts/p01-v2/contract.mjs";

const configurationPath = process.argv.at(-1);
if (!configurationPath || configurationPath.startsWith("--")) throw new Error("missing launch configuration");
const options = JSON.parse(readFileSync(configurationPath, "utf8"));
console.log("H02_MAIN_START", JSON.stringify({ configurationPath, keys: Object.keys(options) }));
for (const key of ["root", "helper", "utility", "preload", "renderer", "result", "mode"])
  if (!options[key]) throw new Error(`missing --${key}`);
const processTokens = {
  main: crypto.randomBytes(24).toString("base64url"),
  utility: crypto.randomBytes(24).toString("base64url"),
  helper: crypto.randomBytes(24).toString("base64url"),
  renderer: crypto.randomBytes(24).toString("base64url"),
};
const mainStartedAt = new Date().toISOString();
const pending = new Map();
let window;
let child;
let utilityReady;
let rendererResult;
let helperExitCode;
let observedProcesses;
let rendererStartedAt;
let finishing = false;
process.on("uncaughtException", (error) => void finish(error));
process.on("unhandledRejection", (error) => void finish(error));

function timeout(promise, milliseconds, label) {
  return Promise.race([promise, new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timeout`)), milliseconds))]);
}

async function processRecord(pid, token, startedAt) {
  const status = await readFile(`/proc/${pid}/status`, "utf8");
  const parent = /^PPid:\s+(\d+)$/m.exec(status);
  const ppid = Number(parent?.[1] ?? 0);
  const ancestors = [];
  let ancestor = ppid;
  while (ancestor > 1 && ancestors.length < 16) {
    ancestors.push(ancestor);
    const ancestorStatus = await readFile(`/proc/${ancestor}/status`, "utf8");
    ancestor = Number(/^PPid:\s+(\d+)$/m.exec(ancestorStatus)?.[1] ?? 0);
  }
  return { pid, ppid, ancestors, token, startedAt };
}

async function captureProcesses() {
  const rendererPid = window?.webContents.getOSProcessId();
  if (!rendererPid || !utilityReady) throw new Error("process inventory is incomplete");
  return {
    main: await processRecord(process.pid, processTokens.main, mainStartedAt),
    renderer: await processRecord(rendererPid, processTokens.renderer, rendererStartedAt),
    utility: await processRecord(utilityReady.utilityPid, processTokens.utility,
      utilityReady.utilityStartedAt),
    helper: await processRecord(utilityReady.helperPid, processTokens.helper,
      utilityReady.helperStartedAt),
  };
}

async function finish(error) {
  if (finishing) return;
  finishing = true;
  let utilityExitCode = null;
  try {
    if (child) {
      const exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
      child.postMessage({ kind: "shutdown" });
      utilityExitCode = await timeout(exited, 5000, "utility shutdown");
    }
  } catch (shutdownError) {
    if (!error) error = shutdownError;
    child?.kill();
  }
  const payload = {
    status: error ? "failed" : "passed",
    error: error ? String(error instanceof Error ? error.stack ?? error.message : error) : undefined,
    mode: options.mode,
    expectedDigest: options.expectedDigest || null,
    security: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true,
      registeredInvokeChannels: ["p01:invoke"] },
    processes: observedProcesses ?? {
      main: { pid: process.pid, token: processTokens.main },
      renderer: { pid: window?.webContents.getOSProcessId() ?? null, token: processTokens.renderer },
      utility: utilityReady ? { pid: utilityReady.utilityPid, token: processTokens.utility } : null,
      helper: utilityReady ? { pid: utilityReady.helperPid, token: processTokens.helper } : null,
    },
    lifecycle: { requestedNormalShutdown: true, helperExitCode, utilityExitCode,
      finishStartedAt: new Date().toISOString() },
    renderer: rendererResult,
  };
  await writeFile(options.result, JSON.stringify(payload, null, 2) + "\n");
  window?.destroy();
  app.exit(error ? 1 : 0);
}

async function start() {
child = utilityProcess.fork(options.utility,
  [options.root, options.helper, processTokens.utility, processTokens.helper],
  { serviceName: "ADR-P01-H02 Utility", stdio: "pipe" });
child.on("spawn", () => console.log("H02_UTILITY_SPAWN", child.pid));
child.on("exit", (code) => console.log("H02_UTILITY_EXIT", code));
child.stdout?.on("data", (data) => process.stdout.write(`UTILITY_OUT ${data}`));
child.stderr?.on("data", (data) => process.stderr.write(`UTILITY_ERR ${data}`));
utilityReady = await timeout(new Promise((resolve, reject) => {
  child.once("spawn", () => {});
  child.once("exit", (code) => reject(new Error(`utility exited before ready: ${code}`)));
  child.on("message", (message) => {
    if (message?.kind === "ready") resolve(message);
    else if (message?.kind === "response") {
      try {
        const response = validateResponse(message.response);
        const completion = pending.get(response.requestId);
        if (!completion) throw new Error("response request id is unknown");
        pending.delete(response.requestId);
        completion.resolve(response);
      } catch (error) { void finish(error); }
    } else if (message?.kind === "invalidation") window?.webContents.send("p01:invalidation", message.value);
    else if (message?.kind === "shutdown") helperExitCode = message.helperExitCode;
    else if (message?.kind === "boundaryError") void finish(new Error(message.error));
  });
}), 10000, "utility ready");
if (utilityReady.utilityToken !== processTokens.utility || utilityReady.helperToken !== processTokens.helper)
  throw new Error("utility/helper process token mismatch");
if (utilityReady.utilityPpid !== process.pid || utilityReady.helperPpid !== utilityReady.utilityPid)
  throw new Error("utility/helper parent chain mismatch");

ipcMain.handle("p01:invoke", (_event, raw) => {
  const request = validateRequest(raw);
  if (pending.has(request.requestId)) throw new Error("duplicate request id");
  const response = new Promise((resolve, reject) => pending.set(request.requestId, { resolve, reject }));
  child.postMessage({ kind: "request", request });
  return timeout(response, 10000, request.operation);
});

window = new BrowserWindow({
  show: false,
  width: 900,
  height: 650,
  webPreferences: {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
    preload: options.preload,
  },
});
rendererStartedAt = new Date().toISOString();
window.webContents.on("console-message", (_event, detailsOrLevel, message) => {
  const text = typeof detailsOrLevel === "object" ? detailsOrLevel.message : message;
  if (text?.startsWith("P01_RESULT ")) {
    try {
      rendererResult = JSON.parse(text.slice(11));
      if (rendererResult.rendererToken !== processTokens.renderer)
        throw new Error("renderer process token mismatch");
      void captureProcesses().then((value) => { observedProcesses = value; return finish(); }, finish);
    }
    catch (error) { void finish(error); }
  } else if (text?.startsWith("P01_ERROR ")) void finish(new Error(text.slice(10)));
});
window.webContents.on("render-process-gone", (_event, details) => void finish(new Error(`renderer gone: ${details.reason}`)));
const renderer = await readFile(options.renderer, "utf8");
const configuration = { mode: options.mode, expectedDigest: options.expectedDigest || null,
  rendererToken: processTokens.renderer };
const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'"><title>H02</title><script>const P01_CONFIG=${JSON.stringify(configuration)};${renderer}</script>`;
await window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
setTimeout(() => void finish(new Error("renderer completion timeout")), 30000);
}

void app.whenReady().then(start).catch((error) => finish(error));
