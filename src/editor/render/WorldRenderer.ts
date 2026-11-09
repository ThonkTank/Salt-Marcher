import { Container, Graphics, WebGLRenderer } from "pixi.js";
// Pixi's static uniform-sync implementation works with the strict desktop CSP.
import "pixi.js/unsafe-eval";
import { editorBudgets } from "../budgets";
import {
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
import { HeightField, type HeightFieldTile } from "./HeightField";

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

type Rect = [number, number, number, number];
interface DisplayTile {
  key: string;
  bounds: Bounds;
  power: number;
  revision: number;
  dirty: Rect | null;
  preparedRevision: number;
  paintedRevision: number;
  submittedRevision: number;
  submittedFrame: number;
  visible: boolean;
  touched: number;
  field: HeightFieldTile;
  overview: HeightOverviewTile | null;
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

/** Retained display tiles. Camera transforms never read or write the store. */
export class WorldRenderer {
  readonly renderer = new WebGLRenderer();
  private stage = new Container();
  private terrain = new Container();
  private overlay = new Graphics();
  private tiles = new Map<string, DisplayTile>();
  private field = new HeightField();
  private overviews = new Map<string, HeightOverviewTile>();
  private knownOverviews = new Set<string>();
  private document!: EditorDocument;
  private sessionId = "";
  private frame = 0;
  private viewGeneration = 0;
  private preparedViewGeneration = -1;
  private lastSubmittedViewGeneration = -1;
  private requestFrame = true;
  private delayUntil = 0;
  private destroyed = false;
  private canvas?: HTMLCanvasElement;
  private contextLost = false;
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
  onError: (error: Error) => void = () => {};

  constructor(private observation: Observation) {
    this.stage.addChild(this.terrain, this.overlay);
    this.terrain.sortableChildren = true;
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
      this.observation.event("graphics-context-restored", {
        sessionId: this.sessionId,
      });
    } catch (error) {
      this.contextLost = true;
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  private invalidateGpuSubmission(): void {
    this.lastSubmittedViewGeneration = -1;
    this.submittedRevision = -1;
    this.submittedViewGeneration = -1;
    for (const tile of this.tiles.values()) {
      tile.dirty = [...WHOLE];
      tile.preparedRevision = -1;
      tile.paintedRevision = -1;
      tile.submittedRevision = -1;
      tile.submittedFrame = 0;
      tile.field.mesh.visible = false;
    }
    this.requestFrame = true;
  }

  reset(document: EditorDocument): void {
    this.document = document;
    this.sessionId = document.sessionId;
    for (const tile of this.tiles.values()) this.destroyTile(tile);
    this.tiles.clear();
    this.field.reset();
    this.overviews.clear();
    this.knownOverviews.clear();
    this.submittedRevision = -1;
    this.submittedViewGeneration = -1;
    this.preparedViewGeneration = -1;
    this.lastSubmittedViewGeneration = -1;
    this.faultArmed = false;
    this.delayUntil = 0;
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
    this.observation.event("view-change", {
      sessionId: this.sessionId,
      viewGeneration: this.viewGeneration,
      bounds: this.bounds(),
      camera: { ...this.camera },
    });
    this.requestFrame = true;
    this.positionTiles();
  }

  /** Numeric sources are retained; a draw reconstructs the canonical sample lattice. */
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
    if (replace) this.field.replaceSources(tiles);
    else this.field.updateSources(tiles);
    // A read may replace atlas slots or certify an empty fine overview. Retained
    // descriptors become current only after rebinding and drawing these sources.
    for (const tile of this.tiles.values()) {
      tile.dirty = [...WHOLE];
      tile.preparedRevision = -1;
      tile.revision = this.document.revision;
    }
    this.checkBudgets();
    this.requestFrame = true;
  }

  /** Remove derived copies when the document releases author sources. */
  forgetSources(keys: readonly string[]): void {
    if (keys.length) this.field.updateSources([], keys);
  }

  /** History already owns complete changed sources, even after distant eviction. */
  updateSourcePatches(patches: readonly HeightPatch[]): void {
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
          const previous = this.overviews.get(key);
          const tile = previous
            ? { ...previous, values: previous.values.slice() }
            : createHeightOverviewTile(at.power, at.tileX, at.tileY);
          if (applyPreparedHeightOverviewDelta(tile, delta)) {
            this.overviews.set(key, tile);
          }
        }
    }
    this.field.updateSources(
      patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
      patches.filter((patch) => !patch.after).map((patch) => patch.key),
    );
    this.checkBudgets();
    this.requestFrame = true;
  }

  private checkBudgets(): void {
    const metrics = this.field.metrics();
    if (metrics.sourceBytes > editorBudgets.sourceBytes)
      throw new Error(
        "Die Darstellungsquellen überschreiten das Speicherbudget.",
      );
    if (
      metrics.cpuBytes + this.overviews.size * HEIGHT_OVERVIEW_BYTES >
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
            paintedRevision: -1,
            submittedRevision: -1,
            submittedFrame: 0,
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
    this.faultArmed = true;
    if (this.fault === "delay-render")
      this.delayUntil = performance.now() + 250;
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

  /**
   * Inspect only the visible part of a requested (possibly swept) region.
   * Missing and stale are distinct: a submitted foundation survives its own
   * pending edit, but that edit is current only after an actual matching draw.
   * Completely offscreen work cannot provide a submission proof.
   */
  inspectRegion(bounds: Bounds): RegionInspection {
    const result: RegionInspection = {
      status: "outside",
      sessionId: this.sessionId,
      frame: this.lastSubmittedViewGeneration < 0 ? 0 : this.frame,
      viewGeneration: this.viewGeneration,
    };
    const area = intersection(bounds, this.bounds());
    if (!area) return result;
    result.status = "missing";
    if (
      this.contextLost ||
      this.preparedViewGeneration !== this.viewGeneration ||
      this.lastSubmittedViewGeneration !== this.viewGeneration
    )
      return result;
    let covered = false;
    let current = true;
    for (const tile of this.tiles.values()) {
      if (!tile.visible || !intersectsBounds(tile.bounds, area)) continue;
      covered = true;
      if (tile.submittedRevision < 0 || tile.submittedFrame !== this.frame)
        return result;
      const rect = pixelRect(tile, area);
      if (
        tile.submittedRevision !== tile.paintedRevision ||
        (tile.dirty && overlaps(tile.dirty, rect))
      )
        current = false;
    }
    if (covered) result.status = current ? "current" : "stale";
    return result;
  }

  state() {
    const metrics = this.field.metrics();
    return {
      tiles: this.tiles.size,
      presentationPower: this.tilePower(),
      presentationBytes:
        metrics.cpuBytes + this.overviews.size * HEIGHT_OVERVIEW_BYTES,
      gpuBytes: metrics.gpuBytes,
      sourceBytes: metrics.sourceBytes,
      sourceCount: metrics.sourceCount,
      overviewBytes: this.overviews.size * HEIGHT_OVERVIEW_BYTES,
      queuedTiles: [...this.tiles.values()].filter((t) => t.visible && t.dirty)
        .length,
      fallbackTiles: metrics.fallbackTiles,
      fallbackSamples: metrics.fallbackSamples,
      pendingUploadBytes: metrics.pendingUploadBytes,
      pendingCompositionTiles: metrics.pendingCompositionTiles,
      submittedRevision: this.submittedRevision,
      submittedViewGeneration: this.submittedViewGeneration,
      lastSubmittedFrame: this.lastSubmittedViewGeneration < 0 ? 0 : this.frame,
      lastSubmittedViewGeneration: this.lastSubmittedViewGeneration,
      viewGeneration: this.viewGeneration,
      fault: this.fault,
      contextLost: this.contextLost,
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

  /** Upload accepted numeric changes and draw once; only a successful draw is a receipt. */
  renderFrame(now: number): FrameSubmission | null {
    if (
      this.destroyed ||
      this.contextLost ||
      !this.document ||
      !this.requestFrame
    )
      return null;
    // Fault controls delay the actual terrain draw, never fabricate readiness.
    if (
      this.heldForPointerup ||
      (this.faultArmed &&
        (this.fault === "drop-render" ||
          (this.fault === "delay-render" && now < this.delayUntil)))
    )
      return null;

    const prepared: DisplayTile[] = [];
    for (const tile of this.tiles.values()) {
      if (
        !tile.visible ||
        !tile.dirty ||
        !this.isPresentationReady(tile.bounds, tile.power)
      )
        continue;
      if (tile.preparedRevision !== tile.revision) {
        const overview =
          this.overviews.get(`height-overview:${tile.key}`) ?? null;
        tile.field.update(overview === tile.overview ? undefined : overview);
        tile.overview = overview;
        tile.preparedRevision = tile.revision;
      }
      prepared.push(tile);
    }
    this.checkBudgets();
    const uploadStart = performance.now();
    const uploaded = this.field.flush(editorBudgets.uploadBytesPerFrame);
    const uploadedAt = performance.now();
    const pending = this.field.metrics().pendingUploadBytes > 0;
    let composedSamples = 0;
    // Cached GPU colour tiles remain safe to draw while new numeric resources
    // upload across frames. Only a complete resource set may replace them.
    if (pending) prepared.length = 0;
    else
      for (const tile of prepared)
        composedSamples += tile.field.drawDirty(this.renderer);
    // Preparation/upload alone cannot change local readiness. Leave dirty state
    // intact if GL drawing fails; an unchanged retry uses these same sources.
    for (const tile of prepared) tile.field.mesh.visible = true;
    this.drawOverlay(new Set(prepared));
    this.renderer.render(this.stage);
    const submittedAt = performance.now();
    this.frame++;
    this.lastSubmittedViewGeneration = this.viewGeneration;
    this.requestFrame = pending;
    for (const tile of prepared) {
      tile.paintedRevision = tile.revision;
      tile.dirty = null;
    }
    for (const tile of this.tiles.values()) {
      if (!tile.visible || tile.paintedRevision < 0) continue;
      tile.submittedRevision = tile.paintedRevision;
      tile.submittedFrame = this.frame;
    }
    const exact =
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
    this.observation.event("height-draw", {
      sessionId: this.sessionId,
      frame: this.frame,
      viewGeneration: this.viewGeneration,
      revision: this.document.revision,
      uploadStart,
      uploadedAt,
      submittedAt,
      uploadedBytes: uploaded,
      updatedTiles: prepared.length,
      composedSamples,
      ...this.field.metrics(),
    });
    return {
      sessionId: this.sessionId,
      frame: this.frame,
      viewGeneration: this.viewGeneration,
      revision: this.document.revision,
      exactRevision,
      at: submittedAt,
      uploadedBytes: uploaded,
    };
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

  private destroyTile(tile: DisplayTile): void {
    tile.field.destroy();
  }

  destroy(): void {
    this.destroyed = true;
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
