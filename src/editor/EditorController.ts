import type {
  AtlasDesktop,
  PreparedDocument,
  ProjectInfo,
  SourceBoundary,
} from "./bridge";
import { editorBudgets } from "./budgets";
import { ComputeJobs, type ComputeHandle } from "./ComputeJobs";
import { WorkerHeightProjectionService } from "./render/HeightProjectionService";
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
  LANDSCAPE_TILE_SIZE,
  LANDSCAPE_BATCH_CELL_LIMIT,
  LANDSCAPE_BATCH_POINT_LIMIT,
  landscapeSegmentCellCost,
  houseBounds,
  houseContainsPoint,
  validateHouseHeader,
  unionBounds,
  type Bounds,
  type HeightBrush,
  type HeightSegment,
  type HouseHeader,
  type LandscapeBrush,
  type LandscapePatch,
  type LandscapeWeights,
  type Point,
} from "./model";
import {
  minimumCoarseHeightLevel,
  projectHeightOverviewPatches,
} from "./model/overview";
import { minimumCoarseLandscapeLevel } from "./model/landscape";
import { Observation, type ObservationOptions } from "./observation";
import {
  WorldRenderer,
  type Camera,
  type RegionFoundation,
  type FrozenRenderReceipt,
} from "./render/WorldRenderer";
import type { BrushEffectReceipt } from "./model/BrushReservations";
import {
  DerivedSurfaceView,
  type SurfaceReadNeed,
  type SurfaceState,
} from "./render/DerivedSurfaceView";

export interface EditorState {
  mode: "raise" | "lower" | "pan" | "forest" | "clearing" | "house" | "select";
  heightMode: "raise" | "lower";
  houseWidth: number;
  houseDepth: number;
  houseRotation: number;
  foundationHeight: number;
  foundationTransition: number;
  selectedHouse: HouseHeader | null;
  landscapeKind: 0 | 1 | 2 | 3;
  landscapeDensity: number;
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
  surfaces: SurfaceState | null;
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
  toolKind: "height" | "landscape" | "house";
  houseBounds: Bounds;
  derived: SurfaceReadNeed | null;
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

interface LandscapeStroke {
  kind: "landscape";
  pointerId: number;
  input: number;
  brush: LandscapeBrush;
  point: Point;
  /** Eligible geometry awaiting atomic materialization, not document changes. */
  path: Point[];
  retainedBounds: Bounds;
  sealed: boolean;
  released: boolean;
}

interface HouseDrag {
  kind: "house";
  pointerId: number;
  anchor: Point;
  original: HouseHeader;
  placement: boolean;
  selectedBefore: string | null;
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
  private brushState: BrushState | LandscapeStroke | HouseDrag = {
    kind: "idle",
  };
  private selectedHouseId: string | null = null;
  private landscapeDemandVersion = 0;
  private landscapeEnabled = false;
  private landscapeMotion: Point = [0, 0];
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
  private contentProbes: { level: number; points: Point[] } | null = null;
  private animation = 0;
  private lastFrameAt = 0;
  private resizeObserver: ResizeObserver;
  private readonly compute = new ComputeJobs();
  private readonly projections = new WorkerHeightProjectionService(
    this.compute,
  );
  private work: Worker | null = null;
  private nextWorkId = 0;
  private backgroundJob: ComputeHandle<void> | null = null;
  private workCompletions = new Map<
    number,
    { resolve(): void; reject(error: unknown): void }
  >();
  private disposed = false;
  private pointer: Point = [0, 0];
  private backgroundStats: Record<string, unknown> = { active: false };
  private backgroundStarting = false;
  state: EditorState = {
    mode: "raise",
    heightMode: "raise",
    houseWidth: 40,
    houseDepth: 30,
    houseRotation: 0,
    foundationHeight: 1,
    foundationTransition: 10,
    selectedHouse: null,
    landscapeKind: 0,
    landscapeDensity: 100,
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
    surfaces: null,
  };
  onChange: (state: EditorState) => void = () => {};

  constructor(
    private canvas: HTMLCanvasElement,
    private bridge: AtlasDesktop,
  ) {
    this.observation = new Observation(bridge.diagnostics);
    this.world = new WorldRenderer(this.observation, this.projections, () => {
      const work = this.compute.metrics();
      return Math.max(
        0,
        work.activeBytes + work.pendingBytes - this.projections.metrics().bytes,
      );
    });
    this.session = new ProjectSession(bridge, {
      changed: () => this.publish(),
      persisted: (receipt) => {
        this.observation.event("persisted", { ...receipt });
        if (this.landscapeEnabled) {
          this.landscapeDemandVersion++;
          this.scheduleLoad();
        }
      },
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
        const id = Number(event.data.id);
        if (event.data.kind === "finished" || event.data.kind === "failed") {
          const completion = this.workCompletions.get(id);
          this.workCompletions.delete(id);
          if (event.data.kind === "failed")
            completion?.reject(new Error(String(event.data.error)));
          else completion?.resolve();
          if (this.disposed && !this.workCompletions.size) {
            this.work?.terminate();
            this.work = null;
          }
        }
        // Slot release precedes session filtering: old cancelled work must ACK
        // even after a new project has replaced its observation context.
        if (
          this.disposed ||
          event.data.sessionId !== this.doc?.sessionId ||
          id !== this.nextWorkId
        )
          return;
        const active =
          event.data.kind !== "finished" && event.data.kind !== "failed";
        this.backgroundStats = { ...event.data, active };
        this.observation.event("background", this.backgroundStats);
        if (active !== this.state.background)
          this.publish({ background: active });
      };
    if (this.work)
      this.work.onerror = (event) => {
        this.work?.terminate();
        this.work = null;
        // An older cancelled run may still occupy a slot while its successor
        // waits. Never drain that successor into this now terminated worker.
        this.backgroundJob?.cancel();
        this.backgroundStats = { active: false, waiting: false };
        this.publish({ background: false });
        const error = new Error(event.message);
        for (const completion of this.workCompletions.values())
          completion.reject(error);
        this.workCompletions.clear();
        this.fail(error);
      };
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
      landscapeEmpty: info.landscapeTiles === 0,
      housesEmpty: info.houses === 0,
      watersEmpty: info.waters === 0,
      maxSourceBytes: editorBudgets.sourceBytes,
      maxPendingBytes: editorBudgets.pendingWriteBytes,
      maxHistoryBytes: editorBudgets.historyBytes,
      maxHistoryActions: editorBudgets.historyActions,
    });
    this.brushState = { kind: "idle" };
    this.selectedHouseId = null;
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
    this.backgroundJob?.cancel();
    this.backgroundJob = null;
    this.projections.setSession(info.sessionId);
    this.compute.cancelAll();
    this.landscapeDemandVersion = 0;
    this.landscapeMotion = [0, 0];
    this.landscapeEnabled = info.landscapeTiles > 0;
    this.world.reset(this.doc, info.landscapeTiles === 0);
    this.world.moveCamera({ x: 0, y: 0, scale: 0.25 });
    this.prepareToolLevel();
    this.world.refresh();
    this.publish({
      title: info.title,
      error: null,
      background: false,
    });
  }

