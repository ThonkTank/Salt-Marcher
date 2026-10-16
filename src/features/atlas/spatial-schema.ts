import { immutable } from "../../model";
import type { AtlasChange, AtlasValue } from "./atlas-history";
import {
  nativeArray,
  nativeId,
  nativeKind,
  nativeRecord,
  nativeText,
} from "./native-values";
import { checkedLocationPlacements } from "./location-placement";
import { checkedTerrainReference } from "./terrain-schema";
import {
  parseOverworld,
  serializeOverworld,
  type OverworldDocument,
  type WorldPoint,
} from "./overworld";

export interface LocationParent {
  readonly kind: "location";
  readonly locationId: string;
}
export interface CityPlacement {
  readonly id: string;
  readonly kind: "city";
  readonly documentId: string;
  readonly parent: LocationParent;
  readonly offsetMeters: WorldPoint;
  readonly rotationRadians: number;
}
export interface DungeonEntrance {
  readonly routeId: string;
  readonly floorId: string;
  readonly roomId: string;
  readonly pointFields: WorldPoint;
}
export interface DungeonPlacement {
  readonly id: string;
  readonly kind: "dungeon";
  readonly documentId: string;
  readonly parent:
    | LocationParent
    | {
        readonly kind: "city-building";
        readonly cityId: string;
        readonly buildingId: string;
      };
  readonly anchor: {
    readonly parentPointMeters: WorldPoint;
    readonly mapPointFields: WorldPoint;
  };
  readonly rotationRadians: number;
  readonly surfaceFloorId: string;
  readonly entrances: readonly DungeonEntrance[];
}
export type DetailPlacement = CityPlacement | DungeonPlacement;
export interface SpatialState {
  readonly version: 1 | 2;
  readonly detailPlacements: readonly DetailPlacement[];
}
export interface OverworldV2 extends Omit<OverworldDocument, "version"> {
  readonly version: 2;
  readonly detailPlacements: readonly DetailPlacement[];
}
export type SpatialWorld = OverworldDocument | OverworldV2;
export const SPATIAL_TARGET = "spatial";
export function spatialNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Ungültige räumliche Zahl.");
  return value;
}
export function spatialPoint(value: unknown): WorldPoint {
  const p = nativeRecord(value, ["x", "y"]);
  return Object.freeze({ x: spatialNumber(p.x), y: spatialNumber(p.y) });
}
function locationParent(value: unknown): LocationParent {
  const p = nativeRecord(value, ["kind", "locationId"]);
  if (p.kind !== "location") throw new Error("Ungültiger Ortsparent.");
  return Object.freeze({
    kind: "location",
    locationId: nativeId(p.locationId),
  });
}
export function checkedDetailPlacements(
  value: unknown,
): readonly DetailPlacement[] {
  const ids = new Set<string>(),
    documents = new Set<string>();
  const result = nativeArray(value).map((raw): DetailPlacement => {
    const kind = nativeKind(raw),
      v = nativeRecord(
        raw,
        kind === "city"
          ? [
              "id",
              "kind",
              "documentId",
              "parent",
              "offsetMeters",
              "rotationRadians",
            ]
          : [
              "id",
              "kind",
              "documentId",
              "parent",
              "anchor",
              "rotationRadians",
              "surfaceFloorId",
              "entrances",
            ],
      );
    const id = nativeId(v.id),
      documentId = nativeId(v.documentId),
      rotationRadians = spatialNumber(v.rotationRadians);
    if (
      id === documentId ||
      ids.has(id) ||
      documents.has(documentId) ||
      documents.has(id) ||
      ids.has(documentId)
    )
      throw new Error("Doppelte oder mehrdeutige Detailplatzierung.");
    ids.add(id);
    documents.add(documentId);
    if (kind === "city")
      return Object.freeze({
        id,
        kind,
        documentId,
        parent: locationParent(v.parent),
        offsetMeters: spatialPoint(v.offsetMeters),
        rotationRadians,
      });
    if (kind !== "dungeon") throw new Error("Unbekannter Detailkartentyp.");
    const parent =
      nativeKind(v.parent) === "location"
        ? locationParent(v.parent)
        : (() => {
            const p = nativeRecord(v.parent, ["kind", "cityId", "buildingId"]);
            if (p.kind !== "city-building")
              throw new Error("Unbekannter Dungeonparent.");
            return Object.freeze({
              kind: "city-building" as const,
              cityId: nativeId(p.cityId),
              buildingId: nativeId(p.buildingId),
            });
          })();
    const a = nativeRecord(v.anchor, ["parentPointMeters", "mapPointFields"]),
      routes = new Set<string>();
    const entrances = nativeArray(v.entrances).map((raw) => {
      const e = nativeRecord(raw, [
          "routeId",
          "floorId",
          "roomId",
          "pointFields",
        ]),
        routeId = nativeId(e.routeId);
      if (routes.has(routeId)) throw new Error("Doppelter Dungeoneingang.");
      routes.add(routeId);
      return Object.freeze({
        routeId,
        floorId: nativeId(e.floorId),
        roomId: nativeId(e.roomId),
        pointFields: spatialPoint(e.pointFields),
      });
    });
    if (!entrances.length)
      throw new Error("Dungeonplatzierung benötigt einen expliziten Eingang.");
    return Object.freeze({
      id,
      kind,
      documentId,
      parent,
      anchor: Object.freeze({
        parentPointMeters: spatialPoint(a.parentPointMeters),
        mapPointFields: spatialPoint(a.mapPointFields),
      }),
      rotationRadians,
      surfaceFloorId: nativeId(v.surfaceFloorId),
      entrances: Object.freeze(entrances),
    });
  });
  return Object.freeze(result);
}
export function checkedSpatialState(value: unknown): SpatialState {
  const v = nativeRecord(value, ["version", "detailPlacements"]),
    detailPlacements = checkedDetailPlacements(v.detailPlacements);
  if (
    (v.version !== 1 && v.version !== 2) ||
    (v.version === 1 && detailPlacements.length)
  )
    throw new Error("Unbekannte räumliche Weltversion.");
  return Object.freeze({ version: v.version, detailPlacements });
}
export function spatialState(world: SpatialWorld): SpatialState {
  return checkedSpatialState({
    version: world.version,
    detailPlacements: world.version === 2 ? world.detailPlacements : [],
  });
}
const WORLD_KEYS = [
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
export function checkedSpatialWorld(value: unknown): SpatialWorld {
  const version =
    value && typeof value === "object"
      ? Object.getOwnPropertyDescriptor(value, "version")?.value
      : undefined;
  const v = nativeRecord(
    value,
    version === 2 ? [...WORLD_KEYS, "detailPlacements"] : WORLD_KEYS,
  );
  if (
    v.kind !== "overworld" ||
    (version !== 1 && version !== 2) ||
    (v.orientation !== "flat" && v.orientation !== "pointy") ||
    v.metersPerMile !== 1609.344 ||
    v.minHexMiles !== 3 ||
    v.levelFactor !== 3
  )
    throw new Error("Ungültige räumliche Weltdatei.");
  const base = parseOverworld(
    JSON.stringify({
      kind: "overworld",
      version: 1,
      id: nativeId(v.id),
      name: nativeText(v.name, true),
      orientation: v.orientation,
      origin: spatialPoint(v.origin),
      metersPerMile: 1609.344,
      minHexMiles: 3,
      levelFactor: 3,
      chunks: nativeArray(v.chunks).map(checkedTerrainReference),
      placements: checkedLocationPlacements(v.placements),
    }),
    true,
  );
  if (version === 1) return parseOverworld(JSON.stringify(value), true);
  const detailPlacements = checkedDetailPlacements(v.detailPlacements),
    reserved = new Set([
      base.id,
      ...base.placements.flatMap((p) => [p.id, p.locationId]),
    ]);
  for (const p of detailPlacements)
    if (reserved.has(p.id) || reserved.has(p.documentId))
      throw new Error("Welt-/Orts-/Detailkennungen überschneiden sich.");
  return Object.freeze({ ...base, version: 2, detailPlacements });
}
/** Separate native entry point: the existing host still rejects V2 until storage is ready. */
export function parseSpatialWorld(text: string): SpatialWorld {
  return checkedSpatialWorld(JSON.parse(text));
}
export function serializeSpatialWorld(world: SpatialWorld): string {
  const checked = checkedSpatialWorld(world);
  return checked.version === 1
    ? serializeOverworld(checked, true)
    : JSON.stringify(checked, null, 2) + "\n";
}
export function spatialBase(world: SpatialWorld): OverworldDocument {
  const checked = checkedSpatialWorld(world);
  if (checked.version === 1) return checked;
  const { detailPlacements: _details, ...base } = checked;
  return parseOverworld(JSON.stringify({ ...base, version: 1 }), true);
}
export function spatialChange(
  worldId: string,
  before: SpatialState,
  after: SpatialState,
): AtlasChange {
  return immutable({
    ownerId: nativeId(worldId),
    target: SPATIAL_TARGET,
    before: checkedSpatialState(before) as unknown as AtlasValue,
    after: checkedSpatialState(after) as unknown as AtlasValue,
  });
}
