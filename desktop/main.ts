import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  utilityProcess,
  type IpcMainInvokeEvent,
  type UtilityProcess,
} from "electron";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  FileActionRequest,
  PreparedDocument,
  ProjectInfo,
  SaveRequest,
  SaveResult,
  SourceBoundary,
} from "../src/editor/bridge";
import type { PreparedSave, StoreActivity } from "./project-store";
import { HEIGHT_MAX_ACTION_TILES } from "../src/editor/model/types";

const CHANNEL = "atlas:p0";
const FILE_ACTION_CHANNEL = "atlas:p0:file-action";
const MAX_PENDING = 64;
const diagnostics = process.env.ATLAS_P0_DIAGNOSTICS === "1";
const indexPath = resolve(__dirname, "../dist-editor/index.html");
// Faults belong to explicit diagnostic launches. A normal packaged start never
// inherits a broken editor just because a stale fault variable remains set.
const fault =
  diagnostics &&
  ["delay-render", "drop-render", "ignore-zoom", "pointerup-render"].includes(
    process.env.ATLAS_P0_FAULT ?? "",
  )
    ? process.env.ATLAS_P0_FAULT
    : undefined;
const initialURL = new URL(pathToFileURL(indexPath).href);
if (fault) initialURL.searchParams.set("fault", fault);
const indexURL = initialURL.href;

class StoreProcess {
  readonly child: UtilityProcess;
  readonly ready: Promise<void>;
  private serial = 0;
  private failure: Error | null = null;
  private readonly activityEvents: (StoreActivity & { index: number })[] = [];
  private activityCount = 0;
  private droppedActivity = 0;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(directory: string) {
    this.child = utilityProcess.fork(
      join(__dirname, "store-process.cjs"),
      [directory],
      {
        serviceName: "Atlas ProjectStore",
        stdio: "pipe",
      },
    );
    this.child.stdout?.on("data", (chunk: Buffer) =>
      process.stdout.write(chunk),
    );
    this.child.stderr?.on("data", (chunk: Buffer) =>
      process.stderr.write(chunk),
    );
    this.ready = new Promise<void>((resolveReady, rejectReady) => {
      this.child.on(
        "message",
        (message: {
          ready?: boolean;
          fatal?: string;
          id?: number;
          value?: unknown;
          error?: string;
          activity?: StoreActivity;
        }) => {
          if (diagnostics && message.activity) {
            const index = this.activityCount++;
            if (this.activityEvents.length < 20_000)
              this.activityEvents.push({ ...message.activity, index });
            else this.droppedActivity++;
          }
          if (message.ready) resolveReady();
          if (message.fatal) {
            const error = new Error(message.fatal);
            rejectReady(error);
            this.rejectAll(error);
          }
          if (message.id === undefined) return;
          const pending = this.pending.get(message.id);
          if (!pending) return;
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error));
          else pending.resolve(message.value);
        },
      );
      this.child.once("exit", (code) => {
        const error = new Error(
          `Der Projektspeicher wurde beendet (${code}). Nicht bestätigte Änderungen bleiben im Editor; sie wurden nicht als gespeichert bestätigt.`,
        );
        rejectReady(error);
        this.rejectAll(error);
      });
    });
  }

  private rejectAll(error: Error) {
    this.failure = error;
    for (const task of this.pending.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    this.pending.clear();
  }

  request<T>(method: string, argument?: unknown): Promise<T> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.pending.size >= MAX_PENDING)
      return Promise.reject(
        new Error(
          "Der Projektspeicher ist ausgelastet. Bitte den ausstehenden Schreibstand prüfen.",
        ),
      );
    const id = ++this.serial;
    return new Promise<T>((resolveRequest, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            "Der Speicherauftrag wurde nicht rechtzeitig bestätigt. Ein Schreibauftrag darf nicht ungeprüft wiederholt werden; bitte den Speicherstand prüfen.",
          ),
        );
      }, 30_000);
      this.pending.set(id, {
        resolve: (value) => resolveRequest(value as T),
        reject,
        timer,
      });
      try {
        this.child.postMessage({ id, method, argument });
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  terminate() {
    this.child.kill();
  }

  activity({ sinceEvent = 0 }: { sinceEvent?: number } = {}) {
    if (!Number.isSafeInteger(sinceEvent) || sinceEvent < 0)
      throw new Error("Ungültiger Beobachtungscursor.");
    return {
      events: this.activityEvents
        .slice(sinceEvent)
        .map((event) => ({ ...event })),
      eventCount: this.activityCount,
      droppedEvents: this.droppedActivity,
    };
  }
}

