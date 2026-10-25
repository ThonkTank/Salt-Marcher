import { routeBounds, validateRoute } from './terrain-route';
import { planRoute, replanRoutes } from './terrain-route-planner';
import { bounds, contains, type LandscapeRecord, type LandscapeBox } from './atlas-landscape';
import { applyTerrainBrush, heightBrushBounds, type HeightStroke } from './terrain-brush';
import { TerrainSampler } from './terrain-height';
import { orderedColors, validateColor } from './landscape-brush';
import { colorSurface } from './landscape-color-surface';
import { LandscapeRasterizer } from './landscape-raster';

/** A draft is an ordinary atlas command evaluated against a readonly snapshot. */
export type SpatialTerrainDraft =
  | { kind: 'landscape-route'; record: LandscapeRecord }
  | { kind: 'landscape-height-stroke'; stroke: HeightStroke }
  | { kind: 'landscape-color-stroke'; record: LandscapeRecord };
export function spatialDraftBounds(d: SpatialTerrainDraft): LandscapeBox {
  if (d?.kind === 'landscape-route') {
    validateRoute(d.record, false);
    return routeBounds(d.record);
  }
  if (d?.kind === 'landscape-height-stroke') return heightBrushBounds(d.stroke);
  if (d?.kind !== 'landscape-color-stroke') throw Error('Räumlichen Pinselauftrag prüfen.');
  validateColor(d.record);
  const r = d.record;
  if (
    !r.paint ||
    r.paint.version !== 2 ||
    r.propertyOnly ||
    r.height ||
    r.mask ||
    Object.keys(r.values).length
  )
    throw Error('Farbauftrag prüfen.');
  return bounds(r);
}
export function previewSpatialTerrain(records: LandscapeRecord[], draft?: SpatialTerrainDraft) {
  if (!draft) return records;
  spatialDraftBounds(draft);
  if (draft.kind === 'landscape-route') {
    const planned = planRoute(records, draft.record),
      next = replanRoutes([...records.filter((r) => r.id !== planned.id), planned]);
    const invalid = next.find((r) => r.route?.conflict);
    if (invalid) throw Error(invalid.route!.conflict);
    return next;
  }
  if (draft.kind === 'landscape-height-stroke') {
    const tiles = applyTerrainBrush(records, draft.stroke),
      ids = new Set(tiles.map((t) => t.id));
    return [...records.filter((r) => !ids.has(r.id)), ...tiles];
  }
  const color = structuredClone(draft.record);
  const clipped = colorSurface(color, records);
  clipped.order = Math.max(0, ...records.map((r) => r.order ?? 0)) + 1;
  return clipped.polygons.length ? [...records, clipped] : records;
}
/** Camera-dependent tessellation only affects display. Exact edits use the original tiles. */
export function spatialTerrainSurface(records: LandscapeRecord[], box: LandscapeBox, mpp: number) {
  const sampler = new TerrainSampler(records),
    resolution = Math.min(...records.filter((r) => r.height).map((r) => r.height!.pixel), Infinity),
    step = Math.max(
      mpp * 6,
      Number.isFinite(resolution) ? resolution : Math.max(box.width, box.height) / 32,
    ),
    segments = Math.min(
      256,
      Math.max(32, 2 ** Math.ceil(Math.log2(Math.max(box.width, box.height) / step))),
    ),
    columns = segments + 1,
    rows = segments + 1,
    heights: number[] = [],
    colors: string[] = [],
    lakes = records.filter((r) => r.surface === 'freshwater');
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      const p = { x: box.x + (x / segments) * box.width, y: box.y + (y / segments) * box.height },
        h = sampler.sample(p).heightM,
        water = sampler.water(p, h),
        level = lakes.reduce(
          (z, r) =>
            contains(p, r.polygons) ? Math.max(z, r.waterLevelM ?? sampler.seaLevelM + 1) : z,
          sampler.seaLevelM,
        );
      heights.push(water ? Math.max(sampler.waterLevel(p, h) ?? level, h) : h);
      colors.push('#ffffff');
    }
  const width = 256,
    height = Math.max(32, Math.min(512, Math.round((width * box.height) / box.width))),
    raster = new LandscapeRasterizer(box, width, height, 0, mpp);
  for (const r of [...records].sort(
    (a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0),
  ))
    raster.paint(r);
  for (const r of orderedColors(records)) raster.paintColor(r);
  return {
    grid: { columns, rows, heights, colors },
    texture: { width, height, pixels: raster.finish() },
  };
}
