import type { Polygon } from '../shared/contracts';
import type { LandscapeRecord } from './atlas-landscape';
import { intersectPolygons, subtractPolygons, unionPolygons } from './landscape-brush';
import { bounds, contains } from './landscape-geometry';
import { decodeHeights, encodeHeights, terrainSettings } from './terrain-height';
import { heightInfluenceBounds } from './terrain-interpolation';
import { coupleRouteEdits, replanRoutes } from './terrain-route-planner';
import { applyTerrainBrush, heightBrushPixel, type HeightStroke } from './terrain-brush';
import type { TerrainGrid } from './terrain-spatial-model';

/** Author operation above the numeric brush, shared by live draft and previews.
 * The worker supplies its independently paged source to coupleTerrainEdits. */
export function applyCoupledTerrainBrush(
  records: LandscapeRecord[],
  stroke: HeightStroke,
  limited?: (factor: number) => void,
  visibility?: TerrainGrid,
  scaleHeight?: (p: { x: number; y: number }) => number,
) {
  const changes = applyTerrainBrush(records, stroke, undefined, visibility, scaleHeight, true);
  return coupleTerrainEdits(
    records,
    changes,
    limited,
    stroke.preserveDetails === false ? heightBrushPixel(stroke.radius) : undefined,
  );
}

const rectangle = (x: number, y: number, width: number, height: number): Polygon[] => [
  {
    outer: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    holes: [],
  },
];

/** Overlapping author strokes at the same level form one horizontal body.
 * The caller supplies the complete group, independently of camera bounds. */
export function terrainLakeGroups(records: LandscapeRecord[]) {
  const defaultLevel = terrainSettings(records).seaLevelM + 1;
  const remaining = records
    .filter((r) => r.surface === 'freshwater' && r.polygons.length)
    .sort((a, b) => a.id.localeCompare(b.id));
  const groups: LandscapeRecord[][] = [];
  while (remaining.length) {
    const group = [remaining.pop()!];
    for (let at = 0; at < group.length; at++)
      for (let i = remaining.length - 1; i >= 0; i--) {
        const a = group[at]!,
          b = remaining[i]!;
        if (
          (a.waterLevelM ?? defaultLevel) === (b.waterLevelM ?? defaultLevel) &&
          intersectPolygons(a.polygons, b.polygons).length
        )
          group.push(...remaining.splice(i, 1));
      }
    groups.push(group);
  }
  return groups;
}

/** Lower bound for the difference of two shape-preserving Hermite patches.
 * Translation and positive scaling commute with both interpolation passes.
 * Otherwise each pass stays within its two central nodes, so the four central
 * nodes bound the entire cell, including all points between author nodes. */
function patchChange(before: number[], after: number[]) {
  const delta = after[0]! - before[0]!;
  if (before.every((v, i) => after[i]! - v === delta)) return delta;
  const first = before.findIndex((v) => v !== 0),
    scale = first < 0 ? NaN : after[first]! / before[first]!;
  const central = [5, 6, 9, 10];
  let bound =
    Math.min(...central.map((i) => after[i]!)) - Math.max(...central.map((i) => before[i]!));
  // Each 1D Hermite pass is 3-Lipschitz in its node values: harmonic
  // tangent gradients sum to at most two, endpoint weights sum to one.
  // Two passes therefore bound Float32 affine residuals by 9 * error.
  const differences = before.map((v, i) => after[i]! - v),
    mid = (Math.min(...differences) + Math.max(...differences)) / 2;
  bound = Math.max(bound, mid - 9 * Math.max(...differences.map((v) => Math.abs(v - mid))));
  if (scale >= 0) {
    const error = Math.max(...before.map((v, i) => Math.abs(after[i]! - scale * v)));
    bound = Math.max(bound, Math.min(...central.map((i) => (scale - 1) * before[i]!)) - 9 * error);
  }
  return bound;
}

/** Complete cell coverage, never representative point sampling. A separate
 * bound per changed additive band is conservative under their sum. */