let window: BrowserWindow;
let store: StoreProcess;
let fileActionPending = false;
let allowClose = false;
let workingDirectory: string;
let fileActionSerial = 0;
let pendingFileAction: {
  id: number;
  resolve: (value: PreparedDocument | null) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
} | null = null;
let diagnosticCommitAttempts = 0;

function trustedSender(
  event: Pick<IpcMainInvokeEvent, "sender" | "senderFrame">,
) {
  if (
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame?.url !== indexURL
  ) {
    throw new Error("Die Anfrage stammt nicht aus dem aktiven Atlas-Fenster.");
  }
}

function checkedPreparedDocument(value: unknown): PreparedDocument {
  const boundary = checkedBoundary(value);
  const candidate = value as PreparedDocument;
  if (
    candidate.persistenceError !== null &&
    (typeof candidate.persistenceError !== "string" ||
      candidate.persistenceError.length > 10_000)
  )
    throw new Error("Ungültiger lokaler Speicherzustand.");
  return { ...boundary, persistenceError: candidate.persistenceError };
}

function requestFileAction(
  request: FileActionRequest,
): Promise<PreparedDocument | null> {
  if (pendingFileAction)
    return Promise.reject(new Error("Ein Editorabschluss ist bereits offen."));
  const id = ++fileActionSerial;
  return new Promise((resolveRequest, reject) => {
    const timer = setTimeout(() => {
      pendingFileAction = null;
      reject(
        new Error(
          "Der Editor hat seinen lokalen Stand nicht bestätigt. Das Fenster bleibt geöffnet.",
        ),
      );
    }, 35_000);
    pendingFileAction = { id, resolve: resolveRequest, reject, timer };
    try {
      window.webContents.send(FILE_ACTION_CHANNEL, { ...request, id });
    } catch (error) {
      pendingFileAction = null;
      clearTimeout(timer);
      reject(error);
    }
  });
}

function checkedBoundary(value: unknown): SourceBoundary {
  const candidate = value as SourceBoundary;
  if (
    !candidate ||
    typeof candidate.sessionId !== "string" ||
    candidate.sessionId.length > 100 ||
    !Number.isSafeInteger(candidate.sequence) ||
    candidate.sequence < 0
  ) {
    throw new Error("Ungültiger Dokumentstand.");
  }
  return { sessionId: candidate.sessionId, sequence: candidate.sequence };
}

async function oneFileAction<T>(action: () => Promise<T>): Promise<T> {
  if (fileActionPending)
    throw new Error("Ein Datei- oder Schließvorgang ist bereits offen.");
  fileActionPending = true;
  try {
    return await action();
  } finally {
    fileActionPending = false;
  }
}

async function chooseOpen(): Promise<string | undefined> {
  // Automation may replace the OS dialog's answer; file operations stay real.
  if (process.env.ATLAS_P0_DIALOG_OPEN !== undefined)
    return process.env.ATLAS_P0_DIALOG_OPEN || undefined;
  const result = await dialog.showOpenDialog(window, {
    title: "Atlas-Projekt öffnen",
    filters: [{ name: "Atlas-Projekt", extensions: ["saltatlas"] }],
    properties: ["openFile"],
  });
  return result.canceled ? undefined : result.filePaths[0];
}

async function chooseSave(prepared: PreparedSave): Promise<string | undefined> {
  if (process.env.ATLAS_P0_DIALOG_SAVE !== undefined)
    return process.env.ATLAS_P0_DIALOG_SAVE || undefined;
  const result = await dialog.showSaveDialog(window, {
    title: "Atlas-Projekt speichern",
    defaultPath: prepared.path ?? `${prepared.title}.saltatlas`,
    filters: [{ name: "Atlas-Projekt", extensions: ["saltatlas"] }],
  });
  return result.canceled ? undefined : result.filePath;
}

async function save(request: SaveRequest): Promise<SaveResult | null> {
  const boundary = checkedBoundary(request);
  // Reserve S before displaying a dialog. Navigation and later source edits
  // remain live; the published file must still contain exactly this snapshot.
  const prepared = await store.request<PreparedSave>("prepareSave", boundary);
  try {
    const path =
      !request.saveAs && prepared.path
        ? prepared.path
        : await chooseSave(prepared);
    if (!path) return null;
    return await store.request<SaveResult>("publishSave", {
      token: prepared.token,
      path,
    });
  } finally {
    await store.request("discardSave", { token: prepared.token });
  }
}

