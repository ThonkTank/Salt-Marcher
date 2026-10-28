import type { DungeonGeometry } from './dungeon-geometry-contracts';
import type { DrawingElement } from './drawing-element-contracts';
import type { DungeonVolume, VolumeColumn } from './volume-contracts';
import { VOXEL_METERS as U } from './volume-contracts';
type ContentAnchor = {
  point: { x: number; y: number };
  zOffsetMeters: number;
  volumeId: string;
  roomId: string;
};

export function dungeonContentAnchors(
  g: { drawing: Pick<DungeonGeometry['drawing'], 'volumes'> },
  elements: readonly DrawingElement[],
) {
  const volumes = new Map((g.drawing.volumes ?? []).map((v) => [v.id, v])),
    groups = new Map<string, { volume: DungeonVolume; elements: DrawingElement[] }>();
  const resolved = new Map<string, ContentAnchor>();
  for (const e of elements) {
    const anchor = e.content?.anchor;
    if (!anchor || ![anchor.x, anchor.y, anchor.z].every(Number.isSafeInteger)) continue;
    const volume = volumes.get(anchor.volumeId);
    if (!volume || volume.roomId !== e.roomId) continue;
    let group = groups.get(volume.id);
    if (!group) {
      group = { volume, elements: [] };
      groups.set(volume.id, group);
    }
    group.elements.push(e);
  }
  for (const { volume, elements } of groups.values()) {
    const columns = volume.columns,
      index = elements.length > 1 ? new Map<string, VolumeColumn>() : null;
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    for (const column of columns) {
      minX = Math.min(minX, column.x);
      minY = Math.min(minY, column.y);
      for (const span of column.spans) minZ = Math.min(minZ, span.z);
      index?.set(column.x + ',' + column.y, column);
    }
    if (!Number.isFinite(minZ)) continue;
    for (const e of elements) {
      const anchor = e.content!.anchor,
        cell = { x: minX + anchor.x, y: minY + anchor.y, z: minZ + anchor.z };
      const column = index
        ? index.get(cell.x + ',' + cell.y)
        : columns.find((c) => c.x === cell.x && c.y === cell.y);
      if (!column?.spans.some((s) => cell.z >= s.z && cell.z < s.z + s.height)) continue;
      resolved.set(e.id, {
        point: { x: (cell.x + 0.5) * U, y: (cell.y + 0.5) * U },
        zOffsetMeters: cell.z * U,
        volumeId: volume.id,
        roomId: volume.roomId,
      });
    }
  }
  return resolved;
}

export function dungeonContentAnchor(
  g: { drawing: Pick<DungeonGeometry['drawing'], 'volumes'> },
  e: DrawingElement,
) {
  return dungeonContentAnchors(g, [e]).get(e.id) ?? null;
}
