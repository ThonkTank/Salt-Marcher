import type { Point } from '../shared/contracts';
export interface MapLabelStyle {
  rank?: number;
  hidden?: boolean;
  point?: Point;
  angle?: number;
}
export function validateMapLabelStyle(style: MapLabelStyle | undefined) {
  if (style === undefined) return;
  if (
    !style ||
    typeof style !== 'object' ||
    (style.rank !== undefined &&
      (!Number.isInteger(style.rank) || style.rank < 0 || style.rank > 5)) ||
    (style.hidden !== undefined && typeof style.hidden !== 'boolean') ||
    (style.point !== undefined &&
      (!style.point ||
        ![style.point.x, style.point.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 1e12))) ||
    (style.angle !== undefined &&
      (!Number.isFinite(style.angle) || Math.abs(style.angle) > Math.PI * 2))
  )
    throw Error('Beschriftung: Bedeutung 0–5 und gültige Position/Drehung wählen.');
}
