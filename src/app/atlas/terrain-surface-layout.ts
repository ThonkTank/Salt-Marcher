import { atlasTilePlan } from './atlas-tile-plan';
import { atlasWorldTileBounds, type AtlasWorldTile } from './atlas-world-tiles';
import { terrainCoverageBox, terrainCoverageLevel } from './terrain-coverage';
import type { AtlasCameraPose } from './atlas-camera';

/** The surrounding read/stroke command binds revision and source fence. */
export interface TerrainSurfaceLayout {
  /** Display sampling is independent of the finer author-node resolution. */
  metersPerPixel: number;
  tiles: AtlasWorldTile[];
}
export const TERRAIN_FLAT_TILE_BUDGET = 32;
export const TERRAIN_TILTED_TILE_BUDGET = 192;
const key = (t: AtlasWorldTile) => `${t.lod}/${t.x}/${t.y}`;

/** A complete, disjoint canonical quadtree partition of the camera's roots.
 * Coarse parents are allowed while their whole children group is loading;
 * caller-supplied holes, overlapping parents and unrelated tiles are not. */
export function validateTerrainSurfaceLayout(view: AtlasCameraPose, surface: TerrainSurfaceLayout) {
  if (
    view.projection !== 'perspective' ||
    !surface ||
    Object.keys(surface).some((k) => !['tiles', 'metersPerPixel'].includes(k)) ||
    !Number.isFinite(surface.metersPerPixel) ||
    surface.metersPerPixel <= 0 ||
    !Array.isArray(surface.tiles) ||
    surface.tiles.length < 1 ||
    surface.tiles.length > (view.tilt ? TERRAIN_TILTED_TILE_BUDGET : TERRAIN_FLAT_TILE_BUDGET)
  )
    throw Error('Geländeoberfläche noch nicht vollständig geladen.');
  const coverage = view.tilt
    ? terrainCoverageBox(view.frame, terrainCoverageLevel(view.tilt))
    : view.frame;
  const roots = atlasTilePlan(coverage, surface.metersPerPixel, {
    maxTiles: view.tilt ? 8 : TERRAIN_FLAT_TILE_BUDGET,
  }).detail;
  const tiles = new Set<string>();
  for (const tile of surface.tiles) {
    if (
      !tile ||
      Object.keys(tile).some((k) => !['lod', 'x', 'y'].includes(k)) ||
      !Number.isSafeInteger(tile.lod) ||
      tile.lod < -8 ||
      tile.lod > 32 ||
      !Number.isSafeInteger(tile.x) ||
      !Number.isSafeInteger(tile.y)
    )
      throw Error('Geländekachel prüfen.');
    const b = atlasWorldTileBounds(tile);
    if (Math.max(Math.abs(b.minX), Math.abs(b.minY), Math.abs(b.maxX), Math.abs(b.maxY)) > 1e12)
      throw Error('Geländekachel außerhalb des darstellbaren Bereichs.');
    if (
      tiles.has(key(tile)) ||
      !roots.some((r) => {
        const d = 2 ** (r.lod - tile.lod);
        return (
          tile.lod <= r.lod && Math.floor(tile.x / d) === r.x && Math.floor(tile.y / d) === r.y
        );
      })
    )
      throw Error('Geländekachel gehört nicht zur Kameraabdeckung.');
    tiles.add(key(tile));
  }
  let consumed = 0;
  const complete = (tile: AtlasWorldTile): boolean => {
    if (tiles.has(key(tile))) {
      consumed++;
      return true;
    }
    if (
      tile.lod <= -8 ||
      !surface.tiles.some((t) => {
        const d = 2 ** (tile.lod - t.lod);
        return t.lod < tile.lod && Math.floor(t.x / d) === tile.x && Math.floor(t.y / d) === tile.y;
      })
    )
      return false;
    return [0, 1, 2, 3].every((i) =>
      complete({
        lod: tile.lod - 1,
        x: tile.x * 2 + (i % 2),
        y: tile.y * 2 + Math.floor(i / 2),
      }),
    );
  };
  if (!roots.every(complete) || consumed !== surface.tiles.length)
    throw Error('Geländeoberfläche noch nicht vollständig geladen.');
}
