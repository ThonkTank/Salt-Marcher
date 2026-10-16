import { inside, nearestSegmentPoint } from "../../geometry";
import { immutable, type Point, type Polygon } from "../../model";
import { parseCityDocument, serializeCityDocument } from "./codec";
import { cityBuildingOutline } from "./geometry";
import type { CityDocument, CityRoadNode } from "./model";

export interface CityBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}
export interface CityHit {
  readonly ownerId: string;
  readonly kind: "district" | "plot" | "plaza" | "road" | "building" | "node";
  readonly elementId: string;
}
export type CityShape =
  | (CityHit & {
      readonly kind: "district" | "plot" | "plaza" | "building";
      readonly polygon: Polygon;
      readonly bounds: CityBounds;
    })
  | (CityHit & {
      readonly kind: "road";
      readonly points: readonly Point[];
      readonly widthMeters: number;
      readonly bounds: CityBounds;
    });
export interface CityScene {
  readonly ownerId: string;
  /** Bottom to top; hit testing uses this exact order in reverse. */
  readonly shapes: readonly CityShape[];
  readonly nodes: readonly CityRoadNode[];
  readonly extent: CityBounds | null;
}

function bounds(points: readonly Point[], padding = 0): CityBounds {
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
  const result = {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
  if (!Object.values(result).every(Number.isFinite))
    throw new Error("Stadtausdehnung ist numerisch nicht darstellbar.");
  return result;
}
function merge(a: CityBounds | null, b: CityBounds): CityBounds {
  return a
    ? {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY),
      }
    : b;
}

/** Derived local-meter geometry only; no placement, camera, renderer or second city state. */
export function cityScene(document: CityDocument): CityScene {
  const checked = parseCityDocument(serializeCityDocument(document));
  const shapes: CityShape[] = [],
    ownerId = checked.id;
  const polygon = (
    kind: "district" | "plot" | "plaza" | "building",
    elementId: string,
    outline: Polygon,
  ) => {
    shapes.push({
      ownerId,
      kind,
      elementId,
      polygon: outline,
      bounds: bounds(outline.outer),
    });
  };
  for (const area of checked.districts)
    polygon("district", area.id, area.outline);
  for (const plot of checked.plots) polygon("plot", plot.id, plot.outline);
  for (const area of checked.plazas) polygon("plaza", area.id, area.outline);
  const nodes = new Map(checked.roadNodes.map((node) => [node.id, node.point]));
  for (const road of checked.roads) {
    const points = [
      nodes.get(road.startNodeId)!,
      ...road.via,
      nodes.get(road.endNodeId)!,
    ];
    shapes.push({
      ownerId,
      kind: "road",
      elementId: road.id,
      points,
      widthMeters: road.widthMeters,
      bounds: bounds(points, road.widthMeters / 2),
    });
  }
  for (const building of checked.buildings)
    polygon("building", building.id, cityBuildingOutline(building));
  let extent: CityBounds | null = null;
  for (const shape of shapes) extent = merge(extent, shape.bounds);
  for (const node of checked.roadNodes)
    extent = merge(extent, bounds([node.point]));
  return immutable({ ownerId, shapes, nodes: checked.roadNodes, extent });
}

function ringDistance(
  point: Point,
  points: readonly Point[],
  closed: boolean,
): number {
  let distance = Infinity;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++)
    distance = Math.min(
      distance,
      nearestSegmentPoint(point, points[i]!, points[(i + 1) % points.length]!)
        .distance,
    );
  return distance;
}
/** Input coordinates/tolerance come from the Atlas owner's unprojection, never a private camera. */
export function hitCity(
  scene: CityScene,
  point: Point,
  options: {
    readonly toleranceMeters: number;
    readonly includeNodes?: boolean;
  },
): CityHit | null {
  const tolerance = options.toleranceMeters;
  if (
    ![point.x, point.y, tolerance].every(Number.isFinite) ||
    tolerance < 0 ||
    (options.includeNodes !== undefined &&
      typeof options.includeNodes !== "boolean")
  )
    throw new Error("Ungültiger Stadttrefferpunkt oder Fangabstand.");
  if (options.includeNodes) {
    let nearest: CityRoadNode | undefined,
      best = Infinity;
    for (const node of scene.nodes) {
      const distance = Math.hypot(
        point.x - node.point.x,
        point.y - node.point.y,
      );
      if (distance <= tolerance && distance < best) {
        nearest = node;
        best = distance;
      }
    }
    if (nearest)
      return immutable({
        ownerId: scene.ownerId,
        kind: "node",
        elementId: nearest.id,
      });
  }
  for (let i = scene.shapes.length - 1; i >= 0; i--) {
    const shape = scene.shapes[i]!,
      b = shape.bounds;
    if (
      point.x < b.minX - tolerance ||
      point.x > b.maxX + tolerance ||
      point.y < b.minY - tolerance ||
      point.y > b.maxY + tolerance
    )
      continue;
    let hit: boolean;
    if (shape.kind === "road") {
      // Subtract first, so a large valid tolerance never overflows the threshold.
      hit =
        ringDistance(point, shape.points, false) - shape.widthMeters / 2 <=
        tolerance;
    } else {
      const polygon = shape.polygon;
      hit =
        (inside(point, polygon.outer) &&
          !polygon.holes.some((hole) => inside(point, hole))) ||
        ringDistance(point, polygon.outer, true) <= tolerance ||
        polygon.holes.some(
          (hole) => ringDistance(point, hole, true) <= tolerance,
        );
    }
    if (hit)
      return immutable({
        ownerId: shape.ownerId,
        kind: shape.kind,
        elementId: shape.elementId,
      });
  }
  return null;
}
