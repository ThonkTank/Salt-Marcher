import type { HousePatch } from "./house";
import type { WaterPatch } from "./water";

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

export const LANDSCAPE_TILE_SIZE = 64;
export const LANDSCAPE_TILE_CELLS = LANDSCAPE_TILE_SIZE ** 2;
export const LANDSCAPE_TILE_BYTES = LANDSCAPE_TILE_CELLS * 5;
export const LANDSCAPE_MAX_LEVEL = 24;
export const LANDSCAPE_LEVELS = Object.freeze(
  Array.from({ length: LANDSCAPE_MAX_LEVEL + 1 }, (_, level) => level),
);
export type LandscapeWeights = [number, number, number, number];

export interface LandscapeTile {
  key: string;
  level: number;
  tileX: number;
  tileY: number;
  revision: number;
  /** 0 inherits; 1 owns this cell, including an explicitly empty clearing. */
  mask: Uint8Array;
  /** Four alternative coverages per cell, with sum at most 255. */
  values: Uint8Array;
}

export interface LandscapePatch {
  key: string;
  before: LandscapeTile | null;
  after: LandscapeTile | null;
}

/** The closed author set shares one journal, history and persistence boundary. */
export type SourcePatch =
  | ({ kind: "height" } & HeightPatch)
  | ({ kind: "landscape" } & LandscapePatch)
  | ({ kind: "house" } & HousePatch)
  | ({ kind: "water" } & WaterPatch);

export interface LandscapeBrush {
  level: number;
  radius: number;
  weights: LandscapeWeights;
  strength?: number;
  label?: string;
}

export interface LandscapeSnapshot {
  sessionId: string;
  generation: number;
  revision: number;
  sequence: number;
  bounds: Bounds;
  minLevel: number;
  /** Owned copies; render snapshots should borrow landscapeSources instead. */
  tiles: LandscapeTile[];
}

export interface HeightTile {
  key: string;
  level: number;
  tileX: number;
  tileY: number;
  revision: number;
  /** Relative author values, never a rendered overview. */
  values: Float64Array;
}

/** Load progress and errors belong to the controller, not cached source data. */
export type SourceState = "unknown" | "ready" | "absent";

export interface HeightPatch {
  key: string;
  before: HeightTile | null;
  after: HeightTile | null;
}

export interface ChangeSet {
  readonly sessionId: string;
  readonly transactionId: string;
  readonly sequence: number;
  readonly revision: number;
  readonly label: string;
  /** Shared immutable snapshots. Never mutate values or transfer these buffers. */
  readonly patches: SourcePatch[];
  readonly dirtyBounds: Bounds[];
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
}

/** One timed part of an atomically accepted brush path. */
export interface HeightSegment {
  from: Point;
  to: Point;
  elapsedMs: number;
}

export interface HeightBrush {
  level: number;
  radius: number;
  /** Signed feet per second: negative rates lower the selected author level. */
  amount: number;
  label?: string;
}

/** Immediate, spatial coast target; independent of the timed height dose. */
export interface CoastBrush {
  level: number;
  radius: number;
  mode: "land" | "sea";
  /** Zero is round; positive values indent the coast inside the brush. */
  roughness: number;
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

export function assertLandscapeLevel(level: number): void {
  if (!Number.isInteger(level) || level < 0 || level > LANDSCAPE_MAX_LEVEL)
    throw new RangeError(
      "Landschaftsstufe muss eine ganze Zahl von 0 bis 24 sein.",
    );
}

export function landscapeSpacing(level: number): number {
  assertLandscapeLevel(level);
  return 2 ** level;
}

export function assertLandscapeWeights(weights: readonly number[]): void {
  if (
    !Array.isArray(weights) ||
    weights.length !== 4 ||
    weights.some(
      (value) => !Number.isInteger(value) || value < 0 || value > 255,
    ) ||
    weights.reduce((sum, value) => sum + value, 0) > 255
  )
    throw new RangeError(
      "Landschaft benötigt vier Bytegewichte mit Summe höchstens 255.",
    );
}

export function landscapeTileKey(
  level: number,
  tileX: number,
  tileY: number,
): string {
  assertLandscapeLevel(level);
  if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileY))
    throw new RangeError("Ungültige Landschaftskachelkoordinaten.");
  return `landscape:${level}:${tileX}:${tileY}`;
}

