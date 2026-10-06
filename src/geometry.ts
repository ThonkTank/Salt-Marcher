import {
  type Boundary,
  type BoundaryAnchor,
  type Building,
  type Door,
  type Entity,
  type MapObject,
  type MapPath,
  type Point,
  type Polygon,
  type Room,
} from "./model";

export function objectPoints(object: MapObject): Point[] {
  const c = Math.cos(object.rotation),
    s = Math.sin(object.rotation),
    halfWidth = object.width / 2,
    halfHeight = object.height / 2;
  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((point) => ({
    x: object.x + point.x * c - point.y * s,
    y: object.y + point.x * s + point.y * c,
  }));
}

export function rectangle(a: Point, b: Point): Point[] {
  return [
    { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
    { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
    { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
    { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
  ];
}
export function ellipse(a: Point, b: Point, count = 32): Point[] {
  const cx = (a.x + b.x) / 2,
    cy = (a.y + b.y) / 2,
    rx = Math.abs(a.x - b.x) / 2,
    ry = Math.abs(a.y - b.y) / 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}
export interface BuildingCurve {
  readonly index: number;
  readonly handle: Point;
}

/** Expand Shift-dragged polygon vertices into the sampled contour stored by Building Tool. */
export function buildingPolygonPoints(
  vertices: readonly Point[],
  curves: readonly BuildingCurve[],
  closed = false,
): Point[] {
  if (!vertices.length || !curves.length) return [...vertices];
  const byIndex = new Map(curves.map((curve) => [curve.index, curve.handle]));
  const result: Point[] = [vertices[0]!];
  for (let index = 1; index < vertices.length; index++) {
    const handle = byIndex.get(index);
    // After a Shift curve, the following click controls its bend. It becomes a
    // contour vertex only if the polygon is closed at that point.
    if (!handle && byIndex.has(index - 1) && index + 1 < vertices.length)
      continue;
    const start = result[result.length - 1]!,
      end = vertices[index]!;
    if (!handle) {
      result.push(end);
      continue;
    }
    if (Math.hypot(end.x - start.x, end.y - start.y) < 1e-6) {
      result.push(end);
      continue;
    }
    const next = vertices[index + 1] ?? (closed ? vertices[0]! : handle),
      bend = {
        x: end.x + 0.553 * (next.x - end.x),
        y: end.y + 0.553 * (next.y - end.y),
      },
      first = {
        x: bend.x - 0.45 * (end.x - start.x),
        y: bend.y - 0.45 * (end.y - start.y),
      };
    // Dungeondraft's saved contour has sixteen midpoint samples before the vertex.
    for (let step = 0; step < 16; step++) {
      const t = (step + 0.5) / 16,
        u = 1 - t;
      result.push({
        x: u ** 3 * start.x + 3 * u ** 2 * t * first.x +
          3 * u * t ** 2 * bend.x + t ** 3 * end.x,
        y: u ** 3 * start.y + 3 * u ** 2 * t * first.y +
          3 * u * t ** 2 * bend.y + t ** 3 * end.y,
      });
    }
    result.push(end);
  }
  return result;
}
export function inside(point: Point, points: readonly Point[]): boolean {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      result = !result;
  }
  return result;
}

function catmull(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const t2 = t * t,
    t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * b.x +
        (-a.x + c.x) * t +
        (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 +
        (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
    y:
      0.5 *
      (2 * b.y +
        (-a.y + c.y) * t +
        (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 +
        (-a.y + 3 * b.y - 3 * c.y + d.y) * t3),
  };
}
export function smoothPath(
  points: readonly Point[],
  closed: boolean,
  steps = 8,
): Point[] {
  if (points.length < 3) return [...points];
  const result: Point[] = [],
    segments = closed ? points.length : points.length - 1,
    at = (index: number) => {
      if (closed) return points[(index + points.length) % points.length]!;
      return points[Math.max(0, Math.min(points.length - 1, index))]!;
    };
  for (let i = 0; i < segments; i++)
    for (let step = 0; step < steps; step++)
      result.push(
        catmull(at(i - 1), at(i), at(i + 1), at(i + 2), step / steps),
      );
  if (!closed) result.push(points.at(-1)!);
  return result;
}
export function boundaryPoints(boundary: Boundary): readonly Point[] {
  return boundaryContours(boundary)[0] ?? [];
}
export interface BuildingContourEntry {
  readonly contour: number;
  readonly polygon: number;
  readonly hole?: number;
  readonly points: readonly Point[];
}
export function buildingContourEntries(
  building: Building,
): readonly BuildingContourEntry[] {
  let contour = 0;
  return building.polygons.flatMap((polygon, polygonIndex) => [
    {
      contour: contour++,
      polygon: polygonIndex,
      points: polygon.outer,
    },
    ...polygon.holes.map((points, hole) => ({
      contour: contour++,
      polygon: polygonIndex,
      hole,
      points,
    })),
  ]);
}
export function replaceBuildingContour(
  building: Building,
  contour: number,
  points: readonly Point[],
): Building {
  const entry = buildingContourEntries(building)[contour];
  if (!entry) throw new Error("Unbekannte Gebäudekontur.");
  return {
    ...building,
    polygons: building.polygons.map((polygon, polygonIndex) => {
      if (polygonIndex !== entry.polygon) return polygon;
      if (entry.hole === undefined) return { ...polygon, outer: points };
      return {
        ...polygon,
        holes: polygon.holes.map((hole, holeIndex) =>
          holeIndex === entry.hole ? points : hole,
        ),
      };
    }),
  };
}
const topologyEpsilon = 1e-9;
function sameTopologyPoint(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= topologyEpsilon;
}
function topologyOrientation(a: Point, b: Point, c: Point): number {
  const left = (b.x - a.x) * (c.y - a.y),
    right = (b.y - a.y) * (c.x - a.x),
    value = left - right,
    tolerance = topologyEpsilon * Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(value) <= tolerance ? 0 : Math.sign(value);
}
function topologyPointOnSegment(point: Point, a: Point, b: Point): boolean {
  return (
    topologyOrientation(a, b, point) === 0 &&
    point.x >= Math.min(a.x, b.x) - topologyEpsilon &&
    point.x <= Math.max(a.x, b.x) + topologyEpsilon &&
    point.y >= Math.min(a.y, b.y) - topologyEpsilon &&
    point.y <= Math.max(a.y, b.y) + topologyEpsilon
  );
}
function topologySegmentsMeet(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = topologyOrientation(a, b, c),
    abD = topologyOrientation(a, b, d),
    cdA = topologyOrientation(c, d, a),
    cdB = topologyOrientation(c, d, b);
  return (
    (abC * abD < 0 && cdA * cdB < 0) ||
    (abC === 0 && topologyPointOnSegment(c, a, b)) ||
    (abD === 0 && topologyPointOnSegment(d, a, b)) ||
    (cdA === 0 && topologyPointOnSegment(a, c, d)) ||
    (cdB === 0 && topologyPointOnSegment(b, c, d))
  );
}
function topologyRingsMeet(
  first: readonly Point[],
  second: readonly Point[],
): boolean {
  for (let a = 0; a < first.length; a++)
    for (let b = 0; b < second.length; b++)
      if (
        topologySegmentsMeet(
          first[a]!,
          first[(a + 1) % first.length]!,
          second[b]!,
          second[(b + 1) % second.length]!,
        )
      )
        return true;
  return false;
}
function topologyPointInRing(
  point: Point,
  ring: readonly Point[],
): "inside" | "outside" | "boundary" {
  for (let index = 0; index < ring.length; index++)
    if (
      topologyPointOnSegment(
        point,
        ring[index]!,
        ring[(index + 1) % ring.length]!,
      )
    )
      return "boundary";
  let insideRing = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index]!,
      b = ring[previous]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      insideRing = !insideRing;
  }
  return insideRing ? "inside" : "outside";
}
function assertSimpleTopologyRing(ring: readonly Point[]): void {
  for (let first = 0; first < ring.length; first++) {
    const a = ring[first]!,
      b = ring[(first + 1) % ring.length]!;
    if (sameTopologyPoint(a, b))
      throw new Error("Ungültige Gebäudetopologie: Nullsegment.");
    for (let second = first + 1; second < ring.length; second++)
      if (sameTopologyPoint(a, ring[second]!))
        throw new Error("Ungültige Gebäudetopologie: doppelter Ringpunkt.");
  }
  for (let first = 0; first < ring.length; first++)
    for (let second = first + 1; second < ring.length; second++) {
      const adjacent =
        second === first + 1 ||
        (first === 0 && second === ring.length - 1);
      if (adjacent) continue;
      if (
        topologySegmentsMeet(
          ring[first]!,
          ring[(first + 1) % ring.length]!,
          ring[second]!,
          ring[(second + 1) % ring.length]!,
        )
      )
        throw new Error("Ungültige Gebäudetopologie: Selbstschnitt.");
    }
  for (let index = 0; index < ring.length; index++) {
    const previous = ring[(index - 1 + ring.length) % ring.length]!,
      point = ring[index]!,
      next = ring[(index + 1) % ring.length]!,
      incoming = { x: point.x - previous.x, y: point.y - previous.y },
      outgoing = { x: next.x - point.x, y: next.y - point.y };
    if (
      topologyOrientation(previous, point, next) === 0 &&
      incoming.x * outgoing.x + incoming.y * outgoing.y < 0
    )
      throw new Error("Ungültige Gebäudetopologie: überlappende Kanten.");
  }
}
function topologyPointInPolygon(point: Point, polygon: Polygon): boolean {
  if (topologyPointInRing(point, polygon.outer) !== "inside") return false;
  return polygon.holes.every(
    (hole) => topologyPointInRing(point, hole) === "outside",
  );
}
export function assertBuildingTopology(polygons: readonly Polygon[]): void {
  for (const polygon of polygons) {
    assertSimpleTopologyRing(polygon.outer);
    for (const hole of polygon.holes) {
      assertSimpleTopologyRing(hole);
      if (
        topologyRingsMeet(polygon.outer, hole) ||
        hole.some(
          (point) => topologyPointInRing(point, polygon.outer) !== "inside",
        )
      )
        throw new Error(
          "Ungültige Gebäudetopologie: Innenkontur liegt nicht strikt im Außenring.",
        );
    }
    for (let first = 0; first < polygon.holes.length; first++)
      for (let second = first + 1; second < polygon.holes.length; second++) {
        const a = polygon.holes[first]!,
          b = polygon.holes[second]!;
        if (
          topologyRingsMeet(a, b) ||
          topologyPointInRing(a[0]!, b) !== "outside" ||
          topologyPointInRing(b[0]!, a) !== "outside"
        )
          throw new Error(
            "Ungültige Gebäudetopologie: Innenkonturen schneiden oder überlappen sich.",
          );
      }
  }
  for (let first = 0; first < polygons.length; first++)
    for (let second = first + 1; second < polygons.length; second++) {
      const a = polygons[first]!,
        b = polygons[second]!,
        aRings = [a.outer, ...a.holes],
        bRings = [b.outer, ...b.holes];
      if (
        aRings.some((aRing) =>
          bRings.some((bRing) => topologyRingsMeet(aRing, bRing)),
        ) ||
        topologyPointInPolygon(a.outer[0]!, b) ||
        topologyPointInPolygon(b.outer[0]!, a)
      )
        throw new Error(
          "Ungültige Gebäudetopologie: Polygonteile schneiden oder überlappen sich.",
        );
    }
}
export function boundaryContours(
  boundary: Boundary,
): readonly (readonly Point[])[] {
  if (boundary.kind === "building")
    return buildingContourEntries(boundary).map((entry) => entry.points);
  return [
    boundary.smooth
      ? smoothPath(boundary.points, boundary.closed)
      : boundary.points,
  ];
}
export function pathPoints(path: MapPath): readonly Point[] {
  return path.smooth ? smoothPath(path.points, path.closed) : path.points;
}
function segmentsOf(points: readonly Point[], closed: boolean) {
  const count = closed ? points.length : points.length - 1;
  let start = 0;
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const a = points[index]!,
      b = points[(index + 1) % points.length]!,
      length = Math.hypot(b.x - a.x, b.y - a.y),
      result = { a, b, length, start };
    start += length;
    return result;
  });
}
export function nearestBuildingVertex(
  point: Point,
  building: Building,
): { contour: number; index: number; distance: number } {
  let best = { contour: 0, index: 0, distance: Infinity };
  for (const entry of buildingContourEntries(building))
    for (const [index, candidate] of entry.points.entries()) {
      const distance = Math.hypot(
        point.x - candidate.x,
        point.y - candidate.y,
      );
      if (distance < best.distance)
        best = { contour: entry.contour, index, distance };
    }
  return best;
}
export function nearestBuildingSegment(
  point: Point,
  building: Building,
): { contour: number; index: number; distance: number } {
  let best = { contour: 0, index: 0, distance: Infinity };
  for (const entry of buildingContourEntries(building)) {
    const segments = segmentsOf(entry.points, true);
    for (const [index, segment] of segments.entries()) {
      const dx = segment.b.x - segment.a.x,
        dy = segment.b.y - segment.a.y,
        t = Math.max(
          0,
          Math.min(
            1,
            ((point.x - segment.a.x) * dx +
              (point.y - segment.a.y) * dy) /
              (dx * dx + dy * dy || 1),
          ),
        ),
        distance = Math.hypot(
          point.x - segment.a.x - dx * t,
          point.y - segment.a.y - dy * t,
        );
      if (distance < best.distance)
        best = { contour: entry.contour, index, distance };
    }
  }
  return best;
}
export function nearestBoundary(
  point: Point,
  boundary: Boundary,
): { contour: number; at: number; distance: number } {
  let best = { contour: 0, at: 0, distance: Infinity };
  for (const [contour, points] of boundaryContours(boundary).entries()) {
    const segments = segmentsOf(
        points,
        boundary.kind === "building" || boundary.closed,
      ),
      total = segments.reduce((sum, segment) => sum + segment.length, 0);
    for (const segment of segments) {
      const dx = segment.b.x - segment.a.x,
        dy = segment.b.y - segment.a.y,
        t = Math.max(
          0,
          Math.min(
            1,
            ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) /
              (dx * dx + dy * dy || 1),
          ),
        ),
        distance = Math.hypot(
          point.x - segment.a.x - t * dx,
          point.y - segment.a.y - t * dy,
        );
      if (distance < best.distance)
        best = {
          contour,
          at: (segment.start + t * segment.length) / (total || 1),
          distance,
        };
    }
  }
  return best;
}
export function nearestPath(
  point: Point,
  path: MapPath,
): { at: number; distance: number } {
  const points = pathPoints(path),
    segments = segmentsOf(points, path.closed),
    total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let best = { at: 0, distance: Infinity };
  for (const segment of segments) {
    const dx = segment.b.x - segment.a.x,
      dy = segment.b.y - segment.a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      ),
      distance = Math.hypot(
        point.x - segment.a.x - t * dx,
        point.y - segment.a.y - t * dy,
      );
    if (distance < best.distance)
      best = {
        at: (segment.start + t * segment.length) / (total || 1),
        distance,
      };
  }
  return best;
}
export function nearestEdge(
  point: Point,
  room: Room,
): { edge: number; t: number; distance: number } {
  let best = { edge: 0, t: 0, distance: Infinity };
  const points = room.polygons[0]!.outer;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!,
      dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      ),
      distance = Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
    if (distance < best.distance) best = { edge: i, t, distance };
  }
  return best;
}