/** A null boundary permits replacing an unavailable store only after explicit discard. */
async function mayReplace(
  local: PreparedDocument,
): Promise<{ boundary: SourceBoundary | null } | null> {
  let project: ProjectInfo | null;
  try {
    project = await store.request<ProjectInfo>("status");
  } catch {
    project = null;
  }
  if (
    project &&
    (project.sessionId !== local.sessionId ||
      project.sequence > local.sequence ||
      (!local.persistenceError && project.sequence !== local.sequence))
  )
    throw new Error(
      "Der lokale Editorstand und die Arbeitskopie stimmen nicht überein.",
    );
  if (
    project &&
    !local.persistenceError &&
    ((local.sequence === 0 && project.path === null) ||
      project.savedSequence === local.sequence)
  )
    return { boundary: checkedBoundary(project) };
  const automation = process.env.ATLAS_P0_DIALOG_UNSAVED;
  const response =
    automation === "save"
      ? 0
      : automation === "discard"
        ? 1
        : automation === "cancel"
          ? 2
          : (
              await dialog.showMessageBox(window, {
                type: "question",
                title: "Ungespeicherte Änderungen",
                message:
                  local.persistenceError || !project
                    ? "Nicht alle lokalen Änderungen sind bestätigt. Speichern prüft den tatsächlichen Speicherstand und versucht die erhaltenen Änderungen sicher zu übernehmen. Verwerfen gibt diese Änderungen ausdrücklich auf."
                    : "Die Änderungen an dieser Welt sind noch nicht in einer Projektdatei gespeichert.",
                buttons: ["Speichern", "Verwerfen", "Abbrechen"],
                defaultId: 0,
                cancelId: 2,
                noLink: true,
              })
            ).response;
  if (response === 2) return null;
  if (response === 1)
    return { boundary: project ? checkedBoundary(project) : null };
  const prepared =
    local.persistenceError || !project
      ? await requestFileAction({ kind: "recover" })
      : local;
  if (!prepared || prepared.persistenceError)
    throw new Error(
      prepared?.persistenceError ?? "Der Editorstand wurde nicht bestätigt.",
    );
  if (!(await save(prepared))) return null;
  return { boundary: checkedBoundary(prepared) };
}

async function replaceUnavailableStore(): Promise<void> {
  store.terminate();
  workingDirectory = mkdtempSync(join(app.getPath("temp"), "atlas-p0-"));
  store = new StoreProcess(workingDirectory);
  await store.ready;
}