  private get landscapeStroke(): LandscapeStroke | null {
    return this.brushState.kind === "landscape" ? this.brushState : null;
  }

  private get landscapeMode(): boolean {
    return this.mode === "forest" || this.mode === "clearing";
  }

  private get houseMode(): boolean {
    return this.mode === "house" || this.mode === "select";
  }

  private get houseDrag(): HouseDrag | null {
    return this.brushState.kind === "house" ? this.brushState : null;
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
        | "heightMode"
        | "diameter"
        | "amount"
        | "landscapeKind"
        | "landscapeDensity"
        | "houseWidth"
        | "houseDepth"
        | "houseRotation"
        | "foundationHeight"
        | "foundationTransition"
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
      selectedHouse: this.selectedHouseId
        ? (this.doc?.house(this.selectedHouseId) ?? null)
        : null,
      scale: this.world.camera.scale,
      sequence: this.doc?.sequence ?? 0,
      level: this.landscapeMode
        ? this.currentLandscapeBrush().level
        : this.currentBrush().level,
      writing: this.session.writing,
      saved: this.session.saved,
      loading: readiness.reason === "sources" || readiness.reason === "terrain",
      needsPress: this.brushState.kind === "blocked",
      surfaces: this.world.surfaceState(),
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
                    : this.backgroundStats.waiting === true
                      ? "Hintergrundarbeit benötigt freien Darstellungsspeicher"
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
    if (this.doc?.active) this.finishGesture(undefined, "tool-change");
    this.publish({
      mode,
      heightMode:
        mode === "raise" || mode === "lower" ? mode : this.state.heightMode,
      diameter:
        mode === "forest" || mode === "clearing"
          ? Math.min(128, this.diameter)
          : this.diameter,
    });
    if (!this.houseMode) this.selectHouse(null);
    this.updateToolNeed();
  }

  private selectHouse(id: string | null): void {
    this.selectedHouseId = id;
    this.world.selectHouse(id);
    this.publish();
  }

  /** Effective house defaults are also the selected header's editable fields. */
  async setHouseSettings(
    settings: Partial<
      Pick<
        HouseHeader,
        | "width"
        | "depth"
        | "rotation"
        | "foundationHeight"
        | "foundationTransition"
      >
    >,
  ): Promise<void> {
    if (this.doc.active) this.finishGesture(undefined, "settings");
    const selected =
      this.mode === "select" && this.selectedHouseId
        ? this.doc.house(this.selectedHouseId)
        : null;
    const next = { ...(selected ?? this.houseAt([0, 0])), ...settings };
    if (Number.isFinite(next.rotation))
      next.rotation = ((next.rotation % 360) + 360) % 360;
    validateHouseHeader(next);
    if (selected) {
      if (!this.session.editable)
        throw new Error(
          "Das Haus kann während dieses Dateivorgangs nicht geändert werden.",
        );
      const document = this.doc;
      const bounds = unionBounds(houseBounds(selected), houseBounds(next));
      if (!document.isHouseRegionReady(bounds)) {
        const loaded = await this.ensureHouseRegion(document, bounds);
        if (
          !loaded ||
          document !== this.doc ||
          !this.session.editable ||
          this.selectedHouseId !== selected.id ||
          document.house(selected.id) !== selected
        )
          throw new Error(
            "Das gewählte Haus hat sich während des Ladens geändert. Bitte die Einstellung erneut übernehmen.",
          );
      }
      this.doc.beginHouseGesture(selected.id, "Haus ändern");
      try {
        this.doc.updateHouseGesture(next);
        this.doc.finishHouseGesture();
      } catch (error) {
        this.doc.cancelHouseGesture();
        throw error;
      } finally {
        this.world.redraw();
      }
      this.persist();
    }
    this.publish({
      houseWidth: next.width,
      houseDepth: next.depth,
      houseRotation: next.rotation,
      foundationHeight: next.foundationHeight,
      foundationTransition: next.foundationTransition,
    });
    this.updateToolNeed();
  }

  private houseAt(point: Point): HouseHeader {
    return {
      id: "preview",
      revision: 0,
      x: point[0],
      y: point[1],
      width: this.state.houseWidth,
      depth: this.state.houseDepth,
      rotation: this.state.houseRotation,
      foundationHeight: this.state.foundationHeight,
      foundationTransition: this.state.foundationTransition,
    };
  }

  private draggedHouse(point: Point, drag = this.houseDrag): HouseHeader {
    if (!drag) return this.houseAt(point);
    return {
      ...drag.original,
      x: drag.original.x + point[0] - drag.anchor[0],
      y: drag.original.y + point[1] - drag.anchor[1],
    };
  }

  private beginHouseDrag(point: Point, pointerId: number): void {
    const selectedBefore = this.selectedHouseId;
    const placement = this.mode === "house";
    const header = placement
      ? { ...this.houseAt(point), id: crypto.randomUUID() }
      : this.pickedHouse(point);
    this.selectHouse(header?.id ?? null);
    if (!header) return;
    const foundation = this.world.captureFoundation();
    if (!this.world.acceptFoundation(houseBounds(header), foundation))
      throw new Error(
        "Der Hausbereich besitzt keine passende sichtbare Grundlage.",
      );
    this.doc.beginHouseGesture(
      placement ? header : header.id,
      placement ? "Haus platzieren" : "Haus verschieben",
    );
    this.foundation = foundation;
    this.brushState = {
      kind: "house",
      pointerId,
      anchor: [...point],
      original: header,
      placement,
      selectedBefore,
    };
    this.world.redraw();
    this.publish();
  }

