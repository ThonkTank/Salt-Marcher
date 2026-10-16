import type { Building, Point } from "../../model";
import { inside } from "../../geometry";
import {
  buildPathTextureBand,
  type PathTextureBand,
} from "../material/path-texture-band";

type Segment = { a: Point; b: Point };

function same(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function solid(building: Building, point: Point): boolean {
  return building.polygons.some((polygon) =>
    inside(point, polygon.outer) &&
    !polygon.holes.some((hole) => inside(point, hole)));
}

function cornerInsets(points: readonly Point[], closed: boolean, width: number): Point[] {
  const count = points.length - 1;
  const result: Point[] = [];
  for (let index = 0; index < count; index++) {
    const a = points[index]!, b = points[index + 1]!;
    result.push(a);
    const dx = b.x - a.x, dy = b.y - a.y,
      length = Math.hypot(dx, dy), inset = width / 2;
    if (length > 2 * inset + 1e-6) {
      result.push({ x: a.x + dx / length * inset,
        y: a.y + dy / length * inset });
      result.push({ x: b.x - dx / length * inset,
        y: b.y - dy / length * inset });
    }
  }
  if (!closed) result.push(points.at(-1)!);
  return result;
}

function bevelBand(
  points: readonly Point[], closed: boolean, width: number,
  repeatLength: number, innerSign: number,
): PathTextureBand {
  const count = closed ? points.length : points.length - 1;
  const tangents = Array.from({ length: count }, (_, index) => {
    const a = points[index]!, b = points[(index + 1) % points.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length <= 1e-9) throw new RangeError("Wandstück ohne Länge.");
    return { x: (b.x - a.x) / length, y: (b.y - a.y) / length, length };
  });
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  let distance = 0;
  for (let index = 0; index <= count; index++) {
    if (index === count && !closed) break;
    const point = points[index % points.length]!,
      before = tangents[index === 0 ? closed ? count - 1 : 0 : index - 1]!,
      after = tangents[index === count ? 0 : index % count]!,
      beforeNormal = { x: -before.y * innerSign, y: before.x * innerSign },
      afterNormal = { x: -after.y * innerSign, y: after.x * innerSign },
      sum = { x: beforeNormal.x + afterNormal.x,
        y: beforeNormal.y + afterNormal.y },
      size = Math.hypot(sum.x, sum.y);
    if (size < 1e-9) throw new RangeError("Direkte Wandumkehr.");
    const bisector = { x: sum.x / size, y: sum.y / size },
      divisor = bisector.x * afterNormal.x + bisector.y * afterNormal.y;
    if (divisor <= 0) throw new RangeError("Wandknick ohne Innenwinkel.");
    const miter = Math.min(1 / divisor, 4), h = width / 2,
      u = distance / repeatLength;
    positions.push(
      point.x - beforeNormal.x * h, point.y - beforeNormal.y * h,
      point.x + bisector.x * miter * h, point.y + bisector.y * miter * h,
      point.x - afterNormal.x * h, point.y - afterNormal.y * h,
    );
    uvs.push(u, 0, u, 1, u, 0);
    if (index < count) distance += tangents[index]!.length;
  }
  if (!closed) {
    const point = points.at(-1)!, tangent = tangents.at(-1)!,
      normal = { x: -tangent.y * innerSign,
        y: tangent.x * innerSign }, u = distance / repeatLength,
      h = width / 2;
    positions.push(
      point.x - normal.x * h, point.y - normal.y * h,
      point.x + normal.x * h, point.y + normal.y * h,
      point.x - normal.x * h, point.y - normal.y * h,
    );
    uvs.push(u, 0, u, 1, u, 0);
  }
  for (let index = 0; index < count; index++) {
    const a = index * 3, b = (index + 1) * 3;
    indices.push(a + 2, a + 1, b, a + 1, b + 1, b);
    if (closed || index > 0) indices.push(a, a + 1, a + 2);
  }
  const phase = closed ? (distance / repeatLength) % 1 : null;
  return { positions, uvs, indices, pathLength: distance,
    repeatLength, closurePhase: phase };
}

/** Keep a continuous texture coordinate through corners, but split at portals. */
export function buildingWallBands(
  building: Building,
  segments: readonly Segment[],
  width: number,
  textureWidth: number,
  textureHeight: number,
  bevel = false,
): PathTextureBand[] {
  const runs: Segment[][] = [];
  for (const segment of segments) {
    const run = runs.at(-1);
    if (run?.length && same(run.at(-1)!.b, segment.a)) run.push(segment);
    else runs.push([segment]);
  }
  if (runs.length > 1 && same(runs.at(-1)!.at(-1)!.b, runs[0]![0]!.a)) {
    runs[0] = [...runs.at(-1)!, ...runs[0]!];
    runs.pop();
  }

  const result: PathTextureBand[] = [];
  const repeatLength = textureWidth / 256;
  for (const run of runs) {
    const first = run[0]!;
    const dx = first.b.x - first.a.x, dy = first.b.y - first.a.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    const mid = { x: (first.a.x + first.b.x) / 2,
      y: (first.a.y + first.b.y) / 2 };
    const step = Math.min(width / 4, 0.05);
    const plus = { x: mid.x - dy / length * step,
      y: mid.y + dx / length * step };
    const minus = { x: mid.x + dy / length * step,
      y: mid.y - dx / length * step };
    const flipV = solid(building, plus) && !solid(building, minus);
    const points = [...run.map((segment) => segment.a), run.at(-1)!.b];
    const closed = points.length >= 4 && same(points[0]!, points.at(-1)!);
    const make = (points: Point[], closed: boolean): void => {
      const inset = cornerInsets(points, closed, width);
      const band = bevel
        ? bevelBand(inset, closed, width, repeatLength, flipV ? 1 : -1)
        : buildPathTextureBand({
          points: inset, width, textureWidth,
          textureHeight, repeatLength, closed });
      result.push({
        ...band,
        uvs: band.uvs.map((value, index) => index % 2
          ? bevel ? value : flipV ? 1 - value : value
          : value + 0.5 / textureWidth),
      });
    };
    try {
      make(points, closed);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      for (const segment of run) make([segment.a, segment.b], false);
    }
  }
  return result;
}
