import {
  assertBuildingTopology,
  boundaryContours,
  boundarySegments,
  portalPose,
} from "../../geometry";
import type { Door, Entity, Point, Wall } from "../../model";
import {
  universalVttLightFromMapLight,
  type UniversalVttLight,
  type UniversalVttPoint,
  type UniversalVttPortal,
} from "./universal-vtt";

export interface UniversalVttMapGeometry {
  readonly lineOfSightSegments: readonly (readonly UniversalVttPoint[])[];
  readonly objectLineOfSightSegments: readonly never[];
  readonly portals: readonly UniversalVttPortal[];
  readonly lights: readonly UniversalVttLight[];
}

const EPSILON = 1e-9;

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function cleanCoordinate(value: number): number {
  return Number(value.toFixed(12));
}

function measuredWallAndPortal(
  wall: Wall,
  door: Door,
  entities: ReadonlyMap<string, Entity>,
): { line: UniversalVttPoint[]; portal: UniversalVttPortal } {
  if (wall.smooth || !wall.closed || wall.shadow !== true)
    throw new Error("VTT-Sichtlinie: Nur geschlossene, ungeglättete Schattenwände sind belegt.");
  if (
    door.anchor?.boundaryId !== wall.id || door.anchor.contour !== 0 ||
    door.variant !== "door" || door.passage?.state !== "closed" ||
    door.blocksLight !== true || door.flip === true
  ) throw new Error("VTT-Portal: Diese Türform ist im Originalexport nicht belegt.");

  const points = boundaryContours(wall)[0];
  if (
    !points || points.length < 3 ||
    !points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ||
    !Number.isFinite(door.width) || door.width <= 0
  )
    throw new Error("VTT-Portal: Wandkontur oder Türbreite ist ungültig.");
  try {
    assertBuildingTopology([{ outer: points, holes: [] }]);
  } catch (error) {
    throw new Error("VTT-Sichtlinie: Nur einfache geschlossene Wandkonturen sind belegt.",
      { cause: error });
  }
  const lengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const centerDistance = door.anchor.at * total;
  const halfWidth = door.width / 2;
  let start = 0;
  let edge = -1;
  for (let index = 0; index < points.length; index++) {
    const length = lengths[index]!;
    if (
      centerDistance - halfWidth > start + EPSILON &&
      centerDistance + halfWidth < start + length - EPSILON
    ) {
      edge = index;
      break;
    }
    start += length;
  }
  if (edge < 0)
    throw new Error("VTT-Portal: Die Türöffnung muss vollständig auf einer Wandkante liegen.");
  const a = points[edge]!, b = points[(edge + 1) % points.length]!;
  if (Math.abs(a.x - b.x) > EPSILON || b.y <= a.y)
    throw new Error("VTT-Portal: Diese Kantenrichtung ist im Originalexport nicht belegt.");
  const fraction = (centerDistance - start) / lengths[edge]!;
  const center: Point = {
    x: cleanCoordinate(a.x + (b.x - a.x) * fraction),
    y: cleanCoordinate(a.y + (b.y - a.y) * fraction),
  };
  const low: Point = { x: center.x, y: cleanCoordinate(center.y - halfWidth) };
  const high: Point = { x: center.x, y: cleanCoordinate(center.y + halfWidth) };
  const pose = portalPose(door, (id) => entities.get(id));
  if (!samePoint(center, pose) || Math.abs(pose.angle - Math.PI / 2) > EPSILON)
    throw new Error("VTT-Portal: Die berechnete Türlage widerspricht der Grenzgeometrie.");

  // Dungeondraft's measured closed wall starts after the door gap, traverses
  // the remaining contour, then ends before the gap. Verify that this path
  // contains precisely the segments used by the editor's boundary geometry.
  const line: UniversalVttPoint[] = [high];
  for (let step = 1; step <= points.length; step++)
    line.push(points[(edge + step) % points.length]!);
  line.push(low);
  const segments = boundarySegments(wall, [door]);
  if (
    segments.length !== line.length - 1 ||
    !segments.every((segment) => line.some((point, index) => {
      const next = line[index + 1];
      return next !== undefined && samePoint(segment.a, point) && samePoint(segment.b, next);
    }))
  ) throw new Error("VTT-Sichtlinie: Wandsegmente und Portalöffnung stimmen nicht überein.");

  return {
    line,
    portal: {
      position: center,
      bounds: [low, high],
      rotation: 1.570796,
      closed: true,
      freestanding: false,
    },
  };
}

/**
 * Map only directly measured DD 1.2.0.1 geometry: an empty map, lights, or
 * one closed shadow wall with one closed wall-bound door on a downward edge.
 * Buildings, other walls/doors, object LOS and other entities fail explicitly.
 */
export function universalVttGeometryForFloor(
  entities: readonly Entity[],
  floorId: string,
): UniversalVttMapGeometry {
  if (!floorId) throw new TypeError("Ein Geschoss ist erforderlich.");
  const selected = entities.filter((entity) => entity.floorId === floorId);
  const byId = new Map(selected.map((entity) => [entity.id, entity]));
  const walls: Wall[] = [];
  const doors: Door[] = [];
  const lights: UniversalVttLight[] = [];
  for (const entity of selected) {
    if (entity.kind === "wall") walls.push(entity);
    else if (entity.kind === "door") doors.push(entity);
    else if (entity.kind === "light") {
      if (entity.rotation !== undefined && entity.rotation !== 0)
        throw new Error("VTT-Licht: Gedrehte Lichter sind im Originalexport nicht belegt.");
      lights.push(universalVttLightFromMapLight(entity));
    } else throw new Error(`VTT-Geometrie: ${entity.kind} ist im Originalexport nicht belegt.`);
  }
  if (!walls.length && !doors.length)
    return { lineOfSightSegments: [], objectLineOfSightSegments: [], portals: [], lights };
  if (walls.length !== 1 || doors.length !== 1)
    throw new Error("VTT-Geometrie: Nur eine Wand mit genau einer Tür ist belegt.");
  const mapped = measuredWallAndPortal(walls[0]!, doors[0]!, byId);
  return {
    lineOfSightSegments: [mapped.line],
    objectLineOfSightSegments: [],
    portals: [mapped.portal],
    lights,
  };
}
