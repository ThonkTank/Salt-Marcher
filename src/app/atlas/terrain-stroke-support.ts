import type { CanvasBox as LandscapeBox } from './atlas-camera';
export interface TerrainAuthorTile {
  x: number;
  y: number;
}
/** Coordinates are lattice tile indices, never world positions. */
export function terrainSupportTiles(
  points: readonly { x: number; y: number }[],
  radius: number,
  pixel: number,
) {
  const edge = 64 * pixel,
    tiles = new Map<string, TerrainAuthorTile>();
  for (const p of points) {
    const left = Math.floor((p.x - radius) / edge),
      right = Math.floor((p.x + radius) / edge),
      top = Math.floor((p.y - radius) / edge),
      bottom = Math.floor((p.y + radius) / edge);
    if (![left, right, top, bottom].every(Number.isSafeInteger))
      throw Error('Pinselbereich nicht präzise darstellbar.');
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        if (
          Math.hypot(
            Math.max(x * edge - p.x, 0, p.x - (x + 1) * edge),
            Math.max(y * edge - p.y, 0, p.y - (y + 1) * edge),
          ) >= radius
        )
          continue;
        tiles.set(`${x}:${y}`, { x, y });
        if (tiles.size > 256) throw Error('Höhenbereich zu groß. In kürzeren Zügen bearbeiten.');
      }
  }
  return [...tiles.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}
/** Source supports include the existing smoothing/author halo individually;
 * distant foreground/background sections never create a rectangular corridor. */
export function terrainSupportBoxes(
  tiles: readonly TerrainAuthorTile[],
  pixel: number,
  halo = 0,
): LandscapeBox[] {
  const edge = 64 * pixel;
  return tiles.map((t) => ({
    x: t.x * edge - halo,
    y: t.y * edge - halo,
    width: edge + 2 * halo,
    height: edge + 2 * halo,
  }));
}
export function terrainBoxesBounds(boxes: readonly LandscapeBox[]): LandscapeBox {
  if (!boxes.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

type Point = { x: number; y: number };
function capsuleTouches(
  a: Point,
  b: Point,
  left: number,
  top: number,
  edge: number,
  radius: number,
) {
  const right = left + edge,
    bottom = top + edge,
    dx = b.x - a.x,
    dy = b.y - a.y,
    length2 = dx * dx + dy * dy;
  let enter = 0,
    exit = 1;
  for (const [p, d, min, max] of [
    [a.x, dx, left, right],
    [a.y, dy, top, bottom],
  ]) {
    if (!d) {
      if (p! < min! || p! > max!) {
        enter = 1;
        exit = 0;
        break;
      }
    } else {
      const lo = (min! - p!) / d!,
        hi = (max! - p!) / d!;
      enter = Math.max(enter, Math.min(lo, hi));
      exit = Math.min(exit, Math.max(lo, hi));
    }
  }
  if (enter <= exit) return true;
  const toBox = (p: Point) =>
    Math.hypot(Math.max(left - p.x, 0, p.x - right), Math.max(top - p.y, 0, p.y - bottom));
  let distance = Math.min(toBox(a), toBox(b));
  for (const x of [left, right])
    for (const y of [top, bottom]) {
      const t = length2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)) : 0;
      distance = Math.min(distance, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
    }
  return distance < radius;
}
/** Exact circle/capsule supports for spatial footprints. Splitting only the
 * enumeration prevents a long diagonal from creating a quadratic tile box.
 * Each supplied centreline remains separate; no silhouette bridge is invented. */
export function terrainCentrelineTiles(
  lines: readonly (readonly Point[])[],
  radius: number,
  pixel: number,
) {
  const edge = 64 * pixel,
    tiles = new Map<string, TerrainAuthorTile>();
  for (const line of lines)
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)]!,
        b = line[i]!,
        length = Math.hypot(b.x - a.x, b.y - a.y),
        count = Math.max(1, Math.ceil(length / edge));
      for (let part = 0; part < count; part++) {
        const at = (f: number) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }),
          p = at(part / count),
          q = at((part + 1) / count),
          left = Math.floor((Math.min(p.x, q.x) - radius) / edge),
          right = Math.floor((Math.max(p.x, q.x) + radius) / edge),
          top = Math.floor((Math.min(p.y, q.y) - radius) / edge),
          bottom = Math.floor((Math.max(p.y, q.y) + radius) / edge);
        if (![left, right, top, bottom, count].every(Number.isSafeInteger))
          throw Error('Pinselbereich nicht präzise darstellbar.');
        for (let y = top; y <= bottom; y++)
          for (let x = left; x <= right; x++) {
            const key = `${x}:${y}`;
            if (tiles.has(key) || !capsuleTouches(p, q, x * edge, y * edge, edge, radius)) continue;
            tiles.set(key, { x, y });
            if (tiles.size > 256)
              throw Error('Höhenbereich zu groß. In kürzeren Zügen bearbeiten.');
          }
      }
    }
  return [...tiles.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}
