import { atlasWorldTileBounds, type AtlasWorldTile } from './atlas-world-tiles';
import type { TerrainProjection, TerrainProjectionRequest } from './terrain-projection';

export const ATLAS_TERRAIN_TILE_PIXELS = 256;
export const ATLAS_TERRAIN_TILE_NODES = 65;
export interface AtlasTerrainTileRequest {
  tile: AtlasWorldTile;
  revision: number;
  contours?: number;
  product?: 'height';
}
export interface AtlasTerrainTile {
  tile: AtlasWorldTile;
  revision: number;
  fence: string;
  cache: 'hit' | 'built' | 'disabled';
  projection: TerrainProjection;
}
/** Display tiles have a fixed lattice; neither camera pose nor window size is a key. */
export function atlasTerrainTileQuery(
  request: AtlasTerrainTileRequest,
  fence?: string,
): TerrainProjectionRequest {
  if (
    !request ||
    Object.keys(request).some((k) => !['tile', 'revision', 'contours', 'product'].includes(k)) ||
    (request.product !== undefined && request.product !== 'height') ||
    !request.tile ||
    Object.keys(request.tile).some((k) => !['lod', 'x', 'y'].includes(k)) ||
    !Number.isSafeInteger(request.revision) ||
    request.revision < 0 ||
    request.tile.lod < -8 ||
    request.tile.lod > 32 ||
    (request.contours !== undefined &&
      (!Number.isFinite(request.contours) ||
        (request.contours < 0 && request.contours !== -1) ||
        request.contours > 100000))
  )
    throw Error('Atlaskachel prüfen.');
  const b = atlasWorldTileBounds(request.tile);
  if (
    Math.max(Math.abs(b.minX), Math.abs(b.minY), Math.abs(b.maxX), Math.abs(b.maxY)) > 1e12 ||
    b.maxX <= b.minX ||
    b.maxY <= b.minY
  )
    throw Error('Atlaskachel außerhalb des darstellbaren Bereichs.');
  const box = { x: b.minX, y: b.minY, width: b.sizeM, height: b.sizeM };
  return {
    view: {
      box,
      frame: box,
      columns: ATLAS_TERRAIN_TILE_NODES,
      rows: ATLAS_TERRAIN_TILE_NODES,
      focusM: 0,
      tilt: 0,
      rotation: 0,
      exaggeration: 1,
    },
    width: ATLAS_TERRAIN_TILE_PIXELS,
    height: ATLAS_TERRAIN_TILE_PIXELS,
    displayMpp: b.sizeM / ATLAS_TERRAIN_TILE_PIXELS,
    contours: request.contours ?? 0,
    revision: request.revision,
    fence,
  };
}
