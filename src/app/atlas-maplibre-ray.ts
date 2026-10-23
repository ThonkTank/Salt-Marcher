import {Matrix4} from '@math.gl/core';
import {atlasMapLibreViewMatrices} from './atlas-maplibre-matrices';
import type {AtlasMapLibreFrame} from './atlas-maplibre-bridge';
import type {AtlasMetricRoot} from './atlas-metric-space';
import type {AtlasMapLibreSceneObject} from './atlas-maplibre-scene-model';

export interface AtlasMapLibreRayHit {
  /** Canonical Atlas world position, with Y increasing down and height in metres. */
  point: {x: number; y: number; heightM: number};
  /** Segment parameter from the near clip plane (0) to the far clip plane (1). */
  clipDistance: number;
}

export interface AtlasMapLibreRayQuery {
  /** The exact Deck-picked object. This function never performs object selection. */
  object: AtlasMapLibreSceneObject;
  /** Captured frame used by the shared MapLibre/Deck view. */
  frame: Pick<AtlasMapLibreFrame, 'projection' | 'mainMatrix' | 'nearZ' | 'farZ'>;
  /** Canvas client-space bounds, matching Deck's PickingInfo.viewport. */
  viewport: Readonly<{x: number; y: number; width: number; height: number}>;
  pixel: Readonly<{x: number; y: number}>;
  root: Readonly<AtlasMetricRoot>;
  sceneOrigin: Readonly<{x: number; y: number}>;
  verticalOriginM: number;
  verticalExaggeration: number;
}

type Vec3 = [number, number, number];
interface Bounds {min: Vec3; max: Vec3}
interface TriangleBounds extends Bounds {triangle: number; center: Vec3}
interface BvhNode extends Bounds {
  left?: BvhNode;
  right?: BvhNode;
  triangles?: readonly number[];
}
interface MeshIndex {
  positions: Float32Array;
  indices: Uint32Array;
  root: BvhNode;
  buildCount: number;
}

const indexes = new WeakMap<AtlasMapLibreSceneObject, MeshIndex>();
const LEAF_SIZE = 8;
const PARALLEL_RELATIVE_EPSILON = Number.EPSILON * 8;
// Deck's matrix multiplication can still leave a few picometres of error at
// exact Float32 mesh vertices. This 10 nm bound is far below author precision.
const AUTHOR_HIT_TOLERANCE_METERS = 1e-8;
const finite = (...values: number[]) => values.every(Number.isFinite);

interface MeshHit {distance: number; point: Vec3}

function makeBounds(): Bounds {
  return {min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]};
}

function includePoint(bounds: Bounds, point: Vec3): void {
  for (let axis = 0; axis < 3; axis++) {
    bounds.min[axis] = Math.min(bounds.min[axis]!, point[axis]!);
    bounds.max[axis] = Math.max(bounds.max[axis]!, point[axis]!);
  }
}

function mergeBounds(target: Bounds, source: Bounds): void {
  includePoint(target, source.min);
  includePoint(target, source.max);
}

function vertex(positions: Float32Array, index: number): Vec3 {
  const offset = index * 3;
  return [positions[offset]!, positions[offset + 1]!, positions[offset + 2]!];
}