export function alignedPortalAt(
  point: Point,
  boundary: Boundary,
  paths: readonly MapPath[],
  width: number,
  snapDistance = 0.5,
): Omit<BoundaryAnchor, "boundaryId"> {
  const nearest = nearestBoundary(point, boundary);
  let best:
    | { contour: number; at: number; distance: number }
    | undefined;
  for (const path of paths) {
    if (
      path.floorId !== boundary.floorId ||
      Math.abs(path.width - width) > 1e-6 ||
      !path.points.length
    )
      continue;
    const endpoints = path.closed
      ? []
      : [path.points[0]!, path.points[path.points.length - 1]!];
    for (const endpoint of endpoints) {
      const anchor = nearestBoundary(endpoint, boundary);
      if (anchor.distance > 1e-4) continue;
      const distance = Math.hypot(point.x - endpoint.x, point.y - endpoint.y);
      if (distance <= snapDistance && (!best || distance < best.distance))
        best = { contour: anchor.contour, at: anchor.at, distance };
    }
  }
  return best
    ? { contour: best.contour, at: best.at }
    : { contour: nearest.contour, at: nearest.at };
}
export function edgeAt(
  room: Room,
  edge: number,
  t: number,
): Omit<BoundaryAnchor, "boundaryId"> {
  const segments = segmentsOf(room.polygons[0]!.outer, true),
    total = segments.reduce((sum, segment) => sum + segment.length, 0),
    segment = segments[edge];
  if (!segment) throw new Error("Ungültige Wandkante.");
  return {
    contour: 0,
    at: (segment.start + segment.length * t) / (total || 1),
  };
}
function boundaryPoseAt(
  boundary: Boundary,
  contour: number,
  at: number,
  offset = 0,
): { x: number; y: number; angle: number } | undefined {
  const points = boundaryContours(boundary)[contour];
  if (!points) return undefined;
  const closed = boundary.kind === "building" || boundary.closed,
    segments = segmentsOf(points, closed),
    total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (!segments.length || total <= 0) return undefined;
  let distance = at * total + offset;
  if (closed) distance = ((distance % total) + total) % total;
  else distance = Math.min(total, Math.max(0, distance));
  const segment =
      segments.find(
        (candidate) => candidate.start + candidate.length >= distance,
      ) ?? segments.at(-1)!,
    t = (distance - segment.start) / (segment.length || 1);
  return {
    x: segment.a.x + (segment.b.x - segment.a.x) * t,
    y: segment.a.y + (segment.b.y - segment.a.y) * t,
    angle: Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x),
  };
}
export function portalPose(
  door: Door,
  get: (id: string) => Entity | undefined,
): { x: number; y: number; angle: number } {
  if (!door.anchor)
    return { x: door.x!, y: door.y!, angle: door.rotation ?? 0 };
  const boundary = get(door.anchor.boundaryId);
  if (boundary?.kind !== "building" && boundary?.kind !== "wall")
    return { x: 0, y: 0, angle: 0 };
  return (
    boundaryPoseAt(boundary, door.anchor.contour, door.anchor.at) ??
    { x: 0, y: 0, angle: 0 }
  );
}
export type BuildingContourEdit =
  | { readonly kind: "move"; readonly contour: number; readonly index: number }
  | { readonly kind: "insert"; readonly contour: number; readonly index: number }
  | { readonly kind: "remove"; readonly contour: number; readonly index: number };
