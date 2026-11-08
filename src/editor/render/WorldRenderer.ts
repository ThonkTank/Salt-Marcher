import {
  BufferImageSource,
  Container,
  Graphics,
  Sprite,
  Texture,
  WebGLRenderer,
} from "pixi.js";
// Pixi's static uniform-sync implementation works with the strict desktop CSP.
import "pixi.js/unsafe-eval";
import { editorBudgets } from "../budgets";
import {
  cloneHeightTile,
  clipBounds,
  HEIGHT_LEVELS,
  intersectsBounds,
  type Bounds,
  type EditorDocument,
  type HeightPatch,
  type HeightTile,
} from "../model";
import {
  HEIGHT_OVERVIEW_BYTES,
  HEIGHT_OVERVIEW_SIZE,
  applyPreparedHeightOverviewDelta,
  createHeightOverviewTile,
  heightOverviewDeltaKeys,
  heightOverviewBounds,
  heightOverviewKeys,
  minimumCoarseHeightLevel,
  parseHeightOverviewKey,
  prepareHeightOverviewDelta,
  validateHeightOverviewTile,
  type HeightOverviewTile,
} from "../model/overview";
import { Observation } from "../observation";
import { MAX_RASTER_BATCH_PIXELS, MAX_RASTER_BATCH_TILES } from "./raster";
import type {
  RasterBatch,
  RasterBatchResult,
  RasterMessage,
  RasterResult,
  RasterTask,
} from "./raster.worker";

export interface Camera {
  x: number;
  y: number;
  scale: number;
}
type Rect = [number, number, number, number];
interface RasterTile {
  key: string;
  bounds: Bounds;
  power: number;
  token: number;
  revision: number;
  dirty: Rect | null;
  pending: RasterTask | null;
  lastJob: number;
  /** Whole-tile prefix: every changed rectangle through this revision is painted. */
  paintedRevision: number;
  /** Uploaded content actually included in a renderer submission. */
  submittedRevision: number;
  submittedFrame: number;
  visible: boolean;
  touched: number;
  source: BufferImageSource;
  sprite: Sprite;
  pixels: Uint8Array;
}
const SIZE = HEIGHT_OVERVIEW_SIZE;
const WHOLE: Rect = [0, 0, SIZE, SIZE];
const LOCAL_BATCHES_BEFORE_VIEW_PROGRESS = 4;
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

function pixelRect(tile: RasterTile, bounds: Bounds): Rect {
  const stepX = (tile.bounds[2] - tile.bounds[0]) / SIZE;
  const stepY = (tile.bounds[3] - tile.bounds[1]) / SIZE;
  return [
    Math.max(0, Math.floor((bounds[0] - tile.bounds[0]) / stepX)),
    Math.max(0, Math.floor((bounds[1] - tile.bounds[1]) / stepY)),
    Math.min(SIZE, Math.ceil((bounds[2] - tile.bounds[0]) / stepX)),
    Math.min(SIZE, Math.ceil((bounds[3] - tile.bounds[1]) / stepY)),
  ];
}

/** Retained display tiles. Camera transforms never read or write the store. */
export class WorldRenderer {
  readonly renderer = new WebGLRenderer();
  private stage = new Container();
  private terrain = new Container();
  private overlay = new Graphics();
  private tiles = new Map<string, RasterTile>();
  private raster = new Worker(new URL("./raster.worker.ts", import.meta.url), {
    type: "module",
  });
  private results: RasterResult[] = [];
  private running: RasterBatch | null = null;
  private sourceSizes = new Map<string, number>();
  private overviews = new Map<string, HeightOverviewTile>();
  private knownOverviews = new Set<string>();
  private jobId = 0;
  private tileToken = 0;
  private document!: EditorDocument;
  private sessionId = "";
  private animation = 0;
  private frame = 0;
  private viewGeneration = 0;
  private preparedViewGeneration = -1;
  private lastSubmittedViewGeneration = -1;
  private focusBounds: Bounds | null = null;
  private feedbackBounds: Bounds | null = null;
  private localBatches = 0;
  private requestFrame = true;
  private lastFrameAt = 0;
  private lastSubmit = "";
  private pendingDelay = new Set<number>();
  private destroyed = false;
  private submittedRevision = -1;
  private submittedViewGeneration = -1;
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
    | "ignore-zoom"
    | "pointerup-render" = "none";
  private faultArmed = false;
  maxRasterMs = 0;
  maxRasterBatchMs = 0;
  sourceBytes = 0;
  workerSourceBytes = 0;
  totalSamples = 0;
  frameCpuMax = 0;
  advanceFrame: (now: number) => void = () => {};
  onExact: (revision: number) => void = () => {};
  onSubmit: (frame: number) => void = () => {};
  onError: (error: Error) => void = () => {};

