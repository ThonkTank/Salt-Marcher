import { Graphics } from "pixi.js";
import { inside, nearestSegmentPoint } from "../../geometry";
import { isStructuredRoom, type RoomV4 } from "../../model";
import { CitySource } from "../city/commands";
import { parseCityDocument, serializeCityDocument } from "../city/codec";
import { CityRenderer } from "../city/renderer";
import {
  cityScene,
  hitCity,
  type CityHit,
  type CityScene,
} from "../city/scene";
import type { CityDocument } from "../city/model";
import { DungeonAtlasSource } from "../dungeon/atlas-source";
import type { AtlasRenderer } from "./atlas-renderer";
import type { AtlasReadView, AtlasValue } from "./atlas-history";
import {
  projectLocal,
  relativeLocalMeters,
  unprojectLocal,
  type RigidFrame,
} from "./relative-frame";
import type { SpatialGraph } from "./spatial-graph";
import type { WorldPoint } from "./overworld";
import type { TerrainSource } from "./terrain-source";

export interface SpatialCanvasAccess {
  graph(): SpatialGraph;
  source(): TerrainSource;
  city(id: string): CitySource;
  dungeon(id: string): DungeonAtlasSource;
}
export type SpatialHit =
  | { kind: "city"; hit: CityHit; frame: RigidFrame }
  | { kind: "room"; ownerId: string; roomId: string };
