import {
  LANDSCAPE_MAX_LEVEL,
  LANDSCAPE_TILE_SIZE,
  WORLD_LIMIT,
  assertBounds,
  assertLandscapeWeights,
  landscapeCellAddress,
  landscapeCellCoordinate,
  landscapeTileBounds,
  landscapeTileKey,
  parseLandscapeTileKey,
  validateLandscapeTile,
  type Bounds,
  type LandscapePatch,
  type LandscapeTile,
  type LandscapeWeights,
} from "./types";

export const LANDSCAPE_OVERVIEW_SIZE = 128;
export const LANDSCAPE_OVERVIEW_CELLS = LANDSCAPE_OVERVIEW_SIZE ** 2;
export const LANDSCAPE_OVERVIEW_BYTES = LANDSCAPE_OVERVIEW_CELLS * 6;
export const MIN_LANDSCAPE_RENDER_POWER = -8;
export const MAX_LANDSCAPE_OVERVIEW_POWER = 24;

/** Fine ownership at fixed texel centres; rest=1 asks the coarse source sampler. */
export interface LandscapeOverviewTile {
  key: string;
  power: number;
  tileX: number;
  tileY: number;
  own: Uint8Array;
  rest: Uint8Array;
  /** Finest owner below the presentation cutoff, or 255 for inheritance. */
  sourceLevels: Uint8Array;
}

export interface LandscapePresentationRequest {
  sessionId: string;
  bounds: Bounds;
  power: number;
}

export interface LandscapePresentationRead extends LandscapePresentationRequest {
  sequence: number;
  tiles: LandscapeTile[];
  overviewKeys: string[];
  overviews: LandscapeOverviewTile[];
}

export type LandscapeCellLookup = (
  level: number,
  worldX: number,
  worldY: number,
) => LandscapeWeights | null | undefined;

export function assertLandscapeRenderPower(power: number): void {
  if (
    !Number.isInteger(power) ||
    power < MIN_LANDSCAPE_RENDER_POWER ||
    power > MAX_LANDSCAPE_OVERVIEW_POWER
  )
    throw new RangeError(
      "Ungültige Darstellungsstufe der Landschaftsübersicht.",
    );
}

export function minimumCoarseLandscapeLevel(power: number): number {
  assertLandscapeRenderPower(power);
  return Math.max(0, Math.min(LANDSCAPE_MAX_LEVEL + 1, power));
}

export function landscapeOverviewKey(
  power: number,
  tileX: number,
  tileY: number,
): string {
  assertLandscapeRenderPower(power);
  if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileY))
    throw new RangeError("Ungültige Landschaftsübersichtskoordinaten.");
  return `landscape-overview:${power}:${tileX}:${tileY}`;
}

export function parseLandscapeOverviewKey(key: string): {
  power: number;
  tileX: number;
  tileY: number;
} {
  const match = /^landscape-overview:(-?\d+):(-?\d+):(-?\d+)$/.exec(key);
  if (!match)
    throw new RangeError("Ungültiger Landschaftsübersichtsschlüssel.");
  const [power, tileX, tileY] = match.slice(1).map(Number);
  if (landscapeOverviewKey(power, tileX, tileY) !== key)
    throw new RangeError("Nichtkanonischer Landschaftsübersichtsschlüssel.");
  return { power, tileX, tileY };
}

export function landscapeOverviewBounds(
  tile: Pick<LandscapeOverviewTile, "power" | "tileX" | "tileY">,
): Bounds {
  const span = LANDSCAPE_OVERVIEW_SIZE * 2 ** tile.power;
  return [
    tile.tileX * span,
    tile.tileY * span,
    (tile.tileX + 1) * span,
    (tile.tileY + 1) * span,
  ];
}

export function createLandscapeOverviewTile(
  power: number,
  tileX: number,
  tileY: number,
): LandscapeOverviewTile {
  return {
    key: landscapeOverviewKey(power, tileX, tileY),
    power,
    tileX,
    tileY,
    own: new Uint8Array(LANDSCAPE_OVERVIEW_CELLS * 4),
    rest: new Uint8Array(LANDSCAPE_OVERVIEW_CELLS).fill(1),
    sourceLevels: new Uint8Array(LANDSCAPE_OVERVIEW_CELLS).fill(255),
  };
}

export function cloneLandscapeOverviewTile(
  tile: LandscapeOverviewTile,
): LandscapeOverviewTile {
  return {
    ...tile,
    own: tile.own.slice(),
    rest: tile.rest.slice(),
    sourceLevels: tile.sourceLevels.slice(),
  };
}