function buildIndex(object: AtlasMapLibreSceneObject, previous?: MeshIndex): MeshIndex {
  const {positions, indices} = object;
  if (positions.length % 3 !== 0 || indices.length % 3 !== 0) throw new Error(`Atlas ray mesh ${object.id} has incomplete vertices or triangles`);
  for (const value of positions) if (!Number.isFinite(value)) throw new Error(`Atlas ray mesh ${object.id} contains non-finite vertices`);

  const triangles: TriangleBounds[] = [];
  const vertexCount = positions.length / 3;
  for (let triangle = 0; triangle < indices.length / 3; triangle++) {
    const ids = [indices[triangle * 3]!, indices[triangle * 3 + 1]!, indices[triangle * 3 + 2]!];
    if (ids.some(id => id >= vertexCount)) throw new Error(`Atlas ray mesh ${object.id} has an out-of-range index`);
    const points = ids.map(id => vertex(positions, id));
    const bounds = makeBounds();
    for (const point of points) includePoint(bounds, point);
    triangles.push({
      ...bounds,
      triangle,
      center: [
        (bounds.min[0] + bounds.max[0]) / 2,
        (bounds.min[1] + bounds.max[1]) / 2,
        (bounds.min[2] + bounds.max[2]) / 2
      ]
    });
  }

  const build = (items: TriangleBounds[]): BvhNode => {
    const bounds = makeBounds();
    for (const item of items) mergeBounds(bounds, item);
    if (items.length <= LEAF_SIZE) return {...bounds, triangles: items.map(item => item.triangle)};

    let axis = 0;
    for (let candidate = 1; candidate < 3; candidate++) {
      if (bounds.max[candidate]! - bounds.min[candidate]! > bounds.max[axis]! - bounds.min[axis]!) axis = candidate;
    }
    items.sort((a, b) => a.center[axis]! - b.center[axis]! || a.triangle - b.triangle);
    const middle = Math.floor(items.length / 2);
    return {...bounds, left: build(items.slice(0, middle)), right: build(items.slice(middle))};
  };

  return {
    positions,
    indices,
    root: triangles.length ? build(triangles) : {...makeBounds(), triangles: []},
    buildCount: (previous?.buildCount ?? 0) + 1
  };
}

function getIndex(object: AtlasMapLibreSceneObject): MeshIndex {
  const cached = indexes.get(object);
  if (cached?.positions === object.positions && cached.indices === object.indices) return cached;
  const next = buildIndex(object, cached);
  indexes.set(object, next);
  return next;
}

/** Exposed for deterministic tests and diagnostics; camera frames do not affect this count. */
export function atlasMapLibreRayIndexBuildCount(object: AtlasMapLibreSceneObject): number {
  return indexes.get(object)?.buildCount ?? 0;
}

function unproject(matrix: Matrix4, x: number, y: number, z: number): Vec3 | null {
  const point = matrix.transformPoint([x, y, z]);
  const result: Vec3 = [point[0]!, point[1]!, point[2]!];
  return result.every(Number.isFinite) ? result : null;
}

export interface AtlasMapLibreRaySegmentQuery {
  frame: Pick<AtlasMapLibreFrame, 'projection' | 'mainMatrix' | 'nearZ' | 'farZ'>;
  viewport: Readonly<{x: number; y: number; width: number; height: number}>;
  pixel: Readonly<{x: number; y: number}>;
  root: Readonly<AtlasMetricRoot>;
  sceneOrigin: Readonly<{x: number; y: number}>;
}

/** Unproject one canvas point through the captured shared-camera matrix.
 * The returned segment is clipped to WebGL NDC depth [-1,+1]. */
export function atlasMapLibreRaySegment(query: AtlasMapLibreRaySegmentQuery): readonly [Vec3, Vec3] | null {
  const {frame, viewport, pixel, root, sceneOrigin} = query;
  if (!frame || frame.projection.length !== 16 || !finite(...frame.projection)
    || frame.mainMatrix.length !== 16 || !finite(...frame.mainMatrix)
    || !finite(frame.nearZ, frame.farZ) || frame.nearZ <= 0 || frame.farZ <= frame.nearZ
    || !finite(viewport.x, viewport.y, viewport.width, viewport.height) || viewport.width <= 0 || viewport.height <= 0
    || !finite(pixel.x, pixel.y) || !finite(root.x, root.y, root.size) || root.size <= 0
    || !finite(sceneOrigin.x, sceneOrigin.y)) throw new Error('Invalid Atlas ray segment query');
  if (pixel.x < viewport.x || pixel.x > viewport.x + viewport.width
    || pixel.y < viewport.y || pixel.y > viewport.y + viewport.height) return null;

  // Match AtlasMapLibreView.makeViewport and Deck's Viewport._initMatrices:
  // view = inverse(P) * mainMatrix * T(origin), then clip = P * view.
  // Inverting mainMatrix * T directly is algebraically equal, but skips the
  // float64 rounding in Deck's actual project/pick matrix path. At rotated
  // roof vertices, that difference was enough to move a hit just outside the
  // same Float32 triangle.
  const matrices = atlasMapLibreViewMatrices(frame, root, sceneOrigin);
  if (!matrices) return null;
  const localClip = matrices.projectionMatrix.multiplyRight(matrices.viewMatrix);
  const determinant = localClip.determinant();
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const inverse = localClip.invert();
  if (!Array.from(inverse).every(Number.isFinite)) return null;
  const ndcX = (pixel.x - viewport.x) / viewport.width * 2 - 1;
  const ndcY = 1 - (pixel.y - viewport.y) / viewport.height * 2;
  const start = unproject(inverse, ndcX, ndcY, -1);
  const end = unproject(inverse, ndcX, ndcY, 1);
  if (!start || !end) return null;
  return [start, end];
}

