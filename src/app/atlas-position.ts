import type { Point } from './contracts';

/** Durable address codec. Only bounded differences enter floating point geometry. */
export interface AtlasPosition {
  version: 1;
  x: { area: string; offset: number };
  y: { area: string; offset: number };
}
export const ATLAS_AREA_METERS = 1000;
const address = /^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/;
function axis(area: string, offset: number) {
  if (
    typeof area !== 'string' ||
    !address.test(area) ||
    area.length > 128 ||
    !Number.isFinite(offset) ||
    Math.abs(offset) > 2 ** 40
  )
    throw new Error('Atlasadresse prüfen.');
  const carry = Math.floor(offset / ATLAS_AREA_METERS);
  if (!Number.isSafeInteger(carry))
    throw new Error('Atlasoffset ist nicht zuverlässig darstellbar.');
  const rest = offset - carry * ATLAS_AREA_METERS;
  const normalized = (BigInt(area) + BigInt(carry)).toString();
  if (normalized.length > 128) throw new Error('Atlasadresse ist zu groß.');
  return { area: normalized, offset: Object.is(rest, -0) ? 0 : rest };
}
export function atlasPosition(p: Point): AtlasPosition {
  if (
    !p ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    Math.max(Math.abs(p.x), Math.abs(p.y)) > 2 ** 42
  )
    throw new Error(
      'Globale Position ist nicht millimetergenau darstellbar. Bereichsadresse verwenden.',
    );
  const fromMeters = (value: number) => {
    const area = Math.floor(value / ATLAS_AREA_METERS);
    return axis(String(area), value - area * ATLAS_AREA_METERS);
  };
  return { version: 1, x: fromMeters(p.x), y: fromMeters(p.y) };
}
export function checkedAtlasPosition(p: AtlasPosition): AtlasPosition {
  if (!p || p.version !== 1 || !p.x || !p.y) throw new Error('Atlaspositionsversion prüfen.');
  return { version: 1, x: axis(p.x.area, p.x.offset), y: axis(p.y.area, p.y.offset) };
}
export function offsetAtlasPosition(p: AtlasPosition, delta: Point): AtlasPosition {
  const a = checkedAtlasPosition(p);
  return checkedAtlasPosition({
    version: 1,
    x: { area: a.x.area, offset: a.x.offset + delta.x },
    y: { area: a.y.area, offset: a.y.offset + delta.y },
  });
}
export function relativeAtlasPosition(
  p: AtlasPosition,
  origin: AtlasPosition,
  maxDistance: number,
): Point {
  if (!Number.isFinite(maxDistance) || maxDistance <= 0 || maxDistance > 1e9)
    throw new Error('Lokalen Atlasbereich prüfen.');
  const a = checkedAtlasPosition(p),
    b = checkedAtlasPosition(origin);
  const local = (x: typeof a.x, y: typeof b.x) => {
    const d = BigInt(x.area) - BigInt(y.area),
      bound = BigInt(Math.ceil(maxDistance / ATLAS_AREA_METERS) + 1);
    if (d < -bound || d > bound)
      throw new Error('Position liegt außerhalb des lokalen Atlasbereichs.');
    const n = Number(d) * ATLAS_AREA_METERS + x.offset - y.offset;
    if (Math.abs(n) > maxDistance)
      throw new Error('Position liegt außerhalb des lokalen Atlasbereichs.');
    return n;
  };
  return { x: local(a.x, b.x), y: local(a.y, b.y) };
}
