import { atlasWorldTileBounds, type AtlasWorldTile } from './atlas-world-tiles';
import {
  buildAtlasCanonicalSceneModel,
  type AtlasCanonicalSceneObject,
  type AtlasSceneSelectionTarget,
  type AtlasSceneSurfaceSampler,
  type AtlasSceneView,
} from './atlas-scene-geometry';
import {
  localizeAtlasCanonicalSceneObject,
  type AtlasDeckSceneModel,
} from './atlas-deck-scene-model';

type Vertex3 = [number, number, number];
const tileObjectId = (id: string, tile: AtlasWorldTile) =>
  `${id}@tile:${tile.lod}/${tile.x}/${tile.y}`;

function clipEdge(
  vertices: Vertex3[],
  axis: 0 | 1,
  bound: number,
  keepGreater: boolean,
): Vertex3[] {
  if (!vertices.length) return [];
  const output: Vertex3[] = [];
  const inside = (p: Vertex3) => (keepGreater ? p[axis] >= bound : p[axis] <= bound);
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!,
      b = vertices[(i + 1) % vertices.length]!,
      ai = inside(a),
      bi = inside(b);
    if (ai) output.push(a);
    if (ai !== bi) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      const intersection: Vertex3 = [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
      intersection[axis] = bound;
      output.push(intersection);
    }
  }
  return output;
}

function triangleAreaSquared(a: Vertex3, b: Vertex3, c: Vertex3): number {
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2],
    vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  const x = uy * vz - uz * vy,
    y = uz * vx - ux * vz,
    z = ux * vy - uy * vx;
  return x * x + y * y + z * z;
}

function clipObject(
  object: AtlasCanonicalSceneObject,
  tile: AtlasWorldTile,
): AtlasCanonicalSceneObject | null {
  const bounds = atlasWorldTileBounds(tile),
    positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i < object.indices.length; i += 3) {
    const triangle = [object.indices[i]!, object.indices[i + 1]!, object.indices[i + 2]!].map(
      (index) =>
        [
          object.positions[index * 3]!,
          object.positions[index * 3 + 1]!,
          object.positions[index * 3 + 2]!,
        ] as Vertex3,
    );
    // The atlas tile grid is half-open. A vertical face lying on a tile's max
    // edge is owned by the adjacent tile whose min edge is the same coordinate.
    if (triangle.every((p) => p[0] === bounds.maxX) || triangle.every((p) => p[1] === bounds.maxY))
      continue;
    let polygon = clipEdge(triangle, 0, bounds.minX, true);
    polygon = clipEdge(polygon, 0, bounds.maxX, false);
    polygon = clipEdge(polygon, 1, bounds.minY, true);
    polygon = clipEdge(polygon, 1, bounds.maxY, false);
    if (polygon.length < 3) continue;
    const base = positions.length / 3;
    for (const p of polygon) positions.push(...p);
    // Keep vertical walls whose XY projection is a line; only 3D-degenerate
    // triangles are removed.
    for (let j = 1; j + 1 < polygon.length; j++)
      if (triangleAreaSquared(polygon[0]!, polygon[j]!, polygon[j + 1]!) > 0)
        indices.push(base, base + j, base + j + 1);
  }
  if (!indices.length) return null;
  return {
    id: tileObjectId(object.id, tile),
    target: object.target,
    positions: new Float64Array(positions),
    indices: new Uint32Array(indices),
  };
}

/** Build display-independent room and building geometry for a stable world tile.
 * The input surface sampler must cover every anchor and footprint vertex visited. */
export function buildAtlasGeometryMesh(
  view: AtlasSceneView,
  tile: AtlasWorldTile,
  surface: AtlasSceneSurfaceSampler,
): AtlasDeckSceneModel {
  if (
    !view ||
    !surface ||
    typeof surface.contains !== 'function' ||
    typeof surface.heightAt !== 'function'
  )
    throw new Error('Atlas geometry tile inputs are invalid');
  const canonical = buildAtlasCanonicalSceneModel({ view, terrain: null, surface });
  const objects: AtlasCanonicalSceneObject[] = [],
    targets = new Map<string, AtlasSceneSelectionTarget>();
  for (const object of canonical.objects) {
    if (object.target.kind === 'terrain') continue;
    const clipped = clipObject(object, tile);
    if (!clipped) continue;
    if (targets.has(clipped.id))
      throw new Error(`Duplicate Atlas geometry tile target: ${clipped.id}`);
    targets.set(clipped.id, clipped.target);
    objects.push(clipped);
  }
  return Object.freeze({
    objects: Object.freeze(objects.map(localizeAtlasCanonicalSceneObject)),
    targets,
    coverage: Object.freeze({
      complete: canonical.coverage.complete,
      supportedKinds: canonical.coverage.supportedKinds,
      unsupported: Object.freeze(
        canonical.coverage.unsupported.map((item) => Object.freeze({ ...item })),
      ),
    }),
    verticalExaggeration: 1,
  });
}
