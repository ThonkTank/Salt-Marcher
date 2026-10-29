import { orient2d } from 'robust-predicates';
import { atlasCameraClipRange, type AtlasCameraPose } from './atlas-camera';

export interface ScreenPoint {
  u: number;
  v: number;
}
export interface ScreenWorldPoint {
  x: number;
  y: number;
  z: number;
  depth: number;
}
interface Vertex extends ScreenWorldPoint {
  w: number;
  U: number;
  V: number;
  u: number;
  v: number;
}
export interface ScreenTriangle {
  id: string;
  polygon: ScreenPoint[];
  point(screen: ScreenPoint): ScreenWorldPoint;
  order(screen: ScreenPoint): number;
}
const cross = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) =>
  -orient2d(a.u, a.v, b.u, b.v, c.u, c.v);
function clip(polygon: Vertex[], distance: (p: Vertex) => number) {
  const out: Vertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!,
      q = polygon[(i + 1) % polygon.length]!,
      f = distance(p),
      g = distance(q);
    if (f >= 0) out.push(p);
    if (f >= 0 !== g >= 0) {
      const t = f / (f - g),
        mix = (a: number, b: number) => a + (b - a) * t;
      out.push({
        x: mix(p.x, q.x),
        y: mix(p.y, q.y),
        z: mix(p.z, q.z),
        depth: mix(p.depth, q.depth),
        w: mix(p.w, q.w),
        U: mix(p.U, q.U),
        V: mix(p.V, q.V),
        u: 0,
        v: 0,
      });
    }
  }
  return out;
}
/** Clip before dividing by w. Interpolated world attributes retain the original
 * plane even when one or more original vertices lie behind the camera. */
export function atlasScreenTriangle(
  view: AtlasCameraPose,
  world: { x: number; y: number; z: number }[],
  id: string,
): ScreenTriangle | null {
  const rotation = (view.rotation * Math.PI) / 180,
    tilt = (view.tilt * Math.PI) / 180,
    c = Math.cos(rotation),
    s = Math.sin(rotation),
    ct = Math.cos(tilt),
    st = Math.sin(tilt),
    distance = view.frame.height * 1.5,
    { near, far } = atlasCameraClipRange(view),
    perspective = view.projection === 'perspective';
  let polygon = world.map((p) => {
    const dx = p.x - view.frame.x - view.frame.width / 2,
      dy = p.y - view.frame.y - view.frame.height / 2,
      dz = (p.z - view.focusM) * view.exaggeration,
      h = dx * c - dy * s,
      down = (dx * s + dy * c) * ct - dz * st,
      depth = distance - (dx * s + dy * c) * st - dz * ct,
      w = perspective ? depth : 1;
    return {
      ...p,
      depth,
      w,
      U: 0.5 * w + (h * (perspective ? distance : 1)) / view.frame.width,
      V: 0.5 * w + (down * (perspective ? distance : 1)) / view.frame.height,
      u: 0,
      v: 0,
    };
  });
  for (const plane of [
    (p: Vertex) => p.depth - near,
    (p: Vertex) => far - p.depth,
    (p: Vertex) => p.U,
    (p: Vertex) => p.w - p.U,
    (p: Vertex) => p.V,
    (p: Vertex) => p.w - p.V,
  ]) {
    polygon = clip(polygon, plane);
    if (polygon.length < 3) return null;
  }
  polygon = polygon.map((p) => ({ ...p, u: p.U / p.w, v: p.V / p.w }));
  let basis: [Vertex, Vertex, Vertex] | undefined,
    area = 0;
  for (let j = 1; j + 1 < polygon.length; j++) {
    const tri: [Vertex, Vertex, Vertex] = [polygon[0]!, polygon[j]!, polygon[j + 1]!],
      a = cross(...tri);
    if (Math.abs(a) > Math.abs(area)) {
      area = a;
      basis = tri;
    }
  }
  if (!basis || !area) return null;
  const vertices = basis,
    [a, b, c0] = vertices;
  const weights = (screen: ScreenPoint) => [
    cross(b, c0, screen) / area,
    cross(c0, a, screen) / area,
    cross(a, b, screen) / area,
  ];
  return {
    id,
    polygon,
    point(screen) {
      const ws = weights(screen),
        den = ws.reduce((sum, n, i) => sum + n / vertices[i]!.w, 0);
      let x = 0,
        y = 0,
        z = 0;
      for (let i = 0; i < 3; i++) {
        const weight = ws[i]! / vertices[i]!.w / den,
          v = vertices[i]!;
        x += v.x * weight;
        y += v.y * weight;
        z += v.z * weight;
      }
      return {
        x,
        y,
        z,
        depth: perspective ? 1 / den : ws.reduce((sum, n, i) => sum + n * vertices[i]!.depth, 0),
      };
    },
    // Larger is closer in both projections; along a screen line this is affine.
    order(screen) {
      return weights(screen).reduce(
        (sum, n, i) => sum + n * (perspective ? 1 / vertices[i]!.w : -vertices[i]!.depth),
        0,
      );
    },
  };
}
/** Closed containment for finite-time holds, open intervals for movement.
 * Robust orientation signs avoid inventing a screen-area tolerance. */
export function atlasScreenOverlap(polygon: ScreenPoint[], p: ScreenPoint, q: ScreenPoint) {
  let lo = 0,
    hi = 1,
    sign = 0;
  for (let i = 1; i + 1 < polygon.length && !sign; i++)
    sign = Math.sign(cross(polygon[0]!, polygon[i]!, polygon[i + 1]!));
  if (!sign) return null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!,
      b = polygon[(i + 1) % polygon.length]!,
      f = sign * cross(a, b, p),
      g = sign * cross(a, b, q),
      delta = g - f;
    if (!delta) {
      if (f < 0) return null;
    } else if (delta > 0) lo = Math.max(lo, -f / delta);
    else hi = Math.min(hi, -f / delta);
    if (lo > hi) return null;
  }
  return [lo, hi] as const;
}
