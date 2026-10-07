import type { Building, Id, Point } from "../../model";
import { inside } from "../../geometry";
import { isNativeFloorAssetId } from "./native-path-catalog";

const MASK64 = (1n << 64n) - 1n;
const DEFAULT_SEED = 12047754176567800795n;
const DEFAULT_INC = 1442695040888963407n;
const MULTIPLIER = 6364136223846793005n;

/** Godot 3.4.2's default PCG stream, used by the inspected native TileSet. */
class NativeTileRandom {
  private state = 0n;
  private readonly increment = ((DEFAULT_INC << 1n) | 1n) & MASK64;
  constructor() {
    this.next();
    this.state = (this.state + DEFAULT_SEED) & MASK64;
    this.next();
  }
  next(): number {
    const old = this.state;
    this.state = (old * MULTIPLIER + this.increment) & MASK64;
    const x = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn);
    const rotation = Number(old >> 59n);
    return ((x >>> rotation) | (x << ((-rotation) & 31))) >>> 0;
  }
}

function atlasColumns(assetId: string): number {
  return assetId.includes("tileset_stone") ? 8 : 4;
}

/** Default-mask cells in Godot's Vector2 map order (column before row). */
function defaultCells(assetId: string): readonly number[] {
  const columns = atlasColumns(assetId);
  const smart = columns === 8 || assetId.includes("tileset_wood_vertical");
  const result: number[] = [];
  for (let column = 0; column < columns; column++)
    for (let row = 0; row < 4; row++)
      if (!smart || row !== 3 || column % 4 !== 3)
        result.push(row * columns + column);
  return result;
}

/** Native FloorTileMap.Load sets each cell, then updates its 3×3 bitmask area. */
export function nativeFloorVariants(
  cells: readonly (string | null)[],
  width: number,
  height: number,
): Uint8Array {
  if (cells.length !== width * height || !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) || width < 1 || height < 1)
    throw new RangeError("Ungültige native Bodenzellen.");
  const result = new Uint8Array(cells.length).fill(255);
  const active = new Uint8Array(cells.length);
  const random = new NativeTileRandom();
  const choices = new Map<string, readonly number[]>();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (cells[index]) active[index] = 1;
      for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++)
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
          const neighbor = ny * width + nx;
          if (!active[neighbor]) continue;
          const assetId = cells[neighbor]!;
          let variants = choices.get(assetId);
          if (!variants) {
            variants = defaultCells(assetId);
            choices.set(assetId, variants);
          }
          result[neighbor] = variants[random.next() % variants.length]!;
        }
    }
  return result;
}

/** The native tile map stores one floor style per occupied field. */
export function nativeFloorCells(
  buildings: readonly Building[],
  floorId: Id,
  width: number,
  height: number,
  replacement?: Building,
): (string | null)[] {
  const cells: (string | null)[] = Array(width * height).fill(null);
  for (const stored of replacement &&
    !buildings.some((building) => building.id === replacement.id)
      ? [...buildings, replacement] : buildings) {
    const building = stored.id === replacement?.id ? replacement : stored;
    const assetId = building.material?.assetId;
    if (building.floorId !== floorId || !assetId ||
        !isNativeFloorAssetId(assetId)) continue;
    for (const polygon of building.polygons) {
      const minX = Math.max(0, Math.floor(Math.min(...polygon.outer.map((p) => p.x))));
      const maxX = Math.min(width, Math.ceil(Math.max(...polygon.outer.map((p) => p.x))));
      const minY = Math.max(0, Math.floor(Math.min(...polygon.outer.map((p) => p.y))));
      const maxY = Math.min(height, Math.ceil(Math.max(...polygon.outer.map((p) => p.y))));
      for (let y = minY; y < maxY; y++)
        for (let x = minX; x < maxX; x++) {
          const center = { x: x + 0.5, y: y + 0.5 };
          if (inside(center, polygon.outer) &&
              !polygon.holes.some((hole) => inside(center, hole)))
            cells[y * width + x] = assetId;
        }
    }
  }
  return cells;
}

/** Include only cells with a visible piece of a clipped diagonal floor. */
export function floorPolygonTouchesCell(
  outer: readonly Point[], x: number, y: number,
): boolean {
  if (inside({ x: x + 0.5, y: y + 0.5 }, outer)) return true;
  if (outer.some((p) => p.x >= x && p.x <= x + 1 &&
      p.y >= y && p.y <= y + 1)) return true;
  for (const corner of [
    { x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 },
  ]) if (inside(corner, outer)) return true;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!, b = outer[(i + 1) % outer.length]!,
      dx = b.x - a.x, dy = b.y - a.y;
    let low = 0, high = 1;
    for (const [p, q] of [
      [-dx, a.x - x], [dx, x + 1 - a.x],
      [-dy, a.y - y], [dy, y + 1 - a.y],
    ] as const) {
      if (p === 0 && q < 0) { low = 2; break; }
      if (p < 0) low = Math.max(low, q / p);
      if (p > 0) high = Math.min(high, q / p);
    }
    if (low <= high) return true;
  }
  return false;
}
