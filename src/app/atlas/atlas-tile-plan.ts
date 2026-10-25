import { ATLAS_WORLD_TILE_METERS, type AtlasWorldTile } from './atlas-world-tiles.js';

const MIN_LOD = -8;
const MAX_LOD = 32;
const MAX_CANONICAL_BOUND = 1e12;
const DEFAULT_MAX_TILES = 64;

export interface AtlasTilePlanBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface AtlasTilePlanOptions {
  readonly maxTiles?: number;
  readonly focus?: AtlasTilePlanBox;
}
export interface AtlasTilePlan {
  readonly detail: AtlasWorldTile[];
  readonly overview: AtlasWorldTile[];
}

/** Optional coarse neighbours, selected only after the visible plan is fixed. */
export function atlasPrefetchTiles(
  plan: AtlasTilePlan,
  box: AtlasTilePlanBox,
  limit = 8,
): AtlasWorldTile[] {
  if (
    !plan.detail.length ||
    !Number.isSafeInteger(limit) ||
    limit <= 0 ||
    ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
    box.width <= 0 ||
    box.height <= 0
  )
    return [];
  const lod = Math.min(MAX_LOD, Math.max(...plan.detail.map((t) => t.lod)) + 2);
  const range = tileRange(box, lod);
  // Prefetch is disposable: never enumerate a huge padded world.
  if (tileCount(range) > 256) return [];
  const overlaps = (a: AtlasWorldTile, b: AtlasWorldTile) => {
    const fine = a.lod < b.lod ? a : b,
      coarse = a.lod < b.lod ? b : a,
      d = 2 ** (coarse.lod - fine.lod);
    return Math.floor(fine.x / d) === coarse.x && Math.floor(fine.y / d) === coarse.y;
  };
  const size = ATLAS_WORLD_TILE_METERS * 2 ** lod;
  const tiles = enumerate(range, lod).filter(
    (t) =>
      [t.x * size, t.y * size, (t.x + 1) * size, (t.y + 1) * size].every(
        (v) => Math.abs(v) <= MAX_CANONICAL_BOUND,
      ) && !plan.detail.some((d) => overlaps(t, d)),
  );
  tiles.sort(
    (a, b) =>
      distanceToCenter(a, lod, box.x + box.width / 2, box.y + box.height / 2) -
      distanceToCenter(b, lod, box.x + box.width / 2, box.y + box.height / 2),
  );
  const result = tiles.slice(0, limit);
  assertCanonicalTiles(result);
  return result;
}

/**
 * Selects a bounded, viewport-dependent pyramid from the stable signed world grid.
 * Tile extents are half-open, so a viewport ending on a tile edge does not fetch
 * the tile beyond that edge.
 */
export function atlasTilePlan(
  box: AtlasTilePlanBox,
  metersPerPixel: number,
  options: AtlasTilePlanOptions = {},
): AtlasTilePlan {
  if (!box || ![box.x, box.y, box.width, box.height, metersPerPixel].every(Number.isFinite)) {
    throw new Error('Atlas tile plan values must be finite');
  }
  if (box.width <= 0 || box.height <= 0)
    throw new Error('Atlas tile plan box must have positive dimensions');
  if (metersPerPixel <= 0) throw new Error('Atlas meters per pixel must be positive');
  const maxX = box.x + box.width,
    maxY = box.y + box.height;
  if (![maxX, maxY].every(Number.isFinite) || maxX <= box.x || maxY <= box.y) {
    throw new Error('Atlas tile plan box extent is lost to numeric precision');
  }
  if (
    Math.abs(box.x) > MAX_CANONICAL_BOUND ||
    Math.abs(box.y) > MAX_CANONICAL_BOUND ||
    Math.abs(maxX) > MAX_CANONICAL_BOUND ||
    Math.abs(maxY) > MAX_CANONICAL_BOUND
  ) {
    throw new Error('Atlas tile plan bounds exceed the canonical world range');
  }
  const maxTiles = options.maxTiles ?? DEFAULT_MAX_TILES;
  if (!Number.isInteger(maxTiles) || maxTiles < 1 || maxTiles > 256) {
    throw new Error('Atlas tile plan maxTiles must be an integer from 1 to 256');
  }

  if (options.focus) return focusedPlan(box, metersPerPixel, maxTiles, options.focus);

  const rawLod = Math.floor(Math.log2(metersPerPixel));
  let lod = Math.max(MIN_LOD, Math.min(MAX_LOD, rawLod));
  let extent = tileRange(box, lod);
  while (tileCount(extent) > maxTiles && lod < MAX_LOD) {
    lod++;
    extent = tileRange(box, lod);
  }
  if (tileCount(extent) > maxTiles) {
    throw new Error(`Atlas tile plan exceeds maxTiles (${maxTiles}) at maximum LOD ${MAX_LOD}`);
  }
  const detail = enumerate(extent, lod);
  assertCanonicalTiles(detail);
  const centerX = box.x + box.width / 2,
    centerY = box.y + box.height / 2;
  detail.sort(
    (a, b) =>
      distanceToCenter(a, lod, centerX, centerY) - distanceToCenter(b, lod, centerX, centerY) ||
      a.y - b.y ||
      a.x - b.x,
  );

  const overviewLod = lod + 2;
  const overview = overviewLod > MAX_LOD ? [] : uniqueParents(detail, lod, overviewLod);
  assertCanonicalTiles(overview);
  overview.sort(
    (a, b) =>
      distanceToCenter(a, overviewLod, centerX, centerY) -
        distanceToCenter(b, overviewLod, centerX, centerY) ||
      a.y - b.y ||
      a.x - b.x,
  );
  return { detail, overview };
}