  constructor(private observation: Observation) {
    this.stage.addChild(this.terrain, this.overlay);
    this.terrain.sortableChildren = true;
    this.raster.onmessage = (event: MessageEvent<RasterBatchResult>) => {
      const batch = event.data;
      if (this.running?.id === batch.id) this.running = null;
      if (batch.sessionId !== this.sessionId) return;
      this.observation.event("raster-batch-result", {
        id: batch.id,
        tiles: batch.results.length,
        cpuMs: batch.cpuMs,
      });
      for (const result of batch.results) {
        this.observation.event("raster-result", {
          id: result.id,
          batchId: batch.id,
          key: result.key,
          rect: result.rect,
          cpuMs: result.cpuMs,
          pixels: result.samples,
        });
        this.maxRasterMs = Math.max(this.maxRasterMs, result.cpuMs);
        this.totalSamples += result.samples;
      }
      if (this.faultArmed && this.fault === "delay-render") {
        const timer = window.setTimeout(() => {
          this.pendingDelay.delete(timer);
          this.results.push(...batch.results);
          this.requestFrame = true;
        }, 250);
        this.pendingDelay.add(timer);
      } else this.results.push(...batch.results);
      this.maxRasterBatchMs = Math.max(this.maxRasterBatchMs, batch.cpuMs);
      this.requestFrame = true;
      // Apply completed rectangles before selecting the next batch, so newly
      // dirty local regions outrank loading unrelated, previously blank tiles.
    };
    this.raster.onerror = (event) => this.onError(new Error(event.message));
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
    this.animation = requestAnimationFrame(this.tick);
  }

  reset(document: EditorDocument): void {
    this.document = document;
    this.sessionId = document.sessionId;
    for (const tile of this.tiles.values()) this.destroyTile(tile);
    this.tiles.clear();
    this.results = [];
    this.running = null;
    this.sourceSizes.clear();
    this.overviews.clear();
    this.knownOverviews.clear();
    this.sourceBytes = 0;
    this.workerSourceBytes = 0;
    this.submittedRevision = -1;
    this.submittedViewGeneration = -1;
    this.preparedViewGeneration = -1;
    this.lastSubmittedViewGeneration = -1;
    this.focusBounds = null;
    this.feedbackBounds = null;
    this.localBatches = 0;
    this.faultArmed = false;
    this.raster.postMessage({
      kind: "sources",
      reset: true,
      sessionId: this.sessionId,
      tiles: [],
    } satisfies RasterMessage);
    this.lastSubmit = "";
    this.requestFrame = true;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.resize(this.width, this.height, devicePixelRatio);
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
    this.camera = { ...camera };
    this.viewGeneration++;
    this.localBatches = 0;
    this.observation.event("view-change", {
      sessionId: this.sessionId,
      viewGeneration: this.viewGeneration,
      bounds: this.bounds(),
      camera: { ...this.camera },
    });
    this.requestFrame = true;
    this.positionTiles();
  }

  /** Sources and numeric overview share one raster path and one certified mesh. */
  updatePresentation(
    tiles: readonly HeightTile[],
    overviews: readonly HeightOverviewTile[],
    overviewKeys: readonly string[],
    replace = false,
  ): void {
    if (replace) {
      this.overviews.clear();
      this.knownOverviews.clear();
    }
    for (const key of overviewKeys) {
      parseHeightOverviewKey(key);
      this.knownOverviews.add(key);
      this.overviews.delete(key);
    }
    for (const tile of overviews) {
      validateHeightOverviewTile(tile);
      if (!this.knownOverviews.has(tile.key))
        throw new Error("Nicht bestätigte Höhenübersicht.");
      this.overviews.set(tile.key, { ...tile, values: tile.values.slice() });
    }
    this.sendSources(
      tiles.map(cloneHeightTile),
      [],
      replace,
      overviews.map((tile) => ({ ...tile, values: tile.values.slice() })),
      [...overviewKeys],
    );
  }

