import {
  collectReservedDocumentIds,
  immutable,
  validateDungeonVolumes,
  type DungeonVolume,
  type DungeonVolumeCell,
  type MapDocument,
  type Point,
  type Polygon,
} from "../../model";
import type { Command } from "../../session";

const ALL_WALLS = Object.freeze(["north", "east", "south", "west"] as const);

export interface WalkableColumn {
  readonly x: number;
  readonly y: number;
  /** Five-foot vertical step containing the floor face. */
  readonly bottomStep: number;
  /** Defaults to two steps: ten feet of clear height. */
  readonly heightSteps?: number;
}

export type VolumeStrokeSample = WalkableColumn;

export interface WalkableAreaRaster {
  readonly polygons?: readonly Polygon[];
  readonly stroke?: { readonly points: readonly Point[]; readonly radius: number };
  readonly bottomStep: number;
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

function shellCells(columns: readonly WalkableColumn[]): readonly DungeonVolumeCell[] {
  if (!columns.length) throw new Error("Volume-Zug benötigt mindestens eine Rasterspalte.");
  const occupied = new Map<string, DungeonVolumeCell>();
  for (const column of columns) for (const cell of columnCells(column))
    occupied.set(`${cell.x}:${cell.y}:${cell.z}`, cell);
  const has = (x: number, y: number, z: number) => occupied.has(`${x}:${y}:${z}`);
  return [...occupied.values()].sort(compareCells).map(({ x, y, z }) => immutable({
    x, y, z,
    floor: !has(x, y, z - 1),
    ceiling: !has(x, y, z + 1),
    walls: ALL_WALLS.filter((wall) => wall === "north" ? !has(x, y - 1, z)
      : wall === "east" ? !has(x + 1, y, z)
      : wall === "south" ? !has(x, y + 1, z)
      : !has(x - 1, y, z)),
  }));
}

function insideRing(point: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length;
    previous = index++) {
    const a = ring[index]!, b = ring[previous]!;
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

function segmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x, dy = end.y - start.y,
    lengthSquared = dx * dx + dy * dy,
    t = lengthSquared
      ? Math.max(0, Math.min(1,
          ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
      : 0;
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/** Rasterize the same visible floor footprint into five-foot Volume columns. */
export function rasterizeWalkableArea(input: WalkableAreaRaster): readonly WalkableColumn[] {
  if (!Number.isInteger(input.bottomStep))
    throw new Error("Volume-Schnitt muss auf einem 5-Fuß-Schritt liegen.");
  const heightSteps = positiveHeight(input.heightSteps),
    points = [
      ...(input.polygons ?? []).flatMap((polygon) => polygon.outer),
      ...(input.stroke?.points ?? []),
    ];
  if (!points.length) return Object.freeze([]);
  const radius = input.stroke?.radius ?? 0,
    minX = Math.floor(Math.min(...points.map(({ x }) => x)) - radius),
    maxX = Math.ceil(Math.max(...points.map(({ x }) => x)) + radius),
    minY = Math.floor(Math.min(...points.map(({ y }) => y)) - radius),
    maxY = Math.ceil(Math.max(...points.map(({ y }) => y)) + radius),
    columns: WalkableColumn[] = [];
  for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
    const center = { x: x + 0.5, y: y + 0.5 },
      inPolygon = (input.polygons ?? []).some((polygon) =>
        insideRing(center, polygon.outer) &&
        !polygon.holes.some((hole) => insideRing(center, hole))),
      strokePoints = input.stroke?.points ?? [],
      inStroke = strokePoints.some((point, index) => index
        ? segmentDistance(center, strokePoints[index - 1]!, point) <= radius
        : strokePoints.length === 1 && Math.hypot(
          center.x - point.x, center.y - point.y,
        ) <= radius);
    if (inPolygon || inStroke)
      columns.push(immutable({ x, y, bottomStep: input.bottomStep, heightSteps }));
  }
  return Object.freeze(columns);
}

/** Rasterize every sampled pointer segment, retaining the slice selected per sample. */
export function rasterizeVolumeStroke(
  samples: readonly VolumeStrokeSample[],
): readonly WalkableColumn[] {
  if (!samples.length) return Object.freeze([]);
  const result = new Map<string, WalkableColumn>(),
    add = (column: WalkableColumn) => {
      if (![column.x, column.y, column.bottomStep].every(Number.isInteger))
        throw new Error("Volume-Zellen müssen auf dem 5-Fuß-Raster liegen.");
      const normalized = immutable({ ...column,
        heightSteps: positiveHeight(column.heightSteps) });
      result.set(`${normalized.x}:${normalized.y}:${normalized.bottomStep}`, normalized);
    };
  add(samples[0]!);
  for (let index = 1; index < samples.length; index++) {
    const from = samples[index - 1]!, to = samples[index]!,
      distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y),
        Math.abs(to.bottomStep - from.bottomStep));
    if (![from.x, from.y, from.bottomStep, to.x, to.y, to.bottomStep]
      .every(Number.isInteger))
      throw new Error("Volume-Zellen müssen auf dem 5-Fuß-Raster liegen.");
    let cursor = { x: from.x, y: from.y, bottomStep: from.bottomStep };
    for (let step = 1; step <= distance; step++) {
      const ratio = step / distance,
        target = {
          x: Math.round(from.x + (to.x - from.x) * ratio),
          y: Math.round(from.y + (to.y - from.y) * ratio),
          bottomStep: Math.round(from.bottomStep +
            (to.bottomStep - from.bottomStep) * ratio),
        };
      for (const axis of ["x", "y", "bottomStep"] as const)
        while (cursor[axis] !== target[axis]) {
          cursor = { ...cursor,
            [axis]: cursor[axis] + Math.sign(target[axis] - cursor[axis]) };
          add({ ...cursor, heightSteps: to.heightSteps });
        }
    }
  }
  return Object.freeze([...result.values()]);
}

const OPPOSITE_WALL: Readonly<Record<(typeof ALL_WALLS)[number],
  (typeof ALL_WALLS)[number]>> = Object.freeze({
    north: "south", east: "west", south: "north", west: "east",
  });

function neighborPosition(cell: Pick<DungeonVolumeCell, "x" | "y" | "z">,
  wall: (typeof ALL_WALLS)[number]): string {
  return wall === "north" ? `${cell.x}:${cell.y - 1}:${cell.z}`
    : wall === "east" ? `${cell.x + 1}:${cell.y}:${cell.z}`
    : wall === "south" ? `${cell.x}:${cell.y + 1}:${cell.z}`
    : `${cell.x - 1}:${cell.y}:${cell.z}`;
}

function cellPosition(cell: Pick<DungeonVolumeCell, "x" | "y" | "z">): string {
  return `${cell.x}:${cell.y}:${cell.z}`;
}

function setWall(cell: DungeonVolumeCell, wall: (typeof ALL_WALLS)[number],
  present: boolean): DungeonVolumeCell {
  return immutable({ ...cell, walls: present
    ? [...new Set([...cell.walls, wall])]
    : cell.walls.filter((candidate) => candidate !== wall) });
}

function setHorizontal(cell: DungeonVolumeCell, face: "floor" | "ceiling",
  present: boolean): DungeonVolumeCell {
  return immutable({ ...cell, [face]: present });
}

/** Join a brush footprint to existing horizontal geometry without crossing authored walls. */
function connectPaintedCells(
  volumes: readonly DungeonVolume[],
  footprint: ReadonlySet<string>,
): readonly DungeonVolume[] {
  const positions = new Map<string, { volume: number; cell: number }>();
  volumes.forEach((volume, volumeIndex) => volume.cells.forEach((cell, cellIndex) =>
    positions.set(cellPosition(cell), { volume: volumeIndex, cell: cellIndex })));
  const cells = volumes.map((volume) => [...volume.cells]);
  for (const key of footprint) {
    const owner = positions.get(key);
    if (!owner) continue;
    const cell = cells[owner.volume]![owner.cell]!;
    for (const wall of ALL_WALLS) {
      const otherOwner = positions.get(neighborPosition(cell, wall));
      if (!otherOwner) continue;
      const other = cells[otherOwner.volume]![otherOwner.cell]!,
        opposite = OPPOSITE_WALL[wall],
        blocked = (cell.authoredFaces?.includes(wall) && cell.walls.includes(wall)) ||
          (other.authoredFaces?.includes(opposite) && other.walls.includes(opposite));
      if (blocked) {
        cells[owner.volume]![owner.cell] = setWall(
          cells[owner.volume]![owner.cell]!, wall, true,
        );
        cells[otherOwner.volume]![otherOwner.cell] = setWall(
          cells[otherOwner.volume]![otherOwner.cell]!, opposite, true,
        );
        continue;
      }
      cells[owner.volume]![owner.cell] = setWall(
        cells[owner.volume]![owner.cell]!, wall, false,
      );
      cells[otherOwner.volume]![otherOwner.cell] = setWall(
        cells[otherOwner.volume]![otherOwner.cell]!, opposite, false,
      );
    }
    for (const delta of [-1, 1] as const) {
      const otherKey = `${cell.x}:${cell.y}:${cell.z + delta}`;
      if (!footprint.has(otherKey)) continue;
      const otherOwner = positions.get(otherKey);
      if (!otherOwner) continue;
      const lowerOwner = delta > 0 ? owner : otherOwner,
        upperOwner = delta > 0 ? otherOwner : owner,
        lower = cells[lowerOwner.volume]![lowerOwner.cell]!,
        upper = cells[upperOwner.volume]![upperOwner.cell]!,
        blocked = (lower.authoredFaces?.includes("ceiling") && lower.ceiling) ||
          (upper.authoredFaces?.includes("floor") && upper.floor);
      if (blocked) {
        cells[lowerOwner.volume]![lowerOwner.cell] =
          setHorizontal(lower, "ceiling", true);
        cells[upperOwner.volume]![upperOwner.cell] =
          setHorizontal(upper, "floor", true);
        continue;
      }
      cells[lowerOwner.volume]![lowerOwner.cell] = setHorizontal(lower, "ceiling", false);
      cells[upperOwner.volume]![upperOwner.cell] = setHorizontal(upper, "floor", false);
    }
  }
  return volumes.map((volume, index) => immutable({ ...volume, cells: cells[index]! }));
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
  validateDungeonVolumes(result.volumes ?? [], result.settings.width,
    result.settings.height, collectReservedDocumentIds(result));
  return immutable(result);
}

function verticallyOpen(a: DungeonVolumeCell, b: DungeonVolumeCell): boolean {
  return a.x === b.x && a.y === b.y && Math.abs(a.z - b.z) === 1 &&
    (a.z < b.z ? !a.ceiling && !b.floor : !b.ceiling && !a.floor);
}

function connected(a: DungeonVolumeCell, b: DungeonVolumeCell): boolean {
  if (verticallyOpen(a, b)) return true;
  if (a.z !== b.z) return false;
  if (b.x === a.x + 1 && b.y === a.y)
    return !a.walls.includes("east") && !b.walls.includes("west");
  if (b.x === a.x - 1 && b.y === a.y)
    return !a.walls.includes("west") && !b.walls.includes("east");
  if (b.y === a.y + 1 && b.x === a.x)
    return !a.walls.includes("south") && !b.walls.includes("north");
  if (b.y === a.y - 1 && b.x === a.x)
    return !a.walls.includes("north") && !b.walls.includes("south");
  return false;
}

function compareCells(left: DungeonVolumeCell, right: DungeonVolumeCell): number {
  return left.z - right.z || left.y - right.y || left.x - right.x;
}

function splitVolumes(input: readonly DungeonVolume[],
  reservedIds: ReadonlySet<string>): readonly DungeonVolume[] {
  const occupiedIds = new Set([...reservedIds, ...input.map(({ id }) => id)]),
    result: DungeonVolume[] = [];
  for (const volume of input) {
    const remaining = new Set(volume.cells), components: DungeonVolumeCell[][] = [];
    while (remaining.size) {
      const first = remaining.values().next().value as DungeonVolumeCell,
        component = [first], pending = [first];
      remaining.delete(first);
      while (pending.length) {
        const cell = pending.pop()!;
        for (const candidate of [...remaining]) if (connected(cell, candidate)) {
          remaining.delete(candidate);
          component.push(candidate);
          pending.push(candidate);
        }
      }
      components.push(component.sort(compareCells));
    }
    components.sort((left, right) => right.length - left.length ||
      compareCells(left[0]!, right[0]!));
    components.forEach((cells, index) => {
      let id = volume.id;
      if (index > 0) {
        const stem = `${volume.id}:split:${coordinateKey(cells[0]!)}`;
        id = stem;
        for (let suffix = 2; occupiedIds.has(id); suffix++) id = `${stem}:${suffix}`;
        occupiedIds.add(id);
      }
      result.push(immutable({ id, cells }));
    });
  }
  return result;
}

function coordinateKey(cell: DungeonVolumeCell): string {
  return `${cell.z}:${cell.y}:${cell.x}`;
}

/** Deterministically keep the first identity when two geometric interiors connect. */
function mergeVolumes(input: readonly DungeonVolume[]): readonly DungeonVolume[] {
  const volumes = input.map((volume) => ({ ...volume, cells: [...volume.cells] }));
  let merged = true;
  while (merged) {
    merged = false;
    mergePass: for (let left = 0; left < volumes.length; left++) {
      for (let right = left + 1; right < volumes.length; right++) {
      if (volumes[left]!.cells.some((a) =>
        volumes[right]!.cells.some((b) => connected(a, b)))) {
        volumes[left] = { id: volumes[left]!.id,
          cells: [...volumes[left]!.cells, ...volumes[right]!.cells] };
        volumes.splice(right, 1);
          merged = true;
          break mergePass;
        }
      }
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

/** Paint one connected drag as one stable geometric Volume. */
export function paintWalkableColumns(
  document: MapDocument,
  id: string,
  columns: readonly WalkableColumn[],
): MapDocument {
  if (document.version !== 4)
    throw new Error("Dungeon-Volumes benötigen Kartenformat V4.");
  if (!id.trim() || document.volumes?.some((volume) => volume.id === id))
    throw new Error("Volume-Kennung ist bereits vergeben oder ungültig.");
  const painted = shellCells(columns), occupied = new Map<string, DungeonVolumeCell>();
  for (const volume of document.volumes ?? [])
    for (const cell of volume.cells) occupied.set(cellPosition(cell), cell);
  const additions = painted.filter((cell) => !occupied.has(cellPosition(cell))),
    footprint = new Set(painted.map(cellPosition)),
    withStroke = additions.length
      ? [...(document.volumes ?? []), immutable({ id, cells: additions })]
      : [...(document.volumes ?? [])],
    volumes = mergeVolumes(connectPaintedCells(withStroke, footprint)),
    result = { ...document, volumes };
  validateDungeonVolumes(volumes, result.settings.width,
    result.settings.height, collectReservedDocumentIds(result));
  return immutable(result);
}

/** One undoable Session command for the visible ten-foot Volume paint gesture. */
export function paintWalkableColumnCommand(
  document: MapDocument,
  id: string,
  column: WalkableColumn,
): Command {
  const next = paintWalkableColumn(document, id, column);
  return immutable({
    label: "Dungeon-Volume zeichnen",
    volumes: { before: document.volumes, after: next.volumes },
  });
}


export function paintWalkableColumnsCommand(
  document: MapDocument,
  id: string,
  columns: readonly WalkableColumn[],
): Command | undefined {
  const next = paintWalkableColumns(document, id, columns);
  if (JSON.stringify(next.volumes) === JSON.stringify(document.volumes)) return undefined;
  return immutable({
    label: "Dungeon-Volume zeichnen",
    volumes: { before: document.volumes, after: next.volumes },
  });
}

/** Pure adapter shared by the real pointer flow and its integration tests. */
export function paintVolumeGestureCommand(
  document: MapDocument,
  id: string,
  samples: readonly VolumeStrokeSample[],
): Command | undefined {
  return paintWalkableColumnsCommand(document, id, rasterizeVolumeStroke(samples));
}

/** Remove the painted 3D footprint and close newly exposed automatic faces. */
export function eraseWalkableColumns(
  document: MapDocument,
  columns: readonly WalkableColumn[],
): MapDocument {
  if (document.version !== 4)
    throw new Error("Dungeon-Volumes benötigen Kartenformat V4.");
  const removed = new Set(shellCells(columns).map(cellPosition));
  let changed = false;
  const retained = (document.volumes ?? []).flatMap((volume): DungeonVolume[] => {
    const cells = volume.cells.filter((cell) => {
      const keep = !removed.has(cellPosition(cell));
      if (!keep) changed = true;
      return keep;
    }).map((cell) => {
      const authored = new Set(cell.authoredFaces ?? []);
      let next = cell;
      for (const wall of ALL_WALLS)
        if (removed.has(neighborPosition(cell, wall)) && !authored.has(wall))
          next = setWall(next, wall, true);
      const below = `${cell.x}:${cell.y}:${cell.z - 1}`,
        above = `${cell.x}:${cell.y}:${cell.z + 1}`;
      return immutable({
        ...next,
        floor: removed.has(below) && !authored.has("floor") ? true : next.floor,
        ceiling: removed.has(above) && !authored.has("ceiling")
          ? true : next.ceiling,
      });
    });
    return cells.length ? [immutable({ ...volume, cells })] : [];
  });
  if (!changed) return document;
  const volumes = splitVolumes(retained, collectReservedDocumentIds(document)),
    result = { ...document, ...(volumes.length ? { volumes } : { volumes: undefined }) };
  validateDungeonVolumes(volumes, result.settings.width,
    result.settings.height, collectReservedDocumentIds(result));
  return immutable(result);
}

export function eraseVolumeGestureCommand(
  document: MapDocument,
  samples: readonly VolumeStrokeSample[],
): Command | undefined {
  const next = eraseWalkableColumns(document, rasterizeVolumeStroke(samples));
  if (next === document) return undefined;
  return volumeMutationCommand(document, next, "Dungeon-Volume ausradieren");
}

function volumeMutationCommand(
  document: MapDocument,
  next: MapDocument,
  label: string,
): Command {
  return immutable({
    label,
    volumes: { before: document.volumes, after: next.volumes },
  });
}

export function setVolumeHeightCommand(
  document: MapDocument,
  id: string,
  heightSteps: number,
): Command {
  return volumeMutationCommand(document, setVolumeHeight(document, id, heightSteps),
    "Dungeon-Volume-Höhe ändern");
}

export function setHorizontalFaceCommand(
  document: MapDocument,
  request: Parameters<typeof setHorizontalFace>[1],
): Command {
  return volumeMutationCommand(document, setHorizontalFace(document, request),
    request.present ? "Zwischenfläche schließen" : "Zwischenfläche öffnen");
}

export function setWallFaceCommand(
  document: MapDocument,
  request: Parameters<typeof setWallFace>[1],
): Command {
  return volumeMutationCommand(document, setWallFace(document, request),
    request.present ? "Volume-Wand schließen" : "Volume-Wand öffnen");
}

export function volumeColumnsAt(
  document: MapDocument,
  x: number,
  y: number,
  activeBottomStep: number,
): readonly { readonly volumeId: string; readonly x: number; readonly y: number }[] {
  const result: { readonly volumeId: string; readonly x: number; readonly y: number }[] = [];
  for (const z of [activeBottomStep, activeBottomStep + 1])
    for (const volume of document.volumes ?? [])
      if (!result.some(({ volumeId }) => volumeId === volume.id) &&
          volume.cells.some((cell) => cell.x === x && cell.y === y && cell.z === z))
        result.push(immutable({ volumeId: volume.id, x, y }));
  return immutable(result);
}

export function volumeColumnAt(
  document: MapDocument,
  x: number,
  y: number,
  activeBottomStep: number,
): { readonly volumeId: string; readonly x: number; readonly y: number } | undefined {
  return volumeColumnsAt(document, x, y, activeBottomStep)[0];
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
  const resized: DungeonVolumeCell[] = [...columns.values()].flatMap((column) => {
    const bottom = Math.min(...column.map((cell) => cell.z));
    const targetHeight = positiveHeight(heightSteps), byStep = new Map(
      column.map((cell) => [cell.z, cell]),
    );
    return Array.from({ length: targetHeight }, (_, offset) => {
      const z = bottom + offset, retained = byStep.get(z);
      if (!retained) return immutable({ x: column[0]!.x, y: column[0]!.y, z,
        floor: offset === 0, ceiling: offset === targetHeight - 1, walls: ALL_WALLS });
      const authored = new Set(retained.authoredFaces ?? []);
      return immutable({
        ...retained,
        floor: authored.has("floor") ? retained.floor : offset === 0,
        ceiling: authored.has("ceiling")
          ? retained.ceiling : offset === targetHeight - 1,
      });
    });
  }), occupied = new Set(resized.map((cell) =>
      `${cell.x}:${cell.y}:${cell.z}`)),
    cells = resized.map((cell) => {
      const authored = new Set(cell.authoredFaces ?? []),
        neighbor = (wall: (typeof ALL_WALLS)[number]): string => wall === "north"
          ? `${cell.x}:${cell.y - 1}:${cell.z}`
          : wall === "east"
            ? `${cell.x + 1}:${cell.y}:${cell.z}`
            : wall === "south"
              ? `${cell.x}:${cell.y + 1}:${cell.z}`
              : `${cell.x - 1}:${cell.y}:${cell.z}`;
      return immutable({
        ...cell,
        walls: ALL_WALLS.filter((wall) => authored.has(wall)
          ? cell.walls.includes(wall)
          : !occupied.has(neighbor(wall))),
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
    edited = (cell: DungeonVolumeCell, face: "floor" | "ceiling",
      present: boolean): DungeonVolumeCell => immutable({
        ...cell,
        [face]: present,
        authoredFaces: [...new Set([...(cell.authoredFaces ?? []), face])],
      }),
    volumes = document.volumes!.map((candidate) => immutable({
      ...candidate,
      cells: candidate.cells.map((cell) => {
        if (candidate.id === request.volumeId && cell.x === request.x &&
            cell.y === request.y && cell.z === request.z) {
          found = true;
          return edited(cell, request.face, request.present);
        }
        if (cell.x === request.x && cell.y === request.y && cell.z === adjacentZ)
          return edited(cell, counterpart, request.present);
        return cell;
      }),
    }));
  if (!found) throw new Error("Dungeon-Volume-Zelle fehlt.");
  const normalized = request.present
      ? splitVolumes(volumes, collectReservedDocumentIds(document))
      : mergeVolumes(volumes),
    result = { ...document, volumes: normalized };
  validateDungeonVolumes(result.volumes ?? [], result.settings.width,
    result.settings.height, collectReservedDocumentIds(result));
  return immutable(result);
}

/** Toggle one vertical wall face and its adjacent counterpart atomically. */
export function setWallFace(
  document: MapDocument,
  request: { readonly volumeId: string; readonly x: number; readonly y: number;
    readonly z: number; readonly wall: (typeof ALL_WALLS)[number];
    readonly present: boolean },
): MapDocument {
  if (!ALL_WALLS.includes(request.wall))
    throw new Error("Ungültige Dungeon-Volume-Wand.");
  const source = document.volumes?.find(({ id }) => id === request.volumeId);
  if (!source) throw new Error("Dungeon-Volume fehlt.");
  let found = false;
  const origin = { x: request.x, y: request.y, z: request.z },
    adjacentKey = neighborPosition(origin, request.wall),
    opposite = OPPOSITE_WALL[request.wall],
    edited = (cell: DungeonVolumeCell, wall: (typeof ALL_WALLS)[number],
      present: boolean): DungeonVolumeCell => immutable({
        ...setWall(cell, wall, present),
        authoredFaces: [...new Set([...(cell.authoredFaces ?? []), wall])],
      }),
    volumes = document.volumes!.map((volume) => immutable({
      ...volume,
      cells: volume.cells.map((cell) => {
        if (volume.id === request.volumeId && cell.x === request.x &&
            cell.y === request.y && cell.z === request.z) {
          found = true;
          return edited(cell, request.wall, request.present);
        }
        if (cellPosition(cell) === adjacentKey)
          return edited(cell, opposite, request.present);
        return cell;
      }),
    }));
  if (!found) throw new Error("Dungeon-Volume-Zelle fehlt.");
  const normalized = request.present
      ? splitVolumes(volumes, collectReservedDocumentIds(document))
      : mergeVolumes(volumes),
    result = { ...document, volumes: normalized };
  validateDungeonVolumes(normalized, result.settings.width,
    result.settings.height, collectReservedDocumentIds(result));
  return immutable(result);
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
