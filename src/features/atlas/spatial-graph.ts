import { immutable, parseDocument, isStructuredRoom } from "../../model";
import { CitySource } from "../city/commands";
import { parseCityDocument } from "../city/codec";
import type { CityDocument } from "../city/model";
import { DungeonAtlasSource } from "../dungeon/atlas-source";
import { LocationSource } from "../location/location-source";
import {
  checkedLocationDocument,
  type LocationDocument,
} from "../location/location-schema";
import type { AtlasReadView } from "./atlas-history";
import { checkedLocationPlacements } from "./location-placement";
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

export type SpatialOwner = LocationSource | CitySource | DungeonAtlasSource;
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
    const world = this.worldAt(view),
      placements = world.version === 2 ? world.detailPlacements : [];
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
    for (const owner of this.owners.values()) {
      const value = view.read(owner.id, "document");
      collectIds(
        owner instanceof DungeonAtlasSource
          ? this.dungeon(owner.id, view)
          : value,
      );
    }
    const parentLocation = (id: string) => {
      if (!world.placements.some((p) => p.locationId === id))
        throw new Error("Ortsparent ist nicht verortet.");
      this.location(id, view);
    };
    for (const p of placements) {
      if (nativeIds.has(p.id))
        throw new Error(
          "Platzierungskennung überschneidet eine native Owner-/Elementkennung.",
        );
      if (p.parent.kind === "location") parentLocation(p.parent.locationId);
      if (p.kind === "city") {
        this.city(p.documentId, view);
        continue;
      }
      if (p.parent.kind === "city-building") {
        const cityParent = this.cityPlacement(world, p.parent.cityId);
        parentLocation(cityParent.parent.locationId);
        if (
          !this.city(p.parent.cityId, view).buildings.some(
            (b) => b.id === (p.parent as { buildingId: string }).buildingId,
          )
        )
          throw new Error(
            "Gebundenes Haus fehlt; zuerst gemeinsam entkoppeln.",
          );
      }
      const document = this.dungeon(p.documentId, view);
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
    for (const owner of this.owners.values()) {
      if (
        !(owner instanceof LocationSource) ||
        view.read(owner.id, "document") === null
      )
        continue;
      const location = this.location(owner.id, view);
      for (const ref of location.detailMaps) {
        if (ref.kind === "city") this.city(ref.documentId, view);
        else this.dungeon(ref.documentId, view);
      }
      for (const ref of location.keyLinks) {
        if (ref.atlasId !== world.id) continue;
        if (ref.kind === "location") {
          const target = this.location(ref.documentId, view);
          if (
            ref.sectionId !== null &&
            !target.sections.some((s) => s.id === ref.sectionId)
          )
            throw new Error("Orts-Keyabschnitt fehlt.");
        } else {
          const room = this.dungeon(ref.documentId, view).entities.find(
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
