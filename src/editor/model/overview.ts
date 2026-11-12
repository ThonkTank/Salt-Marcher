import { HEIGHT_SUM_SCALE, splineWeights } from "./height";
import {
  HEIGHT_MAX_LEVEL,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  assertBounds,
  heightSpacing,
  parseHeightTileKey,
  validateHeightTile,
  type Bounds,
  type HeightPatch,
  type HeightTile,
} from "./types";

export const HEIGHT_OVERVIEW_SIZE = 128;
export const HEIGHT_OVERVIEW_BYTES = HEIGHT_OVERVIEW_SIZE ** 2 * 8;
export const MAX_HEIGHT_OVERVIEW_POWER = HEIGHT_MAX_LEVEL + 3;
export const MIN_HEIGHT_RENDER_POWER = -8;

/** A derived exact fine sum at fixed world texel centres, divided by 32. */
export interface HeightOverviewTile {
  key: string;
  power: number;
  tileX: number;
  tileY: number;
  values: Float64Array;
}

export interface HeightPresentationRequest {
  sessionId: string;
  bounds: Bounds;
  power: number;
}

export interface HeightPresentationRead extends HeightPresentationRequest {
  sequence: number;
  /** Only levels >= minimumCoarseHeightLevel(power), never fine descendants. */
  tiles: HeightTile[];
  /** Missing entries among overviewKeys are certified absent at this sequence. */
  overviewKeys: string[];
  overviews: HeightOverviewTile[];
}

export function assertHeightRenderPower(power: number): void {
  if (
    !Number.isInteger(power) ||
    power < MIN_HEIGHT_RENDER_POWER ||
    power > MAX_HEIGHT_OVERVIEW_POWER
  )
    throw new RangeError("Ungültige Darstellungsstufe der Höhenübersicht.");
}

/** A level is finer exactly when 5 * 2^level < 2^power. */
export function minimumCoarseHeightLevel(power: number): number {
  assertHeightRenderPower(power);
  return Math.max(0, Math.min(HEIGHT_MAX_LEVEL + 1, power - 2));
}

export function heightOverviewKey(
  power: number,
  tileX: number,
  tileY: number,
): string {
  assertHeightRenderPower(power);
  if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileY))
    throw new RangeError("Ungültige Übersichtskachelkoordinaten.");
  return `height-overview:${power}:${tileX}:${tileY}`;
}

export function parseHeightOverviewKey(key: string): {
  power: number;
  tileX: number;
  tileY: number;
} {
  const match = /^height-overview:(-?\d+):(-?\d+):(-?\d+)$/.exec(key);
  if (!match) throw new RangeError("Ungültiger Höhenübersichtsschlüssel.");
  const [power, tileX, tileY] = match.slice(1).map(Number);
  if (heightOverviewKey(power, tileX, tileY) !== key)
    throw new RangeError("Nichtkanonischer Höhenübersichtsschlüssel.");
  return { power, tileX, tileY };
}

/** Full lattice bounds. Clipping must not stretch its fixed sample grid. */
export function heightOverviewBounds(
  tile: Pick<HeightOverviewTile, "power" | "tileX" | "tileY">,
): Bounds {
  const span = HEIGHT_OVERVIEW_SIZE * 2 ** tile.power;
  return [
    tile.tileX * span,
    tile.tileY * span,
    (tile.tileX + 1) * span,
    (tile.tileY + 1) * span,
  ];
}

export function createHeightOverviewTile(
  power: number,
  tileX: number,
  tileY: number,
): HeightOverviewTile {
  return {
    key: heightOverviewKey(power, tileX, tileY),
    power,
    tileX,
    tileY,
    values: new Float64Array(HEIGHT_OVERVIEW_SIZE ** 2),
  };
}

export function validateHeightOverviewTile(tile: HeightOverviewTile): void {
  if (
    !tile ||
    tile.key !== heightOverviewKey(tile.power, tile.tileX, tile.tileY) ||
    !(tile.values instanceof Float64Array) ||
    tile.values.length !== HEIGHT_OVERVIEW_SIZE ** 2 ||
    !tile.values.every(Number.isFinite)
  )
    throw new RangeError("Beschädigte numerische Höhenübersicht.");
}