  /** History already owns complete changed sources, even after distant eviction. */
  updateSourcePatches(patches: readonly HeightPatch[]): void {
    const changed = new Set<string>();
    const powers = new Set(
      [...this.knownOverviews].map((key) => parseHeightOverviewKey(key).power),
    );
    for (const patch of patches) {
      const delta = prepareHeightOverviewDelta(patch);
      if (!delta) continue;
      for (const power of powers)
        for (const key of heightOverviewDeltaKeys(delta, power)) {
          if (!this.knownOverviews.has(key)) continue;
          const at = parseHeightOverviewKey(key);
          const tile =
            this.overviews.get(key) ??
            createHeightOverviewTile(at.power, at.tileX, at.tileY);
          if (applyPreparedHeightOverviewDelta(tile, delta)) {
            this.overviews.set(key, tile);
            changed.add(key);
          }
        }
    }
    this.sendSources(
      patches.flatMap((patch) =>
        patch.after ? [cloneHeightTile(patch.after)] : [],
      ),
      patches.filter((patch) => !patch.after).map((patch) => patch.key),
      false,
      [...changed].map((key) => {
        const tile = this.overviews.get(key)!;
        return { ...tile, values: tile.values.slice() };
      }),
      [...changed],
    );
  }

  private sendSources(
    tiles: HeightTile[],
    removed: string[] = [],
    replace = false,
    overviews: HeightOverviewTile[] = [],
    overviewKeys: string[] = [],
  ): void {
    if (replace) this.sourceSizes.clear();
    for (const key of removed) this.sourceSizes.delete(key);
    for (const tile of tiles)
      this.sourceSizes.set(tile.key, tile.values.byteLength);
    this.sourceBytes = tiles.reduce(
      (total, tile) => total + tile.values.byteLength,
      0,
    );
    this.workerSourceBytes = [...this.sourceSizes.values()].reduce(
      (sum, size) => sum + size,
      0,
    );
    if (this.workerSourceBytes > editorBudgets.sourceBytes)
      throw new Error(
        "Die Darstellungsquellen überschreiten das Speicherbudget.",
      );
    if (
      this.overviews.size * HEIGHT_OVERVIEW_BYTES * 2 +
        this.tiles.size * SIZE * SIZE * 4 >
      editorBudgets.presentationBytes
    )
      throw new Error(
        "Die Höhenübersichten überschreiten das Darstellungsbudget.",
      );
    this.raster.postMessage(
      {
        kind: "sources",
        reset: replace,
        sessionId: this.sessionId,
        tiles,
        removed,
        overviews,
        overviewKeys,
      } satisfies RasterMessage,
      [
        ...tiles.map((tile) => tile.values.buffer as ArrayBuffer),
        ...overviews.map((tile) => tile.values.buffer as ArrayBuffer),
      ],
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

  isPresentationReady(bounds: Bounds, power = this.tilePower()): boolean {
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
        current.add(key);
        let tile = this.tiles.get(key);
        if (!tile) {
          const pixels = new Uint8Array(SIZE * SIZE * 4);
          const source = new BufferImageSource({
            resource: pixels,
            width: SIZE,
            height: SIZE,
            format: "rgba8unorm",
            alphaMode: "no-premultiply-alpha",
            scaleMode: "nearest",
          });
          const sprite = new Sprite(new Texture({ source }));
          tile = {
            key,
            bounds,
            power,
            token: ++this.tileToken,
            revision: this.document.revision,
            dirty: [...WHOLE],
            pending: null,
            lastJob: 0,
            paintedRevision: -1,
            submittedRevision: -1,
            submittedFrame: 0,
            visible: true,
            touched: performance.now(),
            pixels,
            source,
            sprite,
          };
          this.tiles.set(key, tile);
          this.terrain.addChild(sprite);
        }
        tile.visible = true;
        tile.touched = performance.now();
      }
    }
    for (const tile of this.tiles.values()) {
      tile.visible = current.has(tile.key);
      tile.sprite.zIndex = tile.visible ? 1 : 0;
    }
    this.prune();
    this.preparedViewGeneration = this.viewGeneration;
    this.positionTiles();
    this.requestFrame = true;
  }