function intersectSegmentBounds(start: Vec3, direction: Vec3, bounds: Bounds, upperLimit: number, tolerance: number): number | null {
  let minimum = 0;
  let maximum = upperLimit;
  for (let axis = 0; axis < 3; axis++) {
    const delta = direction[axis]!;
    if (delta === 0) {
      if (start[axis]! < bounds.min[axis]! - tolerance || start[axis]! > bounds.max[axis]! + tolerance) return null;
      continue;
    }
    let a = (bounds.min[axis]! - tolerance - start[axis]!) / delta;
    let b = (bounds.max[axis]! + tolerance - start[axis]!) / delta;
    if (a > b) [a, b] = [b, a];
    minimum = Math.max(minimum, a);
    maximum = Math.min(maximum, b);
    if (minimum > maximum) return null;
  }
  return minimum;
}

function closestPointOnEdge(point: Vec3, a: Vec3, b: Vec3): Vec3 {
  const edge: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const lengthSquared = edge[0] ** 2 + edge[1] ** 2 + edge[2] ** 2;
  if (lengthSquared === 0) return a;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * edge[0] + (point[1] - a[1]) * edge[1] + (point[2] - a[2]) * edge[2]) / lengthSquared));
  return [a[0] + edge[0] * t, a[1] + edge[1] * t, a[2] + edge[2] * t];
}

function closestPointOnTriangleBoundary(point: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const candidates = [closestPointOnEdge(point, a, b), closestPointOnEdge(point, b, c), closestPointOnEdge(point, c, a)];
  let best = candidates[0]!;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = (candidate[0] - point[0]) ** 2 + (candidate[1] - point[1]) ** 2 + (candidate[2] - point[2]) ** 2;
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  return best;
}

/** Two-sided Möller–Trumbore with a very small mesh-boundary correction.
 * Any corrected point is projected onto this triangle's boundary, never left
 * outside the selected surface. */
function intersectTriangle(start: Vec3, direction: Vec3, a: Vec3, b: Vec3, c: Vec3, tolerance: number): MeshHit | null {
  const edge1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const edge2: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p: Vec3 = [direction[1] * edge2[2] - direction[2] * edge2[1],
    direction[2] * edge2[0] - direction[0] * edge2[2], direction[0] * edge2[1] - direction[1] * edge2[0]];
  const determinant = edge1[0] * p[0] + edge1[1] * p[1] + edge1[2] * p[2];
  const edge1Length = Math.hypot(...edge1), edge2Length = Math.hypot(...edge2), directionLength = Math.hypot(...direction);
  if (Math.abs(determinant) <= PARALLEL_RELATIVE_EPSILON * edge1Length * edge2Length * directionLength) return null;
  const inverse = 1 / determinant;
  const tvec: Vec3 = [start[0] - a[0], start[1] - a[1], start[2] - a[2]];
  const u = (tvec[0] * p[0] + tvec[1] * p[1] + tvec[2] * p[2]) * inverse;
  const q: Vec3 = [tvec[1] * edge1[2] - tvec[2] * edge1[1],
    tvec[2] * edge1[0] - tvec[0] * edge1[2], tvec[0] * edge1[1] - tvec[1] * edge1[0]];
  const v = (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2]) * inverse;
  const distance = (edge2[0] * q[0] + edge2[1] * q[1] + edge2[2] * q[2]) * inverse;
  if (distance < 0 || distance > 1) return null;
  const point: Vec3 = [start[0] + direction[0] * distance, start[1] + direction[1] * distance, start[2] + direction[2] * distance];
  if (u >= 0 && v >= 0 && u + v <= 1) return {distance, point};

  const boundary = closestPointOnTriangleBoundary(point, a, b, c);
  const separation = Math.hypot(point[0] - boundary[0], point[1] - boundary[1], point[2] - boundary[2]);
  return separation <= tolerance ? {distance, point: boundary} : null;
}