export function heightOverviewKeys(
  bounds: Bounds,
  power: number,
  maxKeys = 256,
): string[] {
  assertBounds(bounds);
  assertHeightRenderPower(power);
  const span = HEIGHT_OVERVIEW_SIZE * 2 ** power;
  const x0 = Math.floor(bounds[0] / span);
  const y0 = Math.floor(bounds[1] / span);
  const x1 = Math.floor(bounds[2] / span);
  const y1 = Math.floor(bounds[3] / span);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > maxKeys)
    throw new RangeError("Zu viele Darstellungskacheln für diesen Ausschnitt.");
  const keys: string[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) keys.push(heightOverviewKey(power, x, y));
  return keys;
}

/** Immutable finite source difference. No rendered result is ever an author. */
export interface HeightOverviewDelta {
  level: number;
  tileX: number;
  tileY: number;
  bounds: Bounds;
  /** Divide each operand before subtraction; their raw difference may overflow. */
  values: Float64Array;
}

export function prepareHeightOverviewDelta(
  patch: HeightPatch,
): HeightOverviewDelta | null {
  const at = parseHeightTileKey(patch.key);
  for (const source of [patch.before, patch.after]) {
    if (!source) continue;
    validateHeightTile(source);
    if (source.key !== patch.key)
      throw new Error("Höhenpatch und Quelle stimmen nicht überein.");
  }
  const values = new Float64Array(HEIGHT_TILE_SIZE ** 2);
  const spacing = heightSpacing(at.level);
  const controlX = at.tileX * HEIGHT_TILE_SIZE;
  const controlY = at.tileY * HEIGHT_TILE_SIZE;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let y = 0; y < HEIGHT_TILE_SIZE; y++) {
    const wy = (controlY + y) * spacing;
    if (Math.abs(wy) > WORLD_LIMIT) continue;
    for (let x = 0; x < HEIGHT_TILE_SIZE; x++) {
      const wx = (controlX + x) * spacing;
      if (Math.abs(wx) > WORLD_LIMIT) continue;
      const index = y * HEIGHT_TILE_SIZE + x;
      const before = patch.before?.values[index] ?? 0;
      const after = patch.after?.values[index] ?? 0;
      if (before === after) continue;
      values[index] = after / HEIGHT_SUM_SCALE - before / HEIGHT_SUM_SCALE;
      x0 = Math.min(x0, wx - 2 * spacing);
      y0 = Math.min(y0, wy - 2 * spacing);
      x1 = Math.max(x1, wx + 2 * spacing);
      y1 = Math.max(y1, wy + 2 * spacing);
    }
  }
  return x0 === Infinity
    ? null
    : {
        ...at,
        values,
        bounds: [
          Math.max(-WORLD_LIMIT, x0),
          Math.max(-WORLD_LIMIT, y0),
          Math.min(WORLD_LIMIT, x1),
          Math.min(WORLD_LIMIT, y1),
        ],
      };
}

/** Inclusive global texel indices whose centres can receive this source delta. */
function deltaWindow(delta: HeightOverviewDelta, power: number): Bounds {
  const step = 2 ** power;
  return [
    Math.ceil(delta.bounds[0] / step - 0.5),
    Math.ceil(delta.bounds[1] / step - 0.5),
    Math.floor(delta.bounds[2] / step - 0.5),
    Math.floor(delta.bounds[3] / step - 0.5),
  ];
}

export function heightOverviewDeltaKeys(
  delta: HeightOverviewDelta,
  power: number,
): string[] {
  if (delta.level >= minimumCoarseHeightLevel(power)) return [];
  const [x0, y0, x1, y1] = deltaWindow(delta, power);
  if (x0 > x1 || y0 > y1) return [];
  const keys: string[] = [];
  for (
    let y = Math.floor(y0 / HEIGHT_OVERVIEW_SIZE);
    y <= Math.floor(y1 / HEIGHT_OVERVIEW_SIZE);
    y++
  )
    for (
      let x = Math.floor(x0 / HEIGHT_OVERVIEW_SIZE);
      x <= Math.floor(x1 / HEIGHT_OVERVIEW_SIZE);
      x++
    )
      keys.push(heightOverviewKey(power, x, y));
  return keys;
}

interface AxisSample {
  start: number;
  weights: [number, number, number, number];
}

