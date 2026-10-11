import {
  immutable,
  validateDocument,
  type DungeonVolume,
  type DungeonVolumeCell,
  type MapDocument,
} from "../../model";

const ALL_WALLS = Object.freeze(["north", "east", "south", "west"] as const);

export interface WalkableColumn {
  readonly x: number;
  readonly y: number;
  /** Five-foot vertical step containing the floor face. */
  readonly bottomStep: number;
  /** Defaults to two steps: ten feet of clear height. */
  readonly heightSteps?: number;
}

function positiveHeight(value: number | undefined): number {
  const height = value ?? 2;
  if (!Number.isInteger(height) || height < 1)
    throw new Error("Volume-Höhe muss ein positiver 5-Fuß-Schritt sein.");
  return height;
}

function columnCells(column: WalkableColumn): readonly DungeonVolumeCell[] {
  const height = positiveHeight(column.heightSteps);
  if (![column.x, column.y, column.bottomStep].every(Number.isInteger))
    throw new Error("Volume-Zellen müssen auf dem 5-Fuß-Raster liegen.");
  return Object.freeze(Array.from({ length: height }, (_, offset) => immutable({
    x: column.x,
    y: column.y,
    z: column.bottomStep + offset,
    floor: offset === 0,
    ceiling: offset === height - 1,
    walls: ALL_WALLS,
  })));
}

function replaceVolume(
  document: MapDocument,
  volume: DungeonVolume,
  mergeOpenConnections = false,
): MapDocument {
  const volumes = document.volumes ?? [],
    index = volumes.findIndex((candidate) => candidate.id === volume.id),
    next = index < 0
      ? [...volumes, volume]
      : volumes.map((candidate, at) => at === index ? volume : candidate),
    result = { ...document, volumes: mergeOpenConnections ? mergeVolumes(next) : next };
  validateDocument(result);
  return immutable(result);
}

function verticallyOpen(a: DungeonVolumeCell, b: DungeonVolumeCell): boolean {
  return a.x === b.x && a.y === b.y && Math.abs(a.z - b.z) === 1 &&
    (a.z < b.z ? !a.ceiling && !b.floor : !b.ceiling && !a.floor);
}

/** Deterministically keep the first identity when two geometric interiors connect. */
function mergeVolumes(input: readonly DungeonVolume[]): readonly DungeonVolume[] {
  const volumes = input.map((volume) => ({ ...volume, cells: [...volume.cells] }));
  for (let left = 0; left < volumes.length; left++) {
    for (let right = left + 1; right < volumes.length;) {
      if (volumes[left]!.cells.some((a) =>
        volumes[right]!.cells.some((b) => verticallyOpen(a, b)))) {
        volumes[left] = { id: volumes[left]!.id,
          cells: [...volumes[left]!.cells, ...volumes[right]!.cells] };
        volumes.splice(right, 1);
      } else right++;
    }
  }
  return volumes.map((volume) => immutable(volume));
}

/** Paint one ordinary walkable column: floor, interior and default ceiling together. */
export function paintWalkableColumn(
  document: MapDocument,
  id: string,
  column: WalkableColumn,
): MapDocument {
  if (document.version !== 4)
    throw new Error("Dungeon-Volumes benötigen Kartenformat V4.");
  if (!id || document.volumes?.some((volume) => volume.id === id))
    throw new Error("Volume-Kennung ist bereits vergeben oder ungültig.");
  return replaceVolume(document, immutable({ id, cells: columnCells(column) }));
}

/** Change clear height while retaining the stable geometric Volume identity. */
export function setVolumeHeight(
  document: MapDocument,
  id: string,
  heightSteps: number,
): MapDocument {
  const volume = document.volumes?.find((candidate) => candidate.id === id);
  if (!volume) throw new Error("Dungeon-Volume fehlt.");
  const columns = new Map<string, DungeonVolumeCell[]>();
  for (const cell of volume.cells) {
    const key = `${cell.x}:${cell.y}`,
      cells = columns.get(key) ?? [];
    cells.push(cell);
    columns.set(key, cells);
  }
  const cells = [...columns.values()].flatMap((column) => {
    const bottom = Math.min(...column.map((cell) => cell.z));
    const targetHeight = positiveHeight(heightSteps), byStep = new Map(
      column.map((cell) => [cell.z, cell]),
    );
    return Array.from({ length: targetHeight }, (_, offset) => {
      const z = bottom + offset, retained = byStep.get(z);
      return retained ?? immutable({ x: column[0]!.x, y: column[0]!.y, z,
        floor: false, ceiling: offset === targetHeight - 1, walls: ALL_WALLS });
    });
  });
  return replaceVolume(document, immutable({ id, cells }));
}

/** Toggle a horizontal boundary without changing traversable cells or identity. */
export function setHorizontalFace(
  document: MapDocument,
  request: { readonly volumeId: string; readonly x: number; readonly y: number;
    readonly z: number; readonly face: "floor" | "ceiling"; readonly present: boolean },
): MapDocument {
  const volume = document.volumes?.find(({ id }) => id === request.volumeId);
  if (!volume) throw new Error("Dungeon-Volume fehlt.");
  let found = false;
  const adjacentZ = request.face === "ceiling" ? request.z + 1 : request.z - 1,
    counterpart = request.face === "ceiling" ? "floor" : "ceiling",
    volumes = document.volumes!.map((candidate) => immutable({
      ...candidate,
      cells: candidate.cells.map((cell) => {
        if (candidate.id === request.volumeId && cell.x === request.x &&
            cell.y === request.y && cell.z === request.z) {
          found = true;
          return immutable({ ...cell, [request.face]: request.present });
        }
        if (cell.x === request.x && cell.y === request.y && cell.z === adjacentZ)
          return immutable({ ...cell, [counterpart]: request.present });
        return cell;
      }),
    }));
  if (!found) throw new Error("Dungeon-Volume-Zelle fehlt.");
  const changed = volumes.find(({ id }) => id === request.volumeId)!;
  return replaceVolume({ ...document, volumes }, changed, !request.present);
}

export type VolumeSliceRelation = "active" | "below" | "above";
export interface ProjectedVolumeCell {
  readonly volumeId: string;
  readonly cell: DungeonVolumeCell;
  readonly relation: VolumeSliceRelation;
}

/** A normal 2D story spans two steps; one adjacent step is onion-sliced per side. */
export function projectVolumeSlice(
  document: MapDocument,
  activeBottomStep: number,
): readonly ProjectedVolumeCell[] {
  if (!Number.isInteger(activeBottomStep))
    throw new Error("Schnitt muss auf einem 5-Fuß-Schritt liegen.");
  return immutable((document.volumes ?? []).flatMap((volume) =>
    volume.cells.flatMap((cell): ProjectedVolumeCell[] => {
      const relation = cell.z === activeBottomStep - 1 ? "below"
        : cell.z === activeBottomStep || cell.z === activeBottomStep + 1 ? "active"
        : cell.z === activeBottomStep + 2 ? "above" : undefined;
      return relation ? [{ volumeId: volume.id, cell, relation }] : [];
    })));
}
