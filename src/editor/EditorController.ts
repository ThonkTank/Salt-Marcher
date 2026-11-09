import type {
  AtlasDesktop,
  PreparedDocument,
  ProjectInfo,
  SourceBoundary,
} from "./bridge";
import { editorBudgets } from "./budgets";
import { ProjectSession } from "./ProjectSession";
import {
  brushTarget,
  brushPathBounds,
  MAX_BRUSH_POINTS,
  decideBrushFrame,
  PRESS_DOSE_MS,
  type BrushPoint,
  type BrushState,
  type BrushStroke,
} from "./brush";
import {
  clipBounds,
  EditorDocument,
  HEIGHT_LEVELS,
  heightBrushReadBounds,
  heightSpacing,
  intersectsBounds,
  type Bounds,
  type HeightBrush,
  type HeightSegment,
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
interface LocalReadiness {
  ready: boolean;
  sourcesReady: boolean;
  reason: "sources" | "terrain" | "feedback" | "busy" | "outside" | null;
  bounds: Bounds;
  point: Point;
  brush: HeightBrush;
  frame: number;
  viewGeneration: number;
}
interface SourceDemand {
  document: EditorDocument;
  viewGeneration: number;
  bounds: Bounds;
  power: number;
  minLevel: number;
  toolBounds: Bounds;
  toolLevel: number;
  key: string;
}

type SourceReadState =
  | { kind: "idle" }
  | { kind: "ready"; key: string }
  | { kind: "loading"; promise: Promise<void> }
  | { kind: "failed"; key: string };

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
  private readonly session: ProjectSession;
  private brushState: BrushState = { kind: "idle" };
  private pan: { x: number; y: number; camera: Camera } | null = null;
  private releaseFileAction: () => void;
  private desiredNeed: SourceDemand | null = null;
  private readState: SourceReadState = { kind: "idle" };
  private awaitingDose: {
    sessionId: string;
    bounds: Bounds;
    intervalId: number;
    gestureId: number;
    revision: number;
  } | null = null;
  private intervalId = 0;
  private inputId = 0;
  private animation = 0;
  private lastFrameAt = 0;
  private resizeObserver: ResizeObserver;
  private work: Worker | null = null;
  private disposed = false;
  private pointer: Point = [0, 0];
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
    this.session = new ProjectSession(bridge, {
      changed: () => this.publish(),
      persisted: (receipt) =>
        this.observation.event("persisted", { ...receipt }),
      failed: this.fail,
    });
    this.releaseFileAction = bridge.onFileAction(async (request) => {
      if (request.kind === "prepare") return this.prepareFileAction("native");
      if (request.kind === "recover") {
        await this.recoverWrites();
        return this.session.preparedDocument();
      }
      this.resumeFileAction("native");
      if (request.error) this.fail(new Error(request.error));
      return null;
    });
    this.resizeObserver = new ResizeObserver(() => {
      this.finishGesture(undefined, "resize");
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
    this.animation = requestAnimationFrame(this.frame);
    await this.loadView().catch(this.fail);
  }

  private setProject(info: ProjectInfo): void {
    this.doc = new EditorDocument(info.sessionId, {
      sequence: info.sequence,
      empty: info.sourceTiles === 0,
      maxSourceBytes: editorBudgets.sourceBytes,
      maxPendingBytes: editorBudgets.pendingWriteBytes,
      maxHistoryBytes: editorBudgets.historyBytes,
      maxHistoryActions: editorBudgets.historyActions,
    });
    this.brushState = { kind: "idle" };
    this.awaitingDose = null;
    this.desiredNeed = null;
    this.readState = { kind: "idle" };
    this.observation.reset();
    this.session.attach(this.doc, info);
    this.backgroundStats = { active: false };
    this.work?.postMessage({ cancel: true });
    this.world.reset(this.doc);
    this.world.moveCamera({ x: 0, y: 0, scale: 0.25 });
    this.world.refresh();
    this.publish({
      title: info.title,
      error: null,
      background: false,
    });
  }

  private get stroke(): BrushStroke | null {
    return this.brushState.kind === "active" ? this.brushState.stroke : null;
  }

  private publish(
    change: Partial<
      Pick<
        EditorState,
        | "mode"
        | "diameter"
        | "amount"
        | "grid"
        | "title"
        | "error"
        | "background"
      >
    > = {},
    readiness = this.localReadiness(),
  ): void {
    const previous = this.state;
    this.state = { ...this.state, ...change };
    this.state = {
      ...this.state,
      canUndo: this.session.editable && (this.doc?.canUndo ?? false),
      canRedo: this.session.editable && (this.doc?.canRedo ?? false),
      persistenceError: this.session.error?.message ?? null,
      recovering: this.session.recovering,
      fileAction: this.session.changingProject,
      scale: this.world.camera.scale,
      sequence: this.doc?.sequence ?? 0,
      level: this.currentBrush().level,
      writing: this.session.writing,
      saved: this.session.saved,
      loading:
        readiness.reason === "sources" ||
        readiness.reason === "terrain" ||
        (readiness.reason === "feedback" && !this.stroke),
      needsPress: this.brushState.kind === "blocked",
    };
    this.state.message = this.session.recovering
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
                : this.session.changingProject
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
    this.publish({ error: message });
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
    this.world.moveCamera(this.clampedCamera(camera));
    this.world.refresh();
    this.releaseOffscreenFeedback();
    this.observation.navigation(input, {
      sessionId: this.doc.sessionId,
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
        ...this.awaitingDose,
        reason: "outside-view",
        viewBounds: this.world.bounds(),
        viewGeneration: this.world.state().viewGeneration,
      });
      this.awaitingDose = null;
    }
  }

  goTo(event: Event, x: number, y: number, scale: number): void {
    if (this.stroke) return;
    this.navigate({ x, y, scale }, this.input(event, "navigation"));
  }

  /** One current demand, not a queue of camera/hover requests. */
  private scheduleLoad(): void {
    if (!this.doc || this.disposed) return;
    const local = this.localReadiness();
    const viewGeneration = this.world.state().viewGeneration;
    const power = this.world.presentationPower();
    const bounds = this.world.sourceBounds();
    const key = [
      this.doc.sessionId,
      viewGeneration,
      power,
      ...bounds,
      local.brush.level,
      ...local.bounds,
    ].join(":");
    if (this.desiredNeed?.key === key) return;
    this.desiredNeed = {
      document: this.doc,
      viewGeneration,
      bounds,
      power,
      minLevel: minimumCoarseHeightLevel(power),
      toolBounds: local.bounds,
      toolLevel: local.brush.level,
      key,
    };
    this.retainViewSources();
  }

  /** Apply one ready dose, then draw; completion is polled before accepting more. */
  private frame = (now: number): void => {
    if (this.disposed) return;
    const start = performance.now();
    let doseSubmitted = false;
    try {
      if (!this.pollCompletedFeedback()) return;
      const read = this.pumpRead();
      if (read) void read.catch(this.fail);
      this.advanceHeldBrush(performance.now());
      const submission = this.world.renderFrame(now);
      if (submission) {
        this.observation.submitted(submission, (bounds) =>
          this.world.inspectSubmittedRegion(bounds),
        );
        this.releaseCompletedDose();
        doseSubmitted = Boolean(
          this.awaitingDose &&
          this.world.inspectSubmittedRegion(this.awaitingDose.bounds).status ===
            "current",
        );
        this.checkLocalReady();
      }
    } catch (error) {
      this.fail(error);
    } finally {
      // Waiting time and travel never become catch-up work after a slow draw.
      if (this.awaitingDose && !doseSubmitted)
        this.advanceHeldBrush(performance.now(), "after-draw");
      if (this.lastFrameAt)
        this.observation.event("frame", {
          interval: now - this.lastFrameAt,
          cpuMs: performance.now() - start,
        });
      this.lastFrameAt = now;
      if (!this.disposed) this.animation = requestAnimationFrame(this.frame);
    }
  };

  /** Input between RAFs may use a completed fence; this never waits or paints. */
  private pollCompletedFeedback(): boolean {
    try {
      if (this.world.pollCompletion()) {
        this.releaseCompletedDose();
        this.checkLocalReady();
      }
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }

  private releaseCompletedDose(): void {
    if (
      this.awaitingDose?.sessionId === this.doc.sessionId &&
      this.world.inspectRegion(this.awaitingDose.bounds).status === "current"
    )
      this.awaitingDose = null;
  }

  private currentView(
    document: EditorDocument,
    viewGeneration: number,
  ): boolean {
    return (
      !this.disposed &&
      document === this.doc &&
      viewGeneration === this.world.state().viewGeneration
    );
  }

  /** Reads may pass a queued write; acknowledged state must never regress. */
  private async readCurrent<T extends SourceBoundary>(
    document: EditorDocument,
    read: () => Promise<T>,
    consume: (reply: T) => void,
    viewGeneration = this.world.state().viewGeneration,
  ): Promise<boolean> {
    const current = () => this.currentView(document, viewGeneration);
    while (current()) {
      const reply = await read().catch((error: unknown) => {
        if (!current()) return null;
        throw error;
      });
      if (!reply || !current() || reply.sessionId !== document.sessionId)
        return false;
      if (!Number.isSafeInteger(reply.sequence) || reply.sequence < 0)
        throw new Error("Ungültige Lesesequenz der Arbeitskopie.");
      if (reply.sequence >= document.persistedSequence) {
        // Import and local projection are one synchronous boundary. An ACK must
        // not release their required patches between validation and projection.
        consume(reply);
        return true;
      }
    }
    return false;
  }

  private readRegion(
    document: EditorDocument,
    bounds: Bounds,
    minLevel: number,
    viewGeneration: number,
  ): Promise<boolean> {
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
      viewGeneration,
    );
  }

  private startRead(key: string, read: () => Promise<void>): Promise<void> {
    const pending = read()
      .catch((error: unknown) => {
        if (
          this.readState.kind === "loading" &&
          this.readState.promise === pending
        )
          this.readState = { kind: "failed", key };
        throw error;
      })
      .finally(() => {
        if (
          this.readState.kind === "loading" &&
          this.readState.promise === pending
        )
          this.readState = { kind: "idle" };
      });
    this.readState = { kind: "loading", promise: pending };
    return pending;
  }

  /** Start just the next missing part. The next frame considers the newest need. */
  private pumpRead(): Promise<void> | null {
    if (this.readState.kind === "loading") return null;
    const need = this.desiredNeed;
    if (!need || !this.currentView(need.document, need.viewGeneration))
      return null;
    if (this.readState.kind === "ready" && this.readState.key === need.key)
      return null;
    const { document, bounds, power, minLevel, viewGeneration } = need;
    const presentation = !this.world.isPresentationReady(bounds, power);
    const tool = !document.isReady(
      need.toolBounds,
      HEIGHT_LEVELS.slice(need.toolLevel),
    );
    if (!presentation && !tool) {
      this.readState = { kind: "ready", key: need.key };
      return null;
    }
    const key = `${need.key}:${presentation ? "presentation" : "tool"}`;
    if (this.readState.kind === "failed" && this.readState.key === key)
      return null;
    this.checkLocalReady();
    return this.startRead(key, async () => {
      if (presentation) {
        await this.readCurrent(
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
          viewGeneration,
        );
      } else {
        await this.readRegion(
          document,
          need.toolBounds,
          need.toolLevel,
          viewGeneration,
        );
      }
      if (document === this.doc && !this.disposed) {
        this.retainViewSources();
        this.checkLocalReady();
      }
    });
  }

  /** Initial/project loading waits on the same single read state used by RAF. */
  private async loadView(): Promise<void> {
    this.scheduleLoad();
    while (!this.disposed) {
      const pending =
        this.readState.kind === "loading"
          ? this.readState.promise
          : this.pumpRead();
      if (!pending) return;
      await pending;
    }
  }

  private retainViewSources(): void {
    const need = this.desiredNeed;
    if (!need || need.document !== this.doc) return;
    this.world.forgetSources(
      this.doc.retainSources([
        { bounds: need.bounds, minLevel: need.minLevel },
        { bounds: need.toolBounds, minLevel: need.toolLevel },
      ]),
    );
  }

  /** The optional diagnostic sampler shares the same bounded read slot. */
  private async ensure(bounds: Bounds, minLevel: number): Promise<boolean> {
    const document = this.doc;
    while (this.readState.kind === "loading") await this.readState.promise;
    if (document !== this.doc || this.disposed) return false;
    if (document.isReady(bounds, HEIGHT_LEVELS.slice(minLevel))) return true;
    let loaded = false;
    await this.startRead(`diagnostic:${document.sessionId}`, async () => {
      loaded = await this.readRegion(
        document,
        bounds,
        minLevel,
        this.world.state().viewGeneration,
      );
    });
    return loaded;
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
    brush = this.stroke?.brush ?? this.currentBrush(),
  ): LocalReadiness {
    const points = this.stroke
      ? [
          this.stroke.point,
          ...this.stroke.path.map((sample) => sample.point),
          point,
        ]
      : [point];
    const inWorld = points.every((candidate) =>
      candidate.every(
        (value) => Number.isFinite(value) && Math.abs(value) <= 100_000_000,
      ),
    );
    const bounds = inWorld
      ? this.stroke
        ? brushPathBounds(this.stroke)
        : heightBrushReadBounds(brush, point, point)
      : brushBounds(point, brush.radius + 2 * heightSpacing(brush.level));
    const view = this.world.bounds();
    const visible = points.every(
      (candidate) =>
        Math.hypot(
          Math.max(view[0] - candidate[0], 0, candidate[0] - view[2]),
          Math.max(view[1] - candidate[1], 0, candidate[1] - view[3]),
        ) < brush.radius,
    );
    const sourcesReady = Boolean(
      inWorld && this.doc?.isReady(bounds, HEIGHT_LEVELS.slice(brush.level)),
    );
    const display = this.world.inspectRegion(bounds);
    const feedback = this.awaitingDose
      ? this.world.inspectRegion(this.awaitingDose.bounds)
      : null;
    const reason =
      !inWorld || !visible
        ? "outside"
        : !this.session.editable
          ? "busy"
          : !sourcesReady
            ? "sources"
            : display.status === "missing" || display.status === "outside"
              ? "terrain"
              : feedback && feedback.status !== "current"
                ? "feedback"
                : display.status !== "current"
                  ? "terrain"
                  : null;
    return {
      ready: reason === null,
      sourcesReady,
      reason,
      bounds,
      point,
      brush,
      frame: display.frame,
      viewGeneration: display.viewGeneration,
    };
  }

  private checkLocalReady(): LocalReadiness {
    const readiness = this.localReadiness();
    if (this.world.cursor) {
      const waiting =
        !readiness.ready && !(readiness.reason === "feedback" && this.stroke);
      if (Boolean(this.world.cursor.waiting) !== waiting) {
        this.world.cursor.waiting = waiting;
        this.world.redraw();
      }
    }
    if (this.doc)
      this.observation.readiness({
        sessionId: this.doc.sessionId,
        revision: this.doc.revision,
        frame: readiness.frame,
        viewGeneration: readiness.viewGeneration,
        ready: readiness.ready,
        sourcesReady: readiness.sourcesReady,
      });
    this.publish({}, readiness);
    return readiness;
  }

  private updateToolNeed(): void {
    const readiness = this.checkLocalReady();
    if (readiness.reason === "sources") this.scheduleLoad();
    this.world.redraw();
  }

  retryLoad(): void {
    if (this.readState.kind !== "loading") this.readState = { kind: "idle" };
    this.publish({ error: null });
    this.scheduleLoad();
    this.world.refresh();
    this.updateToolNeed();
  }

  private down = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 1) return;
    if (!this.pollCompletedFeedback()) return;
    this.canvas.focus();
    this.canvas.setPointerCapture(event.pointerId);
    const input = this.input(
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
    if (this.brushState.kind !== "idle") {
      this.skipInput(
        input,
        this.brushState.kind === "active" ? "busy" : "new-press-required",
      );
      return;
    }
    this.brushState = { kind: "blocked", pointerId: event.pointerId };
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
    const gesture: BrushStroke = {
      id: input,
      pointerId: event.pointerId,
      brush,
      point: [...point],
      pointAt: this.inputTime(event),
      clock: now,
      path: [],
    };
    this.brushState = { kind: "active", stroke: gesture };
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
      // A valid down/up between frames must keep its small immediate click dose.
      this.applyDose(
        gesture,
        [{ from: point, to: point, elapsedMs: PRESS_DOSE_MS }],
        now,
        now,
        0,
        "press",
        [input],
      );
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
      radius: this.stroke
        ? this.stroke.brush.radius * this.world.camera.scale
        : this.diameter / 2,
    };
    this.world.redraw();
  }

  private move = (event: PointerEvent): void => {
    if (!this.pollCompletedFeedback()) return;
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
      this.navigate(camera, this.input(event, "navigation"));
    } else if (this.stroke) {
      const events = event.getCoalescedEvents?.() ?? [];
      for (const e of events.length ? events : [event]) {
        const latest: BrushPoint = {
          point: this.worldPoint(e),
          input: this.input(e, "edit"),
          at: this.inputTime(e),
        };
        const stroke = this.stroke!;
        const previousAt = stroke.path.at(-1)?.at ?? stroke.pointAt;
        if (latest.at < previousAt) {
          this.skipInput(latest.input, "stale");
          continue;
        }
        if (stroke.path.length === MAX_BRUSH_POINTS) {
          // Explicit overload, never a shortcut across the discarded curve.
          const now = performance.now();
          this.discardTime(stroke, stroke.clock, now, "overflow");
          this.skipPath(stroke, "overflow");
          this.skipInput(latest.input, "overflow");
          stroke.point = [...latest.point];
          stroke.pointAt = latest.at;
          stroke.clock = now;
        } else stroke.path.push(latest);
      }
      // Ready movement is accepted before a following pointerup can close the
      // gesture. Pending feedback retains the timestamped path until the draw.
      this.advanceHeldBrush(performance.now());
    } else {
      if (this.brushState.kind === "blocked")
        this.skipInput(this.input(event, "edit"), "new-press-required");
      this.updateToolNeed();
    }
  };

  private up = (event: PointerEvent): void => {
    if (!this.pollCompletedFeedback()) return;
    if (this.pan) {
      this.pan = null;
      return;
    }
    const state = this.brushState;
    if (
      state.kind === "idle" ||
      (state.kind === "active" ? state.stroke.pointerId : state.pointerId) !==
        event.pointerId
    )
      return;
    const input = this.input(event, "pointerup");
    if (state.kind === "active")
      this.finishGesture(input, "pointerup", event, true);
    else {
      this.brushState = { kind: "idle" };
      this.skipInput(input, "no-gesture");
    }
    this.checkLocalReady();
  };

  private wheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.stroke) return;
    const input = this.input(event, "navigation");
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

  private input(event: Event, kind: string): number {
    const id = ++this.inputId;
    this.observation.input(id, event, kind);
    return id;
  }

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
      gestureId: this.stroke?.id ?? null,
    });
  }

  private discardTime(
    gesture: BrushStroke,
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

  private skipPath(gesture: BrushStroke, reason: string): void {
    for (const sample of gesture.path) this.skipInput(sample.input, reason);
    gesture.path = [];
  }

  private applyDose(
    gesture: BrushStroke,
    segments: HeightSegment[],
    fromAt: number,
    toAt: number,
    rawElapsedMs: number,
    cause: "press" | "move" | "hold",
    inputs: number[],
  ): void {
    const from: Point = [...segments[0].from];
    const point = segments.at(-1)!.to;
    const acceptedElapsedMs = segments.reduce(
      (sum, segment) => sum + segment.elapsedMs,
      0,
    );
    const update = this.doc.applySegments(segments);
    const appliedAt = performance.now();
    gesture.point = [...point];
    const intervalId = ++this.intervalId;
    let projectedAt: number | null = null;
    try {
      if (update) {
        this.world.updateSourcePatches(update.patches);
        this.world.invalidate(update.bounds);
        this.awaitingDose = {
          sessionId: this.doc.sessionId,
          bounds: update.bounds,
          intervalId,
          gestureId: gesture.id,
          revision: this.doc.revision,
        };
      }
      projectedAt = performance.now();
    } finally {
      this.observation.dose({
        sessionId: this.doc.sessionId,
        gestureId: gesture.id,
        intervalId,
        at: appliedAt,
        projectedAt,
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
        segments,
        inputIds: inputs,
      });
    }
    if (!update) {
      for (const input of inputs) this.skipInput(input, "no-change");
      return;
    }
    this.checkLocalReady();
  }

  private advanceHeldBrush = (
    now: number,
    phase: "accept" | "after-draw" = "accept",
  ): void => {
    const gesture = this.stroke;
    if (this.disposed || !gesture) return;
    const fromAt = gesture.clock;
    const toAt = Math.max(fromAt, now);
    let accountedTo = fromAt;
    const previousInterval = this.intervalId;
    try {
      // Validate the full segment before discarding time or shifting its anchor.
      const readiness = this.localReadiness(
        brushTarget(gesture),
        gesture.brush,
      );
      const decision = decideBrushFrame(gesture, now, readiness.reason, phase);
      this.brushState = { kind: "active", stroke: decision.stroke };
      if (readiness.ready) this.awaitingDose = null;
      if (decision.kind === "none") return;
      if (decision.kind === "wait" || decision.kind === "stale") {
        const reason = decision.kind === "stale" ? "stale" : decision.reason;
        this.discardTime(
          decision.stroke,
          decision.fromAt,
          decision.toAt,
          reason,
        );
        accountedTo = decision.toAt;
        for (const input of decision.inputs) this.skipInput(input, reason);
        if (decision.kind === "wait" && decision.end) {
          this.finishGesture(undefined, reason);
          this.updateToolNeed();
        }
        return;
      }
      if (decision.discardedFrom !== undefined) {
        this.discardTime(
          decision.stroke,
          decision.discardedFrom,
          decision.fromAt,
          "cap",
        );
        accountedTo = decision.fromAt;
      }
      for (const input of decision.discardedInputs)
        this.skipInput(input, "stale");
      this.applyDose(
        decision.stroke,
        decision.segments,
        decision.fromAt,
        decision.toAt,
        decision.rawElapsedMs,
        decision.cause,
        decision.inputs,
      );
    } catch (error) {
      // An examined window can never become backlog, even if validation fails.
      if (this.stroke) this.stroke.clock = toAt;
      if (this.intervalId === previousInterval)
        this.discardTime(gesture, accountedTo, toAt, "error");
      this.gestureFailure(error);
    }
  };

  private gestureFailure(error: unknown): void {
    this.finishGesture(undefined, "error");
    this.fail(error);
  }

  private finishGesture(
    input?: number,
    reason = "end",
    event?: Event,
    released = false,
  ): void {
    const gesture = this.stroke;
    if (!gesture) return;
    const endAt = performance.now();
    this.discardTime(gesture, gesture.clock, endAt, reason);
    this.skipPath(gesture, reason);
    this.brushState = released
      ? { kind: "idle" }
      : { kind: "blocked", pointerId: gesture.pointerId };
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
    if (input !== undefined)
      this.observation.commit(
        {
          input,
          gestureId: gesture.id,
          sessionId: this.doc.sessionId,
          bounds: change.dirtyBounds,
          sequence: change.sequence,
          revision: change.revision,
        },
        (bounds) => this.world.inspectSubmittedRegion(bounds),
      );
    // Applied terrain already requests its own draw. Finalizing unchanged
    // pixels needs no extra frame; pending terrain and cursor changes still do.
    this.persist();
  }

  private persist(): void {
    this.session.persist();
    this.publish();
  }

  undo(): void {
    this.history(false);
  }
  redo(): void {
    this.history(true);
  }
  private history(redo: boolean): void {
    if (
      this.session.error ||
      this.session.changingProject ||
      this.session.recovering
    )
      return;
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
      this.persist();
      this.publish();
    } catch (error) {
      this.fail(error);
    }
  }

  async save(saveAs = false): Promise<void> {
    if (this.session.changingProject) return;
    this.finishGesture(undefined, "save");
    await this.session.save(saveAs);
    this.publish();
  }

  async open(): Promise<void> {
    await this.changeProject(false);
  }
  async newProject(): Promise<void> {
    await this.changeProject(true);
  }
  private async changeProject(empty: boolean): Promise<void> {
    if (this.session.changingProject) return;
    try {
      await this.prepareFileAction();
      const next = await this.session.changeProject(empty);
      if (next) {
        this.setProject(next);
        await this.loadView();
      }
    } finally {
      this.resumeFileAction();
    }
  }

  /** The input owner ends the gesture; the session owns its file/write boundary. */
  private async prepareFileAction(
    owner: "renderer" | "native" = "renderer",
  ): Promise<PreparedDocument> {
    this.session.beginFileAction(owner);
    try {
      this.finishGesture(undefined, "file-action");
      return await this.session.prepareFileAction();
    } catch (error) {
      this.session.endFileAction(owner);
      throw error;
    }
  }

  private resumeFileAction(owner: "renderer" | "native" = "renderer"): void {
    this.session.endFileAction(owner);
    this.checkLocalReady();
  }

  async recoverWrites(): Promise<void> {
    if (this.session.recovering)
      throw new Error("Der Speicherstand wird bereits geprüft.");
    this.finishGesture(undefined, "recovery");
    await this.session.recover();
    this.publish({ error: null });
    this.checkLocalReady();
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
    if (options.pointerHeight)
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
      schemaVersion: 5,
      sessionId: this.doc?.sessionId,
      state: { ...this.state },
      camera: { ...this.world.camera },
      brush: this.currentBrush(),
      gesture: this.stroke
        ? {
            active: this.doc.active,
            pendingInput: this.stroke.path.length > 0,
            brush: { ...this.stroke.brush },
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
      lastInputId: this.inputId,
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
  private releasePointer(reason: string, event: Event): void {
    this.finishGesture(undefined, reason, event, true);
    this.brushState = { kind: "idle" };
    this.pan = null;
    this.checkLocalReady();
  }

  private blur = (event: Event): void => {
    this.releasePointer("blur", event);
  };
  private cancel = (event: Event): void => {
    this.releasePointer("cancel", event);
  };
  private visibility = (event: Event): void => {
    if (document.visibilityState === "hidden")
      this.releasePointer("visibility", event);
  };
  private leave = (): void => {
    if (this.brushState.kind !== "idle" || this.pan) return;
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
    cancelAnimationFrame(this.animation);
    this.desiredNeed = null;
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
