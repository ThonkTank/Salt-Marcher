/** Stable signed tile grid for an unbounded canonical metre world. */
export const ATLAS_WORLD_TILE_METERS = 256;

export interface AtlasWorldPoint {readonly x: number; readonly y: number}
export interface AtlasWorldTile {readonly lod: number; readonly x: number; readonly y: number}
export interface AtlasWorldBounds {readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; readonly sizeM: number}

function tileSize(lod: number): number {
  if (!Number.isSafeInteger(lod)) throw new Error('Atlas tile LOD must be a safe integer');
  const size = ATLAS_WORLD_TILE_METERS * 2 ** lod;
  if (!Number.isFinite(size) || size <= 0) throw new Error('Atlas tile LOD is outside the finite world range');
  return size;
}

/** Integer addresses are signed and independent of camera focus or render origin. */
export function atlasWorldTileAt(point: AtlasWorldPoint, lod = 0): AtlasWorldTile {
  const sizeM = tileSize(lod);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('Atlas tile point must be finite');
  const x = Math.floor(point.x / sizeM), y = Math.floor(point.y / sizeM);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw new Error('Atlas tile address exceeds safe integer precision');
  return {lod, x, y};
}

/** Canonical half-open tile bounds [min,max), which makes exact boundaries unique. */
export function atlasWorldTileBounds(tile: AtlasWorldTile): AtlasWorldBounds {
  const sizeM = tileSize(tile.lod);
  if (!Number.isSafeInteger(tile.x) || !Number.isSafeInteger(tile.y)) throw new Error('Atlas tile address must use safe integers');
  const minX = tile.x * sizeM, minY = tile.y * sizeM;
  const maxX = minX + sizeM, maxY = minY + sizeM;
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) throw new Error('Atlas tile bounds exceed the finite world range');
  return {minX, minY, maxX, maxY, sizeM};
}

/** Local coordinates remain small after subtracting this tile's double origin. */
export function atlasWorldTileOrigin(tile: AtlasWorldTile): AtlasWorldPoint {
  const bounds = atlasWorldTileBounds(tile);
  return {x: bounds.minX, y: bounds.minY};
}