  invalidate(bounds: Bounds): void {
    this.faultArmed = true;
    for (const tile of this.tiles.values()) {
      if (!intersectsBounds(tile.bounds, bounds)) continue;
      const rect = pixelRect(tile, bounds);
      if (rect[0] >= rect[2] || rect[1] >= rect[3]) continue;
      tile.dirty = tile.dirty ? merged(tile.dirty, rect) : rect;
      tile.revision = this.document.revision;
    }
    this.requestFrame = true;
  }

  redraw(): void {
    this.requestFrame = true;
  }

  /** Scheduling hints only; readiness is derived from sources and submitted tiles. */
  setPriorityAreas(focus: Bounds | null, feedback: Bounds | null = null): void {
    this.focusBounds = focus ? [...focus] : null;
    this.feedbackBounds = feedback ? [...feedback] : null;
  }

  /** The last real render, including a locally useful but incomplete view. */
  submission(): { frame: number; viewGeneration: number } {
    return {
      frame: this.lastSubmittedViewGeneration < 0 ? 0 : this.frame,
      viewGeneration: this.lastSubmittedViewGeneration,
    };
  }

  /**
   * Only the visible part of the requested (possibly swept) area needs a display.
   * A drawn foundation may survive its own pending edit; current=true also
   * requires all changes in that area to have reached an actual submission.
   */
  regionDisplayed(bounds: Bounds, current = true): boolean {
    const area = intersection(bounds, this.bounds());
    if (!area) return true;
    if (
      this.preparedViewGeneration !== this.viewGeneration ||
      this.lastSubmittedViewGeneration !== this.viewGeneration
    )
      return false;
    let covered = false;
    for (const tile of this.tiles.values()) {
      if (!tile.visible || !intersectsBounds(tile.bounds, area)) continue;
      covered = true;
      if (tile.submittedRevision < 0 || tile.submittedFrame !== this.frame)
        return false;
      if (!current) continue;
      const rect = pixelRect(tile, area);
      if (
        tile.submittedRevision !== tile.paintedRevision ||
        (tile.dirty && overlaps(tile.dirty, rect)) ||
        (tile.pending && overlaps(tile.pending.rect, rect))
      )
        return false;
    }
    return covered;
  }

  regionExact(bounds: Bounds): boolean {
    if (this.preparedViewGeneration !== this.viewGeneration) return false;
    const relevant = [...this.tiles.values()].filter(
      (tile) => tile.visible && intersectsBounds(tile.bounds, bounds),
    );
    return (
      relevant.length > 0 &&
      relevant.every((tile) => {
        const rect = pixelRect(tile, bounds);
        return (
          tile.paintedRevision >= 0 &&
          (!tile.dirty || !overlaps(tile.dirty, rect)) &&
          (!tile.pending || !overlaps(tile.pending.rect, rect))
        );
      })
    );
  }

  /** Input-version coverage only; mixed tile prefixes are not a current exact region. */
  regionCoverage(
    bounds: Bounds,
    requiredRevision: number,
  ): { minPaintedRevision: number; maxPaintedRevision: number } | null {
    if (
      this.preparedViewGeneration !== this.viewGeneration ||
      !Number.isSafeInteger(requiredRevision) ||
      requiredRevision < 0 ||
      requiredRevision > this.document.revision
    )
      return null;
    const relevant = [...this.tiles.values()].filter(
      (tile) => tile.visible && intersectsBounds(tile.bounds, bounds),
    );
    if (!relevant.length) return null;
    for (const tile of relevant) {
      if (tile.paintedRevision < 0) return null;
      // A tile not changed by later input already contains that input's version.
      if (tile.paintedRevision >= Math.min(requiredRevision, tile.revision))
        continue;
      const rect = pixelRect(tile, bounds);
      if (
        (tile.dirty && overlaps(tile.dirty, rect)) ||
        (tile.pending && overlaps(tile.pending.rect, rect))
      )
        return null;
    }
    return {
      minPaintedRevision: Math.min(
        ...relevant.map((tile) => tile.paintedRevision),
      ),
      maxPaintedRevision: Math.max(
        ...relevant.map((tile) => tile.paintedRevision),
      ),
    };
  }

