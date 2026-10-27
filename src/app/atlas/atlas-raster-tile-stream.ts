import { atlasTilePlan, atlasPrefetchTiles } from './atlas-tile-plan.js';
/** Common ownership and publication rules for raster display products. */
export interface AtlasRasterTileRequest {
  tile: AtlasWorldTile;
  revision: number;
  contours?: number;
  editingRadius?: number;
}
export interface AtlasRasterTile {
  tile: AtlasWorldTile;
  revision: number;
  fence: string;
}
export interface AtlasRasterTileAdapter<
  T extends AtlasRasterTile,
  R extends AtlasRasterTileRequest,
> {
  request(tile: AtlasWorldTile, revision: number, contours?: number, editingRadius?: number): R;
  validate(reply: T, request: R, source: string): void;
}
import type { LandscapeBox } from './atlas-landscape.js';
import { atlasWorldTileBounds, type AtlasWorldTile } from './atlas-world-tiles.js';

const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_TILES = 64;
const TILE_OBJECT_OVERHEAD = 256;

export interface AtlasRasterStreamOptions {
  readonly maxBytes?: number;
  readonly maxTiles?: number;
  readonly maxRetainedTiles?: number;
}
export interface AtlasRasterStreamInput {
  readonly box: LandscapeBox;
  readonly focus?: LandscapeBox;
  readonly preload?: LandscapeBox;
  /** Per-view ceiling within the stream owner's allocation budget. */
  readonly maxTiles?: number;
  readonly metersPerPixel: number;
  readonly revision: number;
  readonly source: string;
  readonly contours?: number;
  readonly editingRadius?: number;
}
export interface AtlasRasterStreamFrame<T extends AtlasRasterTile> {
  readonly tiles: readonly T[];
  readonly complete: boolean;
  readonly overviewComplete: boolean;
  readonly generation: number;
}
interface CachedTile<T extends AtlasRasterTile> {
  readonly tile: T;
  readonly key: string;
  readonly bytes: number;
}

/** Overview-first loading with stable-camera retention and atomic refinement. */
export class AtlasRasterTileStream<T extends AtlasRasterTile, R extends AtlasRasterTileRequest> {
  private readonly maxBytes: number;
  private readonly maxTiles: number;
  private readonly maxRetainedTiles: number;
  private generation = 0;
  private overviewComplete = false;
  private fetchTail: Promise<unknown> = Promise.resolve();
  private controller = new AbortController();
  private disposed = false;
  private identity: string | undefined;
  private visible = new Map<string, CachedTile<T>>();
  private staged = new Map<string, CachedTile<T>>();
  /** Insertion order is LRU order, oldest first. */
  private readonly cache = new Map<string, CachedTile<T>>();

