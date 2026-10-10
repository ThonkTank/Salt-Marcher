import { parseDocument, serializeDocument } from "../../model";
import { parseCityDocument, serializeCityDocument } from "../city/codec";
import {
  parseLocationDocument,
  serializeLocationDocument,
} from "../location/location-schema";
import { nativeId } from "./native-values";
import { newDetailPath, type DetailRecord } from "./detail-record";
import { checkedSpatialWorld, type SpatialWorld } from "./spatial-schema";
import { checkSpatialSnapshot } from "./spatial-storage";

const REF_KEYS = new Set([
  "id",
  "floorId",
  "roomId",
  "sectionId",
  "doorId",
  "boundaryId",
  "entityId",
  "textId",
  "fromRoomId",
  "toRoomId",
  "startNodeId",
  "endNodeId",
  "plotId",
  "districtId",
  "buildingId",
]);
function localIds(value: unknown, result = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    if (key === "definitions") continue; // Shared definitions/catalog identity is retained.
    if (key === "id" && typeof child === "string") result.add(child);
    else localIds(child, result);
  }
  return result;
}
function remapNative(
  value: unknown,
  ids: ReadonlyMap<string, string>,
  key = "",
): unknown {
  if (typeof value === "string")
    return REF_KEYS.has(key) || key === "prerequisites"
      ? (ids.get(value) ?? value)
      : value;
  if (Array.isArray(value)) return value.map((v) => remapNative(v, ids, key));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      k === "definitions" ? v : remapNative(v, ids, k),
    ]),
  );
}
/** Remaps actual native local IDs in their document scope; text, assets and shared definitions are untouched. */
export function remapSpatialCopy(
  world: SpatialWorld,
  locations: ReadonlyMap<string, string | null>,
  details: ReadonlyMap<string, DetailRecord>,
  worldId: string,
  name: string,
  makeId: () => string,
) {
  checkSpatialSnapshot(world, locations, details);
  const docs = new Map<string, unknown>();
  for (const [id, raw] of locations) {
    if (raw === null) throw new Error("Kopierort fehlt.");
    docs.set(id, parseLocationDocument(raw));
  }
  for (const [id, r] of details)
    docs.set(
      id,
      r.kind === "city" ? parseCityDocument(r.bytes) : parseDocument(r.bytes),
    );
  const reserved = new Set<string>([
    world.id,
    ...world.placements.flatMap((p) => [p.id, p.locationId]),
    ...(world.version === 2 ? world.detailPlacements.map((p) => p.id) : []),
  ]);
  const allIds = (v: unknown) => {
    if (v && typeof v === "object")
      for (const [k, c] of Object.entries(v)) {
        if (k === "id" && typeof c === "string") reserved.add(c);
        else allIds(c);
      }
  };
  for (const doc of docs.values()) allIds(doc);
  nativeId(worldId);
  if (reserved.has(worldId))
    throw new Error("Neue Weltkennung überschneidet native Identitäten.");
  reserved.add(worldId);
  const allocate = () => {
    const id = nativeId(makeId());
    if (reserved.has(id))
      throw new Error("Kopie benötigt neue eindeutige Kennungen.");
    reserved.add(id);
    return id;
  };
  const documentIds = new Map([...docs.keys()].map((id) => [id, allocate()])),
    scoped = new Map<string, Map<string, string>>();
  for (const [id, doc] of docs)
    scoped.set(
      id,
      new Map(
        [...localIds(doc)].map((local) => [
          local,
          local === id ? documentIds.get(id)! : allocate(),
        ]),
      ),
    );
  const local = (doc: string, id: string) => {
    const next = scoped.get(doc)?.get(id);
    if (!next) throw new Error("Lokale Kopierreferenz fehlt.");
    return next;
  };
  const nextLocations = new Map<string, string | null>();
  for (const [id, raw] of locations) {
    const doc = parseLocationDocument(raw!),
      nextId = documentIds.get(id)!;
    const keyLinks = doc.keyLinks.map((ref) =>
      ref.atlasId !== world.id
        ? ref
        : {
            ...ref,
            atlasId: worldId,
            documentId:
              documentIds.get(ref.documentId) ??
              (() => {
                throw new Error("Lokaler Keyowner fehlt in der Kopierclosure.");
              })(),
            sectionId:
              ref.sectionId === null
                ? null
                : local(ref.documentId, ref.sectionId),
            ...(ref.kind === "room"
              ? { roomId: local(ref.documentId, ref.roomId) }
              : {}),
          },
    );
    nextLocations.set(
      nextId,
      serializeLocationDocument({
        ...doc,
        id: nextId,
        sections: doc.sections.map((s) => ({ ...s, id: local(id, s.id) })),
        detailMaps: doc.detailMaps.map((ref) => ({
          ...ref,
          documentId:
            documentIds.get(ref.documentId) ??
            (() => {
              throw new Error("Ortsdetail fehlt in der Kopierclosure.");
            })(),
        })),
        keyLinks,
      }),
    );
  }
  const nextDetails = new Map<string, DetailRecord>();
  for (const [id, r] of details) {
    const nextId = documentIds.get(id)!,
      value = remapNative(docs.get(id), scoped.get(id)!);
    const bytes =
      r.kind === "city"
        ? serializeCityDocument(parseCityDocument(JSON.stringify(value)))
        : serializeDocument(parseDocument(JSON.stringify(value)));
    nextDetails.set(nextId, {
      kind: r.kind,
      id: nextId,
      path: newDetailPath(r.kind, nextId),
      bytes,
    });
  }
  const placements = world.placements.map((p) => ({
    ...p,
    id: allocate(),
    locationId: documentIds.get(p.locationId)!,
  }));
  const detailPlacements =
    world.version !== 2
      ? undefined
      : world.detailPlacements.map((p) => {
          if (p.kind === "city")
            return {
              ...p,
              id: allocate(),
              documentId: documentIds.get(p.documentId)!,
              parent: {
                ...p.parent,
                locationId: documentIds.get(p.parent.locationId)!,
              },
            };
          const parent =
            p.parent.kind === "location"
              ? {
                  ...p.parent,
                  locationId: documentIds.get(p.parent.locationId)!,
                }
              : {
                  ...p.parent,
                  cityId: documentIds.get(p.parent.cityId)!,
                  buildingId: local(p.parent.cityId, p.parent.buildingId),
                };
          return {
            ...p,
            id: allocate(),
            documentId: documentIds.get(p.documentId)!,
            parent,
            surfaceFloorId: local(p.documentId, p.surfaceFloorId),
            entrances: p.entrances.map((e) => ({
              ...e,
              routeId: local(p.documentId, e.routeId),
              floorId: local(p.documentId, e.floorId),
              roomId: local(p.documentId, e.roomId),
            })),
          };
        });
  const next = checkedSpatialWorld({
    ...world,
    id: worldId,
    name,
    placements,
    ...(world.version === 2 ? { detailPlacements } : {}),
  });
  checkSpatialSnapshot(next, nextLocations, nextDetails);
  return { world: next, locations: nextLocations, details: nextDetails };
}