function registerBridge() {
  ipcMain.on(
    FILE_ACTION_CHANNEL,
    (
      event,
      reply: {
        id?: number;
        value?: PreparedDocument | null;
        error?: string;
      },
    ) => {
      try {
        trustedSender(event);
        const pending = pendingFileAction;
        if (!pending || reply?.id !== pending.id) return;
        pendingFileAction = null;
        clearTimeout(pending.timer);
        if (typeof reply.error === "string")
          pending.reject(new Error(reply.error));
        else {
          try {
            pending.resolve(
              reply.value === null
                ? null
                : checkedPreparedDocument(reply.value),
            );
          } catch (error) {
            pending.reject(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        }
      } catch {
        // Untrusted frames cannot settle the active editor's lifecycle request.
      }
    },
  );
  ipcMain.handle(
    CHANNEL,
    async (event, request: { method?: string; argument?: unknown }) => {
      trustedSender(event);
      if (!request || typeof request.method !== "string")
        throw new Error("Ungültige Atlas-Anfrage.");
      const argument = request.argument as Record<string, unknown> | undefined;
      switch (request.method) {
        case "status":
          return store.request("status");
        case "metrics":
          return store.request("metrics");
        case "readRegion":
        case "readPresentation":
          if (
            !argument ||
            !Array.isArray(argument.bounds) ||
            argument.bounds.length !== 4
          )
            throw new Error("Ungültige Ausschnittabfrage.");
          return store.request(request.method, argument);
        case "commit": {
          checkedBoundary(argument);
          if (
            !argument ||
            !Array.isArray(argument.patches) ||
            argument.patches.length > HEIGHT_MAX_ACTION_TILES
          )
            throw new Error("Ungültige Quellenänderung.");
          // Full numeric/payload validation belongs to the utility process, not UI Main.
          const attempt = ++diagnosticCommitAttempts;
          if (diagnostics) {
            const delay = Number(process.env.ATLAS_P0_COMMIT_DELAY_MS ?? 0);
            if (attempt === 1 && Number.isFinite(delay) && delay > 0)
              await new Promise((resolveDelay) =>
                setTimeout(resolveDelay, Math.min(delay, 5_000)),
              );
            const commitFault = process.env.ATLAS_P0_COMMIT_FAULT;
            if (
              commitFault === "always-before" ||
              (commitFault === "before-once" && attempt === 1)
            )
              throw new Error(
                "Diagnose: Schreibauftrag vor der Transaktion abgewiesen.",
              );
          }
          const receipt = await store.request("commit", argument);
          if (
            diagnostics &&
            process.env.ATLAS_P0_COMMIT_FAULT === "after-once" &&
            attempt === 1
          )
            throw new Error(
              "Diagnose: Bestätigung nach erfolgreicher Transaktion verloren.",
            );
          return receipt;
        }
        case "saveProject":
          checkedBoundary(argument);
          return oneFileAction(() => save(argument as unknown as SaveRequest));
        case "newProject":
          return oneFileAction(async () => {
            const permit = await mayReplace(checkedPreparedDocument(argument));
            if (!permit) return null;
            if (!permit.boundary) {
              await replaceUnavailableStore();
              return store.request("status");
            }
            return store.request("newProject", permit.boundary);
          });
        case "openProject":
          return oneFileAction(async () => {
            const permit = await mayReplace(checkedPreparedDocument(argument));
            if (!permit) return null;
            const path = await chooseOpen();
            if (!path) return null;
            if (!permit.boundary) await replaceUnavailableStore();
            return store.request("openProject", {
              path,
              expected: permit.boundary ?? undefined,
            });
          });
        default:
          throw new Error("Unbekannte Atlas-Anfrage.");
      }
    },
  );
}

function registerDiagnostics() {
  if (!diagnostics) return;
  const manifestPath = join(__dirname, "build.json");
  let build: Record<string, unknown> | null = null;
  const buildProvenance: {
    kind: "executed-main-sibling";
    path: string;
    sha256: string | null;
    status: "ok" | "error";
    error?: string;
  } = {
    kind: "executed-main-sibling",
    path: manifestPath,
    sha256: null,
    status: "error",
  };
  try {
    // Electron's fs also reads this sibling inside app.asar. Capture it from
    // the executing bundle at startup, never from the runner's working tree.
    const bytes = readFileSync(manifestPath);
    buildProvenance.sha256 = createHash("sha256").update(bytes).digest("hex");
    const candidate = JSON.parse(bytes.toString("utf8"));
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      typeof candidate.commit !== "string" ||
      !/^[a-f0-9]{40}$/.test(candidate.commit) ||
      typeof candidate.dirty !== "boolean" ||
      typeof candidate.sourceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(candidate.sourceSha256) ||
      typeof candidate.lockSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(candidate.lockSha256) ||
      typeof candidate.builtAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.builtAt)) ||
      typeof candidate.node !== "string" ||
      candidate.node.length === 0
    ) {
      throw new Error(
        "Das ausgeführte Paket enthält kein gültiges Buildmanifest.",
      );
    }
    build = candidate;
    buildProvenance.status = "ok";
  } catch (error) {
    buildProvenance.error =
      error instanceof Error ? error.message : String(error);
  }
  let tracing = false;
  const startTrace = async (options?: { screenshots?: boolean }) => {
    if (tracing) throw new Error("Atlas trace is already running.");
    const debugger_ = window.webContents.debugger;
    if (debugger_.isAttached())
      throw new Error("Atlas trace needs an unclaimed debugger connection.");
    debugger_.attach("1.3");
    try {
      // DevTools' screenshot consumer is started by Tracing.start, not by
      // contentTracing's category filter. Keep the original JSON bytes in a
      // stream: decoding dataCollected here would round Chromium uint64 IDs.
      await debugger_.sendCommand("Tracing.start", {
        transferMode: "ReturnAsStream",
        streamFormat: "json",
        traceConfig: {
          includedCategories: [
            "blink.user_timing",
            "input",
            "latencyInfo",
            "cc",
            "viz",
            "gpu",
            "gpu.capture",
            "benchmark",
            "disabled-by-default-devtools.timeline",
            "disabled-by-default-devtools.timeline.frame",
            ...(options?.screenshots
              ? ["disabled-by-default-devtools.screenshot"]
              : []),
          ],
          recordMode: "recordUntilFull",
        },
      });
      tracing = true;
    } catch (error) {
      debugger_.detach();
      throw error;
    }
  };
  const stopTrace = async (path: string) => {
    if (!tracing) throw new Error("No Atlas trace is running.");
    const debugger_ = window.webContents.debugger;
    let listener: (
      event: Electron.Event,
      method: string,
      params: { stream?: string; dataLossOccurred?: boolean },
    ) => void;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const completed = new Promise<string>((resolveTrace, rejectTrace) => {
        listener = (_event, method, params) => {
          if (method !== "Tracing.tracingComplete") return;
          if (params.dataLossOccurred !== false || !params.stream)
            rejectTrace(new Error("Atlas trace is incomplete or lost events."));
          else resolveTrace(params.stream);
        };
        debugger_.on("message", listener);
        timeout = setTimeout(
          () => rejectTrace(new Error("Atlas trace did not finish.")),
          10_000,
        );
      });
      // Register completion before ending; a short trace may finish immediately.
      const [handle] = await Promise.all([
        completed,
        debugger_.sendCommand("Tracing.end"),
      ]);
      const file = await open(path, "w");
      try {
        for (;;) {
          const chunk = await debugger_.sendCommand("IO.read", { handle });
          await file.writeFile(
            chunk.base64Encoded
              ? Buffer.from(chunk.data, "base64")
              : Buffer.from(chunk.data, "utf8"),
          );
          if (chunk.eof) break;
        }
      } finally {
        await file.close();
        await debugger_.sendCommand("IO.close", { handle });
      }
      return path;
    } finally {
      if (timeout) clearTimeout(timeout);
      debugger_.removeListener("message", listener!);
      debugger_.detach();
      tracing = false;
    }
  };
  // This is main-process test instrumentation. Nothing here is exposed to the
  // renderer, and these observations never create readiness or source changes.
  Object.assign(globalThis, {
    __atlasHost: {
      info: async () => ({
        build,
        buildProvenance,
        versions: { ...process.versions },
        platform: process.platform,
        architecture: process.arch,
        packaged: app.isPackaged,
        gpuFeatures: app.getGPUFeatureStatus(),
        gpuInfo: await app.getGPUInfo("basic"),
        processes: app.getAppMetrics(),
        storePid: store.child.pid,
        displays: screen.getAllDisplays().map((display) => ({
          id: display.id,
          bounds: display.bounds,
          workArea: display.workArea,
          scaleFactor: display.scaleFactor,
          displayFrequency: display.displayFrequency,
        })),
      }),
      metrics: () => store.request("metrics"),
      storeActivity: (options?: { sinceEvent?: number }) =>
        store.activity(options),
      fileActionPending: () => fileActionPending,
      startTrace,
      stopTrace,
    },
  });
}

