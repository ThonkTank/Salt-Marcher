import {
  plantAssets,
  type PlantAsset,
  type VegetationPreset,
  type VegetationInstance,
  type VegetationSpec,
  type VegetationView,
} from './vegetation-contracts';
import { vegetationWaterSuitable } from './vegetation-surface';
export { vegetationWaterSuitable, vegetationFurrowShade } from './vegetation-surface';

import type { Point, Polygon } from '../shared/contracts';
import { type LandscapeBox } from './landscape-bounds';
import { type LandscapeRecord } from './landscape-contracts';
import { bounds, contains, segmentDistance } from './landscape-geometry';
import { linePoints } from './landscape-line';
import { vegetationFootprintRadius } from './vegetation-shape';
import { TerrainSampler } from './terrain-height';
import {
  vegetationGrid,
  vegetationRandom,
  vegetationRepresentative,
  vegetationStride,
} from './vegetation-lod';
export { vegetationRandom } from './vegetation-lod';
/** Copied into authored areas. Library updates never silently rewrite a campaign. */
export const vegetationPresets: readonly VegetationPreset[] = [
  {
    id: 'deciduous',
    name: 'Laubwald',
    terrain: 'forest',
    ground: '#89956b',
    tree: 'oak',
    undergrowthAsset: 'shrub',
    distribution: 'natural',
    groundPattern: 'natural',
    waterDepth: { trees: 0, undergrowth: 0, rocks: 0 },
    density: 0.8,
    size: 14,
    undergrowth: 0.45,
    rocks: 0.06,
    grouping: 0.55,
    edge: 16,
    slope: 42,
  },
  {
    id: 'conifer',
    name: 'Nadelwald',
    terrain: 'forest',
    ground: '#768c71',
    tree: 'pine',
    undergrowthAsset: 'shrub',
    distribution: 'natural',
    groundPattern: 'natural',
    waterDepth: { trees: 0, undergrowth: 0, rocks: 0 },
    density: 0.85,
    size: 18,
    undergrowth: 0.3,
    rocks: 0.12,
    grouping: 0.5,
    edge: 12,
    slope: 46,
  },
  {
    id: 'meadow',
    name: 'Wiese',
    terrain: 'plains',
    ground: '#b3bb7c',
    tree: 'oak',
    undergrowthAsset: 'grass',
    distribution: 'natural',
    groundPattern: 'natural',
    waterDepth: { trees: 0, undergrowth: 0, rocks: 0 },
    density: 0,
    size: 12,
    undergrowth: 0.8,
    rocks: 0.02,
    grouping: 0.35,
    edge: 8,
    slope: 45,
  },
  {
    id: 'scrub',
    name: 'Buschland',
    terrain: 'plains',
    ground: '#a2a579',
    tree: 'oak',
    undergrowthAsset: 'shrub',
    distribution: 'natural',
    groundPattern: 'natural',
    waterDepth: { trees: 0, undergrowth: 0, rocks: 0 },
    density: 0.08,
    size: 9,
    undergrowth: 0.85,
    rocks: 0.15,
    grouping: 0.65,
    edge: 10,
    slope: 48,
  },
  {
    id: 'scree',
    name: 'Geröllfeld',
    terrain: 'hills',
    ground: '#aaa18c',
    tree: 'pine',
    undergrowthAsset: 'shrub',
    distribution: 'natural',
    groundPattern: 'natural',
    waterDepth: { trees: 0, undergrowth: 0, rocks: 0 },
    density: 0,
    size: 10,
    undergrowth: 0.08,
    rocks: 0.9,
    grouping: 0.6,
    edge: 6,
    slope: 65,
  },
  {
    id: 'rocky',
    name: 'Felsiger Boden',
    terrain: 'hills',
    ground: '#a49c87',
    tree: 'oak',
    undergrowthAsset: 'shrub',
    distribution: 'natural',
    groundPattern: 'natural',
    waterDepth: { trees: 0, undergrowth: 0, rocks: 0 },
    density: 0.03,
    size: 12,
    undergrowth: 0.2,
    rocks: 0.5,
    grouping: 0.5,
    edge: 8,
    slope: 70,
  },
  {
    id: 'marsh',
    name: 'Sumpf',
    terrain: 'marsh',
    ground: '#737f58',
    tree: 'shrub',
    undergrowthAsset: 'reed',
    distribution: 'natural',
    groundPattern: 'natural',
    waterDepth: { trees: 0, undergrowth: 0.5, rocks: 0 },
    density: 0.3,
    size: 2,
    undergrowth: 0.95,
    rocks: 0.02,
    grouping: 0.1,
    edge: 4,
    slope: 15,
  },
  {
    id: 'desert',
    name: 'Wüste',
    terrain: 'desert',
    ground: '#d5bd87',
    tree: 'oak',
    undergrowthAsset: 'shrub',
    distribution: 'natural',
    groundPattern: 'natural',
    waterDepth: { trees: 0, undergrowth: 0, rocks: 0 },
    density: 0,
    size: 8,
    undergrowth: 0.1,
    rocks: 0.18,
    grouping: 0.2,
    edge: 4,
    slope: 55,
  },
  {
    id: 'farmland',
    name: 'Landwirtschaft',
    terrain: 'plains',
    ground: '#b0a76b',
    tree: 'oak',
    undergrowthAsset: 'crop',
    distribution: 'rows',
    groundPattern: 'furrows',
    waterDepth: { trees: 0, undergrowth: 0, rocks: 0 },
    density: 0,
    size: 8,
    undergrowth: 1,
    rocks: 0,
    grouping: 0,
    edge: 0,
    slope: 25,
  },
];
export interface VegetationScene {
  revision: number;
  fence?: string;
  box: LandscapeBox;
  records: LandscapeRecord[];
  grid: { columns: number; rows: number; heights: number[]; colors: string[] };
  instances: (VegetationInstance & { areaId: string })[];
  buildings: Polygon[];
  texture?: { width: number; height: number; pixels: Uint8Array };
}
export const vegetationSpec = (id = 'deciduous', seed = 1): VegetationSpec => ({
  version: 1,
  seed,
  preset: structuredClone(vegetationPresets.find((p) => p.id === id) ?? vegetationPresets[0]!),
  layout: 'natural',
  spacing: 12,
  edits: [],
  overrides: [],
});
const finite = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const validPoint = (p: Point) => p && finite(p.x, -1e12, 1e12) && finite(p.y, -1e12, 1e12);
export function validateVegetation(r: LandscapeRecord) {
  if (!r.vegetation) {
    if (r.kind === 'vegetation') throw Error('Landschaftsvorlage fehlt.');
    return;
  }
  const v = r.vegetation,
    p = v.preset;
  if (
    r.kind !== 'vegetation' ||
    v.version !== 1 ||
    !Number.isInteger(v.seed) ||
    !finite(v.seed, 0, 4294967295) ||
    !p ||
    typeof p.id !== 'string' ||
    !p.id.length ||
    p.id.length > 100 ||
    !['plains', 'forest', 'hills', 'mountains', 'water', 'marsh', 'desert', 'snow'].includes(
      p.terrain,
    ) ||
    r.values.terrain !== p.terrain ||
    !/^#[a-fA-F0-9]{6}$/.test(p.ground) ||
    typeof p.name !== 'string' ||
    p.name.length > 100 ||
    !['oak', 'pine', 'shrub'].includes(p.tree) ||
    !['shrub', 'grass', 'reed', 'crop'].includes(p.undergrowthAsset) ||
    !['natural', 'rows'].includes(p.distribution) ||
    !['natural', 'furrows'].includes(p.groundPattern) ||
    !p.waterDepth ||
    !['trees', 'undergrowth', 'rocks'].every((k) =>
      finite(p.waterDepth[k as keyof typeof p.waterDepth], 0, 2),
    ) ||
    !['natural', 'row'].includes(v.layout) ||
    !finite(v.spacing, 2, 1000) ||
    !finite(p.size, 1, 60) ||
    !finite(p.edge, 0, 500) ||
    !finite(p.slope, 0, 85) ||
    ![p.density, p.undergrowth, p.rocks, p.grouping].every((x) => finite(x, 0, 1)) ||
    !Array.isArray(v.edits) ||
    v.edits.length > 1000 ||
    !Array.isArray(v.overrides) ||
    v.overrides.length > 2000 ||
    !r.polygons.length ||
    r.polygons.some((p) => p.outer.length < 3) ||
    r.points.some((p) => !validPoint(p)) ||
    (v.layout === 'row' && r.points.length < 2)
  )
    throw Error('Bewuchsfläche oder Vorlage prüfen.');
  let vertices = 0;
  for (const edit of v.edits) {
    if (
      !edit ||
      !['clear', 'thin', 'dense'].includes(edit.mode) ||
      !Array.isArray(edit.polygons) ||
      !edit.polygons.length
    )
      throw Error('Bestandskorrektur prüfen.');
    for (const p of edit.polygons) {
      if (
        !p ||
        !Array.isArray(p.outer) ||
        p.outer.length < 3 ||
        !Array.isArray(p.holes) ||
        p.holes.some((h) => !Array.isArray(h) || h.length < 3)
      )
        throw Error('Korrekturfläche prüfen.');
      for (const ring of [p.outer, ...p.holes]) {
        vertices += ring.length;
        if (ring.some((p) => !validPoint(p))) throw Error('Korrekturpunkte prüfen.');
      }
    }
  }
  if (vertices > 50000) throw Error('Zu viele Korrekturpunkte.');
  const ids = new Set<string>();
  for (const o of v.overrides) {
    if (
      !o ||
      typeof o.id !== 'string' ||
      !o.id ||
      o.id.length > 150 ||
      ids.has(o.id) ||
      !validPoint(o) ||
      !plantAssets.includes(o.asset) ||
      !finite(o.size, 0.2, 100) ||
      !finite(o.angle, -Math.PI * 100, Math.PI * 100) ||
      (o.removed !== undefined && typeof o.removed !== 'boolean') ||
      (o.locationId !== undefined && (typeof o.locationId !== 'string' || !o.locationId))
    )
      throw Error('Einzelkorrektur prüfen.');
    ids.add(o.id);
  }
}
// World-addressed randomness: camera, tile boundaries, density and unrelated edits
// do not enter a candidate's identity or position.
function edgeDistance(p: Point, polygons: Polygon[]) {
  let d = Infinity;
  for (const poly of polygons)
    for (const ring of [poly.outer, ...poly.holes])
      for (let i = 0; i < ring.length; i++)
        d = Math.min(d, segmentDistance(p, ring[i]!, ring[(i + 1) % ring.length]!));
  return d;
}
export interface VegetationEnvironment {
  terrain: TerrainSampler;
  covers: LandscapeRecord[];
  roads: LandscapeRecord[];
  buildings: Polygon[];
}
export function vegetationEnvironment(
  records: LandscapeRecord[],
  buildings: Polygon[] = [],
): VegetationEnvironment {
  return {
    terrain: new TerrainSampler(records),
    covers: records
      .filter((r) => r.vegetation)
      .sort((a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0)),
    roads: records.filter((r) => r.kind === 'road' || r.kind === 'river'),
    buildings,
  };
}
export function vegetationOwner(env: VegetationEnvironment, p: Point) {
  let owner: LandscapeRecord | undefined;
  for (const r of env.covers) if (contains(p, r.polygons)) owner = r;
  return owner;
}
export function vegetationAssetWaterDepth(preset: VegetationPreset, asset: PlantAsset) {
  // A shallow-water policy belongs only to the definition's selected family.
  return asset === preset.tree
    ? preset.waterDepth.trees
    : asset === 'rock'
      ? preset.waterDepth.rocks
      : asset === preset.undergrowthAsset
        ? preset.waterDepth.undergrowth
        : 0;
}
export function vegetationBlocked(
  env: VegetationEnvironment,
  p: Point,
  radius = 0,
  maximumWaterDepth = 0,
) {
  const height = env.terrain.sample(p).heightM,
    level = env.terrain.waterLevel(p, height);
  if (!vegetationWaterSuitable(level === undefined ? undefined : level - height, maximumWaterDepth))
    return true;
  for (const r of env.roads) {
    const pts = linePoints(r);
    if (pts.some((b, i) => i > 0 && segmentDistance(p, pts[i - 1]!, b) <= r.width / 2 + radius + 1))
      return true;
  }
  return contains(p, env.buildings) || (radius > 0 && edgeDistance(p, env.buildings) < radius);
}
const inBox = (p: Point, b: LandscapeBox, pad = 0) =>
  p.x >= b.x - pad && p.y >= b.y - pad && p.x <= b.x + b.width + pad && p.y <= b.y + b.height + pad;
