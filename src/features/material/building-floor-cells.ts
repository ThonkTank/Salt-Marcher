import type { Building, SmartTileCell } from "../../model";
import { isNativeFloorAssetId } from "./native-path-catalog";
import { nativeFloorCells } from "./native-floor-tiles";

/** Store the cells produced by a new, separate Building floor gesture. */
export function buildingFloorCells(
  building: Building, width: number, height: number,
): readonly SmartTileCell[] {
  const assetId = building.material?.assetId;
  if (!assetId || !isNativeFloorAssetId(assetId)) return [];
  const occupied = nativeFloorCells([building], building.floorId, width, height);
  return occupied.flatMap((style, index) => style ? [{
    floorId: building.floorId,
    buildingId: building.id,
    x: index % width,
    y: Math.floor(index / width),
    assetId: style,
    color: building.fill,
  }] : []);
}
