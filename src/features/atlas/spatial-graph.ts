import {
  immutable,
  parseDocument,
  isStructuredRoom,
  type MapDocument,
} from "../../model";
import { CitySource } from "../city/commands";
import { parseCityDocument } from "../city/codec";
import type { CityDocument } from "../city/model";
import { DungeonAtlasSource } from "../dungeon/atlas-source";
import { LocationSource } from "../location/location-source";
import {
  checkedLocationDocument,
  type LocationDocument,
} from "../location/location-schema";
import { sameAtlasValue, type AtlasReadView, type AtlasValue } from "./atlas-history";
import {
  checkedLocationPlacements,
  type LocationPlacement,
} from "./location-placement";
import {
  checkedSpatialState,
  checkedSpatialWorld,
  SPATIAL_TARGET,
  type CityPlacement,
  type DetailPlacement,
  type DungeonPlacement,
  type SpatialWorld,
} from "./spatial-schema";
import { rotateMeters, rotationError, type RigidFrame } from "./relative-frame";
import type { TerrainSource } from "./terrain-source";

export interface SpatialRecords {
  readonly locations: ReadonlyMap<string, LocationDocument | null>;
  readonly cities: ReadonlyMap<string, CityDocument>;
  readonly dungeons: ReadonlyMap<string, MapDocument>;
}
/** Check actual captured native documents without creating a second History or reading live owners. */
export function validateSpatialRecords(
  world: SpatialWorld,
  records: SpatialRecords,
): void {
  const types = new Set<string>();
  for (const map of [records.locations, records.cities, records.dungeons])
    for (const [id, doc] of map) {
      if (types.has(id) || id === world.id || (doc !== null && doc.id !== id))
        throw new Error("Fremde oder mehrdeutige native Snapshotkennung.");
      types.add(id);
    }
  const location = (id: string) => {
    const doc = records.locations.get(id);
    if (!doc)
      throw new Error(
        "Räumlicher Owner fehlt, ist ungeladen oder hat einen anderen Typ.",
      );
    return doc;
  };
  const city = (id: string) => {
    const doc = records.cities.get(id);
    if (!doc)
      throw new Error(
        "Räumlicher Owner fehlt, ist ungeladen oder hat einen anderen Typ.",
      );
    return doc;
  };
  const dungeon = (id: string) => {
    const doc = records.dungeons.get(id);
    if (!doc)
      throw new Error(
        "Räumlicher Owner fehlt, ist ungeladen oder hat einen anderen Typ.",
      );
    return doc;
  };
  const cityPlacement = (id: string): CityPlacement => {
    const p =
      world.version === 2
        ? world.detailPlacements.find(
            (p) => p.kind === "city" && p.documentId === id,
          )
        : undefined;
    if (!p || p.kind !== "city")
      throw new Error("Stadtparent ist nicht verortet.");
    return p;
  };
  const placements = world.version === 2 ? world.detailPlacements : [];
  const nativeIds = new Set<string>([
    world.id,
    ...world.placements.flatMap((p) => [p.id, p.locationId]),
  ]);
  const collectIds = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "id" && typeof child === "string") nativeIds.add(child);
      else collectIds(child);
    }
  };
  for (const value of [
    ...records.locations.values(),
    ...records.cities.values(),
    ...records.dungeons.values(),
  ])
    collectIds(value);
  const parentLocation = (id: string) => {
    if (!world.placements.some((p) => p.locationId === id))
      throw new Error("Ortsparent ist nicht verortet.");
    location(id);
  };
  for (const p of placements) {
    if (nativeIds.has(p.id))
      throw new Error(
        "Platzierungskennung überschneidet eine native Owner-/Elementkennung.",
      );
    if (p.parent.kind === "location") parentLocation(p.parent.locationId);
    if (p.kind === "city") {
      city(p.documentId);
      continue;
    }
    if (p.parent.kind === "city-building") {
      const cityParent = cityPlacement(p.parent.cityId);
      parentLocation(cityParent.parent.locationId);
      if (
        !city(p.parent.cityId).buildings.some(
          (b) => b.id === (p.parent as { buildingId: string }).buildingId,
        )
      )
        throw new Error("Gebundenes Haus fehlt; zuerst gemeinsam entkoppeln.");
    }
    const document = dungeon(p.documentId);
    if (!document.floors.some((f) => f.id === p.surfaceFloorId))
      throw new Error("Oberflächengeschoss fehlt.");
    for (const e of p.entrances) {
      const room = document.entities.find((r) => r.id === e.roomId),
        route = document.content.routes.find((r) => r.id === e.routeId);
      if (
        !document.floors.some((f) => f.id === e.floorId) ||
        !room ||
        !isStructuredRoom(room) ||
        room.floorId !== e.floorId ||
        !route?.entrance ||
        route.toRoomId !== e.roomId
      )
        throw new Error(
          "Dungeoneingang passt nicht zu Geschoss/Raum/semantischer Route.",
        );
    }
  }
  // Navigation carries no second placement. Local targets need actual native owner closure.
  for (const document of records.locations.values()) {
    if (!document) continue;
    for (const ref of document.detailMaps) {
      if (ref.kind === "city") city(ref.documentId);
      else dungeon(ref.documentId);
    }
    for (const ref of document.keyLinks) {
      if (ref.atlasId !== world.id) continue;
      if (ref.kind === "location") {
        const target = location(ref.documentId);
        if (
          ref.sectionId !== null &&
          !target.sections.some((s) => s.id === ref.sectionId)
        )
          throw new Error("Orts-Keyabschnitt fehlt.");
      } else {
        const room = dungeon(ref.documentId).entities.find(
          (e) => e.id === ref.roomId,
        );
        if (
          !room ||
          !isStructuredRoom(room) ||
          (ref.sectionId !== null &&
            !room.key.sections.some((s) => s.id === ref.sectionId))
        )
          throw new Error("Raum-/Keyabschnitt fehlt.");
      }
    }
  }
}

