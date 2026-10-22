import { PNG } from 'pngjs';
import type { Point, Polygon } from '../contracts';
import type { AtlasRegionQuery } from '../atlas-region-contracts';
import { LandscapeRasterizer } from '../landscape-raster';
import { mapFootprintVisible, mapLineVisible, mapLineWidth } from '../atlas-scale-policy';
import { territoryBounds } from '../atlas-territories';

type Shape = {
  value: { kind?: string; color?: string };
  polygons?: Polygon[];
  points?: Point[];
  stroke?: number;
  style?: { fill?: string };
};
type Frame = Point & { angle: number };
type Item = { shape: Shape; frame: Frame; kind: string; roof?: string };
const at = (p: Point, f: Frame): Point => ({
  x: f.x + p.x * Math.cos(f.angle) - p.y * Math.sin(f.angle),
  y: f.y + p.x * Math.sin(f.angle) + p.y * Math.cos(f.angle),
});

/** Retain only the reader's bounded vector prefix. Once it overflows, paint that
 * prefix and stream all later shapes in the same order without rereading SQL. */
export class AtlasGeometryRaster {
  private pending: Item[] = [];
  private image: LandscapeRasterizer | null = null;
  private width: number;
  private height: number;

  constructor(private query: AtlasRegionQuery, private checkpoint: () => void) {
    this.width = Math.min(512, query.width);
    this.height = Math.max(1, Math.min(512, Math.round(this.width * query.height / query.width)));
  }

  append(shape: Shape, frame: Frame, kind: string, roof?: string) {
    const item = { shape, frame, kind, roof };
    if (this.image) this.paint(item);
    else this.pending.push(item);
  }

  activate() {
    if (this.image) return;
    this.image = new LandscapeRasterizer(this.query.box, this.width, this.height);
    for (const item of this.pending) this.paint(item);
    this.pending = [];
  }

  private paint({ shape: s, frame: f, kind, roof }: Item) {
    this.checkpoint();
    const q = this.query, mpp = q.box.width / q.width;
    const polygons = s.polygons?.map(p => ({
      outer: p.outer.map(p => at(p, f)),
      holes: p.holes.map(r => r.map(p => at(p, f))),
    }));
    if (kind === 'unit' && s.value.kind === 'building' &&
        !mapFootprintVisible(polygons?.flatMap(p => p.outer) ?? [], mpp)) return;
    if (kind === 'unit' && s.value.kind === 'road' &&
        !mapLineVisible('road', s.stroke ?? 6, mpp)) return;
    const color = kind === 'unit'
      ? (s.value.kind === 'water' ? '#8eafb9' : s.value.kind === 'building' ? roof! : '#d9c6a4')
      : kind === 'room' ? (s.style?.fill ?? '#e2dac4') : (s.value.color ?? '#685b50');
    if (polygons) {
      this.image!.paintPolygons(polygons, color);
      const pixel = q.box.width / this.width;
      for (const polygon of polygons) {
        const extent = territoryBounds([polygon]);
        if (extent.width < pixel || extent.height < pixel) {
          this.image!.paintLine([{ x: extent.x + extent.width / 2, y: extent.y + extent.height / 2 }], pixel, color);
        }
      }
    } else if (s.points) {
      this.image!.paintLine(s.points.map(p => at(p, f)), mapLineWidth(s.stroke ?? mpp * 2, mpp), color);
    }
  }

  finish() {
    this.activate();
    this.checkpoint();
    const data = PNG.sync.write({
      width: this.width, height: this.height, data: Buffer.from(this.image!.finish()),
    } as PNG).toString('base64');
    return { box: { ...this.query.box }, width: this.width, height: this.height, data: 'data:image/png;base64,' + data };
  }
}