/** Apply only this source's cubic contribution; never rescan other fine sources. */
export function applyPreparedHeightOverviewDelta(
  tile: HeightOverviewTile,
  delta: HeightOverviewDelta,
  rows: readonly [number, number] = [0, HEIGHT_OVERVIEW_SIZE],
): number {
  if (
    !rows.every(Number.isInteger) ||
    rows[0] < 0 ||
    rows[1] < rows[0] ||
    rows[1] > HEIGHT_OVERVIEW_SIZE
  )
    throw new RangeError("Ungültiger Arbeitsabschnitt der Höhenübersicht.");
  if (delta.level >= minimumCoarseHeightLevel(tile.power)) return 0;
  const window = deltaWindow(delta, tile.power);
  const ox = tile.tileX * HEIGHT_OVERVIEW_SIZE;
  const oy = tile.tileY * HEIGHT_OVERVIEW_SIZE;
  const x0 = Math.max(ox, window[0]);
  const y0 = Math.max(oy + rows[0], window[1]);
  const x1 = Math.min(ox + HEIGHT_OVERVIEW_SIZE - 1, window[2]);
  const y1 = Math.min(oy + rows[1] - 1, window[3]);
  if (x0 > x1 || y0 > y1) return 0;
  const spacing = heightSpacing(delta.level);
  const step = 2 ** tile.power;
  const axis = (from: number, to: number, sourceTile: number) => {
    const result: AxisSample[] = [];
    for (let p = from; p <= to; p++) {
      const world = (p + 0.5) * step;
      const base = Math.floor(world / spacing);
      result.push({
        start: base - 1 - sourceTile * HEIGHT_TILE_SIZE,
        weights: splineWeights((world - base * spacing) / spacing),
      });
    }
    return result;
  };
  const xs = axis(x0, x1, delta.tileX);
  const ys = axis(y0, y1, delta.tileY);
  let changed = 0;
  for (let y = y0; y <= y1; y++) {
    const ay = ys[y - y0];
    for (let x = x0; x <= x1; x++) {
      const ax = xs[x - x0];
      let value = 0;
      for (let j = 0; j < 4; j++) {
        const cy = ay.start + j;
        if (cy < 0 || cy >= HEIGHT_TILE_SIZE || ay.weights[j] === 0) continue;
        const offset = cy * HEIGHT_TILE_SIZE;
        for (let i = 0; i < 4; i++) {
          const cx = ax.start + i;
          if (cx < 0 || cx >= HEIGHT_TILE_SIZE || ax.weights[i] === 0) continue;
          value += delta.values[offset + cx] * ax.weights[i] * ay.weights[j];
        }
      }
      if (value === 0) continue;
      const index = (y - oy) * HEIGHT_OVERVIEW_SIZE + x - ox;
      const next = tile.values[index] + value;
      if (!Number.isFinite(next))
        throw new RangeError("Numerische Höhenübersicht ist übergelaufen.");
      tile.values[index] = next;
      changed++;
    }
  }
  return changed;
}

/** Mutates this owned derived tile and reports actual changed samples. */
export function applyHeightPatchesToOverview(
  tile: HeightOverviewTile,
  patches: readonly HeightPatch[],
): number {
  let changed = 0;
  const minimum = minimumCoarseHeightLevel(tile.power);
  for (const patch of patches) {
    if (parseHeightTileKey(patch.key).level >= minimum) continue;
    const delta = prepareHeightOverviewDelta(patch);
    if (delta) changed += applyPreparedHeightOverviewDelta(tile, delta);
  }
  return changed;
}

/** Project pending authors once over a certified store snapshot, using owned copies. */
export function projectHeightOverviewPatches(
  overviews: readonly HeightOverviewTile[],
  certifiedKeys: readonly string[],
  patches: readonly HeightPatch[],
): HeightOverviewTile[] {
  const certified = new Set(certifiedKeys);
  const result = new Map<string, HeightOverviewTile>();
  for (const tile of overviews) {
    validateHeightOverviewTile(tile);
    if (!certified.has(tile.key) || result.has(tile.key))
      throw new Error("Nicht bestätigte oder doppelte Höhenübersicht.");
    result.set(tile.key, { ...tile, values: tile.values.slice() });
  }
  const deltas = patches.flatMap((patch) => {
    const delta = prepareHeightOverviewDelta(patch);
    return delta ? [delta] : [];
  });
  for (const key of certified) {
    const at = parseHeightOverviewKey(key);
    let tile = result.get(key);
    for (const delta of deltas) {
      if (!heightOverviewDeltaKeys(delta, at.power).includes(key)) continue;
      tile ??= createHeightOverviewTile(at.power, at.tileX, at.tileY);
      if (applyPreparedHeightOverviewDelta(tile, delta)) result.set(key, tile);
    }
  }
  return [...result.values()];
}
