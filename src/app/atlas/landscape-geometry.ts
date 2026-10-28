import type { Point, Polygon } from '../shared/contracts';
import type { LandscapeBox } from './landscape-bounds';
import type { LandscapeRecord } from './landscape-contracts';
import { linePoints } from './landscape-line';
import { heightInfluenceBounds } from './terrain-interpolation';
import { routeBounds } from './terrain-route';

export function contains(p: Point, polys: Polygon[]) {
  const ring = (a: Point[]) => {
    let c = false;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++)
      if (
        a[i]!.y > p.y !== a[j]!.y > p.y &&
        p.x < ((a[j]!.x - a[i]!.x) * (p.y - a[i]!.y)) / (a[j]!.y - a[i]!.y) + a[i]!.x
      )
        c = !c;
    return c;
  };
  return polys.some((poly) => ring(poly.outer) && !poly.holes.some(ring));
}

export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function bounds(record: LandscapeRecord): LandscapeBox {
  if (record.height) return heightInfluenceBounds(record.height);
  if (record.route) return routeBounds(record);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const include = (p: Point) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  for (const p of record.line ? linePoints(record) : record.points) include(p);
  for (const polygon of record.polygons) for (const p of polygon.outer) include(p);
  for (const o of record.vegetation?.overrides ?? [])
    if (!o.removed) {
      include({ x: o.x - o.size, y: o.y - o.size });
      include({ x: o.x + o.size, y: o.y + o.size });
    }
  if (minX === Infinity) throw new Error('Geometrie fehlt.');
  if (record.kind === 'reference') {
    const p = record.points[0]!,
      w = record.width,
      h = (w * (record.imageHeight ?? 1)) / (record.imageWidth ?? 1),
      a = record.angle ?? 0;
    for (const v of [
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ])
      include({
        x: p.x + v.x * Math.cos(a) - v.y * Math.sin(a),
        y: p.y + v.x * Math.sin(a) + v.y * Math.cos(a),
      });
  }
  const pad =
      record.kind === 'river' || record.kind === 'road'
        ? record.width * (record.line ? 1 : 0.5)
        : 0,
    x = minX - pad,
    y = minY - pad;
  return {
    x,
    y,
    width: maxX - x + pad,
    height: maxY - y + pad,
  };
}