  constructor(
    private readonly adapter: AtlasRasterTileAdapter<T, R>,
    options: AtlasRasterStreamOptions = {},
  ) {
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxTiles = options.maxTiles ?? DEFAULT_MAX_TILES;
    this.maxRetainedTiles = options.maxRetainedTiles ?? Infinity;
    if (
      this.maxRetainedTiles !== Infinity &&
      (!Number.isSafeInteger(this.maxRetainedTiles) || this.maxRetainedTiles < 1)
    )
      throw Error('Atlas retained tile budget must be positive');
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1)
      throw new Error('Atlas tile stream maxBytes must be a positive safe integer');
    if (!Number.isInteger(this.maxTiles) || this.maxTiles < 1 || this.maxTiles > 256)
      throw new Error('Atlas tile stream maxTiles must be an integer from 1 to 256');
  }

  async load(
    input: AtlasRasterStreamInput,
    fetch: (request: R, signal: AbortSignal) => Promise<T>,
    publish: (frame: AtlasRasterStreamFrame<T>) => void,
  ): Promise<void> {
    if (this.disposed) throw new Error('Atlas tile stream is disposed');
    const generation = ++this.generation;
    this.overviewComplete = false;
    this.controller.abort();
    this.controller = new AbortController();
    if (
      !input ||
      !Number.isSafeInteger(input.revision) ||
      input.revision < 0 ||
      typeof input.source !== 'string' ||
      !input.source ||
      typeof fetch !== 'function' ||
      typeof publish !== 'function'
    ) {
      throw new Error('Atlas tile stream input is invalid');
    }
    const contours = input.contours;
    if (
      contours !== undefined &&
      (!Number.isFinite(contours) || (contours < 0 && contours !== -1) || contours > 100000)
    ) {
      throw new Error('Atlas tile stream contours are invalid');
    }
    const plan = atlasTilePlan(input.box, input.metersPerPixel, {
      maxTiles: Math.min(input.maxTiles ?? this.maxTiles, this.maxTiles),
      focus: input.focus,
    });
    const identity = sourceIdentity(input.source, input.revision, contours, input.editingRadius);
    const compatible = this.identity === identity;
    this.identity = identity;

    // Camera movement does not invalidate terrain. Retain only old tiles that
    // still intersect the new viewport; changes to source content revoke them.
    if (compatible) {
      this.visible = new Map(
        [...this.visible].filter(([, entry]) => intersectsBox(entry.tile.tile, input.box)),
      );
    } else {
      this.visible = new Map();
    }
    this.staged = new Map();
    this.emit(generation, false, publish);

    const detailsByParent = groupChildren(plan.detail, plan.overview);
    const parentTileKeys = new Map(plan.overview.map((tile) => [worldTileKey(tile), tile]));
    const protectedKeys = () => this.activeKeys();
    const bridgeExistingFrame = this.visible.size > 0;

    // With an existing valid frame, assemble a complete new overview off-screen
    // and swap atomically. A cold start can publish each non-overlapping parent
    // as soon as it arrives so the first useful view is not delayed.
    for (const tile of plan.overview) {
      if (!this.isCurrent(generation)) return;
      const request = this.adapter.request(tile, input.revision, contours, input.editingRadius);
      const loaded = await this.getTile(request, input.source, fetch, generation, protectedKeys());
      if (!this.isCurrent(generation)) return;
      if (!loaded) return;
      const key = worldTileKey(tile);
      if (bridgeExistingFrame) this.staged.set(key, loaded);
      else {
        this.visible.set(key, loaded);
        this.enforceBudget(protectedKeys());
        if (tile === plan.overview.at(-1)) this.overviewComplete = true;
        this.emit(generation, false, publish);
      }
    }

    if (bridgeExistingFrame && plan.overview.length > 0) {
      this.visible = new Map(this.staged);
      this.staged.clear();
      this.enforceBudget(protectedKeys());
      this.overviewComplete = true;
      this.emit(generation, false, publish);
    } else if (plan.overview.length === 0 && plan.detail.length > 0) {
      // At the pyramid's top edge there is no coarse level to bridge with.
      // Assemble the requested tiles before replacing the retained frame.
      for (const tile of plan.detail) {
        if (!this.isCurrent(generation)) return;
        const request = this.adapter.request(tile, input.revision, contours, input.editingRadius);
        const key = cacheKey(input.source, request);
        const loaded = await this.getTile(
          request,
          input.source,
          fetch,
          generation,
          new Set([...protectedKeys(), key]),
        );
        if (!this.isCurrent(generation)) return;
        if (!loaded) return;
        this.staged.set(worldTileKey(tile), loaded);
      }
      this.visible = new Map(this.staged);
      this.staged.clear();
      this.enforceBudget(protectedKeys());
      this.overviewComplete = true;
      this.emit(generation, false, publish);
      this.emit(generation, true, publish);
      return;
    }

    for (const tile of plan.detail) {
      if (!this.isCurrent(generation)) return;
      const request = this.adapter.request(tile, input.revision, contours, input.editingRadius);
      const key = cacheKey(input.source, request);
      const loaded = await this.getTile(
        request,
        input.source,
        fetch,
        generation,
        new Set([...protectedKeys(), key]),
      );
      if (!this.isCurrent(generation)) return;
      if (!loaded) return;
      const detailKey = worldTileKey(tile);
      this.staged.set(detailKey, loaded);

      const parent = coveringParent(tile, plan.overview);
      const parentKey = worldTileKey(parent);
      const requiredChildren = detailsByParent.get(parentKey);
      const childrenReady =
        requiredChildren?.every((child) => this.staged.has(worldTileKey(child))) ?? false;
      if (requiredChildren && childrenReady && this.visible.has(parentKey)) {
        // Replace in one map mutation block; no published frame can contain both
        // the coarse parent and any of its fine children.
        this.visible.delete(parentKey);
        for (const child of requiredChildren) {
          const childKey = worldTileKey(child);
          const entry = this.staged.get(childKey);
          if (entry) this.visible.set(childKey, entry);
          this.staged.delete(childKey);
        }
        this.enforceBudget(protectedKeys());
        this.emit(generation, false, publish);
      } else if (!parentTileKeys.has(parentKey)) {
        this.visible.set(detailKey, loaded);
        this.staged.delete(detailKey);
        this.enforceBudget(protectedKeys());
        this.emit(generation, false, publish);
      }
    }

    if (!this.isCurrent(generation)) return;
    this.staged.clear();
    this.enforceBudget(protectedKeys());
    this.emit(generation, true, publish);
    if (input.preload)
      for (const tile of atlasPrefetchTiles(plan, input.preload)) {
        if (!this.isCurrent(generation)) return;
        // Preloading may use spare capacity, but cannot evict or coarsen the view.
        if (this.activeKeys().size >= this.maxRetainedTiles) break;
        try {
          await this.getTile(
            this.adapter.request(tile, input.revision, contours, input.editingRadius),
            input.source,
            fetch,
            generation,
            protectedKeys(),
          );
        } catch {
          // An optional neighbour must not invalidate an already complete view (for
          // example when Main stops accepting reads during native shutdown). The
          // adapter still validates every reply before it can enter the cache.
          break;
        }
      }
  }

  get statistics() {
    return {
      bytes: this.retainedBytes(),
      tiles: new Set(
        [...this.cache.values(), ...this.visible.values(), ...this.staged.values()].map(
          (e) => e.tile,
        ),
      ).size,
      visible: this.visible.size,
      staged: this.staged.size,
    };
  }

  /** Stop disposable reads without discarding the useful displayed cache. */
  cancel(): void {
    this.controller.abort();
    this.generation++;
    this.staged.clear();
  }

  /** Invalidates in-flight loads and releases retained tile data. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.abort();
    this.generation++;
    this.visible.clear();
    this.staged.clear();
    this.cache.clear();
    this.identity = undefined;
  }

  private async getTile(
    request: R,
    source: string,
    fetch: (request: R, signal: AbortSignal) => Promise<T>,
    generation: number,
    keepKeys: Set<string>,
  ): Promise<CachedTile<T> | undefined> {
    const key = cacheKey(source, request);
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    // A superseded load cannot launch another physical fetch. Even consumers
    // that do not support cancellation have at most one outstanding request.
    const signal = this.controller.signal,
      previous = this.fetchTail;
    let release!: () => void;
    this.fetchTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reply: T;
    try {
      await previous;
      if (!this.isCurrent(generation) || signal.aborted) return undefined;
      reply = await fetch(request, signal);
    } catch (error) {
      if (!this.isCurrent(generation) || signal.aborted) return undefined;
      throw error;
    } finally {
      release();
    }
    if (!this.isCurrent(generation)) return undefined;
    this.adapter.validate(reply, request, source);
    const entry = { tile: reply, key, bytes: estimateBytes(reply) };
    this.cache.set(key, entry);
    keepKeys.add(key);
    try {
      this.enforceBudget(keepKeys);
    } catch (error) {
      if (this.cache.get(key) === entry) this.cache.delete(key);
      throw error;
    }
    return entry;
  }

  private emit(
    generation: number,
    complete: boolean,
    publish: (frame: AtlasRasterStreamFrame<T>) => void,
  ): void {
    if (!this.isCurrent(generation)) return;
    const tiles = Object.freeze([...this.visible.values()].map((entry) => entry.tile));
    publish(
      Object.freeze({
        tiles,
        complete,
        overviewComplete: this.overviewComplete || complete,
        generation,
      }),
    );
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.generation;
  }

  private activeKeys(): Set<string> {
    return new Set([...this.visible.values(), ...this.staged.values()].map((entry) => entry.key));
  }

  private enforceBudget(protectedKeys: Set<string>): void {
    while (this.retainedBytes() > this.maxBytes || this.statistics.tiles > this.maxRetainedTiles) {
      let evictKey: string | undefined;
      for (const key of this.cache.keys()) {
        if (!protectedKeys.has(key)) {
          evictKey = key;
          break;
        }
      }
      if (evictKey === undefined)
        throw new Error(
          this.retainedBytes() > this.maxBytes
            ? `Atlas tile stream exceeds maxBytes (${this.maxBytes})`
            : `Atlas tile stream exceeds maxRetainedTiles (${this.maxRetainedTiles})`,
        );
      this.cache.delete(evictKey);
    }
  }

  private retainedBytes(): number {
    const seen = new Set<T>();
    let bytes = 0;
    const add = (entry: CachedTile<T>) => {
      if (seen.has(entry.tile)) return;
      seen.add(entry.tile);
      bytes += entry.bytes;
    };
    for (const entry of this.cache.values()) add(entry);
    for (const entry of this.visible.values()) add(entry);
    for (const entry of this.staged.values()) add(entry);
    return bytes;
  }
}

function sourceIdentity(
  source: string,
  revision: number,
  contours?: number,
  editingRadius?: number,
): string {
  return JSON.stringify([source, revision, contours ?? 0, editingRadius]);
}

function intersectsBox(tile: AtlasWorldTile, box: LandscapeBox): boolean {
  const bounds = atlasWorldTileBounds(tile);
  return (
    bounds.minX < box.x + box.width &&
    bounds.maxX > box.x &&
    bounds.minY < box.y + box.height &&
    bounds.maxY > box.y
  );
}

function cacheKey(source: string, request: AtlasRasterTileRequest): string {
  return JSON.stringify([
    source,
    request.revision,
    request.contours ?? 0,
    request.editingRadius,
    request.tile.lod,
    request.tile.x,
    request.tile.y,
  ]);
}

function worldTileKey(tile: AtlasWorldTile): string {
  return `${tile.lod}/${tile.x}/${tile.y}`;
}

function parentOf(tile: AtlasWorldTile): AtlasWorldTile {
  const lod = tile.lod + 2;
  if (lod > 32) return { lod, x: tile.x, y: tile.y };
  const divisor = 2 ** (lod - tile.lod);
  return { lod, x: Math.floor(tile.x / divisor), y: Math.floor(tile.y / divisor) };
}

function coveringParent(tile: AtlasWorldTile, roots: readonly AtlasWorldTile[]): AtlasWorldTile {
  return (
    roots.find((root) => {
      const divisor = 2 ** (root.lod - tile.lod);
      return (
        root.lod >= tile.lod &&
        Math.floor(tile.x / divisor) === root.x &&
        Math.floor(tile.y / divisor) === root.y
      );
    }) ?? parentOf(tile)
  );
}

function groupChildren(
  tiles: readonly AtlasWorldTile[],
  roots: readonly AtlasWorldTile[],
): Map<string, AtlasWorldTile[]> {
  const groups = new Map<string, AtlasWorldTile[]>();
  for (const tile of tiles) {
    const key = worldTileKey(coveringParent(tile, roots));
    const children = groups.get(key) ?? [];
    children.push(tile);
    groups.set(key, children);
  }
  return groups;
}

/** Counts typed buffers exactly and JS containers conservatively for bounded caching. */
function estimateBytes(value: unknown): number {
  const objects = new Set<object>();
  const buffers = new Set<ArrayBufferLike>();
  const visit = (item: unknown): number => {
    if (item === null || item === undefined) return 0;
    if (typeof item === 'string') return item.length * 2;
    if (typeof item === 'number') return 8;
    if (typeof item === 'boolean') return 1;
    if (typeof item !== 'object') return 0;
    if (ArrayBuffer.isView(item)) {
      const buffer = item.buffer;
      if (buffers.has(buffer)) return 32;
      buffers.add(buffer);
      return buffer.byteLength + 32;
    }
    if (item instanceof ArrayBuffer) {
      if (buffers.has(item)) return 0;
      buffers.add(item);
      return item.byteLength;
    }
    if (objects.has(item)) return 0;
    objects.add(item);
    if (Array.isArray(item))
      return 24 + item.length * 8 + item.reduce((sum, child) => sum + visit(child), 0);
    let bytes = 64;
    for (const [key, child] of Object.entries(item)) bytes += key.length * 2 + visit(child);
    return bytes;
  };
  return Math.max(TILE_OBJECT_OVERHEAD, visit(value));
}
