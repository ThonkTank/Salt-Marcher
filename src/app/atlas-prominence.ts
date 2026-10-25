import type { LandscapeRecord } from './atlas-landscape';

export const PROMINENCE_LIMITS = [2, 12, 100, 1000, 10000, Infinity] as const;
export const PROMINENCE_NAMES = [
  'Detail',
  'Ort',
  'Umgebung',
  'Region',
  'Kontinent',
  'Welt',
] as const;
export function validateProminence(value: unknown) {
  if (value !== undefined && (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 5))
    throw Error('Kartenprominenz: Automatisch oder 0–5 wählen.');
}
/** Whole authored extent, never the current viewport or a clipped path. */
export function automaticProminence(r: LandscapeRecord) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of r.route?.anchors ?? r.points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const span = Math.max(0, maxX - minX, maxY - minY),
    extent = [100, 1000, 10000, 100000, 1000000].filter((n) => span >= n).length;
  const width = r.width >= 100 ? 4 : r.width >= 20 ? 3 : r.width >= 5 ? 2 : 1;
  const minor = r.style === 'path' || r.style === 'stream';
  return Math.max(0, Math.min(4, Math.max(width, extent)) - (minor ? 1 : 0));
}
export const effectiveProminence = (r: LandscapeRecord) => r.prominence ?? automaticProminence(r);
export const prominenceLimit = (r: LandscapeRecord) => PROMINENCE_LIMITS[effectiveProminence(r)]!;
export function prominenceOpacity(r: LandscapeRecord, mpp: number) {
  const limit = prominenceLimit(r);
  if (!Number.isFinite(limit) || mpp <= 0) return 1;
  const t = Math.max(0, Math.min(1, (limit - mpp) / (limit * 0.25)));
  return t * t * (3 - 2 * t);
}
/** Compare editor drafts without mistaking a prominence edit for a route replan. */
export function onlyProminenceChanged(before: LandscapeRecord, after: LandscapeRecord) {
  const rest = (r: LandscapeRecord) => {
    const { prominence: _prominence, ...data } = r;
    return data;
  };
  return (
    before.prominence !== after.prominence &&
    JSON.stringify(rest(before)) === JSON.stringify(rest(after))
  );
}
