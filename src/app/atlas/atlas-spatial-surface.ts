import * as THREE from 'three';
import type { Point } from '../contracts';

export interface AtlasSpatialSurface {
  /** Output sampling density for text textures; live scenes use a bounded glyph atlas. */
  textPixelsPerMeter?: number;
  displayMpp?: number;
  routes?: ReadonlyMap<string, import('./atlas-landscape').LandscapeRecord>;
  objectHeights?: ReadonlyMap<string, number>;
  scopeBases?: ReadonlyMap<string, number>;
  origin: Point;
  focusM: number;
  exaggeration: number;
  height: (point: Point) => number;
  /** Maximum world edge length for draped vector triangles. */
  segment: number;
  /** Loaded terrain coverage, including the camera margin. */
  bounds?: import('./atlas-landscape').LandscapeBox;
}

/** Refine local vector triangles against the shared terrain without changing source geometry.
 * Consumes the temporary input geometry and returns an independently owned GPU buffer. */
export function drapeAtlasGeometry(
  input: THREE.BufferGeometry,
  world: (x: number, y: number) => Point,
  position: (point: Point) => THREE.Vector3,
  surface: AtlasSpatialSurface,
) {
  const raw = input.index ? input.toNonIndexed() : input,
    vertices = raw.getAttribute('position'),
    uv = raw.getAttribute('uv');
  const output: number[] = [],
    texcoords: number[] = [];
  type Vertex = { p: Point; u: number; v: number };
  const at = (i: number): Vertex => ({
    p: world(vertices.getX(i), vertices.getY(i)),
    u: uv?.getX(i) ?? 0,
    v: uv?.getY(i) ?? 0,
  });
  const midpoint = (a: Vertex, b: Vertex): Vertex => ({
    p: { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 },
    u: (a.u + b.u) / 2,
    v: (a.v + b.v) / 2,
  });
  const triangle = (a: Vertex, b: Vertex, d: Vertex, depth: number) => {
    const lengths = [
      Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y),
      Math.hypot(b.p.x - d.p.x, b.p.y - d.p.y),
      Math.hypot(d.p.x - a.p.x, d.p.y - a.p.y),
    ];
    if (depth < 8 && Math.max(...lengths) > surface.segment) {
      const edge = lengths.indexOf(Math.max(...lengths));
      if (edge === 0) {
        const mid = midpoint(a, b);
        triangle(a, mid, d, depth + 1);
        triangle(mid, b, d, depth + 1);
      } else if (edge === 1) {
        const mid = midpoint(b, d);
        triangle(a, b, mid, depth + 1);
        triangle(a, mid, d, depth + 1);
      } else {
        const mid = midpoint(d, a);
        triangle(a, b, mid, depth + 1);
        triangle(mid, b, d, depth + 1);
      }
      return;
    }
    for (const v of [a, b, d]) {
      const p = position(v.p);
      output.push(p.x, p.y, p.z);
      texcoords.push(v.u, v.v);
    }
  };
  for (let i = 0; i < vertices.count; i += 3) triangle(at(i), at(i + 1), at(i + 2), 0);
  if (raw !== input) raw.dispose();
  input.dispose();
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(output, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(texcoords, 2));
  return result;
}
