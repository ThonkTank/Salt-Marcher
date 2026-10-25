import { visibleTerrainColor } from './terrain-color-visibility';
import { terrainLandSpans, terrainSettings, DEFAULT_HEIGHT_M } from './terrain-height';
import { contains, type LandscapeRecord } from './atlas-landscape';
import { maskLandSpans } from './land-mask';
import { intersectPolygons, subtractPolygons, unionPolygons } from './landscape-brush';
import type { Polygon } from './contracts';

/** Snapshot of the surface at authorship; later coast changes cannot reveal paint laid over sea. */
export function landSurface(records: LandscapeRecord[]): Polygon[] {
  if (records.some((r) => r.height)) {
    let land: Polygon[] = [];
    for (const r of records.filter((r) => r.height).sort((a, b) => b.resolution - a.resolution))
      land = unionPolygons(subtractPolygons(land, r.polygons), terrainLandSpans(records, [r]));
    return land;
  }
  let land: Polygon[] = [];
  const masks = records.filter((r) => r.mask).sort((a, b) => b.resolution - a.resolution);
  if (masks.length) {
    for (const r of masks)
      land = unionPolygons(subtractPolygons(land, r.polygons), maskLandSpans(r.mask!));
  } else {
    for (const r of records
      .filter((r) => r.kind === 'patch' && !r.propertyOnly && r.values.terrain)
      .sort((a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0)))
      land =
        r.values.terrain === 'water'
          ? subtractPolygons(land, r.polygons)
          : unionPolygons(land, r.polygons);
  }
  for (const r of records.filter((r) => r.surface === 'freshwater'))
    land = subtractPolygons(land, r.polygons);
  return unionPolygons(land, land);
}

export function colorSurface(
  record: LandscapeRecord,
  records: LandscapeRecord[],
  canonicalVisibility?: import('./terrain-spatial-model').TerrainGrid,
): LandscapeRecord {
  const r = visibleTerrainColor(structuredClone(record), records, canonicalVisibility),
    p = r.paint!;
  let land = landSurface(records);
  if (DEFAULT_HEIGHT_M > terrainSettings(records).seaLevelM) {
    if (p.fill && p.target === 'ground')
      throw Error('Unbegrenzten Untergrund mit dem Farbpinsel bearbeiten.');
    // Newly exposed background has no authored tiles. Restrict its colour snapshot to the actual stroke.
    const authored = records
      .filter(
        (r) =>
          r.height ||
          (r.surface === 'freshwater' &&
            (r.waterLevelM ?? terrainSettings(records).seaLevelM + 1) >= DEFAULT_HEIGHT_M),
      )
      .flatMap((r) => r.polygons);
    land = unionPolygons(land, subtractPolygons(r.polygons, unionPolygons(authored, [])));
  }
  if (p.fill) {
    if (p.target === 'water' && p.fillScope === 'all')
      throw Error('Wasserfüllung benötigt einen geschlossenen See.');
    const candidates =
      p.target === 'ground'
        ? land
        : land.flatMap((poly) => poly.holes.map((outer) => ({ outer, holes: [] })));
    r.polygons =
      p.fillScope === 'all'
        ? candidates
        : candidates.filter((poly) => contains(r.points[0]!, [poly]));
  } else
    r.polygons =
      p.target === 'ground'
        ? intersectPolygons(r.polygons, land)
        : subtractPolygons(r.polygons, land);
  return r;
}
