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
  brushPathRegions,
  beginTimedBrush,
  normalizeBrushTimestamp,
  planTimedBrushWindow,
  MAX_BRUSH_POINTS,
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
  unionBounds,
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
import {
  WorldRenderer,
  type Camera,
  type RegionFoundation,
  type FrozenRenderReceipt,
} from "./render/WorldRenderer";
import type { BrushEffectReceipt } from "./model/BrushReservations";

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
  finishing: boolean;
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
  reason: "sources" | "terrain" | "busy" | "outside" | null;
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

interface BrushAdmission {
  admissionId: number;
  gestureId: number;
  inputIds: number[];
  from: Point;
  to: Point;
  path: Point[];
  samples: BrushPoint[];
  observedAt: number;
  segments: HeightSegment[];
  fromAt: number;
  toAt: number;
  rawElapsedMs: number;
  offeredElapsedMs: number;
  cause: "press" | "move" | "hold" | "terminal";
}

class BrushUnavailable extends Error {
  constructor(readonly reason: NonNullable<LocalReadiness["reason"]>) {
    super(reason);
  }
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
  private foundation: RegionFoundation | null = null;
  private frozenEffect: {
    effectReceipt: BrushEffectReceipt;
    renderReceipt: FrozenRenderReceipt;
  } | null = null;
  private lastFrozenRevision = -1;
  private admissions = new Map<number, BrushAdmission>();
  private admissionId = 0;
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
    finishing: false,
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
        this.syncBrushContext();
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
    const previous = this.doc;
    this.doc = new EditorDocument(info.sessionId, {
      sequence: info.sequence,
      empty: info.sourceTiles === 0,
      maxSourceBytes: editorBudgets.sourceBytes,
      maxPendingBytes: editorBudgets.pendingWriteBytes,
      maxHistoryBytes: editorBudgets.historyBytes,
      maxHistoryActions: editorBudgets.historyActions,
    });
    this.brushState = { kind: "idle" };
    this.foundation = null;
    this.frozenEffect = null;
    this.lastFrozenRevision = -1;
    this.admissions.clear();
    this.desiredNeed = null;
    this.readState = { kind: "idle" };
    this.observation.reset();
    this.session.attach(this.doc, info);
    previous?.invalidateContinuation();
    this.backgroundStats = { active: false };
    this.work?.postMessage({ cancel: true });
    this.world.reset(this.doc);
    this.world.moveCamera({ x: 0, y: 0, scale: 0.25 });
    this.prepareToolLevel();
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

  private get actionStroke(): BrushStroke | null {
    return this.brushState.kind === "active" ||
      this.brushState.kind === "finishing"
      ? this.brushState.stroke
      : null;
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
      finishing: this.doc?.finishing ?? false,
      scale: this.world.camera.scale,
      sequence: this.doc?.sequence ?? 0,
      level: this.currentBrush().level,
      writing: this.session.writing,
      saved: this.session.saved,
      loading: readiness.reason === "sources" || readiness.reason === "terrain",
      needsPress: this.brushState.kind === "blocked",
    };
    this.state.message = this.session.recovering
      ? "Speicherstand wird geprüft …"
      : this.state.persistenceError
        ? "Speicherfehler: Änderungen bleiben im Editor erhalten"
        : this.state.error
          ? this.state.error
          : this.state.finishing
            ? "Pinselstrich wird abgeschlossen …"
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

  private worldPoint(
    event: PointerEvent | WheelEvent,
    rect = this.canvas.getBoundingClientRect(),
  ): Point {
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
    this.syncBrushContext();
    this.observation.navigation(input, {
      sessionId: this.doc.sessionId,
      camera: { ...this.world.camera },
    });
    this.checkLocalReady();
    this.scheduleLoad();
    this.publish();
  }

