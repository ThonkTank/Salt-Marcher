import type {
  DungeonVolumeCell,
  MapDocument,
} from "../../model";
import {
  projectVolumeSlice,
  type VolumeSliceRelation,
} from "./volume";

const RELATION_ORDER: Readonly<Record<VolumeSliceRelation, number>> = {
  active: 0,
  below: 1,
  above: 2,
};
export interface VolumeSliceFaceSet {
  readonly volumeId: string;
  readonly cell: DungeonVolumeCell;
}

/** One deterministic XY tile. Active facts hide onion-slice facts at the same XY. */
export interface ComposedVolumeSliceCell {
  readonly x: number;
  readonly y: number;
  readonly relation: VolumeSliceRelation;
  readonly faces: readonly VolumeSliceFaceSet[];
}

export interface DungeonViewportBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function composeVolumeSlice(
  document: MapDocument,
  activeBottomStep: number,
): readonly ComposedVolumeSliceCell[] {
  const byXY = new Map<string, {
    x: number;
    y: number;
    relation: VolumeSliceRelation;
    faces: VolumeSliceFaceSet[];
  }>();
  for (const projection of projectVolumeSlice(document, activeBottomStep)) {
    const { x, y } = projection.cell, key = `${x}:${y}`,
      present = byXY.get(key);
    if (!present || RELATION_ORDER[projection.relation] <
        RELATION_ORDER[present.relation]) {
      byXY.set(key, {
        x, y, relation: projection.relation,
        faces: [{ volumeId: projection.volumeId, cell: projection.cell }],
      });
    } else if (projection.relation === present.relation) {
      present.faces.push({ volumeId: projection.volumeId, cell: projection.cell });
    }
  }
  return Object.freeze([...byXY.values()]
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .map(({ x, y, relation, faces }) => Object.freeze({
      x, y, relation,
      faces: Object.freeze(faces.sort((left, right) =>
        left.cell.z - right.cell.z ||
        (left.volumeId < right.volumeId ? -1 :
          left.volumeId > right.volumeId ? 1 : 0))),
    })));
}

/** The legacy map rectangle and every sparse Volume cell share one fit/mask hull. */
export function dungeonViewportBounds(document: MapDocument): DungeonViewportBounds {
  let minX = 0, minY = 0,
    maxX = document.settings.width, maxY = document.settings.height;
  for (const volume of document.volumes ?? [])
    for (const cell of volume.cells) {
      minX = Math.min(minX, cell.x);
      minY = Math.min(minY, cell.y);
      maxX = Math.max(maxX, cell.x + 1);
      maxY = Math.max(maxY, cell.y + 1);
    }
  return Object.freeze({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  });
}
