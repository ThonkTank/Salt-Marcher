import * as THREE from 'three';
import type { AtlasDrawingMesh } from './atlas-drawing-mesh';
import type { TerrainObject } from './terrain-objects';

/** Room-derived footprints retain disconnected components and courtyard holes.
 * Floors are horizontal; only the foundation's lower edge follows the ground. */
export function atlasObjectGeometry(
  object: TerrainObject,
  origin: { x: number; y: number; z: number },
  exaggeration: number,
) {
  const meshes: AtlasDrawingMesh[] = [];
  if (object.closed === false || object.kind !== 'building') return meshes;
  const add = (vertices: number[], color: string) => {
    if (!vertices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const normal = geometry.getAttribute('normal'),
      base = new THREE.Color(color),
      colors: number[] = [];
    for (let i = 0; i < normal.count; i++) {
      const shade =
        0.68 + 0.32 * Math.abs(normal.getX(i) * 0.5 + normal.getY(i) * 0.4 + normal.getZ(i) * 0.76);
      colors.push(base.r * shade, base.g * shade, base.b * shade);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const positions = Float32Array.from(vertices);
    for (let i = 1; i < positions.length; i += 3) positions[i] = -positions[i]!;
    const displayColors = Float32Array.from(colors, (v) =>
      v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055,
    );
    meshes.push({
      positions,
      indices: Uint32Array.from({ length: positions.length / 3 }, (_, i) => i),
      colors: displayColors,
      color: [255, 255, 255, 255],
      target: {
        atlasObject: 'true',
        id: object.id,
        kind: object.kind,
        ...(object.cityId ? { cityId: object.cityId } : {}),
        ...(object.roomId ? { roomId: object.roomId } : {}),
      },
      solid: true,
    });
    geometry.dispose();
  };
  for (const [part, polygon] of (
    object.footprint ?? [{ outer: object.outline, holes: [] }]
  ).entries()) {
    const rings = [polygon.outer, ...polygon.holes];
    if (polygon.outer.length < 3) continue;
    const at = (ring: number, i: number, z: number) => {
      const p = rings[ring]![i]!;
      return [p.x - origin.x, origin.y - p.y, (z - origin.z) * exaggeration];
    };
    const walls: number[] = [],
      foundation: number[] = [],
      roof: number[] = [];
    const quad = (out: number[], a: number[], b: number[], c: number[], d: number[]) =>
      out.push(...a, ...b, ...c, ...c, ...b, ...d);
    for (const [r, ring] of rings.entries())
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length,
          a = at(r, i, object.baseM),
          b = at(r, j, object.baseM);
        quad(walls, a, b, at(r, i, object.topM), at(r, j, object.topM));
        const ground = object.footprintGroundM?.[part]?.[r] ?? object.groundM;
        quad(
          foundation,
          at(r, i, Math.min(object.baseM, ground[i] ?? object.baseM)),
          at(r, j, Math.min(object.baseM, ground[j] ?? object.baseM)),
          a,
          b,
        );
      }
    const shape = rings.map((r) => r.map((p) => new THREE.Vector2(p.x - origin.x, origin.y - p.y))),
      outer = shape[0]!;
    let sign = 0,
      convex = rings.length === 1;
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i]!,
        b = outer[(i + 1) % outer.length]!,
        c = outer[(i + 2) % outer.length]!,
        cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 1e-8) continue;
      if (sign && sign * Math.sign(cross) < 0) convex = false;
      sign = Math.sign(cross);
    }
    if (convex && object.roofM > 0) {
      const centre = [
        outer.reduce((sum, p) => sum + p.x, 0) / outer.length,
        outer.reduce((sum, p) => sum + p.y, 0) / outer.length,
        (object.topM + object.roofM - origin.z) * exaggeration,
      ];
      for (let i = 0; i < outer.length; i++)
        roof.push(
          ...at(0, i, object.topM),
          ...at(0, (i + 1) % outer.length, object.topM),
          ...centre,
        );
    } else {
      const points = shape.flat();
      for (const triangle of THREE.ShapeUtils.triangulateShape(outer, shape.slice(1)))
        for (const i of triangle) {
          const p = points[i]!;
          roof.push(p.x, p.y, (object.topM + object.roofM - origin.z) * exaggeration);
        }
      if (object.roofM > 0)
        for (const [r, ring] of rings.entries())
          for (let i = 0; i < ring.length; i++) {
            const j = (i + 1) % ring.length;
            quad(
              roof,
              at(r, i, object.topM),
              at(r, j, object.topM),
              at(r, i, object.topM + object.roofM),
              at(r, j, object.topM + object.roofM),
            );
          }
    }
    add(foundation, '#857c67');
    add(walls, '#d9c9ac');
    add(roof, object.color);
  }
  return meshes;
}

/** Cache canonical footprint buffers and the corresponding floor/roof anchors. */
export class AtlasObjectGeometry {
  readonly closedIds = new Set<string>();
  readonly heights = new Map<string, number>();
  readonly scopeBases = new Map<string, number>();
  private entries = new Map<string, { key: string; meshes: AtlasDrawingMesh[] }>();
  get meshes() {
    return [...this.entries.values()].flatMap((e) => e.meshes);
  }
  update(
    objects: TerrainObject[],
    origin: { x: number; y: number; z: number },
    exaggeration: number,
  ) {
    this.heights.clear();
    this.scopeBases.clear();
    this.closedIds.clear();
    for (const o of objects) {
      if (o.closed !== false) {
        this.heights.set(o.id, o.topM + o.roofM);
        this.closedIds.add(o.id);
      }
      if (o.scopeId) this.scopeBases.set(o.scopeId, o.baseM);
    }
    for (const id of this.entries.keys()) if (!this.closedIds.has(id)) this.entries.delete(id);
    for (const o of objects) {
      if (o.closed === false) continue;
      const key = JSON.stringify([o, origin, exaggeration]);
      if (this.entries.get(o.id)?.key !== key)
        this.entries.set(o.id, { key, meshes: atlasObjectGeometry(o, origin, exaggeration) });
    }
  }
  dispose() {
    this.entries.clear();
    this.heights.clear();
    this.scopeBases.clear();
    this.closedIds.clear();
  }
}
