import { applyTerrainBrush, type HeightStroke } from './terrain-brush';
import { applyHeightStroke, TerrainSampler } from './terrain-height';
import { type MaskStroke } from './land-mask';
import { validateColor, brushFootprint, orderedColors } from './landscape-brush';
import { colorSurface } from './landscape-color-surface';
import { LandscapeRasterizer } from './landscape-raster';
import type { LandscapeBox, LandscapeRecord } from './atlas-landscape';

export interface BrushPreviewJob {
  generation: number;
  records: LandscapeRecord[];
  box: LandscapeBox;
  width: number;
  height: number;
  stroke?: MaskStroke;
  heightStroke?: HeightStroke;
  contours?: number;
  displayMpp?: number;
  color?: LandscapeRecord;
}
export function brushPreviewRecords(
  job: BrushPreviewJob,
  limited?: (factor: number) => void,
  visibility?: import('./terrain-spatial-model').TerrainGrid,
): LandscapeRecord[] {
  let records = job.records;
  if (job.stroke || job.heightStroke) {
    const tiles = job.heightStroke
        ? applyTerrainBrush(records, job.heightStroke, limited, visibility)
        : applyHeightStroke(records, job.stroke!),
      ids = new Set(tiles.map((r) => r.id));
    records = [...records.filter((r) => !ids.has(r.id)), ...tiles];
  }
  if (job.color) {
    validateColor(job.color);
    const color = structuredClone(job.color);
    if (!color.paint!.fill)
      color.polygons = (color.paint!.strokes ?? [color.points]).flatMap((ps) =>
        brushFootprint(ps, color.paint!.radius),
      );
    const r = colorSurface(color, records, visibility);
    if (r.polygons.length) records = [...records, r];
  }
  return records;
}
export function renderBrushPreview(
  job: BrushPreviewJob,
  onHeight?: (height: number) => void,
  limited?: (factor: number) => void,
): Uint8Array {
  const records = brushPreviewRecords(job, limited);
  const point = (job.heightStroke ?? job.stroke)?.samples.at(-1);
  if (point) onHeight?.(new TerrainSampler(records).sample(point).heightM);
  const image = new LandscapeRasterizer(
    job.box,
    job.width,
    job.height,
    job.contours,
    job.displayMpp,
  );
  const ordered = [...records].sort(
    (a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0),
  );
  for (const r of ordered) image.paint(r);
  for (const r of orderedColors(records)) image.paintColor(r);
  return image.finish();
}
