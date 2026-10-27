import type { Polygon } from '../shared/contracts';
import { type LandscapeRecord } from './atlas-landscape';
import { intersectPolygons, mergePolygons } from './landscape-brush';
import { bounds } from './landscape-geometry';
import { terrainGrid, terrainVisibility, type TerrainGrid } from './terrain-spatial-model';
/** Bake the visible footprint once; later camera/height changes cannot move authored pigment. */
export function visibleTerrainColor(
  record: LandscapeRecord,
  records: LandscapeRecord[],
  canonicalVisibility?: TerrainGrid,
) {
  const view = record.paint?.visibility;
  if (!view) return record;
  const result = structuredClone(record),
    grid = canonicalVisibility ?? terrainGrid(records, view),
    b = bounds(record),
    step = Math.max(record.paint!.radius / 16, Math.max(b.width, b.height) / 192),
    mask: Polygon[] = [];
  const isVisible = terrainVisibility(grid);
  const x0 = Math.floor(b.x / step),
    x1 = Math.ceil((b.x + b.width) / step),
    y0 = Math.floor(b.y / step),
    y1 = Math.ceil((b.y + b.height) / step);
  for (let y = y0; y < y1; y++) {
    let start: number | null = null;
    for (let x = x0; x <= x1; x++) {
      let visible = x < x1;
      if (visible)
        for (const [u, v] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
          [0.5, 0.5],
          [0.5, 0],
          [0, 0.5],
          [1, 0.5],
          [0.5, 1],
        ])
          if (!isVisible({ x: (x + u!) * step, y: (y + v!) * step })) {
            visible = false;
            break;
          }
      if (visible && start === null) start = x;
      if (!visible && start !== null) {
        mask.push({
          outer: [
            { x: start * step, y: y * step },
            { x: x * step, y: y * step },
            { x: x * step, y: (y + 1) * step },
            { x: start * step, y: (y + 1) * step },
          ],
          holes: [],
        });
        start = null;
      }
    }
  }
  result.polygons = intersectPolygons(result.polygons, mergePolygons(mask));
  delete result.paint!.visibility;
  return result;
}