  /** A changed presentation identity seals input and invalidates old allowances. */
  private syncBrushContext(): void {
    const work = this.doc?.brushWork;
    if (!work) return;
    const state = this.world.state();
    if (
      work.context.viewId === state.viewGeneration &&
      work.context.preparationId === state.preparationId
    )
      return;
    this.finishGesture(undefined, "render-context");
    this.doc.changeBrushContext({
      ...work.context,
      viewId: state.viewGeneration,
      preparationId: state.preparationId,
    });
    this.frozenEffect = null;
    this.lastFrozenRevision = -1;
  }

  goTo(event: Event, x: number, y: number, scale: number): void {
    if (this.stroke) return;
    this.navigate({ x, y, scale }, this.input(event, "navigation"));
  }

  /** One current demand, not a queue of camera/hover requests. */
  private scheduleLoad(): void {
    if (!this.doc || this.disposed) return;
    this.prepareToolLevel();
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

  /** One author slice per RAF; input acceptance never waits for a GPU receipt. */
  private frame = (now: number): void => {
    if (this.disposed) return;
    const start = performance.now();
    try {
      if (!this.pollCompletedFeedback()) return;
      this.syncBrushContext();
      const read = this.pumpRead();
      if (read) void read.catch(this.fail);
      this.advanceHeldBrush(performance.now());
      this.advanceAction();
      this.freezeBrushRender();
      const submission = this.world.renderFrame(now);
      if (submission) {
        this.observation.submitted(submission, (bounds) =>
          this.world.inspectSubmittedRegion(bounds),
        );
        this.releaseCompletedEffect();
        this.checkLocalReady();
      }
    } catch (error) {
      this.fail(error);
    } finally {
      if (this.lastFrameAt)
        this.observation.event("frame", {
          interval: now - this.lastFrameAt,
          cpuMs: performance.now() - start,
        });
      this.lastFrameAt = now;
      if (!this.disposed) this.animation = requestAnimationFrame(this.frame);
    }
  };

  /** Polling observes a fence; it neither waits nor materializes author work. */
  private pollCompletedFeedback(): boolean {
    try {
      const completed = this.world.pollCompletion();
      this.releaseCompletedEffect();
      if (completed) this.checkLocalReady();
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }

  private freezeBrushRender(): void {
    const work = this.doc.brushWork;
    if (
      this.frozenEffect ||
      !work ||
      work.complete ||
      !work.appliedRegions.length ||
      this.lastFrozenRevision === this.doc.revision
    )
      return;
    const renderReceipt = this.world.freezeRender(work.appliedRegions);
    if (!renderReceipt) return;
    if (
      renderReceipt.revision !== this.doc.revision ||
      renderReceipt.sessionId !== work.context.sessionId ||
      renderReceipt.viewGeneration !== work.context.viewId ||
      renderReceipt.preparationId !== work.context.preparationId
    )
      throw new Error("Renderstand und Pinselreserve gehören nicht zusammen.");
    const effectReceipt = this.doc.freezeBrushEffect();
    if (!effectReceipt) return;
    this.frozenEffect = { renderReceipt, effectReceipt };
    this.lastFrozenRevision = this.doc.revision;
    this.observation.event("brush-frozen", {
      sessionId: this.doc.sessionId,
      gestureId: work.context.gestureId,
      revision: this.doc.revision,
      ...this.frozenEffect,
      receiptId: effectReceipt.id,
      work,
    });
  }

  private releaseCompletedEffect(): void {
    const frozen = this.frozenEffect;
    if (!frozen) return;
    const status = this.world.inspectRenderReceipt(frozen.renderReceipt);
    if (status === "pending") return;
    this.frozenEffect = null;
    const accepted =
      status === "complete" &&
      frozen.renderReceipt.sessionId === frozen.effectReceipt.sessionId &&
      frozen.renderReceipt.viewGeneration === frozen.effectReceipt.viewId &&
      frozen.renderReceipt.preparationId ===
        frozen.effectReceipt.preparationId &&
      this.doc.acknowledgeBrushEffect(frozen.effectReceipt);
    this.observation.event("brush-feedback", {
      sessionId: frozen.effectReceipt.sessionId,
      gestureId: frozen.effectReceipt.gestureId,
      revision: frozen.renderReceipt.revision,
      ...frozen,
      receiptId: frozen.effectReceipt.id,
      status,
      accepted,
      work: this.doc.brushWork,
    });
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
    const regions = inWorld
      ? this.stroke
        ? brushPathRegions(this.stroke)
        : [heightBrushReadBounds(brush, point, point)]
      : [brushBounds(point, brush.radius + 2 * heightSpacing(brush.level))];
    const bounds = regions.reduce(unionBounds);
    const view = this.world.bounds();
    const visible = points.every(
      (candidate) =>
        Math.hypot(
          Math.max(view[0] - candidate[0], 0, candidate[0] - view[2]),
          Math.max(view[1] - candidate[1], 0, candidate[1] - view[3]),
        ) < brush.radius,
    );
    const sourcesReady = Boolean(
      inWorld &&
      this.doc &&
      regions.every((region) =>
        this.doc.isReady(region, HEIGHT_LEVELS.slice(brush.level)),
      ),
    );
    const displays = regions.map((region) =>
      this.stroke && this.foundation
        ? this.world.inspectFoundation(region, this.foundation)
        : this.world.inspectRegion(region),
    );
    const display = displays[0];
    const reason =
      !inWorld || !visible
        ? "outside"
        : !this.session.editable || this.brushState.kind === "finishing"
          ? "busy"
          : !sourcesReady
            ? "sources"
            : displays.some((region) => region.status !== "current")
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
    this.prepareToolLevel();
    const readiness = this.localReadiness();
    if (this.world.cursor) {
      const waiting = !readiness.ready;
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

  /** Imperative product demand; observation's localReadiness getter stays pure. */
  private prepareToolLevel(): void {
    this.world.setToolLevel(
      this.actionStroke?.brush.level ?? this.currentBrush().level,
    );
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
    this.prepareToolLevel();
    const readiness = this.localReadiness(point, brush);
    if (!readiness.ready) {
      this.skipInput(input, readiness.reason!);
      this.checkLocalReady();
      if (readiness.reason === "sources") this.scheduleLoad();
      return;
    }
    try {
      const at = this.inputTime(event);
      const foundation = this.world.captureFoundation();
      const gesture: BrushStroke = {
        ...beginTimedBrush(brush, { point, at, input }),
        id: input,
        pointerId: event.pointerId,
        path: [],
      };
      this.foundation = foundation;
      this.frozenEffect = null;
      this.lastFrozenRevision = -1;
      this.admissions.clear();
      this.doc.beginPrepaidGesture(brush, {
        sessionId: this.doc.sessionId,
        gestureId: input,
        viewId: foundation.viewGeneration,
        preparationId: foundation.preparationId,
      });
      this.brushState = { kind: "active", stroke: gesture };
      this.observation.event("brush-start", {
        sessionId: this.doc.sessionId,
        gestureId: input,
        input,
        startAt: at,
        inputAt: at,
        point: [...point],
        rateFtPerSecond: brush.amount,
        radius: brush.radius,
        level: brush.level,
        dosing: "c1",
        foundation,
      });
      this.admitBrush(
        gesture,
        {
          admissionId: ++this.admissionId,
          gestureId: input,
          inputIds: [input],
          from: [...point],
          to: [...point],
          path: [point],
          samples: [],
          observedAt: performance.now(),
          segments: [],
          fromAt: at,
          toAt: at,
          rawElapsedMs: 0,
          offeredElapsedMs: 0,
          cause: "press",
        },
        false,
        1,
      );
    } catch (error) {
      this.gestureFailure(error);
    }
    this.checkLocalReady();
  };

  private updatePointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = this.worldPoint(event, rect);
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
      if (event.pointerId !== this.stroke.pointerId) return;
      const events = event.getCoalescedEvents?.() ?? [];
      try {
        const samples = events.length ? events : [event];
        if (
          samples.length + (this.doc.brushWork?.pendingPoints ?? 0) >
          MAX_BRUSH_POINTS - 1
        )
          throw new RangeError(
            "Zu viele offene Pinselpunkte; der angenommene Strich wird abgeschlossen.",
          );
        const rect = this.canvas.getBoundingClientRect();
        this.stroke.path = samples.map((sample): BrushPoint => ({
          point: this.worldPoint(sample, rect),
          input: this.input(sample, "edit"),
          at: this.inputTime(sample),
        }));
        this.advanceHeldBrush(performance.now());
      } catch (error) {
        this.gestureFailure(error);
      }
    } else {
      if (
        this.brushState.kind === "blocked" ||
        this.brushState.kind === "finishing"
      )
        this.skipInput(this.input(event, "edit"), "new-press-required");
      this.updateToolNeed();
    }
  };

  private up = (event: PointerEvent): void => {
    this.pollCompletedFeedback();
    if (this.pan) {
      this.pan = null;
      return;
    }
    const state = this.brushState;
    if (state.kind === "finishing") {
      if (state.blockedPointerId === event.pointerId)
        state.blockedPointerId = null;
      this.checkLocalReady();
      return;
    }
    if (
      state.kind === "idle" ||
      (state.kind === "active" ? state.stroke.pointerId : state.pointerId) !==
        event.pointerId
    )
      return;
    const input = this.input(event, "pointerup");
    if (state.kind === "active") {
      this.updatePointer(event);
      this.finishGesture(input, "pointerup", event, true);
    } else {
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
    return normalizeBrushTimestamp(
      event.timeStamp,
      performance.now(),
      performance.timeOrigin,
    );
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

  private skipPath(gesture: BrushStroke, reason: string): void {
    for (const sample of gesture.path) this.skipInput(sample.input, reason);
    gesture.path = [];
  }

  private admitBrush(
    gesture: BrushStroke,
    admission: BrushAdmission,
    end: boolean,
    pointCount: number,
  ): void {
    const startedAt = performance.now();
    if (
      !this.foundation ||
      !this.world.acceptFoundation(brushPathRegions(gesture), this.foundation)
    )
      throw new Error(
        "Der Pinselbereich besitzt keine passende sichtbare Grundlage.",
      );
    const result = this.doc.admitBrushBatch({
      admissionId: admission.admissionId,
      path: { from: admission.from, points: admission.path, end },
      time: admission.segments,
      pointCount,
    });
    if (result.reserved) this.admissions.set(admission.admissionId, admission);
    this.observation.event("brush-accepted", {
      ...admission,
      sessionId: this.doc.sessionId,
      rateFtPerSecond: gesture.brush.amount,
      radius: gesture.brush.radius,
      level: gesture.brush.level,
      end,
      pointCount,
      reserved: result.reserved,
      reservedCells: result.reservedCells,
      examinedCells: result.examinedCells,
      lookupSlotCount: result.lookupSlotCount,
      acceptedTimeEffect: result.acceptedTime,
      discardedTimeEffect: result.discardedTime,
      pendingPoints: result.pendingPoints,
      cpuMs: performance.now() - startedAt,
      work: this.doc.brushWork,
    });
    if (!result.reserved)
      for (const input of admission.inputIds)
        if (admission.cause !== "terminal")
          this.observation.event("noop", {
            input,
            accepted: true,
            reason: "prepaid",
            sessionId: this.doc.sessionId,
            gestureId: gesture.id,
          });
  }

  private admitWindow(now: number, end = false): void {
    const gesture = this.stroke;
    if (!gesture) return;
    const readiness = this.localReadiness(brushTarget(gesture), gesture.brush);
    if (!readiness.ready) throw new BrushUnavailable(readiness.reason!);
    if (!gesture.path.length && now <= gesture.clock) return;
    const plan = planTimedBrushWindow(gesture, {
      at: now,
      points: gesture.path,
      end,
    });
    this.admitBrush(
      gesture,
      {
        admissionId: ++this.admissionId,
        gestureId: gesture.id,
        inputIds: gesture.path.map((sample) => sample.input),
        from: [...gesture.point],
        to: [...plan.stroke.point],
        samples: gesture.path.map((sample) => ({
          ...sample,
          point: [...sample.point],
        })),
        observedAt: now,
        path: plan.path.points,
        segments: plan.time,
        fromAt: gesture.clock,
        toAt: plan.stroke.clock,
        rawElapsedMs: plan.offeredTimeMs,
        offeredElapsedMs: plan.acceptedTimeMs,
        cause: end ? "terminal" : gesture.path.length ? "move" : "hold",
      },
      end,
      gesture.path.length,
    );
    this.brushState = {
      kind: "active",
      stroke: { ...gesture, ...plan.stroke, path: [] },
    };
  }

  private advanceHeldBrush = (now: number): void => {
    if (this.disposed || !this.stroke) return;
    try {
      this.admitWindow(now);
    } catch (error) {
      if (error instanceof BrushUnavailable) {
        this.finishGesture(undefined, error.reason);
        this.updateToolNeed();
      } else this.gestureFailure(error);
    }
  };

  /** Sole author materializer; persistence and GPU waiting cannot truncate it. */
  private advanceAction(): void {
    const gesture = this.actionStroke;
    if (!gesture || !this.doc.active) return;
    const startedAt = performance.now();
    const result = this.doc.advanceBrushGesture();
    const appliedAt = performance.now();
    const facts = result.appliedAdmissionIds
      .map((id) => this.admissions.get(id))
      .filter((value): value is BrushAdmission => value !== undefined);
    const inputIds = result.completedAdmissionIds.flatMap((id) => {
      const fact = this.admissions.get(id);
      return fact && fact.cause !== "terminal" ? fact.inputIds : [];
    });
    let projectedAt: number | null = null;
    let projectionError: unknown;
    try {
      if (result.update) {
        this.world.updateSourcePatches(result.update.patches);
        this.world.invalidate(result.update.bounds);
      }
      projectedAt = performance.now();
    } catch (error) {
      projectionError = error;
    } finally {
      if (result.applications.length)
        this.observation.dose({
          sessionId: this.doc.sessionId,
          gestureId: gesture.id,
          intervalId: ++this.intervalId,
          at: appliedAt,
          projectedAt,
          cause: "materialize",
          dosing: "c1",
          admissionIds: result.appliedAdmissionIds,
          completedAdmissionIds: result.completedAdmissionIds,
          applications: result.applications,
          sealed: this.doc.brushWork?.sealed ?? true,
          from: facts[0]?.from ?? gesture.point,
          to: facts.at(-1)?.to ?? gesture.point,
          rateFtPerSecond: gesture.brush.amount,
          radius: gesture.brush.radius,
          level: gesture.brush.level,
          revision: this.doc.revision,
          changed: result.update !== null,
          bounds: result.update?.bounds ?? null,
          inputIds,
          cpuMs: performance.now() - startedAt,
        });
      for (const id of result.completedAdmissionIds) this.admissions.delete(id);
    }
    if (projectionError) {
      this.finishGesture(undefined, "projection-error");
      this.world.reset(this.doc);
      this.world.refresh();
      this.frozenEffect = null;
      this.lastFrozenRevision = -1;
      this.desiredNeed = null;
      this.scheduleLoad();
      this.fail(projectionError);
    }
    if (!result.complete) return;
    const state = this.brushState;
    if (state.kind !== "finishing")
      throw new Error("Eine unversiegelte Höhengeste wurde abgeschlossen.");
    this.observation.event("brush-complete", {
      sessionId: this.doc.sessionId,
      gestureId: gesture.id,
      revision: this.doc.revision,
      sequence: this.doc.sequence,
      input: state.input ?? null,
      pendingPoints: this.doc.brushWork?.pendingPoints ?? 0,
      pendingCells: this.doc.brushWork?.pendingCells ?? 0,
      pendingAdmissions: this.doc.brushWork?.pendingAdmissions ?? 0,
    });
    if (result.change && state.input !== undefined)
      this.observation.commit(
        {
          input: state.input,
          gestureId: gesture.id,
          sessionId: this.doc.sessionId,
          bounds: result.change.dirtyBounds,
          sequence: result.change.sequence,
          revision: result.change.revision,
        },
        (bounds) => this.world.inspectSubmittedRegion(bounds),
      );
    else if (state.input !== undefined)
      this.skipInput(state.input, "no-change");
    this.brushState =
      state.blockedPointerId === null
        ? { kind: "idle" }
        : { kind: "blocked", pointerId: state.blockedPointerId };
    this.foundation = null;
    this.persist();
  }

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
    let inputAt: number | null = null;
    if (reason === "pointerup" && event && input !== undefined) {
      try {
        inputAt = this.inputTime(event);
        gesture.path.push({
          point: this.worldPoint(event as PointerEvent),
          input,
          at: inputAt,
        });
        this.admitWindow(performance.now(), true);
      } catch (error) {
        this.skipInput(
          input,
          error instanceof BrushUnavailable
            ? error.reason
            : "terminal-rejected",
        );
        if (!(error instanceof BrushUnavailable)) this.fail(error);
      }
    }
    const sealed = this.stroke ?? gesture;
    this.skipPath(sealed, reason);
    this.doc.sealBrushGesture();
    const endAt = performance.now();
    this.brushState = {
      kind: "finishing",
      stroke: { ...sealed, sealed: true },
      input,
      reason,
      endAt,
      blockedPointerId: released ? null : gesture.pointerId,
    };
    this.observation.event("brush-end", {
      sessionId: this.doc.sessionId,
      gestureId: gesture.id,
      input: input ?? null,
      endAt,
      inputAt,
      reason,
      clock: sealed.clock,
      pendingPoints: this.doc.brushWork?.pendingPoints ?? 0,
    });
    this.publish();
  }

  private persist(): void {
    this.session.persist();
    this.publish();
  }

  undo(): void {
    void this.history(false).catch(this.fail);
  }
  redo(): void {
    void this.history(true).catch(this.fail);
  }
  private async history(redo: boolean): Promise<void> {
    if (
      this.session.error ||
      this.session.changingProject ||
      this.session.recovering
    )
      return;
    this.finishGesture(undefined, "history");
    const document = this.doc;
    await document.whenActionFinished();
    if (document !== this.doc || this.disposed) return;
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
      schemaVersion: 6,
      sessionId: this.doc?.sessionId,
      state: { ...this.state },
      camera: { ...this.world.camera },
      brush: this.currentBrush(),
      gesture: this.actionStroke
        ? {
            kind: this.brushState.kind,
            active: this.doc.active,
            pendingInput: (this.doc.brushWork?.pendingPoints ?? 0) > 0,
            brush: { ...this.actionStroke.brush },
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
            finishing: this.doc.finishing,
            brushWork: this.doc.brushWork,
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
    if (this.brushState.kind === "finishing")
      this.brushState.blockedPointerId = null;
    else this.brushState = { kind: "idle" };
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
    if (this.disposed) return;
    this.finishGesture(undefined, "destroy");
    this.disposed = true;
    this.doc?.invalidateContinuation();
    this.brushState = { kind: "idle" };
    this.foundation = null;
    this.frozenEffect = null;
    this.admissions.clear();
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
