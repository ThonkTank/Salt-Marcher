import type {
  AtlasDesktop,
  CommitReceipt,
  PreparedDocument,
  ProjectInfo,
  SourceBoundary,
} from "./bridge";
import { editorBudgets } from "./budgets";
import {
  clipBounds,
  EditorDocument,
  HEIGHT_LEVELS,
  heightSpacing,
  intersectsBounds,
  type Bounds,
  type ChangeSet,
  type HeightBrush,
  type Point,
} from "./model";
import {
  minimumCoarseHeightLevel,
  projectHeightOverviewPatches,
} from "./model/overview";
import { Observation, type ObservationOptions } from "./observation";
import { WorldRenderer, type Camera } from "./render/WorldRenderer";

export interface EditorState {
  mode: "raise" | "lower" | "pan";
  diameter: number;
  amount: number;
  grid: boolean;
  title: string;
  message: string;
  error: string | null;
  persistenceError: string | null;
  recovering: boolean;
  fileAction: boolean;
  loading: boolean;
  needsPress: boolean;
  writing: boolean;
  saved: boolean;
  canUndo: boolean;
  canRedo: boolean;
  scale: number;
  level: number;
  sequence: number;
  background: boolean;
}
interface BrushPoint {
  point: Point;
  input: number;
  at: number;
}
interface Gesture {
  id: number;
  brush: HeightBrush;
  point: Point;
  pointAt: number;
  clock: number;
  latest: BrushPoint | null;
}
interface LocalReadiness {
  ready: boolean;
  reason: "sources" | "terrain" | "feedback" | "busy" | "outside" | null;
  bounds: Bounds;
  point: Point;
  brush: HeightBrush;
  frame: number;
  viewGeneration: number;
}
interface PendingEdit {
  input?: number;
  gestureId?: number;
  intervalId?: number;
  bounds: Bounds;
  revision: number;
  sequence?: number;
  covered?: boolean;
}
const MAX_DOSE_MS = 50;
const PRESS_DOSE_MS = 1000 / 60;
const brushBounds = (point: Point, radius: number): Bounds =>
  clipBounds([
    point[0] - radius,
    point[1] - radius,
    point[0] + radius,
    point[1] + radius,
  ]);

export class EditorController {
  readonly observation: Observation;
  readonly world: WorldRenderer;
  private doc!: EditorDocument;
  private project!: ProjectInfo;
  private gesture: Gesture | null = null;
  private pan: { x: number; y: number; camera: Camera } | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  // These are the existing bounded ChangeSets, not another work queue or copy.
  // Keep them until an authoritative receipt also makes retry/reconciliation safe.
  private readonly unconfirmedWrites = new Map<number, ChangeSet>();
  private writeError: Error | null = null;
  private recovering = false;
  private releaseFileAction: () => void;
  private pendingWrites = 0;
  private loadToken = 0;
  private navInput: number | null = null;
  private readyNavInput: number | null = null;
  private sourcesNavInput: number | null = null;
  private pendingEdits: PendingEdit[] = [];
  private awaitingDose: {
    bounds: Bounds;
    intervalId: number;
    gestureId: number;
    revision: number;
  } | null = null;
  private intervalId = 0;
  private loadRequest = 0;
  private viewRead: Promise<void> | null = null;
  private viewLoadPending = false;
  private resizeObserver: ResizeObserver;
  private work: Worker | null = null;
  private disposed = false;
  private fileActionOwner: "renderer" | "native" | null = null;
  private pointer: Point = [0, 0];
  private editPointer: number | null = null;
  private backgroundStats: Record<string, unknown> = { active: false };
  private backgroundStarting = false;
  state: EditorState = {
    mode: "raise",
    diameter: 80,
    amount: 20,
    grid: true,
    title: "Neue Karte",
    message: "Projekt wird geöffnet …",
    error: null,
    persistenceError: null,
    recovering: false,
    fileAction: false,
    loading: true,
    needsPress: false,
    writing: false,
    saved: false,
    canUndo: false,
    canRedo: false,
    scale: 0.25,
    level: 0,
    sequence: 0,
    background: false,
  };
  onChange: (state: EditorState) => void = () => {};

