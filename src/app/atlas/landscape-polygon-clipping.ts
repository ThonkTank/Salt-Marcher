import ClipperLib from 'clipper-lib';
import type { Point, Polygon } from '../shared/contracts';
import { segmentDistance } from './atlas-landscape';

/** Keep the centreline within 1/1024 of the brush radius. Coalesced pointer
 * samples on almost straight segments must not multiply clipping work.
 */
function brushPath(points: Point[], radius: number): Point[] {
  const keep = new Set([0, points.length - 1]),
    pending: Array<[number, number]> = [[0, points.length - 1]];
  while (pending.length) {
    const [first, last] = pending.pop()!;
    let furthest = -1,
      distance = radius / 1024;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i]!, points[first]!, points[last]!);
      if (d > distance) {
        distance = d;
        furthest = i;
      }
    }
    if (furthest >= 0) {
      keep.add(furthest);
      pending.push([first, furthest], [furthest, last]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]!);
}

function polygonsFromTree(
  tree: ClipperLib.PolyTree,
  point: (p: ClipperLib.IntPoint) => Point,
): Polygon[] {
  const result: Polygon[] = [];
  const visit = (node: ClipperLib.PolyNode) => {
    if (!node.IsHole())
      result.push({
        outer: node.Contour().map(point),
        holes: node
          .Childs()
          .filter((child) => child.IsHole())
          .map((child) => child.Contour().map(point)),
      });
    node.Childs().forEach(visit);
  };
  tree.Childs().forEach(visit);
  return result;
}

/** Offset the sampled centreline directly instead of unioning a circle per point. */
export function roundBrushPolygons(points: Point[], radius: number): Polygon[] {
  points = brushPath(points, radius);
  const origin = points[0]!;
  let extent = radius;
  for (const p of points)
    extent = Math.max(extent, Math.abs(p.x - origin.x) + radius, Math.abs(p.y - origin.y) + radius);
  if (!Number.isFinite(extent)) throw Error('Pinselzug zu groß.');
  const scale = Math.min(100000, 2 ** 50 / extent);
  const path = points.map((p) => ({
    X: Math.round((p.x - origin.x) * scale),
    Y: Math.round((p.y - origin.y) * scale),
  }));
  // Match the previous 24-segment circle's maximum radial approximation error.
  const engine = new ClipperLib.ClipperOffset(2, radius * scale * (1 - Math.cos(Math.PI / 12))),
    tree = new ClipperLib.PolyTree();
  engine.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  engine.Execute(tree, radius * scale);
  return polygonsFromTree(tree, ({ X, Y }) => ({
    x: X / scale + origin.x,
    y: Y / scale + origin.y,
  }));
}

/** Author brush geometry: local integer coordinates keep tiny intersections stable.
 * 10 micrometres at ordinary world scales; exceptionally large extents reduce
 * precision to stay below 2^50, well inside Clipper's integer range.
 */
export function clipLandscapePolygons(
  operation: 'union' | 'difference' | 'intersection',
  subject: Polygon[],
  clip: Polygon[] = [],
): Polygon[] {
  if (!subject.length) return [];
  const origin = subject[0]!.outer[0]!;
  let extent = 1;
  for (const p of [...subject, ...clip])
    for (const ring of [p.outer, ...p.holes])
      for (const v of ring) {
        if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) throw Error('Polygonpunkte prüfen.');
        extent = Math.max(extent, Math.abs(v.x - origin.x), Math.abs(v.y - origin.y));
      }
  if (!Number.isFinite(extent)) throw Error('Polygonfläche zu groß.');
  const scale = Math.min(100000, 2 ** 50 / extent);
  const paths = (polygons: Polygon[]) =>
    polygons.flatMap((p) =>
      [p.outer, ...p.holes].map((ring, index) => {
        const path = ring.map((v) => ({
          X: Math.round((v.x - origin.x) * scale),
          Y: Math.round((v.y - origin.y) * scale),
        }));
        if (ClipperLib.Clipper.Orientation(path) !== (index === 0)) path.reverse();
        return path;
      }),
    );
  const engine = new ClipperLib.Clipper(),
    tree = new ClipperLib.PolyTree();
  engine.AddPaths(paths(subject), ClipperLib.PolyType.ptSubject, true);
  if (clip.length) engine.AddPaths(paths(clip), ClipperLib.PolyType.ptClip, true);
  const kind = {
    union: ClipperLib.ClipType.ctUnion,
    difference: ClipperLib.ClipType.ctDifference,
    intersection: ClipperLib.ClipType.ctIntersection,
  }[operation];
  if (
    !engine.Execute(
      kind,
      tree,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero,
    )
  )
    throw Error('Pinselfläche konnte nicht berechnet werden.');
  return polygonsFromTree(tree, ({ X, Y }) => ({
    x: X / scale + origin.x,
    y: Y / scale + origin.y,
  }));
}