export type SpatialOwner = LocationSource | CitySource | DungeonAtlasSource;

/** Exact live owner/parent chain captured by one transient dungeon gesture. */
export interface DungeonSpatialBasis {
  readonly graph: SpatialGraph;
  readonly terrainSource: TerrainSource;
  readonly history: TerrainSource["history"];
  readonly dungeonSource: DungeonAtlasSource;
  readonly locationSource: LocationSource;
  readonly citySource?: CitySource;
  readonly dungeonPlacement: DungeonPlacement;
  readonly locationPlacement: LocationPlacement;
  readonly cityPlacement?: CityPlacement;
  readonly cityBuilding?: CityDocument["buildings"][number];
  readonly frame: RigidFrame;
}

const atlasRecord = (value: unknown): AtlasValue => value as AtlasValue;

export function sameDungeonSpatialBasis(
  before: DungeonSpatialBasis,
  after: DungeonSpatialBasis,
): boolean {
  return (
    before.graph === after.graph &&
    before.terrainSource === after.terrainSource &&
    before.history === after.history &&
    before.dungeonSource === after.dungeonSource &&
    before.locationSource === after.locationSource &&
    before.citySource === after.citySource &&
    sameAtlasValue(atlasRecord(before.dungeonPlacement), atlasRecord(after.dungeonPlacement)) &&
    sameAtlasValue(atlasRecord(before.locationPlacement), atlasRecord(after.locationPlacement)) &&
    sameAtlasValue(atlasRecord(before.cityPlacement ?? null), atlasRecord(after.cityPlacement ?? null)) &&
    sameAtlasValue(atlasRecord(before.cityBuilding ?? null), atlasRecord(after.cityBuilding ?? null)) &&
    sameAtlasValue(atlasRecord(before.frame), atlasRecord(after.frame))
  );
}
/** Only actual native adapters enter this registry; it is not an inventory-derived Campaign registry. */
export class SpatialGraph {
  private owners = new Map<string, SpatialOwner>();
  private unsubscribe: () => void;
  constructor(
    readonly source: TerrainSource,
    owners: readonly SpatialOwner[],
  ) {
    source.spatialState();
    for (const owner of owners) this.include(owner);
    this.validate(source.history);
    this.unsubscribe = source.history.addPreflight((view) => {
      this.validate(view);
    });
  }
  /** Keep native owners for the History lifetime even after detach or graphics eviction. */
  include(owner: SpatialOwner): void {
    if (
      !(
        owner instanceof LocationSource ||
        owner instanceof CitySource ||
        owner instanceof DungeonAtlasSource
      ) ||
      owner.history !== this.source.history
    )
      throw new Error("Räumlicher Owner gehört nicht zu dieser AtlasHistory.");
    const existing = this.owners.get(owner.id);
    if (existing && existing !== owner)
      throw new Error("Mehrdeutiger räumlicher Owner.");
    this.owners.set(owner.id, owner);
  }
  dispose(): void {
    this.unsubscribe();
  }
  private owner<T extends SpatialOwner>(
    id: string,
    kind: new (...args: never[]) => T,
  ): T {
    const owner = this.owners.get(id);
    if (!(owner instanceof kind))
      throw new Error(
        "Räumlicher Owner fehlt, ist ungeladen oder hat einen anderen Typ.",
      );
    return owner;
  }
  private location(id: string, view: AtlasReadView): LocationDocument {
    this.owner(id, LocationSource);
    const document = checkedLocationDocument(view.read(id, "document"));
    if (document.id !== id) throw new Error("Fremde Ortskennung.");
    return document;
  }
  private city(id: string, view: AtlasReadView): CityDocument {
    this.owner(id, CitySource);
    const document = parseCityDocument(
      JSON.stringify(view.read(id, "document")),
    );
    if (document.id !== id) throw new Error("Fremde Stadtkennung.");
    return document;
  }
  private dungeon(id: string, view: AtlasReadView) {
    this.owner(id, DungeonAtlasSource);
    const bytes = view.read(id, "document");
    if (typeof bytes !== "string") throw new Error("Dungeonbytes fehlen.");
    const document = parseDocument(bytes);
    if (document.id !== id) throw new Error("Fremde Dungeonkennung.");
    return document;
  }
  private worldAt(view: AtlasReadView): SpatialWorld {
    const state = checkedSpatialState(
      view.read(this.source.world.id, SPATIAL_TARGET),
    );
    return checkedSpatialWorld({
      ...this.source.world,
      placements: checkedLocationPlacements(
        view.read(this.source.world.id, "placements"),
      ),
      version: state.version,
      ...(state.version === 2
        ? { detailPlacements: state.detailPlacements }
        : {}),
    });
  }
  private cityPlacement(world: SpatialWorld, id: string): CityPlacement {
    const placement =
      world.version === 2
        ? world.detailPlacements.find(
            (p) => p.kind === "city" && p.documentId === id,
          )
        : undefined;
    if (!placement || placement.kind !== "city")
      throw new Error("Stadtparent ist nicht verortet.");
    return placement;
  }
  validate(view: AtlasReadView): void {
    const locations = new Map<string, LocationDocument | null>(),
      cities = new Map<string, CityDocument>(),
      dungeons = new Map<string, MapDocument>();
    for (const owner of this.owners.values()) {
      if (owner instanceof LocationSource)
        locations.set(
          owner.id,
          view.read(owner.id, "document") === null
            ? null
            : this.location(owner.id, view),
        );
      else if (owner instanceof CitySource)
        cities.set(owner.id, this.city(owner.id, view));
      else dungeons.set(owner.id, this.dungeon(owner.id, view));
    }
    validateSpatialRecords(this.worldAt(view), { locations, cities, dungeons });
  }
  world(): SpatialWorld {
    this.validate(this.source.history);
    return checkedSpatialWorld({
      ...this.worldAt(this.source.history),
      chunks: this.source.references(),
    });
  }
  frame(
    documentId: string,
    view: AtlasReadView = this.source.history,
  ): RigidFrame {
    this.validate(view);
    const world = this.worldAt(view),
      p: DetailPlacement | undefined =
        world.version === 2
          ? world.detailPlacements.find((p) => p.documentId === documentId)
          : undefined;
    if (!p) throw new Error("Detailkarte ist nicht verortet.");
    const loc = (id: string) =>
      world.placements.find((p) => p.locationId === id)!.position;
    if (p.kind === "city")
      return immutable({
        anchor: loc(p.parent.locationId),
        offsetsMeters: [p.offsetMeters],
        rotationRadians: p.rotationRadians,
        metersPerUnit: 1,
        originUnits: { x: 0, y: 0 },
        precisionMeters: 0,
      });
    return this.dungeonFrame(p, world, view, loc);
  }