  constructor(
    private canvas: HTMLCanvasElement,
    private bridge: AtlasDesktop,
  ) {
    this.observation = new Observation(bridge.diagnostics);
    this.world = new WorldRenderer(this.observation);
    this.releaseFileAction = bridge.onFileAction(async (request) => {
      if (request.kind === "prepare") return this.prepareFileAction("native");
      if (request.kind === "recover") {
        await this.recoverWrites();
        return this.preparedDocument();
      }
      this.resumeFileAction("native");
      if (request.error) this.fail(new Error(request.error));
      return null;
    });
    this.resizeObserver = new ResizeObserver(() => {
      this.finishGesture(undefined, "resize");
      this.loadToken++;
      const bounds = (
        this.canvas.parentElement ?? this.canvas
      ).getBoundingClientRect();
      if (this.world.renderer.canvas) {
        this.world.resize(bounds.width, bounds.height);
        this.world.refresh();
        this.releaseOffscreenFeedback();
      }
      if (this.doc) {
        this.checkLocalReady();
        this.scheduleLoad();
      }
    });
    this.world.onError = this.fail;
    this.world.advanceFrame = this.advanceFrame;
    this.world.onSubmit = (frame) => {
      if (
        this.awaitingDose &&
        this.world.regionDisplayed(this.awaitingDose.bounds)
      )
        this.awaitingDose = null;
      this.checkLocalReady();
      if (!bridge.diagnostics) return;
      const pending: PendingEdit[] = [];
      for (const edit of this.pendingEdits) {
        if (!edit.covered) {
          const coverage = this.world.regionCoverage(
            edit.bounds,
            edit.revision,
          );
          if (coverage) {
            const details = {
              frame,
              sessionId: this.doc.sessionId,
              requiredRevision: edit.revision,
              modelRevision: this.doc.revision,
              ...coverage,
              sequence: edit.sequence ?? null,
            };
            if (edit.input !== undefined)
              this.observation.mark("input-covered", `${edit.input}.${frame}`, {
                ...details,
                input: edit.input,
              });
            if (edit.intervalId !== undefined)
              this.observation.mark(
                "brush-covered",
                `${edit.intervalId}.${frame}`,
                {
                  ...details,
                  gestureId: edit.gestureId,
                  intervalId: edit.intervalId,
                },
              );
            edit.covered = true;
          }
        }
        if (this.world.regionExact(edit.bounds)) {
          const details = {
            frame,
            sessionId: this.doc.sessionId,
            revision: edit.revision,
            sequence: edit.sequence ?? null,
          };
          if (edit.input !== undefined)
            this.observation.mark("edit-submit", `${edit.input}.${frame}`, {
              ...details,
              input: edit.input,
            });
          if (edit.intervalId !== undefined)
            this.observation.mark(
              "brush-submit",
              `${edit.intervalId}.${frame}`,
              {
                ...details,
                gestureId: edit.gestureId,
                intervalId: edit.intervalId,
              },
            );
        } else pending.push(edit);
      }
      this.pendingEdits = pending;
    };
    if (bridge.diagnostics)
      this.work = new Worker(
        new URL("./render/work.worker.ts", import.meta.url),
        { type: "module" },
      );
    if (this.work)
      this.work.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
        if (event.data.sessionId !== this.doc?.sessionId) return;
        const active = event.data.kind !== "finished";
        this.backgroundStats = { ...event.data, active };
        this.observation.event("background", this.backgroundStats);
        if (active !== this.state.background)
          this.publish({ background: active });
      };
    if (this.work)
      this.work.onerror = (event) => this.fail(new Error(event.message));
  }

  async init(): Promise<void> {
    await this.world.init(this.canvas);
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    const rect = (
      this.canvas.parentElement ?? this.canvas
    ).getBoundingClientRect();
    this.world.resize(rect.width, rect.height);
    const fault = new URLSearchParams(location.search).get("fault");
    if (
      fault === "delay-render" ||
      fault === "drop-render" ||
      fault === "ignore-zoom" ||
      fault === "pointerup-render"
    )
      this.world.fault = fault;
    this.installEvents();
    this.setProject(await this.bridge.status());
    await this.loadView().catch(this.fail);
  }

  private setProject(info: ProjectInfo): void {
    this.loadToken++;
    this.project = info;
    this.doc = new EditorDocument(info.sessionId, {
      sequence: info.sequence,
      empty: info.sourceTiles === 0,
      maxSourceBytes: editorBudgets.sourceBytes,
      maxPendingBytes: editorBudgets.pendingWriteBytes,
      maxHistoryBytes: editorBudgets.historyBytes,
      maxHistoryActions: editorBudgets.historyActions,
    });
    this.gesture = null;
    this.editPointer = null;
    this.awaitingDose = null;
    this.pendingEdits = [];
    this.navInput = null;
    this.readyNavInput = null;
    this.sourcesNavInput = null;
    this.writeQueue = Promise.resolve();
    this.unconfirmedWrites.clear();
    this.writeError = null;
    this.backgroundStats = { active: false };
    this.work?.postMessage({ cancel: true });
    this.world.reset(this.doc);
    this.world.moveCamera({ x: 0, y: 0, scale: 0.25 });
    this.world.refresh();
    this.publish({
      title: info.title,
      saved: info.savedSequence === info.sequence,
      error: null,
      loading: true,
      message: "Kartenausschnitt wird geladen …",
      background: false,
    });
  }

  private publish(
    change: Partial<EditorState> = {},
    readiness = this.localReadiness(),
  ): void {
    const previous = this.state;
    this.state = { ...this.state, ...change };
    this.state = {
      ...this.state,
      canUndo:
        !this.writeError &&
        !this.changingProject &&
        !this.recovering &&
        (this.doc?.canUndo ?? false),
      canRedo:
        !this.writeError &&
        !this.changingProject &&
        !this.recovering &&
        (this.doc?.canRedo ?? false),
      persistenceError: this.writeError?.message ?? null,
      recovering: this.recovering,
      fileAction: this.changingProject,
      scale: this.world.camera.scale,
      sequence: this.doc?.sequence ?? 0,
      level: this.currentBrush().level,
      writing: this.pendingWrites > 0,
      saved: Boolean(
        this.doc &&
        this.project?.savedSequence === this.doc.sequence &&
        !this.doc.active,
      ),
      loading:
        readiness.reason === "sources" ||
        readiness.reason === "terrain" ||
        (readiness.reason === "feedback" && !this.gesture),
      needsPress: this.editPointer !== null && !this.gesture,
    };
    this.state.message = this.recovering
      ? "Speicherstand wird geprüft …"
      : this.state.persistenceError
        ? "Speicherfehler: Änderungen bleiben im Editor erhalten"
        : this.state.error
          ? this.state.error
          : this.state.loading
            ? "Kartenbereich wird geladen …"
            : readiness.reason === "outside"
              ? "Zeiger außerhalb des sichtbaren Kartenbereichs"
              : this.state.needsPress
                ? "Zum Bearbeiten loslassen und erneut drücken"
                : this.changingProject
                  ? "Projekt wird geöffnet …"
                  : "Bereit";
    if (
      (Object.keys(this.state) as (keyof EditorState)[]).some(
        (key) => !Object.is(previous[key], this.state[key]),
      )
    )
      this.onChange(this.state);
  }

  private fail = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    this.observation.event("error", { message });
    this.publish({ error: message, message });
  };

  run(operation: () => void | Promise<void>): void {
    this.publish({ error: null });
    try {
      void Promise.resolve(operation()).catch(this.fail);
    } catch (error) {
      this.fail(error);
    }
  }

  get mode() {
    return this.state.mode;
  }
  get diameter() {
    return this.state.diameter;
  }
  get amount() {
    return this.state.amount;
  }

  setMode(mode: EditorState["mode"]): void {
    this.publish({ mode });
    this.updateToolNeed();
  }

  setGrid(grid: boolean): void {
    this.world.grid = grid;
    this.world.redraw();
    this.publish({ grid });
  }

  currentBrush(): HeightBrush {
    const radius = this.diameter / (2 * this.world.camera.scale);
    const level = Math.max(0, Math.min(21, Math.floor(Math.log2(radius / 40))));
    return {
      radius,
      level,
      amount:
        this.mode === "lower" ? -Math.abs(this.amount) : Math.abs(this.amount),
      label: this.mode === "lower" ? "Gelände absenken" : "Gelände anheben",
    };
  }

  setBrush(diameter: number, amount: number): void {
    if (!Number.isFinite(diameter) || !Number.isFinite(amount))
      throw new Error("Pinselgröße und Stärke müssen endliche Zahlen sein.");
    this.publish({
      diameter: Math.max(8, Math.min(512, diameter)),
      amount: Math.max(0.1, Math.min(10000, amount)),
    });
    this.updateToolNeed();
  }

  private worldPoint(event: PointerEvent | WheelEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return [
      this.world.camera.x +
        (event.clientX - rect.left - rect.width / 2) / this.world.camera.scale,
      this.world.camera.y +
        (event.clientY - rect.top - rect.height / 2) / this.world.camera.scale,
    ];
  }

  private clampedCamera(camera: Camera): Camera {
    const limit = 100_000_000;
    return {
      x: Math.max(-limit, Math.min(limit, camera.x)),
      y: Math.max(-limit, Math.min(limit, camera.y)),
      scale: Math.max(0.000002, Math.min(25.6, camera.scale)),
    };
  }

  private navigate(camera: Camera, input: number): void {
    this.finishGesture(undefined, "navigation");
    this.loadToken++;
    this.world.moveCamera(this.clampedCamera(camera));
    this.world.refresh();
    this.releaseOffscreenFeedback();
    this.navInput = input;
    this.readyNavInput = null;
    this.sourcesNavInput = null;
    this.observation.mark("camera", String(input), {
      input,
      camera: { ...this.world.camera },
    });
    this.checkLocalReady();
    this.scheduleLoad();
    this.publish();
  }

  private releaseOffscreenFeedback(): void {
    if (
      this.awaitingDose &&
      !intersectsBounds(this.awaitingDose.bounds, this.world.bounds())
    ) {
      this.observation.event("brush-feedback-obsolete", {
        sessionId: this.doc.sessionId,
        ...this.awaitingDose,
        reason: "outside-view",
        viewBounds: this.world.bounds(),
        viewGeneration: this.world.state().viewGeneration,
      });
      this.awaitingDose = null;
    }
  }

  goTo(event: Event, x: number, y: number, scale: number): void {
    if (this.gesture) return;
    this.navigate({ x, y, scale }, this.observation.input(event, "navigation"));
  }

  private scheduleLoad(): void {
    if (this.loadRequest) return;
    this.loadRequest = requestAnimationFrame(() => {
      this.loadRequest = 0;
      void this.loadView().catch(this.fail);
    });
  }

  private async ensure(bounds: Bounds, minLevel: number): Promise<boolean> {
    if (this.doc.isReady(bounds, HEIGHT_LEVELS.slice(minLevel))) return true;
    const document = this.doc;
    return this.readCurrent(
      document,
      () =>
        this.bridge.readRegion({
          sessionId: document.sessionId,
          bounds,
          minLevel,
        }),
      (reply) => {
        document.acceptCoverage(
          bounds,
          reply.tiles,
          reply.sequence,
          reply.sessionId,
          minLevel,
        );
        this.observation.event("sources", {
          sessionId: reply.sessionId,
          bounds,
          tiles: reply.tiles.length,
          bytes: reply.tiles.reduce((n, tile) => n + tile.values.byteLength, 0),
        });
      },
    );
  }

  /** Reads may pass a queued write; an acknowledged newer state must never regress. */
  private async readCurrent<T extends SourceBoundary>(
    document: EditorDocument,
    read: () => Promise<T>,
    consume: (reply: T) => void,
    token = this.loadToken,
  ): Promise<boolean> {
    const current = () =>
      !this.disposed && document === this.doc && token === this.loadToken;
    while (current()) {
      const reply = await read().catch((error: unknown) => {
        if (!current()) return null;
        throw error;
      });
      if (!reply || !current() || reply.sessionId !== document.sessionId)
        return false;
      // The acknowledgement released its local patches. Read the actual store
      // again rather than trying to project a response older than those patches.
      if (!Number.isSafeInteger(reply.sequence) || reply.sequence < 0)
        throw new Error("Ungültige Lesesequenz der Arbeitskopie.");
      if (reply.sequence >= document.persistedSequence) {
        // Validation and projection are synchronous together: an ack must not
        // release the patches in an extra await between these two steps.
        consume(reply);
        return true;
      }
    }
    return false;
  }

  private loadView(): Promise<void> {
    this.viewLoadPending = true;
    if (!this.viewRead) {
      this.viewRead = (async () => {
        while (this.viewLoadPending && !this.disposed) {
          this.viewLoadPending = false;
          await this.readView();
        }
      })().finally(() => {
        this.viewRead = null;
        // A newer hover/brush request can arrive after the loop ended but before
        // this promise settled. It still represents the current need, not a queue.
        if (this.viewLoadPending && !this.disposed)
          void this.loadView().catch(this.fail);
      });
    }
    return this.viewRead;
  }

  private retainViewSources(bounds: Bounds, minLevel: number): void {
    const local = this.localReadiness();
    const removed = this.doc.retainSources([
      { bounds, minLevel },
      { bounds: local.bounds, minLevel: local.brush.level },
    ]);
    this.world.forgetSources(removed);
  }

  private async readView(): Promise<void> {
    const token = ++this.loadToken;
    const document = this.doc;
    const power = this.world.presentationPower();
    const minLevel = minimumCoarseHeightLevel(power);
    const bounds = this.world.sourceBounds();
    this.retainViewSources(bounds, minLevel);
    if (!this.world.isPresentationReady(bounds, power)) {
      this.checkLocalReady();
      const loaded = await this.readCurrent(
        document,
        () =>
          this.bridge.readPresentation({
            sessionId: document.sessionId,
            bounds,
            power,
          }),
        (reply) => {
          document.acceptCoverage(
            bounds,
            reply.tiles,
            reply.sequence,
            reply.sessionId,
            minLevel,
          );
          const projected = projectHeightOverviewPatches(
            reply.overviews,
            reply.overviewKeys,
            document.presentationPatchesAfter(reply.sequence),
          );
          this.world.updatePresentation(
            document.snapshot(bounds, HEIGHT_LEVELS.slice(minLevel)).tiles,
            projected,
            reply.overviewKeys,
            true,
          );
          this.observation.event("sources", {
            sessionId: reply.sessionId,
            bounds,
            power,
            tiles: reply.tiles.length,
            bytes: reply.tiles.reduce(
              (n, tile) => n + tile.values.byteLength,
              0,
            ),
            overviewTiles: reply.overviews.length,
            overviewBytes: reply.overviews.reduce(
              (n, tile) => n + tile.values.byteLength,
              0,
            ),
          });
        },
        token,
      );
      if (!loaded) return;
    }
    if (this.disposed || token !== this.loadToken || document !== this.doc)
      return;
    // Hover/brush settings may have changed during the presentation read. Keep
    // the current complete tool halo before loading it, not the earlier one.
    this.retainViewSources(bounds, minLevel);
    const { bounds: needed, brush } = this.localReadiness();
    await this.ensure(needed, brush.level);
    if (this.disposed || token !== this.loadToken || document !== this.doc)
      return;
    this.checkLocalReady();
  }

  private toolPoint(): Point {
    const { camera, cursor, width, height } = this.world;
    return cursor
      ? [
          camera.x + (cursor.x - width / 2) / camera.scale,
          camera.y + (cursor.y - height / 2) / camera.scale,
        ]
      : [camera.x, camera.y];
  }

  /** One derived contract for input, the normal UI and read-only observation. */
  private localReadiness(
    point = this.toolPoint(),
    brush = this.gesture?.brush ?? this.currentBrush(),
  ): LocalReadiness {
    const inWorld = point.every(
      (value) => Number.isFinite(value) && Math.abs(value) <= 100_000_000,
    );
    const bounds =
      this.doc && inWorld
        ? this.doc.readBoundsForPoint(point, brush)
        : brushBounds(point, brush.radius + 2 * heightSpacing(brush.level));
    const view = this.world.bounds();
    const visible =
      Math.hypot(
        Math.max(view[0] - point[0], 0, point[0] - view[2]),
        Math.max(view[1] - point[1], 0, point[1] - view[3]),
      ) < brush.radius;
    const reason = !inWorld
      ? "outside"
      : !visible
        ? "outside"
        : this.writeError || this.changingProject || this.recovering
          ? "busy"
          : !this.doc?.isReady(bounds, HEIGHT_LEVELS.slice(brush.level))
            ? "sources"
            : !this.world.regionDisplayed(bounds, false)
              ? "terrain"
              : this.awaitingDose &&
                  !this.world.regionDisplayed(this.awaitingDose.bounds)
                ? "feedback"
                : !this.world.regionDisplayed(bounds)
                  ? "terrain"
                  : null;
    const submitted = this.world.submission();
    return {
      ready: reason === null,
      reason,
      bounds,
      point,
      brush,
      frame: submitted.frame,
      viewGeneration: submitted.viewGeneration,
    };
  }

  private checkLocalReady(): LocalReadiness {
    const readiness = this.localReadiness();
    this.world.setPriorityAreas(readiness.bounds, this.awaitingDose?.bounds);
    if (this.world.cursor) {
      const waiting =
        !readiness.ready && !(readiness.reason === "feedback" && this.gesture);
      if (Boolean(this.world.cursor.waiting) !== waiting) {
        this.world.cursor.waiting = waiting;
        this.world.redraw();
      }
    }
    if (this.doc && this.navInput !== null) {
      const details = {
        input: this.navInput,
        sessionId: this.doc.sessionId,
        ...readiness,
        revision: this.doc.revision,
      };
      if (
        this.sourcesNavInput !== this.navInput &&
        this.doc.isReady(
          readiness.bounds,
          HEIGHT_LEVELS.slice(readiness.brush.level),
        )
      ) {
        this.sourcesNavInput = this.navInput;
        this.observation.mark("sources-ready", String(this.navInput), details);
      }
      if (readiness.ready && this.readyNavInput !== this.navInput) {
        this.readyNavInput = this.navInput;
        this.observation.mark("input-ready", String(this.navInput), details);
      }
    }
    this.publish({}, readiness);
    return readiness;
  }

  private updateToolNeed(): void {
    const readiness = this.checkLocalReady();
    if (readiness.reason === "sources") this.scheduleLoad();
    this.world.redraw();
  }

  retryLoad(): void {
    this.publish({ error: null });
    this.scheduleLoad();
    this.world.refresh();
    this.updateToolNeed();
  }

  private down = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 1) return;
    this.canvas.focus();
    this.canvas.setPointerCapture(event.pointerId);
    const input = this.observation.input(
      event,
      this.mode === "pan" || event.button === 1 ? "navigation" : "edit",
    );
    if (this.mode === "pan" || event.button === 1) {
      this.pan = {
        x: event.clientX,
        y: event.clientY,
        camera: { ...this.world.camera },
      };
      return;
    }
    this.updatePointer(event);
    if (this.editPointer !== null) {
      this.skipInput(input, this.gesture ? "busy" : "new-press-required");
      return;
    }
    this.editPointer = event.pointerId;
    if (this.gesture || this.writeError || this.changingProject) {
      this.skipInput(input, "busy");
      this.checkLocalReady();
      return;
    }
    const brush = this.currentBrush();
    const point = this.worldPoint(event);
    const readiness = this.localReadiness(point, brush);
    if (!readiness.ready) {
      this.skipInput(input, readiness.reason!);
      this.checkLocalReady();
      if (readiness.reason === "sources") this.scheduleLoad();
      return;
    }
    this.awaitingDose = null;
    const now = performance.now();
    const gesture: Gesture = {
      id: input,
      brush,
      point: [...point],
      pointAt: this.inputTime(event),
      clock: now,
      latest: null,
    };
    this.gesture = gesture;
    this.observation.event("brush-start", {
      sessionId: this.doc.sessionId,
      gestureId: input,
      input,
      startAt: gesture.clock,
      inputAt: this.inputTime(event),
      point: [...point],
      rateFtPerSecond: brush.amount,
      radius: brush.radius,
      level: brush.level,
    });
    try {
      this.doc.beginGesture(brush);
      this.doc.applyPoint(point, 0);
      // A valid down/up between frames must keep its small immediate click dose.
      this.applyDose(gesture, point, now, now, 0, "press", input);
    } catch (error) {
      this.gestureFailure(error);
    }
    this.world.redraw();
  };

  private updatePointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = this.worldPoint(event);
    this.world.cursor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      radius: this.gesture
        ? this.gesture.brush.radius * this.world.camera.scale
        : this.diameter / 2,
    };
    this.world.redraw();
  }

  private move = (event: PointerEvent): void => {
    this.updatePointer(event);
    if (this.pan) {
      const camera = {
        ...this.pan.camera,
        x:
          this.pan.camera.x -
          (event.clientX - this.pan.x) / this.pan.camera.scale,
        y:
          this.pan.camera.y -
          (event.clientY - this.pan.y) / this.pan.camera.scale,
      };
      this.navigate(camera, this.observation.input(event, "navigation"));
    } else if (this.gesture) {
      const events = event.getCoalescedEvents?.() ?? [];
      for (const e of events.length ? events : [event]) {
        const latest: BrushPoint = {
          point: this.worldPoint(e),
          input: this.observation.input(e, "edit"),
          at: this.inputTime(e),
        };
        if (this.gesture.latest && latest.at < this.gesture.latest.at) {
          this.skipInput(latest.input, "stale");
          continue;
        }
        if (this.gesture.latest)
          this.skipInput(this.gesture.latest.input, "coalesced");
        this.gesture.latest = latest;
      }
    } else {
      if (this.editPointer !== null)
        this.skipInput(
          this.observation.input(event, "edit"),
          "new-press-required",
        );
      this.updateToolNeed();
    }
  };

  private up = (event: PointerEvent): void => {
    if (this.pan) {
      this.pan = null;
      return;
    }
    if (this.editPointer !== event.pointerId) return;
    this.editPointer = null;
    const input = this.observation.input(event, "pointerup");
    if (this.gesture) this.finishGesture(input, "pointerup", event);
    else this.skipInput(input, "no-gesture");
    this.checkLocalReady();
  };

  private wheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.gesture) return;
    const input = this.observation.input(event, "navigation");
    if (this.world.fault === "ignore-zoom") {
      this.observation.event("fault", { fault: "ignore-zoom", input });
      return;
    }
    const anchor = this.worldPoint(event);
    const previous = this.world.camera;
    const scale = this.clampedCamera({
      ...previous,
      scale:
        previous.scale *
        Math.exp(-Math.max(-500, Math.min(500, event.deltaY)) * 0.0018),
    }).scale;
    this.navigate(
      {
        x: anchor[0] - ((anchor[0] - previous.x) * previous.scale) / scale,
        y: anchor[1] - ((anchor[1] - previous.y) * previous.scale) / scale,
        scale,
      },
      input,
    );
  };

  private inputTime(event: Event): number {
    return event.timeStamp > performance.timeOrigin
      ? event.timeStamp - performance.timeOrigin
      : event.timeStamp;
  }

  private skipInput(input: number, reason: string): void {
    this.observation.event("noop", {
      input,
      accepted: false,
      reason,
      sessionId: this.doc.sessionId,
      gestureId: this.gesture?.id ?? null,
    });
  }

  private discardTime(
    gesture: Gesture,
    fromAt: number,
    toAt: number,
    reason: string,
  ): void {
    if (toAt <= fromAt) return;
    this.observation.event("brush-discard", {
      sessionId: this.doc.sessionId,
      gestureId: gesture.id,
      fromAt,
      toAt,
      reason,
    });
  }

  private anchor(gesture: Gesture, point: Point, at = gesture.pointAt): void {
    if (at < gesture.pointAt) return;
    this.doc.applyPoint(point, 0);
    gesture.point = [...point];
    gesture.pointAt = at;
  }

  private skipLatest(
    gesture: Gesture,
    reason: string,
    trackPosition = true,
  ): void {
    const latest = gesture.latest;
    gesture.latest = null;
    if (latest) this.skipInput(latest.input, reason);
    if (latest && trackPosition) this.anchor(gesture, latest.point, latest.at);
  }

  private applyDose(
    gesture: Gesture,
    point: Point,
    fromAt: number,
    toAt: number,
    rawElapsedMs: number,
    cause: "press" | "move" | "hold",
    input?: number,
  ): void {
    const from = [...gesture.point];
    const acceptedElapsedMs = cause === "press" ? PRESS_DOSE_MS : toAt - fromAt;
    const update = this.doc.applyPoint(point, acceptedElapsedMs);
    gesture.point = [...point];
    const intervalId = ++this.intervalId;
    this.observation.event("brush-interval", {
      sessionId: this.doc.sessionId,
      gestureId: gesture.id,
      intervalId,
      cause,
      nominalDose: cause === "press",
      fromAt,
      toAt,
      rawElapsedMs,
      acceptedElapsedMs,
      from,
      to: [...point],
      rateFtPerSecond: gesture.brush.amount,
      radius: gesture.brush.radius,
      level: gesture.brush.level,
      revision: this.doc.revision,
      changed: Boolean(update),
      bounds: update?.bounds ?? null,
      inputIds: input === undefined ? [] : [input],
    });
    if (!update) {
      if (input !== undefined) this.skipInput(input, "no-change");
      return;
    }
    this.world.updateSourcePatches(update.patches);
    this.world.invalidate(update.bounds);
    this.awaitingDose = {
      bounds: update.bounds,
      intervalId,
      gestureId: gesture.id,
      revision: this.doc.revision,
    };
    if (this.bridge.diagnostics)
      this.pendingEdits.push({
        input,
        gestureId: gesture.id,
        intervalId,
        bounds: update.bounds,
        revision: this.doc.revision,
      });
    if (input !== undefined)
      this.observation.mark("model", String(input), {
        input,
        sessionId: this.doc.sessionId,
        gestureId: gesture.id,
        intervalId,
        revision: this.doc.revision,
        bounds: update.bounds,
        point: [...point],
        gestureReleased: false,
      });
    this.checkLocalReady();
  }

  private advanceFrame = (now: number): void => {
    const gesture = this.gesture;
    if (this.disposed || !gesture) return;
    const fromAt = gesture.clock;
    const toAt = Math.max(fromAt, now);
    // Every examined window ends here, including time rejected by backpressure.
    gesture.clock = toAt;
    let accountedTo = fromAt;
    const previousInterval = this.intervalId;
    try {
      const latest = gesture.latest;
      const point =
        latest && latest.at >= gesture.pointAt ? latest.point : gesture.point;
      // Check the complete next segment before moving its model anchor. Waiting
      // for our own accepted dose is ordinary feedback; a new cold area ends it.
      const readiness = this.localReadiness(point, gesture.brush);
      if (!readiness.ready) {
        this.discardTime(gesture, fromAt, toAt, readiness.reason!);
        accountedTo = toAt;
        this.skipLatest(
          gesture,
          readiness.reason!,
          readiness.reason === "feedback",
        );
        if (readiness.reason !== "feedback") {
          this.finishGesture(undefined, readiness.reason!);
          this.updateToolNeed();
        }
        return;
      }
      this.awaitingDose = null;
      const rawElapsedMs = toAt - fromAt;
      if (rawElapsedMs <= 0) return;
      gesture.latest = null;
      if (latest && latest.at < fromAt) {
        this.discardTime(gesture, fromAt, toAt, "stale");
        accountedTo = toAt;
        this.skipInput(latest.input, "stale");
        this.anchor(gesture, point, latest.at);
        return;
      }
      const acceptedFrom = toAt - Math.min(rawElapsedMs, MAX_DOSE_MS);
      if (acceptedFrom > fromAt) {
        this.discardTime(gesture, fromAt, acceptedFrom, "cap");
        accountedTo = acceptedFrom;
        this.anchor(gesture, point, latest?.at);
      }
      const moving =
        point[0] !== gesture.point[0] || point[1] !== gesture.point[1];
      if (latest) gesture.pointAt = latest.at;
      this.applyDose(
        gesture,
        point,
        acceptedFrom,
        toAt,
        rawElapsedMs,
        moving ? "move" : "hold",
        latest?.input,
      );
    } catch (error) {
      if (this.intervalId === previousInterval)
        this.discardTime(gesture, accountedTo, toAt, "error");
      this.gestureFailure(error);
    }
  };

  private gestureFailure(error: unknown): void {
    this.finishGesture(undefined, "error");
    this.fail(error);
  }

  private finishGesture(input?: number, reason = "end", event?: Event): void {
    const gesture = this.gesture;
    if (!gesture) return;
    const endAt = performance.now();
    this.discardTime(gesture, gesture.clock, endAt, reason);
    this.skipLatest(gesture, reason, false);
    this.gesture = null;
    this.observation.event("brush-end", {
      sessionId: this.doc.sessionId,
      gestureId: gesture.id,
      input: input ?? null,
      endAt,
      inputAt: event ? this.inputTime(event) : null,
      reason,
    });
    const change = this.doc.active ? this.doc.finishGesture() : null;
    if (!change) {
      if (input !== undefined) this.skipInput(input, "no-accepted-dose");
      this.publish();
      return;
    }
    if (input !== undefined) {
      for (const bounds of change.dirtyBounds)
        if (this.bridge.diagnostics)
          this.pendingEdits.push({
            input,
            bounds,
            revision: change.revision,
            sequence: change.sequence,
          });
      this.observation.mark("commit", String(input), {
        input,
        gestureId: gesture.id,
        sessionId: this.doc.sessionId,
        bounds: change.dirtyBounds,
        sequence: change.sequence,
        revision: change.revision,
      });
    }
    this.world.redraw();
    this.persist(change);
  }

  private persist(change: ChangeSet): void {
    this.unconfirmedWrites.set(change.sequence, change);
    this.pendingWrites++;
    this.publish({ saved: false });
    const document = this.doc;
    this.writeQueue = this.writeQueue
      .then(async () => {
        const receipt = await this.bridge.commit(change);
        if (document === this.doc) this.acceptReceipt(change, receipt);
        this.observation.event("persisted", {
          sequence: receipt.sequence,
          sessionId: receipt.sessionId,
        });
      })
      .catch((error: unknown) => {
        this.writeError =
          error instanceof Error ? error : new Error(String(error));
        this.fail(this.writeError);
        throw error;
      })
      .finally(() => {
        this.pendingWrites--;
        this.publish();
      });
    // The queue preserves rejection; this handler only prevents an unhandled rejection.
    void this.writeQueue.catch(() => {});
  }

  undo(): void {
    this.history(false);
  }
  redo(): void {
    this.history(true);
  }
  private history(redo: boolean): void {
    if (this.writeError || this.changingProject || this.recovering) return;
    this.finishGesture(undefined, "history");
    try {
      const change = redo ? this.doc.redo() : this.doc.undo();
      if (!change) return;
      // A broad history region can contain evicted, unchanged fine sources.
      // Transfer the authoritative changed tiles without reloading that region.
      this.world.updateSourcePatches(change.patches);
      for (const bounds of change.dirtyBounds) {
        this.world.invalidate(bounds);
      }
      this.persist(change);
      this.publish();
    } catch (error) {
      this.fail(error);
    }
  }

  async save(saveAs = false): Promise<void> {
    if (this.changingProject) return;
    this.finishGesture(undefined, "save");
    const document = this.doc;
    if (this.writeError) await this.recoverWrites();
    // Include writes accepted while an earlier write was still being acknowledged.
    for (;;) {
      const queue = this.writeQueue;
      await queue;
      if (queue === this.writeQueue) break;
    }
    if (document !== this.doc)
      throw new Error("Das Projekt wurde inzwischen gewechselt.");
    const result = await this.bridge.saveProject({
      sessionId: document.sessionId,
      sequence: document.sequence,
      saveAs,
    });
    if (result && document === this.doc) {
      this.project.savedSequence = result.savedSequence;
      this.project.path = result.path;
      this.publish({
        saved:
          this.doc.sequence === result.savedSequence &&
          !this.doc.active &&
          !this.gesture,
        message: "Projektdatei gespeichert",
      });
    }
  }

  async open(): Promise<void> {
    await this.changeProject(false);
  }
  async newProject(): Promise<void> {
    await this.changeProject(true);
  }
  private async changeProject(empty: boolean): Promise<void> {
    if (this.changingProject) return;
    try {
      const prepared = await this.prepareFileAction();
      const next = empty
        ? await this.bridge.newProject(prepared)
        : await this.bridge.openProject(prepared);
      if (next) {
        this.setProject(next);
        await this.loadView();
      }
    } finally {
      this.resumeFileAction();
    }
  }

  private preparedDocument(): PreparedDocument {
    return {
      sessionId: this.doc.sessionId,
      sequence: this.doc.sequence,
      persistenceError: this.writeError?.message ?? null,
    };
  }

  private get changingProject(): boolean {
    return this.fileActionOwner !== null;
  }

  /** Shared by native close and the renderer's New/Open commands. */
  private async prepareFileAction(
    owner: "renderer" | "native" = "renderer",
  ): Promise<PreparedDocument> {
    if (this.changingProject || this.recovering)
      throw new Error(
        "Ein Datei- oder Wiederherstellungsvorgang ist bereits offen.",
      );
    this.fileActionOwner = owner;
    try {
      this.finishGesture(undefined, "file-action");
      this.publish();
      await this.writeQueue.catch(() => {});
      return this.preparedDocument();
    } catch (error) {
      this.resumeFileAction(owner);
      throw error;
    }
  }

  private resumeFileAction(owner: "renderer" | "native" = "renderer"): void {
    // A rejected native close must not unlock an already running New/Open.
    if (this.fileActionOwner !== owner) return;
    this.fileActionOwner = null;
    this.checkLocalReady();
  }

  private acceptReceipt(change: ChangeSet, receipt: CommitReceipt): void {
    if (
      receipt.sessionId !== change.sessionId ||
      receipt.sequence !== change.sequence ||
      receipt.transactionId !== change.transactionId
    )
      throw new Error(
        "Die Speicherbestätigung gehört nicht zur ausstehenden Änderung.",
      );
    this.doc.acceptPersistence(receipt.sequence);
    this.unconfirmedWrites.delete(change.sequence);
  }

  /** Explicit recovery first checks the authoritative store, then verifies/replays IDs. */
  async recoverWrites(): Promise<void> {
    if (this.recovering)
      throw new Error("Der Speicherstand wird bereits geprüft.");
    this.recovering = true;
    this.finishGesture(undefined, "recovery");
    this.publish();
    try {
      await this.writeQueue.catch(() => {});
      const actual = await this.bridge.status();
      if (
        actual.sessionId !== this.doc.sessionId ||
        actual.sequence < this.doc.persistedSequence ||
        actual.sequence > this.doc.sequence
      )
        throw new Error(
          "Die Arbeitskopie passt nicht zum erhaltenen Editorstand. Änderungen bleiben im Editor; sie wurden nicht verworfen.",
        );
      let checkedSequence = actual.sequence;
      for (const change of this.unconfirmedWrites.values()) {
        if (change.sequence > checkedSequence + 1)
          throw new Error(
            "Die ausstehenden Änderungen sind nicht lückenlos wiederherstellbar.",
          );
        // At/below checkedSequence this only accepts the existing identical
        // transaction+payload receipt. At +1 the authoritative status proved
        // absence. ProjectStore checks identity/order again in either case.
        const receipt = await this.bridge.commit(change);
        this.acceptReceipt(change, receipt);
        checkedSequence = Math.max(checkedSequence, receipt.sequence);
      }
      if (checkedSequence !== this.doc.sequence)
        throw new Error(
          "Die Arbeitskopie enthält noch nicht alle angenommenen Änderungen.",
        );
      this.writeQueue = Promise.resolve();
      this.writeError = null;
      this.publish({ error: null });
    } catch (error) {
      this.writeError =
        error instanceof Error ? error : new Error(String(error));
      this.fail(this.writeError);
      throw error;
    } finally {
      this.recovering = false;
      this.checkLocalReady();
    }
  }

  async background(): Promise<void> {
    if (!this.work || this.state.background || this.backgroundStarting) return;
    this.backgroundStarting = true;
    const document = this.doc;
    try {
      let bounds = this.world.bounds();
      if (!document.isReady(bounds)) {
        // A coarse overview intentionally does not load all fine authors. Keep
        // this diagnostic canonical sampling job on a bounded exact local patch.
        const { x, y } = this.world.camera;
        bounds = clipBounds([x - 320, y - 320, x + 320, y + 320]);
        if (!(await this.ensure(bounds, 0))) return;
      }
      if (document !== this.doc || this.disposed) return;
      const snapshot = document.snapshot(bounds);
      this.work.postMessage(
        {
          sessionId: document.sessionId,
          tiles: snapshot.tiles,
          bounds: snapshot.bounds,
          milliseconds: 10000,
        },
        snapshot.tiles.map((tile) => tile.values.buffer as ArrayBuffer),
      );
      this.publish({ background: true });
    } finally {
      this.backgroundStarting = false;
    }
  }

  observe(points: Point[] = [], options: ObservationOptions = {}) {
    let height: number | null = null;
    try {
      height = this.doc.sampleHeight(this.pointer[0], this.pointer[1]);
    } catch {
      /* Unknown stays unknown. */
    }
    const samples = points.map((point) => {
      try {
        return this.doc.sampleHeight(point[0], point[1]);
      } catch {
        return null;
      }
    });
    return {
      sessionId: this.doc?.sessionId,
      state: { ...this.state },
      camera: { ...this.world.camera },
      brush: this.currentBrush(),
      gesture: this.gesture
        ? {
            active: this.doc.active,
            pendingInput: this.gesture.latest !== null,
            brush: { ...this.gesture.brush },
          }
        : null,
      readiness: this.localReadiness(),
      renderer: this.world.state(),
      background: { ...this.backgroundStats },
      document: this.doc
        ? {
            revision: this.doc.revision,
            sequence: this.doc.sequence,
            active: this.doc.active,
            canUndo: this.doc.canUndo,
            canRedo: this.doc.canRedo,
            ...this.doc.metrics,
          }
        : null,
      pointer: [...this.pointer],
      height,
      samples,
      eventCount: this.observation.eventCount,
      lastInputId: this.observation.lastInputId,
      events: this.observation.read(options),
      droppedEvents: this.observation.dropped,
      timeOrigin: performance.timeOrigin,
    };
  }

  private key = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "Escape") {
      this.finishGesture(undefined, "escape", event);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void this.save(event.shiftKey).catch(this.fail);
    }
  };
  private blur = (event: Event): void => {
    this.editPointer = null;
    this.finishGesture(undefined, "blur", event);
    this.pan = null;
    this.checkLocalReady();
  };
  private cancel = (event: Event): void => {
    this.editPointer = null;
    this.finishGesture(undefined, "cancel", event);
    this.pan = null;
    this.checkLocalReady();
  };
  private visibility = (event: Event): void => {
    if (document.visibilityState !== "hidden") return;
    this.editPointer = null;
    this.finishGesture(undefined, "visibility", event);
    this.pan = null;
    this.checkLocalReady();
  };
  private leave = (): void => {
    if (this.editPointer !== null || this.pan) return;
    this.world.cursor = null;
    this.updateToolNeed();
  };
  private installEvents(): void {
    this.canvas.addEventListener("pointerdown", this.down);
    this.canvas.addEventListener("pointermove", this.move);
    this.canvas.addEventListener("pointerup", this.up);
    this.canvas.addEventListener("pointercancel", this.cancel);
    this.canvas.addEventListener("pointerleave", this.leave);
    this.canvas.addEventListener("wheel", this.wheel, { passive: false });
    window.addEventListener("keydown", this.key);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibility);
  }
  destroy(): void {
    this.finishGesture(undefined, "destroy");
    this.disposed = true;
    this.loadToken++;
    cancelAnimationFrame(this.loadRequest);
    this.resizeObserver.disconnect();
    this.releaseFileAction();
    this.world.destroy();
    this.work?.terminate();
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.cancel);
    this.canvas.removeEventListener("pointerleave", this.leave);
    this.canvas.removeEventListener("wheel", this.wheel);
    window.removeEventListener("keydown", this.key);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
  }
}
