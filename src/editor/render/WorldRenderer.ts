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
  clipBounds,
  intersectsBounds,
  type Bounds,
  type EditorDocument,
} from "../model";
import { Observation } from "../observation";
import type { RasterMessage, RasterResult, RasterTask } from "./raster.worker";

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
  ready: boolean;
  visible: boolean;
  touched: number;
  source: BufferImageSource;
  sprite: Sprite;
  pixels: Uint8Array;
}
const SIZE = 128;
const WHOLE: Rect = [0, 0, SIZE, SIZE];
const merged = (a: Rect, b: Rect): Rect => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];

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
  private running: RasterTask | null = null;
  private scheduled = new Map<string, number>();
  private sourceSizes = new Map<string, number>();
  private jobId = 0;
  private tileToken = 0;
  private document!: EditorDocument;
  private sessionId = "";
  private animation = 0;
  private frame = 0;
  private viewGeneration = 0;
  private preparedViewGeneration = -1;
  private requestFrame = true;
  private lastFrameAt = 0;
  private lastSubmit = "";
  private pendingDelay = new Set<number>();
  private destroyed = false;
  private submittedRevision = -1;
  camera: Camera = { x: 0, y: 0, scale: 0.25 };
  width = 1000;
  height = 760;
  grid = true;
  cursor: { x: number; y: number; radius: number } | null = null;
  fault: "none" | "delay-render" | "drop-render" = "none";
  private faultArmed = false;
  maxRasterMs = 0;
  sourceBytes = 0;
  workerSourceBytes = 0;
  totalSamples = 0;
  frameCpuMax = 0;
  onExact: (revision: number) => void = () => {};
  onSubmit: (frame: number) => void = () => {};
  onError: (error: Error) => void = () => {};

  constructor(private observation: Observation) {
    this.stage.addChild(this.terrain, this.overlay);
    this.terrain.sortableChildren = true;
    this.raster.onmessage = (event: MessageEvent<RasterResult>) => {
      const result = event.data;
      if (this.running?.id === result.id) this.running = null;
      if (result.sessionId !== this.sessionId) return;
      if (this.faultArmed && this.fault === "delay-render") {
        const timer = window.setTimeout(() => {
          this.pendingDelay.delete(timer);
          this.results.push(result);
          this.requestFrame = true;
        }, 250);
        this.pendingDelay.add(timer);
      } else if (!this.faultArmed || this.fault !== "drop-render")
        this.results.push(result);
      this.maxRasterMs = Math.max(this.maxRasterMs, result.cpuMs);
      this.totalSamples += result.samples;
      this.requestFrame = true;
      this.dispatch();
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
    this.scheduled.clear();
    this.sourceSizes.clear();
    this.sourceBytes = 0;
    this.workerSourceBytes = 0;
    this.submittedRevision = -1;
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
    this.requestFrame = true;
    this.positionTiles();
  }

  /** Main document owns arrays; only owned snapshot copies cross the boundary. */
  updateSources(bounds: Bounds, removed: string[] = [], replace = false): void {
    const snapshot = this.document.snapshot(bounds);
    if (replace) this.sourceSizes.clear();
    for (const key of removed) this.sourceSizes.delete(key);
    for (const tile of snapshot.tiles)
      this.sourceSizes.set(tile.key, tile.values.byteLength);
    this.sourceBytes = snapshot.tiles.reduce(
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
    this.raster.postMessage(
      {
        kind: "sources",
        reset: replace,
        sessionId: this.sessionId,
        tiles: snapshot.tiles,
        removed,
      } satisfies RasterMessage,
      snapshot.tiles.map((tile) => tile.values.buffer as ArrayBuffer),
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

  sourceBounds(): Bounds {
    return this.bounds(SIZE * 2 ** this.tilePower());
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
        const bounds: Bounds = clipBounds([
          x * span,
          y * span,
          (x + 1) * span,
          (y + 1) * span,
        ]);
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
            ready: false,
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
    this.dispatch();
    this.requestFrame = true;
  }

  invalidate(bounds: Bounds): void {
    this.faultArmed = true;
    for (const tile of this.tiles.values()) {
      if (!intersectsBounds(tile.bounds, bounds)) continue;
      const step = (tile.bounds[2] - tile.bounds[0]) / SIZE;
      const stepY = (tile.bounds[3] - tile.bounds[1]) / SIZE;
      const rect: Rect = [
        Math.max(0, Math.floor((bounds[0] - tile.bounds[0]) / step)),
        Math.max(0, Math.floor((bounds[1] - tile.bounds[1]) / stepY)),
        Math.min(SIZE, Math.ceil((bounds[2] - tile.bounds[0]) / step)),
        Math.min(SIZE, Math.ceil((bounds[3] - tile.bounds[1]) / stepY)),
      ];
      tile.dirty = tile.dirty ? merged(tile.dirty, rect) : rect;
      tile.token = ++this.tileToken;
      tile.revision = this.document.revision;
    }
    this.dispatch();
    this.requestFrame = true;
  }

  redraw(): void {
    this.requestFrame = true;
  }

  regionExact(bounds: Bounds): boolean {
    if (this.preparedViewGeneration !== this.viewGeneration) return false;
    const relevant = [...this.tiles.values()].filter(
      (tile) => tile.visible && intersectsBounds(tile.bounds, bounds),
    );
    return (
      relevant.length > 0 && relevant.every((tile) => tile.ready && !tile.dirty)
    );
  }

  state() {
    return {
      tiles: this.tiles.size,
      cpuRasterBytes:
        this.tiles.size * SIZE * SIZE * 4 +
        this.results.reduce((n, r) => n + r.pixels.byteLength, 0),
      gpuBytes: this.tiles.size * SIZE * SIZE * 4,
      sourceBytes: this.sourceBytes,
      workerSourceBytes: this.workerSourceBytes,
      queuedTiles: [...this.tiles.values()].filter((t) => t.visible && t.dirty)
        .length,
      running: Boolean(this.running),
      maxRasterMs: this.maxRasterMs,
      totalSamples: this.totalSamples,
      submittedRevision: this.submittedRevision,
      viewGeneration: this.viewGeneration,
      fault: this.fault,
    };
  }

  private dispatch(): void {
    if (this.running || !this.document || this.destroyed) return;
    // Latest pending rectangle per tile replaces obsolete work, never source edits.
    const tile = [...this.tiles.values()].find(
      (tile) =>
        tile.visible &&
        tile.dirty &&
        this.scheduled.get(tile.key) !== tile.token &&
        this.document.isReady(tile.bounds),
    );
    if (!tile || !tile.dirty) return;
    const task: RasterTask = {
      kind: "raster",
      id: ++this.jobId,
      sessionId: this.sessionId,
      key: tile.key,
      token: tile.token,
      revision: tile.revision,
      bounds: tile.bounds,
      size: SIZE,
      rect: [...tile.dirty],
    };
    this.running = task;
    this.scheduled.set(tile.key, tile.token);
    this.raster.postMessage(task);
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
        tile.ready && intersectsBounds(tile.bounds, this.bounds());
    }
  }

  private tick = (now: number): void => {
    if (this.destroyed) return;
    const start = performance.now();
    let uploaded = 0;
    while (
      this.results.length &&
      performance.now() - start < editorBudgets.resultCpuMs
    ) {
      const result = this.results.shift()!;
      const tile = this.tiles.get(result.key);
      if (
        result.sessionId !== this.sessionId ||
        !tile ||
        tile.token !== result.token ||
        tile.revision !== result.revision
      )
        continue;
      const bytes = SIZE * SIZE * 4;
      if (uploaded + bytes > editorBudgets.uploadBytesPerFrame) {
        this.results.unshift(result);
        break;
      }
      const [x0, y0, x1, y1] = result.rect;
      for (let row = y0; row < y1; row++)
        tile.pixels.set(
          result.pixels.subarray(
            (row - y0) * (x1 - x0) * 4,
            (row - y0 + 1) * (x1 - x0) * 4,
          ),
          (row * SIZE + x0) * 4,
        );
      tile.source.update();
      uploaded += bytes;
      tile.dirty = null;
      this.scheduled.delete(tile.key);
      tile.ready = true;
      tile.sprite.visible = intersectsBounds(tile.bounds, this.bounds());
      this.requestFrame = true;
    }
    this.dispatch();
    if (this.requestFrame && this.document) {
      this.drawOverlay();
      const exact =
        this.preparedViewGeneration === this.viewGeneration &&
        [...this.tiles.values()]
          .filter((tile) => tile.visible)
          .every((tile) => tile.ready && !tile.dirty);
      const exactRevision =
        exact && this.tiles.size ? this.document.revision : -1;
      this.renderer.render(this.stage);
      this.frame++;
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
        this.onExact(exactRevision);
      }
      this.lastSubmit = identity;
      this.requestFrame = false;
    }
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
    if (this.grid) {
      const step =
        5 *
        2 ** Math.max(0, Math.ceil(Math.log2(70 / (5 * this.camera.scale))));
      const view = this.bounds();
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
        .stroke({ color: 0xf1d49c, width: 1.2, alpha: 0.9 });
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
