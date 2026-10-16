import type { Building, Entity, Polygon, SmartTileCell } from "../../model";
import type { RecordChange } from "../../session";
import { isNativeFloorAssetId } from "./native-path-catalog";
import { nativeFloorCells } from "./native-floor-tiles";

/** A touched corner alone is not a native floor cell; positive overlap is. */
function polygonOverlapsCell(outer: Polygon["outer"], x: number, y: number): boolean {
  let clipped = [...outer];
  for (const [axis, limit, sign] of [
    ["x", x, 1], ["x", x + 1, -1],
    ["y", y, 1], ["y", y + 1, -1],
  ] as const) {
    const next: typeof clipped = [];
    for (let i = 0; i < clipped.length; i++) {
      const a = clipped[i]!, b = clipped[(i + 1) % clipped.length]!;
      const da = sign * (a[axis] - limit), db = sign * (b[axis] - limit);
      if (da >= 0) next.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        next.push({ x: a.x + t * (b.x - a.x),
          y: a.y + t * (b.y - a.y) });
      }
    }
    clipped = next;
    if (clipped.length < 3) return false;
  }
  let doubledArea = 0;
  for (let i = 0; i < clipped.length; i++) {
    const a = clipped[i]!, b = clipped[(i + 1) % clipped.length]!;
    doubledArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(doubledArea) > 1e-9;
}

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

/** Native holes retain hidden tiles and repaint those touched by the erasing tool. */
export function buildingFloorCellsAfterErase(
  cells: readonly SmartTileCell[] | undefined,
  changes: readonly RecordChange<Entity>[] | undefined,
  width: number, height: number,
  shape?: readonly Polygon[],
  paint?: { assetId: string; color: number },
): readonly SmartTileCell[] | undefined {
  if (!cells?.length || !changes?.length) return cells;
  const remaining = new Map<string, Set<string>>();
  const repainted = new Map<string, Set<string>>();
  for (const change of changes) {
    if (change.before?.kind !== "building" || !change.before.floorTileRaster)
      continue;
    const after = change.after?.kind === "building" ? change.after : undefined;
    remaining.set(change.id, new Set(after
      ? buildingFloorCells({ ...after, polygons: after.polygons.map((polygon) =>
        ({ ...polygon, holes: [] })) }, width, height)
        .map((cell) => `${cell.x}:${cell.y}`)
      : []));
    if (after && shape?.length && paint && isNativeFloorAssetId(paint.assetId))
      repainted.set(change.id, new Set(buildingFloorCells({ ...after,
        polygons: shape,
        material: { tileSize: 4, tint: paint.color, rotation: 0,
          ...after.material, assetId: paint.assetId },
      }, width, height).map((cell) => `${cell.x}:${cell.y}`)));
  }
  if (!remaining.size) return cells;
  let changed = false;
  const next = cells.flatMap((cell) => {
    const allowed = cell.buildingId && remaining.get(cell.buildingId);
    const position = `${cell.x}:${cell.y}`;
    if (allowed && cell.x < width && cell.y < height &&
        !allowed.has(position)) {
      changed = true;
      return [];
    }
    if (paint && cell.buildingId && repainted.get(cell.buildingId)?.has(position) &&
        (cell.assetId !== paint.assetId || cell.color !== paint.color)) {
      changed = true;
      return [{ ...cell, assetId: paint.assetId, color: paint.color }];
    }
    return [cell];
  });
  return changed ? next : cells;
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

/** Native point moves/inserts repaint the bounding raster; removal repaints its interior. */
export function buildingFloorCellsAfterPointEdit(
  cells: readonly SmartTileCell[] | undefined,
  building: Building,
  width: number, height: number,
  paint: { assetId: string; color: number },
  kind: "move" | "insert" | "remove" = "move",
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
      if (kind !== "remove" || polygonOverlapsCell(outer, x, y))
        painted.push({ floorId: building.floorId, buildingId: building.id,
          x, y, assetId: paint.assetId, color: paint.color });
  const positions = new Set(painted.map((cell) => `${cell.x}:${cell.y}`));
  const retained = (cells ?? []).filter((cell) =>
    cell.buildingId !== building.id && (cell.floorId !== building.floorId ||
      !positions.has(`${cell.x}:${cell.y}`)));
  return [...retained, ...painted];
}
