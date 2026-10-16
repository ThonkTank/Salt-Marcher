import { parseDocument, type MapDocument } from "../../model";
import { parseCityDocument } from "../city/codec";
import type { CityDocument } from "../city/model";
import {
  parseLocationDocument,
  type LocationDocument,
} from "../location/location-schema";
import type { DetailKind, DetailRecord } from "./detail-record";
import { validateSpatialRecords, type SpatialRecords } from "./spatial-graph";
import type { SpatialWorld } from "./spatial-schema";

export function spatialRecords(
  locations: ReadonlyMap<string, string | null>,
  details: ReadonlyMap<string, DetailRecord>,
): SpatialRecords {
  const places = new Map<string, LocationDocument | null>(),
    cities = new Map<string, CityDocument>(),
    dungeons = new Map<string, MapDocument>();
  for (const [id, raw] of locations)
    places.set(id, raw === null ? null : parseLocationDocument(raw));
  for (const [id, r] of details) {
    if (r.id !== id) throw new Error("Fremde Detailsnapshotkennung.");
    if (r.kind === "city") cities.set(id, parseCityDocument(r.bytes));
    else dungeons.set(id, parseDocument(r.bytes));
  }
  return { locations: places, cities, dungeons };
}
export function checkSpatialSnapshot(
  world: SpatialWorld,
  locations: ReadonlyMap<string, string | null>,
  details: ReadonlyMap<string, DetailRecord>,
): void {
  validateSpatialRecords(world, spatialRecords(locations, details));
}
/** Actual local references, not guessed unloaded records or Campaign ownership authority. */
export function detailReferences(
  world: SpatialWorld,
  locations: ReadonlyMap<string, string | null>,
): ReadonlyMap<string, DetailKind> {
  const refs = new Map<string, DetailKind>();
  const add = (kind: DetailKind, id: string) => {
    if (refs.has(id) && refs.get(id) !== kind)
      throw new Error("Mehrdeutiger Detailkartentyp.");
    refs.set(id, kind);
  };
  if (world.version === 2)
    for (const p of world.detailPlacements) add(p.kind, p.documentId);
  for (const raw of locations.values()) {
    if (raw === null) continue;
    const doc = parseLocationDocument(raw);
    for (const ref of doc.detailMaps) add(ref.kind, ref.documentId);
    for (const ref of doc.keyLinks)
      if (ref.kind === "room" && ref.atlasId === world.id)
        add("dungeon", ref.documentId);
  }
  return refs;
}
