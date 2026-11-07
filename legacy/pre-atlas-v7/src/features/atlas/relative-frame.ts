import type { WorldPoint } from "./overworld";
import type { ViewportSize } from "./camera";
import { spatialNumber, spatialPoint } from "./spatial-schema";

/** Replacement camera port; the host continues using its existing camera until I01b. */
export interface RelativeAtlasCamera {
  readonly anchor: WorldPoint;
  readonly offsetMeters: WorldPoint;
  readonly metersPerPixel: number;
}
export interface RigidFrame {
  readonly anchor: WorldPoint;
  /** Keep parent translations separate until camera subtraction, including large house positions. */
  readonly offsetsMeters: readonly WorldPoint[];
  readonly rotationRadians: number;
  readonly metersPerUnit: number;
  readonly originUnits: WorldPoint;
  readonly precisionMeters: number;
}
function twoSum(a: number, b: number): readonly [number, number] {
  const sum = a + b,
    part = sum - a;
  return [spatialNumber(sum), spatialNumber(a - (sum - part) + (b - part))];
}
/** Compensated cancellation preserves local offsets without first making an absolute world point. */
function sum(values: readonly number[]): number {
  let high = 0,
    low = 0;
  for (const value of values) {
    const pair = twoSum(high, value);
    high = pair[0];
    low += pair[1];
  }
  return spatialNumber(high + low);
}
export function rotateMeters(point: WorldPoint, angle: number): WorldPoint {
  const p = spatialPoint(point);
  spatialNumber(angle);
  if (angle === 0) return p;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return spatialPoint({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
}
export function rotationError(point: WorldPoint, angle: number): number {
  return angle === 0
    ? 0
    : spatialNumber(
        (Math.abs(point.x) + Math.abs(point.y)) * Number.EPSILON * 8,
      );
}
export function relativeCamera(
  anchor: WorldPoint,
  offsetMeters: WorldPoint,
  metersPerPixel: number,
): RelativeAtlasCamera {
  const a = spatialPoint(anchor),
    p = spatialPoint(offsetMeters);
  if (!(spatialNumber(metersPerPixel) > 0))
    throw new Error("Ungültiger Kameramaßstab.");
  const x = twoSum(a.x, p.x),
    y = twoSum(a.y, p.y);
  return Object.freeze({
    anchor: Object.freeze({ x: x[0], y: y[0] }),
    offsetMeters: Object.freeze({ x: x[1], y: y[1] }),
    metersPerPixel,
  });
}
function size(viewport: ViewportSize): void {
  if (
    !(spatialNumber(viewport.width) > 0) ||
    !(spatialNumber(viewport.height) > 0)
  )
    throw new Error("Ungültiger Kartenausschnitt.");
}
function checkedFrame(frame: RigidFrame, camera: RelativeAtlasCamera): void {
  spatialPoint(frame.anchor);
  spatialPoint(frame.originUnits);
  spatialPoint(camera.anchor);
  spatialPoint(camera.offsetMeters);
  spatialNumber(frame.rotationRadians);
  if (
    !(spatialNumber(frame.metersPerUnit) > 0) ||
    !(spatialNumber(camera.metersPerPixel) > 0) ||
    !(spatialNumber(frame.precisionMeters) >= 0)
  )
    throw new Error("Ungültiger räumlicher Rahmen.");
  if (frame.precisionMeters / camera.metersPerPixel > 1e-4)
    throw new Error(
      "Räumliche Projektion ist bei diesem Maßstab nicht zuverlässig.",
    );
}
function originTerms(
  frame: RigidFrame,
  camera: RelativeAtlasCamera,
  axis: "x" | "y",
): number[] {
  return [
    frame.anchor[axis],
    -camera.anchor[axis],
    -camera.offsetMeters[axis],
    ...frame.offsetsMeters.map((p) => spatialPoint(p)[axis]),
  ];
}
export function relativeLocalMeters(
  frame: RigidFrame,
  camera: RelativeAtlasCamera,
  raw: WorldPoint,
): WorldPoint {
  checkedFrame(frame, camera);
  const p = spatialPoint(raw),
    local = spatialPoint({
      x: (p.x - frame.originUnits.x) * frame.metersPerUnit,
      y: (p.y - frame.originUnits.y) * frame.metersPerUnit,
    });
  if (
    (rotationError(local, frame.rotationRadians) +
      (frame.metersPerUnit === 1
        ? 0
        : (Math.abs(local.x) + Math.abs(local.y)) * Number.EPSILON * 4)) /
      camera.metersPerPixel >
    1e-4
  )
    throw new Error(
      "Lokale Kartenkoordinaten sind nicht zuverlässig projizierbar.",
    );
  const r = rotateMeters(local, frame.rotationRadians);
  return spatialPoint({
    x: sum([...originTerms(frame, camera, "x"), r.x]),
    y: sum([...originTerms(frame, camera, "y"), r.y]),
  });
}
export function projectLocal(
  frame: RigidFrame,
  camera: RelativeAtlasCamera,
  viewport: ViewportSize,
  raw: WorldPoint,
): WorldPoint {
  checkedFrame(frame, camera);
  size(viewport);
  const relative = relativeLocalMeters(frame, camera, raw);
  const result = spatialPoint({
    x: viewport.width / 2 + relative.x / camera.metersPerPixel,
    y: viewport.height / 2 + relative.y / camera.metersPerPixel,
  });
  if (
    Math.max(Math.abs(result.x), Math.abs(result.y)) * Number.EPSILON * 4 >
    1e-4
  )
    throw new Error(
      "Bildschirmkoordinaten sind nicht zuverlässig darstellbar.",
    );
  return result;
}
export function unprojectLocal(
  frame: RigidFrame,
  camera: RelativeAtlasCamera,
  viewport: ViewportSize,
  raw: WorldPoint,
): WorldPoint {
  checkedFrame(frame, camera);
  size(viewport);
  const p = spatialPoint(raw),
    relative = spatialPoint({
      x: sum([
        (p.x - viewport.width / 2) * camera.metersPerPixel,
        ...originTerms(frame, camera, "x").map((n) => -n),
      ]),
      y: sum([
        (p.y - viewport.height / 2) * camera.metersPerPixel,
        ...originTerms(frame, camera, "y").map((n) => -n),
      ]),
    });
  const r = rotateMeters(relative, -frame.rotationRadians),
    result = spatialPoint({
      x: frame.originUnits.x + r.x / frame.metersPerUnit,
      y: frame.originUnits.y + r.y / frame.metersPerUnit,
    });
  const check = projectLocal(frame, camera, viewport, result);
  if (Math.max(Math.abs(check.x - p.x), Math.abs(check.y - p.y)) > 1e-4)
    throw new Error("Lokale Trefferkoordinate verliert Detailpräzision.");
  return result;
}
function shift(
  camera: RelativeAtlasCamera,
  delta: WorldPoint,
): RelativeAtlasCamera {
  const next = relativeCamera(
    camera.anchor,
    {
      x: sum([camera.offsetMeters.x, delta.x]),
      y: sum([camera.offsetMeters.y, delta.y]),
    },
    camera.metersPerPixel,
  );
  for (const axis of ["x", "y"] as const) {
    const actual = sum([
      next.anchor[axis],
      -camera.anchor[axis],
      next.offsetMeters[axis],
      -camera.offsetMeters[axis],
    ]);
    if (Math.abs(actual - delta[axis]) / camera.metersPerPixel > 1e-4)
      throw new Error("Kamerabewegung verliert Detailpräzision.");
  }
  return next;
}
export function panRelativeAtlas(
  camera: RelativeAtlasCamera,
  dx: number,
  dy: number,
): RelativeAtlasCamera {
  return shift(camera, {
    x: -spatialNumber(dx) * camera.metersPerPixel,
    y: -spatialNumber(dy) * camera.metersPerPixel,
  });
}
export function zoomRelativeAtlas(
  camera: RelativeAtlasCamera,
  viewport: ViewportSize,
  raw: WorldPoint,
  factor: number,
): RelativeAtlasCamera {
  size(viewport);
  const p = spatialPoint(raw);
  if (!(spatialNumber(factor) > 0)) throw new Error("Ungültiger Zoom.");
  const metersPerPixel = Math.min(
      1e15,
      Math.max(0.005, camera.metersPerPixel * factor),
    ),
    difference = camera.metersPerPixel - metersPerPixel;
  const next = shift(camera, {
    x: (p.x - viewport.width / 2) * difference,
    y: (p.y - viewport.height / 2) * difference,
  });
  return Object.freeze({ ...next, metersPerPixel });
}
