import type { AtlasClient } from "./client";
import type { Bounds, Status } from "./model";
import type { MapTile } from "./generated/MapTile";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { GroundTile } from "./generated/GroundTile";
import { cityRequest } from "./cityView";
import { terrainRequest } from "./terrainView";
import { groundRequest } from "./groundView";
import { scheduledRead } from "./readScheduler";
import { incrementalChanges, sameVersion } from "./documentVersion";
import { BudgetCache } from "./budgetCache";
import { CACHE_BUDGETS } from "./cacheBudgets";

type TileRequest = {
  level: number;
  tiles: [number, number][];
  pixels?: number;
  contourInterval?: number;
};
type TileResponse<T> = { status: Status; tiles: T[] };
type CachePolicy<T> = {
  budget: { bytes: number; entries: number };
  bounds: (tile: T, level: number) => Bounds;
  cost?: (tile: T) => number;
  resolution?: (tile: T) => string;
  verifyRevision?: boolean;
  identity?: (tile: T) => string;
  error: string;
  read: (
    client: AtlasClient,
    args: TileRequest,
    wanted: () => boolean,
  ) => Promise<TileResponse<T> | undefined>;
};
const overlaps = (a: Bounds, b: Bounds) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const tileBounds = (
  x: number,
  y: number,
  size: number,
  margin: number,
): Bounds => [
  x * size - margin,
  y * size - margin,
  (x + 1) * size + margin,
  (y + 1) * size + margin,
];

/** Shared lifetime and batch loading; each layer owns its spatial invalidation policy. */
class WorldTileCache<T extends { x: number; y: number }> {
  private tiles: BudgetCache<
    string,
    { tile: T; bounds: Bounds; valid: boolean }
  >;
  private status: Status | null = null;
  private client: AtlasClient | null = null;
  private generation = 0;
  private verified = false;
  constructor(private policy: CachePolicy<T>) {
    this.tiles = new BudgetCache(policy.budget.bytes, policy.budget.entries);
  }
  advance(client: AtlasClient, status: Status) {
    if (this.client !== client || !sameVersion(this.status, status)) {
      const changes =
        this.client === client ? incrementalChanges(this.status, status) : null;
      for (const [key, entry] of this.tiles) {
        if (
          this.client !== client ||
          this.status?.sessionId !== status.sessionId
        )
          this.tiles.delete(key);
        else if (
          !changes ||
          changes.world.some((b) => overlaps(b, entry.bounds))
        ) {
          if (this.policy.identity) entry.valid = false;
          else this.tiles.delete(key);
        }
      }
      this.client = client;
      this.status = status;
      this.generation++;
      this.verified = false;
    }
  }
  private put(key: string, tile: T, level: number) {
    const previous = this.tiles.peek(key);
    const identity = this.policy.identity?.(tile);
    if (
      identity &&
      previous &&
      identity === this.policy.identity?.(previous.tile)
    )
      tile = previous.tile;
    this.tiles.set(
      key,
      { tile, bounds: this.policy.bounds(tile, level), valid: true },
      this.policy.cost?.(tile),
    );
  }
  seed(client: AtlasClient, response: TileResponse<T> & { level: number }) {
    if (
      this.client === client &&
      this.status &&
      (this.status.sessionId !== response.status.sessionId ||
        this.status.revision > response.status.revision)
    )
      return;
    this.advance(client, response.status);
    for (const tile of response.tiles)
      this.put(
        `${response.status.sessionId}:${response.level}:${tile.x}:${tile.y}:${this.policy.resolution?.(tile) ?? ""}`,
        tile,
        response.level,
      );
    this.verified = true;
    this.tiles.trim();
  }
  async load(
    client: AtlasClient,
    status: Status,
    args: TileRequest,
    wanted: () => boolean,
  ) {
    if (
      this.client === client &&
      this.status?.sessionId === status.sessionId &&
      this.status.revision > status.revision
    )
      return null;
    this.advance(client, status);
    const generation = this.generation;
    const current = () => generation === this.generation && wanted();
    const key = (x: number, y: number) =>
      `${status.sessionId}:${args.level}:${x}:${y}:${args.pixels === undefined ? "" : `${args.pixels}:${args.contourInterval ?? 5}`}`;
    const missing = args.tiles.filter(
      ([x, y]) => !this.tiles.peek(key(x, y))?.valid,
    );
    if (missing.length || (this.policy.verifyRevision && !this.verified)) {
      const result = await this.policy.read(
        client,
        { ...args, tiles: missing },
        current,
      );
      if (!result || !current()) return null;
      if (!sameVersion(result.status, status)) throw Error(this.policy.error);
      this.verified = true;
      for (const tile of result.tiles) {
        this.put(key(tile.x, tile.y), tile, args.level);
      }
    }
    const tiles = args.tiles.map(([x, y]) => {
      const entry = this.tiles.get(key(x, y));
      if (!entry?.valid) throw Error(this.policy.error);
      return entry.tile;
    });
    this.tiles.trim();
    return { status, level: args.level, tiles };
  }
}

