import clipping, { type MultiPolygon, type Pair } from "polygon-clipping";
import { type Point, type Polygon, type Light } from "./model";

export interface Segment {
  a: Point;
  b: Point;
}
export interface PaintRequest {
  kind: "paint";
  polygons: readonly Polygon[];
  points: readonly Point[];
  radius: number;
  erase: boolean;
}
export interface FloorSource {
  readonly id: string;
  readonly polygons: readonly Polygon[];
}
export interface ComposeBuildingRequest {
  kind: "compose-building";
  sources: readonly FloorSource[];
  shape?: readonly Polygon[];
  stroke?: { readonly points: readonly Point[]; readonly radius: number };
  erase: boolean;
}
export type ComposeBuildingResult =
  | {
      readonly mode: "draw";
      readonly mergedIds: readonly string[];
      readonly polygons: readonly Polygon[];
    }
  | {
      readonly mode: "erase";
      readonly changes: readonly {
        readonly id: string;
        readonly polygons: readonly Polygon[];
      }[];
    };
export interface VisibilityRequest {
  kind: "visibility";
  light: Light;
  segments: readonly Segment[];
}
export type ComputeRequest =
  | PaintRequest
  | ComposeBuildingRequest
  | VisibilityRequest;
const coordinates = (p: Point): Pair => [p.x, p.y];
const multiPolygon = (polygons: readonly Polygon[]): MultiPolygon =>
  polygons.map((p) => [
    p.outer.map(coordinates),
    ...p.holes.map((h) => h.map(coordinates)),
  ]);
const ringPoints = (ring: readonly Pair[]): Point[] => {
  const first = ring[0],
    last = ring.at(-1),
    end =
      ring.length > 1 && first?.[0] === last?.[0] && first?.[1] === last?.[1]
        ? -1
        : undefined;
  return ring.slice(0, end).map(([x, y]) => ({ x, y }));
};
const polygons = (value: MultiPolygon): Polygon[] =>
  value.map((rings) => ({
    outer: ringPoints(rings[0]!),
    holes: rings.slice(1).map(ringPoints),
  }));
function signedArea(ring: readonly Pair[]): number {
  let value = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index]!,
      b = ring[(index + 1) % ring.length]!;
    value += a[0] * b[1] - b[0] * a[1];
  }
  return value / 2;
}
function area(value: MultiPolygon): number {
  return value.reduce(
    (sum, polygon) =>
      sum +
      Math.abs(signedArea(polygon[0]!)) -
      polygon
        .slice(1)
        .reduce((holes, ring) => holes + Math.abs(signedArea(ring)), 0),
    0,
  );
}
function circles(points: readonly Point[], radius: number): MultiPolygon {
  return points.map((p) => [
    Array.from(
      { length: 24 },
      (_, i) =>
        [
          p.x + Math.cos((i / 24) * Math.PI * 2) * radius,
          p.y + Math.sin((i / 24) * Math.PI * 2) * radius,
        ] as Pair,
    ),
  ]);
}
export function paint(request: PaintRequest): Polygon[] {
  if (
    !Number.isFinite(request.radius) ||
    request.radius <= 0 ||
    !request.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  )
    throw new Error("Ungültiger Pinsel.");
  const shapes = circles(request.points, request.radius);
  for (let i = 1; i < request.points.length; i++) {
    const a = request.points[i - 1]!,
      b = request.points[i]!,
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-8) continue;
    const x = (-(b.y - a.y) / length) * request.radius,
      y = ((b.x - a.x) / length) * request.radius;
    shapes.push([
      [
        [a.x + x, a.y + y],
        [b.x + x, b.y + y],
        [b.x - x, b.y - y],
        [a.x - x, a.y - y],
      ],
    ]);
  }
  let brush: MultiPolygon = [];
  for (let i = 0; i < shapes.length; i += 32)
    brush = clipping.union(brush, ...shapes.slice(i, i + 32));
  const current = multiPolygon(request.polygons);
  const result = request.erase
    ? clipping.difference(current, brush)
    : clipping.union(current, brush);
  return polygons(result);
}
export function composeBuilding(
  request: ComposeBuildingRequest,
): ComposeBuildingResult {
  if (!!request.shape === !!request.stroke)
    throw new Error("Grundriss benötigt genau eine Form.");
  const brush = request.stroke
    ? paint({
        kind: "paint",
        polygons: [],
        points: request.stroke.points,
        radius: request.stroke.radius,
        erase: false,
      })
    : [...request.shape!];
  const brushGeometry = multiPolygon(brush);
  if (!brushGeometry.length)
    return request.erase
      ? { mode: "erase", changes: [] }
      : { mode: "draw", mergedIds: [], polygons: [] };
  if (request.erase) {
    const changes: { id: string; polygons: Polygon[] }[] = [];
    for (const source of request.sources) {
      const current = multiPolygon(source.polygons);
      if (area(clipping.intersection(current, brushGeometry)) <= 1e-8) continue;
      changes.push({
        id: source.id,
        polygons: polygons(clipping.difference(current, brushGeometry)),
      });
    }
    return { mode: "erase", changes };
  }
  let merged = brushGeometry;
  const mergedIds: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const source of request.sources) {
      if (mergedIds.includes(source.id)) continue;
      const current = multiPolygon(source.polygons);
      // A shared edge alone keeps two rooms separate. Positive overlap joins them.
      if (area(clipping.intersection(current, merged)) <= 1e-8) continue;
      merged = clipping.union(merged, current);
      mergedIds.push(source.id);
      changed = true;
    }
  }
  return { mode: "draw", mergedIds, polygons: polygons(merged) };
}
export function visibility(
  light: Light,
  segments: readonly Segment[],
): Point[] {
  const relevant = light.shadows
    ? segments.filter(
        (s) =>
          Math.max(s.a.x, s.b.x) >= light.x - light.radius &&
          Math.min(s.a.x, s.b.x) <= light.x + light.radius &&
          Math.max(s.a.y, s.b.y) >= light.y - light.radius &&
          Math.min(s.a.y, s.b.y) <= light.y + light.radius,
      )
    : [];
  const angles = Array.from(
    { length: 96 },
    (_, i) => (i / 96) * Math.PI * 2 - Math.PI,
  );
  for (const s of relevant)
    for (const p of [s.a, s.b]) {
      const a = Math.atan2(p.y - light.y, p.x - light.x);
      angles.push(a - 1e-6, a, a + 1e-6);
    }
  angles.sort((a, b) => a - b);
  return angles.map((angle) => {
    const dx = Math.cos(angle),
      dy = Math.sin(angle);
    let distance = light.radius;
    for (const s of relevant) {
      const sx = s.b.x - s.a.x,
        sy = s.b.y - s.a.y,
        det = dx * sy - dy * sx;
      if (Math.abs(det) < 1e-10) continue;
      const qx = s.a.x - light.x,
        qy = s.a.y - light.y,
        t = (qx * sy - qy * sx) / det,
        u = (qx * dy - qy * dx) / det;
      if (t >= 0 && u >= 0 && u <= 1) distance = Math.min(distance, t);
    }
    return { x: light.x + dx * distance, y: light.y + dy * distance };
  });
}
export function compute(
  request: ComputeRequest,
): Polygon[] | Point[] | ComposeBuildingResult {
  if (request.kind === "paint") return paint(request);
  if (request.kind === "compose-building") return composeBuilding(request);
  return visibility(request.light, request.segments);
}
