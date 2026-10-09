import { immutable, type Point, type Polygon } from "../../model";
import type { CityBuilding } from "./model";

/** Building-local meters → city-local meters; the Atlas placement is not involved. */
export function cityBuildingOutline(
  building: Pick<
    CityBuilding,
    "footprint" | "position" | "rotationRadians" | "scale"
  >,
): Polygon {
  const { footprint, position, rotationRadians, scale } = building;
  if (
    !Number.isFinite(rotationRadians) ||
    !Number.isFinite(scale.x) ||
    !Number.isFinite(scale.y) ||
    scale.x <= 0 ||
    scale.y <= 0
  )
    throw new Error("Ungültige Stadtgeometrie: Hauspose.");
  const c = Math.cos(rotationRadians),
    s = Math.sin(rotationRadians);
  const pose = (points: readonly Point[]) =>
    points.map((p) => {
      const x = p.x * scale.x,
        y = p.y * scale.y;
      const point = {
        x: position.x + x * c - y * s,
        y: position.y + x * s + y * c,
      };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
        throw new Error(
          "Ungültige Stadtgeometrie: Hauskoordinate ist nicht endlich.",
        );
      return point;
    });
  return immutable({
    outer: pose(footprint.outer),
    holes: footprint.holes.map(pose),
  });
}
