import { contains, type LandscapeRecord } from "./atlas-landscape";
import { maskLandSpans } from "./land-mask";
import {
  intersectPolygons,
  subtractPolygons,
  unionPolygons,
} from "./landscape-brush";
import type { Polygon } from "./contracts";

/** Snapshot of the surface at authorship; later coast changes cannot reveal paint laid over sea. */
export function landSurface(records: LandscapeRecord[]): Polygon[] {
  let land: Polygon[] = [];
  const masks = records
    .filter((r) => r.mask)
    .sort((a, b) => b.resolution - a.resolution);
  if (masks.length) {
    for (const r of masks)
      land = unionPolygons(
        subtractPolygons(land, r.polygons),
        maskLandSpans(r.mask!),
      );
  } else {
    for (const r of records
      .filter((r) => r.kind === "patch" && !r.propertyOnly && r.values.terrain)
      .sort(
        (a, b) =>
          b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0),
      ))
      land =
        r.values.terrain === "water"
          ? subtractPolygons(land, r.polygons)
          : unionPolygons(land, r.polygons);
  }
  for (const r of records.filter((r) => r.surface === "freshwater"))
    land = subtractPolygons(land, r.polygons);
  return unionPolygons(land, land);
}

export function colorSurface(
  record: LandscapeRecord,
  records: LandscapeRecord[],
): LandscapeRecord {
  const r = structuredClone(record),
    p = r.paint!;
  const land = landSurface(records);
  if (p.fill) {
    if (p.target === "water" && p.fillScope === "all")
      throw Error("Wasserfüllung benötigt einen geschlossenen See.");
    const candidates =
      p.target === "ground"
        ? land
        : land.flatMap((poly) =>
            poly.holes.map((outer) => ({ outer, holes: [] })),
          );
    r.polygons =
      p.fillScope === "all"
        ? candidates
        : candidates.filter((poly) => contains(r.points[0]!, [poly]));
  } else
    r.polygons =
      p.target === "ground"
        ? intersectPolygons(r.polygons, land)
        : subtractPolygons(r.polygons, land);
  return r;
}
