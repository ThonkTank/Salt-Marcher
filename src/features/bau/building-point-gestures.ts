import { isRoom, type Building, type Entity, type Point } from "../../model";
import type { Command } from "../../session";
import { planBuildingContourMutation, planBuildingOutlineRemoval } from "../../commands";
import {
  buildingContourEntries,
  nearestBuildingVertex,
  replaceBuildingContour,
  type BuildingContourEdit,
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
export type BuildingPointGrip = BuildingVertexGrip | BuildingEdgeGrip;
export interface BuildingPointProposal {
  readonly after: Building;
  readonly edit: BuildingContourEdit;
}

/** Vertex movement is relative to the grip; edge insertion uses the cursor position. */
export function buildingPointDragDestination(
  grip: BuildingPointGrip,
  start: Point,
  pointer: Point,
  snap: boolean,
): Point {
  return "point" in grip
    ? { x: grip.point.x + (snap ? Math.round(pointer.x - start.x) : pointer.x - start.x),
        y: grip.point.y + (snap ? Math.round(pointer.y - start.y) : pointer.y - start.y) }
    : snap ? { x: Math.round(pointer.x), y: Math.round(pointer.y) }
      : { x: pointer.x, y: pointer.y };
}

/** Native Edit Points hover reaches roughly 16 screen pixels at 75% and 100%. */
export const buildingPointGripPixels = 16;

export type BuildingPointEdit =
  | {
      readonly status: "command";
      readonly command: Command;
      readonly after: Building;
    }
  | { readonly status: "outline-removed"; readonly command: Command; readonly after: Building | null }
  | { readonly status: "protected-room" | "locked" | "stale" | "unchanged"; readonly command: null };

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

function moveVertex(
  before: Building,
  grip: BuildingVertexGrip,
  destination: Point,
): Building | null {
  const contour = buildingContourEntries(before)[grip.contour];
  if (
    before.id !== grip.buildingId ||
    !contour?.points[grip.index] ||
    !samePoint(contour.points[grip.index]!, grip.point) ||
    !Number.isFinite(destination.x) ||
    !Number.isFinite(destination.y)
  ) return null;
  const points = contour.points.map((point, index) =>
    index === grip.index ? { x: destination.x, y: destination.y } : point,
  );
  return replaceBuildingContour(before, grip.contour, points);
}

/** Transient floor and wall geometry while a Building point is held. */
export function previewBuildingVertexDrag(
  before: Building,
  grip: BuildingVertexGrip,
  destination: Point,
): Building | null {
  return proposeBuildingPointDrag(before, grip, destination)?.after ?? null;
}

/** Commit the exact previewed contour only after pointer release. */
export function planBuildingVertexDrag(
  entities: readonly Entity[],
  before: Building,
  grip: BuildingVertexGrip,
  destination: Point,
): BuildingPointEdit {
  if (before.locked) return { status: "locked", command: null };
  const proposal = proposeBuildingPointDrag(before, grip, destination);
  if (!proposal) return { status: "stale", command: null };
  if (samePoint(grip.point, destination))
    return { status: "unchanged", command: null };
  const command = planBuildingContourMutation({
    entities,
    before,
    ...proposal,
  });
  return command
    ? { status: "command", command, after: proposal.after }
    : { status: "unchanged", command: null };
}

/** Delete and Backspace share the native action: remove a point or a three-point outline. */
export function planBuildingBackspacePoint(
  entities: readonly Entity[],
  before: Building,
  grip: BuildingVertexGrip,
  wallStyle?: Pick<Building,
    "wall" | "wallAlpha" | "wallBevel" | "wallWidth" | "wallAssetId">,
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
  if (contour.points.length === 3) {
    if (contour.hole === undefined && before.polygons.length === 1 && isRoom(before))
      return { status: "protected-room", command: null };
    const result = planBuildingOutlineRemoval({ entities, before, contour: grip.contour });
    return { status: "outline-removed", ...result };
  }
  if (contour.points.length < 3) return { status: "stale", command: null };
  const points = contour.points.filter((_, index) => index !== grip.index),
    shapeAfter = replaceBuildingContour(before, grip.contour, points),
    after = wallStyle ? { ...shapeAfter, ...wallStyle } : shapeAfter,
    command = planBuildingContourMutation({
      entities,
      before,
      after: shapeAfter,
      edit: { kind: "remove", contour: grip.contour, index: grip.index },
      ...(wallStyle ? { wallStyle } : {}),
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

/** One geometry/edit pair feeds both transient preview and the validated command. */
export function proposeBuildingPointDrag(
  before: Building,
  grip: BuildingPointGrip,
  destination: Point,
): BuildingPointProposal | null {
  if (before.locked) return null;
  if ("point" in grip) {
    const after = moveVertex(before, grip, destination);
    return after ? { after, edit: { kind: "move", contour: grip.contour,
      index: grip.index } } : null;
  }
  const after = insertAtEdge(before, grip, destination);
  return after ? { after, edit: { kind: "insert", contour: grip.contour,
    index: grip.index + 1 } } : null;
}

/** Preview has no document or history effect; commit uses the same geometry. */
export function previewBuildingEdgeDrag(
  before: Building,
  grip: BuildingEdgeGrip,
  destination: Point,
  wallStyle?: Pick<Building,
    "wall" | "wallAlpha" | "wallBevel" | "wallWidth" | "wallAssetId">,
): Building | null {
  const after = proposeBuildingPointDrag(before, grip, destination)?.after;
  return after ? wallStyle ? { ...after, ...wallStyle } : after : null;
}

export function planBuildingEdgeDrag(
  entities: readonly Entity[],
  before: Building,
  grip: BuildingEdgeGrip,
  destination: Point,
  wallStyle?: Pick<Building,
    "wall" | "wallAlpha" | "wallBevel" | "wallWidth" | "wallAssetId">,
): BuildingPointEdit {
  if (before.locked) return { status: "locked", command: null };
  const proposal = proposeBuildingPointDrag(before, grip, destination);
  if (!proposal) return { status: "stale", command: null };
  const command = planBuildingContourMutation({
    entities,
    before,
    ...proposal,
    ...(wallStyle ? { wallStyle } : {}),
  });
  return command
    ? { status: "command", command,
      after: wallStyle ? { ...proposal.after, ...wallStyle } : proposal.after }
    : { status: "stale", command: null };
}
