import type { Point } from '../shared/contracts';

export interface AtlasFrame {
  x: number;
  y: number;
  angle: number;
}

export const localToAtlas = (p: Point, f: AtlasFrame): Point => ({
  x: f.x + p.x * Math.cos(f.angle) - p.y * Math.sin(f.angle),
  y: f.y + p.x * Math.sin(f.angle) + p.y * Math.cos(f.angle),
});

export const atlasToLocal = (p: Point, f: AtlasFrame): Point => ({
  x: (p.x - f.x) * Math.cos(f.angle) + (p.y - f.y) * Math.sin(f.angle),
  y: -(p.x - f.x) * Math.sin(f.angle) + (p.y - f.y) * Math.cos(f.angle),
});

// Axial hexes use distance between parallel sides as their physical metric.
export const atlasHexPoint = (q: number, r: number, size: number) => ({
  x: (q + r / 2) * size,
  y: ((r * Math.sqrt(3)) / 2) * size,
});

export function atlasHexAt(p: Point, size: number) {
  const r = p.y / ((size * Math.sqrt(3)) / 2),
    q = p.x / size - r / 2;
  let x = Math.round(q),
    z = Math.round(r),
    y = Math.round(-q - r);
  const dx = Math.abs(x - q),
    dz = Math.abs(z - r),
    dy = Math.abs(y + q + r);
  if (dx > dy && dx > dz) x = -y - z;
  else if (dy > dz) y = -x - z;
  else z = -x - y;
  return { q: x, r: z };
}

export const frameMatrix = (f: AtlasFrame): import('./atlas-paint').Affine => [
  Math.cos(f.angle),
  Math.sin(f.angle),
  -Math.sin(f.angle),
  Math.cos(f.angle),
  f.x,
  f.y,
];