export function validateLandscapeOverviewTile(
  tile: LandscapeOverviewTile,
): void {
  if (
    !tile ||
    tile.key !== landscapeOverviewKey(tile.power, tile.tileX, tile.tileY) ||
    !(tile.own instanceof Uint8Array) ||
    tile.own.length !== LANDSCAPE_OVERVIEW_CELLS * 4 ||
    !(tile.rest instanceof Uint8Array) ||
    tile.rest.length !== LANDSCAPE_OVERVIEW_CELLS ||
    !(tile.sourceLevels instanceof Uint8Array) ||
    tile.sourceLevels.length !== LANDSCAPE_OVERVIEW_CELLS
  )
    throw new RangeError("Beschädigte Landschaftsübersicht.");
  const minimum = minimumCoarseLandscapeLevel(tile.power);
  for (let index = 0; index < LANDSCAPE_OVERVIEW_CELLS; index++) {
    const offset = index * 4;
    const sum =
      tile.own[offset] +
      tile.own[offset + 1] +
      tile.own[offset + 2] +
      tile.own[offset + 3];
    const level = tile.sourceLevels[index];
    if (
      tile.rest[index] > 1 ||
      sum > 255 ||
      (tile.rest[index] === 1 ? level !== 255 || sum !== 0 : level >= minimum)
    )
      throw new RangeError(
        "Ungültiger Eigentumsbeleg der Landschaftsübersicht.",
      );
  }
}

export function landscapeOverviewKeys(
  bounds: Bounds,
  power: number,
  maxKeys = 256,
): string[] {
  assertBounds(bounds);
  assertLandscapeRenderPower(power);
  const span = LANDSCAPE_OVERVIEW_SIZE * 2 ** power;
  const x0 = Math.floor(bounds[0] / span),
    y0 = Math.floor(bounds[1] / span);
  const x1 = Math.floor(bounds[2] / span),
    y1 = Math.floor(bounds[3] / span);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > maxKeys)
    throw new RangeError(
      "Zu viele Landschaftsdarstellungskacheln für diesen Ausschnitt.",
    );
  const keys: string[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) keys.push(landscapeOverviewKey(power, x, y));
  return keys;
}

/** Only changed author cells can affect derived samples; no source-store scan. */
function patchBounds(patch: LandscapePatch): Bounds | null {
  const at = parseLandscapeTileKey(patch.key);
  const tileBounds = landscapeTileBounds(at);
  if (
    tileBounds[0] >= WORLD_LIMIT ||
    tileBounds[1] >= WORLD_LIMIT ||
    tileBounds[2] <= -WORLD_LIMIT ||
    tileBounds[3] <= -WORLD_LIMIT
  )
    return null;
  for (const tile of [patch.before, patch.after]) {
    if (!tile) continue;
    validateLandscapeTile(tile);
    if (tile.key !== patch.key)
      throw new Error("Landschaftspatch und Quelle stimmen nicht überein.");
  }
  const step = 2 ** at.level;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let index = 0; index < LANDSCAPE_TILE_SIZE ** 2; index++) {
    if (!changedCell(patch, index)) continue;
    const x = tileBounds[0] + (index % LANDSCAPE_TILE_SIZE) * step;
    const y = tileBounds[1] + Math.floor(index / LANDSCAPE_TILE_SIZE) * step;
    if (
      x >= WORLD_LIMIT ||
      y >= WORLD_LIMIT ||
      x + step <= -WORLD_LIMIT ||
      y + step <= -WORLD_LIMIT
    )
      continue;
    x0 = Math.min(x0, Math.max(x, -WORLD_LIMIT));
    y0 = Math.min(y0, Math.max(y, -WORLD_LIMIT));
    x1 = Math.max(x1, Math.min(x + step, WORLD_LIMIT));
    y1 = Math.max(y1, Math.min(y + step, WORLD_LIMIT));
  }
  return x0 === Infinity ? null : [x0, y0, x1, y1];
}

function changedCell(patch: LandscapePatch, index: number): boolean {
  const before = patch.before?.mask[index] ?? 0;
  const after = patch.after?.mask[index] ?? 0;
  if (before !== after) return true;
  if (!before) return false;
  const offset = index * 4;
  for (let channel = 0; channel < 4; channel++)
    if (
      patch.before!.values[offset + channel] !==
      patch.after!.values[offset + channel]
    )
      return true;
  return false;
}

/** Exclusive sample end, except for the one closed positive world edge. */
function sampleEnd(value: number, step: number): number {
  return value === WORLD_LIMIT
    ? Math.floor(value / step - 0.5) + 1
    : Math.ceil(value / step - 0.5);
}

function sampleWindow(bounds: Bounds, power: number): Bounds {
  const step = 2 ** power;
  return [
    Math.ceil(bounds[0] / step - 0.5),
    Math.ceil(bounds[1] / step - 0.5),
    sampleEnd(bounds[2], step),
    sampleEnd(bounds[3], step),
  ];
}