function nearestHit(node: BvhNode, start: Vec3, direction: Vec3, mesh: MeshIndex, tolerance: number, best: MeshHit | null): MeshHit | null {
  if (intersectSegmentBounds(start, direction, node, best?.distance ?? 1, tolerance) === null) return best;
  if (node.triangles) {
    for (const triangle of node.triangles) {
      const offset = triangle * 3;
      const a = vertex(mesh.positions, mesh.indices[offset]!);
      const b = vertex(mesh.positions, mesh.indices[offset + 1]!);
      const c = vertex(mesh.positions, mesh.indices[offset + 2]!);
      const hit = intersectTriangle(start, direction, a, b, c, tolerance);
      if (hit && (!best || hit.distance < best.distance)) best = hit;
    }
    return best;
  }

  const upperLimit = best?.distance ?? 1;
  const leftEntry = node.left ? intersectSegmentBounds(start, direction, node.left, upperLimit, tolerance) : null;
  const rightEntry = node.right ? intersectSegmentBounds(start, direction, node.right, upperLimit, tolerance) : null;
  if (leftEntry !== null && rightEntry !== null) {
    if (leftEntry <= rightEntry) {
      best = nearestHit(node.left!, start, direction, mesh, tolerance, best);
      best = nearestHit(node.right!, start, direction, mesh, tolerance, best);
    } else {
      best = nearestHit(node.right!, start, direction, mesh, tolerance, best);
      best = nearestHit(node.left!, start, direction, mesh, tolerance, best);
    }
  } else if (leftEntry !== null) best = nearestHit(node.left!, start, direction, mesh, tolerance, best);
  else if (rightEntry !== null) best = nearestHit(node.right!, start, direction, mesh, tolerance, best);
  return best;
}

/**
 * Refine a Deck-selected mesh hit to the exact intersection with its uploaded
 * Float32 vertex/index buffers. It deliberately cannot select a different
 * object: Deck's shared-depth result remains the sole visibility decision.
 */
export function refineAtlasMapLibreRayHit(query: AtlasMapLibreRayQuery): AtlasMapLibreRayHit | null {
  const {object, frame, viewport, pixel, root, sceneOrigin, verticalOriginM, verticalExaggeration} = query;
  if (!object || !finite(verticalOriginM, verticalExaggeration) || verticalExaggeration <= 0) throw new Error('Invalid Atlas ray query');
  const segment = atlasMapLibreRaySegment({frame, viewport, pixel, root, sceneOrigin});
  if (!segment) return null;
  const [start, end] = segment;
  const direction: Vec3 = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
  if (!direction.every(Number.isFinite) || direction.every(value => value === 0)) return null;

  const mesh = getIndex(object);
  const tolerance = AUTHOR_HIT_TOLERANCE_METERS * Math.min(1, verticalExaggeration) / root.size;
  const hit = nearestHit(mesh.root, start, direction, mesh, tolerance, null);
  if (!hit) return null;
  const localPoint = hit.point;
  const point = {
    x: sceneOrigin.x + localPoint[0] * root.size,
    y: sceneOrigin.y + localPoint[1] * root.size,
    heightM: verticalOriginM + localPoint[2] * root.size / verticalExaggeration
  };
  return Object.values(point).every(Number.isFinite) ? {point, clipDistance: hit.distance} : null;
}
