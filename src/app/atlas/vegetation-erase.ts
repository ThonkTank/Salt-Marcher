import type { Polygon } from '../shared/contracts';
import { contains, type LandscapeRecord } from './atlas-landscape';
import { clipLandscapePolygons } from './landscape-polygon-clipping';

/** Remove authored cover, rather than storing a mask that suppresses future trees. */
export function eraseVegetation(record: LandscapeRecord, brush: Polygon[]): LandscapeRecord | null {
  // Bounding-box hits may lie entirely in an existing hole. Avoid rewriting them.
  if (!clipLandscapePolygons('intersection', record.polygons, brush).length) return record;
  const remaining = clipLandscapePolygons('difference', record.polygons, brush);
  if (!remaining.length) return null;
  return {
    ...record,
    polygons: remaining,
    vegetation: {
      ...record.vegetation!,
      overrides: record.vegetation!.overrides.filter((o) => !contains(o, brush)),
    },
  };
}
