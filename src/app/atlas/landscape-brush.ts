import { validateTerrainView, type TerrainView } from './terrain-spatial-model';
import polygonClipping from 'polygon-clipping';
import type { Point, Polygon } from '../shared/contracts';
import type { LandscapeRecord } from './atlas-landscape';
import { clipLandscapePolygons, roundBrushPolygons } from './landscape-polygon-clipping';
export type BrushMode =
  | 'terrain'
  | 'land'
  | 'land-erase'
  | 'raise'
  | 'lower'
  | 'freshwater'
  | 'freshwater-erase'
  | 'ground-color'
  | 'water-color'
  | 'color-erase';
export interface LandscapeColor {
  version: 1 | 2;
  operation?: 'paint' | 'erase';
  fillScope?: 'connected' | 'all';
  target: 'ground' | 'water';
  color: string;
  opacity: number;
  flow: number;
  tip: 'round' | 'soft' | 'textured';
  radius: number;
  seed: number;
  fill: boolean;
  strokes?: Point[][];
  visibility?: TerrainView;
}
export const clipPolygons = (ps: Polygon[]) =>
  ps.map((p) => [p.outer, ...p.holes].map((r) => r.map((p) => [p.x, p.y] as [number, number])));
export const unclipPolygons = (ps: ReturnType<typeof polygonClipping.union>): Polygon[] =>
  ps.map((p) => ({
    outer: p[0]!.map(([x, y]) => ({ x, y })),
    holes: p.slice(1).map((r) => r.map(([x, y]) => ({ x, y }))),
  }));
/** Dissolve shared edges before intersecting generated adjacent coverage spans. */
export const mergePolygons = (polygons: Polygon[]) =>
  polygons.length ? unclipPolygons(polygonClipping.union(clipPolygons(polygons))) : [];
export const intersectPolygons = (a: Polygon[], b: Polygon[]) =>
  a.length && b.length
    ? unclipPolygons(polygonClipping.intersection(clipPolygons(a), clipPolygons(b)))
    : [];
export const subtractPolygons = (a: Polygon[], b: Polygon[]) =>
  a.length && b.length
    ? unclipPolygons(polygonClipping.difference(clipPolygons(a), clipPolygons(b)))
    : a;
export const unionPolygons = (a: Polygon[], b: Polygon[]) =>
  !a.length
    ? b
    : !b.length
      ? a
      : unclipPolygons(polygonClipping.union(clipPolygons(a), clipPolygons(b)));
