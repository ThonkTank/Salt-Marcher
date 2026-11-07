import type { WaterBody } from "./generated/WaterBody";
import { containsPolygon, type WorldPoint } from "./model";
export function waterAt(waters: WaterBody[], point: WorldPoint): number | null {
  return (
    waters.find((w) => w.polygons.some((p) => containsPolygon(p, point)))
      ?.level ?? null
  );
}
