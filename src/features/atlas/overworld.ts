import {
  checkedTerrainReference,
  terrainChunkKey,
  type TerrainReference,
} from "./terrain-schema";
import {
  checkedLocationPlacements,
  type LocationPlacement,
} from "./location-placement";
export type HexOrientation = "pointy" | "flat";
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}
export const METERS_PER_MILE = 1609.344;
export const MIN_HEX_MILES = 3;
export interface OverworldDocument {
  readonly kind: "overworld";
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly orientation: HexOrientation;
  readonly origin: WorldPoint;
  readonly metersPerMile: typeof METERS_PER_MILE;
  readonly minHexMiles: typeof MIN_HEX_MILES;
  readonly levelFactor: 3;
  readonly chunks: readonly TerrainReference[];
  readonly placements: readonly LocationPlacement[];
}
export function newOverworld(
  id: string,
  name: string,
  orientation: HexOrientation,
): OverworldDocument {
  return parseOverworld(
    JSON.stringify({
      kind: "overworld",
      version: 1,
      id,
      name: name.trim(),
      orientation,
      origin: { x: 0, y: 0 },
      metersPerMile: METERS_PER_MILE,
      minHexMiles: MIN_HEX_MILES,
      levelFactor: 3,
      chunks: [],
      placements: [],
    }),
  );
}
export function parseOverworld(
  text: string,
  locations = false,
): OverworldDocument {
  const d = JSON.parse(text) as OverworldDocument;
  if (
    !d ||
    d.kind !== "overworld" ||
    d.version !== 1 ||
    typeof d.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(d.id) ||
    typeof d.name !== "string" ||
    !d.name.trim() ||
    d.name.length > 200 ||
    !["pointy", "flat"].includes(d.orientation) ||
    !d.origin ||
    ![d.origin.x, d.origin.y].every(Number.isFinite) ||
    d.metersPerMile !== METERS_PER_MILE ||
    d.minHexMiles !== MIN_HEX_MILES ||
    d.levelFactor !== 3 ||
    !Array.isArray(d.chunks) ||
    !Array.isArray(d.placements)
  )
    throw new Error("Ungültige Atlasdatei oder unbekannter Maßstab.");
  if (d.placements.length && !locations)
    throw new Error("Diese Atlasinhalte benötigen einen neueren Editor.");
  const keys = [
    "kind",
    "version",
    "id",
    "name",
    "orientation",
    "origin",
    "metersPerMile",
    "minHexMiles",
    "levelFactor",
    "chunks",
    "placements",
  ];
  if (Object.keys(d).some((k) => !keys.includes(k)))
    throw new Error("Unbekannte Atlasdaten; Datei bleibt erhalten.");
  const chunks = d.chunks.map(checkedTerrainReference),
    chunkKeys = new Set<string>();
  for (const chunk of chunks) {
    const key = terrainChunkKey(chunk);
    if (chunkKeys.has(key)) throw new Error("Doppelter Landschaftsbereich.");
    chunkKeys.add(key);
  }
  const placements = checkedLocationPlacements(d.placements);
  if (placements.some((p) => p.locationId === d.id))
    throw new Error("Ort und Welt benötigen verschiedene Dokumentkennungen.");
  return Object.freeze({
    ...d,
    origin: Object.freeze({ ...d.origin }),
    chunks: Object.freeze(chunks),
    placements,
  });
}
export function serializeOverworld(
  document: OverworldDocument,
  locations = false,
): string {
  checkedLocationPlacements(document.placements);
  return (
    JSON.stringify(
      parseOverworld(JSON.stringify(document), locations),
      null,
      2,
    ) + "\n"
  );
}
