import type { AtlasDesktop, ProjectInfo } from "./bridge";
import { editorBudgets } from "./budgets";
import {
  clipBounds,
  EditorDocument,
  heightSpacing,
  type Bounds,
  type ChangeSet,
  type HeightBrush,
  type Point,
} from "./model";
import { Observation, type ObservationOptions } from "./observation";
import { WorldRenderer, type Camera } from "./render/WorldRenderer";

export interface EditorState {
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
}
interface Gesture {
  brush: HeightBrush;
  points: BrushPoint[];
  pending: boolean;
  released: boolean;
  cancelled: boolean;
  upInput?: number;
}
interface PendingEdit {
  input: number;
  bounds: Bounds;
  revision: number;
  sequence?: number;
}
const brushBounds = (point: Point, radius: number): Bounds =>
  clipBounds([
    point[0] - radius,
    point[1] - radius,
    point[0] + radius,
    point[1] + radius,
  ]);

export class EditorController {
  readonly observation = new Observation();
  readonly world = new WorldRenderer(this.observation);
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
  private frameRequest = 0;
  private loadRequest = 0;
  private resizeObserver: ResizeObserver;
  private work = new Worker(
    new URL("./render/work.worker.ts", import.meta.url),
    { type: "module" },
  );
  private disposed = false;
  private changingProject = false;
  private pointer: Point = [0, 0];
  private backgroundStats: Record<string, unknown> = { active: false };
  mode: "raise" | "lower" | "pan" = "raise";
  diameter = 80;
  amount = 20;
  state: EditorState = {
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
    this.resizeObserver = new ResizeObserver(() => {
      const bounds = (
        this.canvas.parentElement ?? this.canvas
      ).getBoundingClientRect();
      if (this.world.renderer.canvas)
        this.world.resize(bounds.width, bounds.height);
      if (this.doc) this.scheduleLoad();
    });
    this.world.onError = this.fail;
    this.world.onSubmit = (frame) => {
      const pending: PendingEdit[] = [];
      for (const edit of this.pendingEdits) {
        if (this.world.regionExact(edit.bounds)) {
          this.observation.mark("edit-submit", `${edit.input}.${frame}`, {
            input: edit.input,
            frame,
            sessionId: this.doc.sessionId,
            revision: edit.revision,
            sequence: edit.sequence ?? null,
          });
        } else pending.push(edit);
      }
      this.pendingEdits = pending;
    };
    this.work.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
      if (event.data.sessionId !== this.doc?.sessionId) return;
      const active = event.data.kind !== "finished";
      this.backgroundStats = { ...event.data, active };
      this.observation.event("background", this.backgroundStats);
      if (active !== this.state.background)
        this.publish({ background: active });
    };
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
    this.pendingEdits = [];
    this.navInput = null;
    this.readyNavInput = null;
    this.writeQueue = Promise.resolve();
    this.writeError = null;
    this.backgroundStats = { active: false };
    this.work.postMessage({ cancel: true });
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
    this.state = {
      ...this.state,
      ...change,
      canUndo: this.doc?.canUndo ?? false,
      canRedo: this.doc?.canRedo ?? false,
      scale: this.world.camera.scale,
      sequence: this.doc?.sequence ?? 0,
      level: this.currentBrush().level,
      writing: this.pendingWrites > 0,
    };
    this.onChange(this.state);
  }

  private fail = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    this.observation.event("error", { message });
    this.publish({ error: message, message });
  };

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
    this.diameter = Math.max(8, Math.min(512, diameter));
    this.amount = Math.max(0.1, Math.min(10000, amount));
    this.publish();
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
    this.world.moveCamera(this.clampedCamera(camera));
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

  private async ensure(bounds: Bounds): Promise<void> {
    if (this.doc.isReady(bounds)) return;
    const document = this.doc;
    const reply = await this.bridge.readRegion({
      sessionId: document.sessionId,
      bounds,
    });
    if (this.doc !== document || reply.sessionId !== document.sessionId) return;
    document.acceptCoverage(bounds, reply.tiles, reply.sequence);
    this.world.updateSources(bounds);
    this.observation.event("sources", {
      sessionId: reply.sessionId,
      bounds,
      tiles: reply.tiles.length,
      bytes: reply.tiles.reduce((n, tile) => n + tile.values.byteLength, 0),
    });
  }

  private async loadView(): Promise<void> {
    const token = ++this.loadToken;
    // One display-tile margin allows complete canonical tiles at the viewport edge.
    const bounds = this.world.sourceBounds();
    this.doc.evictConfirmedOutside(bounds);
    this.publish({ loading: !this.doc.isReady(bounds) });
    await this.ensure(bounds);
    if (this.disposed || token !== this.loadToken) return;
    this.world.updateSources(bounds, [], true);
    this.world.refresh();
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
    if (this.doc.isReady(bounds)) {
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
    if (this.gesture || this.writeError || this.changingProject) return;
    const brush = this.currentBrush();
    const point = this.worldPoint(event);
    const bounds = brushBounds(
      point,
      brush.radius + 2 * heightSpacing(brush.level),
    );
    const gesture: Gesture = {
      brush,
      points: [{ point, input }],
      pending: false,
      released: false,
      cancelled: false,
    };
    this.gesture = gesture;
    if (!this.doc.isReady(bounds))
      this.publish({
        message: "Lokale Daten werden geladen; Strich vorgemerkt …",
      });
    this.scheduleGesture();
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
    } else if (this.gesture && !this.gesture.released) {
      const events = event.getCoalescedEvents?.() ?? [];
      for (const e of events.length ? events : [event]) {
        if (this.gesture.points.length >= 512) {
          if (this.gesture.pending) this.cancelPendingGesture();
          else this.finishGesture();
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
        });
      }
      this.scheduleGesture();
    }
  };

  private up = (event: PointerEvent): void => {
    if (this.pan) {
      this.pan = null;
      return;
    }
    if (!this.gesture) return;
    const input = this.observation.input(event, "pointerup");
    this.gesture.released = true;
    this.gesture.upInput = input;
    if (!this.gesture.pending) {
      try {
        this.finishGesture(input);
      } catch (error) {
        this.gestureFailure(error);
      }
    }
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

  private scheduleGesture(): void {
    if (this.frameRequest || this.gesture?.pending) return;
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0;
      try {
        this.flushGesture();
      } catch (error) {
        this.gestureFailure(error);
      }
    });
  }

  private gestureFailure(error: unknown): void {
    if (this.gesture) {
      this.gesture.points = [];
      this.gesture.pending = false;
      this.finishGesture(this.gesture.upInput);
    }
    this.fail(error);
  }

  private flushGesture(): void {
    const gesture = this.gesture;
    if (!gesture || gesture.pending || gesture.cancelled) return;
    while (gesture.points.length) {
      const entry = gesture.points[0];
      const needed = brushBounds(
        entry.point,
        gesture.brush.radius + 2 * heightSpacing(gesture.brush.level),
      );
      if (!this.doc.isReady(needed)) {
        gesture.pending = true;
        void this.ensure(needed)
          .then(() => {
            if (gesture.cancelled || this.gesture !== gesture) return;
            gesture.pending = false;
            this.flushGesture();
            if (gesture.released && !gesture.pending)
              this.finishGesture(gesture.upInput);
          })
          .catch((error: unknown) => {
            if (this.gesture === gesture) {
              gesture.pending = false;
              gesture.points = [];
              if (this.doc.active) this.finishGesture(gesture.upInput);
              else this.gesture = null;
            }
            this.fail(error);
          });
        return;
      }
      if (!this.doc.active) this.doc.beginGesture(gesture.brush);
      gesture.points.shift();
      const bounds = this.doc.applyPoint(entry.point);
      if (!bounds) {
        this.observation.event("noop", { input: entry.input });
        continue;
      }
      this.world.updateSources(bounds);
      this.world.invalidate(bounds);
      this.pendingEdits.push({
        input: entry.input,
        bounds,
        revision: this.doc.revision,
      });
      this.observation.mark("model", String(entry.input), {
        input: entry.input,
        revision: this.doc.revision,
        bounds,
        point: [...entry.point],
        gestureReleased: gesture.released,
      });
    }
    this.publish({ saved: false });
  }

  private finishGesture(input?: number): void {
    if (!this.gesture || this.gesture.pending) return;
    this.flushGesture();
    if (this.gesture.pending) return;
    this.gesture = null;
    if (!this.doc.active) return;
    const change = this.doc.finishGesture();
    if (!change) return;
    if (input !== undefined) {
      for (const bounds of change.dirtyBounds)
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
    // The final revision may already be visible while held. Submit the committed
    // state once more so pointerup is acknowledged by an actual rendered frame.
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
    this.finishGesture();
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
    this.finishGesture();
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
      if (this.gesture?.pending) this.cancelPendingGesture();
      else this.finishGesture();
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

  background(): void {
    if (this.state.background) return;
    const snapshot = this.doc.snapshot(this.world.bounds());
    this.work.postMessage(
      {
        sessionId: this.doc.sessionId,
        tiles: snapshot.tiles,
        bounds: snapshot.bounds,
        milliseconds: 10000,
      },
      snapshot.tiles.map((tile) => tile.values.buffer as ArrayBuffer),
    );
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
            released: this.gesture.released,
            pending: this.gesture.pending,
            queuedPoints: this.gesture.points.length,
            brush: { ...this.gesture.brush },
            upInput: this.gesture.upInput ?? null,
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
      if (this.gesture?.pending) {
        this.cancelPendingGesture();
        this.publish({ message: "Vorgemerkten Strich verworfen" });
      } else this.finishGesture();
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
  private cancelPendingGesture(): void {
    if (!this.gesture) return;
    this.gesture.cancelled = true;
    this.gesture.pending = false;
    this.gesture.points = [];
    if (this.doc.active) this.finishGesture(this.gesture.upInput);
    else this.gesture = null;
  }
  private blur = (): void => {
    if (this.gesture?.pending) this.cancelPendingGesture();
    else this.finishGesture();
    this.pan = null;
  };
  private cancel = (): void => {
    if (this.gesture?.pending) this.cancelPendingGesture();
    else this.finishGesture();
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
  }
  destroy(): void {
    this.disposed = true;
    this.loadToken++;
    cancelAnimationFrame(this.frameRequest);
    cancelAnimationFrame(this.loadRequest);
    this.resizeObserver.disconnect();
    this.world.destroy();
    this.work.terminate();
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.cancel);
    this.canvas.removeEventListener("wheel", this.wheel);
    window.removeEventListener("keydown", this.key);
    window.removeEventListener("blur", this.blur);
  }
}
