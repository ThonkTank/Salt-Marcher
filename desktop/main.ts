import {
  app,
  BrowserWindow,
  contentTracing,
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
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  ProjectInfo,
  SaveRequest,
  SaveResult,
  SourceBoundary,
} from "../src/editor/bridge";
import type { PreparedSave, StoreActivity } from "./project-store";
import { HEIGHT_MAX_ACTION_TILES } from "../src/editor/model/types";

const CHANNEL = "atlas:p0";
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

function trustedSender(event: IpcMainInvokeEvent) {
  if (
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame?.url !== indexURL
  ) {
    throw new Error("Die Anfrage stammt nicht aus dem aktiven Atlas-Fenster.");
  }
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

async function mayReplace(project: ProjectInfo): Promise<boolean> {
  if (project.sequence === 0 && project.path === null) return true;
  if (project.savedSequence === project.sequence) return true;
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
                  "Die Änderungen an dieser Welt sind noch nicht in einer Projektdatei gespeichert.",
                buttons: ["Speichern", "Verwerfen", "Abbrechen"],
                defaultId: 0,
                cancelId: 2,
                noLink: true,
              })
            ).response;
  if (response === 2) return false;
  if (response === 1) return true;
  return (await save(project)) !== null;
}

function registerBridge() {
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
          return store.request("commit", argument);
        }
        case "saveProject":
          checkedBoundary(argument);
          return oneFileAction(() => save(argument as unknown as SaveRequest));
        case "newProject":
          return oneFileAction(async () => {
            const previous = await store.request<ProjectInfo>("status");
            if (!(await mayReplace(previous))) return null;
            return store.request("newProject", checkedBoundary(previous));
          });
        case "openProject":
          return oneFileAction(async () => {
            const previous = await store.request<ProjectInfo>("status");
            if (!(await mayReplace(previous))) return null;
            const path = await chooseOpen();
            if (!path) return null;
            return store.request("openProject", {
              path,
              expected: checkedBoundary(previous),
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
      startTrace: () =>
        contentTracing.startRecording({
          included_categories: [
            "blink.user_timing",
            "input",
            "latencyInfo",
            "cc",
            "viz",
            "gpu",
            "benchmark",
            "disabled-by-default-devtools.timeline",
            "disabled-by-default-devtools.timeline.frame",
          ],
          recording_mode: "record-until-full",
        }),
      stopTrace: (path: string) => contentTracing.stopRecording(path),
    },
  });
}

async function start() {
  app.setName("Atlas Machbarkeitsversuch");
  await app.whenReady();
  Menu.setApplicationMenu(null);
  const workingDirectory = mkdtempSync(join(app.getPath("temp"), "atlas-p0-"));
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
      const previous = await store.request<ProjectInfo>("status");
      if (!(await mayReplace(previous))) return;
      await store.request("close", checkedBoundary(previous));
      allowClose = true;
      window.close();
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
