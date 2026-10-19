import { applyMaskStroke, type MaskStroke } from "./land-mask";
import { validateColor, brushFootprint } from "./landscape-brush";
import { colorSurface } from "./landscape-color-surface";
import { LandscapeRasterizer } from "./landscape-raster";
import type { LandscapeBox, LandscapeRecord } from "./atlas-landscape";

export interface BrushPreviewJob {
  generation: number;
  records: LandscapeRecord[];
  box: LandscapeBox;
  width: number;
  height: number;
  stroke?: MaskStroke;
  color?: LandscapeRecord;
}
export function renderBrushPreview(job: BrushPreviewJob): Uint8Array {
  let records = job.records;
  if (job.stroke) {
    const tiles = applyMaskStroke(records, job.stroke),
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
    const r = colorSurface(color, records);
    if (r.polygons.length) records = [...records, r];
  }
  const image = new LandscapeRasterizer(job.box, job.width, job.height);
  const ordered = [...records].sort(
    (a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0),
  );
  for (const r of ordered) image.paint(r);
  for (const r of records
    .filter((r) => r.paint)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)))
    image.paintColor(r);
  return image.finish();
}
// Browser worker only; importing the pure renderer in Node tests has no side effects.
if (typeof self !== "undefined" && typeof document === "undefined")
  self.onmessage = (event: MessageEvent<BrushPreviewJob>) => {
    try {
      const pixels = renderBrushPreview(event.data);
      self.postMessage(
        { generation: event.data.generation, pixels },
        { transfer: [pixels.buffer] },
      );
    } catch (error) {
      self.postMessage({
        generation: event.data.generation,
        error: (error as Error).message,
      });
    }
  };