export function landscapeOverviewPatchKeys(patch: LandscapePatch): string[] {
  const at = parseLandscapeTileKey(patch.key);
  const bounds = patchBounds(patch);
  if (!bounds) return [];
  const keys: string[] = [];
  for (
    let power = at.level + 1;
    power <= MAX_LANDSCAPE_OVERVIEW_POWER;
    power++
  ) {
    const [x0, y0, x1, y1] = sampleWindow(bounds, power);
    if (x0 >= x1 || y0 >= y1) continue;
    for (
      let y = Math.floor(y0 / LANDSCAPE_OVERVIEW_SIZE);
      y <= Math.floor((y1 - 1) / LANDSCAPE_OVERVIEW_SIZE);
      y++
    )
      for (
        let x = Math.floor(x0 / LANDSCAPE_OVERVIEW_SIZE);
        x <= Math.floor((x1 - 1) / LANDSCAPE_OVERVIEW_SIZE);
        x++
      )
        keys.push(landscapeOverviewKey(power, x, y));
  }
  return keys;
}

/**
 * Mutate only this owned overview. Finer winners never trigger reads; removing
 * the winning mask looks up at most the remaining coarser levels at this point.
 * Unknown local fallback throws, so callers must obtain a fresh store overview.
 */
export function applyLandscapeOverviewPatch(
  overview: LandscapeOverviewTile,
  patch: LandscapePatch,
  lookupCoarser: LandscapeCellLookup,
  rows: readonly [number, number] = [0, LANDSCAPE_OVERVIEW_SIZE],
): { examinedSamples: number; changedSamples: number } {
  if (
    !rows.every(Number.isInteger) ||
    rows[0] < 0 ||
    rows[1] < rows[0] ||
    rows[1] > LANDSCAPE_OVERVIEW_SIZE
  )
    throw new RangeError(
      "Ungültiger Arbeitsabschnitt der Landschaftsübersicht.",
    );
  const at = parseLandscapeTileKey(patch.key);
  const minimum = minimumCoarseLandscapeLevel(overview.power);
  const result = { examinedSamples: 0, changedSamples: 0 };
  if (at.level >= minimum) return result;
  const bounds = patchBounds(patch);
  if (!bounds) return result;
  const [wx0, wy0, wx1, wy1] = sampleWindow(bounds, overview.power);
  const ox = overview.tileX * LANDSCAPE_OVERVIEW_SIZE,
    oy = overview.tileY * LANDSCAPE_OVERVIEW_SIZE;
  const x0 = Math.max(ox, wx0),
    x1 = Math.min(ox + LANDSCAPE_OVERVIEW_SIZE, wx1);
  const y0 = Math.max(oy + rows[0], wy0),
    y1 = Math.min(oy + rows[1], wy1);
  const step = 2 ** overview.power;
  for (let y = y0; y < y1; y++) {
    const worldY = (y + 0.5) * step;
    for (let x = x0; x < x1; x++) {
      const worldX = (x + 0.5) * step;
      const cell = landscapeCellAddress(at.level, worldX, worldY);
      if (cell.key !== patch.key || !changedCell(patch, cell.index)) continue;
      result.examinedSamples++;
      const index = (y - oy) * LANDSCAPE_OVERVIEW_SIZE + x - ox;
      const previousLevel = overview.sourceLevels[index];
      if (previousLevel < at.level) continue;
      let level = 255;
      let weights: LandscapeWeights | null = null;
      if (patch.after?.mask[cell.index]) {
        level = at.level;
        weights = readWeights(patch.after.values, cell.index);
      } else {
        if (previousLevel !== at.level) continue;
        for (let nextLevel = at.level + 1; nextLevel < minimum; nextLevel++) {
          const next = lookupCoarser(nextLevel, worldX, worldY);
          if (next === undefined)
            throw new Error(
              "Landschaftsvererbung für diese Übersicht ist noch unbekannt.",
            );
          if (next !== null) {
            assertLandscapeWeights(next);
            level = nextLevel;
            weights = next;
            break;
          }
        }
      }
      const offset = index * 4;
      let changed = previousLevel !== level;
      for (let channel = 0; channel < 4; channel++) {
        const value = weights?.[channel] ?? 0;
        changed ||= overview.own[offset + channel] !== value;
        overview.own[offset + channel] = value;
      }
      overview.sourceLevels[index] = level;
      overview.rest[index] = weights === null ? 1 : 0;
      if (changed) result.changedSamples++;
    }
  }
  return result;
}

function readWeights(values: Uint8Array, index: number): LandscapeWeights {
  const offset = index * 4;
  return [
    values[offset],
    values[offset + 1],
    values[offset + 2],
    values[offset + 3],
  ];
}