function segmentPositionAt(
  points: readonly Point[],
  at: number,
): { index: number; t: number; point: Point } | undefined {
  const segments = segmentsOf(points, true),
    total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (!segments.length || total <= 0) return undefined;
  const distance = Math.min(total, Math.max(0, at * total)),
    index = Math.max(
      0,
      segments.findIndex(
        (segment) => segment.start + segment.length >= distance,
      ),
    ),
    segment = segments[index] ?? segments.at(-1)!;
  const t = Math.min(
    1,
    Math.max(0, (distance - segment.start) / (segment.length || 1)),
  );
  return {
    index,
    t,
    point: {
      x: segment.a.x + (segment.b.x - segment.a.x) * t,
      y: segment.a.y + (segment.b.y - segment.a.y) * t,
    },
  };
}
function anchorAtSegment(
  points: readonly Point[],
  index: number,
  t: number,
): number | undefined {
  const segments = segmentsOf(points, true),
    segment = segments[index],
    total = segments.reduce((sum, candidate) => sum + candidate.length, 0);
  if (!segment || total <= 0) return undefined;
  return (segment.start + segment.length * Math.min(1, Math.max(0, t))) / total;
}
function projectionAt(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return Math.min(
    1,
    Math.max(
      0,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) /
        (dx * dx + dy * dy || 1),
    ),
  );
}
export function followPortalAfterContourEdit(
  door: Door,
  before: Building,
  after: Building,
  edit: BuildingContourEdit,
): Door | null {
  if (door.anchor?.boundaryId !== before.id) return null;
  const beforePoints = boundaryContours(before)[door.anchor.contour],
    afterPoints = boundaryContours(after)[door.anchor.contour];
  if (!beforePoints || !afterPoints) return null;
  if (door.anchor.contour !== edit.contour)
    return {
      ...door,
      anchor: { ...door.anchor, boundaryId: after.id },
    };
  const position = segmentPositionAt(beforePoints, door.anchor.at);
  if (!position) return null;
  let index = position.index,
    t = position.t;
  if (edit.kind === "insert") {
    const inserted = edit.index,
      split = inserted - 1;
    if (index > split) index++;
    else if (index === split) {
      const a = beforePoints[split]!,
        b = beforePoints[(split + 1) % beforePoints.length]!,
        q = projectionAt(afterPoints[inserted]!, a, b);
      if (t <= q && q > 1e-9) t /= q;
      else if (1 - q > 1e-9) {
        index = inserted;
        t = (t - q) / (1 - q);
      } else t = 1;
    }
  } else if (edit.kind === "remove") {
    const removed = edit.index,
      previous = (removed - 1 + beforePoints.length) % beforePoints.length;
    if (index === previous || index === removed) {
      index = removed === 0 ? afterPoints.length - 1 : removed - 1;
      const a = afterPoints[index]!,
        b = afterPoints[(index + 1) % afterPoints.length]!;
      t = projectionAt(position.point, a, b);
    } else if (removed === 0) index--;
    else if (index > removed) index--;
  }
  const at = anchorAtSegment(afterPoints, index, t);
  if (at === undefined) return null;
  return {
    ...door,
    anchor: {
      boundaryId: after.id,
      contour: door.anchor.contour,
      at,
    },
  };
}
export function reanchorPortal(
  door: Door,
  before: Boundary,
  after: Boundary,
  mode: "follow" | "survive",
  tolerance = 1e-4,
): Door | null {
  if (door.anchor?.boundaryId !== before.id) return null;
  if (mode === "follow") {
    if (!boundaryContours(after)[door.anchor.contour]) return null;
    return {
      ...door,
      anchor: { ...door.anchor, boundaryId: after.id },
    };
  }
  const samples = [0, -door.width / 2, door.width / 2]
      .map((offset) =>
        boundaryPoseAt(before, door.anchor!.contour, door.anchor!.at, offset),
      ),
    center = samples[0];
  if (!center || samples.some((sample) => !sample)) return null;
  const anchors = samples.map((sample) => nearestBoundary(sample!, after)),
    target = anchors[0]!;
  if (
    anchors.some(
      (anchor) =>
        anchor.distance > tolerance || anchor.contour !== target.contour,
    )
  )
    return null;
  const nextPose = boundaryPoseAt(after, target.contour, target.at);
  if (!nextPose || Math.abs(Math.cos(nextPose.angle - center.angle)) < 0.996)
    return null;
  return {
    ...door,
    anchor: {
      boundaryId: after.id,
      contour: target.contour,
      at: target.at,
    },
  };
}
export function boundarySegments(
  boundary: Boundary,
  doors: readonly Door[] = [],
): { a: Point; b: Point }[] {
  const result: { a: Point; b: Point }[] = [];
  for (const [contour, points] of boundaryContours(boundary).entries()) {
    const closed = boundary.kind === "building" || boundary.closed,
      source = segmentsOf(points, closed),
      total = source.reduce((sum, segment) => sum + segment.length, 0),
      gaps: [number, number][] = [];
    for (const door of doors) {
      if (
        door.anchor?.boundaryId !== boundary.id ||
        door.anchor.contour !== contour
      )
        continue;
      const center = door.anchor.at * total,
        low = center - door.width / 2,
        high = center + door.width / 2;
      if (closed && low < 0) gaps.push([0, high], [total + low, total]);
      else if (closed && high > total)
        gaps.push([low, total], [0, high - total]);
      else gaps.push([Math.max(0, low), Math.min(total, high)]);
    }
    for (const segment of source) {
      const end = segment.start + segment.length,
        cuts = gaps
          .map(
            ([a, b]) =>
              [Math.max(segment.start, a), Math.min(end, b)] as const,
          )
          .filter(([a, b]) => b > a)
          .sort((a, b) => a[0] - b[0]);
      let cursor = segment.start;
      const pointAt = (distance: number): Point => {
        const t = (distance - segment.start) / (segment.length || 1);
        return {
          x: segment.a.x + (segment.b.x - segment.a.x) * t,
          y: segment.a.y + (segment.b.y - segment.a.y) * t,
        };
      };
      for (const [low, high] of cuts) {
        if (low > cursor)
          result.push({ a: pointAt(cursor), b: pointAt(low) });
        cursor = Math.max(cursor, high);
      }
      if (cursor < end) result.push({ a: pointAt(cursor), b: segment.b });
    }
  }
  return result;
}
export function wallSegments(room: Building, doors: readonly Door[]) {
  return boundarySegments(room, doors);
}
export function hit(
  point: Point,
  entity: Entity,
  get: (id: string) => Entity | undefined,
  tolerance: number,
): boolean {
  if (entity.kind === "reference" && !entity.visible) return false;
  if (entity.kind === "building")
    return (
      entity.polygons.some(
        (polygon) =>
          inside(point, polygon.outer) &&
          !polygon.holes.some((hole) => inside(point, hole)),
      ) ||
      nearestBoundary(point, entity).distance < tolerance
    );
  if (entity.kind === "wall")
    return (
      nearestBoundary(point, entity).distance <
      Math.max(entity.width / 2, tolerance)
    );
  if (entity.kind === "door") {
    const pose = portalPose(entity, get);
    return (
      Math.hypot(point.x - pose.x, point.y - pose.y) <
      Math.max(entity.width / 2, tolerance)
    );
  }
  if (entity.kind === "surface")
    return entity.polygons.some(
      (polygon) =>
        inside(point, polygon.outer) &&
        !polygon.holes.some((hole) => inside(point, hole)),
    );
  if (entity.kind === "path")
    return (
      nearestPath(point, entity).distance <
      Math.max(entity.width / 2 + entity.outlineWidth, tolerance)
    );
  if (entity.kind === "roof") return inside(point, entity.points);
  if (entity.kind === "light")
    return (
      Math.hypot(point.x - entity.x, point.y - entity.y) <
      Math.max(0.4, tolerance)
    );
  const dx = point.x - entity.x,
    dy = point.y - entity.y,
    c = Math.cos(entity.rotation),
    s = Math.sin(entity.rotation);
  return (
    Math.abs(dx * c + dy * s) < entity.width / 2 + tolerance &&
    Math.abs(-dx * s + dy * c) < entity.height / 2 + tolerance
  );
}
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function entityBounds(
  entity: Entity,
  get: (id: string) => Entity | undefined,
): Bounds {
  if (
    entity.kind === "building" ||
    entity.kind === "surface" ||
    entity.kind === "wall" ||
    entity.kind === "path" ||
    entity.kind === "roof"
  ) {
    const points =
      entity.kind === "building"
        ? entity.polygons.flatMap((polygon) => [
            ...polygon.outer,
            ...polygon.holes.flat(),
          ])
        : entity.kind === "wall"
          ? boundaryPoints(entity)
          : entity.kind === "path"
            ? pathPoints(entity)
            : entity.kind === "roof"
              ? entity.points
              : entity.polygons.flatMap((polygon) => polygon.outer);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    const padding =
      entity.kind === "wall"
        ? entity.width
        : entity.kind === "path"
          ? entity.width / 2 + entity.outlineWidth
          : 1;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }
  if (entity.kind === "door") {
    const pose = portalPose(entity, get);
    return {
      x: pose.x - entity.width,
      y: pose.y - entity.width,
      width: entity.width * 2,
      height: entity.width * 2,
    };
  }
  const radius =
    entity.kind === "light"
      ? entity.radius
      : Math.hypot(entity.width, entity.height) / 2;
  return {
    x: entity.x - radius,
    y: entity.y - radius,
    width: radius * 2,
    height: radius * 2,
  };
}
export function overlaps(a: Bounds, b: Bounds): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}
export function moveEntity(entity: Entity, dx: number, dy: number): Entity {
  if (entity.kind === "door" && entity.anchor) return entity;
  const move = (point: Point) => ({ x: point.x + dx, y: point.y + dy });
  if (entity.kind === "building")
    return {
      ...entity,
      polygons: entity.polygons.map((polygon) => ({
        outer: polygon.outer.map(move),
        holes: polygon.holes.map((hole) => hole.map(move)),
      })),
    };
  if (entity.kind === "wall")
    return { ...entity, points: entity.points.map(move) };
  if (entity.kind === "path")
    return { ...entity, points: entity.points.map(move) };
  if (entity.kind === "roof")
    return {
      ...entity,
      points: entity.points.map(move),
      ridge: entity.ridge.map(move),
    };
  if (entity.kind === "surface")
    return {
      ...entity,
      polygons: entity.polygons.map((polygon) => ({
        outer: polygon.outer.map(move),
        holes: polygon.holes.map((hole) => hole.map(move)),
      })),
    };
  return { ...entity, x: entity.x! + dx, y: entity.y! + dy } as Entity;
}
export function polygonSegments(
  polygons: readonly Polygon[],
): { a: Point; b: Point }[] {
  return polygons.flatMap((polygon) =>
    [polygon.outer, ...polygon.holes].flatMap((ring) =>
      ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length]! })),
    ),
  );
}