export function parseLandscapeTileKey(key: string): {
  level: number;
  tileX: number;
  tileY: number;
} {
  const match = /^landscape:(\d+):(-?\d+):(-?\d+)$/.exec(key);
  if (!match) throw new RangeError("Ungültiger Landschaftsquellenschlüssel.");
  const [level, tileX, tileY] = match.slice(1).map(Number);
  if (landscapeTileKey(level, tileX, tileY) !== key)
    throw new RangeError("Landschaftsquellenschlüssel ist nicht kanonisch.");
  return { level, tileX, tileY };
}

/** Half-open cells; the world's closed positive endpoint belongs inward. */
export function landscapeCellCoordinate(value: number, step: number): number {
  return value === WORLD_LIMIT
    ? Math.ceil(value / step) - 1
    : Math.floor(value / step);
}

export function landscapeCellAddress(
  level: number,
  x: number,
  y: number,
): {
  key: string;
  tileX: number;
  tileY: number;
  index: number;
} {
  assertPoint([x, y]);
  const step = landscapeSpacing(level);
  const cellX = landscapeCellCoordinate(x, step);
  const cellY = landscapeCellCoordinate(y, step);
  const tileX = Math.floor(cellX / LANDSCAPE_TILE_SIZE);
  const tileY = Math.floor(cellY / LANDSCAPE_TILE_SIZE);
  return {
    key: landscapeTileKey(level, tileX, tileY),
    tileX,
    tileY,
    index:
      (cellY - tileY * LANDSCAPE_TILE_SIZE) * LANDSCAPE_TILE_SIZE +
      cellX -
      tileX * LANDSCAPE_TILE_SIZE,
  };
}

export function landscapeTileBounds(
  tile: Pick<LandscapeTile, "level" | "tileX" | "tileY">,
): Bounds {
  const span = LANDSCAPE_TILE_SIZE * landscapeSpacing(tile.level);
  return [
    tile.tileX * span,
    tile.tileY * span,
    (tile.tileX + 1) * span,
    (tile.tileY + 1) * span,
  ];
}

export function createLandscapeTile(
  level: number,
  tileX: number,
  tileY: number,
  revision = 0,
): LandscapeTile {
  return {
    key: landscapeTileKey(level, tileX, tileY),
    level,
    tileX,
    tileY,
    revision,
    mask: new Uint8Array(LANDSCAPE_TILE_CELLS),
    values: new Uint8Array(LANDSCAPE_TILE_CELLS * 4),
  };
}

export function cloneLandscapeTile(tile: LandscapeTile): LandscapeTile {
  return { ...tile, mask: tile.mask.slice(), values: tile.values.slice() };
}

export function validateLandscapeTile(tile: LandscapeTile): void {
  if (
    !tile ||
    tile.key !== landscapeTileKey(tile.level, tile.tileX, tile.tileY) ||
    !Number.isSafeInteger(tile.revision) ||
    tile.revision < 0 ||
    !(tile.mask instanceof Uint8Array) ||
    tile.mask.length !== LANDSCAPE_TILE_CELLS ||
    !(tile.values instanceof Uint8Array) ||
    tile.values.length !== LANDSCAPE_TILE_CELLS * 4
  )
    throw new RangeError("Ungültige Landschaftsquelle.");
  const bounds = landscapeTileBounds(tile);
  if (
    bounds[0] >= WORLD_LIMIT ||
    bounds[1] >= WORLD_LIMIT ||
    bounds[2] <= -WORLD_LIMIT ||
    bounds[3] <= -WORLD_LIMIT
  )
    throw new RangeError("Landschaftskachel liegt außerhalb der Atlaswelt.");
  for (let index = 0; index < LANDSCAPE_TILE_CELLS; index++) {
    const offset = index * 4;
    const sum =
      tile.values[offset] +
      tile.values[offset + 1] +
      tile.values[offset + 2] +
      tile.values[offset + 3];
    if (
      tile.mask[index] > 1 ||
      sum > 255 ||
      (tile.mask[index] === 0 && sum !== 0)
    )
      throw new RangeError("Ungültige Landschaftsmaske oder Deckung.");
  }
}
