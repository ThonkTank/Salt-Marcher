import type { Bounds, Camera, Scene, Status } from "./model";
import type { MapFeature } from "./generated/MapFeature";
import type { MapTile } from "./generated/MapTile";
import type { AtlasClient } from "./client";
import { scheduledRead } from "./readScheduler";
import { sameVersion } from "./documentVersion";
import { toWorld } from "./model";

export const MIN_CITY_SCALE = 0.000064;
export const EDIT_SCALE = 1.28;
export type CityView = { level: number; tiles: MapTile[] };
export function cityLevel(scale: number, previous?: number) {
  const ideal = Math.max(0, Math.min(20, Math.floor(Math.log2(1 / scale))));
  if (previous !== undefined) {
    const pixels = 16 * 2 ** previous * scale;
    if (pixels >= 7.2 && pixels <= 17.6) return previous;
  }
  return ideal;
}
export function cityTiles(bounds: Bounds, level: number): [number, number][] {
  const size = 512 * 2 ** level;
  const result: [number, number][] = [];
  for (
    let x = Math.floor(bounds[0] / size);
    x <= Math.floor(bounds[2] / size);
    x++
  )
    for (
      let y = Math.floor(bounds[1] / size);
      y <= Math.floor(bounds[3] / size);
      y++
    )
      result.push([x, y]);
  return result;
}
const overlaps = (a: Bounds, b: Bounds) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** Byte-budgeted viewport cache, owned by PresentationLoader. */
export class CityCache {
  private cache = new Map<
    string,
    { tile: MapTile; bytes: number; bounds: Bounds }
  >();
  private bytes = 0;
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
      const changes = status.changes;
      const incremental =
        this.client === client &&
        this.status?.sessionId === status.sessionId &&
        this.status.revision + 1 === status.revision &&
        changes;
      for (const [key, entry] of this.cache) {
        if (
          !incremental ||
          changes.world.some((b) => overlaps(b, entry.bounds))
        ) {
          this.cache.delete(key);
          this.bytes -= entry.bytes;
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
      if (!response || !current()) return null;
      if (!sameVersion(response.status, status))
        throw Error("Kartenstand hat sich geändert. Bitte erneut laden.");
      for (const tile of response.tiles) {
        const key = `${level}/${tile.x}/${tile.y}`,
          size = 512 * 2 ** level;
        // Conservative allowance for JS numbers, strings, arrays and objects.
        const bytes = JSON.stringify(tile).length * 6 + 1024;
        this.cache.set(key, {
          tile,
          bytes,
          bounds: [
            tile.x * size - size / 32,
            tile.y * size - size / 32,
            (tile.x + 1) * size + size / 32,
            (tile.y + 1) * size + size / 32,
          ],
        });
        this.bytes += bytes;
      }
    }
    const tiles: MapTile[] = [];
    for (const [x, y] of coords) {
      const key = `${level}/${x}/${y}`,
        entry = this.cache.get(key);
      if (!entry) throw Error("Kartenkachel fehlt. Bitte erneut laden.");
      this.cache.delete(key);
      this.cache.set(key, entry);
      tiles.push(entry.tile);
    }
    while (this.bytes > 64 * 1024 * 1024 && this.cache.size) {
      const key = this.cache.keys().next().value!;
      this.bytes -= this.cache.get(key)!.bytes;
      this.cache.delete(key);
    }
    return { level, tiles };
  }
}
export function sceneFeatures(scene: Scene): MapFeature[] {
  return scene.objects.flatMap((o): MapFeature[] => {
    if (o.kind === "house") {
      const paths = o.contours.map((r) =>
        r.map((p) => toWorld(p, o.transform)),
      );
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const ring of paths)
        for (const p of ring) {
          minX = Math.min(minX, p[0]);
          minY = Math.min(minY, p[1]);
          maxX = Math.max(maxX, p[0]);
          maxY = Math.max(maxY, p[1]);
        }
      const rank = Number.isFinite(minX) ? (maxX - minX) * (maxY - minY) : 0;
      return [
        {
          id: o.id,
          kind: "house",
          name: o.name,
          important: o.importantPlace,
          paths,
          color: o.roof,
          width: 0,
          rank,
        },
      ];
    }
    if (o.kind === "road")
      return [
        {
          id: o.id,
          kind: "road",
          name: o.name,
          important: false,
          paths: [o.path],
          color: "",
          width: o.width,
          rank:
            o.width *
            o.path.reduce(
              (sum, p, i) =>
                i
                  ? sum +
                    Math.hypot(p[0] - o.path[i - 1][0], p[1] - o.path[i - 1][1])
                  : 0,
              0,
            ),
        },
      ];
    return [];
  });
}
export function overviewFeatures(view: CityView): MapFeature[] {
  return [
    ...new Map(
      view.tiles.flatMap((tile) => tile.features).map((f) => [f.id, f]),
    ).values(),
  ];
}
export function zoomIntoCity(camera: Camera, point: [number, number]): Camera {
  const scale =
    camera.scale < 0.064 ? 0.064 : camera.scale < 0.32 ? 0.32 : EDIT_SCALE;
  return {
    scale,
    x: camera.x + point[0] * (camera.scale - scale),
    y: camera.y + point[1] * (camera.scale - scale),
  };
}