  private housePickBounds(point: Point): Bounds {
    return clipBounds([point[0] - 1, point[1] - 1, point[0] + 1, point[1] + 1]);
  }

  private pickedHouse(point: Point): HouseHeader | undefined {
    const bounds = this.housePickBounds(point);
    if (!this.doc?.isHouseRegionReady(bounds)) return undefined;
    return this.doc
      .housesInBounds(bounds)
      .slice()
      .reverse()
      .find((house) => houseContainsPoint(house, point));
  }

  /** Property edits share the same single read slot and stale-response boundary. */
  private async ensureHouseRegion(
    document: EditorDocument,
    bounds: Bounds,
  ): Promise<boolean> {
    while (this.readState.kind === "loading") await this.readState.promise;
    if (document !== this.doc || this.disposed) return false;
    if (document.isHouseRegionReady(bounds)) return true;
    let loaded = false;
    await this.startRead(`house-settings:${document.sessionId}`, async () => {
      loaded = await this.readCurrent(
        document,
        () =>
          this.bridge.readHouseRegion({
            sessionId: document.sessionId,
            bounds,
          }),
        (reply) => {
          document.acceptHouseCoverage(
            bounds,
            reply.headers,
            reply.sequence,
            reply.sessionId,
          );
          this.world.redraw();
        },
      );
    });
    return loaded;
  }

