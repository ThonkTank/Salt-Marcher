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

type TileRequest = { level: number; tiles: [number, number][] };
type TileResponse<T> = { status: Status; tiles: T[] };
type CachePolicy<T> = {
  budget: { bytes: number; entries: number };
  bounds: (tile: T, level: number) => Bounds;
  cost?: (tile: T) => number;
  verifyRevision?: boolean;
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
  private tiles: BudgetCache<string, { tile: T; bounds: Bounds }>;
  private status: Status | null = null;
  private client: AtlasClient | null = null;
  private generation = 0;
  private verified = false;
  constructor(private policy: CachePolicy<T>) {
    this.tiles = new BudgetCache(policy.budget.bytes, policy.budget.entries);
  }
  async load(
    client: AtlasClient,
    status: Status,
    args: TileRequest,
    wanted: () => boolean,
  ) {
    if (this.client !== client || !sameVersion(this.status, status)) {
      const changes =
        this.client === client ? incrementalChanges(this.status, status) : null;
      for (const [key, entry] of this.tiles) {
        if (!changes || changes.world.some((b) => overlaps(b, entry.bounds)))
          this.tiles.delete(key);
      }
      this.client = client;
      this.status = status;
      this.generation++;
      this.verified = false;
    }
    const generation = this.generation;
    const current = () => generation === this.generation && wanted();
    const key = (x: number, y: number) => `${args.level}:${x}:${y}`;
    const missing = args.tiles.filter(([x, y]) => !this.tiles.has(key(x, y)));
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
        this.tiles.set(
          key(tile.x, tile.y),
          {
            tile,
            bounds: this.policy.bounds(tile, args.level),
          },
          this.policy.cost?.(tile),
        );
      }
    }
    const tiles = args.tiles.map(([x, y]) => {
      const entry = this.tiles.get(key(x, y));
      if (!entry) throw Error(this.policy.error);
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
    cost: (tile) =>
      512 +
      tile.heights.length * 8 +
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
    bounds: (t, level) => tileBounds(t.x, t.y, 160 * 2 ** level, 505),
    verifyRevision: true,
    error: "Geländestand hat sich geändert. Bitte erneut laden.",
    read: (client, args, wanted) =>
      scheduledRead(client, "terrainTiles", args, wanted),
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
      terrainRequest(bounds, level),
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
