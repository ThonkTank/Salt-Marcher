import type { Building, Entity, SmartTileCell } from "../../model";
import type { RecordChange } from "../../session";
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

/** Erasing a Building removes only cells no longer covered by its contour. */
export function buildingFloorCellsAfterErase(
  cells: readonly SmartTileCell[] | undefined,
  changes: readonly RecordChange<Entity>[] | undefined,
  width: number, height: number,
): readonly SmartTileCell[] | undefined {
  if (!cells?.length || !changes?.length) return cells;
  const remaining = new Map<string, Set<string>>();
  for (const change of changes) {
    if (change.before?.kind !== "building" || !change.before.floorTileRaster)
      continue;
    const after = change.after?.kind === "building" ? change.after : undefined;
    remaining.set(change.id, new Set(after
      ? buildingFloorCells(after, width, height).map((cell) => `${cell.x}:${cell.y}`)
      : []));
  }
  if (!remaining.size) return cells;
  const next = cells.filter((cell) => {
    const allowed = cell.buildingId && remaining.get(cell.buildingId);
    return !allowed || cell.x >= width || cell.y >= height ||
      allowed.has(`${cell.x}:${cell.y}`);
  });
  return next.length === cells.length ? cells : next;
}
