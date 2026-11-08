export type Point = [number, number];
export type Bounds = [number, number, number, number];

export const HEIGHT_TILE_SIZE = 64;
export const HEIGHT_TILE_CELLS = HEIGHT_TILE_SIZE * HEIGHT_TILE_SIZE;
export const HEIGHT_TILE_BYTES =
  HEIGHT_TILE_CELLS * Float64Array.BYTES_PER_ELEMENT;
/** A locally accepted action must fit the host/store's atomic commit boundary. */
export const HEIGHT_MAX_ACTION_TILES = 512;
export const HEIGHT_MAX_LEVEL = 21;
export const HEIGHT_BASE = -100;
export const HEIGHT_LIMIT = 100_000;
export const WORLD_LIMIT = 100_000_000;
export const HEIGHT_LEVELS = Object.freeze(
  Array.from({ length: HEIGHT_MAX_LEVEL + 1 }, (_, level) => level),
);

export interface HeightTile {
  key: string;
  level: number;
  tileX: number;
  tileY: number;
  revision: number;
  /** Relative author values, never a rendered overview. */
  values: Float64Array;
}

export interface HeightTileRecord extends Omit<HeightTile, "values"> {
  values: number[];
}

export type SourceState = "unknown" | "loading" | "ready" | "absent" | "error";

export interface SourceStamp {
  key: string;
  revision: number;
}

export interface HeightPatch {
  key: string;
  before: HeightTile | null;
  after: HeightTile | null;
}

export interface ChangeSet {
  sessionId: string;
  transactionId: string;
  sequence: number;
  revision: number;
  label: string;
  patches: HeightPatch[];
  dirtyBounds: Bounds[];
}

export interface HeightSnapshot {
  sessionId: string;
  generation: number;
  revision: number;
  sequence: number;
  bounds: Bounds;
  levels: readonly number[];
  /** Owned copies: transferring these buffers cannot detach document sources. */
  tiles: HeightTile[];
  dependencies: SourceStamp[];
}

export interface HeightBrush {
  level: number;
  radius: number;
  /** Signed feet per second: negative rates lower the selected author level. */
  amount: number;
  label?: string;
}

export function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < 0 || level > HEIGHT_MAX_LEVEL)
    throw new RangeError("Höhenstufe muss eine ganze Zahl von 0 bis 21 sein.");
}

export function heightSpacing(level: number): number {
  assertLevel(level);
  return 5 * 2 ** level;
}

export function assertPoint(point: Point): void {
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    point.some((v) => !Number.isFinite(v) || Math.abs(v) > WORLD_LIMIT)
  )
    throw new RangeError("Punkt liegt außerhalb der endlichen Atlaswelt.");
}

export function assertBounds(bounds: Bounds): void {
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    bounds.some((v) => !Number.isFinite(v) || Math.abs(v) > WORLD_LIMIT) ||
    bounds[0] > bounds[2] ||
    bounds[1] > bounds[3]
  )
    throw new RangeError("Ungültiger Weltbereich.");
}

export function heightTileKey(
  level: number,
  tileX: number,
  tileY: number,
): string {
  assertLevel(level);
  if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileY))
    throw new RangeError("Ungültige Kachelkoordinaten.");
  return `height:${level}:${tileX}:${tileY}`;
}

export function parseHeightTileKey(key: string): {
  level: number;
  tileX: number;
  tileY: number;
} {
  const match = /^height:(\d+):(-?\d+):(-?\d+)$/.exec(key);
  if (!match) throw new RangeError("Ungültiger Höhenquellenschlüssel.");
  const level = Number(match[1]);
  const tileX = Number(match[2]);
  const tileY = Number(match[3]);
  if (heightTileKey(level, tileX, tileY) !== key)
    throw new RangeError("Höhenquellenschlüssel ist nicht kanonisch.");
  return { level, tileX, tileY };
}

/** Control ownership is half-open, including at negative tile boundaries. */
export function heightControlAddress(
  level: number,
  controlX: number,
  controlY: number,
): { key: string; tileX: number; tileY: number; index: number } {
  if (!Number.isSafeInteger(controlX) || !Number.isSafeInteger(controlY))
    throw new RangeError("Ungültige Höhenstützstelle.");
  const tileX = Math.floor(controlX / HEIGHT_TILE_SIZE);
  const tileY = Math.floor(controlY / HEIGHT_TILE_SIZE);
  return {
    key: heightTileKey(level, tileX, tileY),
    tileX,
    tileY,
    index:
      (controlY - tileY * HEIGHT_TILE_SIZE) * HEIGHT_TILE_SIZE +
      controlX -
      tileX * HEIGHT_TILE_SIZE,
  };
}

/** Conservative cubic support, suitable for the store's spatial index. */
export function heightTileSupport(
  tile: Pick<HeightTile, "level" | "tileX" | "tileY">,
): Bounds {
  const step = heightSpacing(tile.level);
  const span = HEIGHT_TILE_SIZE * step;
  return [
    tile.tileX * span - 2 * step,
    tile.tileY * span - 2 * step,
    (tile.tileX + 1) * span + 2 * step,
    (tile.tileY + 1) * span + 2 * step,
  ];
}

export function intersectsBounds(a: Bounds, b: Bounds): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

export function clipBounds(bounds: Bounds): Bounds {
  return bounds.map((v) =>
    Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, v)),
  ) as Bounds;
}

export function validateHeightTile(tile: HeightTile): void {
  if (
    !tile ||
    tile.key !== heightTileKey(tile.level, tile.tileX, tile.tileY) ||
    !Number.isSafeInteger(tile.revision) ||
    tile.revision < 0 ||
    !(tile.values instanceof Float64Array) ||
    tile.values.length !== HEIGHT_TILE_CELLS ||
    !tile.values.every(Number.isFinite)
  )
    throw new RangeError("Ungültige relative Höhenkachel.");
  const span = HEIGHT_TILE_SIZE * heightSpacing(tile.level);
  if (
    tile.tileX > Math.floor(WORLD_LIMIT / span) ||
    tile.tileX < Math.floor(-WORLD_LIMIT / span) ||
    tile.tileY > Math.floor(WORLD_LIMIT / span) ||
    tile.tileY < Math.floor(-WORLD_LIMIT / span)
  )
    throw new RangeError("Höhenkachel liegt außerhalb der Atlaswelt.");
}

export function cloneHeightTile(tile: HeightTile): HeightTile {
  return { ...tile, values: tile.values.slice() };
}

export function heightTileToRecord(tile: HeightTile): HeightTileRecord {
  validateHeightTile(tile);
  return { ...tile, values: Array.from(tile.values) };
}

export function heightTileFromRecord(record: HeightTileRecord): HeightTile {
  if (!Array.isArray(record.values))
    throw new RangeError("Höhenwerte fehlen im Datensatz.");
  const tile = { ...record, values: new Float64Array(record.values) };
  validateHeightTile(tile);
  return tile;
}
