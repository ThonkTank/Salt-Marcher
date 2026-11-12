import { Container, Graphics, WebGLRenderer } from "pixi.js";
// Pixi's static uniform-sync implementation works with the strict desktop CSP.
import "pixi.js/unsafe-eval";
import { editorBudgets } from "../budgets";
import {
  clipBounds,
  HEIGHT_LEVELS,
  heightSpacing,
  heightTileSupport,
  intersectsBounds,
  type Bounds,
  type EditorDocument,
  type HeightPatch,
  type HeightTile,
  type Point,
  type LandscapeWeights,
  type LandscapePatch,
} from "../model";
import {
  HEIGHT_OVERVIEW_BYTES,
  HEIGHT_OVERVIEW_SIZE,
  applyPreparedHeightOverviewDelta,
  createHeightOverviewTile,
  heightOverviewBounds,
  heightOverviewKeys,
  minimumCoarseHeightLevel,
  parseHeightOverviewKey,
  prepareHeightOverviewDelta,
  type HeightOverviewDelta,
  type HeightOverviewTile,
} from "../model/overview";
import { LandscapeView, type LandscapeFrame } from "./LandscapeView";
import type { LandscapePresentationRead } from "../model/landscape";
import { Observation } from "../observation";
import type { HeightProjectionService } from "./HeightProjectionService";
import { CursorOverlay } from "./CursorOverlay";
import { HouseView } from "./HouseView";
import {
  DerivedSurfaceView,
  type SurfaceFrame,
  type SurfaceReadNeed,
} from "./DerivedSurfaceView";
import {
  HeightField,
  type HeightCompositionStats,
  type HeightFieldTile,
} from "./HeightField";

export interface Camera {
  x: number;
  y: number;
  scale: number;
}
/** An actual draw submission; it does not certify native presentation. */
export interface FrameSubmission {
  sessionId: string;
  frame: number;
  viewGeneration: number;
  revision: number;
  exactRevision: number;
  at: number;
  uploadedBytes: number;
}

export interface RegionInspection {
  status: "outside" | "missing" | "stale" | "current";
  sessionId: string;
  frame: number;
  viewGeneration: number;
}

/** A bounded proof of the actually completed local foundation of one gesture. */
export interface RegionFoundation {
  readonly id: number;
  readonly sessionId: string;
  readonly viewGeneration: number;
  readonly preparationId: number;
}

/** Identity of one immutable source/overview group, not a physical presentation. */
export interface FrozenRenderReceipt extends RegionFoundation {
  readonly revision: number;
  readonly bounds: readonly Bounds[];
}

interface FrozenTarget {
  tile: DisplayTile;
  revision: number;
  contentVersion: number;
  preparation: number;
  dirty: Rect | null;
  painted: boolean;
}

interface FrozenRender {
  kind: "local" | "background";
  receipt: FrozenRenderReceipt;
  targets: FrozenTarget[];
  overviews: Map<string, HeightOverviewTile>;
  landscapes: Map<string, LandscapeFrame | null>;
  surfaces: Map<string, SurfaceFrame | null>;
}

interface GpuSubmission {
  kind: "terrain" | "scene";
  sync: WebGLSync;
  field: HeightField;
  submission: FrameSubmission | null;
  tiles: { tile: DisplayTile; revision: number; preparation: number }[];
  renderReceipt: FrozenRenderReceipt | null;
  /** Diagnostic feedback delay; never changes the submitted commands. */
  notBefore: number;
}

interface QueuedSource {
  before: HeightTile | null;
  after: HeightTile | null;
  local: boolean;
  foreign: boolean;
  /** Latest complete local snapshot; reads may return an identical owned state. */
  localCandidate?: HeightTile | null;
  /** A controller read rebased through the active document's pinned sources. */
  trustedFoundation?: RegionFoundation;
  bounds: Bounds;
}

interface OverviewPlan {
  base: HeightOverviewTile | null;
  deltas: Map<string, HeightPatch>;
}

interface QueuedOverview extends OverviewPlan {
  replacement: boolean;
  trustedFoundation?: RegionFoundation;
  localCandidate?: OverviewPlan;
  version: number;
  bounds: Bounds;
}

interface OverviewResult {
  tile: HeightOverviewTile | null;
  changed: boolean;
  foreign?: boolean;
}

interface OverviewWork {
  key: string;
  request: QueuedOverview;
  version: number;
  buffers: Set<ArrayBufferLike>;
  steps: Generator<void, OverviewResult, void>;
}

interface FoundationTile {
  version: number;
  /** 128×128 bits; all 96 retained tiles use at most 192 KiB. */
  pixels: Uint32Array;
}

type Rect = [number, number, number, number];
interface DisplayTile {
  key: string;
  bounds: Bounds;
  power: number;
  revision: number;
  dirty: Rect | null;
  preparedRevision: number;
  preparedIntent: number;
  preparedContentVersion: number;
  paintedRevision: number;
  submittedRevision: number;
  submittedFrame: number;
  completedRevision: number;
  completedFrame: number;
  submittedPreparation: number;
  completedPreparation: number;
  /** Own brush changes keep the baseline; actual imported changes do not. */
  foundationVersion: number;
  contentVersion: number;
  visible: boolean;
  touched: number;
  field: HeightFieldTile;
  overview: HeightOverviewTile | null;
  failedPreparation?: {
    revision: number;
    contentVersion: number;
    preparation: number;
  };
}
const SIZE = HEIGHT_OVERVIEW_SIZE;
const WHOLE: Rect = [0, 0, SIZE, SIZE];
const merged = (a: Rect, b: Rect): Rect => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];
const overlaps = (a: Rect, b: Rect): boolean =>
  a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

function intersection(a: Bounds, b: Bounds): Bounds | null {
  const area: Bounds = [
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.min(a[2], b[2]),
    Math.min(a[3], b[3]),
  ];
  return area[0] < area[2] && area[1] < area[3] ? area : null;
}

function pixelRect(tile: DisplayTile, bounds: Bounds): Rect {
  const stepX = (tile.bounds[2] - tile.bounds[0]) / SIZE;
  const stepY = (tile.bounds[3] - tile.bounds[1]) / SIZE;
  return [
    Math.max(0, Math.floor((bounds[0] - tile.bounds[0]) / stepX)),
    Math.max(0, Math.floor((bounds[1] - tile.bounds[1]) / stepY)),
    Math.min(SIZE, Math.ceil((bounds[2] - tile.bounds[0]) / stepX)),
    Math.min(SIZE, Math.ceil((bounds[3] - tile.bounds[1]) / stepY)),
  ];
}

function foundationCoverage(
  pixels: Uint32Array,
  rect: Rect,
  write = false,
): boolean {
  for (let y = rect[1]; y < rect[3]; y++) {
    const start = y * SIZE + rect[0];
    const end = y * SIZE + rect[2];
    for (
      let word = Math.floor(start / 32);
      word < Math.ceil(end / 32);
      word++
    ) {
      const left = Math.max(0, start - word * 32);
      const right = Math.min(32, end - word * 32);
      const mask = (0xffffffff << left) & (0xffffffff >>> (32 - right));
      if (write) pixels[word] |= mask;
      else if ((pixels[word] & mask) >>> 0 !== mask >>> 0) return false;
    }
  }
  return true;
}

function outsideRect(area: Rect, dirty: Rect | null): Rect[] {
  if (!dirty || !overlaps(area, dirty)) return [area];
  const x0 = Math.max(area[0], dirty[0]);
  const y0 = Math.max(area[1], dirty[1]);
  const x1 = Math.min(area[2], dirty[2]);
  const y1 = Math.min(area[3], dirty[3]);
  return [
    [area[0], area[1], x0, area[3]],
    [x1, area[1], area[2], area[3]],
    [x0, area[1], x1, y0],
    [x0, y1, x1, area[3]],
  ].filter((rect) => rect[0] < rect[2] && rect[1] < rect[3]) as Rect[];
}

/** Retained display tiles. Camera transforms never read or write the store. */
export class WorldRenderer {
  readonly renderer = new WebGLRenderer();
  private stage = new Container();
  private terrain = new Container();
  private overlay = new Graphics();
  private houses = new HouseView();
  private tiles = new Map<string, DisplayTile>();
  private field: HeightField;
  private readonly retiredFields = new Set<HeightField>();
  private overviews = new Map<string, HeightOverviewTile>();
  private knownOverviews = new Set<string>();
  private document!: EditorDocument;
  private landscape!: LandscapeView;
  private surfaces!: DerivedSurfaceView;
  private readonly retiredSurfaces = new Set<DerivedSurfaceView>();
  private sessionId = "";
  private frame = 0;
  private viewGeneration = 0;
  private preparedViewGeneration = -1;
  private lastSubmittedViewGeneration = -1;
  private requestFrame = true;
  private delayUntil = 0;
  private destroyed = false;
  private canvas?: HTMLCanvasElement;
  private cursorOverlay?: CursorOverlay;
  private resizePending = false;
  private pendingDisplayTiles = false;
  private contextLost = false;
  private graphicsFailed = false;
  private unfencedWork = false;
  private unfencedField: HeightField | null = null;
  private submittedRevision = -1;
  private submittedViewGeneration = -1;
  private lastCompletedFrame = 0;
  private lastCompletedViewGeneration = -1;
  private preparationId = 0;
  private nextProofId = 1;
  private foundation: {
    receipt: RegionFoundation;
    tiles: Map<DisplayTile, FoundationTile>;
  } | null = null;
  private frozen: FrozenRender | null = null;
  /** One worker-owned exception snapshot never occupies the normal terrain group. */
  private exceptionTarget: {
    receipt: FrozenRenderReceipt;
    target: FrozenTarget;
    overview: HeightOverviewTile | null;
    landscape: LandscapeFrame | null;
    surface: SurfaceFrame | null;
  } | null = null;
  private completedRender: FrozenRenderReceipt | null = null;
  private readonly queuedSources = new Map<string, QueuedSource>();
  private readonly queuedOverviews = new Map<string, QueuedOverview>();
  private overviewWork: OverviewWork | null = null;
  /** FIFO command order, with one terrain and one scene slot at most. */
  private readonly pendingGpu: GpuSubmission[] = [];
  private sceneRequested = true;
  private interruptBackground = false;
  private preparationDeadline = 0;
  private preparationSteps = 0;
  private preparationStarted = 0;
  private framePrepared = false;
  private wantedInfluence: Bounds[] | null = null;
  private terrainPacketId = 0;
  private preparationSerial = 0;
  private preparationRecord: {
    id: number;
    at: number;
    ms: number;
    steps: number;
    sourceSteps: number;
  } | null = null;
  camera: Camera = { x: 0, y: 0, scale: 0.25 };
  width = 1000;
  height = 760;
  grid = true;
  cursor: {
    x: number;
    y: number;
    radius: number;
    waiting?: boolean;
  } | null = null;
  fault:
    | "none"
    | "delay-render"
    | "drop-render"
    | "delay-feedback"
    | "ignore-zoom"
    | "pointerup-render" = "none";
  private faultArmed = false;
  onError: (error: Error) => void = () => {};

  constructor(
    private observation: Observation,
    private projections?: HeightProjectionService,
    private extraComputeBytes: () => number = () => 0,
  ) {
    this.field = this.newField();
    this.stage.addChild(this.terrain, this.houses.graphics, this.overlay);
    this.terrain.sortableChildren = true;
  }

  private newField(): HeightField {
    return new HeightField(this.projections, () => {
      this.requestFrame = true;
    });
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.renderer.init({
      canvas,
      width: this.width,
      height: this.height,
      resolution: devicePixelRatio,
      autoDensity: true,
      antialias: false,
      background: 0x294e63,
    });
    this.field.init(this.renderer);
    this.canvas = canvas;
    this.cursorOverlay = new CursorOverlay(canvas);
    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.invalidateGpuSubmission();
    this.observation.event("graphics-context-lost", {
      sessionId: this.sessionId,
    });
  };

