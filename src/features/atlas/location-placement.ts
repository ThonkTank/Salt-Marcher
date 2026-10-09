import type { WorldPoint } from "./overworld";
import { nativeArray, nativeId, nativeRecord } from "./native-values";

export interface LocationPlacement {
  readonly kind: "location";
  readonly id: string;
  readonly locationId: string;
  readonly position: WorldPoint;
}
/** This codec is not activated in Overworld until the complete storage path is connected. */
export function checkedLocationPlacement(value: unknown): LocationPlacement {
  const v = nativeRecord(value, ["kind", "id", "locationId", "position"]),
    p = nativeRecord(v.position, ["x", "y"]);
  if (
    v.kind !== "location" ||
    typeof p.x !== "number" ||
    typeof p.y !== "number" ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y)
  )
    throw new Error("Ungültige Ortsplatzierung.");
  return Object.freeze({
    kind: "location",
    id: nativeId(v.id),
    locationId: nativeId(v.locationId),
    position: Object.freeze({ x: p.x, y: p.y }),
  });
}
export function checkedLocationPlacements(
  value: unknown,
): readonly LocationPlacement[] {
  const placements = nativeArray(value).map(checkedLocationPlacement),
    ids = new Set<string>(),
    locations = new Set<string>();
  for (const placement of placements) {
    if (ids.has(placement.id) || locations.has(placement.locationId))
      throw new Error("Doppelte Ortsplatzierung.");
    ids.add(placement.id);
    locations.add(placement.locationId);
  }
  return Object.freeze(placements);
}
