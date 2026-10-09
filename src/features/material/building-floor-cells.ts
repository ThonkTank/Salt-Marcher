import type { Building, Entity, Polygon, SmartTileCell } from "../../model";
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

/** Native interior holes mask the floor visually but retain the stored tiles. */
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
      ? buildingFloorCells({ ...after, polygons: after.polygons.map((polygon) =>
        ({ ...polygon, holes: [] })) }, width, height)
        .map((cell) => `${cell.x}:${cell.y}`)
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

/** Paint only the new gesture's cells, preserving earlier crop gaps. */
export function buildingFloorCellsAfterDraw(
  cells: readonly SmartTileCell[] | undefined,
  building: Building,
  mergedIds: readonly string[],
  shape: readonly Polygon[] | undefined,
  width: number, height: number,
  paint?: { assetId: string; color: number },
): readonly SmartTileCell[] | undefined {
  const previous = cells ?? [];
  const owners = new Set(mergedIds);
  const painted = shape?.length
    ? buildingFloorCells({ ...building, polygons: shape }, width, height)
      .map((cell) => paint ? { ...cell, ...paint } : cell) : [];
  const key = (cell: SmartTileCell) => `${cell.floorId}:${cell.x}:${cell.y}`;
  const existing = new Map(previous.map((cell) => [key(cell), cell]));
  const changedPaint = painted.some((cell) => {
    const old = existing.get(key(cell));
    return !old || old.buildingId !== building.id ||
      old.assetId !== cell.assetId || old.color !== cell.color;
  });
  const changedOwner = previous.some((cell) => cell.buildingId &&
    owners.has(cell.buildingId) && cell.buildingId !== building.id);
  if (!changedPaint && !changedOwner) return cells;
  const positions = new Set(painted.map(key));
  return [...previous.filter((cell) => !positions.has(key(cell)))
    .map((cell) => cell.buildingId && owners.has(cell.buildingId)
      ? { ...cell, buildingId: building.id } : cell), ...painted];
}

/** Native contour point dragging repaints the complete outer bounding rectangle. */
export function buildingFloorCellsAfterPointEdit(
  cells: readonly SmartTileCell[] | undefined,
  building: Building,
  width: number, height: number,
  paint: { assetId: string; color: number },
): readonly SmartTileCell[] | undefined {
  if (!building.floorTileRaster || building.polygons.length !== 1 ||
      building.polygons[0]?.holes.length || !isNativeFloorAssetId(paint.assetId))
    return cells;
  const outer = building.polygons[0]!.outer;
  const minX = Math.max(0, Math.floor(Math.min(...outer.map((p) => p.x))));
  const maxX = Math.min(width, Math.ceil(Math.max(...outer.map((p) => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...outer.map((p) => p.y))));
  const maxY = Math.min(height, Math.ceil(Math.max(...outer.map((p) => p.y))));
  const painted: SmartTileCell[] = [];
  for (let y = minY; y < maxY; y++)
    for (let x = minX; x < maxX; x++)
      painted.push({ floorId: building.floorId, buildingId: building.id,
        x, y, assetId: paint.assetId, color: paint.color });
  const positions = new Set(painted.map((cell) => `${cell.x}:${cell.y}`));
  const retained = (cells ?? []).filter((cell) =>
    cell.buildingId !== building.id && (cell.floorId !== building.floorId ||
      !positions.has(`${cell.x}:${cell.y}`)));
  return [...retained, ...painted];
}
