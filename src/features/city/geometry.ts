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
export function cityBuildingLocalPoint(
  pose: CityBuildingPose,
  point: Point,
): Point {
  return transform(pose).inverse(point);
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