  private handleContextRestored = (): void => {
    if (this.destroyed) return;
    try {
      // Pixi has already recreated its context before this listener runs. Its
      // empty texture allocations are not a reconstruction of our GPU caches.
      this.field.rebuildAfterContextRestore();
      this.invalidateGpuSubmission();
      this.contextLost = false;
      this.graphicsFailed = false;
      this.unfencedWork = false;
      this.observation.event("graphics-context-restored", {
        sessionId: this.sessionId,
      });
    } catch (error) {
      this.contextLost = true;
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  private invalidateGpuSubmission(release = true): void {
    if (release) this.releaseFence();
    this.invalidateProofs();
    this.lastSubmittedViewGeneration = -1;
    this.lastCompletedFrame = 0;
    this.lastCompletedViewGeneration = -1;
    this.submittedRevision = -1;
    this.submittedViewGeneration = -1;
    for (const tile of this.tiles.values()) {
      tile.dirty = [...WHOLE];
      tile.preparedRevision = -1;
      tile.preparedIntent = -1;
      tile.paintedRevision = -1;
      tile.submittedRevision = -1;
      tile.submittedFrame = 0;
      tile.completedRevision = -1;
      tile.completedFrame = 0;
      tile.submittedPreparation = -1;
      tile.completedPreparation = -1;
      tile.field.mesh.visible = false;
    }
    this.requestFrame = true;
    this.sceneRequested = true;
  }

  reset(document: EditorDocument, landscapeEmpty = true): void {
    this.invalidateProofs();
    this.resetSourceQueue();
    this.document = document;
    this.houses.reset();
    this.landscape = new LandscapeView(document, landscapeEmpty);
    this.surfaces?.destroy();
    if (this.surfaces?.pendingDigest) this.retiredSurfaces.add(this.surfaces);
    this.surfaces = new DerivedSurfaceView(document, (bounds) => {
      if (bounds) this.invalidateSurface(bounds);
      this.redraw();
    });
    this.sessionId = document.sessionId;
    for (const tile of this.tiles.values())
      this.terrain.removeChild(tile.field.mesh);
    if (
      this.unfencedField === this.field ||
      this.pendingGpu.some((pending) => pending.field === this.field)
    ) {
      // Outstanding commands keep their exact textures/pages alive. A session
      // change invalidates their results, not the commands already submitted.
      this.retiredFields.add(this.field);
      const numericSupported = this.field.numericSupported;
      this.field = this.newField();
      if (this.canvas) this.field.init(this.renderer, numericSupported);
    } else this.field.reset();
    this.tiles.clear();
    this.overviews.clear();
    this.knownOverviews.clear();
    this.submittedRevision = -1;
    this.submittedViewGeneration = -1;
    this.preparedViewGeneration = -1;
    this.lastSubmittedViewGeneration = -1;
    this.lastCompletedFrame = 0;
    this.lastCompletedViewGeneration = -1;
    this.faultArmed = false;
    this.delayUntil = 0;
    this.requestFrame = true;
    this.sceneRequested = true;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.resizePending = true;
    this.moveCamera(this.camera);
  }

  bounds(margin = 0): Bounds {
    const halfWidth = this.width / this.camera.scale / 2 + margin;
    const halfHeight = this.height / this.camera.scale / 2 + margin;
    return clipBounds([
      this.camera.x - halfWidth,
      this.camera.y - halfHeight,
      this.camera.x + halfWidth,
      this.camera.y + halfHeight,
    ]);
  }

  moveCamera(camera: Camera): void {
    this.invalidateProofs();
    this.camera = { ...camera };
    this.viewGeneration++;
    this.observation.event("view-change", {
      sessionId: this.sessionId,
      viewGeneration: this.viewGeneration,
      bounds: this.bounds(),
      camera: { ...this.camera },
    });
    this.requestFrame = true;
    this.sceneRequested = true;
    this.positionTiles();
  }

  updateLandscapePresentation(read: LandscapePresentationRead): void {
    for (const bounds of this.landscape.accept(read))
      this.invalidateTiles(bounds, !this.document.active, undefined, false);
    // An equivalent fine-ownership cache may still have been waiting for the
    // document's coarse source coverage. Wake its existing dirty work even when
    // this read requires no further pixel invalidation.
    this.requestFrame = true;
  }

  updateLandscape(
    bounds: Bounds,
    sequence?: number,
    patches?: readonly LandscapePatch[],
  ): void {
    for (const changed of this.landscape.changed(bounds, sequence, patches))
      this.invalidateTiles(changed, false, undefined, false);
  }

  /**
   * Inputs are immutable document snapshots / projected read results. Admission
   * retains them; validation, copying and publication run in the shared RAF budget.
   */
  updatePresentation(
    tiles: readonly HeightTile[],
    overviews: readonly HeightOverviewTile[],
    overviewKeys: readonly string[],
    foundation?: RegionFoundation,
  ): void {
    const ownRead =
      foundation &&
      this.document.active &&
      this.foundation?.receipt === foundation
        ? foundation
        : undefined;
    const incoming = new Map(overviews.map((tile) => [tile.key, tile]));
    const certified = new Set(overviewKeys);
    for (const tile of overviews)
      if (!certified.has(tile.key))
        throw new Error("Nicht bestätigte Höhenübersicht.");
    for (const key of overviewKeys) {
      const at = parseHeightOverviewKey(key);
      this.knownOverviews.add(key);
      const after = incoming.get(key) ?? null;
      if (!after && !this.overviews.has(key) && !this.queuedOverviews.has(key))
        continue;
      const pending = this.queuedOverviews.get(key);
      const candidate = pending?.localCandidate
        ? {
            base: pending.localCandidate.base,
            deltas: new Map(pending.localCandidate.deltas),
          }
        : pending && !pending.replacement
          ? { base: pending.base, deltas: new Map(pending.deltas) }
          : undefined;
      this.queuedOverviews.set(key, {
        base: after,
        replacement: true,
        deltas: new Map(),
        localCandidate: candidate,
        trustedFoundation: ownRead,
        version: 0,
        bounds: heightOverviewBounds(at),
      });
    }
    for (const tile of tiles) {
      this.queueSource(tile.key, tile, false);
      const queued = this.queuedSources.get(tile.key);
      if (queued && ownRead) queued.trustedFoundation = ownRead;
    }
    this.pruneOverviews(overviewKeys);
    for (const key of this.queuedOverviews.keys())
      if (!this.knownOverviews.has(key)) this.queuedOverviews.delete(key);
    this.checkBudgets();
    this.requestFrame = true;
  }

  /** Eviction is a renderer residency change, never an author deletion. */
  forgetSources(keys: readonly string[]): void {
    for (const key of keys) this.queueSource(key, null, false);
  }

  /** Published patches are immutable, including a missing resident before-image. */
  updateSourcePatches(patches: readonly HeightPatch[]): void {
    for (const patch of patches) {
      const source = patch.after ?? patch.before;
      if (!source) continue;
      this.queueSource(patch.key, patch.after, true, patch.before);
      const support = heightTileSupport(source);
      for (const key of this.knownOverviews) {
        const at = parseHeightOverviewKey(key);
        if (source.level >= minimumCoarseHeightLevel(at.power)) continue;
        const bounds = heightOverviewBounds(at);
        if (!intersectsBounds(bounds, support)) continue;
        let queued = this.queuedOverviews.get(key);
        if (!queued) {
          queued = {
            base: this.overviews.get(key) ?? null,
            replacement: false,
            deltas: new Map(),
            version: 0,
            bounds,
          };
          this.queuedOverviews.set(key, queued);
        }
        const previous = queued.deltas.get(patch.key);
        queued.deltas.set(patch.key, {
          key: patch.key,
          before: previous ? previous.before : patch.before,
          after: patch.after,
        });
        if (queued.localCandidate) {
          const candidate = queued.localCandidate.deltas.get(patch.key);
          queued.localCandidate.deltas.set(patch.key, {
            key: patch.key,
            before: candidate ? candidate.before : patch.before,
            after: patch.after,
          });
        }
        queued.version++;
      }
    }
    this.checkBudgets();
    this.requestFrame = true;
  }

  private get sourcesFrozen(): boolean {
    return this.frozen !== null || this.terrainPending;
  }

  private get terrainPending(): boolean {
    return this.pendingGpu.some((pending) => pending.kind === "terrain");
  }

  private get scenePending(): boolean {
    return this.pendingGpu.some((pending) => pending.kind === "scene");
  }

  private queueSource(
    key: string,
    after: HeightTile | null,
    local: boolean,
    before?: HeightTile | null,
  ): void {
    const queued = this.queuedSources.get(key);
    const current = queued
      ? queued.after
      : (this.field.readSource(key) ?? null);
    if (current === after && !(local && !current && before)) return;
    const source = after ?? current ?? before;
    if (!source) return;
    this.queuedSources.set(key, {
      // A late History deletion can require a before-image which the renderer
      // never kept resident. Preserve that proof even after a queued eviction.
      before:
        queued &&
        (queued.before !== null || queued.localCandidate !== undefined)
          ? queued.before
          : (this.field.readSource(key) ?? before ?? null),
      after,
      local,
      foreign: !local,
      localCandidate: local ? after : queued?.localCandidate,
      bounds: heightTileSupport(source),
    });
    this.requestFrame = true;
  }

  private resetSourceQueue(): void {
    this.overviewWork?.steps.return({ tile: null, changed: false });
    this.overviewWork = null;
    this.queuedSources.clear();
    this.queuedOverviews.clear();
  }

  /** Pending dependencies prevent a descriptor from observing a partial cohort. */
  private hasQueuedSourcesFor(bounds: readonly Bounds[]): boolean {
    const power = this.tilePower();
    const minimum = minimumCoarseHeightLevel(power);
    for (const source of this.queuedSources.values())
      if (
        (source.after ?? source.before)!.level >= minimum ||
        (source.after ?? source.before)!.level === this.field.toolLevel
      )
        if (bounds.some((area) => intersectsBounds(area, source.bounds)))
          return true;
    for (const [key, overview] of this.queuedOverviews)
      if (
        parseHeightOverviewKey(key).power === power &&
        bounds.some((area) => intersectsBounds(area, overview.bounds))
      )
        return true;
    return false;
  }

  private hasQueuedImportsFor(
    bounds: readonly Bounds[],
    foundation?: RegionFoundation,
  ): boolean {
    const ownRead =
      foundation && this.foundation?.receipt === foundation
        ? foundation
        : undefined;
    const power = this.tilePower();
    const minimum = minimumCoarseHeightLevel(power);
    for (const source of this.queuedSources.values())
      if (
        source.foreign &&
        !(ownRead && source.trustedFoundation === ownRead) &&
        ((source.after ?? source.before)!.level >= minimum ||
          (source.after ?? source.before)!.level === this.field.toolLevel) &&
        bounds.some((area) => intersectsBounds(area, source.bounds))
      )
        return true;
    for (const [key, overview] of this.queuedOverviews)
      if (
        overview.replacement &&
        !(ownRead && overview.trustedFoundation === ownRead) &&
        parseHeightOverviewKey(key).power === power &&
        bounds.some((area) => intersectsBounds(area, overview.bounds))
      )
        return true;
    return false;
  }

  /** Unique physical pending inputs and unpublished numeric work for accounting. */
  private queuedSourceBuffers(): ArrayBufferLike[] {
    const buffers = new Set<ArrayBufferLike>();
    const add = (
      source: HeightTile | HeightOverviewTile | null | undefined,
    ) => {
      if (source) buffers.add(source.values.buffer);
    };
    for (const source of this.queuedSources.values()) {
      add(source.before);
      add(source.after);
      add(source.localCandidate);
    }
    const addOverview = (overview: OverviewPlan) => {
      add(overview.base);
      for (const patch of overview.deltas.values()) {
        add(patch.before);
        add(patch.after);
      }
    };
    for (const overview of this.queuedOverviews.values()) {
      addOverview(overview);
      if (overview.localCandidate) addOverview(overview.localCandidate);
    }
    if (this.overviewWork) {
      addOverview(this.overviewWork.request);
      if (this.overviewWork.request.localCandidate)
        addOverview(this.overviewWork.request.localCandidate);
    }
    for (const buffer of this.overviewWork?.buffers ?? []) buffers.add(buffer);
    return [...buffers];
  }

  private sourceDistance(bounds: Bounds): number {
    const x =
      this.camera.x +
      ((this.cursor?.x ?? this.width / 2) - this.width / 2) / this.camera.scale;
    const y =
      this.camera.y +
      ((this.cursor?.y ?? this.height / 2) - this.height / 2) /
        this.camera.scale;
    const distance = Math.hypot(
      Math.max(bounds[0] - x, 0, x - bounds[2]),
      Math.max(bounds[1] - y, 0, y - bounds[3]),
    );
    return this.wantedInfluence?.some((area) => intersectsBounds(area, bounds))
      ? distance - 1e12
      : distance;
  }

  private sourcePreparationFits(bytes: number): boolean {
    const metrics = this.resourceMetrics();
    return (
      metrics.cpuBytes + this.retainedBufferBytes() + bytes <=
      editorBudgets.presentationBytes
    );
  }

  /** Sole source/overview publisher. Each step is one source or a small raster slice. */
  private drainSources(deadline: number, maxSteps: number): number {
    if (this.sourcesFrozen || maxSteps <= 0) return 0;
    let steps = 0;
    const sources = [...this.queuedSources].sort(
      (a, b) =>
        this.sourceDistance(a[1].bounds) - this.sourceDistance(b[1].bounds),
    );
    const overviews = [...this.queuedOverviews].sort(
      (a, b) =>
        this.sourceDistance(a[1].bounds) - this.sourceDistance(b[1].bounds),
    );
    while (steps < maxSteps && performance.now() < deadline) {
      const work = this.overviewWork;
      const nearest = sources.find(
        ([key, request]) => this.queuedSources.get(key) === request,
      );
      const localTakesPriority =
        work &&
        nearest?.[1].local &&
        !work.request.deltas.has(nearest[0]) &&
        (parseHeightOverviewKey(work.key).power !== this.tilePower() ||
          this.sourceDistance(nearest[1].bounds) <
            this.sourceDistance(work.request.bounds));
      if (
        work &&
        (localTakesPriority ||
          this.queuedOverviews.get(work.key) !== work.request ||
          work.request.version !== work.version)
      ) {
        work.steps.return({ tile: null, changed: false });
        this.overviewWork = null;
      }
      if (this.overviewWork) {
        const active = this.overviewWork;
        steps++;
        let next: IteratorResult<void, OverviewResult>;
        try {
          next = active.steps.next();
        } catch (error) {
          this.overviewWork = null;
          throw error;
        }
        if (!next.done) continue;
        this.overviewWork = null;
        if (
          this.queuedOverviews.get(active.key) !== active.request ||
          active.request.version !== active.version
        )
          continue;
        this.queuedOverviews.delete(active.key);
        if (next.value.changed) {
          if (next.value.tile) this.overviews.set(active.key, next.value.tile);
          else this.overviews.delete(active.key);
          const tile = this.tiles.get(
            active.key.slice("height-overview:".length),
          );
          if (tile) {
            tile.contentVersion++;
            if (next.value.foreign ?? active.request.replacement) {
              tile.foundationVersion++;
              tile.field.invalidateTotal();
              tile.dirty = [...WHOLE];
            } else {
              tile.field.markHeightChanged();
              tile.dirty ??= [...WHOLE];
            }
            tile.preparedRevision = -1;
            tile.revision = this.document.revision;
          }
        }
        continue;
      }
      const source = sources.find(
        ([key, request]) => this.queuedSources.get(key) === request,
      );
      const overview = source
        ? overviews.find(
            ([key, request]) =>
              this.queuedOverviews.get(key) === request &&
              request.deltas.has(source[0]) &&
              parseHeightOverviewKey(key).power === this.tilePower(),
          )
        : overviews.find(
            ([key, request]) => this.queuedOverviews.get(key) === request,
          );
      if (overview) {
        // One cloned overview plus one 64² delta; prior output/input buffers are
        // separately retained. Never allocate the operation's peak speculatively.
        if (
          !this.sourcePreparationFits(
            HEIGHT_OVERVIEW_BYTES * (overview[1].localCandidate ? 2 : 1) +
              64 * 64 * 8,
          )
        )
          break;
        const [key, request] = overview;
        const buffers = new Set<ArrayBufferLike>();
        this.overviewWork = {
          key,
          request,
          version: request.version,
          buffers,
          steps: this.prepareOverview(key, request, buffers),
        };
        continue;
      }
      if (!source) break;
      const [key, request] = source;
      if (
        request.after &&
        !this.sourcePreparationFits(request.after.values.byteLength)
      )
        break;
      steps++;
      const candidate = request.localCandidate;
      const identicalLocal =
        candidate !== undefined &&
        (candidate === request.after ||
          Boolean(
            candidate &&
            request.after &&
            candidate.values.length === request.after.values.length &&
            candidate.values.every(
              (value, index) => value === request.after!.values[index],
            ),
          ));
      const changed =
        request.local || identicalLocal
          ? this.field.applySourcePatches([
              { key, before: request.before, after: request.after },
            ])
          : this.field.updateSources(
              request.after ? [request.after] : [],
              request.after ? [] : [key],
            );
      if (request.foreign && !identicalLocal)
        for (const bounds of changed) this.invalidateTiles(bounds, true);
      this.queuedSources.delete(key);
    }
    this.checkBudgets();
    return steps;
  }

  private *prepareOverview(
    key: string,
    request: QueuedOverview,
    buffers: Set<ArrayBufferLike>,
  ): Generator<void, OverviewResult, void> {
    const at = parseHeightOverviewKey(key);
    const base = request.base;
    const previous = this.overviews.get(key) ?? null;
    const patches = [...request.deltas.values()];
    if (base) buffers.add(base.values.buffer);
    for (const patch of patches) {
      if (patch.before) buffers.add(patch.before.values.buffer);
      if (patch.after) buffers.add(patch.after.values.buffer);
    }
    if (!base && !patches.length && !request.localCandidate)
      return { tile: null, changed: previous !== null };
    if (
      base &&
      (base.key !== key ||
        base.power !== at.power ||
        base.tileX !== at.tileX ||
        base.tileY !== at.tileY ||
        !(base.values instanceof Float64Array) ||
        base.values.length !== SIZE * SIZE)
    )
      throw new RangeError("Beschädigte numerische Höhenübersicht.");
    const result = createHeightOverviewTile(at.power, at.tileX, at.tileY);
    buffers.add(result.values.buffer);
    if (base)
      for (
        let from = 0;
        from < base.values.length;
        from += editorBudgets.heightOverviewSamplesPerStep
      ) {
        const to = Math.min(
          base.values.length,
          from + editorBudgets.heightOverviewSamplesPerStep,
        );
        for (let index = from; index < to; index++) {
          const value = base.values[index];
          if (!Number.isFinite(value))
            throw new RangeError("Beschädigte numerische Höhenübersicht.");
          result.values[index] = value;
        }
        yield;
      }
    let delta: HeightOverviewDelta | null = null;
    try {
      for (const patch of patches) {
        delta = prepareHeightOverviewDelta(patch);
        if (!delta) {
          yield;
          continue;
        }
        buffers.add(delta.values.buffer);
        yield;
        for (let row = 0; row < SIZE; row += 8) {
          applyPreparedHeightOverviewDelta(result, delta, [
            row,
            Math.min(SIZE, row + 8),
          ]);
          yield;
        }
        buffers.delete(delta.values.buffer);
        delta = null;
      }
      let changed = Boolean(previous) !== Boolean(base);
      let nonzero = false;
      for (
        let from = 0;
        from < result.values.length;
        from += editorBudgets.heightOverviewSamplesPerStep
      ) {
        const to = Math.min(
          result.values.length,
          from + editorBudgets.heightOverviewSamplesPerStep,
        );
        for (let index = from; index < to; index++) {
          nonzero ||= result.values[index] !== 0;
          changed ||= result.values[index] !== (previous?.values[index] ?? 0);
        }
        yield;
      }
      let foreign = request.replacement;
      if (request.replacement && request.localCandidate) {
        const expected = yield* this.prepareOverview(
          key,
          {
            ...request.localCandidate,
            replacement: false,
            version: 0,
            bounds: request.bounds,
          },
          buffers,
        );
        foreign = false;
        for (
          let from = 0;
          from < result.values.length;
          from += editorBudgets.heightOverviewSamplesPerStep
        ) {
          const to = Math.min(
            result.values.length,
            from + editorBudgets.heightOverviewSamplesPerStep,
          );
          for (let index = from; index < to; index++)
            foreign ||=
              result.values[index] !== (expected.tile?.values[index] ?? 0);
          yield;
        }
        if (expected.tile) buffers.delete(expected.tile.values.buffer);
      }
      return { tile: !base && !nonzero ? null : result, changed, foreign };
    } finally {
      if (delta) buffers.delete(delta.values.buffer);
    }
  }

  private retainedBufferBytes(): number {
    const buffers = new Set<ArrayBufferLike>(this.landscape?.retainedBuffers());
    for (const buffer of this.surfaces?.retainedBuffers() ?? [])
      buffers.add(buffer);
    for (const surface of this.retiredSurfaces)
      for (const buffer of surface.retainedBuffers()) buffers.add(buffer);
    for (const frame of this.frozen?.surfaces.values() ?? [])
      for (const buffer of frame?.buffers ?? []) buffers.add(buffer);
    for (const buffer of this.exceptionTarget?.surface?.buffers ?? [])
      buffers.add(buffer);
    for (const frame of this.frozen?.landscapes.values() ?? [])
      for (const buffer of frame?.buffers ?? []) buffers.add(buffer);
    for (const buffer of this.exceptionTarget?.landscape?.buffers ?? [])
      buffers.add(buffer);
    const sourceBuffers = new Set<ArrayBufferLike>();
    for (const field of [this.field, ...this.retiredFields])
      for (const source of field.atlas.sources.values())
        sourceBuffers.add(source.values.buffer);
    const add = (values: Float64Array) => buffers.add(values.buffer);
    for (const tile of this.overviews.values()) add(tile.values);
    for (const tile of this.tiles.values())
      if (tile.overview) add(tile.overview.values);
    for (const tile of this.frozen?.overviews.values() ?? []) add(tile.values);
    if (this.exceptionTarget?.overview)
      add(this.exceptionTarget.overview.values);
    for (const [key, queued] of this.queuedSources) {
      const held = this.field.readSource(key)?.values.buffer;
      if (queued.before && queued.before.values.buffer !== held)
        add(queued.before.values);
      if (queued.after && queued.after.values.buffer !== held)
        add(queued.after.values);
    }
    for (const buffer of this.projections?.metrics().retainedInputBuffers ?? [])
      if (!sourceBuffers.has(buffer)) buffers.add(buffer);
    for (const field of [this.field, ...this.retiredFields])
      for (const buffer of field.retainedSourceBuffers())
        if (!sourceBuffers.has(buffer)) buffers.add(buffer);
    for (const buffer of this.queuedSourceBuffers())
      if (!sourceBuffers.has(buffer)) buffers.add(buffer);
    let bytes = 0;
    for (const buffer of buffers) bytes += buffer.byteLength;
    for (const proof of this.foundation?.tiles.values() ?? [])
      bytes += proof.pixels.byteLength;
    return bytes;
  }

  private invalidateProofs(): void {
    this.preparationId++;
    this.foundation = null;
    this.wantedInfluence = null;
    this.abandonFrozen();
    this.exceptionTarget?.target.tile.field.cancelPreparation();
    this.exceptionTarget = null;
    this.completedRender = null;
  }

  private abandonFrozen(): void {
    if (this.frozen)
      for (const target of this.frozen.targets)
        if (!target.painted) target.tile.field.cancelPreparation();
    this.frozen = null;
    this.interruptBackground = false;
  }

  private checkBudgets(): void {
    const metrics = this.resourceMetrics();
    if (metrics.sourceBytes > editorBudgets.sourceBytes)
      throw new Error(
        "Die Darstellungsquellen überschreiten das Speicherbudget.",
      );
    if (
      metrics.cpuBytes + this.retainedBufferBytes() >
      editorBudgets.presentationBytes
    )
      throw new Error(
        "Die Höhenübersichten überschreiten das Darstellungsbudget.",
      );
    if (metrics.gpuBytes > editorBudgets.gpuBytes)
      throw new Error(
        "Die numerischen Texturen überschreiten das Grafikbudget.",
      );
  }

  private tilePower(): number {
    let power = Math.ceil(Math.log2(1 / this.camera.scale));
    while (
      (Math.ceil(this.width / (SIZE * 2 ** power * this.camera.scale)) + 1) *
        (Math.ceil(this.height / (SIZE * 2 ** power * this.camera.scale)) + 1) >
      editorBudgets.retainedTiles
    )
      power++;
    return power;
  }

  presentationPower(): number {
    return this.tilePower();
  }

  /** Product tool demand prepares its render strategy before accepting a Down. */
  setToolLevel(level: number): void {
    if (this.field.toolLevel === level) return;
    this.invalidateProofs();
    if (!this.field.setToolLevel(level)) return;
    for (const tile of this.tiles.values()) {
      tile.dirty = [...WHOLE];
      tile.preparedRevision = -1;
    }
    this.requestFrame = true;
  }

  isLandscapePresentationReady(
    bounds: Bounds,
    power = this.tilePower(),
  ): boolean {
    return this.landscape?.ready(bounds, power) ?? true;
  }

  isPresentationReady(bounds: Bounds, power = this.tilePower()): boolean {
    return (
      this.isHeightPresentationReady(bounds, power) &&
      this.isLandscapePresentationReady(bounds, power)
    );
  }

  isHeightPresentationReady(bounds: Bounds, power = this.tilePower()): boolean {
    const clipped = clipBounds(bounds);
    return (
      this.document.isReady(
        clipped,
        HEIGHT_LEVELS.slice(minimumCoarseHeightLevel(power)),
      ) &&
      heightOverviewKeys(clipped, power).every((key) => {
        const area = heightOverviewBounds(parseHeightOverviewKey(key));
        return !overlaps(area, clipped) || this.knownOverviews.has(key);
      })
    );
  }

  sourceBounds(): Bounds {
    const span = SIZE * 2 ** this.tilePower();
    const bounds = this.bounds(span);
    return clipBounds([
      Math.floor(bounds[0] / span) * span,
      Math.floor(bounds[1] / span) * span,
      Math.ceil(bounds[2] / span) * span,
      Math.ceil(bounds[3] / span) * span,
    ]);
  }

  refresh(): void {
    if (!this.document) return;
    const power = this.tilePower();
    const span = SIZE * 2 ** power;
    const view = this.bounds();
    const specifications: { key: string; bounds: Bounds }[] = [];
    const current = new Set<string>();
    for (
      let y = Math.floor(view[1] / span);
      y <= Math.floor(view[3] / span);
      y++
    ) {
      for (
        let x = Math.floor(view[0] / span);
        x <= Math.floor(view[2] / span);
        x++
      ) {
        const bounds: Bounds = [
          x * span,
          y * span,
          (x + 1) * span,
          (y + 1) * span,
        ];
        const key = `${power}:${x}:${y}`;
        if (!intersection(bounds, view)) continue;
        current.add(key);
        specifications.push({ key, bounds });
      }
    }
    for (const tile of this.tiles.values())
      tile.visible = current.has(tile.key);
    this.pendingDisplayTiles = false;
    for (const { key, bounds } of specifications) {
      if (
        !this.tiles.has(key) &&
        this.tiles.size >= editorBudgets.retainedTiles
      ) {
        const cold = [...this.tiles.values()]
          .filter((tile) => !tile.visible && !this.tilePinned(tile))
          .sort((a, b) => a.touched - b.touched)[0];
        if (cold) {
          this.tiles.delete(cold.key);
          this.destroyTile(cold);
        } else {
          this.pendingDisplayTiles = true;
          continue;
        }
      }
      let tile = this.tiles.get(key);
      if (!tile) {
        const field = this.field.createTile(
          bounds,
          power,
          this.overviews.get(`height-overview:${key}`),
        );
        tile = {
          key,
          bounds,
          power,
          revision: this.document.revision,
          dirty: [...WHOLE],
          preparedRevision: -1,
          preparedIntent: -1,
          preparedContentVersion: -1,
          paintedRevision: -1,
          submittedRevision: -1,
          submittedFrame: 0,
          completedRevision: -1,
          completedFrame: 0,
          submittedPreparation: -1,
          completedPreparation: -1,
          foundationVersion: 0,
          contentVersion: 0,
          visible: true,
          touched: performance.now(),
          field,
          overview: this.overviews.get(`height-overview:${key}`) ?? null,
        };
        this.tiles.set(key, tile);
        this.terrain.addChild(field.mesh);
      }
      tile.visible = true;
      tile.touched = performance.now();
    }
    for (const tile of this.tiles.values()) {
      tile.visible = current.has(tile.key);
      tile.field.mesh.zIndex = tile.visible ? 1 : 0;
    }
    this.prune();
    this.preparedViewGeneration = this.viewGeneration;
    this.positionTiles();
    this.requestFrame = true;
  }

  invalidate(bounds: Bounds): void {
    this.surfaces.invalidate(bounds);
    this.faultArmed = true;
    if (this.fault === "delay-render")
      this.delayUntil = performance.now() + 250;
    this.invalidateTiles(bounds);
  }

  private invalidateSurface(bounds: Bounds): void {
    for (const tile of this.tiles.values()) {
      if (!intersectsBounds(tile.bounds, bounds)) continue;
      tile.contentVersion++;
      tile.dirty = [...WHOLE];
      tile.revision = this.document.revision;
      tile.preparedRevision = -1;
    }
    this.requestFrame = true;
  }

  surfaceReadNeed(): SurfaceReadNeed | null {
    this.surfaces.sync(this.bounds(), this.camera.scale);
    return this.surfaces.readNeed();
  }

  surfaceRetainHeight(): Bounds | null {
    return this.surfaces.retainHeightBounds();
  }
  surfaceRetainWater(): Bounds[] {
    return this.surfaces.retainWaterBounds();
  }
  surfaceReadFailed(need: SurfaceReadNeed, error: unknown): void {
    this.surfaces.failed(need, error);
  }
  surfaceState() {
    return this.surfaces?.state() ?? null;
  }
  surfaceSample(point: Point, natural: number | null) {
    return this.surfaces.sample(point, natural);
  }

  private invalidateTiles(
    bounds: Bounds,
    sourcesChanged = false,
    sourceLevel?: number,
    heightChanged = true,
  ): void {
    for (const tile of this.tiles.values()) {
      if (
        sourceLevel !== undefined &&
        !tile.field.dependsOnAuthorLevel(sourceLevel)
      )
        continue;
      if (!intersectsBounds(tile.bounds, bounds)) continue;
      const rect = pixelRect(tile, bounds);
      if (rect[0] >= rect[2] || rect[1] >= rect[3]) continue;
      if (heightChanged && !sourcesChanged && !this.sourcesFrozen)
        tile.field.markHeightChanged();
      if (sourcesChanged) tile.foundationVersion++;
      tile.contentVersion++;
      tile.dirty = tile.dirty ? merged(tile.dirty, rect) : rect;
      tile.revision = this.document.revision;
      if (sourcesChanged) tile.preparedRevision = -1;
    }
    this.requestFrame = true;
  }

  redraw(): void {
    this.redrawCursor();
    this.requestFrame = true;
    this.sceneRequested = true;
  }

  selectHouse(id: string | null): void {
    this.houses.selectedId = id;
    this.redraw();
  }

  redrawCursor(): void {
    this.cursorOverlay?.update(this.cursor);
  }

  /** Explicit retry keeps failed remote work out of ordinary scheduling meanwhile. */
  retryPreparation(): void {
    this.surfaces.retry();
    for (const tile of this.tiles.values()) {
      if (!tile.failedPreparation) continue;
      tile.failedPreparation = undefined;
      tile.preparedRevision = -1;
      tile.preparedIntent = -1;
    }
    this.requestFrame = true;
  }

  private preparationFailed(tile: DisplayTile): boolean {
    const failed = tile.failedPreparation;
    return Boolean(
      failed &&
      failed.revision === tile.revision &&
      failed.contentVersion === tile.contentVersion &&
      failed.preparation === tile.field.preparationVersion,
    );
  }

  /**
   * Inspect only the visible part of a requested (possibly swept) region.
   * Missing and stale are distinct: a submitted foundation survives its own
   * pending edit, but that edit is current only after an actual matching draw.
   * Completely offscreen work cannot provide a submission proof.
   */
  inspectRegion(bounds: Bounds): RegionInspection {
    return this.inspect(bounds, true);
  }

  /** CPU submission evidence remains separate from completed GPU work. */
  inspectSubmittedRegion(
    bounds: Bounds,
    minimumRevision?: number,
  ): RegionInspection {
    const result = this.inspect(bounds, false);
    if (result.status === "current" || minimumRevision === undefined)
      return result;
    if (
      !Number.isSafeInteger(minimumRevision) ||
      minimumRevision < 0 ||
      this.contextLost ||
      this.graphicsFailed ||
      this.destroyed
    )
      return result;
    const scene = this.pendingGpu.find(
      (pending) =>
        pending.kind === "scene" &&
        pending.submission?.frame === result.frame &&
        pending.submission.sessionId === result.sessionId,
    );
    const receipt = scene?.renderReceipt;
    if (
      !receipt ||
      receipt !== this.frozen?.receipt ||
      receipt.sessionId !== this.sessionId ||
      receipt.viewGeneration !== this.viewGeneration ||
      receipt.preparationId !== this.preparationId ||
      receipt.revision < minimumRevision
    )
      return result;
    const area = intersection(bounds, this.bounds());
    if (!area) return result;
    // This is read-only timing correlation for the submitted immutable R, not
    // readiness of the newest document. A full Scene receipt certifies only
    // its complete visible influence; an unrelated region or partial packet
    // cannot publish an input merely because its revision is older.
    let uncovered: Rect[] = [area];
    for (const covered of receipt.bounds) {
      uncovered = uncovered.flatMap((part) => outsideRect(part, covered));
      if (!uncovered.length) return { ...result, status: "current" };
    }
    return result;
  }

  /** Capture actually completed pixels; later own edits may reuse this baseline. */
  captureFoundation(): RegionFoundation {
    const receipt = Object.freeze({
      id: this.nextProofId++,
      sessionId: this.sessionId,
      viewGeneration: this.viewGeneration,
      preparationId: this.preparationId,
    });
    const tiles = new Map<DisplayTile, FoundationTile>();
    for (const tile of this.tiles.values()) {
      if (!tile.visible) continue;
      const area = intersection(tile.bounds, this.bounds());
      if (!area) continue;
      for (const rect of outsideRect(pixelRect(tile, area), tile.dirty)) {
        const step = (tile.bounds[2] - tile.bounds[0]) / SIZE;
        const bounds: Bounds = [
          tile.bounds[0] + rect[0] * step,
          tile.bounds[1] + rect[1] * step,
          tile.bounds[0] + rect[2] * step,
          tile.bounds[1] + rect[3] * step,
        ];
        if (this.inspectRegion(bounds).status !== "current") continue;
        let proof = tiles.get(tile);
        if (!proof)
          tiles.set(
            tile,
            (proof = {
              version: tile.foundationVersion,
              pixels: new Uint32Array((SIZE * SIZE) / 32),
            }),
          );
        foundationCoverage(proof.pixels, rect, true);
      }
    }
    this.foundation = { receipt, tiles };
    return receipt;
  }

  /** Pure readiness inspection; only acceptance below expands the stored proof. */
  inspectFoundation(
    bounds: Bounds,
    receipt: RegionFoundation,
  ): RegionInspection {
    const result = this.inspectRegion(bounds);
    if (
      this.foundation?.receipt !== receipt ||
      receipt.sessionId !== this.sessionId ||
      receipt.viewGeneration !== this.viewGeneration ||
      receipt.preparationId !== this.preparationId ||
      this.contextLost
    )
      return {
        ...result,
        status: result.status === "outside" ? "outside" : "missing",
      };
    const area = intersection(bounds, this.bounds());
    if (!area) return result;
    if (this.hasQueuedImportsFor([area], receipt))
      return { ...result, status: "missing" };
    let covered = false;
    for (const tile of this.tiles.values()) {
      if (!tile.visible || !intersectsBounds(tile.bounds, area)) continue;
      covered = true;
      const proof = this.foundation.tiles.get(tile);
      if (proof && proof.version !== tile.foundationVersion)
        return { ...result, status: "missing" };
      const local = intersection(tile.bounds, area)!;
      if (!proof || !foundationCoverage(proof.pixels, pixelRect(tile, local))) {
        if (this.inspectRegion(local).status !== "current")
          return { ...result, status: "missing" };
      }
    }
    return { ...result, status: covered ? "current" : "missing" };
  }

  acceptFoundation(
    influence: Bounds | readonly Bounds[],
    receipt: RegionFoundation,
  ): boolean {
    const bounds: readonly Bounds[] =
      typeof influence[0] === "number"
        ? [influence as Bounds]
        : (influence as readonly Bounds[]);
    if (
      this.foundation?.receipt !== receipt ||
      bounds.some(
        (area) => this.inspectFoundation(area, receipt).status !== "current",
      )
    )
      return false;
    for (const boundsPart of bounds) {
      const area = intersection(boundsPart, this.bounds());
      if (!area) return false;
      for (const tile of this.tiles.values()) {
        if (!tile.visible || !intersectsBounds(tile.bounds, area)) continue;
        let proof = this.foundation.tiles.get(tile);
        if (!proof)
          this.foundation.tiles.set(
            tile,
            (proof = {
              version: tile.foundationVersion,
              pixels: new Uint32Array((SIZE * SIZE) / 32),
            }),
          );
        foundationCoverage(
          proof.pixels,
          pixelRect(tile, intersection(tile.bounds, area)!),
          true,
        );
      }
    }
    return true;
  }

  /** Freeze one complete visible influence against immutable numeric sources. */
  freezeRender(
    influence: Bounds | readonly Bounds[],
  ): FrozenRenderReceipt | null {
    const requested: Bounds[] =
      typeof influence[0] === "number"
        ? [[...(influence as Bounds)]]
        : (influence as readonly Bounds[]).map((area) => [...area]);
    this.wantedInfluence = requested;
    if (this.frozen?.kind === "background") {
      // A new local gesture takes over after the already submitted terrain
      // packet. Unsubmitted work stays in the same dirty union.
      this.interruptBackground = true;
      if (this.terrainPending) return null;
      this.abandonFrozen();
    }
    if (
      this.destroyed ||
      this.contextLost ||
      this.graphicsFailed ||
      this.sourcesFrozen ||
      this.hasQueuedSourcesFor(requested) ||
      this.preparedViewGeneration !== this.viewGeneration
    )
      return null;
    const bounds: Bounds[] = requested;
    const areas = bounds
      .map((area) => intersection(area, this.bounds()))
      .filter((area): area is Bounds => area !== null);
    if (!areas.length) return null;
    if (areas.some((area) => !this.hasDisplayCoverage(area))) return null;
    const targets: FrozenTarget[] = [];
    for (const tile of this.tiles.values()) {
      if (
        !tile.visible ||
        !areas.some((area) => intersectsBounds(tile.bounds, area))
      )
        continue;
      if (!this.isPresentationReady(tile.bounds, tile.power)) return null;
      const dirty =
        tile.dirty ??
        (tile.field.preparedVersion !== tile.field.preparationVersion
          ? [...WHOLE]
          : null);
      targets.push({
        tile,
        revision: tile.revision,
        contentVersion: tile.contentVersion,
        preparation: tile.field.preparationVersion,
        dirty: dirty ? ([...dirty] as Rect) : null,
        painted: !dirty && tile.paintedRevision >= tile.revision,
      });
    }
    if (!targets.length) return null;
    this.wantedInfluence = null;
    const receipt = Object.freeze({
      id: this.nextProofId++,
      sessionId: this.sessionId,
      viewGeneration: this.viewGeneration,
      preparationId: this.preparationId,
      revision: this.document.revision,
      bounds: Object.freeze(
        bounds.map((area) => Object.freeze(area) as Bounds),
      ),
    });
    if (areas.every((area) => this.inspectRegion(area).status === "current")) {
      this.completedRender = receipt;
      this.observation.event("render-current", {
        sessionId: this.sessionId,
        frame: this.lastCompletedFrame,
        viewGeneration: this.viewGeneration,
        renderReceipt: receipt,
      });
      return receipt;
    }
    this.frozen = {
      kind: "local",
      receipt,
      targets,
      overviews: new Map(this.overviews),
      landscapes: new Map(
        targets.map(({ tile }) => [
          tile.key,
          this.landscape.freeze(tile.bounds, tile.power),
        ]),
      ),
      surfaces: new Map(
        targets.map(({ tile }) => [
          tile.key,
          this.surfaces.freeze(tile.bounds, tile.power),
        ]),
      ),
    };
    this.checkBudgets();
    this.requestFrame = true;
    return receipt;
  }

  inspectRenderReceipt(
    receipt: FrozenRenderReceipt,
  ): "pending" | "complete" | "invalid" {
    if (
      receipt.sessionId !== this.sessionId ||
      receipt.viewGeneration !== this.viewGeneration ||
      receipt.preparationId !== this.preparationId ||
      this.contextLost ||
      this.graphicsFailed ||
      this.destroyed
    )
      return "invalid";
    if (this.completedRender === receipt) return "complete";
    return this.frozen?.receipt === receipt ? "pending" : "invalid";
  }

  private inspect(bounds: Bounds, completed: boolean): RegionInspection {
    const frame = completed ? this.lastCompletedFrame : this.frame;
    const view = completed
      ? this.lastCompletedViewGeneration
      : this.lastSubmittedViewGeneration;
    const result: RegionInspection = {
      status: "outside",
      sessionId: this.sessionId,
      frame: view < 0 ? 0 : frame,
      viewGeneration: this.viewGeneration,
    };
    const area = intersection(bounds, this.bounds());
    if (!area) return result;
    result.status = "missing";
    if (
      this.contextLost ||
      this.preparedViewGeneration !== this.viewGeneration ||
      this.graphicsFailed ||
      view !== this.viewGeneration ||
      !this.hasDisplayCoverage(area)
    )
      return result;
    if (this.hasQueuedImportsFor([area])) return result;
    let covered = false;
    let current = true;
    for (const tile of this.tiles.values()) {
      if (!tile.visible || !intersectsBounds(tile.bounds, area)) continue;
      covered = true;
      const revision = completed
        ? tile.completedRevision
        : tile.submittedRevision;
      const tileFrame = completed ? tile.completedFrame : tile.submittedFrame;
      const preparation = completed
        ? tile.completedPreparation
        : tile.submittedPreparation;
      if (revision < 0 || tileFrame !== frame) return result;
      const rect = pixelRect(tile, area);
      if (
        revision !== tile.paintedRevision ||
        preparation !== tile.field.preparationVersion ||
        (tile.dirty && overlaps(tile.dirty, rect))
      )
        current = false;
    }
    if (covered) result.status = current ? "current" : "stale";
    return result;
  }

  private hasDisplayCoverage(bounds: Bounds): boolean {
    return heightOverviewKeys(bounds, this.tilePower()).every((key) => {
      const area = heightOverviewBounds(parseHeightOverviewKey(key));
      return (
        !intersection(bounds, area) ||
        Boolean(this.tiles.get(key.slice("height-overview:".length))?.visible)
      );
    });
  }

  sampleLandscapeDisplay(point: Point): LandscapeWeights | null {
    const epsilon = 1e-7;
    const area = clipBounds([
      point[0] - epsilon,
      point[1] - epsilon,
      point[0] + epsilon,
      point[1] + epsilon,
    ]);
    if (
      this.inspectRegion(area).status !== "current" ||
      !this.isLandscapePresentationReady(area)
    )
      return null;
    const tile = [...this.tiles.values()].find(
      (tile) =>
        tile.visible &&
        point[0] >= tile.bounds[0] &&
        point[1] >= tile.bounds[1] &&
        point[0] <= tile.bounds[2] &&
        point[1] <= tile.bounds[3],
    );
    return tile?.field.sampleLandscape(point) ?? null;
  }

  state() {
    const metrics = this.resourceMetrics();
    const preparing = this.observation.enabled
      ? this.frozen?.targets.find((target) => !target.painted)
      : undefined;
    return {
      tiles: this.tiles.size,
      landscape: {
        enabled: this.landscape ? !this.landscape.empty : false,
        ready: this.landscape?.ready(this.bounds(), this.tilePower()) ?? false,
      },
      presentationPower: this.tilePower(),
      presentationBytes: metrics.cpuBytes + this.retainedBufferBytes(),
      gpuBytes: metrics.gpuBytes,
      sourceBytes: metrics.sourceBytes,
      sourceCount: metrics.sourceCount,
      overviewBytes: this.overviews.size * HEIGHT_OVERVIEW_BYTES,
      queuedTiles: [...this.tiles.values()].filter((t) => t.visible && t.dirty)
        .length,
      fallbackTiles: metrics.fallbackTiles,
      fallbackSamples: metrics.fallbackSamples,
      anchoredTiles: metrics.anchoredTiles,
      anchorRebases: metrics.anchorRebases,
      basisTransfers: metrics.basisTransfers,
      pendingUploadBytes: metrics.pendingUploadBytes,
      pendingCompositionTiles: metrics.pendingCompositionTiles,
      submittedRevision: this.submittedRevision,
      submittedViewGeneration: this.submittedViewGeneration,
      lastSubmittedFrame: this.lastSubmittedViewGeneration < 0 ? 0 : this.frame,
      lastSubmittedViewGeneration: this.lastSubmittedViewGeneration,
      viewGeneration: this.viewGeneration,
      lastCompletedFrame: this.lastCompletedFrame,
      lastCompletedViewGeneration: this.lastCompletedViewGeneration,
      gpuPending: this.pendingGpu.length > 0,
      gpuSubmissions: this.pendingGpu.length,
      terrainPending: this.terrainPending,
      scenePending: this.scenePending,
      retiredFields: this.retiredFields.size,
      projectionJobs: this.projections?.metrics().active ?? 0,
      projectionPending: this.projections?.metrics().pending ?? 0,
      preparationId: this.preparationId,
      frozenRevision: this.frozen?.receipt.revision ?? null,
      ...(preparing && {
        frozenPreparation: {
          key: preparing.tile.key,
          kind: this.frozen?.kind,
          ...preparing.tile.field.preparationState(),
        },
      }),
      queuedSourceTiles: this.queuedSources.size,
      queuedOverviewTiles: this.queuedOverviews.size,
      pendingDisplayTiles: this.pendingDisplayTiles,
      fault: this.fault,
      contextLost: this.contextLost,
      graphicsFailed: this.graphicsFailed,
      heldForPointerup: this.heldForPointerup,
    };
  }

  private get heldForPointerup(): boolean {
    return this.fault === "pointerup-render" && Boolean(this.document?.active);
  }

  private positionTiles(): void {
    for (const tile of this.tiles.values()) {
      // Subtract world origin in doubles before Pixi's Float32 GPU transforms.
      tile.field.mesh.position.set(
        (tile.bounds[0] - this.camera.x) * this.camera.scale + this.width / 2,
        (tile.bounds[1] - this.camera.y) * this.camera.scale + this.height / 2,
      );
      tile.field.mesh.width =
        (tile.bounds[2] - tile.bounds[0]) * this.camera.scale;
      tile.field.mesh.height =
        (tile.bounds[3] - tile.bounds[1]) * this.camera.scale;
      tile.field.mesh.visible =
        tile.visible &&
        tile.paintedRevision >= 0 &&
        intersectsBounds(tile.bounds, this.bounds());
    }
  }

  private prioritizedTargets(): FrozenTarget[] {
    const x =
      this.camera.x +
      ((this.cursor?.x ?? this.width / 2) - this.width / 2) / this.camera.scale;
    const y =
      this.camera.y +
      ((this.cursor?.y ?? this.height / 2) - this.height / 2) /
        this.camera.scale;
    const distance = ({ tile }: FrozenTarget) =>
      Math.hypot(
        Math.max(tile.bounds[0] - x, 0, x - tile.bounds[2]),
        Math.max(tile.bounds[1] - y, 0, y - tile.bounds[3]),
      );
    return (this.frozen?.targets ?? [])
      .filter((target) => !target.painted)
      .sort((a, b) => distance(a) - distance(b));
  }

  private targetPrepared(target: FrozenTarget): boolean {
    const tile = target.tile;
    return (
      tile.preparedRevision === target.revision &&
      tile.preparedIntent === target.preparation &&
      tile.preparedContentVersion === target.contentVersion &&
      !tile.field.needsPreparation
    );
  }

  /** Selection is metadata-only; no descriptor, raster or page is prepared here. */
  private freezeBackground(): void {
    if (
      this.sourcesFrozen ||
      this.preparedViewGeneration !== this.viewGeneration
    )
      return;
    if (this.wantedInfluence && this.hasQueuedSourcesFor(this.wantedInfluence))
      return;
    const spacing = heightSpacing(this.field.toolLevel);
    const localX =
      this.camera.x +
      ((this.cursor?.x ?? this.width / 2) - this.width / 2) / this.camera.scale;
    const localY =
      this.camera.y +
      ((this.cursor?.y ?? this.height / 2) - this.height / 2) /
        this.camera.scale;
    const radius =
      (this.cursor ? this.cursor.radius / this.camera.scale : 8 * spacing) +
      2 * spacing;
    if (
      this.hasQueuedSourcesFor([
        clipBounds([
          localX - radius,
          localY - radius,
          localX + radius,
          localY + radius,
        ]),
      ])
    )
      return;
    const exception = this.exceptionTarget;
    if (exception) {
      const { target, receipt, overview, landscape, surface } = exception;
      if (target.preparation !== target.tile.field.preparationVersion) {
        this.exceptionTarget = null;
      } else if (
        !target.tile.field.waitingProjection ||
        !target.tile.field.hasProjectionTask
      ) {
        this.frozen = {
          kind: "background",
          receipt,
          targets: [target],
          overviews: new Map(overview ? [[overview.key, overview]] : []),
          landscapes: new Map([[target.tile.key, landscape]]),
          surfaces: new Map([[target.tile.key, surface]]),
        };
        this.exceptionTarget = null;
        return;
      }
    }
    const targets: FrozenTarget[] = [];
    for (const tile of this.tiles.values()) {
      if (!tile.visible) continue;
      if (this.preparationFailed(tile)) continue;
      if (
        this.exceptionTarget?.target.tile === tile ||
        (this.exceptionTarget && tile.field.fallback) ||
        (tile.field.waitingProjection &&
          (this.projections?.metrics().active ?? 0) > 0)
      )
        continue;
      if (
        !tile.dirty &&
        tile.field.preparedVersion !== tile.field.preparationVersion
      )
        tile.dirty = [...WHOLE];
      if (
        !tile.dirty ||
        !this.isPresentationReady(tile.bounds, tile.power) ||
        this.hasQueuedSourcesFor([tile.bounds])
      )
        continue;
      targets.push({
        tile,
        revision: tile.revision,
        contentVersion: tile.contentVersion,
        preparation: tile.field.preparationVersion,
        dirty: [...tile.dirty],
        painted: false,
      });
    }
    if (!targets.length) return;
    // Finish one local background target before freezing any remote work.
    targets.sort(
      (a, b) =>
        this.sourceDistance(a.tile.bounds) - this.sourceDistance(b.tile.bounds),
    );
    targets.splice(1);
    this.frozen = {
      kind: "background",
      receipt: Object.freeze({
        id: this.nextProofId++,
        sessionId: this.sessionId,
        viewGeneration: this.viewGeneration,
        preparationId: this.preparationId,
        revision: this.document.revision,
        bounds: Object.freeze(targets.map(({ tile }) => tile.bounds)),
      }),
      targets,
      overviews: new Map(this.overviews),
      landscapes: new Map(
        targets.map(({ tile }) => [
          tile.key,
          this.landscape.freeze(tile.bounds, tile.power),
        ]),
      ),
      surfaces: new Map(
        targets.map(({ tile }) => [
          tile.key,
          this.surfaces.freeze(tile.bounds, tile.power),
        ]),
      ),
    };
  }

  private pinGpu(
    kind: GpuSubmission["kind"],
    tiles: GpuSubmission["tiles"],
    submission: FrameSubmission | null = null,
    renderReceipt: FrozenRenderReceipt | null = null,
  ): number | undefined {
    if (
      this.pendingGpu.length >= editorBudgets.glSubmissions ||
      this.pendingGpu.some((pending) => pending.kind === kind)
    )
      throw new Error("Das Grafik-Arbeitspaket hat keinen freien Platz.");
    const gl = this.renderer.gl;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.graphicsFailed = true;
      this.unfencedWork = true;
      this.unfencedField = this.field;
      this.invalidateGpuSubmission(false);
      throw new Error("Der Grafikabschluss konnte nicht verfolgt werden.");
    }
    gl.flush();
    this.pendingGpu.push({
      kind,
      sync,
      field: this.field,
      submission,
      tiles,
      renderReceipt,
      notBefore:
        this.fault === "delay-feedback" && this.faultArmed
          ? performance.now() + 400
          : 0,
    });
    return this.observation.gpuFence(sync, kind);
  }

  /** Each RAF selects first, then spends a bounded preparation and terrain packet. */
  prepareFrame(): boolean {
    this.preparationStarted = performance.now();
    this.preparationDeadline =
      this.preparationStarted + editorBudgets.preparationMsPerFrame;
    this.preparationSteps =
      this.contextLost || this.graphicsFailed || this.destroyed
        ? 0
        : this.drainSources(
            this.preparationDeadline,
            editorBudgets.preparationStepsPerFrame,
          );
    const sourceSteps = this.preparationSteps;
    // A session replacement cannot cancel WebCrypto. Its previous input keeps
    // the shared derivation slot until settlement, including its byte charge.
    for (const surface of this.retiredSurfaces)
      if (!surface.pendingDigest) this.retiredSurfaces.delete(surface);
    if (
      !this.contextLost &&
      !this.graphicsFailed &&
      !this.destroyed &&
      this.surfaces
    ) {
      this.surfaces.sync(this.bounds(), this.camera.scale);
      if (
        !this.retiredSurfaces.size &&
        this.surfaces.pending &&
        this.reservePreparation(null, this.surfaces.nextPreparationBytes)
      )
        this.preparationSteps += this.surfaces.step(
          Math.min(this.preparationDeadline, performance.now() + 0.5),
          Math.min(
            32,
            editorBudgets.preparationStepsPerFrame - this.preparationSteps,
          ),
        );
    }
    this.preparationRecord = {
      id: ++this.preparationSerial,
      at: this.preparationStarted,
      ms: performance.now() - this.preparationStarted,
      steps: this.preparationSteps,
      sourceSteps,
    };
    this.framePrepared = true;
    return this.preparationSteps > 0;
  }

  /** Also records source-only / preparation-only RAFs; none disappear from the gate. */
  finishFrame(): void {
    const record = this.preparationRecord;
    if (!record) return;
    if (!this.observation.enabled) {
      this.preparationRecord = null;
      return;
    }
    const resources = this.resourceMetrics();
    this.observation.event("height-preparation", {
      sessionId: this.sessionId,
      preparationFrame: record.id,
      preparationStart: record.at,
      preparationMs: record.ms,
      preparationSteps: record.steps,
      sourceSteps: record.sourceSteps,
      ...resources,
      presentationBytes: resources.cpuBytes + this.retainedBufferBytes(),
    });
    this.preparationRecord = null;
  }

  private recordPreparation(ms: number, steps: number): void {
    if (!this.preparationRecord) return;
    this.preparationRecord.ms = ms;
    this.preparationRecord.steps = steps;
  }

  renderFrame(now: number): FrameSubmission | null {
    if (!this.framePrepared) this.prepareFrame();
    this.framePrepared = false;
    if (
      this.destroyed ||
      this.contextLost ||
      this.graphicsFailed ||
      !this.document ||
      (!this.requestFrame && !this.sceneRequested)
    )
      return null;
    if (
      this.heldForPointerup ||
      (this.faultArmed &&
        (this.fault === "drop-render" ||
          (this.fault === "delay-render" && now < this.delayUntil)))
    )
      return null;
    if (this.interruptBackground && !this.terrainPending) {
      this.abandonFrozen();
    }
    this.freezeBackground();
    const group = this.frozen;
    let uploaded = 0;
    let composedSamples = 0;
    let work = 0;
    let preparationSteps = this.preparationSteps;
    let preparationMs = performance.now() - this.preparationStarted;
    let updatedTiles = 0;
    let uploadStart = performance.now();
    let uploadedAt = uploadStart;
    const uploadSpans: { start: number; end: number; bytes: number }[] = [];
    const compositionSpans: { start: number; end: number; work: number }[] = [];
    const composition: HeightCompositionStats = {
      canonicalSamples: 0,
      deltaSamples: 0,
      colourSamples: 0,
      anchorCopySamples: 0,
      basisCaptureSamples: 0,
      canonicalBasisBuilds: 0,
      horizontalSamples: 0,
      projectionProducts: 0,
    };

    if (group) {
      const preparationStart = this.preparationStarted;
      const deadline = this.preparationDeadline;
      const reserve = this.preparationReservation();
      const targets = this.prioritizedTargets();
      const warmBatch =
        group.kind === "local" &&
        targets.every(({ tile }) => tile.field.hasActiveBasis);
      let reservationBlocked = false;
      for (const target of targets) {
        const tile = target.tile;
        // A scene only reads the retained colour targets. CPU preparation of
        // another packet may proceed while that scene waits. A terrain packet
        // still owns all of its selected resources until its real fence ends.
        if (
          this.pendingGpu.some(
            (pending) =>
              pending.kind === "terrain" &&
              pending.tiles.some((reference) => reference.tile === tile),
          )
        )
          continue;
        if (
          performance.now() >= deadline ||
          preparationSteps >= editorBudgets.preparationStepsPerFrame
        )
          break;
        if (
          tile.preparedRevision !== target.revision ||
          tile.preparedIntent !== target.preparation ||
          tile.preparedContentVersion !== target.contentVersion
        ) {
          const overview =
            group.overviews.get(`height-overview:${tile.key}`) ?? null;
          tile.field.setLandscape(group.landscapes.get(tile.key) ?? null);
          tile.field.setSurface(group.surfaces.get(tile.key) ?? null);
          tile.field.update(
            overview === tile.overview ? undefined : overview,
            target.dirty ?? WHOLE,
            group.kind === "local" ? "local" : "background",
          );
          tile.overview = overview;
          tile.preparedRevision = target.revision;
          tile.preparedIntent = target.preparation;
          tile.preparedContentVersion = target.contentVersion;
        }
        // Consecutive synchronous generator steps share the same peak reserve.
        // Recheck on every changed requirement (notably atlas growth / worker
        // hydration), another tile or RAF. No job callback can interleave here.
        let reserved: { cpuBytes: number; gpuBytes: number } | null = null;
        let failed = false;
        while (
          tile.field.needsPreparation &&
          performance.now() < deadline &&
          preparationSteps < editorBudgets.preparationStepsPerFrame
        ) {
          const nextReserve = tile.field.nextPreparationBytes;
          if (
            !reserved ||
            nextReserve?.cpuBytes !== reserved.cpuBytes ||
            nextReserve?.gpuBytes !== reserved.gpuBytes
          ) {
            if (!reserve(tile, nextReserve)) {
              reservationBlocked = true;
              break;
            }
            reserved = nextReserve;
          }
          preparationSteps++;
          try {
            if (!tile.field.prepareStep()) break;
          } catch (error) {
            if (group.kind !== "background") throw error;
            // An unrelated failed exception must not hold the frozen sources
            // needed to prepare a new local foundation. Keep its dirty work,
            // and retry only changed inputs or the explicit retry action.
            tile.failedPreparation = {
              revision: target.revision,
              contentVersion: target.contentVersion,
              preparation: target.preparation,
            };
            tile.field.cancelPreparation();
            tile.preparedRevision = -1;
            tile.preparedIntent = -1;
            group.targets = group.targets.filter(
              (candidate) => candidate !== target,
            );
            if (!group.targets.length && this.frozen === group)
              this.frozen = null;
            this.onError(
              error instanceof Error ? error : new Error(String(error)),
            );
            failed = true;
            break;
          }
        }
        if (failed) continue;
        if (group.kind === "background" && tile.field.waitingProjection) {
          if (tile.field.hasProjectionTask && !this.exceptionTarget)
            this.exceptionTarget = {
              target,
              overview:
                group.overviews.get(`height-overview:${tile.key}`) ?? null,
              landscape: group.landscapes.get(tile.key) ?? null,
              surface: group.surfaces.get(tile.key) ?? null,
              receipt: Object.freeze({
                ...group.receipt,
                bounds: Object.freeze([tile.bounds]),
              }),
            };
          else if (this.exceptionTarget?.target !== target) {
            tile.field.cancelPreparation();
            tile.preparedRevision = -1;
            tile.preparedIntent = -1;
          }
          group.targets = group.targets.filter(
            (candidate) => candidate !== target,
          );
          if (!group.targets.length) this.frozen = null;
          continue;
        }
      }
      // Selection is metadata-only and is not cut off by the preparation clock.
      // A normal warm influence fits one work packet: do not submit its prefix
      // just because preparation needed another RAF. Real memory pressure and
      // cold/exception work retain their bounded, progressive path.
      const selected = this.prioritizedTargets().filter((target) =>
        this.targetPrepared(target),
      );
      const completeWarmPreparation =
        !warmBatch ||
        reservationBlocked ||
        group.targets.every(
          (target) => target.painted || this.targetPrepared(target),
        );
      preparationMs = performance.now() - preparationStart;
      this.recordPreparation(preparationMs, preparationSteps);
      this.checkBudgets();
      if (
        selected.length &&
        completeWarmPreparation &&
        !this.terrainPending &&
        this.pendingGpu.length < editorBudgets.glSubmissions
      ) {
        try {
          uploadStart = performance.now();
          uploaded = this.field.flush(
            editorBudgets.uploadBytesPerFrame,
            selected.map((target) => target.tile.field),
          );
          uploadedAt = performance.now();
          uploadSpans.push({
            start: uploadStart,
            end: uploadedAt,
            bytes: uploaded,
          });
          let terrainWork = this.field.lastFlushHadWork || uploaded > 0;
          for (const target of selected) {
            const tile = target.tile;
            while (tile.field.uploadReady && tile.field.needsComposition) {
              const cost = tile.field.compositionWork;
              if (cost > editorBudgets.compositionWorkPerFrame)
                throw new Error(
                  "Ein Höhen-Teilschritt überschreitet das Grafik-Arbeitspaket.",
                );
              if (work + cost > editorBudgets.compositionWorkPerFrame) break;
              work += cost;
              const compositionStart = performance.now();
              const samples = tile.field.drawDirty(this.renderer);
              compositionSpans.push({
                start: compositionStart,
                end: performance.now(),
                work: cost,
              });
              composedSamples += samples;
              terrainWork ||= cost > 0;
              for (const key of Object.keys(
                composition,
              ) as (keyof HeightCompositionStats)[])
                composition[key] += tile.field.compositionStats[key];
              if (
                !tile.field.needsComposition &&
                !tile.field.needsPreparation
              ) {
                tile.paintedRevision = target.revision;
                target.painted = true;
                if (target.contentVersion === tile.contentVersion)
                  tile.dirty = null;
                tile.field.mesh.visible = true;
                updatedTiles++;
                break;
              }
              if (
                preparationMs >= editorBudgets.preparationMsPerFrame ||
                preparationSteps >= editorBudgets.preparationStepsPerFrame
              )
                break;
              const stepStart = performance.now();
              if (!reserve(tile, tile.field.nextPreparationBytes)) break;
              preparationSteps++;
              const progressed = tile.field.prepareStep();
              preparationMs += performance.now() - stepStart;
              this.recordPreparation(preparationMs, preparationSteps);
              if (!progressed || tile.field.needsPreparation) break;
              const nextUploadStart = performance.now();
              const nextUploaded = this.field.flush(
                editorBudgets.uploadBytesPerFrame - uploaded,
                [tile.field],
              );
              uploaded += nextUploaded;
              terrainWork ||= this.field.lastFlushHadWork;
              uploadedAt = performance.now();
              uploadSpans.push({
                start: nextUploadStart,
                end: uploadedAt,
                bytes: nextUploaded,
              });
            }
          }
          if (terrainWork) {
            // Upload-only packets occupy the same terrain slot and always fence.
            const fenceId = this.pinGpu(
              "terrain",
              selected.map(({ tile, revision, preparation }) => ({
                tile,
                revision,
                preparation,
              })),
            );
            this.sceneRequested = true;
            this.observation.event("height-terrain", {
              fenceId,
              preparationFrame: this.preparationRecord?.id,
              packet: ++this.terrainPacketId,
              renderId: group.receipt.id,
              uploadStart,
              uploadedAt,
              submittedAt: performance.now(),
              uploadSpans,
              compositionSpans,
              updatedTiles,
              gpuSubmissions: this.pendingGpu.length,
              terrainSubmissions: Number(this.terrainPending),
              sceneSubmissions: Number(this.scenePending),
              ...this.resourceMetrics(),
              presentationBytes:
                this.resourceMetrics().cpuBytes + this.retainedBufferBytes(),
              sessionId: this.sessionId,
              viewGeneration: this.viewGeneration,
              revision: group.receipt.revision,
              preparationMs,
              preparationSteps,
              uploadedBytes: uploaded,
              composedSamples,
              compositionWork: work,
              ...composition,
            });
          }
        } catch (error) {
          // A failed upload/draw may already have submitted a prefix. Keep its
          // resources and terrain slot until that real prefix has ended.
          if (!this.terrainPending && !this.graphicsFailed)
            this.pinGpu(
              "terrain",
              selected.map(({ tile, revision, preparation }) => ({
                tile,
                revision,
                preparation,
              })),
            );
          throw error;
        }
      }
    }
    this.requestFrame =
      Boolean(this.frozen) ||
      this.queuedSources.size > 0 ||
      this.queuedOverviews.size > 0 ||
      [...this.tiles.values()].some(
        (tile) =>
          tile.visible &&
          tile.dirty &&
          !this.preparationFailed(tile) &&
          this.isPresentationReady(tile.bounds, tile.power),
      );
    // Camera-only draws can use complete cached colour while the terrain slot waits.
    if (
      this.scenePending ||
      this.pendingGpu.length >= editorBudgets.glSubmissions ||
      !this.sceneRequested
    )
      return null;
    const sceneStart = performance.now();
    try {
      if (this.resizePending) {
        this.renderer.resize(this.width, this.height, devicePixelRatio);
        this.resizePending = false;
      }
      this.drawOverlay();
      this.houses.draw(
        this.document,
        this.camera,
        this.bounds(),
        this.width,
        this.height,
        (bytes) =>
          this.reservePreparation(null, { cpuBytes: bytes, gpuBytes: bytes }),
      );
      this.renderer.render(this.stage);
    } catch (error) {
      if (!this.scenePending && !this.graphicsFailed)
        this.pinGpu(
          "scene",
          [...this.tiles.values()]
            .filter((tile) => tile.visible && tile.paintedRevision >= 0)
            .map((tile) => ({
              tile,
              revision: tile.paintedRevision,
              preparation: tile.field.preparedVersion,
            })),
        );
      throw error;
    }
    let submittedAt = performance.now();
    this.frame++;
    this.lastSubmittedViewGeneration = this.viewGeneration;
    this.sceneRequested = false;
    const visible = [...this.tiles.values()].filter(
      (tile) => tile.visible && tile.paintedRevision >= 0,
    );
    for (const tile of visible) {
      tile.submittedRevision = tile.paintedRevision;
      tile.submittedFrame = this.frame;
      tile.submittedPreparation = tile.field.preparedVersion;
    }
    const exact =
      !this.hasQueuedSourcesFor([this.bounds()]) &&
      this.hasDisplayCoverage(this.bounds()) &&
      this.preparedViewGeneration === this.viewGeneration &&
      [...this.tiles.values()]
        .filter((tile) => tile.visible)
        .every((tile) => tile.paintedRevision >= tile.revision && !tile.dirty);
    const exactRevision =
      exact && this.tiles.size ? this.document.revision : -1;
    if (exactRevision >= 0) {
      this.submittedRevision = exactRevision;
      this.submittedViewGeneration = this.viewGeneration;
    }
    const submission: FrameSubmission = {
      sessionId: this.sessionId,
      frame: this.frame,
      viewGeneration: this.viewGeneration,
      revision: group?.receipt.revision ?? this.document.revision,
      exactRevision,
      at: submittedAt,
      uploadedBytes: uploaded,
    };
    const fenceId = this.pinGpu(
      "scene",
      visible.map((tile) => ({
        tile,
        revision: tile.paintedRevision,
        preparation: tile.field.preparedVersion,
      })),
      submission,
      group &&
        this.frozen === group &&
        group.targets.length > 0 &&
        group.targets.every(
          (target) =>
            target.painted &&
            target.tile.field.preparedVersion === target.preparation,
        )
        ? group.receipt
        : null,
    );
    submittedAt = performance.now();
    submission.at = submittedAt;
    this.observation.event("height-draw", {
      fenceId,
      preparationFrame: this.preparationRecord?.id,
      renderId: group?.receipt.id ?? null,
      sceneStart,
      gpuSubmissions: this.pendingGpu.length,
      terrainSubmissions: Number(this.terrainPending),
      sceneSubmissions: Number(this.scenePending),
      sessionId: this.sessionId,
      frame: this.frame,
      viewGeneration: this.viewGeneration,
      revision: submission.revision,
      uploadStart,
      uploadedAt,
      submittedAt,
      uploadedBytes: uploaded,
      updatedTiles,
      composedSamples,
      ...composition,
      compositionWork: work,
      preparationMs,
      preparationSteps,
      ...this.field.metrics(),
    });
    return submission;
  }

  private reservePreparation(
    tile: DisplayTile | null,
    reserve = tile?.field.nextPreparationBytes,
  ): boolean {
    if (!reserve) return true;
    const metrics = this.resourceMetrics();
    if (
      metrics.cpuBytes + this.retainedBufferBytes() + reserve.cpuBytes <=
        editorBudgets.presentationBytes &&
      metrics.gpuBytes + reserve.gpuBytes <= editorBudgets.gpuBytes
    )
      return true;
    // Evict only unreferenced cold representations. Accepted author work stays owned by the document.
    for (const cold of [...this.tiles.values()]
      .filter((candidate) => !candidate.visible && !this.tilePinned(candidate))
      .sort((a, b) => a.touched - b.touched)) {
      this.tiles.delete(cold.key);
      this.destroyTile(cold);
      const after = this.resourceMetrics();
      if (
        after.cpuBytes + this.retainedBufferBytes() + reserve.cpuBytes <=
          editorBudgets.presentationBytes &&
        after.gpuBytes + reserve.gpuBytes <= editorBudgets.gpuBytes
      )
        return true;
    }
    return false;
  }

  /**
   * A synchronous preparation batch owns conservative peak allowances. Reuse
   * one inventory instead of walking every resident tile for every small step.
   * Each target keeps its largest allowance until this call returns; releases
   * are deliberately not credited. No callback can allocate between steps.
   */
  private preparationReservation(): (
    tile: DisplayTile,
    reserve: { cpuBytes: number; gpuBytes: number },
  ) => boolean {
    const inventory = () => {
      const metrics = this.resourceMetrics();
      return {
        cpuBytes: metrics.cpuBytes + this.retainedBufferBytes(),
        gpuBytes: metrics.gpuBytes,
      };
    };
    let charged = inventory();
    const allowances = new Map<
      DisplayTile,
      { cpuBytes: number; gpuBytes: number }
    >();
    return (tile, reserve) => {
      const previous = allowances.get(tile);
      const allowance = {
        cpuBytes: Math.max(previous?.cpuBytes ?? 0, reserve.cpuBytes),
        gpuBytes: Math.max(previous?.gpuBytes ?? 0, reserve.gpuBytes),
      };
      let next = {
        cpuBytes:
          charged.cpuBytes + allowance.cpuBytes - (previous?.cpuBytes ?? 0),
        gpuBytes:
          charged.gpuBytes + allowance.gpuBytes - (previous?.gpuBytes ?? 0),
      };
      if (
        next.cpuBytes > editorBudgets.presentationBytes ||
        next.gpuBytes > editorBudgets.gpuBytes
      ) {
        // A conservative estimate can exhaust a batch before real memory does.
        // Reconcile actual allocations and use the ordinary cold eviction gate.
        if (!this.reservePreparation(tile, reserve)) return false;
        const current = inventory();
        allowances.clear();
        allowance.cpuBytes = reserve.cpuBytes;
        allowance.gpuBytes = reserve.gpuBytes;
        next = {
          cpuBytes: current.cpuBytes + reserve.cpuBytes,
          gpuBytes: current.gpuBytes + reserve.gpuBytes,
        };
      }
      allowances.set(tile, allowance);
      charged = next;
      return true;
    };
  }

  private resourceMetrics() {
    const metrics = this.field.metrics();
    for (const field of this.retiredFields) {
      const held = field.metrics();
      metrics.cpuBytes += held.cpuBytes;
      metrics.gpuBytes += held.gpuBytes;
      metrics.sourceBytes += held.sourceBytes;
    }
    if (this.projections) metrics.cpuBytes += this.projections.metrics().bytes;
    metrics.cpuBytes += this.extraComputeBytes();
    metrics.cpuBytes += this.surfaces?.retainedMetadataBytes ?? 0;
    for (const surface of this.retiredSurfaces)
      metrics.cpuBytes += surface.retainedMetadataBytes;
    metrics.cpuBytes += this.houses.bytes;
    metrics.gpuBytes += this.houses.bytes;
    return metrics;
  }

  private tilePinned(tile: DisplayTile): boolean {
    return (
      this.unfencedField === this.field ||
      this.exceptionTarget?.target.tile === tile ||
      Boolean(this.frozen?.targets.some((target) => target.tile === tile)) ||
      this.pendingGpu.some((pending) =>
        pending.tiles.some((reference) => reference.tile === tile),
      )
    );
  }

  /** FIFO, zero-timeout polls: a cancelled result never frees still-running GPU work. */
  pollCompletion(): FrameSubmission | null {
    if (this.contextLost || this.destroyed) return null;
    let completed: FrameSubmission | null = null;
    const gl = this.renderer.gl;
    while (this.pendingGpu.length) {
      const pending = this.pendingGpu[0];
      if (performance.now() < pending.notBefore) break;
      const status = gl.clientWaitSync(pending.sync, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) break;
      if (status !== gl.ALREADY_SIGNALED && status !== gl.CONDITION_SATISFIED) {
        this.graphicsFailed = true;
        this.invalidateGpuSubmission(false);
        throw new Error(
          "Der Grafikabschluss ist fehlgeschlagen; Darstellung wird neu aufgebaut.",
        );
      }
      gl.deleteSync(pending.sync);
      this.pendingGpu.shift();
      const submission = pending.submission;
      if (
        !submission ||
        submission.sessionId !== this.sessionId ||
        this.graphicsFailed
      )
        continue;
      completed = submission;
      this.lastCompletedFrame = submission.frame;
      this.lastCompletedViewGeneration = submission.viewGeneration;
      for (const { tile, revision, preparation } of pending.tiles) {
        tile.completedRevision = revision;
        tile.completedFrame = submission.frame;
        tile.completedPreparation = preparation;
      }
      const receipt =
        pending.renderReceipt && this.frozen?.receipt === pending.renderReceipt
          ? pending.renderReceipt
          : null;
      if (receipt) {
        if (this.frozen?.kind === "local") this.completedRender = receipt;
        this.frozen = null;
      }
      this.observation.event("gpu-completed", {
        sessionId: submission.sessionId,
        frame: submission.frame,
        viewGeneration: submission.viewGeneration,
        revision: submission.revision,
        submittedAt: submission.at,
        renderReceipt: receipt,
      });
    }
    for (const field of this.retiredFields) {
      if (field === this.unfencedField) continue;
      if (this.pendingGpu.some((pending) => pending.field === field)) continue;
      field.destroy();
      this.retiredFields.delete(field);
    }
    if (this.graphicsFailed && !this.unfencedWork && !this.pendingGpu.length) {
      for (const tile of this.tiles.values()) tile.field.invalidateGPU();
      this.graphicsFailed = false;
      this.requestFrame = true;
      this.sceneRequested = true;
    }
    if (this.interruptBackground && !this.terrainPending) this.abandonFrozen();
    this.prune();
    if (this.pendingDisplayTiles) this.refresh();
    return completed;
  }

  /** Only context loss/destruction invalidates the actual commands as well. */
  private releaseFence(): void {
    for (const pending of this.pendingGpu)
      this.renderer.gl.deleteSync(pending.sync);
    this.pendingGpu.length = 0;
    this.unfencedField = null;
    this.unfencedWork = false;
    for (const field of this.retiredFields) field.destroy();
    this.retiredFields.clear();
  }

  private drawOverlay(prepared: ReadonlySet<DisplayTile> = new Set()): void {
    this.overlay.clear();
    // Missing current-scale terrain remains visibly loading until its complete
    // resource set has been uploaded and composed, even without a pointer.
    const view = this.bounds();
    const loading =
      this.preparedViewGeneration !== this.viewGeneration
        ? [view]
        : [...this.tiles.values()]
            .filter(
              (tile) =>
                tile.visible && tile.paintedRevision < 0 && !prepared.has(tile),
            )
            .map((tile) => intersection(tile.bounds, view))
            .filter((area): area is Bounds => area !== null);
    for (const area of loading) {
      const left =
        (area[0] - this.camera.x) * this.camera.scale + this.width / 2;
      const top =
        (area[1] - this.camera.y) * this.camera.scale + this.height / 2;
      const right =
        (area[2] - this.camera.x) * this.camera.scale + this.width / 2;
      const bottom =
        (area[3] - this.camera.y) * this.camera.scale + this.height / 2;
      for (let x = left - (bottom - top); x < right; x += 24) {
        const x0 = Math.max(left, x);
        const x1 = Math.min(right, x + bottom - top);
        this.overlay.moveTo(x0, top + x0 - x).lineTo(x1, top + x1 - x);
      }
    }
    this.overlay.stroke({ color: 0xc9d2d4, width: 1, alpha: 0.2 });
    if (this.grid) {
      const step =
        5 *
        2 ** Math.max(0, Math.ceil(Math.log2(70 / (5 * this.camera.scale))));
      for (let x = Math.ceil(view[0] / step) * step; x < view[2]; x += step) {
        const px = (x - this.camera.x) * this.camera.scale + this.width / 2;
        this.overlay.moveTo(px, 0).lineTo(px, this.height);
      }
      for (let y = Math.ceil(view[1] / step) * step; y < view[3]; y += step) {
        const py = (y - this.camera.y) * this.camera.scale + this.height / 2;
        this.overlay.moveTo(0, py).lineTo(this.width, py);
      }
      this.overlay.stroke({ color: 0xe7dec9, width: 1, alpha: 0.13 });
    }
  }

  private prune(): void {
    const removable = [...this.tiles.values()]
      .filter((tile) => !tile.visible && !this.tilePinned(tile))
      .sort((a, b) => a.touched - b.touched);
    while (this.tiles.size > editorBudgets.retainedTiles && removable.length) {
      const tile = removable.shift()!;
      this.tiles.delete(tile.key);
      this.destroyTile(tile);
    }
    if (
      [...this.tiles.values()].filter((tile) => tile.visible).length >
      editorBudgets.retainedTiles
    )
      this.onError(
        new Error(
          "Der sichtbare Ausschnitt überschreitet das Darstellungsbudget.",
        ),
      );
  }

  private pruneOverviews(requested: readonly string[]): void {
    const keep = new Set([
      ...requested,
      ...[...this.tiles.keys()].map((key) => `height-overview:${key}`),
    ]);
    for (const key of this.knownOverviews) {
      if (keep.has(key)) continue;
      this.knownOverviews.delete(key);
      this.overviews.delete(key);
    }
  }

  private destroyTile(tile: DisplayTile): void {
    this.terrain.removeChild(tile.field.mesh);
    tile.field.destroy();
  }

  destroy(): void {
    this.surfaces?.destroy();
    this.releaseFence();
    this.invalidateProofs();
    this.resetSourceQueue();
    this.destroyed = true;
    this.cursorOverlay?.destroy();
    this.canvas?.removeEventListener(
      "webglcontextlost",
      this.handleContextLost,
    );
    this.canvas?.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    for (const tile of this.tiles.values()) this.destroyTile(tile);
    this.field.destroy();
    this.renderer.destroy();
  }
}