export class CityCache {
  private cache = new WorldTileCache<MapTile>({
    budget: CACHE_BUDGETS.city,
    bounds: (t, level) =>
      tileBounds(t.x, t.y, 512 * 2 ** level, 16 * 2 ** level),
    // Structural allowance for JS objects, arrays, numbers and UTF-16 strings.
    cost: (tile) =>
      1024 +
      tile.density.length * 64 +
      tile.features.reduce(
        (total, f) =>
          total +
          256 +
          2 * (f.id.length + f.name.length + f.kind.length + f.color.length) +
          f.paths.reduce((sum, path) => sum + 32 + path.length * 48, 0),
        0,
      ),
    error: "Kartenstand hat sich geändert. Bitte erneut laden.",
    read: (client, args, wanted) =>
      scheduledRead(client, "mapTiles", args, wanted),
  });
  load(
    client: AtlasClient,
    status: Status,
    bounds: Bounds,
    level: number,
    wanted: () => boolean,
  ) {
    return this.cache.load(client, status, cityRequest(bounds, level), wanted);
  }
}

export class TerrainCache {
  private cache = new WorldTileCache<SurfaceTile>({
    budget: CACHE_BUDGETS.terrain,
    identity: (tile) => tile.contentId,
    resolution: (tile) =>
      `${tile.raster?.pixels ?? 512}:${tile.raster?.contourInterval ?? 5}`,
    cost: (tile) =>
      512 +
      tile.contentId.length * 2 +
      tile.heights.length * 8 +
      (tile.raster
        ? 2 * (tile.raster.relief.length + tile.raster.water.length) +
          tile.raster.contours.length * 32
        : 0) +
      tile.foundationTops.reduce((n, [id]) => n + 48 + id.length * 2, 0) +
      tile.waters.reduce(
        (n, water) =>
          n +
          128 +
          water.id.length * 2 +
          water.polygons.reduce(
            (sum, polygon) =>
              sum +
              64 +
              [polygon.outer, ...polygon.holes].reduce(
                (r, ring) => r + 32 + ring.length * 48,
                0,
              ),
            0,
          ),
        0,
      ),
    bounds: (t, level) =>
      tileBounds(
        t.x,
        t.y,
        160 * 2 ** level,
        Math.max(10, (160 * 2 ** level) / 16),
      ),
    verifyRevision: true,
    error: "Geländestand hat sich geändert. Bitte erneut laden.",
    read: (client, args, wanted) =>
      scheduledRead(client, "terrainTiles", args, wanted),
  });
  advance(client: AtlasClient, status: Status) {
    this.cache.advance(client, status);
  }
  seed(
    client: AtlasClient,
    response: import("./generated/TerrainResponse").TerrainResponse,
  ) {
    this.cache.seed(client, response);
  }
  load(
    client: AtlasClient,
    status: Status,
    bounds: Bounds,
    level: number,
    wanted: () => boolean,
    scale?: number,
    dpr?: number,
  ) {
    return this.cache.load(
      client,
      status,
      terrainRequest(bounds, level, scale, dpr),
      wanted,
    );
  }
}

export class GroundCache {
  private cache = new WorldTileCache<GroundTile>({
    budget: CACHE_BUDGETS.ground,
    bounds: (t, level) => tileBounds(t.x, t.y, 64 * 2 ** level, 2 ** level),
    cost: (tile) => tile.pixels.length * 2 + 66 * 66 * 4 + 512,
    error: "Bodenfarben haben sich geändert. Bitte erneut laden.",
    read: (client, args, wanted) =>
      scheduledRead(client, "groundTiles", args, wanted),
  });
  load(
    client: AtlasClient,
    status: Status,
    bounds: Bounds,
    level: number,
    wanted: () => boolean,
  ) {
    return this.cache.load(
      client,
      status,
      groundRequest(bounds, level),
      wanted,
    );
  }
}

// One confirmed terrain owner per document protocol, surviving UI remounts.
const terrainCaches = new WeakMap<AtlasClient, TerrainCache>();
export function terrainCacheFor(client: AtlasClient): TerrainCache {
  let cache = terrainCaches.get(client);
  if (!cache) {
    cache = new TerrainCache();
    terrainCaches.set(client, cache);
  }
  return cache;
}