function brushRing(
  point: Point,
  radius: number,
  roughness: number,
  seed: number,
  index = 0,
): Point[] {
  return Array.from({ length: 24 }, (_, j) => {
    const a = (j * Math.PI) / 12,
      r =
        radius *
        (1 + roughness * 0.13 * (Math.sin(j * 3 + index * 0.7 + seed) + Math.cos(j * 5 - seed)));
    return { x: point.x + Math.cos(a) * r, y: point.y + Math.sin(a) * r };
  });
}
/** Capsules avoid holes even with sparse/coalesced pointer samples. */
export function brushFootprint(
  points: Point[],
  radius: number,
  roughness = 0,
  seed = 1,
): Polygon[] {
  if (!points.length) return [];
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(roughness) ||
    roughness < 0 ||
    roughness > 2 ||
    points.length > 2000 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw Error('Pinselgröße und Strichpunkte prüfen.');
  if (!roughness) return roundBrushPolygons(points, radius);
  // Construct and clip near the stroke, before adding its world offset. Tiny
  // capsule intersections otherwise lose precision thousands of kilometres away.
  const origin = points[0]!;
  points = points.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
  const rings: Polygon[] = points.map((p, i) => ({
    outer: brushRing(p, radius, roughness, seed, i),
    holes: [],
  }));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!len) continue;
    const x = (-(b.y - a.y) / len) * radius,
      y = ((b.x - a.x) / len) * radius;
    rings.push({
      outer: [
        { x: a.x + x, y: a.y + y },
        { x: b.x + x, y: b.y + y },
        { x: b.x - x, y: b.y - y },
        { x: a.x - x, y: a.y - y },
      ],
      holes: [],
    });
  }
  // Dissolve small batches, then merge similarly sized results. A single union
  // of thousands of overlapping circles spends most of its time on hidden edges.
  let groups: Polygon[][] = [];
  for (let i = 0; i < rings.length; i += 64)
    groups.push(clipLandscapePolygons('union', rings.slice(i, i + 64)));
  while (groups.length > 1) {
    const next: Polygon[][] = [];
    for (let i = 0; i < groups.length; i += 2)
      next.push(
        i + 1 < groups.length
          ? clipLandscapePolygons('union', [...groups[i]!, ...groups[i + 1]!])
          : groups[i]!,
      );
    groups = next;
  }
  const out = groups[0]!;
  const translate = (ring: Point[]) => ring.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }));
  return out.map((p) => ({ outer: translate(p.outer), holes: p.holes.map(translate) }));
}
export function validateColor(r: LandscapeRecord) {
  if (
    r.propertyOnly !== undefined &&
    (r.propertyOnly !== true ||
      r.kind !== 'patch' ||
      r.paint ||
      r.mask ||
      r.surface ||
      r.maskManaged)
  )
    throw Error('Eigenschaftsfläche prüfen.');
  if (r.surface && !['land', 'sea', 'freshwater'].includes(r.surface))
    throw Error('Wasser-/Landfläche prüfen.');
  const p = r.paint;
  if (!p) return;
  if (p.visibility) {
    validateTerrainView(p.visibility);
    if (p.fill) throw Error('In der räumlichen Ansicht mit Pinselzügen malen.');
  }
  if (
    p.version === 2 &&
    (!['paint', 'erase'].includes(p.operation ?? '') ||
      !['connected', 'all'].includes(p.fillScope ?? 'connected'))
  )
    throw Error('Farboperation prüfen.');
  if (
    p.strokes &&
    (!Array.isArray(p.strokes) ||
      p.strokes.flat().length > 2000 ||
      p.strokes.some(
        (s) => !Array.isArray(s) || s.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y)),
      ))
  )
    throw Error('Farbstriche prüfen.');
  if (
    r.kind !== 'patch' ||
    ![1, 2].includes(p.version) ||
    !['ground', 'water'].includes(p.target) ||
    !/^#[\da-f]{6}$/i.test(p.color) ||
    !['round', 'soft', 'textured'].includes(p.tip) ||
    ![p.opacity, p.flow].every((v) => Number.isFinite(v) && v >= 0.1 && v <= 1) ||
    !Number.isFinite(p.radius) ||
    p.radius <= 0 ||
    !Number.isSafeInteger(p.seed) ||
    p.seed < 0 ||
    p.seed > 0xffffffff ||
    typeof p.fill !== 'boolean' ||
    Object.keys(r.values).length ||
    (!p.fill && !r.points.length)
  )
    throw Error('Farbpinsel prüfen.');
  if (!p.fill) {
    let count = 0;
    for (const stroke of p.strokes ?? [r.points]) {
      if (stroke.length) count++;
      for (let i = 1; i < stroke.length; i++)
        count += Math.max(
          1,
          Math.ceil(
            Math.hypot(stroke[i]!.x - stroke[i - 1]!.x, stroke[i]!.y - stroke[i - 1]!.y) /
              (p.radius * 0.5),
          ),
        );
    }
    if (count > 4000) throw Error('Farbzug zu lang. In kürzeren Abschnitten malen.');
  }
}
/** Preserve the legacy coarse/fine painter stack below newly authored pigment. */
export function orderedColors(records: LandscapeRecord[]) {
  return records
    .filter((r) => r.paint)
    .sort((a, b) => {
      const legacyA = a.paint!.version === 1,
        legacyB = b.paint!.version === 1;
      if (legacyA !== legacyB) return legacyA ? -1 : 1;
      return (
        (legacyA ? b.resolution - a.resolution : 0) || (a.order ?? Infinity) - (b.order ?? Infinity)
      );
    });
}
export interface ColorPart {
  polygons: Polygon[];
  color: string;
  opacity: number;
}
/** Numeric feather bands are identical in the Canvas and overview raster. */
export function colorParts(r: LandscapeRecord): ColorPart[] {
  const p = r.paint;
  if (!p) return [];
  if (p.fill) return [{ polygons: r.polygons, color: p.color, opacity: 1 }];
  const out: ColorPart[] = [],
    stamps: Point[] = [];
  for (const stroke of p.strokes ?? [r.points]) {
    if (!stroke.length) continue;
    stamps.push(stroke[0]!);
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1]!,
        b = stroke[i]!,
        steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (p.radius * 0.5)));
      if (stamps.length + steps > 4000)
        throw Error('Farbzug zu lang. In kürzeren Abschnitten malen.');
      for (let j = 1; j <= steps; j++)
        stamps.push({ x: a.x + ((b.x - a.x) * j) / steps, y: a.y + ((b.y - a.y) * j) / steps });
    }
  }
  for (let n = 0; n < stamps.length; n++) {
    let previous = 0;
    const bands = p.tip === 'round' ? 1 : 6;
    for (let i = 0; i < bands; i++) {
      const next = p.flow * ((i + 1) / bands),
        opacity = (next - previous) / (1 - previous || 1);
      previous = next;
      // Version-1 pigment is reconstructed from its original 24-point stamps.
      // New author brush geometry must not repaint already saved colour strokes.
      const stamp: Polygon = {
        outer: brushRing(
          stamps[n]!,
          p.radius * (1 - i * 0.13),
          p.tip === 'textured' ? 1.5 : 0,
          p.seed + n + i,
        ),
        holes: [],
      };
      out.push({
        color: p.color,
        opacity,
        polygons: clipLandscapePolygons('intersection', r.polygons, [stamp]),
      });
    }
  }
  return out;
}