  /** Resolve the existing registry and full rigid parent chain; never cache it. */
  dungeonBasis(
    documentId: string,
    view: AtlasReadView = this.source.history,
  ): DungeonSpatialBasis {
    this.validate(view);
    const world = this.worldAt(view),
      dungeonPlacement =
        world.version === 2
          ? world.detailPlacements.find(
              (placement): placement is DungeonPlacement =>
                placement.kind === "dungeon" &&
                placement.documentId === documentId,
            )
          : undefined;
    if (!dungeonPlacement) throw new Error("Dungeon ist nicht verortet.");
    const dungeonSource = this.owner(documentId, DungeonAtlasSource),
      cityPlacement =
        dungeonPlacement.parent.kind === "city-building"
          ? this.cityPlacement(world, dungeonPlacement.parent.cityId)
          : undefined,
      locationId =
        dungeonPlacement.parent.kind === "location"
          ? dungeonPlacement.parent.locationId
          : cityPlacement!.parent.locationId,
      locationPlacement = world.placements.find(
        (placement) => placement.locationId === locationId,
      ),
      locationSource = this.owner(locationId, LocationSource);
    if (!locationPlacement) throw new Error("Ortsparent ist nicht verortet.");
    const citySource = cityPlacement
        ? this.owner(cityPlacement.documentId, CitySource)
        : undefined,
      buildingId =
        dungeonPlacement.parent.kind === "city-building"
          ? dungeonPlacement.parent.buildingId
          : undefined,
      cityBuilding =
        cityPlacement && buildingId
          ? this.city(cityPlacement.documentId, view).buildings.find(
              (building) => building.id === buildingId,
            )
          : undefined;
    if (cityPlacement && !cityBuilding)
      throw new Error("Gebundenes Haus fehlt; zuerst gemeinsam entkoppeln.");
    return Object.freeze({
      graph: this,
      terrainSource: this.source,
      history: this.source.history,
      dungeonSource,
      locationSource,
      ...(citySource ? { citySource } : {}),
      dungeonPlacement,
      locationPlacement,
      ...(cityPlacement ? { cityPlacement } : {}),
      ...(cityBuilding ? { cityBuilding } : {}),
      frame: this.frame(documentId, view),
    });
  }
  private dungeonFrame(
    p: DungeonPlacement,
    world: SpatialWorld,
    view: AtlasReadView,
    loc: (id: string) => { x: number; y: number },
  ): RigidFrame {
    if (p.parent.kind === "location")
      return immutable({
        anchor: loc(p.parent.locationId),
        offsetsMeters: [p.anchor.parentPointMeters],
        rotationRadians: p.rotationRadians,
        metersPerUnit: 1.524,
        originUnits: p.anchor.mapPointFields,
        precisionMeters: 0,
      });
    const placement = this.cityPlacement(world, p.parent.cityId),
      house = this.city(p.parent.cityId, view).buildings.find(
        (b) => b.id === (p.parent as { buildingId: string }).buildingId,
      )!;
    const scaled = {
        x: p.anchor.parentPointMeters.x * house.scale.x,
        y: p.anchor.parentPointMeters.y * house.scale.y,
      },
      rotation = placement.rotationRadians + house.rotationRadians;
    const scaleError =
      (Math.abs(scaled.x) * (house.scale.x === 1 ? 0 : Number.EPSILON) +
        Math.abs(scaled.y) * (house.scale.y === 1 ? 0 : Number.EPSILON)) *
      8;
    return immutable({
      anchor: loc(placement.parent.locationId),
      offsetsMeters: [
        placement.offsetMeters,
        rotateMeters(house.position, placement.rotationRadians),
        rotateMeters(scaled, rotation),
      ],
      rotationRadians: rotation + p.rotationRadians,
      metersPerUnit: 1.524,
      originUnits: p.anchor.mapPointFields,
      precisionMeters:
        scaleError +
        rotationError(house.position, placement.rotationRadians) +
        rotationError(scaled, rotation),
    });
  }
}