/** Prepare once; immutable source arrays are borrowed and only present levels traversed. */
export function prepareLandscapeSampler(
  tiles: readonly LandscapeTile[],
  minLevel = 0,
  maxLevel = LANDSCAPE_MAX_LEVEL,
): (x: number, y: number) => LandscapeWeights {
  if (
    !Number.isInteger(minLevel) ||
    minLevel < 0 ||
    minLevel > LANDSCAPE_MAX_LEVEL + 1 ||
    !Number.isInteger(maxLevel) ||
    maxLevel < -1 ||
    maxLevel > LANDSCAPE_MAX_LEVEL
  )
    throw new RangeError("Ungültiger Landschaftsquellenbereich.");
  const sources = new Map<string, LandscapeTile>();
  const levels = new Set<number>();
  for (const tile of tiles) {
    validateLandscapeTile(tile);
    if (sources.has(tile.key)) throw new Error("Doppelte Landschaftsquelle.");
    sources.set(tile.key, tile);
    if (tile.level >= minLevel && tile.level <= maxLevel)
      levels.add(tile.level);
  }
  const selected = [...levels].sort((a, b) => a - b);
  return (x, y) => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > WORLD_LIMIT ||
      Math.abs(y) > WORLD_LIMIT
    )
      throw new RangeError("Punkt liegt außerhalb der endlichen Atlaswelt.");
    for (const level of selected) {
      const step = 2 ** level;
      const cellX = landscapeCellCoordinate(x, step),
        cellY = landscapeCellCoordinate(y, step);
      const tileX = Math.floor(cellX / LANDSCAPE_TILE_SIZE),
        tileY = Math.floor(cellY / LANDSCAPE_TILE_SIZE);
      const tile = sources.get(landscapeTileKey(level, tileX, tileY));
      if (!tile) continue;
      const index =
        (cellY - tileY * LANDSCAPE_TILE_SIZE) * LANDSCAPE_TILE_SIZE +
        cellX -
        tileX * LANDSCAPE_TILE_SIZE;
      if (tile.mask[index]) return readWeights(tile.values, index);
    }
    return [0, 0, 0, 0];
  };
}

/** Fixed-grid fine ownership composed with independently sampled coarse inheritance. */
export function prepareLandscapePresentation(
  read: LandscapePresentationRead,
): (x: number, y: number) => LandscapeWeights {
  assertBounds(read.bounds);
  const minimum = minimumCoarseLandscapeLevel(read.power);
  const certified = new Set<string>();
  for (const key of read.overviewKeys) {
    const at = parseLandscapeOverviewKey(key);
    if (at.power !== read.power || certified.has(key))
      throw new Error("Unpassende Landschaftsübersichtsantwort.");
    certified.add(key);
  }
  const overviews = new Map<string, LandscapeOverviewTile>();
  for (const overview of read.overviews) {
    validateLandscapeOverviewTile(overview);
    if (!certified.has(overview.key) || overviews.has(overview.key))
      throw new Error("Nicht bestätigte oder doppelte Landschaftsübersicht.");
    overviews.set(overview.key, overview);
  }
  if (read.tiles.some((tile) => tile.level < minimum))
    throw new Error(
      "Feine Landschaftsquellen gehören nicht in die grobe Darstellung.",
    );
  const coarse = prepareLandscapeSampler(read.tiles, minimum);
  const step = 2 ** read.power;
  return (x, y) => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > WORLD_LIMIT ||
      Math.abs(y) > WORLD_LIMIT
    )
      throw new RangeError("Punkt liegt außerhalb der endlichen Atlaswelt.");
    const px = landscapeCellCoordinate(x, step),
      py = landscapeCellCoordinate(y, step);
    const tileX = Math.floor(px / LANDSCAPE_OVERVIEW_SIZE),
      tileY = Math.floor(py / LANDSCAPE_OVERVIEW_SIZE);
    const key = landscapeOverviewKey(read.power, tileX, tileY);
    if (!certified.has(key))
      throw new Error("Landschaftsübersicht ist nicht bestätigt.");
    const tile = overviews.get(key);
    const index =
      (py - tileY * LANDSCAPE_OVERVIEW_SIZE) * LANDSCAPE_OVERVIEW_SIZE +
      px -
      tileX * LANDSCAPE_OVERVIEW_SIZE;
    return tile && tile.rest[index] === 0
      ? readWeights(tile.own, index)
      : coarse(x, y);
  };
}

export function sampleLandscapePresentation(
  read: LandscapePresentationRead,
  x: number,
  y: number,
): LandscapeWeights {
  return prepareLandscapePresentation(read)(x, y);
}
