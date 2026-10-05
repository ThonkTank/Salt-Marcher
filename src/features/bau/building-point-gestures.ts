import type { Building, Entity, Point } from "../../model";
import type { Command } from "../../session";
import { planBuildingContourMutation } from "../../commands";
import {
  buildingContourEntries,
  nearestBuildingVertex,
  replaceBuildingContour,
} from "../../geometry";

export interface BuildingVertexGrip {
  readonly buildingId: string;
  readonly contour: number;
  readonly index: number;
  readonly point: Point;
}

export interface BuildingEdgeGrip {
  readonly buildingId: string;
  readonly contour: number;
  readonly index: number;
  readonly start: Point;
  readonly end: Point;
  readonly midpoint: Point;
}

export type BuildingPointEdit =
  | {
      readonly status: "command";
      readonly command: Command;
      readonly after: Building;
    }
  | { readonly status: "minimum" | "locked" | "stale"; readonly command: null };

const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
const validTolerance = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

/** Hovered Edit Points grip. The caller supplies the screen-size grip radius in fields. */
export function buildingVertexGrip(
  building: Building,
  pointer: Point,
  tolerance: number,
): BuildingVertexGrip | null {
  if (building.locked || !validTolerance(tolerance)) return null;
  const nearest = nearestBuildingVertex(pointer, building);
  if (nearest.distance >= tolerance) return null;
  const point =
    buildingContourEntries(building)[nearest.contour]?.points[nearest.index];
  return point
    ? {
        buildingId: building.id,
        contour: nearest.contour,
        index: nearest.index,
        point,
      }
    : null;
}

/** Native Backspace on a hovered point removes exactly that point, down to three. */
export function planBuildingBackspacePoint(
  entities: readonly Entity[],
  before: Building,
  grip: BuildingVertexGrip,
): BuildingPointEdit {
  if (before.locked) return { status: "locked", command: null };
  const contour = buildingContourEntries(before)[grip.contour];
  if (
    before.id !== grip.buildingId ||
    !contour ||
    !contour.points[grip.index] ||
    !samePoint(contour.points[grip.index]!, grip.point)
  )
    return { status: "stale", command: null };
  if (contour.points.length <= 3) return { status: "minimum", command: null };
  const points = contour.points.filter((_, index) => index !== grip.index),
    after = replaceBuildingContour(before, grip.contour, points),
    command = planBuildingContourMutation({
      entities,
      before,
      after,
      edit: { kind: "remove", contour: grip.contour, index: grip.index },
    });
  return command
    ? { status: "command", command, after }
    : { status: "stale", command: null };
}

/** The directly observed native insertion grip is at a Building edge midpoint. */
export function buildingEdgeMidpointGrip(
  building: Building,
  pointer: Point,
  tolerance: number,
): BuildingEdgeGrip | null {
  if (building.locked || !validTolerance(tolerance)) return null;
  let best: (BuildingEdgeGrip & { distance: number }) | null = null;
  for (const contour of buildingContourEntries(building))
    for (const [index, start] of contour.points.entries()) {
      const end = contour.points[(index + 1) % contour.points.length]!;
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const distance = Math.hypot(
        pointer.x - midpoint.x,
        pointer.y - midpoint.y,
      );
      if (distance < tolerance && (!best || distance < best.distance))
        best = {
          buildingId: building.id,
          contour: contour.contour,
          index,
          start,
          end,
          midpoint,
          distance,
        };
    }
  if (!best) return null;
  const { distance: _distance, ...grip } = best;
  return grip;
}

function insertAtEdge(
  before: Building,
  grip: BuildingEdgeGrip,
  destination: Point,
): Building | null {
  const contour = buildingContourEntries(before)[grip.contour],
    points = contour?.points;
  if (
    before.id !== grip.buildingId ||
    !points ||
    !points[grip.index] ||
    !samePoint(points[grip.index]!, grip.start) ||
    !samePoint(points[(grip.index + 1) % points.length]!, grip.end) ||
    !Number.isFinite(destination.x) ||
    !Number.isFinite(destination.y)
  )
    return null;
  const next = [...points];
  next.splice(grip.index + 1, 0, destination);
  return replaceBuildingContour(before, grip.contour, next);
}

/** Preview has no document or history effect; commit uses the same geometry. */
export function previewBuildingEdgeDrag(
  before: Building,
  grip: BuildingEdgeGrip,
  destination: Point,
): Building | null {
  return before.locked ? null : insertAtEdge(before, grip, destination);
}

export function planBuildingEdgeDrag(
  entities: readonly Entity[],
  before: Building,
  grip: BuildingEdgeGrip,
  destination: Point,
): BuildingPointEdit {
  if (before.locked) return { status: "locked", command: null };
  const after = insertAtEdge(before, grip, destination);
  if (!after) return { status: "stale", command: null };
  const command = planBuildingContourMutation({
    entities,
    before,
    after,
    edit: { kind: "insert", contour: grip.contour, index: grip.index + 1 },
  });
  return command
    ? { status: "command", command, after }
    : { status: "stale", command: null };
}