  state() {
    return {
      tiles: this.tiles.size,
      cpuRasterBytes:
        this.tiles.size * SIZE * SIZE * 4 +
        this.results.reduce((n, r) => n + r.pixels.byteLength, 0) +
        this.overviews.size * HEIGHT_OVERVIEW_BYTES * 2,
      gpuBytes: this.tiles.size * SIZE * SIZE * 4,
      sourceBytes: this.sourceBytes,
      workerSourceBytes: this.workerSourceBytes,
      overviewBytes: this.overviews.size * HEIGHT_OVERVIEW_BYTES,
      workerOverviewBytes: this.overviews.size * HEIGHT_OVERVIEW_BYTES,
      queuedTiles: [...this.tiles.values()].filter(
        (t) => t.visible && (t.dirty || t.pending),
      ).length,
      running: Boolean(this.running),
      maxRasterMs: this.maxRasterMs,
      maxRasterBatchMs: this.maxRasterBatchMs,
      totalSamples: this.totalSamples,
      submittedRevision: this.submittedRevision,
      submittedViewGeneration: this.submittedViewGeneration,
      lastSubmittedFrame: this.submission().frame,
      lastSubmittedViewGeneration: this.lastSubmittedViewGeneration,
      viewGeneration: this.viewGeneration,
      fault: this.fault,
      heldForPointerup: this.heldForPointerup,
    };
  }

  private get heldForPointerup(): boolean {
    return this.fault === "pointerup-render" && Boolean(this.document?.active);
  }

  private dispatch(): void {
    if (
      this.running ||
      !this.document ||
      this.destroyed ||
      this.heldForPointerup
    )
      return;
    const view = this.bounds();
    const feedback =
      this.feedbackBounds && intersection(this.feedbackBounds, view);
    const halfPixel = 0.5 / this.camera.scale;
    const focus =
      (this.focusBounds && intersection(this.focusBounds, view)) ??
      ([
        this.camera.x - halfPixel,
        this.camera.y - halfPixel,
        this.camera.x + halfPixel,
        this.camera.y + halfPixel,
      ] as Bounds);
    const priority = (tile: RasterTile): number => {
      // With no live dose, previously drawn dirty tiles are still accepted
      // changes (for example Undo). Initial loading never dirties drawn tiles.
      if (
        (feedback && overlaps(tile.dirty!, pixelRect(tile, feedback))) ||
        (!feedback && tile.paintedRevision >= 0)
      )
        return 0;
      return overlaps(tile.dirty!, pixelRect(tile, focus)) ? 1 : 2;
    };
    const center = feedback ?? focus;
    const distance = (tile: RasterTile): number =>
      Math.abs(tile.bounds[0] + tile.bounds[2] - center[0] - center[2]) +
      Math.abs(tile.bounds[1] + tile.bounds[3] - center[1] - center[3]);
    // Latest pending rectangle per tile replaces obsolete work, never source edits.
    const candidates = [...this.tiles.values()]
      .filter(
        (tile) =>
          tile.visible &&
          tile.dirty &&
          !tile.pending &&
          this.isPresentationReady(tile.bounds, tile.power),
      )
      .sort(
        (a, b) =>
          priority(a) - priority(b) ||
          a.lastJob - b.lastJob ||
          distance(a) - distance(b),
      );
    // A held brush can produce another local dose after every submitted frame.
    // Let one bounded remaining tile progress periodically, without trapping a
    // local result in the same batch or growing a second work queue.
    const remaining = candidates.find((tile) => priority(tile) === 2);
    const viewProgress =
      this.localBatches >= LOCAL_BATCHES_BEFORE_VIEW_PROGRESS && remaining;
    const selected = viewProgress ? [viewProgress] : candidates;
    const tasks: RasterTask[] = [];
    let pixels = 0;
    const batchPriority = selected.length ? priority(selected[0]) : -1;
    for (const tile of selected) {
      if (tasks.length === MAX_RASTER_BATCH_TILES) break;
      // A local result is returned without waiting for unrelated view loading.
      if (priority(tile) !== batchPriority) break;
      const rect = tile.dirty!;
      const count = (rect[2] - rect[0]) * (rect[3] - rect[1]);
      if (pixels + count > MAX_RASTER_BATCH_PIXELS) break;
      const task: RasterTask = {
        kind: "raster",
        id: ++this.jobId,
        sessionId: this.sessionId,
        key: tile.key,
        token: tile.token,
        revision: tile.revision,
        power: tile.power,
        bounds: tile.bounds,
        size: SIZE,
        rect: [...rect],
      };
      tasks.push(task);
      pixels += count;
      tile.pending = task;
      tile.dirty = null;
      tile.lastJob = task.id;
    }
    if (!tasks.length) return;
    const batch: RasterBatch = {
      kind: "raster-batch",
      id: tasks[0].id,
      sessionId: this.sessionId,
      tasks,
    };
    this.running = batch;
    this.localBatches =
      batchPriority < 2 && remaining ? this.localBatches + 1 : 0;
    this.observation.event("raster-batch-start", {
      id: batch.id,
      tiles: tasks.length,
      pixels,
      priority: batchPriority,
      viewProgress: Boolean(viewProgress),
    });
    for (const task of tasks)
      this.observation.event("raster-start", {
        id: task.id,
        batchId: batch.id,
        key: task.key,
        rect: task.rect,
        revision: task.revision,
        pixels: (task.rect[2] - task.rect[0]) * (task.rect[3] - task.rect[1]),
      });
    this.raster.postMessage(batch);
  }