function assertCanonicalTiles(tiles: readonly AtlasWorldTile[]): void {
  for (const tile of tiles) {
    const size = ATLAS_WORLD_TILE_METERS * 2 ** tile.lod;
    const minX = tile.x * size,
      minY = tile.y * size;
    const maxX = minX + size,
      maxY = minY + size;
    if (
      Math.abs(minX) > MAX_CANONICAL_BOUND ||
      Math.abs(minY) > MAX_CANONICAL_BOUND ||
      Math.abs(maxX) > MAX_CANONICAL_BOUND ||
      Math.abs(maxY) > MAX_CANONICAL_BOUND
    ) {
      throw new Error('Atlas tile plan includes a tile outside the canonical world range');
    }
  }
}

interface TileRange {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function tileRange(box: AtlasTilePlanBox, lod: number): TileRange {
  const size = ATLAS_WORLD_TILE_METERS * 2 ** lod;
  return {
    minX: Math.floor(box.x / size),
    maxX: halfOpenEnd(box.x + box.width, size),
    minY: Math.floor(box.y / size),
    maxY: halfOpenEnd(box.y + box.height, size),
  };
}

function halfOpenEnd(maximum: number, size: number): number {
  const address = maximum / size;
  return Number.isInteger(address) ? address - 1 : Math.floor(address);
}

function tileCount(range: TileRange): number {
  return (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
}

function enumerate(range: TileRange, lod: number): AtlasWorldTile[] {
  const tiles: AtlasWorldTile[] = [];
  for (let y = range.minY; y <= range.maxY; y++) {
    for (let x = range.minX; x <= range.maxX; x++) tiles.push({ lod, x, y });
  }
  return tiles;
}

function uniqueParents(
  tiles: readonly AtlasWorldTile[],
  childLod: number,
  parentLod: number,
): AtlasWorldTile[] {
  const divisor = 2 ** (parentLod - childLod);
  const parents = new Map<string, AtlasWorldTile>();
  for (const tile of tiles) {
    const parent = {
      lod: parentLod,
      x: Math.floor(tile.x / divisor),
      y: Math.floor(tile.y / divisor),
    };
    parents.set(`${parent.x},${parent.y}`, parent);
  }
  return [...parents.values()];
}

function distanceToCenter(
  tile: AtlasWorldTile,
  lod: number,
  centerX: number,
  centerY: number,
): number {
  const size = ATLAS_WORLD_TILE_METERS * 2 ** lod;
  return Math.hypot((tile.x + 0.5) * size - centerX, (tile.y + 0.5) * size - centerY);
}

/** Cover the distant ground with coarse roots and spend the remaining tile budget
 * near the camera focus. Leaves partition each root, so refinement has no holes. */
function focusedPlan(
  box: AtlasTilePlanBox,
  mpp: number,
  maxTiles: number,
  focus: AtlasTilePlanBox,
): AtlasTilePlan {
  if (
    ![focus.x, focus.y, focus.width, focus.height].every(Number.isFinite) ||
    focus.width <= 0 ||
    focus.height <= 0
  )
    throw Error('Atlas tile focus must be a finite positive box');
  const overview = atlasTilePlan(box, mpp, { maxTiles: Math.min(8, maxTiles) }).detail;
  const detail = [...overview],
    cx = focus.x + focus.width / 2,
    cy = focus.y + focus.height / 2;
  const span = Math.max(focus.width, focus.height);
  const priority = (tile: AtlasWorldTile) => {
    const size = ATLAS_WORLD_TILE_METERS * 2 ** tile.lod;
    const dx = Math.max(tile.x * size - cx, cx - (tile.x + 1) * size, 0);
    const dy = Math.max(tile.y * size - cy, cy - (tile.y + 1) * size, 0);
    return size / (mpp * 256 * Math.max(1, Math.hypot(dx, dy) / span));
  };
  while (detail.length + 3 <= maxTiles) {
    let index = -1,
      score = 1;
    detail.forEach((tile, i) => {
      const value = priority(tile);
      if (tile.lod > MIN_LOD && value > score) {
        score = value;
        index = i;
      }
    });
    if (index < 0) break;
    const tile = detail[index]!;
    detail.splice(
      index,
      1,
      ...[0, 1, 2, 3].map((i) => ({
        lod: tile.lod - 1,
        x: tile.x * 2 + (i % 2),
        y: tile.y * 2 + Math.floor(i / 2),
      })),
    );
  }
  detail.sort((a, b) => distanceToCenter(a, a.lod, cx, cy) - distanceToCenter(b, b.lod, cx, cy));
  return { detail, overview };
}