  private moveHouse(point: Point): boolean {
    const drag = this.houseDrag;
    if (!drag) return false;
    const readiness = this.houseReadiness(point);
    if (
      !readiness.ready ||
      !this.foundation ||
      !this.world.acceptFoundation(readiness.bounds, this.foundation)
    ) {
      this.scheduleLoad();
      this.publish({}, readiness);
      return false;
    }
    this.doc.updateHouseGesture(this.draggedHouse(point, drag));
    this.world.redraw();
    this.publish();
    return true;
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

  currentLandscapeBrush(): LandscapeBrush {
    const radius = Math.min(128, this.diameter) / (2 * this.world.camera.scale);
    const weights: LandscapeWeights = [0, 0, 0, 0];
    if (this.mode !== "clearing")
      weights[this.state.landscapeKind] = Math.round(
        this.state.landscapeDensity * 2.55,
      );
    return {
      radius,
      level: Math.max(0, Math.min(24, Math.floor(Math.log2(radius / 8)))),
      weights,
      label: this.mode === "clearing" ? "Lichtung malen" : "Landschaft malen",
    };
  }

  setLandscape(kind: number, density: number): void {
    if (
      !Number.isInteger(kind) ||
      kind < 0 ||
      kind > 3 ||
      !Number.isFinite(density)
    )
      throw new Error("Ungültige Landschaftseinstellung.");
    this.publish({
      landscapeKind: kind as 0 | 1 | 2 | 3,
      landscapeDensity: Math.max(0, Math.min(100, density)),
    });
    this.updateToolNeed();
  }

  setBrush(diameter: number, amount: number): void {
    if (!Number.isFinite(diameter) || !Number.isFinite(amount))
      throw new Error("Pinselgröße und Stärke müssen endliche Zahlen sein.");
    this.publish({
      diameter: Math.max(8, Math.min(this.landscapeMode ? 128 : 512, diameter)),
      amount: Math.max(0.1, Math.min(10000, amount)),
    });
    this.updateToolNeed();
  }

  /** V7 size gestures only change the next height stroke's settings. */
  private resizeHeightBrush(factor: number): void {
    if (this.pan || this.brushState.kind !== "idle") return;
    this.setBrush(Math.round(this.diameter * factor), this.amount);
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
    if (this.stroke || this.landscapeStroke || this.houseDrag) return;
    this.navigate({ x, y, scale }, this.input(event, "navigation"));
  }

  /** Keep a small tile-aligned author neighborhood warm ahead of the pointer. */
  private landscapeReadBounds(local: LocalReadiness): Bounds {
    const span = LANDSCAPE_TILE_SIZE * 2 ** local.brush.level;
    const x = Math.floor(local.point[0] / span),
      y = Math.floor(local.point[1] / span);
    const dx = Math.sign(this.landscapeMotion[0]),
      dy = Math.sign(this.landscapeMotion[1]);
    const neighborhood = clipBounds([
      (x - 1 + Math.min(0, dx)) * span,
      (y - 1 + Math.min(0, dy)) * span,
      (x + 2 + Math.max(0, dx)) * span,
      (y + 2 + Math.max(0, dy)) * span,
    ]);
    return unionBounds(neighborhood, local.bounds);
  }

  /** One current demand, not a queue of camera/hover requests. */
  private scheduleLoad(): void {
    if (!this.doc || this.disposed) return;
    this.prepareToolLevel();
    const local = this.localReadiness();
    const viewGeneration = this.world.state().viewGeneration;
    const power = this.world.presentationPower();
    const bounds = this.world.sourceBounds();
    const derived = this.world.surfaceReadNeed();
    const landscape = this.landscapeStroke || this.landscapeMode;
    const toolBounds = landscape
      ? this.landscapeReadBounds(local)
      : local.bounds;
    const key = [
      this.doc.sessionId,
      this.landscapeDemandVersion,
      this.landscapeMode,
      this.houseMode,
      viewGeneration,
      power,
      ...bounds,
      local.brush.level,
      ...toolBounds,
      ...(this.landscapeStroke?.retainedBounds ?? []),
      derived?.key ?? "",
      derived?.kind ?? "",
      derived?.version ?? "",
      ...(derived?.bounds ?? []),
    ].join(":");
    if (this.desiredNeed?.key === key) return;
    this.desiredNeed = {
      document: this.doc,
      viewGeneration,
      bounds,
      power,
      minLevel: minimumCoarseHeightLevel(power),
      toolBounds,
      toolLevel: local.brush.level,
      toolKind:
        this.houseDrag || this.houseMode
          ? "house"
          : landscape
            ? "landscape"
            : "height",
      houseBounds:
        this.houseMode || this.houseDrag
          ? unionBounds(
              DerivedSurfaceView.houseReadBounds(bounds),
              local.bounds,
            )
          : DerivedSurfaceView.houseReadBounds(bounds),
      derived,
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
      const derived = this.world.surfaceReadNeed();
      const previousDerived = this.desiredNeed?.derived;
      if (
        derived?.key !== previousDerived?.key ||
        derived?.kind !== previousDerived?.kind ||
        derived?.version !== previousDerived?.version ||
        derived?.bounds.join(":") !== previousDerived?.bounds.join(":")
      )
        this.scheduleLoad();
      const read = this.pumpRead();
      if (read) void read.catch(this.fail);
      this.advanceHeldBrush(performance.now());
      this.advanceLandscape();
      this.advanceAction();
      if (this.world.prepareFrame()) this.checkLocalReady();
      if (this.state.surfaces !== this.world.surfaceState()) this.publish();
      this.freezeBrushRender();
      const submission = this.world.renderFrame(now);
      if (submission) {
        this.observation.submitted(submission, (bounds, revision) =>
          this.world.inspectSubmittedRegion(bounds, revision),
        );
        this.releaseCompletedEffect();
        this.checkLocalReady();
      }
    } catch (error) {
      this.fail(error);
    } finally {
      this.world.finishFrame();
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
      // A permanently failed fence must not keep an already painted landscape
      // behind its action/Save barrier. Reset retains the GPU's in-flight field.
      if (this.landscapeStroke) this.gestureFailure(error);
      else this.fail(error);
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
    const landscapePresentation = !this.world.isLandscapePresentationReady(
      bounds,
      power,
    );
    const presentation =
      !document.isReady(bounds, HEIGHT_LEVELS.slice(minLevel)) ||
      !this.world.isHeightPresentationReady(bounds, power);
    const tool =
      need.toolKind === "landscape"
        ? !document.isLandscapeReady(need.toolBounds, need.toolLevel)
        : need.toolKind === "house"
          ? false
          : !document.isReady(
              need.toolBounds,
              HEIGHT_LEVELS.slice(need.toolLevel),
            );
    const houses = !document.isHouseRegionReady(need.houseBounds);
    const waters = !document.isWaterRegionReady(bounds);
    if (
      !presentation &&
      !landscapePresentation &&
      !tool &&
      !houses &&
      !waters &&
      !need.derived
    ) {
      this.readState = { kind: "ready", key: need.key };
      return null;
    }
    const key = `${need.key}:${presentation ? "presentation" : landscapePresentation ? "landscape-presentation" : tool ? "tool" : houses ? "houses" : waters ? "waters" : "derived"}`;
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
              document.active ? (this.foundation ?? undefined) : undefined,
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
      } else if (landscapePresentation) {
        await this.readCurrent(
          document,
          () =>
            this.bridge.readLandscapePresentation({
              sessionId: document.sessionId,
              bounds,
              power,
            }),
          (reply) => {
            document.acceptLandscapeCoverage(
              bounds,
              reply.tiles,
              reply.sequence,
              reply.sessionId,
              minimumCoarseLandscapeLevel(power),
            );
            this.world.updateLandscapePresentation(reply);
          },
          viewGeneration,
        );
      } else if (tool && need.toolKind === "landscape") {
        await this.readCurrent(
          document,
          () =>
            this.bridge.readLandscapeRegion({
              sessionId: document.sessionId,
              bounds: need.toolBounds,
              minLevel: need.toolLevel,
            }),
          (reply) =>
            document.acceptLandscapeCoverage(
              need.toolBounds,
              reply.tiles,
              reply.sequence,
              reply.sessionId,
              need.toolLevel,
            ),
          viewGeneration,
        );
      } else if (tool) {
        await this.readRegion(
          document,
          need.toolBounds,
          need.toolLevel,
          viewGeneration,
        );
      } else if (houses) {
        await this.readCurrent(
          document,
          () =>
            this.bridge.readHouseRegion({
              sessionId: document.sessionId,
              bounds: need.houseBounds,
            }),
          (reply) => {
            document.acceptHouseCoverage(
              need.houseBounds,
              reply.headers,
              reply.sequence,
              reply.sessionId,
            );
            this.world.redraw();
            this.observation.event("house-sources", {
              sessionId: reply.sessionId,
              bounds: need.houseBounds,
              headers: reply.headers.length,
            });
          },
          viewGeneration,
        );
      } else if (waters) {
        await this.readWaterRegion(document, bounds, viewGeneration);
      } else if (need.derived) {
        const derived = need.derived;
        try {
          if (derived.kind === "water")
            await this.readWaterRegion(
              document,
              derived.bounds,
              viewGeneration,
            );
          else
            await this.readRegion(document, derived.bounds, 0, viewGeneration);
        } catch (error) {
          if (this.currentView(document, viewGeneration))
            this.world.surfaceReadFailed(derived, error);
        }
      }
      if (document === this.doc && !this.disposed) {
        this.retainViewSources();
        this.checkLocalReady();
        // A newly loaded partial house can reveal a larger selected owner.
        // Refresh that demand even while the pointer remains stationary.
        this.scheduleLoad();
      }
    });
  }

  private readWaterRegion(
    document: EditorDocument,
    bounds: Bounds,
    viewGeneration: number,
  ): Promise<boolean> {
    return this.readCurrent(
      document,
      () =>
        this.bridge.readWaterRegion({ sessionId: document.sessionId, bounds }),
      (reply) => {
        document.acceptWaterCoverage(
          bounds,
          reply.sources,
          reply.sequence,
          reply.sessionId,
        );
        this.world.redraw();
        this.observation.event("water-sources", {
          sessionId: reply.sessionId,
          bounds,
          sources: reply.sources.length,
        });
      },
      viewGeneration,
    );
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
    const derivedBounds = this.world.surfaceRetainHeight();
    const fineBounds = derivedBounds
      ? need.toolKind === "height"
        ? unionBounds(derivedBounds, need.toolBounds)
        : derivedBounds
      : need.toolKind === "height"
        ? need.toolBounds
        : null;
    this.world.forgetSources(
      this.doc.retainSources([
        { bounds: need.bounds, minLevel: need.minLevel },
        ...(fineBounds
          ? [
              {
                bounds: fineBounds,
                minLevel: derivedBounds ? 0 : need.toolLevel,
              },
            ]
          : []),
      ]),
    );
    this.doc.retainLandscapeSources([
      {
        bounds: need.bounds,
        minLevel: minimumCoarseLandscapeLevel(need.power),
      },
      ...(need.toolKind === "landscape"
        ? [
            {
              bounds: this.landscapeStroke
                ? unionBounds(
                    need.toolBounds,
                    this.landscapeStroke.retainedBounds,
                  )
                : need.toolBounds,
              minLevel: need.toolLevel,
            },
          ]
        : []),
    ]);
    this.doc.retainHouseSources([need.houseBounds]);
    const retainedWater = this.world.surfaceRetainWater();
    this.doc.retainWaterSources([need.bounds, ...retainedWater.slice(1)]);
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
    if (this.houseDrag || this.houseMode) return this.houseReadiness(point);
    if (this.landscapeStroke || (!this.stroke && this.landscapeMode))
      return this.landscapeReadiness(point);
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

  private houseReadiness(point = this.toolPoint()): LocalReadiness {
    const view = this.world.bounds();
    let bounds = this.housePickBounds(point);
    let valid =
      point.every((value) => Number.isFinite(value)) &&
      point[0] >= view[0] &&
      point[0] <= view[2] &&
      point[1] >= view[1] &&
      point[1] <= view[3];
    if (this.mode === "house" || this.houseDrag) {
      const header = this.draggedHouse(point);
      try {
        validateHouseHeader(header);
      } catch {
        valid = false;
      }
      bounds = clipBounds(houseBounds(header));
    } else if (this.mode === "select" && valid) {
      const picked = this.pickedHouse(point);
      if (picked) bounds = houseBounds(picked);
    }
    const sourcesReady = Boolean(valid && this.doc?.isHouseRegionReady(bounds));
    // A visible part can select a larger owner. Its complete header region is
    // read through the same slot; offscreen terrain is not needed to move it.
    const visibleBounds: Bounds = [
      Math.max(bounds[0], view[0]),
      Math.max(bounds[1], view[1]),
      Math.min(bounds[2], view[2]),
      Math.min(bounds[3], view[3]),
    ];
    const displayBounds = valid ? visibleBounds : bounds;
    // A house's own pending foundation colour does not revoke the completed
    // surface on which its gesture was admitted. Source/view guards stay shared.
    const display =
      this.houseDrag && this.foundation
        ? this.world.inspectFoundation(displayBounds, this.foundation)
        : this.world.inspectRegion(displayBounds);
    const reason = !valid
      ? "outside"
      : !this.session.editable
        ? "busy"
        : !sourcesReady
          ? "sources"
          : display.status !== "current"
            ? "terrain"
            : null;
    return {
      ready: reason === null,
      sourcesReady,
      reason,
      bounds,
      point,
      brush: this.currentBrush(),
      frame: display.frame,
      viewGeneration: display.viewGeneration,
    };
  }

  private landscapeReadiness(
    point = this.toolPoint(),
    from = this.landscapeStroke?.point ?? point,
  ): LocalReadiness {
    const brush = this.landscapeStroke?.brush ?? this.currentLandscapeBrush();
    const bounds = clipBounds([
      Math.min(from[0], point[0]) - brush.radius,
      Math.min(from[1], point[1]) - brush.radius,
      Math.max(from[0], point[0]) + brush.radius,
      Math.max(from[1], point[1]) + brush.radius,
    ]);
    const view = this.world.bounds();
    const visible = [from, point].every(
      (candidate) =>
        candidate.every(
          (v) => Number.isFinite(v) && Math.abs(v) <= 100_000_000,
        ) &&
        Math.hypot(
          Math.max(view[0] - candidate[0], 0, candidate[0] - view[2]),
          Math.max(view[1] - candidate[1], 0, candidate[1] - view[3]),
        ) < brush.radius,
    );
    const sourcesReady = Boolean(
      this.doc?.isLandscapeReady(bounds, brush.level),
    );
    const display =
      this.landscapeStroke && this.foundation
        ? this.world.inspectFoundation(bounds, this.foundation)
        : this.world.inspectRegion(bounds);
    const reason = !visible
      ? "outside"
      : !sourcesReady
        ? "sources"
        : display.status !== "current" ||
            !this.world.isLandscapePresentationReady(bounds)
          ? "terrain"
          : !this.session.editable || this.landscapeStroke?.sealed
            ? "busy"
            : null;
    return {
      ready: reason === null,
      sourcesReady,
      reason,
      bounds,
      point,
      brush: { ...brush, amount: 0 },
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
        this.world.redrawCursor();
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
    if (this.world.cursor && !this.actionStroke && !this.landscapeStroke)
      this.world.cursor.radius = this.houseMode ? 4 : this.diameter / 2;
    this.checkLocalReady();
    this.scheduleLoad();
    this.world.redrawCursor();
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
    this.world.retryPreparation();
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
    if (this.landscapeMode) {
      try {
        const landscapeBrush = this.currentLandscapeBrush();
        this.foundation = this.world.captureFoundation();
        if (!this.world.acceptFoundation(readiness.bounds, this.foundation))
          throw new Error(
            "Der Landschaftsbereich besitzt keine passende sichtbare Grundlage.",
          );
        this.doc.beginLandscapeGesture(landscapeBrush);
        this.brushState = {
          kind: "landscape",
          pointerId: event.pointerId,
          input,
          brush: landscapeBrush,
          point,
          path: [point],
          retainedBounds: [...readiness.bounds],
          sealed: false,
          released: false,
        };
        this.publish({ error: null });
        this.scheduleLoad();
      } catch (error) {
        this.gestureFailure(error);
      }
      this.checkLocalReady();
      return;
    }
    if (this.houseMode) {
      try {
        this.beginHouseDrag(point, event.pointerId);
      } catch (error) {
        this.gestureFailure(error);
      }
      this.checkLocalReady();
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
    const point = this.worldPoint(event, rect);
    const motion: Point = [
      point[0] - this.pointer[0],
      point[1] - this.pointer[1],
    ];
    if (motion[0] !== 0 || motion[1] !== 0) this.landscapeMotion = motion;
    this.pointer = point;
    this.world.cursor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      radius: this.stroke
        ? this.stroke.brush.radius * this.world.camera.scale
        : this.landscapeStroke
          ? this.landscapeStroke.brush.radius * this.world.camera.scale
          : this.houseMode
            ? 4
            : this.diameter / 2,
    };
    this.world.redrawCursor();
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
    } else if (this.houseDrag) {
      if (event.pointerId !== this.houseDrag.pointerId) return;
      try {
        this.moveHouse(this.pointer);
      } catch (error) {
        this.gestureFailure(error);
      }
    } else if (this.landscapeStroke) {
      const stroke = this.landscapeStroke;
      if (stroke.sealed || event.pointerId !== stroke.pointerId) return;
      try {
        const coalesced = event.getCoalescedEvents?.() ?? [];
        const samples = [...coalesced, event];
        const rect = this.canvas.getBoundingClientRect();
        for (const sample of samples)
          if (!this.acceptLandscapePoint(this.worldPoint(sample, rect))) break;
        this.scheduleLoad();
      } catch (error) {
        this.gestureFailure(error);
      }
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
    if (
      state.kind === "active" ||
      state.kind === "landscape" ||
      state.kind === "house"
    ) {
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
    if (event.altKey && (this.mode === "raise" || this.mode === "lower")) {
      this.resizeHeightBrush(event.deltaY < 0 ? 1.1 : 1 / 1.1);
      return;
    }
    if (this.stroke || this.landscapeStroke || this.houseDrag) return;
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
    this.recordContentProbes(
      "admission",
      admission.toAt,
      admission.admissionId,
    );
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
    if (result.applications.length || result.complete)
      this.recordContentProbes(result.complete ? "complete" : "materialize");
    if (projectionError) {
      this.finishGesture(undefined, "projection-error");
      this.world.reset(this.doc, !this.landscapeEnabled);
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
        (bounds, revision) =>
          this.world.inspectSubmittedRegion(bounds, revision),
      );
    else if (state.input !== undefined)
      this.skipInput(state.input, "no-change");
    this.brushState =
      state.blockedPointerId === null
        ? { kind: "idle" }
        : { kind: "blocked", pointerId: state.blockedPointerId };
    this.foundation = null;
    this.updateToolNeed();
    this.persist();
  }

  private landscapeChanged(
    bounds: Bounds,
    sequence?: number,
    patches?: readonly LandscapePatch[],
  ): void {
    this.landscapeEnabled = true;
    this.world.updateLandscape(bounds, sequence, patches);
    this.landscapeDemandVersion++;
    this.scheduleLoad();
  }

  /** Stop before an unavailable point; only eligible geometry may still drain. */
  private stopLandscapeInput(message: string): void {
    const stroke = this.landscapeStroke;
    if (!stroke || stroke.sealed) return;
    stroke.sealed = true;
    this.doc.sealLandscapeGesture();
    this.publish({ error: message });
    this.scheduleLoad();
  }

  /** Queue eligible geometry while its displayed foundation and sources are current. */
  private acceptLandscapePoint(point: Point, terminal = false): boolean {
    const stroke = this.landscapeStroke;
    if (!stroke || stroke.sealed) return false;
    const from = stroke.path.at(-1) ?? stroke.point;
    if (point[0] === from[0] && point[1] === from[1]) return true;
    const ready = this.landscapeReadiness(point, from);
    if (
      !ready.ready ||
      !this.foundation ||
      !this.world.acceptFoundation(ready.bounds, this.foundation)
    ) {
      this.stopLandscapeInput(
        "Der nächste Landschaftsbereich ist noch nicht bereit. Der bisherige Strich bleibt erhalten; nach dem Laden neu ansetzen.",
      );
      return false;
    }
    // Exactly collinear forward segments have the same capsule union. Preserve
    // every corner/reversal and the endpoint without retaining redundant events.
    const previous = stroke.path.at(-2) ?? stroke.point;
    const ax = from[0] - previous[0],
      ay = from[1] - previous[1],
      bx = point[0] - from[0],
      by = point[1] - from[1];
    const extendsLine =
      stroke.path.length > 0 &&
      ax * by === ay * bx &&
      ax * bx + ay * by >= 0 &&
      // A merged diagonal has a wider rectangular source requirement than its
      // short pieces. Keep those pieces when only their local corridor is ready.
      this.doc.isLandscapeReady(
        clipBounds([
          Math.min(previous[0], point[0]) - stroke.brush.radius,
          Math.min(previous[1], point[1]) - stroke.brush.radius,
          Math.max(previous[0], point[0]) + stroke.brush.radius,
          Math.max(previous[1], point[1]) + stroke.brush.radius,
        ]),
        stroke.brush.level,
      );
    if (extendsLine) stroke.path[stroke.path.length - 1] = point;
    else {
      if (stroke.path.length >= MAX_BRUSH_POINTS - (terminal ? 0 : 1)) {
        this.stopLandscapeInput(
          "Der Pinsel hat seine Arbeitsgrenze erreicht. Der bisherige Strich bleibt erhalten; bitte loslassen und neu ansetzen.",
        );
        return false;
      }
      stroke.path.push(point);
    }
    stroke.retainedBounds = [
      Math.min(stroke.retainedBounds[0], ready.bounds[0]),
      Math.min(stroke.retainedBounds[1], ready.bounds[1]),
      Math.max(stroke.retainedBounds[2], ready.bounds[2]),
      Math.max(stroke.retainedBounds[3], ready.bounds[3]),
    ];
    return true;
  }

  /** One bounded atomic batch per RAF, independent of the pointer event rate. */
  private advanceLandscape(): void {
    const stroke = this.landscapeStroke;
    if (!stroke) return;
    try {
      if (stroke.path.length) {
        const points: Point[] = [stroke.point];
        let consumed = 0,
          cells = 0;
        while (
          consumed < stroke.path.length &&
          points.length <= LANDSCAPE_BATCH_POINT_LIMIT
        ) {
          const from = points.at(-1)!;
          const target = stroke.path[consumed];
          const cost = landscapeSegmentCellCost(stroke.brush, from, target);
          if (cells + cost > LANDSCAPE_BATCH_CELL_LIMIT) {
            if (points.length > 1) break;
            // A long jump remains the same straight segment, spread across
            // bounded materializations; its true endpoint stays in the path.
            let fraction = 0.5;
            let part: Point = from;
            do {
              part = [
                from[0] + (target[0] - from[0]) * fraction,
                from[1] + (target[1] - from[1]) * fraction,
              ];
              fraction /= 2;
            } while (
              fraction > Number.EPSILON &&
              landscapeSegmentCellCost(stroke.brush, from, part) >
                LANDSCAPE_BATCH_CELL_LIMIT
            );
            if (
              (part[0] === from[0] && part[1] === from[1]) ||
              landscapeSegmentCellCost(stroke.brush, from, part) >
                LANDSCAPE_BATCH_CELL_LIMIT
            )
              throw new Error(
                "Der Landschaftspinsel überschreitet die Arbeitsgrenze.",
              );
            points.push(part);
            break;
          }
          points.push(target);
          cells += cost;
          consumed++;
        }
        const update = this.doc.applyLandscapeSegments(points);
        stroke.point = points.at(-1)!;
        stroke.path.splice(0, consumed);
        if (update)
          this.landscapeChanged(update.bounds, undefined, update.patches);
      }
      if (stroke.sealed && !stroke.path.length) this.completeLandscape();
    } catch (error) {
      this.gestureFailure(error);
    }
  }

  /** Document acceptance precedes projection and persistence; neither may undo it. */
  private completeLandscape(): void {
    const stroke = this.landscapeStroke;
    if (!stroke) return;
    const change = this.doc.finishLandscapeGesture();
    this.brushState = stroke.released
      ? { kind: "idle" }
      : { kind: "blocked", pointerId: stroke.pointerId };
    this.foundation = null;
    try {
      if (change)
        for (const bounds of change.dirtyBounds)
          this.landscapeChanged(bounds, change.sequence, []);
    } finally {
      this.persist();
      this.updateToolNeed();
    }
  }

  private gestureFailure(error: unknown): void {
    if (this.landscapeStroke) {
      // A failed atomic batch changed nothing. Earlier materialized batches
      // remain canonical; unmaterialized geometry must never replay later.
      this.landscapeStroke.path = [];
      this.landscapeStroke.sealed = true;
      this.doc.sealLandscapeGesture();
      try {
        this.completeLandscape();
      } catch {
        // completeLandscape persists in finally even if projection failed.
      }
      this.world.reset(this.doc, !this.landscapeEnabled);
      this.world.refresh();
      this.desiredNeed = null;
      this.scheduleLoad();
    } else this.finishGesture(undefined, "error");
    this.fail(error);
  }

  private finishGesture(
    input?: number,
    reason = "end",
    event?: Event,
    released = false,
  ): void {
    const house = this.houseDrag;
    if (house) {
      let cancelled = [
        "escape",
        "blur",
        "cancel",
        "visibility",
        "navigation",
        "resize",
        "destroy",
        "error",
        "tool-change",
        "render-context",
      ].includes(reason);
      if (!cancelled && reason === "pointerup" && event) {
        try {
          if (!this.moveHouse(this.worldPoint(event as PointerEvent))) {
            cancelled = true;
            this.fail(
              new Error(
                "Hausbewegung abgebrochen: Der Zielbereich ist noch nicht bereit oder liegt außerhalb der sichtbaren Karte.",
              ),
            );
          }
        } catch (error) {
          cancelled = true;
          this.fail(error);
        }
      }
      if (cancelled) this.doc.cancelHouseGesture();
      else this.doc.finishHouseGesture();
      this.brushState = released
        ? { kind: "idle" }
        : { kind: "blocked", pointerId: house.pointerId };
      this.foundation = null;
      if (cancelled && house.placement) this.selectHouse(house.selectedBefore);
      this.world.redraw();
      if (!cancelled) this.persist();
      this.updateToolNeed();
      return;
    }
    const landscape = this.landscapeStroke;
    if (landscape) {
      if (released) landscape.released = true;
      if (reason === "escape" && !landscape.sealed) {
        const update = this.doc.cancelLandscapeGesture();
        this.brushState = released
          ? { kind: "idle" }
          : { kind: "blocked", pointerId: landscape.pointerId };
        this.foundation = null;
        if (update)
          this.landscapeChanged(update.bounds, undefined, update.patches);
      } else if (reason === "destroy" || reason === "error") {
        // Destruction has no future RAF. Keep its materialized document prefix;
        // native close/project replacement normally use the full action barrier.
        landscape.path = [];
        landscape.sealed = true;
        this.doc.sealLandscapeGesture();
        this.completeLandscape();
      } else if (!landscape.sealed) {
        if (reason === "pointerup" && event) {
          try {
            this.acceptLandscapePoint(
              this.worldPoint(event as PointerEvent),
              true,
            );
          } catch (error) {
            this.gestureFailure(error);
            return;
          }
        }
        landscape.sealed = true;
        this.doc.sealLandscapeGesture();
        this.scheduleLoad();
      }
      this.publish();
      return;
    }
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
      this.recordContentProbes(redo ? "redo" : "undo");
      // A broad history region can contain evicted, unchanged fine sources.
      // Transfer the authoritative changed tiles without reloading that region.
      const height = change.patches.filter((patch) => patch.kind === "height");
      const landscape = change.patches.filter(
        (patch) => patch.kind === "landscape",
      );
      if (
        change.patches.some(
          (patch) => patch.kind === "house" || patch.kind === "water",
        )
      ) {
        this.world.redraw();
        this.scheduleLoad();
      }
      if (height.length) this.world.updateSourcePatches(height);
      for (const bounds of change.dirtyBounds) {
        if (landscape.length)
          this.landscapeChanged(bounds, change.sequence, landscape);
        if (height.length) this.world.invalidate(bounds);
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
  async openWaterScene(): Promise<void> {
    await this.changeProject(true, "water");
  }
  retrySurfaces(): void {
    this.world.retryPreparation();
    this.scheduleLoad();
    this.publish();
  }
  private async changeProject(
    empty: boolean,
    template?: "water",
  ): Promise<void> {
    if (this.session.changingProject) return;
    try {
      await this.prepareFileAction();
      const next = await this.session.changeProject(empty, template);
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
      // A conservative preflight reserves the complete resident source upper
      // bound before snapshot() creates copies. Diagnostic work may wait; it
      // never competes for the reserve needed to finish an accepted gesture.
      if (
        document.metrics.sourceBytes >
        editorBudgets.presentationBytes - this.world.state().presentationBytes
      ) {
        this.backgroundStats = { active: false, waiting: true };
        this.publish();
        return;
      }
      const snapshot = document.snapshot(bounds);
      this.backgroundStats = { active: false, waiting: false };
      const bytes = snapshot.tiles.reduce(
        (sum, tile) => sum + tile.values.byteLength,
        0,
      );
      const worker = this.work;
      const id = ++this.nextWorkId;
      const job = this.compute.request(
        "background",
        "background",
        bytes,
        () => {
          const ended = new Promise<void>((resolve, reject) => {
            this.workCompletions.set(id, { resolve, reject });
          });
          try {
            worker.postMessage(
              {
                id,
                sessionId: document.sessionId,
                tiles: snapshot.tiles,
                bounds: snapshot.bounds,
                milliseconds: 10000,
              },
              snapshot.tiles.map((tile) => tile.values.buffer as ArrayBuffer),
            );
          } catch (error) {
            this.workCompletions.get(id)?.reject(error);
            this.workCompletions.delete(id);
          }
          return {
            ended,
            cancel: () => worker.postMessage({ cancel: true, id }),
          };
        },
      );
      this.backgroundJob = job;
      void job.result.then(
        () => {
          if (this.backgroundJob === job) {
            this.backgroundJob = null;
            if (document === this.doc && !this.disposed)
              this.publish({ background: false });
          }
        },
        (error) => {
          if (document === this.doc && !this.disposed) this.fail(error);
        },
      );
      this.publish({ background: true });
    } finally {
      this.backgroundStarting = false;
    }
  }

  /** Configure bounded evidence only; this does not prepare sources or change readiness. */
  configureContentProbes(probes: { level: number; points: Point[] } | null) {
    if (!this.observation.enabled)
      throw new Error(
        "Autorenproben benötigen den ausdrücklichen Diagnosemodus.",
      );
    if (this.doc.active)
      throw new Error("Autorenproben vor der Geste festlegen.");
    if (probes) {
      this.doc.observeBrushCoefficients(probes.level, probes.points);
      this.contentProbes = {
        level: probes.level,
        points: probes.points.map((point) => [...point]),
      };
    } else this.contentProbes = null;
    return this.contentProbes
      ? this.doc.observeBrushCoefficients(
          this.contentProbes.level,
          this.contentProbes.points,
        )
      : null;
  }

  private recordContentProbes(
    phase: string,
    clock?: number,
    admissionId?: number,
  ): void {
    if (!this.contentProbes || !this.observation.enabled) return;
    const startedAt = performance.now();
    const sampled = this.doc.observeBrushCoefficients(
      this.contentProbes.level,
      this.contentProbes.points,
    );
    this.observation.event("brush-content", {
      phase,
      clock,
      admissionId,
      sessionId: this.doc.sessionId,
      gestureId: this.doc.brushWork?.context.gestureId,
      level: this.contentProbes.level,
      revision: this.doc.revision,
      ...sampled,
      cpuMs: performance.now() - startedAt,
    });
  }

  observe(points: Point[] = [], options: ObservationOptions = {}) {
    const path = options.readinessPath;
    if (path && (!path.length || path.length > 512))
      throw new RangeError("Beobachteter Pinselweg benötigt 1 bis 512 Punkte.");
    const pathBrush = path ? this.currentBrush() : null;
    const pathRegions = path?.map((point, index) =>
      heightBrushReadBounds(pathBrush!, path[Math.max(0, index - 1)], point),
    );
    const pathReadiness = pathRegions?.map((bounds) => ({
      sourcesReady: this.doc.isReady(
        bounds,
        HEIGHT_LEVELS.slice(pathBrush!.level),
      ),
      terrain: this.world.inspectRegion(bounds).status,
    }));
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
      pathReadiness: pathReadiness
        ? {
            ready: pathReadiness.every(
              (region) => region.sourcesReady && region.terrain === "current",
            ),
            regions: pathReadiness,
          }
        : null,
      renderer: this.world.state(),
      surfaces: {
        ...this.world.surfaceState(),
        points: points.map((point, i) =>
          this.world.surfaceSample(point, samples[i]),
        ),
      },
      houses: {
        ready: this.doc?.isHouseRegionReady(this.world.bounds()) ?? false,
        selectedId: this.selectedHouseId,
        headers: this.doc?.isHouseRegionReady(this.world.bounds())
          ? this.doc
              .housesInBounds(this.world.bounds())
              .map((header) => ({ ...header }))
          : [],
      },
      background: { ...this.backgroundStats },
      compute: this.compute.metrics(),
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
      landscape: points.map(([x, y]) => {
        try {
          return this.doc.sampleLandscape(x, y);
        } catch {
          return null;
        }
      }),
      landscapeDisplay: points.map((point) =>
        this.world.sampleLandscapeDisplay(point),
      ),
      contentProbes: this.contentProbes
        ? this.doc.observeBrushCoefficients(
            this.contentProbes.level,
            this.contentProbes.points,
          )
        : null,
      eventCount: this.observation.eventCount,
      lastInputId: this.inputId,
      events: this.observation.read(options),
      droppedEvents: this.observation.dropped,
      timeOrigin: performance.timeOrigin,
    };
  }

  private key = (event: KeyboardEvent): void => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement
    )
      return;
    if (
      (this.mode === "raise" || this.mode === "lower") &&
      !(event.ctrlKey && !event.getModifierState("AltGraph")) &&
      !event.metaKey &&
      (event.key === "[" || event.key === "]")
    ) {
      event.preventDefault();
      this.resizeHeightBrush(event.key === "]" ? 1.1 : 1 / 1.1);
      return;
    }
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
    else if (this.landscapeStroke) this.landscapeStroke.released = true;
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
    this.backgroundJob?.cancel();
    this.projections.dispose();
    this.compute.dispose();
    // Let cooperative cancellation acknowledge actual completion before the
    // shared admission drops a slot. No new work is accepted after disposal.
    if (!this.workCompletions.size) this.work?.terminate();
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
