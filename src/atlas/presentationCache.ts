import type { AtlasClient } from "./client";
import type { Bounds, Status, Version } from "./model";
import type { MapTile } from "./generated/MapTile";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { TerrainResponse } from "./generated/TerrainResponse";
import { cityTiles, type CityView } from "./cityView";
import { terrainRequest } from "./terrainView";
import { scheduledRead } from "./readScheduler";
import { sameVersion } from "./documentVersion";
import { incrementalChanges } from "./documentVersion";
import { BudgetCache } from "./budgetCache";

const overlaps = (a: Bounds, b: Bounds) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** Byte-budgeted viewport cache, owned by PresentationLoader. */
export class CityCache {
  private cache = new BudgetCache<string, { tile: MapTile; bounds: Bounds }>(
    64 * 1024 * 1024,
  );
  private status: Status | null = null;
  private client: AtlasClient | null = null;
  async load(
    client: AtlasClient,
    status: Status,
    bounds: Bounds,
    level: number,
    current: () => boolean,
  ): Promise<CityView | null> {
    if (this.client !== client || !sameVersion(this.status, status)) {
      const changes =
        this.client === client ? incrementalChanges(this.status, status) : null;
      for (const [key, entry] of this.cache) {
        if (!changes || changes.world.some((b) => overlaps(b, entry.bounds))) {
          this.cache.delete(key);
        }
      }
      this.client = client;
      this.status = status;
    }
    let coords = cityTiles(bounds, level);
    while (coords.length > 64 && level < 20)
      coords = cityTiles(bounds, ++level);
    const missing = coords.filter(
      ([x, y]) => !this.cache.has(`${level}/${x}/${y}`),
    );
    if (missing.length) {
      const response = await scheduledRead(
        client,
        "mapTiles",
        { level, tiles: missing },
        current,
      );
      if (
        !response ||
        !current() ||
        this.client !== client ||
        !sameVersion(this.status, status)
      )
        return null;
      if (!sameVersion(response.status, status))
        throw Error("Kartenstand hat sich geändert. Bitte erneut laden.");
      for (const tile of response.tiles) {
        const key = `${level}/${tile.x}/${tile.y}`,
          size = 512 * 2 ** level;
        // Conservative allowance for JS numbers, strings, arrays and objects.
        const bytes = JSON.stringify(tile).length * 6 + 1024;
        this.cache.set(
          key,
          {
            tile,
            bounds: [
              tile.x * size - size / 32,
              tile.y * size - size / 32,
              (tile.x + 1) * size + size / 32,
              (tile.y + 1) * size + size / 32,
            ],
          },
          bytes,
        );
      }
    }
    const tiles: MapTile[] = [];
    for (const [x, y] of coords) {
      const key = `${level}/${x}/${y}`,
        entry = this.cache.get(key);
      if (!entry) throw Error("Kartenkachel fehlt. Bitte erneut laden.");
      tiles.push(entry.tile);
    }
    this.cache.trim();
    return { level, tiles };
  }
}
/** Revision-bound, bounded cache. Publication remains owned by PresentationLoader. */
export class TerrainCache {
  private status: Status | null = null;
  private client: AtlasClient | null = null;
  private tiles = new BudgetCache<string, SurfaceTile>(256);
  private water = 0;
  private waterVersion: Version | null = null;
  async load(
    client: AtlasClient,
    status: Status,
    bounds: Bounds,
    scale: number,
    wanted: () => boolean,
  ): Promise<TerrainResponse | null> {
    const changed = !sameVersion(this.status, status) || this.client !== client;
    if (changed) {
      const changes =
        this.client === client ? incrementalChanges(this.status, status) : null;
      if (changes) {
        for (const [key] of this.tiles) {
          const [level, x, y] = key.split(":").map(Number),
            w = 160 * 2 ** level;
          if (
            changes.world.some(
              (b) =>
                x * w <= b[2] + 505 &&
                (x + 1) * w >= b[0] - 505 &&
                y * w <= b[3] + 505 &&
                (y + 1) * w >= b[1] - 505,
            )
          )
            this.tiles.delete(key);
        }
      } else this.tiles.clear();
      this.status = status;
      this.client = client;
    }
    const args = terrainRequest(bounds, scale),
      key = (x: number, y: number) => `${args.level}:${x}:${y}`;
    const missing = args.tiles.filter(([x, y]) => !this.tiles.has(key(x, y)));
    if (missing.length || changed || !sameVersion(this.waterVersion, status)) {
      const result = await scheduledRead(
        client,
        "terrainTiles",
        { ...args, tiles: missing },
        wanted,
      );
      if (
        !result ||
        !wanted() ||
        this.client !== client ||
        !sameVersion(this.status, status)
      )
        return null;
      if (!sameVersion(result.status, status))
        throw Error("Geländestand hat sich geändert. Bitte erneut laden.");
      this.water = result.waterLevel;
      this.waterVersion = status;
      for (const tile of result.tiles)
        this.tiles.set(key(tile.x, tile.y), tile);
    }
    const tiles = args.tiles.map(([x, y]) => this.tiles.get(key(x, y))!);
    this.tiles.trim();
    return { status, level: args.level, waterLevel: this.water, tiles };
  }
}
