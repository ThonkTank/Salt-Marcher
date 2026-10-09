import type { AtlasValue } from "./atlas-history";

export const TERRAIN_CHUNK_SIZE = 32;
export interface AxialCell {
  readonly q: number;
  readonly r: number;
}
export interface TerrainCell extends AxialCell {
  readonly surface: "land" | "sea";
  readonly terrain: "plain" | "forest";
  readonly color: string;
}
export interface TerrainExtent {
  readonly minQ: number;
  readonly maxQ: number;
  readonly minR: number;
  readonly maxR: number;
}
export interface TerrainReference extends AxialCell {
  readonly level: 0;
  readonly file: string;
  readonly cellCount: number;
  readonly extent: TerrainExtent;
}
export interface TerrainChunk extends AxialCell {
  readonly kind: "atlas-terrain";
  readonly version: 1;
  readonly worldId: string;
  readonly level: 0;
  readonly cells: readonly TerrainCell[];
}
function fields(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(value, k))
  )
    throw new Error("Unbekannte oder unvollständige Landschaftsdaten.");
  return value as Record<string, unknown>;
}
export function checkedAxial(q: number, r: number): void {
  if (
    !Number.isSafeInteger(q) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(q + r)
  )
    throw new Error("Ungültige Landschaftsadresse.");
}
export function terrainTarget(a: AxialCell): string {
  checkedAxial(a.q, a.r);
  return `0/${a.q || 0}/${a.r || 0}`;
}
export function chunkAddress(a: AxialCell): AxialCell {
  checkedAxial(a.q, a.r);
  return {
    q: Math.floor(a.q / TERRAIN_CHUNK_SIZE),
    r: Math.floor(a.r / TERRAIN_CHUNK_SIZE),
  };
}
export function terrainChunkKey(a: AxialCell): string {
  checkedAxial(a.q, a.r);
  return `${a.q || 0}/${a.r || 0}`;
}
export function terrainChunkFile(a: AxialCell): string {
  checkedAxial(a.q, a.r);
  return `terrain/0_${a.q || 0}_${a.r || 0}.json`;
}
export function checkedTerrainCell(raw: unknown): TerrainCell {
  const v = fields(raw, ["q", "r", "surface", "terrain", "color"]);
  checkedAxial(v.q as number, v.r as number);
  if (
    !["land", "sea"].includes(v.surface as string) ||
    !["plain", "forest"].includes(v.terrain as string) ||
    (v.surface === "sea" && v.terrain !== "plain") ||
    typeof v.color !== "string" ||
    !/^#[0-9a-f]{6}$/.test(v.color)
  )
    throw new Error("Ungültige Landschaftseigenschaften.");
  return Object.freeze({ ...v }) as unknown as TerrainCell;
}
export function terrainValue(cell: TerrainCell | null): AtlasValue {
  return cell
    ? {
        q: cell.q,
        r: cell.r,
        surface: cell.surface,
        terrain: cell.terrain,
        color: cell.color,
      }
    : null;
}
export function validateTerrainChange(target: string, value: AtlasValue): void {
  if (!/^0\/-?(0|[1-9]\d*)\/-?(0|[1-9]\d*)$/.test(target))
    throw new Error("Ungültiges Landschaftsziel.");
  const [, q, r] = target.split("/");
  checkedAxial(Number(q), Number(r));
  if (target !== terrainTarget({ q: Number(q), r: Number(r) }))
    throw new Error("Uneindeutiges Landschaftsziel.");
  if (value !== null && terrainTarget(checkedTerrainCell(value)) !== target)
    throw new Error("Landschaftsziel stimmt nicht mit der Zelle überein.");
}
export function terrainExtent(
  cells: readonly AxialCell[],
): TerrainExtent | null {
  if (!cells.length) return null;
  let minQ = Infinity,
    minR = Infinity,
    maxQ = -Infinity,
    maxR = -Infinity;
  for (const cell of cells) {
    minQ = Math.min(minQ, cell.q);
    maxQ = Math.max(maxQ, cell.q);
    minR = Math.min(minR, cell.r);
    maxR = Math.max(maxR, cell.r);
  }
  return Object.freeze({ minQ, maxQ, minR, maxR });
}
export function checkedTerrainReference(raw: unknown): TerrainReference {
  const v = fields(raw, ["level", "q", "r", "file", "cellCount", "extent"]);
  checkedAxial(v.q as number, v.r as number);
  const e = fields(v.extent, [
    "minQ",
    "maxQ",
    "minR",
    "maxR",
  ]) as unknown as TerrainExtent;
  checkedAxial(e.minQ, e.minR);
  checkedAxial(e.maxQ, e.maxR);
  if (
    v.level !== 0 ||
    v.file !== terrainChunkFile(v as unknown as AxialCell) ||
    !Number.isInteger(v.cellCount) ||
    (v.cellCount as number) < 1 ||
    (v.cellCount as number) > TERRAIN_CHUNK_SIZE ** 2 ||
    e.minQ > e.maxQ ||
    e.minR > e.maxR ||
    [
      { q: e.minQ, r: e.minR },
      { q: e.maxQ, r: e.maxR },
    ].some(
      (a) =>
        terrainChunkKey(chunkAddress(a)) !==
        terrainChunkKey(v as unknown as AxialCell),
    )
  )
    throw new Error("Ungültiger Landschaftsbereich.");
  return Object.freeze({
    ...v,
    extent: Object.freeze({ ...e }),
  }) as unknown as TerrainReference;
}
export function parseTerrainChunk(
  text: string,
  worldId: string,
  reference: TerrainReference,
): TerrainChunk {
  const v = fields(JSON.parse(text), [
    "kind",
    "version",
    "worldId",
    "level",
    "q",
    "r",
    "cells",
  ]);
  if (
    v.kind !== "atlas-terrain" ||
    v.version !== 1 ||
    v.worldId !== worldId ||
    v.level !== 0 ||
    v.q !== reference.q ||
    v.r !== reference.r ||
    !Array.isArray(v.cells) ||
    v.cells.length !== reference.cellCount
  )
    throw new Error("Landschaftsbereich passt nicht zum Atlas.");
  const cells = v.cells.map(checkedTerrainCell),
    targets = new Set<string>();
  for (const cell of cells) {
    const key = terrainTarget(cell);
    if (
      targets.has(key) ||
      terrainChunkKey(chunkAddress(cell)) !== terrainChunkKey(reference)
    )
      throw new Error("Doppelte oder fremde Landschaftszelle.");
    targets.add(key);
  }
  const extent = terrainExtent(cells)!;
  if (
    Object.keys(extent).some(
      (k) =>
        extent[k as keyof TerrainExtent] !==
        reference.extent[k as keyof TerrainExtent],
    )
  )
    throw new Error("Landschaftszusammenfassung stimmt nicht.");
  return Object.freeze({
    kind: "atlas-terrain",
    version: 1,
    worldId,
    level: 0,
    q: reference.q,
    r: reference.r,
    cells: Object.freeze(cells),
  });
}
export function serializeTerrainChunk(chunk: TerrainChunk): string {
  const reference = checkedTerrainReference({
    level: 0,
    q: chunk.q,
    r: chunk.r,
    file: terrainChunkFile(chunk),
    cellCount: chunk.cells.length,
    extent: terrainExtent(chunk.cells),
  });
  const checked = parseTerrainChunk(
    JSON.stringify(chunk),
    chunk.worldId,
    reference,
  );
  return (
    JSON.stringify(
      {
        ...checked,
        cells: [...checked.cells].sort((a, b) => a.q - b.q || a.r - b.r),
      },
      null,
      2,
    ) + "\n"
  );
}