async function start() {
  app.setName("Atlas Machbarkeitsversuch");
  await app.whenReady();
  Menu.setApplicationMenu(null);
  workingDirectory = mkdtempSync(join(app.getPath("temp"), "atlas-p0-"));
  store = new StoreProcess(workingDirectory);
  await store.ready;
  if (process.env.ATLAS_P0_PROJECT)
    await store.request("openProject", { path: process.env.ATLAS_P0_PROJECT });
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 620,
    useContentSize: true,
    title: "Atlas · Machbarkeitsversuch",
    backgroundColor: "#142a32",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      additionalArguments: diagnostics ? ["--atlas-diagnostics"] : [],
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== indexURL) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  registerBridge();
  registerDiagnostics();
  let closing = false;
  window.on("close", (event) => {
    if (allowClose) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    void oneFileAction(async () => {
      let error: string | undefined;
      let prepared: PreparedDocument | null = null;
      try {
        prepared = await requestFileAction({ kind: "prepare" });
        if (!prepared) throw new Error("Der lokale Editorstand fehlt.");
        const permit = await mayReplace(prepared);
        if (!permit) return;
        if (permit.boundary) await store.request("close", permit.boundary);
        else store.terminate();
        allowClose = true;
        window.close();
      } catch (failure) {
        error = failure instanceof Error ? failure.message : String(failure);
      } finally {
        if (!allowClose) await requestFileAction({ kind: "resume", error });
      }
    })
      .catch((error) =>
        dialog.showErrorBox(
          "Atlas konnte nicht geschlossen werden",
          error instanceof Error ? error.message : String(error),
        ),
      )
      .finally(() => {
        closing = false;
      });
  });
  await window.loadFile(indexPath, fault ? { query: { fault } } : undefined);
}

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => store?.terminate());

void start().catch((error) => {
  console.error("Atlas-Desktopstart fehlgeschlagen:", error);
  store?.terminate();
  app.exit(1);
});