export const VEGETATION_SURFACE_MPP = 8;
export function generateVegetation(
  r: LandscapeRecord,
  environment: VegetationEnvironment | ((point: Point, radius: number) => VegetationEnvironment),
  box: LandscapeBox,
  mpp: number,
): VegetationView {
  const sourceAt = (point: Point, radius: number) =>
    typeof environment === 'function' ? environment(point, radius) : environment;
  const v = r.vegetation!;
  if (!v) return { instances: [], mode: 'surface' };
  const instances: VegetationInstance[] = [],
    p = v.preset,
    overrides = new Map(v.overrides.map((o) => [o.id, o]));
  const base = v.spacing;
  const extent = bounds(r),
    pad = 60;
  const clipped = {
    x: Math.max(box.x - pad, extent.x),
    y: Math.max(box.y - pad, extent.y),
    right: Math.min(box.x + box.width + pad, extent.x + extent.width),
    bottom: Math.min(box.y + box.height + pad, extent.y + extent.height),
  };
  const grid = vegetationGrid(base, mpp, clipped),
    stride = v.layout === 'row' ? vegetationStride(base, mpp) : grid.stride;
  const detail = mpp <= 2 && stride === 1,
    mode = mpp > VEGETATION_SURFACE_MPP ? 'surface' : detail ? 'individual' : 'canopy';
  const emit = (
    id: string,
    at: Point,
    asset: PlantAsset,
    size: number,
    angle: number,
    chance: number,
    random: number,
  ) => {
    const env = sourceAt(at, size * 0.25);
    if (overrides.has(id) || !inBox(at, box, pad) || vegetationOwner(env, at)?.id !== r.id) return;
    const edge = edgeDistance(at, r.polygons);
    // Containment applies to the complete visible model, not just its stem.
    // Protected author corrections below deliberately retain their exact position.
    if (edge < vegetationFootprintRadius(asset, size)) return;
    const surface = env.terrain.query(at);
    if (
      surface.slopeDegrees > p.slope ||
      vegetationBlocked(
        env,
        at,
        asset === 'rock' ? size * 0.25 : size * 0.12,
        vegetationAssetWaterDepth(p, asset),
      )
    )
      return;
    let density = chance;
    for (const edit of v.edits)
      if (contains(at, edit.polygons))
        density =
          edit.mode === 'clear'
            ? 0
            : edit.mode === 'thin'
              ? density * 0.3
              : Math.min(1, density + 0.5);
    if (p.edge) density *= Math.min(1, edge / p.edge);
    if (density <= 0 || random > density) return;
    instances.push({ id, ...at, asset, size, angle, z: surface.heightM, normal: surface.normal });
  };
  if (mode !== 'surface') {
    if (v.layout === 'row') {
      let index = 0,
        travel = 0,
        next = 0;
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1]!,
          b = r.points[i]!,
          length = Math.hypot(b.x - a.x, b.y - a.y);
        if (!length) continue;
        // Skip distant portions without iterating a continent's worth of trees.
        const start = Math.max(next, travel),
          end = travel + length;
        const segmentBox = {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.abs(a.x - b.x),
          height: Math.abs(a.y - b.y),
        };
        const count = Math.max(0, Math.ceil((end - start) / base));
        if (
          segmentBox.x <= box.x + box.width + pad &&
          segmentBox.x + segmentBox.width >= box.x - pad &&
          segmentBox.y <= box.y + box.height + pad &&
          segmentBox.y + segmentBox.height >= box.y - pad
        ) {
          let lo = 0,
            hi = 1;
          for (const [origin, delta, min, max] of [
            [a.x, b.x - a.x, box.x - pad, box.x + box.width + pad],
            [a.y, b.y - a.y, box.y - pad, box.y + box.height + pad],
          ]) {
            if (delta) {
              const u = (min! - origin!) / delta,
                w = (max! - origin!) / delta;
              lo = Math.max(lo, Math.min(u, w));
              hi = Math.min(hi, Math.max(u, w));
            }
          }
          const first = Math.max(0, Math.ceil((travel + lo * length - start) / base)),
            last = Math.min(count - 1, Math.floor((travel + hi * length - start) / base));
          if ((last - first) / stride > 20000) throw Error('Baumreihe: näheren Abschnitt wählen.');
          for (let n = first; n <= last; n++) {
            const k = index + n;
            if (k % stride) continue;
            const t = (start + n * base - travel) / length;
            emit(
              'row:' + k,
              { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
              p.tree,
              p.size,
              vegetationRandom(v.seed, k, 0, 4) * Math.PI * 2,
              p.density,
              vegetationRandom(v.seed, k, 0, 5),
            );
          }
        }
        index += count;
        next = start + count * base;
        travel = end;
      }
    } else {
      const { x0, y0, x1, y1 } = grid;
      for (let row = y0; row <= y1; row += stride)
        for (let column = x0; column <= x1; column += stride) {
          // Coarser levels retain a nested subset of the same local candidates.
          const { x, y } = vegetationRepresentative(v.seed, column, row, stride);
          const rand = (salt: number) => vegetationRandom(v.seed, x, y, salt);
          const at = { x: (x + 0.2 + rand(1) * 0.6) * base, y: (y + 0.2 + rand(2) * 0.6) * base },
            cluster =
              1 -
              p.grouping +
              p.grouping *
                (0.2 + 0.8 * vegetationRandom(v.seed, Math.floor(x / 8), Math.floor(y / 8), 42));
          emit(
            `tree:${x}:${y}`,
            at,
            p.tree,
            p.size * (0.75 + rand(3) * 0.5),
            rand(4) * Math.PI * 2,
            p.density * cluster,
            rand(5),
          );
          if (detail) {
            const small = {
              x: (x + 0.12 + rand(6) * 0.76) * base,
              y: (y + 0.12 + rand(7) * 0.76) * base,
            };
            emit(
              `rock:${x}:${y}`,
              small,
              'rock',
              1 + rand(8) * 4,
              rand(9) * Math.PI * 2,
              p.rocks * cluster,
              rand(10),
            );
            emit(
              `under:${x}:${y}`,
              p.distribution === 'rows'
                ? { x: (x + 0.5) * base, y: (y + 0.5) * base }
                : { x: (x + rand(11)) * base, y: (y + rand(12)) * base },
              p.undergrowthAsset,
              p.undergrowthAsset === 'grass'
                ? 0.7
                : p.undergrowthAsset === 'crop'
                  ? 1.2
                  : p.undergrowthAsset === 'reed'
                    ? 2
                    : 1 + rand(13) * 2,
              p.distribution === 'rows' ? 0 : rand(14) * Math.PI * 2,
              p.undergrowth * cluster,
              rand(15),
            );
          } else if (!p.density && p.rocks > 0.2)
            emit(
              `rock:${x}:${y}`,
              { x: (x + 0.12 + rand(6) * 0.76) * base, y: (y + 0.12 + rand(7) * 0.76) * base },
              'rock',
              1 + rand(8) * 4,
              rand(9) * Math.PI * 2,
              p.rocks * cluster,
              rand(10),
            );
        }
    }
  }
  // Protected objects remain visible even when their original candidate becomes
  // unsuitable. Conflicts are reported; author decisions are never deleted.
  for (const o of overrides.values())
    if (!o.removed && inBox(o, box, pad)) {
      const env = sourceAt(o, o.size * 0.15);
      const surface = env.terrain.query(o);
      instances.push({
        ...o,
        z: surface.heightM,
        normal: surface.normal,
        protected: true,
        conflict:
          vegetationBlocked(env, o, o.size * 0.15, vegetationAssetWaterDepth(p, o.asset)) ||
          surface.slopeDegrees > p.slope,
      });
    }
  return { instances, mode };
}