type CityDisplay = { scene: CityScene; frame: RigidFrame; nodes: boolean };
type RoomDisplay = { ownerId: string; room: RoomV4; frame: RigidFrame };
/** Display-only montage. All source reads, previews and hit coordinates share the host camera/history. */
export class SpatialCanvas {
  private cities = new Map<string, CityRenderer>();
  private readonly rooms = new Graphics();
  private cityDisplays: CityDisplay[] = [];
  private roomDisplays: RoomDisplay[] = [];
  private roomLOD = new Set<string>();
  selection?: CityHit;
  selectedRoom?: { ownerId: string; roomId: string };
  preview?: CityDocument;
  constructor(
    private renderer: AtlasRenderer,
    private access: SpatialCanvasAccess,
  ) {
    renderer.detailLayer.addChild(this.rooms);
  }
  private view(): AtlasReadView {
    const source = this.access.source(),
      history = source.history;
    const overrides = new Map<string, AtlasValue>();
    if (this.preview)
      overrides.set(
        this.preview.id + "/document",
        JSON.parse(serializeCityDocument(this.preview)) as AtlasValue,
      );
    if (this.renderer.locationPreview)
      overrides.set(
        source.world.id + "/placements",
        source
          .placements()
          .map((p) =>
            p.locationId === this.renderer.locationPreview!.id
              ? { ...p, position: this.renderer.locationPreview!.position }
              : p,
          ) as unknown as AtlasValue,
      );
    return {
      read: (owner, target) =>
        overrides.get(owner + "/" + target) ?? history.read(owner, target),
      entries: (owner) =>
        history
          .entries(owner)
          .map(([target, value]) => [
            target,
            overrides.get(owner + "/" + target) ?? value,
          ]),
    };
  }
  fitPoints(): readonly { frame: RigidFrame; point: WorldPoint }[] {
    const graph = this.access.graph(),
      world = graph.world();
    if (world.version !== 2) return [];
    return world.detailPlacements.flatMap((p) => {
      const frame = graph.frame(p.documentId);
      if (p.kind === "dungeon")
        return this.access
          .dungeon(p.documentId)
          .read()
          .document.entities.filter(isStructuredRoom)
          .filter((r) => r.floorId === p.surfaceFloorId)
          .flatMap((r) =>
            r.polygons.flatMap((poly) =>
              poly.outer.map((point) => ({ frame, point })),
            ),
          );
      const extent = cityScene(this.access.city(p.documentId).read()).extent;
      return extent
        ? [
            { frame, point: { x: extent.minX, y: extent.minY } },
            { frame, point: { x: extent.maxX, y: extent.minY } },
            { frame, point: { x: extent.maxX, y: extent.maxY } },
            { frame, point: { x: extent.minX, y: extent.maxY } },
          ]
        : [];
    });
  }
  private near(frame: RigidFrame, point: WorldPoint): boolean {
    const camera = this.renderer.relativeCamera;
    const relative = relativeLocalMeters(
      frame,
      { ...camera, metersPerPixel: 1e15 },
      point,
    );
    return (
      Math.max(Math.abs(relative.x), Math.abs(relative.y)) /
        camera.metersPerPixel <
      1e10
    );
  }
  draw(): void {
    const graph = this.access.graph(),
      world = graph.world(),
      view = this.view(),
      camera = this.renderer.relativeCamera,
      viewport = this.renderer.viewport;
    this.cityDisplays = [];
    this.roomDisplays = [];
    this.rooms.clear();
    for (const r of this.cities.values()) r.container.visible = false;
    const placements = world.version === 2 ? world.detailPlacements : [],
      hiddenRoofs = new Map<string, Set<string>>();
    for (const p of placements) {
      if (p.kind !== "dungeon") continue;
      const frame = graph.frame(p.documentId, view),
        document = this.access.dungeon(p.documentId).read().document;
      const rooms = document.entities
        .filter(isStructuredRoom)
        .filter((r) => r.floorId === p.surfaceFloorId)
        .sort((a, b) => a.layer - b.layer);
      const points = rooms.flatMap((r) => r.polygons.flatMap((p) => p.outer));
      if (!points.length) continue;
      if (!points.some((point) => this.near(frame, point))) {
        this.roomLOD.delete(p.documentId);
        continue;
      }
      const projected = points.map((point) =>
        projectLocal(frame, camera, viewport, point),
      );
      const width =
        Math.max(...projected.map((p) => p.x)) -
        Math.min(...projected.map((p) => p.x));
      const height =
        Math.max(...projected.map((p) => p.y)) -
        Math.min(...projected.map((p) => p.y));
      const visible =
        Math.min(width, height) >= (this.roomLOD.has(p.documentId) ? 56 : 80);
      if (!visible) {
        this.roomLOD.delete(p.documentId);
        continue;
      }
      this.roomLOD.add(p.documentId);
      if (p.parent.kind === "city-building") {
        const set = hiddenRoofs.get(p.parent.cityId) ?? new Set<string>();
        set.add(p.parent.buildingId);
        hiddenRoofs.set(p.parent.cityId, set);
      }
      for (const room of rooms)
        this.roomDisplays.push({ ownerId: p.documentId, room, frame });
    }
    for (const p of placements) {
      if (p.kind !== "city") continue;
      const frame = graph.frame(p.documentId, view),
        document = parseCityDocument(
          JSON.stringify(view.read(p.documentId, "document")),
        ),
        original = cityScene(document);
      if (!original.extent) continue;
      if (
        !this.near(frame, {
          x: original.extent.minX / 2 + original.extent.maxX / 2,
          y: original.extent.minY / 2 + original.extent.maxY / 2,
        })
      )
        continue;
      const a = projectLocal(frame, camera, viewport, {
          x: original.extent.minX,
          y: original.extent.minY,
        }),
        b = projectLocal(frame, camera, viewport, {
          x: original.extent.maxX,
          y: original.extent.maxY,
        });
      if (Math.hypot(a.x - b.x, a.y - b.y) < 16) continue;
      const scene = {
        ...original,
        shapes: original.shapes.filter(
          (s) =>
            s.kind !== "building" ||
            !hiddenRoofs.get(p.documentId)?.has(s.elementId),
        ),
      };
      const nodes = this.selection?.ownerId === p.documentId;
      let drawing = this.cities.get(p.documentId);
      if (!drawing) {
        drawing = new CityRenderer();
        this.cities.set(p.documentId, drawing);
        this.renderer.detailLayer.addChildAt(
          drawing.container,
          this.renderer.detailLayer.children.length - 1,
        );
      }
      drawing.container.visible = true;
      drawing.draw(
        scene,
        (point) => projectLocal(frame, camera, viewport, point),
        { selection: this.selection, showNodes: nodes },
      );
      this.cityDisplays.push({ scene, frame, nodes });
    }
    for (const { room, frame, ownerId } of this.roomDisplays) {
      const project = (point: WorldPoint) =>
        projectLocal(frame, camera, viewport, point);
      for (const polygon of room.polygons) {
        const ring = (points: readonly WorldPoint[]) =>
          this.rooms.poly(
            points.flatMap((p) => {
              const s = project(p);
              return [s.x, s.y];
            }),
            true,
          );
        ring(polygon.outer).fill({
          color: room.fill,
          alpha: room.floorAlpha ?? 1,
        });
        if (polygon.holes.length) {
          for (const hole of polygon.holes) ring(hole);
          this.rooms.cut();
        }
        const selected =
          this.selectedRoom?.ownerId === ownerId &&
          this.selectedRoom.roomId === room.id;
        for (const points of [polygon.outer, ...polygon.holes])
          ring(points).stroke({
            color: selected ? 0xe7b24e : room.wall,
            alpha: room.wallAlpha ?? 1,
            width: selected
              ? 2
              : Math.max(
                  1,
                  (room.wallWidth * frame.metersPerUnit) /
                    camera.metersPerPixel,
                ),
          });
      }
    }
    this.renderer.host.dataset.visibleCities = String(this.cityDisplays.length);
    this.renderer.host.dataset.visibleRooms = String(this.roomDisplays.length);
  }
  hit(screen: WorldPoint): SpatialHit | undefined {
    const camera = this.renderer.relativeCamera,
      viewport = this.renderer.viewport;
    for (const { room, frame, ownerId } of [...this.roomDisplays].reverse()) {
      const point = unprojectLocal(frame, camera, viewport, screen);
      if (
        room.polygons.some((p) => {
          if (
            (room.floorAlpha ?? 1) > 0 &&
            inside(point, p.outer) &&
            !p.holes.some((h) => inside(point, h))
          )
            return true;
          const tolerance =
            (camera.metersPerPixel * 6) / frame.metersPerUnit +
            room.wallWidth / 2;
          return (
            (room.wallAlpha ?? 1) > 0 &&
            [p.outer, ...p.holes].some((ring) =>
              ring.some(
                (a, i) =>
                  nearestSegmentPoint(point, a, ring[(i + 1) % ring.length]!)
                    .distance <= tolerance,
              ),
            )
          );
        })
      )
        return { kind: "room", ownerId, roomId: room.id };
    }
    for (const { scene, frame, nodes } of [...this.cityDisplays].reverse()) {
      const point = unprojectLocal(frame, camera, viewport, screen),
        hit = hitCity(scene, point, {
          toleranceMeters: (camera.metersPerPixel * 6) / frame.metersPerUnit,
          includeNodes: nodes,
        });
      if (hit) return { kind: "city", hit, frame };
    }
  }
  destroy(): void {
    for (const drawing of this.cities.values()) drawing.destroy();
    this.cities.clear();
    this.rooms.destroy();
  }
}
