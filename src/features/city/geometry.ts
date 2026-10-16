import { immutable, type Point, type Polygon } from "../../model";
import type { CityBuilding } from "./model";
import { cityInputPoint } from "./input";

export type CityBuildingPose = Pick<
  CityBuilding,
  "position" | "rotationRadians" | "scale"
>;
function transform(pose: CityBuildingPose) {
  const position = cityInputPoint(pose.position),
    scale = cityInputPoint(pose.scale);
  if (!Number.isFinite(pose.rotationRadians) || scale.x <= 0 || scale.y <= 0)
    throw new Error("Ungültige Stadtgeometrie: Hauspose.");
  const c = Math.cos(pose.rotationRadians),
    s = Math.sin(pose.rotationRadians);
  return {
    forward(raw: Point): Point {
      const p = cityInputPoint(raw),
        x = p.x * scale.x,
        y = p.y * scale.y;
      // Preserve the existing outline arithmetic, including its operation order.
      return cityInputPoint({
        x: position.x + x * c - y * s,
        y: position.y + x * s + y * c,
      });
    },
    precision(raw: Point): Point {
      const p = cityInputPoint(raw);
      // Scale terms before summing to avoid unnecessary coordinate-sum overflow.
      const xError =
        Math.abs(p.x) * Number.EPSILON + Math.abs(position.x) * Number.EPSILON;
      const yError =
        Math.abs(p.y) * Number.EPSILON + Math.abs(position.y) * Number.EPSILON;
      // Each inverse component only receives errors through its actual rotation weights.
      return cityInputPoint({
        x: (8 * (Math.abs(c) * xError + Math.abs(s) * yError)) / scale.x,
        y: (8 * (Math.abs(s) * xError + Math.abs(c) * yError)) / scale.y,
      });
    },
    inverse(raw: Point): Point {
      const p = cityInputPoint(raw),
        x = p.x - position.x,
        y = p.y - position.y;
      return cityInputPoint({
        x: (x * c + y * s) / scale.x,
        y: (-x * s + y * c) / scale.y,
      });
    },
  };
}
export function cityBuildingPoint(pose: CityBuildingPose, point: Point): Point {
  return transform(pose).forward(point);
}
/** Footprint bounding-box midpoint, shared by inspector and transform grips. */
export function cityBuildingLocalCenter(
  building: Pick<CityBuilding, "footprint">,
): Point {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of building.footprint.outer) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return cityInputPoint({ x: minX / 2 + maxX / 2, y: minY / 2 + maxY / 2 });
}
/** Change the pose while retaining the footprint midpoint in city meters. */
export function cityBuildingCenteredPose(
  building: CityBuildingPose & Pick<CityBuilding, "footprint">,
  rotationRadians: number,
  scale: Point = building.scale,
): CityBuildingPose {
  if (
    rotationRadians === building.rotationRadians &&
    scale.x === building.scale.x &&
    scale.y === building.scale.y
  )
    return building;
  const local = cityBuildingLocalCenter(building),
    pivot = cityBuildingPoint(building, local),
    offset = cityBuildingPoint(
      { position: { x: 0, y: 0 }, rotationRadians, scale },
      local,
    );
  return {
    position: cityInputPoint({ x: pivot.x - offset.x, y: pivot.y - offset.y }),
    rotationRadians,
    scale,
  };
}
export function cityBuildingLocalPoint(
  pose: CityBuildingPose,
  point: Point,
): Point {
  return transform(pose).inverse(point);
}
/** Conservative inverse-pose roundoff estimate in building meters; not UI snapping. */
export function cityBuildingLocalPrecision(
  pose: CityBuildingPose,
  point: Point,
): Point {
  return transform(pose).precision(point);
}
/** Building-local meters → city-local meters; the Atlas placement is not involved. */
export function cityBuildingOutline(
  building: CityBuildingPose & Pick<CityBuilding, "footprint">,
): Polygon {
  const pose = transform(building);
  return immutable({
    outer: building.footprint.outer.map(pose.forward),
    holes: building.footprint.holes.map((points) => points.map(pose.forward)),
  });
}
