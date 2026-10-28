import type { AtlasCell, Terrain } from '../runtime/world-contracts';
import type { Point, Polygon } from '../shared/contracts';
import { atlasHexAt, atlasHexPoint } from './campaign-atlas-model';
import { MASK_SEA_LEVEL, maskAt } from './land-mask';
import { contains } from './landscape-geometry';
import { lineContains } from './landscape-line';
import { TerrainSampler } from './terrain-height';
export const HEX_METERS = 4828.032;
const EARTH_WIDTH = 40000000,
  EARTH_HEIGHT = 20000000;
export const hexSize = (level: number) => HEX_METERS * 3 ** level;
export interface LandscapeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
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
export type LandscapeField =
  | 'terrain'
  | 'elevationM'
  | 'climate'
  | 'road'
  | 'river'
  | 'label'
  | 'faction'
  | 'interrupt'
  | 'access';
/** Parameters and level are frozen at pointerdown; samples are snapshotted at release. */
export interface LakeStroke {
  mode: 'dig' | 'erase';
  id: string;
  radius: number;
  strength: number;
  feather: number;
  waterLevelM: number;
  samples: import('./land-mask').MaskSample[];
  visibility?: import('./terrain-brush').HeightStroke['visibility'];
}
/** Source attribution only; canonical heights remain ordinary height records. */
export interface LakeBed {
  tileId: string;
  tile: import('./terrain-height').HeightTile;
}
export interface LandscapeRecord {
  /** Display importance; absent means automatic. Physical dimensions are unchanged. */
  prominence?: number;
  label?: import('./map-label-style').MapLabelStyle;
  id: string;
  revision: number;
  kind: 'patch' | 'river' | 'road' | 'reference' | 'place' | 'vegetation';
  name: string;
  points: Point[];
  polygons: Polygon[];
  resolution: number;
  width: number;
  values: Partial<Omit<AtlasCell, 'q' | 'r' | 'level'>>;
  order?: number;
  style?: 'path' | 'road' | 'stream' | 'river';
  route?: import('./terrain-route').TerrainRoute;
  line?: import('./landscape-line').LandscapeLine;
  paint?: import('./landscape-brush').LandscapeColor;
  mask?: import('./land-mask').LandMask;
  maskManaged?: boolean;
  height?: import('./terrain-height').HeightTile;
  terrainSettings?: import('./terrain-height').TerrainSettings;
  waterLevelM?: number;
  lakeBed?: LakeBed[];
  propertyOnly?: boolean;
  sourceCell?: { mapId: string; q: number; r: number; level: number };
  surface?: 'land' | 'sea' | 'freshwater';
  vegetation?: import('./vegetation').VegetationSpec;
  vegetationView?: import('./vegetation-projection').VegetationProjection;
  locationId?: string;
  assetId?: string;
  imageWidth?: number;
  imageHeight?: number;
  angle?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}
export type LandscapeAction =
  | {
      kind: 'landscape-prominence';
      id: string;
      expectedRevision: number;
      prominence: number | null;
    }
  | {
      kind: 'landscape-route';
      record: LandscapeRecord;
      expectedRevision: number | null;
      sourceRevision: number;
    }
  | {
      kind: 'landscape-vegetation-edit';
      polygons: Polygon[];
      mode: 'clear' | 'thin' | 'dense' | 'erase';
    }
  | { kind: 'landscape-terrain-style'; style: import('./terrain-relief').TerrainStyle }
  | { kind: 'landscape-sea-level'; seaLevelM: number }
  | { kind: 'landscape-lake-stroke'; stroke: LakeStroke }
  | { kind: 'landscape-height-stroke'; stroke: import('./terrain-brush').HeightStroke }
  | { kind: 'landscape-land-stroke'; stroke: import('./land-mask').MaskStroke }
  | { kind: 'landscape-color-stroke'; record: LandscapeRecord }
  | {
      kind: 'landscape-brush';
      record: LandscapeRecord;
      mode: Exclude<import('./landscape-brush').BrushMode, 'terrain'>;
      radius: number;
      roughness: number;
      seed: number;
      fill: boolean;
      samples?: import('./land-mask').MaskSample[];
    }
  | {
      kind: 'landscape-batch';
      remove?: { id: string; expectedRevision: number }[];
      records: {
        record: LandscapeRecord;
        expectedRevision: number | null;
      }[];
    }
  | {
      kind: 'landscape-put';
      record: LandscapeRecord;
      expectedRevision: number | null;
    }
  | {
      kind: 'landscape-remove';
      id: string;
      expectedRevision: number;
    }
  | {
      kind: 'landscape-reset';
      propertyOnly?: boolean;
      polygons: Polygon[];
      field: LandscapeField;
      resolution: number;
    }
  | {
      kind: 'landscape-place';
      point?: Point;
      record: LandscapeRecord;
      document: import('../../features/location/location-schema').LocationDocument;
      expectedLocationRevision: number | null;
      expectedRevision: number | null;
    };
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
