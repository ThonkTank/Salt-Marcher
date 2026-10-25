import type { Room } from '../contracts';
/** Fit precisely the rooms rendered by the caller, including its current draft. */
export function roomCameraBox(rooms: Iterable<Pick<Room, 'polygons'>>): string | null {
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const room of rooms)
    for (const polygon of room.polygons)
      for (const p of polygon.outer) {
        x = Math.min(x, p.x);
        y = Math.min(y, p.y);
        right = Math.max(right, p.x);
        bottom = Math.max(bottom, p.y);
      }
  if (!Number.isFinite(x)) return null;
  const width = right - x,
    height = bottom - y,
    pad = Math.max(width, height) * 0.18 + 0.5;
  return `${x - pad} ${y - pad} ${width + pad * 2} ${height + pad * 2}`;
}