  private positionTiles(): void {
    for (const tile of this.tiles.values()) {
      // Subtract world origin in doubles before Pixi's Float32 GPU transforms.
      tile.sprite.position.set(
        (tile.bounds[0] - this.camera.x) * this.camera.scale + this.width / 2,
        (tile.bounds[1] - this.camera.y) * this.camera.scale + this.height / 2,
      );
      tile.sprite.width = (tile.bounds[2] - tile.bounds[0]) * this.camera.scale;
      tile.sprite.height =
        (tile.bounds[3] - tile.bounds[1]) * this.camera.scale;
      tile.sprite.visible =
        tile.paintedRevision >= 0 &&
        intersectsBounds(tile.bounds, this.bounds());
    }
  }

  private tick = (now: number): void => {
    if (this.destroyed) return;
    const start = performance.now();
    const resultStart = performance.now();
    let uploaded = 0;
    while (
      !this.heldForPointerup &&
      !(this.faultArmed && this.fault === "drop-render") &&
      this.results.length &&
      performance.now() - resultStart < editorBudgets.resultCpuMs
    ) {
      const result = this.results.shift()!;
      const tile = this.tiles.get(result.key);
      if (
        result.sessionId !== this.sessionId ||
        !tile ||
        tile.token !== result.token ||
        tile.pending?.id !== result.id ||
        result.revision < tile.paintedRevision
      ) {
        this.observation.event("raster-discard", {
          id: result.id,
          reason: "session-tile-or-revision",
        });
        continue;
      }
      const bytes = SIZE * SIZE * 4;
      if (uploaded + bytes > editorBudgets.uploadBytesPerFrame) {
        this.results.unshift(result);
        break;
      }
      const [x0, y0, x1, y1] = result.rect;
      for (let row = y0; row < y1; row++) {
        const offset = (row - y0) * (x1 - x0) * 4;
        tile.pixels.set(
          result.pixels.subarray(offset, offset + (x1 - x0) * 4),
          (row * SIZE + x0) * 4,
        );
      }
      tile.source.update();
      uploaded += bytes;
      // One pending task contains all accumulated changes through its revision.
      // Paint it completely; later changes remain dirty for the follow-up task.
      tile.paintedRevision = result.revision;
      tile.pending = null;
      tile.sprite.visible = intersectsBounds(tile.bounds, this.bounds());
      this.observation.event("raster-upload", {
        id: result.id,
        key: result.key,
        paintedRevision: tile.paintedRevision,
        requiredRevision: tile.revision,
        acceptedPixels: (x1 - x0) * (y1 - y0),
        supersededPixels: 0,
        remainingDirty: tile.dirty,
      });
      this.requestFrame = true;
    }
    if (this.requestFrame && this.document) {
      // Submit callbacks may request another overlay frame as readiness changes.
      this.requestFrame = false;
      this.drawOverlay();
      const exact =
        this.preparedViewGeneration === this.viewGeneration &&
        [...this.tiles.values()]
          .filter((tile) => tile.visible)
          .every(
            (tile) =>
              tile.paintedRevision >= tile.revision &&
              !tile.dirty &&
              !tile.pending,
          );
      const exactRevision =
        exact && this.tiles.size ? this.document.revision : -1;
      this.renderer.render(this.stage);
      this.frame++;
      this.lastSubmittedViewGeneration = this.viewGeneration;
      for (const tile of this.tiles.values())
        if (tile.visible && tile.paintedRevision >= 0) {
          tile.submittedRevision = tile.paintedRevision;
          tile.submittedFrame = this.frame;
        }
      const identity = `${this.sessionId}.${this.frame}.${this.viewGeneration}.${exactRevision}`;
      this.observation.mark("submit", identity, {
        frame: this.frame,
        sessionId: this.sessionId,
        revision: this.document.revision,
        exactRevision,
        cameraGeneration: this.viewGeneration,
        uploadedBytes: uploaded,
      });
      this.onSubmit(this.frame);
      // This is explicitly submission, not an invented presentation timestamp.
      if (exactRevision >= 0 && identity !== this.lastSubmit) {
        this.submittedRevision = exactRevision;
        this.submittedViewGeneration = this.viewGeneration;
        this.onExact(exactRevision);
      }
      this.lastSubmit = identity;
    }
    // Publish the accepted state before admitting the next bounded brush dose.
    // All newly accepted input still precedes selection of the next raster batch.
    try {
      this.advanceFrame(performance.now());
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
    if (this.destroyed) return;
    this.dispatch();
    if (this.lastFrameAt)
      this.observation.event("frame", {
        interval: now - this.lastFrameAt,
        cpuMs: performance.now() - start,
      });
    this.lastFrameAt = now;
    this.frameCpuMax = Math.max(this.frameCpuMax, performance.now() - start);
    this.animation = requestAnimationFrame(this.tick);
  };

  private drawOverlay(): void {
    this.overlay.clear();
    // Missing current-scale terrain remains visibly loading, even if retained
    // coarser tiles are underneath it or the pointer is outside the map.
    const view = this.bounds();
    const loading =
      this.preparedViewGeneration !== this.viewGeneration
        ? [view]
        : [...this.tiles.values()]
            .filter((tile) => tile.visible && tile.paintedRevision < 0)
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
    if (this.cursor)
      this.overlay
        .circle(this.cursor.x, this.cursor.y, this.cursor.radius)
        .stroke({
          color: this.cursor.waiting ? 0xc9d2d4 : 0xf1d49c,
          width: 1.2,
          alpha: this.cursor.waiting ? 0.45 : 0.9,
        });
  }

  private prune(): void {
    const removable = [...this.tiles.values()]
      .filter((tile) => !tile.visible)
      .sort((a, b) => a.touched - b.touched);
    while (this.tiles.size > editorBudgets.retainedTiles && removable.length) {
      const tile = removable.shift()!;
      this.tiles.delete(tile.key);
      this.destroyTile(tile);
    }
    if (this.tiles.size > editorBudgets.retainedTiles)
      this.onError(
        new Error(
          "Der sichtbare Ausschnitt überschreitet das Darstellungsbudget.",
        ),
      );
  }

  private destroyTile(tile: RasterTile): void {
    tile.sprite.destroy({ texture: true, textureSource: true });
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animation);
    for (const timer of this.pendingDelay) clearTimeout(timer);
    this.raster.terminate();
    for (const tile of this.tiles.values()) this.destroyTile(tile);
    this.renderer.destroy();
  }
}
