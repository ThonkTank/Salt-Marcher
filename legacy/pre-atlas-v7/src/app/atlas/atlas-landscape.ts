import { type LandscapeBox } from './landscape-bounds';
import { type LandscapeRecord } from './landscape-contracts';
import type { AtlasCell, Terrain } from '../runtime/world-cell-contracts';
import type { Point, Polygon } from '../shared/contracts';
import { atlasHexAt, atlasHexPoint } from './atlas-coordinates';
import { MASK_SEA_LEVEL, maskAt } from './land-mask';
import { contains } from './landscape-geometry';
import { lineContains } from './landscape-line';
import { TerrainSampler } from './terrain-height';
export const HEX_METERS = 4828.032;
const EARTH_WIDTH = 40000000,
  EARTH_HEIGHT = 20000000;
export const hexSize = (level: number) => HEX_METERS * 3 ** level;
export const LANDSCAPE_PLACE_FONT_PX = 13;
/** Conservative paint reach; canonical geometry and exact hits keep their own bounds. */
export function landscapePaintBox(
  box: LandscapeBox,
  mpp: number,
  labelUnits?: number,
): LandscapeBox {
  const dx =
      mpp *
      (labelUnits === undefined ? 1 : Math.max(6, LANDSCAPE_PLACE_FONT_PX * (labelUnits + 1))),
    dy = mpp * (labelUnits === undefined ? 1 : 26);
  const result = {
    x: box.x - dx,
    y: box.y - dy,
    width: box.width + 2 * dx,
    height: box.height + 2 * dy,
  };
  if (
    ![
      result.x,
      result.y,
      result.width,
      result.height,
      result.x + result.width,
      result.y + result.height,
    ].every(Number.isFinite)
  )
    throw Error('Landschaftsausschnitt nicht präzise darstellbar.');
  return result;
}
export function hexPolygon(q: number, r: number, size: number): Polygon {
  return {
    outer: Array.from({ length: 6 }, (_, i) => {
      const a = ((30 + i * 60) * Math.PI) / 180;
      return {
        x: (q + r / 2) * size + (Math.cos(a) * size) / Math.sqrt(3),
        y: ((r * Math.sqrt(3)) / 2) * size + (Math.sin(a) * size) / Math.sqrt(3),
      };
    }),
    holes: [],
  };
}
/** Separate gestures share one bounded draft without painting between them. */
export function hexStrokesPolygons(strokes: Point[][], size: number): Polygon[] {
  if (
    !Number.isFinite(size) ||
    size <= 0 ||
    strokes.some((points) => points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
  )
    throw new Error('Hexmaßstab und Strichpunkte prüfen.');
  const cells = new Map<string, Polygon>();
  for (const points of strokes)
    for (let i = 0; i < points.length; i++) {
      const from = atlasHexAt(points[Math.max(0, i - 1)]!, size),
        to = atlasHexAt(points[i]!, size),
        count =
          (Math.abs(to.q - from.q) +
            Math.abs(to.r - from.r) +
            Math.abs(to.q + to.r - from.q - from.r)) /
          2;
      if (!Number.isSafeInteger(count) || count > 5000)
        throw new Error('Hexstrich zu groß. In Abschnitten von höchstens 5.000 Hexes malen.');
      const a = atlasHexPoint(from.q, from.r, size),
        b = atlasHexPoint(to.q, to.r, size);
      for (let step = 0; step <= count; step++) {
        const t = count ? step / count : 0,
          h = atlasHexAt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, size),
          key = h.q + ',' + h.r;
        if (cells.has(key)) continue;
        if (cells.size === 5000)
          throw new Error('Hexstrich zu groß. In Abschnitten von höchstens 5.000 Hexes malen.');
        cells.set(key, hexPolygon(h.q, h.r, size));
      }
    }
  return [...cells.values()];
}
export function effectiveLandscape(
  records: LandscapeRecord[],
  p: Point,
  base: Partial<AtlasCell> = {},
) {
  const out: Partial<AtlasCell> = { terrain: 'water', ...base };
  for (const record of records
    .filter((r) => r.kind === 'patch')
    .sort((a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0)))
    if (!record.mask && record.surface !== 'freshwater' && contains(p, record.polygons)) {
      if (record.propertyOnly) {
        const { terrain, ...values } = record.values;
        Object.assign(out, values);
      } else Object.assign(out, record.values);
    }
  const authoredTerrain = out.terrain;
  let occupancy: number | undefined;
  for (const r of records.filter((r) => r.mask).sort((a, b) => b.resolution - a.resolution)) {
    const value = maskAt(r.mask!, p);
    if (value !== undefined) occupancy = value;
  }
  if (occupancy !== undefined)
    out.terrain =
      occupancy >= MASK_SEA_LEVEL
        ? out.terrain && out.terrain !== 'water'
          ? out.terrain
          : 'plains'
        : 'water';
  else if (records.some((r) => r.maskManaged)) out.terrain = 'water';
  const heightField = records.some((r) => r.height || r.terrainSettings);
  if (heightField) {
    const sample = new TerrainSampler(records),
      height = sample.sample(p);
    out.elevationM = height.heightM;
    out.terrain = sample.water(p, height.heightM)
      ? 'water'
      : authoredTerrain && authoredTerrain !== 'water'
        ? authoredTerrain
        : 'plains';
  }
  if (out.terrain !== 'water')
    for (const r of records
      .filter((r) => r.propertyOnly || r.kind === 'vegetation')
      .sort((a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0)))
      if (
        r.values.terrain &&
        (!heightField || r.values.terrain !== 'water') &&
        contains(p, r.polygons)
      )
        out.terrain = r.values.terrain;
  // Freshwater remains an independently erasable surface.
  for (const r of records)
    if (!heightField && r.surface === 'freshwater' && contains(p, r.polygons))
      out.terrain = 'water';
  // Rivers are water surfaces. Roads never turn water into a crossing.
  for (const r of records)
    if (r.kind === 'river' && lineContains(r, p)) {
      out.terrain = 'water';
      out.river = true;
    }
  for (const r of records)
    if (r.kind === 'road' && out.terrain !== 'water' && lineContains(r, p)) out.road = true;
  return out;
}
export function earthView(aspect: number, center: Point = { x: 0, y: 0 }): LandscapeBox {
  const width = Math.max(EARTH_WIDTH, EARTH_HEIGHT * aspect),
    height = width / aspect;
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}
export function distance(points: Point[]) {
  return points.reduce(
    (n, p, i) => n + (i ? Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y) : 0),
    0,
  );
}
export const formatDistance = (meters: number) => {
  const n = (value: number) => value.toLocaleString('de-DE', { maximumSignificantDigits: 3 });
  return `${meters < 1000 ? n(meters) + ' m' : n(meters / 1000) + ' km'} · ${n(meters / 1609.344)} Meilen`;
};
export const emptyRecord = (kind: LandscapeRecord['kind']): LandscapeRecord => ({
  id: crypto.randomUUID(),
  revision: 0,
  kind,
  name: '',
  points: [],
  polygons: [],
  resolution: HEX_METERS,
  width: kind === 'river' ? 30 : kind === 'road' ? 5 : 0,
  values: {},
});
export const terrainValue = (v: unknown): v is Terrain =>
  typeof v === 'string' &&
  ['plains', 'forest', 'hills', 'mountains', 'water', 'marsh', 'desert', 'snow'].includes(v);