function commonLift(records: LandscapeRecord[], changes: LandscapeRecord[], polygons: Polygon[]) {
  const bands = new Map<number, LandscapeRecord[]>();
  for (const r of changes) {
    if (!r.height) continue;
    // Absolute legacy patches can inherit a spatially varying coarser field.
    // Without a complete inherited interval there is no certified positive lift.
    if (r.height.version !== 2) {
      const b = heightInfluenceBounds(r.height);
      if (intersectPolygons(polygons, rectangle(b.x, b.y, b.width, b.height)).length) return 0;
      continue;
    }
    const band = bands.get(r.height.pixel) ?? [];
    band.push(r);
    bands.set(r.height.pixel, band);
  }
  let total = 0;
  for (const [pixel, edited] of [...bands].sort((a, b) => b[0] - a[0])) {
    const old = new Map<string, Float32Array>(),
      next = new Map<string, Float32Array>();
    for (const r of records)
      if (r.height?.version === 2 && r.height.pixel === pixel)
        old.set(`${r.height.x / pixel / 64}:${r.height.y / pixel / 64}`, decodeHeights(r.height));
    for (const r of edited)
      next.set(`${r.height!.x / pixel / 64}:${r.height!.y / pixel / 64}`, decodeHeights(r.height!));
    const node = (x: number, y: number, after: boolean) => {
      const tx = Math.floor(x / 64),
        ty = Math.floor(y / 64),
        key = `${tx}:${ty}`;
      const values = (after ? next.get(key) : undefined) ?? old.get(key);
      const value = values?.[(y - ty * 64) * 64 + x - tx * 64];
      return value === undefined || Number.isNaN(value) ? 0 : value;
    };
    let uncovered = polygons;
    const cells = new Set<string>();
    let minimum = Infinity;
    for (const record of edited) {
      const t = record.height!,
        x0 = t.x / pixel - 2,
        y0 = t.y / pixel - 2;
      const clipped = intersectPolygons(
        polygons,
        rectangle(x0 * pixel, y0 * pixel, 67 * pixel, 67 * pixel),
      );
      if (!clipped.length) continue;
      uncovered = subtractPolygons(
        uncovered,
        rectangle(x0 * pixel, y0 * pixel, 67 * pixel, 67 * pixel),
      );
      const b = bounds({ ...record, height: undefined, polygons: clipped, points: [] });
      for (
        let y = Math.max(y0, Math.floor(b.y / pixel));
        y <= Math.min(y0 + 66, Math.floor((b.y + b.height) / pixel));
        y++
      )
        for (
          let x = Math.max(x0, Math.floor(b.x / pixel));
          x <= Math.min(x0 + 66, Math.floor((b.x + b.width) / pixel));
          x++
        ) {
          const key = `${x}:${y}`;
          if (cells.has(key)) continue;
          cells.add(key);
          // Inside cells need no clipping; boundary cells are intersected exactly.
          if (
            !contains({ x: (x + 0.5) * pixel, y: (y + 0.5) * pixel }, clipped) &&
            !intersectPolygons(clipped, rectangle(x * pixel, y * pixel, pixel, pixel)).length
          )
            continue;
          const before: number[] = [],
            after: number[] = [];
          for (let dy = -1; dy <= 2; dy++)
            for (let dx = -1; dx <= 2; dx++) {
              before.push(node(x + dx, y + dy, false));
              after.push(node(x + dx, y + dy, true));
            }
          minimum = Math.min(minimum, patchChange(before, after));
        }
    }
    total += uncovered.length || minimum === Infinity ? Math.min(0, minimum) : minimum;
  }
  return Math.max(0, total);
}

/** Preserve excavation ownership when the existing detail-off operation relaxes
 * a finer additive band. The final ratio includes route attenuation. Ordinary
 * additive strokes never touch this bookkeeping. */
function relaxedBed(
  records: LandscapeRecord[],
  changes: LandscapeRecord[],
  lake: LandscapeRecord,
  pixel?: number,
) {
  if (pixel === undefined || !lake.lakeBed) return lake.lakeBed;
  return lake.lakeBed.map((bed) => {
    if (bed.tile.pixel >= pixel) return bed;
    const before = records.find((r) => r.id === bed.tileId)?.height,
      after = changes.find((r) => r.id === bed.tileId)?.height;
    if (!before || !after) return bed;
    const old = decodeHeights(before),
      next = decodeHeights(after),
      amounts = decodeHeights(bed.tile).slice();
    let changed = false;
    for (let i = 0; i < amounts.length; i++) {
      if (!amounts[i] || !old[i] || !Number.isFinite(old[i])) continue;
      const ratio = Math.max(0, Math.min(1, next[i]! / old[i]!));
      if (!Number.isFinite(ratio) || ratio === 1) continue;
      amounts[i] = amounts[i]! * ratio;
      changed = true;
    }
    return changed ? { ...bed, tile: { ...bed.tile, data: encodeHeights(amounts) } } : bed;
  });
}

export function coupleLakeEdits(
  records: LandscapeRecord[],
  changes: LandscapeRecord[],
  relaxedPixel?: number,
) {
  const defaultLevel = terrainSettings(records).seaLevelM + 1;
  const result = [...changes];
  for (const group of terrainLakeGroups(records)) {
    const polygons = group.reduce<Polygon[]>((all, r) => unionPolygons(all, r.polygons), []);
    const lift = commonLift(records, changes, polygons);
    for (const lake of group) {
      const lakeBed = relaxedBed(records, changes, lake, relaxedPixel);
      if (!lift && lakeBed?.every((b, i) => b === lake.lakeBed?.[i])) continue;
      if (!lift && lakeBed === lake.lakeBed) continue;
      result.push({
        ...lake,
        ...(lift ? { waterLevelM: (lake.waterLevelM ?? defaultLevel) + lift } : {}),
        ...(lakeBed ? { lakeBed } : {}),
      });
    }
  }
  return result;
}

/** First settle protected height changes, then derive the common water lift.
 * Validate the combined change once. A failed new mouth rejects the gesture;
 * there is no iterative water/route solver and no mutation of the source. */
export function coupleTerrainEdits(
  records: LandscapeRecord[],
  changes: LandscapeRecord[],
  limited?: (factor: number) => void,
  relaxedPixel?: number,
) {
  if (!records.some((r) => r.route)) return coupleLakeEdits(records, changes, relaxedPixel);
  // The first route plan already sees the prospective lifted mouth. Keeping
  // the old target here would attenuate even a completely translated river.
  const prospective = coupleLakeEdits(records, changes);
  const protectedChanges = coupleRouteEdits(records, prospective, limited).filter(
    (r) => r.surface !== 'freshwater',
  );
  const coupled = coupleLakeEdits(records, protectedChanges, relaxedPixel);
  if (
    ![...prospective, ...coupled].some(
      (r) =>
        r.surface === 'freshwater' &&
        r.waterLevelM !== records.find((old) => old.id === r.id)?.waterLevelM,
    )
  )
    return coupled;
  const replacement = new Map(coupled.map((r) => [r.id, r]));
  const merged = [...records.filter((r) => !replacement.has(r.id)), ...coupled];
  const planned = replanRoutes(merged);
  for (const r of planned)
    if (r.route && JSON.stringify(r) !== JSON.stringify(records.find((old) => old.id === r.id)))
      replacement.set(r.id, r);
  return [...replacement.values()];
}
