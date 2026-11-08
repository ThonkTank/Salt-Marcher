import type { AtlasDesktop, ProjectInfo } from "./bridge";
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
  loading: boolean;
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
  points: BrushPoint[];
  pressPending: boolean;
  pending: boolean;
  cancelled: boolean;
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
  private writeError: Error | null = null;
  private pendingWrites = 0;
  private loadToken = 0;
  private navInput: number | null = null;
  private readyNavInput: number | null = null;
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
  private changingProject = false;
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
    loading: true,
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
    this.resizeObserver = new ResizeObserver(() => {
      this.loadToken++;
      const bounds = (
        this.canvas.parentElement ?? this.canvas
      ).getBoundingClientRect();
      if (this.world.renderer.canvas) {
        this.world.resize(bounds.width, bounds.height);
        this.releaseOffscreenFeedback();
      }
      if (this.doc) this.scheduleLoad();
    });
    this.world.onError = this.fail;
    this.world.advanceFrame = this.advanceFrame;
    this.world.onSubmit = (frame) => {
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
    await this.loadView();
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
    this.awaitingDose = null;
    this.pendingEdits = [];
    this.navInput = null;
    this.readyNavInput = null;
    this.writeQueue = Promise.resolve();
    this.writeError = null;
    this.backgroundStats = { active: false };
    this.work?.postMessage({ cancel: true });
    this.world.reset(this.doc);
    this.world.moveCamera({ x: 0, y: 0, scale: 0.25 });
    this.publish({
      title: info.title,
      saved: info.savedSequence === info.sequence,
      error: null,
      loading: true,
      message: "Kartenausschnitt wird geladen …",
      background: false,
    });
  }

  private publish(change: Partial<EditorState> = {}): void {
    const previous = this.state;
    this.state = { ...this.state, ...change };
    this.state = {
      ...this.state,
      canUndo: this.doc?.canUndo ?? false,
      canRedo: this.doc?.canRedo ?? false,
      scale: this.world.camera.scale,
      sequence: this.doc?.sequence ?? 0,
      level: this.currentBrush().level,
      writing: this.pendingWrites > 0,
      saved: Boolean(
        this.doc &&
        this.project?.savedSequence === this.doc.sequence &&
        !this.doc.active,
      ),
    };
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
    this.releaseOffscreenFeedback();
    this.navInput = input;
    this.readyNavInput = null;
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

  private async ensure(bounds: Bounds, minLevel: number): Promise<void> {
    if (this.doc.isReady(bounds, HEIGHT_LEVELS.slice(minLevel))) return;
    const document = this.doc;
    const reply = await this.bridge
      .readRegion({
        sessionId: document.sessionId,
        bounds,
        minLevel,
      })
      .catch((error: unknown) => {
        if (document !== this.doc || this.disposed) return null;
        throw error;
      });
    if (
      !reply ||
      this.doc !== document ||
      reply.sessionId !== document.sessionId
    )
      return;
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
      });
    }
    return this.viewRead;
  }

  private async readView(): Promise<void> {
    const token = ++this.loadToken;
    const document = this.doc;
    const power = this.world.presentationPower();
    const minLevel = minimumCoarseHeightLevel(power);
    const bounds = this.world.sourceBounds();
    document.evictConfirmedOutside(bounds);
    if (!this.world.isPresentationReady(bounds, power)) {
      this.publish({ loading: true });
      const reply = await this.bridge
        .readPresentation({
          sessionId: document.sessionId,
          bounds,
          power,
        })
        .catch((error: unknown) => {
          if (
            document !== this.doc ||
            token !== this.loadToken ||
            this.disposed
          )
            return null;
          throw error;
        });
      if (
        !reply ||
        this.disposed ||
        token !== this.loadToken ||
        document !== this.doc ||
        reply.sessionId !== document.sessionId
      )
        return;
      // An ack can overtake a read reply. Its patches have already been released;
      // reread rather than replacing the visible local projection with old data.
      if (reply.sequence < document.persistedSequence) {
        this.viewLoadPending = true;
        return;
      }
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
        bytes: reply.tiles.reduce((n, tile) => n + tile.values.byteLength, 0),
        overviewTiles: reply.overviews.length,
        overviewBytes: reply.overviews.reduce(
          (n, tile) => n + tile.values.byteLength,
          0,
        ),
      });
    }
    this.world.refresh();
    const brush = this.currentBrush();
    await this.ensure(
      brushBounds(
        [this.world.camera.x, this.world.camera.y],
        brush.radius + 2 * heightSpacing(brush.level),
      ),
      brush.level,
    );
    if (this.disposed || token !== this.loadToken || document !== this.doc)
      return;
    this.checkLocalReady();
    this.publish({ loading: false, message: "Bereit" });
  }

  private checkLocalReady(): void {
    if (
      !this.doc ||
      this.navInput === null ||
      this.readyNavInput === this.navInput
    )
      return;
    const brush = this.currentBrush();
    const bounds = brushBounds(
      [this.world.camera.x, this.world.camera.y],
      brush.radius + 2 * heightSpacing(brush.level),
    );
    if (this.doc.isReady(bounds, HEIGHT_LEVELS.slice(brush.level))) {
      this.readyNavInput = this.navInput;
      this.observation.mark("ready", String(this.navInput), {
        input: this.navInput,
        bounds,
        point: [this.world.camera.x, this.world.camera.y],
        brush: { ...brush },
      });
    }
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
    if (this.gesture || this.writeError || this.changingProject) {
      this.skipInput(input, "busy");
      return;
    }
    const brush = this.currentBrush();
    const point = this.worldPoint(event);
    const bounds = brushBounds(
      point,
      brush.radius + 2 * heightSpacing(brush.level),
    );
    const now = performance.now();
    const gesture: Gesture = {
      id: input,
      brush,
      point: [...point],
      pointAt: this.inputTime(event),
      clock: now,
      points: [],
      pressPending: true,
      pending: false,
      cancelled: false,
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
    if (!this.doc.isReady(bounds, HEIGHT_LEVELS.slice(brush.level)))
      this.publish({
        message: "Lokale Daten werden geladen; Pinsel pausiert …",
      });
    try {
      this.doc.beginGesture(brush);
      this.doc.applyPoint(point, 0);
      this.acceptPress(gesture);
    } catch (error) {
      this.gestureFailure(error);
    }
    this.world.redraw();
  };

  private move = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = this.worldPoint(event);
    this.world.cursor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      radius: this.diameter / 2,
    };
    this.world.redraw();
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
        if (this.gesture.points.length >= 512) {
          this.finishGesture(undefined, "input-limit");
          this.fail(
            new Error(
              "Der noch nicht verarbeitete Pinselpfad ist zu lang. Bitte einen kürzeren Strich verwenden.",
            ),
          );
          break;
        }
        this.gesture.points.push({
          point: this.worldPoint(e),
          input: this.observation.input(e, "edit"),
          at: this.inputTime(e),
        });
      }
      this.world.redraw();
    }
  };

  private up = (event: PointerEvent): void => {
    if (this.pan) {
      this.pan = null;
      return;
    }
    if (!this.gesture) return;
    const input = this.observation.input(event, "pointerup");
    this.finishGesture(input, "pointerup", event);
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
    this.observation.event("noop", { input, accepted: false, reason });
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

  private skipQueued(
    gesture: Gesture,
    reason: string,
    trackPosition = true,
  ): void {
    const latest = gesture.points.reduce<BrushPoint | undefined>(
      (newest, point) => (!newest || point.at >= newest.at ? point : newest),
      undefined,
    );
    for (const entry of gesture.points) this.skipInput(entry.input, reason);
    gesture.points = [];
    if (latest && trackPosition) this.anchor(gesture, latest.point, latest.at);
  }

  private waitForSources(
    gesture: Gesture,
    point: Point,
    at = gesture.pointAt,
  ): void {
    // Paused movement is not painted later as one long connecting segment.
    this.anchor(gesture, point, at);
    const bounds = this.doc.readBoundsForPoint(point, gesture.brush);
    gesture.pending = true;
    this.observation.event("brush-wait", {
      sessionId: this.doc.sessionId,
      gestureId: gesture.id,
      bounds,
      level: gesture.brush.level,
    });
    void this.ensure(bounds, gesture.brush.level)
      .then(() => {
        if (this.disposed || gesture.cancelled || this.gesture !== gesture)
          return;
        const now = performance.now();
        this.discardTime(gesture, gesture.clock, now, "sources");
        gesture.clock = now;
        this.skipQueued(gesture, "sources");
        gesture.pending = false;
        this.world.redraw();
      })
      .catch((error: unknown) => {
        if (this.disposed || gesture.cancelled || this.gesture !== gesture)
          return;
        this.gestureFailure(error);
      });
  }

  private acceptPress(gesture: Gesture): void {
    if (this.awaitingDose && !this.world.regionExact(this.awaitingDose.bounds))
      return;
    this.awaitingDose = null;
    const needed = this.doc.readBoundsForPoint(gesture.point, gesture.brush);
    if (!this.doc.isReady(needed, HEIGHT_LEVELS.slice(gesture.brush.level))) {
      this.waitForSources(gesture, gesture.point);
      return;
    }
    const now = performance.now();
    this.applyDose(gesture, gesture.point, now, now, 0, "press", gesture.id);
    gesture.pressPending = false;
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
        gestureId: gesture.id,
        intervalId,
        revision: this.doc.revision,
        bounds: update.bounds,
        point: [...point],
        gestureReleased: false,
      });
    this.publish({ saved: false });
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
      const blocked = gesture.pending
        ? "sources"
        : this.awaitingDose && !this.world.regionExact(this.awaitingDose.bounds)
          ? "feedback"
          : null;
      if (blocked) {
        this.discardTime(gesture, fromAt, toAt, blocked);
        accountedTo = toAt;
        this.skipQueued(gesture, blocked);
        return;
      }
      this.awaitingDose = null;
      if (gesture.pressPending) {
        this.discardTime(gesture, fromAt, toAt, "press");
        accountedTo = toAt;
        this.skipQueued(gesture, "press");
        this.acceptPress(gesture);
        return;
      }
      const rawElapsedMs = toAt - fromAt;
      if (rawElapsedMs <= 0) return;
      const points = gesture.points.splice(0);
      const latest = points.reduce<BrushPoint | undefined>(
        (newest, point) => (!newest || point.at >= newest.at ? point : newest),
        undefined,
      );
      for (const entry of points)
        if (entry !== latest) this.skipInput(entry.input, "coalesced");
      const point = latest?.point ?? gesture.point;
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
      const needed = this.doc.readBoundsForPoint(point, gesture.brush);
      if (!this.doc.isReady(needed, HEIGHT_LEVELS.slice(gesture.brush.level))) {
        this.discardTime(gesture, acceptedFrom, toAt, "sources");
        accountedTo = toAt;
        if (latest) this.skipInput(latest.input, "sources");
        this.waitForSources(gesture, point, latest?.at);
        return;
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
    this.skipQueued(gesture, reason, false);
    if (gesture.pressPending) this.skipInput(gesture.id, reason);
    gesture.cancelled = true;
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
        sequence: change.sequence,
        revision: change.revision,
      });
    }
    this.world.redraw();
    this.persist(change);
  }

  private persist(change: ChangeSet): void {
    this.pendingWrites++;
    this.publish({ saved: false });
    const document = this.doc;
    this.writeQueue = this.writeQueue
      .then(async () => {
        const receipt = await this.bridge.commit(change);
        if (document === this.doc) document.acceptPersistence(receipt.sequence);
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
    this.finishGesture(undefined, "save");
    await this.writeQueue;
    const document = this.doc;
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
    this.changingProject = true;
    try {
      this.finishGesture(undefined, "project");
      await this.writeQueue;
      const next = empty
        ? await this.bridge.newProject()
        : await this.bridge.openProject();
      if (next) {
        this.setProject(next);
        await this.loadView();
      }
    } finally {
      this.changingProject = false;
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
        await this.ensure(bounds, 0);
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
            pending: this.gesture.pending,
            queuedPoints: this.gesture.points.length,
            brush: { ...this.gesture.brush },
          }
        : null,
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
    this.finishGesture(undefined, "blur", event);
    this.pan = null;
  };
  private cancel = (event: Event): void => {
    this.finishGesture(undefined, "cancel", event);
    this.pan = null;
  };
  private visibility = (event: Event): void => {
    if (document.visibilityState !== "hidden") return;
    this.finishGesture(undefined, "visibility", event);
    this.pan = null;
  };
  private installEvents(): void {
    this.canvas.addEventListener("pointerdown", this.down);
    this.canvas.addEventListener("pointermove", this.move);
    this.canvas.addEventListener("pointerup", this.up);
    this.canvas.addEventListener("pointercancel", this.cancel);
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
    this.world.destroy();
    this.work?.terminate();
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.cancel);
    this.canvas.removeEventListener("wheel", this.wheel);
    window.removeEventListener("keydown", this.key);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
  }
}
