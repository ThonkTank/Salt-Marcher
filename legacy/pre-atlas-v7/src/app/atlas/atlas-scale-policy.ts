import { prominenceOpacity } from './atlas-prominence';
import type { LandscapeRecord } from './landscape-contracts';
export const MAP_LINE_MIN_PIXELS = 1.4;
export const mapLineThreshold = (kind: 'road' | 'river', minor = false) =>
  minor ? 0.4 : kind === 'river' ? 0.12 : 0.18;
/** Display widths are screen based; canonical dimensions and hit tests stay exact. */
export function mapLineVisible(kind: 'road' | 'river', width: number, mpp: number, minor = false) {
  return mpp <= 0 || width / mpp >= mapLineThreshold(kind, minor);
}
export function mapLineWidth(width: number, mpp: number) {
  return mpp <= 0 ? width : Math.max(width, mpp * MAP_LINE_MIN_PIXELS);
}
export function mapRecordVisible(r: LandscapeRecord, mpp: number) {
  return r.kind === 'road' || r.kind === 'river'
    ? prominenceOpacity(r, mpp) > 0
    : r.kind !== 'place' || mpp <= 1000;
}
export function mapFootprintVisible(points: readonly { x: number; y: number }[], mpp: number) {
  if (mpp <= 0) return true;
  let x = Infinity,
    y = Infinity,
    xx = -Infinity,
    yy = -Infinity;
  for (const p of points) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    xx = Math.max(xx, p.x);
    yy = Math.max(yy, p.y);
  }
  return mapExtentVisible(xx - x, yy - y, mpp);
}

/** Subpixel geometry does not become a synthetic place marker when zooming out. */
export function mapExtentVisible(width: number, height: number, mpp: number) {
  return mpp <= 0 || Math.max(width, height) / mpp >= 2;
}

/** Fade the last readable interval without changing topology or physical widths. */
export function mapLineOpacity(kind: 'road' | 'river', width: number, mpp: number, minor = false) {
  if (mpp <= 0) return 1;
  const threshold = mapLineThreshold(kind, minor),
    t = Math.max(0, Math.min(1, (width / mpp / threshold - 1) / 0.5));
  return t * t * (3 - 2 * t);
}
export function mapRecordOpacity(record: LandscapeRecord, mpp: number) {
  return record.kind === 'road' || record.kind === 'river' ? prominenceOpacity(record, mpp) : 1;
}
